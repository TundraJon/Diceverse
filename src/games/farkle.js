// Farkle: pure rules module. No DOM, no timers, no Math.random.
// Rules per the supplied sheet (docs/farkle-rules-sheet.png); see Build Queue/Log in README.
import { createPool, rollPool } from '../blocks/dice-pool.js';
import { createPushLoop } from '../blocks/push-loop.js';
import { scoreSelection, validSubsets, hasScoring, bestSelection, scoreTable } from '../blocks/combo-table.js';

export const meta = {
  id: 'farkle',
  name: 'Farkle',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 15,
  tier: 'A',
  soloKey: (o) => `${o.target}:${o.entry}:${o.scoring}:${o.penalty}`,
  soloHide: ['finalRound'],
  houseRules: [
    { key: 'target', label: 'Target score', options: [{ value: 2500, label: '2,500' }, { value: 5000, label: '5,000' }, { value: 10000, label: '10,000' }], default: 10000 },
    { key: 'entry', label: 'Points to get on the board', options: [{ value: 0, label: 'None' }, { value: 500, label: '500' }, { value: 1000, label: '1,000' }], default: 500 },
    {
      key: 'scoring', label: 'Scoring', options: [{ value: 'standard', label: 'Standard' }, { value: 'classic', label: 'Classic' }], default: 'standard',
      // One line under the choice: what Classic leaves out, generated from the engine tables so it cannot drift.
      hint: () => {
        const classic = new Set(scoreTable('classic').map((r) => r.label));
        return `Classic leaves out: ${scoreTable('standard').filter((r) => !classic.has(r.label)).map((r) => r.label).join(', ')}.`;
      },
    },
    { key: 'penalty', label: '3 Farkles in a row: −1,000', options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }], default: true },
    { key: 'finalRound', label: 'Final round', options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }], default: true },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

const loop = createPushLoop({});

// Options are never mutated, so clones may share them. Manual clone keeps bot simulations fast.
const cloneState = (s) => ({
  ...s,
  seats: s.seats.map((x) => ({ ...x })),
  turn: { ...s.turn, dice: s.turn.dice.map((d) => ({ ...d })) },
  contenders: s.contenders.slice(),
  final: s.final ? { pending: s.final.pending.slice() } : null,
});

const freshTurn = () => ({ ...loop.freshTurn(), phase: 'start', hot: false, dice: createPool(6, 6) });

export function setup(options) {
  const opts = { ...defaultOptions(), ...options };
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({
    name: s.name, isBot: !!s.isBot, preset: s.preset || null, total: 0, turns: 0, onBoard: false, streak: 0,
  }));
  return {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats,
    current: 0,
    turn: freshTurn(),
    contenders: seats.map((_, i) => i),
    final: null,
    winner: null,
  };
}

export const observe = (state) => state; // no hidden information

export function canBank(state) {
  const seat = state.seats[state.current];
  return state.turn.points > 0 && (seat.onBoard || state.options.entry === 0 || state.turn.points >= state.options.entry);
}

export function legalActions(state, seat) {
  if (state.winner !== null || seat !== state.current) return [];
  const t = state.turn;
  if (t.phase === 'start') return [{ type: 'ROLL' }];
  if (t.phase === 'select') {
    const free = t.dice.filter((d) => d.state === 'free');
    return validSubsets(free.map((d) => d.value), state.options.scoring).map((sub) => ({
      type: 'SET_ASIDE', ids: sub.idx.map((i) => free[i].id),
    }));
  }
  const acts = [{ type: 'ROLL' }];
  if (canBank(state)) acts.push({ type: 'BANK' });
  return acts;
}

export const isOver = (state) => state.winner !== null;

export function result(state) {
  const standings = state.seats
    .map((s, i) => ({ seat: i, name: s.name, total: s.total, turns: s.turns }))
    .sort((a, b) => b.total - a.total);
  return { winner: state.winner, standings, soloTurns: state.seats.length === 1 ? state.seats[0].turns : null };
}

function endTurn(s, events, banked) {
  const seat = s.seats[s.current];
  seat.turns += 1;
  events.push({ type: 'TURN_ENDED', seat: s.current });
  const n = s.seats.length;
  const solo = n === 1;

  if (s.final) s.final.pending = s.final.pending.filter((i) => i !== s.current);

  if (banked && !s.final && seat.total >= s.options.target) {
    if (!s.options.finalRound || solo) {
      s.winner = s.current;
      events.push({ type: 'GAME_OVER', winner: s.winner });
      return;
    }
    // Every OTHER seat gets exactly one more turn, in seat order after the trigger.
    const pending = [];
    for (let step = 1; step < n; step++) pending.push((s.current + step) % n);
    s.final = { pending };
  }

  if (s.final && s.final.pending.length === 0) {
    const best = Math.max(...s.contenders.map((i) => s.seats[i].total));
    const leaders = s.contenders.filter((i) => s.seats[i].total === best);
    if (leaders.length === 1) {
      s.winner = leaders[0];
      events.push({ type: 'GAME_OVER', winner: s.winner });
      return;
    }
    // Exact tie: one more turn each among only the tied seats.
    s.contenders = leaders;
    const pending = [];
    for (let step = 1; step <= n; step++) { const c = (s.current + step) % n; if (leaders.includes(c)) pending.push(c); }
    s.final = { pending };
  }

  let next = (s.current + 1) % n;
  if (s.final) {
    for (let step = 1; step <= n; step++) {
      const c = (s.current + step) % n;
      if (s.final.pending.includes(c)) { next = c; break; }
    }
  }
  s.current = next;
  s.turn = freshTurn();
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

export function apply(state, action, rng) {
  const s = cloneState(state);
  const events = [];
  if (s.winner !== null) throw new Error('Game is over');
  const seat = s.seats[s.current];
  const t = s.turn;

  if (action.type === 'ROLL') {
    if (t.phase !== 'start' && t.phase !== 'decide') throw new Error('Cannot roll now');
    const fresh = t.phase === 'start' || t.hot; // all six dice are rolled
    if (fresh) t.dice = createPool(6, 6);
    t.hot = false;
    t.dice = rollPool(t.dice, rng);
    t.rolls += 1;
    const rolled = t.dice.filter((d) => d.state === 'free');
    events.push({ type: 'ROLLED', seat: s.current, ids: rolled.map((d) => d.id), dice: rolled.map((d) => d.value), fresh });
    if (!hasScoring(rolled.map((d) => d.value), s.options.scoring)) {
      loop.bust(s, events, { type: 'FARKLED' });
      seat.streak += 1;
      if (s.options.penalty && seat.streak >= 3) {
        const amount = Math.min(1000, seat.total);
        seat.total -= amount;
        seat.streak = 0;
        events.push({ type: 'PENALTY', seat: s.current, amount, total: seat.total });
      }
      endTurn(s, events, false);
    } else {
      t.phase = 'select';
    }
  } else if (action.type === 'SET_ASIDE') {
    if (t.phase !== 'select') throw new Error('Cannot set aside now');
    const ids = action.ids;
    if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length) throw new Error('Bad selection');
    const dice = ids.map((id) => t.dice.find((d) => d.id === id));
    if (dice.some((d) => !d || d.state !== 'free')) throw new Error('Bad selection');
    const gain = scoreSelection(dice.map((d) => d.value), s.options.scoring);
    if (gain === null) throw new Error('Selection does not score');
    dice.forEach((d) => (d.state = 'kept'));
    t.points += gain;
    events.push({ type: 'SCORED', seat: s.current, gain, turnPoints: t.points, ids: ids.slice() });
    if (!t.dice.some((d) => d.state === 'free')) {
      t.hot = true;
      events.push({ type: 'HOT_DICE', seat: s.current });
    }
    t.phase = 'decide';
  } else if (action.type === 'BANK') {
    if (t.phase !== 'decide') throw new Error('Cannot bank now');
    if (!canBank(s)) throw new Error('Cannot bank yet');
    loop.bank(s, events);
    seat.onBoard = true;
    seat.streak = 0;
    endTurn(s, events, true);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot hooks (used by src/ai/brain.js) ----
export const botHints = { riskScale: 50 };

export function shortcut(obs, seat) {
  // Banking now ends the game immediately when there is no final round (or solo): take it.
  const me = obs.seats[seat];
  if (obs.turn.phase === 'decide' && canBank(obs) && (!obs.options.finalRound || obs.seats.length === 1) &&
      me.total + obs.turn.points >= obs.options.target) {
    return { type: 'BANK' };
  }
  return null;
}

// Candidate plans for the current phase. In the select phase each plan is
// [SET_ASIDE subset, then ROLL or BANK]; subsets are pruned to the best-scoring one
// plus the best-scoring one of each size (keeping back scoring dice to roll more).
export function candidatePlans(obs, seat) {
  const t = obs.turn;
  if (t.phase !== 'select') return legalActions(obs, seat).map((a) => [a]);
  const free = t.dice.filter((d) => d.state === 'free');
  const subs = validSubsets(free.map((d) => d.value), obs.options.scoring);
  const unique = new Map();
  for (const sub of subs) {
    const key = sub.idx.map((i) => free[i].value).sort().join('');
    if (!unique.has(key)) unique.set(key, { ids: sub.idx.map((i) => free[i].id), score: sub.score, size: sub.idx.length });
  }
  const all = [...unique.values()];
  const keep = new Set();
  const top = all.reduce((a, b) => (b.score > a.score ? b : a));
  keep.add(top);
  const bestBySize = new Map();
  for (const c of all) if (!bestBySize.has(c.size) || c.score > bestBySize.get(c.size).score) bestBySize.set(c.size, c);
  bestBySize.forEach((c) => keep.add(c));
  const plans = [];
  const me = obs.seats[seat];
  for (const c of keep) {
    const act = { type: 'SET_ASIDE', ids: c.ids };
    plans.push([act, { type: 'ROLL' }]);
    const pts = t.points + c.score;
    if (me.onBoard || obs.options.entry === 0 || pts >= obs.options.entry) plans.push([act, { type: 'BANK' }]);
  }
  return plans;
}

// Simple continuation policy used to value a plan: take all scoring dice, bank when allowed.
export function rollout(state, seat, rng, turnsAtStart) {
  let s = state;
  for (let step = 0; step < 40; step++) {
    if (s.winner !== null || s.current !== seat || s.seats[seat].turns > turnsAtStart) return s;
    const phase = s.turn.phase;
    if (phase === 'select') {
      const free = s.turn.dice.filter((d) => d.state === 'free');
      const idx = bestSelection(free.map((d) => d.value), s.options.scoring);
      s = apply(s, { type: 'SET_ASIDE', ids: idx.map((i) => free[i].id) }, rng).state;
    } else if (phase === 'decide' && canBank(s)) {
      s = apply(s, { type: 'BANK' }, rng).state;
    } else {
      s = apply(s, { type: 'ROLL' }, rng).state;
    }
  }
  return s;
}
