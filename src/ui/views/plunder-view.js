// Pirate Plunder view: the tile row, the dice you kept, the dice you rolled (tap one to keep all of that face), and the claim choice.
import { renderDie, ROLL_MS, REVEAL_MS } from '../dice.js';
import { statusOverride } from '../avatars.js';
import { apply, claimOptions, coinsOf, faceValue, tileNumbers, MAP } from '../../games/plunder.js';

// All the theme words live here so another skin is a small change.
const THEME = {
  title: 'PIRATE PLUNDER',
  coin: '\u{1FA99}',
  map: '\u{1F5FA}️',
  tagline: 'Grab the loot. Beat the rivals to the chests.',
  bust: 'Rough seas! Haul lost.',
  treasure: "Now that's treasure.",
  win: 'Best haul on the seven seas.',
  steal: (tile, name) => `Plundered ${tile} from ${name}!`,
};
const SYMBOLS = [null, null, null, null, null, THEME.map]; // pips on 1 to 5, the map on face 6
const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const colorOf = (view, i) => view.seats[i].color || SEAT_COLORS[i];

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const faceName = (f, n) => (f === MAP ? (n === 1 ? 'map' : 'maps') : `${f}${n === 1 ? '' : 's'}`);
const faceShort = (f) => (f === MAP ? THEME.map : `${f}s`);
const coinsOfStack = (stack) => stack.reduce((a, n) => a + coinsOf(n), 0);

export const plunderView = {
  title: THEME.title,

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Pirate Plunder'));
    sheet.appendChild(el('p', 'tagline', THEME.tagline));
    const last = options.tiles === 'short' ? 32 : 36;
    [
      `The sea holds loot tiles numbered 21 to ${last}. The higher the number, the more coins ${THEME.coin} it is worth (1 coin for 21 to 24, 2 for 25 to 28, 3 for 29 to 32, 4 for 33 to 36).`,
      `On your turn, roll all 8 dice. They show 1 to 5 or a map ${THEME.map} that counts as 5.`,
      'Keep every die that shows one number. You can never keep a number you already kept this turn. Then take a tile or roll the dice that are left.',
      options.mapNeeded === false
        ? 'You can take a tile when your total equals or beats a tile in the sea.'
        : `You can take a tile when you have kept at least one map ${THEME.map} and your total equals or beats a tile in the sea.`,
      'You may take any tile you can reach, not only the highest.',
      options.steal === false ? null : 'Or steal: if your total is exactly the number of another player’s top tile, you can take that tile instead.',
      'Rolled only numbers you already kept? Or all dice kept and you cannot take a tile? Rough seas: the highest tile in the sea is lost, and your top tile goes back to the sea.',
      'When no tile is left in the sea, the most coins wins. A tie goes to the player holding the highest tile.',
      'Solo: play until the sea is empty; your score is your coins.',
    ].filter(Boolean).forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h, mode) {
    return `${h.tiles === 'short' ? 'Short (21-32)' : 'Standard (21-36)'}${h.mapNeeded === false ? ' · no map needed' : ''}${mode !== 'solo' && h.steal === false ? ' · no stealing' : ''}`;
  },

  init(session) { return this.sync(null, session); },

  sync(prev, session) {
    const st = session.state;
    const t = st.turn;
    return {
      seats: st.seats.map((s) => ({ name: s.name, isBot: s.isBot, turns: s.turns })),
      current: st.current,
      tiles: { ...st.tiles },
      stacks: st.stacks.map((a) => a.slice()),
      dice: st.dice.map((d) => ({ ...d })),
      total: t.total,
      map: t.map,
      kept: t.kept.slice(),
      rolled: [],
      sel: null,
      pick: null,
      viewed: prev ? prev.viewed : null,
      banner: null,
    };
  },

  build(ui) {
    ui.table.classList.add('pkwrap');
    ui.scores.hidden = true;
    ui.chips = el('div', 'climbchips');
    ui.stackp = el('div', 'stackp');
    const stage = el('div', 'pkstage');
    ui.tiles = el('div', 'pkrow');
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    stage.append(ui.tiles, ui.banner);
    ui.keptTray = el('div', 'trayb');
    ui.rollTray = el('div', 'trayb');
    ui.info = el('div', 'pkinfo');
    ui.steal = el('button', 'secondary small');
    ui.hint = el('div', 'hint');
    ui.table.append(ui.chips, ui.stackp, stage, ui.keptTray, ui.rollTray, ui.info, ui.steal, ui.hint);
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const cur = view.seats[view.current];
    const phase = st.turn.phase;
    const over = session.isOver();
    const human = !over && !cur.isBot && !ctx.busy;
    const o = st.options;
    ui.controls.classList.add('sticky');
    ui.log.hidden = true;

    // one line per player: colour, face and name, coins and top tile; tap one to see that player's tiles
    ui.chips.innerHTML = '';
    ui.chips.style.setProperty('--n', String(view.seats.length === 1 ? 1 : 2));
    view.seats.forEach((s, i) => {
      const stack = view.stacks[i];
      const coins = coinsOfStack(stack);
      const top = stack.length ? stack[stack.length - 1] : null;
      const chip = el('div', 'cchip' + (i === view.current && !over ? ' active' : '') + (i === view.viewed ? ' viewed' : ''));
      const sw = el('i');
      sw.style.background = colorOf(view, i);
      chip.append(sw, el('span', 'cn', `${s.face || (s.isBot ? '\u{1F916}' : '\u{1F464}')} ${s.name}`), el('b', null, `${THEME.coin}${coins}${top ? ` · ${top}` : ''}`));
      chip.tabIndex = 0;
      chip.setAttribute('role', 'button');
      chip.setAttribute('aria-label', `${s.name}: ${coins} coins${top ? `, top tile ${top}` : ''}. Show their tiles`);
      const show = () => { view.viewed = view.viewed === i ? null : i; this.render(ui, view, session, ctx); };
      chip.addEventListener('click', show);
      chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
      ui.chips.appendChild(chip);
    });
    ui.stackp.hidden = view.viewed === null;
    ui.stackp.innerHTML = '';
    if (view.viewed !== null) {
      const stack = view.stacks[view.viewed];
      ui.stackp.appendChild(el('span', null, `${view.seats[view.viewed].name}'s tiles${stack.length ? ' (top is last)' : ': none yet'}`));
      stack.forEach((n) => ui.stackp.appendChild(el('span', 'mini', `${n} ${THEME.coin.repeat(coinsOf(n))}`)));
    }

    // what the current selection would do (keep the dice, then maybe take a tile)
    const free = view.dice.filter((d) => d.state === 'free');
    const picking = phase === 'pick' && human;
    let pv = null; // { ids, face, count, add, total, options, freeLeft, bust }
    if (picking && view.sel !== null) {
      const ids = free.filter((d) => d.face === view.sel).map((d) => d.id);
      if (ids.length) {
        try {
          const next = apply(st, { type: 'SET_ASIDE', ids }, null).state;
          const decided = !next.over && next.current === st.current && next.turn.phase === 'decide';
          pv = {
            ids, face: view.sel, count: ids.length, add: faceValue(view.sel) * ids.length, total: st.turn.total + faceValue(view.sel) * ids.length,
            options: decided ? claimOptions(next) : [], freeLeft: decided ? next.dice.filter((d) => d.state === 'free').length : 0, bust: !decided,
          };
        } catch { pv = null; }
      }
    }
    // after a keep that is already done (only after a page reload mid-turn) the choice is simply the current options
    const resumeOpts = phase === 'decide' && human ? claimOptions(st) : [];
    const opts = pv ? pv.options : resumeOpts;
    const midOpts = opts.filter((x) => x.from === 'mid');
    const stealOpt = opts.find((x) => x.from !== 'mid') || null;
    if (!opts.some((x) => x.tile === view.pick)) view.pick = midOpts.length ? midOpts[midOpts.length - 1].tile : stealOpt ? stealOpt.tile : null;
    const chosen = opts.find((x) => x.tile === view.pick) || null;

    // the tile row
    const nums = tileNumbers(o.tiles);
    ui.tiles.style.setProperty('--cols', String(nums.length / 2));
    ui.tiles.innerHTML = '';
    nums.forEach((n) => {
      const sv = view.tiles[n];
      const isOpt = sv === 'mid' && midOpts.some((x) => x.tile === n);
      const tile = el('div', 'pk' + (sv === 'down' ? ' down' : sv === 'mid' ? '' : ' gone') + (isOpt ? ' opt' : '') + (chosen && chosen.tile === n ? ' hot' : ''));
      if (sv === 'mid') {
        tile.append(el('b', null, String(n)), el('span', null, THEME.coin.repeat(coinsOf(n))));
        tile.setAttribute('role', isOpt ? 'button' : 'img');
        tile.setAttribute('aria-label', `Tile ${n}, ${coinsOf(n)} coin${coinsOf(n) === 1 ? '' : 's'}${isOpt ? ', you can take it' : ''}`);
        if (isOpt) { tile.tabIndex = 0; tile.addEventListener('click', () => { view.pick = n; this.render(ui, view, session, ctx); }); }
      } else tile.setAttribute('aria-hidden', 'true');
      ui.tiles.appendChild(tile);
    });
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner' + (view.banner && view.banner.good ? ' hot' : '');

    // the dice you kept
    const kept = view.dice.filter((d) => d.state === 'kept').sort((a, b) => a.face - b.face);
    ui.keptTray.innerHTML = '';
    ui.keptTray.appendChild(el('h4', null, `Kept: total ${view.total}${o.mapNeeded === false ? '' : ` · ${THEME.map} ${view.map ? '✓' : '✗'}`}`));
    const krow = el('div', 'keptrow');
    kept.forEach((d) => krow.appendChild(renderDie(d.face, { danger: false, symbols: SYMBOLS })));
    if (!kept.length) krow.appendChild(el('span', 'none', 'Nothing kept yet'));
    ui.keptTray.appendChild(krow);

    // the dice you rolled: tap one to keep all the dice of that face
    ui.rollTray.innerHTML = '';
    ui.rollTray.appendChild(el('h4', null, picking ? 'Rolled: tap a number to keep all of those dice' : 'Rolled'));
    ui.dice = el('div', 'dice pkdice');
    free.forEach((d) => {
      const taken = d.face > 0 && view.kept.includes(d.face);
      const btn = el('button', 'dieBtn' + (view.sel !== null && d.face === view.sel ? ' sel' : '') + (taken ? ' taken' : ''));
      btn.disabled = !picking || taken || d.face === 0;
      btn.setAttribute('aria-pressed', String(view.sel !== null && d.face === view.sel));
      btn.setAttribute('aria-label', d.face === 0 ? 'Die, not rolled' : `Die showing ${d.face === MAP ? 'a map' : d.face}${taken ? ', already kept' : ''}`);
      btn.appendChild(renderDie(d.face === 0 ? null : d.face, { tumble: ctx.tumble && !ctx.reduced && view.rolled.includes(d.id), danger: false, symbols: SYMBOLS }));
      btn.addEventListener('click', () => { view.sel = d.face; view.pick = null; this.render(ui, view, session, ctx); });
      ui.dice.appendChild(btn);
    });
    ui.rollTray.appendChild(ui.dice);

    // what the selection does, and the steal choice
    let info = '';
    if (over) info = '';
    else if (cur.isBot) info = '';
    else if (ctx.busy) info = 'Rolling…';
    else if (phase === 'roll') info = 'Roll the 8 dice';
    else if (phase === 'pick') {
      info = pv
        ? `Keeping ${faceName(pv.face, pv.count)}: +${pv.add}, total ${pv.total}`
        : 'Tap a number to keep all of those dice';
    } else info = `Total ${view.total}`;
    ui.info.textContent = info;
    ui.info.classList.toggle('bad', !!(pv && pv.bust));
    ui.steal.hidden = !stealOpt;
    if (stealOpt) {
      const victim = view.seats[stealOpt.from].name;
      const on = chosen && chosen.tile === stealOpt.tile;
      ui.steal.textContent = on ? `Stealing ${stealOpt.tile} from ${victim} (tap to take a sea tile instead)` : `Steal ${stealOpt.tile} from ${victim} instead`;
      ui.steal.onclick = () => { view.pick = on && midOpts.length ? midOpts[midOpts.length - 1].tile : stealOpt.tile; this.render(ui, view, session, ctx); };
    }
    ui.hint.textContent = statusOverride(view, cur, over) || (over ? '' : cur.isBot ? `${cur.name} is thinking…` : '');

    // controls
    ui.controls.innerHTML = '';
    ui.controls.style.gridTemplateColumns = '';
    const btn = (label, cls, disabled, onClick, sub) => {
      const b = el('button', cls + (sub ? ' pair' : ''));
      b.appendChild(document.createTextNode(label));
      if (sub) b.appendChild(el('small', 'sub', sub));
      b.disabled = !!disabled;
      b.addEventListener('click', onClick);
      ui.controls.appendChild(b);
      return b;
    };
    const keepAct = pv ? { type: 'SET_ASIDE', ids: pv.ids } : null;
    if (phase === 'roll' || over) {
      btn('ROLL', 'btn-roll span2', !human || over, () => ctx.act([{ type: 'ROLL' }]));
    } else if (phase === 'pick') {
      const subKeep = pv ? `keep ${faceShort(pv.face)}` : 'tap a number first';
      if (pv && pv.bust) {
        btn('KEEP', 'btn-roll span2', !human, () => ctx.act([keepAct]), `${faceShort(pv.face)}: this ends your turn`);
      } else {
        btn('ROLL AGAIN', 'btn-roll', !(picking && pv && pv.freeLeft > 0), () => ctx.act([keepAct, { type: 'ROLL' }]), subKeep);
        const stealing = chosen && chosen.from !== 'mid';
        btn(chosen ? `${stealing ? 'STEAL' : 'TAKE'} ${chosen.tile}` : 'TAKE TILE', 'btn-bank', !(picking && pv && chosen), () => ctx.act([keepAct, { type: 'CLAIM', tile: chosen.tile }]), chosen ? `${subKeep}${stealing ? ` · from ${view.seats[chosen.from].name}` : ''}` : subKeep);
      }
    } else {
      btn('ROLL AGAIN', 'btn-roll', !(human && free.length), () => ctx.act([{ type: 'ROLL' }]));
      const stealing = chosen && chosen.from !== 'mid';
      btn(chosen ? `${stealing ? 'STEAL' : 'TAKE'} ${chosen.tile}` : 'TAKE TILE', 'btn-bank', !(human && chosen), () => ctx.act([{ type: 'CLAIM', tile: chosen.tile }]));
    }
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    switch (ev.type) {
      case 'ROLLED':
        ev.dice.forEach((d) => { view.dice[d.id].face = d.face; });
        view.rolled = ev.dice.map((d) => d.id);
        view.sel = null;
        view.pick = null;
        view.banner = null;
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : ROLL_MS + REVEAL_MS; // the choices appear 0.25 s after the dice stop
        ctx.announce(`${name(ev.seat)} rolled ${ev.dice.map((d) => (d.face === MAP ? 'a map' : d.face)).join(', ')}`);
        break;
      case 'SET_ASIDE':
        ev.ids.forEach((id) => { view.dice[id].state = 'kept'; });
        view.kept.push(ev.face);
        view.total = ev.total;
        view.map = ev.map;
        view.sel = null;
        view.pick = null;
        view.rolled = [];
        ctx.log(`${name(ev.seat)} kept ${faceName(ev.face, ev.ids.length)} (total ${ev.total})`);
        delay = ctx.reduced ? 100 : 350;
        break;
      case 'BANKED':
        if (ev.from !== 'mid') view.stacks[ev.from].pop();
        view.stacks[ev.seat].push(ev.tile);
        view.tiles[ev.tile] = ev.seat;
        if (ev.from !== 'mid') view.banner = { text: THEME.steal(ev.tile, name(ev.from)), good: true };
        else if (ev.amount >= 4) view.banner = { text: THEME.treasure, good: true };
        ctx.log(`${name(ev.seat)} took tile ${ev.tile}${ev.from !== 'mid' ? ` from ${name(ev.from)}` : ''}`);
        ctx.announce(`${name(ev.seat)} took tile ${ev.tile}${ev.from !== 'mid' ? ` from ${name(ev.from)}` : ''}`);
        delay = view.banner ? (ctx.reduced ? 500 : 1100) : 600;
        break;
      case 'BUSTED':
        if (ev.turned !== null) view.tiles[ev.turned] = 'down';
        if (ev.returned !== null) { view.stacks[ev.seat].pop(); view.tiles[ev.returned] = 'mid'; }
        view.banner = { text: THEME.bust };
        ctx.log(`${name(ev.seat)} failed${ev.turned !== null ? `: tile ${ev.turned} is lost` : ''}${ev.returned !== null ? `, tile ${ev.returned} goes back` : ''}`);
        ctx.announce(`${name(ev.seat)} failed to take a tile`);
        ctx.vibrate();
        delay = ctx.reduced ? 600 : 1500;
        break;
      case 'TURN_ENDED':
        view.banner = null;
        view.seats[ev.seat].turns += 1;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.dice.forEach((d) => { d.face = 0; d.state = 'free'; });
        view.total = 0;
        view.map = false;
        view.kept = [];
        view.rolled = [];
        view.sel = null;
        view.pick = null;
        delay = 200;
        break;
      case 'GAME_OVER':
        view.banner = { text: THEME.win, good: true };
        delay = ctx.reduced ? 200 : 600;
        break;
      default:
        break;
    }
    return { delay, tumble };
  },
};
