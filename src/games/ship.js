// Ship, Captain & Crew: pure rules module for the classic bar dice game. No DOM, no timers, no Math.random.
// Five dice, up to three rolls a turn: set aside a 6 (the ship), then a 5 (the captain), then a 4 (the crew), in that order; the two
// dice left are the cargo and their total is the score. Internal names follow the shared vocabulary where it fits: TURN_STARTED, GAME_OVER.
import { createRng } from '../core/rng.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export const SLOTS = ['ship', 'captain', 'crew'];
export const SLOT_VALUE = { ship: 6, captain: 5, crew: 4 };
export const VOYAGES = 5; // a Solo game

export const meta = {
  id: 'ship',
  name: 'Ship, Captain & Crew',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 10,
  tier: 'A',
  soloBest: 'high', // the biggest total over the voyages
  soloKey: (o) => `${o.rolls}`,
  soloValue: (res) => res.soloScore,
  soloTitle: (v) => `Total cargo: ${v}`,
  soloLabel: (v) => `${v} cargo`,
  soloHide: ['target'], // points to win make no sense in Solo
  houseRules: [
    { key: 'rolls', label: 'Rolls per turn', options: [{ value: 3, label: '3' }, { value: 4, label: '4' }], default: 3 },
    { key: 'target', label: 'Points to win', options: [{ value: 3, label: '3' }, { value: 5, label: '5' }, { value: 7, label: '7' }], default: 5 },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

export function setup(options, rng) {
  const opts = { ...defaultOptions(), ...options };
  if (opts.target === false) opts.target = defaultOptions().target; // Solo hides this rule (the shell passes false)
  if (![3, 4].includes(opts.rolls)) throw new Error('Unknown number of rolls');
  if (![3, 5, 7].includes(opts.target)) throw new Error('Unknown points to win');
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({ name: s.name, isBot: !!s.isBot, preset: s.preset || null, turns: 0, wins: 0 }));
  const n = seats.length;
  const starter = n === 1 ? 0 : rng.die(n) - 1; // the first round's starting player is chosen by the rng
  const s = {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats,
    round: 1,
    starter,
    order: Array.from({ length: n }, (_, k) => (starter + k) % n), // who plays now (all of them, or the tied players)
    pos: 0,
    scores: seats.map(() => null), // this round's score per player (null: not played yet)
    voyages: 0,
    soloTotal: 0,
    current: starter,
    over: false,
    winner: null,
    winners: [],
  };
  freshTurn(s);
  return s;
}

function freshTurn(s) {
  s.turn = { phase: 'roll', rollsLeft: s.options.rolls, locked: { ship: false, captain: false, crew: false }, free: [], cargo: null };
}

export function legalActions(state, seat) {
  if (state.over || seat !== state.current) return [];
  if (state.turn.phase === 'cargo') return [{ type: 'ROLL' }, { type: 'KEEP' }];
  return [{ type: 'ROLL' }];
}

export const isOver = (state) => state.over;

export function result(state) {
  const standings = state.seats.map((x, i) => ({ seat: i, name: x.name, total: x.wins, turns: x.turns })).sort((a, b) => (b.total - a.total) || (a.seat - b.seat));
  return { winner: state.winner, winners: state.winners, standings, soloScore: state.seats.length === 1 ? state.soloTotal : null };
}

export function observe(state) { return clone(state); } // nothing is hidden

// Set aside what can be set aside, in order. Returns the slots that locked in this call.
function lockIn(t) {
  const out = [];
  const take = (slot) => { const i = t.free.indexOf(SLOT_VALUE[slot]); if (i >= 0) { t.free.splice(i, 1); t.locked[slot] = true; out.push(slot); return true; } return false; };
  if (!t.locked.ship) take('ship');
  if (t.locked.ship && !t.locked.captain) take('captain');
  if (t.locked.captain && !t.locked.crew) take('crew');
  return out;
}

function endTurn(s, score, events) {
  const seat = s.current;
  s.seats[seat].turns += 1;
  s.scores[seat] = score;
  events.push({ type: 'TURN_ENDED', seat, score });
  if (s.seats.length === 1) {
    s.voyages += 1;
    s.soloTotal += score;
    if (s.voyages >= VOYAGES) { s.over = true; s.winner = 0; s.winners = [0]; events.push({ type: 'GAME_OVER', winner: 0, winners: [0] }); return; }
    s.scores = [null];
    freshTurn(s);
    s.round += 1;
    events.push({ type: 'TURN_STARTED', seat: 0 });
    return;
  }
  s.pos += 1;
  if (s.pos < s.order.length) { s.current = s.order[s.pos]; freshTurn(s); events.push({ type: 'TURN_STARTED', seat: s.current }); return; }
  // everybody in this pass has played
  const best = Math.max(...s.order.map((i) => s.scores[i]));
  const top = s.order.filter((i) => s.scores[i] === best);
  if (top.length > 1) { // a tie for the best score: only the tied players take one more turn each
    events.push({ type: 'TIEBREAK', seats: top.slice() });
    top.forEach((i) => { s.scores[i] = null; });
    s.order = top;
    s.pos = 0;
    s.current = top[0];
    freshTurn(s);
    events.push({ type: 'TURN_STARTED', seat: s.current });
    return;
  }
  const w = top[0];
  s.seats[w].wins += 1;
  events.push({ type: 'ROUND_ENDED', scores: s.scores.slice(), winner: w });
  events.push({ type: 'ROUND_WON', seat: w });
  if (s.seats[w].wins >= s.options.target) { s.over = true; s.winner = w; s.winners = [w]; events.push({ type: 'GAME_OVER', winner: w, winners: [w] }); return; }
  // the next round: the starting player is the one to the right (counter-clockwise) of the last starter
  const n = s.seats.length;
  s.round += 1;
  s.starter = (s.starter + n - 1) % n;
  s.order = Array.from({ length: n }, (_, k) => (s.starter + k) % n);
  s.pos = 0;
  s.scores = s.seats.map(() => null);
  s.current = s.starter;
  freshTurn(s);
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.over) throw new Error('Game is over');
  const seat = s.current;
  const t = s.turn;
  if (action.type === 'ROLL') {
    const complete = SLOTS.every((k) => t.locked[k]);
    const n = complete ? 2 : 5 - SLOTS.filter((k) => t.locked[k]).length;
    const dice = Array.from({ length: n }, () => rng.die(6));
    t.rollsLeft -= 1;
    events.push({ type: 'ROLLED', seat, dice: dice.slice(), rollsLeft: t.rollsLeft, cargo: complete });
    if (complete) { // re-rolling both cargo dice: the new total stays
      t.cargo = dice;
      const total = dice[0] + dice[1];
      events.push({ type: 'ROLL_DONE', seat, locked: [] });
      events.push({ type: 'CARGO', seat, dice: dice.slice(), total });
      if (t.rollsLeft <= 0) endTurn(s, total, events); else t.phase = 'cargo';
    } else {
      t.free = dice;
      const newly = lockIn(t);
      newly.forEach((slot) => events.push({ type: 'LOCKED', seat, slot, value: SLOT_VALUE[slot] }));
      events.push({ type: 'ROLL_DONE', seat, locked: newly });
      if (SLOTS.every((k) => t.locked[k])) {
        t.cargo = t.free.slice();
        t.free = [];
        const total = t.cargo[0] + t.cargo[1];
        events.push({ type: 'CARGO', seat, dice: t.cargo.slice(), total });
        if (t.rollsLeft <= 0) endTurn(s, total, events); else t.phase = 'cargo';
      } else if (t.rollsLeft <= 0) {
        events.push({ type: 'NO_CARGO', seat });
        endTurn(s, 0, events);
      }
    }
  } else if (action.type === 'KEEP') {
    if (t.phase !== 'cargo') throw new Error('Nothing to keep yet');
    endTurn(s, t.cargo[0] + t.cargo[1], events);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot ----
// The only decision is whether to re-roll the cargo (both dice, and the new total stays).
const LINES = { cautious: 5, balanced: 6, bold: 7 };
export function choose(obs, seat, presetKey, seed) {
  const legal = legalActions(obs, seat);
  if (legal.length === 1) return { actions: [legal[0]], margin: null };
  const rng = createRng(seed);
  const total = obs.turn.cargo[0] + obs.turn.cargo[1];
  const line = LINES[presetKey] === undefined ? LINES.balanced : LINES[presetKey];
  const played = obs.order.slice(0, obs.pos).map((i) => obs.scores[i]).filter((v) => v !== null);
  const best = played.length ? Math.max(...played) : -1;
  const behind = total < best; // behind someone who has already played: any chance is worth it
  const reroll = behind || total <= line - (rng.next() < 0.1 ? 1 : 0);
  return { actions: [reroll ? { type: 'ROLL' } : { type: 'KEEP' }], margin: null };
}
