// Seeded RNGs. Every random draw in the game goes through one of these.
//
//  - Array seed of four uint32 values -> sfc32 (128-bit state, public-domain generator).
//    Dice use rejection sampling so every face is exactly equally likely.
//  - Single number seed -> legacy mulberry32. Kept ONLY so old saves (version 1) replay
//    exactly as before, and for the bot's throwaway simulations. Not used for new games' dice.
//
// Neither generator is cryptographically secure; they are deterministic given the seed,
// which is what makes autosave, resume, replay and testing work.

const TWO32 = 4294967296;

function createLegacy(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / TWO32;
  };
  return {
    next,
    uint32: () => Math.floor(next() * TWO32),
    die: (sides = 6) => Math.floor(next() * sides) + 1, // unchanged on purpose: old saves must replay identically
    gauss: () => gauss(next),
  };
}

function createSfc32(seed) {
  if (seed.length !== 4 || !seed.every((v) => Number.isFinite(v))) throw new Error('Invalid seed');
  let a = seed[0] | 0, b = seed[1] | 0, c = seed[2] | 0, d = seed[3] | 0;
  const uint32 = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) uint32(); // warm-up
  const next = () => uint32() / TWO32;
  return {
    next,
    uint32,
    // Exactly fair integer in [1, sides] by rejection sampling.
    die(sides = 6) {
      const limit = Math.floor(TWO32 / sides) * sides;
      let u;
      do { u = uint32(); } while (u >= limit);
      return (u % sides) + 1;
    },
    gauss: () => gauss(next),
  };
}

function gauss(next) {
  const u = Math.max(next(), 1e-12);
  const v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function createRng(seed) {
  return Array.isArray(seed) ? createSfc32(seed) : createLegacy(seed);
}

// A fresh game seed: four uint32 values from the browser's secure generator.
export function newSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return Array.from(crypto.getRandomValues(new Uint32Array(4)));
  }
  // Fallback when no secure generator exists. This is the ONLY place Math.random may appear;
  // rules code must never call it.
  const t = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : 0;
  let x = (Date.now() ^ t ^ Math.floor(Math.random() * TWO32)) >>> 0;
  const out = [];
  for (let i = 0; i < 4; i++) {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    out.push((z ^ (z >>> 16)) >>> 0);
  }
  return out;
}
