import { Task } from '../tasks/task.model';
import {
  getTaskRepeatOccurrenceDay,
  isValidTaskRepeatOccurrenceDay,
} from './get-task-repeat-occurrence-day.util';

describe('getTaskRepeatOccurrenceDay', () => {
  it('prefers the immutable occurrence day stored on the task', () => {
    const task = {
      id: 'rpt_cfg_2026-07-04',
      created: new Date('2026-07-03T23:30:00.000Z').getTime(),
      dueDay: '2026-07-05',
      repeatOccurrenceDay: '2026-07-04',
    } as unknown as Task;

    expect(getTaskRepeatOccurrenceDay(task)).toBe('2026-07-04');
  });

  it('recovers the occurrence day from a deterministic repeat task id', () => {
    const task = {
      id: 'rpt_cfg_with_under_scores_2026-07-04',
      created: new Date('2026-07-03T23:30:00.000Z').getTime(),
      dueDay: '2026-07-05',
    } as unknown as Task;

    expect(getTaskRepeatOccurrenceDay(task)).toBe('2026-07-04');
  });

  it('falls back to created for legacy non-deterministic task ids', () => {
    const task = {
      id: 'legacy-task',
      created: new Date(2026, 6, 4, 12).getTime(),
    } as unknown as Task;

    expect(getTaskRepeatOccurrenceDay(task)).toBe('2026-07-04');
  });
});

describe('isValidTaskRepeatOccurrenceDay', () => {
  it('rejects structurally valid but impossible calendar dates', () => {
    expect(isValidTaskRepeatOccurrenceDay('2026-13-40')).toBeFalse();
  });
});
