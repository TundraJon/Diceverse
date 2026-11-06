// Reusable panels: ScoreStrip and TurnBar.
export function renderScoreStrip(container, seats, current, turnPoints, onSeatClick) {
  container.innerHTML = '';
  container.className = 'scores' + (seats.length === 1 ? ' one' : '');
  seats.forEach((s, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (i === current ? ' active' : '');
    const name = document.createElement('div');
    name.className = 'name';
    const n = document.createElement('span');
    n.textContent = (s.isBot ? '🤖 ' : '👤 ') + s.name;
    const t = document.createElement('span');
    t.textContent = `${s.turns} turn${s.turns === 1 ? '' : 's'}`;
    name.append(n, t);
    const total = document.createElement('div');
    total.className = 'total';
    total.textContent = String(s.total);
    const tp = document.createElement('div');
    tp.className = 'tp';
    tp.textContent = i === current && turnPoints > 0 ? `+${turnPoints} this turn` : s.note || '';
    chip.append(name, total, tp);
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
