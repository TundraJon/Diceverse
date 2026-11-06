// localStorage helpers. Every access is wrapped: storage may be missing or blocked.
const SAVE_KEY = 'diceverse:pig:save';
const SETTINGS_KEY = 'diceverse:settings';
let storageOk = true;

function read(key) {
  try { return window.localStorage.getItem(key); } catch { storageOk = false; return null; }
}
function write(key, value) {
  try { window.localStorage.setItem(key, value); return true; } catch { storageOk = false; return false; }
}
function remove(key) {
  try { window.localStorage.removeItem(key); } catch { storageOk = false; }
}

export const storageAvailable = () => {
  try { window.localStorage.setItem('diceverse:probe', '1'); window.localStorage.removeItem('diceverse:probe'); return true; }
  catch { return false; }
};

export function loadSave() {
  const raw = read(SAVE_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const v1 = v && v.version === 1 && typeof v.seed === 'number' && Number.isFinite(v.seed);
    const v2 = v && v.version === 2 && Array.isArray(v.seed) && v.seed.length === 4 && v.seed.every(Number.isInteger);
    if ((v1 || v2) && Array.isArray(v.log)) return v;
    remove(SAVE_KEY);
    return null;
  } catch { remove(SAVE_KEY); return null; }
}
export const writeSave = (saved) => write(SAVE_KEY, JSON.stringify(saved));
export const clearSave = () => remove(SAVE_KEY);

export function loadSettings() {
  const raw = read(SETTINGS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export const writeSettings = (s) => write(SETTINGS_KEY, JSON.stringify(s));

const bestKey = (o) => `diceverse:pig:best:${o.target}:${o.dice}`;
export function loadBest(o) {
  const n = Number(read(bestKey(o)));
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function updateBest(o, turns) {
  const prev = loadBest(o);
  if (prev === null || turns < prev) { write(bestKey(o), String(turns)); return true; }
  return false;
}
