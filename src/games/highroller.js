// High Roller: pure rules module. No DOM, no timers, no Math.random.
// Six casinos numbered 1 to 6, each with banknotes on it (topped up to at least $50,000 every round). Everybody has 8 dice. On your turn you roll
// ALL the dice you have left, choose ONE number and put every die showing it on that casino. When all the dice are placed the casinos pay out:
// players with the same number of dice at a casino cancel each other out, then the most dice takes the best note, the next the next, and so on.
// Notes nobody wins go under the pile. After the last round the most money wins. Neutral (white) dice are an optional extra player.
// Internal names follow the shared vocabulary where it fits: TURN_STARTED, TURN_ENDED, GAME_OVER.
import { createRng } from '../core/rng.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export const NOTE_COUNTS = [[10000, 6], [20000, 8], [30000, 8], [40000, 6], [50000, 6], [60000, 5], [70000, 5], [80000, 5], [90000, 5]]; // 54 notes
export const TARGET = 50000; // every casino is topped up to at least this
export const CASINOS = 6;
export const DICE = 8;

export const meta = {
  id: 'highroller',
  name: 'High Roller',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 15,
  tier: 'A',
  soloBest: 'high', // the most money
  soloKey: (o) => `${o.rounds}`,
  soloHide: ['neutral'], // in Solo the white dice are always the opponent
  soloValue: (res) => res.soloScore,
  soloTitle: (v) => `Final money: $${(v || 0).toLocaleString('en-US')}`, // the shell builds these even when it is not a Solo game (v is null then)
  soloLabel: (v) => `$${(v || 0).toLocaleString('en-US')}`,
  houseRules: [
    {
      key: 'neutral', label: 'Neutral dice',
      options: [{ value: 'auto', label: 'Auto' }, { value: 'off', label: 'Off' }, { value: 'on', label: 'On' }], default: 'auto',
      hint: () => 'White dice that count as one more, imaginary player: they are rolled and placed together with your own dice, and any money they win goes back under the pile. Auto: on with 2 players, off with 3 or 4.',
    },
    {
      key: 'rounds', label: 'Rounds',
      options: [{ value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }], default: 4,
      hint: () => 'The player with the most money after the last round wins.',
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

// How many neutral dice each player gets, and how many are left over (a 3-player game: the two spare ones are rolled at the start of a round and placed by themselves).
export function neutralPlan(rule, n) {
  const on = n === 1 || rule === 'on' || (rule === 'auto' && n === 2);
  if (!on) return { per: 0, spare: 0 };
  return { per: n === 1 ? 8 : n === 2 ? 4 : 2, spare: n === 3 ? 2 : 0 };
}

export function setup(options, rng) {
  const opts = { ...defaultOptions(), ...options };
  if (opts.neutral === false) opts.neutral = defaultOptions().neutral; // Solo hides this rule (the shell passes false)
  if (!['auto', 'off', 'on'].includes(opts.neutral)) throw new Error('Unknown neutral dice rule');
  if (![3, 4, 5].includes(opts.rounds)) throw new Error('Unknown number of rounds');
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((x) => ({ name: x.name, isBot: !!x.isBot, preset: x.preset || null, turns: 0, own: 0, neutral: 0, money: 0, notes: [] }));
  const n = seats.length;
  if (n < 1 || n > 4) throw new Error('High Roller is for one to four players');
  const pile = [];
  NOTE_COUNTS.forEach(([v, c]) => { for (let k = 0; k < c; k++) pile.push(v); });
  for (let i = pile.length - 1; i > 0; i--) { const j = rng.die(i + 1) - 1; [pile[i], pile[j]] = [pile[j], pile[i]]; } // a fair shuffle by the rng
  const start = n === 1 ? 0 : rng.die(n) - 1;
  const s = {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats,
    n,
    round: 1,
    rounds: opts.rounds,
    start,
    current: start,
    casinos: [],
    pile,
    spare: [], // the leftover neutral dice of this round (3 players), already placed
    phase: 'roll', // roll, place
    rolled: null, // { own: [..], neutral: [..] } while a player is choosing
    over: false,
    winner: null,
    winners: [],
  };
  dealRound(s, rng);
  return s;
}

// A new round: the casinos get their notes (from the top of the pile) up to at least $50,000, everybody gets their dice back.
function dealRound(s, rng) {
  const n = s.n;
  const plan = neutralPlan(s.options.neutral, n);
  s.casinos = Array.from({ length: CASINOS }, () => {
    const notes = [];
    let sum = 0;
    while (sum < TARGET && s.pile.length) { const v = s.pile.shift(); notes.push(v); sum += v; }
    notes.sort((a, b) => b - a);
    return { notes, dice: Array(n + 1).fill(0) }; // dice: one count per player, the last one is the neutral "player"
  });
  s.seats.forEach((x) => { x.own = DICE; x.neutral = plan.per; });
  s.spare = [];
  for (let k = 0; k < plan.spare; k++) { const v = rng.die(6); s.spare.push(v); s.casinos[v - 1].dice[n] += 1; }
  s.current = s.start;
  s.phase = 'roll';
  s.rolled = null;
}

const hasDice = (s, i) => s.seats[i].own + s.seats[i].neutral > 0;
function nextWithDice(s, from) {
  for (let k = 1; k <= s.n; k++) { const i = (from + k) % s.n; if (hasDice(s, i)) return i; }
  return -1;
}

export function legalActions(state, seat) {
  if (state.over || seat !== state.current) return [];
  if (state.phase === 'roll') return hasDice(state, seat) ? [{ type: 'ROLL' }] : [];
  const faces = new Set(state.rolled.own.concat(state.rolled.neutral));
  return [1, 2, 3, 4, 5, 6].filter((f) => faces.has(f)).map((face) => ({ type: 'PLACE', face }));
}

export const isOver = (state) => state.over;

export function observe(state) { return clone(state); } // everything that was paid out was public, so nothing is hidden from a bot

export function result(state) {
  const order = state.seats.map((_, i) => i).sort((a, b) => (state.seats[b].money - state.seats[a].money) || (state.seats[b].notes.length - state.seats[a].notes.length) || (a - b));
  const standings = order.map((i) => ({ seat: i, name: state.seats[i].name, total: state.seats[i].money, turns: state.seats[i].turns, notes: state.seats[i].notes.length }));
  return { winner: state.winner, winners: state.winners, standings, soloScore: state.n === 1 ? state.seats[0].money : null };
}

// Who wins at one casino. counts: dice per participant (the last participant is the neutral one). Returns who is cancelled, the awards (best note first)
// and the notes nobody wins.
export function payCasino(counts, notes) {
  const entries = counts.map((c, who) => ({ who, c })).filter((e) => e.c > 0);
  const same = {};
  entries.forEach((e) => { (same[e.c] = same[e.c] || []).push(e); });
  const cancelled = [];
  const live = [];
  entries.forEach((e) => { if (same[e.c].length > 1) cancelled.push(e.who); else live.push(e); });
  live.sort((a, b) => b.c - a.c);
  const sorted = notes.slice().sort((a, b) => b - a);
  const awards = live.filter((_, i) => i < sorted.length).map((e, i) => ({ who: e.who, note: sorted[i], dice: e.c }));
  return { cancelled, awards, toPile: sorted.slice(awards.length) };
}

function winnersOf(s) {
  const best = Math.max(...s.seats.map((x) => x.money));
  const top = s.seats.map((x, i) => i).filter((i) => s.seats[i].money === best);
  const most = Math.max(...top.map((i) => s.seats[i].notes.length));
  return top.filter((i) => s.seats[i].notes.length === most);
}

function payRound(s, events) {
  for (let c = 0; c < CASINOS; c++) {
    const cas = s.casinos[c];
    const r = payCasino(cas.dice, cas.notes);
    r.awards.forEach((a) => {
      if (a.who === s.n) s.pile.push(a.note); // the neutral player's money goes under the pile
      else { s.seats[a.who].money += a.note; s.seats[a.who].notes.push(a.note); }
    });
    r.toPile.forEach((v) => s.pile.push(v));
    events.push({ type: 'CASINO_PAID', casino: c, counts: cas.dice.slice(), notes: cas.notes.slice(), cancelled: r.cancelled, awards: r.awards, toPile: r.toPile });
    cas.notes = [];
    cas.dice = Array(s.n + 1).fill(0);
  }
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.over) throw new Error('Game is over');
  const seat = s.current;
  const me = s.seats[seat];
  if (action.type === 'ROLL') {
    if (s.phase !== 'roll' || !hasDice(s, seat)) throw new Error('Cannot roll now');
    const own = Array.from({ length: me.own }, () => rng.die(6));
    const neutral = Array.from({ length: me.neutral }, () => rng.die(6));
    s.rolled = { own, neutral };
    s.phase = 'place';
    events.push({ type: 'ROLLED', seat, own: own.slice(), neutral: neutral.slice() });
  } else if (action.type === 'PLACE') {
    if (s.phase !== 'place') throw new Error('Roll first');
    const face = action.face;
    const own = s.rolled.own.filter((v) => v === face).length;
    const neutral = s.rolled.neutral.filter((v) => v === face).length;
    if (!Number.isInteger(face) || own + neutral === 0) throw new Error('No dice with that number');
    const cas = s.casinos[face - 1];
    cas.dice[seat] += own;
    cas.dice[s.n] += neutral;
    me.own -= own;
    me.neutral -= neutral;
    me.turns += 1;
    s.rolled = null;
    s.phase = 'roll';
    events.push({ type: 'PLACED', seat, face, own, neutral });
    events.push({ type: 'TURN_ENDED', seat });
    const nxt = nextWithDice(s, seat);
    if (nxt >= 0) {
      s.current = nxt;
      events.push({ type: 'TURN_STARTED', seat: nxt });
    } else {
      payRound(s, events);
      events.push({ type: 'ROUND_ENDED', round: s.round });
      if (s.round >= s.rounds) {
        s.over = true;
        s.winners = winnersOf(s);
        s.winner = s.winners[0];
        events.push({ type: 'GAME_OVER', winner: s.winner, winners: s.winners.slice() });
      } else {
        s.round += 1;
        s.start = (s.start + 1) % s.n; // the start card goes to the left
        dealRound(s, rng);
        events.push({ type: 'ROUND_STARTED', round: s.round, start: s.start, casinos: clone(s.casinos), spare: s.spare.slice() });
        events.push({ type: 'TURN_STARTED', seat: s.current });
      }
    }
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot ----
// The bot tries each number it could place and plays the rest of the round out many times (everybody else placing the group that looks best to them,
// with the dice rolled at random), counting the notes it would win, ties included. Presets differ in how much they like a risky payout.
const SETTINGS = {
  cautious: { sims: 40, risk: -0.35, noise: 0.5 },
  balanced: { sims: 60, risk: 0, noise: 1.0 },
  bold: { sims: 60, risk: 0.3, noise: 1.2 },
};

function rollCounts(k, rng) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < k; i++) c[rng.die(6)] += 1;
  return c;
}

// A quick policy for everybody in the simulated rest of the round: the group with the most notes to win per die already in the way.
function pickFace(sim, who, ownC, neuC) {
  let best = 0;
  let bestV = -1;
  for (let f = 1; f <= 6; f++) {
    const k = ownC[f] + neuC[f];
    if (!k) continue;
    const row = sim.counts[f - 1];
    let others = 0;
    for (let j = 0; j < row.length; j++) if (j !== who) others += row[j];
    const v = (k * sim.sums[f - 1]) / (1 + 0.8 * others);
    if (v > bestV) { bestV = v; best = f; }
  }
  return best;
}

function playOut(obs, seat, face, rng) {
  const n = obs.n;
  const sim = {
    left: obs.seats.map((x) => x.own),
    nleft: obs.seats.map((x) => x.neutral),
    counts: obs.casinos.map((c) => c.dice.slice()),
    sums: obs.casinos.map((c) => c.notes.reduce((a, b) => a + b, 0)),
  };
  const place = (who, f, own, neu) => { sim.counts[f - 1][who] += own; sim.counts[f - 1][n] += neu; sim.left[who] -= own; sim.nleft[who] -= neu; };
  const r = obs.rolled;
  place(seat, face, r.own.filter((v) => v === face).length, r.neutral.filter((v) => v === face).length);
  let cur = seat;
  for (let guard = 0; guard < 200; guard++) {
    let nxt = -1;
    for (let k = 1; k <= n; k++) { const i = (cur + k) % n; if (sim.left[i] + sim.nleft[i] > 0) { nxt = i; break; } }
    if (nxt < 0) break;
    cur = nxt;
    const ownC = rollCounts(sim.left[cur], rng);
    const neuC = rollCounts(sim.nleft[cur], rng);
    const f = pickFace(sim, cur, ownC, neuC);
    place(cur, f, ownC[f], neuC[f]);
  }
  let won = 0;
  for (let c = 0; c < CASINOS; c++) payCasino(sim.counts[c], obs.casinos[c].notes).awards.forEach((a) => { if (a.who === seat) won += a.note; });
  return won;
}

export function choose(obs, seat, presetKey, seed) {
  const cfg = SETTINGS[presetKey] || SETTINGS.balanced;
  const legal = legalActions(obs, seat);
  if (legal.length <= 1) return { actions: legal.slice(0, 1), margin: null };
  const scored = legal.map((a) => {
    const rng = createRng(seed);
    const wins = [];
    for (let i = 0; i < cfg.sims; i++) wins.push(playOut(obs, seat, a.face, rng));
    const mean = wins.reduce((x, y) => x + y, 0) / wins.length;
    const sd = Math.sqrt(wins.reduce((x, y) => x + (y - mean) ** 2, 0) / wins.length);
    const jitter = (createRng(seed + a.face).next() - 0.5) * 4000 * cfg.noise;
    return { a, value: mean + cfg.risk * sd + jitter };
  });
  scored.sort((x, y) => y.value - x.value);
  return { actions: [scored[0].a], margin: (scored[0].value - scored[1].value) / 10000 };
}
