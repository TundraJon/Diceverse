// Bundles src/ into one self-contained index.html at the repo root (JS + CSS inlined, no external requests).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const result = await build({
  entryPoints: ['src/shell/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
});

const js = result.outputFiles[0].text.replace(/<\/script>/gi, '<\\/script>');
const css = readFileSync('src/ui/theme.css', 'utf8');
const template = readFileSync('src/shell/index.template.html', 'utf8');

const html = template
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js);

writeFileSync('index.html', html);
// the service worker (a real file next to index.html) gets the build's hash in its cache name, so a new build replaces the old cache
const hash = createHash('sha1').update(html).update(readFileSync('manifest.webmanifest'));
for (const f of readdirSync('icons').sort()) hash.update(readFileSync(`icons/${f}`));
const stamp = hash.digest('hex').slice(0, 10);
writeFileSync('sw.js', readFileSync('src/shell/sw.template.js', 'utf8').replace('__BUILD__', stamp));
console.log(`index.html written (${(html.length / 1024).toFixed(1)} KB)`);
