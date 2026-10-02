/**
 * Füstteszt a Next-alkalmazásra (éles build, `next start`): az oldalak
 * betöltenek JavaScript-hiba és CSP-sértés nélkül, a biztonsági fejlécek
 * megvannak, és a `?projekt=` cím a megadott projektet nyitja.
 *
 *   npm run build && npm run e2e:next
 * Helyi Chromium: CHROMIUM_PATH=/út/a/chrome
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const port = 3100 + Math.floor(Math.random() * 500);
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(port)], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base);
      if (r.ok) return;
    } catch {
      /* még indul */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('A Next-szerver nem indult el.');
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail ? ` – ${detail}` : ''}`);
};

let browser;
try {
  await waitForServer();
  const res = await fetch(`${base}/adatok`);
  const csp = res.headers.get('content-security-policy') ?? '';
  check(
    'biztonsági fejlécek (CSP, X-Frame-Options, nosniff)',
    csp.includes("frame-ancestors 'none'") && res.headers.get('x-frame-options') === 'DENY' && res.headers.get('x-content-type-options') === 'nosniff',
  );
  check('HSTS (éles build)', (res.headers.get('strict-transport-security') ?? '').includes('max-age=63072000'));
  const foreign = await fetch(`${base}/auth/signout`, { method: 'POST', headers: { origin: 'https://evil.com' } });
  check('kilépés idegen oldalról tiltva', foreign.status === 403);
  const save = await fetch(`${base}/api/engagements/00000000-0000-0000-0000-000000000001/save`, { method: 'POST', body: '{}' });
  check('mentés-végpont bejelentkezés nélkül tiltva', [401, 403, 503].includes(save.status), String(save.status));
  const redirect = await fetch(`${base}/auth/callback?code=x&next=/\\evil.com`, { redirect: 'manual' });
  check('belépés-visszatérés nem irányít idegen oldalra', !(redirect.headers.get('location') ?? '').includes('evil.com'));

  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text()) && errors.push(m.text()));

  for (const p of ['/', '/adatok', '/interjuk', '/projekt']) {
    await page.goto(base + p);
    await page.waitForTimeout(800);
    check(`${p} betölt`, (await page.locator('nav').first().count()) === 1);
  }

  await page
    .getByRole('button', { name: 'Kalauz bezárása' })
    .click()
    .catch(() => {});
  await page.locator('nav button[aria-haspopup]').click();
  await page.getByRole('button', { name: 'Új projekt' }).click();
  await page.getByPlaceholder('pl. Példa Kft.').fill('Next Teszt Kft.');
  await page.getByRole('button', { name: 'Létrehozás' }).click();
  await page.waitForURL('**/adatok');
  check('új projekt az Adatgyűjtésre visz', page.url().endsWith('/adatok'));
  const id = await page.evaluate(() => sessionStorage.getItem('ict-hc:tab-project'));

  const p2 = await browser.newPage();
  await p2.goto(`${base}/?projekt=gyarto`);
  await p2.waitForTimeout(1000);
  check('?projekt= a megadott projektet nyitja új lapon', (await p2.locator('nav button[aria-haspopup]').innerText()).includes('Minta Gyártó'));
  await page.reload();
  await page.waitForTimeout(800);
  check('az első lap a saját projektjén marad', (await page.evaluate(() => sessionStorage.getItem('ict-hc:tab-project'))) === id);

  check('nincs JavaScript-hiba és CSP-sértés', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('a teszt végigfutott', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
} finally {
  await browser?.close();
  server.kill();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} rendben`);
process.exit(failed ? 1 : 0);
