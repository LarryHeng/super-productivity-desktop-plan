const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const Module = require('node:module');

require('ts-node/register/transpile-only');

const modPath = path.resolve(__dirname, 'backup.ts');
const simpleStorePath = path.resolve(__dirname, 'simple-store.ts');
const originalModuleLoad = Module._load;

let handlers = {};
let listeners = {};
let userDataDir;
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
        app: { getPath: () => userDataDir },
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
    return originalModuleLoad.call(this, request, parent, isMain);
  };
};

const resetCaches = () => {
  delete require.cache[modPath];
  delete require.cache[simpleStorePath];
  handlers = {};
  listeners = {};
};

const load = () => {
  resetCaches();
  require(modPath).initBackupAdapter();
};

test.beforeEach(() => {
  userDataDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'sp-ud-')));
  externalDir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'sp-bak-')));
  installMocks();
  load();
});

test.afterEach(() => {
  Module._load = originalModuleLoad;
  resetCaches();
  fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.rmSync(externalDir, { recursive: true, force: true });
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

  listeners['BACKUP']({}, { data: { ok: true }, maxBackupFiles: 20 });

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
