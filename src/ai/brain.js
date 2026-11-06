// Bot brain. Receives ONLY an observation (never the session or the real RNG).
// Decides by simulating the rest of the turn with the game's own apply().
import { createRng } from '../core/rng.js';

export const PRESETS = {
  cautious: { label: 'Cautious', sims: 300, noise: 0.6, risk: -1 },
  balanced: { label: 'Balanced', sims: 600, noise: 1.0, risk: 0 },
  bold: { label: 'Bold', sims: 600, noise: 1.2, risk: 1.2 },
};

// Value of a finished simulated turn: the seat's banked total afterwards.
function simulate(game, obs, seat, firstAction, rng) {
  let st = JSON.parse(JSON.stringify(obs));
  let out = game.apply(st, { type: firstAction }, rng);
  st = out.state;
  // After a ROLL that did not end the turn, bank immediately (one-step lookahead).
  if (st.current === seat && !game.isOver(st) && game.legalActions(st, seat).some((a) => a.type === 'BANK')) {
    st = game.apply(st, { type: 'BANK' }, rng).state;
  }
  return st.seats[seat].total;
}

export function chooseAction(game, obs, seat, presetKey, seed) {
  const legal = game.legalActions(obs, seat);
  if (legal.length === 1) return legal[0];
  const p = PRESETS[presetKey] || PRESETS.balanced;
  const rng = createRng(seed);

  // Banking now wins the game outright: take it.
  const me = obs.seats[seat];
  const canBank = legal.some((a) => a.type === 'BANK');
  if (canBank && !obs.options.equalTurns && me.total + obs.turn.points >= obs.options.target) {
    return { type: 'BANK' };
  }

  let rollSum = 0;
  let bankSum = 0;
  for (let i = 0; i < p.sims; i++) {
    rollSum += simulate(game, obs, seat, 'ROLL', rng);
    bankSum += simulate(game, obs, seat, 'BANK', rng);
  }
  let margin = (rollSum - bankSum) / p.sims;

  // Observable-info nudge: when an opponent is close to the target and ahead, take more risk.
  const bestOpp = Math.max(...obs.seats.map((s, i) => (i === seat ? -1 : s.total)), -1);
  let catchUp = 0;
  if (bestOpp >= obs.options.target * 0.7 && bestOpp > me.total + obs.turn.points) {
    catchUp = Math.min(3, (bestOpp - me.total - obs.turn.points) / 24);
  }

  margin += p.risk + catchUp + rng.gauss() * p.noise;
  return { type: margin > 0 ? 'ROLL' : 'BANK', margin };
}

// Thinking time: longer when the call is close.
export function thinkMs(closeness) {
  return Math.round(700 + Math.min(1, closeness) * 800);
}
