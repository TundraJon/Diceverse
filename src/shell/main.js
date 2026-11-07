import { GAMES, GAME_ORDER } from '../games/index.js';
import { VIEWS } from '../ui/views/index.js';
import { createSession, replaySession } from '../core/engine.js';
import { newSeed } from '../core/rng.js';
import { createScheduler } from '../core/scheduler.js';
import { decide, thinkMs, PRESETS } from '../ai/brain.js';
import { loadSave, writeSave, clearSave, loadSettings, writeSettings, loadBest, updateBest, storageAvailable } from './save.js';

const BOT_NAMES = ['Pip', 'Dottie', 'Rook', 'Mabel', 'Juno', 'Fitch'];
const app = document.getElementById('app');
const live = document.getElementById('live');
// Hidden test speed: ?speed=N (0 to 1, default 1) scales every presentation delay. Rules and bot decisions are unaffected.
function readSpeed() {
  try {
    const raw = new URLSearchParams(window.location.search).get('speed');
    if (raw === null || raw.trim() === '') return 1;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 1;
  } catch { return 1; }
}
const speed = readSpeed();
if (speed === 0) document.body.classList.add('fast');
const sched = createScheduler({ scale: speed });
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- settings (per-game house rules; migrates the old Pig-only layout) ---------- */
function loadAllSettings() {
  const s = Object.assign({ game: 'pig', mode: 'bots', players: 3, preset: 'balanced', house: {} }, loadSettings() || {});
  if (s.house && 'target' in s.house && !s.house.pig) s.house = { pig: s.house }; // old flat layout was Pig's
  if (!GAMES[s.game]) s.game = 'pig';
  GAME_ORDER.forEach((id) => {
    s.house[id] = Object.assign(GAMES[id].defaultOptions(), s.house[id] || {});
    if (GAMES[id].normalizeOptions) s.house[id] = GAMES[id].normalizeOptions(s.house[id]); // e.g. Digits needs the 9-tile board
  });
  return s;
}
let settings = loadAllSettings();
const persistSettings = () => writeSettings(settings);

let G = null; // active game: { id, mod, view }
let session = null;
let busy = false;
let ui = {};
let view = null;
let storageWarned = false;

const useGame = (id) => { G = { id, mod: GAMES[id], view: VIEWS[id] }; };

function announce(text) { live.textContent = ''; setTimeout(() => (live.textContent = text), 20); }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* ---------- options / seats ---------- */
function buildOptions() {
  const mod = GAMES[settings.game];
  const house = { ...settings.house[settings.game] };
  let seats;
  if (settings.mode === 'solo') {
    seats = [{ name: 'You', isBot: false }];
    (mod.meta.soloHide || []).forEach((k) => { house[k] = false; });
  } else if (settings.mode === 'pass') {
    seats = Array.from({ length: settings.players }, (_, i) => ({ name: `Player ${i + 1}`, isBot: false }));
  } else {
    seats = [{ name: 'You', isBot: false }].concat(
      Array.from({ length: settings.players - 1 }, (_, i) => ({ name: BOT_NAMES[i], isBot: true, preset: settings.preset }))
    );
  }
  return mod.normalizeOptions ? { ...mod.normalizeOptions(house), seats } : { ...house, seats };
}

/* ---------- menu ---------- */
function goMenu() {
  sched.cancelAll();
  busy = false;
  session = null;
  renderMenu();
}

function renderMenu() {
  app.innerHTML = '';
  const gameId = settings.game;
  const mod = GAMES[gameId];
  const gview = VIEWS[gameId];
  const screen = el('section', 'screen');
  const hero = el('div', 'hero');
  hero.append(el('div', 'logo', '🎲'), el('h1', null, 'DICEVERSE'), el('p', null, 'dice companion'));
  screen.appendChild(hero);

  GAME_ORDER.forEach((id) => {
    if (!loadSave(id)) return;
    const resume = el('button', 'primary', `Resume ${GAMES[id].meta.name}`);
    resume.addEventListener('click', () => resumeGame(id));
    screen.appendChild(resume);
  });

  const gamePanel = el('div', 'panel');
  gamePanel.appendChild(el('h2', null, 'Game'));
  const gseg = el('div', 'seg games'); // wraps onto a second row when there are many games
  GAME_ORDER.forEach((id) => {
    const b = el('button', null, GAMES[id].meta.name);
    b.setAttribute('aria-pressed', String(settings.game === id));
    b.addEventListener('click', () => { settings.game = id; persistSettings(); renderMenu(); });
    gseg.appendChild(b);
  });
  gamePanel.appendChild(gseg);
  screen.appendChild(gamePanel);

  // Mode, with Bot style directly under it (only for vs Bots)
  const modePanel = el('div', 'panel');
  modePanel.appendChild(el('h2', null, 'Mode'));
  const seg = el('div', 'seg');
  [['bots', 'vs Bots'], ['pass', 'Pass & Play'], ['solo', 'Solo']].forEach(([key, label]) => {
    const b = el('button', null, label);
    b.setAttribute('aria-pressed', String(settings.mode === key));
    b.addEventListener('click', () => { settings.mode = key; persistSettings(); renderMenu(); });
    seg.appendChild(b);
  });
  modePanel.appendChild(seg);
  if (settings.mode === 'bots') {
    const row = el('div', 'row sub');
    row.appendChild(el('label', null, 'Bot style'));
    const sel = el('select');
    sel.setAttribute('aria-label', 'Bot style');
    Object.entries(PRESETS).forEach(([k, v]) => {
      const o = el('option', null, v.label);
      o.value = k;
      if (settings.preset === k) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { settings.preset = sel.value; persistSettings(); });
    row.appendChild(sel);
    modePanel.appendChild(row);
  }
  screen.appendChild(modePanel);

  // Players: last panel; hidden in Solo (nothing sits below it, so no row jumps).
  if (settings.mode !== 'solo') {
    const pp = el('div', 'panel');
    const prow = el('div', 'row');
    prow.appendChild(el('span', null, 'Players'));
    const st = el('div', 'stepper');
    const minus = el('button', null, '−');
    minus.setAttribute('aria-label', 'Fewer players');
    const count = el('span', null, String(settings.players));
    const plus = el('button', null, '+');
    plus.setAttribute('aria-label', 'More players');
    minus.disabled = settings.players <= 2;
    plus.disabled = settings.players >= 4;
    minus.addEventListener('click', () => { settings.players--; persistSettings(); renderMenu(); });
    plus.addEventListener('click', () => { settings.players++; persistSettings(); renderMenu(); });
    st.append(minus, count, plus);
    prow.appendChild(st);
    pp.appendChild(prow);
    screen.appendChild(pp);
  }

  const h = settings.house[gameId];
  const summary = el('p', 'note');
  summary.textContent = gview.summary(h, settings.mode);
  const best = settings.mode === 'solo' ? loadBest(gameId, mod.meta.soloKey(h)) : null;
  if (best !== null) summary.textContent += ` · your best: ${(mod.meta.soloLabel || ((v) => `${v} turns`))(best)}`;
  screen.appendChild(summary);

  const hr = el('button', 'secondary', 'House rules');
  hr.addEventListener('click', openHouseRules);
  const rules = el('button', 'secondary', 'How to play');
  rules.addEventListener('click', () => { useGame(gameId); openRules(settings.house[gameId]); });
  const start = el('button', 'primary', 'Start');
  start.addEventListener('click', () => startNew());
  screen.append(hr, rules, start);
  app.appendChild(screen);
}

function openSheet(build) {
  const back = el('div', 'sheet-back');
  const sheet = el('div', 'sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  const close = () => back.remove();
  build(sheet, close);
  back.appendChild(sheet);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.body.appendChild(back);
  const first = sheet.querySelector('button');
  if (first) first.focus();
}

function openRules(options) {
  openSheet((sheet, close) => {
    G.view.rulesSheet(sheet, options);
    const ok = el('button', 'primary', 'Got it');
    ok.addEventListener('click', close);
    sheet.appendChild(ok);
  });
}

function openHouseRules() {
  const gameId = settings.game;
  const mod = GAMES[gameId];
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, `${mod.meta.name} house rules`));
    const refreshers = [];
    const refreshAll = () => refreshers.forEach((f) => f());
    mod.meta.houseRules.forEach((rule) => {
      if ((mod.meta.soloHide || []).includes(rule.key) && settings.mode === 'solo') return;
      const wrap = el('div', 'panel');
      wrap.appendChild(el('h2', null, rule.label));
      const seg = el('div', 'seg');
      const buttons = rule.options.map((opt) => {
        const b = el('button', null, opt.label);
        b.addEventListener('click', () => {
          if (b.disabled) return;
          settings.house[gameId][rule.key] = opt.value;
          // a choice can make another one invalid (e.g. Digits on a bigger board): let the game fix it
          if (mod.normalizeOptions) settings.house[gameId] = mod.normalizeOptions(settings.house[gameId]);
          persistSettings();
          refreshAll();
        });
        seg.appendChild(b);
        return b;
      });
      wrap.appendChild(seg);
      if (rule.hint) wrap.appendChild(el('p', 'note', rule.hint()));
      const note = rule.options.some((o) => o.disabled) ? el('p', 'note') : null;
      if (note) wrap.appendChild(note);
      sheet.appendChild(wrap);
      refreshers.push(() => {
        const cur = settings.house[gameId];
        rule.options.forEach((opt, i) => {
          buttons[i].setAttribute('aria-pressed', String(cur[rule.key] === opt.value));
          buttons[i].disabled = !!(opt.disabled && opt.disabled(cur));
        });
        if (note) {
          const d = rule.options.find((o) => o.disabled && o.disabled(cur));
          note.textContent = d ? d.disabledNote || '' : '';
          note.hidden = !d;
        }
      });
    });
    refreshAll();
    const ok = el('button', 'primary', 'Done');
    ok.addEventListener('click', () => { close(); renderMenu(); });
    sheet.appendChild(ok);
  });
}

/* ---------- game lifecycle ---------- */
function startNew(options) {
  sched.cancelAll();
  busy = false;
  if (!options) useGame(settings.game);
  session = createSession(G.mod, options || buildOptions(), newSeed());
  persistSession();
  enterGame();
}

function resumeGame(id) {
  sched.cancelAll();
  useGame(id);
  const restored = replaySession(G.mod, loadSave(id));
  if (!restored) { clearSave(id); renderMenu(); return; }
  session = restored;
  enterGame();
}

function persistSession() {
  if (!session) return;
  if (session.isOver()) { clearSave(G.id); return; }
  const ok = writeSave(G.id, session.save());
  if (!ok && !storageWarned) { storageWarned = true; addLog('Progress cannot be saved on this device.'); }
}

function enterGame() {
  view = G.view.init(session);
  app.innerHTML = '';
  const screen = el('section', 'screen');

  const bar = el('header', 'bar');
  bar.appendChild(el('h1', null, G.view.title));
  const right = el('div');
  right.style.display = 'flex'; right.style.gap = '8px';
  const rulesBtn = el('button', 'icon-btn', '?');
  rulesBtn.setAttribute('aria-label', 'Rules');
  rulesBtn.addEventListener('click', () => openRules(session.options));
  const menuBtn = el('button', 'icon-btn', 'Menu');
  menuBtn.addEventListener('click', goMenu);
  right.append(rulesBtn, menuBtn);
  bar.appendChild(right);

  ui = {};
  ui.scores = el('div');
  ui.table = el('div', 'table');
  G.view.build(ui);
  ui.controls = el('div', 'controls');
  ui.log = el('div', 'log');
  screen.append(bar, ui.scores, ui.table, ...(ui.after ? [ui.after] : []), ui.controls, ui.log);
  app.appendChild(screen);

  if (!storageAvailable() && !storageWarned) { storageWarned = true; addLog('Progress cannot be saved on this device.'); }
  render(false);
  afterEvents();
}

const ctx = () => ({
  busy,
  tumble: false,
  reduced: reduced(),
  act: humanAct,
  log: addLog,
  announce,
  vibrate: () => { if (navigator.vibrate) { try { navigator.vibrate(150); } catch { /* ignore */ } } },
});

function render(tumble) {
  const c = ctx();
  c.tumble = tumble;
  G.view.render(ui, view, session, c);
}

function addLog(text) {
  if (!ui.log) return;
  ui.log.appendChild(el('div', null, text));
  while (ui.log.children.length > 3) ui.log.removeChild(ui.log.firstChild);
}

function humanAct(actions) {
  if (busy || !session || session.isOver()) return;
  const cur = session.state.seats[session.state.current];
  if (cur.isBot) return;
  doActions(actions, 0);
}

// Dispatch actions[i], show its events, then continue with the next action (e.g. SET_ASIDE then ROLL).
function doActions(actions, i) {
  busy = true;
  const events = session.dispatch(actions[i]);
  persistSession();
  render(false);
  present(events, 0, () => {
    if (i + 1 < actions.length && !session.isOver()) {
      sched.after(reduced() ? 100 : 250, () => doActions(actions, i + 1));
    } else {
      view = G.view.sync(view, session);
      busy = false;
      render(false);
      afterEvents();
    }
  });
}

/* ---------- presenting events ---------- */
function present(events, i, done) {
  if (i >= events.length) { done(); return; }
  const c = ctx();
  const { delay, tumble } = G.view.reduce(view, events[i], c);
  render(tumble);
  sched.after(delay, () => present(events, i + 1, done));
}

/* ---------- after events: bot turn or game over ---------- */
function afterEvents() {
  if (session.isOver()) { showGameOver(); return; }
  const st = session.state;
  const cur = st.seats[st.current];
  if (!cur.isBot) { render(false); return; }
  busy = true;
  render(false);
  const seat = st.current;
  const obs = session.observe(seat);
  // Numeric bot seed: first word of an array seed (or the legacy number), mixed with progress and seat.
  const base = Array.isArray(session.seed) ? session.seed[0] : session.seed;
  const seed = (base ^ (session.log.length * 7919) ^ (seat * 104729)) >>> 0;
  const d = decide(G.mod, obs, seat, cur.preset, seed);
  const closeness = d.margin === null ? 0.3 : 1 - Math.min(1, Math.abs(d.margin) / 5);
  sched.after(reduced() ? 300 : thinkMs(closeness), () => doActions(d.actions, 0));
}

function showGameOver() {
  const res = session.result();
  const st = session.state;
  const solo = st.seats.length === 1;
  persistSession();
  const meta = G.mod.meta;
  const soloKey = meta.soloKey(st.options);
  const value = (meta.soloValue || ((r) => r.soloTurns))(res);
  const soloTitle = (meta.soloTitle || ((v) => `Done in ${v} turns`))(value);
  const soloLabel = meta.soloLabel || ((v) => `${v} turns`);
  let newBest = false;
  if (solo) newBest = updateBest(G.id, soloKey, value, meta.soloBest || 'low');
  const winners = res.winners || (res.winner !== null && res.winner !== undefined ? [res.winner] : []);
  const names = winners.map((i) => st.seats[i].name);
  const winText = winners.length > 1 ? `It's a tie: ${names.join(' and ')}` : `${names[0]} ${names[0] === 'You' ? 'win' : 'wins'}`;
  announce(solo ? soloTitle : winText);
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, solo ? soloTitle : winners.length > 1 ? `\u{1F91D} ${winText}` : `\u{1F3C6} ${winText}!`));
    if (solo) {
      const best = loadBest(G.id, soloKey);
      sheet.appendChild(el('p', null, newBest ? 'New personal best!' : best !== null ? `Your best: ${soloLabel(best)}` : ''));
    }
    const list = el('div', 'results');
    res.standings.forEach((r) => {
      const row = el('div', 'r');
      row.append(el('span', null, r.name), el('span', null, `${r.total.toLocaleString('en-US')} · ${r.turns} turns`));
      list.appendChild(row);
    });
    sheet.appendChild(list);
    const again = el('button', 'primary', 'Play again');
    again.addEventListener('click', () => { close(); startNew(session.options); });
    const menu = el('button', 'secondary', 'Menu');
    menu.addEventListener('click', () => { close(); session = null; renderMenu(); });
    sheet.append(again, menu);
  });
}

renderMenu();
