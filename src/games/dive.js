// Deep Dive: pure rules module (a shared-air treasure dive). No DOM, no timers, no Math.random.
// A line of 32 hidden-value chips runs away from the sub; divers share one tank of air. Internal names follow the shared
// vocabulary: BANKED = a diver came back and revealed chips, BUSTED = a diver lost everything.

const clone = (v) => JSON.parse(JSON.stringify(v));

export const LEVEL_BASE = { 1: 0, 2: 4, 3: 8, 4: 12 };
export const LEVEL_MEAN = { 1: 1.5, 2: 5.5, 3: 9.5, 4: 13.5 }; // what a bot (or a person) expects a chip of a level to be worth
export const pipsOf = (face) => Math.ceil(face / 2); // the dice show 1, 1, 2, 2, 3, 3
const CHIPS_PER_LEVEL = 8;

export const meta = {
  id: 'dive',
  name: 'Deep Dive',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 20,
  tier: 'B',
  soloBest: 'high', // the most points
  soloKey: (o) => `${o.dives}:${o.air}:${o.turnBack}`,
  soloValue: (res) => res.soloScore,
  soloTitle: (v) => `Final haul: ${v} points`,
  soloLabel: (v) => `${v} points`,
  houseRules: [
    { key: 'dives', label: 'Dives', options: [{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }], default: 3 },
    { key: 'air', label: 'Air in the tank', options: [{ value: 20, label: '20' }, { value: 25, label: '25' }, { value: 30, label: '30' }], default: 25 },
    {
      key: 'turnBack', label: 'Turning back', options: [{ value: 'needs', label: 'Needs treasure' }, { value: 'free', label: 'Free' }], default: 'needs',
      hint: () => 'Needs treasure: you may only turn back toward the sub while carrying treasure. Free: anyone may turn back.',
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

const freshDiver = () => ({ pos: 0, dir: 'down', turned: false, back: false, carried: [] });

export function setup(options, rng) {
  const opts = { ...defaultOptions(), ...options };
  if (![2, 3, 4].includes(opts.dives)) throw new Error('Unknown number of dives');
  if (![20, 25, 30].includes(opts.air)) throw new Error('Unknown air');
  if (!['needs', 'free'].includes(opts.turnBack)) throw new Error('Unknown turning-back rule');
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({ name: s.name, isBot: !!s.isBot, preset: s.preset || null, turns: 0 }));
  // 32 chips, 8 per level, each value of the level twice; the values are shuffled within their level
  const chips = {};
  const line = [];
  for (let level = 1; level <= 4; level++) {
    const vals = [];
    for (let v = 0; v < 4; v++) vals.push(LEVEL_BASE[level] + v, LEVEL_BASE[level] + v);
    for (let i = vals.length - 1; i > 0; i--) { const j = rng.die(i + 1) - 1; [vals[i], vals[j]] = [vals[j], vals[i]]; }
    vals.forEach((value, k) => { const id = (level - 1) * CHIPS_PER_LEVEL + k; chips[id] = { level, value }; line.push({ t: 'c', chips: [id] }); });
  }
  const s = {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    seats,
    dive: 1,
    air: opts.air,
    chips,
    line, // the slots in order from the sub: { t: 'c', chips: [ids] } (a chip or a stack) or { t: 'b' } (a blank)
    divers: seats.map(freshDiver),
    kept: seats.map(() => []), // chip ids a diver brought back (revealed)
    current: 0,
    turn: { phase: 'declare', rolled: null, roll: null },
    lastTurn: false,
    order: [], // who has come back this dive, in order
    winner: null,
    winners: [],
    over: false,
  };
  return s;
}

// No hidden information about positions or air; the chip VALUES are hidden until a diver brings them back.
export function observe(state) {
  const s = clone(state);
  const shown = new Set(s.kept.flat());
  Object.keys(s.chips).forEach((id) => { if (!shown.has(Number(id))) s.chips[id].value = null; });
  return s;
}

const chipValue = (s, id) => (s.chips[id].value === null ? LEVEL_MEAN[s.chips[id].level] : s.chips[id].value);
export const points = (s, seat) => s.kept[seat].reduce((a, id) => a + chipValue(s, id), 0);
export const unitValue = (s, unit) => unit.reduce((a, id) => a + chipValue(s, id), 0);
export const occupied = (s, pos, except) => pos > 0 && s.divers.some((d, i) => i !== except && !d.back && d.pos === pos);

// A diver that cannot swim any deeper (no free chip beyond it).
export function stuckDown(s, seat) {
  const d = s.divers[seat];
  for (let q = d.pos + 1; q <= s.line.length; q++) if (!occupied(s, q, seat)) return false;
  return true;
}

// Turning back: once per dive; with the default rule only while carrying treasure, or when stuck at the deepest chip (so the dive
// can never reach a dead end where nobody can move and the air never drops).
export function canTurnBack(s, seat) {
  const d = s.divers[seat];
  if (d.back || d.turned || d.dir !== 'down') return false;
  return s.options.turnBack === 'free' || d.carried.length > 0 || stuckDown(s, seat);
}

export function legalActions(state, seat) {
  if (state.over || seat !== state.current) return [];
  const t = state.turn;
  const d = state.divers[seat];
  if (t.phase === 'declare') {
    const acts = [{ type: 'ROLL' }];
    if (canTurnBack(state, seat)) acts.unshift({ type: 'TURN_BACK' });
    return acts;
  }
  const acts = [];
  const slot = d.pos >= 1 ? state.line[d.pos - 1] : null;
  if (slot && slot.t === 'c') acts.push({ type: 'PICK_UP' });
  if (slot && slot.t === 'b') d.carried.forEach((u) => acts.push({ type: 'DROP', ids: [u[0]] }));
  acts.push({ type: 'PASS' });
  return acts;
}

export const isOver = (state) => state.over;

function tieKey(s, seat) {
  const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
  s.kept[seat].forEach((id) => { c[s.chips[id].level] += 1; });
  return [points(s, seat), c[4], c[3], c[2], c[1]];
}
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

export function result(state) {
  const keys = state.seats.map((_, i) => tieKey(state, i));
  const standings = state.seats.map((s, i) => ({ seat: i, name: s.name, total: keys[i][0], turns: s.turns })).sort((a, b) => cmp(keys[b.seat], keys[a.seat]));
  return { winner: state.winner, winners: state.winners, standings, soloScore: state.seats.length === 1 ? points(state, 0) : null };
}

// ---- turn flow ----
function beginTurn(s, events) {
  const seat = s.current;
  const used = s.divers[seat].carried.length;
  s.air -= used;
  s.turn = { phase: 'declare', rolled: null, roll: null };
  events.push({ type: 'TURN_STARTED', seat });
  events.push({ type: 'BREATHED', seat, used, air: s.air });
  if (s.air <= 0) s.lastTurn = true;
}

function nextSeat(s) {
  const n = s.seats.length;
  for (let step = 1; step <= n; step++) {
    const c = (s.current + step) % n;
    if (!s.divers[c].back) return c;
  }
  return -1;
}

function endDive(s, events) {
  // divers who are back reveal and keep their chips
  s.seats.forEach((_, i) => {
    const d = s.divers[i];
    if (!d.back || !d.carried.length) return;
    const ids = d.carried.flat();
    s.kept[i].push(...ids);
    events.push({ type: 'BANKED', seat: i, amount: ids.reduce((a, id) => a + chipValue(s, id), 0), count: ids.length, total: points(s, i), chips: ids.map((id) => ({ id, level: s.chips[id].level, value: chipValue(s, id) })) });
    d.carried = [];
  });
  // the others drop everything, closest to the sub first; the chips are stacked at the end of the line, 3 to a stack
  const lost = s.seats.map((_, i) => i).filter((i) => !s.divers[i].back).sort((a, b) => s.divers[a].pos - s.divers[b].pos || a - b);
  const pile = [];
  lost.forEach((i) => {
    const ids = s.divers[i].carried.flat();
    if (ids.length) events.push({ type: 'BUSTED', seat: i, count: ids.length });
    pile.push(...ids);
    s.divers[i].carried = [];
  });
  s.line = s.line.filter((sl) => sl.t === 'c'); // blank chips go, the line closes up
  const stacks = [];
  for (let k = 0; k < pile.length; k += 3) { const sl = { t: 'c', chips: pile.slice(k, k + 3) }; s.line.push(sl); stacks.push(sl.chips.slice()); }
  if (stacks.length) events.push({ type: 'STACKED', stacks });
  // the order divers returned to the sub: the ones who came back, then the others from the closest; the last goes first next dive
  const order = s.order.slice();
  lost.forEach((i) => order.push(i));
  events.push({ type: 'DIVE_ENDED', dive: s.dive, line: s.line.map((sl) => ({ t: 'c', chips: sl.chips.slice() })) });
  if (s.dive >= s.options.dives) {
    const keys = s.seats.map((_, i) => tieKey(s, i));
    let best = keys[0];
    keys.forEach((k) => { if (cmp(k, best) > 0) best = k; });
    s.winners = keys.map((k, i) => (cmp(k, best) === 0 ? i : -1)).filter((i) => i >= 0);
    s.winner = s.winners[0];
    s.over = true;
    events.push({ type: 'GAME_OVER', winner: s.winner, winners: s.winners.slice() });
    return;
  }
  s.dive += 1;
  s.air = s.options.air;
  s.lastTurn = false;
  s.divers = s.seats.map(freshDiver);
  s.order = [];
  s.current = order[order.length - 1];
  events.push({ type: 'DIVE_STARTED', dive: s.dive, air: s.air, first: s.current });
  beginTurn(s, events);
}

function endTurn(s, events) {
  s.seats[s.current].turns += 1;
  events.push({ type: 'TURN_ENDED', seat: s.current });
  const allBack = s.divers.every((d) => d.back);
  if (s.lastTurn || allBack) { endDive(s, events); return; }
  s.current = nextSeat(s);
  beginTurn(s, events);
}

// Move a diver `jumps` chips in the direction it faces; chips with another diver on them are jumped over without counting.
function swim(s, seat, jumps) {
  const d = s.divers[seat];
  const from = d.pos;
  const dir = d.dir === 'down' ? 1 : -1;
  const n = s.line.length;
  let q = d.pos;
  let count = 0;
  let returned = false;
  while (count < jumps) {
    q += dir;
    if (q <= 0) { returned = true; break; }
    if (q > n) {
      q = n; // past the last chip: stop on the last free chip
      while (q > d.pos && occupied(s, q, seat)) q -= 1;
      if (q <= d.pos) q = d.pos;
      break;
    }
    if (occupied(s, q, seat)) continue;
    count += 1;
  }
  if (returned) { d.pos = 0; d.back = true; s.order.push(seat); } else d.pos = q;
  return { from, to: d.pos, returned };
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.over) throw new Error('Game is over');
  const seat = s.current;
  const d = s.divers[seat];
  const t = s.turn;
  if (action.type === 'TURN_BACK') {
    if (t.phase !== 'declare' || !canTurnBack(s, seat)) throw new Error('Cannot turn back now');
    d.dir = 'up';
    d.turned = true;
    events.push({ type: 'TURNED_BACK', seat });
  } else if (action.type === 'ROLL') {
    if (t.phase !== 'declare') throw new Error('Cannot roll now');
    const dice = [rng.die(6), rng.die(6)];
    const sum = pipsOf(dice[0]) + pipsOf(dice[1]);
    const carried = d.carried.length;
    const jumps = Math.max(0, sum - carried);
    t.rolled = dice;
    t.roll = { sum, carried, jumps };
    events.push({ type: 'ROLLED', seat, dice: dice.slice() });
    const m = swim(s, seat, jumps);
    events.push({ type: 'MOVED', seat, from: m.from, to: m.to, jumps, sum, carried, returned: m.returned, dir: d.dir });
    if (m.returned) endTurn(s, events); else t.phase = 'hunt';
  } else if (action.type === 'PICK_UP') {
    if (t.phase !== 'hunt' || d.pos < 1 || s.line[d.pos - 1].t !== 'c') throw new Error('Nothing to pick up here');
    const unit = s.line[d.pos - 1].chips;
    d.carried.push(unit);
    s.line[d.pos - 1] = { t: 'b' };
    events.push({ type: 'PICKED_UP', seat, slot: d.pos, chips: unit.slice() });
    endTurn(s, events);
  } else if (action.type === 'DROP') {
    if (t.phase !== 'hunt' || d.pos < 1 || s.line[d.pos - 1].t !== 'b') throw new Error('Can only drop on an empty chip');
    const id = action.ids && action.ids[0];
    const idx = d.carried.findIndex((u) => u[0] === id);
    if (idx < 0) throw new Error('You are not carrying that');
    const unit = d.carried.splice(idx, 1)[0];
    s.line[d.pos - 1] = { t: 'c', chips: unit };
    events.push({ type: 'DROPPED_HERE', seat, slot: d.pos, chips: unit.slice() });
    endTurn(s, events);
  } else if (action.type === 'PASS') {
    if (t.phase !== 'hunt') throw new Error('Swim first');
    events.push({ type: 'PASSED', seat });
    endTurn(s, events);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot hooks (used by src/ai/brain.js) ----
export const botHints = { riskScale: 0.5, noiseScale: 0.2, simsPerPlan: (presetSims) => Math.max(40, Math.floor(presetSims / 8)) };

export function candidatePlans(obs, seat) {
  if (obs.over || obs.current !== seat) return [];
  const t = obs.turn;
  if (t.phase === 'declare') {
    const plans = [[{ type: 'ROLL' }]];
    if (canTurnBack(obs, seat)) plans.push([{ type: 'TURN_BACK' }, { type: 'ROLL' }]);
    return plans;
  }
  const plans = [];
  const seen = new Set();
  legalActions(obs, seat).forEach((a) => {
    if (a.type === 'DROP') {
      const level = obs.chips[a.ids[0]].level;
      const key = `${level}:${obs.divers[seat].carried.find((u) => u[0] === a.ids[0]).length}`;
      if (seen.has(key)) return;
      seen.add(key);
    }
    plans.push([a]);
  });
  return plans;
}

export const isDeterministic = (plan) => plan.every((a) => a.type !== 'ROLL');

// The chance a diver gets back to the sub, from how far it is, how much it carries and how much air everyone burns a round.
export function returnChance(s, seat) {
  const d = s.divers[seat];
  if (d.back) return 1;
  const carried = d.carried.length;
  const burn = Math.max(1, s.divers.reduce((a, x) => a + (x.back ? 0 : x.carried.length), 0));
  const roundsLeft = Math.max(0, s.air) / burn;
  const perTurn = Math.max(0.6, 4 - carried); // two dice of 1 to 3 average 4, minus what it carries
  const needed = d.pos / perTurn;
  return Math.min(1, Math.max(0, (roundsLeft - needed + 0.5) / 2));
}

// The points kept, plus what the diver carries times its chance of getting back, minus a share of the others' points.
export function turnValue(state, seat) {
  let mine = points(state, seat);
  const d = state.divers[seat];
  const carriedValue = d.carried.reduce((a, u) => a + unitValue(state, u), 0);
  mine += carriedValue * returnChance(state, seat) + (d.back ? 0.3 : 0);
  const others = state.seats.map((_, i) => i).filter((i) => i !== seat);
  if (!others.length) return mine;
  return mine - 0.3 * (others.reduce((a, i) => a + points(state, i), 0) / others.length);
}

// Finish the seat's turn with a simple policy: turn back once it carries about as much as the air allows, pick up when safe.
export function rollout(state, seat, rng, turnsAtStart) {
  let s = state;
  for (let step = 0; step < 6; step++) {
    if (s.over || s.current !== seat || s.seats[seat].turns > turnsAtStart) return s;
    const t = s.turn;
    if (t.phase === 'declare') {
      s = apply(s, { type: 'ROLL' }, rng).state;
      continue;
    }
    const slot = s.divers[seat].pos >= 1 ? s.line[s.divers[seat].pos - 1] : null;
    const safe = returnChance(s, seat) > 0.55;
    s = apply(s, slot && slot.t === 'c' && safe ? { type: 'PICK_UP' } : { type: 'PASS' }, rng).state;
  }
  return s;
}
