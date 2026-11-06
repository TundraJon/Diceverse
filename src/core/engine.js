// Session wrapper: owns seed, RNG, state and the action log. Rules modules stay pure.
import { createRng } from './rng.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export function createSession(game, options, seed) {
  const rng = createRng(seed);
  let state = game.setup(options, rng);
  const log = [];
  return {
    game,
    seed,
    options,
    log,
    get state() {
      return state;
    },
    observe(seat) {
      return clone(game.observe(state, seat));
    },
    legalActions(seat) {
      return game.legalActions(state, seat);
    },
    dispatch(action) {
      const legal = game.legalActions(state, state.current);
      if (!legal.some((a) => a.type === action.type)) {
        throw new Error(`Illegal action ${action.type}`);
      }
      const out = game.apply(state, action, rng);
      state = out.state;
      log.push({ type: action.type });
      return out.events;
    },
    isOver() {
      return game.isOver(state);
    },
    result() {
      return game.result(state);
    },
    save() {
      return { version: 1, seed, options, log: log.slice() };
    },
  };
}

// Rebuild a session by replaying a saved action log. Returns null if replay fails.
export function replaySession(game, saved) {
  try {
    if (!saved || saved.version !== 1 || !Array.isArray(saved.log)) return null;
    const s = createSession(game, saved.options, saved.seed);
    for (const a of saved.log) {
      if (s.isOver()) return null;
      s.dispatch({ type: a.type });
    }
    return s;
  } catch {
    return null;
  }
}
