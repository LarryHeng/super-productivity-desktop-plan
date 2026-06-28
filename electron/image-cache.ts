import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { assertPathOutside } from './file-path-guard';
import { loadSimpleStoreAll, saveSimpleStore } from './simple-store';
import { SimpleStoreKey } from './shared-with-frontend/simple-store.const';

/**
 * Main-owned cache for user-picked images (e.g. background images).
 *
 * Background (issue #8228): the legacy flow was
 *   pick → renderer holds an absolute path / file:// URL → renderer asks
 *   main to inline that path as a data URL on every render.
 * That gave any compromised renderer the ability to ask main to read any
 * image-extension file outside userData, indefinitely. The path was the
 * authorization token, and the path could be swapped after the pick.
 *
 * After this module: the renderer picks a file via `dialog.showOpenDialog`
 * (proven user intent), main copies the file into a private cache directory
 * and hands back an opaque `id`. The renderer stores that id in user config
 * and asks main for the data URL by id. No path ever leaves main. Subsequent
 * app launches can resolve the id without re-asking the user. The cache
 * follows an externally linked `backups` folder when one is configured;
 * otherwise it remains under userData.
 *
 * Source-path validation is layered defense-in-depth:
 *   - source must live outside userData (no laundering the grant file)
 *   - extension must be in the allow-list (binary blobs masquerading as png
 *     won't decode in the renderer anyway, but reject early)
 *   - size must be under MAX_IMAGE_BYTES (avoid memory pressure when
 *     copying / base64-encoding)
 *   - the id is `randomBytes(16)` (128 bits) — unguessable, so a renderer
 *     cannot iterate the cache directory looking for files it didn't import.
 */

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// SVG is deliberately excluded: it is a scriptable format (can embed
// <script>/event handlers) and inlining it as a data URL would reintroduce an
// XSS surface, so the cache only accepts raster formats.
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
};

const ID_RE = /^[a-f0-9]{32}$/;

const isSamePath = (a: string, b: string): boolean => {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
};

const getCacheDir = async (): Promise<string> => {
  if (process.env.SP_IMAGE_CACHE_DIR) {
    return process.env.SP_IMAGE_CACHE_DIR;
  }

  const simpleStore = await loadSimpleStoreAll();
  const configuredDir = simpleStore[SimpleStoreKey.IMAGE_CACHE_DIR];
  if (typeof configuredDir === 'string' && path.isAbsolute(configuredDir)) {
    return configuredDir;
  }
  const backupTarget = simpleStore[SimpleStoreKey.BACKUP_LINK_TARGET];
  if (
    typeof backupTarget === 'string' &&
    path.isAbsolute(backupTarget) &&
    path.basename(backupTarget).toLowerCase() === 'backups'
  ) {
    return path.join(path.dirname(backupTarget), 'bg-images');
  }

  const userDataDir = app.getPath('userData');
  const backupLink = path.join(userDataDir, 'backups');
  try {
    const resolvedBackupDir = await fs.realpath(backupLink);
    if (
      !isSamePath(resolvedBackupDir, backupLink) &&
      path.basename(resolvedBackupDir).toLowerCase() === 'backups'
    ) {
      return path.join(path.dirname(resolvedBackupDir), 'bg-images');
    }
  } catch {
    // No linked backups directory. Keep the small cache under userData.
  }

  return path.join(userDataDir, 'bg-images');
};

const ensureCacheDir = async (): Promise<string> => {
  const dir = await getCacheDir();
  await fs.mkdir(dir, { recursive: true });
  await migrateLegacyCache(dir);
  return dir;
};

export interface ImageCachePathInfo {
  readonly effectiveDir: string;
  readonly configuredDir: string | null;
}

export const getImageCachePathInfo = async (): Promise<ImageCachePathInfo> => {
  const all = await loadSimpleStoreAll();
  const configured = all[SimpleStoreKey.IMAGE_CACHE_DIR];
  const effectiveDir = await ensureCacheDir();
  return {
    effectiveDir,
    configuredDir:
      typeof configured === 'string' && path.isAbsolute(configured) ? configured : null,
  };
};

const isManagedImageFileName = (name: string): boolean =>
  ID_RE.test(path.parse(name).name) && !!MIME_BY_EXT[getExt(name)];

const copyManagedImages = async (
  sourceDir: string,
  targetDir: string,
): Promise<string[]> => {
  if (isSamePath(sourceDir, targetDir)) {
    return [];
  }
  let names: string[];
  try {
    names = await fs.readdir(sourceDir);
  } catch {
    return [];
  }

  const copied: string[] = [];
  for (const name of names) {
    if (!isManagedImageFileName(name)) continue;
    const source = path.join(sourceDir, name);
    const target = path.join(targetDir, name);
    try {
      try {
        await fs.access(target);
      } catch {
        await fs.copyFile(source, target);
        copied.push(name);
      }
    } catch {
      for (const copiedName of copied) {
        try {
          await fs.unlink(path.join(targetDir, copiedName));
        } catch {
          // Best-effort rollback; the configured path is not changed below.
        }
      }
      throw new Error('Background image cache migration failed');
    }
  }
  return names.filter(isManagedImageFileName);
};

/**
 * Move the managed background library to a user-selected folder.
 *
 * Existing cache files are copied before the setting changes. The original
 * files selected by the user are never touched; only app-managed copies in
 * the previous cache are cleaned up after the new location is durable.
 */
export const setImageCacheDirectory = async (
  selectedPath: string,
): Promise<ImageCachePathInfo> => {
  if (typeof selectedPath !== 'string' || !path.isAbsolute(selectedPath)) {
    throw new Error('Background image cache path must be absolute');
  }

  await fs.mkdir(selectedPath, { recursive: true });
  const targetDir = await fs.realpath(selectedPath);
  const sourceDir = await ensureCacheDir();
  const migratedNames = await copyManagedImages(sourceDir, targetDir);

  await saveSimpleStore(SimpleStoreKey.IMAGE_CACHE_DIR, targetDir);

  if (!isSamePath(sourceDir, targetDir)) {
    for (const name of migratedNames) {
      try {
        await fs.unlink(path.join(sourceDir, name));
      } catch {
        // The new copy is already durable; a stale old copy is harmless.
      }
    }
  }

  return {
    effectiveDir: targetDir,
    configuredDir: targetDir,
  };
};

const migrateLegacyCache = async (targetDir: string): Promise<void> => {
  const legacyDir = path.join(app.getPath('userData'), 'bg-images');
  if (isSamePath(legacyDir, targetDir)) {
    return;
  }

  let names: string[];
  try {
    names = await fs.readdir(legacyDir);
  } catch {
    return;
  }

  for (const name of names) {
    if (!isManagedImageFileName(name)) {
      continue;
    }
    const source = path.join(legacyDir, name);
    const target = path.join(targetDir, name);
    try {
      try {
        await fs.access(target);
      } catch {
        await fs.copyFile(source, target);
      }
      await fs.unlink(source);
    } catch {
      // Keep the legacy copy when migration is interrupted or the target is read-only.
    }
  }
};

const getExt = (p: string): string => {
  // Use path.extname so Windows backslash separators are handled too —
  // the renderer-supplied path may originate from a Windows-style picker.
  const ext = path.extname(p).toLowerCase();
  return ext.startsWith('.') ? ext.substring(1) : ext;
};

export interface ImportedImage {
  readonly id: string;
  readonly mimeType: string;
}

/**
 * Copy the source image into the cache and return an opaque id. Returns
 * null on any rejection (unsupported extension, too large, inside userData,
 * read error). The caller — typically the renderer-facing IPC — must not
 * surface the rejection reason as a path-bearing error.
 */
export const importImage = async (
  absoluteSourcePath: string,
): Promise<ImportedImage | null> => {
  if (typeof absoluteSourcePath !== 'string' || absoluteSourcePath.length === 0) {
    return null;
  }

  // The renderer-supplied path was just returned from SHOW_OPEN_DIALOG (proven
  // user intent), but we still validate — a compromised renderer could call
  // this IPC with any path, not just the dialog result.
  try {
    assertPathOutside(app.getPath('userData'), absoluteSourcePath);
  } catch {
    return null;
  }

  const ext = getExt(absoluteSourcePath);
  const mimeType = MIME_BY_EXT[ext];
  if (!mimeType) {
    return null;
  }

  let stat;
  try {
    stat = await fs.stat(absoluteSourcePath);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  if (stat.size > MAX_IMAGE_BYTES) return null;
  if (stat.size === 0) return null;

  const dir = await ensureCacheDir();
  const id = randomBytes(16).toString('hex');
  const target = path.join(dir, `${id}.${ext}`);

  try {
    await fs.copyFile(absoluteSourcePath, target);
  } catch {
    // Best-effort cleanup if a partial copy landed.
    try {
      await fs.unlink(target);
    } catch {
      // ignore
    }
    return null;
  }
  return { id, mimeType };
};

interface CachedImageFile {
  readonly absolutePath: string;
  readonly mimeType: string;
}

const findCachedFile = async (id: string): Promise<CachedImageFile | null> => {
  if (!ID_RE.test(id)) return null;
  const dir = await ensureCacheDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return null;
  }
  for (const name of entries) {
    if (!name.startsWith(`${id}.`)) continue;
    const ext = getExt(name);
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) continue;
    return { absolutePath: path.join(dir, name), mimeType };
  }
  return null;
};

/**
 * Return a `data:<mime>;base64,…` URL for the cached image. Returns null
 * when the id is unknown, malformed, or the file disappeared between
 * import and read.
 */
export const getImageDataUrl = async (id: string): Promise<string | null> => {
  const found = await findCachedFile(id);
  if (!found) return null;
  let stat;
  try {
    stat = await fs.stat(found.absolutePath);
  } catch {
    return null;
  }
  // Defence-in-depth: a file already in the cache should not be larger than
  // the import limit, but the import limit may change between releases. Be
  // paranoid about a too-large read either way.
  if (stat.size > MAX_IMAGE_BYTES) return null;
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(found.absolutePath);
  } catch {
    return null;
  }
  return `data:${found.mimeType};base64,${buffer.toString('base64')}`;
};

/** Return the managed cache path for display in settings. */
export const getImageDisplayPath = async (id: string): Promise<string | null> => {
  const found = await findCachedFile(id);
  return found?.absolutePath ?? null;
};

/** Remove a cached image by id. No-op when the id is unknown. */
export const removeCachedImage = async (id: string): Promise<void> => {
  const found = await findCachedFile(id);
  if (!found) return;
  try {
    await fs.unlink(found.absolutePath);
  } catch {
    // ignore
  }
};
