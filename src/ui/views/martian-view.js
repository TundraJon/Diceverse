// Martian Dice view: the dice tray, what is set aside, the "keep" buttons and the Death Ray Duel.
// Nothing that depends on a roll shows until the dice have stopped and a short pause has passed (the `ROLLED` event waits SETTLE_MS before the next event
// updates anything): the tanks move, the counts and the score appear in the events after it, and the "keep" buttons come back when the screen is redrawn
// from the game state at the end of the presentation.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderScoreStrip, renderTurnBar } from '../panels.js';
import { isMe, statusOverride } from '../avatars.js';
import { FACES, DICE, availableTypes, turnScore } from '../../games/martian.js';
import { FACE_CLASSES, NAMES, PLURAL, ensureMartianCss } from '../martian-art.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

const BANNER_MS = 2500; // every banner stays at least this long
const BOTS_DUEL_MS = 1000; // a duel with only bots in it is quicker
const TYPES = ['tank', 'ray', 'cow', 'chicken', 'human']; // the order of the dice set aside
const TYPE_FACE = { ray: 1, cow: 2, human: 3, chicken: 4, tank: 5 }; // a face number that shows each type
const LABELS = FACES.map((t) => NAMES[t]);
const KEEP_TYPES = ['ray', 'cow', 'chicken', 'human'];

const seatsView = (st) => st.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns, got: { ...s.got } }));
const KINDS = ['chicken', 'cow', 'human']; // what is collected in the Collect mode (alphabetical, as on the result screen)
const addText = (added) => KINDS.filter((t) => added[t] > 0).map((t) => `+${added[t]} ${added[t] === 1 ? NAMES[t] : PLURAL[t]}`).join(', ');
const zero = () => ({ tank: 0, ray: 0, cow: 0, chicken: 0, human: 0 });
const faceType = (f) => FACES[f - 1];
const listOf = (dice) => {
  const c = {};
  dice.forEach((f) => { c[faceType(f)] = (c[faceType(f)] || 0) + 1; });
  return TYPES.filter((t) => c[t]).map((t) => `${c[t]} ${c[t] === 1 ? NAMES[t] : PLURAL[t]}`).join(', ');
};
// Collect mode: instead of one total, each player card shows cows, chickens and humans collected so far out of the goal (a full one is marked), and what
// the turn in play would add (after the dice have settled).
function renderGoalChips(container, view, add) {
  container.innerHTML = '';
  container.className = 'scores' + (view.seats.length === 1 ? ' one' : '');
  view.seats.forEach((s, i) => {
    const chip = el('div', 'chip' + (i === view.current ? ' active' : ''));
    const name = el('div', 'name');
    name.append(el('span', null, `${s.face || (s.isBot ? '\u{1F916}' : '\u{1F464}')} ${s.name}`), el('span', null, `${s.turns} turn${s.turns === 1 ? '' : 's'}`));
    const row = el('div', 'mdgot');
    KINDS.forEach((t) => {
      const full = s.got[t] >= view.each;
      const item = el('span', 'mdgi' + (full ? ' full' : ''));
      item.append(el('i', `mdgico mdsym-${t}`), el('b', null, `${Math.min(s.got[t], view.each)}/${view.each}`));
      row.appendChild(item);
    });
    chip.setAttribute('aria-label', `${s.name}: ${KINDS.map((t) => `${PLURAL[t]} ${Math.min(s.got[t], view.each)} of ${view.each}`).join(', ')}`);
    chip.append(name, row, el('div', 'tp', i === view.current && add ? add : ''));
    container.appendChild(chip);
  });
}
const dieOf = (face, ctx, tumble) => renderDie(face, { tumble: !!tumble && !ctx.reduced, cls: 'cream', images: FACE_CLASSES, labels: LABELS });

export const martianView = {
  title: 'MARTIAN DICE',

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Martian Dice'));
    ['You have 13 dice. Each die shows a tank, a death ray (two faces), a cow, a chicken or a human.',
     'Roll all your dice. The tanks you roll are always set aside.',
     'Then pick ONE other type and set aside ALL the dice of that type. Death rays can be picked any time. You can pick cows, chickens and humans only once each in a turn.',
     'If you cannot pick a type, your turn is over. If you can, roll the dice that are left, or stop.',
     'Score: if you have more tanks than death rays, you score 0. If not, each cow, chicken and human is 1 point, and you get 3 more if you have all three kinds.',
     'When a player reaches the target, everyone gets the same number of turns. The most points wins. A tie is settled by the Death Ray Duel: each tied player rolls 6 dice, and more death rays wins.',
     'Solo: reach the target in as few turns as you can.']
      .forEach((t) => sheet.appendChild(el('p', null, t)));
    if (options && options.stranded === 'zero') sheet.appendChild(el('p', null, 'House rule, Stranded: if you roll and cannot set anything aside, the turn scores nothing (in Collect mode it adds nothing).'));
    if (options && options.goal === 'collect') sheet.appendChild(el('p', null, `House rule, Collect: there are no points. A turn that is not a bust adds the cows, chickens and humans you set aside to your counts. The first player with ${options.each} of each wins (everyone gets the same number of turns; a tie is settled by the Death Ray Duel).`));
  },

  // The result line of a player when the game is over: in Collect mode the pictures of what was collected (chickens, cows, humans: alphabetical), then the turns.
  resultLine(r, options) {
    if (options.goal !== 'collect' || !r.got) return null;
    const one = (n, t) => `${n} ${n === 1 ? NAMES[t] : PLURAL[t]}`;
    const box = el('span', 'mdres');
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', `${one(r.got.chicken, 'chicken')}, ${one(r.got.cow, 'cow')}, ${one(r.got.human, 'human')}, ${r.turns} turns`);
    ['chicken', 'cow', 'human'].forEach((t) => {
      const g = el('span', 'mdresi');
      g.setAttribute('aria-hidden', 'true');
      g.append(el('i', `mdgico mdsym-${t}`), el('b', null, String(r.got[t])));
      box.appendChild(g);
    });
    const turns = el('span', 'mdresturns', `\u00B7 ${r.turns} turns`);
    turns.setAttribute('aria-hidden', 'true');
    box.appendChild(turns);
    return box;
  },

  summary(h) {
    return `${h.goal === 'collect' ? `Collect ${h.each} of each` : `Target ${h.target}`}${h.stranded === 'zero' ? ' \u00B7 stranded scores nothing' : ''}`;
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
      collect: st.options.goal === 'collect',
      stranded: st.options.stranded === 'zero',
      each: st.options.each,
      phase: st.winner !== null ? 'over' : st.duel ? 'duel' : t.phase,
      kept: { ...t.kept },
      used: { ...t.used },
      left: t.left,
      rolled: t.phase === 'choose' ? t.rolled.filter((f) => faceType(f) !== 'tank') : [], // the dice to pick from
      pending: t.pending.slice(),
      turnPoints: t.phase === 'roll' || st.winner !== null ? 0 : turnScore(t.kept).gain, // (nothing is "in play" once the game is over)
      duel: st.duel ? (old && old.duel && old.duel.rolls ? old.duel : { seats: st.duel.seats.slice(), rolls: null, counts: false }) : null, // the last duel roll stays on show (until the next one, or behind the result sheet)
      banner: null,
      note: '',
    };
  },

  build(ui) {
    ensureMartianCss();
    ui.table.classList.add('mdtable');
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    ui.keptBox = el('div', 'mdbox mdkept');
    ui.rolledBox = el('div', 'mdbox mdrolled');
    ui.duelBox = el('div', 'mdbox mdduel');
    ui.choose = el('div', 'mdchoose');
    ui.turnline = el('div', 'turnline');
    ui.table.append(ui.banner, ui.keptBox, ui.rolledBox, ui.duelBox, ui.choose, ui.turnline);
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const over = session.isOver();
    const cur = view.seats[view.current];
    if (view.collect) renderGoalChips(ui.scores, view, view.turnPoints > 0 ? addText(view.kept) : '');
    else renderScoreStrip(ui.scores, view.seats, view.current, view.turnPoints, undefined, { target: view.target });
    const duel = !!view.duel; // (the game state is already over while the last banners show, so this does not look at `over`)
    const human = !over && !cur.isBot && !ctx.busy;

    // what is set aside this turn, grouped by type
    ui.keptBox.hidden = duel;
    ui.keptBox.innerHTML = '';
    if (!duel) {
      ui.keptBox.appendChild(el('div', 'mdlab', 'Set aside this turn'));
      const row = el('div', 'mddice kept');
      TYPES.forEach((t) => { for (let i = 0; i < view.kept[t]; i++) row.appendChild(dieOf(TYPE_FACE[t], ctx, false)); });
      if (!row.children.length) row.appendChild(el('span', 'mdnone', 'Nothing yet'));
      ui.keptBox.appendChild(row);
    }

    // the dice just rolled (or empty slots for the dice that are left to roll)
    ui.rolledBox.hidden = duel;
    ui.rolledBox.innerHTML = '';
    if (!duel) {
      const rolling = view.rolled.length > 0;
      ui.rolledBox.appendChild(el('div', 'mdlab', rolling ? 'Just rolled' : `${view.left} dice to roll`));
      const row = el('div', 'mddice');
      if (rolling) view.rolled.forEach((f) => row.appendChild(dieOf(f, ctx, ctx.tumble)));
      else for (let i = 0; i < view.left; i++) row.appendChild(renderDie(null, { cls: 'cream', images: FACE_CLASSES, labels: LABELS }));
      ui.rolledBox.appendChild(row);
    }

    // the Death Ray Duel
    ui.duelBox.hidden = !duel;
    ui.duelBox.innerHTML = '';
    if (duel) {
      ui.duelBox.appendChild(el('div', 'mdlab', 'Death Ray Duel: more death rays wins'));
      view.duel.seats.forEach((i) => {
        const line = el('div', 'mdduelrow');
        line.appendChild(el('span', 'mdduelname', `${view.seats[i].face || (view.seats[i].isBot ? '\u{1F916}' : '\u{1F464}')} ${view.seats[i].name}`));
        const row = el('div', 'mddice kept');
        const roll = view.duel.rolls && view.duel.rolls.find((r) => r.seat === i);
        if (roll) roll.dice.forEach((f) => row.appendChild(dieOf(f, ctx, ctx.tumble)));
        else for (let k = 0; k < 6; k++) row.appendChild(renderDie(null, { cls: 'cream', images: FACE_CLASSES, labels: LABELS }));
        line.appendChild(row);
        if (roll && view.duel.counts) line.appendChild(el('b', 'mdduelrays', `${roll.rays} death ${roll.rays === 1 ? 'ray' : 'rays'}`));
        ui.duelBox.appendChild(line);
      });
    }

    // the four "keep" buttons: only while you must pick, and only after the dice have settled
    ui.choose.hidden = !(view.phase === 'choose' && !over && !cur.isBot);
    ui.choose.innerHTML = '';
    if (!ui.choose.hidden) {
      ui.choose.appendChild(el('div', 'mdlab', 'Pick ONE type to set aside'));
      const grid = el('div', 'mdkeep');
      const avail = availableTypes({ pending: view.pending, used: view.used });
      KEEP_TYPES.forEach((t) => {
        const count = view.pending.filter((x) => x === t).length;
        const ok = human && avail.includes(t);
        const b = el('button', 'mdkeepbtn');
        b.type = 'button';
        b.disabled = !ok;
        b.setAttribute('aria-label', count === 0 ? `${PLURAL[t]}: none rolled` : t !== 'ray' && view.used[t] ? `${PLURAL[t]}: already set aside this turn` : `Set aside ${count} ${count === 1 ? NAMES[t] : PLURAL[t]}`);
        b.append(el('span', `mdico mdsym-${t}`), el('span', 'mdkn', PLURAL[t]), el('b', 'mdkc', count === 0 ? '–' : `×${count}`));
        b.addEventListener('click', () => ctx.act([{ type: 'KEEP', face: t }]));
        grid.appendChild(b);
      });
      ui.choose.appendChild(grid);
    }

    ui.turnline.innerHTML = '';
    const said = statusOverride(view, cur, over);
    if (said) ui.turnline.textContent = said;
    else if (!over) {
      if (view.note) ui.turnline.textContent = view.note;
      else if (duel) ui.turnline.textContent = 'Tied: settle it with the Death Ray Duel';
      else if (isMe(cur)) ui.turnline.append(document.createTextNode(view.phase === 'choose' ? 'Pick one type' : 'Your turn'));
      else ui.turnline.append(el('strong', null, cur.name), document.createTextNode(cur.isBot ? ' is thinking…' : (view.phase === 'choose' ? ': pick one type' : "'s turn")));
    }
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner' + (view.banner && view.banner.good ? ' hot' : '');

    // the buttons at the bottom
    if (duel) {
      renderTurnBar(ui.controls, [{ label: 'DEATH RAY DUEL', cls: 'btn-roll span2', disabled: !human, onClick: () => ctx.act([{ type: 'DUEL' }]) }]);
    } else if (view.phase === 'roll') {
      renderTurnBar(ui.controls, [{ label: `ROLL ${view.left} DICE`, cls: 'btn-roll span2', disabled: !human, onClick: () => ctx.act([{ type: 'ROLL' }]) }]);
    } else {
      const deciding = view.phase === 'decide';
      renderTurnBar(ui.controls, [
        { label: deciding ? `ROLL AGAIN (${view.left})` : 'ROLL AGAIN', cls: 'btn-roll', disabled: !(human && deciding), onClick: () => ctx.act([{ type: 'ROLL' }]) },
        { label: deciding ? `STOP (${turnScore(view.kept).gain})` : 'STOP', cls: 'btn-bank', disabled: !(human && deciding), onClick: () => ctx.act([{ type: 'STOP' }]) },
      ]);
    }
  },

  // Mutates the view for one event; returns how long to show it and whether dice tumble.
  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.phase = 'roll';
        view.kept = zero();
        view.used = { cow: false, chicken: false, human: false };
        view.left = DICE;
        view.rolled = [];
        view.pending = [];
        view.turnPoints = 0;
        view.banner = null;
        view.note = '';
        delay = ctx.reduced ? 150 : 300;
        break;
      case 'ROLLED':
        view.phase = 'rolling'; // nothing from this roll shows until the dice have settled
        view.rolled = ev.dice.slice();
        view.note = '';
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS;
        after = `${name(ev.seat)} rolled ${listOf(ev.dice)}`; // spoken once the dice have settled
        break;
      case 'TANKS_KEPT':
        view.kept.tank = ev.tanks;
        view.left -= ev.count;
        view.rolled = view.rolled.filter((f) => faceType(f) !== 'tank');
        view.turnPoints = turnScore(view.kept).gain;
        delay = ctx.reduced ? 250 : 600;
        break;
      case 'NO_KEEP':
        view.note = view.stranded ? 'Stranded: nothing can be set aside' : 'Nothing can be set aside: the turn is over';
        delay = ctx.reduced ? 500 : 1000;
        break;
      case 'KEPT':
        view.kept[ev.face] += ev.count;
        if (ev.face !== 'ray') view.used[ev.face] = true;
        view.left = ev.left;
        view.rolled = [];
        view.pending = [];
        view.phase = 'decide';
        view.turnPoints = turnScore(view.kept).gain;
        ctx.announce(`${name(ev.seat)} set aside ${ev.count} ${ev.count === 1 ? NAMES[ev.face] : PLURAL[ev.face]}`);
        delay = ctx.reduced ? 250 : 500;
        break;
      case 'TURN_SCORED': {
        view.seats[ev.seat].total = ev.total;
        if (ev.got) view.seats[ev.seat].got = { ...ev.got }; // Collect mode
        view.turnPoints = 0;
        const bonus = ev.bonus ? ' (3 bonus)' : '';
        if (ev.stranded) { // the Stranded rule took what the turn had
          view.banner = { text: view.collect ? `STRANDED! ${name(ev.seat)} adds nothing` : `STRANDED! ${name(ev.seat)} scores 0`, good: false };
          ctx.announce(`${name(ev.seat)} is stranded: nothing can be set aside, ${view.collect ? 'nothing added' : 'no points'}`);
          ctx.vibrate();
        } else if (view.collect) {
          const txt = ev.added ? addText(ev.added) : '';
          view.banner = ev.bust
            ? { text: `TANKS WIN! ${name(ev.seat)} adds nothing`, good: false }
            : { text: txt ? `${name(ev.seat)}: ${txt}` : `${name(ev.seat)}: nothing added`, good: !!txt };
          ctx.announce(ev.bust ? `${name(ev.seat)}: more tanks than death rays, nothing added` : `${name(ev.seat)} ${txt ? `added ${txt.replace(/\+/g, '')}` : 'added nothing'}`);
        } else {
          view.banner = ev.bust
            ? { text: `TANKS WIN! ${name(ev.seat)} scores 0`, good: false }
            : { text: ev.gain > 0 ? `${name(ev.seat)}: +${ev.gain}${bonus}` : `${name(ev.seat)}: 0 points`, good: ev.gain > 0 };
          ctx.announce(ev.bust ? `${name(ev.seat)}: more tanks than death rays, no points` : `${name(ev.seat)} scored ${ev.gain}`);
        }
        if (ev.bust) ctx.vibrate();
        delay = ctx.reduced ? 1500 : BANNER_MS;
        break;
      }
      case 'TURN_ENDED':
        view.seats[ev.seat].turns += 1;
        view.banner = null;
        break;
      case 'DUEL_STARTED': {
        view.duel = { seats: ev.seats.slice(), rolls: null, counts: false };
        view.phase = 'duel';
        view.current = ev.seats[0];
        view.banner = { text: `${ev.seats.map(name).join(' and ')} tie: Death Ray Duel!`, good: false };
        ctx.announce(`${ev.seats.map(name).join(' and ')} tie. Death Ray Duel`);
        delay = ev.seats.every((i) => view.seats[i].isBot) ? BOTS_DUEL_MS : (ctx.reduced ? 1500 : BANNER_MS);
        break;
      }
      case 'DUEL_ROLLED':
        view.banner = null;
        view.duel.rolls = ev.rolls.map((r) => ({ ...r }));
        view.duel.counts = false;
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS;
        after = `Duel: ${ev.rolls.map((r) => `${name(r.seat)} ${r.rays} death rays`).join(', ')}`;
        break;
      case 'DUEL_WON':
        view.duel.counts = true;
        view.banner = { text: `${name(ev.winner)} wins the duel!`, good: true };
        delay = view.duel.seats.every((i) => view.seats[i].isBot) ? BOTS_DUEL_MS : (ctx.reduced ? 1500 : BANNER_MS);
        break;
      case 'DUEL_TIED':
        view.duel.counts = true;
        view.duel.seats = ev.seats.slice(); // the players still tied roll again (their dice stay on show until then)
        view.current = ev.seats[0];
        view.banner = { text: 'Still tied: roll again!', good: false };
        delay = view.duel.seats.every((i) => view.seats[i].isBot) ? BOTS_DUEL_MS : (ctx.reduced ? 1500 : BANNER_MS);
        break;
      case 'GAME_OVER':
        view.banner = { text: `${name(ev.winner)} wins!`, good: true };
        delay = ctx.reduced ? 200 : 600;
        break;
      default:
        break;
    }
    if (ev.type !== 'ROLLED' && ev.type !== 'DUEL_ROLLED') view.settling = false;
    return { delay, tumble, after };
  },
};
