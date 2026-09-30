'use client';

import { useMemo } from 'react';
import type { PageId } from '@/lib/guide';
import { stepsForProject } from '@/lib/projectProgress';
import { projectStages } from '@/lib/projectStages';
import { useNav } from '../Nav';
import { useModules } from '../useModules';
import { Card } from './primitives';
import StepBar from './StepBar';

/** A projekt szakaszai minden oldal tetején (a többi modul adatát a tárolóból olvassa). */
export default function ProjectStagesCard({ projectId, identified, current }: { projectId: string; identified: number; current: PageId }) {
  const nav = useNav();
  const { disabled } = useModules();
  const stages = useMemo(() => projectStages(stepsForProject(projectId, identified, disabled)), [projectId, identified, disabled]);
  if (stages.length === 0) return null;
  return (
    <Card className="px-3 py-2.5 print:hidden">
      <StepBar stages={stages} current={current} onGo={nav?.go} />
    </Card>
  );
}
