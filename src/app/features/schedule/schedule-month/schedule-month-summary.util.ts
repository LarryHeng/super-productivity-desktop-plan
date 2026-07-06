import { ScheduleEvent } from '../schedule.model';
import { SVEType } from '../schedule.const';

export interface ScheduleMonthTaskSummary {
  taskId: string;
  title: string;
  durationMs: number;
}

export interface ScheduleMonthDaySummary {
  totalDurationMs: number;
  tasks: ScheduleMonthTaskSummary[];
}

export const buildScheduleMonthSummary = (
  events: readonly ScheduleEvent[],
): Record<string, ScheduleMonthDaySummary> => {
  const dayTaskMaps = new Map<string, Map<string, ScheduleMonthTaskSummary>>();

  for (const event of events) {
    if (
      (event.type !== SVEType.ActualTask &&
        event.type !== SVEType.CompletedPlannedTask) ||
      !event.plannedForDay ||
      !event.data ||
      !('id' in event.data)
    ) {
      continue;
    }

    const durationMs = Math.max(0, Math.round(event.timeLeftInHours * 60 * 60 * 1000));
    if (durationMs === 0) {
      continue;
    }

    const taskId = event.data.id;
    const title =
      'title' in event.data && typeof event.data.title === 'string'
        ? event.data.title
        : taskId;
    const taskMap =
      dayTaskMaps.get(event.plannedForDay) ?? new Map<string, ScheduleMonthTaskSummary>();
    const existing = taskMap.get(taskId);

    taskMap.set(taskId, {
      taskId,
      title,
      durationMs: (existing?.durationMs ?? 0) + durationMs,
    });
    dayTaskMaps.set(event.plannedForDay, taskMap);
  }

  const result: Record<string, ScheduleMonthDaySummary> = {};
  for (const [day, taskMap] of dayTaskMaps) {
    const tasks = [...taskMap.values()];
    result[day] = {
      totalDurationMs: tasks.reduce((total, task) => total + task.durationMs, 0),
      tasks,
    };
  }
  return result;
};

export const formatWorkedDuration = (durationMs: number, locale: string): string => {
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const values: string[] = [];

  if (hours > 0) {
    values.push(
      new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'hour',
        unitDisplay: 'short',
      }).format(hours),
    );
  }
  if (minutes > 0 || values.length === 0) {
    values.push(
      new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'minute',
        unitDisplay: 'short',
      }).format(minutes),
    );
  }

  return values.join(' ');
};
