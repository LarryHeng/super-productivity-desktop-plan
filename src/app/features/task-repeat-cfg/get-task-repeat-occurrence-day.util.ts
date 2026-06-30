import { Task } from '../tasks/task.model';
import { getDbDateStr, isDBDateStr } from '../../util/get-db-date-str';

type RepeatOccurrenceTask = Pick<Task, 'id' | 'created' | 'repeatOccurrenceDay'>;

export const isValidTaskRepeatOccurrenceDay = (value: unknown): value is string => {
  if (typeof value !== 'string' || !isDBDateStr(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const parsed = new Date(year, month - 1, day, 12);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

export const getTaskRepeatOccurrenceDay = (task: RepeatOccurrenceTask): string => {
  if (isValidTaskRepeatOccurrenceDay(task.repeatOccurrenceDay)) {
    return task.repeatOccurrenceDay;
  }

  const deterministicIdDate = task.id.slice(-10);
  if (task.id.startsWith('rpt_') && isValidTaskRepeatOccurrenceDay(deterministicIdDate)) {
    return deterministicIdDate;
  }

  return getDbDateStr(task.created);
};
