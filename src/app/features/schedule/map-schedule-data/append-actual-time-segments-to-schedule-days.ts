import { ScheduleDay, ScheduleLunchBreakCfg, SVE } from '../schedule.model';
import { SVEType } from '../schedule.const';
import {
  TTActiveTaskSegment,
  TTActualTaskSegment,
  TTActualTaskSegmentByDateMap,
} from '../../time-tracking/time-tracking.model';
import { TaskCopy } from '../../tasks/task.model';
import { dateStrToUtcDate } from '../../../util/date-str-to-utc-date';
import { getDateTimeFromClockString } from '../../../util/get-date-time-from-clock-string';

export const DEFAULT_ACTUAL_SEGMENT_MERGE_GAP_MINUTES = 5;
export const MAX_ACTUAL_SEGMENT_MERGE_GAP_MINUTES = 30;
const MINUTE_IN_MS = 60 * 1000;
const LUNCH_TRANSITION_RATIO = 0.1;

export const appendActualTimeSegmentsToScheduleDays = (
  days: ScheduleDay[],
  taskSegments: TTActualTaskSegmentByDateMap | undefined,
  tasksById: Record<string, TaskCopy | Readonly<TaskCopy> | undefined> | undefined,
  activeSegment: TTActiveTaskSegment | null = null,
  currentTime: number = Date.now(),
  mergeGapMinutes: number = DEFAULT_ACTUAL_SEGMENT_MERGE_GAP_MINUTES,
  lunchBreakCfg?: ScheduleLunchBreakCfg,
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
    const actualSegments = trimOverlappingActualTaskSegments(
      mergeNearbyActualTaskSegments(
        [...(taskSegments?.[day.dayDate] ?? []), ...activeSegments].filter(
          (segment) => isValidActualSegment(segment) && !!tasksById[segment.taskId],
        ),
        normalizeMergeGapMinutes(mergeGapMinutes) * MINUTE_IN_MS,
      ),
    );

    const actualEntries: SVE[] = actualSegments.map((segment) => {
      const task = tasksById[segment.taskId] as TaskCopy;
      return {
        id: `actual-${segment.taskId}-${segment.start}-${segment.end}`,
        type:
          segment.source === 'manual' ? SVEType.CompletedPlannedTask : SVEType.ActualTask,
        start: segment.start,
        duration: segment.end - segment.start,
        data: task,
        plannedForDay: day.dayDate,
        originalDuration: segment.originalDuration ?? segment.end - segment.start,
      };
    });
    const shiftedEntries = shiftPlannedEntriesAfterActualTime(
      coalesceSplitPlannedEntries(day.entries),
      actualEntries,
    );
    const lunchAdjustedEntries = splitPlannedEntriesAroundLunch(
      shiftedEntries,
      getLunchEntriesForPlanning(shiftedEntries, day.dayDate, lunchBreakCfg),
    );
    const shiftedPlannedEntries = shiftPlannedEntriesAfterActualTime(
      lunchAdjustedEntries,
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
    // Manual segments are NEVER merged
    if (segment.source === 'manual') {
      merged.push({ ...segment });
      continue;
    }
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.source !== 'manual' &&
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

const trimOverlappingActualTaskSegments = (
  segments: readonly TTActualTaskSegment[],
): TTActualTaskSegment[] => {
  const normalized: TTActualTaskSegment[] = [];

  for (const segment of [...segments].sort((a, b) => a.start - b.start)) {
    const previous = normalized[normalized.length - 1];
    if (previous && segment.start < previous.end) {
      if (segment.start <= previous.start) {
        normalized.pop();
      } else {
        normalized[normalized.length - 1] = {
          ...previous,
          end: segment.start,
        };
      }
    }
    normalized.push({ ...segment });
  }

  return normalized;
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

const SPLIT_TASK_TYPES = new Set<SVEType>([
  SVEType.SplitTask,
  SVEType.SplitTaskPlannedForDay,
  SVEType.SplitTaskContinued,
  SVEType.SplitTaskContinuedLast,
]);

const SPLIT_REPEAT_TYPES = new Set<SVEType>([
  SVEType.RepeatProjectionSplit,
  SVEType.RepeatProjectionSplitContinued,
  SVEType.RepeatProjectionSplitContinuedLast,
]);

const coalesceSplitPlannedEntries = (entries: readonly SVE[]): SVE[] => {
  const result: SVE[] = [];
  const groups = new Map<string, SVE>();

  for (const entry of [...entries].sort((a, b) => a.start - b.start)) {
    const dataId = (entry.data as { id?: string } | undefined)?.id;
    const isSplitTask = SPLIT_TASK_TYPES.has(entry.type);
    const isSplitRepeat = SPLIT_REPEAT_TYPES.has(entry.type);
    if (!dataId || (!isSplitTask && !isSplitRepeat)) {
      result.push(entry);
      continue;
    }

    const key = `${isSplitTask ? 'task' : 'repeat'}:${dataId}:${
      entry.plannedForDay ?? ''
    }`;
    const existing = groups.get(key);
    if (existing) {
      groups.set(key, {
        ...existing,
        start: Math.min(existing.start, entry.start),
        duration: existing.duration + entry.duration,
        isBeyondBudget: existing.isBeyondBudget || entry.isBeyondBudget,
      } as SVE);
      continue;
    }

    const type = isSplitRepeat
      ? SVEType.RepeatProjection
      : entry.type === SVEType.SplitTaskPlannedForDay
        ? SVEType.TaskPlannedForDay
        : SVEType.Task;
    groups.set(key, {
      ...entry,
      id: dataId,
      type,
    } as SVE);
  }

  return [...result, ...groups.values()].sort((a, b) => a.start - b.start);
};

const getLunchEntriesForPlanning = (
  entries: readonly SVE[],
  dayDate: string,
  lunchBreakCfg?: ScheduleLunchBreakCfg,
): SVE[] => {
  const visibleEntries = entries.filter((entry) => entry.type === SVEType.LunchBreak);
  if (visibleEntries.length || !lunchBreakCfg) {
    return visibleEntries;
  }

  const date = dateStrToUtcDate(dayDate);
  const start = getDateTimeFromClockString(lunchBreakCfg.startTime, date);
  const end = getDateTimeFromClockString(lunchBreakCfg.endTime, date);
  return end > start
    ? [
        {
          id: `PLANNING_LUNCH_BREAK_${dayDate}`,
          type: SVEType.LunchBreak,
          start,
          duration: end - start,
          data: lunchBreakCfg,
        },
      ]
    : [];
};

const splitPlannedEntriesAroundLunch = (
  entries: readonly SVE[],
  lunchEntries: readonly SVE[],
): SVE[] => {
  const sortedLunchEntries = [...lunchEntries].sort((a, b) => a.start - b.start);
  if (!sortedLunchEntries.length) {
    return [...entries];
  }

  return entries
    .flatMap((entry) => {
      if (!PLANNED_BLOCK_TYPES.has(entry.type)) {
        return [entry];
      }
      return sortedLunchEntries.reduce<SVE[]>(
        (fragments, lunch) =>
          fragments.flatMap((fragment) => splitEntryAroundLunch(fragment, lunch)),
        [entry],
      );
    })
    .sort((a, b) => a.start - b.start);
};

const splitEntryAroundLunch = (entry: SVE, lunch: SVE): SVE[] => {
  const lunchEnd = lunch.start + lunch.duration;
  const transitionDuration = lunch.duration * LUNCH_TRANSITION_RATIO;
  const transitionEnd = lunch.start + transitionDuration;
  const entryEnd = entry.start + entry.duration;

  if (entryEnd <= transitionEnd || entry.start >= lunchEnd) {
    return [entry];
  }
  if (entry.start >= transitionEnd) {
    return [{ ...entry, start: lunchEnd } as SVE];
  }

  const firstDuration = transitionEnd - entry.start;
  const remainingDuration = entry.duration - firstDuration;
  if (firstDuration <= 0 || remainingDuration <= 0) {
    return [entry];
  }

  const { firstType, continuedType } = getLunchSplitTypes(entry.type);
  const first = {
    ...entry,
    type: firstType,
    duration: firstDuration,
  } as SVE;
  const continued = {
    ...entry,
    id: `${entry.id}__lunch_${lunch.start}`,
    type: continuedType,
    start: lunchEnd,
    duration: remainingDuration,
    ...(continuedType === SVEType.RepeatProjectionSplitContinuedLast
      ? { splitIndex: 0 }
      : {}),
  } as SVE;

  return [first, continued];
};

const getLunchSplitTypes = (
  type: SVEType,
): { firstType: SVEType; continuedType: SVEType } => {
  if (
    type === SVEType.RepeatProjection ||
    type === SVEType.RepeatProjectionSplit ||
    type === SVEType.RepeatProjectionSplitContinued ||
    type === SVEType.RepeatProjectionSplitContinuedLast
  ) {
    return {
      firstType: SVEType.RepeatProjectionSplit,
      continuedType: SVEType.RepeatProjectionSplitContinuedLast,
    };
  }
  if (type === SVEType.ScheduledRepeatProjection) {
    return {
      firstType: SVEType.ScheduledRepeatProjection,
      continuedType: SVEType.RepeatProjectionSplitContinuedLast,
    };
  }
  if (type === SVEType.TaskPlannedForDay || type === SVEType.SplitTaskPlannedForDay) {
    return {
      firstType: SVEType.SplitTaskPlannedForDay,
      continuedType: SVEType.SplitTaskContinuedLast,
    };
  }
  if (type === SVEType.ScheduledTask) {
    return {
      firstType: SVEType.ScheduledTask,
      continuedType: SVEType.SplitTaskContinuedLast,
    };
  }
  return {
    firstType: SVEType.SplitTask,
    continuedType: SVEType.SplitTaskContinuedLast,
  };
};

const shiftPlannedEntriesAfterActualTime = (
  entries: readonly SVE[],
  actualEntries: readonly SVE[],
): SVE[] => {
  const sortedEntries = [...entries].sort((a, b) => a.start - b.start);
  const blockers: SVE[] = [
    ...sortedEntries.filter(
      (entry) =>
        !PLANNED_BLOCK_TYPES.has(entry.type) && entry.type !== SVEType.LunchBreak,
    ),
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
