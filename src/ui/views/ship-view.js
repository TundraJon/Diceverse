// Ship, Captain & Crew view: the ship deck with three sockets (ship 6, captain 5, crew 4), the sea with the dice still in play, the cargo hold,
// the round table. All theme words live in THEME. The art (the ship) is drawn in CSS and inline SVG.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderTurnBar } from '../panels.js';
import { statusOverride } from '../avatars.js';
import { SLOTS, SLOT_VALUE, VOYAGES } from '../../games/ship.js';

const THEME = {
  title: 'SHIP, CAPTAIN & CREW',
  tagline: 'Find your ship, captain and crew, then count the cargo.',
  slot: { ship: 'SHIP 6', captain: 'CAPTAIN 5', crew: 'CREW 4' },
  hold: 'Cargo hold',
};
const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const colorOf = (view, i) => view.seats[i].color || SEAT_COLORS[i];
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// The ship: sails, a mast with a flag and a hull with planks, behind the three sockets.
const SHIP_SVG = '<svg viewBox="0 0 360 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'
  + '<path d="M176 8 L176 78" stroke="#6b4a2a" stroke-width="4"/>'
  + '<path d="M180 12 L180 20 L214 14 Z" fill="#e5484d"/>'
  + '<path d="M172 16 C120 24 96 52 92 76 L172 76 Z" fill="#f1e7cf" stroke="#cdbb92" stroke-width="1.5"/>'
  + '<path d="M182 16 C236 26 262 54 266 76 L182 76 Z" fill="#f6edd8" stroke="#cdbb92" stroke-width="1.5"/>'
  + '<path d="M26 78 L334 78 C326 130 292 146 252 146 L108 146 C68 146 34 130 26 78 Z" fill="#8a5a2b" stroke="#fde68a" stroke-width="2"/>'
  + '<path d="M34 104 L326 104 M46 126 L314 126" stroke="rgba(0,0,0,0.25)" stroke-width="2"/>'
  + '<rect x="26" y="74" width="308" height="8" rx="3" fill="#a8742f" stroke="#fde68a" stroke-width="1.5"/>'
  + '</svg>';

const seatsView = (st) => st.seats.map((s) => ({ name: s.name, isBot: s.isBot, wins: s.wins, turns: s.turns }));

export const shipView = {
  title: THEME.title,

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Ship, Captain & Crew'));
    sheet.appendChild(el('p', 'tagline', THEME.tagline));
    [
      `On your turn you roll five dice, up to ${options.rolls} times.`,
      'You need a 6 (the ship), then a 5 (the captain), then a 4 (the crew), in that order. When you roll one you need, it is set aside and you do not roll it again. A 5 or a 4 cannot be kept until the 6 (and the 5) are in place, but you can set aside two or three in one roll if they come in order.',
      'Once the ship, captain and crew are set aside, the other two dice are your cargo and their total (2 to 12) is your score. If you do not get all three in your rolls you score 0.',
      'If you finish with rolls to spare you may re-roll both cargo dice, but you must keep the new total, even if it is lower. Or stop and keep what you have.',
      'When everybody has had a turn the highest score wins the round and earns a point. If the best score is tied, the tied players take one more turn each until one is left. The next round starts with the player to the right of the last starter.',
      `The first to ${options.target} points wins.`,
      `Solo: ${VOYAGES} voyages, and your total cargo is your score.`,
    ].forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h) {
    const bits = [];
    if (h.rolls !== undefined && h.rolls !== 3) bits.push(`${h.rolls} rolls`);
    if (h.target !== undefined && h.target !== 5) bits.push(`first to ${h.target}`);
    return bits.length ? bits.join(' · ') : 'Standard rules';
  },

  init(session) { return this.sync(null, session); },

  sync(_view, session) {
    const st = session.state;
    const t = st.turn;
    return {
      seats: seatsView(st),
      current: st.current,
      scores: st.scores.slice(),
      order: st.order.slice(),
      round: st.round,
      voyages: st.voyages,
      locked: { ...t.locked },
      sea: t.free.slice(),
      cargo: t.cargo ? t.cargo.slice() : null,
      cargoTotal: t.cargo ? t.cargo[0] + t.cargo[1] : null,
      rollsLeft: t.rollsLeft,
      rolling: false,
      banner: null,
      target: st.options.target,
      rolls: st.options.rolls,
      soloScores: [],
    };
  },

  build(ui) {
    ui.table.classList.add('scwrap');
    ui.scores.hidden = true;
    ui.chips = el('div', 'climbchips');
    ui.banner = el('div', 'banner scbanner');
    ui.banner.hidden = true;
    ui.rounds = el('div', 'scrounds');
    ui.deck = el('div', 'scdeck');
    ui.sea = el('div', 'scsea');
    ui.hold = el('div', 'schold');
    ui.pips = el('div', 'scpips');
    ui.table.append(ui.chips, ui.banner, ui.rounds, ui.deck, ui.sea, ui.hold, ui.pips);
    ui.table.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const over = session.isOver();
    ui.controls.classList.add('sticky');
    ui.log.hidden = true; // this screen is full
    const solo = view.seats.length === 1;
    const cur = view.seats[view.current];
    const human = !over && !cur.isBot && !ctx.busy && !view.rolling;

    // one chip per player: color, face and name, round wins (or the total over the voyages)
    ui.chips.innerHTML = '';
    ui.chips.style.setProperty('--n', String(solo ? 1 : 2));
    view.seats.forEach((s, i) => {
      const chip = el('div', 'cchip' + (i === view.current && !over ? ' active' : ''));
      const sw = el('i');
      sw.style.background = colorOf(view, i);
      chip.append(sw, el('span', 'cn', `${s.face || (s.isBot ? '\u{1F916}' : '\u{1F464}')} ${s.name}`), el('b', null, solo ? `Voyage ${Math.min(VOYAGES, view.voyages + 1)}/${VOYAGES}` : `${s.wins}/${view.target}`));
      chip.setAttribute('aria-label', solo ? `${s.name}: voyage ${Math.min(VOYAGES, view.voyages + 1)} of ${VOYAGES}` : `${s.name}: ${s.wins} of ${view.target} points`);
      ui.chips.appendChild(chip);
    });

    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner scbanner' + (view.banner && view.banner.good ? ' hot' : '');

    // the round table: everybody's score this round
    ui.rounds.innerHTML = '';
    if (solo) {
      ui.rounds.appendChild(el('div', 'scrow head', `Total cargo ${view.soloScores.reduce((a, b) => a + b, 0)}`));
      const r = el('div', 'scrow');
      for (let k = 0; k < VOYAGES; k++) r.appendChild(el('span', 'scv' + (k < view.soloScores.length ? ' done' : ''), k < view.soloScores.length ? String(view.soloScores[k]) : '–'));
      ui.rounds.appendChild(r);
    } else {
      view.seats.forEach((s, i) => {
        const sc = view.scores[i];
        const row = el('div', 'scrow' + (i === view.current && !over ? ' on' : ''));
        const sw = el('i');
        sw.style.background = colorOf(view, i);
        row.append(sw, el('span', 'scn', s.name), el('b', null, sc === null ? '–' : sc === 0 ? 'no cargo' : String(sc)));
        ui.rounds.appendChild(row);
      });
    }

    // the ship deck: three sockets, filled in order
    ui.deck.innerHTML = SHIP_SVG;
    const slots = el('div', 'scslots');
    SLOTS.forEach((k) => {
      const slot = el('div', `scslot${view.locked[k] ? ' on' : ''}`);
      if (view.locked[k]) slot.appendChild(renderDie(SLOT_VALUE[k], { danger: false }));
      else slot.appendChild(el('b', null, String(SLOT_VALUE[k])));
      slot.appendChild(el('small', null, THEME.slot[k]));
      slot.setAttribute('aria-label', `${THEME.slot[k]}${view.locked[k] ? ', in place' : ', empty'}`);
      slots.appendChild(slot);
    });
    ui.deck.appendChild(slots);

    // the sea: the dice still in play (blank until the first roll of a turn)
    ui.sea.innerHTML = '';
    const inPlay = view.cargo ? 0 : 5 - SLOTS.filter((k) => view.locked[k]).length;
    const showing = view.sea.length ? view.sea : Array.from({ length: inPlay }, () => null);
    showing.forEach((v) => ui.sea.appendChild(renderDie(v, { tumble: ctx.tumble && !ctx.reduced && view.rolling && v !== null, danger: false })));
    ui.sea.classList.toggle('empty', !showing.length);

    // the cargo hold
    ui.hold.innerHTML = '';
    ui.hold.classList.toggle('full', !!view.cargo);
    ui.hold.appendChild(el('span', 'schl', THEME.hold));
    const cd = el('div', 'scdice');
    for (let k = 0; k < 2; k++) cd.appendChild(renderDie(view.cargo ? view.cargo[k] : null, { tumble: ctx.tumble && !ctx.reduced && view.rolling && !!view.cargo, danger: false }));
    ui.hold.appendChild(cd);
    ui.hold.appendChild(el('b', 'sct', view.cargoTotal !== null && !view.rolling ? `= ${view.cargoTotal}` : ''));

    // rolls left
    ui.pips.innerHTML = '';
    ui.pips.appendChild(el('span', null, 'Rolls left'));
    for (let k = 0; k < view.rolls; k++) ui.pips.appendChild(el('i', k < view.rollsLeft ? 'on' : ''));
    const info = over ? '' : view.rolling ? 'Rolling…' : cur.isBot ? `${cur.name} is rolling…` : (cur.me && cur.name === 'You' ? '' : `${cur.name}: `) + (st.turn.phase === 'cargo' ? 'Re-roll the cargo or keep it' : (view.cargo ? '' : 'Roll the dice'));
    ui.pips.appendChild(el('em', null, statusOverride(view, cur, over) || info));

    // controls
    if (human && st.turn.phase === 'cargo') {
      renderTurnBar(ui.controls, [
        { label: 'RE-ROLL CARGO', cls: 'btn-roll', onClick: () => ctx.act([{ type: 'ROLL' }]) },
        { label: `KEEP ${view.cargoTotal}`, cls: 'btn-bank', onClick: () => ctx.act([{ type: 'KEEP' }]) },
      ]);
    } else {
      renderTurnBar(ui.controls, [{ label: 'ROLL', cls: 'btn-roll span2', disabled: !human, onClick: () => ctx.act([{ type: 'ROLL' }]) }]);
    }
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'ROLLED':
        view.rollsLeft = ev.rollsLeft;
        view.rolling = true;
        view.banner = null;
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS; // nothing about the roll (a die set aside, the cargo total) shows until the dice have settled and the pause has passed
        if (ev.cargo) { view.cargo = ev.dice.slice(); view.cargoTotal = null; after = `${name(ev.seat)} re-rolled the cargo: ${ev.dice.join(' and ')}`; } else { view.sea = ev.dice.slice(); after = `${name(ev.seat)} rolled ${ev.dice.join(', ')}`; }
        break;
      case 'LOCKED': {
        view.rolling = false;
        view.locked[ev.slot] = true;
        const i = view.sea.indexOf(ev.value);
        if (i >= 0) view.sea.splice(i, 1);
        delay = ctx.reduced ? 150 : 500;
        break;
      }
      case 'ROLL_DONE':
        view.rolling = false;
        break;
      case 'CARGO':
        view.rolling = false;
        view.sea = [];
        view.cargo = ev.dice.slice();
        view.cargoTotal = ev.total;
        ctx.log(`${name(ev.seat)}: cargo ${ev.total}`);
        delay = ctx.reduced ? 200 : 500;
        break;
      case 'NO_CARGO':
        view.banner = { text: `${name(ev.seat)}: no cargo`, good: false };
        ctx.log(`${name(ev.seat)} gets no cargo`);
        ctx.announce(`${name(ev.seat)} gets no cargo`);
        delay = ctx.reduced ? 400 : 900;
        break;
      case 'TURN_ENDED':
        view.scores[ev.seat] = ev.score;
        view.seats[ev.seat].turns += 1;
        if (view.seats.length === 1) { view.soloScores.push(ev.score); view.voyages += 1; }
        delay = ctx.reduced ? 250 : 700;
        break;
      case 'TIEBREAK': {
        const names = ev.seats.map(name);
        ev.seats.forEach((i) => { view.scores[i] = null; });
        view.order = ev.seats.slice();
        view.banner = { text: `${names.join(' and ')} tie: one more turn each`, good: false };
        ctx.announce(`${names.join(' and ')} tie. One more turn each`);
        delay = ctx.reduced ? 500 : 1300;
        break;
      }
      case 'ROUND_ENDED':
        view.seats[ev.winner].wins += 1;
        view.nextRound = true;
        view.banner = { text: `${name(ev.winner)} wins the round with ${ev.scores[ev.winner]}`, good: true };
        ctx.log(`${name(ev.winner)} wins round ${view.round}`);
        ctx.announce(`${name(ev.winner)} wins the round`);
        delay = ctx.reduced ? 500 : 1300;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.locked = { ship: false, captain: false, crew: false };
        view.sea = [];
        view.cargo = null;
        view.cargoTotal = null;
        view.rollsLeft = view.rolls;
        view.rolling = false;
        if (view.nextRound) { view.nextRound = false; view.round += 1; view.scores = view.seats.map(() => null); view.order = view.seats.map((_, i) => i); } // a new round: the table starts again
        delay = 150;
        break;
      case 'GAME_OVER':
        view.banner = { text: view.seats.length === 1 ? 'The voyages are over!' : `${name(ev.winner)} wins the game!`, good: true };
        delay = ctx.reduced ? 200 : 600;
        break;
      default:
        break;
    }
    return { delay, tumble, after };
  },
};
