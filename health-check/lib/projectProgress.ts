import { guideSteps, nextStep, type GuideStep } from '@/lib/guide';
import { loadIntake } from '@/lib/intake/state';
import { loadRecords } from '@/lib/interview/records';
import { loadBenchmark } from '@/lib/learning/benchmark';
import type { ModuleId } from '@/lib/modules';
import { loadSnapshots } from '@/lib/risk/followup';
import { loadProject } from '@/lib/risk/store';
import { loadTimesheet } from '@/lib/timesheet/timesheet';

/** Egy projekt kalauz-lépései a tárolóból (a Projektjeim áttekintőhöz és a kalauzhoz). */
export function projectSteps(projectId: string, disabled: ModuleId[] = []): GuideStep[] {
  const ws = loadProject(projectId);
  return guideSteps({
    intake: loadIntake(projectId),
    interviews: loadRecords(projectId),
    identified: ws.items.filter((r) => r.identified).length,
    snapshots: loadSnapshots(projectId).length,
    hoursLogged: loadTimesheet(projectId).entries.reduce((a, e) => a + e.hours, 0),
    benchmarked: loadBenchmark().some((r) => r.ref === projectId),
    disabled,
  });
}

export interface ProjectProgress {
  done: number;
  total: number;
  next: GuideStep | null;
  identified: number;
}

export function projectProgress(projectId: string, disabled: ModuleId[] = []): ProjectProgress {
  const steps = projectSteps(projectId, disabled);
  return {
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    next: nextStep(steps),
    identified: loadProject(projectId).items.filter((r) => r.identified).length,
  };
}
