// Cliffhanger view: eleven columns shaped like a mountain (the 7 column is the peak) in front of a drawn snow-peak.
import { renderDie } from '../dice.js';
import { statusOverride } from '../avatars.js';
import { LEN, splits, chooseOptions, stuck } from '../../games/cliffhanger.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
// Older saves have no seat colors: these fixed ones (by seat) are the fallback. New games store each seat's color.
const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const colorOf = (view, i) => view.seats[i].color || SEAT_COLORS[i];

// Cosmetic background: sky, far hills, the main peak with a snow cap, and a tree line. Drawn inline (no image files).
// The shapes are filled in by drawPeak() from the measured top dots, so the slopes pass through the center of every
// column top at any screen width.
const PEAK_SVG = `<svg class="peakbg" preserveAspectRatio="none" aria-hidden="true" focusable="false">
<defs><linearGradient id="chSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d9fca"/><stop offset="1" stop-color="#c7e3f0"/></linearGradient>
<linearGradient id="chRock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d8fa3"/><stop offset="1" stop-color="#3f566b"/></linearGradient></defs>
<rect class="pk-sky" fill="url(#chSky)"/>
<path class="pk-hills" fill="#8fb3cc" opacity="0.7"/>
<path class="pk-peak" fill="url(#chRock)"/>
<path class="pk-snow" fill="#f4f8fb"/>
<path class="pk-shade" fill="#dce9f2" opacity="0.85"/>
<path class="pk-trees" fill="#1f4a3a"/>
</svg>`;

// Top-down: the peak is the center of the 7's top dot; each slope runs from it through the center of the outermost
// column's top dot (the eleven top dots lie on two straight lines) to the board edge; below that the mountain fills the width.
function drawPeak(ui) {
  const b = ui.board;
  const W = b.clientWidth;
  const H = b.clientHeight;
  const cols = ui.cols.querySelectorAll('.ccol');
  const svg = b.querySelector('.peakbg');
  if (!W || !H || cols.length !== 11 || !svg) return;
  const br = b.getBoundingClientRect();
  const pt = (col) => {
    const r = col.querySelector('.cd').getBoundingClientRect(); // the first dot in a column is its top space
    return [r.left + r.width / 2 - br.left - b.clientLeft, r.top + r.height / 2 - br.top - b.clientTop];
  };
  const [x2, y2] = pt(cols[0]);
  const [x7, y7] = pt(cols[5]);
  const [x12, y12] = pt(cols[10]);
  const slopeL = (y2 - y7) / (x2 - x7);
  const slopeR = (y12 - y7) / (x12 - x7);
  const yL = y7 + slopeL * (0 - x7);
  const yR = y7 + slopeR * (W - x7);
  const xOn = (slope, y) => x7 + (y - y7) / slope;
  const snowY = y7 + 0.24 * (H - y7);
  const xl = xOn(slopeL, snowY);
  const xr = xOn(slopeR, snowY);
  const zig = [];
  for (let i = 1; i <= 6; i++) zig.push(`L${(xr + (xl - xr) * (i / 7)).toFixed(1)} ${(snowY + (i % 2 ? 9 : -4)).toFixed(1)}`);
  const f = (n) => n.toFixed(1);
  const set = (cls, d) => svg.querySelector(cls).setAttribute('d', d);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const sky = svg.querySelector('.pk-sky');
  sky.setAttribute('width', W);
  sky.setAttribute('height', H);
  set('.pk-hills', `M0 ${f(0.71 * H)} L${f(0.17 * W)} ${f(0.52 * H)} L${f(0.31 * W)} ${f(0.64 * H)} L${f(0.42 * W)} ${f(0.48 * H)} L${f(0.56 * W)} ${f(0.69 * H)} L${W} ${f(0.69 * H)} L${W} ${H} L0 ${H}Z`);
  set('.pk-peak', `M0 ${f(yL)} L${f(x7)} ${f(y7)} L${W} ${f(yR)} L${W} ${H} L0 ${H}Z`);
  set('.pk-snow', `M${f(x7)} ${f(y7)} L${f(xr)} ${f(snowY)} ${zig.join(' ')} L${f(xl)} ${f(snowY)}Z`);
  set('.pk-shade', `M${f(x7)} ${f(y7)} L${f(xr)} ${f(snowY)} L${f(x7 + (xr - x7) * 0.2)} ${f(snowY + 8)} L${f(x7)} ${f(y7 + (snowY - y7) * 0.6)}Z`);
  let trees = `M0 ${f(0.93 * H)}`;
  const n = 16;
  for (let i = 0; i < n; i++) trees += ` L${f((i + 0.5) * (W / n))} ${f(0.83 * H)} L${f((i + 1) * (W / n))} ${f(0.93 * H)}`;
  set('.pk-trees', `${trees} L${W} ${H} L0 ${H}Z`);
}

export const cliffhangerView = {
  title: 'CLIFFHANGER',

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Cliffhanger'));
    [
      `Be the first to win ${options.winCols} columns. There is one column for every dice total from 2 to 12: the rare totals have short columns, 7 has the longest.`,
      'On your turn, roll four dice and split them into two pairs any way you like. The sum of each pair is a column to climb. You have only three brown markers per turn: a new column takes a marker, a column you already have a marker in moves up one space.',
      'You must climb if you can. If only one of a pair’s columns can be used, you climb that one. A pair with the same total (7 and 7) climbs that column two spaces.',
      'After climbing you may BANK (your markers become permanent progress) or ROLL AGAIN. If a roll lets you climb no column at all, you blow it: this turn’s climbing is lost (earlier progress stays) and your turn ends. Once all three markers are down, every roll must move one of them.',
      'You win a column only when you BANK with a marker on its top space. A won column is closed to everyone and wipes out other players’ progress in it. A marker on top that you did not bank does not count.',
      options.occupied === 'jump' ? 'Jumping: a marker skips any space where an opponent has progress.'
        : options.occupied === 'forced' ? 'Forced move: while a marker stands on a space where an opponent has progress, you cannot bank. You must keep rolling until it is free, or you blow it.'
          : 'Markers may share a space with an opponent.',
      'Tip: 6, 7 and 8 come up most often, so the short columns are not the easy ones.',
    ].forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h) {
    const occ = { normal: 'markers share spaces', jump: 'jumping', forced: 'forced move' }[h.occupied];
    return `Win ${h.winCols} columns · ${occ}`;
  },

  init(session) { return this.sync(null, session); },

  sync(_view, session) {
    const st = session.state;
    return {
      seats: st.seats.map((s) => ({ name: s.name, isBot: s.isBot, won: s.won, turns: s.turns })),
      prog: st.seats.map((s) => s.prog.slice()),
      owner: st.owner.slice(),
      markers: { ...st.turn.markers },
      current: st.current,
      dice: st.turn.dice.slice(),
      rollId: session.log.length,
      banner: null,
      slip: false,
    };
  },

  build(ui) {
    ui.table.classList.add('climbwrap');
    ui.scores.hidden = true; // Cliffhanger has its own chips; the empty strip doubled the gap under the title
    ui.chips = el('div', 'climbchips');
    ui.board = el('div', 'climbboard');
    ui.board.insertAdjacentHTML('afterbegin', PEAK_SVG);
    ui.cols = el('div', 'climbcols');
    ui.climber = el('div', 'climber', '\u{1F9D7}');
    ui.climber.setAttribute('aria-hidden', 'true');
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    ui.board.append(ui.cols, ui.climber, ui.banner);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => drawPeak(ui)).observe(ui.board); // rotate or resize: redraw
    ui.dice = el('div', 'dice climb');
    ui.hint = el('div', 'hint');
    ui.table.append(ui.chips, ui.board, ui.dice, ui.hint);
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const cur = view.seats[view.current];
    const phase = st.turn.phase;
    const human = !session.isOver() && !cur.isBot && !ctx.busy;
    ui.controls.classList.add('sticky');
    ui.log.hidden = true; // this screen is full: the board already shows everything the log would

    // header chips: one line each (colour, face and name, columns won), two per row; one row for 1 or 2 players
    ui.chips.innerHTML = '';
    ui.chips.style.setProperty('--n', String(view.seats.length === 1 ? 1 : 2));
    view.seats.forEach((s, i) => {
      const chip = el('div', 'cchip' + (i === view.current && !session.isOver() ? ' active' : ''));
      const sw = el('i');
      sw.style.background = colorOf(view, i);
      chip.append(sw, el('span', 'cn', `${s.face || (s.isBot ? '\u{1F916}' : '\u{1F464}')} ${s.name}`), el('b', null, `${s.won}/${st.options.winCols}`));
      chip.setAttribute('aria-label', `${s.name}: ${s.won} of ${st.options.winCols} columns won`);
      ui.chips.appendChild(chip);
    });

    // board
    ui.cols.innerHTML = '';
    COLS.forEach((c) => {
      const col = el('div', 'ccol' + (view.owner[c] !== null ? ' owned' : ''));
      const mine = view.prog.map((p, i) => `${view.seats[i].name} ${p[c]}`).filter((_, i) => view.prog[i][c] > 0).join(', ');
      col.setAttribute('role', 'img');
      col.setAttribute('aria-label', `Column ${c}, ${LEN[c]} spaces${view.owner[c] !== null ? `, won by ${view.seats[view.owner[c]].name}` : ''}${mine ? `, progress: ${mine}` : ''}${view.markers[c] ? `, marker on space ${view.markers[c]}` : ''}`);
      // the summit mark sits above the top space of a won column (its row is always reserved so nothing moves)
      const flag = el('div', 'cflag', view.owner[c] !== null ? '\u{1F3D4}️' : '');
      if (view.owner[c] !== null) flag.style.filter = `drop-shadow(0 0 3px ${colorOf(view, view.owner[c])})`;
      col.appendChild(flag);
      for (let step = LEN[c]; step >= 1; step--) {
        const d = el('div', 'cd' + (step === LEN[c] ? ' top' : ''));
        const who = view.prog.map((p, i) => (p[c] === step ? i : -1)).filter((i) => i >= 0);
        who.forEach((i) => { const m = el('span', 'cm'); m.style.background = colorOf(view, i); d.appendChild(m); });
        if (step === LEN[c] && view.owner[c] !== null) d.style.background = colorOf(view, view.owner[c]);
        if (view.markers[c] === step) d.appendChild(el('span', 'cring'));
        col.appendChild(d);
      }
      col.appendChild(el('div', 'clabel', String(c)));
      ui.cols.appendChild(col);
    });
    drawPeak(ui);
    ui.climber.className = 'climber' + (view.slip ? ' slip' : '');
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner' + (view.banner && view.banner.good ? ' hot' : '');

    // dice and hint
    ui.dice.innerHTML = '';
    const n = view.dice.length || 4;
    for (let i = 0; i < n; i++) ui.dice.appendChild(renderDie(view.dice[i] === undefined ? null : view.dice[i], { tumble: ctx.tumble && !ctx.reduced, danger: false, cls: 'cream' }));
    const left = 3 - Object.keys(view.markers).length;
    ui.hint.textContent = statusOverride(view, cur, session.isOver()) || (session.isOver() ? '' : cur.isBot ? `${cur.name} is thinking…`
      : phase === 'choose' ? 'Choose a pair to climb'
        : phase === 'decide' ? `${left} marker${left === 1 ? '' : 's'} left · bank to keep your climb`
          : 'Roll the four dice');

    // controls
    ui.controls.innerHTML = '';
    ui.controls.style.gridTemplateColumns = '';
    const btn = (label, cls, disabled, onClick, sub) => {
      const b = el('button', cls);
      b.appendChild(document.createTextNode(label));
      if (sub) b.appendChild(el('small', 'sub', sub));
      b.disabled = !!disabled;
      b.addEventListener('click', onClick);
      ui.controls.appendChild(b);
      return b;
    };
    if (phase === 'choose' && !session.isOver()) {
      const options = chooseOptions(st);
      ui.controls.style.gridTemplateColumns = `repeat(${Math.min(3, Math.max(1, options.length))}, 1fr)`; // up to six options wrap to a second row
      const sp = splits(st.turn.dice);
      options.forEach((cols) => {
        const label = cols.length === 2 ? `${cols[0]} + ${cols[1]}` : `${cols[0]} only`;
        // the dice split that makes this choice (a pair of sums, or the one sum for a single column)
        const m = sp.find((x) => cols.every((c) => x.sums.includes(c)));
        btn(label, 'btn-roll pair', !human, () => ctx.act([{ type: 'CHOOSE', cols }]), m ? m.text : '');
      });
    } else {
      const canBank = phase === 'decide' && Object.keys(view.markers).length > 0 && !stuck(st);
      btn(phase === 'decide' ? 'ROLL AGAIN' : 'ROLL', 'btn-roll', !human || session.isOver(), () => ctx.act([{ type: 'ROLL' }]));
      if (phase === 'decide') btn('BANK', 'btn-bank', !human || !canBank, () => ctx.act([{ type: 'BANK' }]));
      else ui.controls.firstChild.classList.add('span2');
    }
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    switch (ev.type) {
      case 'ROLLED':
        view.dice = ev.dice.slice();
        view.rollId += 1;
        view.banner = null;
        view.slip = false;
        tumble = true;
        delay = ctx.reduced ? 150 : 650;
        ctx.announce(`${name(ev.seat)} rolled ${ev.dice.join(', ')}`);
        break;
      case 'MOVED':
        view.markers[ev.col] = ev.to;
        ctx.log(`${name(ev.seat)} ${ev.placed ? 'placed a marker in' : 'climbed'} column ${ev.col} (space ${ev.to} of ${LEN[ev.col]})`);
        delay = ctx.reduced ? 100 : 380;
        break;
      case 'BLOWN':
        view.banner = { text: 'BLOWN IT! Progress lost' };
        view.slip = true;
        ctx.log(`${name(ev.seat)} blew it`);
        ctx.announce(`${name(ev.seat)} blew it and lost this turn's climb`);
        ctx.vibrate();
        delay = ctx.reduced ? 600 : 1500;
        break;
      case 'BANKED':
        ev.cols.forEach((m) => { view.prog[ev.seat][m.col] = m.to; });
        view.markers = {};
        ctx.log(`${name(ev.seat)} banked ${ev.cols.map((m) => m.col).join(', ')}`);
        delay = ctx.reduced ? 100 : 350;
        break;
      case 'COLUMN_WON':
        view.owner[ev.col] = ev.seat;
        view.seats[ev.seat].won += 1;
        ev.removedFrom.forEach((i) => { view.prog[i][ev.col] = 0; });
        view.banner = { text: `${name(ev.seat)} won column ${ev.col}!`, good: true };
        ctx.log(`${name(ev.seat)} won column ${ev.col}`);
        ctx.announce(`${name(ev.seat)} won column ${ev.col}`);
        delay = ctx.reduced ? 400 : 1100;
        break;
      case 'TURN_ENDED':
        view.markers = {};
        view.banner = null;
        view.slip = false;
        view.seats[ev.seat].turns += 1;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.dice = [];
        view.markers = {};
        delay = 150;
        break;
      case 'GAME_OVER':
        delay = ctx.reduced ? 200 : 500;
        break;
      default:
        break;
    }
    return { delay, tumble };
  },
};
