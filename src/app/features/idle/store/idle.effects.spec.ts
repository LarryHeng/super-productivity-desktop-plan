import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { Action } from '@ngrx/store';
import { EMPTY, of, Subject } from 'rxjs';
import { IdleEffects } from './idle.effects';
import { idleDialogResult, resetIdle } from './idle.actions';
import { LOCAL_ACTIONS } from '../../../util/local-actions.token';
import { ChromeExtensionInterfaceService } from '../../../core/chrome-extension-interface/chrome-extension-interface.service';
import { WorkContextService } from '../../work-context/work-context.service';
import { TaskService } from '../../tasks/task.service';
import { SimpleCounterService } from '../../simple-counter/simple-counter.service';
import { MatDialog } from '@angular/material/dialog';
import { UiHelperService } from '../../ui-helper/ui-helper.service';
import { DateService } from '../../../core/date/date.service';
import { DataInitStateService } from '../../../core/data-init/data-init-state.service';
import { Task } from '../../tasks/task.model';

describe('IdleEffects', () => {
  let actions$: Subject<Action>;
  let effects: IdleEffects;
  let taskService: jasmine.SpyObj<TaskService>;

  beforeEach(() => {
    actions$ = new Subject<Action>();
    taskService = jasmine.createSpyObj('TaskService', [
      'add',
      'addActualTimeSegment',
      'addTimeSpentAndSync',
      'currentTaskId',
      'removeTimeSpent',
      'setCurrentId',
    ]);

    TestBed.configureTestingModule({
      providers: [
        IdleEffects,
        provideMockActions(() => actions$),
        provideMockStore(),
        { provide: LOCAL_ACTIONS, useValue: actions$ },
        {
          provide: ChromeExtensionInterfaceService,
          useValue: { onReady$: EMPTY, addEventListener: jasmine.createSpy() },
        },
        {
          provide: WorkContextService,
          useValue: { addToBreakTimeForActiveContext: jasmine.createSpy() },
        },
        { provide: TaskService, useValue: taskService },
        {
          provide: SimpleCounterService,
          useValue: {
            enabledSimpleStopWatchCounters$: of([]),
            update: jasmine.createSpy(),
            decreaseCounterToday: jasmine.createSpy(),
          },
        },
        { provide: MatDialog, useValue: { open: jasmine.createSpy() } },
        {
          provide: UiHelperService,
          useValue: { focusAppAfterNotification: jasmine.createSpy() },
        },
        {
          provide: DateService,
          useValue: { todayStr: () => '2026-06-27' },
        },
        {
          provide: DataInitStateService,
          useValue: { isAllDataLoadedInitially$: EMPTY },
        },
      ],
    });

    effects = TestBed.inject(IdleEffects);
  });

  it('adds the entire idle interval to an existing task without starting it', () => {
    const task = { id: 'task-1', title: 'Existing task' } as Task;
    const idleMinutes = 46 * 60 * 1000;
    const idleSeconds = 4 * 1000;
    const idleTime = idleMinutes + idleSeconds;
    const emitted: Action[] = [];
    effects.handleIdleDialogResult$.subscribe((action) => emitted.push(action));

    actions$.next(
      idleDialogResult({
        idleTime,
        isResetBreakTimer: false,
        wasFocusSessionRunning: false,
        trackItems: [
          {
            type: 'TASK',
            time: 'IDLE_TIME',
            task,
            simpleCounterToggleBtns: [],
          },
        ],
      }),
    );

    expect(taskService.addTimeSpentAndSync).toHaveBeenCalledOnceWith(task, idleTime);
    expect(taskService.addActualTimeSegment).toHaveBeenCalledOnceWith(task.id, idleTime);
    expect(taskService.setCurrentId).not.toHaveBeenCalled();
    expect(emitted).toEqual([resetIdle()]);
  });

  it('records the idle interval as actual history for a newly created task', () => {
    const idleTime = 15 * 60 * 1000;
    taskService.add.and.returnValue('new-task');
    effects.handleIdleDialogResult$.subscribe();

    actions$.next(
      idleDialogResult({
        idleTime,
        isResetBreakTimer: false,
        wasFocusSessionRunning: false,
        trackItems: [
          {
            type: 'TASK',
            time: 'IDLE_TIME',
            title: 'New task',
            simpleCounterToggleBtns: [],
          },
        ],
      }),
    );

    expect(taskService.addActualTimeSegment).toHaveBeenCalledOnceWith(
      'new-task',
      idleTime,
    );
    expect(taskService.setCurrentId).not.toHaveBeenCalled();
  });
});
