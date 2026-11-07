// Shut the Box view: a wooden box with 12 tiles (6 + 6), a tall felt dice tray, and a sliding cover for a shut box.
import { renderDie } from '../dice.js';
import { renderScoreStrip, renderTurnBar } from '../panels.js';
import { validSets, oneDieAllowed } from '../../blocks/tile-board.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const TILES = 12;
const ONE_DIE = { standard: 'standard', late: 'late', off: 'off' };

const initialTiles = (size) => Array.from({ length: TILES }, (_, i) => (i + 1 > size ? 'na' : 'open'));

// Cosmetic, deterministic scatter for the dice inside the tray (percent of the tray, plus a rotation).
// This one function is the place a later bouncing-dice animation replaces; the layout does not depend on it.
function placeDice(count, rollId) {
  const h = (n) => { let x = (Math.imul(rollId + 1, 2654435761) + Math.imul(n + 1, 40503)) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; return (x % 1000) / 1000; };
  if (count === 1) return [{ left: 42 + h(1) * 16, top: 38 + h(2) * 18, rot: (h(3) - 0.5) * 60 }];
  return [
    { left: 24 + h(1) * 14, top: 34 + h(2) * 22, rot: (h(3) - 0.5) * 60 },
    { left: 62 + h(4) * 14, top: 34 + h(5) * 22, rot: (h(6) - 0.5) * 60 },
  ];
}

export const shutboxView = {
  title: 'SHUT THE BOX',

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Shut the Box'));
    [
      `Every turn starts with all ${options.size} tiles open. Roll the dice, then shut open tiles that add up exactly to your roll. Keep rolling and shutting.`,
      'Your turn ends when you roll a total that no open tiles can make. Your score is what is left open (lower is better).',
      'Shut every tile and you shut the box: score 0.',
      options.oneDie === 'off' ? 'You always roll two dice.' : options.oneDie === 'late' ? 'Once your open tiles add up to less than 6, you may roll just one die.' : 'Once every tile above 6 is shut, you may roll just one die.',
      options.maxTiles === 2 ? 'You may shut at most two tiles per roll.' : 'You may shut any number of tiles per roll.',
      options.scoring === 'digits' ? 'Scoring: the open tiles are read as one number (open 1, 5, 9 scores 159).' : 'Scoring: add up the open tiles.',
      options.format === 'single' ? 'Single round: after everyone has had a turn, the lowest score wins. Shut the box and you win at once.'
        : `Rounds add up: your scores add to a running total, and when it reaches ${options.format === 'out45' ? 45 : 100} you are out. The last player in wins.`,
      'Tiles above your board size stay pressed down.',
    ].forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h, mode) {
    const rule = { standard: 'standard one-die rule', late: 'late one-die rule', off: 'two dice always' }[h.oneDie];
    const fmt = { single: '', out45: ' · out at 45', out100: ' · out at 100' }[h.format];
    return `${h.size} tiles · ${rule} · ${h.maxTiles ? 'at most 2 tiles' : 'any tiles'} · ${h.scoring} scoring${mode !== 'solo' ? fmt : ''}`;
  },

  init(session) { return this.sync(null, session); },

  sync(_view, session) {
    const st = session.state;
    return {
      seats: st.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns, out: s.out })),
      current: st.current,
      round: st.round,
      tiles: Array.from({ length: TILES }, (_, i) => (i + 1 > st.options.size ? 'na' : st.turn.open.includes(i + 1) ? 'open' : 'shut')),
      dice: st.turn.dice.slice(),
      target: st.turn.target,
      rollId: session.log.length,
      selected: [],
      animTiles: [],
      banner: null,
      cover: null,
    };
  },

  build(ui) {
    ui.table.classList.add('boxwrap');
    ui.banner = el('div', 'banner'); // lives inside the tray (attached in render), so the box can never paint over it
    ui.banner.hidden = true;
    ui.turnline = el('div', 'turnline');
    ui.box = el('div', 'sbox walnut');
    ui.tiles = el('div', 'tilegrid');
    ui.tray = el('div', 'tray');
    ui.cover = el('div', 'cover walnut');
    ui.box.append(el('div', 'rail'), ui.tiles, el('div', 'rail'), ui.tray, ui.cover);
    ui.table.append(ui.turnline, ui.box);
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const o = st.options;
    const cur = view.seats[view.current];
    const phase = st.turn.phase;
    const human = !session.isOver() && !cur.isBot && !ctx.busy;
    const flipping = human && phase === 'flip';
    ui.controls.classList.add('sticky');
    ui.log.hidden = true; // this screen is full: the box, tiles and tray already show everything the log would

    renderScoreStrip(ui.scores, view.seats.map((s) => ({ ...s, note: s.out ? 'OUT' : '' })), view.current, 0);

    // tiles
    const sets = flipping ? validSets(st.turn.open, st.turn.target, o.maxTiles) : [];
    const hintTiles = new Set(sets.flat());
    ui.tiles.innerHTML = '';
    view.tiles.forEach((state, i) => {
      const k = i + 1;
      const selected = view.selected.includes(k);
      const anim = view.animTiles.includes(k) ? (state === 'shut' ? ' anim-down' : ' anim-up') : '';
      const b = el('button', `tile ${state}${selected ? ' sel' : ''}${flipping && state === 'open' && hintTiles.has(k) ? ' hint' : ''}${anim}`, state === 'na' ? '' : String(k));
      b.disabled = !(flipping && state === 'open' && hintTiles.has(k));
      b.setAttribute('aria-label', `Tile ${k}, ${state === 'na' ? 'not in this game' : state === 'shut' ? 'shut' : 'open'}${selected ? ', selected' : ''}`);
      b.setAttribute('aria-pressed', String(selected));
      b.addEventListener('click', () => {
        const j = view.selected.indexOf(k);
        if (j >= 0) view.selected.splice(j, 1); else view.selected.push(k);
        this.render(ui, view, session, ctx);
      });
      ui.tiles.appendChild(b);
    });

    // dice tray: dice are positioned inside it by transforms (see placeDice)
    ui.tray.innerHTML = '';
    const n = view.dice.length;
    placeDice(n, view.rollId).forEach((p, i) => {
      const d = el('div', 'tdie');
      d.style.left = `${p.left}%`;
      d.style.top = `${p.top}%`;
      d.style.transform = `translate(-50%, -50%) rotate(${p.rot.toFixed(1)}deg)`;
      d.appendChild(renderDie(view.dice[i], { tumble: ctx.tumble && !ctx.reduced, danger: false, cls: 'cream' }));
      ui.tray.appendChild(d);
    });
    const sel = view.selected.slice().sort((a, b) => a - b);
    const selSum = sel.reduce((a, b) => a + b, 0);
    const info = el('div', 'trayinfo');
    if (!n) info.textContent = session.isOver() ? '' : cur.isBot ? `${cur.name} is thinking…` : 'Roll the dice';
    else info.textContent = `Roll ${view.target}${flipping ? ` · selected ${sel.length ? `${sel.join(' + ')} = ${selSum}` : 'none'}` : ''}`;
    ui.tray.appendChild(info);
    ui.tray.appendChild(ui.banner);

    // cover (slides down over the box when the box is shut)
    ui.cover.className = 'cover walnut' + (view.cover && view.cover.down ? ' down' : '');
    ui.cover.innerHTML = '';
    ui.cover.setAttribute('aria-hidden', String(!(view.cover && view.cover.down)));
    if (view.cover) {
      const em = el('div', 'emblem gold');
      if (view.cover.congrats) em.appendChild(el('div', 'cg', 'CONGRATULATIONS!'));
      em.appendChild(el('div', 'cs', view.cover.sub));
      ui.cover.appendChild(em);
      ui.cover.setAttribute('aria-label', (view.cover.congrats ? 'Congratulations! ' : '') + view.cover.sub);
    }

    // banner + turn line
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.turnline.innerHTML = '';
    if (!session.isOver()) {
      const round = o.format === 'single' ? '' : ` · round ${view.round}`;
      if (cur.name === 'You') ui.turnline.append(document.createTextNode(`Your turn${round}`));
      else ui.turnline.append(el('strong', null, cur.name), document.createTextNode(`${cur.isBot ? ' is thinking…' : "'s turn"}${round}`));
    }

    // buttons
    let buttons;
    if (phase === 'flip' && !session.isOver()) {
      const exact = sets.some((s) => s.join(',') === sel.join(','));
      buttons = [{ label: sel.length ? `FLIP ${sel.join(' + ')}` : 'FLIP', cls: 'btn-roll', span2: true, disabled: !(flipping && exact), onClick: () => ctx.act([{ type: 'FLIP', ids: sel }]) }];
    } else if (oneDieAllowed(ONE_DIE[o.oneDie], st.turn.open)) {
      buttons = [
        { label: 'ROLL 2 DICE', cls: 'btn-roll', disabled: !human, onClick: () => ctx.act([{ type: 'ROLL', ids: [0, 1] }]) },
        { label: 'ROLL 1 DIE', cls: 'btn-bank', disabled: !human, onClick: () => ctx.act([{ type: 'ROLL', ids: [0] }]) },
      ];
    } else {
      buttons = [{ label: 'ROLL', cls: 'btn-roll', span2: true, disabled: !human, onClick: () => ctx.act([{ type: 'ROLL', ids: [0, 1] }]) }];
    }
    renderTurnBar(ui.controls, buttons);
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    const size = view.tiles.filter((t) => t !== 'na').length;
    view.animTiles = [];
    let delay = 0;
    let tumble = false;
    switch (ev.type) {
      case 'ROLLED':
        view.dice = ev.dice.slice();
        view.target = ev.target;
        view.rollId += 1;
        view.selected = [];
        view.banner = null;
        tumble = true;
        delay = ctx.reduced ? 150 : 650;
        ctx.announce(`${name(ev.seat)} rolled ${ev.dice.join(' and ')}, total ${ev.target}`);
        break;
      case 'FLIPPED':
        ev.ids.forEach((id) => { view.tiles[id - 1] = 'shut'; });
        view.animTiles = ev.ids.slice();
        view.selected = [];
        ctx.log(`${name(ev.seat)} shut ${ev.ids.join(' + ')}`);
        delay = ctx.reduced ? 100 : 380;
        break;
      case 'NO_MOVE':
        view.banner = { text: `NO MOVE! Score ${ev.score}` };
        ctx.log(`${name(ev.seat)} could not move: score ${ev.score}`);
        ctx.announce(`No move. ${name(ev.seat)} scores ${ev.score}`);
        ctx.vibrate();
        delay = ctx.reduced ? 600 : 1500; // the NO MOVE notice stays up 1.5 s (user request)
        break;
      case 'BOX_SHUT': {
        const seat = view.seats[ev.seat];
        const who = seat.name === 'You' ? 'You' : seat.name;
        view.cover = { down: true, congrats: !seat.isBot, sub: `${who} shut the box!` };
        ctx.log(`${name(ev.seat)} shut the box!`);
        ctx.announce(`${seat.isBot ? '' : 'Congratulations! '}${who} shut the box!`);
        delay = (ctx.reduced ? 0 : 600) + 2000; // slide down, then hold 2 s so the message can be read
        break;
      }
      case 'SCORED':
        view.seats[ev.seat].total = ev.total;
        ctx.log(`${name(ev.seat)} scored ${ev.score}`);
        if (view.cover && view.cover.down) {
          // the cover slides back up, then every tile flips back up (a reset)
          view.cover = { ...view.cover, down: false };
          view.tiles = initialTiles(size);
          view.animTiles = view.tiles.map((t, i) => (t === 'open' ? i + 1 : 0)).filter(Boolean);
          view.dice = [];
          view.target = 0;
          delay = ctx.reduced ? 0 : 1200;
        } else delay = 300;
        break;
      case 'TURN_ENDED':
        view.banner = null;
        view.seats[ev.seat].turns += 1;
        break;
      case 'ELIMINATED':
        view.seats[ev.seat].out = true;
        view.banner = { text: `${name(ev.seat)} is OUT` };
        ctx.log(`${name(ev.seat)} is out (${ev.total})`);
        ctx.announce(`${name(ev.seat)} is out`);
        delay = ctx.reduced ? 500 : 900;
        break;
      case 'ROUND_STARTED':
        view.round = ev.round;
        view.banner = null;
        ctx.log(`Round ${ev.round}`);
        break;
      case 'TURN_STARTED': {
        view.current = ev.seat;
        view.dice = [];
        view.target = 0;
        view.selected = [];
        const fresh = initialTiles(size);
        const changed = fresh.map((t, i) => (t !== view.tiles[i] ? i + 1 : 0)).filter(Boolean);
        view.tiles = fresh;
        view.animTiles = changed;
        delay = changed.length ? (ctx.reduced ? 0 : 600) : 150;
        break;
      }
      default:
        break;
    }
    return { delay, tumble };
  },
};
