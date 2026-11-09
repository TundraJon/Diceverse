// Yacht view: five tappable dice (tap = hold), a roll counter, and the category sheet.
import { renderDie, ROLL_MS, REVEAL_MS } from '../dice.js';
import { renderScoreStrip, renderTurnBar } from '../panels.js';
import { isMe, statusOverride } from '../avatars.js';
import { RULESETS, RULESET_IDS, UPPER_KEYS, UPPER_TARGET, categoryList, potential, totals, comparisonRows } from '../../blocks/category-sheet.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const DASH = '—';

export const yachtView = {
  title: 'YACHT',

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play Yacht'));
    [
      'Roll five dice. Tap dice to hold them, then roll the rest again. You get up to three rolls per turn, and you can stop early.',
      'After your last roll, pick one category and score it. Each category can be used once, so the game lasts one round per category.',
      'The highest total wins. Solo: beat your own best score.',
      'Popular (Bonus) only: an extra five of a kind earns +100 when your Five of a Kind box already holds 50, and that roll can go in any open box (Full House 25, Small Straight 30, Large Straight 40).',
    ].forEach((t) => sheet.appendChild(el('p', null, t)));
    sheet.appendChild(el('h2', null, 'Rule sets'));
    const table = el('table', 'cmp wide');
    const head = el('tr');
    ['Name', ...RULESET_IDS.map((id) => RULESETS[id].short)].forEach((t, i) => {
      const th = el('th', i ? 'num' : null, t);
      th.scope = 'col';
      head.appendChild(th);
    });
    table.appendChild(el('thead')).appendChild(head);
    const body = el('tbody');
    comparisonRows().forEach((r) => {
      const tr = el('tr');
      const name = el('th', null, r[0]);
      name.scope = 'row';
      tr.appendChild(name);
      r.slice(1).forEach((c) => tr.appendChild(el('td', 'num' + (c === DASH ? ' dash' : ''), c)));
      body.appendChild(tr);
    });
    table.appendChild(body);
    sheet.appendChild(table);
    sheet.appendChild(el('p', 'note', 'Sum 5 = all five dice. Sum 4, 3, 2 = only the matching dice. A dash means the category is not in that set. Selected set: ' + RULESETS[options.ruleset].label + '.'));
  },

  summary(h) {
    const s = RULESETS[h.ruleset];
    return `${s.label} · ${s.rounds} rounds`;
  },

  init(session) { return this.sync(null, session); },

  sync(_view, session) {
    const st = session.state;
    return {
      seats: st.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns, card: { ...s.card }, extra: s.extra })),
      current: st.current,
      dice: st.turn.dice.slice(),
      held: [false, false, false, false, false],
      rolled: [],
      selected: null,
      banner: null,
      viewSeat: st.current,
    };
  },

  build(ui) {
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    ui.dice = el('div', 'dice yacht');
    ui.turnline = el('div', 'turnline');
    ui.sheetBox = el('div', 'catsheet');
    ui.table.classList.add('compact');
    ui.table.append(ui.banner, ui.dice, ui.turnline);
    ui.after = ui.sheetBox; // the shell places this right after the table
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const setId = st.options.ruleset;
    const set = RULESETS[setId];
    const cur = view.seats[view.current];
    const phase = st.turn.phase;
    const human = !session.isOver() && !cur.isBot && !ctx.busy;
    const choosing = human && phase === 'choose';
    const rollsLeft = st.turn.rollsLeft;
    if (ui.controls) ui.controls.classList.add('sticky');

    renderScoreStrip(ui.scores, view.seats, view.current, 0, (i) => { view.viewSeat = i; this.render(ui, view, session, ctx); });

    // dice
    ui.dice.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const wrap = el('div', 'dwrap');
      const btn = el('button', 'dieBtn' + (view.held[i] ? ' held' : ''));
      btn.disabled = !(choosing && rollsLeft > 0);
      btn.setAttribute('aria-pressed', String(view.held[i]));
      const v = view.dice[i];
      btn.setAttribute('aria-label', v == null ? 'Die, not rolled' : `Die showing ${v}${view.held[i] ? ', held' : ''}`);
      btn.appendChild(renderDie(v, { tumble: ctx.tumble && !ctx.reduced && view.rolled.includes(i), danger: false }));
      btn.addEventListener('click', () => { view.held[i] = !view.held[i]; this.render(ui, view, session, ctx); });
      wrap.append(btn, el('div', 'holdTag', view.held[i] ? 'HELD' : ''));
      ui.dice.appendChild(wrap);
    }

    // turn line
    ui.turnline.innerHTML = '';
    const said = statusOverride(view, cur, session.isOver());
    if (said) ui.turnline.textContent = said;
    else if (!session.isOver()) {
      const round = Math.min(cur.turns + 1, set.rounds);
      const who = isMe(cur) ? 'Your turn' : cur.name;
      const tail = cur.isBot ? ' is thinking…' : isMe(cur) ? '' : "'s turn";
      const roll = phase === 'start' ? 'ready to roll' : rollsLeft > 0 ? `${rollsLeft} roll${rollsLeft === 1 ? '' : 's'} left` : 'pick a category';
      if (isMe(cur)) ui.turnline.append(document.createTextNode(`${who} · round ${round} of ${set.rounds} · ${roll}`));
      else ui.turnline.append(el('strong', null, cur.name), document.createTextNode(`${tail} · round ${round} of ${set.rounds} · ${roll}`));
    }
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner' + (view.banner && view.banner.kind === 'hot' ? ' hot' : '');

    // category sheet for the viewed seat
    const seatIdx = view.viewSeat;
    const seat = view.seats[seatIdx];
    const mine = seatIdx === view.current;
    const live = mine && phase === 'choose' && !ctx.busy ? st.turn.dice : null; // no previews while the dice are still rolling
    ui.sheetBox.innerHTML = '';
    const head = el('div', 'cathead');
    head.append(el('strong', null, isMe(seat) ? 'Your sheet' : `${seat.name}'s sheet`), el('span', null, mine ? '' : 'viewing (tap a name above)'));
    ui.sheetBox.appendChild(head);
    const list = el('div', 'catlist');
    const tt = totals(setId, seat.card, seat.extra);
    const addRow = (c) => {
      const scored = seat.card[c.key] !== null;
      const selectable = choosing && mine && !scored;
      const row = el('button', 'catRow' + (scored ? ' scored' : '') + (view.selected === c.key ? ' sel' : ''));
      row.disabled = !selectable;
      row.setAttribute('aria-pressed', String(view.selected === c.key));
      const pv = live && !scored ? potential(setId, c.key, live, st.seats[seatIdx].card) : null;
      row.append(el('span', null, c.label), el('span', 'val' + (pv !== null ? (pv === 0 ? ' zero' : ' prev') : ''), scored ? String(seat.card[c.key]) : pv !== null ? String(pv) : DASH));
      row.addEventListener('click', () => { view.selected = view.selected === c.key ? null : c.key; this.render(ui, view, session, ctx); });
      list.appendChild(row);
    };
    categoryList(setId).forEach((c) => {
      addRow(c);
      if (c.key === 'sixes' && set.upperBonus) {
        const prog = el('div', 'catNote', `Upper ${tt.upper} / ${UPPER_TARGET}${tt.bonus ? ` · bonus +${tt.bonus}` : ` · bonus ${set.upperBonus} at ${UPPER_TARGET}`}`);
        list.appendChild(prog);
      }
    });
    if (set.extra && seat.extra) list.appendChild(el('div', 'catNote', `Extra five of a kind bonus: +${seat.extra}`));
    list.appendChild(el('div', 'catNote total', `Total ${tt.total}`));
    ui.sheetBox.appendChild(list);

    // buttons
    const unheld = [0, 1, 2, 3, 4].filter((i) => !view.held[i]);
    const selPts = view.selected && live ? potential(setId, view.selected, live, st.seats[view.current].card) : null;
    const buttons = [];
    if (phase === 'start') {
      buttons.push({ label: 'ROLL', cls: 'btn-roll', span2: true, disabled: !human, onClick: () => ctx.act([{ type: 'ROLL', ids: [0, 1, 2, 3, 4] }]) });
    } else {
      buttons.push({
        label: rollsLeft > 0 ? (unheld.length ? `ROLL (${rollsLeft} left)` : 'HOLD FEWER') : 'NO ROLLS LEFT',
        cls: 'btn-roll', disabled: !(choosing && rollsLeft > 0 && unheld.length > 0),
        onClick: () => ctx.act([{ type: 'ROLL', ids: unheld }]),
      });
      const label = view.selected && mine ? `SCORE ${selPts}` : 'PICK A CATEGORY';
      buttons.push({ label, cls: 'btn-bank', disabled: !(choosing && mine && view.selected), onClick: () => ctx.act([{ type: 'SCORE', category: view.selected }]) });
    }
    renderTurnBar(ui.controls, buttons);
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    switch (ev.type) {
      case 'ROLLED':
        ev.ids.forEach((id, i) => { view.dice[id] = ev.dice[i]; });
        view.rolled = ev.ids.slice();
        view.banner = null;
        view.viewSeat = ev.seat;
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : ROLL_MS + REVEAL_MS; // the score previews appear 0.25 s after the dice stop
        ctx.announce(`${name(ev.seat)} rolled ${ev.dice.join(', ')}`);
        break;
      case 'SCORED': {
        const seat = view.seats[ev.seat];
        seat.card[ev.category] = ev.points;
        seat.extra += ev.bonus;
        seat.total = ev.total;
        view.selected = null;
        view.rolled = [];
        if (ev.joker) view.banner = { text: 'JOKER! +100', kind: 'hot' };
        ctx.log(`${name(ev.seat)} scored ${ev.points} in ${ev.category}${ev.joker ? ' (+100 Joker)' : ''}`);
        ctx.announce(`${name(ev.seat)} scored ${ev.points}`);
        delay = ev.joker ? (ctx.reduced ? 500 : 900) : 500;
        break;
      }
      case 'TURN_ENDED':
        view.banner = null;
        view.seats[ev.seat].turns += 1;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.viewSeat = ev.seat;
        view.dice = [null, null, null, null, null];
        view.held = [false, false, false, false, false];
        view.rolled = [];
        view.selected = null;
        delay = 200;
        break;
      default:
        break;
    }
    return { delay, tumble };
  },
};
