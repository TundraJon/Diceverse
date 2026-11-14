// Ship, Captain & Crew view: the freighter (the ship die 6 in the wheelhouse, the captain 5 at the helm, the crew 4 in the crow's nest, the cargo dice in
// the three containers), the sea with the dice still in play, the round table. All theme words live in THEME. The art is src/ui/freighter-art.js.
import { renderDie, REVEAL_MS, SETTLE_MS, ROLL_MS, throwAge } from '../dice.js';
import { renderTurnBar } from '../panels.js';
import { statusOverride } from '../avatars.js';
import { SLOTS, SLOT_VALUE, VOYAGES, REQUIRED, cargoSize } from '../../games/ship.js';
import { freighterSvg, flatDieSvg, GEOM as FREIGHTER_GEOM } from '../freighter-art.js';
import { galleonSvg, GEOM as GALLEON_GEOM } from '../galleon-art.js';
import { starshipSvg, GEOM as STARSHIP_GEOM } from '../starship-art.js';

const THEME = {
  title: 'SHIP, CAPTAIN & CREW',
  tagline: 'Find your ship, captain and crew, then count the cargo.',
  slot: { ship: 'SHIP 6', captain: 'CAPTAIN 5', crew: 'CREW 4' },
};
// The looks: the drawing, where the dice go, and the panel behind it (none, a gray sky or space).
const SKINS = {
  freighter: { svg: freighterSvg, geom: FREIGHTER_GEOM, bg: null },
  galleon: { svg: galleonSvg, geom: GALLEON_GEOM, bg: 'sky' },
  starship: { svg: starshipSvg, geom: STARSHIP_GEOM, bg: 'space' },
};
const BOTS_TIEBREAK_MS = 1000; // banners during a tiebreak that only bots play (nobody human is in it) are short
const BANNER_MS = 2500; // every banner stays at least this long (also with reduced motion: reading time does not depend on motion)
const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const colorOf = (view, i) => view.seats[i].color || SEAT_COLORS[i];
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// A flat die for the ship. When it is thrown it spins down to rest (the same length as a 3D throw) and carries on from where it was after a re-render.
function flatDie(value, tumble) {
  const d = el('div', 'fdie');
  d.innerHTML = flatDieSvg(value);
  const age = throwAge();
  const fast = document.body.classList.contains('fast');
  if (tumble && !fast && age < ROLL_MS && d.animate) {
    const a = d.animate([
      { transform: 'rotate(-540deg) scale(1.12) translate(6%, -10%)' },
      { offset: 0.4, transform: 'rotate(-230deg) scale(1.06) translate(-4%, 4%)' },
      { offset: 0.75, transform: 'rotate(-40deg) scale(1.03) translate(2%, -2%)' },
      { transform: 'rotate(0deg) scale(1) translate(0, 0)' },
    ], { duration: ROLL_MS, easing: 'ease-out', fill: 'both' });
    a.currentTime = Math.max(0, age);
  }
  return d;
}

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
    if (h.skin !== undefined && h.skin !== 'freighter') bits.push(h.skin);
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
      cargoTotal: t.cargo ? t.cargo.reduce((x, y) => x + y, 0) : null,
      rollsLeft: t.rollsLeft,
      rolling: false,
      banner: null,
      target: st.options.target,
      rolls: st.options.rolls,
      crew: st.options.crew,
      skin: st.options.skin,
      botsTiebreak: !!st.tiebreak && st.order.every((i) => st.seats[i].isBot),
      reroll: st.options.reroll,
      held: [],
      tumbling: [],
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
    ui.pips = el('div', 'scpips');
    ui.table.append(ui.chips, ui.banner, ui.rounds, ui.deck, ui.sea, ui.pips);
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

    // the freighter: the ship die in the wheelhouse, the captain at the helm, the crew in the crow's nest, the cargo dice in the containers
    const need = REQUIRED[view.crew];
    const seen = ui.seenLocked || {};
    const fresh = ctx.reduced ? [] : SLOTS.filter((k) => view.locked[k] && !seen[k]);
    ui.seenLocked = { ...view.locked };
    const showTotal = view.cargoTotal !== null && !view.rolling;
    const skin = SKINS[view.skin] || SKINS.freighter;
    const { vb } = skin.geom;
    ui.deck.classList.toggle('sky', skin.bg === 'sky');
    ui.deck.classList.toggle('space', skin.bg === 'space');
    ui.deck.innerHTML = skin.svg({ locked: view.locked, need, fresh, total: showTotal ? view.cargoTotal : null });
    ui.deck.setAttribute('role', 'group');
    ui.deck.setAttribute('aria-label', SLOTS.map((k) => (need.includes(k) ? `${THEME.slot[k]} ${view.locked[k] ? 'in place' : 'empty'}` : `${THEME.slot[k]} not needed`)).join(', ') + (showTotal ? `, cargo ${view.cargoTotal}` : ''));
    const place = (cls, pos) => {
      const e = el('div', cls);
      e.style.left = `${((pos.x - vb.x) / vb.w * 100).toFixed(3)}%`;
      e.style.top = `${((pos.y - vb.y) / vb.h * 100).toFixed(3)}%`;
      e.style.width = `${(pos.s / vb.w * 100).toFixed(3)}%`;
      ui.deck.appendChild(e);
      return e;
    };
    if (view.locked.ship) place(`scsq${fresh.includes('ship') ? ' pop' : ''}`, skin.geom.die).appendChild(flatDie(SLOT_VALUE.ship, false));
    const n = cargoSize(view.crew);
    const slots = skin.geom.cargoFor ? skin.geom.cargoFor(n) : skin.geom.cargo; // the starship uses the right two squares for two cargo dice
    const pick = human && st.turn.phase === 'cargo' && view.reroll === 'either' && !!view.cargo; // Either die: tap the cargo dice you want to keep
    for (let k = 0; k < n; k++) {
      const box = place('scsq', slots[k]);
      if (!view.cargo) continue; // an empty container
      const die = flatDie(view.cargo[k], ctx.tumble && !ctx.reduced && view.rolling && view.tumbling.includes(k));
      if (pick) {
        const wrap = el('div', 'schw');
        const btn = el('button', 'dieBtn' + (view.held[k] ? ' held' : ''));
        btn.type = 'button';
        btn.setAttribute('aria-pressed', String(!!view.held[k]));
        btn.setAttribute('aria-label', `Cargo die showing ${view.cargo[k]}${view.held[k] ? ', kept' : ''}`);
        btn.appendChild(die);
        btn.addEventListener('click', () => { view.held[k] = !view.held[k]; this.render(ui, view, session, ctx); });
        wrap.append(btn, el('div', 'holdTag', view.held[k] ? 'KEPT' : ''));
        box.appendChild(wrap);
      } else box.appendChild(die);
    }

    // the sea: the dice still in play (blank before the first roll of a turn)
    ui.sea.innerHTML = '';
    const inPlay = view.cargo ? 0 : 5 - need.filter((k) => view.locked[k]).length;
    const showing = view.sea.length ? view.sea : Array.from({ length: inPlay }, () => null);
    showing.forEach((v) => ui.sea.appendChild(renderDie(v, { tumble: ctx.tumble && !ctx.reduced && view.rolling && v !== null, danger: false })));
    ui.sea.classList.toggle('empty', !showing.length);

    // rolls left
    ui.pips.innerHTML = '';
    ui.pips.appendChild(el('span', null, 'Rolls left'));
    for (let k = 0; k < view.rolls; k++) ui.pips.appendChild(el('i', k < view.rollsLeft ? 'on' : ''));
    const info = over ? '' : view.rolling ? 'Rolling…' : cur.isBot ? `${cur.name} is rolling…` : (cur.me && cur.name === 'You' ? '' : `${cur.name}: `) + (st.turn.phase === 'cargo' ? 'Re-roll the cargo or keep it' : (view.cargo ? '' : 'Roll the dice'));
    ui.pips.appendChild(el('em', null, statusOverride(view, cur, over) || info));

    // controls
    if (human && st.turn.phase === 'cargo') {
      const total = view.cargoTotal;
      if (view.reroll === 'either') {
        const free = view.cargo.map((_, i) => i).filter((i) => !view.held[i]);
        renderTurnBar(ui.controls, [
          { label: free.length ? `RE-ROLL ${free.length}` : 'ALL KEPT', cls: 'btn-roll', disabled: !free.length, onClick: () => { const ids = free.slice(); view.held = []; ctx.act([{ type: 'ROLL', ids }]); } },
          { label: `KEEP ${total}`, cls: 'btn-bank', onClick: () => ctx.act([{ type: 'KEEP' }]) },
        ]);
      } else {
        renderTurnBar(ui.controls, [
          { label: 'RE-ROLL CARGO', cls: 'btn-roll', onClick: () => ctx.act([{ type: 'ROLL' }]) },
          { label: `KEEP ${total}`, cls: 'btn-bank', onClick: () => ctx.act([{ type: 'KEEP' }]) },
        ]);
      }
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
        view.held = [];
        view.tumbling = ev.ids ? ev.ids.slice() : [];
        if (ev.cargo) { // the cargo dice that are re-rolled change; the held ones keep their value
          (ev.ids || []).forEach((i, k) => { view.cargo[i] = ev.dice[k]; });
          view.cargoTotal = null;
          after = `${name(ev.seat)} re-rolled ${ev.dice.length === 1 ? 'a cargo die' : 'the cargo'}: ${ev.dice.join(' and ')}`;
        } else { view.sea = ev.dice.slice(); after = `${name(ev.seat)} rolled ${ev.dice.join(', ')}`; }
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
        delay = view.botsTiebreak ? BOTS_TIEBREAK_MS : BANNER_MS;
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
        view.scores.forEach((_, i) => { if (!ev.seats.includes(i)) view.scores[i] = null; }); // the players who are out of the tiebreak lose their score from the board too
        view.order = ev.seats.slice();
        view.banner = { text: `${names.join(' and ')} tie: one more turn each`, good: false };
        ctx.announce(`${names.join(' and ')} tie. One more turn each`);
        view.botsTiebreak = ev.seats.every((i) => view.seats[i].isBot); // a tiebreak with no human in it: its banners are short
        delay = view.botsTiebreak ? BOTS_TIEBREAK_MS : BANNER_MS;
        break;
      }
      case 'ROUND_VOID':
        view.botsTiebreak = false;
        view.nextRound = true;
        view.banner = { text: 'Nobody scored: no point this round', good: false };
        ctx.log(`Round ${view.round}: nobody scored`);
        ctx.announce('Nobody scored. No point this round');
        delay = BANNER_MS;
        break;
      case 'ROUND_ENDED':
        view.botsTiebreak = false;
        view.seats[ev.winner].wins += 1;
        view.nextRound = true;
        view.banner = { text: `${name(ev.winner)} wins the round with ${ev.scores[ev.winner]}`, good: true };
        ctx.log(`${name(ev.winner)} wins round ${view.round}`);
        ctx.announce(`${name(ev.winner)} wins the round`);
        delay = BANNER_MS;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.locked = { ship: false, captain: false, crew: false };
        view.sea = [];
        view.cargo = null;
        view.cargoTotal = null;
        view.held = [];
        view.rollsLeft = view.rolls;
        view.rolling = false;
        if (view.nextRound) { view.nextRound = false; view.round += 1; view.scores = view.seats.map(() => null); view.order = view.seats.map((_, i) => i); } // a new round: the table starts again
        delay = 150;
        break;
      case 'GAME_OVER':
        view.botsTiebreak = false;
        view.banner = { text: view.seats.length === 1 ? 'The voyages are over!' : `${name(ev.winner)} wins the game!`, good: true };
        delay = BANNER_MS;
        break;
      default:
        break;
    }
    return { delay, tumble, after };
  },
};
