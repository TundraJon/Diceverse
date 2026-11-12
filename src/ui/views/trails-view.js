// Treasure Trails view: the dice, your sheet (four rows of jewels and a chest each), the other players' small sheets, the penalty track.
// All theme words live in THEME. The art (jewels, chests, padlocks) is drawn in CSS and inline SVG.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderTurnBar } from '../panels.js';
import { isMe, statusOverride } from '../avatars.js';
import { ROWS, TRI, PENALTY, lastNumber, ticksOf, legalActions as rulesLegal } from '../../games/trails.js';

const THEME = {
  title: 'TREASURE TRAILS',
  tagline: 'Mark your trails, lock the chests.',
  rows: ['Ruby', 'Gold', 'Emerald', 'Sapphire'],
  gem: ['#ef4444', '#f5b73b', '#22c55e', '#3b82f6'],
  kinds: ['pearl', 'pearl', 'ruby', 'gold', 'emerald', 'sapphire'],
};
const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const colorOf = (view, i) => view.seats[i].color || SEAT_COLORS[i];
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const numbersOf = (r) => (ROWS[r].dir === 1 ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
const total = (seat) => ROWS.reduce((a, _, r) => a + TRI[Math.min(12, ticksOf(seat, r))], 0) - PENALTY * seat.penalties;
const lastOf = (seat, r) => (seat.sheet[r].marks.length ? seat.sheet[r].marks[seat.sheet[r].marks.length - 1] : (ROWS[r].dir === 1 ? 1 : 13));

const CHEST = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="10" width="18" height="10" rx="2" fill="#8a5a2b" stroke="#fde68a" stroke-width="1.2"/><path d="M3 10 C3 5 21 5 21 10 Z" fill="#a8742f" stroke="#fde68a" stroke-width="1.2"/><rect x="10.5" y="9" width="3" height="5" rx="1" fill="#fde68a"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="#cbd5e1" stroke="#0f172a" stroke-width="1.2"/><path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke="#cbd5e1" stroke-width="2"/></svg>';

const seatsView = (st) => st.seats.map((s) => ({ name: s.name, isBot: s.isBot, turns: s.turns, penalties: s.penalties, sheet: clone(s.sheet), total: 0 }));
const clone = (v) => JSON.parse(JSON.stringify(v));

export const trailsView = {
  title: THEME.title,

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Treasure Trails'));
    sheet.appendChild(el('p', 'tagline', THEME.tagline));
    [
      'Every player has a sheet of four rows. Ruby and Gold count up from 2 to 12. Emerald and Sapphire count down from 12 to 2. Each row ends in a treasure chest.',
      'On each roll the active player throws six dice: two white pearl dice and one die each in ruby, gold, emerald and sapphire.',
      'Everybody, starting with the active player, may mark ONE number on any row that equals the total of the two pearl dice, or pass. Then the active player may also mark one number on a row using one pearl die plus that row\'s colored die.',
      'You mark from left to right only. Numbers you skip are lost, so fewer skips are better.',
      `To mark the last number of a row and open its chest you need at least ${options.lockAt} ticks in that row. The chest gives a bonus tick and locks the row for everybody once the roll is over.`,
      'If the active player marks nothing on their roll, they take a penalty of 5 points.',
      `The game ends when two rows are locked or someone has taken ${options.penalties} penalties. A row scores 1, 3, 6, 10, 15 ... points for 1, 2, 3, 4, 5 ... ticks. Highest total wins.`,
      'Solo: you are the active player every roll; try for your best total.',
    ].forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h) {
    const bits = [];
    if (h.lockAt !== undefined && h.lockAt !== 5) bits.push(`chest needs ${h.lockAt}`);
    if (h.penalties !== undefined && h.penalties !== 4) bits.push(`${h.penalties} penalties`);
    return bits.length ? bits.join(' · ') : 'Standard rules';
  },

  init(session) { return this.sync(null, session); },

  sync(_view, session) {
    const st = session.state;
    const v = {
      seats: seatsView(st),
      current: st.current,
      active: st.active,
      phase: st.phase,
      dice: st.dice ? st.dice.slice() : null,
      locked: st.locked.slice(),
      pending: st.pending.slice(),
      rolling: false,
      banner: null,
      multi: st.seats.filter((s) => !s.isBot).length > 1,
    };
    v.seats.forEach((s, i) => { s.total = total(st.seats[i]); });
    return v;
  },

  build(ui) {
    ui.table.classList.add('trwrap');
    ui.scores.hidden = true;
    ui.chips = el('div', 'climbchips');
    ui.banner = el('div', 'banner trbanner');
    ui.banner.hidden = true;
    ui.dice = el('div', 'trdice');
    ui.info = el('div', 'trinfo');
    ui.sheet = el('div', 'trsheet');
    ui.foot = el('div', 'trfoot');
    ui.minis = el('div', 'trminis');
    ui.table.append(ui.chips, ui.banner, ui.dice, ui.info, ui.sheet, ui.foot, ui.minis);
    ui.table.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const over = session.isOver();
    ui.controls.classList.add('sticky');
    ui.log.hidden = true; // this screen is full
    const cur = view.seats[view.current];
    const phase = view.phase;
    const human = !over && !cur.isBot && !ctx.busy && !view.rolling;
    // whose sheet is shown: yours, or in Pass & Play the player who is choosing
    const mine = (() => { const k = view.seats.findIndex((s) => s.me); return k >= 0 ? k : (phase === 'roll' ? view.active : view.current); })();
    const viewed = view.seats[mine];

    // one chip per player: color, face and name, the total
    ui.chips.innerHTML = '';
    ui.chips.style.setProperty('--n', String(view.seats.length === 1 ? 1 : 2));
    view.seats.forEach((s, i) => {
      const chip = el('div', 'cchip' + (i === view.current && !over ? ' active' : ''));
      const sw = el('i');
      sw.style.background = colorOf(view, i);
      chip.append(sw, el('span', 'cn', `${s.face || (s.isBot ? '\u{1F916}' : '\u{1F464}')} ${s.name}`), el('b', null, String(s.total)));
      chip.setAttribute('aria-label', `${s.name}: ${s.total} points`);
      ui.chips.appendChild(chip);
    });

    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner trbanner' + (view.banner && view.banner.good ? ' hot' : '');

    // the six dice (blank until the first roll of a turn)
    ui.dice.innerHTML = '';
    THEME.kinds.forEach((k, i) => {
      const v = view.dice ? view.dice[i] : null;
      ui.dice.appendChild(renderDie(v, { tumble: ctx.tumble && !ctx.reduced && !!view.dice && view.rolling, danger: false, kind: k, cls: i < 2 ? 'trw' : '' }));
    });

    // what is being asked (only after the dice have settled)
    const legal = human ? rulesLegal(st, view.current) : [];
    const marks = legal.filter((a) => a.type === 'MARK');
    const sum = view.dice ? view.dice[0] + view.dice[1] : 0;
    let info = '';
    if (over) info = '';
    else if (view.rolling) info = 'Rolling…';
    else if (phase === 'roll') info = cur.isBot ? `${cur.name} rolls…` : (isMe(st.options.seats[view.current]) ? 'Your roll: throw the dice' : `${cur.name}: throw the dice`);
    else if (cur.isBot) info = `${cur.name} is choosing…`;
    else {
      const who = isMe(st.options.seats[view.current]) && cur.name === 'You' ? '' : `${cur.name}: `;
      info = phase === 'white' ? `${who}Use the white sum, ${sum}, or pass` : `${who}Use a white die and a colored die, or pass`;
    }
    ui.info.textContent = statusOverride(view, cur, over) || info;

    // your sheet
    ui.sheet.innerHTML = '';
    ROWS.forEach((row, r) => {
      const locked = view.locked[r];
      const rowEl = el('div', `trrow${locked ? ' locked' : ''}`);
      rowEl.style.setProperty('--gem', THEME.gem[r]);
      rowEl.setAttribute('role', 'group');
      rowEl.setAttribute('aria-label', `${THEME.rows[r]} row, ${ticksOf(viewed, r)} ticks${locked ? ', locked' : ''}`);
      const last = lastOf(viewed, r);
      numbersOf(r).forEach((n) => {
        const marked = viewed.sheet[r].marks.includes(n);
        const gone = !marked && (row.dir === 1 ? n <= last : n >= last);
        const opt = human && view.current === mine && marks.some((a) => a.row === r && a.n === n);
        const c = el('button', `trc${marked ? ' mk' : ''}${gone ? ' gone' : ''}${opt ? ' opt' : ''}${n === lastNumber(r) ? ' last' : ''}`);
        c.type = 'button';
        c.disabled = !opt;
        c.appendChild(el('b', null, String(n)));
        if (marked) c.appendChild(el('i', 'trgem'));
        c.setAttribute('aria-label', `${THEME.rows[r]} ${n}${marked ? ', marked' : opt ? ', you can mark it' : ''}`);
        if (opt) c.addEventListener('click', () => ctx.act([{ type: 'MARK', row: r, n }]));
        rowEl.appendChild(c);
      });
      const chest = el('div', `trchest${viewed.sheet[r].chest ? ' open' : ''}${viewed.sheet[r].marks.length >= st.options.lockAt ? ' ready' : ''}`);
      chest.innerHTML = CHEST + (locked ? `<span class="trlock">${LOCK}</span>` : '') + (viewed.sheet[r].chest ? '<i class="trgem"></i>' : '');
      chest.setAttribute('aria-label', viewed.sheet[r].chest ? 'Chest open' : `Chest, needs ${st.options.lockAt} ticks`);
      rowEl.appendChild(chest);
      ui.sheet.appendChild(rowEl);
    });

    // the penalty track and your total
    ui.foot.innerHTML = '';
    const pen = el('div', 'trpen');
    pen.appendChild(el('span', null, 'Penalties'));
    for (let k = 0; k < st.options.penalties; k++) pen.appendChild(el('i', k < viewed.penalties ? 'x' : '', k < viewed.penalties ? '✕' : ''));
    ui.foot.appendChild(pen);
    ui.foot.appendChild(el('div', 'trtot', `${viewed.name === 'You' || view.seats.length === 1 ? 'Your' : `${viewed.name}'s`} total: ${viewed.total}`));

    // the other players' small sheets
    ui.minis.innerHTML = '';
    view.seats.forEach((s, i) => {
      if (i === mine) return;
      const m = el('div', 'trmini' + (i === view.current && !over ? ' on' : ''));
      const head = el('div', 'trmh');
      const sw = el('i');
      sw.style.background = colorOf(view, i);
      head.append(sw, el('span', null, s.name.length > 9 ? `${s.name.slice(0, 8)}…` : s.name), el('b', null, String(s.total)));
      m.appendChild(head);
      const grid = el('div', 'trmg');
      ROWS.forEach((row, r) => {
        const rr = el('div', `trmr${view.locked[r] ? ' locked' : ''}`);
        rr.style.setProperty('--gem', THEME.gem[r]);
        numbersOf(r).forEach((n) => rr.appendChild(el('i', s.sheet[r].marks.includes(n) ? 'on' : '')));
        rr.appendChild(el('i', s.sheet[r].chest ? 'on chest' : 'chest'));
        grid.appendChild(rr);
      });
      m.appendChild(grid);
      m.setAttribute('aria-label', `${s.name}: ${s.total} points, ${s.penalties} penalties`);
      ui.minis.appendChild(m);
    });

    // controls
    if (human && phase === 'roll') renderTurnBar(ui.controls, [{ label: 'ROLL', cls: 'btn-roll span2', onClick: () => ctx.act([{ type: 'ROLL' }]) }]);
    else renderTurnBar(ui.controls, [{ label: human && !marks.length ? 'NOTHING TO MARK · PASS' : 'PASS', cls: 'btn-bank span2', disabled: !human || phase === 'roll', onClick: () => ctx.act([{ type: 'PASS' }]) }]);
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'ROLLED':
        view.dice = ev.dice.slice();
        view.rolling = true;
        view.banner = null;
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS; // nothing about the roll is offered until the dice have settled and the pause has passed
        after = `${name(ev.seat)} rolled white ${ev.dice[0]} and ${ev.dice[1]}, ruby ${ev.dice[2]}, gold ${ev.dice[3]}, emerald ${ev.dice[4]}, sapphire ${ev.dice[5]}`;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.phase = ev.phase;
        view.rolling = false;
        if (ev.phase === 'roll') { view.active = ev.seat; view.dice = null; view.banner = null; }
        delay = 150;
        break;
      case 'MARKED': {
        const s = view.seats[ev.seat];
        s.sheet[ev.row].marks.push(ev.n);
        if (ev.lock) s.sheet[ev.row].chest = true;
        s.total = total(s);
        ctx.log(`${name(ev.seat)} marks ${ev.n} in ${THEME.rows[ev.row]}`);
        delay = ctx.reduced ? 150 : 300;
        break;
      }
      case 'ROW_LOCKED':
        view.pending.push(ev.row);
        view.banner = { text: `${name(ev.seat)} locks the ${THEME.rows[ev.row]} chest!`, good: true };
        ctx.announce(`${name(ev.seat)} locks the ${THEME.rows[ev.row]} row`);
        ctx.vibrate();
        delay = ctx.reduced ? 500 : 1000;
        break;
      case 'PENALTY': {
        const s = view.seats[ev.seat];
        s.penalties = ev.count;
        s.total = total(s);
        view.banner = { text: `${name(ev.seat)}: penalty −${PENALTY}`, good: false };
        ctx.log(`${name(ev.seat)} takes a penalty`);
        ctx.announce(`${name(ev.seat)} takes a penalty`);
        delay = ctx.reduced ? 400 : 800;
        break;
      }
      case 'ROLL_ENDED':
        view.pending.forEach((r) => { view.locked[r] = true; });
        view.pending = [];
        view.seats[ev.seat].turns += 1;
        break;
      case 'GAME_OVER':
        view.banner = { text: 'The trails are closed!', good: true };
        delay = ctx.reduced ? 200 : 600;
        break;
      default:
        break;
    }
    return { delay, tumble, after };
  },
};
