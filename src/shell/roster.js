// The stored players of Pass & Play (pure functions, no DOM). Player "you" is the Settings profile (name, avatar, colour; the checkbox is `youPlay`); up to eight
// more are kept in `settings.roster` between games and sessions, each with a stable `id`. `settings.order` is the seating order of all of them (the ids, and
// 'you'): the first player in it starts. A checked player takes part in the game.
import { COLORS, cleanAvatar, cleanColor, personFace, DEFAULT_AVATAR } from '../ui/avatars.js';

export const MAX_ROSTER = 8; // besides you: nine players in all
export const MIN_PLAYERS = 2; // a Pass & Play game needs at least two people
export const YOU = 'you';

// A typed name: single spaces, at most 12 characters; empty means "not named" (shown as "Player N").
export const cleanRosterName = (raw) => String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, 12).trim();

// The first colour key that is not in `used`.
export function firstFreeColor(used) {
  const free = COLORS.find((c) => !used.includes(c.key));
  return (free || COLORS[0]).key;
}

// A new id for a stored player: p1, p2, ... never one that is already used.
export function nextId(roster) {
  const used = roster.map((p) => String(p.id));
  let k = 1;
  while (used.includes(`p${k}`)) k++;
  return `p${k}`;
}

// Make a saved roster valid. Nothing saved (undefined) gives the one starting slot (player two); an empty list is a real choice (everybody was deleted).
export function cleanRoster(roster, myColor) {
  if (!Array.isArray(roster)) return [{ id: 'p1', name: '', avatar: { ...DEFAULT_AVATAR }, color: firstFreeColor([cleanColor(myColor)]), playing: true }];
  const out = [];
  roster.slice(0, MAX_ROSTER).forEach((p) => {
    const id = p && typeof p.id === 'string' && /^p\d+$/.test(p.id) && !out.some((q) => q.id === p.id) ? p.id : nextId(out);
    out.push({
      id,
      name: cleanRosterName(p && p.name),
      avatar: cleanAvatar(p && p.avatar),
      color: cleanColor(p && p.color),
      playing: !!(p && p.playing),
    });
  });
  return out;
}

// The seating order: the ids of everybody, 'you' included, each once. Anything missing is added at the end, anything unknown is dropped.
export function cleanOrder(order, roster) {
  const valid = [YOU].concat(roster.map((p) => p.id));
  const out = [];
  (Array.isArray(order) ? order : []).forEach((id) => { if (valid.includes(id) && !out.includes(id)) out.push(id); });
  valid.forEach((id) => { if (!out.includes(id)) out.push(id); });
  return out;
}

// Everybody in seating order. `index` is -1 for you and the position in `settings.roster` for the others. `n` is the number in "Player N": it belongs to the
// stored player (2 for the first stored player) and does not change when the order does.
export function listPlayers(settings) {
  const byId = {};
  byId[YOU] = { id: YOU, index: -1, n: 1, name: settings.name, avatar: settings.avatar, color: settings.color, playing: settings.youPlay !== false, you: true };
  settings.roster.forEach((p, i) => { byId[p.id] = { id: p.id, index: i, n: i + 2, name: p.name, avatar: p.avatar, color: p.color, playing: p.playing, you: false }; });
  return cleanOrder(settings.order, settings.roster).map((id) => byId[id]);
}

export const displayName = (p) => (p.you ? p.name : p.name || `Player ${p.n}`);
export const playingCount = (settings) => listPlayers(settings).filter((p) => p.playing).length;

// The colour keys that other players who are playing already have (so a player cannot take them).
export function takenColors(settings, exceptId) {
  return listPlayers(settings).filter((p) => p.playing && p.id !== exceptId).map((p) => p.color);
}

// A game takes at most `max` players: uncheck from the bottom of the list until it fits.
export function enforceMax(settings, max) {
  let changed = false;
  const list = listPlayers(settings);
  for (let k = list.length - 1; k >= 0 && playingCount(settings) > max; k--) {
    const p = list[k];
    if (!p.playing) continue;
    if (p.you) settings.youPlay = false; else settings.roster[p.index].playing = false;
    changed = true;
  }
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

// Put the player `id` where it is dropped: just before `beforeId`, or at the end when `beforeId` is null.
export function moveBefore(settings, id, beforeId) {
  const order = cleanOrder(settings.order, settings.roster).filter((x) => x !== id);
  const at = beforeId === null || !order.includes(beforeId) ? order.length : order.indexOf(beforeId);
  order.splice(at, 0, id);
  settings.order = order;
}

// Turn the seating so that `id` is first (everybody keeps their place in the circle).
export function rotateToFirst(settings, id) {
  const order = cleanOrder(settings.order, settings.roster);
  const at = order.indexOf(id);
  if (at > 0) settings.order = order.slice(at).concat(order.slice(0, at));
}

// The seats of a Pass & Play game: the players who are playing, in seating order (the first one starts). An unnamed player is "Player N".
export function seatsFor(settings) {
  return listPlayers(settings).filter((p) => p.playing).map((p) => ({
    name: displayName(p),
    isBot: false,
    avatar: personFace(p.avatar),
    me: false, // "Your turn" is only for a single human
    color: COLORS.find((c) => c.key === p.color).hex,
  }));
}

// "Roll for first player": every player in `ids` gets a die (`roll()` gives 1 to 6); the highest wins, a tie is rolled again between the tied players.
// Returns the rounds, each an array of { id, value } for the players still in, and the winner. `roll` is a function so a test can supply the dice.
export function rollForFirst(ids, roll) {
  const rounds = [];
  let left = ids.slice();
  for (let guard = 0; guard < 50 && left.length > 1; guard++) {
    const r = left.map((id) => ({ id, value: roll() }));
    rounds.push(r);
    const best = Math.max(...r.map((x) => x.value));
    left = r.filter((x) => x.value === best).map((x) => x.id);
  }
  return { rounds, winner: left[0] };
}
