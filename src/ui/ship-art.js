// The Space Salvage ship: the user's own 20-part spaceship drawing (parts 01 nose to 20 tail), drawn as inline SVG.
// {u} in a part is replaced by a unique id per ship (several ships on one page would otherwise share one set of gradients).
// Layout changes the user asked for: parts 13 to 20 are moved up 65 units so part 13 tucks under part 12 (the cabin sphere),
// and parts 19 and 20 a further 36 units so part 19 covers about 30% of part 18; part 12 is drawn last, on top.
export const SHIP = {
  viewBox: '-430 -760 860 1400',
  w: 860,
  h: 1400,
  parts: [
    `<path d="M 0,-740 L 28,-690 L 0,-670 L -28,-690 Z" fill="url(#mb{u})" stroke="#ffffff" stroke-width="2"/><line x1="0" y1="-740" x2="0" y2="-670" stroke="#12161b" stroke-width="1.5"/>`,
    `<path d="M -28,-690 L 28,-690 L 65,-590 L -65,-590 Z" fill="url(#mb{u})" stroke="#e1e8f0" stroke-width="2"/><path d="M -20,-680 L 20,-680 L 45,-600 L -45,-600 Z" fill="url(#ms{u})" opacity="0.6"/><polygon points="-55,-610 -65,-590 -75,-620" fill="#1e2329" stroke="#90a0b0"/>`,
    `<path d="M -65,-590 L 65,-590 L 75,-490 L -75,-490 Z" fill="url(#mb{u})" stroke="#ffffff" stroke-width="2"/><rect x="-30" y="-570" width="60" height="70" fill="url(#ms{u})" stroke="#687888" stroke-width="1.5" rx="3"/>`,
    `<path d="M -65,-570 L -95,-530 L -95,-480 L -70,-490 Z" fill="url(#ms{u})" stroke="#d0dce8" stroke-width="1.5"/><circle cx="-82" cy="-510" r="4" fill="#0b0d10"/>`,
    `<path d="M 65,-570 L 95,-530 L 95,-480 L 70,-490 Z" fill="url(#ms{u})" stroke="#d0dce8" stroke-width="1.5"/><circle cx="82" cy="-510" r="4" fill="#0b0d10"/>`,
    `<path d="M -75,-490 L 75,-490 L 90,-380 L -90,-380 Z" fill="url(#mb{u})" stroke="#e1e8f0" stroke-width="2"/><line x1="0" y1="-490" x2="0" y2="-380" stroke="#12161b" stroke-width="3"/>`,
    `<path d="M -90,-380 L 90,-380 L 110,-260 L -110,-260 Z" fill="url(#ms{u})" stroke="#ffffff" stroke-width="2"/><circle cx="-50" cy="-320" r="12" fill="url(#mb{u})" stroke="#4a5664"/><circle cx="50" cy="-320" r="12" fill="url(#mb{u})" stroke="#4a5664"/>`,
    `<path d="M -110,-240 L -270,-220 L -260,-110 L -120,-140 Z" fill="url(#mb{u})" stroke="#e1e8f0" stroke-width="2"/><rect x="-240" y="-195" width="75" height="55" fill="url(#ms{u})" rx="4" stroke="#708090"/>`,
    `<path d="M 110,-240 L 270,-220 L 260,-110 L 120,-140 Z" fill="url(#mb{u})" stroke="#e1e8f0" stroke-width="2"/><rect x="165" y="-195" width="75" height="55" fill="url(#ms{u})" rx="4" stroke="#708090"/>`,
    `<rect x="-410" y="-280" width="140" height="310" rx="65" fill="url(#mb{u})" stroke="#ffffff" stroke-width="2.5"/><ellipse cx="-340" cy="-210" rx="48" ry="24" fill="url(#ms{u})" stroke="#8090a0" stroke-width="2"/><ellipse cx="-340" cy="-40" rx="48" ry="24" fill="url(#ms{u})" stroke="#8090a0" stroke-width="2"/><line x1="-340" y1="-280" x2="-340" y2="30" stroke="#12161b" stroke-width="3"/>`,
    `<rect x="270" y="-280" width="140" height="310" rx="65" fill="url(#mb{u})" stroke="#ffffff" stroke-width="2.5"/><ellipse cx="340" cy="-210" rx="48" ry="24" fill="url(#ms{u})" stroke="#8090a0" stroke-width="2"/><ellipse cx="340" cy="-40" rx="48" ry="24" fill="url(#ms{u})" stroke="#8090a0" stroke-width="2"/><line x1="340" y1="-280" x2="340" y2="30" stroke="#12161b" stroke-width="3"/>`,
    `<circle cx="0" cy="-170" r="145" fill="url(#mb{u})" stroke="#ffffff" stroke-width="2.5"/><rect x="-85" y="-230" width="170" height="120" fill="url(#ms{u})" stroke="#8898a8" stroke-width="2" rx="10"/><circle cx="-50" cy="-200" r="15" fill="#1b2027" stroke="#8898a8"/>`,
    `<rect x="-145" y="-10" width="290" height="60" rx="8" fill="url(#ms{u})" stroke="#ffffff" stroke-width="2.5"/><line x1="-140" y1="20" x2="140" y2="20" stroke="#8898a8" stroke-width="3" stroke-dasharray="20 10"/>`,
    `<path d="M -130,50 L 130,50 L 110,120 L -110,120 Z" fill="url(#mb{u})" stroke="#e1e8f0" stroke-width="2"/><path d="M -70,85 A 12 12 0 0 0 -46,85 M -30,85 A 12 12 0 0 0 -6,85 M 6,85 A 12 12 0 0 0 30,85 M 46,85 A 12 12 0 0 0 70,85" stroke="#12161b" stroke-width="4" fill="none"/>`,
    `<path d="M -125,120 L 125,120 C 120,180 110,230 85,270 L -85,270 C -110,230 -120,180 -125,120 Z" fill="url(#mb{u})" stroke="#ffffff" stroke-width="2"/><ellipse cx="0" cy="195" rx="70" ry="40" fill="url(#ms{u})" stroke="#8090a0" stroke-width="2"/>`,
    `<path d="M -75,250 L -155,300 L -130,380 L -65,330 Z" fill="url(#ms{u})" stroke="#c0d0e0" stroke-width="2"/>`,
    `<path d="M 75,250 L 155,300 L 130,380 L 65,330 Z" fill="url(#ms{u})" stroke="#c0d0e0" stroke-width="2"/>`,
    `<path d="M -85,270 C -75,320 -60,360 -25,390 L 25,390 C 60,360 75,320 85,270 Z" fill="url(#mb{u})" stroke="#ffffff" stroke-width="2"/><line x1="-70" y1="300" x2="70" y2="300" stroke="#12161b" stroke-width="3"/><line x1="-50" y1="340" x2="50" y2="340" stroke="#12161b" stroke-width="3"/>`,
    `<path d="M -60,390 L 60,390 L 90,520 L -90,520 Z" fill="url(#mb{u})" stroke="#ffffff" stroke-width="2.5"/><ellipse cx="0" cy="520" rx="90" ry="22" fill="url(#ms{u})" stroke="#8090a0" stroke-width="2"/>`,
    `<path d="M -90,520 L 90,520 L 30,680 L 0,720 L -30,680 Z" fill="url(#ms{u})" stroke="#ffffff" stroke-width="2.5"/><circle cx="0" cy="690" r="10" fill="url(#tg{u})"/><line x1="-20" y1="540" x2="-20" y2="670" stroke="#8090a0" stroke-width="1.5"/><line x1="20" y1="540" x2="20" y2="670" stroke="#8090a0" stroke-width="1.5"/>`,
  ],
};

// The order the parts are added in: the nose and the spine first, then the cabin sphere, then the wings and engine pods, then the tail,
// so nothing is ever placed unattached.
export const BUILD_ORDER = [1, 2, 3, 4, 5, 6, 7, 12, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20];
const RANK = {};
BUILD_ORDER.forEach((n, k) => { RANK[n] = k; });
const UP = (i) => (i >= 19 ? 101 : i >= 13 ? 65 : 0); // part numbers 1 to 20
const mix = (hex, to, t) => {
  const n = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const a = n(hex);
  const b = n(to);
  return `#${a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

// One ship as an SVG string. `uid` makes the gradient ids unique, `color` is the player's color (it replaces the dark
// gradient fills), `built` is how many parts (0 to 20) are drawn solid (the first `built` of BUILD_ORDER) and `fresh` is how many
// were built before this draw, so the later ones animate in (-1: none).
export function shipSvg(uid, color, built, fresh) {
  const dark = mix(color, '#000000', 0.4);
  const light = mix(color, '#ffffff', 0.35);
  const defs = `<defs>
<linearGradient id="mb${uid}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#2a3038"/><stop offset="20%" stop-color="#7a8999"/><stop offset="50%" stop-color="#e6ecf2"/><stop offset="80%" stop-color="#7a8999"/><stop offset="100%" stop-color="#1e2329"/></linearGradient>
<linearGradient id="ms${uid}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${dark}"/><stop offset="50%" stop-color="${light}"/><stop offset="100%" stop-color="${dark}"/></linearGradient>
<radialGradient id="tg${uid}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="60%" stop-color="#88b0d8" stop-opacity="0.5"/><stop offset="100%" stop-color="#0b0d10" stop-opacity="0"/></radialGradient>
</defs>`;
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 12];
  const body = order.map((n) => {
    const on = RANK[n] < built;
    const cls = `shp${on ? '' : ' off'}${on && fresh >= 0 && RANK[n] >= fresh ? ' snap' : ''}`;
    return `<g class="${cls}" transform="translate(0 ${-UP(n)})">${SHIP.parts[n - 1].replace(/\{u\}/g, uid)}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SHIP.viewBox}" aria-hidden="true">${defs}${body}</svg>`;
}
