// Pirate Plunder: pure rules module (a tile-grabbing dice game). No DOM, no timers, no Math.random.
// Eight dice (faces 1 to 5 and a map that counts 5); keep all the dice of one new face per roll; take a tile when the total
// equals or beats a face-up tile and a map is kept, or steal an exact-match top tile. Internal names follow the shared
// vocabulary: BANKED = a tile was taken, BUSTED = failed to take one.

const clone = (v) => JSON.parse(JSON.stringify(v));

export const MAP = 6; // face 6 is the map
export const faceValue = (f) => (f === MAP ? 5 : f);
export const coinsOf = (n) => (n <= 24 ? 1 : n <= 28 ? 2 : n <= 32 ? 3 : 4);
const DICE = 8;

export const meta = {
  id: 'plunder',
  name: 'Pirate Plunder',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 15,
  tier: 'A',
  soloBest: 'high', // the most coins
  soloKey: (o) => `${o.tiles}:${o.mapNeeded}`,
  soloValue: (res) => res.soloScore,
  soloTitle: (v) => `Final haul: ${v} coins`,
  soloLabel: (v) => `${v} coins`,
  soloHide: ['steal'], // nobody to steal from
  houseRules: [
    {
      key: 'steal', label: 'Stealing', options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }], default: true,
      hint: () => 'On: a total that exactly matches another player’s top tile lets you steal it. Off: top tiles are safe.',
    },
    {
      key: 'tiles', label: 'Tiles', options: [{ value: 'standard', label: 'Standard (21-36)' }, { value: 'short', label: 'Short (21-32)' }], default: 'standard',
      hint: () => 'Standard: 16 tiles. Short: 12 tiles, a shorter game.',
    },
    {
      key: 'mapNeeded', label: 'Map to take a tile', options: [{ value: true, label: 'Required' }, { value: false, label: 'Not required' }], default: true,
      hint: () => 'Required: you must have kept at least one map to take a tile. Not required: an easier game.',
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

export const tileNumbers = (tiles) => Array.from({ length: tiles === 'short' ? 12 : 16 }, (_, i) => 21 + i);

const freshTurn = () => ({ phase: 'roll', total: 0, map: false, kept: [], rolls: 0 });
const freshDice = () => Array.from({ length: DICE }, (_, id) => ({ id, face: 0, state: 'free' }));

export function setup(options) {
  const opts = { ...defaultOptions(), ...options };
  if (!['standard', 'short'].includes(opts.tiles)) throw new Error('Unknown tile set');
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({
    name: s.name, isBot: !!s.isBot, preset: s.preset || null, turns: 0,
  }));
  const tiles = {};
  tileNumbers(opts.tiles).forEach((n) => { tiles[n] = 'mid'; });
  return {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    dice: freshDice(),
    seats,
    current: 0,
    turn: freshTurn(),
    tiles, // number -> 'mid' (face-up in the middle), 'down' (turned over) or the seat index that holds it
    stacks: seats.map(() => []), // tile numbers per seat, the last one is the top
    winner: null,
    over: false,
  };
}

export const observe = (state) => state; // no hidden information

export const stackCoins = (state, seat) => state.stacks[seat].reduce((a, n) => a + coinsOf(n), 0);

// Every tile a claim could take right now: the face-up tiles at or below the total, and (Steal On) another player's top
// tile whose number is exactly the total. Each: { tile, from } with from 'mid' or the seat index.
export function claimOptions(state) {
  const t = state.turn;
  if (state.options.mapNeeded && !t.map) return [];
  const out = [];
  Object.keys(state.tiles).map(Number).sort((a, b) => a - b).forEach((n) => {
    if (state.tiles[n] === 'mid' && n <= t.total) out.push({ tile: n, from: 'mid' });
  });
  if (state.options.steal) {
    state.stacks.forEach((st, i) => {
      if (i !== state.current && st.length && st[st.length - 1] === t.total) out.push({ tile: t.total, from: i });
    });
  }
  return out;
}

const freeDice = (s) => s.dice.filter((d) => d.state === 'free');

export function legalActions(state, seat) {
  if (state.over || seat !== state.current) return [];
  const t = state.turn;
  if (t.phase === 'roll') return [{ type: 'ROLL' }];
  if (t.phase === 'pick') {
    const faces = [...new Set(freeDice(state).map((d) => d.face))].filter((f) => !t.kept.includes(f)).sort((a, b) => a - b);
    return faces.map((f) => ({ type: 'SET_ASIDE', ids: freeDice(state).filter((d) => d.face === f).map((d) => d.id) }));
  }
  const acts = [];
  if (freeDice(state).length) acts.push({ type: 'ROLL' });
  claimOptions(state).forEach((o) => acts.push({ type: 'CLAIM', tile: o.tile }));
  return acts;
}

export const isOver = (state) => state.over;

export function result(state) {
  const standings = state.seats
    .map((s, i) => ({ seat: i, name: s.name, total: stackCoins(state, i), turns: s.turns, top: Math.max(0, ...state.stacks[i]) }))
    .sort((a, b) => b.total - a.total || b.top - a.top);
  return { winner: state.winner, standings, soloScore: state.seats.length === 1 ? stackCoins(state, 0) : null };
}

function endTurn(s, events) {
  s.seats[s.current].turns += 1;
  events.push({ type: 'TURN_ENDED', seat: s.current });
  s.dice = freshDice();
  s.turn = freshTurn();
  if (!Object.values(s.tiles).includes('mid')) {
    // the middle is empty: most coins wins, a tie goes to the highest tile
    const best = result(s).standings[0];
    s.winner = best.seat;
    s.over = true;
    events.push({ type: 'GAME_OVER', winner: s.winner });
    return;
  }
  s.current = (s.current + 1) % s.seats.length;
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

// Failing to take a tile: the highest face-up tile is turned over, then your top tile goes back to the middle.
function bust(s, events, reason) {
  const mid = Object.keys(s.tiles).map(Number).filter((n) => s.tiles[n] === 'mid');
  const turned = mid.length ? Math.max(...mid) : null;
  if (turned !== null) s.tiles[turned] = 'down';
  const st = s.stacks[s.current];
  const returned = st.length ? st.pop() : null;
  if (returned !== null) s.tiles[returned] = 'mid';
  events.push({ type: 'BUSTED', seat: s.current, reason, turned, returned });
  endTurn(s, events);
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.over) throw new Error('Game is over');
  const t = s.turn;
  if (action.type === 'ROLL') {
    if (t.phase === 'pick') throw new Error('Set a face aside first');
    const free = freeDice(s);
    if (!free.length) throw new Error('No dice left to roll');
    free.forEach((d) => { d.face = rng.die(6); });
    t.rolls += 1;
    events.push({ type: 'ROLLED', seat: s.current, dice: free.map((d) => ({ id: d.id, face: d.face })) });
    if (free.every((d) => t.kept.includes(d.face))) bust(s, events, 'no new face');
    else t.phase = 'pick';
  } else if (action.type === 'SET_ASIDE') {
    if (t.phase !== 'pick') throw new Error('Roll first');
    const ids = (action.ids || []).slice().sort((a, b) => a - b);
    const face = ids.length ? s.dice[ids[0]].face : 0;
    const all = freeDice(s).filter((d) => d.face === face).map((d) => d.id);
    if (!ids.length || JSON.stringify(ids) !== JSON.stringify(all) || t.kept.includes(face)) throw new Error('Not a legal set to keep');
    ids.forEach((id) => { s.dice[id].state = 'kept'; });
    t.kept.push(face);
    t.total += faceValue(face) * ids.length;
    if (face === MAP) t.map = true;
    events.push({ type: 'SET_ASIDE', seat: s.current, face, ids, total: t.total, map: t.map });
    t.phase = 'decide';
    if (!freeDice(s).length && !claimOptions(s).length) bust(s, events, 'no tile');
  } else if (action.type === 'CLAIM') {
    if (t.phase !== 'decide') throw new Error('Keep a face first');
    const opt = claimOptions(s).find((o) => o.tile === action.tile);
    if (!opt) throw new Error('That tile cannot be taken');
    if (opt.from !== 'mid') s.stacks[opt.from].pop();
    s.stacks[s.current].push(opt.tile);
    s.tiles[opt.tile] = s.current;
    events.push({ type: 'BANKED', seat: s.current, tile: opt.tile, from: opt.from, amount: coinsOf(opt.tile), total: stackCoins(s, s.current) });
    endTurn(s, events);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot hooks (used by src/ai/brain.js) ----
export const botHints = { riskScale: 0.3, noiseScale: 0.1, simsPerPlan: (presetSims) => Math.max(40, Math.floor(presetSims / 8)) };

// The tiles worth planning a claim for: the highest face-up one, the highest in each lower coin group, and any steal.
function claimPicks(next) {
  const opts = claimOptions(next);
  const picks = [];
  const seen = new Set();
  opts.filter((o) => o.from === 'mid').reverse().forEach((o) => {
    const c = coinsOf(o.tile);
    if (!seen.has(c)) { seen.add(c); picks.push(o); }
  });
  opts.filter((o) => o.from !== 'mid').forEach((o) => picks.push(o));
  return picks;
}

export function candidatePlans(obs, seat) {
  const t = obs.turn;
  if (obs.over || obs.current !== seat) return [];
  if (t.phase === 'roll') return [[{ type: 'ROLL' }]];
  const plans = [];
  if (t.phase === 'decide') {
    if (freeDice(obs).length) plans.push([{ type: 'ROLL' }]);
    claimPicks(obs).forEach((o) => plans.push([{ type: 'CLAIM', tile: o.tile }]));
    return plans;
  }
  legalActions(obs, seat).forEach((a) => {
    const next = apply(obs, a, null).state; // keeping dice uses no randomness
    if (next.over || next.current !== seat || next.turn.phase !== 'decide') { plans.push([a]); return; } // a forced bust
    if (freeDice(next).length) plans.push([a, { type: 'ROLL' }]);
    claimPicks(next).forEach((o) => plans.push([a, { type: 'CLAIM', tile: o.tile }]));
  });
  return plans.length ? plans : legalActions(obs, seat).map((a) => [a]);
}

export const isDeterministic = (plan) => plan[plan.length - 1].type === 'CLAIM';

// The seat's coins, minus half the others' average (stealing and denying matter as well).
export function turnValue(state, seat) {
  const mine = stackCoins(state, seat);
  const others = state.seats.map((_, i) => i).filter((i) => i !== seat);
  if (!others.length) return mine;
  return mine - 0.5 * (others.reduce((a, i) => a + stackCoins(state, i), 0) / others.length);
}

// Continue the simulated turn with a simple policy: keep the map first, then the face that adds the most; take the
// highest tile as soon as it is worth 2 coins or more (or a steal), or when only a few dice are left.
export function rollout(state, seat, rng, turnsAtStart) {
  let s = state;
  for (let step = 0; step < 40; step++) {
    if (s.over || s.current !== seat || s.seats[seat].turns > turnsAtStart) return s;
    const t = s.turn;
    if (t.phase === 'roll') { s = apply(s, { type: 'ROLL' }, rng).state; continue; }
    if (t.phase === 'pick') {
      const acts = legalActions(s, seat);
      let best = acts[0];
      let bestScore = -1;
      acts.forEach((a) => {
        const face = s.dice[a.ids[0]].face;
        const sc = (face === MAP && !t.map ? 100 : 0) + faceValue(face) * a.ids.length;
        if (sc > bestScore) { best = a; bestScore = sc; }
      });
      s = apply(s, best, rng).state;
      continue;
    }
    const picks = claimPicks(s);
    const top = picks.length ? picks.reduce((a, o) => (coinsOf(o.tile) > coinsOf(a.tile) || o.from !== 'mid' ? o : a)) : null;
    if (top && (coinsOf(top.tile) >= 2 || top.from !== 'mid' || freeDice(s).length <= 2)) s = apply(s, { type: 'CLAIM', tile: top.tile }, rng).state;
    else if (freeDice(s).length) s = apply(s, { type: 'ROLL' }, rng).state;
    else return s;
  }
  return s;
}
