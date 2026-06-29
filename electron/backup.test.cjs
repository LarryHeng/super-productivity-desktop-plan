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

const installMocks = () => {
  Module._load = function patchedLoad(request, parent, isMain) {
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

test('fresh installs store backups below the selected installation directory', async () => {
  const result = await handlers['GET_BACKUP_PATH_INFO']({});
  const expected = path.join(installDir, 'backups');

  assert.equal(result.backupDir, path.join(userDataDir, 'backups'));
  assert.equal(result.linkTarget, expected);
  assert.equal(result.effectiveDir, expected);
  assert.equal(fs.realpathSync.native(result.backupDir), expected);
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

test('PICK_BACKUP_LINK_TARGET migrates files from an existing linked target', async () => {
  const replacementDir = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sp-bak-replacement-')),
  );
  try {
    fs.writeFileSync(path.join(installDir, 'backups', 'old.json'), '{"old":true}');
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

test('automatic backup restores referenced managed backgrounds with the JSON data', async () => {
  const id = 'a'.repeat(32);
  const imageDir = path.join(installDir, 'bg-images');
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
    .readdirSync(path.join(installDir, 'backups'))
    .find((name) => name.endsWith('.json'));
  assert.ok(backupName);
  assert.equal(
    fs.existsSync(path.join(installDir, 'backups', '.assets', `${id}.png`)),
    true,
  );
  const assetDir = path.join(installDir, 'backups', '.assets');
  const future = new Date(Date.now() + 5_000);
  fs.utimesSync(assetDir, future, future);
  const latest = await handlers['BACKUP_IS_AVAILABLE']({});
  assert.ok(latest);
  assert.match(latest.path, /\.json$/);

  fs.rmSync(imagePath);
  await handlers['BACKUP_LOAD_DATA']({}, path.join(userDataDir, 'backups', backupName));

  assert.equal(fs.readFileSync(imagePath, 'utf8'), 'background-bytes');
});
