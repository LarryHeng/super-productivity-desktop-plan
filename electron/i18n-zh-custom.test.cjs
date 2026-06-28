const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const en = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/assets/i18n/en.json'), 'utf8'),
);
const zh = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/assets/i18n/zh.json'), 'utf8'),
);

const getMissingKeys = (reference, translated, prefix = '') => {
  const missing = [];
  for (const [key, value] of Object.entries(reference)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      missing.push(...getMissingKeys(value, translated?.[key], keyPath));
    } else if (!translated || !(key in translated)) {
      missing.push(keyPath);
    }
  }
  return missing;
};

test('Chinese translations cover every English reference key', () => {
  assert.deepEqual(getMissingKeys(en, zh), []);
});

test('break reminder banner has complete Chinese copy', () => {
  assert.equal(zh.F.TIME_TRACKING.B.BREAK_SNACK, '休息一下，稍后再继续！');
  assert.equal(zh.F.TIME_TRACKING.B.PAUSE_AND_BREAK, '暂停并休息');
  assert.equal(
    zh.GCF.TAKE_A_BREAK.DEFAULT_MESSAGE,
    '您已连续工作 {{duration}}，该休息一下了。离开电脑走一走，短暂休息能让之后的工作更高效！',
  );
});

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

test('schedule is named timeline and exposes a return-to-today label', () => {
  assert.equal(zh.MH.SCHEDULE, '时间表');
  assert.equal(zh.F.SCHEDULE.RETURN_TO_TODAY, '回到今天');
});

test('task widget always-show setting explains its main-window behavior', () => {
  assert.equal(
    zh.GCF.TASK_WIDGET.IS_ALWAYS_SHOW,
    '始终显示任务小部件（软件打开时是否展示小组件）',
  );
});

test('schedule exposes the configurable actual-block merge gap labels', () => {
  assert.equal(zh.GCF.SCHEDULE.L_ACTUAL_TIME_MERGE_GAP, '实际块合并间隔（分钟）');
  assert.match(zh.GCF.SCHEDULE.ACTUAL_TIME_MERGE_GAP_DESCRIPTION, /30/);
});
