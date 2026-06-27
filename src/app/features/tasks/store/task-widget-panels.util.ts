import { DEFAULT_BOARDS } from '../../boards/boards.const';
import { filterTasksForPanel } from '../../boards/boards.util';
import { Task } from '../task.model';
import { IMPORTANT_TAG, URGENT_TAG } from '../../tag/tag.const';

export type TaskWidgetListTask = Readonly<{
  id: string;
  title: string;
  timeEstimate: number;
  timeSpent: number;
  dueDay?: string;
  dueWithTime?: number;
  deadlineDay?: string;
  deadlineWithTime?: number;
  isDone: boolean;
}>;

export type TaskWidgetTaskPanel = Readonly<{
  id: string;
  title: string;
  tasks: TaskWidgetListTask[];
}>;

const EISENHOWER_MATRIX_BOARD_ID = 'EISENHOWER_MATRIX';

export const mapTaskForTaskWidget = (t: Task): TaskWidgetListTask => ({
  id: t.id,
  title: t.title,
  timeEstimate: t.timeEstimate,
  timeSpent: t.timeSpent,
  dueDay: t.dueDay ?? undefined,
  dueWithTime: t.dueWithTime ?? undefined,
  deadlineDay: t.deadlineDay ?? undefined,
  deadlineWithTime: t.deadlineWithTime ?? undefined,
  isDone: t.isDone,
});

export const buildEisenhowerTaskWidgetPanels = (
  tasks: readonly Task[],
  translateTitle: (title: string) => string = (title) => title,
): TaskWidgetTaskPanel[] => {
  const board = DEFAULT_BOARDS.find((cfg) => cfg.id === EISENHOWER_MATRIX_BOARD_ID);
  if (!board) {
    return [];
  }

  const visibleTasks = tasks.filter(
    (task) =>
      !task.isDone ||
      task.tagIds?.includes(URGENT_TAG.id) ||
      task.tagIds?.includes(IMPORTANT_TAG.id),
  );

  return board.panels.map((panel) => ({
    id: panel.id,
    title: translateTitle(panel.title),
    tasks: filterTasksForPanel(visibleTasks, panel).map(mapTaskForTaskWidget),
  }));
};
