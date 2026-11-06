// Yacht: pure rules module. One game, three rule sets (Classic Yacht, Nordic (Yatzy), Popular (Bonus)).
// No DOM, no timers, no Math.random.
import {
  RULESETS, RULESET_IDS, PAR, categoryList, emptyCard, openCategories, jokerActive, potential, totals, cardFull,
} from '../blocks/category-sheet.js';

export const meta = {
  id: 'yacht',
  name: 'Yacht',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 10,
  tier: 'A',
  soloBest: 'high', // solo personal best is the highest score
  soloKey: (o) => o.ruleset,
  soloValue: (res) => res.soloScore,
  soloTitle: (v) => `Score ${v}`,
  soloLabel: (v) => `${v}`,
  soloHide: [],
  houseRules: [
    {
      key: 'ruleset',
      label: 'Rule set',
      options: RULESET_IDS.map((id) => ({ value: id, label: RULESETS[id].label })),
      default: 'popular',
      hint: () => RULESET_IDS.map((id) => {
        const s = RULESETS[id];
        return `${s.label}: ${s.rounds} rounds, ${s.upperBonus ? `${s.upperBonus}-point upper bonus` : 'no bonus'}${s.extra ? ', 100-point bonus for extra five of a kinds' : ''}`;
      }).join(' · '),
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

const ALL = [0, 1, 2, 3, 4];

// Options are never mutated, so clones may share them. Manual clone keeps bot simulations fast.
const cloneState = (s) => ({
  ...s,
  seats: s.seats.map((x) => ({ ...x, card: { ...x.card }, last: x.last ? { ...x.last } : null })),
  turn: { ...s.turn, dice: s.turn.dice.slice() },
  winners: s.winners.slice(),
});

const freshTurn = () => ({ phase: 'start', dice: [null, null, null, null, null], rollsLeft: 3 });

export function setup(options) {
  const opts = { ...defaultOptions(), ...options };
  if (!RULESETS[opts.ruleset]) throw new Error('Unknown rule set');
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({
    name: s.name, isBot: !!s.isBot, preset: s.preset || null, card: emptyCard(opts.ruleset), extra: 0, total: 0, turns: 0, last: null,
  }));
  return {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats, current: 0, turn: freshTurn(), over: false, winners: [],
  };
}

export const observe = (state) => state; // no hidden information

export function legalActions(state, seat) {
  if (state.over || seat !== state.current) return [];
  const t = state.turn;
  if (t.phase === 'start') return [{ type: 'ROLL', ids: ALL.slice() }];
  const acts = [];
  if (t.rollsLeft > 0) {
    for (let mask = 1; mask < 32; mask++) acts.push({ type: 'ROLL', ids: ALL.filter((i) => mask & (1 << i)) });
  }
  openCategories(state.options.ruleset, state.seats[seat].card).forEach((category) => acts.push({ type: 'SCORE', category }));
  return acts;
}

export const isOver = (state) => state.over;

export function result(state) {
  const standings = state.seats
    .map((s, i) => ({ seat: i, name: s.name, total: s.total, turns: s.turns }))
    .sort((a, b) => b.total - a.total);
  return {
    winner: state.winners.length === 1 ? state.winners[0] : null,
    winners: state.winners.slice(),
    standings,
    soloScore: state.seats.length === 1 ? state.seats[0].total : null,
  };
}

function endTurn(s, events) {
  const seat = s.seats[s.current];
  seat.turns += 1;
  events.push({ type: 'TURN_ENDED', seat: s.current });
  const rounds = RULESETS[s.options.ruleset].rounds;
  if (s.seats.every((x) => x.turns >= rounds)) {
    const best = Math.max(...s.seats.map((x) => x.total));
    s.winners = s.seats.map((x, i) => (x.total === best ? i : -1)).filter((i) => i >= 0);
    s.over = true;
    events.push({ type: 'GAME_OVER', winners: s.winners.slice() });
    return;
  }
  s.current = (s.current + 1) % s.seats.length;
  s.turn = freshTurn();
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

export function apply(state, action, rng) {
  const s = cloneState(state);
  const events = [];
  if (s.over) throw new Error('Game is over');
  const seat = s.seats[s.current];
  const t = s.turn;
  const setId = s.options.ruleset;

  if (action.type === 'ROLL') {
    const ids = action.ids;
    if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length || ids.some((i) => !Number.isInteger(i) || i < 0 || i > 4)) throw new Error('Bad dice selection');
    if (t.phase === 'start') { if (ids.length !== 5) throw new Error('First roll rolls all five dice'); }
    else if (t.rollsLeft <= 0) throw new Error('No rolls left');
    ids.forEach((i) => { t.dice[i] = rng.die(6); });
    t.rollsLeft -= 1;
    t.phase = 'choose';
    events.push({ type: 'ROLLED', seat: s.current, ids: ids.slice(), dice: ids.map((i) => t.dice[i]), rollsLeft: t.rollsLeft });
  } else if (action.type === 'SCORE') {
    if (t.phase !== 'choose') throw new Error('Roll first');
    const key = action.category;
    if (!categoryList(setId).some((c) => c.key === key) || seat.card[key] !== null) throw new Error('Category not available');
    const joker = jokerActive(setId, t.dice, seat.card);
    const points = potential(setId, key, t.dice, seat.card);
    const bonus = joker ? 100 : 0;
    seat.card[key] = points;
    seat.extra += bonus;
    seat.last = { cat: key, points, bonus };
    seat.total = totals(setId, seat.card, seat.extra).total;
    events.push({ type: 'SCORED', seat: s.current, category: key, points, bonus, joker, total: seat.total });
    endTurn(s, events);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot hooks (used by src/ai/brain.js) ----
// Many plans (about 40) need many simulations each to be ranked reliably: with too few, picking the best-looking
// plan mostly picks noise. Noise is kept small (a fraction of a point) so the bot stays strong; presets differ in
// simulations and in how much they favor continuing to roll.
export const botHints = { riskScale: 1, noiseScale: 0.15, simsPerPlan: (presetSims) => presetSims };

// A plan that ends in SCORE has no randomness: one sample is enough.
export const isDeterministic = (plan) => plan[plan.length - 1].type === 'SCORE';

// Value of a finished simulated turn: points (plus any bonus) minus what the box is typically worth.
export function turnValue(state, seat) {
  const l = state.seats[seat].last;
  return l ? l.points + l.bonus - PAR[state.options.ruleset][l.cat] : -999;
}

export function candidatePlans(obs, seat) {
  const t = obs.turn;
  if (t.phase === 'start') return [[{ type: 'ROLL', ids: ALL.slice() }]];
  const plans = openCategories(obs.options.ruleset, obs.seats[seat].card).map((category) => [{ type: 'SCORE', category }]);
  if (t.rollsLeft > 0) {
    const seen = new Set();
    for (let mask = 1; mask < 32; mask++) {
      const ids = ALL.filter((i) => mask & (1 << i));
      const held = ALL.filter((i) => !ids.includes(i)).map((i) => t.dice[i]).sort().join('');
      if (seen.has(held)) continue;
      seen.add(held);
      plans.push([{ type: 'ROLL', ids }]);
    }
  }
  return plans;
}

function bestCategory(s, seat) {
  const setId = s.options.ruleset;
  const card = s.seats[seat].card;
  let best = null;
  let bestVal = -Infinity;
  for (const key of openCategories(setId, card)) {
    const v = potential(setId, key, s.turn.dice, card) - PAR[setId][key];
    if (v > bestVal) { bestVal = v; best = key; }
  }
  return best;
}

// Continuation policy: keep the most frequent face (ties: higher), re-roll the rest, then score the best-value box.
export function rollout(state, seat, rng, turnsAtStart) {
  let s = state;
  for (let step = 0; step < 6; step++) {
    if (s.over || s.current !== seat || s.seats[seat].turns > turnsAtStart) return s;
    if (s.turn.phase === 'start') { s = apply(s, { type: 'ROLL', ids: ALL.slice() }, rng).state; continue; }
    if (s.turn.rollsLeft > 0) {
      const c = [0, 0, 0, 0, 0, 0, 0];
      s.turn.dice.forEach((v) => c[v]++);
      let face = 1;
      for (let f = 2; f <= 6; f++) if (c[f] >= c[face]) face = f;
      const ids = ALL.filter((i) => s.turn.dice[i] !== face);
      if (ids.length) { s = apply(s, { type: 'ROLL', ids }, rng).state; continue; }
    }
    s = apply(s, { type: 'SCORE', category: bestCategory(s, seat) }, rng).state;
  }
  return s;
}
