// ComboTable block: scoring of a *selection* of dice for Farkle-style games.
// A selection scores only if EVERY selected die is used by some combination.
// Values come from the supplied rules sheet (docs/farkle-rules-sheet.png).

const SINGLE = { 1: 100, 5: 50 };
const THREE = [0, 300, 200, 300, 400, 500, 600]; // index = face
const KIND = { 4: 1000, 5: 2000, 6: 3000 };
const SPECIAL = { straight: 1500, threePairs: 1500, fourPlusPair: 1500, twoTriplets: 2500 };

export const SCORING_SETS = ['standard', 'classic'];

// Best score using all k dice of one face, or null if they cannot all be used.
function faceBest(face, k) {
  if (k === 0) return 0;
  const single = SINGLE[face];
  let best = null;
  if (single) best = k * single;
  if (k >= 3) {
    const kind = k === 3 ? THREE[face] : KIND[k];
    best = Math.max(best === null ? -1 : best, kind);
    if (single && k > 3) best = Math.max(best, THREE[face] + (k - 3) * single);
  }
  return best;
}

function counts(values) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const v of values) c[v]++;
  return c;
}

function special(c, n) {
  if (n !== 6) return 0;
  const faces = c.slice(1);
  if (faces.every((x) => x === 1)) return SPECIAL.straight;
  const twos = faces.filter((x) => x === 2).length;
  const threes = faces.filter((x) => x === 3).length;
  const fours = faces.filter((x) => x === 4).length;
  if (twos === 3) return SPECIAL.threePairs;
  if (fours === 1 && twos === 1) return SPECIAL.fourPlusPair;
  if (threes === 2) return SPECIAL.twoTriplets;
  return 0;
}

// Score of exactly this set of dice (all used), or null if invalid / empty.
export function scoreSelection(values, scoring = 'standard') {
  const n = values.length;
  if (n === 0) return null;
  const c = counts(values);
  let total = 0;
  let valid = true;
  for (let f = 1; f <= 6; f++) {
    const fb = faceBest(f, c[f]);
    if (fb === null) { valid = false; break; }
    total += fb;
  }
  let best = valid ? total : null;
  if (scoring === 'standard') {
    const sp = special(c, n);
    if (sp > 0 && (best === null || sp > best)) best = sp;
  }
  return best;
}

// Every non-empty subset of the rolled dice that scores: [{ idx: [indices], score }]
export function validSubsets(values, scoring = 'standard') {
  const n = values.length;
  const out = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    const idx = [];
    const vals = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { idx.push(i); vals.push(values[i]); }
    const score = scoreSelection(vals, scoring);
    if (score !== null) out.push({ idx, score });
  }
  return out;
}

// Fast "is this a Farkle?" test (equivalent to validSubsets(...).length > 0).
export function hasScoring(values, scoring = 'standard') {
  const c = counts(values);
  if (c[1] > 0 || c[5] > 0) return true;
  for (let f = 2; f <= 6; f++) if (c[f] >= 3) return true;
  return scoring === 'standard' && special(c, values.length) > 0;
}

// Highest-scoring selection among the rolled dice (used by bot rollouts): returns index list.
export function bestSelection(values, scoring = 'standard') {
  const c = counts(values);
  const take = [];
  values.forEach((v, i) => { if (v === 1 || v === 5 || c[v] >= 3) take.push(i); });
  let bestIdx = null;
  let bestScore = -1;
  if (take.length) {
    const s = scoreSelection(take.map((i) => values[i]), scoring);
    if (s !== null) { bestIdx = take; bestScore = s; }
  }
  if (scoring === 'standard' && special(c, values.length) > bestScore) {
    bestIdx = values.map((_, i) => i);
    bestScore = special(c, values.length);
  }
  if (bestIdx === null) {
    // fall back to the exhaustive search (rare: e.g. only three pairs without 1s/5s handled above)
    const all = validSubsets(values, scoring);
    if (!all.length) return null;
    all.sort((a, b) => b.score - a.score);
    return all[0].idx;
  }
  return bestIdx;
}

// Rows for the on-screen scoring table, generated from the same constants as the engine.
export function scoreTable(scoring = 'standard') {
  const rows = [
    { label: 'Single 1', dice: [1], points: SINGLE[1] },
    { label: 'Single 5', dice: [5], points: SINGLE[5] },
  ];
  for (let f = 1; f <= 6; f++) rows.push({ label: `Three ${f}s`, dice: [f, f, f], points: THREE[f] });
  rows.push({ label: 'Four of a kind', dice: ['?', '?', '?', '?'], points: KIND[4] });
  rows.push({ label: 'Five of a kind', dice: ['?', '?', '?', '?', '?'], points: KIND[5] });
  rows.push({ label: 'Six of a kind', dice: ['?', '?', '?', '?', '?', '?'], points: KIND[6] });
  if (scoring === 'standard') {
    rows.push({ label: 'Straight 1-6', dice: [1, 2, 3, 4, 5, 6], points: SPECIAL.straight });
    rows.push({ label: 'Three pairs', dice: ['?', '?', '?', '?', '?', '?'], points: SPECIAL.threePairs });
    rows.push({ label: 'Four of a kind + pair', dice: ['?', '?', '?', '?', '?', '?'], points: SPECIAL.fourPlusPair });
    rows.push({ label: 'Two triplets', dice: ['?', '?', '?', '?', '?', '?'], points: SPECIAL.twoTriplets });
  }
  return rows;
}
