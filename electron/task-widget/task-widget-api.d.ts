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
  panels: {
    id: string;
    title: string;
    tasks: TaskWidgetListTask[];
  }[];
}

interface TaskWidgetBackgroundData {
  image: string | null;
  imageOpacity: number;
}

interface TaskWidgetAppearanceData {
  backgroundOpacity: number;
  contentOpacity: number;
}

interface TaskWidgetCountdownExpiredData {
  taskId: string;
  title: string;
}

interface TaskWidgetAPI {
  showMainWindow: () => void;
  completeTask: (taskId: string) => void;
  switchTask: (taskId: string) => void;
  hideWidget: () => void;
  extendTask: (taskId: string, additionalTime: number) => void;
  onUpdateContent: (callback: (data: TaskWidgetContentData) => void) => () => void;
  onUpdateOpacity: (callback: (data: TaskWidgetAppearanceData) => void) => () => void;
  onUpdateBackground: (callback: (data: TaskWidgetBackgroundData) => void) => () => void;
  onCountdownExpired: (
    callback: (data: TaskWidgetCountdownExpiredData) => void,
  ) => () => void;
}

declare global {
  interface Window {
    taskWidgetAPI: TaskWidgetAPI;
  }
}

export {};
