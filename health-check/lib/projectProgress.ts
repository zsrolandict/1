import { guideSteps, nextStep, type GuideStep } from '@/lib/guide';
import { loadIntake } from '@/lib/intake/state';
import { loadRecords } from '@/lib/interview/records';
import { loadBenchmark } from '@/lib/learning/benchmark';
import type { ModuleId } from '@/lib/modules';
import { loadSnapshots } from '@/lib/risk/followup';
import { loadProject, type Workspace } from '@/lib/risk/store';
import { loadTimesheet } from '@/lib/timesheet/timesheet';

/** A tudástárba felvett projektek azonosítói (egyszer olvassuk, ha több projektet számolunk). */
export function benchmarkedRefs(): Set<string> {
  return new Set(loadBenchmark().map((r) => r.ref));
}

/** Egy (már betöltött) projekt kalauz-lépései. */
export function stepsFor(ws: Workspace, disabled: ModuleId[] = [], benchmarked: Set<string> = benchmarkedRefs()): GuideStep[] {
  const id = ws.projectId;
  return guideSteps({
    intake: loadIntake(id),
    interviews: loadRecords(id),
    identified: ws.items.filter((r) => r.identified).length,
    snapshots: loadSnapshots(id).length,
    hoursLogged: loadTimesheet(id).entries.reduce((a, e) => a + e.hours, 0),
    benchmarked: benchmarked.has(id),
    disabled,
  });
}

export function projectSteps(projectId: string, disabled: ModuleId[] = []): GuideStep[] {
  return stepsFor(loadProject(projectId), disabled);
}

export interface ProjectProgress {
  done: number;
  total: number;
  next: GuideStep | null;
  identified: number;
}

export function projectProgress(projectId: string, disabled: ModuleId[] = [], benchmarked: Set<string> = benchmarkedRefs()): ProjectProgress {
  const ws = loadProject(projectId);
  const steps = stepsFor(ws, disabled, benchmarked);
  return {
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    next: nextStep(steps),
    identified: ws.items.filter((r) => r.identified).length,
  };
}
