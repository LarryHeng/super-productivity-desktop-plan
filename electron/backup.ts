import { app, dialog, ipcMain, IpcMainEvent } from 'electron';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { IPC } from './shared-with-frontend/ipc-events.const';
import { LocalBackupMeta } from '../src/app/imex/local-backup/local-backup.model';
import * as path from 'path';
import { error, log } from 'electron-log/main';
import type { AppDataCompleteLegacy } from '../src/app/imex/sync/sync.model';
import type { AppDataComplete } from '../src/app/op-log/model/model-config';
import { getBackupTimestamp } from './shared-with-frontend/get-backup-timestamp';
import { assertPathOutside, isPathInsideDir } from './file-path-guard';
import {
  DEFAULT_MAX_BACKUP_FILES,
  selectBackupFilesToDelete,
} from './shared-with-frontend/backup-file-cleanup.util';
import { getWin } from './main-window';
import { saveSimpleStore } from './simple-store';
import { SimpleStoreKey } from './shared-with-frontend/simple-store.const';

export const BACKUP_DIR = path.join(app.getPath('userData'), `backups`);
export const BACKUP_DIR_WINSTORE = BACKUP_DIR.replace(
  'Roaming',
  `Local\\Packages\\53707johannesjo.SuperProductivity_ch45amy23cdv6\\LocalCache\\Roaming`,
);

export interface BackupPathInfo {
  backupDir: string;
  effectiveDir: string;
  linkTarget: string | null;
}

const normalizeForCompare = (p: string): string =>
  process.platform === 'win32' ? p.toLowerCase() : p;

const safeRealpath = (p: string): string => {
  try {
    return realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
};

export interface BackupPathSelectionError {
  error: string;
}

const createSafeBackupError = (): BackupPathSelectionError => ({
  error: 'Backup folder could not be changed.',
});

export const getBackupPathInfo = (): BackupPathInfo => {
  const backupDir = BACKUP_DIR;
  if (!existsSync(backupDir)) {
    return {
      backupDir,
      effectiveDir: backupDir,
      linkTarget: null,
    };
  }

  const effectiveDir = safeRealpath(backupDir);
  const linkTarget =
    lstatSync(backupDir).isSymbolicLink() &&
    normalizeForCompare(effectiveDir) !== normalizeForCompare(path.resolve(backupDir))
      ? effectiveDir
      : null;

  return {
    backupDir,
    effectiveDir: linkTarget ?? backupDir,
    linkTarget,
  };
};

const copyEntriesToTarget = (sourceDir: string, targetDir: string): void => {
  mkdirSync(targetDir, { recursive: true });
  for (const entryName of readdirSync(sourceDir)) {
    const sourcePath = path.join(sourceDir, entryName);
    let targetPath = path.join(targetDir, entryName);
    if (existsSync(targetPath)) {
      const parsed = path.parse(entryName);
      targetPath = path.join(
        targetDir,
        `${parsed.name}.migrated-${Date.now()}${parsed.ext}`,
      );
    }
    cpSync(sourcePath, targetPath, { recursive: true, force: false });
  }
};

const replaceBackupDirWithLink = (targetDir: string): void => {
  const backupDir = BACKUP_DIR;
  const parentDir = path.dirname(backupDir);
  mkdirSync(parentDir, { recursive: true });

  if (existsSync(backupDir)) {
    const stats = lstatSync(backupDir);
    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      copyEntriesToTarget(backupDir, targetDir);
    }
    rmSync(backupDir, { recursive: true, force: true });
  }

  symlinkSync(targetDir, backupDir, process.platform === 'win32' ? 'junction' : 'dir');
};

export const pickBackupLinkTarget = async (): Promise<
  BackupPathInfo | BackupPathSelectionError | undefined
> => {
  const win = getWin();
  const dialogOptions: Electron.OpenDialogOptions = {
    title: 'Select backup folder',
    defaultPath: getBackupPathInfo().effectiveDir,
    properties: ['openDirectory', 'createDirectory'],
  };
  const result = win
    ? await dialog.showOpenDialog(win, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || !result.filePaths.length) {
    return undefined;
  }

  try {
    const selectedPath = result.filePaths[0];
    mkdirSync(selectedPath, { recursive: true });
    const targetDir = realpathSync.native(selectedPath);

    assertPathOutside(app.getPath('userData'), targetDir);
    replaceBackupDirWithLink(targetDir);
    await saveSimpleStore(SimpleStoreKey.BACKUP_LINK_TARGET, targetDir);

    return getBackupPathInfo();
  } catch (e) {
    error(e);
    return createSafeBackupError();
  }
};

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function initBackupAdapter(): void {
  console.log('Saving backups to', BACKUP_DIR);
  log('Saving backups to', BACKUP_DIR);

  // BACKUP
  ipcMain.on(IPC.BACKUP, backupData);

  ipcMain.handle(IPC.GET_BACKUP_PATH_INFO, (): BackupPathInfo => getBackupPathInfo());
  ipcMain.handle(
    IPC.PICK_BACKUP_LINK_TARGET,
    (): Promise<BackupPathInfo | BackupPathSelectionError | undefined> =>
      pickBackupLinkTarget(),
  );

  // IS_BACKUP_AVAILABLE
  ipcMain.handle(IPC.BACKUP_IS_AVAILABLE, (): LocalBackupMeta | false => {
    if (!existsSync(BACKUP_DIR)) {
      return false;
    }

    const files = readdirSync(BACKUP_DIR);
    if (!files.length) {
      return false;
    }
    const filesWithMeta: LocalBackupMeta[] = files.map(
      (fileName: string): LocalBackupMeta => ({
        name: fileName,
        path: path.join(BACKUP_DIR, fileName),
        folder: BACKUP_DIR,
        created: statSync(path.join(BACKUP_DIR, fileName)).mtime.getTime(),
      }),
    );

    filesWithMeta.sort((a: LocalBackupMeta, b: LocalBackupMeta) => a.created - b.created);
    log(
      'Avilable Backup Files: ',
      filesWithMeta?.map && filesWithMeta.map((f) => f.path),
    );
    return filesWithMeta.reverse()[0];
  });

  // RESTORE_BACKUP
  ipcMain.handle(IPC.BACKUP_LOAD_DATA, (ev, backupPath: string): string => {
    // `backupPath` comes from the renderer, which runs untrusted plugin code,
    // so it must be constrained to the backup directory. Otherwise any plugin
    // (or XSS payload) could read arbitrary files via window.ea.loadBackupData.
    // See GHSA-x937-wf3j-88q3. Both the regular and the Windows-Store backup
    // dirs are accepted; the legitimate caller only ever passes paths built
    // from BACKUP_DIR (see IPC.BACKUP_IS_AVAILABLE above).
    if (
      !isPathInsideDir(BACKUP_DIR, backupPath) &&
      !isPathInsideDir(BACKUP_DIR_WINSTORE, backupPath)
    ) {
      throw new Error('BACKUP_LOAD_DATA: refused path outside backup directory');
    }
    const resolved = path.resolve(backupPath);
    log('Reading backup file: ', resolved);
    return readFileSync(resolved, { encoding: 'utf8' });
  });
}

interface BackupDataArgs {
  data: AppDataCompleteLegacy | AppDataComplete;
  maxBackupFiles?: number | null;
}

const isBackupDataArgs = (arg: unknown): arg is BackupDataArgs =>
  !!arg &&
  typeof arg === 'object' &&
  'data' in arg &&
  typeof (arg as { data?: unknown }).data === 'object';

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function backupData(
  ev: IpcMainEvent,
  dataOrArgs: AppDataCompleteLegacy | BackupDataArgs,
): void {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR);
  }
  const filePath = `${BACKUP_DIR}/${getBackupTimestamp()}.json`;
  const data = isBackupDataArgs(dataOrArgs) ? dataOrArgs.data : dataOrArgs;
  const maxBackupFiles = isBackupDataArgs(dataOrArgs)
    ? dataOrArgs.maxBackupFiles
    : DEFAULT_MAX_BACKUP_FILES;

  try {
    const backup = JSON.stringify(data);
    writeFileSync(filePath, backup);
    cleanupOldBackups(maxBackupFiles);
  } catch (e) {
    log('Error while backing up');
    error(e);
  }
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function cleanupOldBackups(maxBackupFiles?: number | null): void {
  if (!existsSync(BACKUP_DIR)) {
    return;
  }

  try {
    const files = readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));
    const filesWithMtime = files.map((fileName) => {
      const filePath = path.join(BACKUP_DIR, fileName);
      return { fileName, filePath, mtime: statSync(filePath).mtime.getTime() };
    });

    for (const file of selectBackupFilesToDelete(filesWithMtime, maxBackupFiles)) {
      try {
        unlinkSync(file.filePath);
      } catch (e) {
        log(`Error deleting backup file ${file.fileName}`);
        error(e);
      }
    }
  } catch (e) {
    log('Error during backup cleanup');
    error(e);
  }
}
