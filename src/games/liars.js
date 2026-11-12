// Liar's Dice: pure rules module. No DOM, no timers, no Math.random.
// Everyone has a cup of dice only they can see. Players bid on how many dice of a face are on the whole table (ones are wild) or
// challenge the last bid. The bid track is 30 squares round a board: Number 1, Wild 1, Number 2, Number 3, Wild 2, Number 4, ...
// and it goes round again (a second lap), so a bid is a "space" (an index in that endless order) plus, for a Number bid, a face.
// Internal names follow the shared vocabulary where it fits: TURN_STARTED / TURN_ENDED, GAME_OVER.
import { createRng } from '../core/rng.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export const MAX_NUMBER = 40; // two laps of the track
export const MAX_WILD = 20;

export const meta = {
  id: 'liars',
  name: "Liar's Dice",
  players: { min: 2, max: 4 },
  soloOK: false,
  estMinutes: 15,
  tier: 'A',
  soloBest: 'low',
  soloKey: () => 'none',
  houseRules: [
    {
      key: 'lost', label: 'Dice lost',
      options: [{ value: 'one', label: 'One die' }, { value: 'diff', label: 'The difference' }], default: 'one',
      hint: () => 'One die: the loser of a challenge loses one die. The difference: the loser loses as many dice as the bid was out by (at least one).',
    },
    {
      key: 'wild', label: 'Wild ones',
      options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }], default: true,
      hint: () => 'On: ones count as the face of any Number bid, and you can bid on Wilds. Off: ones are an ordinary face and there are no Wild bids.',
    },
    { key: 'dice', label: 'Starting dice', options: [{ value: 3, label: '3' }, { value: 5, label: '5' }], default: 5 },
    {
      key: 'duel', label: 'Final duel',
      options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }], default: true,
      hint: () => 'On: when two players are left with one die each, they bid on the total of both dice (2 to 12).',
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

// ---- the track ----
// With Wild ones: space 0 = Number 1, 1 = Wild 1, 2 = Number 2, 3 = Number 3, 4 = Wild 2, 5 = Number 4, ... (Wild n = 3n - 2).
// Without Wild ones there are no Wild spaces: space i = Number i + 1.
export function describeSpace(space, wild) {
  if (!wild) return { kind: 'N', q: space + 1 };
  const r = space % 3;
  if (r === 1) return { kind: 'W', q: (space - 1) / 3 + 1 };
  if (r === 0) return { kind: 'N', q: 2 * (space / 3) + 1 };
  return { kind: 'N', q: 2 * ((space - 2) / 3) + 2 };
}
export const spaceCount = (wild) => (wild ? 60 : MAX_NUMBER);
// The space of Number q (q >= 1) or Wild q.
export function spaceOf(kind, q, wild) {
  if (!wild) return q - 1;
  if (kind === 'W') return 3 * q - 2;
  return q % 2 === 1 ? 3 * ((q - 1) / 2) : 3 * (q / 2) - 1;
}
export const bidText = (bid, wild) => {
  if (bid.total !== undefined) return `a total of ${bid.total}`;
  const d = describeSpace(bid.space, wild);
  const w = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const n = d.q <= 10 ? w[d.q] : String(d.q);
  return d.kind === 'W' ? `${n} Wild${d.q === 1 ? '' : 's'}` : `${n} ${bid.face}${d.q === 1 ? '' : 's'}`;
};

export function setup(options, rng) {
  const opts = { ...defaultOptions(), ...options };
  if (!['one', 'diff'].includes(opts.lost)) throw new Error('Unknown dice-lost rule');
  if (![true, false].includes(opts.wild)) throw new Error('Unknown wild-ones rule');
  if (![3, 5].includes(opts.dice)) throw new Error('Unknown starting dice');
  if (![true, false].includes(opts.duel)) throw new Error('Unknown final-duel rule');
  const seats = (opts.seats || [{ name: 'You', isBot: false }, { name: 'Bot', isBot: true }]).map((s) => ({ name: s.name, isBot: !!s.isBot, preset: s.preset || null, turns: 0, dice: opts.dice }));
  if (seats.length < 2) throw new Error("Liar's Dice needs at least two players");
  const s = {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats,
    round: 0,
    hands: [],
    bid: null, // { seat, space, face, q, kind } or { seat, total } in a final duel
    duel: false,
    current: rng.die(seats.length) - 1, // the first opener is chosen by the rng
    out: [], // seats in the order they were eliminated
    over: false,
    winner: null,
    winners: [],
  };
  roll(s, rng);
  return s;
}

function alive(s) { return s.seats.map((x, i) => (x.dice > 0 ? i : -1)).filter((i) => i >= 0); }
function nextAlive(s, from) {
  for (let k = 1; k <= s.seats.length; k++) { const i = (from + k) % s.seats.length; if (s.seats[i].dice > 0) return i; }
  return from;
}

// Every player rolls their dice under the cup.
function roll(s, rng) {
  s.round += 1;
  s.hands = s.seats.map((x) => Array.from({ length: x.dice }, () => rng.die(6)));
  s.bid = null;
  const a = alive(s);
  s.duel = !!s.options.duel && a.length === 2 && a.every((i) => s.seats[i].dice === 1);
}

// Hidden information: you see your own dice only. The number of dice everybody has and the last bid are public.
export function observe(state, seat) {
  const s = clone(state);
  s.hands = s.hands.map((h, i) => (i === seat ? h : h.map(() => null)));
  return s;
}

const totalDice = (s) => s.seats.reduce((a, x) => a + x.dice, 0);

// Count the dice that match a bid.
export function countFor(s, bid) {
  const all = s.hands.flat();
  if (bid.total !== undefined) return all.reduce((a, v) => a + v, 0);
  const wild = s.options.wild;
  if (bid.kind === 'W') return all.filter((v) => v === 1).length;
  return all.filter((v) => v === bid.face || (wild && v === 1)).length;
}

export function faces(opts) { return opts.wild ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6]; }

// Is (space, face) a higher bid than the current one? A later space (any face), or the same Number space with a higher face.
export function raises(prev, space, face) {
  if (!prev) return true;
  if (space > prev.space) return true;
  return space === prev.space && prev.kind === 'N' && face > prev.face;
}

export function legalActions(state, seat) {
  if (state.over || seat !== state.current) return [];
  const acts = [];
  const prev = state.bid;
  if (state.duel) {
    const lo = prev ? prev.total + 1 : 2;
    for (let t = lo; t <= 12; t++) acts.push({ type: 'BID', total: t });
    if (prev) acts.push({ type: 'CHALLENGE' });
    return acts;
  }
  const wild = state.options.wild;
  const n = spaceCount(wild);
  for (let sp = prev ? prev.space : 0; sp < n; sp++) {
    const d = describeSpace(sp, wild);
    if (d.kind === 'W') { if (raises(prev, sp, 1)) acts.push({ type: 'BID', space: sp, face: 1 }); continue; }
    faces(state.options).forEach((f) => { if (raises(prev, sp, f)) acts.push({ type: 'BID', space: sp, face: f }); });
  }
  if (prev) acts.push({ type: 'CHALLENGE' });
  return acts;
}

export const isOver = (state) => state.over;

export function result(state) {
  const order = [state.winner].concat(state.out.slice().reverse());
  const rank = (i) => order.indexOf(i);
  const standings = state.seats
    .map((x, i) => ({ seat: i, name: x.name, total: x.dice, turns: x.turns }))
    .sort((a, b) => rank(a.seat) - rank(b.seat));
  return { winner: state.winner, winners: state.winners, standings, soloScore: null };
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.over) throw new Error('Game is over');
  const seat = s.current;
  if (action.type === 'BID') {
    let bid;
    if (s.duel) {
      if (!Number.isInteger(action.total) || action.total < 2 || action.total > 12 || (s.bid && action.total <= s.bid.total)) throw new Error('Not a higher total');
      bid = { seat, total: action.total };
    } else {
      const d = describeSpace(action.space, s.options.wild);
      if (!Number.isInteger(action.space) || action.space < 0 || action.space >= spaceCount(s.options.wild)) throw new Error('Not on the track');
      if (d.kind === 'W' ? action.face !== 1 : !faces(s.options).includes(action.face)) throw new Error('Not a face for this bid');
      if (!raises(s.bid, action.space, action.face)) throw new Error('Not a higher bid');
      bid = { seat, space: action.space, face: action.face, q: d.q, kind: d.kind };
    }
    s.bid = bid;
    s.seats[seat].turns += 1;
    events.push({ type: 'BID', seat, bid: clone(bid) });
    events.push({ type: 'TURN_ENDED', seat });
    s.current = nextAlive(s, seat);
    events.push({ type: 'TURN_STARTED', seat: s.current });
  } else if (action.type === 'CHALLENGE') {
    if (!s.bid) throw new Error('Nothing to challenge');
    const bid = s.bid;
    const bidder = bid.seat;
    const actual = countFor(s, bid);
    const need = bid.total !== undefined ? bid.total : bid.q;
    const bidderRight = actual >= need; // an exact count is the bidder being right: only the challenger loses
    const loser = bidderRight ? seat : bidder;
    let lost = 1;
    if (s.options.lost === 'diff' && !s.duel) lost = bidderRight ? Math.max(1, actual - need) : need - actual;
    lost = Math.min(lost, s.seats[loser].dice);
    events.push({ type: 'TURN_ENDED', seat });
    events.push({ type: 'CHALLENGED', seat, target: bidder });
    events.push({ type: 'REVEALED', seat, hands: clone(s.hands), bid: clone(bid), count: actual, valid: bidderRight, loser, winner: bidderRight ? bidder : seat, lost });
    s.seats[loser].dice -= lost;
    events.push({ type: 'DICE_LOST', seat: loser, n: lost, left: s.seats[loser].dice });
    events.push({ type: 'CHALLENGE_WON', seat: bidderRight ? bidder : seat });
    if (s.seats[loser].dice === 0) { s.out.push(loser); events.push({ type: 'ELIMINATED', seat: loser }); }
    const a = alive(s);
    if (a.length === 1) {
      s.over = true;
      s.winner = a[0];
      s.winners = [a[0]];
      events.push({ type: 'GAME_OVER', winner: a[0], winners: [a[0]] });
    } else {
      s.current = s.seats[loser].dice > 0 ? loser : nextAlive(s, loser); // the loser opens the next round
      roll(s, rng);
      events.push({ type: 'ROUND_STARTED', round: s.round, opener: s.current, duel: s.duel, hands: clone(s.hands), dice: s.seats.map((x) => x.dice) });
      events.push({ type: 'TURN_STARTED', seat: s.current });
    }
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot ----
// The bot decides by probability and a little bluffing (not by simulation), from `observe` only: its own dice, the dice counts and the last bid.
const SETTINGS = {
  cautious: { challengeBelow: 0.35, bluff: 0.05, noise: 0.6 },
  balanced: { challengeBelow: 0.25, bluff: 0.1, noise: 1.0 },
  bold: { challengeBelow: 0.15, bluff: 0.2, noise: 1.2 },
};

const binomTail = (n, p, k) => { // P(X >= k), X ~ Binomial(n, p)
  if (k <= 0) return 1;
  if (k > n) return 0;
  let c = 1;
  let sum = 0;
  const q = 1 - p;
  // P(X = i) built from i = 0
  const pmf = [];
  for (let i = 0; i <= n; i++) {
    if (i === 0) c = q ** n; else c = (c * (n - i + 1) / i) * (p / q);
    pmf.push(c);
  }
  for (let i = k; i <= n; i++) sum += pmf[i];
  return Math.min(1, Math.max(0, sum));
};

// The chance that a bid is true, from this seat's point of view. A bid by another player is a little evidence that they hold some of that face.
export function chanceTrue(obs, seat, bid) {
  const own = obs.hands[seat];
  const unknown = totalDice(obs) - own.length;
  if (bid.total !== undefined) {
    const d = own[0];
    let hit = 0;
    for (let o = 1; o <= 6; o++) if (d + o >= bid.total) hit += 1;
    return hit / 6;
  }
  const wild = obs.options.wild;
  const mine = own.filter((v) => (bid.kind === 'W' ? v === 1 : v === bid.face || (wild && v === 1))).length;
  const p = bid.kind === 'W' ? 1 / 6 : wild ? 1 / 3 : 1 / 6;
  const need = bid.q - mine;
  const base = binomTail(unknown, p, need);
  if (bid.seat === seat) return base;
  return 0.5 * base + 0.5 * binomTail(unknown, p, need - 1); // half a die of evidence
}

export function choose(obs, seat, presetKey, seed) {
  const cfg = SETTINGS[presetKey] || SETTINGS.balanced;
  const rng = createRng(seed);
  const jitter = () => (rng.next() - 0.5) * 0.1 * cfg.noise;
  const legal = legalActions(obs, seat);
  const prev = obs.bid;
  const bids = legal.filter((a) => a.type === 'BID');
  const toBid = (a) => (a.total !== undefined ? { seat, total: a.total } : { seat, space: a.space, face: a.face, ...(() => { const d = describeSpace(a.space, obs.options.wild); return { q: d.q, kind: d.kind }; })() });
  const scored = bids.map((a) => ({ a, p: chanceTrue(obs, seat, toBid(a)) }));
  if (prev) {
    const pc = chanceTrue(obs, seat, prev);
    const can = legal.some((a) => a.type === 'CHALLENGE');
    if (can && pc + jitter() < cfg.challengeBelow) return { actions: [{ type: 'CHALLENGE' }], margin: Math.abs(pc - cfg.challengeBelow) * 10 };
    // the lowest raise that is likely enough; now and then a deliberate bluff (a bigger raise that is unlikely)
    const honest = scored.filter((x) => x.p >= 0.5);
    const bluffs = scored.filter((x) => x.p >= 0.2 && x.p < 0.45);
    if (honest.length && !(bluffs.length && rng.next() < cfg.bluff)) {
      const best = honest.reduce((m, x) => (x.a.space === undefined ? (x.a.total < m.a.total ? x : m) : (x.a.space < m.a.space || (x.a.space === m.a.space && x.a.face < m.a.face) ? x : m)));
      return { actions: [best.a], margin: Math.abs(pc - cfg.challengeBelow) * 10 };
    }
    if (bluffs.length && (rng.next() < cfg.bluff || !can)) {
      const pick = bluffs[Math.min(bluffs.length - 1, Math.floor(rng.next() * Math.min(bluffs.length, 4)))];
      return { actions: [pick.a], margin: 1 };
    }
    if (can && pc < 0.6) return { actions: [{ type: 'CHALLENGE' }], margin: Math.abs(pc - 0.6) * 10 };
    if (bids.length) return { actions: [bids[0]], margin: 1 }; // the smallest legal raise
    return { actions: [{ type: 'CHALLENGE' }], margin: null };
  }
  // an opening bid: the face the bot holds most of, with a quantity it is comfortable with
  if (obs.duel) {
    const pick = scored.filter((x) => x.p >= 0.6).pop() || scored[0];
    return { actions: [pick.a], margin: null };
  }
  const comfy = scored.filter((x) => x.p >= 0.6 + jitter());
  const pick = comfy.length ? comfy[Math.min(comfy.length - 1, Math.floor(comfy.length * 0.7))] : scored[0];
  return { actions: [pick.a], margin: null };
}
