import { BrowserWindow, ipcMain, screen } from 'electron';
import { execFile } from 'node:child_process';
import { join } from 'path';
import { TaskCopy } from '../../src/app/features/tasks/task.model';
import { TaskWidgetConfig } from '../../src/app/features/config/global-config.model';
import { info } from 'electron-log/main';
import { IPC } from '../shared-with-frontend/ipc-events.const';
import { loadSimpleStoreAll, saveSimpleStore } from '../simple-store';
import { IS_MAC, IS_WINDOWS } from '../common.const';
import { getImageDataUrl } from '../image-cache';

let taskWidgetWin: BrowserWindow | null = null;
let isTaskWidgetEnabled = false;
let isAlwaysShow = false;
// Set when the user explicitly reveals the widget via the global shortcut.
let isUserForcedVisible = false;
let isUserHidden = false;
let currentTask: TaskCopy | null = null;
let isPomodoroEnabled = false;
let currentPomodoroSessionTime = 0;
let isFocusModeEnabled = false;
let currentFocusSessionTime = 0;
let initTimeoutId: NodeJS.Timeout | null = null;
let currentOpacity = 95;
let currentContentOpacity = 100;
let currentBackgroundImage: string | null = null;
let currentBackgroundImageOpacity = 45;
let currentBackgroundPositionX = 50;
let currentBackgroundPositionY = 50;
let currentGlobalBackgroundImage: string | null = null;
let currentGlobalBackgroundImageOpacity = 20;
let currentGlobalBackgroundPositionX = 50;
let currentGlobalBackgroundPositionY = 50;
let listenersRegistered = false;
let taskWidgetCreationPromise: Promise<void> | null = null;
let taskWidgetCreationGeneration = 0;
let pendingShowAfterCreate = false;
let pendingShowAfterCreateInactive = false;
let backgroundResolveGeneration = 0;
let isTaskWidgetDocumentReady = false;
let windowsDesktopMediaSourceIdPromise: Promise<string | null> | null = null;

const TASK_WIDGET_BOUNDS_KEY = 'taskWidgetBounds';
const LEGACY_BOUNDS_KEY = 'overlayBounds';
const TASK_WIDGET_SHOW_MAIN_WINDOW = 'task-widget-show-main-window';
const TASK_WIDGET_COMPLETE_TASK = 'task-widget-complete-task';
const TASK_WIDGET_SWITCH_TASK = 'task-widget-switch-task';
const TASK_WIDGET_EXTEND_TASK = 'task-widget-extend-task';
const TASK_WIDGET_HIDE = 'task-widget-hide';
const IMAGE_CACHE_PREFIX = 'image:';
const TASK_WIDGET_THEME_BACKGROUND = 'task-widget:theme';
const WINDOWS_DESKTOP_LAYER_REFRESH_MS = 500;
const WINDOWS_DESKTOP_HANDLE_COMMAND =
  'Add-Type -MemberDefinition \'[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern System.IntPtr GetShellWindow();\' -Name ShellWindow -Namespace Native; [Native.ShellWindow]::GetShellWindow().ToInt64()';
let boundsDebounceTimer: NodeJS.Timeout | null = null;

type ShowTaskWidgetOptions = Readonly<{
  inactive?: boolean;
}>;

export type TaskWidgetListTask = Readonly<{
  id: string;
  title: string;
  timeEstimate?: number;
  timeSpent?: number;
  dueDay?: string;
  dueWithTime?: number;
  deadlineDay?: string;
  deadlineWithTime?: number;
  isDone?: boolean;
}>;

export type TaskWidgetTaskLists = Readonly<{
  labels: TaskWidgetLabels;
  panels: ReadonlyArray<
    Readonly<{
      id: string;
      title: string;
      tasks: TaskWidgetListTask[];
    }>
  >;
}>;

type TaskWidgetLabels = Readonly<{
  activeTask: string;
  noActiveTask: string;
  noTasks: string;
}>;

const EMPTY_TASK_WIDGET_LABELS: TaskWidgetLabels = {
  activeTask: '',
  noActiveTask: '',
  noTasks: '',
};

let currentTaskLists: TaskWidgetTaskLists = {
  labels: EMPTY_TASK_WIDGET_LABELS,
  panels: [],
};

const getMainWindow = (): BrowserWindow | undefined =>
  BrowserWindow.getAllWindows().find((win) => win !== taskWidgetWin);

const getWindowsDesktopMediaSourceId = (): Promise<string | null> => {
  if (!IS_WINDOWS) {
    return Promise.resolve(null);
  }

  if (!windowsDesktopMediaSourceIdPromise) {
    windowsDesktopMediaSourceIdPromise = new Promise((resolve) => {
      execFile(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          WINDOWS_DESKTOP_HANDLE_COMMAND,
        ],
        {
          encoding: 'utf8',
          timeout: 5_000,
          windowsHide: true,
        },
        (error, stdout) => {
          const handle = stdout?.trim();
          if (error || !handle || !/^\d+$/.test(handle) || handle === '0') {
            windowsDesktopMediaSourceIdPromise = null;
            info('Unable to resolve the Windows desktop shell window');
            resolve(null);
            return;
          }
          resolve(`window:${handle}:0`);
        },
      );
    });
  }

  return windowsDesktopMediaSourceIdPromise;
};

const maintainTaskWidgetDesktopLayer = async (): Promise<void> => {
  const win = taskWidgetWin;
  if (
    !IS_WINDOWS ||
    !win ||
    win.isDestroyed() ||
    !isTaskWidgetEnabled ||
    isUserHidden ||
    !win.isVisible()
  ) {
    return;
  }

  const desktopMediaSourceId = await getWindowsDesktopMediaSourceId();
  if (
    !desktopMediaSourceId ||
    taskWidgetWin !== win ||
    win.isDestroyed() ||
    !win.isVisible()
  ) {
    return;
  }

  try {
    win.moveAbove(desktopMediaSourceId);
  } catch (error) {
    windowsDesktopMediaSourceIdPromise = null;
    info('Unable to maintain task widget desktop layer', error);
  }
};

const normalizeBackgroundImage = (
  backgroundImage: string | null | undefined,
): string | null =>
  typeof backgroundImage === 'string' && backgroundImage.trim().length > 0
    ? backgroundImage
    : null;

const normalizeBackgroundImageOpacity = (
  backgroundImageOpacity: number | null | undefined,
  fallback: number,
): number => Math.max(0, Math.min(100, backgroundImageOpacity ?? fallback));

const normalizeBackgroundPosition = (
  value: number | null | undefined,
  fallback = 50,
): number =>
  Number.isFinite(value)
    ? Math.round(Math.max(0, Math.min(100, value as number)) * 10) / 10
    : fallback;

const getEffectiveTaskWidgetBackground = (): Readonly<{
  image: string | null;
  imageOpacity: number;
  mode: 'theme' | 'image';
  positionX: number;
  positionY: number;
}> =>
  currentBackgroundImage === TASK_WIDGET_THEME_BACKGROUND
    ? {
        image: null,
        imageOpacity: currentBackgroundImageOpacity,
        mode: 'theme',
        positionX: currentBackgroundPositionX,
        positionY: currentBackgroundPositionY,
      }
    : currentBackgroundImage
      ? {
          image: currentBackgroundImage,
          imageOpacity: currentBackgroundImageOpacity,
          mode: 'image',
          positionX: currentBackgroundPositionX,
          positionY: currentBackgroundPositionY,
        }
      : {
          image: currentGlobalBackgroundImage,
          imageOpacity: currentGlobalBackgroundImageOpacity,
          mode: currentGlobalBackgroundImage ? 'image' : 'theme',
          positionX: currentGlobalBackgroundPositionX,
          positionY: currentGlobalBackgroundPositionY,
        };

export const updateTaskWidgetEnabled = (isEnabled: boolean): void => {
  const wasEnabled = isTaskWidgetEnabled;
  isTaskWidgetEnabled = isEnabled;

  if (!isEnabled) {
    destroyTaskWidget();
    return;
  }

  if (!wasEnabled) {
    isUserHidden = false;
  }

  if (!taskWidgetWin && !taskWidgetCreationPromise) {
    initListeners();
    createTaskWidgetWindow().then(() => {
      // Window creation is async; re-apply the cached opacity here because
      // updateTaskWidgetOpacity() is a no-op while taskWidgetWin is still null,
      // and on macOS BrowserWindow.setOpacity() defaults to 1 (no CSS fallback).
      if (taskWidgetWin && !taskWidgetWin.isDestroyed()) {
        updateTaskWidgetOpacity(currentOpacity, currentContentOpacity);
        updateTaskWidgetBackground(
          currentBackgroundImage,
          currentBackgroundImageOpacity,
          currentBackgroundPositionX,
          currentBackgroundPositionY,
        );
        if (isAlwaysShow) {
          showTaskWidget({ inactive: true });
        }
      }
      // Request current task state after window is ready
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(IPC.REQUEST_CURRENT_TASK_FOR_TASK_WIDGET);
      }
    });
  }
};

const clearPendingTaskWidgetCreation = (): void => {
  taskWidgetCreationGeneration += 1;
  taskWidgetCreationPromise = null;
  pendingShowAfterCreate = false;
  pendingShowAfterCreateInactive = false;
};

export const destroyTaskWidget = (): void => {
  // Clear any pending timeouts
  if (initTimeoutId) {
    clearInterval(initTimeoutId);
    initTimeoutId = null;
  }

  // Clear bounds debounce timer
  if (boundsDebounceTimer) {
    clearTimeout(boundsDebounceTimer);
    boundsDebounceTimer = null;
  }

  // Disable task widget to prevent close event prevention
  isTaskWidgetEnabled = false;
  isUserForcedVisible = false;
  isUserHidden = false;
  clearPendingTaskWidgetCreation();

  // Remove IPC listeners
  ipcMain.removeAllListeners(TASK_WIDGET_SHOW_MAIN_WINDOW);
  ipcMain.removeAllListeners(TASK_WIDGET_COMPLETE_TASK);
  ipcMain.removeAllListeners(TASK_WIDGET_SWITCH_TASK);
  ipcMain.removeAllListeners(TASK_WIDGET_EXTEND_TASK);
  ipcMain.removeAllListeners(TASK_WIDGET_HIDE);
  listenersRegistered = false;

  if (taskWidgetWin && !taskWidgetWin.isDestroyed()) {
    try {
      // Remove ALL event listeners
      taskWidgetWin.removeAllListeners();

      // Remove webContents listeners
      if (taskWidgetWin.webContents && !taskWidgetWin.webContents.isDestroyed()) {
        taskWidgetWin.webContents.removeAllListeners();
      }

      // Hide first to prevent visual issues
      taskWidgetWin.hide();

      // Set closable to ensure we can close it
      taskWidgetWin.setClosable(true);

      // Force destroy the window
      taskWidgetWin.destroy();
    } catch (e) {
      // Window might already be destroyed
      console.error('Error destroying task widget window:', e);
    }

    taskWidgetWin = null;
  }
  isTaskWidgetDocumentReady = false;
};

const createTaskWidgetWindow = (): Promise<void> => {
  if (taskWidgetWin) {
    return Promise.resolve();
  }

  if (taskWidgetCreationPromise) {
    return taskWidgetCreationPromise;
  }

  const creationGeneration = taskWidgetCreationGeneration;
  const nextCreationPromise = createTaskWidgetWindowForGeneration(
    creationGeneration,
  ).finally(() => {
    if (taskWidgetCreationPromise === nextCreationPromise) {
      taskWidgetCreationPromise = null;
    }
  });

  taskWidgetCreationPromise = nextCreationPromise;
  return nextCreationPromise;
};

const createTaskWidgetWindowForGeneration = async (
  creationGeneration: number,
): Promise<void> => {
  if (taskWidgetWin) {
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const defaultBounds = { width: 760, height: 420, x: screenWidth - 780, y: 40 };

  // Restore persisted bounds or use defaults
  let bounds = defaultBounds;
  try {
    const store = await loadSimpleStoreAll();
    // Try new key first, fall back to legacy key for migration
    const saved = (store[TASK_WIDGET_BOUNDS_KEY] || store[LEGACY_BOUNDS_KEY]) as
      | { width: number; height: number; x: number; y: number }
      | undefined;
    if (
      saved &&
      typeof saved.width === 'number' &&
      saved.width > 0 &&
      typeof saved.height === 'number' &&
      saved.height > 0 &&
      typeof saved.x === 'number' &&
      typeof saved.y === 'number'
    ) {
      // Validate saved bounds are visible on any connected display
      const matchingDisplay = screen.getDisplayMatching({
        x: saved.x,
        y: saved.y,
        width: saved.width,
        height: saved.height,
      });
      const isOnScreen =
        matchingDisplay &&
        saved.x + saved.width > matchingDisplay.bounds.x &&
        saved.x < matchingDisplay.bounds.x + matchingDisplay.bounds.width &&
        saved.y >= matchingDisplay.bounds.y &&
        saved.y < matchingDisplay.bounds.y + matchingDisplay.bounds.height;
      bounds = isOnScreen ? saved : defaultBounds;
    }
  } catch (_e) {
    // Use defaults (file may not exist on first run)
  }

  if (
    taskWidgetWin ||
    !isTaskWidgetEnabled ||
    creationGeneration !== taskWidgetCreationGeneration
  ) {
    return;
  }

  // On macOS, transparent + frameless windows do not support native window
  // dragging or edge resizing (see Electron's BrowserWindow docs: "Transparent
  // windows are not resizable. Setting `resizable` to `true` may make a
  // transparent window stop working on some platforms."). Use a solid window
  // instead and rely on BrowserWindow.setOpacity() for the user-set opacity so
  // the OS keeps native drag/resize behavior intact.
  taskWidgetWin = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    title: 'Super Productivity Task Widget',
    frame: false,
    transparent: !IS_MAC,
    backgroundColor: IS_MAC ? '#00000000' : undefined,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: true,
    minWidth: 420,
    minHeight: 220,
    minimizable: false,
    maximizable: false,
    closable: true, // Ensure window is closable
    hasShadow: IS_MAC, // Mac: solid window can keep native shadow
    autoHideMenuBar: true,
    roundedCorners: IS_MAC, // Mac: rely on OS-native rounded corners
    webPreferences: {
      preload: join(__dirname, 'task-widget-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      disableDialogs: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false, // Prevent throttling when hidden
    },
  });
  isTaskWidgetDocumentReady = false;

  taskWidgetWin.on('closed', () => {
    taskWidgetWin = null;
    isTaskWidgetDocumentReady = false;
    // Tie "user-forced visible" to the window's lifetime: once the window is
    // gone the sticky flag has no widget to keep visible, so don't let it
    // linger into a future re-create.
    isUserForcedVisible = false;
  });

  taskWidgetWin.on('ready-to-show', () => {
    if (!taskWidgetWin || taskWidgetWin.isDestroyed()) return;

    // Request current task state from main window
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(IPC.REQUEST_CURRENT_TASK_FOR_TASK_WIDGET);
    }
    if (isAlwaysShow) {
      showTaskWidget({ inactive: true });
    }
  });

  // Electron's BrowserWindow type omits this overload for a non-minimizable
  // window, but Windows Show Desktop can still emit it.
  // @ts-ignore
  taskWidgetWin.on('minimize', (event: Electron.Event) => {
    event.preventDefault();
    setImmediate(() => {
      if (
        taskWidgetWin &&
        !taskWidgetWin.isDestroyed() &&
        isTaskWidgetEnabled &&
        !isUserHidden
      ) {
        taskWidgetWin.restore();
        taskWidgetWin.showInactive();
      }
    });
  });

  taskWidgetWin.webContents.on('did-finish-load', () => {
    isTaskWidgetDocumentReady = true;
    lastCountdownExpiredKey = null;
    updateTaskWidgetContent();
    updateTaskWidgetOpacity(currentOpacity, currentContentOpacity);
    applyEffectiveTaskWidgetBackground();
    syncTaskWidgetVisibilityWithMainWindow(!!getMainWindow()?.isVisible());
  });

  const persistBoundsDebounced = (): void => {
    if (boundsDebounceTimer) clearTimeout(boundsDebounceTimer);
    boundsDebounceTimer = setTimeout(() => {
      if (taskWidgetWin && !taskWidgetWin.isDestroyed()) {
        saveSimpleStore(TASK_WIDGET_BOUNDS_KEY, taskWidgetWin.getBounds());
      }
    }, 300);
  };

  taskWidgetWin.on('resize', persistBoundsDebounced);
  taskWidgetWin.on('move', persistBoundsDebounced);

  // Prevent context menu on right-click to avoid crashes
  taskWidgetWin.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  // Prevent any window system menu
  taskWidgetWin.on('system-context-menu', (e) => {
    e.preventDefault();
  });

  taskWidgetWin.loadFile(join(__dirname, 'task-widget.html'));

  initTimeoutId = setInterval(() => {
    if (
      taskWidgetWin &&
      !taskWidgetWin.isDestroyed() &&
      isTaskWidgetEnabled &&
      !isUserHidden
    ) {
      if (taskWidgetWin.isMinimized()) {
        taskWidgetWin.restore();
        taskWidgetWin.showInactive();
      }
      void maintainTaskWidgetDesktopLayer();
    }
  }, WINDOWS_DESKTOP_LAYER_REFRESH_MS);
  initTimeoutId.unref?.();

  // Don't make window click-through initially to allow dragging
  // The renderer process will handle mouse events dynamically

  // Update initial state
  updateTaskWidgetContent();

  updateTaskWidgetOpacity(currentOpacity, currentContentOpacity);
  updateTaskWidgetBackground(
    currentBackgroundImage,
    currentBackgroundImageOpacity,
    currentBackgroundPositionX,
    currentBackgroundPositionY,
  );

  if (pendingShowAfterCreate) {
    const showInactive = pendingShowAfterCreateInactive;
    pendingShowAfterCreate = false;
    pendingShowAfterCreateInactive = false;
    showTaskWidgetWindow({ inactive: showInactive });
  }
};

const showTaskWidgetWindow = (options: ShowTaskWidgetOptions = {}): void => {
  if (!taskWidgetWin || taskWidgetWin.isDestroyed()) {
    return;
  }

  if (taskWidgetWin.isMinimized()) {
    taskWidgetWin.restore();
  }

  if (options.inactive) {
    taskWidgetWin.showInactive();
  } else {
    taskWidgetWin.show();
  }
  void maintainTaskWidgetDesktopLayer();
};

export const showTaskWidget = (options: ShowTaskWidgetOptions = {}): void => {
  if (!isTaskWidgetEnabled) {
    return;
  }

  if (isUserHidden) {
    return;
  }

  // Recreate task widget if it was accidentally closed
  if (!taskWidgetWin) {
    info('Task widget window was destroyed, recreating');
    pendingShowAfterCreate = true;
    pendingShowAfterCreateInactive = pendingShowAfterCreateInactive || !!options.inactive;
    createTaskWidgetWindow();
    return;
  }

  if (taskWidgetWin.isDestroyed()) {
    return;
  }

  if (taskWidgetWin.isMinimized()) {
    showTaskWidgetWindow({ inactive: true });
  } else if (!taskWidgetWin.isVisible()) {
    info('Showing task widget');
    showTaskWidgetWindow(options);
  } else {
    info('Task widget already visible');
  }
};

export const hideTaskWidget = (): void => {
  if (!taskWidgetWin || !isTaskWidgetEnabled) {
    info(
      'Task widget hide skipped: window=' +
        !!taskWidgetWin +
        ', enabled=' +
        isTaskWidgetEnabled,
    );
    return;
  }

  // Only hide if currently visible
  if (taskWidgetWin.isVisible()) {
    info('Hiding task widget');
    taskWidgetWin.hide();
  } else {
    info('Task widget already hidden');
  }
};

/**
 * Toggles the task widget's visibility. Intended for the global shortcut
 * (`globalToggleTaskWidget`): it only acts when the task widget feature is
 * enabled in settings and never changes that persisted enabled/disabled
 * preference; it just shows or hides the existing widget.
 */
export const toggleTaskWidgetVisibility = (): void => {
  if (!isTaskWidgetEnabled) {
    return;
  }

  if (taskWidgetWin && !taskWidgetWin.isDestroyed() && taskWidgetWin.isVisible()) {
    isUserForcedVisible = false;
    isUserHidden = true;
    hideTaskWidget();
    return;
  }

  isUserForcedVisible = true;
  isUserHidden = false;
  showTaskWidget({ inactive: true });
};

const initListeners = (): void => {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  const showMainWindowFromWidget = (): void => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      // Mirror showOrFocus() logic: restore() before show() to handle the case where
      // the window is minimized+hidden (e.g. minimize-to-tray on Linux where
      // event.preventDefault() on 'minimize' has no effect).
      mainWindow.restore();
      mainWindow.show();
      mainWindow.maximize();
      isUserForcedVisible = false;
      if (!isAlwaysShow) {
        hideTaskWidget();
      }
      setTimeout(() => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.focus();
          if (!mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.focus();
          }
        }
      }, 60);
    }
  };

  ipcMain.on(TASK_WIDGET_SHOW_MAIN_WINDOW, () => {
    showMainWindowFromWidget();
  });

  ipcMain.on(
    TASK_WIDGET_COMPLETE_TASK,
    (_ev, taskId: string, requestedIsDone?: boolean) => {
      if (typeof taskId !== 'string' || !taskId) {
        return;
      }
      const isDone = requestedIsDone !== false;
      getMainWindow()?.webContents.send(IPC.TASK_WIDGET_COMPLETE_TASK, taskId, isDone);
    },
  );

  ipcMain.on(TASK_WIDGET_SWITCH_TASK, (_ev, taskId: string) => {
    if (typeof taskId !== 'string' || !taskId) {
      return;
    }
    getMainWindow()?.webContents.send(IPC.SWITCH_TASK, taskId);
  });

  ipcMain.on(TASK_WIDGET_EXTEND_TASK, (_ev, taskId: string, additionalTime: number) => {
    if (
      typeof taskId !== 'string' ||
      !taskId ||
      !Number.isFinite(additionalTime) ||
      additionalTime < 60_000 ||
      additionalTime > 24 * 60 * 60 * 1000
    ) {
      return;
    }
    getMainWindow()?.webContents.send(
      IPC.TASK_WIDGET_EXTEND_TASK,
      taskId,
      additionalTime,
    );
  });

  ipcMain.on(TASK_WIDGET_HIDE, () => {
    isUserForcedVisible = false;
    isUserHidden = true;
    getMainWindow()?.webContents.send(IPC.TASK_WIDGET_SET_ENABLED, false);
    hideTaskWidget();
  });
};

export const updateTaskWidgetTask = (
  task: TaskCopy | null,
  pomodoroEnabled: boolean,
  pomodoroTime: number,
  focusModeEnabled: boolean,
  focusTime: number,
): void => {
  currentTask = task;
  isPomodoroEnabled = pomodoroEnabled;
  currentPomodoroSessionTime = pomodoroTime;
  isFocusModeEnabled = focusModeEnabled;
  currentFocusSessionTime = focusTime;

  updateTaskWidgetContent();
};

let lastCountdownExpiredKey: string | null = null;

export const updateTaskWidgetTaskLists = (lists: TaskWidgetTaskLists): void => {
  const isTranslationKey = (value: string): boolean =>
    /^[A-Z0-9_]+(?:\.[A-Z0-9_]+)+$/.test(value);
  const keepValidTranslation = (value: unknown, fallback: string): string =>
    typeof value === 'string' && value && !isTranslationKey(value) ? value : fallback;

  currentTaskLists = {
    labels: {
      activeTask: keepValidTranslation(
        lists.labels?.activeTask,
        currentTaskLists.labels.activeTask,
      ),
      noActiveTask: keepValidTranslation(
        lists.labels?.noActiveTask,
        currentTaskLists.labels.noActiveTask,
      ),
      noTasks: keepValidTranslation(
        lists.labels?.noTasks,
        currentTaskLists.labels.noTasks,
      ),
    },
    panels: Array.isArray(lists.panels)
      ? lists.panels.map((panel) => ({
          id: typeof panel.id === 'string' ? panel.id : '',
          title: keepValidTranslation(
            panel.title,
            currentTaskLists.panels.find(({ id }) => id === panel.id)?.title ?? '',
          ),
          tasks: Array.isArray(panel.tasks) ? panel.tasks : [],
        }))
      : [],
  };

  updateTaskWidgetContent();
};

const updateTaskWidgetContent = (): void => {
  if (!taskWidgetWin || !isTaskWidgetEnabled) {
    return;
  }

  let title = '';
  let timeStr = '';
  let mode: 'pomodoro' | 'focus' | 'task' | 'idle' = 'idle';

  if (!currentTask) {
    lastCountdownExpiredKey = null;
  }

  if (currentTask && currentTask.title) {
    title = currentTask.title;
    if (title.length > 40) {
      title = title.substring(0, 37) + '...';
    }

    if (isPomodoroEnabled) {
      mode = 'pomodoro';
      timeStr = formatTime(currentPomodoroSessionTime);
    } else if (isFocusModeEnabled) {
      mode = 'focus';
      timeStr = formatTime(currentFocusSessionTime);
    } else if (currentTask.timeEstimate) {
      mode = 'task';
      const remainingTime = Math.max(currentTask.timeEstimate - currentTask.timeSpent, 0);
      timeStr = formatTime(remainingTime);
      if (remainingTime === 0 && isTaskWidgetDocumentReady) {
        const expiryKey = `${currentTask.id}:${currentTask.timeEstimate}`;
        if (lastCountdownExpiredKey !== expiryKey) {
          lastCountdownExpiredKey = expiryKey;
          taskWidgetWin.webContents.send('countdown-expired', {
            taskId: currentTask.id,
            title: currentTask.title,
          });
        }
      } else {
        lastCountdownExpiredKey = null;
      }
    } else if (currentTask.timeSpent) {
      mode = 'task';
      timeStr = formatTime(currentTask.timeSpent);
    }
  }

  taskWidgetWin.webContents.send('update-content', {
    title,
    time: timeStr,
    mode,
    labels: currentTaskLists.labels,
    panels: currentTaskLists.panels,
  });
};

export const updateTaskWidgetAlwaysShow = (alwaysShow: boolean): void => {
  isAlwaysShow = alwaysShow;
  if (alwaysShow && isTaskWidgetEnabled) {
    isUserHidden = false;
    showTaskWidget({ inactive: true });
  } else if (isTaskWidgetEnabled) {
    syncTaskWidgetVisibilityWithMainWindow(!!getMainWindow()?.isVisible());
  }
};

export const syncTaskWidgetVisibilityWithMainWindow = (
  isMainWindowVisible: boolean,
): void => {
  if (!isTaskWidgetEnabled || isUserHidden) {
    return;
  }
  if (isMainWindowVisible && !isAlwaysShow && !isUserForcedVisible) {
    hideTaskWidget();
    return;
  }
  showTaskWidget({ inactive: true });
};

export const getIsTaskWidgetAlwaysShow = (): boolean => isAlwaysShow;

export const getIsTaskWidgetUserForcedVisible = (): boolean => isUserForcedVisible;

export const updateTaskWidgetOpacity = (
  opacity: number,
  contentOpacity: number = currentContentOpacity,
): void => {
  currentOpacity = opacity;
  currentContentOpacity = contentOpacity;
  if (!taskWidgetWin || taskWidgetWin.isDestroyed()) {
    return;
  }
  taskWidgetWin.webContents.send('update-opacity', {
    backgroundOpacity: Math.max(0.1, Math.min(1, opacity / 100)),
    contentOpacity: Math.max(0.1, Math.min(1, contentOpacity / 100)),
  });
};

const resolveTaskWidgetBackground = async (
  backgroundImage: string | null,
): Promise<string | null> => {
  if (!backgroundImage) {
    return null;
  }
  if (backgroundImage.startsWith(IMAGE_CACHE_PREFIX)) {
    const id = backgroundImage.substring(IMAGE_CACHE_PREFIX.length);
    return id ? getImageDataUrl(id) : null;
  }
  return backgroundImage;
};

export const updateTaskWidgetBackground = (
  backgroundImage: string | null | undefined,
  backgroundImageOpacity: number | null | undefined,
  backgroundPositionX: number | null | undefined = 50,
  backgroundPositionY: number | null | undefined = 50,
): void => {
  currentBackgroundImage = normalizeBackgroundImage(backgroundImage);
  currentBackgroundImageOpacity = normalizeBackgroundImageOpacity(
    backgroundImageOpacity,
    45,
  );
  currentBackgroundPositionX = normalizeBackgroundPosition(backgroundPositionX);
  currentBackgroundPositionY = normalizeBackgroundPosition(backgroundPositionY);

  applyEffectiveTaskWidgetBackground();
};

export const updateTaskWidgetGlobalBackground = (
  backgroundImage: string | null | undefined,
  backgroundImageOpacity: number | null | undefined,
  backgroundPositionX: number | null | undefined = 50,
  backgroundPositionY: number | null | undefined = 50,
): void => {
  currentGlobalBackgroundImage = normalizeBackgroundImage(backgroundImage);
  currentGlobalBackgroundImageOpacity = normalizeBackgroundImageOpacity(
    backgroundImageOpacity,
    20,
  );
  currentGlobalBackgroundPositionX = normalizeBackgroundPosition(backgroundPositionX);
  currentGlobalBackgroundPositionY = normalizeBackgroundPosition(backgroundPositionY);

  applyEffectiveTaskWidgetBackground();
};

const applyEffectiveTaskWidgetBackground = (): void => {
  if (!taskWidgetWin || taskWidgetWin.isDestroyed()) {
    return;
  }

  const generation = ++backgroundResolveGeneration;
  const { image, mode, positionX, positionY } = getEffectiveTaskWidgetBackground();
  void resolveTaskWidgetBackground(image).then((resolvedImage) => {
    if (
      generation !== backgroundResolveGeneration ||
      !taskWidgetWin ||
      taskWidgetWin.isDestroyed()
    ) {
      return;
    }
    taskWidgetWin.webContents.send('update-background', {
      image: resolvedImage,
      imageOpacity: Math.max(0.1, Math.min(1, currentOpacity / 100)),
      mode: resolvedImage ? mode : 'theme',
      positionX,
      positionY,
    });
  });
};

// Apply the per-instance task widget settings sent by the renderer.
const applyTaskWidgetSettings = (cfg: TaskWidgetConfig | undefined): void => {
  const isEnabled = !!cfg?.isEnabled;
  if (!isEnabled) {
    updateTaskWidgetAlwaysShow(false);
    updateTaskWidgetEnabled(false);
    return;
  }

  updateTaskWidgetAlwaysShow(!!cfg?.isAlwaysShow);
  updateTaskWidgetEnabled(isEnabled);
  updateTaskWidgetOpacity(cfg?.opacity ?? 95, cfg?.contentOpacity ?? 100);
  updateTaskWidgetBackground(
    cfg?.backgroundImage ?? null,
    cfg?.backgroundImageOpacity,
    cfg?.backgroundPositionX,
    cfg?.backgroundPositionY,
  );
};

let taskWidgetSettingsListenerRegistered = false;
export const initTaskWidgetSettingsListener = (): void => {
  if (taskWidgetSettingsListenerRegistered) return;
  taskWidgetSettingsListenerRegistered = true;
  ipcMain.on(IPC.UPDATE_TASK_WIDGET_SETTINGS, (_ev, cfg: TaskWidgetConfig) => {
    applyTaskWidgetSettings(cfg);
  });
};

const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
