/**
 * Böngészős füstteszt az előnézet-buildre (szerver és AI-kulcs nélkül).
 *
 *   npm run build:preview && node scripts/split-preview.mjs --harness
 *   npm run e2e
 *
 * A fő felhasználói utakat járja végig: üdvözlő kalauz, új projekt, üres
 * értékelés, export előtti kérdés, bemutató, Projektjeim és folytatás, két
 * böngészőlap két projekttel, ütközésjelzés, órarögzítés.
 * Helyi Chromium: CHROMIUM_PATH=/út/a/chrome (egyébként a Playwright sajátja).
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const dir = path.resolve(import.meta.dirname, '..', 'dist-preview', 'publish');
if (!existsSync(path.join(dir, 'test.html'))) {
  console.error('Nincs tesztkörnyezet: npm run build:preview && node scripts/split-preview.mjs --harness');
  process.exit(1);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const file = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(dir) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/test.html`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const errors = [];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` – ${detail}` : ''}`);
};
const projectButton = (p) => p.locator('nav button[aria-haspopup]');
const currentTab = (p) => p.locator('nav button[aria-current=page]').first().innerText();

try {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base);
  await p.waitForTimeout(1500);

  check('első látogatás: üdvözlő kalauz', (await p.getByText('Üdv az ICT Health Checkben!').count()) === 1);

  await p.getByRole('button', { name: /Új ügyfél indítása/ }).click();
  await p.getByPlaceholder('pl. Példa Kft.').fill('E2E Teszt Kft.');
  await p.getByRole('button', { name: 'Létrehozás' }).click();
  await p.waitForTimeout(800);
  check('új projekt az Adatgyűjtéssel indul', (await currentTab(p)) === 'Adatgyűjtés');
  await p.getByRole('button', { name: 'Kalauz bezárása' }).click();

  await p.evaluate(() => (location.hash = 'matrix'));
  await p.waitForTimeout(800);
  check('üres projekt: „Még nincs értékelés”', (await p.getByText('Még nincs értékelés').count()) === 1);
  check('üres projekt: árbevétel-figyelmeztetés', (await p.getByText(/Add meg az éves árbevételt/).count()) === 1);

  await p.getByRole('button', { name: 'Excel' }).click();
  await p.waitForTimeout(300);
  check('export előtt rákérdez üres értékelésnél', (await p.getByRole('alertdialog').count()) === 1);
  await p.getByRole('button', { name: 'Mégse' }).click();

  await projectButton(p).click();
  await p.getByRole('button', { name: 'Építőipari cég', exact: true }).click();
  await p.waitForTimeout(800);
  check('bemutató megnyitása', (await projectButton(p).innerText()).includes('Építőipari'));

  await projectButton(p).click();
  await p.getByRole('button', { name: /Projektjeim/ }).click();
  await p.waitForTimeout(400);
  const overview = await p.getByRole('dialog', { name: 'Projektjeim' }).innerText();
  check('Projektjeim: a saját projekt a listában', overview.includes('E2E Teszt Kft.'));
  await p.getByRole('button', { name: /Folytatás/ }).first().click();
  await p.waitForTimeout(800);
  check('folytatás: ott, ahol abbahagytad', (await projectButton(p).innerText()).includes('E2E Teszt Kft.') && (await currentTab(p)) === 'Red Flag mátrix');

  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.goto(`${base}#matrix`);
  await p2.waitForTimeout(1200);
  await projectButton(p2).click();
  await p2.getByRole('button', { name: 'IT-fejlesztő cég', exact: true }).click();
  await p2.waitForTimeout(800);
  await p.waitForTimeout(300);
  check('két lap, két projekt: az első lap nem vált át', (await projectButton(p).innerText()).includes('E2E Teszt Kft.'));

  await projectButton(p2).click();
  await p2.getByRole('button', { name: /^E2E Teszt Kft\. Vállalati/ }).click();
  await p2.waitForTimeout(800);
  await p2.getByRole('button', { name: 'Cégnév szerkesztése' }).click();
  await p2.getByLabel('Cégnév').fill('E2E Teszt Kft. módosítva');
  await p2.keyboard.press('Enter');
  await p2.waitForTimeout(600);
  check('ütközésjelzés, ha másik lap módosít', (await p.getByText(/másik böngészőlapon is módosították/).count()) === 1);

  await p.evaluate(() => (location.hash = 'projekt'));
  await p.waitForTimeout(800);
  await p.getByLabel('A neved').fill('Teszt Elek');
  await p.getByRole('button', { name: 'OK', exact: true }).click();
  await p.getByLabel('Óra').fill('2');
  await p.getByRole('button', { name: 'Rögzítés', exact: true }).click();
  await p.waitForTimeout(300);
  check('órarögzítés a rögzítő nevével', (await p.locator('tbody tr').first().innerText()).includes('Teszt Elek'));

  check('nincs JavaScript-hiba', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('a teszt végigfutott', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} rendben`);
process.exit(failed ? 1 : 0);
