// How long a roll is shown: the dice tumble for ROLL_MS (keep it equal to the CSS `tumble` animation), and the choices a roll
// leads to (where to place a marker, which category to score) appear REVEAL_MS after the dice have stopped.
export const ROLL_MS = 600;
export const REVEAL_MS = 250;

// Renders a CSS-pip die. A rolled 1 gets a red pip (the Pig danger face).
const PIPS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

export function renderDie(value, { tumble = false, danger = true, cls = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'die' + (value == null ? ' blank' : '') + (tumble ? ' tumble' : '') + (cls ? ' ' + cls : '');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', value == null ? 'Die, not rolled' : `Die showing ${value}`);
  const spots = PIPS[value] || [];
  for (let i = 1; i <= 9; i++) {
    const cell = document.createElement('div');
    if (spots.includes(i)) {
      cell.className = 'pip' + (value === 1 && danger ? ' danger' : '');
    }
    el.appendChild(cell);
  }
  return el;
}
