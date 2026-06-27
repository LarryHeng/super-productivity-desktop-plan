const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

require('ts-node/register/transpile-only');

const originalModuleLoad = Module._load;
const taskWidgetModulePath = path.resolve(__dirname, 'task-widget/task-widget.ts');

let createdWindows = [];
let loadSimpleStoreAllImpl;
let ipcHandlers;

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

class FakeWebContents {
  constructor() {
    this.sent = [];
    this._handlers = new Map();
  }
  on(eventName, handler) {
    this._handlers.set(eventName, handler);
  }
  emit(eventName) {
    const handler = this._handlers.get(eventName);
    if (handler) handler();
  }
  send(channel, ...args) {
    this.sent.push({ channel, args });
  }
  focus() {}
  isDestroyed() {
    return false;
  }
  removeAllListeners() {}
}

class FakeBrowserWindow {
  constructor(options = {}) {
    this.options = options;
    this._visible = false;
    this.showCount = 0;
    this.showInactiveCount = 0;
    this.hideCount = 0;
    this.restoreCount = 0;
    this.maximizeCount = 0;
    this._minimized = false;
    this._handlers = new Map();
    this.webContents = new FakeWebContents();
    createdWindows.push(this);
  }

  static getAllWindows() {
    return createdWindows.slice();
  }

  loadFile() {}
  setVisibleOnAllWorkspaces() {}
  setOpacity() {}
  setClosable() {}
  removeAllListeners() {}
  destroy() {}
  on(eventName, handler) {
    this._handlers.set(eventName, handler);
  }
  emit(eventName) {
    const handler = this._handlers.get(eventName);
    if (handler) handler();
  }
  getBounds() {
    return { width: 300, height: 80, x: 0, y: 0 };
  }
  isDestroyed() {
    return false;
  }
  isVisible() {
    return this._visible;
  }
  isMinimized() {
    return this._minimized;
  }
  show() {
    this._visible = true;
    this.showCount += 1;
  }
  showInactive() {
    this._visible = true;
    this.showInactiveCount += 1;
  }
  focus() {}
  restore() {
    this._minimized = false;
    this.restoreCount += 1;
  }
  maximize() {
    this.maximizeCount += 1;
  }
  hide() {
    this._visible = false;
    this.hideCount += 1;
  }
}

const installMocks = () => {
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        BrowserWindow: FakeBrowserWindow,
        ipcMain: {
          on: (channel, handler) => ipcHandlers.set(channel, handler),
          removeAllListeners: (channel) => ipcHandlers.delete(channel),
        },
        screen: {
          getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }),
          getDisplayMatching: () => ({
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          }),
        },
      };
    }
    if (request === 'electron-log/main') {
      return { info: () => {} };
    }
    if (request.endsWith('ipc-events.const')) {
      return {
        IPC: {
          REQUEST_CURRENT_TASK_FOR_TASK_WIDGET: 'REQUEST_CURRENT_TASK_FOR_TASK_WIDGET',
          TASK_WIDGET_COMPLETE_TASK: 'TASK_WIDGET_COMPLETE_TASK',
          TASK_WIDGET_SET_ENABLED: 'TASK_WIDGET_SET_ENABLED',
          TASK_WIDGET_EXTEND_TASK: 'TASK_WIDGET_EXTEND_TASK',
          SWITCH_TASK: 'SWITCH_TASK',
          UPDATE_TASK_WIDGET_SETTINGS: 'UPDATE_TASK_WIDGET_SETTINGS',
        },
      };
    }
    if (request.endsWith('simple-store')) {
      return {
        loadSimpleStoreAll: () => loadSimpleStoreAllImpl(),
        saveSimpleStore: () => {},
      };
    }
    if (request.endsWith('image-cache')) {
      return {
        getImageDataUrl: async (id) => `data:image/png;base64,${id}`,
      };
    }
    if (request.endsWith('common.const')) {
      return { IS_MAC: false };
    }
    return originalModuleLoad.call(this, request, parent, isMain);
  };
};

const loadModule = () => {
  delete require.cache[taskWidgetModulePath];
  return require(taskWidgetModulePath);
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

test.beforeEach(() => {
  createdWindows = [];
  ipcHandlers = new Map();
  loadSimpleStoreAllImpl = async () => ({});
  installMocks();
});

test.afterEach(() => {
  Module._load = originalModuleLoad;
});

test('toggleTaskWidgetVisibility is a no-op while the task widget feature is disabled', () => {
  const mod = loadModule();
  mod.toggleTaskWidgetVisibility();
  assert.equal(createdWindows.length, 0, 'no window should be created when disabled');
});

test('toggleTaskWidgetVisibility shows the widget when it is enabled but hidden', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  assert.equal(createdWindows.length, 1, 'enabling should create the widget window');
  const win = createdWindows[0];
  assert.equal(win.isVisible(), false, 'widget starts hidden');

  mod.toggleTaskWidgetVisibility();
  assert.equal(win.isVisible(), true, 'toggle should show the hidden widget');
  assert.equal(win.showInactiveCount, 1);
});

test('toggleTaskWidgetVisibility hides the widget when it is enabled and visible', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[0];
  mod.showTaskWidget();
  assert.equal(win.isVisible(), true, 'widget should be visible before toggling');

  mod.toggleTaskWidgetVisibility();
  assert.equal(win.isVisible(), false, 'toggle should hide the visible widget');
  assert.equal(win.hideCount, 1);
});

test('forcing the widget visible via the shortcut sets a sticky user-forced flag', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  assert.equal(mod.getIsTaskWidgetUserForcedVisible(), false, 'flag starts cleared');

  mod.toggleTaskWidgetVisibility();
  assert.equal(
    mod.getIsTaskWidgetUserForcedVisible(),
    true,
    'showing via the shortcut sets the sticky flag',
  );

  mod.toggleTaskWidgetVisibility();
  assert.equal(
    mod.getIsTaskWidgetUserForcedVisible(),
    false,
    'hiding via the shortcut clears the sticky flag',
  );
});

test('disabling the widget clears the sticky user-forced flag', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  mod.toggleTaskWidgetVisibility();
  assert.equal(mod.getIsTaskWidgetUserForcedVisible(), true);

  mod.updateTaskWidgetEnabled(false);
  assert.equal(
    mod.getIsTaskWidgetUserForcedVisible(),
    false,
    'disabling the feature resets the sticky flag',
  );
});

test('disabling clears the sticky flag even when the widget window is absent', () => {
  const mod = loadModule();

  // Enable but do not flush: createTaskWidgetWindow() is mid-flight, so
  // taskWidgetWin is still null (the "absent window" / async re-create gap).
  mod.updateTaskWidgetEnabled(true);

  // User hits the shortcut during that gap, so the flag is set without a window.
  mod.toggleTaskWidgetVisibility();
  assert.equal(createdWindows.length, 0, 'no window exists yet');
  assert.equal(
    mod.getIsTaskWidgetUserForcedVisible(),
    true,
    'shortcut sets the sticky flag even without a window',
  );

  // Disabling now must clear the flag even though destroyTaskWidget() is
  // skipped (its guard requires an existing window), or it would leak into
  // the next enable.
  mod.updateTaskWidgetEnabled(false);
  assert.equal(
    mod.getIsTaskWidgetUserForcedVisible(),
    false,
    'disabling clears the flag regardless of whether the window exists',
  );
});

test('disabling while async creation is pending prevents the widget window from being created', async () => {
  const storeLoad = createDeferred();
  loadSimpleStoreAllImpl = () => storeLoad.promise;
  const mod = loadModule();

  mod.updateTaskWidgetEnabled(true);
  mod.updateTaskWidgetEnabled(false);

  storeLoad.resolve({});
  await flush();

  assert.equal(
    createdWindows.length,
    0,
    'disabling before persisted bounds load resolves should cancel window creation',
  );
});

test('shortcut reveal while async creation is pending shows the widget after creation completes', async () => {
  const storeLoad = createDeferred();
  loadSimpleStoreAllImpl = () => storeLoad.promise;
  const mod = loadModule();

  mod.updateTaskWidgetEnabled(true);
  mod.toggleTaskWidgetVisibility();

  storeLoad.resolve({});
  await flush();

  assert.equal(createdWindows.length, 1, 'only the initial in-flight creation is reused');
  assert.equal(
    createdWindows[0].isVisible(),
    true,
    'pending shortcut reveal should show the window once it exists',
  );
});

test('shortcut reveal uses showInactive so the current app keeps focus', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[0];
  mod.toggleTaskWidgetVisibility();

  assert.equal(win.showInactiveCount, 1);
  assert.equal(win.showCount, 0);
  assert.equal(win.isVisible(), true, 'widget should still become visible');
});

test('the closed event clears the sticky flag so it does not outlive the window', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[0];
  mod.toggleTaskWidgetVisibility();
  assert.equal(mod.getIsTaskWidgetUserForcedVisible(), true);

  win.emit('closed');
  assert.equal(
    mod.getIsTaskWidgetUserForcedVisible(),
    false,
    'closing the window clears the sticky flag',
  );
});

test('shortcut-hidden widget stays hidden until the user reveals it again', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[0];
  mod.showTaskWidget();
  assert.equal(win.isVisible(), true, 'widget starts visible for the hide action');

  mod.toggleTaskWidgetVisibility();
  assert.equal(win.isVisible(), false, 'hide button hides the widget');

  mod.showTaskWidget();
  assert.equal(
    win.isVisible(),
    false,
    'automatic show requests should not undo an explicit user hide',
  );

  mod.toggleTaskWidgetVisibility();
  assert.equal(win.isVisible(), true, 'shortcut reveal brings the widget back');
});

test('enabled task widget creates a desktop planning panel with a useful lower bound', async () => {
  const mod = loadModule();

  mod.updateTaskWidgetEnabled(true);
  await flush();

  assert.equal(createdWindows.length, 1, 'enabling should create the widget window');
  const options = createdWindows[0].options;
  assert.ok(options.width >= 700, 'default width should fit matrix columns');
  assert.ok(options.height >= 360, 'default height should fit a planning panel');
  assert.ok(options.minWidth >= 420, 'min width should keep the panel usable');
  assert.ok(options.minHeight >= 220, 'min height should keep the panel usable');
  assert.equal(
    options.alwaysOnTop,
    false,
    'desktop widget should be covered by normal app windows',
  );
  assert.equal(options.maxHeight, undefined, 'panel height should not be capped');
});

test('updateTaskWidgetTaskLists sends Eisenhower matrix panels to the renderer', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[0];
  mod.updateTaskWidgetTaskLists({
    panels: [
      {
        id: 'URGENT_AND_IMPORTANT',
        title: 'Urgent & Important',
        tasks: [{ id: 'task-1', title: 'Matrix task', timeEstimate: 0, timeSpent: 0 }],
      },
    ],
  });

  const update = win.webContents.sent
    .filter((msg) => msg.channel === 'update-content')
    .at(-1);
  assert.equal(update.args[0].panels.length, 1);
  assert.equal(update.args[0].panels[0].id, 'URGENT_AND_IMPORTANT');
  assert.equal(update.args[0].panels[0].tasks[0].id, 'task-1');
});

test('task widget completion requests are forwarded to the main renderer', async () => {
  const mainWin = new FakeBrowserWindow();
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  ipcHandlers.get('task-widget-complete-task')({}, 'task-1');

  assert.deepEqual(mainWin.webContents.sent.at(-1), {
    channel: 'TASK_WIDGET_COMPLETE_TASK',
    args: ['task-1'],
  });
});

test('task widget open requests restore, show, and maximize the main app', async () => {
  const mainWin = new FakeBrowserWindow();
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  ipcHandlers.get('task-widget-show-main-window')();

  assert.equal(mainWin.restoreCount, 1);
  assert.equal(mainWin.showCount, 1);
  assert.equal(mainWin.maximizeCount, 1);
});

test('task widget hide requests the renderer to disable the widget setting', async () => {
  const mainWin = new FakeBrowserWindow();
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[1];
  mod.showTaskWidget();
  assert.equal(win.isVisible(), true, 'widget should be visible before hiding');

  ipcHandlers.get('task-widget-hide')();

  assert.deepEqual(mainWin.webContents.sent.at(-1), {
    channel: 'TASK_WIDGET_SET_ENABLED',
    args: [false],
  });
});

test('task widget falls back to the global background when no widget background is set', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[0];
  mod.updateTaskWidgetGlobalBackground('image:global-bg', 33);
  await flush();

  const update = win.webContents.sent
    .filter((msg) => msg.channel === 'update-background')
    .at(-1);

  assert.deepEqual(update.args[0], {
    image: 'data:image/png;base64,global-bg',
    imageOpacity: 0.95,
  });
});

test('task widget own background overrides the global fallback', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[0];
  mod.updateTaskWidgetBackground('image:widget-bg', 44);
  await flush();
  mod.updateTaskWidgetGlobalBackground('image:global-bg', 33);
  await flush();

  const update = win.webContents.sent
    .filter((msg) => msg.channel === 'update-background')
    .at(-1);

  assert.deepEqual(update.args[0], {
    image: 'data:image/png;base64,widget-bg',
    imageOpacity: 0.95,
  });
});

test('task widget replays appearance and background after its document loads', async () => {
  const mod = loadModule();
  mod.initTaskWidgetSettingsListener();

  ipcHandlers.get('UPDATE_TASK_WIDGET_SETTINGS')(
    {},
    {
      isEnabled: true,
      isAlwaysShow: true,
      opacity: 72,
      contentOpacity: 64,
      backgroundImage: 'image:widget-bg',
    },
  );
  await flush();

  const win = createdWindows[0];
  win.webContents.sent = [];
  win.webContents.emit('did-finish-load');
  await flush();

  assert.deepEqual(
    win.webContents.sent.find((msg) => msg.channel === 'update-opacity')?.args[0],
    {
      backgroundOpacity: 0.72,
      contentOpacity: 0.64,
    },
  );
  assert.deepEqual(
    win.webContents.sent.find((msg) => msg.channel === 'update-background')?.args[0],
    {
      image: 'data:image/png;base64,widget-bg',
      imageOpacity: 0.72,
    },
  );
  assert.equal(win.showInactiveCount > 0, true);
});

test('task widget restores itself when Windows Show Desktop minimizes it', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetAlwaysShow(true);
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[0];
  win._minimized = true;
  const event = {
    preventDefaultCalled: false,
    preventDefault() {
      this.preventDefaultCalled = true;
    },
  };
  win._handlers.get('minimize')(event);
  await flush();

  assert.equal(event.preventDefaultCalled, true);
  assert.equal(win.restoreCount, 1);
  assert.equal(win.showInactiveCount > 0, true);
});

test('task countdown expiry is emitted only once for the same estimate', async () => {
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  const win = createdWindows[0];
  win.webContents.emit('did-finish-load');
  const task = {
    id: 'task-1',
    title: 'Timed task',
    timeEstimate: 30 * 60 * 1000,
    timeSpent: 30 * 60 * 1000,
  };
  mod.updateTaskWidgetTask(task, false, 0, false, 0);
  mod.updateTaskWidgetTask(task, false, 0, false, 0);

  const expiryMessages = win.webContents.sent.filter(
    (msg) => msg.channel === 'countdown-expired',
  );
  assert.equal(expiryMessages.length, 1);
  assert.deepEqual(expiryMessages[0].args[0], {
    taskId: 'task-1',
    title: 'Timed task',
  });
});

test('task widget extension requests are forwarded to the main renderer', async () => {
  const mainWin = new FakeBrowserWindow();
  const mod = loadModule();
  mod.updateTaskWidgetEnabled(true);
  await flush();

  ipcHandlers.get('task-widget-extend-task')({}, 'task-1', 15 * 60 * 1000);

  assert.deepEqual(mainWin.webContents.sent.at(-1), {
    channel: 'TASK_WIDGET_EXTEND_TASK',
    args: ['task-1', 15 * 60 * 1000],
  });
});
