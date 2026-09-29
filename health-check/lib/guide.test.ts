import { describe, expect, it } from 'vitest';
import { guideSteps, nextStep, type GuideInput } from './guide';
import { EMPTY_INTAKE } from './intake/state';
import { MODULES, toggleModule } from './modules';

const base: GuideInput = { intake: EMPTY_INTAKE, interviews: {}, identified: 0, snapshots: 0, hoursLogged: 0, benchmarked: false, disabled: [] };

describe('kalauz', () => {
  it('üres projektnél a tényállás a következő lépés', () => {
    const steps = guideSteps(base);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(nextStep(steps)!.id).toBe('case');
    expect(nextStep(steps)!.target).toEqual({ page: 'adatok', tab: 'case' });
  });

  it('a kész lépést átugorja', () => {
    const intake = { ...EMPTY_INTAKE, profile: { ...EMPTY_INTAKE.profile, sectors: ['IT' as const] } };
    expect(nextStep(guideSteps({ ...base, intake }))!.id).toBe('registry');
  });

  it('a kikapcsolt modul lépése kimarad, a mátrix mindig marad', () => {
    const all = MODULES.map((m) => m.id);
    const steps = guideSteps({ ...base, disabled: all });
    expect(steps.map((s) => s.id)).toEqual(['matrix']);
    expect(guideSteps({ ...base, disabled: ['CASE', 'REGISTRY'] })[0].id).toBe('checklist');
  });

  it('minden lépés kész → nincs következő', () => {
    const intake = {
      ...EMPTY_INTAKE,
      profile: { ...EMPTY_INTAKE.profile, narrative: 'x' },
      registry: {} as never,
      synthesis: {} as never,
      documents: [{}] as never,
      tables: { AR: {}, AP: {} } as never,
      answers: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`Q${String(i).padStart(2, '0')}`, true])),
    };
    const steps = guideSteps({
      ...intakeAll(intake),
      interviews: { OWNER_CEO: { analysis: {} } as never },
      identified: 3,
      snapshots: 1,
      hoursLogged: 2,
      benchmarked: true,
      disabled: ['CHECKLIST'],
    });
    expect(nextStep(steps)).toBeNull();
  });

  it('modul ki-be kapcsolása', () => {
    expect(toggleModule([], 'WHATIF')).toEqual(['WHATIF']);
    expect(toggleModule(['WHATIF'], 'WHATIF')).toEqual([]);
  });
});

function intakeAll(intake: GuideInput['intake']): GuideInput {
  return { ...base, intake };
}
