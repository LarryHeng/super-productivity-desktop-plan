import { Task } from '../../tasks/task.model';
import {
  TTActiveTaskSegment,
  TTActualTaskSegment,
} from '../../time-tracking/time-tracking.model';

export type ManualRecordContinuation = 'continue' | 'done';
export type ManualTimeRangeError = 'invalid' | 'future' | 'overlap';

export const validateManualTimeRange = (
  start: number,
  end: number,
  existingSegments: readonly TTActualTaskSegment[],
  activeSegment: TTActiveTaskSegment | null,
  now: number = Date.now(),
): ManualTimeRangeError | null => {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 'invalid';
  }
  if (end > now) {
    return 'future';
  }

  const hasOverlap = existingSegments.some(
    (segment) => start < segment.end && end > segment.start,
  );
  const activeEnd = activeSegment ? now : 0;
  const overlapsActive =
    !!activeSegment && start < activeEnd && end > activeSegment.start;

  return hasOverlap || overlapsActive ? 'overlap' : null;
};

export const getTaskUpdateAfterManualRecord = (
  task: Task,
  recordedDuration: number,
  continuation: ManualRecordContinuation,
  remainingEstimate: number,
): Pick<Task, 'isDone' | 'timeEstimate'> => {
  const nextTimeSpent = task.timeSpent + recordedDuration;
  if (continuation === 'continue') {
    return {
      isDone: false,
      timeEstimate: nextTimeSpent + Math.max(0, remainingEstimate),
    };
  }
  return {
    isDone: true,
    timeEstimate: nextTimeSpent,
  };
};
