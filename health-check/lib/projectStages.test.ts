import { describe, expect, it } from 'vitest';
import type { GuideStep } from './guide';
import { projectStages } from './projectStages';

const step = (id: string, done: boolean) => ({ id, done }) as GuideStep;

describe('projectStages', () => {
  it('az első befejezetlen szakasz az aktuális, a kész szakaszok készek', () => {
    const stages = projectStages([step('case', true), step('checklist', true), step('interviews', false), step('matrix', true), step('knowledge', false)]);
    expect(stages.map((s) => [s.id, s.state, `${s.done}/${s.total}`])).toEqual([
      ['intake', 'done', '2/2'],
      ['interviews', 'current', '0/1'],
      ['assess', 'done', '1/1'],
      ['close', 'todo', '0/1'],
    ]);
  });

  it('a kikapcsolt modul szakasza kimarad', () => {
    expect(projectStages([step('case', false), step('matrix', false)]).map((s) => s.id)).toEqual(['intake', 'assess']);
  });
});
