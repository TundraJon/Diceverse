// Farkle view: six tappable dice, a kept row, live selection score, and the turn bar.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderScoreStrip, renderTurnBar } from '../panels.js';
import { isMe, statusOverride } from '../avatars.js';
import { scoreSelection, bestSelection, scoreTable } from '../../blocks/combo-table.js';
import { canBank } from '../../games/farkle.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const blankDice = () => Array.from({ length: 6 }, (_, i) => ({ id: i, value: null, state: 'free', sides: 6 }));
const fmt = (n) => n.toLocaleString('en-US');

export const farkleView = {
  title: 'FARKLE',

  rulesSheet(sheet, options) {
    const o = options;
    sheet.appendChild(el('h2', null, 'How to play Farkle'));
    const lines = [
      'Roll six dice. If none of them score, that is a Farkle: you lose your turn points and your turn ends.',
      'Otherwise tap the scoring dice you want to set aside, then either roll the remaining dice or bank your turn points.',
      'If all six dice score (hot dice), you may bank or roll all six again.',
      'Three of a kind or better must come from a single roll.',
      o.entry > 0 ? `Until you have banked once, you need ${fmt(o.entry)} points in a single turn to get on the board.` : 'You can bank any amount at any time.',
      o.penalty ? 'Three Farkles in a row costs you 1,000 points.' : null,
      o.finalRound ? `When someone banks ${fmt(o.target)} or more, every other player gets one last turn. Highest total wins.` : `First to bank ${fmt(o.target)} wins.`,
      'Solo: reach the target in as few turns as you can.',
    ].filter(Boolean);
    lines.forEach((t) => sheet.appendChild(el('p', null, t)));
    // One table with both scoring sets side by side, built from the same constants as the engine.
    sheet.appendChild(el('h2', null, 'Scoring'));
    const standard = scoreTable('standard');
    const classic = new Map(scoreTable('classic').map((r) => [r.label, r.points]));
    const table = el('table', 'cmp');
    const head = el('tr');
    ['Name', 'Classic', 'Standard'].forEach((t, i) => {
      const th = el('th', i ? 'num' : null, t);
      th.scope = 'col';
      head.appendChild(th);
    });
    table.appendChild(el('thead')).appendChild(head);
    const body = el('tbody');
    standard.forEach((r) => {
      const tr = el('tr');
      const name = el('th', null, r.label);
      name.scope = 'row';
      const c = classic.get(r.label);
      tr.append(name, el('td', 'num' + (c === undefined ? ' dash' : ''), c === undefined ? '\u2014' : fmt(c)), el('td', 'num', fmt(r.points)));
      body.appendChild(tr);
    });
    table.appendChild(body);
    sheet.appendChild(table);
    sheet.appendChild(el('p', 'note', 'A dash (\u2014) means that combination does not score in that set.'));
  },

  summary(h, mode) {
    return `Target ${fmt(h.target)} · ${h.entry ? fmt(h.entry) + ' to start' : 'no entry minimum'} · ${h.scoring} scoring${h.penalty ? ' · −1,000 for 3 Farkles' : ''}${mode !== 'solo' && h.finalRound ? ' · final round' : ''}`;
  },

  init(session) {
    return this.sync(null, session);
  },

  sync(_view, session) {
    const st = session.state;
    return {
      seats: st.seats.map((s) => ({ name: s.name, isBot: s.isBot, total: s.total, turns: s.turns, onBoard: s.onBoard })),
      current: st.current,
      turnPoints: st.turn.points,
      dice: st.turn.dice.map((d) => ({ ...d })),
      selected: [],
      rolled: [],
      banner: null,
    };
  },

  build(ui) {
    ui.banner = el('div', 'banner');
    ui.banner.hidden = true;
    ui.kept = el('div', 'kept');
    ui.dice = el('div', 'dice farkle');
    ui.badge = el('div', 'selbadge');
    ui.helper = el('div', 'helper');
    ui.hint = el('div', 'hint');
    ui.turnline = el('div', 'turnline');
    ui.table.append(ui.banner, ui.kept, ui.dice, ui.badge, ui.helper, ui.hint, ui.turnline);
  },

  render(ui, view, session, ctx) {
    const st = session.state;
    const o = st.options;
    const cur = view.seats[view.current];
    const phase = st.turn.phase;
    const human = !session.isOver() && !cur.isBot && !ctx.busy;
    const picking = human && phase === 'select';

    renderScoreStrip(ui.scores, view.seats.map((s) => ({ ...s, note: o.entry > 0 && !s.onBoard ? 'not on board' : '' })), view.current, view.turnPoints, undefined, { target: o.target, fmt });

    // kept dice (set aside this turn)
    ui.kept.innerHTML = '';
    const kept = view.dice.filter((d) => d.state === 'kept');
    ui.kept.hidden = kept.length === 0;
    kept.forEach((d) => ui.kept.appendChild(renderDie(d.value, { danger: false })));

    // dice still in play
    ui.dice.innerHTML = '';
    const free = view.dice.filter((d) => d.state === 'free');
    free.forEach((d) => {
      const btn = el('button', 'dieBtn' + (view.selected.includes(d.id) ? ' sel' : ''));
      btn.disabled = !picking;
      btn.setAttribute('aria-pressed', String(view.selected.includes(d.id)));
      btn.setAttribute('aria-label', d.value == null ? 'Die, not rolled' : `Die showing ${d.value}${view.selected.includes(d.id) ? ', selected' : ''}`);
      btn.appendChild(renderDie(d.value, { tumble: ctx.tumble && !ctx.reduced && view.rolled.includes(d.id), danger: false }));
      btn.addEventListener('click', () => {
        const i = view.selected.indexOf(d.id);
        if (i >= 0) view.selected.splice(i, 1); else view.selected.push(d.id);
        this.render(ui, view, session, ctx);
      });
      ui.dice.appendChild(btn);
    });

    // selection score
    const selVals = view.selected.map((id) => view.dice.find((d) => d.id === id).value);
    const selScore = view.selected.length ? scoreSelection(selVals, o.scoring) : null;
    ui.badge.className = 'selbadge' + (picking && view.selected.length && selScore === null ? ' bad' : '');
    ui.badge.textContent = !picking ? '' : !view.selected.length ? 'Tap the dice you want to set aside' : selScore === null ? 'Not scoring: every selected die must score' : `+${fmt(selScore)}`;

    // helper
    ui.helper.innerHTML = '';
    if (picking) {
      const b = el('button', 'secondary small', 'Take all scoring');
      b.addEventListener('click', () => {
        const idx = bestSelection(free.map((d) => d.value), o.scoring);
        view.selected = idx ? idx.map((i) => free[i].id) : [];
        this.render(ui, view, session, ctx);
      });
      ui.helper.appendChild(b);
    }

    // hint
    const pts = st.turn.points + (selScore || 0);
    const needs = !st.seats[st.current].onBoard && o.entry > 0;
    ui.hint.textContent = !session.isOver() && !cur.isBot && needs ? `Need ${fmt(o.entry)} in one turn to get on the board (this turn: ${fmt(pts)})` : '';

    // banner
    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner' + (view.banner && view.banner.kind === 'hot' ? ' hot' : '');

    // turn line
    ui.turnline.innerHTML = '';
    const said = statusOverride(view, cur, session.isOver());
    if (said) ui.turnline.textContent = said;
    else if (!session.isOver()) {
      if (isMe(cur)) ui.turnline.append(document.createTextNode('Your turn'));
      else ui.turnline.append(el('strong', null, cur.name), document.createTextNode(cur.isBot ? ' is thinking…' : "'s turn"));
    }

    // buttons
    const left = free.length - view.selected.length;
    const rollCount = phase === 'select' ? (left === 0 ? 6 : left) : (st.turn.hot ? 6 : free.length);
    const validSel = selScore !== null;
    const bankOkAfter = st.seats[st.current].onBoard || o.entry === 0 || pts >= o.entry;
    let buttons;
    if (phase === 'start') {
      buttons = [{ label: 'ROLL 6 DICE', cls: 'btn-roll', span2: true, disabled: !human, onClick: () => ctx.act([{ type: 'ROLL' }]) }];
    } else if (phase === 'select') {
      buttons = [
        { label: `SET ASIDE & ROLL (${rollCount})`, cls: 'btn-roll', disabled: !(picking && validSel), onClick: () => ctx.act([{ type: 'SET_ASIDE', ids: view.selected.slice() }, { type: 'ROLL' }]) },
        { label: 'SET ASIDE & BANK', cls: 'btn-bank', disabled: !(picking && validSel && bankOkAfter), onClick: () => ctx.act([{ type: 'SET_ASIDE', ids: view.selected.slice() }, { type: 'BANK' }]) },
      ];
    } else {
      buttons = [
        { label: `ROLL (${rollCount})`, cls: 'btn-roll', disabled: !human, onClick: () => ctx.act([{ type: 'ROLL' }]) },
        { label: 'BANK', cls: 'btn-bank', disabled: !(human && canBank(st)), onClick: () => ctx.act([{ type: 'BANK' }]) },
      ];
    }
    renderTurnBar(ui.controls, buttons);
  },

  reduce(view, ev, ctx) {
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'ROLLED':
        if (ev.fresh) view.dice = blankDice();
        ev.ids.forEach((id, i) => { const d = view.dice.find((x) => x.id === id); d.value = ev.dice[i]; d.state = 'free'; });
        view.rolled = ev.ids.slice();
        view.selected = [];
        view.banner = null;
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS; // nothing result-dependent shows until the dice have stopped and 0.25 s have passed
        after = `${name(ev.seat)} rolled ${ev.dice.join(', ')}`; // spoken once the dice have settled
        break;
      case 'SCORED':
        ev.ids.forEach((id) => { view.dice.find((x) => x.id === id).state = 'kept'; });
        view.turnPoints = ev.turnPoints;
        view.selected = [];
        view.rolled = [];
        ctx.log(`${name(ev.seat)} set aside +${ev.gain} (turn ${ev.turnPoints})`);
        delay = 350;
        break;
      case 'HOT_DICE':
        view.banner = { text: 'HOT DICE!', kind: 'hot' };
        ctx.log(`${name(ev.seat)} has hot dice`);
        ctx.announce('Hot dice');
        delay = ctx.reduced ? 500 : 800;
        break;
      case 'FARKLED':
        view.turnPoints = 0;
        view.banner = { text: ev.lost > 0 ? `FARKLE! −${fmt(ev.lost)}` : 'FARKLE!', kind: 'bad' };
        ctx.log(`${name(ev.seat)} Farkled`);
        ctx.announce(`${name(ev.seat)} Farkled`);
        ctx.vibrate();
        delay = ctx.reduced ? 600 : 1200;
        break;
      case 'PENALTY':
        view.seats[ev.seat].total = ev.total;
        view.banner = { text: `−${fmt(ev.amount)} PENALTY`, kind: 'bad' };
        ctx.log(`${name(ev.seat)} lost ${fmt(ev.amount)} for three Farkles in a row`);
        ctx.announce(`${name(ev.seat)} lost ${ev.amount} for three Farkles in a row`);
        delay = ctx.reduced ? 600 : 1200;
        break;
      case 'BANKED':
        view.turnPoints = 0;
        view.seats[ev.seat].total = ev.total;
        view.seats[ev.seat].onBoard = true;
        ctx.log(`${name(ev.seat)} banked ${fmt(ev.amount)} (total ${fmt(ev.total)})`);
        ctx.announce(`${name(ev.seat)} banked ${ev.amount}, total ${ev.total}`);
        delay = 450;
        break;
      case 'TURN_ENDED':
        view.banner = null;
        view.seats[ev.seat].turns += 1;
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.turnPoints = 0;
        view.dice = blankDice();
        view.selected = [];
        view.rolled = [];
        delay = 200;
        break;
      default:
        break;
    }
    return { delay, tumble, after };
  },
};
