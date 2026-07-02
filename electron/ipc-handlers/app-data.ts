import { app, ipcMain } from 'electron';
import { IPC } from '../shared-with-frontend/ipc-events.const';
import { BACKUP_DIR, BACKUP_DIR_WINSTORE } from '../backup';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const initAppDataIpc = (): void => {
  ipcMain.handle(IPC.GET_PATH, (ev, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0]);
  });

  ipcMain.handle(IPC.GET_BACKUP_PATH, () => {
    if (process?.windowsStore) {
      return BACKUP_DIR_WINSTORE;
    } else {
      return BACKUP_DIR;
    }
  });

  ipcMain.handle(IPC.GET_PRODUCTIVITY_QUOTES, () => {
    try {
      const quotesPath = join(app.getPath('userData'), 'productivity-quotes.json');
      if (existsSync(quotesPath)) {
        const raw = readFileSync(quotesPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (item: unknown) =>
              Array.isArray(item) &&
              item.length === 2 &&
              typeof item[0] === 'string' &&
              typeof item[1] === 'string',
          )
        ) {
          return raw;
        }
      }
    } catch (_) {
      /* ignore — fall through to built-in */
    }
    return null;
  });
};
