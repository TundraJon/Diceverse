// Player avatars (18 faces: man / person / woman x six skin tones) and the helpers that decide which face a seat shows.
import { AI_ROSTER } from '../ai/roster.js';

export const TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}']; // default yellow, then light to dark
// The faces offered in Settings (no neutral "person" row). Until one is chosen the player shows the plain 👤.
export const KINDS = [
  { key: 'man', base: '\u{1F468}', label: 'Man' },
  { key: 'woman', base: '\u{1F469}', label: 'Woman' },
];
export const PLAIN_FACE = '\u{1F464}'; // the plain 👤: the player's starting face, and Pass & Play players 2 to 4
export const DEFAULT_AVATAR = { kind: 'none', tone: 0 };

export function personFace(avatar) {
  const k = KINDS.find((x) => x.key === (avatar && avatar.kind));
  if (!k) return PLAIN_FACE;
  const t = Number.isInteger(avatar.tone) && avatar.tone >= 0 && avatar.tone < TONES.length ? avatar.tone : 0;
  return k.base + TONES[t];
}

// Keep a saved avatar choice valid. The old neutral "person" default (never offered as a choice) and anything unknown
// count as "not chosen" and show the plain 👤.
export function cleanAvatar(a) {
  const kind = a && KINDS.some((x) => x.key === a.kind) ? a.kind : 'none';
  const tone = kind !== 'none' && Number.isInteger(a.tone) && a.tone >= 0 && a.tone < TONES.length ? a.tone : 0;
  return { kind, tone };
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
