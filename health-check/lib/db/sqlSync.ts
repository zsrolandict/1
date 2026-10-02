import { KIND_ADJUSTMENTS } from '@/lib/engagement/adjustments';
import type { EngagementKind } from '@/lib/engagement/kinds';
import { scoreRisk } from '@/lib/risk/engine';
import type { RiskItem, Scale5 } from '@/lib/risk/types';

/**
 * Egy igazság a kódban és az adatbázisban (audit K7). A típuskorrekciók és a
 * besorolás forrása a TypeScript (lib/engagement/adjustments.ts,
 * lib/risk/engine.ts); az adatbázis migrációja és SQL-tesztje ebből
 * generálódik, és teszt ellenőrzi, hogy nem váltak el egymástól:
 *  - `kindAdjustmentsSeedSql()` – a 0013-as migráció seed-része;
 *  - `ragParityTestSql()` – supabase/tests/11_rag_parity.sql: a TS-motor
 *    által számolt elvárt besorolások, a valódi PostgreSQL-függvénnyel összevetve.
 */

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function kindAdjustmentsSeedSql(): string {
  const rows = (Object.entries(KIND_ADJUSTMENTS) as [EngagementKind, (typeof KIND_ADJUSTMENTS)[EngagementKind]][])
    .flatMap(([kind, adj]) =>
      Object.entries(adj)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, a]) => `  (${q(kind)}, ${q(code)}, ${a.dL ?? 0}, ${a.dI ?? 0}, ${q(a.reason)})`),
    )
    .join(',\n');
  return `-- GENERÁLT (lib/db/sqlSync.ts › kindAdjustmentsSeedSql) – kézzel ne szerkeszd; a forrás lib/engagement/adjustments.ts.
insert into kind_adjustments (kind, code, dl, di, reason) values
${rows};`;
}

/** A paritásteszt esetei: minden típuskorrekciós tétel + a skála és a küszöb szélei, korrekcióval és anélkül. */
export interface ParityCase {
  kind: EngagementKind;
  code: string;
  likelihood: Scale5;
  impact: Scale5;
  exposureHuf: number;
  materialityHuf: number;
  ignore: boolean;
}

export function parityCases(): ParityCase[] {
  const out: ParityCase[] = [];
  const kinds = Object.keys(KIND_ADJUSTMENTS) as EngagementKind[];
  for (const kind of kinds) {
    for (const code of Object.keys(KIND_ADJUSTMENTS[kind]).sort()) {
      for (const [l, i] of [
        [1, 1],
        [5, 5],
        [3, 3],
        [3, 5],
        [5, 3],
        [2, 4],
      ] as [Scale5, Scale5][]) {
        out.push({ kind, code, likelihood: l, impact: i, exposureHuf: 0, materialityHuf: 50_000_000, ignore: false });
        out.push({ kind, code, likelihood: l, impact: i, exposureHuf: 0, materialityHuf: 50_000_000, ignore: true });
      }
      // Lényegességi küszöb a korrigált valószínűséggel: 60 M Ft kitettség, 50 M Ft küszöb.
      out.push({ kind, code, likelihood: 4, impact: 1, exposureHuf: 60_000_000, materialityHuf: 50_000_000, ignore: false });
      out.push({ kind, code, likelihood: 5, impact: 1, exposureHuf: 60_000_000, materialityHuf: 50_000_000, ignore: false });
    }
    // Korrekció nélküli tétel ugyanabban a típusban.
    out.push({ kind, code: 'NINCS-01', likelihood: 3, impact: 4, exposureHuf: 0, materialityHuf: 50_000_000, ignore: false });
  }
  return out;
}

const RAG_SQL = { GREEN: 'GREEN', AMBER: 'AMBER', RED: 'RED' } as const;

/** Az elvárt besorolás a TS-motorból (ugyanazzal a bemenettel, mint az SQL-függvény). */
export function expectedRag(c: ParityCase): 'GREEN' | 'AMBER' | 'RED' {
  const item: RiskItem = {
    id: 'x',
    code: c.code,
    pillar: 'LEGAL',
    title: 'x',
    description: '',
    identified: true,
    likelihood: c.likelihood,
    impact: c.impact,
    exposureHuf: c.exposureHuf,
    remediationDays: 5,
    remediation: '',
    division: 'LEGAL',
    serviceFeeHuf: 0,
    ignoreKindAdjustment: c.ignore,
  };
  return RAG_SQL[scoreRisk(item, { materialityHuf: c.materialityHuf, adjustments: KIND_ADJUSTMENTS[c.kind] }).rag];
}

export function ragParityTestSql(): string {
  const cases = parityCases();
  const values = cases
    .map(
      (c) =>
        `  (${q(c.kind)}::engagement_kind, ${q(c.code)}, ${c.likelihood}, ${c.impact}, ${c.exposureHuf}, ${c.materialityHuf}, ${c.ignore}, ${q(expectedRag(c))}::rag)`,
    )
    .join(',\n');
  return `-- GENERÁLT (lib/db/sqlSync.ts › ragParityTestSql) – kézzel ne szerkeszd.
-- 0013: az adatbázis besorolása (red_flag_rag_for) pontosan egyezik a TypeScript-motoréval (${cases.length} eset).
do $$
declare
  bad int;
  sample text;
begin
  with cases(kind, code, l, i, exposure, materiality, ign, expected) as (values
${values}
  )
  select count(*), string_agg(kind || ' ' || code || ' ' || l || 'x' || i || ' ign=' || ign || ': ' || red_flag_rag_for(l, i, exposure, materiality, kind, code, ign) || ' <> ' || expected, '; ')
    into bad, sample
    from cases
   where red_flag_rag_for(l, i, exposure, materiality, kind, code, ign) <> expected;
  if bad > 0 then
    raise exception 'red_flag_rag_for eltér a TS-motortól (% eset): %', bad, left(sample, 800);
  end if;
end $$;
`;
}
