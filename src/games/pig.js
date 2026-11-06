// Pig: pure rules module. No DOM, no timers, no Math.random.
import { createPool, rollPool, values } from '../blocks/dice-pool.js';
import { createPushLoop } from '../blocks/push-loop.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export const meta = {
  id: 'pig',
  name: 'Pig',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 5,
  tier: 'A',
  houseRules: [
    { key: 'target', label: 'Target score', options: [{ value: 50, label: '50' }, { value: 100, label: '100' }, { value: 150, label: '150' }], default: 100 },
    { key: 'dice', label: 'Dice', options: [{ value: 1, label: 'One die' }, { value: 2, label: 'Two dice' }], default: 1 },
    { key: 'equalTurns', label: 'Equal turns', options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }], default: false },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

const loop = createPushLoop({
  rollDice(state, rng) {
    const pool = rollPool(createPool(state.options.dice, 6), rng);
    return values(pool);
  },
  resolve(dice, state) {
    if (state.options.dice === 1) {
      return dice[0] === 1 ? { bust: true } : { gain: dice[0] };
    }
    const ones = dice.filter((d) => d === 1).length;
    if (ones === 2) return { bust: true, resetTotal: true };
    if (ones === 1) return { bust: true };
    return { gain: dice[0] + dice[1] };
  },
});

export function setup(options) {
  const opts = { ...defaultOptions(), ...options };
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({
    name: s.name,
    isBot: !!s.isBot,
    preset: s.preset || null,
    total: 0,
    turns: 0,
  }));
  return {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats,
    current: 0,
    turn: loop.freshTurn(),
    contenders: seats.map((_, i) => i),
    final: null,
    winner: null,
  };
}

export function observe(state) {
  return state; // Pig has no hidden information.
}

export function legalActions(state, seat) {
  if (state.winner !== null || seat !== state.current) return [];
  const acts = [{ type: 'ROLL' }];
  if (state.turn.points > 0) acts.push({ type: 'BANK' });
  return acts;
}

export function isOver(state) {
  return state.winner !== null;
}

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
  const solo = s.seats.length === 1;

  if (banked && seat.total >= s.options.target && !s.final) {
    if (!s.options.equalTurns || solo) {
      s.winner = s.current;
      events.push({ type: 'GAME_OVER', winner: s.winner });
      return;
    }
    s.final = { turns: seat.turns };
  }

  if (s.final && s.contenders.every((i) => s.seats[i].turns >= s.final.turns)) {
    const best = Math.max(...s.contenders.map((i) => s.seats[i].total));
    const leaders = s.contenders.filter((i) => s.seats[i].total === best);
    if (leaders.length === 1) {
      s.winner = leaders[0];
      events.push({ type: 'GAME_OVER', winner: s.winner });
      return;
    }
    s.contenders = leaders;
    s.final = { turns: s.final.turns + 1 };
  }

  const n = s.seats.length;
  let next = s.current;
  for (let step = 1; step <= n; step++) {
    const cand = (s.current + step) % n;
    if (!s.contenders.includes(cand)) continue;
    if (s.final && s.seats[cand].turns >= s.final.turns) continue;
    next = cand;
    break;
  }
  s.current = next;
  s.turn = loop.freshTurn();
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.winner !== null) throw new Error('Game is over');
  if (action.type === 'ROLL') {
    const r = loop.roll(s, rng, events);
    if (r.ended) endTurn(s, events, false);
  } else if (action.type === 'BANK') {
    if (s.turn.points <= 0) throw new Error('Nothing to bank');
    loop.bank(s, events);
    endTurn(s, events, true);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}
