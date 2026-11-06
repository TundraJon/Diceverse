/*
 * tests-helpers.cjs: shared plumbing for the throwaway Playwright test scripts (Node). It holds NO test scenarios.
 * Test scripts themselves live in the scratchpad and are never committed (see CLAUDE.md).
 * Adapted for Diceverse (single bundled index.html built by `npm run build`): preflight() checks the inline script, charset, external URLs and a stale bundle;
 * force() can pin all four words of a game seed. Pass your own selectors to px() and waitSplash() if you use them.
 *
 * Use from a scratchpad script (the file is .cjs because package.json is "type": "module"):
 *   NODE_PATH=$(npm root -g) timeout 170 node my-test.cjs
 *
 *   const T = require('/home/user/diceverse/tests-helpers.cjs');
 *   T.run(async () => {
 *     const t0 = Date.now(), c = T.checker();
 *     const bad = T.preflight(ROOT); if (bad.length) { console.log('PREFLIGHT', bad); return; }   // about 1 second
 *     const srv = T.serve(ROOT, 8150);
 *     const s = await T.launch({ width: 412, height: 800, reducedMotion: true });                // short 4 s timeouts
 *     await s.page.goto(srv.url + '/index.html'); await T.waitSplash(s.page);
 *     await T.force(s.page, [2, 4]);                                                              // next two random draws
 *     c.chk('label', expected, actual);                                                           // prints only failures
 *     await s.browser.close(); srv.close(); c.done(s.errors, t0);                                // one summary line
 *   });
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');

// ---- Before the browser: catches most silly errors in about a second ----
// Single-file bundle: opts { html: 'index.html', src: 'src' }.
//  - the inline <script> blocks parse
//  - a charset is declared in the first 1024 bytes (so non-ASCII characters are safe)
//  - no <script>/<link>/<img> pulls from an external http(s) URL (the app must work offline)
//  - the bundle is not older than anything in src/ or build.mjs (catches a forgotten `npm run build`)
function preflight(root, opts) {
  opts = Object.assign({ html: 'index.html', src: 'src', build: 'build.mjs' }, opts || {});
  const problems = [];
  let html = '';
  try { html = fs.readFileSync(path.join(root, opts.html), 'utf8'); } catch (e) { return [opts.html + ': ' + e.message]; }
  if (!/<meta[^>]+charset=/i.test(html.slice(0, 1024))) problems.push(opts.html + ' has no charset declaration in the first 1024 bytes');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  if (!scripts.length) problems.push(opts.html + ' has no inline script');
  scripts.forEach((code, i) => { try { new Function(code); } catch (e) { problems.push('inline script ' + (i + 1) + ': ' + e.message); } });
  if (/<(script|link|img)\b[^>]*\b(src|href)=["']https?:/i.test(html)) problems.push(opts.html + ' loads an external URL in a tag (must work offline)');
  const newest = (dir) => {
    let t = 0;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      t = Math.max(t, f.isDirectory() ? newest(full) : fs.statSync(full).mtimeMs);
    }
    return t;
  };
  try {
    const built = fs.statSync(path.join(root, opts.html)).mtimeMs;
    const srcT = Math.max(newest(path.join(root, opts.src)), fs.existsSync(path.join(root, opts.build)) ? fs.statSync(path.join(root, opts.build)).mtimeMs : 0);
    if (srcT > built + 1) problems.push(opts.html + ' is older than the source: run `npm run build`');
  } catch (e) { problems.push('stale check failed: ' + e.message); }
  return problems;
}

// ---- A tiny static server (no dev server to start) ----
function serve(root, port) {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  const base = path.resolve(root);
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html', f = path.resolve(base, rel);
    if (!f.startsWith(base)) { r.writeHead(403); r.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(port);
  return { url: 'http://localhost:' + port, close: () => srv.close() };
}

// ---- Browser: short timeouts, error collection, dialogs, forced randomness ----
const RANDOM_STUB = () => { // window.__force = [n, ...] pins the next crypto.getRandomValues(Uint32Array) values, one number per array slot
  window.__force = []; const real = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (a) => { real(a); if (window.__force.length && a instanceof Uint32Array) { for (let i = 0; i < a.length && window.__force.length; i++) a[i] = window.__force.shift(); } return a; };
};
const force = (page, values) => page.evaluate((v) => { window.__force = v; }, values);

// force(page, [a, b, c, d]) pins a whole game seed (four words) before pressing Start.
// Options: width, height, touch (default true), dsf, reducedMotion, timeout (ms, default 4000), downloads, forceRandom (default true),
// blockStorage (a key prefix: reading or writing those localStorage keys throws, to test "storage refused")
async function newContext(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: o.width || 412, height: o.height || 800 }, hasTouch: o.touch !== false, deviceScaleFactor: o.dsf || 1, reducedMotion: o.reducedMotion ? 'reduce' : 'no-preference', acceptDownloads: !!o.downloads });
  if (o.forceRandom !== false) await ctx.addInitScript(RANDOM_STUB);
  if (o.blockStorage) await ctx.addInitScript((p) => {
    const g = Storage.prototype.getItem, s = Storage.prototype.setItem;
    Storage.prototype.getItem = function (k) { if (String(k).startsWith(p)) throw new Error('blocked'); return g.call(this, k); };
    Storage.prototype.setItem = function (k, v) { if (String(k).startsWith(p)) throw new Error('blocked'); return s.call(this, k, v); };
  }, o.blockStorage);
  const page = await ctx.newPage(); page.setDefaultTimeout(o.timeout || 4000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const dialogs = { confirm: true, prompt: '', log: [] }; // change dialogs.confirm / dialogs.prompt between steps
  page.on('dialog', d => { dialogs.log.push(d.type() + ': ' + d.message()); if (d.type() === 'confirm') (dialogs.confirm ? d.accept() : d.dismiss()); else d.accept(dialogs.prompt); });
  return { browser, ctx, page, errors, dialogs };
}
async function launch(o) { const { chromium } = require('playwright'); return newContext(await chromium.launch(), o); }

// The splash screen fades after about 3 seconds; wait for it before screenshots or pixel checks
// (pass the id of your splash element, or skip this if the app has none)
const waitSplash = (page, id) => page.waitForFunction((id) => { const s = document.getElementById(id); return !s || getComputedStyle(s).opacity === '0'; }, id || 'splash', { timeout: 6000 });

// ---- Real touch gestures through the browser's touch API ----
// Note: lifting the finger sends a click that closes a long-press menu, so pick menu items inside longPress's fn (finger still down).
async function touchTools(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
  const longPress = async (x, y, fn) => { await touch('touchStart', [[x, y]]); await page.waitForTimeout(750); const r = fn ? await fn() : undefined; await touch('touchEnd', []); await page.waitForTimeout(80); return r; };
  const drag = async (x1, y1, x2, y2, hold) => { await touch('touchStart', [[x1, y1]]); await touch('touchMove', [[(x1 + x2) / 2, (y1 + y2) / 2]]); await touch('touchMove', [[x2, y2]]); if (!hold) await touch('touchEnd', []); };
  return { touch, longPress, drag };
}

// ---- Reading what is on screen ----
const px = (page, x, y, sel) => page.evaluate(([x, y, sel]) => Array.from(document.querySelector(sel).getContext('2d').getImageData(x, y, 1, 1).data).slice(0, 3), [x, y, sel || 'canvas']);
const near = (a, b, d) => a.every((v, i) => Math.abs(v - b[i]) <= (d === undefined ? 8 : d));

// ---- Checks: print only failures, then one summary line ----
function checker() {
  let passes = 0, fails = 0;
  const chk = (label, expected, actual) => { const ok = JSON.stringify(expected) === JSON.stringify(actual); ok ? passes++ : fails++; if (!ok) console.log('FAIL ' + label + ' (expect ' + JSON.stringify(expected) + '): ' + JSON.stringify(actual)); };
  const chkT = (label, cond, info) => { cond ? passes++ : fails++; if (!cond) console.log('FAIL ' + label + ': ' + JSON.stringify(info)); };
  const done = (errors, t0) => { console.log('PASS ' + passes + '  FAIL ' + fails + '  JS errors: ' + JSON.stringify(errors || []) + '  (' + Math.round((Date.now() - t0) / 1000) + 's)'); return fails === 0 && !(errors && errors.length); };
  return { chk, chkT, done };
}

// ---- Test files: a flat-color PNG of any size, written without extra tools ----
function png(file, w, h, rgb) {
  const table = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.concat([Buffer.from(type), data]), len = Buffer.alloc(4), cs = Buffer.alloc(4); len.writeUInt32BE(data.length); cs.writeUInt32BE(crc(t)); return Buffer.concat([len, t, cs]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// ---- Wrapper: hard timeout so a stuck test can never run for 15 minutes ----
async function run(main, ms) {
  const timer = setTimeout(() => { console.log('HARD TIMEOUT: the test ran past ' + Math.round((ms || 170000) / 1000) + 's'); process.exit(2); }, ms || 170000);
  try { await main(); } catch (e) { console.log('ERROR: ' + String(e.message).split('\n')[0]); process.exitCode = 1; }
  clearTimeout(timer); process.exit(process.exitCode || 0);
}

module.exports = { preflight, serve, newContext, launch, force, waitSplash, touchTools, px, near, checker, png, run, RANDOM_STUB };
