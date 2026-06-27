import { ScheduleDay, SVE } from '../schedule.model';
import { SVEType } from '../schedule.const';
import {
  TTActualTaskSegment,
  TTActualTaskSegmentByDateMap,
} from '../../time-tracking/time-tracking.model';
import { TaskCopy } from '../../tasks/task.model';

const MIN_ACTUAL_SEGMENT_DURATION = 60 * 1000;
const ACTUAL_SEGMENT_MERGE_GAP = 5 * 60 * 1000;

export const appendActualTimeSegmentsToScheduleDays = (
  days: ScheduleDay[],
  taskSegments: TTActualTaskSegmentByDateMap | undefined,
  tasksById: Record<string, TaskCopy | Readonly<TaskCopy> | undefined> | undefined,
): ScheduleDay[] => {
  if (!taskSegments || !tasksById) {
    return days;
  }

  return days.map((day) => {
    const actualSegments = mergeNearbyActualTaskSegments(
      (taskSegments[day.dayDate] ?? []).filter(
        (segment) => isValidActualSegment(segment) && !!tasksById[segment.taskId],
      ),
    );

    if (!actualSegments.length) {
      return day;
    }

    const actualTaskIds = new Set(actualSegments.map((segment) => segment.taskId));
    const entriesWithoutEstimatedTaskEntries = day.entries.filter(
      (entry) => !isSameDayEstimatedTaskEntry(entry, actualTaskIds),
    );
    const actualEntries: SVE[] = actualSegments.map((segment) => {
      const task = tasksById[segment.taskId] as TaskCopy;
      return {
        id: `actual-${segment.taskId}-${segment.start}-${segment.end}`,
        type: SVEType.ActualTask,
        start: segment.start,
        duration: Math.max(segment.end - segment.start, MIN_ACTUAL_SEGMENT_DURATION),
        data: task,
        plannedForDay: day.dayDate,
      };
    });

    return {
      ...day,
      entries: [...entriesWithoutEstimatedTaskEntries, ...actualEntries].sort(
        (a, b) => a.start - b.start,
      ),
    };
  });
};

export const mergeNearbyActualTaskSegments = (
  segments: readonly TTActualTaskSegment[],
): TTActualTaskSegment[] => {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: TTActualTaskSegment[] = [];

  for (const segment of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.taskId === segment.taskId &&
      segment.start - previous.end < ACTUAL_SEGMENT_MERGE_GAP
    ) {
      merged[merged.length - 1] = {
        ...previous,
        end: Math.max(previous.end, segment.end),
      };
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
};

const isValidActualSegment = (segment: TTActualTaskSegment): boolean =>
  !!segment.taskId &&
  Number.isFinite(segment.start) &&
  Number.isFinite(segment.end) &&
  segment.end > segment.start;

const isSameDayEstimatedTaskEntry = (entry: SVE, actualTaskIds: Set<string>): boolean =>
  (entry.type === SVEType.Task ||
    entry.type === SVEType.TaskPlannedForDay ||
    entry.type === SVEType.ScheduledTask ||
    entry.type === SVEType.SplitTask ||
    entry.type === SVEType.SplitTaskPlannedForDay ||
    entry.type === SVEType.SplitTaskContinued ||
    entry.type === SVEType.SplitTaskContinuedLast) &&
  !!entry.data &&
  'id' in entry.data &&
  actualTaskIds.has(entry.data.id);
