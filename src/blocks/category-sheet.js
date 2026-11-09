// CategorySheet block: rule sets, category scoring, bonuses and the Joker for Yacht-style games.
// Dice are arrays of five values (1-6). All functions are pure.

const counts = (d) => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of d) c[v]++; return c; };
const sum = (d) => d.reduce((a, b) => a + b, 0);
const topFace = (c, k) => { for (let f = 6; f >= 1; f--) if (c[f] >= k) return f; return 0; };
const sortedKey = (d) => d.slice().sort((a, b) => a - b).join('');

const upper = (n) => (d) => n * counts(d)[n];
const onePair = (d) => { const f = topFace(counts(d), 2); return f ? 2 * f : 0; };
const twoPairs = (d) => {
  const c = counts(d); const faces = [];
  for (let f = 6; f >= 1; f--) if (c[f] >= 2) faces.push(f);
  return faces.length >= 2 ? 2 * faces[0] + 2 * faces[1] : 0;
};
const kindOf3 = (d) => { const f = topFace(counts(d), 3); return f ? 3 * f : 0; };
const kindOf3All = (d) => (topFace(counts(d), 3) ? sum(d) : 0);
const kindOf4 = (d) => { const f = topFace(counts(d), 4); return f ? 4 * f : 0; };
const kindOf4All = (d) => (topFace(counts(d), 4) ? sum(d) : 0);
const isFullHouse = (d) => { const c = counts(d); return c.includes(3) && c.includes(2); };
const fullHouseSum = (d) => (isFullHouse(d) ? sum(d) : 0);
const fullHouse25 = (d) => (isFullHouse(d) ? 25 : 0);
const exact = (key, pts) => (d) => (sortedKey(d) === key ? pts : 0);
const anyFour = (pts) => (d) => { const s = new Set(d); return [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]].some((r) => r.every((v) => s.has(v))) ? pts : 0; };
const anyFive = (pts) => (d) => (['12345', '23456'].includes(sortedKey(d)) ? pts : 0);
const chance = (d) => sum(d);
const fiveKind = (d) => (counts(d).includes(5) ? 50 : 0);

const UPPER = [
  { key: 'ones', label: 'Ones', desc: 'add 1s', score: upper(1) }, { key: 'twos', label: 'Twos', desc: 'add 2s', score: upper(2) },
  { key: 'threes', label: 'Threes', desc: 'add 3s', score: upper(3) }, { key: 'fours', label: 'Fours', desc: 'add 4s', score: upper(4) },
  { key: 'fives', label: 'Fives', desc: 'add 5s', score: upper(5) }, { key: 'sixes', label: 'Sixes', desc: 'add 6s', score: upper(6) },
];
export const UPPER_KEYS = UPPER.map((c) => c.key);

// `short` is the compact text used in the side-by-side rules table.
export const RULESETS = {
  classic: {
    id: 'classic', label: 'Classic Yacht', short: 'Classic', rounds: 12, upperBonus: 0, extra: false,
    categories: [
      ...UPPER,
      { key: 'fullHouse', label: 'Full House', desc: '3 + 2 the same, add all 5', score: fullHouseSum, short: 'Sum 5' },
      { key: 'fourKind', label: 'Four of a Kind', desc: '4 the same, add the 4', score: kindOf4, short: 'Sum 4' },
      { key: 'smallStraight', label: 'Little Straight', desc: '1-2-3-4-5, 30', score: exact('12345', 30), short: '30 (1-5)' },
      { key: 'largeStraight', label: 'Big Straight', desc: '2-3-4-5-6, 30', score: exact('23456', 30), short: '30 (2-6)' },
      { key: 'chance', label: 'Choice', desc: 'any dice, add all 5', score: chance, short: 'Sum 5' },
      { key: 'fiveKind', label: 'Yacht', desc: 'all 5 the same, 50', score: fiveKind, short: '50' },
    ],
  },
  nordic: {
    id: 'nordic', label: 'Nordic (Yatzy)', short: 'Nordic', rounds: 15, upperBonus: 50, extra: false,
    categories: [
      ...UPPER,
      { key: 'onePair', label: 'One Pair', desc: '2 the same, add the pair', score: onePair, short: 'Sum 2' },
      { key: 'twoPairs', label: 'Two Pairs', desc: '2 different pairs, add the 4', score: twoPairs, short: 'Sum 4' },
      { key: 'threeKind', label: 'Three of a Kind', desc: '3 the same, add the 3', score: kindOf3, short: 'Sum 3' },
      { key: 'fourKind', label: 'Four of a Kind', desc: '4 the same, add the 4', score: kindOf4, short: 'Sum 4' },
      { key: 'smallStraight', label: 'Small Straight', desc: '1-2-3-4-5, 15', score: exact('12345', 15), short: '15 (1-5)' },
      { key: 'largeStraight', label: 'Large Straight', desc: '2-3-4-5-6, 20', score: exact('23456', 20), short: '20 (2-6)' },
      { key: 'fullHouse', label: 'Full House', desc: '3 + 2 the same, add all 5', score: fullHouseSum, short: 'Sum 5' },
      { key: 'chance', label: 'Chance', desc: 'any dice, add all 5', score: chance, short: 'Sum 5' },
      { key: 'fiveKind', label: 'Yatzy', desc: 'all 5 the same, 50', score: fiveKind, short: '50' },
    ],
  },
  popular: {
    id: 'popular', label: 'Popular (Bonus)', short: 'Popular', rounds: 13, upperBonus: 35, extra: true,
    categories: [
      ...UPPER,
      { key: 'threeKind', label: 'Three of a Kind', desc: '3 the same, add all 5', score: kindOf3All, short: 'Sum 5' },
      { key: 'fourKind', label: 'Four of a Kind', desc: '4 the same, add all 5', score: kindOf4All, short: 'Sum 5' },
      { key: 'fullHouse', label: 'Full House', desc: '3 + 2 the same, 25', score: fullHouse25, short: '25' },
      { key: 'smallStraight', label: 'Small Straight', desc: '4 in a row, 30', score: anyFour(30), short: '30 (any 4)' },
      { key: 'largeStraight', label: 'Large Straight', desc: '5 in a row, 40', score: anyFive(40), short: '40 (any 5)' },
      { key: 'chance', label: 'Chance', desc: 'any dice, add all 5', score: chance, short: 'Sum 5' },
      { key: 'fiveKind', label: 'Five of a Kind', desc: 'all 5 the same, 50', score: fiveKind, short: '50' },
    ],
  },
};
export const RULESET_IDS = ['classic', 'nordic', 'popular'];
export const UPPER_TARGET = 63;

// Typical score per category, used by the bot to judge a score against what the box is "worth".
// Upper boxes: three dice of the face (which also steers toward the 63 bonus). The others were measured
// from 4,000 simulated solo games per rule set played by the bot's own rollout policy (5 refinement passes);
// they reflect that simple policy, not perfect play (it rarely builds straights, so those boxes read 0-1).
const MEASURED = {
  classic: { fullHouse: 12.6, fourKind: 15.5, smallStraight: 0, largeStraight: 0, chance: 23, fiveKind: 21.7 },
  nordic: { onePair: 10.3, twoPairs: 14.6, threeKind: 15.3, fourKind: 17.3, smallStraight: 0, largeStraight: 0, fullHouse: 14.2, chance: 22.6, fiveKind: 24.3 },
  popular: { threeKind: 21.2, fourKind: 18.8, fullHouse: 18.1, smallStraight: 8.6, largeStraight: 0.8, chance: 22.7, fiveKind: 23.2 },
};
export const PAR = { classic: {}, nordic: {}, popular: {} };
RULESET_IDS.forEach((id) => RULESETS[id].categories.forEach((c) => {
  PAR[id][c.key] = UPPER_KEYS.includes(c.key) ? 3 * (UPPER_KEYS.indexOf(c.key) + 1) : MEASURED[id][c.key];
}));

export const categoryList = (setId) => RULESETS[setId].categories;
export const emptyCard = (setId) => Object.fromEntries(categoryList(setId).map((c) => [c.key, null]));
export const openCategories = (setId, card) => categoryList(setId).filter((c) => card[c.key] === null).map((c) => c.key);

// An extra five of a kind in the Popular set when the Five of a Kind box already holds 50.
export function jokerActive(setId, dice, card) {
  return RULESETS[setId].extra && counts(dice).includes(5) && card.fiveKind === 50;
}

// What these dice would score in a category (the simplified Joker relaxes three categories).
export function potential(setId, key, dice, card) {
  const cat = RULESETS[setId].categories.find((c) => c.key === key);
  if (jokerActive(setId, dice, card)) {
    if (key === 'fullHouse') return 25;
    if (key === 'smallStraight') return 30;
    if (key === 'largeStraight') return 40;
  }
  return cat.score(dice);
}

export function totals(setId, card, extra = 0) {
  const set = RULESETS[setId];
  const up = UPPER_KEYS.reduce((a, k) => a + (card[k] || 0), 0);
  const bonus = set.upperBonus && up >= UPPER_TARGET ? set.upperBonus : 0;
  const lowerKeys = set.categories.map((c) => c.key).filter((k) => !UPPER_KEYS.includes(k));
  const lower = lowerKeys.reduce((a, k) => a + (card[k] || 0), 0);
  return { upper: up, bonus, lower, extra, total: up + bonus + lower + extra };
}

export const cardFull = (setId, card) => openCategories(setId, card).length === 0;

// Rows for the side-by-side rules table, built from the same data as the engine.
export function comparisonRows() {
  const ids = RULESET_IDS;
  const short = (setId, key) => { const c = RULESETS[setId].categories.find((x) => x.key === key); return c ? c.short : '—'; };
  const rows = [
    ['Ones to Sixes', ...ids.map(() => 'Sum of that face')],
    ['Upper bonus', ...ids.map((i) => (RULESETS[i].upperBonus ? `${RULESETS[i].upperBonus} at ${UPPER_TARGET}+` : '—'))],
  ];
  [['One Pair', 'onePair'], ['Two Pairs', 'twoPairs'], ['Three of a Kind', 'threeKind'], ['Four of a Kind', 'fourKind'], ['Full House', 'fullHouse'],
   ['Small Straight', 'smallStraight'], ['Large Straight', 'largeStraight'], ['Chance / Choice', 'chance'], ['Five of a kind', 'fiveKind']]
    .forEach(([label, key]) => rows.push([label, ...ids.map((i) => short(i, key))]));
  rows.push(['Extra five of a kind', ...ids.map((i) => (RULESETS[i].extra ? '+100, Joker' : '—'))]);
  rows.push(['Rounds', ...ids.map((i) => String(RULESETS[i].rounds))]);
  return rows;
}
