import { getPlannerMonthItems } from './planner-month.util';
import { PlannerDay, ScheduleItemType } from '../planner.model';

describe('getPlannerMonthItems', () => {
  it('lists unique work content without times or durations', () => {
    const day = {
      dayDate: '2026-06-27',
      tasks: [{ id: 'task-1', title: 'Write report' }],
      deadlineTasks: [{ id: 'task-1', title: 'Write report' }],
      scheduledIItems: [
        {
          id: 'scheduled-task',
          type: ScheduleItemType.Task,
          start: 9,
          end: 10,
          task: { id: 'task-2', title: 'Review PR' },
        },
        {
          id: 'calendar',
          type: ScheduleItemType.CalEvent,
          start: 11,
          end: 12,
          calendarEvent: { title: 'Team sync', duration: 60 },
        },
      ],
      noStartTimeRepeatProjections: [],
      allDayEvents: [],
      timeEstimate: 0,
      timeLimit: 0,
      itemsTotal: 3,
    } as unknown as PlannerDay;

    expect(getPlannerMonthItems(day)).toEqual([
      { id: 'task:task-1', title: 'Write report' },
      { id: 'task:task-2', title: 'Review PR' },
      { id: 'calendar:calendar', title: 'Team sync' },
    ]);
  });
});
