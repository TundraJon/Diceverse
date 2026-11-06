// Reusable panels: ScoreStrip and TurnBar.
export function renderScoreStrip(container, seats, current, turnPoints) {
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
    tp.textContent = i === current && turnPoints > 0 ? `+${turnPoints} this turn` : '';
    chip.append(name, total, tp);
    container.appendChild(chip);
  });
}

export function renderTurnBar(container, { canRoll, canBank, onRoll, onBank }) {
  container.innerHTML = '';
  const roll = document.createElement('button');
  roll.className = 'btn-roll';
  roll.textContent = 'ROLL';
  roll.disabled = !canRoll;
  roll.addEventListener('click', onRoll);
  const bank = document.createElement('button');
  bank.className = 'btn-bank';
  bank.textContent = 'BANK';
  bank.disabled = !canBank;
  bank.addEventListener('click', onBank);
  container.append(roll, bank);
}
