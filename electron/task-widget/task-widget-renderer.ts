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
  document.body.classList.toggle('size-narrow', w < 560);
};

const resizeObserver = new ResizeObserver(updateResponsiveState);
resizeObserver.observe(document.documentElement);
updateResponsiveState();
