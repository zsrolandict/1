/**
 * Az egyfájlos előnézet-build (dist-preview/index.html) szétbontása
 * közzétehető fájlokra: index.html + app.js + app.css (+ betűkészletek).
 * A claude.ai Artifact a nagy, egyetlen HTML-t nem fogadja el, a
 * többfájlosat igen.
 *
 *   npm run build:preview:publish           → dist-preview/publish/
 *   node scripts/split-preview.mjs --harness → + E2E-tesztkörnyezet (test.html, fx.js)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'dist-preview', 'index.html');
const out = path.join(root, 'dist-preview', 'publish');
if (!existsSync(src)) {
  console.error('Nincs dist-preview/index.html – előbb: npm run build:preview');
  process.exit(1);
}
const html = readFileSync(src, 'utf8');

const scriptOpen = '<script type="module" crossorigin>';
const styleOpen = '<style rel="stylesheet" crossorigin>';
const a = html.indexOf(scriptOpen);
const c = html.lastIndexOf(styleOpen);
if (a < 0 || c < 0) {
  console.error('Váratlan build-szerkezet: nem található a beágyazott szkript vagy stíluslap.');
  process.exit(1);
}
// A szkript a stíluslap előtt végződik; a JS-ben lehetnek „<style” szövegek, ezért a határokat hátulról keressük.
const js = html.slice(a + scriptOpen.length, html.lastIndexOf('</script>', c));
const css = html.slice(c + styleOpen.length, html.lastIndexOf('</style>'));

mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'app.js'), js);
writeFileSync(path.join(out, 'app.css'), css);
writeFileSync(
  path.join(out, 'index.html'),
  '<title>ICT Health Check</title>\n<link rel="stylesheet" href="app.css">\n<div id="root"></div>\n<script type="module" src="app.js"></script>\n',
);
const fonts = path.join(root, 'public', 'fonts');
if (existsSync(fonts)) cpSync(fonts, path.join(out, 'fonts'), { recursive: true });

if (process.argv.includes('--harness')) {
  for (const f of ['test.html', 'fx.js']) cpSync(path.join(root, 'e2e', 'harness', f), path.join(out, f));
}
console.log(`Kész: ${path.relative(root, out)} (app.js ${(js.length / 1e6).toFixed(1)} MB, app.css ${(css.length / 1e3).toFixed(0)} kB)`);
