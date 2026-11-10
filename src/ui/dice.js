// Dice: a real CSS 3D cube (six faces, no library, no canvas). At rest the result face is on top, facing the camera, with a
// small tilt so a sliver of the sides shows. When thrown, the cube drops in, bounces about three times with a shadow, spins down
// and settles exactly on its value. The throw is cosmetic: the roll was decided by the rules before it starts.

// How long a throw lasts, and how long after the dice stop the choices a roll leads to appear (where to place a marker, which
// category to score).
export const ROLL_MS = 1000;
export const REVEAL_MS = 250;

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

// How each die of a throw starts (sideways offset in die sizes, spin per bounce in degrees about each axis), picked by the die's
// position in the throw and the throw's number, so the dice never move in lockstep. No randomness.
const START = [
  { dx: -1.4, sx: 160, sy: 220, sz: 70 },
  { dx: 1.5, sx: -200, sy: 150, sz: -90 },
  { dx: -0.8, sx: 130, sy: -240, sz: 110 },
  { dx: 1.1, sx: -170, sy: -180, sz: -60 },
  { dx: -1.8, sx: 210, sy: 120, sz: 90 },
  { dx: 0.6, sx: -140, sy: 250, sz: -120 },
];

let throwAt = 0; // when the current throw started (set by the shell; a re-render during a throw continues it)
let throwNo = 0;
let seq = 0; // the position of the next die in this render pass

export function startThrow(at) { throwAt = at; throwNo += 1; }
export function beginDice() { seq = 0; }

const num = (v) => Math.round(v * 10) / 10;

// `symbols` (six emoji, one per face number) draws symbol dice instead of pips; `kind` is the body colour (green, yellow, red, crew).
export function renderDie(value, { tumble = false, danger = true, cls = '', sides = 6, symbols = null, kind = '' } = {}) {
  if (sides !== 6) throw new Error('Only six-sided dice are built so far');
  const k = seq++;
  const el = document.createElement('div');
  el.className = 'die' + (value == null ? ' blank' : '') + (symbols ? ' sym' : '') + (kind ? ' k-' + kind : '') + (cls ? ' ' + cls : '');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', value == null ? 'Die, not rolled' : (symbols ? `Die showing ${symbols[value - 1]}` : `Die showing ${value}`));

  const tilt = document.createElement('div');
  tilt.className = 'tilt';
  const cube = document.createElement('div');
  cube.className = 'cube';
  for (let f = 1; f <= 6; f++) {
    const face = document.createElement('div');
    face.className = `face f${f}`;
    face.setAttribute('aria-hidden', 'true');
    if (symbols) {
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
    const v = START[(k + throwNo) % START.length];
    // heights in die sizes (negative is up): drop, land, bounce, land, bounce, land, rest. Spin decays to the resting face.
    const steps = [
      { o: 0, y: -2.8, x: v.dx, z: 1.2, s: 3.0, e: 'ease-in' },
      { o: 0.24, y: 0, x: v.dx * 0.5, z: 0.5, s: 2.0, e: 'ease-out' },
      { o: 0.44, y: -0.9, x: v.dx * 0.25, z: 0.3, s: 1.3, e: 'ease-in' },
      { o: 0.62, y: 0, x: v.dx * 0.1, z: 0.1, s: 0.8, e: 'ease-out' },
      { o: 0.78, y: -0.32, x: 0, z: 0, s: 0.4, e: 'ease-in' },
      { o: 0.9, y: 0, x: 0, z: 0, s: 0.12, e: 'ease-out' },
      { o: 1, y: 0, x: 0, z: 0, s: 0, e: 'linear' },
    ];
    const frames = steps.map((p) => ({
      offset: p.o,
      easing: p.e,
      transform: p.o === 1 ? rest : `translate3d(${num(p.x)}em, ${num(p.y)}em, ${num(p.z)}em) rotateX(${num(fx + v.sx * p.s)}deg) rotateY(${num(fy + v.sy * p.s)}deg) rotateZ(${num(v.sz * p.s)}deg)`,
    }));
    el.classList.add('throwing');
    const a = cube.animate(frames, { duration: ROLL_MS, fill: 'both' });
    a.currentTime = Math.max(0, age); // a re-render in the middle of a throw carries on from where it was
    shadow.animate(steps.map((p) => ({ offset: p.o, transform: `scale(${num(0.45 + 0.55 * (1 - Math.min(1, -p.y / 2.8)))})`, opacity: num(0.18 + 0.45 * (1 - Math.min(1, -p.y / 2.8))) })),
      { duration: ROLL_MS, fill: 'both' }).currentTime = Math.max(0, age);
  }
  return el;
}
