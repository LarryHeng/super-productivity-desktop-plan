import { inject, Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngrx/effects';
import { setCurrentTask, unsetCurrentTask } from './task.actions';
import { select, Store } from '@ngrx/store';
import {
  filter,
  startWith,
  take,
  tap,
  throttleTime,
  withLatestFrom,
} from 'rxjs/operators';
import {
  selectAllTasksInActiveProjects,
  selectCurrentTask,
  selectTaskEntities,
} from './task.selectors';
import { selectTodayTaskIds } from '../../work-context/store/work-context.selectors';
import { GlobalConfigService } from '../../config/global-config.service';
import { selectIsOverlayShown } from '../../focus-mode/store/focus-mode.selectors';
import { TimeTrackingActions } from '../../time-tracking/store/time-tracking.actions';
import { FocusModeService } from '../../focus-mode/focus-mode.service';
import {
  cancelFocusSession,
  completeFocusSession,
  hideFocusOverlay,
  pauseFocusSession,
  showFocusOverlay,
  startFocusSession,
  tick,
  unPauseFocusSession,
} from '../../focus-mode/store/focus-mode.actions';
import { IPC } from '../../../../../electron/shared-with-frontend/ipc-events.const';
import { ipcAddTaskFromAppUri$ } from '../../../core/ipc-events';
import { TaskService } from '../task.service';
import { TaskSharedActions } from '../../../root-store/meta/task-shared.actions';
import { LOCAL_ACTIONS } from '../../../util/local-actions.token';
import { TaskLog } from '../../../core/log';
import { combineLatest } from 'rxjs';
import {
  buildEisenhowerTaskWidgetPanels,
  mapTaskForTaskWidget,
} from './task-widget-panels.util';
import { TranslateService } from '@ngx-translate/core';
import { TaskWidgetSettingsService } from '../../config/task-widget-settings.service';

// TODO send message to electron when current task changes here

@Injectable()
export class TaskElectronEffects {
  private _actions$ = inject(LOCAL_ACTIONS);
  private _store$ = inject<Store<any>>(Store);
  private _configService = inject(GlobalConfigService);
  private _focusModeService = inject(FocusModeService);
  private _taskService = inject(TaskService);
  private _translateService = inject(TranslateService);
  private _taskWidgetSettingsService = inject(TaskWidgetSettingsService);

  // -----------------------------------------------------------------------------------
  // NOTE: IS_ELECTRON checks not necessary, since we check before importing this module
  // -----------------------------------------------------------------------------------

  constructor() {
    /**
     * SYNC-SAFE: This IPC listener is safe during sync/hydration because:
     * - Read-only operation - only reads current state and sends to Electron
     * - No store mutations or action dispatches
     * - Responds to explicit IPC request, not store-change driven
     * - take(1) ensures single response per request
     */
    window.ea.on(IPC.REQUEST_CURRENT_TASK_FOR_TASK_WIDGET, () => {
      this._store$
        .pipe(
          select(selectCurrentTask),
          withLatestFrom(
            this._store$.pipe(select(selectIsOverlayShown)),
            this._focusModeService.currentSessionTime$,
          ),
          // Only take the first value and complete
          take(1),
        )
        .subscribe(([current, isFocusModeEnabled, currentFocusSessionTime]) => {
          window.ea.updateCurrentTask(
            current,
            false, // isPomodoroEnabled - legacy, always false
            0, // currentPomodoroSessionTime - legacy, always 0
            isFocusModeEnabled,
            currentFocusSessionTime,
            this._focusModeService.mode(),
          );
        });
    });

    window.ea.onSwitchTask((taskId) => {
      if (typeof taskId !== 'string' || !taskId) {
        return;
      }
      if (this._taskService.currentTaskId() === taskId) {
        this._taskService.pauseCurrent();
      } else {
        this._taskService.setCurrentId(taskId);
      }
    });

    window.ea.on(IPC.TASK_WIDGET_COMPLETE_TASK, (_ev, taskId) => {
      if (typeof taskId !== 'string' || !taskId) {
        return;
      }
      if (this._taskService.currentTaskId() === taskId) {
        this._taskService.pauseCurrent();
      }
      this._store$.dispatch(
        TaskSharedActions.updateTask({
          task: { id: taskId, changes: { isDone: true } },
        }),
      );
    });

    window.ea.on(IPC.TASK_WIDGET_SET_ENABLED, (_ev, isEnabled) => {
      this._taskWidgetSettingsService.update({ isEnabled: !!isEnabled });
    });

    window.ea.on(IPC.TASK_WIDGET_EXTEND_TASK, (_ev, taskId, additionalTime) => {
      if (
        typeof taskId !== 'string' ||
        !taskId ||
        typeof additionalTime !== 'number' ||
        additionalTime < 60_000 ||
        additionalTime > 24 * 60 * 60 * 1000
      ) {
        return;
      }
      this._store$.pipe(select(selectTaskEntities), take(1)).subscribe((taskEntities) => {
        const task = taskEntities[taskId];
        if (!task) return;
        this._taskService.update(taskId, {
          timeEstimate: Math.max(task.timeEstimate, task.timeSpent) + additionalTime,
        });
      });
    });
  }

  syncTaskListsToElectron$ = createEffect(
    () =>
      combineLatest([
        this._store$.pipe(select(selectTodayTaskIds)),
        this._store$.pipe(select(selectTaskEntities)),
        this._store$.pipe(select(selectAllTasksInActiveProjects)),
      ]).pipe(
        tap(([todayTaskIds, taskEntities, allTasks]) => {
          const tasks = todayTaskIds
            .map((id) => taskEntities[id])
            .filter((t) => !!t && !t.isDone)
            .map((t) => mapTaskForTaskWidget(t!));
          window.ea.updateTodayTasks(tasks);
          window.ea.updateTaskWidgetTasks({
            panels: buildEisenhowerTaskWidgetPanels(allTasks, (title) =>
              this._translateService.instant(title),
            ),
          });
        }),
      ),
    { dispatch: false },
  );

  taskChangeElectron$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(
          setCurrentTask,
          unsetCurrentTask,
          TimeTrackingActions.addTimeSpent,
          showFocusOverlay,
          hideFocusOverlay,
          startFocusSession,
          cancelFocusSession,
          pauseFocusSession,
          unPauseFocusSession,
          completeFocusSession,
          // Keep tray time in sync during focus-mode breaks and focus sessions
          // without an active task (addTimeSpent is gated on currentTask.id).
          tick,
          TaskSharedActions.updateTask,
        ),
        // addTimeSpent and tick both fire every 1s during an active-task focus
        // session (same shared globalInterval source), so collapse them into a
        // single IPC/sec. Leading+trailing preserves immediate feedback for the
        // non-tick actions (setCurrentTask, startFocusSession, ...).
        throttleTime(500, undefined, { leading: true, trailing: true }),
        withLatestFrom(
          this._store$.pipe(select(selectCurrentTask)),
          this._store$.pipe(select(selectIsOverlayShown)),
          this._focusModeService.currentSessionTime$.pipe(startWith(0)),
        ),
        tap(([action, current, isFocusModeEnabled, currentFocusSessionTime]) => {
          window.ea.updateCurrentTask(
            current,
            false, // isPomodoroEnabled - legacy, always false
            0, // currentPomodoroSessionTime - legacy, always 0
            isFocusModeEnabled,
            currentFocusSessionTime,
            this._focusModeService.mode(),
          );
        }),
      ),
    { dispatch: false },
  );

  setTaskBarNoProgress$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(setCurrentTask),
        tap(({ id }) => {
          if (!id) {
            window.ea.setProgressBar({
              progress: -1,
              progressBarMode: 'none',
            });
          }
        }),
      ),
    { dispatch: false },
  );

  clearTaskBarOnTaskDone$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(TaskSharedActions.updateTask),
        tap(({ task }) => {
          if (task.changes.isDone) {
            window.ea.setProgressBar({
              progress: -1,
              progressBarMode: 'none',
            });
          }
        }),
      ),
    { dispatch: false },
  );

  setTaskBarProgress$ = createEffect(
    () =>
      this._actions$.pipe(
        ofType(TimeTrackingActions.addTimeSpent),
        // The OS taskbar progress bar moves imperceptibly per second; throttling
        // collapses 1 IPC/sec into ~1 IPC/3s. Leading+trailing keeps the first
        // tick after start instant and the final value at the end of a window.
        throttleTime(3000, undefined, { leading: true, trailing: true }),
        withLatestFrom(this._store$.select(selectIsOverlayShown)),
        // Don't show progress bar when focus session is running
        filter(([a, isFocusSessionRunning]) => !isFocusSessionRunning),
        tap(([{ task }]) => {
          const progress = task.timeSpent / task.timeEstimate;
          window.ea.setProgressBar({
            progress,
            progressBarMode: 'normal',
          });
        }),
      ),
    { dispatch: false },
  );

  handleAddTaskFromProtocol$ = createEffect(
    () =>
      ipcAddTaskFromAppUri$.pipe(
        tap((data) => {
          // Double-check data validity as defensive programming
          if (!data || !data.title || typeof data.title !== 'string') {
            TaskLog.err('handleAddTaskFromProtocol$ received invalid data', {
              hasData: !!data,
              titleType: typeof data?.title,
            });
            return;
          }
          this._taskService.add(data.title);
        }),
      ),
    { dispatch: false },
  );
}
