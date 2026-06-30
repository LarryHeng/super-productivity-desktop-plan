const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ResEdit = require('resedit');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'electron-builder.yaml');
const iconPath = path.join(root, 'build', 'windows-icon.ico');

test('Windows packaging pins the legacy desktop shortcut icon', () => {
  const config = fs.readFileSync(configPath, 'utf8');
  assert.match(
    config,
    /^win:\r?\n(?:^[ \t].*\r?\n)*?^  icon: build\/windows-icon\.ico$/m,
  );
  assert.ok(fs.existsSync(iconPath), 'the pinned Windows icon must be packaged');

  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
  const sizes = iconFile.icons.map(({ data }) => data.width);
  assert.ok(sizes.includes(16), 'the shortcut icon needs a 16px image');
  assert.ok(sizes.includes(32), 'the shortcut icon needs a 32px image');
  assert.ok(
    sizes.some((size) => size >= 48),
    'the shortcut icon needs a large image',
  );
});
