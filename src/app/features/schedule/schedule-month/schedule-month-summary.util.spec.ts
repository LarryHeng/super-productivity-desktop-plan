import {
  buildScheduleMonthSummary,
  formatWorkedDuration,
} from './schedule-month-summary.util';
import { ScheduleEvent } from '../schedule.model';
import { SVEType } from '../schedule.const';

describe('schedule month summary', () => {
  it('groups actual segments for the same task and excludes planned events', () => {
    const events: ScheduleEvent[] = [
      createEvent('segment-1', SVEType.ActualTask, 'task-1', 'Deep work', 1.25),
      createEvent('segment-2', SVEType.ActualTask, 'task-1', 'Deep work', 0.5),
      createEvent('segment-3', SVEType.ActualTask, 'task-2', 'Review', 0.25),
      createEvent('planned', SVEType.TaskPlannedForDay, 'task-3', 'Tomorrow', 3),
    ];

    const result = buildScheduleMonthSummary(events);

    expect(result['2026-06-27'].totalDurationMs).toBe(2 * 60 * 60 * 1000);
    expect(result['2026-06-27'].tasks).toEqual([
      {
        taskId: 'task-1',
        title: 'Deep work',
        durationMs: 1.75 * 60 * 60 * 1000,
      },
      {
        taskId: 'task-2',
        title: 'Review',
        durationMs: 0.25 * 60 * 60 * 1000,
      },
    ]);
  });

  it('formats a concrete hour and minute duration without time ranges', () => {
    const twoHours = 2 * 60 * 60 * 1000;
    const fiveMinutes = 5 * 60 * 1000;
    expect(formatWorkedDuration(twoHours + fiveMinutes, 'en-US')).toBe('2 hr 5 min');
  });
});

const createEvent = (
  id: string,
  type: SVEType,
  taskId: string,
  title: string,
  timeLeftInHours: number,
): ScheduleEvent => ({
  id,
  type,
  style: '',
  startHours: 9,
  timeLeftInHours,
  plannedForDay: '2026-06-27',
  data: { id: taskId, title } as ScheduleEvent['data'],
});
