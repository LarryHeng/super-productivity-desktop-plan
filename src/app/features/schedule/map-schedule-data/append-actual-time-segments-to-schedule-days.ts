import { ScheduleDay, SVE } from '../schedule.model';
import { SVEType } from '../schedule.const';
import {
  TTActiveTaskSegment,
  TTActualTaskSegment,
  TTActualTaskSegmentByDateMap,
} from '../../time-tracking/time-tracking.model';
import { TaskCopy } from '../../tasks/task.model';

export const DEFAULT_ACTUAL_SEGMENT_MERGE_GAP_MINUTES = 5;
export const MAX_ACTUAL_SEGMENT_MERGE_GAP_MINUTES = 30;
const MINUTE_IN_MS = 60 * 1000;

export const appendActualTimeSegmentsToScheduleDays = (
  days: ScheduleDay[],
  taskSegments: TTActualTaskSegmentByDateMap | undefined,
  tasksById: Record<string, TaskCopy | Readonly<TaskCopy> | undefined> | undefined,
  activeSegment: TTActiveTaskSegment | null = null,
  currentTime: number = Date.now(),
  mergeGapMinutes: number = DEFAULT_ACTUAL_SEGMENT_MERGE_GAP_MINUTES,
): ScheduleDay[] => {
  if (!tasksById) {
    return days;
  }

  return days.map((day) => {
    const activeSegments: TTActualTaskSegment[] =
      activeSegment?.date === day.dayDate && currentTime > activeSegment.start
        ? [
            {
              taskId: activeSegment.taskId,
              start: activeSegment.start,
              end: currentTime,
            },
          ]
        : [];
    const actualSegments = mergeNearbyActualTaskSegments(
      [...(taskSegments?.[day.dayDate] ?? []), ...activeSegments].filter(
        (segment) => isValidActualSegment(segment) && !!tasksById[segment.taskId],
      ),
      normalizeMergeGapMinutes(mergeGapMinutes) * MINUTE_IN_MS,
    );

    if (!actualSegments.length) {
      return day;
    }

    const actualEntries: SVE[] = actualSegments.map((segment) => {
      const task = tasksById[segment.taskId] as TaskCopy;
      return {
        id: `actual-${segment.taskId}-${segment.start}-${segment.end}`,
        type: SVEType.ActualTask,
        start: segment.start,
        duration: segment.end - segment.start,
        data: task,
        plannedForDay: day.dayDate,
      };
    });
    const shiftedPlannedEntries = shiftPlannedEntriesAfterActualTime(
      day.entries,
      actualEntries,
    );

    return {
      ...day,
      entries: [...shiftedPlannedEntries, ...actualEntries].sort(
        (a, b) => a.start - b.start,
      ),
    };
  });
};

export const mergeNearbyActualTaskSegments = (
  segments: readonly TTActualTaskSegment[],
  mergeGapMs: number = DEFAULT_ACTUAL_SEGMENT_MERGE_GAP_MINUTES * MINUTE_IN_MS,
): TTActualTaskSegment[] => {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: TTActualTaskSegment[] = [];

  for (const segment of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.taskId === segment.taskId &&
      segment.start - previous.end <= mergeGapMs
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

const normalizeMergeGapMinutes = (minutes: number): number => {
  if (!Number.isFinite(minutes)) {
    return DEFAULT_ACTUAL_SEGMENT_MERGE_GAP_MINUTES;
  }
  return Math.min(MAX_ACTUAL_SEGMENT_MERGE_GAP_MINUTES, Math.max(0, minutes));
};

const isValidActualSegment = (segment: TTActualTaskSegment): boolean =>
  !!segment.taskId &&
  Number.isFinite(segment.start) &&
  Number.isFinite(segment.end) &&
  segment.end > segment.start;

const PLANNED_BLOCK_TYPES = new Set<SVEType>([
  SVEType.Task,
  SVEType.TaskPlannedForDay,
  SVEType.ScheduledTask,
  SVEType.SplitTask,
  SVEType.SplitTaskPlannedForDay,
  SVEType.SplitTaskContinued,
  SVEType.SplitTaskContinuedLast,
  SVEType.RepeatProjection,
  SVEType.RepeatProjectionSplit,
  SVEType.RepeatProjectionSplitContinued,
  SVEType.RepeatProjectionSplitContinuedLast,
  SVEType.ScheduledRepeatProjection,
]);

const shiftPlannedEntriesAfterActualTime = (
  entries: readonly SVE[],
  actualEntries: readonly SVE[],
): SVE[] => {
  const sortedEntries = [...entries].sort((a, b) => a.start - b.start);
  const blockers: SVE[] = [
    ...sortedEntries.filter((entry) => !PLANNED_BLOCK_TYPES.has(entry.type)),
    ...actualEntries,
  ];
  const shiftedEntries: SVE[] = [];

  for (const entry of sortedEntries) {
    if (!PLANNED_BLOCK_TYPES.has(entry.type)) {
      shiftedEntries.push(entry);
      continue;
    }

    let shiftedStart = entry.start;
    let collision = findFirstCollision(shiftedStart, entry.duration, blockers);
    while (collision) {
      shiftedStart = collision.start + collision.duration;
      collision = findFirstCollision(shiftedStart, entry.duration, blockers);
    }

    const shiftedEntry =
      shiftedStart === entry.start ? entry : { ...entry, start: shiftedStart };
    shiftedEntries.push(shiftedEntry);
    blockers.push(shiftedEntry);
  }

  return shiftedEntries;
};

const findFirstCollision = (
  start: number,
  duration: number,
  blockers: readonly SVE[],
): SVE | undefined =>
  blockers
    .filter(
      (blocker) =>
        blocker.duration > 0 &&
        start < blocker.start + blocker.duration &&
        start + duration > blocker.start,
    )
    .sort((a, b) => a.start - b.start)[0];
