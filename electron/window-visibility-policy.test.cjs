const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require('ts-node/register/transpile-only');

const modulePath = path.resolve(__dirname, 'window-visibility-policy.ts');

test('the native minimize button always keeps the main window in the taskbar', () => {
  delete require.cache[modulePath];
  const { getMainWindowMinimizeAction } = require(modulePath);

  assert.equal(getMainWindowMinimizeAction({ isMinimizeToTray: true }), 'MINIMIZE');
  assert.equal(getMainWindowMinimizeAction({ isMinimizeToTray: false }), 'MINIMIZE');
});
