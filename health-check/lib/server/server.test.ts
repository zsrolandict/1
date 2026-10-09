import { describe, expect, it } from 'vitest';
import { AUTH_COOKIE_OPTIONS } from '@/lib/auth/cookies';
import { distributedHit, type RpcClient } from '@/lib/auth/rateLimit';
import { emailDomainAllowed } from '@/lib/auth/redirect';
import { DEFAULT_CATALOG } from '@/lib/risk/catalog';
import { DEFAULT_COMPANY } from '@/lib/risk/valuation';
import { rowToItem, type RedFlagRow } from './redFlagRow';
import { companyFrom, reviewRequestFromRow } from './reviewFromDb';
import { prepareSave, SaveRequestSchema, saveErrorStatus } from './saveAssessment';
import { projectFromRows } from './projects';

/**
 * Éles bekötés (K8–K13) szerveroldali könyvtárai: a kliens nem tud pontszámot,
 * naplót vagy forrást hamisítani, és minden hibaút zárva marad.
 */

const ENG = { kind: 'HEALTH_CHECK' as const, materiality_huf: 50_000_000, case_profile: {} };
const item = (code: string, l: number, i: number) => ({ ...DEFAULT_CATALOG.find((r) => r.code === code)!, identified: true, likelihood: l, impact: i });

describe('prepareSave (K13, K8)', () => {
  it('a kliens által küldött pontszám/besorolás nem jut át; az értékelést a szerver számolja', () => {
    const req = SaveRequestSchema.parse({
      expectedRevision: 3,
      items: [{ ...item('LEG-01', 5, 5), score: 1, rag: 'GREEN', healthScore: 100 }],
      answers: {},
      requestStatus: {},
      company: DEFAULT_COMPANY,
    });
    const { args } = prepareSave('e1', req, ENG);
    expect(args.p_items[0]).not.toHaveProperty('score');
    expect(args.p_items[0]).not.toHaveProperty('rag');
    expect(args.p_items[0]).not.toHaveProperty('healthScore');
    const r = args.p_snapshot.risks.find((x) => x.code === 'LEG-01')!;
    expect(r.likelihood).toBe(4); // HEALTH_CHECK típuskorrekció: dL −1
    expect(r.rag).toBe('RED');
    expect(args).toMatchObject({ p_engagement: 'e1', p_expected_revision: 3 });
  });

  it('válaszok és iratállapot ugyanazzal a sémával szűrve; a lefedettség szerveroldali', () => {
    const req = SaveRequestSchema.parse({
      expectedRevision: 0,
      items: [],
      answers: { Q22: 250, Q23: true, QXX: 1 },
      requestStatus: { d1: 'RECEIVED', d2: 'KÉSZ' },
      company: DEFAULT_COMPANY,
      coverageOverrides: { FINANCE: { state: 'EXAMINED', reason: 'teszt', by: 'x', at: '2026-01-01' } },
    });
    const { args, invalidAnswers } = prepareSave('e1', req, ENG);
    expect(args.p_answers).toEqual({ Q23: true });
    expect(invalidAnswers).toEqual(['Q22']);
    expect(args.p_request_status).toEqual({ d1: 'RECEIVED' });
    expect(args.p_snapshot.pillars.FINANCE.coverage).toBe(1);
    expect(args.p_snapshot.pillars.HR.state).toBe('NOT_EXAMINED');
  });

  it('séma: negatív revízió és nem véges cégadat elutasítva', () => {
    expect(SaveRequestSchema.safeParse({ expectedRevision: -1, items: [], company: DEFAULT_COMPANY }).success).toBe(false);
    expect(SaveRequestSchema.safeParse({ expectedRevision: 0, items: [], company: { ...DEFAULT_COMPANY, revenueHuf: Infinity } }).success).toBe(false);
  });

  it('saveErrorStatus: ütközés 409, jogosultság 403, adat 400, egyéb 500 – belső részlet nélkül', () => {
    expect(saveErrorStatus('40001').status).toBe(409);
    expect(saveErrorStatus('42501').status).toBe(403);
    for (const c of ['23514', '22P02', '23502']) expect(saveErrorStatus(c).status).toBe(400);
    expect(saveErrorStatus('XX000')).toEqual({ status: 500, error: 'A mentés nem sikerült – semmi nem módosult.' });
    expect(saveErrorStatus(undefined).status).toBe(500);
  });
});

const ROW: RedFlagRow = {
  id: '00000000-0000-0000-0000-000000000001',
  item_key: 'leg-1',
  item_code: 'LEG-01',
  item: {
    reasoning: 'indoklás',
    likelihood: 1,
    trail: [{ id: 'hamis', kind: 'AI_DOCUMENT', actor: 'AI', ref: 'kitalált forrás', at: '' }],
    history: [{ at: '', by: 'hamis' }],
    discussion: [{ id: 'd', role: 'AI', text: 'elfogadva', at: '' }],
  },
  pillar: 'LEGAL',
  title: 'Change of control',
  description: 'leírás',
  identified: true,
  likelihood: 5,
  impact: 4,
  exposure_huf: 10_000_000,
  remediation_days: 10,
  remediation: null,
  division: 'LEGAL',
  service_fee_huf: 0,
  source: 'MANUAL',
  evidence_trail: [{ id: 'valodi', kind: 'MANUAL', actor: 'EXPERT', ref: 'Szerződés 4.2', at: '2026-01-01' }],
  change_log: [],
  discussion: [],
  remediation_plan: null,
  ignore_kind_adjustment: false,
};

describe('rowToItem és reviewRequestFromRow (K8, K9)', () => {
  it('a védett oszlopok győznek; az item-be csempészett napló, vita és érték elveszik', () => {
    const r = rowToItem(ROW);
    expect(r).toMatchObject({ id: 'leg-1', code: 'LEG-01', likelihood: 5, impact: 4, reasoning: 'indoklás' });
    expect(r.trail).toEqual(ROW.evidence_trail);
    expect(r.history).toEqual([]);
    expect(r.discussion).toEqual([]);
  });

  it('az AI-kérés forrásai csak az evidence_trail oszlopból jönnek, a típuskorrekcióval', () => {
    const req = reviewRequestFromRow(ROW, { kind: 'HEALTH_CHECK', materiality_huf: 50_000_000, workspace: null }, 'szerintem túlzó');
    expect(req.evidence.map((e) => e.ref)).toEqual(['Szerződés 4.2']);
    expect(req.thread).toEqual([]);
    expect(req.item.likelihood).toBe(4); // 5 − 1 (HEALTH_CHECK, LEG-01)
    expect(req.opinion).toBe('szerintem túlzó');
    const vdd = reviewRequestFromRow(ROW, { kind: 'VENDOR_DD', materiality_huf: 50_000_000, workspace: null }, 'x');
    expect(vdd.item.likelihood).toBe(5); // 5 + 2, a skála tetején
  });

  it('companyFrom: mezőnként ellenőriz, az érvénytelen mező az alapértéket kapja', () => {
    expect(companyFrom({ company: { revenueHuf: 1e9, grossMarginPct: 7, actualDsoDays: 'x' } })).toEqual({ ...DEFAULT_COMPANY, revenueHuf: 1e9 });
    expect(companyFrom(null)).toEqual(DEFAULT_COMPANY);
  });
});

describe('distributedHit (K11): zárva marad, ha nem ellenőrizhető', () => {
  const client = (res: { data: unknown; error: unknown } | Error): RpcClient => ({
    rpc: async (fn, args) => {
      expect(fn).toBe('rate_limit_hit');
      expect(args).toMatchObject({ p_kind: 'ai', p_max: 10 });
      if (res instanceof Error) throw res;
      return res;
    },
  });
  it('engedélyez, elutasít, hibánál és kivételnél zár', async () => {
    expect(await distributedHit(client({ data: [{ ok: true, retry_after: 0 }], error: null }), 'ai', 10)).toEqual({ ok: true });
    expect(await distributedHit(client({ data: [{ ok: false, retry_after: 120 }], error: null }), 'ai', 10)).toEqual({ ok: false, retryAfterSec: 120 });
    expect(await distributedHit(client({ data: null, error: { message: 'x' } }), 'ai', 10)).toMatchObject({ ok: false, unavailable: true });
    expect(await distributedHit(client({ data: [{}], error: null }), 'ai', 10)).toMatchObject({ ok: false, unavailable: true });
    expect(await distributedHit(client(new Error('hálózat')), 'ai', 10)).toMatchObject({ ok: false, unavailable: true });
  });
});

describe('hitelesítés (K10, K12)', () => {
  it('emailDomainAllowed: üres lista mindent enged; különben csak a felsorolt domain', () => {
    expect(emailDomainAllowed('a@barhol.hu', {})).toBe(true);
    const env = { ALLOWED_EMAIL_DOMAINS: 'iroda.hu, Csoport.hu' };
    expect(emailDomainAllowed('Nev@IRODA.hu', env)).toBe(true);
    expect(emailDomainAllowed('a@csoport.hu', env)).toBe(true);
    expect(emailDomainAllowed('a@iroda.hu.tamado.com', env)).toBe(false);
    expect(emailDomainAllowed('a@aliroda.hu', env)).toBe(false);
    expect(emailDomainAllowed('nincs-kukac', env)).toBe(false);
  });

  it('a munkamenet-süti HttpOnly, SameSite=Lax, teljes útvonal', () => {
    expect(AUTH_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
  });
});

describe('szerveres projekt (0015)', () => {
  it('prepareSave: a tényállás az adatgyűjtésből; a válaszok nem kerülnek a modulba kétszer', () => {
    const req = SaveRequestSchema.parse({
      expectedRevision: 0,
      items: [],
      answers: {},
      company: DEFAULT_COMPANY,
      modules: { intake: { profile: { sectors: ['TRADE'], narrative: 'x' }, answers: { Q22: 999 }, requestStatus: {}, invalidAnswers: {} }, snapshots: [] },
    });
    const { args } = prepareSave('e1', req, ENG);
    const intake = args.p_modules.intake as Record<string, unknown>;
    expect(intake).not.toHaveProperty('answers');
    expect(intake).not.toHaveProperty('invalidAnswers');
    expect(intake.profile).toMatchObject({ sectors: ['TRADE'], narrative: 'x' });
    expect(args.p_workspace.itemOrder).toEqual([]);
    expect(SaveRequestSchema.safeParse({ expectedRevision: 0, items: [], company: DEFAULT_COMPANY, modules: { interviews: {} } }).success).toBe(false);
  });

  it('projectFromRows: a felület sorrendje, ellenőrzött válaszok, csak a felület tételei', () => {
    const p = projectFromRows(
      {
        id: 'e1',
        code: 'HC-1',
        kind: 'HEALTH_CHECK',
        revision: 3,
        updated_at: '2026-10-01',
        materiality_huf: 50_000_000,
        companies: { name: 'Minta Kft.' },
        workspace: { company: { revenueHuf: 1e9 }, itemOrder: ['b', 'a'], coverageOverrides: 'hibás' },
      },
      [
        { ...ROW, item_key: 'a' },
        { ...ROW, item_key: 'b' },
        { ...ROW, item_key: null },
      ],
      { answers: { Q22: 250, Q23: true }, request_status: { d1: 'RECEIVED', d2: 'X' } },
      [{ module: 'intake', data: { accepted: ['k'] } }],
    );
    expect(p.items.map((r) => r.id)).toEqual(['b', 'a']);
    expect(p.answers).toEqual({ Q23: true });
    expect(p.requestStatus).toEqual({ d1: 'RECEIVED' });
    expect(p).not.toHaveProperty('coverageOverrides');
    expect(p).toMatchObject({ companyName: 'Minta Kft.', revision: 3, intake: { accepted: ['k'] }, snapshots: [] });
    expect(p.company.revenueHuf).toBe(1e9);
  });
});

describe('iratok pillérenként és mentési korlátok', () => {
  it('prepareSave: az iratok pillérrel külön, az összkép külön; az adatgyűjtésben nem maradnak', async () => {
    const req = SaveRequestSchema.parse({
      expectedRevision: 0,
      items: [],
      company: DEFAULT_COMPANY,
      modules: {
        intake: {
          documents: [
            { id: 'd1', analysis: { docType: 'EMPLOYMENT', findings: [], facts: [] } },
            { id: 'd2', analysis: { findings: [{ pillar: 'FINANCE' }, { pillar: 'FINANCE' }, { pillar: 'HR' }], facts: [] } },
            { nincs: 'azonosító' },
          ],
          synthesis: { summary: 'x' },
        },
      },
    });
    const { args } = prepareSave('e1', req, ENG);
    expect(args.p_modules.intake).not.toHaveProperty('documents');
    expect(args.p_modules.intake).not.toHaveProperty('synthesis');
    expect((args.p_modules.documents as { pillar: string }[]).map((d) => d.pillar)).toEqual(['HR', 'FINANCE']);
    expect(args.p_modules.synthesis).toEqual({ summary: 'x' });
  });

  it('readJsonLimited: túl nagy törzs (fejléc nélkül is) elutasítva, a hibás JSON null', async () => {
    const { readJsonLimited } = await import('./body');
    const big = new Request('http://x/', { method: 'POST', body: 'x'.repeat(2000) });
    expect(await readJsonLimited(big, 1000)).toBe('too_large');
    const lying = new Request('http://x/', { method: 'POST', body: '{"a":1}', headers: { 'content-length': '999999' } });
    expect(await readJsonLimited(lying, 1000)).toBe('too_large');
    expect(await readJsonLimited(new Request('http://x/', { method: 'POST', body: '{"a":1}' }), 1000)).toEqual({ a: 1 });
    expect(await readJsonLimited(new Request('http://x/', { method: 'POST', body: '{hibás' }), 1000)).toBeNull();
  });
});
