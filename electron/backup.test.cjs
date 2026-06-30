const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const Module = require('node:module');

require('ts-node/register/transpile-only');

const modPath = path.resolve(__dirname, 'backup.ts');
const simpleStorePath = path.resolve(__dirname, 'simple-store.ts');
const imageCachePath = path.resolve(__dirname, 'image-cache.ts');
const originalModuleLoad = Module._load;

let handlers = {};
let listeners = {};
let userDataDir;
let installDir;
let externalDir;
let nextDialogResult = { canceled: true, filePaths: [] };
let mutateCopiedTarget = null;
let isFailSymlinkCreation = false;

const installMocks = () => {
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'fs') {
      return {
        ...fs,
        cpSync: (source, target, options) => {
          fs.cpSync(source, target, options);
          mutateCopiedTarget?.(source, target);
        },
        symlinkSync: (...args) => {
          if (isFailSymlinkCreation) {
            throw new Error('simulated junction creation failure');
          }
          return fs.symlinkSync(...args);
        },
      };
    }
    if (request === 'electron') {
      return {
        ipcMain: {
          handle: (channel, fn) => (handlers[channel] = fn),
          on: (channel, fn) => (listeners[channel] = fn),
        },
        app: {
          isPackaged: true,
          getPath: (name) =>
            name === 'exe'
              ? path.join(installDir, 'Super Productivity.exe')
              : userDataDir,
        },
        dialog: {
          showOpenDialog: async () => nextDialogResult,
        },
      };
    }
    if (request === 'electron-log/main') {
      return { log: () => {}, error: () => {} };
    }
    if (request.endsWith('ipc-events.const')) {
      return {
        IPC: {
          BACKUP: 'BACKUP',
          BACKUP_IS_AVAILABLE: 'BACKUP_IS_AVAILABLE',
          BACKUP_LOAD_DATA: 'BACKUP_LOAD_DATA',
          GET_BACKUP_PATH_INFO: 'GET_BACKUP_PATH_INFO',
          PICK_BACKUP_LINK_TARGET: 'PICK_BACKUP_LINK_TARGET',
        },
      };
    }
    if (/[/\\]main-window$/.test(request)) {
      return { getWin: () => ({}) };
    }
    if (request === './image-cache') {
      return originalModuleLoad.call(this, imageCachePath, parent, isMain);
    }
    return originalModuleLoad.call(this, request, parent, isMain);
  };
};

const resetCaches = () => {
  delete require.cache[modPath];
  delete require.cache[simpleStorePath];
  delete require.cache[imageCachePath];
  handlers = {};
  listeners = {};
};

const load = () => {
  resetCaches();
  require(modPath).initBackupAdapter();
};

test.beforeEach(() => {
  userDataDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'sp-ud-')));
  installDir = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sp-install-')),
  );
  externalDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'sp-bak-')));
  mutateCopiedTarget = null;
  isFailSymlinkCreation = false;
  installMocks();
  load();
});

test.afterEach(() => {
  Module._load = originalModuleLoad;
  resetCaches();
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.rmSync(installDir, { recursive: true, force: true });
  fs.rmSync(externalDir, { recursive: true, force: true });
});

test('fresh installs store backups in the real userData directory', async () => {
  const result = await handlers['GET_BACKUP_PATH_INFO']({});
  const expected = path.join(userDataDir, 'backups');

  assert.equal(result.backupDir, expected);
  assert.equal(result.linkTarget, null);
  assert.equal(result.effectiveDir, expected);
  assert.equal(fs.realpathSync.native(result.backupDir), expected);
  assert.equal(
    fs.existsSync(path.join(installDir, 'backups')),
    false,
    'the installation directory is not used as a data directory',
  );
});

test('PICK_BACKUP_LINK_TARGET links the default backup dir to the selected folder', async () => {
  nextDialogResult = { canceled: false, filePaths: [externalDir] };

  const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

  assert.ok(!(result instanceof Error), 'the selection is accepted');
  assert.equal(result.backupDir, path.join(userDataDir, 'backups'));
  assert.equal(result.linkTarget, externalDir);
  assert.equal(result.effectiveDir, externalDir);
  assert.equal(
    fs.realpathSync.native(path.join(userDataDir, 'backups')),
    externalDir,
    'default backup folder resolves to the selected target',
  );

  await handlers['BACKUP']({}, { data: { ok: true }, maxBackupFiles: 20 });

  const files = fs
    .readdirSync(externalDir)
    .filter((fileName) => fileName.endsWith('.json'));
  assert.equal(files.length, 1);
  assert.equal(
    fs.readFileSync(path.join(externalDir, files[0]), 'utf8'),
    JSON.stringify({ ok: true }),
  );
});

test('GET_BACKUP_PATH_INFO detects an existing manual backup junction', async () => {
  const backupDir = path.join(userDataDir, 'backups');
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.symlinkSync(
    externalDir,
    backupDir,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  load();

  const result = await handlers['GET_BACKUP_PATH_INFO']({});

  assert.equal(result.backupDir, backupDir);
  assert.equal(result.linkTarget, externalDir);
  assert.equal(result.effectiveDir, externalDir);
});

test('PICK_BACKUP_LINK_TARGET migrates existing backup files before linking', async () => {
  const backupDir = path.join(userDataDir, 'backups');
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.mkdirSync(backupDir);
  fs.writeFileSync(path.join(backupDir, 'old.json'), '{"old":true}');
  nextDialogResult = { canceled: false, filePaths: [externalDir] };

  const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

  assert.ok(!(result instanceof Error), 'the selection is accepted');
  assert.equal(
    fs.readFileSync(path.join(externalDir, 'old.json'), 'utf8'),
    '{"old":true}',
  );
  assert.equal(fs.realpathSync.native(backupDir), externalDir);
});

test('PICK_BACKUP_LINK_TARGET merges assets from two non-empty repositories and preserves timestamps', async () => {
  const backupDir = path.join(userDataDir, 'backups');
  const sourceAssetsDir = path.join(backupDir, '.assets');
  const targetAssetsDir = path.join(externalDir, '.assets');
  const archiveDir = path.join(backupDir, 'archive');
  const sourceId = 'a'.repeat(32);
  const targetId = 'b'.repeat(32);
  const sourceBackupPath = path.join(backupDir, 'old.json');
  const sourceAssetPath = path.join(sourceAssetsDir, `${sourceId}.png`);
  const sourceArchivePath = path.join(archiveDir, 'nested.json');
  const sourceBackupTime = new Date('2020-01-02T03:04:05.000Z');
  const sourceAssetTime = new Date('2021-02-03T04:05:06.000Z');
  const sourceArchiveTime = new Date('2022-03-04T05:06:07.000Z');
  const sourceData = { background: `image:${sourceId}` };

  fs.mkdirSync(sourceAssetsDir);
  fs.mkdirSync(targetAssetsDir);
  fs.mkdirSync(archiveDir);
  fs.writeFileSync(sourceBackupPath, JSON.stringify(sourceData));
  fs.writeFileSync(sourceAssetPath, 'source-background');
  fs.writeFileSync(sourceArchivePath, '{"nested":true}');
  fs.writeFileSync(path.join(externalDir, 'current.json'), '{"current":true}');
  fs.writeFileSync(path.join(targetAssetsDir, `${targetId}.png`), 'target-background');
  fs.utimesSync(sourceBackupPath, sourceBackupTime, sourceBackupTime);
  fs.utimesSync(sourceAssetPath, sourceAssetTime, sourceAssetTime);
  fs.utimesSync(archiveDir, sourceArchiveTime, sourceArchiveTime);
  nextDialogResult = { canceled: false, filePaths: [externalDir] };

  const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

  assert.ok(!('error' in result));
  assert.equal(
    fs.readFileSync(path.join(externalDir, 'current.json'), 'utf8'),
    '{"current":true}',
  );
  assert.equal(
    fs.readFileSync(path.join(targetAssetsDir, `${targetId}.png`), 'utf8'),
    'target-background',
  );
  assert.equal(
    fs.readFileSync(path.join(targetAssetsDir, `${sourceId}.png`), 'utf8'),
    'source-background',
  );
  assert.equal(
    fs.readdirSync(externalDir).some((name) => name.startsWith('.assets.migrated-')),
    false,
  );
  assert.equal(
    fs.statSync(path.join(externalDir, 'old.json')).mtime.getTime(),
    sourceBackupTime.getTime(),
  );
  assert.equal(
    fs.statSync(path.join(targetAssetsDir, `${sourceId}.png`)).mtime.getTime(),
    sourceAssetTime.getTime(),
  );
  assert.equal(
    fs.statSync(path.join(externalDir, 'archive')).mtime.getTime(),
    sourceArchiveTime.getTime(),
  );

  await handlers['BACKUP_LOAD_DATA']({}, path.join(externalDir, 'old.json'));

  assert.equal(
    fs.readFileSync(path.join(userDataDir, 'bg-images', `${sourceId}.png`), 'utf8'),
    'source-background',
  );

  await handlers['BACKUP']({}, { data: { latest: true }, maxBackupFiles: 2 });

  assert.equal(
    fs.existsSync(path.join(externalDir, 'old.json')),
    false,
    'retention recognizes the migrated backup as the oldest file',
  );
  assert.equal(fs.existsSync(path.join(externalDir, 'current.json')), true);
});

test('PICK_BACKUP_LINK_TARGET rejects conflicting asset contents without overwriting either repository', async () => {
  const backupDir = path.join(userDataDir, 'backups');
  const sourceAssetsDir = path.join(backupDir, '.assets');
  const targetAssetsDir = path.join(externalDir, '.assets');
  const id = 'a'.repeat(32);
  fs.mkdirSync(sourceAssetsDir);
  fs.mkdirSync(targetAssetsDir);
  fs.writeFileSync(path.join(sourceAssetsDir, `${id}.png`), 'source-background');
  fs.writeFileSync(path.join(targetAssetsDir, `${id}.png`), 'target-background');
  nextDialogResult = { canceled: false, filePaths: [externalDir] };

  const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

  assert.deepEqual(result, {
    error: 'Backup folder could not be changed.',
  });
  assert.equal(fs.lstatSync(backupDir).isSymbolicLink(), false);
  assert.equal(
    fs.readFileSync(path.join(sourceAssetsDir, `${id}.png`), 'utf8'),
    'source-background',
  );
  assert.equal(
    fs.readFileSync(path.join(targetAssetsDir, `${id}.png`), 'utf8'),
    'target-background',
  );
});

test('PICK_BACKUP_LINK_TARGET keeps all pre-existing collision files', async () => {
  const backupDir = path.join(userDataDir, 'backups');
  const fixedNow = 1_750_000_000_000;
  const originalDateNow = Date.now;
  fs.writeFileSync(path.join(backupDir, 'old.json'), '{"source":true}');
  fs.writeFileSync(path.join(externalDir, 'old.json'), '{"existing":1}');
  fs.writeFileSync(
    path.join(externalDir, `old.migrated-${fixedNow}.json`),
    '{"existing":2}',
  );
  Date.now = () => fixedNow;
  nextDialogResult = { canceled: false, filePaths: [externalDir] };

  try {
    const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

    assert.ok(!('error' in result));
    assert.equal(
      fs.readFileSync(path.join(externalDir, 'old.json'), 'utf8'),
      '{"existing":1}',
    );
    assert.equal(
      fs.readFileSync(path.join(externalDir, `old.migrated-${fixedNow}.json`), 'utf8'),
      '{"existing":2}',
    );
    assert.equal(
      fs.readFileSync(path.join(externalDir, `old.migrated-${fixedNow}-1.json`), 'utf8'),
      '{"source":true}',
    );
  } finally {
    Date.now = originalDateNow;
  }
});

test('PICK_BACKUP_LINK_TARGET preserves the source when copy verification fails', async () => {
  const backupDir = path.join(userDataDir, 'backups');
  const sourceFile = path.join(backupDir, 'old.json');
  fs.writeFileSync(sourceFile, '{"old":true}');
  mutateCopiedTarget = (_source, target) => {
    fs.writeFileSync(target, '{"bad":true}');
  };
  load();
  nextDialogResult = { canceled: false, filePaths: [externalDir] };

  const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

  assert.deepEqual(result, {
    error: 'Backup folder could not be changed.',
  });
  assert.equal(fs.lstatSync(backupDir).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(sourceFile, 'utf8'), '{"old":true}');
  assert.equal(
    fs.existsSync(path.join(externalDir, 'old.json')),
    false,
    'a failed verified copy is rolled back from the selected directory',
  );
});

test('PICK_BACKUP_LINK_TARGET restores the source when junction creation fails', async () => {
  const backupDir = path.join(userDataDir, 'backups');
  const sourceFile = path.join(backupDir, 'old.json');
  fs.writeFileSync(sourceFile, '{"old":true}');
  isFailSymlinkCreation = true;
  load();
  nextDialogResult = { canceled: false, filePaths: [externalDir] };

  const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

  assert.deepEqual(result, {
    error: 'Backup folder could not be changed.',
  });
  assert.equal(fs.lstatSync(backupDir).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(sourceFile, 'utf8'), '{"old":true}');
});

test('PICK_BACKUP_LINK_TARGET migrates files from an existing linked target', async () => {
  const replacementDir = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sp-bak-replacement-')),
  );
  try {
    const backupDir = path.join(userDataDir, 'backups');
    fs.rmSync(backupDir, { recursive: true, force: true });
    fs.symlinkSync(
      externalDir,
      backupDir,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    fs.writeFileSync(path.join(externalDir, 'old.json'), '{"old":true}');
    load();
    nextDialogResult = { canceled: false, filePaths: [replacementDir] };

    const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

    assert.ok(!(result instanceof Error), 'the selection is accepted');
    assert.equal(
      fs.readFileSync(path.join(replacementDir, 'old.json'), 'utf8'),
      '{"old":true}',
    );
    assert.equal(
      fs.realpathSync.native(path.join(userDataDir, 'backups')),
      replacementDir,
    );
  } finally {
    fs.rmSync(replacementDir, { recursive: true, force: true });
  }
});

test('PICK_BACKUP_LINK_TARGET returns a serializable error result', async () => {
  nextDialogResult = {
    canceled: false,
    filePaths: [path.join(userDataDir, 'nested-backups')],
  };

  const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

  assert.deepEqual(result, {
    error: 'Backup folder could not be changed.',
  });
});

test('PICK_BACKUP_LINK_TARGET rejects an ancestor of userData', async () => {
  nextDialogResult = {
    canceled: false,
    filePaths: [path.dirname(userDataDir)],
  };

  const result = await handlers['PICK_BACKUP_LINK_TARGET']({});

  assert.deepEqual(result, {
    error: 'Backup folder could not be changed.',
  });
  assert.equal(
    fs.lstatSync(path.join(userDataDir, 'backups')).isSymbolicLink(),
    false,
    'the default backup directory must not become a self-containing link',
  );
});

test('automatic backup restores referenced managed backgrounds with the JSON data', async () => {
  const id = 'a'.repeat(32);
  const imageDir = path.join(userDataDir, 'bg-images');
  const imagePath = path.join(imageDir, `${id}.png`);
  fs.mkdirSync(imageDir, { recursive: true });
  fs.writeFileSync(imagePath, 'background-bytes');
  const data = {
    globalConfig: {
      misc: { globalBackgroundImage: `image:${id}` },
    },
  };

  await handlers['BACKUP']({}, { data, maxBackupFiles: 20 });
  const backupName = fs
    .readdirSync(path.join(userDataDir, 'backups'))
    .find((name) => name.endsWith('.json'));
  assert.ok(backupName);
  assert.equal(
    fs.existsSync(path.join(userDataDir, 'backups', '.assets', `${id}.png`)),
    true,
  );
  const assetDir = path.join(userDataDir, 'backups', '.assets');
  const future = new Date(Date.now() + 5_000);
  fs.utimesSync(assetDir, future, future);
  const latest = await handlers['BACKUP_IS_AVAILABLE']({});
  assert.ok(latest);
  assert.match(latest.path, /\.json$/);

  fs.rmSync(imagePath);
  await handlers['BACKUP_LOAD_DATA']({}, path.join(userDataDir, 'backups', backupName));

  assert.equal(fs.readFileSync(imagePath, 'utf8'), 'background-bytes');
});

test('migration safety backup surfaces write failures to its caller', async () => {
  const backupDir = path.join(userDataDir, 'backups');
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.writeFileSync(backupDir, 'not-a-directory');

  await assert.rejects(
    handlers['BACKUP'](
      {},
      {
        data: { ok: true },
        isThrowOnError: true,
      },
    ),
  );
});
