const showMainBtn = document.getElementById('show-main') as HTMLButtonElement;
const hideWidgetBtn = document.getElementById('hide-widget') as HTMLButtonElement;
const container = document.getElementById('task-widget-container') as HTMLDivElement;
const taskTitle = document.getElementById('task-title') as HTMLSpanElement;
const activeLabel = document.getElementById('active-label') as HTMLSpanElement;
const timeDisplay = document.getElementById('time-display') as HTMLSpanElement;
const matrixGrid = document.getElementById('matrix-grid') as HTMLDivElement;
const widgetBg = document.getElementById('widget-bg') as HTMLDivElement;
const extendDialog = document.getElementById('extend-dialog') as HTMLElement;
const extendTaskTitle = document.getElementById('extend-task-title') as HTMLElement;
const extendMinutes = document.getElementById('extend-minutes') as HTMLInputElement;
const extendConfirm = document.getElementById('extend-confirm') as HTMLButtonElement;
const extendCancel = document.getElementById('extend-cancel') as HTMLButtonElement;
let expiredTaskId: string | null = null;
let labels = {
  activeTask: '',
  noActiveTask: '',
  noTasks: '',
};

type TaskWidgetListTask = Readonly<{
  id: string;
  title: string;
  timeEstimate?: number;
  timeSpent?: number;
  dueDay?: string;
  dueWithTime?: number;
  deadlineDay?: string;
  deadlineWithTime?: number;
  isDone?: boolean;
}>;

const blockRightClick = (e: MouseEvent): false | void => {
  if (e.type === 'contextmenu' || e.button === 2) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }
};
document.addEventListener('contextmenu', blockRightClick, true);
document.addEventListener('mousedown', blockRightClick, true);
document.addEventListener('mouseup', blockRightClick, true);

const colDivider = document.getElementById('col-divider') as HTMLDivElement;
const rowDivider = document.getElementById('row-divider') as HTMLDivElement;
const crossCenter = document.getElementById('cross-center') as HTMLDivElement;
const LS_KEY = 'taskWidgetMatrixRatios';
const DEFAULT_COL_RATIO = 0.5;
const DEFAULT_ROW_RATIO = 0.5;
const MIN_RATIO = 0.18;
const MAX_RATIO = 0.82;
const SNAP_RATIO = 0.5;
const SNAP_THRESHOLD = 0.06;

let colRatio = DEFAULT_COL_RATIO;
let rowRatio = DEFAULT_ROW_RATIO;

try {
  const stored = localStorage.getItem(LS_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (
      typeof parsed.col === 'number' &&
      parsed.col >= MIN_RATIO &&
      parsed.col <= MAX_RATIO
    ) {
      colRatio = parsed.col;
    }
    if (
      typeof parsed.row === 'number' &&
      parsed.row >= MIN_RATIO &&
      parsed.row <= MAX_RATIO
    ) {
      rowRatio = parsed.row;
    }
  }
} catch (_) {
  /* ignore */
}

const persistRatios = (): void => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ col: colRatio, row: rowRatio }));
  } catch (_) {
    /* ignore */
  }
};

const GAP = 10;

const applyRatios = (): void => {
  const gridStyles = getComputedStyle(matrixGrid);
  const padLeft = parseFloat(gridStyles.paddingLeft) || 0;
  const padRight = parseFloat(gridStyles.paddingRight) || 0;
  const padTop = parseFloat(gridStyles.paddingTop) || 0;
  const padBottom = parseFloat(gridStyles.paddingBottom) || 0;

  // Temporarily clear pixel tracks so grid uses CSS 1fr and we read its
  // real constrained width instead of an overflowed stale value.
  matrixGrid.style.gridTemplateColumns = '';
  matrixGrid.style.gridTemplateRows = '';
  void matrixGrid.offsetWidth;

  const contentW = matrixGrid.clientWidth - padLeft - padRight;
  const contentH = matrixGrid.clientHeight - padTop - padBottom;
  if (contentW <= 0 || contentH <= 0) return;

  const availW = contentW - GAP;
  const availH = contentH - GAP;

  const col1W = Math.round(colRatio * availW);
  const col2W = availW - col1W;
  const row1H = Math.round(rowRatio * availH);
  const row2H = availH - row1H;

  matrixGrid.style.gridTemplateColumns = `${col1W}px ${col2W}px`;
  matrixGrid.style.gridTemplateRows = `${row1H}px ${row2H}px`;

  const halfGap = GAP / 2;
  const colX = padLeft + col1W + halfGap;
  const rowY = padTop + row1H + halfGap;

  colDivider.style.left = `${colX}px`;
  colDivider.style.top = `${padTop}px`;
  colDivider.style.height = `${contentH}px`;
  rowDivider.style.left = `${padLeft}px`;
  rowDivider.style.top = `${rowY}px`;
  rowDivider.style.width = `${contentW}px`;
  crossCenter.style.left = `${colX}px`;
  crossCenter.style.top = `${rowY}px`;
};

let activeDrag: 'col' | 'row' | 'cross' | null = null;
let dragStartX = 0;
let dragStartY = 0;
let dragStartColRatio = 0;
let dragStartRowRatio = 0;

const onDragStart = (mode: 'col' | 'row' | 'cross', e: MouseEvent): void => {
  activeDrag = mode;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartColRatio = colRatio;
  dragStartRowRatio = rowRatio;
  hasSnappedCol = false;
  hasSnappedRow = false;
  matrixGrid.classList.remove('snap-col', 'snap-row');
  if (mode === 'col' || mode === 'cross') colDivider.classList.add('active');
  if (mode === 'row' || mode === 'cross') rowDivider.classList.add('active');
  if (mode === 'cross') crossCenter.classList.add('active');
  e.preventDefault();
};

colDivider.addEventListener('mousedown', (e) => onDragStart('col', e));
rowDivider.addEventListener('mousedown', (e) => onDragStart('row', e));
crossCenter.addEventListener('mousedown', (e) => onDragStart('cross', e));

let hasSnappedCol = false;
let hasSnappedRow = false;

const snap = (raw: number, setSnapped: (v: boolean) => void): number => {
  if (Math.abs(raw - SNAP_RATIO) <= SNAP_THRESHOLD) {
    setSnapped(true);
    return SNAP_RATIO;
  }
  setSnapped(false);
  return raw;
};

document.addEventListener('mousemove', (e) => {
  if (!activeDrag) return;
  const gridStyles = getComputedStyle(matrixGrid);
  const padLeft = parseFloat(gridStyles.paddingLeft) || 0;
  const padRight = parseFloat(gridStyles.paddingRight) || 0;
  const padTop = parseFloat(gridStyles.paddingTop) || 0;
  const padBottom = parseFloat(gridStyles.paddingBottom) || 0;

  const contentW = matrixGrid.clientWidth - padLeft - padRight;
  const contentH = matrixGrid.clientHeight - padTop - padBottom;
  if (contentW <= GAP + 1 || contentH <= GAP + 1) return;

  const availW = contentW - GAP;
  const availH = contentH - GAP;

  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  if (activeDrag === 'col' || activeDrag === 'cross') {
    const dRatioX = dx / availW;
    const rawRatio = dragStartColRatio + dRatioX;
    colRatio = Math.max(
      MIN_RATIO,
      Math.min(
        MAX_RATIO,
        snap(rawRatio, (v) => {
          hasSnappedCol = v;
        }),
      ),
    );
  }
  if (activeDrag === 'row' || activeDrag === 'cross') {
    const dRatioY = dy / availH;
    const rawRatio = dragStartRowRatio + dRatioY;
    rowRatio = Math.max(
      MIN_RATIO,
      Math.min(
        MAX_RATIO,
        snap(rawRatio, (v) => {
          hasSnappedRow = v;
        }),
      ),
    );
  }

  matrixGrid.classList.toggle(
    'snap-col',
    !!activeDrag && hasSnappedCol && (activeDrag === 'col' || activeDrag === 'cross'),
  );
  matrixGrid.classList.toggle(
    'snap-row',
    !!activeDrag && hasSnappedRow && (activeDrag === 'row' || activeDrag === 'cross'),
  );

  applyRatios();
});

document.addEventListener('mouseup', () => {
  if (!activeDrag) return;
  colDivider.classList.remove('active');
  rowDivider.classList.remove('active');
  crossCenter.classList.remove('active');
  matrixGrid.classList.remove('snap-col', 'snap-row');
  activeDrag = null;
  persistRatios();
});

const dividerResizeObserver = new ResizeObserver(() => applyRatios());
dividerResizeObserver.observe(container);

showMainBtn.addEventListener('click', () => {
  window.taskWidgetAPI.showMainWindow();
});

hideWidgetBtn.addEventListener('click', () => {
  window.taskWidgetAPI.hideWidget();
});

const formatDuration = (timeMs: number | undefined): string => {
  const ms = Number(timeMs) || 0;
  if (ms <= 0) {
    return '';
  }
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }
  return `${minutes}m`;
};

const formatDateStr = (value: string | undefined): string => {
  if (!value) {
    return '';
  }
  return value.slice(5);
};

const formatTime = (value: number | undefined): string => {
  if (typeof value !== 'number') {
    return '';
  }
  return new Date(value).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const renderList = (target: HTMLDivElement, tasks: TaskWidgetListTask[]): void => {
  target.textContent = '';
  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = labels.noTasks;
    target.appendChild(empty);
    return;
  }

  for (const task of tasks) {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.dataset.taskId = task.id;
    row.classList.toggle('is-done', !!task.isDone);

    const completeBtn = document.createElement('button');
    completeBtn.className = 'complete-task';
    completeBtn.type = 'button';
    const isDone = !!task.isDone;
    const completeActionLabel = isDone ? 'Restore task' : 'Complete task';
    completeBtn.title = completeActionLabel;
    completeBtn.setAttribute('aria-label', completeActionLabel);
    completeBtn.textContent = isDone ? 'undo' : 'done';
    completeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      window.taskWidgetAPI.completeTask(task.id, !isDone);
    });

    const textWrap = document.createElement('button');
    textWrap.className = 'task-main';
    textWrap.type = 'button';
    textWrap.title = task.title;
    textWrap.disabled = !!task.isDone;
    textWrap.addEventListener('click', () => {
      window.taskWidgetAPI.switchTask(task.id);
    });

    const title = document.createElement('span');
    title.className = 'task-row-title';
    title.textContent = task.title || '(untitled)';

    const meta = document.createElement('span');
    meta.className = 'task-row-meta';
    const remaining = formatDuration(
      task.timeEstimate ? Math.max(task.timeEstimate - (task.timeSpent || 0), 0) : 0,
    );
    const dateLabel =
      formatTime(task.dueWithTime) ||
      formatDateStr(task.dueDay) ||
      formatTime(task.deadlineWithTime) ||
      formatDateStr(task.deadlineDay);
    meta.textContent = [dateLabel, remaining].filter(Boolean).join(' | ');

    textWrap.appendChild(title);
    if (meta.textContent) {
      textWrap.appendChild(meta);
    }
    row.appendChild(completeBtn);
    row.appendChild(textWrap);
    target.appendChild(row);
  }
};

const renderPanels = (
  panels: { id: string; title: string; tasks: TaskWidgetListTask[] }[],
): void => {
  matrixGrid.textContent = '';
  for (const panel of panels) {
    const section = document.createElement('section');
    section.className = 'task-column';
    section.dataset.panelId = panel.id;

    const header = document.createElement('div');
    header.className = 'column-title';
    header.textContent = panel.title;

    const list = document.createElement('div');
    list.className = 'task-list';

    renderList(list, panel.tasks || []);
    section.appendChild(header);
    section.appendChild(list);
    matrixGrid.appendChild(section);
  }
  matrixGrid.appendChild(colDivider);
  matrixGrid.appendChild(rowDivider);
  matrixGrid.appendChild(crossCenter);
  applyRatios();
};

window.taskWidgetAPI.onUpdateContent((data) => {
  labels = { ...labels, ...data.labels };
  container.classList.remove('mode-pomodoro', 'mode-focus', 'mode-task', 'mode-idle');
  if (data.mode) {
    container.classList.add(`mode-${data.mode}`);
  }
  activeLabel.textContent = labels.activeTask;
  taskTitle.textContent = data.title || labels.noActiveTask;
  timeDisplay.textContent = data.time || '--:--';
  renderPanels(data.panels || []);
});

window.taskWidgetAPI.onUpdateOpacity(({ backgroundOpacity, contentOpacity }) => {
  document.body.style.setProperty('--background-opacity', backgroundOpacity.toString());
  document.body.style.setProperty('--content-opacity', contentOpacity.toString());
});

window.taskWidgetAPI.onCountdownExpired(({ taskId, title }) => {
  expiredTaskId = taskId;
  extendTaskTitle.textContent = title;
  extendMinutes.value = '15';
  extendDialog.hidden = false;
  extendMinutes.focus();
  extendMinutes.select();
});

extendCancel.addEventListener('click', () => {
  expiredTaskId = null;
  extendDialog.hidden = true;
});

extendConfirm.addEventListener('click', () => {
  const minutes = Number.parseInt(extendMinutes.value, 10);
  if (!expiredTaskId || !Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    extendMinutes.focus();
    return;
  }
  window.taskWidgetAPI.extendTask(expiredTaskId, minutes * 60 * 1000);
  expiredTaskId = null;
  extendDialog.hidden = true;
});

extendMinutes.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    extendConfirm.click();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    extendCancel.click();
  }
});

window.taskWidgetAPI.onUpdateBackground((data) => {
  document.body.classList.toggle('uses-theme-background', data.mode === 'theme');
  if (data.image) {
    widgetBg.style.backgroundImage = `url("${data.image.replace(/"/g, '\\"')}")`;
    widgetBg.style.backgroundPosition = `${data.positionX}% ${data.positionY}%`;
    widgetBg.style.opacity = data.imageOpacity.toString();
  } else {
    widgetBg.style.backgroundImage = 'none';
    widgetBg.style.backgroundPosition = '50% 50%';
    widgetBg.style.opacity = '0';
  }
});

const updateResponsiveState = (): void => {
  const w = document.documentElement.clientWidth;
  const isNarrow = w < 560;
  document.body.classList.toggle('size-narrow', isNarrow);
  if (isNarrow) {
    matrixGrid.style.gridTemplateColumns = '';
    matrixGrid.style.gridTemplateRows = '';
    colDivider.style.display = 'none';
    rowDivider.style.display = 'none';
    crossCenter.style.display = 'none';
  } else {
    colDivider.style.display = '';
    rowDivider.style.display = '';
    crossCenter.style.display = '';
    applyRatios();
  }
};

const resizeObserver = new ResizeObserver(updateResponsiveState);
resizeObserver.observe(document.documentElement);
updateResponsiveState();
