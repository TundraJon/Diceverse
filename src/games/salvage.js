// Space Salvage: pure rules module (a push-your-luck game with a bin of mixed-risk dice). No DOM, no timers, no Math.random.
// Internal names follow the shared push-your-luck code: BANK = Stow, `brainPile` = the haul (salvage dice), `shotPile` = the
// fire side, `cup` = the salvage bin, `shots` = this turn's defensive fire. Only the words on screen are space words.

const clone = (v) => JSON.parse(JSON.stringify(v));

// Face codes: S salvage, S2 double salvage, D drifting target, F defensive fire, F2 double fire, FUEL fuel cell, SHIELD shield.
// FACES[type][face number - 1]: the face number is the value the die shows (1 to 6, as on the 3D cube).
export const FACES = {
  green: ['S', 'S', 'S', 'D', 'D', 'F'],
  yellow: ['S', 'S', 'D', 'D', 'F', 'F'],
  red: ['S', 'D', 'D', 'F', 'F', 'F'],
  security: ['S2', 'S', 'D', 'D', 'F', 'F2'],
  mechanic: ['S', 'S', 'D', 'F', 'FUEL', 'SHIELD'],
  android: ['S2', 'S', 'D', 'D', 'FUEL', 'SHIELD'],
};
export const CREW_TYPES = ['security', 'mechanic', 'android'];
export const MIXES = {
  standard: { green: 6, yellow: 4, red: 3 },
  gentle: { green: 8, yellow: 4, red: 1 },
  brutal: { green: 4, yellow: 4, red: 5 },
};
const SIZE = 3; // dice rolled at a time

export const meta = {
  id: 'salvage',
  name: 'Space Salvage',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 10,
  tier: 'A',
  soloBest: 'low', // fewest turns to reach the target
  soloKey: (o) => `${o.target}:${o.fire}:${o.mix}:${o.extra}`,
  soloHide: ['equalTurns'], // house rules that make no sense in solo play
  houseRules: [
    { key: 'target', label: 'Target salvage', options: [{ value: 10, label: '10' }, { value: 13, label: '13' }, { value: 15, label: '15' }, { value: 20, label: '20' }], default: 13 },
    {
      key: 'fire', label: 'Defensive fire that ends the turn',
      options: [{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }], default: 3,
    },
    {
      key: 'equalTurns', label: 'Last round',
      options: [{ value: true, label: 'Equal turns' }, { value: false, label: 'First to target' }], default: true,
      hint: () => 'Equal turns: when someone reaches the target, everyone else gets one final turn. First to target: the first to reach it wins at once.',
    },
    {
      key: 'mix', label: 'Dice mix',
      options: [{ value: 'standard', label: 'Standard' }, { value: 'gentle', label: 'Gentle' }, { value: 'brutal', label: 'Brutal' }],
      default: 'standard',
      hint: () => 'Standard: 6 Scout Probes, 4 Freighters, 3 Warships · Gentle: 8 / 4 / 1 · Brutal: 4 / 4 / 5.',
    },
    {
      key: 'extra', label: 'Extra dice',
      options: [{ value: 'none', label: 'None' }, { value: 'crew', label: 'Crew' }], default: 'none',
      hint: () => 'Crew swaps three dice for Security, Mechanic and Android dice with double salvage, double fire, fuel cells and shields.',
    },
    {
      key: 'meter', label: 'Danger meter',
      options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }], default: false,
      hint: () => 'On: while you decide, a bar shows your exact chance of defensive fire on the next roll.',
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

// The 13 dice (types in id order), for a dice mix and the extra dice.
export function diceTypes(mix, extra) {
  const m = MIXES[mix];
  const types = [];
  Object.keys(m).forEach((c) => { for (let i = 0; i < m[c]; i++) types.push(c); });
  if (extra === 'crew') {
    const swap = (from, to) => { const i = types.indexOf(from); types[i] = to; };
    swap(types.includes('red') ? 'red' : 'yellow', 'security');
    swap('yellow', 'mechanic');
    swap('green', 'android');
  }
  return types;
}

// How many dice of each group (green, yellow, red, crew) are in a list of die ids.
export function binCounts(s, ids) {
  const c = { green: 0, yellow: 0, red: 0, crew: 0 };
  ids.forEach((id) => { c[CREW_TYPES.includes(s.dice[id].type) ? 'crew' : s.dice[id].type] += 1; });
  return c;
}

const freshTurn = () => ({ points: 0, shots: 0, rolls: 0, rolled: [], phase: 'roll', fuel: false, shield: false });

function resetDice(s) {
  s.cup = s.dice.map((_, i) => i);
  s.hand = [];
  s.brainPile = [];
  s.shotPile = [];
  s.spent = [];
}

export function setup(options) {
  const opts = { ...defaultOptions(), ...options };
  if (![10, 13, 15, 20].includes(opts.target)) throw new Error('Unknown target');
  if (![2, 3, 4].includes(opts.fire)) throw new Error('Unknown fire limit');
  if (!MIXES[opts.mix]) throw new Error('Unknown dice mix');
  if (!['none', 'crew'].includes(opts.extra)) throw new Error('Unknown extra dice');
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({
    name: s.name,
    isBot: !!s.isBot,
    preset: s.preset || null,
    total: 0,
    turns: 0,
  }));
  const s = {
    options: { ...opts, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) },
    dice: diceTypes(opts.mix, opts.extra).map((type) => ({ type })),
    seats,
    current: 0,
    turn: freshTurn(),
    contenders: seats.map((_, i) => i),
    final: null,
    winner: null,
  };
  resetDice(s);
  return s;
}

export function observe(state) {
  return state; // no hidden information: the bin's contents are public
}

export function legalActions(state, seat) {
  if (state.winner !== null || seat !== state.current) return [];
  if (state.turn.phase === 'roll') return [{ type: 'ROLL' }];
  return [{ type: 'ROLL' }, { type: 'BANK' }];
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

// What a roll of these dice does, given the turn so far. Pure: used by the real roll and by dangerChance, so both agree.
// rolled: [{ id, type, face }]. A fuel cell (this roll or earlier this turn) turns every Scout Probe drift into salvage;
// a shield (this roll or earlier) raises the fire limit by one; both are applied before the bust check.
export function evaluate(turn, fireLimit, rolled) {
  const syms = rolled.map((r) => FACES[r.type][r.face - 1]);
  const fuel = turn.fuel || syms.includes('FUEL');
  const shield = turn.shield || syms.includes('SHIELD');
  let salvage = 0;
  let fire = 0;
  const items = rolled.map((r, k) => {
    let sym = syms[k];
    let dest;
    let worth = 0;
    if (sym === 'S') { dest = 'haul'; worth = 1; }
    else if (sym === 'S2') { dest = 'haul'; worth = 2; }
    else if (sym === 'F') { dest = 'fire'; worth = 1; }
    else if (sym === 'F2') { dest = 'fire'; worth = 2; }
    else if (sym === 'D') {
      if (fuel && r.type === 'green') { dest = 'haul'; worth = 1; sym = 'S'; } else dest = 'hand';
    } else dest = 'spent';
    if (dest === 'haul') salvage += worth;
    if (dest === 'fire') fire += worth;
    return { id: r.id, type: r.type, face: r.face, sym, dest, worth };
  });
  const shots = turn.shots + fire;
  const limit = fireLimit + (shield ? 1 : 0);
  return { items, salvage, fire, fuel, shield, shots, limit, bust: shots >= limit };
}

function endTurn(s, events, banked) {
  const seat = s.seats[s.current];
  seat.turns += 1;
  events.push({ type: 'TURN_ENDED', seat: s.current });
  resetDice(s);
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
  s.turn = freshTurn();
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

// The dice that can be drawn for the next roll: the bin, plus the haul when the bin is too small.
function drawPool(s) {
  const need = SIZE - s.hand.length;
  return need > s.cup.length ? s.cup.concat(s.brainPile) : s.cup;
}

function doRoll(s, rng, events) {
  const t = s.turn;
  const seat = s.current;
  const need = SIZE - s.hand.length;
  if (need > s.cup.length && s.brainPile.length) {
    s.cup.push(...s.brainPile);
    s.brainPile = [];
    events.push({ type: 'CUP_REFILLED', seat });
  }
  const drawn = [];
  for (let k = 0; k < need && s.cup.length; k++) drawn.push(s.cup.splice(rng.die(s.cup.length) - 1, 1)[0]);
  events.push({ type: 'DRAWN', seat, ids: drawn.slice() });
  const rolled = s.hand.concat(drawn).map((id) => ({ id, type: s.dice[id].type, face: rng.die(6) }));
  s.hand = [];
  const r = evaluate(t, s.options.fire, rolled);
  t.rolls += 1;
  t.fuel = r.fuel;
  t.shield = r.shield;
  t.rolled = r.items.map(({ id, type, face, sym, dest }) => ({ id, type, face, sym, dest }));
  events.push({ type: 'ROLLED', seat, dice: t.rolled.map((d) => ({ ...d })) });
  r.items.forEach((it) => {
    if (it.dest === 'haul') s.brainPile.push(it.id);
    else if (it.dest === 'fire') s.shotPile.push(it.id);
    else if (it.dest === 'hand') s.hand.push(it.id);
    else s.spent.push(it.id);
  });
  t.points += r.salvage;
  t.shots = r.shots;
  events.push({ type: 'TALLY', seat, points: t.points, shots: t.shots, limit: r.limit, fuel: r.fuel, shield: r.shield, bin: binCounts(s, s.cup), hand: s.hand.length });
  if (r.fire > 0) events.push({ type: 'SHOT', seat, fire: r.shots, limit: r.limit });
  if (r.bust) {
    events.push({ type: 'BUSTED', seat, lost: t.points });
    t.points = 0;
    endTurn(s, events, false);
  } else {
    t.phase = 'decide';
  }
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.winner !== null) throw new Error('Game is over');
  if (action.type === 'ROLL') {
    doRoll(s, rng, events);
  } else if (action.type === 'BANK') {
    if (s.turn.phase !== 'decide') throw new Error('Roll first');
    const seat = s.seats[s.current];
    const amount = s.turn.points;
    seat.total += amount;
    events.push({ type: 'BANKED', seat: s.current, amount, total: seat.total });
    endTurn(s, events, true);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// The exact chance that defensive fire ends the turn on the next roll: every possible draw from the bin (after the
// refill if one is needed) times every combination of faces, resolved by the same `evaluate` the real roll uses.
export function dangerChance(state) {
  const s = state;
  const pool = drawPool(s);
  const need = Math.min(SIZE - s.hand.length, pool.length);
  const handDice = s.hand.map((id) => s.dice[id].type);
  const counts = new Map(); // sorted dice types -> how many draws give them
  let draws = 0;
  const pick = (from, left, types) => {
    if (left === 0) {
      const key = handDice.concat(types).sort().join(',');
      counts.set(key, (counts.get(key) || 0) + 1);
      draws += 1;
      return;
    }
    for (let i = from; i <= pool.length - left; i++) pick(i + 1, left - 1, types.concat(s.dice[pool[i]].type));
  };
  pick(0, need, []);
  let bad = 0;
  counts.forEach((n, key) => {
    const types = key.split(',');
    const k = types.length;
    let busts = 0;
    const total = 6 ** k;
    for (let c = 0; c < total; c++) {
      let x = c;
      const rolled = types.map((type) => { const face = (x % 6) + 1; x = Math.floor(x / 6); return { id: -1, type, face }; });
      if (evaluate(s.turn, s.options.fire, rolled).bust) busts += 1;
    }
    bad += n * (busts / total);
  });
  return draws ? bad / draws : 0;
}

// ---- Bot hooks (used by src/ai/brain.js) ----
// Scores here are single salvage points, so the risk shift and the noise are small (tuned against a bot that stows at 3).
export const botHints = { riskScale: 0.3, noiseScale: 0.1 };

// Never plan a stow of nothing; otherwise stow or roll again.
export function candidatePlans(obs, seat) {
  return legalActions(obs, seat)
    .filter((a) => !(a.type === 'BANK' && obs.turn.points === 0))
    .map((a) => [a]);
}

export const isDeterministic = (plan) => plan[0].type === 'BANK';

// Banked total, with a bonus for winning (and a penalty for losing) once the game is decided inside the simulation.
export const turnValue = (state, seat) => state.seats[seat].total + (state.winner === seat ? 8 : state.winner !== null ? -8 : 0);

// Stowing wins the game (first to target), or leaves the bot ahead as the last player of the final round.
export function shortcut(obs, seat) {
  if (obs.turn.phase !== 'decide' || obs.current !== seat || obs.turn.points <= 0) return null;
  const me = obs.seats[seat];
  const after = me.total + obs.turn.points;
  if (!obs.final && after >= obs.options.target && !obs.options.equalTurns) return { type: 'BANK' };
  if (obs.final) {
    const others = obs.contenders.filter((i) => i !== seat);
    const lastToPlay = others.every((i) => obs.seats[i].turns >= obs.final.turns);
    if (lastToPlay && after > Math.max(...others.map((i) => obs.seats[i].total), -1)) return { type: 'BANK' };
  }
  return null;
}

// Continue the simulated turn with a simple policy: keep rolling until the haul reaches STOP_AT, then stow. As the last
// player of the final round, keep rolling until stowing would put the bot ahead.
const STOP_AT = 3;
export function rollout(state, seat, rng, turnsAtStart) {
  let s = state;
  for (let step = 0; step < 60; step++) {
    if (s.winner !== null || s.seats[seat].turns > turnsAtStart || s.current !== seat) return s;
    let bank = s.turn.phase === 'decide' && s.turn.points >= STOP_AT;
    if (s.final) {
      const others = s.contenders.filter((i) => i !== seat);
      if (others.every((i) => s.seats[i].turns >= s.final.turns)) bank = s.turn.phase === 'decide' && s.seats[seat].total + s.turn.points > Math.max(...others.map((i) => s.seats[i].total), -1);
    }
    s = apply(s, bank ? { type: 'BANK' } : { type: 'ROLL' }, rng).state;
  }
  return s;
}
