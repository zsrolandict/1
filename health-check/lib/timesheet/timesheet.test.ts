import { describe, expect, it } from 'vitest';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { addEntry, budgetFor, EMPTY_TIMESHEET, removeEntry, summarize, validateEntry, type Bucket } from './timesheet';

const LABELS: Record<Bucket, string> = { FINANCE: 'Pénzügy', LEGAL: 'Jog', OPERATIONS: 'Működés', HR: 'HR', PM: 'Projektvezetés' };
const e = (bucket: Bucket, hours: number, role: 'PARTNER' | 'SENIOR' | 'JUNIOR' = 'SENIOR') => ({
  date: '2026-09-01',
  bucket,
  role,
  person: 'Teszt',
  hours,
  note: '',
});

describe('óraszám-követés', () => {
  it('a keret a típus teljes óraszáma, projektvezetéssel', () => {
    const b = budgetFor('VENDOR_DD');
    expect(b.reduce((a, x) => a + x.hours, 0)).toBe(ENGAGEMENT_KINDS.VENDOR_DD.hourBudget);
    expect(b.find((x) => x.bucket === 'PM')!.hours).toBe(2);
  });

  it('80%-nál figyelmeztet, felette túllépést jelez', () => {
    const fin = budgetFor('HEALTH_CHECK').find((x) => x.bucket === 'FINANCE')!.hours;
    let s = addEntry(EMPTY_TIMESHEET, e('FINANCE', fin - 0.5));
    let sum = summarize(s, 'HEALTH_CHECK', LABELS);
    expect(sum.buckets.find((b) => b.bucket === 'FINANCE')!.level).toBe('WARN');
    s = addEntry(s, e('FINANCE', 1));
    sum = summarize(s, 'HEALTH_CHECK', LABELS);
    expect(sum.buckets.find((b) => b.bucket === 'FINANCE')!.level).toBe('OVER');
    expect(sum.warnings.join(' ')).toContain('túllépés');
  });

  it('költség szerepkörönkénti óradíjjal, fedezet a díjhoz képest', () => {
    const s = addEntry(addEntry(EMPTY_TIMESHEET, e('LEGAL', 2, 'PARTNER')), e('HR', 4, 'JUNIOR'));
    const sum = summarize(s, 'HEALTH_CHECK', LABELS);
    expect(sum.costHuf).toBe(2 * 25_000 + 4 * 9_000);
    expect(sum.marginHuf).toBe(1_200_000 - sum.costHuf);
    expect(sum.used).toBe(6);
    expect(summarize(removeEntry(s, s.entries[0].id), 'HEALTH_CHECK', LABELS).used).toBeLessThan(6);
  });

  it('veszteséges projektre figyelmeztet', () => {
    const s = { ...addEntry(EMPTY_TIMESHEET, e('LEGAL', 10, 'PARTNER')), feeHuf: 100_000 };
    expect(summarize(s, 'HEALTH_CHECK', LABELS).warnings.join(' ')).toContain('veszteséges');
  });

  it('bejegyzés ellenőrzése', () => {
    expect(validateEntry(e('HR', 13))).toContain('12');
    expect(validateEntry(e('HR', 0))).not.toBeNull();
    expect(validateEntry(e('HR', 1.3))).toContain('Negyedórás');
    expect(validateEntry(e('HR', 1.25))).toBeNull();
  });
});
