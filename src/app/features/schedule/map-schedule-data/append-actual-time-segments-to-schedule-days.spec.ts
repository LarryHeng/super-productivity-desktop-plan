/* eslint-disable @typescript-eslint/naming-convention */
import { appendActualTimeSegmentsToScheduleDays } from './append-actual-time-segments-to-schedule-days';
import { ScheduleDay } from '../schedule.model';
import { SVEType } from '../schedule.const';
import { DEFAULT_TASK } from '../../tasks/task.model';

describe('appendActualTimeSegmentsToScheduleDays', () => {
  const task = {
    ...DEFAULT_TASK,
    id: 'task-1',
    title: 'Actual task',
    projectId: 'project-1',
    timeEstimate: 60 * 60 * 1000,
  };

  it('should replace estimated task entries for the same day with actual segments', () => {
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [
        {
          id: 'task-1',
          type: SVEType.Task,
          start: Date.UTC(2026, 5, 27, 8, 0),
          duration: 60 * 60 * 1000,
          data: task,
          plannedForDay: '2026-06-27',
        },
      ],
    };

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {
        '2026-06-27': [
          {
            taskId: 'task-1',
            start: Date.UTC(2026, 5, 27, 9, 10),
            end: Date.UTC(2026, 5, 27, 9, 45),
          },
        ],
      },
      { 'task-1': task },
    );

    expect(result[0].entries).toEqual([
      jasmine.objectContaining({
        id: `actual-task-1-${Date.UTC(2026, 5, 27, 9, 10)}-${Date.UTC(2026, 5, 27, 9, 45)}`,
        type: SVEType.ActualTask,
        start: Date.UTC(2026, 5, 27, 9, 10),
        duration: 35 * 60 * 1000,
        data: task,
        plannedForDay: '2026-06-27',
      }),
    ]);
  });

  it('should preserve non-task entries and ignore missing task ids', () => {
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [
        {
          id: 'lunch',
          type: SVEType.LunchBreak,
          start: Date.UTC(2026, 5, 27, 12, 0),
          duration: 30 * 60 * 1000,
          data: { startTime: '12:00', endTime: '12:30' },
        },
      ],
    };

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {
        '2026-06-27': [
          {
            taskId: 'missing',
            start: Date.UTC(2026, 5, 27, 9, 10),
            end: Date.UTC(2026, 5, 27, 9, 45),
          },
        ],
      },
      {},
    );

    expect(result).toEqual([day]);
  });

  it('should merge adjacent segments for the same task when the gap is under five minutes', () => {
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [],
    };
    const start = Date.UTC(2026, 5, 27, 9, 0);
    const twentyMinutes = 20 * 60 * 1000;
    const twentyFourMinutes = 24 * 60 * 1000;
    const fortyMinutes = 40 * 60 * 1000;

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {
        '2026-06-27': [
          { taskId: 'task-1', start, end: start + twentyMinutes },
          {
            taskId: 'task-1',
            start: start + twentyFourMinutes,
            end: start + fortyMinutes,
          },
        ],
      },
      { 'task-1': task },
    );

    const actualEntries = result[0].entries.filter(
      (entry) => entry.type === SVEType.ActualTask,
    );
    expect(actualEntries.length).toBe(1);
    expect(actualEntries[0].start).toBe(start);
    expect(actualEntries[0].duration).toBe(40 * 60 * 1000);
  });

  it('should keep same-task segments separate when another task runs between them', () => {
    const otherTask = { ...task, id: 'task-2', title: 'Other task' };
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [],
    };
    const start = Date.UTC(2026, 5, 27, 9, 0);
    const twentyMinutes = 20 * 60 * 1000;
    const twentyTwoMinutes = 22 * 60 * 1000;
    const fortyMinutes = 40 * 60 * 1000;

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {
        '2026-06-27': [
          { taskId: 'task-1', start, end: start + twentyMinutes },
          {
            taskId: 'task-2',
            start: start + twentyMinutes,
            end: start + twentyTwoMinutes,
          },
          {
            taskId: 'task-1',
            start: start + twentyTwoMinutes,
            end: start + fortyMinutes,
          },
        ],
      },
      { 'task-1': task, 'task-2': otherTask },
    );

    expect(
      result[0].entries.filter(
        (entry) => entry.type === SVEType.ActualTask && entry.data.id === 'task-1',
      ).length,
    ).toBe(2);
  });
});
