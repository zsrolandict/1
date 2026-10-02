import { beforeEach, describe, expect, it } from 'vitest';
import { computeCoverage } from '@/lib/risk/coverage';
import { answerIssue, checklistProgress, checklistQuestion, evaluateChecklist, MAX_COUNT_ANSWER, sanitizeAnswers, type ChecklistAnswers } from './checklist';
import { EMPTY_PROFILE } from './requests';
import { intakeKey, loadIntake } from './state';

/**
 * Audit K5: a kérdőív-válaszok szigorú, zod-alapú ellenőrzése – az
 * értékelésben (szabályok, tények, lefedettség) és a tárolóból betöltéskor.
 */

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
const storage = new MemoryStorage();
(globalThis as { localStorage?: unknown }).localStorage = storage;

const q = (id: string) => checklistQuestion(id)!;

describe('válasz-séma kérdéstípusonként (answerIssue)', () => {
  it('százalék: csak véges szám 0 és 100 között', () => {
    for (const ok of [0, 45, 45.5, 100]) expect(answerIssue(q('Q22'), ok), String(ok)).toBeNull();
    for (const bad of [100.01, 250, -1, NaN, Infinity, -Infinity, '45', '', null, true, [], {}]) {
      expect(answerIssue(q('Q22'), bad), JSON.stringify(bad) ?? String(bad)).toBe('0 és 100 közötti százalékot vár');
    }
  });

  it('darabszám: véges, nemnegatív, a korlátig; igen/nem: csak logikai; választós: csak felkínált érték', () => {
    expect(answerIssue(q('Q27'), 12)).toBeNull();
    for (const bad of [-1, NaN, Infinity, MAX_COUNT_ANSWER + 1, '12']) expect(answerIssue(q('Q27'), bad)).not.toBeNull();
    expect(answerIssue(q('Q24'), true)).toBeNull();
    for (const bad of ['true', 1, 0, 'igen', null]) expect(answerIssue(q('Q24'), bad)).toBe('igen/nem választ vár');
    expect(answerIssue(q('Q26'), 'NEM')).toBeNull();
    for (const bad of ['nem', 'TALÁN', '', 3, true]) expect(answerIssue(q('Q26'), bad)).toBe('a felkínált válaszok egyikét várja');
  });
});

describe('értékelés érvénytelen és fantomválaszokkal (evaluateChecklist)', () => {
  it('érvénytelen válasz se tényt, se javaslatot nem ad, és okkal visszakerül; az érvényes működik', () => {
    const bad = evaluateChecklist({ Q22: 250, Q27: -3, Q24: 'igen' as never }, 'HEALTH_CHECK');
    expect(bad.suggestions).toEqual([]);
    expect(bad.facts).toEqual([]);
    expect(bad.rejectedAnswers?.map((r) => r.id).sort()).toEqual(['Q22', 'Q24', 'Q27']);
    const nan = evaluateChecklist({ Q22: NaN }, 'HEALTH_CHECK');
    expect(nan.facts).toEqual([]); // korábban „NaN%” tényként rögzült
    const good = evaluateChecklist({ Q22: 45 }, 'HEALTH_CHECK');
    expect(good.suggestions.map((s) => s.code)).toEqual(['OPS-05']);
    expect(good.suggestions[0].valuationPatch).toEqual({ type: 'REVENUE_SHARE', share: 0.45 });
    expect(good.rejectedAnswers).toBeUndefined();
  });

  it('rejtett gyermekkérdés fantomválasza nem számít – akkor sem, ha a szülő válasza érvénytelen', () => {
    // Q25 (kulcsemberhez kötött árbevétel) csak akkor látható, ha Q24 = igen.
    for (const parent of [undefined, false, 'igen', 1]) {
      const answers = (parent === undefined ? { Q25: 80, Q26: 'NEM' } : { Q24: parent, Q25: 80, Q26: 'NEM' }) as ChecklistAnswers;
      const r = evaluateChecklist(answers, 'HEALTH_CHECK');
      expect(
        r.facts.some((f) => f.id === 'CHK-Q25' || f.id === 'CHK-Q26'),
        String(parent),
      ).toBe(false);
      expect(
        r.suggestions.some((s) => s.code === 'HR-01'),
        String(parent),
      ).toBe(false);
    }
    const shown = evaluateChecklist({ Q24: true, Q25: 80, Q26: 'NEM' }, 'HEALTH_CHECK');
    expect(shown.suggestions.find((s) => s.code === 'HR-01')).toMatchObject({ likelihood: 4, impact: 5 });
  });

  it('ágazati kérdés az ágazat nélkül fantom; ismeretlen kérdés-azonosító nem számít', () => {
    expect(evaluateChecklist({ QR4: true, QXX: true, Q99: 5 } as never, 'HEALTH_CHECK').suggestions).toEqual([]);
    expect(evaluateChecklist({ QR4: true }, 'HEALTH_CHECK', ['TRADE']).suggestions.map((s) => s.code)).toEqual(['KER-02']);
  });

  it('a kitöltöttség és a lefedettség csak érvényes, látható választ számol', () => {
    const answers = { Q22: 250, Q24: false, Q25: 80, Q23: true } as never;
    const p = checklistProgress(answers);
    const baseline = checklistProgress({ Q24: false, Q23: true });
    expect(p.answered).toBe(baseline.answered); // a 250% és a rejtett Q25 nem „megválaszolt”
    const cov = computeCoverage({ answers, profile: EMPTY_PROFILE, kind: 'HEALTH_CHECK', requestStatus: {} });
    expect(cov.OPERATIONS.questions.answered).toBe(1); // csak Q23
  });
});

describe('betöltési útvonal (sanitizeAnswers, loadIntake)', () => {
  beforeEach(() => storage.clear());

  it('sanitizeAnswers: ismeretlen azonosító kiesik, érvénytelen érték okkal félrekerül, az érvényes marad', () => {
    const r = sanitizeAnswers({ Q22: 45, Q23: true, Q24: 'true', Q27: -1, QXX: 1, Q26: 'TALÁN' });
    expect(r.answers).toEqual({ Q22: 45, Q23: true });
    expect(Object.keys(r.invalid).sort()).toEqual(['Q24', 'Q26', 'Q27']);
    expect(r.invalid.Q27.reason).toContain('közötti számot vár');
    for (const junk of [null, 'szöveg', [1, 2], 42]) expect(sanitizeAnswers(junk)).toEqual({ answers: {}, invalid: {} });
  });

  it('loadIntake: kézzel átírt mentésből csak érvényes válasz és ismert iratállapot jut az értékelésbe', () => {
    // JSON-ban a NaN null lesz: ezt is ki kell szűrni.
    const raw = `{"answers":{"Q22":250,"Q23":true,"Q24":NaN_HELY,"QXX":true,"Q26":"TALÁN"},"requestStatus":{"d1":"RECEIVED","d2":"KÉSZ","d3":5}}`.replace(
      'NaN_HELY',
      'null',
    );
    storage.setItem(intakeKey('p1'), raw);
    const s = loadIntake('p1');
    expect(s.answers).toEqual({ Q23: true });
    expect(Object.keys(s.invalidAnswers ?? {}).sort()).toEqual(['Q22', 'Q24', 'Q26']);
    expect(s.invalidAnswers!.Q22).toMatchObject({ value: 250, reason: '0 és 100 közötti százalékot vár' });
    expect(s.requestStatus).toEqual({ d1: 'RECEIVED' });
  });

  it('loadIntake: a korábban félretett érvénytelen válasz megmarad, amíg nincs helyes válasz ugyanarra a kérdésre', () => {
    const invalidAnswers = { Q22: { value: 250, reason: '0 és 100 közötti százalékot vár' } };
    storage.setItem(intakeKey('p2'), JSON.stringify({ answers: {}, invalidAnswers }));
    expect(loadIntake('p2').invalidAnswers).toEqual(invalidAnswers);
    storage.setItem(intakeKey('p2'), JSON.stringify({ answers: { Q22: 30 }, invalidAnswers }));
    const fixed = loadIntake('p2');
    expect(fixed.answers).toEqual({ Q22: 30 });
    expect(fixed.invalidAnswers).toBeUndefined();
  });
});
