// Tile-board block: pure helpers for Shut the Box style games. Tiles are numbers; an "open" list is ascending.

// Every subset of the open tiles whose numbers add up to the target (each subset ascending).
// maxTiles 0 (or less) means any number of tiles; 2 limits each subset to at most two tiles.
export function validSets(open, target, maxTiles = 0) {
  const out = [];
  const limit = maxTiles > 0 ? maxTiles : Infinity;
  const picked = [];
  const go = (start, remaining) => {
    if (remaining === 0) { out.push(picked.slice()); return; }
    if (picked.length >= limit) return;
    for (let i = start; i < open.length; i++) {
      const t = open[i];
      if (t > remaining) break; // open is ascending
      picked.push(t);
      go(i + 1, remaining - t);
      picked.pop();
    }
  };
  go(0, target);
  return out;
}

// Score of the tiles still open: their sum, or read left to right as one number (open 1, 5, 9 -> 159).
export function scoreOpen(open, scoring = 'sum') {
  if (scoring === 'digits') return open.length ? Number(open.join('')) : 0;
  return open.reduce((a, b) => a + b, 0);
}

// May the player choose to roll one die? 'standard': every tile above 6 is shut; 'late': the open tiles
// add up to less than 6; 'off': never.
export function oneDieAllowed(rule, open) {
  if (rule === 'standard') return open.every((t) => t <= 6);
  if (rule === 'late') return open.reduce((a, b) => a + b, 0) < 6;
  return false;
}
