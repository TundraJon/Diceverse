// Space Salvage view: three symbol dice, the haul and defensive-fire boxes, the bin, and the danger meter.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderTurnBar } from '../panels.js';
import { statusOverride } from '../avatars.js';
import { shipSvg } from '../ship-art.js';
import { dangerChance, binCounts, CREW_TYPES } from '../../games/salvage.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
// Older saves have no seat colors: these fixed ones (by seat) are the fallback.
const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const colorOf = (view, i) => view.seats[i].color || SEAT_COLORS[i];

// The six faces of a die type, as symbols (face number 1 to 6). Matches FACES in the rules module.
const SYM = { S: '⚙️', S2: '⚙️⚙️', D: '\u{1F6F0}️', F: '\u{1F4A5}', F2: '\u{1F4A5}\u{1F4A5}', FUEL: '\u{1F50B}', SHIELD: '\u{1F6E1}️' };
const WORD = { S: 'salvage', S2: 'double salvage', D: 'drifting target', F: 'defensive fire', F2: 'double fire', FUEL: 'fuel cell', SHIELD: 'shield' };
const TABLE = {
  green: ['S', 'S', 'S', 'D', 'D', 'F'],
  yellow: ['S', 'S', 'D', 'D', 'F', 'F'],
  red: ['S', 'D', 'D', 'F', 'F', 'F'],
  security: ['S2', 'S', 'D', 'D', 'F', 'F2'],
  mechanic: ['S', 'S', 'D', 'F', 'FUEL', 'SHIELD'],
  android: ['S2', 'S', 'D', 'D', 'FUEL', 'SHIELD'],
};
const symbolsOf = (type) => TABLE[type].map((c) => SYM[c]);
const bodyOf = (type) => (CREW_TYPES.includes(type) ? 'crew' : type);

const SHIP_PARTS = 20;
const partsBuilt = (total, target) => Math.min(SHIP_PARTS, Math.ceil((total * SHIP_PARTS) / target)); // the ship is complete exactly at the target

// The fleet: your ship large, the others small beside it (Pass & Play: the player to move is the large one). Sizes are
// chosen from the room between the last line of the screen and the buttons, so the controls never leave the screen.
function fitFleet(ui, reset) {
  if (!ui.fleet || !ui.fleet.childElementCount) return;
  const f = ui.fleet;
  const key = `${window.innerWidth}x${window.innerHeight}`;
  if (reset) ui.fleetKey = null;
  if (ui.fleetKey === key) return; // worked out once per screen size, so the ships never change size or vanish from turn to turn
  f.hidden = false;
  f.style.setProperty('--lg', '0px');
  f.style.setProperty('--sm', '0px');
  // keep room for what comes and goes: the danger meter (only when that house rule is on) and the crew badges
  const reserve = (ui.meterOn && ui.meter.hidden ? 54 : 0) + (ui.badges.childElementCount ? 0 : 24) + 24; // the last 24: the salvage box grows to a second line of gears
  const free = ui.controls.getBoundingClientRect().top - ui.hint.getBoundingClientRect().bottom - 16 - reserve;
  const lg = Math.max(40, Math.min(170, free));
  ui.fleetKey = key;
  f.style.setProperty('--lg', `${lg}px`);
  f.style.setProperty('--sm', `${Math.round(lg * 0.6)}px`);
}

export const salvageView = {
  title: 'SPACE SALVAGE',

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Space Salvage'));
    sheet.appendChild(el('p', 'tagline', 'Take the job. Keep the haul.'));
    [
      'The Long War is over, but its wrecks still drift through the Boneyard, and the old war machines still shoot at anything that gets close. You are a small-time crew working the wrecks before the next crew does.',
      'Your bin holds 13 dice: Scout Probes (green, mostly safe), Freighters (yellow) and Warships (red, rich but well defended).',
      `On your turn you take three dice from the bin and roll them. ⚙️ Salvage goes in your haul. 💥 Defensive fire goes on the fire side. 🛰️ A drifting target stays in your hand.`,
      `Then you choose: STOW the haul (add it to your cargo hold and pass the turn) or ROLL AGAIN. When you roll again, the drifting targets are rolled together with new dice from the bin, to make three.`,
      `Take ${options.fire} blasts of defensive fire in one turn and the cargo hold slams shut: you are reeled in and the haul you were carrying floats away. Only salvage you have stowed is safe.`,
      options.meter ? 'The danger meter shows your exact chance of defensive fire ending the turn on the next roll.' : null,
      options.equalTurns === false
        ? `The first crew to stow ${options.target} salvage wins at once.`
        : `When someone stows ${options.target} salvage, everyone else gets one final turn. The most salvage wins; a tie is played off by the tied leaders only.`,
      'Solo: reach the target in as few turns as you can.',
      options.extra === 'crew'
        ? 'Crew: three dice are swapped for crew. Security (double salvage, double fire), Mechanic and Android (fuel cells and shields). A 🔋 fuel cell turns every Scout Probe drift into salvage for the rest of the turn. A 🛡️ shield means it takes one more blast to end your turn. Double salvage ⚙️⚙️ counts 2, double fire 💥💥 counts 2.'
        : null,
    ].filter(Boolean).forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h, mode) {
    const mix = { standard: 'standard dice', gentle: 'gentle dice', brutal: 'brutal dice' }[h.mix];
    return `Target ${h.target} · ${h.fire} fire${mode !== 'solo' && h.equalTurns === false ? ' · first to target' : ''} · ${mix}${h.extra === 'crew' ? ' · crew' : ''}${h.meter ? ' · danger meter' : ''}`;
  },

  init(session) { return this.sync(null, session); },

  sync(_view, session) {
    const st = session.state;
    const t = st.turn;
    return {
      seats: st.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns })),
      current: st.current,
      points: t.points,
      shots: t.shots,
      limit: st.options.fire + (t.shield ? 1 : 0),
      fuel: t.fuel,
      shield: t.shield,
      rolled: t.rolled.map((d) => ({ ...d })),
      bin: binCounts(st, st.cup),
      full: binCounts(st, st.dice.map((_, i) => i)),
      fire: st.options.fire,
      hand: st.hand.length,
      banner: null,
    };
  },

  build(ui) {
    ui.table.classList.add('salvwrap');
    ui.scores.hidden = true; // own one-line chips below
    ui.chips = el('div', 'climbchips');
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    ui.dice = el('div', 'dice salv');
    ui.boxes = el('div', 'salvboxes');
    ui.binline = el('div', 'binline');
    ui.badges = el('div', 'badges');
    ui.meter = el('div', 'meter');
    ui.hint = el('div', 'hint');
    const stage = el('div', 'salvstage');
    stage.append(ui.dice, ui.banner);
    ui.fleet = el('div', 'fleet');
    ui.shipN = {}; // parts shown the last time, so only new parts animate in
    ui.table.append(ui.chips, ui.fleet, stage, ui.boxes, ui.binline, ui.badges, ui.meter, ui.hint);
    window.addEventListener('resize', () => fitFleet(ui, true));
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const cur = view.seats[view.current];
    const phase = st.turn.phase;
    const over = session.isOver();
    const human = !over && !cur.isBot && !ctx.busy;
    ui.controls.classList.add('sticky');
    ui.log.hidden = true; // this screen is full

    // one line per player: colour, face and name, salvage in the cargo hold / target
    ui.chips.innerHTML = '';
    ui.chips.style.setProperty('--n', String(view.seats.length === 1 ? 1 : 2));
    view.seats.forEach((s, i) => {
      const chip = el('div', 'cchip' + (i === view.current && !over ? ' active' : ''));
      const sw = el('i');
      sw.style.background = colorOf(view, i);
      chip.append(sw, el('span', 'cn', `${s.face || (s.isBot ? '\u{1F916}' : '\u{1F464}')} ${s.name}`), el('b', null, `${s.total}/${st.options.target}`));
      chip.setAttribute('aria-label', `${s.name}: ${s.total} of ${st.options.target} salvage in the cargo hold`);
      ui.chips.appendChild(chip);
    });

    // the three dice just rolled (blank before the first roll of a turn)
    ui.dice.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const d = view.rolled[i];
      ui.dice.appendChild(d
        ? renderDie(d.face, { tumble: ctx.tumble && !ctx.reduced, kind: bodyOf(d.type), symbols: symbolsOf(d.type) })
        : renderDie(null, { kind: 'green', symbols: symbolsOf('green') }));
    }
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner' + (view.banner && view.banner.good ? ' hot' : '');

    // salvage this turn and defensive fire
    ui.boxes.innerHTML = '';
    const hb = el('div', 'sbox');
    hb.appendChild(el('b', null, `Salvage this turn: ${view.points}`));
    const ic = el('div', 'sicons');
    ic.textContent = view.points ? '⚙️'.repeat(Math.min(view.points, 12)) + (view.points > 12 ? ` +${view.points - 12}` : '') : ' ';
    hb.appendChild(ic);
    const fb = el('div', 'sbox');
    fb.appendChild(el('b', null, `Defensive fire: ${view.shots} of ${view.limit}`));
    const slots = el('div', 'sslots');
    for (let i = 0; i < view.limit; i++) slots.appendChild(el('span', 'slot' + (i < view.shots ? ' hit' : ''), i < view.shots ? '\u{1F4A5}' : ''));
    fb.appendChild(slots);
    ui.boxes.append(hb, fb);
    ui.boxes.setAttribute('role', 'group');
    ui.boxes.setAttribute('aria-label', `Salvage this turn ${view.points}. Defensive fire ${view.shots} of ${view.limit}.`);

    // the bin, as a legend of the dice colors: a swatch, the name and how many are in the bin
    const b = view.bin;
    const kinds = [['green', 'Scout Probes', b.green], ['yellow', 'Freighters', b.yellow], ['red', 'Warships', b.red]];
    if (view.full.crew) kinds.push(['crew', 'Crew', b.crew]);
    ui.binline.innerHTML = '';
    kinds.forEach(([k, label, count]) => {
      const it = el('span', 'lgi');
      it.append(el('i', `sw k-${k}`), document.createTextNode(`${label} ${count}`));
      ui.binline.appendChild(it);
    });
    if (view.hand) ui.binline.appendChild(el('span', 'lgi', `drifting kept: ${view.hand}`));
    ui.binline.setAttribute('role', 'group');
    ui.binline.setAttribute('aria-label', `In the bin: ${kinds.map(([, label, count]) => `${label} ${count}`).join(', ')}${view.hand ? `, drifting kept ${view.hand}` : ''}`);

    // effects of the crew dice
    ui.badges.innerHTML = '';
    if (view.fuel) ui.badges.appendChild(el('span', 'badge', '\u{1F50B} Scout Probe drifts count as salvage'));
    if (view.shield) ui.badges.appendChild(el('span', 'badge', '\u{1F6E1}️ One more hit to go'));

    // danger meter: only while choosing, never while the dice are rolling or a bot plays
    const choosing = !!st.options.meter && phase === 'decide' && human;
    ui.meter.hidden = !choosing;
    if (choosing) {
      const pct = Math.round(dangerChance(st) * 100);
      ui.meter.innerHTML = '';
      ui.meter.append(el('span', null, `Chance of defensive fire on the next roll: ${pct}%`));
      const bar = el('div', 'mbar');
      const fill = el('i');
      fill.style.width = `${pct}%`;
      fill.className = pct >= 50 ? 'hi' : pct >= 25 ? 'mid' : '';
      bar.appendChild(fill);
      ui.meter.appendChild(bar);
    }

    ui.hint.textContent = statusOverride(view, cur, over) || (over ? '' : cur.isBot ? `${cur.name} is thinking…`
      : ctx.busy ? 'Rolling…'
        : phase === 'decide' ? 'Stow the haul or roll again'
          : 'Roll the three dice');

    // the fleet: every player's ship, one part per share of the target in the hold
    const target = st.options.target;
    const big = (() => { const k = view.seats.findIndex((x) => x.me); return k >= 0 ? k : view.current; })();
    const order = [big].concat(view.seats.map((_, i) => i).filter((i) => i !== big));
    ui.fleet.innerHTML = '';
    order.forEach((i, k) => {
      const built = partsBuilt(view.seats[i].total, target);
      const before = ui.shipN[i];
      const fresh = before !== undefined && built > before ? before : -1;
      ui.shipN[i] = built;
      const w = el('div', `shipw ${k === 0 ? 'big' : 'small'}`);
      w.style.setProperty('--glow', colorOf(view, i));
      w.innerHTML = shipSvg(`s${i}`, colorOf(view, i), built, fresh);
      w.setAttribute('role', 'img');
      w.setAttribute('aria-label', `${view.seats[i].name}'s ship: ${built} of ${SHIP_PARTS} parts built`);
      if (view.alarm === i) w.classList.add('alarm'); // a bust: red warning lights
      ui.fleet.appendChild(w);
    });
    view.alarm = null;

    // controls
    const bankLabel = `STOW ${view.points}`;
    renderTurnBar(ui.controls, phase === 'decide' || view.points > 0 || view.rolled.length
      ? [
        { label: 'ROLL AGAIN', cls: 'btn-roll', disabled: !human || phase !== 'decide', onClick: () => ctx.act([{ type: 'ROLL' }]) },
        { label: bankLabel, cls: 'btn-bank', disabled: !human || phase !== 'decide', onClick: () => ctx.act([{ type: 'BANK' }]) },
      ]
      : [{ label: 'ROLL', cls: 'btn-roll span2', disabled: !human || over, onClick: () => ctx.act([{ type: 'ROLL' }]) }]);
    ui.meterOn = !!st.options.meter;
    fitFleet(ui);
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'ROLLED':
        view.rolled = ev.dice.map((d) => ({ ...d }));
        view.banner = null;
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS; // nothing result-dependent shows until the dice have stopped and 0.25 s have passed
        after = `${name(ev.seat)} rolled ${ev.dice.map((d) => WORD[d.sym]).join(', ')}`; // spoken once the dice have settled
        break;
      case 'TALLY':
        view.points = ev.points;
        view.shots = ev.shots;
        view.limit = ev.limit;
        view.fuel = ev.fuel;
        view.shield = ev.shield;
        view.bin = { ...ev.bin };
        view.hand = ev.hand;
        ctx.log(`${name(ev.seat)}: salvage ${ev.points}, fire ${ev.shots} of ${ev.limit}`);
        break;
      case 'SHOT':
        if (ev.fire < ev.limit) {
          view.banner = { text: "They're still shooting!" };
          delay = ctx.reduced ? 300 : 700;
        }
        break;
      case 'BUSTED':
        view.points = 0;
        view.alarm = ev.seat;
        view.banner = { text: 'Hold sealed! Retract safety lines!' };
        ctx.log(`${name(ev.seat)} retracted the safety lines and lost ${ev.lost}`);
        ctx.announce(`${name(ev.seat)} retracted the safety lines and lost the haul`);
        ctx.vibrate();
        delay = ctx.reduced ? 900 : 2200;
        break;
      case 'BANKED':
        view.points = 0;
        view.seats[ev.seat].total = ev.total;
        if (ev.amount >= 5) view.banner = { text: "Now that's a payday.", good: true };
        ctx.log(`${name(ev.seat)} stowed ${ev.amount} (total ${ev.total})`);
        ctx.announce(`${name(ev.seat)} stowed ${ev.amount}, total ${ev.total}`);
        delay = ev.amount >= 5 ? (ctx.reduced ? 400 : 1000) : 450;
        break;
      case 'TURN_ENDED':
        view.banner = null;
        view.seats[ev.seat].turns += 1;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.points = 0;
        view.shots = 0;
        view.fuel = false;
        view.shield = false;
        view.rolled = [];
        view.hand = 0;
        view.bin = { ...view.full };
        view.limit = view.fire;
        delay = 200;
        break;
      case 'GAME_OVER':
        view.banner = { text: 'Best haul on the Rim.', good: true };
        delay = ctx.reduced ? 200 : 600;
        break;
      default:
        break;
    }
    return { delay, tumble, after };
  },
};
