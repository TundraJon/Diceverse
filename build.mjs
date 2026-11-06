// Bundles src/ into one self-contained dist/diceverse.html (JS + CSS inlined, no external requests).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

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

mkdirSync('dist', { recursive: true });
writeFileSync('dist/diceverse.html', html);
console.log(`dist/diceverse.html written (${(html.length / 1024).toFixed(1)} KB)`);
