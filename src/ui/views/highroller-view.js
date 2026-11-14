// High Roller view: six casino cards (number, name, the banknotes on it, a row of dice per player), the player chips, the dice you have just rolled
// (grouped by number, tap a group and press PLACE) and the payout. Nobody's money is on screen except your own (against bots) and, in Pass & Play,
// the current player's while they hold the peek button; everything is revealed at the end. All theme words live in THEME.
import { renderDie, REVEAL_MS, SETTLE_MS } from '../dice.js';
import { renderTurnBar } from '../panels.js';
import { statusOverride } from '../avatars.js';
import { CASINOS, neutralPlan } from '../../games/highroller.js';

const THEME = {
  title: 'HIGH ROLLER',
  tagline: 'Put your dice where the money is, and where nobody else is crowding.',
  casinos: ['Lucky Seven', 'Golden Dragon', 'Silver Spur', 'Neon Palms', 'Crimson Ace', 'Blue Lagoon'],
  neutral: 'White',
};
const SEAT_COLORS = ['#3b82f6', '#22a55b', '#e5484d', '#f59e0b'];
const NEUTRAL_COLOR = '#f1f5f9';
const BANNER_MS = 2500; // every banner stays at least this long
const COUNT_MS = 1400; // the money count-up at the end of the game
const PAY_MS = 1400; // one casino paid out
const colorOf = (view, i) => (i === view.n ? NEUTRAL_COLOR : view.seats[i].color || SEAT_COLORS[i]);
const money = (v) => `$${v.toLocaleString('en-US')}`;
const short = (v) => `$${v / 1000}K`;
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const clone = (v) => JSON.parse(JSON.stringify(v));

const seatsView = (st) => st.seats.map((s) => ({ name: s.name, isBot: s.isBot, turns: s.turns, own: s.own, neutral: s.neutral, money: s.money, notes: s.notes.length }));

// Finish the casino that was being paid: its dice and notes leave the table.
function settle(view) {
  if (!view.payout) return;
  const c = view.casinos[view.payout.casino];
  c.dice = c.dice.map(() => 0);
  c.notes = [];
  view.payout = null;
}

export const highRollerView = {
  title: THEME.title,

  rulesSheet(sheet, options) {
    sheet.appendChild(el('h2', null, 'How to play High Roller'));
    sheet.appendChild(el('p', 'tagline', THEME.tagline));
    [
      'Six casinos, numbered 1 to 6, each with banknotes on it (every casino holds at least $50,000). Everybody has 8 dice.',
      'On your turn you roll ALL the dice you have left. Choose ONE number: every die showing it, all of them, goes on that casino, even if somebody else is already there. Then it is the next player\'s turn. When you have no dice left you wait; the others carry on.',
      'When everybody has put out all their dice the casinos pay out, from 1 to 6. Players with the SAME number of dice at a casino cancel each other out and get nothing from it. Of the others, the most dice takes the biggest banknote, the next most the next biggest, and so on. Notes nobody wins go back under the pile.',
      'Your money is kept secret: you see the notes being won, but nobody shows a total until the end. After the last round the most money wins; if that is tied, the most banknotes; if that is tied too, the win is shared.',
      options.neutral === 'on' || options.neutral === 'auto' ? 'Neutral dice: white dice count as one more, imaginary player. They are rolled and placed together with your own dice (all the dice showing the number you choose, white ones too), and any money the white player wins goes back under the pile. Auto turns them on for 2 players. With 2 players each of you gets 4 white dice; with 3 or 4 players, 2 each (with 3 players the 2 spare white dice are rolled and placed at the start of the round).' : 'Neutral dice (a house rule): white dice that count as one more, imaginary player.',
      `Solo: you play against the white dice (you have 8 of your own and 8 white ones) and try to finish ${options.rounds || 4} rounds with as much money as you can.`,
    ].forEach((t) => sheet.appendChild(el('p', null, t)));
  },

  summary(h) {
    const bits = [];
    if (h.rounds !== undefined && h.rounds !== 4) bits.push(`${h.rounds} rounds`);
    if (h.neutral === 'on') bits.push('neutral dice');
    else if (h.neutral === 'off') bits.push('no neutral dice');
    return bits.length ? bits.join(' · ') : 'Standard rules';
  },

  init(session) { return this.sync(null, session); },

  sync(old, session) {
    const st = session.state;
    const humans = st.seats.map((s, i) => (s.isBot ? -1 : i)).filter((i) => i >= 0);
    return {
      seats: seatsView(st),
      n: st.n,
      round: st.round,
      rounds: st.rounds,
      start: st.start,
      current: st.current,
      casinos: clone(st.casinos),
      phase: st.phase,
      rolled: st.rolled ? clone(st.rolled) : null,
      plan: neutralPlan(st.options.neutral, st.n),
      viewer: humans.length === 1 ? humans[0] : -1, // the one human whose money may be shown
      shared: humans.length > 1, // Pass & Play: nobody's money is shown, the player in turn may hold to peek at theirs
      over: st.over,
      winners: st.winners.slice(),
      countAt: old ? old.countAt : null,
      rolling: false,
      pick: null,
      banner: null,
      payout: null,
      peeking: false,
      last: null,
      spare: st.spare.slice(),
    };
  },

  build(ui) {
    ui.table.classList.add('hrlwrap');
    ui.scores.hidden = true;
    ui.chips = el('div', 'climbchips');
    ui.banner = el('div', 'banner hrlbanner');
    ui.banner.hidden = true;
    ui.info = el('div', 'hrlinfo');
    ui.grid = el('div', 'hrlgrid');
    ui.roll = el('div', 'hrlroll');
    ui.table.append(ui.chips, ui.banner, ui.info, ui.grid, ui.roll);
    ui.table.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  render(ui, view, session, ctx) {
    const over = session.isOver();
    ui.controls.classList.add('sticky');
    ui.log.hidden = true; // this screen is full
    const cur = view.seats[view.current];
    const solo = view.n === 1;
    const human = !over && !cur.isBot && !ctx.busy && !view.rolling;
    const canSee = (i) => over || view.over || i === view.viewer || (view.shared && view.peeking && i === view.current && !view.seats[i].isBot);

    // the player chips: names, how many banknotes each has (public), and the money where it may be shown
    ui.chips.innerHTML = '';
    ui.chips.style.setProperty('--n', String(solo ? 1 : 2));
    view.seats.forEach((s, i) => {
      const chip = el('div', 'cchip' + (i === view.current && !over ? ' active' : ''));
      const sw = el('i');
      sw.style.background = colorOf(view, i);
      const showMoney = canSee(i);
      const m = el('b', 'hrlmoney', showMoney ? money(s.money) : '$ ?');
      m.dataset.to = String(s.money);
      chip.append(sw, el('span', 'cn', `${s.face || (s.isBot ? '\u{1F916}' : '\u{1F464}')} ${s.name}`), el('b', 'hrlnotecount', `\u{1F9FE}${s.notes}`), m);
      chip.setAttribute('aria-label', `${s.name}: ${s.notes} banknotes${showMoney ? `, ${money(s.money)}` : ''}`);
      ui.chips.appendChild(chip);
    });
    if (view.over && view.countAt !== null && view.countAt !== undefined && !ctx.reduced && !document.body.classList.contains('fast')) {
      const spans = [...ui.chips.querySelectorAll('.hrlmoney')];
      const tick = () => {
        const p = Math.min(1, (performance.now() - view.countAt) / COUNT_MS);
        spans.forEach((sp) => { if (sp.isConnected) sp.textContent = money(Math.round((Number(sp.dataset.to) * p) / 1000) * 1000); });
        if (p < 1 && spans[0] && spans[0].isConnected) requestAnimationFrame(tick);
      };
      tick();
    }

    ui.banner.hidden = !view.banner;
    ui.banner.textContent = view.banner ? view.banner.text : '';
    ui.banner.className = 'banner hrlbanner' + (view.banner && view.banner.good ? ' hot' : '');

    // round line
    ui.info.innerHTML = '';
    const startName = view.seats[view.start].name;
    ui.info.append(el('span', null, `Round ${Math.min(view.round, view.rounds)} of ${view.rounds}`), el('span', null, solo ? '' : `Start: ${startName}`));

    // the six casinos
    ui.grid.innerHTML = '';
    ui.grid.style.setProperty('--rows', String(view.n + (view.plan.per || view.plan.spare ? 1 : 0)));
    const rolled = view.phase === 'place' && view.rolled && !view.rolling ? view.rolled : null;
    const litFace = human && rolled ? view.pick : null;
    for (let c = 0; c < CASINOS; c++) {
      const cas = view.casinos[c];
      const pay = view.payout && view.payout.casino === c ? view.payout : null;
      const card = el('div', 'hrlcas' + (litFace === c + 1 ? ' lit' : '') + (pay ? ' pay' : ''));
      const h = el('div', 'hrlh');
      h.append(el('b', null, String(c + 1)), el('span', null, THEME.casinos[c]));
      card.appendChild(h);
      const notes = el('div', 'hrlnotes');
      cas.notes.forEach((v) => notes.appendChild(el('span', `hrlnote v${v / 1000}`, short(v))));
      card.appendChild(notes);
      const rows = el('div', 'hrlrows');
      cas.dice.forEach((cnt, j) => {
        if (!cnt) return;
        const cancelled = pay && pay.cancelled.includes(j);
        const award = pay ? pay.awards.find((a) => a.who === j) : null;
        const row = el('div', 'hrlrow' + (cancelled ? ' cancel' : '') + (view.last && view.last.face === c + 1 && view.last.who === j ? ' pulse' : ''));
        const sw = el('i');
        sw.style.setProperty('--dc', colorOf(view, j));
        row.append(sw, el('b', null, `×${cnt}`));
        if (award) row.appendChild(el('em', null, `+${short(award.note)}`));
        else if (cancelled) row.appendChild(el('em', 'tie', 'tie'));
        rows.appendChild(row);
      });
      card.appendChild(rows);
      const label = `Casino ${c + 1}, ${THEME.casinos[c]}: ${cas.notes.length ? cas.notes.map(money).join(', ') : 'no banknotes'}`;
      card.setAttribute('aria-label', label);
      ui.grid.appendChild(card);
    }

    // the roll area: the dice just rolled, in groups by number once they have settled
    ui.roll.innerHTML = '';
    const status = el('div', 'hrlstatus');
    const dice = el('div', 'hrldice');
    const info = over ? '' : view.rolling ? 'Rolling…' : cur.isBot ? `${cur.name} is ${view.phase === 'place' ? 'choosing' : 'rolling'}…` : view.phase === 'place' ? 'Tap the dice you want to place, then PLACE' : `${cur.name === 'You' ? '' : `${cur.name}: `}Roll your ${cur.own + cur.neutral} ${cur.own + cur.neutral === 1 ? 'die' : 'dice'}`;
    status.textContent = statusOverride(view, cur, over) || info;
    if (view.phase === 'place' && view.rolled && !over) {
      const items = view.rolled.own.map((v) => ({ v, who: view.current })).concat(view.rolled.neutral.map((v) => ({ v, who: view.n })));
      const mkDie = (it, tumbleIt) => {
        const d = renderDie(it.v, { tumble: tumbleIt, danger: false, cls: it.who === view.n ? '' : 'hrlc' });
        if (it.who !== view.n) d.style.setProperty('--dc', colorOf(view, it.who));
        return d;
      };
      if (view.rolling) {
        // the dice are still rolling: they sit in a row in the order they were rolled, nothing about the result is grouped or lit yet
        items.forEach((it) => dice.appendChild(mkDie(it, ctx.tumble && !ctx.reduced)));
      } else {
        [1, 2, 3, 4, 5, 6].forEach((f) => {
          const g = items.filter((it) => it.v === f);
          if (!g.length) return;
          const interactive = human;
          const box = el(interactive ? 'button' : 'div', 'hrlgroup' + (view.pick === f ? ' sel' : ''));
          if (interactive) {
            box.type = 'button';
            box.setAttribute('aria-pressed', String(view.pick === f));
            box.setAttribute('aria-label', `${g.length} ${g.length === 1 ? 'die' : 'dice'} showing ${f}, for ${THEME.casinos[f - 1]}`);
            box.addEventListener('click', () => { view.pick = view.pick === f ? null : f; this.render(ui, view, session, ctx); });
          }
          g.forEach((it) => box.appendChild(mkDie(it, false)));
          dice.appendChild(box);
        });
      }
    }
    ui.roll.append(status, dice);

    // controls
    const bars = [];
    if (human && view.phase === 'place') {
      bars.push({ label: view.pick ? `PLACE ON ${view.pick}` : 'PLACE', cls: view.shared ? 'btn-roll' : 'btn-roll span2', disabled: !view.pick, onClick: () => ctx.act([{ type: 'PLACE', face: view.pick }]) });
    } else {
      bars.push({ label: 'ROLL', cls: 'btn-roll span2', disabled: !(human && view.phase === 'roll'), onClick: () => ctx.act([{ type: 'ROLL' }]) });
    }
    renderTurnBar(ui.controls, bars);
    if (view.shared && !over && !cur.isBot) {
      // Pass & Play: hold to peek at your own money (nothing else changes on screen)
      const peek = el('button', 'btn-bank hrlpeek' + (view.peeking ? ' on' : ''), view.peeking ? 'PEEKING' : 'HOLD TO PEEK');
      peek.type = 'button';
      peek.setAttribute('aria-pressed', String(!!view.peeking));
      peek.setAttribute('aria-label', 'Hold to peek at your money');
      const on = (v) => { if (view.peeking !== v) { view.peeking = v; this.render(ui, view, session, ctx); } };
      peek.addEventListener('pointerdown', (e) => { e.preventDefault(); on(true); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => peek.addEventListener(n, () => on(false)));
      peek.addEventListener('contextmenu', (e) => e.preventDefault());
      peek.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on(!view.peeking); } });
      ui.controls.appendChild(peek);
      if (bars[0].cls.includes('span2')) ui.controls.firstChild.classList.remove('span2');
    }
  },

  reduce(view, ev, ctx) {
    settle(view);
    const name = (s) => view.seats[s].name;
    let delay = 0;
    let tumble = false;
    let after = null;
    switch (ev.type) {
      case 'ROLLED':
        view.rolled = { own: ev.own.slice(), neutral: ev.neutral.slice() };
        view.phase = 'place';
        view.rolling = true;
        view.pick = null;
        view.banner = null;
        view.last = null;
        tumble = true;
        delay = ctx.reduced ? REVEAL_MS : SETTLE_MS; // nothing about the roll (the groups, the lit casino, the PLACE button) shows until the dice have settled and the pause has passed
        after = `${name(ev.seat)} rolled ${ev.own.concat(ev.neutral).sort((a, b) => a - b).join(', ')}`;
        break;
      case 'PLACED': {
        view.rolling = false;
        const c = view.casinos[ev.face - 1];
        c.dice[ev.seat] += ev.own;
        c.dice[view.n] += ev.neutral;
        view.seats[ev.seat].own -= ev.own;
        view.seats[ev.seat].neutral -= ev.neutral;
        view.seats[ev.seat].turns += 1;
        view.rolled = null;
        view.phase = 'roll';
        view.pick = null;
        view.last = { face: ev.face, who: ev.seat };
        ctx.log(`${name(ev.seat)} put ${ev.own + ev.neutral} on ${ev.face}`);
        delay = ctx.reduced ? 250 : 800;
        break;
      }
      case 'TURN_ENDED':
        break;
      case 'TURN_STARTED':
        view.current = ev.seat;
        view.last = null;
        delay = 150;
        break;
      case 'CASINO_PAID': {
        view.payout = { casino: ev.casino, cancelled: ev.cancelled.slice(), awards: ev.awards.map((a) => ({ ...a })) };
        ev.awards.forEach((a) => {
          if (a.who === view.n) return; // the white player's money goes back under the pile
          view.seats[a.who].notes += 1;
          view.seats[a.who].money += a.note;
        });
        const any = ev.counts.some((x) => x > 0);
        delay = any ? (ctx.reduced ? 700 : PAY_MS) : 120;
        break;
      }
      case 'ROUND_ENDED':
        view.last = null;
        if (ev.round >= view.rounds) { delay = 250; break; } // the game-over banner follows at once
        view.banner = { text: `Round ${ev.round} is over`, good: false };
        ctx.announce(`Round ${ev.round} is over`);
        delay = BANNER_MS;
        break;
      case 'ROUND_STARTED':
        view.banner = null;
        view.round = ev.round;
        view.start = ev.start;
        view.casinos = clone(ev.casinos);
        view.spare = ev.spare.slice();
        view.seats.forEach((s) => { s.own = 8; s.neutral = view.plan.per; });
        ctx.announce(`Round ${ev.round}`);
        delay = ctx.reduced ? 300 : 700;
        break;
      case 'GAME_OVER': {
        view.over = true;
        view.countAt = performance.now();
        view.winners = ev.winners.slice();
        const names = ev.winners.map(name);
        view.banner = { text: view.n === 1 ? 'The rounds are over!' : ev.winners.length > 1 ? `${names.join(' and ')} tie!` : `${names[0]} ${view.seats[ev.winner].me && names[0] === 'You' ? 'win' : 'wins'} the game!`, good: true };
        delay = BANNER_MS;
        break;
      }
      default:
        break;
    }
    return { delay, tumble, after };
  },
};
