// Treasure Trails: pure rules module for a roll-and-write sheet game. No DOM, no timers, no Math.random.
// Every player has a sheet of four rows: ruby and gold count up from 2 to 12, emerald and sapphire count down from 12 to 2, each ending
// in a treasure chest. Six dice are rolled for everybody: two white pearl dice and one die each in ruby, gold, emerald and sapphire.
// Internal names follow the shared vocabulary where it fits: TURN_STARTED, GAME_OVER.
import { createRng } from '../core/rng.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export const ROWS = [
  { id: 'ruby', dir: 1 },
  { id: 'gold', dir: 1 },
  { id: 'emerald', dir: -1 },
  { id: 'sapphire', dir: -1 },
];
export const TRI = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78]; // points for 0 to 12 ticks in a row
export const PENALTY = 5;
export const lastNumber = (r) => (ROWS[r].dir === 1 ? 12 : 2); // the number that locks the row
const START = (r) => (ROWS[r].dir === 1 ? 1 : 13); // "before the first number"

export const meta = {
  id: 'trails',
  name: 'Treasure Trails',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 15,
  tier: 'C',
  soloBest: 'high', // the highest total
  soloKey: (o) => `${o.lockAt}:${o.penalties}`,
  soloValue: (res) => res.soloScore,
  soloTitle: (v) => `Final haul: ${v} points`,
  soloLabel: (v) => `${v} points`,
  houseRules: [
    {
      key: 'lockAt', label: 'Chest needs',
      options: [{ value: 4, label: '4 ticks' }, { value: 5, label: '5 ticks' }, { value: 6, label: '6 ticks' }], default: 5,
      hint: () => 'How many ticks a row needs before you may mark its last number and lock the row.',
    },
    {
      key: 'penalties', label: 'Penalties to end',
      options: [{ value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }], default: 4,
      hint: () => 'The game ends when someone has taken this many penalties (or two rows are locked).',
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

const freshSheet = () => ROWS.map(() => ({ marks: [], chest: false }));

export function setup(options, rng) {
  const opts = { ...defaultOptions(), ...options };
  if (![4, 5, 6].includes(opts.lockAt)) throw new Error('Unknown chest rule');
  if (![3, 4, 5].includes(opts.penalties)) throw new Error('Unknown penalty limit');
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({ name: s.name, isBot: !!s.isBot, preset: s.preset || null, turns: 0, penalties: 0, sheet: freshSheet() }));
  return {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats,
    locked: ROWS.map(() => false), // rows that are closed to everybody
    pending: [], // rows locked during this roll (closed once the roll is over)
    lockedBy: ROWS.map(() => null),
    dice: null, // [white, white, ruby, gold, emerald, sapphire]
    phase: 'roll', // roll, white, color
    active: 0,
    order: [], // the seats that choose in the white phase
    step: 0,
    markedThisRoll: false,
    roll: 0,
    current: 0,
    over: false,
    winner: null,
    winners: [],
  };
}

// ---- marking ----
export const ticksOf = (seat, r) => seat.sheet[r].marks.length + (seat.sheet[r].chest ? 1 : 0);
export function score(state, i) {
  const s = state.seats[i];
  return ROWS.reduce((a, _, r) => a + TRI[Math.min(12, ticksOf(s, r))], 0) - PENALTY * s.penalties;
}
// The last mark in a row (the start value when it is empty).
export const lastMark = (seat, r) => (seat.sheet[r].marks.length ? seat.sheet[r].marks[seat.sheet[r].marks.length - 1] : START(r));

// Can `seat` mark number n in row r right now (the dice are not looked at here)?
export function canMark(state, i, r, n) {
  const seat = state.seats[i];
  if (state.locked[r]) return false;
  if (state.pending.includes(r) && (state.phase !== 'white' || n !== lastNumber(r))) return false; // a row locked in this roll: only its last number, and only in the white phase
  if (seat.sheet[r].chest) return false;
  const dir = ROWS[r].dir;
  if (dir === 1 ? !(n > lastMark(seat, r)) : !(n < lastMark(seat, r))) return false;
  if (n < 2 || n > 12) return false;
  if (n === lastNumber(r) && seat.sheet[r].marks.length < state.options.lockAt) return false;
  return true;
}

// How many numbers marking n would skip in that row.
export const skipped = (seat, r, n) => (ROWS[r].dir === 1 ? n - lastMark(seat, r) - 1 : lastMark(seat, r) - n - 1);

export function legalActions(state, seat) {
  if (state.over || seat !== state.current) return [];
  if (state.phase === 'roll') return [{ type: 'ROLL' }];
  const acts = [];
  const d = state.dice;
  if (state.phase === 'white') {
    const n = d[0] + d[1];
    ROWS.forEach((_, r) => { if (canMark(state, seat, r, n)) acts.push({ type: 'MARK', row: r, n }); });
  } else {
    ROWS.forEach((_, r) => {
      const seen = new Set();
      [d[0] + d[2 + r], d[1] + d[2 + r]].forEach((n) => { if (!seen.has(n)) { seen.add(n); if (canMark(state, seat, r, n)) acts.push({ type: 'MARK', row: r, n }); } });
    });
  }
  acts.push({ type: 'PASS' });
  return acts;
}

export const isOver = (state) => state.over;

export function result(state) {
  const tot = state.seats.map((_, i) => score(state, i));
  const chests = state.seats.map((s) => s.sheet.filter((x) => x.chest).length);
  const standings = state.seats.map((s, i) => ({ seat: i, name: s.name, total: tot[i], turns: s.turns })).sort((a, b) => (b.total - a.total) || (chests[b.seat] - chests[a.seat]));
  return { winner: state.winner, winners: state.winners, standings, soloScore: state.seats.length === 1 ? tot[0] : null };
}

export function observe(state) { return clone(state); } // nothing is hidden

function nextAfterWhite(s, events) {
  s.step += 1;
  if (s.step < s.order.length) { s.current = s.order[s.step]; events.push({ type: 'TURN_STARTED', seat: s.current, phase: 'white' }); return; }
  s.phase = 'color';
  s.current = s.active;
  events.push({ type: 'TURN_STARTED', seat: s.current, phase: 'color' });
}

function endRoll(s, events) {
  const act = s.seats[s.active];
  act.turns += 1;
  if (!s.markedThisRoll) { act.penalties += 1; events.push({ type: 'PENALTY', seat: s.active, count: act.penalties }); }
  s.pending.forEach((r) => { s.locked[r] = true; });
  s.pending = [];
  const lockedCount = s.locked.filter(Boolean).length;
  const over = lockedCount >= 2 || s.seats.some((x) => x.penalties >= s.options.penalties);
  events.push({ type: 'ROLL_ENDED', seat: s.active });
  if (over) {
    s.over = true;
    const tot = s.seats.map((_, i) => score(s, i));
    const best = Math.max(...tot);
    let w = s.seats.map((_, i) => i).filter((i) => tot[i] === best);
    if (w.length > 1) { const ch = w.map((i) => s.seats[i].sheet.filter((x) => x.chest).length); const m = Math.max(...ch); w = w.filter((_, k) => ch[k] === m); }
    s.winners = w;
    s.winner = w[0];
    events.push({ type: 'GAME_OVER', winner: s.winner, winners: w.slice() });
    return;
  }
  s.active = (s.active + 1) % s.seats.length;
  s.current = s.active;
  s.phase = 'roll';
  s.dice = null;
  s.markedThisRoll = false;
  events.push({ type: 'TURN_STARTED', seat: s.current, phase: 'roll' });
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.over) throw new Error('Game is over');
  const seat = s.current;
  if (action.type === 'ROLL') {
    if (s.phase !== 'roll') throw new Error('Cannot roll now');
    s.roll += 1;
    s.dice = [rng.die(6), rng.die(6), rng.die(6), rng.die(6), rng.die(6), rng.die(6)];
    s.markedThisRoll = false;
    s.phase = 'white';
    s.order = s.seats.map((_, k) => (s.active + k) % s.seats.length);
    s.step = 0;
    s.current = s.order[0];
    events.push({ type: 'ROLLED', seat, dice: s.dice.slice() });
    events.push({ type: 'TURN_STARTED', seat: s.current, phase: 'white' });
  } else if (action.type === 'MARK') {
    if (s.phase === 'roll') throw new Error('Roll first');
    const r = action.row;
    const n = action.n;
    const legal = legalActions(s, seat).some((a) => a.type === 'MARK' && a.row === r && a.n === n);
    if (!legal) throw new Error('Cannot mark that');
    const sh = s.seats[seat].sheet[r];
    sh.marks.push(n);
    const lock = n === lastNumber(r);
    if (lock) { sh.chest = true; if (!s.pending.includes(r) && !s.locked[r]) { s.pending.push(r); s.lockedBy[r] = seat; } }
    if (seat === s.active) s.markedThisRoll = true;
    events.push({ type: 'MARKED', seat, row: r, n, phase: s.phase, lock });
    if (lock) events.push({ type: 'ROW_LOCKED', seat, row: r });
    if (s.phase === 'white') nextAfterWhite(s, events); else endRoll(s, events);
  } else if (action.type === 'PASS') {
    if (s.phase === 'roll') throw new Error('Roll first');
    events.push({ type: 'PASSED', seat, phase: s.phase });
    if (s.phase === 'white') nextAfterWhite(s, events); else endRoll(s, events);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot ----
// The bot marks when it skips few numbers; a little more skipping is accepted by the active player rather than taking a penalty.
const SETTINGS = {
  cautious: { skip: 1, noise: 0.6 },
  balanced: { skip: 2, noise: 1.0 },
  bold: { skip: 3, noise: 1.2 },
};

export function choose(obs, seat, presetKey, seed) {
  const cfg = SETTINGS[presetKey] || SETTINGS.balanced;
  const rng = createRng(seed);
  const legal = legalActions(obs, seat);
  if (legal.length === 1) return { actions: [legal[0]], margin: null };
  const me = obs.seats[seat];
  const marks = legal.filter((a) => a.type === 'MARK');
  const mustAvoidPenalty = seat === obs.active && !obs.markedThisRoll && obs.phase === 'color';
  const allow = cfg.skip + (mustAvoidPenalty ? 2 : 0) + (rng.next() < 0.15 * cfg.noise ? 1 : 0);
  const tot = obs.seats.map((_, i) => score(obs, i));
  const ahead = tot[seat] >= Math.max(...tot);
  const scored = marks.map((a) => {
    const sk = skipped(me, a.row, a.n);
    const ticks = me.sheet[a.row].marks.length;
    const lock = a.n === lastNumber(a.row);
    let value = -sk * 2 + Math.min(ticks, 8) * 0.3 + (lock ? 3 : 0) + rng.next() * 0.2 * cfg.noise;
    if (lock && !(ticks >= 6 || ahead)) value -= 20; // only take the chest with a good row, or when ahead
    return { a, sk, value };
  }).filter((x) => x.sk <= allow && x.value > -10);
  if (!scored.length) return { actions: [{ type: 'PASS' }], margin: null };
  scored.sort((x, y) => y.value - x.value);
  return { actions: [scored[0].a], margin: null };
}
