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

  it('renders manually recorded segments with the third block style', () => {
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [],
    };
    const start = Date.UTC(2026, 5, 27, 9, 10);
    const end = Date.UTC(2026, 5, 27, 9, 45);

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {
        '2026-06-27': [
          {
            taskId: 'task-1',
            start,
            end,
            source: 'manual',
          },
        ],
      },
      { 'task-1': task },
    );

    expect(result[0].entries).toContain(
      jasmine.objectContaining({
        type: SVEType.CompletedPlannedTask,
        start,
        duration: end - start,
      }),
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

  it('cascades overlapping planned tasks without splitting the earlier task', () => {
    const secondTask = { ...task, id: 'task-2', title: 'Second task' };
    const start = Date.UTC(2026, 5, 27, 9, 0);
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [
        {
          id: 'task-1',
          type: SVEType.Task,
          start,
          duration: minutes(90),
          data: task,
          plannedForDay: '2026-06-27',
        },
        {
          id: 'task-2',
          type: SVEType.Task,
          start: start + minutes(60),
          duration: minutes(30),
          data: secondTask,
          plannedForDay: '2026-06-27',
        },
      ],
    };

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {},
      { 'task-1': task, 'task-2': secondTask },
    );
    const planned = result[0].entries.filter((entry) => entry.type === SVEType.Task);

    expect(planned.map((entry) => entry.start)).toEqual([start, start + minutes(90)]);
    expect(planned.map((entry) => entry.duration)).toEqual([minutes(90), minutes(30)]);
  });

  it('coalesces split fragments and shifts the following plan as one block', () => {
    const secondTask = { ...task, id: 'task-2', title: 'Second task' };
    const start = Date.UTC(2026, 5, 27, 9, 0);
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [
        {
          id: 'task-1',
          type: SVEType.SplitTask,
          start,
          duration: minutes(30),
          data: task,
          plannedForDay: '2026-06-27',
        },
        {
          id: 'task-1_2026-06-27_0',
          type: SVEType.SplitTaskContinuedLast,
          start: start + minutes(60),
          duration: minutes(30),
          data: task,
          plannedForDay: '2026-06-27',
        },
        {
          id: 'task-2',
          type: SVEType.Task,
          start: start + minutes(75),
          duration: minutes(30),
          data: secondTask,
          plannedForDay: '2026-06-27',
        },
      ],
    };

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {},
      { 'task-1': task, 'task-2': secondTask },
    );
    const taskEntries = result[0].entries.filter((entry) =>
      [SVEType.Task, SVEType.TaskPlannedForDay].includes(entry.type),
    );

    expect(taskEntries.length).toBe(2);
    expect(taskEntries[0]).toEqual(
      jasmine.objectContaining({
        id: 'task-1',
        start,
        duration: minutes(60),
      }),
    );
    expect(taskEntries[1].start).toBe(start + minutes(75));
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

  it('lets planned work use ten percent of lunch before continuing after lunch', () => {
    const start = Date.UTC(2026, 5, 27, 11, 30);
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [
        {
          id: 'task-1',
          type: SVEType.Task,
          start,
          duration: minutes(120),
          data: task,
          plannedForDay: '2026-06-27',
        },
        {
          id: 'lunch',
          type: SVEType.LunchBreak,
          start: Date.UTC(2026, 5, 27, 12, 0),
          duration: minutes(60),
          data: { startTime: '12:00', endTime: '13:00' },
        },
      ],
    };

    const result = appendActualTimeSegmentsToScheduleDays([day], {}, { 'task-1': task });

    const plannedEntries = result[0].entries.filter(
      (entry) =>
        entry.type !== SVEType.LunchBreak &&
        (entry.data as { id?: string }).id === 'task-1',
    );
    expect(plannedEntries).toEqual([
      jasmine.objectContaining({
        start,
        duration: minutes(36),
      }),
      jasmine.objectContaining({
        start: Date.UTC(2026, 5, 27, 13, 0),
        duration: minutes(84),
      }),
    ]);
  });

  it('applies the lunch transition to future planning without a visible marker', () => {
    const start = new Date(2026, 5, 29, 11, 30).getTime();
    const lunchEnd = new Date(2026, 5, 29, 13, 0).getTime();
    const day: ScheduleDay = {
      dayDate: '2026-06-29',
      beyondBudgetTasks: [],
      isToday: false,
      entries: [
        {
          id: 'task-1',
          type: SVEType.Task,
          start,
          duration: minutes(120),
          data: task,
          plannedForDay: '2026-06-29',
        },
      ],
    };

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {},
      { 'task-1': task },
      null,
      Date.now(),
      5,
      { startTime: '12:00', endTime: '13:00' },
    );
    const plannedEntries = result[0].entries.filter(
      (entry) => (entry.data as { id?: string }).id === 'task-1',
    );

    expect(plannedEntries).toEqual([
      jasmine.objectContaining({ start, duration: minutes(36) }),
      jasmine.objectContaining({ start: lunchEnd, duration: minutes(84) }),
    ]);
    expect(
      result[0].entries.some((entry) => entry.type === SVEType.LunchBreak),
    ).toBeFalse();
  });

  it('trims an earlier actual segment when another task starts before it ends', () => {
    const otherTask = { ...task, id: 'task-2', title: 'Other task' };
    const start = Date.UTC(2026, 5, 27, 11, 37);
    const secondStart = start + minutes(7);
    const day: ScheduleDay = {
      dayDate: '2026-06-27',
      beyondBudgetTasks: [],
      isToday: true,
      entries: [],
    };

    const result = appendActualTimeSegmentsToScheduleDays(
      [day],
      {
        '2026-06-27': [
          { taskId: 'task-1', start, end: start + minutes(20) },
          { taskId: 'task-2', start: secondStart, end: start + minutes(30) },
        ],
      },
      { 'task-1': task, 'task-2': otherTask },
    );
    const actualEntries = result[0].entries.filter(
      (entry) => entry.type === SVEType.ActualTask,
    );

    expect(actualEntries).toEqual([
      jasmine.objectContaining({
        data: jasmine.objectContaining({ id: 'task-1' }),
        start,
        duration: minutes(7),
      }),
      jasmine.objectContaining({
        data: jasmine.objectContaining({ id: 'task-2' }),
        start: secondStart,
        duration: minutes(23),
      }),
    ]);
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
