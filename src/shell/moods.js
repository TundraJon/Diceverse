// Bot moods and polite talk. Cosmetic only: the state lives here in the shell, is never saved, and never touches the
// rules, the game RNG or the bot's decisions. The views read it through the shell (the shell shows talk in a bubble and passes view.thinking and seat.face).
import { AI_ROSTER, dealLine } from '../ai/roster.js';
import { botIdOf, faceFor } from '../ui/avatars.js';

const MOOD_MS = 4000; // an outcome mood face (shocked, winning, relieved) stays this long
const TALK_MS = 3500; // a spoken line stays this long
const STALE_MS = 4000; // a line that waited longer than this for its turn to talk is dropped

// A "big" bank or score, per game (a bot's face goes to WINNING).
const BIG_BANK = { pig: 20, farkle: 1000, cliffhanger: 4, salvage: 5, plunder: 4, dive: 15 };
// A roll with this much at stake makes a bot nervous (Pig and Farkle: turn points; Cliffhanger: all three markers down;
// Shut the Box: 6 or less still open).
const STAKES = { pig: 20, farkle: 1000 };

export function createMoods({ sched, rand, redraw, announce, seatsOf }) {
  let mood = [];
  let token = [];
  let talk = null;
  let waiting = null;
  let thinking = null;
  let thinkingSeat = null; // the bot whose turn is being played (thinking lasts for the whole turn, not per action)
  let decks = {};
  let spoke = {};
  let wait = {}; // per bot: how many more of its own turns to stay quiet before it talks again
  let talkTurn = {};
  let nervous = {};
  let slot = 0;

  const botSeat = (i) => { const s = seatsOf()[i]; return s && s.isBot && botIdOf(s) ? s : null; };

  function reset() {
    mood = []; token = []; talk = null; waiting = null; thinking = null; thinkingSeat = null; decks = {}; spoke = {}; nervous = {}; wait = {}; talkTurn = {}; slot++;
  }

  function setMood(i, m) {
    if (!botSeat(i)) return;
    mood[i] = m;
    token[i] = (token[i] || 0) + 1;
    const t = token[i];
    // an outcome face fades back to what the bot is doing (thinking while its turn goes on, otherwise normal); nervous holds
    if (m !== 'DEFAULT' && m !== 'THINKING' && m !== 'NERVOUS') sched.after(MOOD_MS, () => { if (token[i] === t) { mood[i] = rest(i); redraw(); } });
    redraw();
  }
  const rest = (i) => (thinkingSeat === i ? 'THINKING' : 'DEFAULT');

  function startTalk(entry) {
    talk = entry;
    const mine = ++slot;
    announce(`${entry.name}: ${entry.line}`);
    redraw();
    sched.after(TALK_MS, () => {
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
    const line = dealLine(decks, id, m, rand);
    if (!line) return;
    const entry = { seat: i, name: s.name, line, at: Date.now(), final };
    if (!talk) startTalk(entry);
    else if (final || !waiting || !waiting.final) waiting = entry;
  }

  // A mood that comes from what happened: the face changes, and the bot says one line per turn of its own.
  // A bot talks on every second or third turn of its own (a talk turn); on other turns only its face changes.
  function spokeNow(i, m) {
    spoke[i] = true;
    wait[i] = 1 + (rand() % 2); // stay quiet for the next one or two of its own turns
    say(i, m);
  }
  function feel(i, m) {
    if (!botSeat(i)) return;
    setMood(i, m);
    if (talkTurn[i] && !spoke[i]) spokeNow(i, m);
  }

  // NERVOUS once per turn: the first roll with a lot at stake; it holds until an outcome or the end of the turn.
  function tense(i) {
    if (nervous[i]) return;
    nervous[i] = true;
    feel(i, 'NERVOUS');
  }

  const steps = (cols) => cols.reduce((a, c) => a + (c.to - c.from), 0);

  function onEvent(ev, gameId, view) {
    const i = ev.seat;
    switch (ev.type) {
      case 'TURN_STARTED':
        if (thinkingSeat !== null && thinkingSeat !== i) { thinking = null; thinkingSeat = null; }
        spoke[i] = false; nervous[i] = false;
        if (botSeat(i)) {
          if (wait[i] === undefined) wait[i] = rand() % 2; // its first line comes on its first or second turn
          talkTurn[i] = wait[i] <= 0;
          if (!talkTurn[i]) wait[i] -= 1;
        }
        setMood(i, 'DEFAULT');
        startThinking(i); // a bot is thinking from the moment its turn starts (no "is thinking…" flash before its first action)
        break;
      case 'TURN_ENDED':
        // the thinking line stays through the short gap until the next turn starts (no "is thinking…" flash between turns)
        if (mood[i] === 'THINKING' || mood[i] === 'NERVOUS') setMood(i, 'DEFAULT');
        if (botSeat(i) && talkTurn[i] && !spoke[i]) spokeNow(i, 'DEFAULT'); // a talk turn that gave no mood still gets a normal line
        break;
      case 'BUSTED': case 'FARKLED': case 'BLOWN': case 'NO_MOVE': case 'DICE_LOST':
        feel(i, 'SHOCKED');
        break;
      case 'COLUMN_WON': case 'BOX_SHUT': case 'CHALLENGE_WON':
        feel(i, 'WINNING');
        break;
      case 'BANKED': {
        const big = gameId === 'cliffhanger' ? steps(ev.cols) >= BIG_BANK.cliffhanger : (ev.amount || 0) >= (BIG_BANK[gameId] || Infinity);
        if (big) feel(i, 'WINNING');
        else if (nervous[i]) feel(i, 'RELIEVED'); // a bank after being nervous is a relief
        else setMood(i, rest(i));
        break;
      }
      case 'SCORED': {
        if (gameId === 'shutbox') { if (!ev.shut && ev.score <= 5) feel(i, 'WINNING'); break; }
        if (gameId === 'yacht') { if ((ev.points || 0) >= 25) feel(i, 'WINNING'); break; }
        const stake = STAKES[gameId];
        if (stake && (ev.turnPoints || 0) >= stake) tense(i);
        break;
      }
      case 'SHOT': // defensive fire one hit short of ending the turn makes a bot nervous
        if (gameId === 'salvage' && ev.fire === ev.limit - 1) tense(i);
        break;
      case 'MOVED':
        if (gameId === 'cliffhanger' && Object.keys(view.markers).length === 3) tense(i);
        break;
      case 'FLIPPED': {
        if (gameId !== 'shutbox') break;
        const open = view.tiles.reduce((a, t, k) => a + (t === 'open' ? k + 1 : 0), 0);
        if (open > 0 && open <= 6) tense(i);
        break;
      }
      case 'GAME_OVER': {
        thinking = null; thinkingSeat = null;
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

  // Thinking starts on a bot's first action of its turn and lasts until its turn ends (TURN_ENDED) or the game does:
  // the same line and the thinking face for the whole turn, not restarted for every roll and choice.
  function startThinking(i) {
    const s = botSeat(i);
    if (!s) { thinking = null; thinkingSeat = null; return; }
    if (thinkingSeat === i && thinking) return;
    const id = botIdOf(s);
    thinking = dealLine(decks, id, 'THINKING', rand) || AI_ROSTER[id].thinkingText;
    thinkingSeat = i;
    if (mood[i] !== 'NERVOUS') setMood(i, 'THINKING');
  }

  return {
    reset, onEvent, startThinking, say,
    faceOf: (i) => faceFor(seatsOf()[i], mood[i] || 'DEFAULT'),
    getTalk: () => (talk ? { seat: talk.seat, name: talk.name, line: talk.line } : null),
    getThinking: () => thinking,
  };
}
