// Dice: a real CSS 3D cube (six faces, no library, no canvas). At rest the result face is on top, facing the camera, with a
// small tilt so a sliver of the sides shows. When thrown, the cube drops in, bounces about three times with a shadow, spins down
// and settles exactly on its value. The throw is cosmetic: the roll was decided by the rules before it starts.

// How long a throw lasts, and how long after the dice stop the choices a roll leads to appear (where to place a marker, which
// category to score).
export const ROLL_MS = 1000;
export const REVEAL_MS = 250;
// Nothing that depends on a roll's result may show until the dice have stopped and this long has passed (the rule in CLAUDE.md).
export const SETTLE_MS = ROLL_MS + REVEAL_MS;

// Pip positions on a 3 x 3 grid for each face. Opposite faces add to 7 (1/6, 2/5, 3/4).
const PIPS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

// The rotation that brings face N toward the camera (face 1 is the front, 6 the back, 3 the right, 4 the left, 2 the top, 5 the
// bottom of the un-rotated cube).
const REST = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

// How each die of a throw varies, picked by the die's position in the throw and the throw's number, so the dice never move in
// lockstep. No randomness. lat: the sideways start offset in die sizes; spin: how much it rolls (1 = the base 720 degrees);
// wob: degrees the rolling axis is turned from straight across the travel, so a die tumbles a little off the straight line.
const LAT = [-1.0, 0.0, 1.0, -0.6, 0.8, 0.3];
const SPIN = [1, 1.15, 0.9, 1.05, 0.95, 1.1];
const WOB = [-22, 12, 28, -15, 20, -28];

let throwAt = 0; // when the current throw started (set by the shell; a re-render during a throw continues it)
let throwNo = 0;
let throwDir = [0, -1]; // which way the dice travel on the screen (x right, y down); up = thrown from the bottom
let seq = 0; // the position of the next die in this render pass

// `dir` is the travel direction: [0, -1] from the bottom (up), [-0.7, 0.7] from the top right, [1, 0] from the left, [-1, 0] from the right.
export function startThrow(at, dir) { throwAt = at; throwNo += 1; if (dir) throwDir = dir; }
export function beginDice() { seq = 0; }

const num = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// `symbols` (six emoji, one per face number) draws symbol dice instead of pips; an empty entry (null) keeps the pips on that face; `kind` is the body colour (green, yellow, red, crew).
export function renderDie(value, { tumble = false, danger = true, cls = '', sides = 6, symbols = null, kind = '' } = {}) {
  if (sides !== 6) throw new Error('Only six-sided dice are built so far');
  const k = seq++;
  const el = document.createElement('div');
  el.className = 'die' + (value == null ? ' blank' : '') + (symbols && symbols.every(Boolean) ? ' sym' : '') + (kind ? ' k-' + kind : '') + (cls ? ' ' + cls : '');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', value == null ? 'Die, not rolled' : (symbols && symbols[value - 1] ? `Die showing ${symbols[value - 1]}` : `Die showing ${value}`));

  const tilt = document.createElement('div');
  tilt.className = 'tilt';
  const cube = document.createElement('div');
  cube.className = 'cube';
  for (let f = 1; f <= 6; f++) {
    const face = document.createElement('div');
    face.className = `face f${f}`;
    face.setAttribute('aria-hidden', 'true');
    if (symbols && symbols[f - 1]) {
      face.classList.add('symf');
      const sy = document.createElement('div');
      sy.className = 'symface' + (symbols[f - 1] && symbols[f - 1].length > 3 ? ' two' : '');
      if (value != null) sy.textContent = symbols[f - 1];
      face.appendChild(sy);
      cube.appendChild(face);
      continue;
    }
    for (let i = 1; i <= 9; i++) {
      const cell = document.createElement('div');
      if (value != null && PIPS[f].includes(i)) cell.className = 'pip' + (f === 1 && danger ? ' danger' : '');
      face.appendChild(cell);
    }
    cube.appendChild(face);
  }
  const [fx, fy] = REST[value] || REST[1];
  const rest = `translate3d(0, 0, 0) rotateX(${fx}deg) rotateY(${fy}deg) rotateZ(0deg)`;
  cube.style.transform = rest;
  const shadow = document.createElement('div');
  shadow.className = 'shadow';
  tilt.appendChild(cube);
  el.append(shadow, tilt);

  // The throw. Skipped in the fast test mode, for a die that is not thrown, and once the throw is over.
  const age = typeof performance !== 'undefined' ? performance.now() - throwAt : ROLL_MS;
  const fast = typeof document !== 'undefined' && document.body && document.body.classList.contains('fast');
  if (tumble && value != null && !fast && age < ROLL_MS && cube.animate) {
    const n = (k + throwNo) % LAT.length;
    const [tx, ty] = throwDir;
    const w = (WOB[n] * Math.PI) / 180;
    const bx = -ty; // the rolling axis starts perpendicular to the travel and is turned by the wobble
    const by = tx;
    const ax = num(bx * Math.cos(w) - by * Math.sin(w), 3);
    const ay = num(bx * Math.sin(w) + by * Math.cos(w), 3);
    // along: where the die is on its path (die sizes, negative = behind the middle, on the thrower's side); s: how close it is to the
    // camera (the bounces); k: how much of the roll is left. The die lands, bounces toward the camera three times, and settles.
    const steps = [
      { o: 0, a: -3.4, s: 1.0, k: 1.0, e: 'ease-out' },
      { o: 0.18, a: -2.0, s: 1.3, k: 0.85, e: 'ease-in' },
      { o: 0.32, a: -0.95, s: 1.0, k: 0.6, e: 'ease-out' },
      { o: 0.46, a: -0.45, s: 1.2, k: 0.4, e: 'ease-in' },
      { o: 0.6, a: -0.15, s: 1.0, k: 0.22, e: 'ease-out' },
      { o: 0.72, a: -0.05, s: 1.1, k: 0.1, e: 'ease-in' },
      { o: 0.84, a: 0, s: 1.0, k: 0.03, e: 'ease-out' },
      { o: 1, a: 0, s: 1.0, k: 0, e: 'linear' },
    ];
    const at = (p) => {
      const lat = LAT[n] * (p.o >= 0.84 ? 0 : 1 - p.o / 0.84) * 1.2; // the sideways offset fades out as the die settles
      return [tx * p.a - ty * lat, ty * p.a + tx * lat];
    };
    // The roll angle rises toward 0 (it starts negative), so the die rolls forward along its travel and lands on its resting face.
    const frames = steps.map((p) => {
      const [x, y] = at(p);
      return {
        offset: p.o,
        easing: p.e,
        transform: p.o === 1 ? rest : `translate3d(${num(x)}em, ${num(y)}em, ${num((p.s - 1) * 1.2)}em) scale(${p.s}) rotate3d(${ax}, ${ay}, 0, ${num(-720 * SPIN[n] * p.k, 0)}deg) rotateX(${fx}deg) rotateY(${fy}deg)`,
      };
    });
    el.classList.add('throwing');
    const a = cube.animate(frames, { duration: ROLL_MS, fill: 'both' });
    a.currentTime = Math.max(0, age); // a re-render in the middle of a throw carries on from where it was
    // the shadow follows the die along the table and shrinks while the die is close to the camera
    shadow.animate(steps.map((p) => {
      const [x, y] = at(p);
      const up = (p.s - 1) / 0.3;
      return { offset: p.o, transform: `translate(${num(x)}em, ${num(y)}em) scale(${num(1.15 - 0.27 * up)})`, opacity: num(0.45 - 0.3 * up) };
    }), { duration: ROLL_MS, fill: 'both' }).currentTime = Math.max(0, age);
  }
  return el;
}
