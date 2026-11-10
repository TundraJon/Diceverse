import { GAMES, GAME_ORDER } from '../games/index.js';
import { VIEWS } from '../ui/views/index.js';
import { createSession, replaySession } from '../core/engine.js';
import { newSeed } from '../core/rng.js';
import { createScheduler } from '../core/scheduler.js';
import { decide, thinkMs, PRESETS } from '../ai/brain.js';
import { loadSave, writeSave, clearSave, loadSettings, writeSettings, loadBest, updateBest, storageAvailable } from './save.js';
import { createMoods } from './moods.js';
import { ROLL_MS, startThrow, beginDice } from '../ui/dice.js';
import { drawOpponents, AI_ROSTER } from '../ai/roster.js';
import { KINDS, TONES, COLORS, DEFAULT_AVATAR, PLAIN_FACE, personFace, cleanAvatar, cleanColor, seatColors, cleanName, isMe, faceFor } from '../ui/avatars.js';

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
  const s = Object.assign({ game: 'pig', mode: 'bots', players: 3, preset: 'balanced', house: {}, name: 'You', avatar: DEFAULT_AVATAR, color: 'blue' }, loadSettings() || {});
  s.name = cleanName(s.name); // empty means "You"
  s.avatar = cleanAvatar(s.avatar);
  s.color = cleanColor(s.color);
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

// Bot moods and polite talk (cosmetic; see moods.js). Seats come from the options the game was started with, which
// keep the avatar, the "me" flag and the roster id that the game rules do not need.
const moods = createMoods({
  sched,
  rand: () => newSeed()[0],
  redraw: () => { if (session && view && ui.table) render(false); },
  announce: (t) => announce(t),
  seatsOf: () => (session ? session.options.seats || [] : []),
});
// Put the shell-owned cosmetic data (face, "me", what a bot says or thinks) onto the view before it draws.
function decorate() {
  if (!session || !view || !view.seats) return;
  const opts = session.options.seats || [];
  view.seats.forEach((s, i) => {
    s.me = isMe(opts[i]);
    s.face = moods.faceOf(i);
    s.color = opts[i] && opts[i].color; // older saves have none: the view falls back to its fixed colors
  });
  view.thinking = moods.getThinking();
}

// A bot's line shows in a speech bubble directly under that bot's own chip (it may cover what is below for a moment).
function placeBubble() {
  const screen = ui.table && ui.table.closest('.screen');
  if (!screen) return;
  if (!ui.bubble) {
    ui.bubble = el('div', 'talkbubble');
    ui.bubble.setAttribute('aria-hidden', 'true'); // the line is announced separately
    ui.bubble.hidden = true;
    screen.appendChild(ui.bubble);
  }
  const talk = moods.getTalk();
  const chip = talk ? screen.querySelectorAll('.cchip, .scores .chip')[talk.seat] : null;
  if (!chip) { ui.bubble.hidden = true; return; }
  ui.bubble.hidden = false;
  ui.bubble.textContent = `${moods.faceOf(talk.seat)} \u201c${talk.line}\u201d`;
  const sr = screen.getBoundingClientRect();
  const cr = chip.getBoundingClientRect();
  ui.bubble.style.maxWidth = `${Math.min(300, sr.width - 8)}px`;
  const bw = ui.bubble.offsetWidth;
  const left = Math.min(Math.max(cr.left - sr.left, 4), sr.width - bw - 4);
  ui.bubble.style.left = `${left}px`;
  ui.bubble.style.top = `${cr.bottom - sr.top + 8}px`;
  ui.bubble.style.setProperty('--ptr', `${Math.min(Math.max(cr.left + cr.width / 2 - sr.left - left, 14), bw - 14)}px`);
}

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
  const you = { name: settings.name, isBot: false, avatar: personFace(settings.avatar) };
  let seats;
  if (settings.mode === 'solo') {
    seats = [{ ...you, me: true }];
    (mod.meta.soloHide || []).forEach((k) => { house[k] = false; });
  } else if (settings.mode === 'pass') {
    // player 1 is the profile; players 2 to 4 keep the plain face. "Your turn" is only for a single human.
    seats = Array.from({ length: settings.players }, (_, i) => (i === 0 ? { ...you, me: false } : { name: `Player ${i + 1}`, isBot: false, avatar: PLAIN_FACE, me: false }));
  } else {
    // vs Bots: opponents are drawn at random from the roster (cosmetic: names, faces and lines only)
    const ids = drawOpponents(settings.players - 1, [...newSeed(), ...newSeed()]);
    seats = [{ ...you, me: true }].concat(ids.map((id) => ({ name: AI_ROSTER[id].name, isBot: true, preset: settings.preset, botId: id, avatar: AI_ROSTER[id].defaultEmoji })));
  }
  seatColors(seats.length, settings.color).forEach((hex, i) => { seats[i].color = hex; }); // yours first, the rest in palette order
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
  const gear = el('button', 'gear', '\u2699\uFE0F');
  gear.setAttribute('aria-label', 'Settings');
  gear.addEventListener('click', openSettings);
  screen.appendChild(gear);
  const hero = el('div', 'hero');
  hero.append(el('div', 'logo', '🎲'), el('h1', null, 'DICEVERSE'), el('p', null, 'dice companion'));
  screen.appendChild(hero);

  GAME_ORDER.forEach((id) => {
    if (!loadSave(id)) return;
    const resumeRow = el('div', 'resumerow');
    const resume = el('button', 'primary', `Resume ${GAMES[id].meta.name}`);
    resume.addEventListener('click', () => resumeGame(id));
    const trash = el('button', 'trash', '\u{1F5D1}\uFE0F');
    trash.setAttribute('aria-label', `Delete saved ${GAMES[id].meta.name} game`);
    trash.addEventListener('click', () => confirmDelete([id], renderMenu));
    resumeRow.append(resume, trash);
    screen.appendChild(resumeRow);
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
  // Players: a row inside the Mode panel; hidden in Solo.
  if (settings.mode !== 'solo') {
    const prow = el('div', 'row sub');
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
    modePanel.appendChild(prow); // the Players row sits inside the Mode panel to save a panel's height
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
  const btnrow = el('div', 'btnrow'); // House rules and How to play share a row
  btnrow.append(hr, rules);
  screen.append(btnrow, start);
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
  if (first) first.focus({ preventScroll: true }); // focusing a button at the bottom of a long sheet must not scroll it
  sheet.scrollTop = 0;
}

function openRules(options) {
  openSheet((sheet, close) => {
    G.view.rulesSheet(sheet, options);
    const ok = el('button', 'primary', 'Got it');
    ok.addEventListener('click', close);
    sheet.appendChild(ok);
  });
}

// Ask before deleting saved games (one game, or all of them). "Keep it" comes first so it has the focus.
function confirmDelete(ids, after) {
  const found = ids.map((id) => ({ id, save: loadSave(id) })).filter((x) => x.save);
  if (!found.length) return;
  const one = found.length === 1;
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, one ? 'Delete saved game?' : 'Delete all saved games?'));
    if (one) {
      const { id, save } = found[0];
      const seats = (save.options && save.options.seats) || [];
      const who = seats.length <= 1 ? 'Solo' : `${seats.length} players`;
      const moves = save.log.length;
      sheet.appendChild(el('p', null, `Your unfinished ${GAMES[id].meta.name} game (${who}, ${moves} move${moves === 1 ? '' : 's'} played) will be deleted. This can't be undone.`));
    } else {
      sheet.appendChild(el('p', null, `All ${found.length} unfinished games will be deleted. This can't be undone.`));
    }
    const row = el('div', 'confirmrow');
    const keep = el('button', 'secondary', one ? 'Keep it' : 'Keep them');
    const del = el('button', 'danger', one ? 'Delete' : 'Delete all');
    keep.addEventListener('click', close);
    del.addEventListener('click', () => { found.forEach((x) => clearSave(x.id)); close(); if (after) after(); });
    row.append(keep, del);
    sheet.appendChild(row);
    sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  });
}

// Settings: your name, your avatar and your color. The avatar and the color are two small dropdown buttons; each opens a
// panel under the row with every choice visible at once.
function openSettings() {
  openSheet((sheet, close) => {
    sheet.classList.add('settings'); // lets a dropdown panel float over the lower part of the sheet
    sheet.appendChild(el('h2', null, 'Settings'));

    const nameRow = el('div', 'setrow');
    const label = el('label', null, 'Name:');
    label.htmlFor = 'setname';
    const input = el('input', 'namefield');
    input.id = 'setname';
    input.type = 'text';
    input.maxLength = 12;
    input.value = settings.name === 'You' ? '' : settings.name;
    input.placeholder = 'You'; // the faded suggestion: gone as soon as a letter is typed
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'words');
    nameRow.append(label, input);
    sheet.appendChild(nameRow);

    const row = el('div', 'ddrow');
    const avBtn = el('button', 'ddbtn');
    const colBtn = el('button', 'ddbtn');
    avBtn.setAttribute('aria-label', 'Avatar');
    colBtn.setAttribute('aria-label', 'Color');
    const avVal = el('span', 'ddv');
    const swVal = el('i', 'sw');
    avBtn.append(avVal, el('span', 'ddc', '\u25BE'));
    colBtn.append(swVal, el('span', 'ddc', '\u25BE'));
    const avPanel = el('div', 'ddpanel avgrid');
    const colPanel = el('div', 'ddpanel clgrid');
    avPanel.hidden = true;
    colPanel.hidden = true;
    const avButtons = [];
    KINDS.forEach((k) => TONES.forEach((tone, t) => {
      const b = el('button', 'avbtn', personFace({ kind: k.key, tone: t }));
      b.setAttribute('aria-label', `${k.label}, ${t === 0 ? 'default tone' : `skin tone ${t}`}`);
      b.addEventListener('click', () => { settings.avatar = { kind: k.key, tone: t }; persistSettings(); refresh(); closePanels(); });
      avButtons.push([b, k.key, t]);
      avPanel.appendChild(b);
    }));
    const colButtons = [];
    COLORS.forEach((c) => {
      const b = el('button', 'swbtn');
      const dot = el('i');
      dot.style.background = c.hex;
      b.appendChild(dot);
      b.setAttribute('aria-label', c.label);
      b.addEventListener('click', () => { settings.color = c.key; persistSettings(); refresh(); closePanels(); });
      colButtons.push([b, c.key]);
      colPanel.appendChild(b);
    });
    row.append(avBtn, colBtn, avPanel, colPanel);
    sheet.appendChild(row);

    const closePanels = () => {
      avPanel.hidden = true; colPanel.hidden = true;
      avBtn.setAttribute('aria-expanded', 'false'); colBtn.setAttribute('aria-expanded', 'false');
    };
    const toggle = (panel, btn, other) => {
      const willOpen = panel.hidden;
      closePanels();
      if (willOpen) { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
      void other;
    };
    avBtn.addEventListener('click', () => toggle(avPanel, avBtn, colPanel));
    colBtn.addEventListener('click', () => toggle(colPanel, colBtn, avPanel));
    // a tap outside the open panel (or its button) and Escape close it
    sheet.addEventListener('click', (e) => {
      if ([avBtn, colBtn, avPanel, colPanel].some((n) => n.contains(e.target))) return;
      closePanels();
    });
    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (!avPanel.hidden || !colPanel.hidden)) { e.stopPropagation(); closePanels(); }
    });

    const refresh = () => {
      avVal.textContent = personFace(settings.avatar);
      swVal.style.background = COLORS.find((c) => c.key === settings.color).hex;
      avButtons.forEach(([b, kind, t]) => b.setAttribute('aria-pressed', String(settings.avatar.kind === kind && settings.avatar.tone === t)));
      colButtons.forEach(([b, key]) => b.setAttribute('aria-pressed', String(settings.color === key)));
    };
    const save = () => { settings.name = cleanName(input.value); input.value = settings.name === 'You' ? '' : settings.name; persistSettings(); };
    input.addEventListener('change', save);
    const clearAll = el('button', 'secondary clearall');
    const refreshClear = () => {
      const n = GAME_ORDER.filter((id) => loadSave(id)).length;
      clearAll.disabled = n === 0;
      clearAll.textContent = n ? `Clear all saved games (${n})` : 'No saved games';
    };
    clearAll.addEventListener('click', () => confirmDelete(GAME_ORDER, () => { refreshClear(); renderMenu(); }));
    sheet.appendChild(clearAll);
    refreshClear();
    const ok = el('button', 'primary', 'Done');
    ok.addEventListener('click', () => { save(); close(); });
    sheet.appendChild(ok);
    closePanels();
    refresh();
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
  const seed = newSeed(); // the game seed is drawn first, then the opponents (so a pinned test seed still works)
  session = createSession(G.mod, options || buildOptions(), seed);
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
  moods.reset();
  view = G.view.init(session);
  decorate();
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

let throwFrom = -1e9; // when the current dice throw began
function render(tumble) {
  decorate();
  const c = ctx();
  const now = performance.now();
  if (tumble) { throwFrom = now; startThrow(now); }
  c.tumble = tumble || now - throwFrom < ROLL_MS; // a re-render in the middle of a throw carries the throw on
  beginDice();
  G.view.render(ui, view, session, c);
  placeBubble();
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
      decorate();
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
  const { delay, tumble, after } = G.view.reduce(view, events[i], c);
  moods.onEvent(events[i], G.id, view);
  render(tumble);
  // `after` is a screen-reader announcement that must not be spoken before the dice have settled
  sched.after(delay, () => { if (after) announce(after); present(events, i + 1, done); });
}

/* ---------- after events: bot turn or game over ---------- */
function afterEvents() {
  if (session.isOver()) { showGameOver(); return; }
  const st = session.state;
  const cur = st.seats[st.current];
  if (!cur.isBot) { render(false); return; }
  busy = true;
  moods.startThinking(st.current);
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
  const optSeats = session.options.seats || [];
  const names = winners.map((i) => st.seats[i].name);
  const winText = winners.length > 1 ? `It's a tie: ${names.join(' and ')}` : `${names[0]} ${isMe(optSeats[winners[0]]) ? 'win' : 'wins'}`;
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
      const at = r.seat !== undefined ? r.seat : st.seats.findIndex((x) => x.name === r.name);
      row.append(el('span', null, `${faceFor(optSeats[at], 'DEFAULT')} ${r.name}`), el('span', null, `${r.total.toLocaleString('en-US')} · ${r.turns} turns`));
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
