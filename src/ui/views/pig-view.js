// Pig view: rendering and event presentation for the Pig screen.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderScoreStrip, renderTurnBar } from '../panels.js';
import { isMe, statusOverride } from '../avatars.js';
import { PIG } from '../pig-art.js';

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

const spaceOf = (score, n) => Math.min(n, Math.floor(score / STEP)); // 0 = still in the pen

// Put every pig (and the current player's ghost) on its space; pigs sharing a space are fanned out a little.
function placePigs(ui, view, st, animateGhost) {
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
  const pw = Math.min(46, Math.round(ui.cells[0].getBoundingClientRect().width * 1.4)); // the pigs shrink with the spaces on a narrow screen
  [...ui.pigs, ui.ghost].forEach((node) => { node.style.width = `${pw}px`; });
  const spots = view.seats.map((s) => spaceOf(s.total, n));
  const ghostSpace = view.turnPoints > 0 ? spaceOf(view.seats[view.current].total + view.turnPoints, n) : -1;
  const groups = {};
  spots.forEach((sp, i) => { (groups[sp] = groups[sp] || []).push(i); });
  const put = (node, sp, r, count, shiftX) => {
    const p = at(sp);
    const w = pw;
    const h = w * PIG.h / PIG.w;
    const k = r - (count - 1) / 2;
    node.style.left = `${Math.max(2, Math.min(tb.width - w - 2, p.x - w / 2 + k * 4 + (shiftX || 0)))}px`;
    node.style.top = `${p.y - h / 2 + k * 7}px`;
    node.classList.toggle('flip', p.left);
  };
  view.seats.forEach((s, i) => {
    const node = ui.pigs[i];
    const g = groups[spots[i]];
    put(node, spots[i], g.indexOf(i), g.length, 0);
    node.style.zIndex = i === view.current ? 6 : 4;
  });
  const ghostWasHidden = ui.ghost.hidden;
  ui.ghost.hidden = ghostSpace < 0;
  if (ghostSpace >= 0) {
    if (ghostWasHidden) ui.ghost.classList.add('pgnomove');
    ui.ghost.querySelector('.pg-col').style.background = colorOf(view, view.current);
    const g = groups[ghostSpace] || [];
    put(ui.ghost, ghostSpace, g.length, g.length + 1, 0);
    if (ghostWasHidden) { void ui.ghost.offsetWidth; ui.ghost.classList.remove('pgnomove'); }
  }
  tr.setAttribute('aria-label', `Track to the barn at ${st.options.target}: ${view.seats.map((s) => `${s.name} ${s.total}`).join(', ')}`);
}

const seatsView = (state) => state.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns }));

export const pigView = {
  title: 'PIG',

  rulesSheet(sheet) {
    sheet.appendChild(el('h2', null, 'How to play Pig'));
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
    return `Target ${h.target} · ${h.dice === 1 ? 'one die' : 'two dice'}${mode !== 'solo' && h.equalTurns ? ' · equal turns' : ''}`;
  },

  init(session) {
    return this.sync(null, session);
  },

  sync(_view, session) {
    const st = session.state;
    return { seats: seatsView(st), current: st.current, turnPoints: st.turn.points, dice: st.turn.dice.slice(), banner: '' };
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
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (ui.lastView) placePigs(ui, ui.lastView, ui.lastState); }).observe(ui.track); // rotate or resize: put the pigs back
  },

  // The racing-pigs track: a pen, the spaces as a snake of rows (5 points a space) and the barn that shows the target.
  renderTrack(ui, view, st, ctx) {
    const target = st.options.target;
    const n = Math.round(target / STEP);
    const key = `${target}:${view.seats.length}`;
    if (ui.trackKey !== key) {
      ui.trackKey = key;
      ui.track.classList.add('pgfresh');
      ui.cellCount = n;
      ui.track.innerHTML = '';
      ui.pen = el('div', 'pgpen', 'START');
      ui.cells = [];
      const grid = el('div', 'pggrid');
      for (let i = 1; i <= n; i++) {
        const row = Math.floor((i - 1) / PER_ROW);
        const col = (i - 1) % PER_ROW;
        const c = el('div', 'pgcell' + (i === n ? ' barn' : ''));
        c.style.gridArea = `${row + 1} / ${(row % 2 === 0 ? col : PER_ROW - 1 - col) + 1}`;
        if (i === n) c.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 11 L12 3 L22 11 V21 H2 Z" fill="#b4472f" stroke="#fde68a" stroke-width="1.2"/><rect x="9" y="13" width="6" height="8" fill="#fde68a"/></svg><b>${target}</b>`;
        else if ((i * STEP) % 25 === 0) c.appendChild(el('b', null, String(i * STEP)));
        grid.appendChild(c);
        ui.cells.push(c);
      }
      ui.track.append(ui.pen, grid);
      ui.pigs = view.seats.map((_, i) => pigEl(colorOf(view, i), 'pgreal'));
      ui.ghost = pigEl(colorOf(view, view.current), 'pgghost');
      ui.ghost.hidden = true;
      ui.pigs.forEach((pg, i) => { pg.setAttribute('role', 'img'); pg.setAttribute('aria-label', view.seats[i].name); ui.track.appendChild(pg); });
      ui.track.appendChild(ui.ghost);
    }
    ui.pigs.forEach((pg, i) => { pg.querySelector('.pg-col').style.background = colorOf(view, i); pg.setAttribute('aria-label', `${view.seats[i].name} at ${view.seats[i].total}`); });
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
        const a = g.animate([{ transform: 'rotate(0deg)', opacity: 0.55 }, { transform: 'rotate(540deg) scale(0.6)', opacity: 0 }], { duration: 700, easing: 'ease-in' });
        a.onfinish = () => g.remove();
      }
    }
    const fresh = ui.track.classList.contains('pgfresh');
    placePigs(ui, view, st);
    if (fresh) { void ui.track.offsetWidth; ui.track.classList.remove('pgfresh'); }
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    renderScoreStrip(ui.scores, view.seats, view.current, view.turnPoints, undefined, { target: st.options.target });
    this.renderTrack(ui, view, st, ctx);
    ui.dice.innerHTML = '';
    ui.dice.className = 'dice' + (st.options.dice === 2 ? ' two' : '');
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
        view.banner = ev.reset ? 'DOUBLE ONES! TOTAL RESET' : ev.lost > 0 ? `BUST! −${ev.lost}` : 'BUST!';
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
