// The stored players of Pass & Play (pure functions, no DOM). Player 1 is always you, the Settings profile (name, avatar, colour; the checkbox
// is `youPlay`); up to eight more are kept in `settings.roster` between games and sessions. A checked player takes part in the game.
import { COLORS, cleanAvatar, cleanColor, personFace, DEFAULT_AVATAR } from '../ui/avatars.js';

export const MAX_ROSTER = 8; // besides you: nine players in all
export const MIN_PLAYERS = 2; // a Pass & Play game needs at least two people

// A typed name: single spaces, at most 12 characters; empty means "not named" (shown as "Player N").
export const cleanRosterName = (raw) => String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, 12).trim();

// The first colour key that is not in `used`.
export function firstFreeColor(used) {
  const free = COLORS.find((c) => !used.includes(c.key));
  return (free || COLORS[0]).key;
}

// Make a saved roster valid. Nothing saved (undefined) gives the one starting slot (player two); an empty list is a real choice (everybody was deleted).
export function cleanRoster(roster, myColor) {
  if (!Array.isArray(roster)) return [{ name: '', avatar: { ...DEFAULT_AVATAR }, color: firstFreeColor([cleanColor(myColor)]), playing: true }];
  return roster.slice(0, MAX_ROSTER).map((p) => ({
    name: cleanRosterName(p && p.name),
    avatar: cleanAvatar(p && p.avatar),
    color: cleanColor(p && p.color),
    playing: !!(p && p.playing),
  }));
}

// Everybody in the list, you first. `index` is -1 for you and the position in `settings.roster` for the others; `n` is the place in the list (1 for you).
export function listPlayers(settings) {
  const you = { index: -1, n: 1, name: settings.name, avatar: settings.avatar, color: settings.color, playing: settings.youPlay !== false, you: true };
  return [you].concat(settings.roster.map((p, i) => ({ index: i, n: i + 2, name: p.name, avatar: p.avatar, color: p.color, playing: p.playing, you: false })));
}

export const displayName = (p) => (p.you ? p.name : p.name || `Player ${p.n}`);
export const playingCount = (settings) => listPlayers(settings).filter((p) => p.playing).length;

// The colour keys that other players who are playing already have (so a player cannot take them).
export function takenColors(settings, exceptIndex) {
  return listPlayers(settings).filter((p) => p.playing && p.index !== exceptIndex).map((p) => p.color);
}

// A game takes at most `max` players: uncheck from the bottom of the list until it fits.
export function enforceMax(settings, max) {
  let changed = false;
  for (let k = settings.roster.length - 1; k >= 0 && playingCount(settings) > max; k--) {
    if (settings.roster[k].playing) { settings.roster[k].playing = false; changed = true; }
  }
  if (playingCount(settings) > max && settings.youPlay !== false) { settings.youPlay = false; changed = true; }
  return changed;
}

// Colours only have to differ among the players who are playing: a player whose colour clashes gets the first free one.
export function fixColorClashes(settings) {
  let changed = false;
  const used = [];
  listPlayers(settings).filter((p) => p.playing).forEach((p) => {
    if (used.includes(p.color)) {
      const key = firstFreeColor(used.concat(listPlayers(settings).filter((q) => q.playing).map((q) => q.color)));
      if (p.you) settings.color = key; else settings.roster[p.index].color = key;
      used.push(key);
      changed = true;
    } else used.push(p.color);
  });
  return changed;
}

// The seats of a Pass & Play game: the players who are playing, in list order. An unnamed player is "Player N" (N = the place in the list).
export function seatsFor(settings) {
  return listPlayers(settings).filter((p) => p.playing).map((p) => ({
    name: displayName(p),
    isBot: false,
    avatar: personFace(p.avatar),
    me: false, // "Your turn" is only for a single human
    color: COLORS.find((c) => c.key === p.color).hex,
  }));
}
