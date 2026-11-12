// Liar's Dice view: the Bidding Track board (30 squares round the edge), the players' dice columns and cups in the middle, your
// cup (hold to peek), the face buttons, and the challenge reveal. All theme words live in THEME.
import { renderDie, REVEAL_MS } from '../dice.js';
import { renderTurnBar } from '../panels.js';
import { isMe, statusOverride } from '../avatars.js';
import { describeSpace, spaceOf, bidText, faces, legalActions as rulesLegal } from '../../games/liars.js';

const THEME = {
  title: "LIAR'S DICE",
  tagline: 'Bluff, bid and call it.',
  bidWord: 'bids',
  call: 'LIAR!',
  wild: 'wild',
  lost: 'Lost dice',
};

const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const colorOf = (view, i) => view.seats[i].color || SEAT_COLORS[i];
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const isFast = () => document.body.classList.contains('fast');
const SHAKE_MS = 2000; // how long the cups shake at the start of a round (more than the 1.25 s the no-tell rule asks for)
const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// ---- the ring: position 0 to 29 on the board, clockwise from the top left (10 columns x 7 rows) ----
const COLS = 10;
const ROWS = 7;
function cellOf(pos) {
  if (pos < 10) return { row: 1, col: pos + 1 };
  if (pos < 15) return { row: pos - 10 + 2, col: 10 };
  if (pos < 25) return { row: 7, col: 10 - (pos - 15) };
  return { row: 7 - (pos - 24), col: 1 };
}
// A space on the track (a number from 0 up) lies on a ring position and a lap.
function placeOf(space, wild) {
  if (wild) return { pos: space % 30, lap: Math.floor(space / 30) };
  const q = space + 1;
  return { pos: spaceOf('N', ((q - 1) % 20) + 1, true), lap: Math.floor((q - 1) / 20) };
}
function spaceAt(pos, lap, wild) {
  if (wild) { const sp = lap * 30 + pos; return sp < 60 ? sp : null; }
  const d = describeSpace(pos, true);
  if (d.kind === 'W') return null;
  const q = d.q + 20 * lap;
  return q <= 40 ? q - 1 : null;
}

const faceWord = (f) => ['', 'ones', 'twos', 'threes', 'fours', 'fives', 'sixes'][f];

const seatsView = (st) => st.seats.map((s) => ({ name: s.name, isBot: s.isBot, dice: s.dice, turns: s.turns }));

// The dice under your cup grow to use the room that is left on this screen (32 px on a screen with none, up to 48 px), so nothing
// ever scrolls. Worked out once per screen size, with room kept for the banner that comes and goes.
const DICE_MIN = 32;
const DICE_MAX = 48;
function fitDice(ui, reset) {
  const t = ui.table;
  const key = `${window.innerWidth}x${window.innerHeight}`;
  if (reset) ui.diceKey = null;
  if (ui.diceKey === key || !ui.controls || !ui.hint) return;
  t.style.setProperty('--ldd', `${DICE_MIN}px`);
  const free = ui.controls.getBoundingClientRect().top - ui.hint.getBoundingClientRect().bottom - 8 - (ui.banner.hidden ? 40 : 0);
  const widthCap = Math.floor((Math.min(window.innerWidth, 560) - 32 - 54) / 5);
  const size = Math.max(DICE_MIN, Math.min(DICE_MAX, widthCap, DICE_MIN + Math.floor(free)));
  t.style.setProperty('--ldd', `${size}px`);
  ui.diceKey = key;
}

export const liarsView = {
  title: THEME.title,

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, "How to play Liar's Dice"));
    sheet.appendChild(el('p', 'tagline', THEME.tagline));
    [
      `Everyone has ${options.dice} dice under a cup and only you can see yours. Hold the PEEK button to look at your own dice.`,
      options.wild
        ? 'The bidding track runs round the edge of the board. A Number bid claims that at least that many dice on the whole table show a face. Ones are wild: they count as any face. A Wild bid claims that many ones.'
        : 'The bidding track runs round the edge of the board. A bid claims that at least that many dice on the whole table show a face. Ones are an ordinary face here.',
      'On your turn you either raise the bid or challenge it, no passing. To raise, move the Bidding Die to a later square (any face), or stay on the same square and show a higher face. After square 20 the track goes round again (21 and up).',
      'A challenge lifts all the cups and counts the dice. If there are at least as many as the bid, the bidder was right and the challenger loses; an exact count counts for the bidder. If there are fewer, the bidder loses.',
      options.lost === 'diff'
        ? 'The loser of a challenge loses as many dice as the bid was out by (at least one).'
        : 'The loser of a challenge loses one die.',
      'The loser of the round opens the next one. A player with no dice is out; the last player with dice wins.',
      options.duel
        ? 'Final duel: when two players are left with one die each, they bid on the total of both dice, from 2 to 12, each bid higher than the last. A challenge is right if the real total is lower than the bid.'
        : null,
    ].filter(Boolean).forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h) {
    const bits = [];
    if (h.wild === false) bits.push('no wild ones');
    if (h.lost === 'diff') bits.push('lose the difference');
    if (h.dice === 3) bits.push('3 dice');
    if (h.duel === false) bits.push('no final duel');
    return bits.length ? bits.join(' · ') : 'Standard rules';
  },

  init(session) {
    const v = this.sync(null, session);
    v.shakeUntil = performance.now() + (isFast() ? 0 : reducedMotion() ? REVEAL_MS : SHAKE_MS); // the first round's cups shake too
    return v;
  },

  sync(prev, session) {
    const st = session.state;
    const humans = st.seats.filter((s) => !s.isBot).length;
    return {
      seats: seatsView(st),
      current: st.current,
      round: st.round,
      bid: st.bid ? { ...st.bid } : null,
      duel: st.duel,
      hands: st.hands.map((h) => h.slice()),
      wild: st.options.wild,
      shaking: false,
      shakeUntil: prev && prev.shakeUntil ? prev.shakeUntil : 0, // a re-sync in the middle of the first shake keeps it
      staged: null,
      peeking: false,
      cover: humans > 1 && !st.seats[st.current].isBot,
      multi: humans > 1,
      reveal: null,
      banner: null,
      opener: st.current,
    };
  },

  // How long a bot must still wait before it acts: the cups are shaking (the shell uses the longer of this and its thinking time).
  holdMs(view) { return Math.max(0, (view.shakeUntil || 0) - performance.now()); },

  build(ui) {
    ui.table.classList.add('ldwrap');
    ui.table.addEventListener('contextmenu', (e) => e.preventDefault()); // no long-press menu on the playing screen
    window.addEventListener('resize', () => fitDice(ui, true));
    ui.scores.hidden = true;
    ui.chips = el('div', 'climbchips');
    ui.banner = el('div', 'banner ldbanner');
    ui.banner.hidden = true;
    ui.board = el('div', 'ldboard');
    ui.faces = el('div', 'ldfaces');
    ui.mine = el('div', 'ldmine');
    ui.hint = el('div', 'hint');
    ui.cover = el('div', 'ldcover');
    ui.cover.hidden = true;
    ui.table.append(ui.chips, ui.banner, ui.board, ui.faces, ui.mine, ui.hint, ui.cover);
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const wild = st.options.wild;
    const over = session.isOver();
    ui.controls.classList.add('sticky');
    ui.log.hidden = true; // this screen is full
    const cur = view.seats[view.current];
    const human = !over && !cur.isBot && !ctx.busy && !view.reveal;
    const mine = (() => { const k = view.seats.findIndex((s) => s.me); return k >= 0 ? k : view.current; })();
    const now = performance.now();
    const shaking = view.shaking || now < view.shakeUntil;
    if (view.shakeUntil && now < view.shakeUntil && !ui.shakeTimer) {
      ui.shakeTimer = setTimeout(() => { ui.shakeTimer = null; view.shakeUntil = 0; this.render(ui, view, session, ctx); }, view.shakeUntil - now + 20);
    }

    // one chip per player: color, face and name, the dice they have left
    ui.chips.innerHTML = '';
    ui.chips.style.setProperty('--n', String(Math.min(2, view.seats.length)));
    view.seats.forEach((s, i) => {
      const chip = el('div', 'cchip' + (i === view.current && !over ? ' active' : ''));
      const sw = el('i');
      sw.style.background = colorOf(view, i);
      chip.append(sw, el('span', 'cn', `${s.face || (s.isBot ? '\u{1F916}' : '\u{1F464}')} ${s.name}`), el('b', null, `${s.dice} \u{1F3B2}`));
      chip.setAttribute('aria-label', `${s.name}: ${s.dice} dice left`);
      ui.chips.appendChild(chip);
    });

    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner ldbanner' + (view.banner && view.banner.good ? ' hot' : '');

    // legal bids for you right now (only while it is your turn)
    const legal = human ? rulesLegal(st, view.current) : [];
    const bids = legal.filter((a) => a.type === 'BID');
    const canChallenge = legal.some((a) => a.type === 'CHALLENGE');
    if (view.staged && !bids.some((a) => a.space === view.staged.space && a.face === view.staged.face && a.total === view.staged.total)) view.staged = null;

    // the lap shown on the squares: the second lap relabels them 21 and up
    // (it only moves on to the next lap when there is no legal raise left on this one)
    const bidLap = view.bid && view.bid.space !== undefined ? placeOf(view.bid.space, wild).lap : 0;
    const lap = view.duel ? 0 : view.staged && view.staged.space !== undefined ? placeOf(view.staged.space, wild).lap
      : (bids.length && !bids.some((a) => a.space !== undefined && placeOf(a.space, wild).lap === bidLap) ? bidLap + 1 : bidLap);

    // the board
    ui.board.innerHTML = '';
    ui.board.classList.toggle('duel', view.duel);
    const legalBySquare = {};
    bids.forEach((a) => { if (a.space === undefined) return; const p = placeOf(a.space, wild); (legalBySquare[p.pos + ':' + p.lap] = legalBySquare[p.pos + ':' + p.lap] || []).push(a); });
    for (let pos = 0; pos < 30; pos++) {
      const d = describeSpace(pos, true);
      const isWildSq = d.kind === 'W';
      const q = d.q + (isWildSq ? 10 : 20) * lap;
      const c = cellOf(pos);
      const sq = el('button', 'ldsq' + (isWildSq ? ' w' : '') + (isWildSq && !wild ? ' off' : ''));
      sq.style.gridArea = `${c.row} / ${c.col}`;
      sq.type = 'button';
      sq.appendChild(el('b', null, String(q)));
      if (isWildSq && wild) sq.appendChild(el('small', null, THEME.wild));
      // which space this square is for the current lap (the next one that is a legal raise)
      const spHere = spaceAt(pos, lap, wild);
      const legalHere = spHere !== null ? { sp: spHere, acts: bids.filter((a) => a.space === spHere) } : null;
      const tappable = !view.duel && !!legalHere && legalHere.acts.length > 0 && !shaking;
      sq.disabled = !tappable;
      sq.classList.toggle('opt', tappable);
      if (tappable) {
        sq.addEventListener('click', () => {
          const acts = legalHere.acts;
          const keep = view.staged && view.staged.space === legalHere.sp ? view.staged.face : null;
          const pick = acts.find((a) => a.face === keep) || acts[0];
          view.staged = { space: pick.space, face: pick.face };
          this.render(ui, view, session, ctx);
        });
      }
      // the Bidding Die: on the current bid's square, and a dashed one where you are about to bid
      const token = (b, cls) => {
        if (!b || b.space === undefined) return;
        const p = placeOf(b.space, wild);
        if (p.pos !== pos) return;
        const t = el('span', `ldtok ${cls}`);
        const f = b.face;
        t.appendChild(renderDie(f, { danger: false }));
        if (p.lap > 0) t.appendChild(el('i', 'lap', '2'));
        sq.appendChild(t);
        sq.classList.add(cls === 'bid' ? 'hasbid' : 'hasstage');
      };
      token(view.bid && !view.duel ? view.bid : null, 'bid');
      token(view.staged, 'stage');
      sq.setAttribute('aria-label', isWildSq ? `Wild ${q}` : `Number ${q}`);
      ui.board.appendChild(sq);
    }

    // the middle of the board
    const mid = el('div', 'ldcenter');
    if (view.reveal) {
      const r = view.reveal;
      mid.classList.add('reveal');
      mid.appendChild(el('div', 'ldbidline', `${view.seats[r.bid.seat].name}: ${bidText(r.bid, wild)}`));
      const rows = el('div', 'ldrows');
      r.hands.forEach((h, i) => {
        if (!h.length) return;
        const row = el('div', 'ldrow');
        const sw = el('i');
        sw.style.background = colorOf(view, i);
        row.appendChild(sw);
        h.forEach((v, k) => {
          const hit = r.bid.total === undefined && (r.bid.kind === 'W' ? v === 1 : v === r.bid.face || (wild && v === 1));
          const die = renderDie(v, { danger: false, cls: 'ldd' + (hit ? ' hit' : '') });
          if (hit) die.style.animationDelay = `${(r.order[i + ':' + k] || 0) * (isFast() || ctx.reduced ? 0 : 170)}ms`;
          row.appendChild(die);
        });
        rows.appendChild(row);
      });
      mid.appendChild(rows);
      mid.appendChild(el('div', 'ldcount', `Counted ${r.count}${r.bid.total === undefined ? ` of ${r.bid.q}` : ` (bid ${r.bid.total})`}: ${r.valid ? 'the bid stands' : 'the bid fails'}`));
    } else {
      const bidLine = view.bid
        ? `${view.seats[view.bid.seat].name} ${THEME.bidWord} ${bidText(view.bid, wild)}`
        : (shaking ? 'Shaking the cups…' : (isMe(st.options.seats[view.current]) && cur.name === 'You' ? 'You open' : `${cur.name} opens`));
      mid.appendChild(el('div', 'ldbidline', bidLine));
      if (view.duel) {
        mid.appendChild(el('div', 'ldsub', 'Final duel: bid the total of both dice'));
        const row = el('div', 'ldtotals');
        for (let t = 2; t <= 12; t++) {
          const b = el('button', 'ldtot' + (view.staged && view.staged.total === t ? ' sel' : ''), String(t));
          b.type = 'button';
          const ok = bids.some((a) => a.total === t) && !shaking;
          b.disabled = !ok;
          if (ok) b.addEventListener('click', () => { view.staged = { total: t }; this.render(ui, view, session, ctx); });
          row.appendChild(b);
        }
        mid.appendChild(row);
      }
      const cols = el('div', 'ldcols');
      view.seats.forEach((s, i) => {
        const col = el('div', 'ldcol' + (s.dice === 0 ? ' out' : '') + (i === view.current ? ' on' : ''));
        const cup = el('i', 'ldcup');
        cup.style.background = colorOf(view, i);
        col.appendChild(cup);
        const stack = el('div', 'ldstack');
        const start = st.options.dice;
        for (let k = 0; k < start; k++) { const dd = el('i', 'ldpip' + (k < s.dice ? '' : ' gone')); dd.style.background = k < s.dice ? colorOf(view, i) : ''; stack.appendChild(dd); }
        col.appendChild(stack);
        col.appendChild(el('small', null, s.name.length > 7 ? `${s.name.slice(0, 6)}…` : s.name));
        cols.appendChild(col);
      });
      mid.appendChild(cols);
      const lost = st.options.seats.length * st.options.dice - view.seats.reduce((a, s) => a + s.dice, 0);
      const pile = el('div', 'ldlost');
      pile.appendChild(el('span', null, `${THEME.lost}`));
      for (let k = 0; k < lost; k++) pile.appendChild(el('i', 'ldpip lostd'));
      mid.appendChild(pile);
    }
    mid.style.gridArea = `2 / 2 / ${ROWS} / ${COLS}`;
    ui.board.appendChild(mid);

    // the face buttons (a Number bid) under the board
    ui.faces.innerHTML = '';
    ui.faces.hidden = view.duel;
    if (!view.duel) {
      const staged = view.staged;
      const stagedActs = staged ? bids.filter((a) => a.space === staged.space) : [];
      const isWildBid = staged && describeSpace(staged.space, wild).kind === 'W';
      faces(st.options).forEach((f) => {
        const b = el('button', 'ldface' + (staged && !isWildBid && staged.face === f ? ' sel' : ''));
        b.type = 'button';
        b.appendChild(renderDie(f, { danger: false }));
        b.setAttribute('aria-label', `Face ${f}`);
        const ok = stagedActs.some((a) => a.face === f) && !isWildBid;
        b.disabled = !ok || shaking;
        if (ok) b.addEventListener('click', () => { view.staged = { space: staged.space, face: f }; this.render(ui, view, session, ctx); });
        ui.faces.appendChild(b);
      });
      ui.faces.appendChild(el('small', 'ldfhint', staged ? (isWildBid ? 'A Wild bid counts ones only' : 'Pick the face') : (human ? 'Tap a square to bid there' : '')));
    }

    // your cup: hold to peek
    ui.mine.innerHTML = '';
    const showMine = !over && !view.reveal && !view.cover && view.hands[mine] && view.seats[mine].dice > 0;
    if (showMine) {
      const hand = view.hands[mine].slice(0, view.seats[mine].dice);
      const peek = el('button', 'ldpeek' + (view.peeking && !shaking ? ' on' : ''));
      peek.type = 'button';
      peek.appendChild(el('span', 'ldcupbig'));
      peek.appendChild(el('b', null, view.peeking && !shaking ? 'PEEKING' : 'HOLD TO PEEK'));
      peek.disabled = shaking;
      peek.setAttribute('aria-pressed', String(!!view.peeking && !shaking));
      peek.setAttribute('aria-label', 'Hold to peek at your dice');
      const on = (v) => { if (view.peeking !== v) { view.peeking = v; this.render(ui, view, session, ctx); } };
      peek.addEventListener('pointerdown', (e) => { e.preventDefault(); on(true); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => peek.addEventListener(n, () => on(false)));
      peek.addEventListener('contextmenu', (e) => e.preventDefault());
      peek.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on(!view.peeking); } });
      const dice = el('div', 'ldhand' + (shaking ? ' shake' : ''));
      hand.forEach((v) => {
        if (view.peeking && !shaking) dice.appendChild(renderDie(v, { danger: false }));
        else dice.appendChild(renderDie(null, { danger: false }));
      });
      const box = el('div', 'ldyou'); // the dice and the button that peeks at them: one fixed box, so nothing moves when you peek
      box.append(dice, peek);
      ui.mine.appendChild(box);
    }

    // pass & play: nobody else's turn is shown until the next player takes the device
    ui.cover.hidden = !view.cover || over;
    if (view.cover && !over) {
      ui.cover.innerHTML = '';
      ui.cover.append(el('div', 'ldcoverbox'));
      const box = ui.cover.firstChild;
      box.append(el('div', 'ldcoverh', `Pass the device to ${cur.name}`), el('div', 'ldcovers', 'Do not look at the screen until you take the device.'));
      const go = el('button', 'btn-roll', `I'm ${cur.name}`);
      go.type = 'button';
      go.addEventListener('click', () => { view.cover = false; view.peeking = false; this.render(ui, view, session, ctx); });
      box.appendChild(go);
    }

    ui.hint.textContent = statusOverride(view, cur, over) || (over ? '' : cur.isBot ? `${cur.name} is thinking…` : view.reveal ? '' : shaking ? 'Shaking the cups…' : view.bid ? 'Raise the bid or call it' : 'Make the opening bid');

    // controls
    const staged = view.staged;
    const bidLabel = staged ? (staged.total !== undefined ? `BID ${staged.total}` : `BID ${bidText({ space: staged.space, face: staged.face }, wild).replace(/^a total of /, '')}`) : 'BID';
    renderTurnBar(ui.controls, [
      { label: bidLabel.toUpperCase().length > 22 ? 'BID' : bidLabel, cls: 'btn-roll', disabled: !human || !staged || shaking, onClick: () => { const a = { type: 'BID', ...(staged.total !== undefined ? { total: staged.total } : { space: staged.space, face: staged.face }) }; view.staged = null; ctx.act([a]); } },
      { label: THEME.call, cls: 'danger', disabled: !human || !canChallenge || shaking, onClick: () => { view.staged = null; ctx.act([{ type: 'CHALLENGE' }]); } },
    ]);
    fitDice(ui);
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let after = null;
    switch (ev.type) {
      case 'BID':
        view.bid = { ...ev.bid };
        view.banner = null;
        view.seats[ev.seat].turns += 1;
        view.staged = null;
        ctx.log(`${name(ev.seat)} ${THEME.bidWord} ${bidText(ev.bid, view.wild)}`);
        after = `${name(ev.seat)} ${THEME.bidWord} ${bidText(ev.bid, view.wild)}`;
        delay = 350;
        break;
      case 'CHALLENGED':
        view.banner = { text: `${name(ev.seat)}: ${THEME.call}`, good: false };
        ctx.vibrate();
        delay = ctx.reduced ? 300 : 900;
        break;
      case 'REVEALED': {
        // the matching dice light up one by one in seat order
        const order = {};
        let k = 0;
        ev.hands.forEach((h, i) => h.forEach((v, j) => { const hit = ev.bid.total === undefined && (ev.bid.kind === 'W' ? v === 1 : v === ev.bid.face || (view.wild && v === 1)); if (hit) { order[i + ':' + j] = k; k += 1; } }));
        view.reveal = { hands: ev.hands, bid: ev.bid, count: ev.count, valid: ev.valid, loser: ev.loser, order };
        view.banner = null;
        ctx.log(`${name(ev.seat)} called it: counted ${ev.count}; ${name(ev.loser)} loses ${ev.lost}`);
        delay = ctx.reduced || isFast() ? 600 : 700 + Math.min(10, k) * 170 + 1000;
        break;
      }
      case 'DICE_LOST':
        view.seats[ev.seat].dice = ev.left;
        view.banner = { text: `${name(ev.seat)} loses ${ev.n === 1 ? 'a die' : `${ev.n} dice`}` };
        ctx.announce(`${name(ev.seat)} loses ${ev.n === 1 ? 'a die' : `${ev.n} dice`}, ${ev.left} left`);
        delay = ctx.reduced ? 500 : 1100;
        break;
      case 'ELIMINATED':
        view.banner = { text: `${name(ev.seat)} is out!`, good: false };
        delay = ctx.reduced ? 400 : 900;
        break;
      case 'ROUND_STARTED':
        view.reveal = null;
        view.round = ev.round;
        view.hands = ev.hands.map((h) => h.slice());
        view.duel = ev.duel;
        view.bid = null;
        view.staged = null;
        view.peeking = false;
        view.shaking = true; // the cups shake; nothing about the new dice shows until they have settled
        view.banner = null;
        delay = ctx.reduced ? REVEAL_MS : SHAKE_MS;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.shaking = false;
        view.staged = null;
        if (view.multi) { view.peeking = false; if (!view.seats[ev.seat].isBot) view.cover = true; } // hand the device over
        delay = 150;
        break;
      case 'GAME_OVER':
        view.reveal = null;
        view.banner = { text: `${name(ev.winner)} wins!`, good: true };
        delay = ctx.reduced ? 200 : 600;
        break;
      default:
        break;
    }
    return { delay, tumble: false, after };
  },
};
