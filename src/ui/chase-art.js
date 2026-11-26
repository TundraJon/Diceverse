// Dice Chase pictures: simple drawings (placeholders the user can replace with their own art later, as with Martian Dice). Each is a small SVG, written once
// into a style element as a CSS background image, so ten dice do not carry ten copies. The four colours also differ in SHAPE (snowflake, leaf, drop, flame),
// so they can be told apart without seeing colour.
const star = (cx, cy, ro, ri, n) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (Math.PI * i) / n - Math.PI / 2;
  const r = i % 2 ? ri : ro;
  return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;
const ART = {
  ice: svg('<g stroke="#0284c7" stroke-width="5" stroke-linecap="round" fill="none"><path d="M32 6V58M9.5 19L54.5 45M9.5 45L54.5 19"/></g><g stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M26 10L32 16L38 10M26 54L32 48L38 54M8 26L16 27L14 19M56 38L48 37L50 45M8 38L16 37L14 45M56 26L48 27L50 19"/></g><circle cx="32" cy="32" r="5" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>'),
  leaf: svg('<path d="M10 54C6 24 26 8 56 8C56 40 40 58 10 54Z" fill="#22c55e" stroke="#14532d" stroke-width="3" stroke-linejoin="round"/><path d="M10 54C22 40 34 28 48 16" stroke="#14532d" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M24 40L24 28M34 32L36 22M30 46L42 42" stroke="#14532d" stroke-width="2.5" fill="none" stroke-linecap="round"/>'),
  water: svg('<path d="M32 5C32 5 12 28 12 41A20 20 0 0 0 52 41C52 28 32 5 32 5Z" fill="#3b82f6" stroke="#1e3a8a" stroke-width="3" stroke-linejoin="round"/><path d="M22 42A10 10 0 0 0 30 52" stroke="#bfdbfe" stroke-width="4" fill="none" stroke-linecap="round"/>'),
  fire: svg('<path d="M32 3C35 17 51 24 51 41A19 19 0 0 1 13 41C13 31 19 27 22 17C26 24 28 26 31 27C32 19 29 11 32 3Z" fill="#f97316" stroke="#9a3412" stroke-width="3" stroke-linejoin="round"/><path d="M32 30C34 38 41 40 41 47A9 9 0 0 1 23 47C23 42 28 40 29 34Z" fill="#fde047"/>'),
  star: svg(`<polygon points="${star(32, 34, 28, 12, 5)}" fill="#facc15" stroke="#a16207" stroke-width="3" stroke-linejoin="round"/>`),
  x2: svg('<circle cx="32" cy="32" r="28" fill="#a855f7" stroke="#581c87" stroke-width="3"/><g stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M11 25L25 39M25 25L11 39"/><path d="M33 27Q33 19 41 19Q50 19 50 27Q50 32 33 41L51 41"/></g>'),
  special: svg('<path d="M32 3L39 25L61 32L39 39L32 61L25 39L3 32L25 25Z" fill="#e879f9" stroke="#701a75" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="32" r="6" fill="#fef9c3" stroke="#701a75" stroke-width="2"/>'),
  surge: svg('<path d="M37 3L12 37H27L22 61L52 25H36Z" fill="#facc15" stroke="#a16207" stroke-width="3" stroke-linejoin="round"/>'),
  fairy: svg('<ellipse cx="19" cy="29" rx="14" ry="7" fill="#c4b5fd" stroke="#6d28d9" stroke-width="2" transform="rotate(-28 19 29)"/><ellipse cx="45" cy="29" rx="14" ry="7" fill="#c4b5fd" stroke="#6d28d9" stroke-width="2" transform="rotate(28 45 29)"/><path d="M32 25L19 55H45Z" fill="#ec4899" stroke="#9d174d" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="15" r="9" fill="#fde1c4" stroke="#b45309" stroke-width="2.5"/><path d="M23 14C24 5 40 5 41 14C37 9 28 9 23 14Z" fill="#f59e0b" stroke="#b45309" stroke-width="2"/><path d="M42 36L57 22" stroke="#a16207" stroke-width="3" stroke-linecap="round"/><polygon points="57,12 59,19 66,19 60,23 62,30 57,26 52,30 54,23 48,19 55,19" fill="#facc15" stroke="#a16207" stroke-width="1.5" transform="translate(-6 2) scale(0.9)"/>'),
};

// One CSS class per picture.
export const IMG = Object.fromEntries(Object.keys(ART).map((k) => [k, `chsym-${k}`]));
// The faces of a row die (1 to 4 the colours, 5 Sweep, 6 x2) and of the action die (1 to 4 the colours, 5 any special die, 6 Surge), as class names and names for the screen reader.
export const ROW_IMAGES = [IMG.ice, IMG.leaf, IMG.water, IMG.fire, IMG.star, IMG.x2];
export const ROW_LABELS = ['Ice', 'Leaf', 'Water', 'Fire', 'Sweep', 'Times two'];
export const ACT_IMAGES = [IMG.ice, IMG.leaf, IMG.water, IMG.fire, IMG.special, IMG.surge];
export const ACT_LABELS = ['Ice', 'Leaf', 'Water', 'Fire', 'Special', 'Surge'];

export function ensureChaseCss() {
  if (typeof document === 'undefined' || document.getElementById('chase-art-css')) return;
  const st = document.createElement('style');
  st.id = 'chase-art-css';
  st.textContent = Object.keys(ART).map((k) => `.chsym-${k}{background-image:url("data:image/svg+xml,${encodeURIComponent(ART[k])}")}`).join('\n');
  document.head.appendChild(st);
}
