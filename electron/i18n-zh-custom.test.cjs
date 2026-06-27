const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const zh = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/assets/i18n/zh.json'), 'utf8'),
);

test('idle handling custom actions have Chinese translations', () => {
  const keys = [
    'ALL_TIME_ASSIGNED',
    'BREAK_SUMMARY',
    'CONFIRM_BREAK',
    'CONFIRM_CREATE_TASK',
    'CONFIRM_SPLIT',
    'CONFIRM_TASK',
    'CONFIRM_TRACK',
    'DONT_TRACK',
    'MODE_BREAK',
    'MODE_SPLIT',
    'MODE_TASK',
    'TIME_OVER_ASSIGNED',
    'TIME_UNASSIGNED',
    'USE_REMAINING_TIME',
    'WHAT_WERE_YOU_DOING',
  ];

  for (const key of keys) {
    assert.equal(typeof zh.F.TIME_TRACKING.D_IDLE[key], 'string', key);
    assert.notEqual(zh.F.TIME_TRACKING.D_IDLE[key].trim(), '', key);
  }
});
