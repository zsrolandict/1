import { describe, expect, it } from 'vitest';
import { crossChecks } from './crossChecks';
import { registryFindings, sectorFromActivity, verifyRegistry } from './registry';
import { SAMPLE_ANSWERS } from './samples/checklist';
import { SAMPLE_REGISTRY, sampleRegistryRecord } from './samples/registry';
import { EMPTY_INTAKE, intakeFacts } from './state';

const REF = new Date('2026-09-29T00:00:00Z');

describe('cégkivonat', () => {
  it('TEÁOR → ágazat', () => {
    expect(sectorFromActivity('6920 Számviteli tevékenység')).toBe('ACCOUNTING');
    expect(sectorFromActivity('7022 Üzletviteli tanácsadás')).toBe('CONSULTING');
    expect(sectorFromActivity('2562 Fémmegmunkálás')).toBe('MANUFACTURING');
    expect(sectorFromActivity('4120 Lakó- és nem lakóépület építése')).toBe('CONSTRUCTION');
    expect(sectorFromActivity('6201 Számítógépes programozás')).toBe('IT');
    expect(sectorFromActivity('4690 Vegyestermékkör nagykereskedelme')).toBe('TRADE');
    expect(sectorFromActivity(null)).toBeNull();
  });

  it('a mintakivonat minden adata igazolható; kitalált idézetet eldob', () => {
    const s = SAMPLE_REGISTRY.gyarto;
    expect(verifyRegistry(s.raw, s.text).discardedUnverified).toBe(0);
    const bad = verifyRegistry({ ...s.raw, owners: [...s.raw.owners, { name: 'X', sharePct: 5, quote: 'X Kft. (üzletrész: 5%)' }] }, s.text);
    expect(bad.owners).toHaveLength(2);
    expect(bad.discardedUnverified).toBe(1);
    expect(bad.discarded).toHaveLength(1);
    expect(bad.discarded![0].reason).toContain('nem található');
  });

  it('gyártó: két tulajdonos ↔ kérdőív „egy tulajdonos” – súlyos ellentmondás; gyakori vezetőváltás', () => {
    const state = { ...EMPTY_INTAKE, answers: SAMPLE_ANSWERS.gyarto, registry: sampleRegistryRecord('gyarto') };
    const f = registryFindings(state.registry!, state, REF);
    expect(f.multipleOwners).toBe(true);
    expect(f.sector).toBe('MANUFACTURING');
    expect(f.conflicts[0]).toMatchObject({ severity: 'HIGH', topic: 'Tulajdonosi kör' });
    expect(f.suggestions.map((x) => x.title)).toContain('Gyakori vezetőváltás az elmúlt két évben');
    expect(f.notes.some((n) => n.includes('Tulajdonosi változás'))).toBe(true);
    // az Összképben is megjelenik, a tények az interjúkhoz kerülnek
    expect(crossChecks(state, 'VENDOR_DD').conflicts.some((c) => c.key === 'REG:Q16')).toBe(true);
    expect(intakeFacts(state, 'VENDOR_DD').some((x) => x.id === 'REG-OWNERS')).toBe(true);
  });

  it('bejegyzett eljárás: kritikus kockázati javaslat', () => {
    const s = SAMPLE_REGISTRY.konyvelo;
    const text = s.text + '\n24. Felszámolási eljárás: a Fővárosi Törvényszék elrendelte a felszámolást';
    const data = verifyRegistry({ ...s.raw, proceedings: [{ type: 'felszámolás', quote: 'Fővárosi Törvényszék elrendelte a felszámolást' }] }, text);
    const f = registryFindings({ data, fileName: null, at: '', isSample: false }, EMPTY_INTAKE, REF);
    expect(f.suggestions[0]).toMatchObject({ likelihood: 4, impact: 5, pillar: 'LEGAL' });
  });
});
