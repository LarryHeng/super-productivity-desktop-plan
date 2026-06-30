const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const installerPath = path.resolve(__dirname, '..', 'build', 'installer.nsh');

const extractPowerShell = () => {
  const source = fs.readFileSync(installerPath, 'utf8');
  const lines = [];
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*FileWrite \$R0 "(.*)"$/.exec(line);
    if (!match) continue;
    lines.push(match[1].replace(/\$\\r\$\\n/g, '\r\n').replace(/\$\$/g, '$'));
  }
  return lines.join('');
};

const runRestoreScript = ({ mode, installDir, appDataDir }) => {
  const scriptPath = path.join(appDataDir, 'restore-test.ps1');
  fs.mkdirSync(appDataDir, { recursive: true });
  fs.writeFileSync(scriptPath, extractPowerShell(), 'utf8');
  return spawnSync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-Mode',
      mode,
      '-InstallDir',
      installDir,
    ],
    {
      env: { ...process.env, APPDATA: appDataDir },
      encoding: 'utf8',
    },
  );
};

test('installer separates upgrade cleanup from uninstall data restoration', () => {
  const source = fs.readFileSync(installerPath, 'utf8');

  assert.match(source, /!macro customUnInstall\b/);
  assert.match(
    source,
    /!macro customInstall\b[\s\S]*StrCpy \$R9 "update"[\s\S]*!insertmacro RunRestoreUserData/,
    'the new installer must repair links left by an older uninstaller',
  );
  assert.doesNotMatch(
    source,
    /!macro customRemoveFiles\b/,
    'electron-builder should retain its atomic update cleanup',
  );
  assert.match(source, /\$\{isUpdated\}/);
  assert.match(source, /backups/);
  assert.match(source, /bg-images/);
});

test('uninstall restore verifies a C-drive copy before replacing a link', () => {
  const source = fs.readFileSync(installerPath, 'utf8');

  assert.match(source, /robocopy/i);
  assert.match(source, /Get-FileHash/);
  assert.match(source, /ReparsePoint/);
  assert.match(source, /Directory\]::Delete/);
  assert.match(source, /Move-Item/);
  assert.doesNotMatch(
    source,
    /Remove-Item[^\r\n]*\$target/i,
    'the external source remains as a safety copy',
  );
});

test('uninstall restore clears stale external-location settings', () => {
  const source = fs.readFileSync(installerPath, 'utf8');

  assert.match(source, /backupLinkTarget/);
  assert.match(source, /imageCacheDir/);
});

test(
  'uninstall copies linked data back to real C paths and leaves external sources intact',
  { skip: process.platform !== 'win32' },
  () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-uninstall-'));
    const appDataDir = path.join(tempRoot, 'AppData', 'Roaming');
    const userDataDir = path.join(appDataDir, 'superProductivity');
    const installDir = path.join(tempRoot, 'install');
    const externalRoot = path.join(tempRoot, 'external');
    const externalBackups = path.join(externalRoot, 'backups');
    const externalImages = path.join(externalRoot, 'bg-images');
    const backupLink = path.join(userDataDir, 'backups');
    const imageLink = path.join(userDataDir, 'bg-images');
    try {
      fs.mkdirSync(path.join(externalBackups, '.assets'), { recursive: true });
      fs.mkdirSync(externalImages, { recursive: true });
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.mkdirSync(installDir, { recursive: true });
      fs.writeFileSync(path.join(externalBackups, 'backup.json'), '{"ok":true}');
      fs.writeFileSync(path.join(externalBackups, '.assets', 'asset.png'), 'asset');
      fs.writeFileSync(path.join(externalImages, 'image.png'), 'image');
      fs.symlinkSync(externalBackups, backupLink, 'junction');
      fs.symlinkSync(externalImages, imageLink, 'junction');
      fs.writeFileSync(
        path.join(userDataDir, 'simpleSettings'),
        JSON.stringify({
          backupLinkTarget: externalBackups,
          imageCacheDir: externalImages,
          keepMe: true,
        }),
      );

      const result = runRestoreScript({
        mode: 'uninstall',
        installDir,
        appDataDir,
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(fs.lstatSync(backupLink).isSymbolicLink(), false);
      assert.equal(fs.lstatSync(imageLink).isSymbolicLink(), false);
      assert.equal(
        fs.readFileSync(path.join(backupLink, 'backup.json'), 'utf8'),
        '{"ok":true}',
      );
      assert.equal(
        fs.readFileSync(path.join(backupLink, '.assets', 'asset.png'), 'utf8'),
        'asset',
      );
      assert.equal(fs.readFileSync(path.join(imageLink, 'image.png'), 'utf8'), 'image');
      assert.equal(
        fs.readFileSync(path.join(externalBackups, 'backup.json'), 'utf8'),
        '{"ok":true}',
        'the external backup remains as a safety copy',
      );
      assert.equal(
        fs.readFileSync(path.join(externalImages, 'image.png'), 'utf8'),
        'image',
        'the external image remains as a safety copy',
      );
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(userDataDir, 'simpleSettings'), 'utf8')),
        { keepMe: true },
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);

test(
  'upgrade restores only legacy links that point inside the installation directory',
  { skip: process.platform !== 'win32' },
  () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-upgrade-'));
    const appDataDir = path.join(tempRoot, 'AppData', 'Roaming');
    const userDataDir = path.join(appDataDir, 'superProductivity');
    const installDir = path.join(tempRoot, 'install');
    const installBackups = path.join(installDir, 'backups');
    const externalImages = path.join(tempRoot, 'external', 'bg-images');
    const backupLink = path.join(userDataDir, 'backups');
    const imageLink = path.join(userDataDir, 'bg-images');
    try {
      fs.mkdirSync(installBackups, { recursive: true });
      fs.mkdirSync(externalImages, { recursive: true });
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(path.join(installBackups, 'legacy.json'), '{"legacy":true}');
      fs.writeFileSync(path.join(externalImages, 'external.png'), 'external');
      fs.symlinkSync(installBackups, backupLink, 'junction');
      fs.symlinkSync(externalImages, imageLink, 'junction');
      fs.writeFileSync(
        path.join(userDataDir, 'simpleSettings'),
        JSON.stringify({
          backupLinkTarget: installBackups,
          imageCacheDir: externalImages,
        }),
      );

      const result = runRestoreScript({
        mode: 'update',
        installDir,
        appDataDir,
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(fs.lstatSync(backupLink).isSymbolicLink(), false);
      assert.equal(
        fs.readFileSync(path.join(backupLink, 'legacy.json'), 'utf8'),
        '{"legacy":true}',
      );
      assert.equal(fs.lstatSync(imageLink).isSymbolicLink(), true);
      assert.equal(
        fs.realpathSync.native(imageLink),
        fs.realpathSync.native(externalImages),
      );
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(userDataDir, 'simpleSettings'), 'utf8')),
        { imageCacheDir: externalImages },
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  },
);
