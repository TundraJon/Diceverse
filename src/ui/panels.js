// Reusable panels: ScoreStrip and TurnBar.
// opts.target (and opts.fmt) adds a smaller "/ target" beside each total. opts.compact drops the empty status line and tightens the boxes (Shut the Box). A seat with `swatch` (a colour) gets that colour as a small swatch before its name (Pig).
export function renderScoreStrip(container, seats, current, turnPoints, onSeatClick, opts) {
  container.innerHTML = '';
  container.className = 'scores' + (seats.length === 1 ? ' one' : '') + (opts && opts.compact ? ' compact' : '');
  seats.forEach((s, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (i === current ? ' active' : '');
    const name = document.createElement('div');
    name.className = 'name';
    const n = document.createElement('span');
    n.textContent = (s.face || (s.isBot ? '🤖' : '👤')) + ' ' + s.name;
    if (s.swatch) { // the colour of this player's piece (Pig): a small swatch before the avatar and name, as in the other games
      const sw = document.createElement('i');
      sw.className = 'swatch';
      sw.style.background = s.swatch;
      n.insertBefore(sw, n.firstChild);
    }
    const t = document.createElement('span');
    t.textContent = `${s.turns} turn${s.turns === 1 ? '' : 's'}`;
    name.append(n, t);
    const total = document.createElement('div');
    total.className = 'total';
    total.textContent = String(s.total);
    const tp = document.createElement('div');
    tp.className = 'tp';
    tp.textContent = i === current && turnPoints > 0 ? `+${turnPoints} this turn` : s.note || '';
    if (opts && opts.target != null) {
      const fmt = opts.fmt || String;
      const trow = document.createElement('div');
      trow.className = 'trow';
      const tgt = document.createElement('div');
      tgt.className = 'tgt';
      tgt.textContent = `/ ${fmt(opts.target)}`;
      trow.append(total, tgt);
      chip.setAttribute('aria-label', `${s.name}: ${s.total} of ${fmt(opts.target)}`);
      chip.append(name, trow, tp);
    } else chip.append(name, total, tp);
    if (onSeatClick) {
      chip.tabIndex = 0;
      chip.setAttribute('role', 'button');
      chip.setAttribute('aria-label', `Show ${s.name}'s sheet`);
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => onSeatClick(i));
      chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeatClick(i); } });
    }
    container.appendChild(chip);
  });
}

// buttons: [{ label, cls, disabled, onClick, span2 }]
export function renderTurnBar(container, buttons) {
  container.innerHTML = '';
  buttons.forEach((b) => {
    const el = document.createElement('button');
    el.className = b.cls + (b.span2 ? ' span2' : '');
    el.textContent = b.label;
    el.disabled = !!b.disabled;
    el.addEventListener('click', b.onClick);
    container.appendChild(el);
  });
}
