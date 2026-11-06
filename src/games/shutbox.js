// Shut the Box: pure rules module. No DOM, no timers, no Math.random.
import { validSets, scoreOpen, oneDieAllowed } from '../blocks/tile-board.js';

const SIZES = [9, 10, 12];

export const meta = {
  id: 'shutbox',
  name: 'Shut the Box',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 5,
  tier: 'A',
  soloBest: 'low', // lowest score is best; 0 means the box was shut
  soloKey: (o) => `${o.size}:${o.oneDie}:${o.maxTiles}:${o.scoring}`,
  soloValue: (res) => res.soloScore,
  soloTitle: (v) => (v === 0 ? 'You shut the box!' : `Score ${v}`),
  soloLabel: (v) => `${v}`,
  soloHide: ['format'],
  houseRules: [
    { key: 'size', label: 'Board size', options: SIZES.map((n) => ({ value: n, label: `${n} tiles` })), default: 9 },
    {
      key: 'oneDie', label: 'One-die rule',
      options: [{ value: 'standard', label: 'Standard' }, { value: 'late', label: 'Late' }, { value: 'off', label: 'Off' }],
      default: 'standard',
      hint: () => 'Standard: roll one die once every tile above 6 is shut · Late: once the open tiles add up to less than 6 · Off: always two dice.',
    },
    { key: 'maxTiles', label: 'Tiles per roll', options: [{ value: 0, label: 'Any number' }, { value: 2, label: 'At most 2' }], default: 0 },
    {
      key: 'scoring', label: 'Scoring',
      options: [{ value: 'sum', label: 'Sum' }, { value: 'digits', label: 'Digits', disabled: (o) => o.size !== 9, disabledNote: 'Digits is for the 9-tile board only.' }],
      default: 'sum',
      hint: () => 'Sum: add the open tiles · Digits: read the open tiles as one number (open 1, 5, 9 scores 159).',
    },
    {
      key: 'format', label: 'Format',
      options: [{ value: 'single', label: 'Single round' }, { value: 'out45', label: 'Out at 45' }, { value: 'out100', label: 'Out at 100' }],
      default: 'single',
      hint: () => 'Single round: lowest score wins · Out at 45 / 100: scores add up over rounds, reach the limit and you are out, last player in wins (Digits scoring knocks players out very fast).',
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

// Digits scoring only exists on the 9-tile board: anything else falls back to Sum.
export function normalizeOptions(options) {
  const o = { ...options };
  if (o.size !== 9 && o.scoring === 'digits') o.scoring = 'sum';
  return o;
}

const cloneState = (s) => ({
  ...s,
  seats: s.seats.map((x) => ({ ...x, last: x.last ? { ...x.last } : null })),
  turn: { ...s.turn, open: s.turn.open.slice(), dice: s.turn.dice.slice() },
  winners: s.winners.slice(),
});

const freshTurn = (size) => ({ open: Array.from({ length: size }, (_, i) => i + 1), phase: 'roll', dice: [], target: 0 });

export function setup(options) {
  const opts = { ...defaultOptions(), ...options };
  if (!SIZES.includes(opts.size)) throw new Error('Unknown board size');
  if (opts.scoring === 'digits' && opts.size !== 9) throw new Error('Digits scoring is only for the 9-tile board');
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({
    name: s.name, isBot: !!s.isBot, preset: s.preset || null, total: 0, turns: 0, out: false, last: null,
  }));
  if (seats.length === 1) opts.format = 'single'; // Solo is one turn
  return {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats, current: 0, round: 1, turn: freshTurn(opts.size), over: false, winners: [],
  };
}

export const observe = (state) => state; // no hidden information

export function legalActions(state, seat) {
  if (state.over || seat !== state.current) return [];
  const t = state.turn;
  if (t.phase === 'roll') {
    const acts = [{ type: 'ROLL', ids: [0, 1] }];
    if (oneDieAllowed(state.options.oneDie, t.open)) acts.push({ type: 'ROLL', ids: [0] });
    return acts;
  }
  return validSets(t.open, t.target, state.options.maxTiles).map((ids) => ({ type: 'FLIP', ids }));
}

export const isOver = (state) => state.over;

export function result(state) {
  const standings = state.seats
    .map((s, i) => ({ seat: i, name: s.name, total: s.total, turns: s.turns, out: s.out }))
    .sort((a, b) => a.total - b.total);
  return {
    winner: state.winners.length === 1 ? state.winners[0] : null,
    winners: state.winners.slice(),
    standings,
    soloScore: state.seats.length === 1 ? state.seats[0].total : null,
  };
}

function startTurn(s, events) {
  s.turn = freshTurn(s.options.size);
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

function finish(s, events, winners) {
  s.winners = winners;
  s.over = true;
  events.push({ type: 'GAME_OVER', winners: winners.slice() });
}

function endTurn(s, events, score, shut) {
  const seat = s.seats[s.current];
  seat.last = { score, shut };
  seat.turns += 1;
  const single = s.options.format === 'single';
  seat.total = single ? score : seat.total + score;
  events.push({ type: 'SCORED', seat: s.current, score, total: seat.total, shut });
  events.push({ type: 'TURN_ENDED', seat: s.current });
  const n = s.seats.length;

  if (single) {
    if (shut) { finish(s, events, [s.current]); return; } // shutting the box ends the game at once
    if (s.current === n - 1) {
      const best = Math.min(...s.seats.map((x) => x.total));
      finish(s, events, s.seats.map((x, i) => (x.total === best ? i : -1)).filter((i) => i >= 0));
      return;
    }
    s.current += 1;
    startTurn(s, events);
    return;
  }

  // Out-at formats: everyone still in takes a turn each round (a shut box just scores 0).
  const next = s.seats.findIndex((x, i) => i > s.current && !x.out);
  if (next >= 0) { s.current = next; startTurn(s, events); return; }
  const limit = s.options.format === 'out45' ? 45 : 100;
  const justOut = [];
  s.seats.forEach((x, i) => {
    if (!x.out && x.total >= limit) { x.out = true; justOut.push(i); events.push({ type: 'ELIMINATED', seat: i, total: x.total }); }
  });
  const active = s.seats.map((x, i) => (x.out ? -1 : i)).filter((i) => i >= 0);
  if (active.length === 1) { finish(s, events, [active[0]]); return; }
  if (active.length === 0) {
    const best = Math.min(...justOut.map((i) => s.seats[i].total));
    finish(s, events, justOut.filter((i) => s.seats[i].total === best));
    return;
  }
  s.round += 1;
  events.push({ type: 'ROUND_STARTED', round: s.round });
  s.current = active[0];
  startTurn(s, events);
}

export function apply(state, action, rng) {
  const s = cloneState(state);
  const events = [];
  if (s.over) throw new Error('Game is over');
  const t = s.turn;

  if (action.type === 'ROLL') {
    if (t.phase !== 'roll') throw new Error('Flip first');
    const ids = action.ids;
    const two = Array.isArray(ids) && ids.length === 2 && ids[0] === 0 && ids[1] === 1;
    const one = Array.isArray(ids) && ids.length === 1 && ids[0] === 0;
    if (!two && !one) throw new Error('Bad dice selection');
    if (one && !oneDieAllowed(s.options.oneDie, t.open)) throw new Error('One die is not allowed now');
    t.dice = ids.map(() => rng.die(6));
    t.target = t.dice.reduce((a, b) => a + b, 0);
    events.push({ type: 'ROLLED', seat: s.current, dice: t.dice.slice(), target: t.target });
    if (validSets(t.open, t.target, s.options.maxTiles).length === 0) {
      const score = scoreOpen(t.open, s.options.scoring);
      events.push({ type: 'NO_MOVE', seat: s.current, score });
      endTurn(s, events, score, false);
    } else {
      t.phase = 'flip';
    }
  } else if (action.type === 'FLIP') {
    if (t.phase !== 'flip') throw new Error('Roll first');
    const ids = action.ids;
    if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length) throw new Error('Bad tile selection');
    if (ids.some((i) => !t.open.includes(i))) throw new Error('Tile is not open');
    if (ids.reduce((a, b) => a + b, 0) !== t.target) throw new Error('Tiles do not add up to the roll');
    if (s.options.maxTiles > 0 && ids.length > s.options.maxTiles) throw new Error('Too many tiles');
    t.open = t.open.filter((i) => !ids.includes(i));
    events.push({ type: 'FLIPPED', seat: s.current, ids: ids.slice().sort((a, b) => a - b) });
    if (t.open.length === 0) {
      events.push({ type: 'BOX_SHUT', seat: s.current });
      endTurn(s, events, 0, true);
    } else {
      t.phase = 'roll';
      t.dice = [];
      t.target = 0;
    }
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot hooks (used by src/ai/brain.js) ----
export const botHints = { riskScale: 1, noiseScale: 0.2, simsPerPlan: (presetSims) => presetSims };

// Shutting the box right now is always best.
export function shortcut(obs) {
  if (obs.turn.phase !== 'flip') return null;
  const all = validSets(obs.turn.open, obs.turn.target, obs.options.maxTiles).find((set) => set.length === obs.turn.open.length);
  return all ? { type: 'FLIP', ids: all } : null;
}

export function candidatePlans(obs, seat) {
  return legalActions(obs, seat).map((a) => [a]);
}

// Value of a finished simulated turn: the negative of its score (lower scores are better).
export function turnValue(state, seat) {
  const l = state.seats[seat].last;
  return l ? -l.score : -1e9;
}

// Continuation policy: flip the set containing the highest tile (fewest tiles on a tie); roll one die when it is
// allowed and the open tiles add up to 6 or less, otherwise two dice.
export function rollout(state, seat, rng, turnsAtStart) {
  let s = state;
  for (let step = 0; step < 80; step++) {
    if (s.over || s.current !== seat || s.seats[seat].turns > turnsAtStart) return s;
    const t = s.turn;
    if (t.phase === 'roll') {
      const sum = t.open.reduce((a, b) => a + b, 0);
      const ids = oneDieAllowed(s.options.oneDie, t.open) && sum <= 6 ? [0] : [0, 1];
      s = apply(s, { type: 'ROLL', ids }, rng).state;
    } else {
      const sets = validSets(t.open, t.target, s.options.maxTiles);
      let best = sets[0];
      for (const set of sets) {
        const hi = set[set.length - 1];
        const bh = best[best.length - 1];
        if (hi > bh || (hi === bh && set.length < best.length)) best = set;
      }
      s = apply(s, { type: 'FLIP', ids: best }, rng).state;
    }
  }
  return s;
}
