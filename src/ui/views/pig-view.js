// Pig view: rendering and event presentation for the Pig screen.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderScoreStrip, renderTurnBar } from '../panels.js';
import { isMe, statusOverride } from '../avatars.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const seatsView = (state) => state.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns }));

export const pigView = {
  title: 'PIG',

  rulesSheet(sheet) {
    sheet.appendChild(el('h2', null, 'How to play Pig'));
    ['On your turn, roll the die as many times as you like.',
     'Each roll adds to your turn points, unless you roll a 1: you lose the turn points and your turn ends.',
     'Press BANK any time to add your turn points to your total and pass the die.',
     'First to reach the target wins.',
     'Two-dice option: a single 1 loses your turn points; double 1s also wipe your whole total.',
     'Equal turns option: when someone reaches the target, everyone gets the same number of turns, and the highest total wins.',
     'Solo: reach the target in as few turns as you can.']
      .forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h, mode) {
    return `Target ${h.target} · ${h.dice === 1 ? 'one die' : 'two dice'}${mode !== 'solo' && h.equalTurns ? ' · equal turns' : ''}`;
  },

  init(session) {
    return this.sync(null, session);
  },

  sync(_view, session) {
    const st = session.state;
    return { seats: seatsView(st), current: st.current, turnPoints: st.turn.points, dice: st.turn.dice.slice(), banner: '' };
  },

  build(ui) {
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    ui.dice = el('div', 'dice');
    ui.turnline = el('div', 'turnline');
    ui.table.append(ui.banner, ui.dice, ui.turnline);
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    renderScoreStrip(ui.scores, view.seats, view.current, view.turnPoints);
    ui.dice.innerHTML = '';
    ui.dice.className = 'dice' + (st.options.dice === 2 ? ' two' : '');
    for (let i = 0; i < st.options.dice; i++) {
      ui.dice.appendChild(renderDie(view.dice[i] ?? null, { tumble: ctx.tumble && !ctx.reduced }));
    }
    const cur = view.seats[view.current];
    ui.turnline.innerHTML = '';
    const said = statusOverride(view, cur, session.isOver());
    if (said) ui.turnline.textContent = said;
    else if (!session.isOver()) {
      if (isMe(cur)) ui.turnline.append(document.createTextNode('Your turn'));
      else ui.turnline.append(el('strong', null, cur.name), document.createTextNode(cur.isBot ? ' is thinking…' : "'s turn"));
    }
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner;
    const humanTurn = !session.isOver() && !cur.isBot && !ctx.busy;
    renderTurnBar(ui.controls, [
      { label: 'ROLL', cls: 'btn-roll', disabled: !humanTurn, onClick: () => ctx.act([{ type: 'ROLL' }]) },
      { label: 'BANK', cls: 'btn-bank', disabled: !(humanTurn && st.turn.points > 0 && view.turnPoints > 0), onClick: () => ctx.act([{ type: 'BANK' }]) },
    ]);
  },

  // Mutates the view for one event; returns how long to show it and whether dice tumble.
  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'ROLLED':
        view.dice = ev.dice.slice();
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS; // nothing result-dependent shows until the dice have stopped and 0.25 s have passed
        after = `${name(ev.seat)} rolled ${ev.dice.join(' and ')}`; // spoken once the dice have settled
        break;
      case 'SCORED':
        view.turnPoints = ev.turnPoints;
        ctx.log(`${name(ev.seat)} +${ev.gain} (turn ${ev.turnPoints})`);
        delay = 250;
        break;
      case 'BUSTED':
        view.turnPoints = 0;
        view.banner = ev.reset ? 'DOUBLE ONES! TOTAL RESET' : ev.lost > 0 ? `BUST! −${ev.lost}` : 'BUST!';
        if (ev.reset) view.seats[ev.seat].total = 0;
        ctx.log(`${name(ev.seat)} busted${ev.reset ? ' and lost their total' : ''}`);
        ctx.announce(`${name(ev.seat)} busted`);
        ctx.vibrate();
        delay = ctx.reduced ? 600 : 1200;
        break;
      case 'BANKED':
        view.turnPoints = 0;
        view.seats[ev.seat].total = ev.total;
        ctx.log(`${name(ev.seat)} banked ${ev.amount} (total ${ev.total})`);
        ctx.announce(`${name(ev.seat)} banked ${ev.amount}, total ${ev.total}`);
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
      default:
        break;
    }
    return { delay, tumble, after };
  },
};
