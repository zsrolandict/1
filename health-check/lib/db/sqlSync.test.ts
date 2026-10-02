import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KIND_ADJUSTMENTS } from '@/lib/engagement/adjustments';
import { expectedRag, kindAdjustmentsSeedSql, parityCases, ragParityTestSql } from './sqlSync';

/**
 * Audit K7: a típuskorrekció és a besorolás egy igazság. Ha valaki a
 * TypeScript korrekciós táblát vagy a motort módosítja, ez a teszt elbukik,
 * amíg új migráció és frissített SQL-paritásteszt nem készül.
 */
const root = path.resolve(import.meta.dirname, '..', '..', 'supabase');
const MARK = 'GENERÁLT (lib/db/sqlSync.ts › kindAdjustmentsSeedSql)';

/** A legutolsó migráció, amely a korrekciós seedet tartalmazza (élesített migrációt nem írunk át). */
function latestSeedMigration(): { file: string; text: string } {
  const files = readdirSync(path.join(root, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const withSeed = files.map((f) => ({ file: f, text: readFileSync(path.join(root, 'migrations', f), 'utf8') })).filter((m) => m.text.includes(MARK));
  return withSeed[withSeed.length - 1];
}

/**
 * `npm run db:sync`: frissíti a paritástesztet, és ha a korrekciós tábla
 * megváltozott, ÚJ migrációt ír (törlés + friss seed) – a régit nem módosítja.
 */
if (process.env.WRITE_SQL === '1') {
  writeFileSync(path.join(root, 'tests', '11_rag_parity.sql'), ragParityTestSql());
  if (!latestSeedMigration().text.includes(kindAdjustmentsSeedSql())) {
    const files = readdirSync(path.join(root, 'migrations'))
      .filter((f) => /^\d{4}_/.test(f))
      .sort();
    const next = String(Number(files[files.length - 1].slice(0, 4)) + 1).padStart(4, '0');
    writeFileSync(
      path.join(root, 'migrations', `${next}_kind_adjustments_sync.sql`),
      `-- A típuskorrekciós tábla frissítése a TypeScript forrásból (npm run db:sync).\ndelete from kind_adjustments;\n${kindAdjustmentsSeedSql()}\n`,
    );
    console.log(`Új migráció: ${next}_kind_adjustments_sync.sql – vedd fel a scripts/db-smoke.sh listájába.`);
  }
}

describe('SQL ↔ TypeScript szinkron (K7)', () => {
  it('a legutolsó korrekciós migráció seedje pontosan a TS-korrekciós tábla (eltérésnél: npm run db:sync)', () => {
    expect(latestSeedMigration().text).toContain(kindAdjustmentsSeedSql());
    const rows = Object.values(KIND_ADJUSTMENTS).reduce((a, k) => a + Object.keys(k).length, 0);
    expect(
      kindAdjustmentsSeedSql()
        .split('\n')
        .filter((l) => l.startsWith('  (')).length,
    ).toBe(rows);
  });

  it('az SQL-paritásteszt a TS-motor aktuális eredményeit tartalmazza (eltérésnél: npm run db:sync)', () => {
    const file = readFileSync(path.join(root, 'tests', '11_rag_parity.sql'), 'utf8');
    expect(file).toBe(ragParityTestSql());
  });

  it('a paritás-esetek a korrekciót mindkét irányban lefedik (be- és kikapcsolva, skálaszéleken)', () => {
    const cases = parityCases();
    expect(cases.length).toBeGreaterThan(500);
    // Van olyan eset, ahol a korrekció megváltoztatja a besorolást – különben a teszt semmit nem bizonyítana.
    const changed = cases.filter((c) => !c.ignore && expectedRag(c) !== expectedRag({ ...c, ignore: true }));
    expect(changed.length).toBeGreaterThan(20);
  });
});
