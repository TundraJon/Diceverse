// Bot brain. Receives ONLY an observation (never the session or the real RNG).
// Each candidate plan is valued by simulating the rest of the turn with the game's own
// apply() and a simple rollout policy; the game supplies the plans and the rollout.
import { createRng } from '../core/rng.js';

export const PRESETS = {
  cautious: { label: 'Cautious', sims: 300, noise: 0.6, risk: -1 },
  balanced: { label: 'Balanced', sims: 600, noise: 1.0, risk: 0 },
  bold: { label: 'Bold', sims: 600, noise: 1.2, risk: 1.2 },
};

// Returns { actions: [...], margin } where actions are dispatched in order (e.g. SET_ASIDE then ROLL).
// margin = adjusted value gap between the best and second-best plan (small = close call).
export function decide(game, obs, seat, presetKey, seed) {
  const plans = game.candidatePlans ? game.candidatePlans(obs, seat) : game.legalActions(obs, seat).map((a) => [a]);
  if (plans.length === 1) return { actions: plans[0], margin: null };

  const shortcut = game.shortcut ? game.shortcut(obs, seat) : null;
  if (shortcut) return { actions: [shortcut], margin: Infinity };

  const p = PRESETS[presetKey] || PRESETS.balanced;
  const hints = game.botHints || {};
  const sc = hints.riskScale || 1;
  const nsc = hints.noiseScale === undefined ? sc : hints.noiseScale; // per-game scale for the random noise
  const rng = createRng(seed);
  const turnsAtStart = obs.seats[seat].turns;
  const sims = plans.length > 2 ? (hints.simsPerPlan ? hints.simsPerPlan(p.sims) : Math.max(80, Math.floor(p.sims / 4))) : p.sims;
  // Hook name is turnValue (not valueOf: bundled modules inherit Object.prototype.valueOf).
  const turnValue = game.turnValue || ((st, who) => st.seats[who].total);

  // Observable-info nudge: when an opponent is close to the target and ahead, take more risk.
  const me = obs.seats[seat];
  const bestOpp = Math.max(...obs.seats.map((s, i) => (i === seat ? -1 : s.total)), -1);
  let catchUp = 0;
  const turnPts = obs.turn.points || 0;
  if (obs.options.target && bestOpp >= obs.options.target * 0.7 && bestOpp > me.total + turnPts) {
    catchUp = Math.min(3, (bestOpp - me.total - turnPts) / (24 * sc)) * sc;
  }

  const scores = plans.map((plan) => {
    let sum = 0;
    const n = game.isDeterministic && game.isDeterministic(plan) ? 1 : sims;
    for (let i = 0; i < n; i++) {
      let st = obs;
      for (const a of plan) st = game.apply(st, a, rng).state;
      st = game.rollout(st, seat, rng, turnsAtStart);
      sum += turnValue(st, seat);
    }
    const continues = plan[plan.length - 1].type === 'ROLL';
    // Per-plan noise of sd noise*nsc/sqrt(2): the gap between two plans then has sd noise*nsc.
    return sum / n + (continues ? p.risk * sc + catchUp : 0) + rng.gauss() * p.noise * nsc * Math.SQRT1_2;
  });

  let best = 0;
  scores.forEach((v, i) => { if (v > scores[best]) best = i; });
  const second = scores.reduce((m, v, i) => (i !== best && v > m ? v : m), -Infinity);
  return { actions: plans[best], margin: (scores[best] - second) / sc };
}

// Back-compat single-action helper (used by older scratch tests).
export function chooseAction(game, obs, seat, presetKey, seed) {
  const d = decide(game, obs, seat, presetKey, seed);
  return { type: d.actions[0].type, margin: d.margin };
}

// Thinking time: longer when the call is close.
export function thinkMs(closeness) {
  return Math.round(700 + Math.min(1, closeness) * 800);
}
