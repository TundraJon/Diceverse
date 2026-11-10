// Reusable panels: ScoreStrip and TurnBar.
// opts.target (and opts.fmt) adds a smaller "/ target" beside each total.
export function renderScoreStrip(container, seats, current, turnPoints, onSeatClick, opts) {
  container.innerHTML = '';
  container.className = 'scores' + (seats.length === 1 ? ' one' : '');
  seats.forEach((s, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (i === current ? ' active' : '');
    const name = document.createElement('div');
    name.className = 'name';
    const n = document.createElement('span');
    n.textContent = (s.face || (s.isBot ? '🤖' : '👤')) + ' ' + s.name;
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
