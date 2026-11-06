// Dice pool block: pure helpers for a set of dice.
export function createPool(count, sides = 6) {
  return Array.from({ length: count }, (_, i) => ({ id: i, value: null, sides, state: 'free' }));
}

// Roll every die in the pool that is free (or the listed ids). Returns a new pool.
export function rollPool(pool, rng, ids = null) {
  return pool.map((d) =>
    (ids ? ids.includes(d.id) : d.state === 'free') ? { ...d, value: rng.die(d.sides) } : { ...d }
  );
}

export const values = (pool) => pool.map((d) => d.value);
