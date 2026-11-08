// Bot moods and polite talk. Cosmetic only: the state lives here in the shell, is never saved, and never touches the
// rules, the game RNG or the bot's decisions. The views read it through the shell (view.talk / view.thinking / seat.face).
import { AI_ROSTER, pickLine } from '../ai/roster.js';
import { botIdOf, faceFor } from '../ui/avatars.js';

const MOOD_MS = 2500; // a mood face or a spoken line stays about this long
const STALE_MS = 4000; // a line that waited longer than this for its turn to talk is dropped

// A "big" bank or score, per game (a bot's face goes to WINNING).
const BIG_BANK = { pig: 20, farkle: 1000, cliffhanger: 4 };
// A roll with this much at stake makes a bot nervous (Pig and Farkle: turn points; Cliffhanger: all three markers down;
// Shut the Box: 6 or less still open).
const STAKES = { pig: 20, farkle: 1000 };

export function createMoods({ sched, rand, redraw, announce, seatsOf }) {
  let mood = [];
  let token = [];
  let talk = null;
  let waiting = null;
  let thinking = null;
  let last = {};
  let spoke = {};
  let hits = {};
  let slot = 0;

  const botSeat = (i) => { const s = seatsOf()[i]; return s && s.isBot && botIdOf(s) ? s : null; };

  function reset() {
    mood = []; token = []; talk = null; waiting = null; thinking = null; last = {}; spoke = {}; hits = {}; slot++;
  }

  function setMood(i, m) {
    if (!botSeat(i)) return;
    mood[i] = m;
    token[i] = (token[i] || 0) + 1;
    const t = token[i];
    if (m !== 'DEFAULT' && m !== 'THINKING') sched.after(MOOD_MS, () => { if (token[i] === t) { mood[i] = 'DEFAULT'; redraw(); } });
    redraw();
  }

  function startTalk(entry) {
    talk = entry;
    const mine = ++slot;
    announce(`${entry.name}: ${entry.line}`);
    redraw();
    sched.after(MOOD_MS, () => {
      if (slot !== mine) return;
      talk = null;
      const w = waiting;
      waiting = null;
      if (w && Date.now() - w.at <= STALE_MS) startTalk(w); else redraw();
    });
  }

  // One speech slot: only one bot talks at a time. A second line waits (only the newest waiting line is kept); a
  // game-over line (`final`) always gets its turn.
  function say(i, m, final = false) {
    const s = botSeat(i);
    if (!s) return;
    const id = botIdOf(s);
    const line = pickLine(id, m, rand(), last[id]);
    if (!line) return;
    last[id] = line;
    const entry = { name: s.name, line, at: Date.now(), final };
    if (!talk) startTalk(entry);
    else if (final || !waiting || !waiting.final) waiting = entry;
  }

  // A mood that comes from what happened: the face changes, and the bot says one line per turn of its own.
  function feel(i, m) {
    if (!botSeat(i)) return;
    setMood(i, m);
    if (!spoke[i]) { spoke[i] = true; say(i, m); }
  }

  const steps = (cols) => cols.reduce((a, c) => a + (c.to - c.from), 0);

  function onEvent(ev, gameId, view) {
    const i = ev.seat;
    switch (ev.type) {
      case 'TURN_STARTED':
        spoke[i] = false; hits[i] = 0;
        setMood(i, 'DEFAULT');
        if (botSeat(i) && rand() % 3 === 0) say(i, 'DEFAULT'); // now and then a bot greets the table
        break;
      case 'BUSTED': case 'FARKLED': case 'BLOWN': case 'NO_MOVE':
        feel(i, 'SHOCKED');
        break;
      case 'COLUMN_WON': case 'BOX_SHUT':
        feel(i, 'WINNING');
        break;
      case 'BANKED': {
        const big = gameId === 'cliffhanger' ? steps(ev.cols) >= BIG_BANK.cliffhanger : (ev.amount || 0) >= (BIG_BANK[gameId] || Infinity);
        if (big) feel(i, 'WINNING');
        else if (hits[i]) feel(i, 'RELIEVED');
        else setMood(i, 'DEFAULT');
        break;
      }
      case 'SCORED': {
        if (gameId === 'shutbox') { if (!ev.shut && ev.score <= 5) feel(i, 'WINNING'); break; }
        if (gameId === 'yacht') { if ((ev.points || 0) >= 25) feel(i, 'WINNING'); break; }
        const stake = STAKES[gameId];
        if (stake && (ev.turnPoints || 0) >= stake) { hits[i] = (hits[i] || 0) + 1; feel(i, hits[i] % 2 ? 'NERVOUS' : 'RELIEVED'); }
        break;
      }
      case 'MOVED':
        if (gameId === 'cliffhanger' && Object.keys(view.markers).length === 3) { hits[i] = (hits[i] || 0) + 1; feel(i, hits[i] % 2 ? 'NERVOUS' : 'RELIEVED'); }
        break;
      case 'FLIPPED': {
        if (gameId !== 'shutbox') break;
        const open = view.tiles.reduce((a, t, k) => a + (t === 'open' ? k + 1 : 0), 0);
        if (open > 0 && open <= 6) { hits[i] = (hits[i] || 0) + 1; feel(i, hits[i] % 2 ? 'NERVOUS' : 'RELIEVED'); }
        break;
      }
      case 'GAME_OVER': {
        const winners = ev.winners || (ev.winner !== null && ev.winner !== undefined ? [ev.winner] : []);
        const seats = seatsOf();
        seats.forEach((s, k) => { if (botSeat(k)) setMood(k, winners.includes(k) ? 'WINNING' : 'SHOCKED'); });
        const botWinner = winners.find((k) => botSeat(k));
        if (botWinner !== undefined) say(botWinner, 'WINNING', true);
        else { const k = seats.findIndex((s, n) => botSeat(n)); if (k >= 0) say(k, 'SHOCKED', true); }
        break;
      }
      default:
        break;
    }
  }

  function startThinking(i) {
    const s = botSeat(i);
    if (!s) { thinking = null; return; }
    const id = botIdOf(s);
    thinking = pickLine(id, 'THINKING', rand(), last[`${id}:t`]) || AI_ROSTER[id].thinkingText;
    last[`${id}:t`] = thinking;
    setMood(i, 'THINKING');
  }

  function stopThinking(i) {
    thinking = null;
    if (mood[i] === 'THINKING') setMood(i, 'DEFAULT');
  }

  return {
    reset, onEvent, startThinking, stopThinking, say,
    faceOf: (i) => faceFor(seatsOf()[i], mood[i] || 'DEFAULT'),
    getTalk: () => (talk ? { name: talk.name, line: talk.line } : null),
    getThinking: () => thinking,
  };
}
