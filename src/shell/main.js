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
import { MAX_ROSTER, MIN_PLAYERS, cleanRoster, cleanOrder, cleanRosterName, listPlayers, displayName, playingCount, takenColors, enforceMax, fixColorClashes, firstFreeColor, nextId, moveBefore, rotateToFirst, rollForFirst, seatsFor } from './roster.js';
import { flatDieSvg } from '../ui/freighter-art.js';
import { AGES, STYLES, TONE_COLORS, looksFor, withTone, COLORS, DEFAULT_AVATAR, personFace, cleanAvatar, cleanColor, seatColors, cleanName, isMe, faceFor } from '../ui/avatars.js';

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
const TEXT_SIZES = [['normal', 'Normal'], ['large', 'Large'], ['larger', 'Larger']];
function loadAllSettings() {
  const s = Object.assign({ game: 'pig', mode: 'bots', players: 3, preset: 'balanced', house: {}, name: 'You', avatar: DEFAULT_AVATAR, color: 'blue', textSize: 'normal' }, loadSettings() || {});
  s.name = cleanName(s.name); // empty means "You"
  s.avatar = cleanAvatar(s.avatar);
  s.color = cleanColor(s.color);
  s.roster = cleanRoster(s.roster, s.color); // the stored Pass & Play players besides you
  s.youPlay = s.youPlay !== false; // whether you are one of the players in Pass & Play
  s.order = cleanOrder(s.order, s.roster); // the seating order of everybody (the first one starts)
  if (!TEXT_SIZES.some(([k]) => k === s.textSize)) s.textSize = 'normal';
  if (s.house && 'target' in s.house && !s.house.pig) s.house = { pig: s.house }; // old flat layout was Pig's
  if (!GAMES[s.game]) s.game = 'pig';
  GAME_ORDER.forEach((id) => {
    s.house[id] = Object.assign(GAMES[id].defaultOptions(), s.house[id] || {});
    if (GAMES[id].normalizeOptions) s.house[id] = GAMES[id].normalizeOptions(s.house[id]); // e.g. Digits needs the 9-tile board
  });
  return s;
}
let settings = loadAllSettings();
const applyTextSize = () => { document.documentElement.dataset.text = settings.textSize; }; // the CSS scales every rem size from this
applyTextSize();
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
    // the checked players of the stored roster, you first (each has their own name, face and colour); "Your turn" is only for a single human
    seats = seatsFor(settings);
  } else {
    // vs Bots: opponents are drawn at random from the roster (cosmetic: names, faces and lines only)
    const ids = drawOpponents(settings.players - 1, [...newSeed(), ...newSeed()]);
    seats = [{ ...you, me: true }].concat(ids.map((id) => ({ name: AI_ROSTER[id].name, isBot: true, preset: settings.preset, botId: id, avatar: AI_ROSTER[id].defaultEmoji })));
  }
  if (settings.mode !== 'pass') seatColors(seats.length, settings.color).forEach((hex, i) => { seats[i].color = hex; }); // yours first, the rest in palette order (Pass & Play players have their own)
  const first = settings.mode === 'pass' ? { first: 0 } : {}; // Pass & Play: the first player in the seating order starts (games that draw a starter honour this)
  return mod.normalizeOptions ? { ...mod.normalizeOptions(house), seats, ...first } : { ...house, seats, ...first };
}

/* ---------- menu ---------- */
function goMenu() {
  sched.cancelAll();
  busy = false;
  removePassCover();
  session = null;
  renderMenu();
}

function renderMenu() {
  app.innerHTML = '';
  const gameId = settings.game;
  const mod = GAMES[gameId];
  const gview = VIEWS[gameId];
  if (mod.meta.soloOK === false && settings.mode === 'solo') { settings.mode = 'bots'; persistSettings(); } // a game with no Solo falls back to vs Bots
  const screen = el('section', 'screen');
  const gear = el('button', 'gear', '\u2699\uFE0F');
  gear.setAttribute('aria-label', 'Settings');
  gear.addEventListener('click', openSettings);
  screen.appendChild(gear);
  const hero = el('div', 'hero');
  hero.append(el('div', 'logo', '🎲'), el('h1', null, 'DiceVerse'), el('p', null, 'dice companion'));
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
    if (settings.mode === 'solo' && GAMES[id].meta.soloOK === false) { // in Solo a game with no Solo mode stays in its place, grayed out
      b.disabled = true;
      b.setAttribute('aria-label', `${GAMES[id].meta.name}, no Solo mode`);
    }
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
    if (key === 'solo' && GAMES[gameId].meta.soloOK === false) { // the Solo button stays in its place, grayed out, for a game with no Solo mode
      b.disabled = true;
      b.setAttribute('aria-label', 'Solo, not available for this game');
    }
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
  // Pass & Play: the stored players (who plays, their name, avatar and colour) open up under the Mode buttons, where vs Bots has its Bot style line.
  if (settings.mode === 'pass') renderPlayersLine(modePanel);
  // Players: a row inside the Mode panel (vs Bots only; Pass & Play counts the checked players).
  if (settings.mode === 'bots') {
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
  const tooFew = settings.mode === 'pass' && playingCount(settings) < MIN_PLAYERS; // Pass & Play needs at least two people
  start.disabled = tooFew;
  if (tooFew) summary.textContent = 'Pick at least 2 players';
  start.addEventListener('click', () => startNew());
  const btnrow = el('div', 'btnrow'); // House rules and How to play share a row
  btnrow.append(hr, rules);
  screen.append(btnrow, start);
  app.appendChild(screen);
}

// ---- the stored players of Pass & Play ----
// A player as a pill: the colour swatch, the face and the name (the greyed "Player N" when unnamed). The same pill is used in the menu and in the list.
function playerPill(pl, extra) {
  const pill = el('span', 'pl' + (!pl.you && !pl.name ? ' ph' : '') + (extra ? ` ${extra}` : ''));
  const sw = el('i', 'swatch');
  sw.style.background = COLORS.find((c) => c.key === pl.color).hex;
  pill.append(sw, el('span', 'plface', personFace(pl.avatar)), el('span', 'plnm', displayName(pl)));
  return pill;
}

// The one line on the menu: who is playing (the same pills) and a button that opens the full-screen Players screen.
function renderPlayersLine(panel) {
  const max = GAMES[settings.game].meta.players.max;
  if (enforceMax(settings, max)) persistSettings(); // a game with fewer seats unchecks players from the bottom
  const box = el('div', 'plline');
  box.appendChild(el('div', 'avlab', 'Players'));
  const pills = el('div', 'plpills');
  const playing = listPlayers(settings).filter((p) => p.playing);
  if (playing.length) playing.forEach((p) => pills.appendChild(playerPill(p))); else pills.appendChild(el('span', 'plnone', 'Nobody is playing yet'));
  box.appendChild(pills);
  const choose = el('button', 'secondary plchoose', 'Choose players');
  choose.type = 'button';
  choose.addEventListener('click', openPlayersScreen);
  box.appendChild(choose);
  panel.appendChild(box);
}

function confirmDeletePlayer(name, onDelete) {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, `Delete ${name}?`));
    sheet.appendChild(el('p', null, 'This stored player will be removed. This can\'t be undone.'));
    const row = el('div', 'confirmrow');
    const keep = el('button', 'secondary', 'Cancel');
    const del = el('button', 'danger', 'Delete');
    keep.addEventListener('click', close);
    del.addEventListener('click', () => { close(); onDelete(); });
    row.append(keep, del);
    sheet.appendChild(row);
    sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  });
}

// The player block shared by Settings and the Pass & Play editor: Name, the avatar picker and "Favorite color:" with its dropdown. `getName` gives what the
// field shows ('' when the player has no name yet), `setName(raw)` stores it, `taken()` gives the colour keys the player cannot take. Returns { node, refresh }.
function buildPlayerBlock(o) {
  const node = el('div', 'plblock');
  const nameRow = el('div', 'setrow');
  const label = el('label', null, 'Name:');
  label.htmlFor = 'setname';
  const input = el('input', 'namefield');
  input.id = 'setname';
  input.type = 'text';
  input.maxLength = 12;
  input.value = o.getName();
  input.placeholder = o.placeholder; // the faded suggestion: gone as soon as a letter is typed
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'words');
  input.addEventListener('input', () => o.setName(input.value));
  input.addEventListener('change', () => { input.value = o.getName(); });
  nameRow.append(label, input);
  node.appendChild(nameRow);
  const avPicker = buildAvatarPicker(o.getAvatar, o.setAvatar);
  node.appendChild(avPicker.node);
  const colRow = el('div', 'setrow colorrow'); // a title to the left like "Name:"; the open panel spans the whole row
  const colLabel = el('label', null, 'Favorite color:');
  colLabel.htmlFor = 'setcolor';
  const row = el('div', 'ddrow one inrow');
  const colBtn = el('button', 'ddbtn');
  colBtn.id = 'setcolor';
  colBtn.type = 'button';
  colBtn.setAttribute('aria-label', 'Favorite color');
  const swVal = el('i', 'sw');
  colBtn.append(swVal, el('span', 'ddc', '▾'));
  const colPanel = el('div', 'ddpanel clgrid');
  colPanel.hidden = true;
  const colButtons = [];
  COLORS.forEach((c) => {
    const b = el('button', 'swbtn');
    b.type = 'button';
    const dot = el('i');
    dot.style.background = c.hex;
    b.appendChild(dot);
    b.setAttribute('aria-label', c.label);
    b.addEventListener('click', () => { o.setColor(c.key); refresh(); closePanel(); });
    colButtons.push([b, c.key]);
    colPanel.appendChild(b);
  });
  row.append(colBtn);
  colRow.append(colLabel, row, colPanel);
  node.appendChild(colRow);
  const closePanel = () => { colPanel.hidden = true; colBtn.setAttribute('aria-expanded', 'false'); };
  const refresh = () => {
    avPicker.refresh();
    swVal.style.background = COLORS.find((c) => c.key === o.getColor()).hex;
    const taken = o.taken();
    colButtons.forEach(([b, key]) => {
      b.setAttribute('aria-pressed', String(o.getColor() === key));
      b.disabled = taken.includes(key) && o.getColor() !== key; // a colour another playing player has is grayed out
    });
  };
  colBtn.addEventListener('click', () => {
    const willOpen = colPanel.hidden;
    refresh();
    closePanel();
    if (willOpen) { colPanel.hidden = false; colBtn.setAttribute('aria-expanded', 'true'); }
  });
  // a tap outside the open panel (or its button) and Escape close it
  const away = (e) => {
    if (!node.isConnected) { document.removeEventListener('click', away); return; }
    if (![colBtn, colPanel].some((n) => n.contains(e.target))) closePanel();
  };
  document.addEventListener('click', away);
  node.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !colPanel.hidden) { e.stopPropagation(); closePanel(); } });
  closePanel();
  refresh();
  return { node, refresh };
}

// The full-screen Players screen: who plays (a checkbox), the seating order (drag the handle), tap a pill to edit that player, a red X deletes, "Add player",
// and "Roll for first player".
function openPlayersScreen() {
  let sel = null; // the id of the player whose editor is open
  openSheet((sheet, close) => {
    sheet.classList.add('full');
    const head = el('div', 'plhead');
    const done = el('button', 'secondary small', 'Done');
    done.addEventListener('click', close);
    head.append(el('h2', null, 'Players'), done);
    sheet.appendChild(head);
    sheet.appendChild(el('div', 'avlab', 'Who plays · drag the handle to set the order'));
    const listBox = el('div', 'pllist');
    sheet.appendChild(listBox);
    const add = el('button', 'secondary pladd', '＋ Add player');
    add.type = 'button';
    const rollBtn = el('button', 'secondary plrollbtn', '\u{1F3B2} Roll for first player');
    rollBtn.type = 'button';
    const hint = el('p', 'note plhint');
    const rollBox = el('div', 'plroll');
    rollBox.hidden = true;
    sheet.append(add, rollBtn, hint, rollBox);

    const maxPlayers = () => GAMES[settings.game].meta.players.max;
    const render = () => {
      if (enforceMax(settings, maxPlayers())) persistSettings();
      const players = listPlayers(settings);
      const count = playingCount(settings);
      if (sel !== null && !players.some((p) => p.id === sel)) sel = null;
      listBox.innerHTML = '';
      players.forEach((pl, k) => {
        const row = el('div', 'plrow' + (sel === pl.id ? ' sel' : ''));
        row.dataset.id = pl.id;
        const grip = el('button', 'plgrip', '⠿');
        grip.type = 'button';
        grip.setAttribute('aria-label', `Move ${displayName(pl)} (drag, or use the up and down arrow keys)`);
        const chkWrap = el('label', 'rostchk');
        const chk = el('input');
        chk.type = 'checkbox';
        chk.checked = pl.playing;
        chk.disabled = !pl.playing && count >= maxPlayers(); // the game's maximum is reached
        chk.setAttribute('aria-label', `${displayName(pl)} plays`);
        chk.addEventListener('change', () => {
          if (pl.you) settings.youPlay = chk.checked; else settings.roster[pl.index].playing = chk.checked;
          if (chk.checked) fixColorClashes(settings);
          persistSettings();
          render();
        });
        chkWrap.appendChild(chk);
        const pillBtn = el('button', 'plpillbtn');
        pillBtn.type = 'button';
        pillBtn.setAttribute('aria-expanded', String(sel === pl.id));
        const pill = playerPill(pl, pl.playing ? '' : 'off');
        pillBtn.appendChild(pill);
        pillBtn.addEventListener('click', () => { sel = sel === pl.id ? null : pl.id; render(); });
        row.append(grip, chkWrap, pillBtn);
        if (!pl.you) {
          const del = el('button', 'rostdel', '✕');
          del.type = 'button';
          del.setAttribute('aria-label', `Delete ${displayName(pl)}`);
          del.addEventListener('click', () => confirmDeletePlayer(displayName(pl), () => {
            settings.roster.splice(pl.index, 1);
            settings.order = cleanOrder(settings.order, settings.roster);
            if (sel === pl.id) sel = null;
            persistSettings();
            render();
          }));
          row.appendChild(del);
        }
        // dragging the handle (and the arrow keys) set the seating order
        grip.addEventListener('keydown', (e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const ids = listPlayers(settings).map((p) => p.id);
          const at = ids.indexOf(pl.id);
          const to = e.key === 'ArrowUp' ? at - 1 : at + 1;
          if (to < 0 || to >= ids.length) return;
          moveBefore(settings, pl.id, e.key === 'ArrowUp' ? ids[to] : ids[to + 1] || null);
          persistSettings();
          render();
          listBox.querySelector(`[data-id="${pl.id}"] .plgrip`).focus();
        });
        grip.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          grip.setPointerCapture(e.pointerId);
          listBox.querySelectorAll('.pled').forEach((x) => x.remove()); // close the editor while dragging
          row.classList.add('drag');
          // The rows are not moved in the page while dragging (that would drop the pointer capture): the dragged row follows the finger and the rows it passes
          // slide one place; the order is set once, when the finger lifts.
          const all = [...listBox.querySelectorAll('.plrow')];
          const from = all.indexOf(row);
          const step = all.length > 1 ? all[1].getBoundingClientRect().top - all[0].getBoundingClientRect().top : row.offsetHeight;
          const startY = e.clientY;
          let to = from;
          const move = (ev) => {
            const dy = ev.clientY - startY;
            row.style.transform = `translateY(${dy}px)`;
            to = Math.max(0, Math.min(all.length - 1, Math.round(from + dy / step)));
            all.forEach((r, k) => {
              if (r === row) return;
              r.style.transform = k > from && k <= to ? `translateY(${-step}px)` : k < from && k >= to ? `translateY(${step}px)` : '';
            });
          };
          const up = () => {
            grip.removeEventListener('pointermove', move);
            grip.removeEventListener('pointerup', up);
            grip.removeEventListener('pointercancel', up);
            const ids = all.map((r) => r.dataset.id);
            ids.splice(to, 0, ids.splice(from, 1)[0]);
            settings.order = ids;
            persistSettings();
            sel = null;
            render();
          };
          grip.addEventListener('pointermove', move);
          grip.addEventListener('pointerup', up);
          grip.addEventListener('pointercancel', up);
        });
        listBox.appendChild(row);
        if (sel === pl.id) {
          const ed = el('div', 'pled');
          const block = buildPlayerBlock({
            getName: () => (pl.you ? (settings.name === 'You' ? '' : settings.name) : settings.roster[pl.index].name),
            setName: (raw) => {
              if (pl.you) settings.name = cleanName(raw); else settings.roster[pl.index].name = cleanRosterName(raw);
              persistSettings();
              const shown = pl.you ? settings.name : settings.roster[pl.index].name;
              const nm = row.querySelector('.plnm');
              nm.textContent = shown || `Player ${pl.n}`;
              nm.parentElement.classList.toggle('ph', !pl.you && !shown);
            },
            placeholder: pl.you ? 'You' : `Player ${pl.n}`,
            getAvatar: () => (pl.you ? settings.avatar : settings.roster[pl.index].avatar),
            setAvatar: (a) => { if (pl.you) settings.avatar = a; else settings.roster[pl.index].avatar = a; persistSettings(); row.querySelector('.plface').textContent = personFace(a); },
            getColor: () => (pl.you ? settings.color : settings.roster[pl.index].color),
            setColor: (key) => { if (pl.you) settings.color = key; else settings.roster[pl.index].color = key; persistSettings(); row.querySelector('.swatch').style.background = COLORS.find((c) => c.key === key).hex; },
            taken: () => takenColors(settings, pl.id),
          });
          ed.appendChild(block.node);
          listBox.appendChild(ed);
        }
      });
      add.disabled = players.length >= MAX_ROSTER + 1;
      rollBtn.disabled = count < MIN_PLAYERS;
      hint.textContent = count < MIN_PLAYERS ? 'Pick at least 2 players' : '';
    };
    add.addEventListener('click', () => {
      const id = nextId(settings.roster);
      settings.roster.push({ id, name: '', avatar: { ...DEFAULT_AVATAR }, color: firstFreeColor(takenColors(settings, null)), playing: playingCount(settings) < maxPlayers() }); // at the maximum the new player is stored but not checked
      settings.order = cleanOrder(settings.order, settings.roster);
      sel = id;
      persistSettings();
      render();
    });
    // Roll for first player: everybody who plays rolls a die, the highest starts (a tie is rolled again between the tied players); the seating turns so they are first
    const rand6 = () => Math.floor(((newSeed()[0] >>> 0) / 4294967296) * 6) + 1;
    rollBtn.addEventListener('click', () => {
      const players = listPlayers(settings).filter((p) => p.playing);
      const byId = Object.fromEntries(players.map((p) => [p.id, p]));
      const result = rollForFirst(players.map((p) => p.id), rand6);
      rollBox.hidden = false;
      rollBtn.disabled = true;
      const instant = reduced() || document.body.classList.contains('fast');
      const show = (round, final, k) => {
        rollBox.innerHTML = '';
        rollBox.appendChild(el('div', 'avlab', round.length === players.length ? 'Roll for first player' : 'Tie: rolled again'));
        const tiles = el('div', 'pltiles');
        round.forEach((r) => {
          const t = el('div', 'pltile' + (final && r.id === result.winner ? ' win' : ''));
          t.append(el('span', 'plface', personFace(byId[r.id].avatar)));
          const die = el('div', 'pldie');
          die.innerHTML = flatDieSvg(r.value);
          t.append(die, el('span', 'plnm', displayName(byId[r.id])));
          tiles.appendChild(t);
        });
        rollBox.appendChild(tiles);
        if (final) {
          rollBox.appendChild(el('div', 'plwinner', `${displayName(byId[result.winner])} starts!`));
          rotateToFirst(settings, result.winner);
          persistSettings();
          rollBtn.disabled = false;
          rollBtn.textContent = '\u{1F3B2} Roll again';
          render();
        }
        void k;
      };
      if (instant) { result.rounds.forEach((r, i) => show(r, i === result.rounds.length - 1, i)); return; }
      let i = 0;
      const next = () => {
        if (!rollBox.isConnected) return;
        const round = result.rounds[i];
        let ticks = 0;
        const timer = setInterval(() => { // the dice spin through random faces, then settle
          if (!rollBox.isConnected) { clearInterval(timer); return; }
          ticks++;
          if (ticks < 10) { show(round.map((r) => ({ id: r.id, value: rand6() })), false, i); return; }
          clearInterval(timer);
          const last = i === result.rounds.length - 1;
          show(round, last, i);
          if (!last) { i++; setTimeout(next, 1100); }
        }, 90);
      };
      next();
    });
    render();
  }, () => renderMenu(), true); // redraw the menu when the screen closes: its line shows who is playing
}

function openSheet(build, onClose, full) {
  const back = el('div', 'sheet-back' + (full ? ' full' : ''));
  const sheet = el('div', 'sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  const close = () => { back.remove(); if (onClose) onClose(); };
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

// "Reset game defaults": every game's house rules go back to their standard values. Nothing else changes (name, avatar, color, mode, players,
// bot level, saved games and personal bests stay).
function confirmResetDefaults(after) {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, 'Reset game defaults?'));
    sheet.appendChild(el('p', null, "Every game's house rules go back to their standard settings. Your name, avatar, color, saved games and personal bests are not changed."));
    const row = el('div', 'confirmrow');
    const keep = el('button', 'secondary', 'Cancel');
    const reset = el('button', 'danger', 'Reset');
    keep.addEventListener('click', close);
    reset.addEventListener('click', () => {
      GAME_ORDER.forEach((id) => {
        settings.house[id] = GAMES[id].defaultOptions();
        if (GAMES[id].normalizeOptions) settings.house[id] = GAMES[id].normalizeOptions(settings.house[id]);
      });
      persistSettings();
      close();
      if (after) after();
    });
    row.append(keep, reset);
    sheet.appendChild(row);
    sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  });
}

// The avatar picker (Settings and the Pass & Play player editor): a live preview, AGE and STYLE rows beside it, a row of six skin tones and under them a
// gallery of faces (two rows, the list depends on age and style). Until something is chosen the preview shows the plain 👤 and nothing is selected; the first
// tap fills the missing choices as Adult and Male (and the first tone). Every tap calls setAvatar(new avatar) and refreshes. Returns { node, refresh }.
function buildAvatarPicker(getAvatar, setAvatar) {
  const node = el('div', 'avwrap');
  const pick = el('div', 'avpick');
  const prev = el('div', 'avprev');
  prev.setAttribute('aria-hidden', 'true');
  const ctl = el('div', 'avctl');
  const chosen = () => getAvatar().age !== 'none' && getAvatar().style !== 'none';
  const gallery = el('div', 'avgal');
  gallery.setAttribute('role', 'group');
  gallery.setAttribute('aria-label', 'Face');
  let galKey = '';
  const drawGallery = () => {
    const a = getAvatar();
    const age = chosen() ? a.age : 'adult';
    const style = chosen() ? a.style : 'male';
    const key = age + (age === 'child' ? '' : style);
    if (key !== galKey) { // the list only changes with age or style
      galKey = key;
      gallery.innerHTML = '';
      looksFor(age, style).forEach((look, k) => {
        const b = el('button', 'avface');
        b.type = 'button';
        b.dataset.look = look;
        b.setAttribute('aria-label', `Face ${k + 1}`);
        b.addEventListener('click', () => setPatch({ look }));
        gallery.appendChild(b);
      });
    }
    [...gallery.children].forEach((b) => {
      b.textContent = withTone(b.dataset.look, a.tone);
      b.setAttribute('aria-pressed', String(chosen() && a.look === b.dataset.look));
    });
  };
  const refresh = () => {
    prev.textContent = personFace(getAvatar());
    segs.forEach(([b, key, val]) => b.setAttribute('aria-pressed', String(chosen() && getAvatar()[key] === val)));
    toneBtns.forEach(([b, t]) => b.setAttribute('aria-pressed', String(chosen() && getAvatar().tone === t)));
    drawGallery();
  };
  const setPatch = (patch) => {
    const a = getAvatar();
    // a new age or style keeps the face when the new list has it, otherwise cleanAvatar gives that list's first face
    const next = { age: chosen() ? a.age : 'adult', style: chosen() ? a.style : 'male', tone: a.tone, look: chosen() ? a.look : '', ...patch };
    if (patch.style && next.age === 'child' && !patch.look) next.look = ''; // a child's Style still picks the boy or the girl
    setAvatar(cleanAvatar(next));
    refresh();
  };
  const segs = [];
  const mkSeg = (title, key, items) => {
    const box = el('div', 'avrow');
    box.appendChild(el('span', 'avlab', title));
    const grp = el('div', 'avseg');
    grp.setAttribute('role', 'group');
    grp.setAttribute('aria-label', title);
    items.forEach((it) => {
      const b = el('button', 'avsegbtn', it.label);
      b.type = 'button';
      b.setAttribute('aria-label', `${title}: ${it.label}`);
      b.addEventListener('click', () => setPatch({ [key]: it.key }));
      segs.push([b, key, it.key]);
      grp.appendChild(b);
    });
    box.appendChild(grp);
    return box;
  };
  ctl.append(mkSeg('Age', 'age', AGES), mkSeg('Style', 'style', STYLES));
  pick.append(prev, ctl);
  const toneRow = el('div', 'avtones');
  toneRow.setAttribute('role', 'group');
  toneRow.setAttribute('aria-label', 'Skin tone');
  const toneBtns = [];
  TONE_COLORS.forEach((hex, t) => {
    const b = el('button', 'avtone');
    b.type = 'button';
    const dot = el('i');
    dot.style.background = hex;
    b.appendChild(dot);
    b.setAttribute('aria-label', `Skin tone ${t + 1}`);
    b.addEventListener('click', () => setPatch({ tone: t }));
    toneBtns.push([b, t]);
    toneRow.appendChild(b);
  });
  node.append(pick, toneRow, gallery);
  refresh();
  return { node, refresh };
}

// Settings: your name, your avatar (a preview with age, style and skin tone rows) and your color (a dropdown button that opens a
// panel under it with every choice visible at once).
function openSettings() {
  openSheet((sheet, close) => {
    sheet.classList.add('settings'); // lets a dropdown panel float over the lower part of the sheet
    sheet.appendChild(el('h2', null, 'Settings'));

    // your name, avatar and colour: the same block as the Pass & Play editor
    const block = buildPlayerBlock({
      getName: () => (settings.name === 'You' ? '' : settings.name),
      setName: (raw) => { settings.name = cleanName(raw); persistSettings(); },
      placeholder: 'You',
      getAvatar: () => settings.avatar,
      setAvatar: (a) => { settings.avatar = a; persistSettings(); },
      getColor: () => settings.color,
      setColor: (key) => { settings.color = key; persistSettings(); },
      taken: () => [],
    });
    sheet.appendChild(block.node);

    // Text size: Normal, Large or Larger (every size in the app that is written in rem follows it)
    const tsRow = el('div', 'setrow tsrow');
    const tsLabel = el('label', null, 'Text size:');
    tsLabel.id = 'tslabel';
    const tsSeg = el('div', 'avseg');
    tsSeg.setAttribute('role', 'group');
    tsSeg.setAttribute('aria-labelledby', 'tslabel');
    const tsBtns = [];
    TEXT_SIZES.forEach(([key, label]) => {
      const b = el('button', 'avsegbtn', label);
      b.type = 'button';
      b.setAttribute('aria-label', `Text size: ${label}`);
      b.addEventListener('click', () => { settings.textSize = key; persistSettings(); applyTextSize(); refresh(); });
      tsBtns.push([b, key]);
      tsSeg.appendChild(b);
    });
    tsRow.append(tsLabel, tsSeg);
    sheet.appendChild(tsRow);

    const refresh = () => {
      block.refresh();
      tsBtns.forEach(([b, key]) => b.setAttribute('aria-pressed', String(settings.textSize === key)));
    };
    const clearAll = el('button', 'secondary clearall');
    const refreshClear = () => {
      const n = GAME_ORDER.filter((id) => loadSave(id)).length;
      clearAll.disabled = n === 0;
      clearAll.textContent = n ? `Clear all saved games (${n})` : 'No saved games';
    };
    clearAll.addEventListener('click', () => confirmDelete(GAME_ORDER, () => { refreshClear(); renderMenu(); }));
    sheet.appendChild(clearAll);
    refreshClear();
    const resetDefaults = el('button', 'secondary resetdef', 'Reset game defaults');
    resetDefaults.addEventListener('click', () => confirmResetDefaults(() => renderMenu()));
    sheet.appendChild(resetDefaults);
    const ok = el('button', 'primary', 'Done');
    ok.addEventListener('click', close);
    sheet.appendChild(ok);
    refresh();
  }, () => renderMenu()); // the Pass & Play list shows your profile: redraw the menu when Settings closes
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
        wrap.hidden = !!(rule.hidden && rule.hidden(cur)); // a rule that does not apply to the other choices is not shown (Martian Dice: Target score or Each type)
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
  if (!ok) showSaveWarning(); // (a first failed save happens before the game screen exists: enterGame shows the warning then)
}

function enterGame() {
  moods.reset();
  removePassCover();
  coverSeat = -1; // a new or resumed game: the first player gets the "Pass the phone" cover too
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
  storageWarned = false; // each game screen warns once
  ui.scores = el('div');
  ui.table = el('div', 'table');
  G.view.build(ui);
  ui.controls = el('div', 'controls');
  ui.log = el('div', 'log');
  screen.append(bar, ui.scores, ui.table, ...(ui.after ? [ui.after] : []), ui.controls, ui.log);
  app.appendChild(screen);

  ui.bar = bar;
  if (!storageAvailable()) showSaveWarning();
  render(false);
  afterEvents();
}

const ctx = () => ({
  busy,
  tumble: false,
  reduced: reduced(),
  act: humanAct,
  log: () => {}, // the running narrative under the game is gone (the user's choice); addLog stays for the "cannot save" warning
  announce,
  vibrate: () => { if (navigator.vibrate) { try { navigator.vibrate(150); } catch { /* ignore */ } } },
});

// Which way the dice travel across the screen: a human throws from the bottom (up); a bot throws from where its chip sits:
// bot seat 1 from the top right (down and to the left), seat 2 from the left (to the right), seat 3 from the right (to the left).
const BOT_THROWS = [[-0.7, 0.7], [1, 0], [-1, 0]];
function throwDirection() {
  const seat = session && view ? session.options.seats && session.options.seats[view.current] : null;
  return seat && seat.isBot ? BOT_THROWS[(view.current - 1) % BOT_THROWS.length] : [0, -1];
}

let throwFrom = -1e9; // when the current dice throw began
function render(tumble) {
  decorate();
  const c = ctx();
  const now = performance.now();
  if (tumble) { throwFrom = now; startThrow(now, throwDirection()); }
  c.tumble = tumble || now - throwFrom < ROLL_MS; // a re-render in the middle of a throw carries the throw on
  beginDice();
  G.view.render(ui, view, session, c);
  placeBubble();
}

// The "cannot save" warning: one line under the top bar of the game screen (every game has that bar; the old log under the game is hidden in 9 games), said once.
function showSaveWarning() {
  if (storageWarned || !ui.bar || !ui.bar.isConnected) return;
  storageWarned = true;
  const w = el('div', 'savewarn', 'Progress cannot be saved on this device.');
  w.setAttribute('role', 'status');
  ui.bar.after(w);
}

function addLog(text) { // returns true when the line is on the screen (there is a game screen to show it on)
  if (!ui.log || !ui.log.isConnected) return false;
  ui.log.appendChild(el('div', null, text));
  while (ui.log.children.length > 3) ui.log.removeChild(ui.log.firstChild);
  return true;
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


/* ---------- Pass the phone: in Pass & Play a full-screen cover at every change of player ---------- */
let coverSeat = -1; // the seat whose turn the phone was last handed over for
let passCover = null;
function removePassCover() { if (passCover) { passCover.remove(); passCover = null; } }
// Only in a game of several humans (Pass & Play), and only when the player to move changed since the last cover.
function needsPassCover() {
  const seats = session.options.seats || [];
  // a game can also ask for the cover with `view.cover` (Liar's Dice: every new round, even when the same player starts again)
  return seats.length > 1 && seats.every((s) => !s.isBot) && (session.state.current !== coverSeat || !!(view && view.cover)) && !session.isOver();
}
// The cover shows only who is next (never anything about the game or a result) and keeps the screen hidden until "I'm ready".
function showPassCover(seatIdx) {
  removePassCover();
  busy = true; // nothing can be done under the cover
  const seat = session.options.seats[seatIdx];
  const cover = el('div', 'passcover');
  cover.setAttribute('role', 'dialog');
  cover.setAttribute('aria-modal', 'true');
  cover.setAttribute('aria-label', `Pass the phone to ${seat.name}`);
  cover.style.setProperty('--pc', seat.color || '#888');
  cover.append(el('div', 'pcbar'), el('div', 'pclab', 'Pass the phone to'), el('div', 'pcface', seat.avatar || ''), el('div', 'pcname', seat.name), el('div', 'pcnote', 'Do not look at the screen until you take the phone.'));
  const ready = el('button', 'primary pcready', "I'm ready");
  ready.type = 'button';
  ready.addEventListener('click', () => {
    removePassCover();
    coverSeat = seatIdx;
    if (view && view.cover) { view.cover = false; view.peeking = false; } // a game's own hand-over flag (Liar's Dice)
    busy = false;
    render(false);
  });
  cover.appendChild(ready);
  document.body.appendChild(cover);
  passCover = cover;
  ready.focus();
  announce(`Pass the phone to ${seat.name}`);
}

/* ---------- after events: bot turn or game over ---------- */
function afterEvents() {
  if (session.isOver()) { showGameOver(); return; }
  const st = session.state;
  const cur = st.seats[st.current];
  if (!cur.isBot) { if (needsPassCover()) showPassCover(st.current); render(false); return; }
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
  const hold = G.view.holdMs ? G.view.holdMs(view) : 0; // a screen may ask a bot to wait (Liar's Dice: the cups are still shaking)
  sched.after(Math.max(reduced() ? 300 : thinkMs(closeness), hold), () => doActions(d.actions, 0));
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
  const winText = winners.length > 1 ? `It's a tie: ${names.join(' and ')}` : `${names[0]} ${isMe(optSeats[winners[0]]) && names[0] === 'You' ? 'win' : 'wins'}`;
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
      const custom = G.view.resultLine ? G.view.resultLine(r, st.options) : null; // a game's screen may draw its own result line (Martian Dice, Collect mode: pictures)
      row.append(el('span', null, `${faceFor(optSeats[at], 'DEFAULT')} ${r.name}`), custom || el('span', null, `${r.total.toLocaleString('en-US')} · ${r.turns} turns`));
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
