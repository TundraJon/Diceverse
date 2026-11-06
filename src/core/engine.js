// Session wrapper: owns seed, RNG, state and the action log. Rules modules stay pure.
import { createRng } from './rng.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

// Actions may carry an `ids` payload (e.g. Farkle SET_ASIDE); compare type and sorted ids.
const sortedIds = (a) => (a.ids ? a.ids.slice().sort((x, y) => x - y) : null);
const sameAction = (a, b) => a.type === b.type && JSON.stringify(sortedIds(a)) === JSON.stringify(sortedIds(b));

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
      if (!legal.some((a) => sameAction(a, action))) {
        throw new Error(`Illegal action ${action.type}`);
      }
      const out = game.apply(state, action, rng);
      state = out.state;
      log.push(clone(action)); // full action, so payloads replay exactly
      return out.events;
    },
    isOver() {
      return game.isOver(state);
    },
    result() {
      return game.result(state);
    },
    save() {
      // Array seed -> version 2 (sfc32). Numeric seed -> version 1 (legacy generator, resumed old save).
      return { version: Array.isArray(seed) ? 2 : 1, seed, options, log: log.slice() };
    },
  };
}

// Rebuild a session by replaying a saved action log. Returns null if replay fails.
export function replaySession(game, saved) {
  try {
    if (!saved || !Array.isArray(saved.log)) return null;
    const v1 = saved.version === 1 && typeof saved.seed === 'number' && Number.isFinite(saved.seed);
    const v2 = saved.version === 2 && Array.isArray(saved.seed) && saved.seed.length === 4 && saved.seed.every(Number.isInteger);
    if (!v1 && !v2) return null;
    const s = createSession(game, saved.options, saved.seed);
    for (const a of saved.log) {
      if (s.isOver()) return null;
      s.dispatch(a);
    }
    return s;
  } catch {
    return null;
  }
}
