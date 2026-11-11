// Deep Dive view: the air, the line of chips as a snake with a path line and depth bands, the divers, the dice and the choices.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { statusOverride } from '../avatars.js';
import { DIVER } from '../diver.js';
import { points, pipsOf, canTurnBack } from '../../games/dive.js';

// All the theme words live here so another skin is a small change.
const THEME = {
  title: 'DEEP DIVE',
  tagline: 'Share the air. Beat the others to the deep.',
  airGone: "Air's gone!",
  back: (amount) => `Back on board: +${amount}`,
  lost: 'Lost it all!',
  diveDone: (n) => `Dive ${n} done`,
  win: 'Best haul of the day.',
};
const SHAPES = {
  1: { c: '#c98a4b', clip: 'polygon(50% 6%,94% 90%,6% 90%)' },
  2: { c: '#a9b4c0', clip: 'polygon(8% 8%,92% 8%,92% 92%,8% 92%)' },
  3: { c: '#e0a82e', clip: 'polygon(50% 4%,96% 38%,78% 94%,22% 94%,4% 38%)' },
  4: { c: '#d1495b', clip: 'polygon(25% 6%,75% 6%,98% 50%,75% 94%,25% 94%,2% 50%)' },
};
const SKIN = ['#ffcc4d', '#f7dece', '#f3d2a2', '#d5ab88', '#af7e57', '#7c533e']; // the avatar's skin-tone modifier picks one; none is yellow
const skinOf = (face) => { const m = /[\u{1F3FB}-\u{1F3FF}]/u.exec(face || ''); return m ? SKIN[m[0].codePointAt(0) - 0x1F3FA] : SKIN[0]; };
const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const colorOf = (view, i) => view.seats[i].color || SEAT_COLORS[i];
const PIPS = [1, 1, 2, 2, 3, 3];

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// The four diver layers are CSS masks; the data URIs are put in one style element, once.
function ensureDiverCss() {
  if (document.getElementById('dive-diver-css')) return;
  const st = document.createElement('style');
  st.id = 'dive-diver-css';
  st.textContent = ['outline', 'skin', 'body', 'gear'].map((k) => `.dvl.dv-${k}{-webkit-mask-image:url("${DIVER[k]}");mask-image:url("${DIVER[k]}")}`).join('\n');
  document.head.appendChild(st);
}

// A diver: four stacked layers (white rim, skin tone, dark suit, the player's color on the gear). It faces right; `left` mirrors it.
function diver(color, skin, left, label, cls) {
  const w = el('span', `dvw${cls ? ' ' + cls : ''}${left ? ' flip' : ''}`);
  [['outline', '#fff'], ['skin', skin], ['body', '#0b1220'], ['gear', color]].forEach(([k, bg]) => {
    const l = el('span', `dvl dv-${k}`);
    l.style.background = bg;
    w.appendChild(l);
  });
  w.setAttribute('role', 'img');
  w.setAttribute('aria-label', label);
  return w;
}

const shapeOf = (view, slot) => Math.max(...slot.chips.map((id) => view.levels[id]));
const carriedCount = (view, i) => view.divers[i].carried.length;

// The line through the middle of every chip, from the sub: drawn behind the chips and the divers.
function drawLine(ui) {
  const pa = ui.path;
  const svg = pa && pa.querySelector('.pathsvg');
  if (!svg) return;
  const pr = pa.getBoundingClientRect();
  const sub = pa.querySelector('.subpill');
  const cells = [...pa.querySelectorAll('.ch')].sort((a, b) => a.dataset.i - b.dataset.i);
  if (!pr.width || !cells.length) return;
  const c = (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2 - pr.left, r.top + r.height / 2 - pr.top]; };
  const pts = (sub ? [[c(sub)[0], sub.getBoundingClientRect().bottom - pr.top - 4]] : []).concat(cells.map(c));
  svg.setAttribute('viewBox', `0 0 ${pr.width} ${pr.height}`);
  svg.setAttribute('width', pr.width);
  svg.setAttribute('height', pr.height);
  const f = (n) => n.toFixed(1);
  svg.innerHTML = `<path d="M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L')}" fill="none" stroke="rgba(186,230,253,0.55)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
    + cells.map((e) => { const p = c(e); return `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="2.2" fill="rgba(186,230,253,0.8)"/>`; }).join('');
}

export const diveView = {
  title: THEME.title,

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Deep Dive'));
    sheet.appendChild(el('p', 'tagline', THEME.tagline));
    [
      `You and the other divers share one submarine and one tank of air. A line of 32 treasure chips runs away from the sub, shallow chips first and the richest deepest. The more you carry, the faster the air runs out for everyone. The game is ${options.dives} dives; the most points at the end wins.`,
      'Each chip shows only its level (the shape); nobody knows its points until a diver brings it back.',
      `Each dive starts with ${options.air} air. On your turn: first you breathe (the air drops by the number of chips you carry). Then you may turn back toward the sub, once per dive${options.turnBack === 'free' ? '' : ' and only while carrying treasure'}. Then you roll the two dice (1 to 3 each), subtract the chips you carry, and swim that many chips. You jump over chips where other divers are, without counting them. If you pass the sub, you are back on board.`,
      'After swimming you may pick up the chip you are on (you can carry any number), drop one of yours on an empty spot, or do nothing.',
      'A dive ends when the air runs out (that turn is the last) or everyone is back. Divers who are back reveal their chips and keep them. The rest lose everything: their chips are stacked at the end of the line, three to a stack, and a stack counts as one chip from then on.',
      'The last diver back goes first in the next dive. At the end the most points wins; a tie goes to the most deep (level 4) chips.',
      'Solo: dive alone and score as many points as you can.',
    ].forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h) {
    return `${h.dives} dives · ${h.air} air${h.turnBack === 'free' ? ' · free turning back' : ''}`;
  },

  init(session) { return this.sync(null, session); },

  sync(prev, session) {
    const st = session.state;
    const levels = {};
    Object.keys(st.chips).forEach((id) => { levels[id] = st.chips[id].level; });
    return {
      seats: st.seats.map((s) => ({ name: s.name, isBot: s.isBot, turns: s.turns })),
      current: st.current,
      dive: st.dive,
      dives: st.options.dives,
      air: st.air,
      airMax: st.options.air,
      levels,
      line: st.line.map((sl) => (sl.t === 'c' ? { t: 'c', chips: sl.chips.slice() } : { t: 'b' })),
      divers: st.divers.map((d) => ({ pos: d.pos, dir: d.dir, turned: d.turned, back: d.back, carried: d.carried.map((u) => u.slice()) })),
      pts: st.seats.map((_, i) => points(st, i)),
      rolled: st.turn.rolled ? st.turn.rolled.slice() : null,
      info: st.turn.roll && st.turn.phase === 'hunt' ? `Rolled ${st.turn.rolled.map(pipsOf).join(' + ')} = ${st.turn.roll.sum}${st.turn.roll.carried ? `, minus ${st.turn.roll.carried} carried` : ''} = ${st.turn.roll.jumps} jump${st.turn.roll.jumps === 1 ? '' : 's'}` : '',
      settling: false,
      banner: null,
      drop: null,
    };
  },

  build(ui) {
    ensureDiverCss();
    ui.table.classList.add('divewrap');
    ui.scores.hidden = true;
    ui.chips = el('div', 'climbchips');
    ui.airrow = el('div', 'airrow');
    ui.airbar = el('div', 'airbar');
    ui.path = el('div', 'path');
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    const stage = el('div', 'pkstage');
    stage.append(ui.path, ui.banner);
    ui.status = el('div', 'trayb divestatus');
    ui.hint = el('div', 'hint');
    ui.table.append(ui.chips, ui.airrow, ui.airbar, stage, ui.status, ui.hint);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => drawLine(ui)).observe(ui.path); // rotate or resize: redraw the line
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const cur = view.seats[view.current];
    const over = session.isOver();
    const human = !over && !cur.isBot && !ctx.busy;
    const phase = st.turn.phase;
    const me = view.divers[view.current];
    ui.controls.classList.add('sticky');
    ui.log.hidden = true;

    // one line per player: colour, face and name, points and what they carry
    ui.chips.innerHTML = '';
    ui.chips.style.setProperty('--n', String(view.seats.length === 1 ? 1 : 2));
    view.seats.forEach((s, i) => {
      const chip = el('div', 'cchip' + (i === view.current && !over ? ' active' : ''));
      const sw = el('i');
      sw.style.background = colorOf(view, i);
      chip.append(sw, el('span', 'cn', `${s.face || (s.isBot ? '\u{1F916}' : '\u{1F464}')} ${s.name}`), el('b', null, `${view.pts[i]}${carriedCount(view, i) ? ` · \u{1F392}${carriedCount(view, i)}` : ''}`));
      chip.setAttribute('aria-label', `${s.name}: ${view.pts[i]} points, carrying ${carriedCount(view, i)}`);
      ui.chips.appendChild(chip);
    });

    // the air
    const burn = view.divers.reduce((a, d) => a + (d.back ? 0 : d.carried.length), 0);
    ui.airrow.innerHTML = '';
    ui.airrow.append(el('span', null, `Dive ${view.dive} of ${view.dives}`), el('span', null, `Air ${Math.max(0, view.air)} / ${view.airMax}${burn ? ` · each round uses ${burn}` : ''}`));
    ui.airbar.innerHTML = '';
    const fill = el('i');
    fill.style.width = `${Math.max(0, Math.min(100, (view.air / view.airMax) * 100))}%`;
    fill.className = view.air <= 5 ? 'low' : '';
    ui.airbar.appendChild(fill);
    ui.airbar.setAttribute('role', 'img');
    ui.airbar.setAttribute('aria-label', `Air ${Math.max(0, view.air)} of ${view.airMax}`);

    // the path: the sub, then the line as a snake of rows of 8
    ui.path.innerHTML = '';
    ui.path.appendChild(el('div', 'pathsvgwrap')).appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg')).setAttribute('class', 'pathsvg');
    const subb = el('div', 'subb');
    subb.appendChild(el('span', 'subpill', '⛴ SUB'));
    view.divers.forEach((d, i) => { if (d.pos === 0) subb.appendChild(diver(colorOf(view, i), skinOf(view.seats[i].face), false, `${view.seats[i].name}${d.back ? ' is back on board' : ' is on the sub'}`, d.back ? 'insub back' : 'insub')); });
    ui.path.appendChild(subb);
    const n = view.line.length;
    for (let r = 0; r * 8 < n; r++) {
      const row = el('div', `chr r${Math.min(r, 3)}`);
      const cells = [];
      for (let k = 0; k < 8 && r * 8 + k < n; k++) {
        const idx = r * 8 + k;
        const slot = view.line[idx];
        const cell = el('div', 'ch' + (slot.t === 'b' ? ' blank' : ''));
        cell.dataset.i = String(idx);
        if (slot.t === 'c') {
          const sh = SHAPES[shapeOf(view, slot)];
          const b = el('b', null, slot.chips.length > 1 ? `×${slot.chips.length}` : '?');
          b.style.background = sh.c;
          b.style.clipPath = sh.clip;
          cell.appendChild(b);
          cell.setAttribute('role', 'img');
          cell.setAttribute('aria-label', `Slot ${idx + 1}: ${slot.chips.length > 1 ? `a stack of ${slot.chips.length}` : 'a chip'}, level ${shapeOf(view, slot)}`);
        } else cell.setAttribute('aria-label', `Slot ${idx + 1}: empty`);
        const who = view.divers.findIndex((d) => !d.back && d.pos === idx + 1);
        if (who >= 0) {
          const d = view.divers[who];
          const rtl = r % 2 === 1; // a right-to-left row: deeper is to the left
          const faceRight = (d.dir === 'down') !== rtl;
          cell.appendChild(diver(colorOf(view, who), skinOf(view.seats[who].face), !faceRight, `${view.seats[who].name}, ${d.dir === 'down' ? 'diving deeper' : 'heading back to the sub'}`));
        }
        cells.push(cell);
      }
      // the snake: even rows run left to right, odd rows right to left (a short last row sits at the end it starts from)
      cells.forEach((c, k) => { c.style.gridArea = `1 / ${r % 2 === 1 ? 8 - k : k + 1}`; row.appendChild(c); });
      ui.path.appendChild(row);
    }
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner' + (view.banner && view.banner.good ? ' hot' : '');

    // the current diver: what it carries, the dice and what the roll did
    ui.status.innerHTML = '';
    const slotNow = me.pos >= 1 ? view.line[me.pos - 1] : null;
    const droppable = phase === 'hunt' && human && slotNow && slotNow.t === 'b' && me.carried.length > 0;
    if (view.drop === null || view.drop >= me.carried.length) view.drop = me.carried.length ? me.carried.length - 1 : null;
    ui.status.appendChild(el('h4', null, over ? 'The dives are over' : `${cur.name}${me.back ? ' is back on board' : ''}: carrying ${me.carried.length}${me.carried.length ? ` (uses ${me.carried.length} air a turn)` : ''}`));
    const srow = el('div', 'srow');
    const car = el('div', 'car');
    me.carried.forEach((u, k) => {
      const b = el('button', 'cu' + (droppable && view.drop === k ? ' sel' : ''));
      const sh = SHAPES[Math.max(...u.map((id) => view.levels[id]))];
      const shape = el('i', null, u.length > 1 ? `×${u.length}` : '?');
      shape.style.background = sh.c;
      shape.style.clipPath = sh.clip;
      b.appendChild(shape);
      b.disabled = !droppable;
      b.setAttribute('aria-pressed', String(droppable && view.drop === k));
      b.setAttribute('aria-label', `${u.length > 1 ? `Stack of ${u.length}` : 'Chip'}, level ${Math.max(...u.map((id) => view.levels[id]))}${droppable ? ', tap to choose it to drop' : ''}`);
      b.addEventListener('click', () => { view.drop = k; this.render(ui, view, session, ctx); });
      car.appendChild(b);
    });
    if (!me.carried.length) car.appendChild(el('span', 'none', 'Nothing carried'));
    const dice = el('div', 'dvdice');
    [0, 1].forEach((i) => dice.appendChild(renderDie(view.rolled ? view.rolled[i] : null, { tumble: ctx.tumble && !ctx.reduced && !!view.rolled, danger: false, pips: PIPS })));
    srow.append(car, dice);
    ui.status.appendChild(srow);
    const infoText = over ? '' : view.settling ? 'Rolling…' : view.info || (phase === 'declare' ? (me.dir === 'down' ? 'Roll to swim deeper' : 'Roll to swim back toward the sub') : '');
    ui.status.appendChild(el('div', 'pkinfo', infoText));
    ui.hint.textContent = statusOverride(view, cur, over) || (over ? '' : cur.isBot ? `${cur.name} is thinking…` : '');

    // controls
    ui.controls.innerHTML = '';
    ui.controls.style.gridTemplateColumns = '';
    const btn = (label, cls, disabled, onClick, sub) => {
      const b = el('button', cls + (sub ? ' pair' : ''));
      b.appendChild(document.createTextNode(label));
      if (sub) b.appendChild(el('small', 'sub', sub));
      b.disabled = !!disabled;
      b.addEventListener('click', onClick);
      ui.controls.appendChild(b);
      return b;
    };
    if (over) {
      btn('ROLL', 'btn-roll span2', true, () => {});
    } else if (phase === 'declare') {
      const back = human && canTurnBack(st, view.current);
      btn('ROLL', 'btn-roll', !human, () => ctx.act([{ type: 'ROLL' }]), me.dir === 'down' ? 'swim deeper' : 'swim back');
      btn('TURN BACK', 'btn-bank', !back, () => ctx.act([{ type: 'TURN_BACK' }]), me.turned ? 'already turned' : '↑ once per dive');
    } else {
      const here = slotNow && slotNow.t === 'c';
      btn('PICK UP', 'btn-roll', !(human && here), () => ctx.act([{ type: 'PICK_UP' }]), here ? 'the chip here' : 'nothing here');
      btn('DROP HERE', 'btn-bank', !droppable, () => ctx.act([{ type: 'DROP', ids: [me.carried[view.drop][0]] }]), droppable ? 'the chosen chip' : 'needs an empty spot');
      btn('DO NOTHING', 'btn-roll span2 quiet', !human, () => ctx.act([{ type: 'PASS' }]));
    }
    drawLine(ui);
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.rolled = null;
        view.info = '';
        view.settling = false;
        view.banner = null;
        view.drop = null;
        delay = 150;
        break;
      case 'BREATHED':
        view.air = ev.air;
        if (ev.air <= 0) { view.banner = { text: THEME.airGone }; ctx.announce(THEME.airGone); delay = ctx.reduced ? 400 : 900; }
        break;
      case 'TURNED_BACK':
        view.divers[ev.seat].dir = 'up';
        view.divers[ev.seat].turned = true;
        view.info = `${name(ev.seat)} turned back toward the sub`;
        delay = 300;
        break;
      case 'ROLLED':
        view.rolled = ev.dice.slice();
        view.settling = true;
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS; // the move shows only after the dice have settled
        after = `${name(ev.seat)} rolled ${ev.dice.map(pipsOf).join(' and ')}`;
        break;
      case 'MOVED': {
        view.settling = false;
        const d = view.divers[ev.seat];
        d.pos = ev.returned ? 0 : ev.to;
        if (ev.returned) d.back = true;
        view.info = `Rolled ${view.rolled.map(pipsOf).join(' + ')} = ${ev.sum}${ev.carried ? `, minus ${ev.carried} carried` : ''} = ${ev.jumps} jump${ev.jumps === 1 ? '' : 's'}`;
        ctx.log(`${name(ev.seat)} swam ${ev.jumps}`);
        if (ev.returned) ctx.announce(`${name(ev.seat)} is back on board`);
        delay = ctx.reduced ? 150 : 450;
        break;
      }
      case 'PICKED_UP':
        view.line[ev.slot - 1] = { t: 'b' };
        view.divers[ev.seat].carried.push(ev.chips.slice());
        ctx.log(`${name(ev.seat)} picked up a chip`);
        delay = 250;
        break;
      case 'DROPPED_HERE': {
        const d = view.divers[ev.seat];
        d.carried = d.carried.filter((u) => u[0] !== ev.chips[0]);
        view.line[ev.slot - 1] = { t: 'c', chips: ev.chips.slice() };
        ctx.log(`${name(ev.seat)} dropped a chip`);
        delay = 250;
        break;
      }
      case 'PASSED':
        delay = 120;
        break;
      case 'BANKED':
        view.divers[ev.seat].carried = [];
        view.pts[ev.seat] = ev.total;
        view.banner = { text: `${name(ev.seat)}: ${THEME.back(ev.amount)}`, good: true };
        ctx.announce(`${name(ev.seat)} is back with ${ev.count} chip${ev.count === 1 ? '' : 's'} worth ${ev.amount}`);
        delay = ctx.reduced ? 500 : 1100;
        break;
      case 'BUSTED':
        view.divers[ev.seat].carried = [];
        view.banner = { text: `${name(ev.seat)}: ${THEME.lost}` };
        ctx.announce(`${name(ev.seat)} lost ${ev.count} chip${ev.count === 1 ? '' : 's'}`);
        ctx.vibrate();
        delay = ctx.reduced ? 500 : 1000;
        break;
      case 'STACKED':
        delay = 300;
        break;
      case 'DIVE_ENDED':
        view.line = ev.line.map((sl) => ({ t: 'c', chips: sl.chips.slice() }));
        view.banner = { text: THEME.diveDone(ev.dive), good: true };
        delay = ctx.reduced ? 400 : 900;
        break;
      case 'DIVE_STARTED':
        view.dive = ev.dive;
        view.air = ev.air;
        view.divers.forEach((d) => { d.pos = 0; d.dir = 'down'; d.turned = false; d.back = false; d.carried = []; });
        view.banner = null;
        delay = 300;
        break;
      case 'TURN_ENDED':
        view.seats[ev.seat].turns += 1;
        break;
      case 'GAME_OVER':
        view.banner = { text: THEME.win, good: true };
        delay = ctx.reduced ? 200 : 600;
        break;
      default:
        break;
    }
    if (ev.type !== 'ROLLED' && ev.type !== 'TURN_STARTED' && ev.type !== 'BREATHED') view.settling = false;
    return { delay, tumble, after };
  },
};
