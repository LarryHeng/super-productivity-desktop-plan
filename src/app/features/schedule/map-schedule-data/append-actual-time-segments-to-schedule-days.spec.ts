/* eslint-disable @typescript-eslint/naming-convention */
import { appendActualTimeSegmentsToScheduleDays } from './append-actual-time-segments-to-schedule-days';
import { ScheduleDay } from '../schedule.model';
import { SVEType } from '../schedule.const';
import { DEFAULT_TASK } from '../../tasks/task.model';

const minutes = (value: number): number => value * 60 * 1000;

describe('appendActualTimeSegmentsToScheduleDays', () => {
  const task = {
    ...DEFAULT_TASK,
    id: 'task-1',
    title: 'Actual task',
    projectId: 'project-1',
    timeEstimate: 60 * 60 * 1000,
  };

  it('keeps the planned reference block when an actual segment exists', () => {
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [
        {
          id: 'task-1',
          type: SVEType.Task,
          start: Date.UTC(2026, 5, 27, 9, 20),
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

    expect(
      result[0].entries.some((entry) => entry.type === SVEType.ActualTask),
    ).toBeTrue();
    expect(result[0].entries.some((entry) => entry.type === SVEType.Task)).toBeTrue();
    expect(result[0].entries.find((entry) => entry.type === SVEType.Task)?.start).toBe(
      Date.UTC(2026, 5, 27, 9, 45),
    );
  });

  it('pushes later planned blocks forward while preserving their order and duration', () => {
    const secondTask = { ...task, id: 'task-2', title: 'Second task' };
    const thirdTask = { ...task, id: 'task-3', title: 'Third task' };
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [
        {
          id: 'task-2',
          type: SVEType.Task,
          start: Date.UTC(2026, 5, 27, 9, 20),
          duration: 60 * 60 * 1000,
          data: secondTask,
          plannedForDay: '2026-06-27',
        },
        {
          id: 'task-3',
          type: SVEType.Task,
          start: Date.UTC(2026, 5, 27, 10, 20),
          duration: 30 * 60 * 1000,
          data: thirdTask,
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
      { 'task-1': task, 'task-2': secondTask, 'task-3': thirdTask },
    );

    const planned = result[0].entries.filter((entry) => entry.type === SVEType.Task);
    expect(planned.map((entry) => entry.start)).toEqual([
      Date.UTC(2026, 5, 27, 9, 45),
      Date.UTC(2026, 5, 27, 10, 45),
    ]);
    expect(planned.map((entry) => entry.duration)).toEqual([
      60 * 60 * 1000,
      30 * 60 * 1000,
    ]);
  });

  it('includes the active timing segment up to the supplied current time', () => {
    const start = Date.UTC(2026, 5, 27, 9, 10);
    const now = Date.UTC(2026, 5, 27, 9, 46);
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [],
    };

    const result = (
      appendActualTimeSegmentsToScheduleDays as unknown as (
        days: ScheduleDay[],
        segments: Record<string, []>,
        tasks: typeof task extends infer T ? Record<string, T> : never,
        activeSegment: { taskId: string; date: string; start: number },
        currentTime: number,
      ) => ScheduleDay[]
    )(
      [day],
      {},
      { 'task-1': task },
      { taskId: 'task-1', date: '2026-06-27', start },
      now,
    );

    expect(result[0].entries).toContain(
      jasmine.objectContaining({
        type: SVEType.ActualTask,
        start,
        duration: now - start,
      }),
    );
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

  it('should use the configured merge gap for same-task actual blocks', () => {
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [],
    };
    const start = Date.UTC(2026, 5, 27, 9, 0);

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {
        '2026-06-27': [
          { taskId: 'task-1', start, end: start + minutes(20) },
          {
            taskId: 'task-1',
            start: start + minutes(28),
            end: start + minutes(40),
          },
        ],
      },
      { 'task-1': task },
      null,
      Date.now(),
      10,
    );

    expect(
      result[0].entries.filter((entry) => entry.type === SVEType.ActualTask).length,
    ).toBe(1);
  });

  it('should clamp the configured merge gap to thirty minutes', () => {
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [],
    };
    const start = Date.UTC(2026, 5, 27, 9, 0);

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {
        '2026-06-27': [
          { taskId: 'task-1', start, end: start + minutes(10) },
          {
            taskId: 'task-1',
            start: start + minutes(41),
            end: start + minutes(50),
          },
        ],
      },
      { 'task-1': task },
      null,
      Date.now(),
      60,
    );

    expect(
      result[0].entries.filter((entry) => entry.type === SVEType.ActualTask).length,
    ).toBe(2);
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
