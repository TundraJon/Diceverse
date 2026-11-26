// Dice Chase: pure rules module. No DOM, no timers, no Math.random.
// A turn: roll a ROW of dice (faces 1 to 4 are the colours Ice, Leaf, Water, Fire worth 1 to 4 points; face 5 is a Sweep die; face 6 is a x2 die). A fairy
// starts left of the first die. Each step you roll the ACTION die: 1 to 4 = the fairy jumps to the next die on its right with that colour; 5 = to the next
// special die (Sweep or x2); 6 = Surge: +3 points and the fairy stays. Landing scores the die (a special scores 2). Landing on a Sweep die arms it: the next
// jump also scores every die it jumps over. Landing on a x2 die doubles the next jump. After each step you STOP (bank the turn's points) or ROLL again; if the
// action die has nothing to jump to, you bust and lose the turn's points. Reach the target and everybody gets the same number of turns (a tie is shared).

const clone = (v) => JSON.parse(JSON.stringify(v));

export const SURGE = 3; // points of a Surge
export const SPECIAL = 2; // points of landing on (or sweeping over) a Sweep or x2 die
export const NAMES = ['Ice', 'Leaf', 'Water', 'Fire', 'Sweep', 'x2']; // what each row die face is
export const pointsOf = (face) => (face <= 4 ? face : SPECIAL);

export const meta = {
  id: 'chase',
  name: 'Dice Chase',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 8,
  tier: 'A',
  soloKey: (o) => `${o.target}:${o.row}`, // the personal best is per target and row size (fewest turns)
  soloHide: [],
  houseRules: [
    {
      key: 'row', label: 'Row size',
      options: [6, 8, 10].map((v) => ({ value: v, label: `${v} dice` })),
      default: 8,
      hint: () => 'How many dice are in the row. A short row has fewer places to jump to, so you bust more often.',
    },
    {
      key: 'target', label: 'Target score',
      options: [20, 30, 40].map((v) => ({ value: v, label: String(v) })),
      default: 30,
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

const freshTurn = () => ({
  phase: 'lay', // lay (the row is rolled), decide (roll the action die or stop)
  row: [], // the face numbers of the row, left to right
  pos: -1, // where the fairy is (-1 = before the first die)
  points: 0, // the turn's points, not yet banked
  sweep: false, // a Sweep die was landed on: the next jump also scores the dice it jumps over
  x2: false, // a x2 die was landed on: the next jump is doubled
  rolls: 0,
  last: null, // the face of the latest action die
});

export function setup(options, rng) {
  const opts = { ...defaultOptions(), ...options };
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({
    name: s.name,
    isBot: !!s.isBot,
    preset: s.preset || null,
    total: 0,
    turns: 0,
  }));
  const n = seats.length;
  const drawn = n === 1 ? 0 : rng.die(n) - 1; // the starting player is drawn; Pass & Play can name one (options.first)
  const starter = Number.isInteger(opts.first) && opts.first >= 0 && opts.first < n ? opts.first : drawn;
  return {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats,
    current: starter,
    starter,
    turn: freshTurn(),
    final: null, // { turns } once somebody has reached the target: everybody plays up to this many turns
    winner: null,
    winners: [],
  };
}

export function observe(state) {
  return state; // no hidden information
}

// Where the action die `face` would take the fairy from `pos` in `row` (-1 = nowhere: a bust).
export function targetOf(row, pos, face) {
  if (face === 6) return pos; // Surge: stays
  for (let i = pos + 1; i < row.length; i++) {
    if (face <= 4 ? row[i] === face : row[i] >= 5) return i;
  }
  return -1;
}

export function legalActions(state, seat) {
  if (state.winner !== null || seat !== state.current) return [];
  const t = state.turn;
  if (t.phase === 'lay') return [{ type: 'LAY' }];
  return t.rolls > 0 ? [{ type: 'ROLL' }, { type: 'STOP' }] : [{ type: 'ROLL' }];
}

export function isOver(state) {
  return state.winner !== null;
}

export function result(state) {
  const standings = state.seats
    .map((s, i) => ({ seat: i, name: s.name, total: s.total, turns: s.turns }))
    .sort((a, b) => b.total - a.total);
  return { winner: state.winner, winners: state.winners.slice(), standings, soloTurns: state.seats.length === 1 ? state.seats[0].turns : null };
}

function gameOver(s, events, winners) {
  s.winner = winners[0];
  s.winners = winners.slice();
  events.push({ type: 'GAME_OVER', winner: s.winner, winners: s.winners.slice() });
}

function endTurn(s, events, bust) {
  const seat = s.seats[s.current];
  const t = s.turn;
  const gain = bust ? 0 : t.points;
  seat.total += gain;
  seat.turns += 1;
  events.push({ type: 'TURN_SCORED', seat: s.current, gain, lost: bust ? t.points : 0, bust, total: seat.total });
  if (bust) events.push({ type: 'BUSTED', seat: s.current, lost: 0 }); // (the bot moods listen for these)
  else if (gain > 0) events.push({ type: 'BANKED', seat: s.current, amount: gain, total: seat.total });
  events.push({ type: 'TURN_ENDED', seat: s.current });
  nextTurn(s, events);
}

function nextTurn(s, events) {
  const target = s.options.target;
  const seat = s.seats[s.current];
  if (s.seats.length === 1) {
    if (seat.total >= target) { gameOver(s, events, [0]); return; }
  } else if (!s.final && seat.total >= target) {
    s.final = { turns: seat.turns };
  }
  if (s.final && s.seats.every((x) => x.turns >= s.final.turns)) {
    const best = Math.max(...s.seats.map((x) => x.total));
    gameOver(s, events, s.seats.map((x, i) => (x.total === best ? i : -1)).filter((i) => i >= 0)); // a tie is shared
    return;
  }
  const n = s.seats.length;
  let next = s.current;
  for (let step = 1; step <= n; step++) {
    const cand = (s.current + step) % n;
    if (s.final && s.seats[cand].turns >= s.final.turns) continue; // already has all its turns
    next = cand;
    break;
  }
  s.current = next;
  s.turn = freshTurn();
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.winner !== null) throw new Error('Game is over');
  const t = s.turn;
  if (action.type === 'LAY') {
    if (t.phase !== 'lay') throw new Error('The row is already rolled');
    t.row = Array.from({ length: s.options.row }, () => rng.die(6));
    t.phase = 'decide';
    events.push({ type: 'ROW_ROLLED', seat: s.current, row: t.row.slice() });
  } else if (action.type === 'ROLL') {
    if (t.phase !== 'decide') throw new Error('Cannot roll now');
    let face = rng.die(6);
    // The first roll of a turn is never wasted: if it has nothing to jump to, it is rolled again.
    while (t.rolls === 0 && targetOf(t.row, t.pos, face) === -1) face = rng.die(6);
    t.rolls += 1;
    t.last = face;
    events.push({ type: 'ACTION_ROLLED', seat: s.current, face });
    if (face === 6) { // Surge: +3, the fairy stays (a pending x2 or Sweep waits for the next jump)
      t.points += SURGE;
      events.push({ type: 'SURGE', seat: s.current, gain: SURGE, points: t.points });
    } else {
      const to = targetOf(t.row, t.pos, face);
      if (to === -1) {
        events.push({ type: 'NO_TARGET', seat: s.current, face, lost: t.points });
        endTurn(s, events, true);
        return { state: s, events };
      }
      const landing = pointsOf(t.row[to]);
      let swept = 0;
      let skipped = 0;
      if (t.sweep) for (let i = t.pos + 1; i < to; i++) { swept += pointsOf(t.row[i]); skipped += 1; }
      let gain = landing + swept;
      const doubled = t.x2;
      if (doubled) gain *= 2;
      const from = t.pos;
      t.points += gain;
      t.pos = to;
      t.sweep = t.row[to] === 5; // landing on a Sweep die arms it (a Sweep used just now is used up)
      t.x2 = t.row[to] === 6;
      events.push({ type: 'JUMPED', seat: s.current, from, to, landing, swept, skipped, doubled, gain, points: t.points, sweepArmed: t.sweep, x2Armed: t.x2 });
      if (to === t.row.length - 1) { // the fairy is at the last die: nothing is left, the turn banks
        events.push({ type: 'ROW_DONE', seat: s.current });
        endTurn(s, events, false);
      }
    }
  } else if (action.type === 'STOP') {
    if (t.phase !== 'decide' || t.rolls === 0) throw new Error('Cannot stop now');
    endTurn(s, events, false);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot hooks (used by src/ai/brain.js) ----
export const botHints = { riskScale: 1 };

export function candidatePlans(obs, seat) {
  return legalActions(obs, seat).map((a) => [a]);
}

// A plan that only stops has no luck in it.
export const isDeterministic = (plan) => plan.length === 1 && plan[0].type === 'STOP';

// The odds of the next roll: how likely it is to bust, and the points it would score if it does not.
export function nextRoll(t) {
  let bust = 0;
  let gain = 0;
  for (let face = 1; face <= 6; face++) {
    if (face === 6) { gain += SURGE; continue; }
    const to = targetOf(t.row, t.pos, face);
    if (to === -1) { bust += 1; continue; }
    let g = pointsOf(t.row[to]);
    if (t.sweep) for (let i = t.pos + 1; i < to; i++) g += pointsOf(t.row[i]);
    gain += t.x2 ? g * 2 : g;
  }
  return { bust: bust / 6, gain: gain / 6 }; // gain: averaged over all six faces (a bust counts 0)
}

// Roll again or stop, for the rest of a simulated turn: roll while the expected gain beats the expected loss.
function wantsToRoll(s) {
  const t = s.turn;
  if (t.rolls === 0) return true;
  const { bust, gain } = nextRoll(t);
  return gain > bust * t.points;
}

export function rollout(state, seat, rng, turnsAtStart) {
  let s = state;
  for (let guard = 0; guard < 60; guard++) {
    if (s.winner !== null || s.current !== seat || s.seats[seat].turns > turnsAtStart) break;
    const t = s.turn;
    const a = t.phase === 'lay' ? { type: 'LAY' } : wantsToRoll(s) ? { type: 'ROLL' } : { type: 'STOP' };
    s = apply(s, a, rng).state;
  }
  return s;
}
