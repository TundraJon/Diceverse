import * as pig from '../games/pig.js';
import { createSession, replaySession } from '../core/engine.js';
import { newSeed } from '../core/rng.js';
import { createScheduler } from '../core/scheduler.js';
import { chooseAction, thinkMs, PRESETS } from '../ai/brain.js';
import { renderDie } from '../ui/dice.js';
import { renderScoreStrip, renderTurnBar } from '../ui/panels.js';
import { loadSave, writeSave, clearSave, loadSettings, writeSettings, loadBest, updateBest, storageAvailable } from './save.js';

const BOT_NAMES = ['Pip', 'Dottie', 'Rook', 'Mabel', 'Juno', 'Fitch'];
const app = document.getElementById('app');
const live = document.getElementById('live');
const sched = createScheduler();
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const defaults = () => ({ mode: 'bots', players: 3, preset: 'balanced', house: pig.defaultOptions() });
let settings = Object.assign(defaults(), loadSettings() || {});
settings.house = Object.assign(pig.defaultOptions(), settings.house || {});

let session = null;
let busy = false;
let ui = {}; // references to game DOM
let view = null; // what the player currently sees (updated by events)
let storageWarned = false;

function announce(text) { live.textContent = ''; setTimeout(() => (live.textContent = text), 20); }
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* ---------- options / seats ---------- */
function buildOptions() {
  const house = settings.house;
  let seats;
  if (settings.mode === 'solo') seats = [{ name: 'You', isBot: false }];
  else if (settings.mode === 'pass') seats = Array.from({ length: settings.players }, (_, i) => ({ name: `Player ${i + 1}`, isBot: false }));
  else seats = [{ name: 'You', isBot: false }].concat(
    Array.from({ length: settings.players - 1 }, (_, i) => ({ name: BOT_NAMES[i], isBot: true, preset: settings.preset }))
  );
  return { seats, target: house.target, dice: house.dice, equalTurns: settings.mode === 'solo' ? false : house.equalTurns };
}

/* ---------- menu ---------- */
function goMenu() {
  sched.cancelAll();
  busy = false;
  session = session && !session.isOver() ? session : null;
  renderMenu();
}

function renderMenu() {
  app.innerHTML = '';
  const screen = el('section', 'screen');
  const hero = el('div', 'hero');
  hero.append(el('div', 'logo', '🎲'), el('h1', null, 'DICEVERSE'), el('p', null, 'Pig · dice companion'));
  screen.appendChild(hero);

  const saved = loadSave();
  if (saved) {
    const resume = el('button', 'primary', 'Resume game');
    resume.addEventListener('click', resumeGame);
    screen.appendChild(resume);
  }

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
  screen.appendChild(modePanel);

  if (settings.mode !== 'solo') {
    const pp = el('div', 'panel');
    const row = el('div', 'row');
    row.appendChild(el('span', null, 'Players'));
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
    row.appendChild(st);
    pp.appendChild(row);
    screen.appendChild(pp);
  }

  if (settings.mode === 'bots') {
    const bp = el('div', 'panel');
    const row = el('div', 'row');
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
    bp.appendChild(row);
    screen.appendChild(bp);
  }

  const summary = el('p', 'note');
  const h = settings.house;
  summary.textContent = `Target ${h.target} · ${h.dice === 1 ? 'one die' : 'two dice'}${settings.mode !== 'solo' && h.equalTurns ? ' · equal turns' : ''}`;
  const best = settings.mode === 'solo' ? loadBest(h) : null;
  if (best) summary.textContent += ` · your best: ${best} turns`;
  screen.appendChild(summary);

  const hr = el('button', 'secondary', 'House rules');
  hr.addEventListener('click', openHouseRules);
  const rules = el('button', 'secondary', 'How to play');
  rules.addEventListener('click', openRules);
  const start = el('button', 'primary', 'Start');
  start.addEventListener('click', () => startNew());
  screen.append(hr, rules, start);
  app.appendChild(screen);
}

function persistSettings() { writeSettings(settings); }

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

function openRules() {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, 'How to play Pig'));
    ['On your turn, roll the die as many times as you like.',
     'Each roll adds to your turn points, unless you roll a 1: you lose the turn points and your turn ends.',
     'Press BANK any time to add your turn points to your total and pass the die.',
     'First to reach the target wins.',
     'Two-dice option: a single 1 loses your turn points; double 1s also wipe your whole total.',
     'Equal turns option: when someone reaches the target, everyone gets the same number of turns, and the highest total wins.',
     'Solo: reach the target in as few turns as you can.']
      .forEach((t) => sheet.appendChild(el('p', null, t)));
    const ok = el('button', 'primary', 'Got it');
    ok.addEventListener('click', close);
    sheet.appendChild(ok);
  });
}

function openHouseRules() {
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, 'House rules'));
    pig.meta.houseRules.forEach((rule) => {
      if (rule.key === 'equalTurns' && settings.mode === 'solo') return;
      const wrap = el('div', 'panel');
      wrap.appendChild(el('h2', null, rule.label));
      const seg = el('div', 'seg');
      rule.options.forEach((opt) => {
        const b = el('button', null, opt.label);
        b.setAttribute('aria-pressed', String(settings.house[rule.key] === opt.value));
        b.addEventListener('click', () => {
          settings.house[rule.key] = opt.value;
          persistSettings();
          seg.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(rule.options[i].value === opt.value)));
        });
        seg.appendChild(b);
      });
      wrap.appendChild(seg);
      sheet.appendChild(wrap);
    });
    const ok = el('button', 'primary', 'Done');
    ok.addEventListener('click', () => { close(); renderMenu(); });
    sheet.appendChild(ok);
  });
}

/* ---------- game lifecycle ---------- */
function startNew(options) {
  sched.cancelAll();
  busy = false;
  session = createSession(pig, options || buildOptions(), newSeed());
  persistSession();
  enterGame();
}

function resumeGame() {
  sched.cancelAll();
  const restored = replaySession(pig, loadSave());
  if (!restored) { clearSave(); renderMenu(); return; }
  session = restored;
  enterGame();
}

function persistSession() {
  if (!session) return;
  if (session.isOver()) { clearSave(); return; }
  const ok = writeSave(session.save());
  if (!ok && !storageWarned) { storageWarned = true; addLog('Progress cannot be saved on this device.'); }
}

function seatsView(state) {
  return state.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns }));
}

function enterGame() {
  const st = session.state;
  view = { seats: seatsView(st), current: st.current, turnPoints: st.turn.points, dice: st.turn.dice.slice(), banner: '' };
  app.innerHTML = '';
  const screen = el('section', 'screen');

  const bar = el('header', 'bar');
  bar.appendChild(el('h1', null, 'PIG'));
  const right = el('div');
  right.style.display = 'flex'; right.style.gap = '8px';
  const rulesBtn = el('button', 'icon-btn', '?');
  rulesBtn.setAttribute('aria-label', 'Rules');
  rulesBtn.addEventListener('click', openRules);
  const menuBtn = el('button', 'icon-btn', 'Menu');
  menuBtn.addEventListener('click', goMenu);
  right.append(rulesBtn, menuBtn);
  bar.appendChild(right);

  ui.scores = el('div');
  ui.table = el('div', 'table');
  ui.banner = el('div', 'banner');
  ui.banner.hidden = true;
  ui.dice = el('div', 'dice');
  ui.turnline = el('div', 'turnline');
  ui.table.append(ui.banner, ui.dice, ui.turnline);
  ui.controls = el('div', 'controls');
  ui.log = el('div', 'log');
  screen.append(bar, ui.scores, ui.table, ui.controls, ui.log);
  app.appendChild(screen);

  if (!storageAvailable() && !storageWarned) { storageWarned = true; addLog('Progress cannot be saved on this device.'); }
  render({ tumble: false });
  afterEvents();
}

function render({ tumble }) {
  const st = session.state;
  renderScoreStrip(ui.scores, view.seats, view.current, view.turnPoints);
  ui.dice.innerHTML = '';
  ui.dice.className = 'dice' + (st.options.dice === 2 ? ' two' : '');
  const n = st.options.dice;
  for (let i = 0; i < n; i++) ui.dice.appendChild(renderDie(view.dice[i] ?? null, { tumble: tumble && !reduced() }));
  const cur = view.seats[view.current];
  ui.turnline.innerHTML = '';
  if (session.isOver()) ui.turnline.textContent = '';
  else {
    const strong = el('strong', null, cur.name);
    if (cur.name === 'You') ui.turnline.append(document.createTextNode('Your turn'));
    else ui.turnline.append(strong, document.createTextNode(cur.isBot ? ' is thinking…' : "'s turn"));
  }
  ui.banner.hidden = !view.banner;
  ui.banner.textContent = view.banner;
  const humanTurn = !session.isOver() && !cur.isBot && !busy;
  renderTurnBar(ui.controls, {
    canRoll: humanTurn,
    canBank: humanTurn && session.state.turn.points > 0 && view.turnPoints > 0,
    onRoll: () => humanAct('ROLL'),
    onBank: () => humanAct('BANK'),
  });
}

function addLog(text) {
  if (!ui.log) return;
  const line = el('div', null, text);
  ui.log.appendChild(line);
  while (ui.log.children.length > 3) ui.log.removeChild(ui.log.firstChild);
}

function humanAct(type) {
  if (busy || !session || session.isOver()) return;
  const cur = session.state.seats[session.state.current];
  if (cur.isBot) return;
  doAction({ type });
}

function doAction(action) {
  busy = true;
  const seatBefore = session.state.current;
  const events = session.dispatch(action);
  persistSession();
  render({ tumble: false });
  present(events, seatBefore, 0);
}

/* ---------- presenting events ---------- */
function present(events, seat, i) {
  if (i >= events.length) {
    view.banner = '';
    view = { ...view, seats: seatsView(session.state), current: session.state.current, turnPoints: session.state.turn.points };
    busy = false;
    render({ tumble: false });
    afterEvents();
    return;
  }
  const ev = events[i];
  const name = (s) => view.seats[s].name;
  let delay = 0;
  let tumble = false;
  switch (ev.type) {
    case 'ROLLED':
      view.dice = ev.dice.slice();
      tumble = true;
      delay = reduced() ? 150 : 650;
      announce(`${name(ev.seat)} rolled ${ev.dice.join(' and ')}`);
      break;
    case 'SCORED':
      view.turnPoints = ev.turnPoints;
      addLog(`${name(ev.seat)} +${ev.gain} (turn ${ev.turnPoints})`);
      delay = 250;
      break;
    case 'BUSTED':
      view.turnPoints = 0;
      view.banner = ev.reset ? 'DOUBLE ONES! TOTAL RESET' : ev.lost > 0 ? `BUST! −${ev.lost}` : 'BUST!';
      if (ev.reset) view.seats[ev.seat].total = 0;
      addLog(`${name(ev.seat)} busted${ev.reset ? ' and lost their total' : ''}`);
      announce(`${name(ev.seat)} busted`);
      if (navigator.vibrate) { try { navigator.vibrate(150); } catch { /* ignore */ } }
      delay = reduced() ? 600 : 1200;
      break;
    case 'BANKED':
      view.turnPoints = 0;
      view.seats[ev.seat].total = ev.total;
      addLog(`${name(ev.seat)} banked ${ev.amount} (total ${ev.total})`);
      announce(`${name(ev.seat)} banked ${ev.amount}, total ${ev.total}`);
      delay = 450;
      break;
    case 'TURN_ENDED':
      view.banner = '';
      view.seats[ev.seat].turns += 1;
      break;
    case 'TURN_STARTED':
      view.current = ev.seat;
      view.turnPoints = 0;
      view.dice = [];
      delay = 200;
      break;
    case 'GAME_OVER':
      break;
    default:
      break;
  }
  render({ tumble });
  sched.after(delay, () => present(events, seat, i + 1));
}

/* ---------- after events: bot turn or game over ---------- */
function afterEvents() {
  if (session.isOver()) { showGameOver(); return; }
  const st = session.state;
  const cur = st.seats[st.current];
  if (!cur.isBot) { render({ tumble: false }); return; }
  busy = true;
  render({ tumble: false });
  const seat = st.current;
  const obs = session.observe(seat);
  // Numeric bot seed: first word of an array seed (or the legacy number), mixed with progress and seat.
  const base = Array.isArray(session.seed) ? session.seed[0] : session.seed;
  const seed = (base ^ (session.log.length * 7919) ^ (seat * 104729)) >>> 0;
  const decision = chooseAction(pig, obs, seat, cur.preset, seed);
  const wait = thinkMs(1 - Math.min(1, Math.abs(decision.margin ?? 5) / 5));
  sched.after(reduced() ? 300 : wait, () => doAction({ type: decision.type }));
}

function showGameOver() {
  const res = session.result();
  const st = session.state;
  const solo = st.seats.length === 1;
  persistSession();
  let newBest = false;
  if (solo) newBest = updateBest(st.options, res.soloTurns);
  announce(solo ? `You reached ${st.options.target} in ${res.soloTurns} turns` : `${st.seats[res.winner].name} ${st.seats[res.winner].name === 'You' ? 'win' : 'wins'}`);
  openSheet((sheet, close) => {
    sheet.appendChild(el('h2', null, solo ? `Done in ${res.soloTurns} turns` : `🏆 ${st.seats[res.winner].name} ${st.seats[res.winner].name === 'You' ? 'win' : 'wins'}!`));
    if (solo) {
      const best = loadBest(st.options);
      sheet.appendChild(el('p', null, newBest ? 'New personal best!' : best ? `Your best: ${best} turns` : ''));
    }
    const list = el('div', 'results');
    res.standings.forEach((r) => {
      const row = el('div', 'r');
      row.append(el('span', null, r.name), el('span', null, `${r.total} · ${r.turns} turns`));
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
