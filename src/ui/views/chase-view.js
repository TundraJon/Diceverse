// Dice Chase view: the row of dice, the fairy that hops along it, the action die and the key of what each picture is worth.
// Nothing that depends on a roll shows until the dice have stopped and a short pause has passed (the `ROW_ROLLED` and `ACTION_ROLLED` events wait SETTLE_MS before
// the next event moves the fairy, changes the points or says what happened): while a die is rolling the fairy stays, no die is dimmed or lit, and the
// buttons are off; the next presentation step (or the redraw from the game state at the end) shows the result.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderScoreStrip, renderTurnBar } from '../panels.js';
import { isMe, statusOverride } from '../avatars.js';
import { pointsOf, SURGE } from '../../games/chase.js';
import { ROW_IMAGES, ROW_LABELS, ACT_IMAGES, ACT_LABELS, IMG, ensureChaseCss } from '../chase-art.js';
import { TONE_COLORS } from '../avatars.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const BANNER_MS = 2500; // every banner stays at least this long
// The fairy's colors. Dress: the player's color. Skin: the skin tone chosen in the player's face (a skin-tone mark in the emoji); the blue of the default 👤 when no tone
// is chosen. A bot's skin follows its usual face: yellow (🙂 🖐️), silver (🤖 👽), blue (🏛️ 👁️) or green (🎲). Hair: the hair of the player's face (blond, red, dark curly,
// white or grey, plain faces dark brown; a bald face takes the dress color); a bot has blond hair. (The shades are my choice.)
const DEFAULT_DRESS = '#3b82f6';
const SKIN = { yellow: '#f7d56a', silver: '#c0c8d0', blue: '#6b8fc7', green: '#8cc084' };
const HAIR = { blond: '#f5d76e', red: '#c8501f', dark: '#4a2f1b', white: '#e5e7eb', plain: '#5a3a22' };
const has = (str, ...cps) => cps.some((cp) => str.includes(String.fromCodePoint(cp)));
function fairyColors(opt, dress) {
  const face = typeof opt.avatar === 'string' ? opt.avatar : '';
  if (opt.isBot) {
    const skin = has(face, 0x1F642, 0x1F590) ? SKIN.yellow : has(face, 0x1F3DB, 0x1F441) ? SKIN.blue : has(face, 0x1F3B2) ? SKIN.green : SKIN.silver; // (a bot with an unknown face is silver, like 🤖)
    return { skin, hair: HAIR.blond };
  }
  const m = face.match(/[\u{1F3FB}-\u{1F3FF}]/u);
  const skin = m ? TONE_COLORS[m[0].codePointAt(0) - 0x1F3FB + 1] : SKIN.blue;
  const hair = has(face, 0x1F9B2) ? dress : has(face, 0x1F9B0) ? HAIR.red : has(face, 0x1F9B1) ? HAIR.dark : has(face, 0x1F9B3, 0x1F474, 0x1F475, 0x1F9D3) ? HAIR.white : has(face, 0x1F471) ? HAIR.blond : HAIR.plain;
  return { skin, hair };
}
const seatsView = (st) => st.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns }));
const rowDie = (face, ctx, tumble) => renderDie(face, { tumble: !!tumble && !ctx.reduced, cls: 'cream', images: ROW_IMAGES, labels: ROW_LABELS });
const actDie = (face, ctx, tumble) => renderDie(face, { tumble: !!tumble && !ctx.reduced, cls: 'cream', images: ACT_IMAGES, labels: ACT_LABELS });
const rowNames = (row) => row.map((f) => ROW_LABELS[f - 1]).join(', ');
const ACTION_TEXT = ['jump to the next Ice die', 'jump to the next Leaf die', 'jump to the next Water die', 'jump to the next Fire die', 'jump to the next special die', `Surge: +${SURGE} points`];

export const chaseView = {
  title: 'DICE CHASE',

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Dice Chase'));
    [`Roll the row: ${options && options.row ? options.row : 8} dice in a line. Four of the pictures are colours: Ice is worth 1, Leaf 2, Water 3 and Fire 4. A star die (Sweep) and a x2 die are worth 2 each.`,
     'Your fairy starts before the first die. Each step, roll the action die. Ice, Leaf, Water or Fire: the fairy jumps to the next die on its right with that colour. Special: it jumps to the next star or x2 die. Surge: you get 3 points and the fairy stays.',
     'When the fairy lands, you score that die. Dice it jumped over score nothing.',
     'Land on a star die and your next jump scores every die it jumps over too. Land on a x2 die and your next jump scores double.',
     'After each step, stop and keep the points of this turn, or roll again. If the action die has nothing to jump to, you bust and lose the points of this turn. Your first roll of a turn is never wasted: if it has nothing to jump to, it is rolled again.',
     'If the fairy lands on the last die, the turn ends and you keep the points.',
     'When a player reaches the target, everyone gets the same number of turns. The most points wins. A tie is shared.',
     'Solo: reach the target in as few turns as you can.']
      .forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h) {
    return `${h.row} dice · target ${h.target}`;
  },

  init(session) {
    return this.sync(null, session);
  },

  // The view from the game state (nothing is in the middle of a roll here).
  sync(old, session) {
    const st = session.state;
    const t = st.turn;
    return {
      seats: seatsView(st),
      current: st.current,
      target: st.options.target,
      size: st.options.row,
      phase: st.winner !== null ? 'over' : t.phase,
      row: t.row.slice(),
      pos: t.pos,
      points: st.winner !== null ? 0 : t.points,
      sweep: t.sweep,
      x2: t.x2,
      rolls: t.rolls,
      action: t.last,
      banner: null,
      note: '',
    };
  },

  build(ui) {
    ensureChaseCss();
    ui.table.classList.add('chtable');
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    ui.key = el('div', 'chkey');
    ui.board = el('div', 'chbox');
    ui.lane = el('div', 'chlane');
    const NS = 'http://www.w3.org/2000/svg'; // the fairy is drawn from the sprite so its colors can change (see chase-art.js)
    ui.fairy = document.createElementNS(NS, 'svg');
    ui.fairy.setAttribute('class', 'chfairy');
    ui.fairy.setAttribute('role', 'img');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#chf-fairy');
    use.setAttribute('width', '100%');
    use.setAttribute('height', '100%');
    ui.fairy.appendChild(use);
    ui.lane.appendChild(ui.fairy);
    ui.rowBox = el('div', 'chrow');
    ui.board.append(ui.lane, ui.rowBox);
    ui.status = el('div', 'chstatus');
    ui.actionBox = el('div', 'chbox chaction');
    ui.turnline = el('div', 'turnline');
    ui.table.append(ui.banner, ui.key, ui.board, ui.status, ui.actionBox, ui.turnline);
  },

  render(ui, view, session, ctx) {
    const over = session.isOver();
    const cur = view.seats[view.current];
    renderScoreStrip(ui.scores, view.seats, view.current, view.points, undefined, { target: view.target });
    const human = !over && !cur.isBot && !ctx.busy;
    const n = view.size;
    const rowRolling = view.phase === 'rowroll';
    const actRolling = view.phase === 'actionroll';

    // the key: what each picture is worth
    ui.key.innerHTML = '';
    [1, 2, 3, 4].forEach((f) => {
      const k = el('span', 'chk');
      k.append(el('i', `chkico ${ROW_IMAGES[f - 1]}`), el('b', null, `${ROW_LABELS[f - 1]} ${pointsOf(f)}`));
      ui.key.appendChild(k);
    });
    const sp = el('span', 'chk');
    sp.append(el('i', `chkico ${IMG.star}`), el('b', null, 'Sweep 2'), el('i', `chkico ${IMG.x2}`), el('b', null, 'x2 2'));
    ui.key.appendChild(sp);

    // the row and the fairy (the fairy is one element, so it can hop; the row is drawn again)
    ui.board.style.setProperty('--n', String(n + 1));
    ui.rowBox.innerHTML = '';
    const flag = el('span', 'chstart', '\u2691'); // a flag marks the start (the fairy's label says so for the screen reader)
    flag.setAttribute('aria-hidden', 'true');
    ui.rowBox.appendChild(flag);
    for (let i = 0; i < n; i++) {
      if (view.row.length) {
        const cell = el('span', 'chcell' + (!rowRolling && view.pos >= 0 && i < view.pos ? ' behind' : '') + (!rowRolling && i === view.pos ? ' here' : ''));
        cell.appendChild(rowDie(view.row[i], ctx, rowRolling && ctx.tumble));
        ui.rowBox.appendChild(cell);
      } else {
        const cell = el('span', 'chcell');
        cell.appendChild(renderDie(null, { cls: 'cream', images: ROW_IMAGES, labels: ROW_LABELS }));
        ui.rowBox.appendChild(cell);
      }
    }
    const col = rowRolling || view.row.length === 0 ? 0 : view.pos + 1;
    ui.fairy.style.left = `${((col + 0.5) / (n + 1)) * 100}%`;
    ui.fairy.setAttribute('class', `chfairy${view.sweep ? ' sweep' : ''}${view.x2 ? ' x2' : ''}${ctx.reduced ? ' still' : ''}`);
    const seatOpt = (session.options.seats || [])[view.current] || {};
    const dressColor = seatOpt.color || DEFAULT_DRESS;
    const fc = fairyColors(seatOpt, dressColor);
    ui.fairy.style.setProperty('--dress', dressColor);
    ui.fairy.style.setProperty('--skin', fc.skin);
    ui.fairy.style.setProperty('--hair', fc.hair);
    ui.fairy.setAttribute('aria-label', view.pos < 0 ? 'Fairy, at the start' : `Fairy, on die ${view.pos + 1} of ${n}`);

    // what is armed and what the turn has so far (these change only after the dice have settled)
    ui.status.innerHTML = '';
    if (!over && view.phase !== 'lay' && !rowRolling && !actRolling) {
      ui.status.appendChild(el('span', 'chpts', `This turn: ${view.points}`));
      if (view.sweep) ui.status.appendChild(el('span', 'chtag', 'Sweep ready'));
      if (view.x2) ui.status.appendChild(el('span', 'chtag', 'x2 ready'));
    }

    // the action die
    ui.actionBox.innerHTML = '';
    ui.actionBox.appendChild(el('div', 'mdlab', 'Action die'));
    const line = el('div', 'chactline');
    line.appendChild(view.action && view.phase !== 'lay' && !rowRolling ? actDie(view.action, ctx, actRolling && ctx.tumble) : renderDie(null, { cls: 'cream', images: ACT_IMAGES, labels: ACT_LABELS }));
    line.appendChild(el('span', 'chacttext', actRolling ? '' : view.phase === 'lay' || rowRolling || !view.action ? 'Roll it to jump' : ACTION_TEXT[view.action - 1]));
    ui.actionBox.appendChild(line);

    ui.turnline.innerHTML = '';
    const said = statusOverride(view, cur, over);
    if (said) ui.turnline.textContent = said;
    else if (!over) {
      if (view.note) ui.turnline.textContent = view.note;
      else if (isMe(cur)) ui.turnline.append(document.createTextNode(view.phase === 'lay' ? 'Your turn: roll the row' : 'Your turn'));
      else ui.turnline.append(el('strong', null, cur.name), document.createTextNode(cur.isBot ? ' is thinking…' : "'s turn"));
    }
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner' + (view.banner && view.banner.good ? ' hot' : '');

    // the buttons at the bottom
    if (view.phase === 'lay') {
      renderTurnBar(ui.controls, [{ label: 'ROLL THE ROW', cls: 'btn-roll span2', disabled: !human, onClick: () => ctx.act([{ type: 'LAY' }]) }]);
    } else {
      const deciding = view.phase === 'decide';
      renderTurnBar(ui.controls, [
        { label: 'ROLL', cls: 'btn-roll', disabled: !(human && deciding), onClick: () => ctx.act([{ type: 'ROLL' }]) },
        { label: deciding && view.rolls > 0 ? `STOP (${view.points})` : 'STOP', cls: 'btn-bank', disabled: !(human && deciding && view.rolls > 0), onClick: () => ctx.act([{ type: 'STOP' }]) },
      ]);
    }
  },

  // Mutates the view for one event; returns how long to show it and whether dice tumble.
  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    const verb = (s, one, many) => (name(s) === 'You' ? many : one); // "You bank", "Ann banks"
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.phase = 'lay';
        view.row = [];
        view.pos = -1;
        view.points = 0;
        view.sweep = false;
        view.x2 = false;
        view.rolls = 0;
        view.action = null;
        view.banner = null;
        view.note = '';
        delay = ctx.reduced ? 150 : 300;
        break;
      case 'ROW_ROLLED':
        view.phase = 'rowroll'; // nothing from this roll shows until the dice have settled
        view.row = ev.row.slice();
        view.pos = -1;
        view.note = '';
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS;
        after = `${name(ev.seat)} rolled the row: ${rowNames(ev.row)}`; // spoken once the dice have settled
        break;
      case 'ACTION_ROLLED':
        view.phase = 'actionroll';
        view.action = ev.face;
        view.note = '';
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS;
        after = `Action die: ${ACT_LABELS[ev.face - 1]}`;
        break;
      case 'JUMPED':
        view.phase = 'decide';
        view.rolls += 1;
        view.pos = ev.to;
        view.points = ev.points;
        view.sweep = ev.sweepArmed;
        view.x2 = ev.x2Armed;
        view.note = `+${ev.gain}${ev.doubled ? ' (doubled)' : ''}${ev.skipped > 0 ? ` (swept ${ev.skipped} ${ev.skipped === 1 ? 'die' : 'dice'})` : ''}`;
        ctx.announce(`${name(ev.seat)} ${verb(ev.seat, 'jumps', 'jump')} to die ${ev.to + 1} and ${verb(ev.seat, 'scores', 'score')} ${ev.gain}`);
        delay = ctx.reduced ? 250 : 650; // the fairy hops
        break;
      case 'SURGE':
        view.phase = 'decide';
        view.rolls += 1;
        view.points = ev.points;
        view.note = `Surge! +${ev.gain}`;
        ctx.announce(`${name(ev.seat)} ${verb(ev.seat, 'surges', 'surge')} for ${ev.gain}`);
        delay = ctx.reduced ? 250 : 600;
        break;
      case 'NO_TARGET':
        view.phase = 'decide';
        view.note = 'Nothing to jump to!';
        delay = ctx.reduced ? 500 : 900;
        break;
      case 'ROW_DONE':
        view.note = 'The fairy reached the last die';
        delay = ctx.reduced ? 250 : 500;
        break;
      case 'TURN_SCORED':
        view.seats[ev.seat].total = ev.total;
        view.points = 0;
        view.sweep = false;
        view.x2 = false;
        view.banner = ev.bust
          ? { text: `BUST! ${name(ev.seat)} ${verb(ev.seat, 'loses', 'lose')} ${ev.lost}`, good: false }
          : { text: ev.gain > 0 ? `${name(ev.seat)} ${verb(ev.seat, 'banks', 'bank')} ${ev.gain}` : `${name(ev.seat)}: 0 points`, good: ev.gain > 0 };
        ctx.announce(ev.bust ? `${name(ev.seat)} ${verb(ev.seat, 'busts', 'bust')} and ${verb(ev.seat, 'loses', 'lose')} ${ev.lost}` : `${name(ev.seat)} ${verb(ev.seat, 'banks', 'bank')} ${ev.gain}`);
        if (ev.bust) ctx.vibrate();
        delay = ctx.reduced ? 1500 : BANNER_MS;
        break;
      case 'TURN_ENDED':
        view.seats[ev.seat].turns += 1;
        view.banner = null;
        break;
      case 'GAME_OVER':
        view.banner = { text: ev.winners.length > 1 ? `${ev.winners.map(name).join(' and ')} share the win!` : `${name(ev.winner)} ${verb(ev.winner, 'wins', 'win')}!`, good: true };
        delay = ctx.reduced ? 200 : 600;
        break;
      default:
        break;
    }
    if (ev.type !== 'ROW_ROLLED' && ev.type !== 'ACTION_ROLLED') view.settling = false;
    return { delay, tumble, after };
  },
};
