import { describe, expect, it } from 'vitest';
import { runCaseSuggestion } from './casePrompts';
import { buildRequestList, EMPTY_PROFILE, requestListText, type CaseProfile } from './requests';
import { SAMPLE_PROFILES } from './samples/profiles';
import { EMPTY_INTAKE, missingRequests, requestList } from './state';

const tanacsado: CaseProfile = {
  sectors: ['CONSULTING'],
  headcount: 30,
  flags: ['FAMILY'],
  narrative: 'Tanácsadó cég 30 munkavállalóval, generációváltás előtt. Az alapító két éven belül átadná a vezetést a fiának.',
};

describe('iratbekérési lista', () => {
  it('az alap iratkör mindig benne van, kötelezőként', () => {
    const base = buildRequestList(EMPTY_PROFILE, 'HEALTH_CHECK').filter((d) => d.source === 'BASE');
    expect(base).toHaveLength(15);
    expect(base.every((d) => d.priority === 'REQUIRED')).toBe(true);
  });

  it('tanácsadó cég, 30 fő, generációváltás: a cél, az ágazat, a létszám és a jellemző is ad iratot', () => {
    const list = buildRequestList(tanacsado, 'SUCCESSION');
    const titles = list.map((d) => d.title).join(' | ');
    expect(titles).toContain('Tulajdonosi (szindikátusi) megállapodás');
    expect(titles).toContain('Szakmai felelősségbiztosítás');
    expect(titles).toContain('Munkaidő-nyilvántartás');
    expect(titles).toContain('Családtagok foglalkoztatása');
    expect(titles).not.toContain('visszaélés-bejelentési'); // 50 fő alatt nem kötelező
    expect(new Set(list.map((d) => d.id)).size).toBe(list.length);
  });

  it('ugyanaz az irat több okból: egyszer szerepel, minden indokkal, a szigorúbb prioritással', () => {
    const list = buildRequestList({ ...tanacsado, flags: ['FAMILY', 'MULTIPLE_OWNERS'] }, 'SUCCESSION');
    const owners = list.filter((d) => d.title.startsWith('Tulajdonosi (szindikátusi)'));
    expect(owners).toHaveLength(1);
    expect(owners[0].why.length).toBeGreaterThanOrEqual(2);
    expect(owners[0].priority).toBe('REQUIRED');
  });

  it('50 fő felett bekéri a visszaélés-bejelentési rendszert', () => {
    expect(buildRequestList({ ...EMPTY_PROFILE, headcount: 60 }, 'HEALTH_CHECK').some((d) => d.id === 'Z01')).toBe(true);
  });

  it('a cél megváltoztatása más iratokat hoz', () => {
    const a = buildRequestList(tanacsado, 'SUCCESSION').map((d) => d.id);
    const b = buildRequestList(tanacsado, 'FINANCING_READINESS').map((d) => d.id);
    expect(b).toContain('K08');
    expect(a).not.toContain('K08');
  });

  it('ügyfélnek küldhető szöveg: a beérkezett és a nem releváns tétel kimarad', () => {
    const list = buildRequestList(tanacsado, 'SUCCESSION');
    const t = requestListText('Példa Kft.', list, { B01: 'RECEIVED', B02: 'NA' });
    expect(t).not.toContain('Hatályos cégkivonat');
    expect(t).toContain('Kötelező:');
  });

  it('a „Hiányzik” iratok az interjúkhoz kerülnek; extra irat is a listába', () => {
    const state = {
      ...EMPTY_INTAKE,
      profile: tanacsado,
      requestStatus: { K11: 'MISSING' as const },
      extraRequests: [
        {
          id: 'X1',
          title: 'Végrendeleti rendelkezés az üzletrészről',
          pillar: 'LEGAL' as const,
          why: ['x'],
          source: 'MANUAL' as const,
          priority: 'RECOMMENDED' as const,
        },
      ],
    };
    expect(missingRequests(state, 'SUCCESSION').map((d) => d.title)).toEqual(['Tulajdonosi (szindikátusi) megállapodás']);
    expect(requestList(state, 'SUCCESSION').some((d) => d.id === 'X1')).toBe(true);
  });

  it('minden mintaesethez van tényállás', () => {
    for (const id of ['gyarto', 'epitoipar', 'konyvelo', 'it-fejleszto']) expect(SAMPLE_PROFILES[id].narrative.length).toBeGreaterThan(100);
  });
});

describe('AI-javaslat a tényállásból', () => {
  it('csak a tényállásban szó szerint alátámasztott javaslat marad; meglévő irat nem ismétlődik', async () => {
    const current = buildRequestList(tanacsado, 'SUCCESSION');
    const call = (async () => ({
      sectors: ['CONSULTING'],
      headcount: 30,
      flags: [
        { flag: 'MULTIPLE_OWNERS', quote: 'átadná a vezetést a fiának' },
        { flag: 'LITIGATION', quote: 'per van folyamatban' },
      ],
      documents: [
        { title: 'Vezetés-átadási ütemterv', pillar: 'HR', why: 'x', quote: 'két éven belül átadná a vezetést' },
        { title: 'Kitalált irat', pillar: 'LEGAL', why: 'x', quote: 'ilyen szöveg nincs a tényállásban' },
        { title: 'Tulajdonosi (szindikátusi) megállapodás', pillar: 'LEGAL', why: 'x', quote: 'generációváltás előtt' },
      ],
    })) as never;
    const r = await runCaseSuggestion(call, { profile: tanacsado, kind: 'SUCCESSION', companyName: 'Példa', current });
    expect(r.flags.map((f) => f.flag)).toEqual(['MULTIPLE_OWNERS']);
    expect(r.documents.map((d) => d.title)).toEqual(['Vezetés-átadási ütemterv']);
    expect(r.discardedUnverified).toBe(3);
  });
});
