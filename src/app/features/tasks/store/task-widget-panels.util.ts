import { DEFAULT_BOARDS } from '../../boards/boards.const';
import { filterTasksForPanel } from '../../boards/boards.util';
import { Task } from '../task.model';
import { IMPORTANT_TAG, URGENT_TAG } from '../../tag/tag.const';
import { T } from '../../../t.const';

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

export type TaskWidgetLabels = Readonly<{
  activeTask: string;
  noActiveTask: string;
  noTasks: string;
}>;

const EISENHOWER_MATRIX_BOARD_ID = 'EISENHOWER_MATRIX';
const eisenhowerBoard = DEFAULT_BOARDS.find(
  (cfg) => cfg.id === EISENHOWER_MATRIX_BOARD_ID,
);

const TASK_WIDGET_LABEL_KEYS: Readonly<Record<keyof TaskWidgetLabels, string>> = {
  activeTask: T.GCF.TASK_WIDGET.ACTIVE_TASK,
  noActiveTask: T.GCF.TASK_WIDGET.NO_ACTIVE_TASK,
  noTasks: T.GCF.TASK_WIDGET.NO_TASKS,
};

export const TASK_WIDGET_TRANSLATION_KEYS: string[] = [
  ...(eisenhowerBoard?.panels.map((panel) => panel.title) ?? []),
  ...Object.values(TASK_WIDGET_LABEL_KEYS),
];

export const buildTaskWidgetLabels = (
  translateTitle: (title: string) => string,
): TaskWidgetLabels => ({
  activeTask: translateTitle(TASK_WIDGET_LABEL_KEYS.activeTask),
  noActiveTask: translateTitle(TASK_WIDGET_LABEL_KEYS.noActiveTask),
  noTasks: translateTitle(TASK_WIDGET_LABEL_KEYS.noTasks),
});

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
  if (!eisenhowerBoard) {
    return [];
  }

  const visibleTasks = tasks.filter(
    (task) =>
      !task.isDone ||
      task.tagIds?.includes(URGENT_TAG.id) ||
      task.tagIds?.includes(IMPORTANT_TAG.id),
  );

  return eisenhowerBoard.panels.map((panel) => ({
    id: panel.id,
    title: translateTitle(panel.title),
    tasks: filterTasksForPanel(visibleTasks, panel).map(mapTaskForTaskWidget),
  }));
};
