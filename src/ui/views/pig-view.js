// Pig view: rendering and event presentation for the Pig screen.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderScoreStrip, renderTurnBar } from '../panels.js';
import { isMe, statusOverride } from '../avatars.js';
import { PIG } from '../pig-art.js';
import { PENGUIN, IGLOO, BUCKET } from '../penguin-art.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};


const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const colorOf = (view, i) => view.seats[i].color || SEAT_COLORS[i];
const PER_ROW = 10; // spaces in a row of the track; one space is 5 points
const STEP = 5;

// The pig is two CSS masks (a dark base and the player's color on top); the data URIs go in one style element, once.
function ensurePigCss() {
  if (document.getElementById('pig-art-css')) return;
  const st = document.createElement('style');
  st.id = 'pig-art-css';
  st.textContent = `.pgl.pg-base{-webkit-mask-image:url("${PIG.base}");mask-image:url("${PIG.base}")}\n.pgl.pg-col{-webkit-mask-image:url("${PIG.col}");mask-image:url("${PIG.col}")}`;
  document.head.appendChild(st);
}

// A pig: faces right; `left` mirrors it.
function pigEl(color, cls) {
  const w = el('span', `pgw${cls ? ' ' + cls : ''}`);
  const base = el('span', 'pgl pg-base');
  base.style.background = '#0b1220';
  const col = el('span', 'pgl pg-col');
  col.style.background = color;
  w.append(base, col);
  return w;
}

// The Penguin slide look: the penguin is drawn once in a hidden <svg> and every racer is a <use> of it, with the player's color (the scarf) in --c.
const FISH = '#8b939b'; // the fish in the bucket: mid gray; the pail is ice blue
function ensurePenguinDefs() {
  if (document.getElementById('pg-penguin-defs')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'pg-penguin-defs';
  s.setAttribute('width', '0');
  s.setAttribute('height', '0');
  s.setAttribute('aria-hidden', 'true');
  s.style.position = 'absolute';
  s.innerHTML = `<defs><clipPath id="pg-peng-clip"><path d="${PENGUIN.outer}"/></clipPath>`
    + `<g id="pg-peng"><path d="${PENGUIN.body}" fill="#ffffff"/><path d="${PENGUIN.body}" fill="#050505" fill-rule="evenodd"/><path d="${PENGUIN.beak}" fill="#D99A79" fill-rule="evenodd"/>`
    + `<g clip-path="url(#pg-peng-clip)"><path d="M1070 150 L1200 340" stroke="var(--c)" stroke-width="64"/><path d="M1070 150 L1200 340" stroke="#000" stroke-opacity=".18" stroke-width="8" transform="translate(-14 -8)"/></g></g></defs>`;
  document.body.appendChild(s);
}

// A penguin racer: faces right; the scarf is the player's color.
function penguinEl(color, cls) {
  const w = el('span', `pgw pguin${cls ? ' ' + cls : ''}`);
  w.style.setProperty('--c', color);
  w.innerHTML = `<svg viewBox="${PENGUIN.vb}" width="100%" height="100%" aria-hidden="true"><use href="#pg-peng"/></svg>`;
  return w;
}
const racerEl = (penguin, color, cls) => (penguin ? penguinEl(color, cls) : pigEl(color, cls));
const setRacerColor = (node, color) => { if (node.classList.contains('pguin')) node.style.setProperty('--c', color); else node.querySelector('.pg-col').style.background = color; };
// How a racer is turned for a heading in degrees: a pig turns round; a penguin stays on its belly and only faces left or right (it flips at a bend).
const turnOf = (ui, deg) => {
  if (!ui.penguin) return `rotate(${deg}deg)`;
  const a = ((deg % 360) + 360) % 360;
  return `scaleX(${a > 90 && a < 270 ? -1 : 1})`;
};

const spaceOf = (score, n) => Math.min(n, Math.floor(score / STEP)); // 0 = still in the pen

// The trail: one dirt path through the space centers (a snake of rows with rounded bends), a stone at every space, signposts
// at 25, 50, 75 ..., the gate of the pen and the barn at the end. Drawn from the measured positions, so it is redone on resize.
function geometry(ui) {
  const tb = ui.track.getBoundingClientRect();
  const c = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2 - tb.left, y: r.top + r.height / 2 - tb.top }; };
  const pen = ui.pen.getBoundingClientRect();
  const cells = ui.cells.map(c);
  const rh = cells.length > PER_ROW ? cells[PER_ROW].y - cells[0].y : ui.cells[0].getBoundingClientRect().height * 1.6;
  const edge = Math.min(32, Math.max(16, rh * 0.74)); // the lanes get wider as the rows get taller, up to a limit
  const fill = Math.min(25, Math.max(12, rh * 0.6));
  const room = Math.min(cells[0].x, tb.width - cells[Math.min(PER_ROW, cells.length) - 1].x); // from the end of a row to the edge of the track
  const rx = Math.max(6, Math.min(rh / 2, room - edge / 2 - 2)); // a bend is half an ellipse: as tall as the rows are far apart, but never wider than the room at the end of a row
  return { tb, cells, rh, rx, edge, fill, penC: c(ui.pen), gate: { x: cells[0].x, y: pen.bottom - tb.top } };
}

function drawTrail(ui, target) {
  if (!ui.svg || !ui.cells || !ui.cells.length) return;
  const g = geometry(ui);
  if (!g.tb.width) return;
  const n = g.cells.length;
  const f = (v) => v.toFixed(1);
  const rows = Math.ceil(n / PER_ROW);
  let d = `M${f(g.gate.x)} ${f(g.gate.y + Math.max(0, g.edge / 2 - 6))} L${f(g.cells[0].x)} ${f(g.cells[0].y)}`; // starts a little below the gate so the round end of the lane stays off the word START
  for (let r = 0; r < rows; r++) {
    const endI = Math.min(n, (r + 1) * PER_ROW) - 1;
    const e = g.cells[endI];
    d += ` L${f(e.x)} ${f(e.y)}`;
    if (r < rows - 1) d += ` A${f(g.rx)} ${f(g.rh / 2)} 0 0 ${r % 2 === 0 ? 1 : 0} ${f(e.x)} ${f(e.y + g.rh)}`;
  }
  const { edge, fill } = g;
  const pg = !!ui.penguin;
  const C = pg ? { edge: '#5b9cc0', fill: '#d7eef9', dot: '#9fd0e6', post: '#e8f6ff', postLine: '#7fb6d4', num: '#18516e' } : { edge: '#5b4023', fill: '#8a6a3f', dot: '#4a3319', post: '#5b3a1a', postLine: '#d6b36a', num: '#fde68a' };
  let h = `<path d="${d}" fill="none" stroke="${C.edge}" stroke-width="${f(edge)}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${d}" fill="none" stroke="${C.fill}" stroke-width="${f(fill)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  g.cells.forEach((c, i) => { if (i < n - 1) h += `<circle cx="${f(c.x)}" cy="${f(c.y)}" r="2" fill="${C.dot}"/>`; });
  // a stone at the middle of every bend (not a space: no pig stops on it)
  for (let r = 0; r < rows - 1; r++) {
    const e = g.cells[Math.min(n, (r + 1) * PER_ROW) - 1];
    h += `<circle cx="${f(e.x + (r % 2 === 0 ? 1 : -1) * g.rx)}" cy="${f(e.y + g.rh / 2)}" r="2" fill="${C.dot}"/>`;
  }
  // signposts at every 25 points, in the gap under their row (pulled in from the bends)
  g.cells.forEach((c, i) => {
    const space = i + 1;
    if (space >= n || (space * STEP) % 25 !== 0) return;
    const rowEnd = space % PER_ROW === 0;
    const inward = rowEnd ? (Math.floor(i / PER_ROW) % 2 === 0 ? -1 : 1) * Math.min(g.rh, 40) * 0.8 : 0;
    const x = c.x + inward;
    const y = c.y + edge / 2 + 5;
    h += `<rect x="${f(x - 10)}" y="${f(y - 6)}" width="20" height="12" rx="2.5" fill="${C.post}" stroke="${C.postLine}" stroke-width="1"/>`
      + `<text x="${f(x)}" y="${f(y + 3)}" font-size="12" font-weight="700" text-anchor="middle" fill="${C.num}">${space * STEP}</text>`;
  });
  // the gate of the pen: two posts, one leaf swung open (an igloo in the Penguin slide look)
  const gx = g.gate.x;
  const gy = g.gate.y;
  if (pg) h += `<svg x="${f(gx - 23)}" y="${f(gy - 40)}" width="46" height="46" viewBox="0 0 512 512">${IGLOO.map(([c, p]) => `<path fill="${c}" d="${p}"/>`).join('')}</svg>`;
  else h += `<rect x="${f(gx - 15)}" y="${f(gy - 6)}" width="4" height="12" rx="1" fill="#d6b36a"/><rect x="${f(gx + 11)}" y="${f(gy - 6)}" width="4" height="12" rx="1" fill="#d6b36a"/>`
    + `<path d="M${f(gx - 11)} ${f(gy - 2)} L${f(gx - 22)} ${f(gy + 7)}" stroke="#d6b36a" stroke-width="2.5" stroke-linecap="round"/>`;
  // the barn at the end: about 1.5 x its old size, the target on the left of the central door
  const b = g.cells[n - 1];
  if (pg) h += `<svg x="${f(b.x - 22)}" y="${f(b.y - 36)}" width="44" height="44" viewBox="0 0 512 512"><path fill="#8fd0ee" d="${BUCKET.pail}"/><path fill="${FISH}" d="${BUCKET.fish}"/></svg>`
    + `<rect x="${f(b.x - 15)}" y="${f(b.y + edge / 2 - 3)}" width="30" height="14" rx="3" fill="#fff0c8" stroke="#f5c542" stroke-width="1"/><text x="${f(b.x)}" y="${f(b.y + edge / 2 + 8)}" font-size="12" font-weight="800" text-anchor="middle" fill="#7a4a00">${target}</text>`;
  else h += `<g transform="translate(${f(b.x - 26)} ${f(b.y - 19)})"><path d="M0 16 L26 1 L52 16 V38 H0 Z" fill="#b4472f" stroke="#fde68a" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<rect x="21.5" y="22" width="9" height="16" fill="#fde68a"/><text x="10.5" y="32" font-size="12" font-weight="800" text-anchor="middle" fill="#fde68a">${target}</text></g>`;
  ui.svg.setAttribute('viewBox', `0 0 ${f(g.tb.width)} ${f(g.tb.height)}`);
  ui.svg.setAttribute('width', f(g.tb.width));
  ui.svg.setAttribute('height', f(g.tb.height));
  ui.svg.innerHTML = h;
}

// The points a pig walks through from one space to another: out of the pen through the gate, along the trail and around
// the bends (the bend point is the far side of the half circle the trail makes).
function walkPoints(ui, from, to) {
  const g = geometry(ui);
  const pts = (a, b) => { // a < b
    const out = [a === 0 ? { ...g.penC, pen: true } : g.cells[a - 1]];
    if (a === 0) out.push({ ...g.gate, gate: true });
    for (let sp = Math.max(a, 0) + 1; sp <= b; sp++) {
      if (sp - 1 >= 1 && (sp - 1) % PER_ROW === 0) {
        const prev = g.cells[sp - 2];
        const dir = Math.floor((sp - 2) / PER_ROW) % 2 === 0 ? 1 : -1;
        out.push({ x: prev.x + dir * g.rx, y: prev.y + g.rh / 2, apex: true });
      }
      out.push(g.cells[sp - 1]);
    }
    return out;
  };
  return from < to ? pts(from, to) : pts(to, from).reverse();
}

// Put every pig (and the current player's ghost) on its space; pigs sharing a space are fanned out a little. A pig whose
// space changed walks there along the trail (not with `ctx` missing, a reduced-motion screen or the fast test mode).
function placePigs(ui, view, st, ctx) {
  const tr = ui.track;
  if (!tr || !ui.cells) return;
  const n = ui.cellCount;
  const tb = tr.getBoundingClientRect();
  if (!tb.width) return;
  const at = (space) => {
    const e = space === 0 ? ui.pen : ui.cells[space - 1];
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2 - tb.left, y: r.top + r.height / 2 - tb.top, left: space > 0 && Math.floor((space - 1) / PER_ROW) % 2 === 1 };
  };
  const cw = ui.cells[0].getBoundingClientRect().width;
  const pw = ui.penguin ? Math.min(72, Math.round(cw * 2.2)) : Math.min(46, Math.round(cw * 1.4)); // the racers shrink with the spaces on a narrow screen
  const ph = ui.penguin ? pw * PENGUIN.h / PENGUIN.w : pw * PIG.h / PIG.w;
  [...ui.pigs, ui.ghost].forEach((node) => { node.style.width = `${pw}px`; });
  const canWalk = !!(ctx && !ctx.reduced && !document.body.classList.contains('fast') && ui.pigs[0].animate);
  const spots = view.seats.map((sp) => spaceOf(sp.total, n));
  const ghostSpace = view.turnPoints > 0 ? spaceOf(view.seats[view.current].total + view.turnPoints, n) : -1;
  const groups = {};
  spots.forEach((sp, i) => { (groups[sp] = groups[sp] || []).push(i); });
  const finalXY = (sp, r, count) => {
    const p = at(sp);
    const k = r - (count - 1) / 2;
    return { x: Math.max(2, Math.min(tb.width - pw - 2, p.x - pw / 2 + k * (ui.penguin ? 10 : 4))), y: p.y - ph / 2 + k * (ui.penguin ? 8 : 7), rot: p.left ? 180 : 0 }; // racers sharing a space are fanned out (penguins are wider, so more)
  };
  const setNode = (node, xy) => {
    node.style.left = `${xy.x}px`;
    node.style.top = `${xy.y}px`;
    node._rot = ((xy.rot % 360) + 360) % 360;
    node.style.transform = turnOf(ui, node._rot);
  };
  // walk `node` from space `a` to `b`, ending at `end`
  const walk = (node, a, b, end) => {
    const token = {};
    node._walk = token;
    node.classList.add('pgwalk');
    const raw = walkPoints(ui, a, b);
    const pts = raw.map((q) => ({ x: q.x - pw / 2, y: q.y - ph / 2 }));
    pts[pts.length - 1] = { x: end.x, y: end.y };
    // the heading (degrees, 0 = right, 90 = down, 180 = left, 270 = up) the pig has at every point: along the row it walks, down or up at a
    // bend dot or the gate; a bend turns it through 90 degrees
    const dirOf = (i0, i1) => { const dx = raw[i1].x - raw[i0].x; const dy = raw[i1].y - raw[i0].y; return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 180) : (dy >= 0 ? 90 : 270); };
    const heads = raw.map((q, i) => {
      if (q.apex) return raw[i].y > raw[i - 1].y ? 90 : 270;
      const out = i + 1 < raw.length ? dirOf(i, i + 1) : null;
      const inn = i > 0 ? dirOf(i - 1, i) : null;
      if (out !== null && (out === 0 || out === 180)) return out;
      return inn !== null ? inn : out;
    });
    heads[0] = node._rot || 0;
    heads[heads.length - 1] = end.rot;
    const rots = [heads[0]];
    for (let k = 1; k < heads.length; k++) { let d = ((heads[k] - heads[k - 1]) % 360 + 540) % 360 - 180; rots.push(rots[k - 1] + d); } // turn the short way
    const lens = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y));
    const sum = lens.reduce((x, y) => x + y, 0) || 1;
    const total = Math.min(1200, 120 * Math.max(1, Math.abs(b - a)));
    let i = 1;
    const finish = () => {
      if (node._walk !== token) return;
      node.classList.remove('pgwalk');
      setNode(node, end);
      if (ui.resizePending && ![...ui.pigs, ui.ghost].some((x) => x.classList.contains('pgwalk'))) { ui.resizePending = false; placePigs(ui, ui.lastView, ui.lastState); } // the track was resized during the walk: settle the pigs on the new one
    };
    const next = () => {
      if (node._walk !== token) return;
      if (i >= pts.length) { finish(); return; }
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const an = node.animate([{ left: `${p0.x}px`, top: `${p0.y}px`, transform: turnOf(ui, rots[i - 1]) }, { left: `${p1.x}px`, top: `${p1.y}px`, transform: turnOf(ui, rots[i]) }], { duration: Math.max(30, total * lens[i - 1] / sum), easing: 'linear', fill: 'forwards' });
      an.onfinish = () => { node.style.left = `${p1.x}px`; node.style.top = `${p1.y}px`; node.style.transform = turnOf(ui, rots[i]); node._rot = ((rots[i] % 360) + 360) % 360; an.cancel(); i++; next(); };
    };
    setNode(node, { x: pts[0].x, y: pts[0].y, rot: heads[0] });
    next();
  };
  view.seats.forEach((sp, i) => {
    const node = ui.pigs[i];
    const g = groups[spots[i]];
    const end = finalXY(spots[i], g.indexOf(i), g.length);
    const was = ui.pigAt[i];
    ui.pigAt[i] = spots[i];
    node.style.zIndex = i === view.current ? 6 : 4;
    if (canWalk && was !== undefined && was !== spots[i]) walk(node, was, spots[i], end);
    else if (!node._walk || !node.classList.contains('pgwalk')) setNode(node, end);
    else if (was === spots[i] && !canWalk) { node._walk = null; node.classList.remove('pgwalk'); setNode(node, end); }
  });
  const ghostWasHidden = ui.ghost.hidden;
  ui.ghost.hidden = ghostSpace < 0;
  if (ghostSpace >= 0) {
    setRacerColor(ui.ghost, colorOf(view, view.current));
    const g = groups[ghostSpace] || [];
    const end = finalXY(ghostSpace, g.length, g.length + 1);
    const from = ghostWasHidden ? spots[view.current] : ui.ghostAt;
    ui.ghostAt = ghostSpace;
    if (ghostWasHidden) ui.ghost.classList.add('pgnomove');
    if (canWalk && from !== undefined && from !== ghostSpace) {
      ui.ghost.classList.remove('pgnomove');
      walk(ui.ghost, from, ghostSpace, end);
    } else {
      ui.ghost._walk = null;
      ui.ghost.classList.remove('pgwalk');
      setNode(ui.ghost, end);
      if (ghostWasHidden) { void ui.ghost.offsetWidth; ui.ghost.classList.remove('pgnomove'); }
    }
  } else { ui.ghost._walk = null; ui.ghost.classList.remove('pgwalk'); ui.ghostAt = undefined; }
  tr.setAttribute('aria-label', `Track to the ${ui.penguin ? 'fish bucket' : 'barn'} at ${st.options.target}: ${view.seats.map((sp) => `${sp.name} ${sp.total}`).join(', ')}`);
}

const seatsView = (state) => state.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns }));

export const pigView = {
  title: 'PIG',

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Pig'));
    if (options && options.skin === 'penguin') sheet.appendChild(el('p', null, 'Penguin slide: the penguins race to the fish bucket. A 1 is thin ice: the ice cracks and the penguin loses the turn points.'));
    ['On your turn, roll the die as many times as you like.',
     'Each roll adds to your turn points, unless you roll a 1: you lose the turn points and your turn ends.',
     'Press BANK any time to add your turn points to your total and pass the die.',
     'First to reach the target wins.',
     'Two-dice option: a single 1 loses your turn points; double 1s also wipe your whole total.',
     'Equal turns option: when someone reaches the target, everyone gets the same number of turns, and the highest total wins.',
     'Solo: reach the target in as few turns as you can.']
      .forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h, mode) {
    return `Target ${h.target} · ${h.dice === 1 ? 'one die' : 'two dice'}${mode !== 'solo' && h.equalTurns ? ' · equal turns' : ''}${h.skin === 'penguin' ? ' · penguin slide' : ''}`;
  },

  init(session) {
    return this.sync(null, session);
  },

  sync(_view, session) {
    const st = session.state;
    return { seats: seatsView(st), current: st.current, turnPoints: st.turn.points, dice: st.turn.dice.slice(), banner: '', skin: st.options.skin === 'penguin' ? 'penguin' : 'pig' };
  },

  build(ui) {
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    ui.dice = el('div', 'dice');
    ui.turnline = el('div', 'turnline');
    ensurePigCss();
    ui.track = el('div', 'pgtrack');
    ui.track.setAttribute('role', 'img');
    ui.table.append(ui.track, ui.banner, ui.dice, ui.turnline);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { // rotate or resize (the browser's address bar showing or hiding changes the height too): redraw the trail and put the pigs back, but never cut a walk short
      if (!ui.lastView) return;
      drawTrail(ui, ui.target);
      if ([...ui.pigs, ui.ghost].some((node) => node.classList.contains('pgwalk'))) ui.resizePending = true;
      else placePigs(ui, ui.lastView, ui.lastState);
    }).observe(ui.track);
  },

  // The racing-pigs track: a pen, the spaces as a snake of rows (5 points a space) and the barn that shows the target.
  renderTrack(ui, view, st, ctx) {
    const target = st.options.target;
    const n = Math.round(target / STEP);
    const key = `${target}:${view.seats.length}:${view.skin}`;
    if (ui.trackKey !== key) {
      ui.trackKey = key;
      ui.penguin = view.skin === 'penguin';
      ui.track.classList.toggle('penguin', ui.penguin);
      if (ui.penguin) ensurePenguinDefs();
      ui.track.classList.add('pgfresh');
      ui.cellCount = n;
      ui.track.innerHTML = '';
      ui.pen = el('div', 'pgpen', 'START');
      ui.cells = [];
      ui.pigAt = [];
      ui.ghostAt = undefined;
      ui.target = target;
      ui.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ui.svg.setAttribute('class', 'pgsvg');
      ui.svg.setAttribute('aria-hidden', 'true');
      const grid = el('div', 'pggrid');
      for (let i = 1; i <= n; i++) {
        const row = Math.floor((i - 1) / PER_ROW);
        const col = (i - 1) % PER_ROW;
        const c = el('div', 'pgcell');
        c.style.gridArea = `${row + 1} / ${(row % 2 === 0 ? col : PER_ROW - 1 - col) + 1}`;
        grid.appendChild(c);
        ui.cells.push(c);
      }
      ui.track.append(ui.svg, ui.pen, grid);
      ui.pigs = view.seats.map((_, i) => racerEl(ui.penguin, colorOf(view, i), 'pgreal'));
      ui.ghost = racerEl(ui.penguin, colorOf(view, view.current), 'pgghost');
      ui.ghost.hidden = true;
      ui.pigs.forEach((pg, i) => { pg.setAttribute('role', 'img'); pg.setAttribute('aria-label', view.seats[i].name); ui.track.appendChild(pg); });
      ui.track.appendChild(ui.ghost);
    }
    ui.pigs.forEach((pg, i) => { setRacerColor(pg, colorOf(view, i)); pg.setAttribute('aria-label', `${view.seats[i].name} at ${view.seats[i].total}`); });
    ui.lastView = view;
    ui.lastState = st;
    if (view.ghostFall) { // a bust: the ghost pig tumbles into the mud and is gone
      const f = view.ghostFall;
      view.ghostFall = null;
      placePigs(ui, { ...view, turnPoints: f.points }, st);
      if (!ctx.reduced && ui.ghost.animate) {
        const g = ui.ghost.cloneNode(true);
        g.hidden = false;
        g.classList.add('pgfall');
        ui.track.appendChild(g);
        const r0 = ui.ghost._rot || 0;
        if (ui.penguin) { // thin ice: a hole opens, the ghost penguin flips onto its back there and is gone
          const t = turnOf(ui, r0);
          const hole = el('span', 'pgcrack');
          hole.style.left = `${ui.ghost.offsetLeft + ui.ghost.offsetWidth / 2 - 16}px`;
          hole.style.top = `${ui.ghost.offsetTop + ui.ghost.offsetHeight / 2 - 8}px`;
          hole.innerHTML = '<svg viewBox="0 0 32 16" width="32" height="16" aria-hidden="true"><ellipse cx="16" cy="8" rx="15" ry="6.5" fill="#0b2a44"/><path d="M3 5l5 2-2 3 6 1M29 4l-4 3 4 2M16 2l-1 4 3 1" stroke="#fff" stroke-width="1" fill="none"/></svg>';
          ui.track.insertBefore(hole, g);
          hole.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1100 }).onfinish = () => hole.remove();
          g.animate([{ transform: t, opacity: 0.55 }, { transform: `${t} scaleY(-1)`, opacity: 0.95, offset: 0.3 }, { transform: `${t} scaleY(-1)`, opacity: 0.95, offset: 0.7 }, { transform: `${t} scaleY(-1) scale(0.6)`, opacity: 0 }], { duration: 1100 }).onfinish = () => g.remove();
        } else {
          const a = g.animate([{ transform: `rotate(${r0}deg)`, opacity: 0.55 }, { transform: `rotate(${r0 + 540}deg) scale(0.6)`, opacity: 0 }], { duration: 700, easing: 'ease-in' });
          a.onfinish = () => g.remove();
        }
      }
    }
    const fresh = ui.track.classList.contains('pgfresh');
    if (fresh || !ui.svg.firstChild) drawTrail(ui, ui.target);
    placePigs(ui, view, st, ctx);
    if (fresh) { void ui.track.offsetWidth; ui.track.classList.remove('pgfresh'); }
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    renderScoreStrip(ui.scores, view.seats.map((s, i) => ({ ...s, swatch: colorOf(view, i) })), view.current, view.turnPoints, undefined, { target: st.options.target });
    this.renderTrack(ui, view, st, ctx);
    ui.dice.innerHTML = '';
    ui.dice.className = 'dice pig' + (st.options.dice === 2 ? ' two' : '');
    for (let i = 0; i < st.options.dice; i++) {
      ui.dice.appendChild(renderDie(view.dice[i] ?? null, { tumble: ctx.tumble && !ctx.reduced }));
    }
    const cur = view.seats[view.current];
    ui.turnline.innerHTML = '';
    const said = statusOverride(view, cur, session.isOver());
    if (said) ui.turnline.textContent = said;
    else if (!session.isOver()) {
      if (isMe(cur)) ui.turnline.append(document.createTextNode('Your turn'));
      else ui.turnline.append(el('strong', null, cur.name), document.createTextNode(cur.isBot ? ' is thinking…' : "'s turn"));
    }
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner;
    const humanTurn = !session.isOver() && !cur.isBot && !ctx.busy;
    renderTurnBar(ui.controls, [
      { label: 'ROLL', cls: 'btn-roll', disabled: !humanTurn, onClick: () => ctx.act([{ type: 'ROLL' }]) },
      { label: 'BANK', cls: 'btn-bank', disabled: !(humanTurn && st.turn.points > 0 && view.turnPoints > 0), onClick: () => ctx.act([{ type: 'BANK' }]) },
    ]);
  },

  // Mutates the view for one event; returns how long to show it and whether dice tumble.
  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'ROLLED':
        view.dice = ev.dice.slice();
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS; // nothing result-dependent shows until the dice have stopped and 0.25 s have passed
        after = `${name(ev.seat)} rolled ${ev.dice.join(' and ')}`; // spoken once the dice have settled
        break;
      case 'SCORED':
        view.turnPoints = ev.turnPoints;
        ctx.log(`${name(ev.seat)} +${ev.gain} (turn ${ev.turnPoints})`);
        delay = 250;
        break;
      case 'BUSTED':
        if (view.turnPoints > 0) view.ghostFall = { points: view.turnPoints };
        view.turnPoints = 0;
        view.banner = ev.reset ? 'DOUBLE ONES! TOTAL RESET' : `${view.skin === 'penguin' ? 'THIN ICE!' : 'BUST!'}${ev.lost > 0 ? ` −${ev.lost}` : ''}`;
        if (ev.reset) view.seats[ev.seat].total = 0;
        ctx.log(`${name(ev.seat)} busted${ev.reset ? ' and lost their total' : ''}`);
        ctx.announce(`${name(ev.seat)} busted`);
        ctx.vibrate();
        delay = ctx.reduced ? 600 : 1200;
        break;
      case 'BANKED':
        view.turnPoints = 0;
        view.seats[ev.seat].total = ev.total;
        ctx.log(`${name(ev.seat)} banked ${ev.amount} (total ${ev.total})`);
        ctx.announce(`${name(ev.seat)} banked ${ev.amount}, total ${ev.total}`);
        delay = 450;
        break;
      case 'TURN_ENDED':
        view.banner = '';
        view.seats[ev.seat].turns += 1;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.turnPoints = 0;
        view.dice = [];
        delay = 200;
        break;
      default:
        break;
    }
    return { delay, tumble, after };
  },
};
