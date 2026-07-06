interface TaskWidgetListTask {
  id: string;
  title: string;
  timeEstimate?: number;
  timeSpent?: number;
  dueDay?: string;
  dueWithTime?: number;
  deadlineDay?: string;
  deadlineWithTime?: number;
  isDone?: boolean;
}

interface TaskWidgetContentData {
  title: string;
  time: string;
  mode: 'pomodoro' | 'focus' | 'task' | 'idle';
  labels: {
    activeTask: string;
    noActiveTask: string;
    noTasks: string;
  };
  panels: {
    id: string;
    title: string;
    tasks: TaskWidgetListTask[];
  }[];
}

interface TaskWidgetBackgroundData {
  image: string | null;
  imageOpacity: number;
  mode: 'theme' | 'image';
  positionX: number;
  positionY: number;
}

interface TaskWidgetAppearanceData {
  backgroundOpacity: number;
  contentOpacity: number;
}

interface TaskWidgetCountdownExpiredData {
  taskId: string;
  title: string;
}

interface TaskWidgetCountdownData {
  name: string;
  days: number | null;
  styles: Record<string, string>;
}

interface TaskWidgetAPI {
  showMainWindow: () => void;
  completeTask: (taskId: string, isDone: boolean) => void;
  switchTask: (taskId: string) => void;
  hideWidget: () => void;
  extendTask: (taskId: string, additionalTime: number) => void;
  onUpdateContent: (callback: (data: TaskWidgetContentData) => void) => () => void;
  onUpdateOpacity: (callback: (data: TaskWidgetAppearanceData) => void) => () => void;
  onUpdateBackground: (callback: (data: TaskWidgetBackgroundData) => void) => () => void;
  onCountdownExpired: (
    callback: (data: TaskWidgetCountdownExpiredData) => void,
  ) => () => void;
  onUpdateCountdown: (
    callback: (data: TaskWidgetCountdownData | null) => void,
  ) => () => void;
}

declare global {
  interface Window {
    taskWidgetAPI: TaskWidgetAPI;
  }
}

export {};
