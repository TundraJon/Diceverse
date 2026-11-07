// Cliffhanger: pure rules module (a push-your-luck column climb). No DOM, no timers, no Math.random.
import { createPool, rollPool, values } from '../blocks/dice-pool.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

// Column lengths, indexed by the sum (2..12); entries 0 and 1 are unused.
export const LEN = [0, 0, 3, 5, 7, 9, 11, 13, 11, 9, 7, 5, 3];
const COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MARKERS = 3;
const CAP = { 1: 5, 2: 5, 3: 4, 4: 3 }; // most columns to win, by number of players

export const meta = {
  id: 'cliffhanger',
  name: 'Cliffhanger',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 15,
  tier: 'B',
  soloBest: 'low', // fewest turns to win the columns
  soloKey: (o) => `${o.winCols}:${o.occupied}`,
  soloValue: (res) => res.soloTurns,
  soloTitle: (v) => `Done in ${v} turns`,
  soloLabel: (v) => `${v} turns`,
  houseRules: [
    {
      key: 'winCols', label: 'Columns to win',
      options: [{ value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }],
      default: 3,
      hint: () => 'The first player to win this many columns wins. With 3 players the most is 4, with 4 players the most is 3 (2 players and solo: up to 5).',
    },
    {
      key: 'occupied', label: 'Occupied spaces',
      options: [{ value: 'normal', label: 'Normal' }, { value: 'jump', label: 'Jumping' }, { value: 'forced', label: 'Forced move' }],
      default: 'normal',
      hint: () => 'Normal: markers may share a space with an opponent · Jumping: a marker skips spaces holding an opponent · Forced move: while a marker stands on an opponent\'s space you must keep rolling (or blow it).',
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

/* ---------- helpers ---------- */
const SPLITS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

const splitSums = (d) => [[d[0] + d[1], d[2] + d[3]], [d[0] + d[2], d[1] + d[3]], [d[0] + d[3], d[1] + d[2]]];

// The three ways to split four dice into two pairs: the two sums and a readable text.
export function splits(dice) {
  const all = splitSums(dice);
  return SPLITS.map(([p, q], i) => ({
    sums: all[i],
    text: `${dice[p[0]]}+${dice[p[1]]} · ${dice[q[0]]}+${dice[q[1]]}`,
  }));
}

const occupied = (s, col, pos) => s.seats.some((x, i) => i !== s.current && x.prog[col] === pos);

// The next space above `from` in a column (skipping occupied spaces when Jumping); 0 when there is none.
function nextPos(s, col, from) {
  let p = from + 1;
  if (s.options.occupied === 'jump') while (p <= LEN[col] && occupied(s, col, p)) p++;
  return p <= LEN[col] ? p : 0;
}

// Try to apply column steps (a column listed twice is two steps) to a copy of the markers. null when not possible.
function trySteps(s, markers, cols) {
  const m = { ...markers };
  const steps = [];
  for (const c of cols) {
    if (s.owner[c] !== null) return null; // won columns are closed to everyone
    if (m[c] !== undefined) {
      const p = nextPos(s, c, m[c]);
      if (!p) return null;
      steps.push({ col: c, from: m[c], to: p, placed: false });
      m[c] = p;
    } else {
      if (Object.keys(m).length >= MARKERS) return null;
      const base = s.seats[s.current].prog[c];
      const p = nextPos(s, c, base);
      if (!p) return null;
      steps.push({ col: c, from: base, to: p, placed: true });
      m[c] = p;
    }
  }
  return { markers: m, steps };
}

// Every legal CHOOSE for the dice just rolled: each split gives both columns when both can be used, otherwise
// whichever single column can be used (a choice when both can but only one marker is left).
export function chooseOptions(s) {
  const t = s.turn;
  const seen = new Set();
  const out = [];
  const add = (cols) => { const k = cols.join(','); if (!seen.has(k)) { seen.add(k); out.push(cols); } };
  for (const [x, y] of splitSums(t.dice)) {
    if (trySteps(s, t.markers, [x, y])) add([x, y].sort((a, b) => a - b));
    else {
      if (trySteps(s, t.markers, [x])) add([x]);
      if (y !== x && trySteps(s, t.markers, [y])) add([y]);
    }
  }
  return out.sort((a, b) => a[0] * 100 + (a[1] || 0) - (b[0] * 100 + (b[1] || 0)));
}

// Forced move: a marker stands on a space that holds an opponent's progress.
export function stuck(s) {
  if (s.options.occupied !== 'forced') return false;
  return Object.entries(s.turn.markers).some(([c, pos]) => occupied(s, Number(c), pos));
}
const canBank = (s) => Object.keys(s.turn.markers).length > 0 && !stuck(s);

/* ---------- engine contract ---------- */
export function setup(options) {
  const opts = { ...defaultOptions(), ...options };
  if (![3, 4, 5].includes(opts.winCols)) throw new Error('Unknown number of columns to win');
  if (!['normal', 'jump', 'forced'].includes(opts.occupied)) throw new Error('Unknown occupied-space rule');
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({
    name: s.name, isBot: !!s.isBot, preset: s.preset || null, prog: Array(13).fill(0), won: 0, turns: 0,
  }));
  opts.winCols = Math.min(opts.winCols, CAP[seats.length] || 3); // the sheet's cap by player count
  return {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats,
    owner: Array(13).fill(null),
    current: 0,
    turn: { phase: 'roll', dice: [], markers: {}, rolls: 0 },
    winner: null,
    over: false,
  };
}

export const observe = (state) => state; // no hidden information

export function legalActions(state, seat) {
  if (state.over || seat !== state.current) return [];
  const t = state.turn;
  if (t.phase === 'roll') return [{ type: 'ROLL' }];
  if (t.phase === 'choose') return chooseOptions(state).map((cols) => ({ type: 'CHOOSE', cols }));
  const acts = [{ type: 'ROLL' }];
  if (canBank(state)) acts.push({ type: 'BANK' });
  return acts;
}

export const isOver = (state) => state.over;

export function result(state) {
  const standings = state.seats
    .map((s, i) => ({ seat: i, name: s.name, total: s.won, turns: s.turns, progress: s.prog.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total || b.progress - a.progress);
  return {
    winner: state.winner,
    standings,
    soloTurns: state.seats.length === 1 ? state.seats[0].turns : null,
  };
}

function endTurn(s, events) {
  const seat = s.seats[s.current];
  seat.turns += 1;
  events.push({ type: 'TURN_ENDED', seat: s.current });
  s.turn = { phase: 'roll', dice: [], markers: {}, rolls: 0 };
  if (s.winner !== null) {
    s.over = true;
    events.push({ type: 'GAME_OVER', winner: s.winner });
    return;
  }
  s.current = (s.current + 1) % s.seats.length;
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.over) throw new Error('Game is over');
  const t = s.turn;
  const seat = s.seats[s.current];

  if (action.type === 'ROLL') {
    if (t.phase === 'choose') throw new Error('Choose a pair first');
    t.dice = values(rollPool(createPool(4, 6), rng));
    t.rolls += 1;
    events.push({ type: 'ROLLED', seat: s.current, dice: t.dice.slice() });
    if (chooseOptions(s).length === 0) {
      const lost = Object.entries(t.markers).map(([c, pos]) => ({ col: Number(c), from: seat.prog[c], to: pos }));
      events.push({ type: 'BLOWN', seat: s.current, lost });
      endTurn(s, events);
    } else {
      t.phase = 'choose';
    }
  } else if (action.type === 'CHOOSE') {
    if (t.phase !== 'choose') throw new Error('Roll first');
    const cols = (action.cols || []).slice().sort((a, b) => a - b);
    const key = cols.join(',');
    if (!chooseOptions(s).some((o) => o.join(',') === key)) throw new Error('That pair is not playable');
    const r = trySteps(s, t.markers, cols);
    t.markers = r.markers;
    r.steps.forEach((st) => events.push({ type: 'MOVED', seat: s.current, ...st }));
    t.phase = 'decide';
  } else if (action.type === 'BANK') {
    if (t.phase !== 'decide' || !canBank(s)) throw new Error('Cannot bank now');
    const cols = Object.entries(t.markers).map(([c, pos]) => ({ col: Number(c), from: seat.prog[c], to: pos }));
    cols.forEach((m) => { seat.prog[m.col] = m.to; });
    events.push({ type: 'BANKED', seat: s.current, cols });
    cols.forEach((m) => {
      if (m.to !== LEN[m.col]) return;
      s.owner[m.col] = s.current;
      seat.won += 1;
      const removedFrom = [];
      s.seats.forEach((x, i) => { if (i !== s.current && x.prog[m.col] > 0) { x.prog[m.col] = 0; removedFrom.push(i); } });
      events.push({ type: 'COLUMN_WON', seat: s.current, col: m.col, removedFrom });
    });
    if (seat.won >= s.options.winCols) s.winner = s.current;
    endTurn(s, events);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

/* ---------- bot hooks (used by src/ai/brain.js) ---------- */
// Value of one step in each column = the expected number of rolls it takes to get that sum (exact, from the 1,296
// outcomes of four dice): rare sums are worth more per step, and every column ends up costing about the same.
const U = (() => {
  const cnt = Array(13).fill(0);
  for (let n = 0; n < 1296; n++) {
    const d = [n % 6 + 1, Math.floor(n / 6) % 6 + 1, Math.floor(n / 36) % 6 + 1, Math.floor(n / 216) % 6 + 1];
    const got = new Set();
    splitSums(d).forEach((sums) => sums.forEach((c) => got.add(c)));
    got.forEach((c) => { cnt[c] += 1; });
  }
  return cnt.map((c) => (c ? 1296 / c : 0));
})();

const STOP_AT = 9; // rollout policy: bank once this turn's progress is worth this many expected rolls

export const botHints = { riskScale: 1, noiseScale: 0.3, simsPerPlan: (presetSims) => Math.max(30, Math.floor(presetSims / 10)) };

const turnGain = (s) => {
  const base = s.seats[s.current].prog;
  return Object.entries(s.turn.markers).reduce((a, [c, pos]) => a + (pos - base[c]) * U[c], 0);
};
const atTop = (s) => Object.entries(s.turn.markers).filter(([c, pos]) => pos === LEN[c]).length;

// Banking right now wins the game: take it.
export function shortcut(obs, seat) {
  if (obs.turn.phase !== 'decide' || obs.current !== seat || !canBank(obs)) return null;
  return obs.seats[seat].won + atTop(obs) >= obs.options.winCols ? { type: 'BANK' } : null;
}

export function candidatePlans(obs, seat) {
  return legalActions(obs, seat).map((a) => [a]);
}

export const isDeterministic = (plan) => plan[0].type === 'BANK';

// Value of a finished simulated turn: committed progress in expected-roll units, plus a bonus per won column.
export function turnValue(state, seat) {
  const s = state.seats[seat];
  let v = s.won * 8;
  for (const c of COLS) v += s.prog[c] * U[c];
  return state.winner === seat ? v + 1000 : v;
}

// Continuation policy: take the pair worth the most; bank when the turn's progress reaches STOP_AT or a column top is reached.
export function rollout(state, seat, rng, turnsAtStart) {
  let s = state;
  for (let step = 0; step < 80; step++) {
    if (s.over || s.current !== seat || s.seats[seat].turns > turnsAtStart) return s;
    const t = s.turn;
    if (t.phase === 'roll') s = apply(s, { type: 'ROLL' }, rng).state;
    else if (t.phase === 'choose') {
      let best = null;
      let bestGain = -1;
      for (const cols of chooseOptions(s)) {
        const gain = trySteps(s, t.markers, cols).steps.reduce((a, st) => a + (st.to - st.from) * U[st.col], 0);
        if (gain > bestGain) { best = cols; bestGain = gain; }
      }
      s = apply(s, { type: 'CHOOSE', cols: best }, rng).state;
    } else if (canBank(s) && (turnGain(s) >= STOP_AT || atTop(s) > 0)) s = apply(s, { type: 'BANK' }, rng).state;
    else s = apply(s, { type: 'ROLL' }, rng).state;
  }
  return s;
}
