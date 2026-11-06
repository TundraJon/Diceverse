// localStorage helpers. Every access is wrapped: storage may be missing or blocked.
const saveKey = (id) => `diceverse:${id}:save`;
const SETTINGS_KEY = 'diceverse:settings';

function read(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { window.localStorage.setItem(key, value); return true; } catch { return false; }
}
function remove(key) {
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

export const storageAvailable = () => {
  try { window.localStorage.setItem('diceverse:probe', '1'); window.localStorage.removeItem('diceverse:probe'); return true; }
  catch { return false; }
};

export function loadSave(id) {
  const raw = read(saveKey(id));
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const v1 = v && v.version === 1 && typeof v.seed === 'number' && Number.isFinite(v.seed);
    const v2 = v && v.version === 2 && Array.isArray(v.seed) && v.seed.length === 4 && v.seed.every(Number.isInteger);
    if ((v1 || v2) && Array.isArray(v.log)) return v;
    remove(saveKey(id));
    return null;
  } catch { remove(saveKey(id)); return null; }
}
export const writeSave = (id, saved) => write(saveKey(id), JSON.stringify(saved));
export const clearSave = (id) => remove(saveKey(id));

export function loadSettings() {
  const raw = read(SETTINGS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export const writeSettings = (s) => write(SETTINGS_KEY, JSON.stringify(s));

// Solo personal best per game and rule set (Pig keeps its original key format).
const bestKey = (id, soloKey) => `diceverse:${id}:best:${soloKey}`;
export function loadBest(id, soloKey) {
  const n = Number(read(bestKey(id, soloKey)));
  return Number.isFinite(n) && n > 0 ? n : null;
}
// dir 'low': fewer is better (turns); 'high': more is better (score).
export function updateBest(id, soloKey, value, dir = 'low') {
  const prev = loadBest(id, soloKey);
  if (prev === null || (dir === 'high' ? value > prev : value < prev)) { write(bestKey(id, soloKey), String(value)); return true; }
  return false;
}
