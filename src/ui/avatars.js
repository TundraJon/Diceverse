// Player avatars: an age (child or adult), a style (male or female) that decides which faces are listed, one face from that list (`look`) and one of six
// skin tones. The helpers below decide which face a seat shows.
import { AI_ROSTER } from '../ai/roster.js';

export const TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}']; // default yellow, then light to dark
export const TONE_COLORS = ['#f7d56a', '#f6d3b9', '#e4b58f', '#c4885a', '#8f5a3a', '#5b3a29']; // the swatches in Settings, one per tone
export const AGES = [
  { key: 'child', label: 'Child' },
  { key: 'adult', label: 'Adult' },
];
export const STYLES = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];
// The faces to choose from (the user's lists, one bald face each). The first one of a list is its default. A child has the same three for either style.
const CHILD = ['\u{1F466}', '\u{1F467}', '\u{1F9D1}\u200D\u{1F9B2}']; // boy, girl, bald person
const ADULT = {
  male: ['\u{1F468}', '\u{1F9D1}', '\u{1F471}\u200D\u2642\uFE0F', '\u{1F471}', '\u{1F9D4}', '\u{1F9D4}\u200D\u2642\uFE0F', '\u{1F9D4}\u200D\u2640\uFE0F',
    '\u{1F468}\u200D\u{1F9B0}', '\u{1F9D1}\u200D\u{1F9B0}', '\u{1F468}\u200D\u{1F9B1}', '\u{1F9D1}\u200D\u{1F9B1}', '\u{1F468}\u200D\u{1F9B3}',
    '\u{1F468}\u200D\u{1F9B2}', '\u{1F474}'],
  female: ['\u{1F469}', '\u{1F9D1}', '\u{1F471}\u200D\u2640\uFE0F', '\u{1F471}', '\u{1F9D1}\u200D\u{1F9B0}', '\u{1F469}\u200D\u{1F9B0}', '\u{1F468}\u200D\u{1F9B0}',
    '\u{1F469}\u200D\u{1F9B1}', '\u{1F9D1}\u200D\u{1F9B1}', '\u{1F469}\u200D\u{1F9B3}', '\u{1F9D1}\u200D\u{1F9B3}', '\u{1F468}\u200D\u{1F9B3}',
    '\u{1F469}\u200D\u{1F9B2}', '\u{1F475}', '\u{1F9D3}'],
};
// The faces listed for an age and style (a child has the same list for both styles; 'none' counts as adult male).
export function looksFor(age, style) {
  if (age === 'child') return CHILD;
  return ADULT[style === 'female' ? 'female' : 'male'];
}
// The face a style starts with: a boy or a girl for a child, a man or a woman for an adult.
const defaultLook = (age, style) => (age === 'child' ? CHILD[style === 'female' ? 1 : 0] : looksFor(age, style)[0]);
export const PLAIN_FACE = '\u{1F464}'; // the plain 👤: the player's starting face, and Pass & Play players 2 to 4
export const DEFAULT_AVATAR = { age: 'none', style: 'none', look: '', tone: 0 }; // not chosen yet: shows the plain 👤

// A face with a skin tone: the tone mark goes straight after the first symbol (👨‍🦲 becomes 👨🏽‍🦲).
export function withTone(look, tone) {
  const t = Number.isInteger(tone) && tone >= 0 && tone < TONES.length ? tone : 0;
  const cps = Array.from(look);
  cps.splice(1, 0, TONES[t]);
  return cps.join('');
}

export function personFace(avatar) {
  const a = cleanAvatar(avatar);
  if (a.age === 'none') return PLAIN_FACE;
  return withTone(a.look, a.tone);
}

// Keep a saved avatar choice valid. A face that is not in its list becomes the style's default (so an old Elder, which had no face, becomes an adult's
// first face; old saves are not kept working beyond that); the old neutral "person" and anything unknown count as "not chosen" and show the plain 👤.
export function cleanAvatar(a) {
  let age = a && ['child', 'adult', 'elder'].includes(a.age) ? a.age : 'none';
  let style = a && ['male', 'female'].includes(a.style) ? a.style : 'none';
  if (age === 'none' && a && (a.kind === 'man' || a.kind === 'woman')) { age = 'adult'; style = a.kind === 'man' ? 'male' : 'female'; }
  if (age === 'none' || style === 'none') return { age: 'none', style: 'none', look: '', tone: 0 };
  const wasElder = age === 'elder'; // an old Elder becomes the older man or woman of the adult list
  if (wasElder) age = 'adult';
  const tone = a && Number.isInteger(a.tone) && a.tone >= 0 && a.tone < TONES.length ? a.tone : 0;
  const list = looksFor(age, style);
  const look = a && list.includes(a.look) ? a.look : wasElder ? (style === 'male' ? '\u{1F474}' : '\u{1F475}') : defaultLook(age, style);
  return { age, style, look, tone };
}

// Player colors: eight that read well on the dark board. The first one is the default.
export const COLORS = [
  { key: 'blue', hex: '#3b82f6', label: 'Blue' },
  { key: 'green', hex: '#22a55b', label: 'Green' },
  { key: 'red', hex: '#e5484d', label: 'Red' },
  { key: 'amber', hex: '#f59e0b', label: 'Amber' },
  { key: 'purple', hex: '#a855f7', label: 'Purple' },
  { key: 'cyan', hex: '#06b6d4', label: 'Cyan' },
  { key: 'pink', hex: '#ec4899', label: 'Pink' },
  { key: 'white', hex: '#e5e7eb', label: 'White' },
];
export const cleanColor = (k) => (COLORS.some((c) => c.key === k) ? k : COLORS[0].key);

// Colors for `count` seats: seat 0 gets the player's choice, the others take the remaining colors in palette order.
export function seatColors(count, mineKey) {
  const mine = COLORS.find((c) => c.key === cleanColor(mineKey));
  const rest = COLORS.filter((c) => c !== mine);
  return Array.from({ length: count }, (_, i) => (i === 0 ? mine.hex : rest[i - 1].hex));
}

// Keep a typed name valid: trimmed, single spaces, at most 12 characters, empty means "You".
export function cleanName(raw) {
  const n = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, 12).trim();
  return n || 'You';
}

// A seat is "me" (shown as "Your turn", "You win") only when exactly one human plays. Older saves have no flag, so the
// name "You" still counts.
export const isMe = (seat) => !!seat && (seat.me === true || (seat.me === undefined && seat.name === 'You'));

// The roster id of a bot seat. Older saves have no botId, so the old name is matched to the roster.
const OLD_NAMES = { Pip: 'pip', Dottie: 'dottie', Rook: 'chance', Mabel: 'nat', Juno: 'alea', Fitch: 'snake' };
export function botIdOf(seat) {
  if (!seat || !seat.isBot) return null;
  if (seat.botId && AI_ROSTER[seat.botId]) return seat.botId;
  const byName = Object.values(AI_ROSTER).find((b) => b.name === seat.name);
  return byName ? byName.id : OLD_NAMES[seat.name] || null;
}

// Can this phone draw the emoji as one glyph? (older phones draw a 2020 emoji as two). Cached; true if we cannot tell.
const drawable = {};
export function canDraw(emoji) {
  if (emoji in drawable) return drawable[emoji];
  let ok = true;
  try {
    const parts = Array.from(emoji).filter((c) => c !== '‍');
    if (parts.length > 1 && emoji.includes('‍') && typeof document !== 'undefined') {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = '40px sans-serif';
      const whole = ctx.measureText(emoji).width;
      const split = parts.reduce((a, c) => a + ctx.measureText(c).width, 0);
      ok = whole < split * 0.9;
    }
  } catch { ok = true; }
  drawable[emoji] = ok;
  return ok;
}

// The face a seat shows right now. `mood` only matters for the bots that change face.
export function faceFor(seat, mood) {
  const id = botIdOf(seat);
  if (id) {
    const bot = AI_ROSTER[id];
    const m = mood && bot.moods[mood];
    if (m && m.emoji) return m.fallback && !canDraw(m.emoji) ? m.fallback : m.emoji;
    return bot.defaultEmoji;
  }
  if (seat && seat.isBot) return '\u{1F916}';
  return (seat && seat.avatar) || PLAIN_FACE;
}

// The status text that replaces a view's normal turn line while a bot is thinking (talk now shows in a speech bubble).
export function statusOverride(view, cur, over) {
  if (!over && cur && cur.isBot) {
    const t = view.thinking;
    if (t) return t.startsWith(cur.name) ? t : `${cur.name}: ${t}`;
    return `${cur.name} is thinking\u2026`;
  }
  return null;
}
