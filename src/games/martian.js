// Martian Dice: pure rules module. No DOM, no timers, no Math.random.
// 13 dice, each with 1 tank, 2 death rays, 1 cow, 1 chicken and 1 human. A turn: roll the dice you have left, the tanks are always set aside, then set aside ALL the
// dice of ONE other type (death rays any time; cows, chickens and humans once each per turn), then roll again or stop. Score: tanks more than death rays = 0;
// otherwise 1 point per cow, chicken and human, and 3 more if you have all three kinds. Reach the target and everybody gets the same number of turns; a tie is
// settled by the Death Ray Duel (each tied player rolls 6 dice, more death rays wins).
// House rule `goal` = 'collect': instead of points, each player collects cows, chickens and humans over the turns (a turn that is not a bust adds what was set
// aside, no bonus); the first to have `each` of all three kinds ends the game, with the same number of turns for all and the Duel for a tie.

const clone = (v) => JSON.parse(JSON.stringify(v));

// What each face number (1 to 6) shows. The same order as the art (src/ui/martian-art.js).
export const FACES = ['ray', 'cow', 'human', 'chicken', 'tank', 'ray'];
export const DICE = 13;
export const DUEL_DICE = 6;
export const BONUS = 3;

export const meta = {
  id: 'martian',
  name: 'Martian Dice',
  players: { min: 1, max: 4 },
  soloOK: true,
  estMinutes: 8,
  tier: 'A',
  soloKey: (o) => (o.goal === 'collect' ? `collect:${o.each}` : String(o.target)), // the personal best is per goal (fewest turns to reach it)
  soloHide: [],
  houseRules: [
    {
      key: 'goal', label: 'Goal',
      options: [{ value: 'points', label: 'Points' }, { value: 'collect', label: 'Collect each type' }],
      default: 'points',
      hint: () => 'Points: score points up to the target score · Collect each type: be the first to collect the same number of cows, chickens and humans.',
    },
    {
      key: 'target', label: 'Target score',
      options: [15, 25, 35].map((v) => ({ value: v, label: String(v), disabled: (o) => o.goal === 'collect', disabledNote: 'The target score is not used when you collect each type.' })),
      default: 25,
    },
    {
      key: 'each', label: 'Each type',
      options: [5, 8, 10].map((v) => ({ value: v, label: String(v), disabled: (o) => o.goal !== 'collect', disabledNote: 'Used only when the goal is Collect each type.' })),
      default: 8,
    },
  ],
};

export function defaultOptions() {
  const o = {};
  meta.houseRules.forEach((r) => (o[r.key] = r.default));
  return o;
}

const freshTurn = () => ({
  phase: 'roll', // roll (a new turn), choose (a type must be set aside), decide (roll again or stop)
  left: DICE, // dice not yet set aside
  rolled: [], // the face numbers of the latest roll
  pending: [], // the types of the latest roll that are not tanks and not yet chosen
  kept: { tank: 0, ray: 0, cow: 0, chicken: 0, human: 0 },
  used: { cow: false, chicken: false, human: false }, // a type set aside this turn cannot be chosen again
  rolls: 0,
});

export function setup(options, rng) {
  const opts = { ...defaultOptions(), ...options };
  const seats = (opts.seats || [{ name: 'You', isBot: false }]).map((s) => ({
    name: s.name,
    isBot: !!s.isBot,
    preset: s.preset || null,
    total: 0, // points; in Collect mode the progress (each kind counted up to the goal)
    turns: 0,
    got: { cow: 0, chicken: 0, human: 0 }, // Collect mode: what has been collected over the turns
  }));
  const collect = opts.goal === 'collect';
  const n = seats.length;
  const drawn = n === 1 ? 0 : rng.die(n) - 1; // the starting player is drawn; Pass & Play can name one (options.first)
  const starter = Number.isInteger(opts.first) && opts.first >= 0 && opts.first < n ? opts.first : drawn;
  return {
    options: { ...opts, target: collect ? 3 * opts.each : opts.target, seats: seats.map(({ name, isBot, preset }) => ({ name, isBot, preset })) }, // (the target is the most progress there is, for the bot's catch-up logic)
    seats,
    current: starter,
    starter,
    turn: freshTurn(),
    final: null, // { turns } once somebody has reached the target: everybody plays up to this many turns
    duel: null, // { seats, round } while tied players settle it with the Death Ray Duel
    winner: null,
    winners: [],
  };
}

export function observe(state) {
  return state; // no hidden information
}

// The types the player can set aside from the latest roll: death rays always, the others once each per turn.
export function availableTypes(turn) {
  const types = [];
  ['ray', 'cow', 'chicken', 'human'].forEach((t) => {
    if (turn.pending.includes(t) && (t === 'ray' || !turn.used[t])) types.push(t);
  });
  return types;
}

export function legalActions(state, seat) {
  if (state.winner !== null || seat !== state.current) return [];
  if (state.duel) return [{ type: 'DUEL' }];
  const t = state.turn;
  if (t.phase === 'roll') return [{ type: 'ROLL' }];
  if (t.phase === 'choose') return availableTypes(t).map((face) => ({ type: 'KEEP', face }));
  return [{ type: 'ROLL' }, { type: 'STOP' }];
}

export function isOver(state) {
  return state.winner !== null;
}

export function result(state) {
  const standings = state.seats
    .map((s, i) => ({ seat: i, name: s.name, total: s.total, turns: s.turns }))
    .sort((a, b) => b.total - a.total);
  return { winner: state.winner, winners: state.winners.slice(), standings, soloTurns: state.seats.length === 1 ? state.seats[0].turns : null };
}

// What the turn scores with what is set aside now.
export function turnScore(kept) {
  const bust = kept.tank > kept.ray;
  const earth = kept.cow + kept.chicken + kept.human;
  const bonus = !bust && kept.cow > 0 && kept.chicken > 0 && kept.human > 0 ? BONUS : 0;
  return { bust, earth, bonus, gain: bust ? 0 : earth + bonus };
}

// Collect mode: how much of the goal a seat has (each kind counted up to the goal), and whether it is done.
export const progress = (got, each) => Math.min(got.cow, each) + Math.min(got.chicken, each) + Math.min(got.human, each);
export const isDone = (got, each) => got.cow >= each && got.chicken >= each && got.human >= each;

function scoreTurn(s, events) {
  const seat = s.seats[s.current];
  const k = s.turn.kept;
  const collect = s.options.goal === 'collect';
  const sc = turnScore(k);
  let bonus = sc.bonus;
  let gain = sc.gain;
  let added = null;
  if (collect) { // no bonus: a turn that is not a bust adds the cows, chickens and humans set aside
    bonus = 0;
    gain = sc.bust ? 0 : sc.earth;
    added = sc.bust ? { cow: 0, chicken: 0, human: 0 } : { cow: k.cow, chicken: k.chicken, human: k.human };
    seat.got.cow += added.cow;
    seat.got.chicken += added.chicken;
    seat.got.human += added.human;
    seat.total = progress(seat.got, s.options.each);
  } else seat.total += gain;
  seat.turns += 1;
  events.push({ type: 'TURN_SCORED', seat: s.current, tanks: k.tank, rays: k.ray, cows: k.cow, chickens: k.chicken, humans: k.human, bonus, gain, bust: sc.bust, total: seat.total, ...(collect ? { added, got: { ...seat.got } } : {}) });
  if (sc.bust) events.push({ type: 'BUSTED', seat: s.current, lost: 0 }); // (the bot moods listen for these two)
  else if (gain > 0) events.push({ type: 'BANKED', seat: s.current, amount: gain, total: seat.total });
  events.push({ type: 'TURN_ENDED', seat: s.current });
  nextTurn(s, events);
}

function gameOver(s, events, winners) {
  s.winner = winners[0];
  s.winners = winners.slice();
  events.push({ type: 'GAME_OVER', winner: s.winner, winners: s.winners.slice() });
}

function nextTurn(s, events) {
  const target = s.options.target;
  const collect = s.options.goal === 'collect';
  const each = s.options.each;
  const seat = s.seats[s.current];
  const reached = (x) => (collect ? isDone(x.got, each) : x.total >= target);
  if (s.seats.length === 1) {
    if (reached(seat)) { gameOver(s, events, [0]); return; }
  } else if (!s.final && reached(seat)) {
    s.final = { turns: seat.turns };
  }
  if (s.final && s.seats.every((x) => x.turns >= s.final.turns)) {
    const best = Math.max(...s.seats.map((x) => x.total));
    // Points: the most points. Collect: everybody who is done (two or more tie and go to the Duel).
    const leaders = s.seats.map((x, i) => ((collect ? isDone(x.got, each) : x.total === best) ? i : -1)).filter((i) => i >= 0);
    if (leaders.length === 1) { gameOver(s, events, leaders); return; }
    s.duel = { seats: leaders, round: 1 }; // a tie for the most points: the Death Ray Duel
    s.current = leaders[0];
    s.turn = freshTurn();
    events.push({ type: 'DUEL_STARTED', seats: leaders.slice() });
    return;
  }
  const n = s.seats.length;
  let next = s.current;
  for (let step = 1; step <= n; step++) {
    const cand = (s.current + step) % n;
    if (s.final && s.seats[cand].turns >= s.final.turns) continue; // already has all its turns
    next = cand;
    break;
  }
  s.current = next;
  s.turn = freshTurn();
  events.push({ type: 'TURN_STARTED', seat: s.current });
}

function rollDice(s, rng, events) {
  const t = s.turn;
  const rolled = [];
  for (let i = 0; i < t.left; i++) rolled.push(rng.die(6));
  t.rolls += 1;
  t.rolled = rolled;
  events.push({ type: 'ROLLED', seat: s.current, dice: rolled.slice() });
  const types = rolled.map((f) => FACES[f - 1]);
  const tanks = types.filter((x) => x === 'tank').length;
  t.kept.tank += tanks; // the tanks are always set aside
  t.left -= tanks;
  t.pending = types.filter((x) => x !== 'tank');
  if (tanks) events.push({ type: 'TANKS_KEPT', seat: s.current, count: tanks, tanks: t.kept.tank });
  if (!availableTypes(t).length) { // nothing can be set aside: the turn is over
    events.push({ type: 'NO_KEEP', seat: s.current });
    scoreTurn(s, events);
    return;
  }
  t.phase = 'choose';
}

export function apply(state, action, rng) {
  const s = clone(state);
  const events = [];
  if (s.winner !== null) throw new Error('Game is over');
  const t = s.turn;
  if (action.type === 'DUEL') {
    if (!s.duel) throw new Error('No duel');
    const rolls = s.duel.seats.map((seat) => {
      const dice = Array.from({ length: DUEL_DICE }, () => rng.die(6));
      return { seat, dice, rays: dice.filter((f) => FACES[f - 1] === 'ray').length };
    });
    events.push({ type: 'DUEL_ROLLED', rolls: rolls.map((r) => ({ ...r })) });
    const best = Math.max(...rolls.map((r) => r.rays));
    const top = rolls.filter((r) => r.rays === best);
    if (top.length === 1) {
      events.push({ type: 'DUEL_WON', winner: top[0].seat });
      gameOver(s, events, [top[0].seat]);
    } else { // still tied: the tied players roll again
      s.duel = { seats: top.map((r) => r.seat), round: s.duel.round + 1 };
      s.current = s.duel.seats[0];
      events.push({ type: 'DUEL_TIED', seats: s.duel.seats.slice() });
    }
  } else if (action.type === 'ROLL') {
    if (s.duel || (t.phase !== 'roll' && t.phase !== 'decide')) throw new Error('Cannot roll now');
    rollDice(s, rng, events);
  } else if (action.type === 'KEEP') {
    if (t.phase !== 'choose' || !availableTypes(t).includes(action.face)) throw new Error('Cannot keep that');
    const type = action.face;
    const count = t.pending.filter((x) => x === type).length;
    t.kept[type] += count;
    if (type !== 'ray') t.used[type] = true;
    t.left -= count;
    t.pending = [];
    events.push({ type: 'KEPT', seat: s.current, face: type, count, left: t.left });
    if (t.left === 0) scoreTurn(s, events); // no dice left: the turn is over
    else t.phase = 'decide';
  } else if (action.type === 'STOP') {
    if (t.phase !== 'decide') throw new Error('Cannot stop now');
    scoreTurn(s, events);
  } else {
    throw new Error(`Unknown action ${action.type}`);
  }
  return { state: s, events };
}

// ---- Bot hooks (used by src/ai/brain.js) ----
export const botHints = { riskScale: 1 };

export function candidatePlans(obs, seat) {
  return legalActions(obs, seat).map((a) => [a]);
}

// A plan that only stops has no luck in it.
export const isDeterministic = (plan) => plan.length === 1 && plan[0].type === 'STOP';

// What the simple policy of the rest of a simulated turn picks to set aside: the type worth most right now.
function keepValue(s, type) {
  const t = s.turn;
  const count = t.pending.filter((x) => x === type).length;
  const danger = t.kept.tank > t.kept.ray; // tanks lead: death rays are what is needed
  if (type === 'ray') return count * (danger ? 2.2 : 0.9);
  if (s.options.goal === 'collect') { // only what is still needed counts (a kind at the goal is worth almost nothing)
    const got = s.seats[s.current].got;
    const need = Math.max(0, s.options.each - got[type] - t.kept[type]);
    return Math.min(count, need) + 0.05 * count;
  }
  const others = ['cow', 'chicken', 'human'].filter((x) => x !== type);
  const completes = others.every((x) => t.kept[x] > 0) ? BONUS : 0;
  return count + completes + (t.kept[type] === 0 && others.some((x) => t.kept[x] > 0) ? 0.5 : 0);
}

// Roll again or stop, for the rest of a simulated turn: stop with few dice left or a good score; with tanks in front keep trying for rays.
function wantsToRoll(s) {
  const t = s.turn;
  if (t.left <= 2) return false;
  const sc = turnScore(t.kept);
  if (sc.bust) return t.left >= 3;
  if (s.options.goal === 'collect') { // stop once the turn has added a good amount of what is still needed
    const got = s.seats[s.current].got;
    const useful = ['cow', 'chicken', 'human'].reduce((a, x) => a + Math.min(t.kept[x], Math.max(0, s.options.each - got[x])), 0);
    return useful < 6;
  }
  return sc.gain < 7;
}

export function rollout(state, seat, rng, turnsAtStart) {
  let s = state;
  for (let guard = 0; guard < 60; guard++) {
    if (s.winner !== null || s.current !== seat || s.seats[seat].turns > turnsAtStart || s.duel) break;
    const t = s.turn;
    let a;
    if (t.phase === 'roll') a = { type: 'ROLL' };
    else if (t.phase === 'choose') {
      const types = availableTypes(t);
      a = { type: 'KEEP', face: types.reduce((best, x) => (keepValue(s, x) > keepValue(s, best) ? x : best), types[0]) };
    } else a = wantsToRoll(s) ? { type: 'ROLL' } : { type: 'STOP' };
    s = apply(s, a, rng).state;
  }
  return s;
}
