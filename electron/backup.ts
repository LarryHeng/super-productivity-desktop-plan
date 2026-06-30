import { app, dialog, ipcMain, IpcMainEvent } from 'electron';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { createHash } from 'crypto';
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
import { backupManagedImagesForData, restoreManagedImagesForData } from './image-cache';

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

const ensureDefaultBackupDirectory = (): void => {
  if (existsSync(BACKUP_DIR)) {
    return;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
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

const getFileSha256 = (filePath: string): string =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');

const verifyCopiedEntry = (sourcePath: string, targetPath: string): void => {
  const sourceStat = lstatSync(sourcePath);
  const targetStat = lstatSync(targetPath);

  if (sourceStat.isSymbolicLink() || targetStat.isSymbolicLink()) {
    throw new Error('Backup migration does not accept nested symbolic links');
  }

  if (sourceStat.isDirectory()) {
    if (!targetStat.isDirectory()) {
      throw new Error('Backup migration target type differs from source');
    }
    for (const entryName of readdirSync(sourcePath)) {
      verifyCopiedEntry(
        path.join(sourcePath, entryName),
        path.join(targetPath, entryName),
      );
    }
    return;
  }

  if (!sourceStat.isFile() || !targetStat.isFile()) {
    throw new Error('Backup migration only accepts files and directories');
  }
  if (sourceStat.size !== targetStat.size) {
    throw new Error('Backup migration copied file length differs');
  }
  if (getFileSha256(sourcePath) !== getFileSha256(targetPath)) {
    throw new Error('Backup migration copied file hash differs');
  }
};

const preserveCopiedEntryTimestamps = (sourcePath: string, targetPath: string): void => {
  const sourceStat = lstatSync(sourcePath);
  if (sourceStat.isDirectory()) {
    for (const entryName of readdirSync(sourcePath)) {
      preserveCopiedEntryTimestamps(
        path.join(sourcePath, entryName),
        path.join(targetPath, entryName),
      );
    }
  }
  utimesSync(targetPath, sourceStat.atime, sourceStat.mtime);
};

const getAvailableCopyTarget = (targetDir: string, entryName: string): string => {
  const preferredTarget = path.join(targetDir, entryName);
  if (!existsSync(preferredTarget)) {
    return preferredTarget;
  }

  const parsed = path.parse(entryName);
  const migratedName = `${parsed.name}.migrated-${Date.now()}`;
  let attempt = 0;
  let candidate: string;
  do {
    const suffix = attempt === 0 ? '' : `-${attempt}`;
    candidate = path.join(targetDir, `${migratedName}${suffix}${parsed.ext}`);
    attempt++;
  } while (existsSync(candidate));
  return candidate;
};

interface EntryTimestamps {
  path: string;
  atime: Date;
  mtime: Date;
}

const copyNewEntry = (
  sourcePath: string,
  targetPath: string,
  copiedTargets: string[],
): void => {
  copiedTargets.push(targetPath);
  cpSync(sourcePath, targetPath, {
    recursive: true,
    force: false,
    preserveTimestamps: true,
  });
  verifyCopiedEntry(sourcePath, targetPath);
  preserveCopiedEntryTimestamps(sourcePath, targetPath);
};

const mergeDirectoryContents = (
  sourceDir: string,
  targetDir: string,
  copiedTargets: string[],
  targetDirectoryTimestamps: EntryTimestamps[],
): void => {
  const sourceStat = lstatSync(sourceDir);
  const targetStat = lstatSync(targetDir);
  if (
    sourceStat.isSymbolicLink() ||
    targetStat.isSymbolicLink() ||
    !sourceStat.isDirectory() ||
    !targetStat.isDirectory()
  ) {
    throw new Error('Backup migration can only merge regular directories');
  }

  targetDirectoryTimestamps.push({
    path: targetDir,
    atime: targetStat.atime,
    mtime: targetStat.mtime,
  });
  for (const entryName of readdirSync(sourceDir)) {
    const sourcePath = path.join(sourceDir, entryName);
    const targetPath = path.join(targetDir, entryName);
    if (!existsSync(targetPath)) {
      copyNewEntry(sourcePath, targetPath, copiedTargets);
      continue;
    }

    const sourceEntryStat = lstatSync(sourcePath);
    const targetEntryStat = lstatSync(targetPath);
    if (sourceEntryStat.isDirectory() && targetEntryStat.isDirectory()) {
      mergeDirectoryContents(
        sourcePath,
        targetPath,
        copiedTargets,
        targetDirectoryTimestamps,
      );
      continue;
    }
    verifyCopiedEntry(sourcePath, targetPath);
  }
};

const restoreDirectoryTimestamps = (timestamps: EntryTimestamps[]): void => {
  for (const entry of [...timestamps].reverse()) {
    utimesSync(entry.path, entry.atime, entry.mtime);
  }
};

const copyEntriesToTarget = (sourceDir: string, targetDir: string): void => {
  mkdirSync(targetDir, { recursive: true });
  const copiedTargets: string[] = [];
  const targetDirectoryTimestamps: EntryTimestamps[] = [];
  try {
    for (const entryName of readdirSync(sourceDir)) {
      const sourcePath = path.join(sourceDir, entryName);
      if (entryName === '.assets' && existsSync(path.join(targetDir, entryName))) {
        mergeDirectoryContents(
          sourcePath,
          path.join(targetDir, entryName),
          copiedTargets,
          targetDirectoryTimestamps,
        );
        continue;
      }
      const targetPath = getAvailableCopyTarget(targetDir, entryName);
      copyNewEntry(sourcePath, targetPath, copiedTargets);
    }
    restoreDirectoryTimestamps(targetDirectoryTimestamps);
  } catch (e) {
    for (const copiedTarget of copiedTargets.reverse()) {
      rmSync(copiedTarget, { recursive: true, force: true });
    }
    restoreDirectoryTimestamps(targetDirectoryTimestamps);
    throw e;
  }
};

const replaceExistingBackupDirWithLink = (
  backupDir: string,
  sourceDir: string,
  targetDir: string,
): void => {
  const isExistingLink = lstatSync(backupDir).isSymbolicLink();
  const rollbackDir = `${backupDir}.before-link-${process.pid}-${Date.now()}`;

  if (isExistingLink) {
    rmSync(backupDir, { recursive: true, force: true });
  } else {
    renameSync(backupDir, rollbackDir);
  }

  try {
    symlinkSync(targetDir, backupDir, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (e) {
    if (existsSync(backupDir)) {
      rmSync(backupDir, { recursive: true, force: true });
    }
    if (isExistingLink) {
      symlinkSync(
        sourceDir,
        backupDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } else {
      renameSync(rollbackDir, backupDir);
    }
    throw e;
  }

  if (!isExistingLink) {
    rmSync(rollbackDir, { recursive: true, force: true });
  }
};

const replaceBackupDirWithLink = (targetDir: string): void => {
  const backupDir = BACKUP_DIR;
  const parentDir = path.dirname(backupDir);
  mkdirSync(parentDir, { recursive: true });

  if (existsSync(backupDir)) {
    const sourceDir = safeRealpath(backupDir);
    if (
      statSync(sourceDir).isDirectory() &&
      normalizeForCompare(sourceDir) !== normalizeForCompare(targetDir)
    ) {
      copyEntriesToTarget(sourceDir, targetDir);
    }
    replaceExistingBackupDirWithLink(backupDir, sourceDir, targetDir);
    return;
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
    assertPathOutside(targetDir, app.getPath('userData'));
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
  ensureDefaultBackupDirectory();
  console.log('Saving backups to', BACKUP_DIR);
  log('Saving backups to', BACKUP_DIR);

  // BACKUP
  ipcMain.handle(IPC.BACKUP, backupData);

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

    const files = readdirSync(BACKUP_DIR).filter((fileName) => {
      if (!fileName.endsWith('.json')) {
        return false;
      }
      return statSync(path.join(BACKUP_DIR, fileName)).isFile();
    });
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
  ipcMain.handle(
    IPC.BACKUP_LOAD_DATA,
    async (ev, backupPath: string): Promise<string> => {
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
      const backup = readFileSync(resolved, { encoding: 'utf8' });
      try {
        const data = JSON.parse(backup) as unknown;
        await restoreManagedImagesForData(data, path.join(BACKUP_DIR, '.assets'));
      } catch (e) {
        error('Failed to restore managed background images from backup:', e);
      }
      return backup;
    },
  );
}

interface BackupDataArgs {
  data: AppDataCompleteLegacy | AppDataComplete;
  maxBackupFiles?: number | null;
  isThrowOnError?: boolean;
}

const isBackupDataArgs = (arg: unknown): arg is BackupDataArgs =>
  !!arg &&
  typeof arg === 'object' &&
  'data' in arg &&
  typeof (arg as { data?: unknown }).data === 'object';

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
async function backupData(
  ev: IpcMainEvent,
  dataOrArgs: AppDataCompleteLegacy | BackupDataArgs,
): Promise<void> {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR);
  }
  const filePath = `${BACKUP_DIR}/${getBackupTimestamp()}.json`;
  const data = isBackupDataArgs(dataOrArgs) ? dataOrArgs.data : dataOrArgs;
  const maxBackupFiles = isBackupDataArgs(dataOrArgs)
    ? dataOrArgs.maxBackupFiles
    : DEFAULT_MAX_BACKUP_FILES;

  try {
    await backupManagedImagesForData(data, path.join(BACKUP_DIR, '.assets'));
    const backup = JSON.stringify(data);
    writeFileSync(filePath, backup);
    cleanupOldBackups(maxBackupFiles);
  } catch (e) {
    log('Error while backing up');
    error(e);
    if (isBackupDataArgs(dataOrArgs) && dataOrArgs.isThrowOnError) {
      throw e;
    }
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
