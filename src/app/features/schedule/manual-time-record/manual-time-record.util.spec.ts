import { DEFAULT_TASK, Task } from '../../tasks/task.model';
import { TTActualTaskSegment } from '../../time-tracking/time-tracking.model';
import {
  getTaskUpdateAfterManualRecord,
  validateManualTimeRange,
} from './manual-time-record.util';

describe('manual time record utilities', () => {
  const task = {
    ...DEFAULT_TASK,
    id: 'task-1',
    projectId: 'INBOX',
    title: 'Task',
    timeEstimate: 60 * 60 * 1000,
    timeSpent: 15 * 60 * 1000,
  } as Task;

  describe('validateManualTimeRange', () => {
    const existing: TTActualTaskSegment[] = [
      { taskId: 'task-2', start: 2_000, end: 3_000 },
    ];

    it('rejects an overlap with an existing segment', () => {
      expect(validateManualTimeRange(2_500, 3_500, existing, null, 10_000)).toBe(
        'overlap',
      );
    });

    it('rejects an overlap with the active segment', () => {
      expect(
        validateManualTimeRange(
          4_000,
          5_000,
          [],
          { taskId: 'task-3', date: '2026-06-29', start: 4_500 },
          10_000,
        ),
      ).toBe('overlap');
    });

    it('accepts a past non-overlapping interval', () => {
      expect(validateManualTimeRange(3_000, 4_000, existing, null, 10_000)).toBeNull();
    });
  });

  describe('getTaskUpdateAfterManualRecord', () => {
    it('keeps a remaining estimate when the task will continue', () => {
      expect(
        getTaskUpdateAfterManualRecord(task, 30 * 60 * 1000, 'continue', 20 * 60 * 1000),
      ).toEqual({
        isDone: false,
        timeEstimate: 65 * 60 * 1000,
      });
    });

    it('closes the estimate when the task is completed', () => {
      expect(getTaskUpdateAfterManualRecord(task, 30 * 60 * 1000, 'done', 0)).toEqual({
        isDone: true,
        timeEstimate: 45 * 60 * 1000,
      });
    });
  });
});
