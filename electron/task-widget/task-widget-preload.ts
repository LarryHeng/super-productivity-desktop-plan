import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('taskWidgetAPI', {
  showMainWindow: () => {
    ipcRenderer.send('task-widget-show-main-window');
  },
  completeTask: (taskId: string, isDone: boolean) => {
    ipcRenderer.send('task-widget-complete-task', taskId, isDone);
  },
  switchTask: (taskId: string) => {
    ipcRenderer.send('task-widget-switch-task', taskId);
  },
  hideWidget: () => {
    ipcRenderer.send('task-widget-hide');
  },
  extendTask: (taskId: string, additionalTime: number) => {
    ipcRenderer.send('task-widget-extend-task', taskId, additionalTime);
  },
  onUpdateContent: (callback: (data: any) => void) => {
    const listener = (event: Electron.IpcRendererEvent, data: any): void =>
      callback(data);
    ipcRenderer.on('update-content', listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('update-content', listener);
    };
  },
  onUpdateOpacity: (
    callback: (appearance: { backgroundOpacity: number; contentOpacity: number }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      appearance: { backgroundOpacity: number; contentOpacity: number },
    ): void => callback(appearance);
    ipcRenderer.on('update-opacity', listener);

    return () => {
      ipcRenderer.removeListener('update-opacity', listener);
    };
  },
  onCountdownExpired: (callback: (data: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: any): void =>
      callback(data);
    ipcRenderer.on('countdown-expired', listener);

    return () => {
      ipcRenderer.removeListener('countdown-expired', listener);
    };
  },
  onUpdateCountdown: (
    callback: (
      data: { name: string; days: number | null; styles: Record<string, string> } | null,
    ) => void,
  ) => {
    const listener = (_event: Electron.IpcRendererEvent, data: any): void =>
      callback(data);
    ipcRenderer.on('update-countdown', listener);

    return () => {
      ipcRenderer.removeListener('update-countdown', listener);
    };
  },
  onUpdateBackground: (callback: (data: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: any): void =>
      callback(data);
    ipcRenderer.on('update-background', listener);

    return () => {
      ipcRenderer.removeListener('update-background', listener);
    };
  },
});
