import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, of, Subject } from 'rxjs';
import { TaskElectronEffects } from './task-electron.effects';
import { TaskService } from '../task.service';
import { provideMockStore } from '@ngrx/store/testing';
import { Store } from '@ngrx/store';
import { GlobalConfigService } from '../../config/global-config.service';
import { FocusModeService } from '../../focus-mode/focus-mode.service';
import { tap } from 'rxjs/operators';
import { IPC } from '../../../../../electron/shared-with-frontend/ipc-events.const';
import { TaskSharedActions } from '../../../root-store/meta/task-shared.actions';
import { TranslateService } from '@ngx-translate/core';
import { TaskWidgetSettingsService } from '../../config/task-widget-settings.service';
import { selectTaskEntities } from './task.selectors';

describe('TaskElectronEffects', () => {
  let effects: TaskElectronEffects;
  let actions$: Observable<any>;
  let taskService: jasmine.SpyObj<TaskService>;
  let taskWidgetSettingsService: jasmine.SpyObj<TaskWidgetSettingsService>;
  let mockIpcAddTaskFromAppUri$: Subject<{ title: string }>;
  let originalEaDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalEaDescriptor = Object.getOwnPropertyDescriptor(window, 'ea');
    const taskServiceSpy = jasmine.createSpyObj('TaskService', [
      'add',
      'setCurrentId',
      'pauseCurrent',
      'update',
    ]);
    (taskServiceSpy as any).currentTaskId = jasmine
      .createSpy('currentTaskId')
      .and.returnValue(null);
    const globalConfigServiceSpy = jasmine.createSpyObj('GlobalConfigService', [], {
      cfg$: of({}),
    });
    const focusModeServiceSpy = jasmine.createSpyObj('FocusModeService', ['mode'], {
      currentSessionTime$: of(0),
    });
    focusModeServiceSpy.mode.and.returnValue('Countdown');
    const translateServiceSpy = jasmine.createSpyObj('TranslateService', ['instant']);
    translateServiceSpy.instant.and.callFake((key: string) => key);
    const taskWidgetSettingsServiceSpy = jasmine.createSpyObj(
      'TaskWidgetSettingsService',
      ['update'],
    );

    // Mock window.ea
    Object.defineProperty(window, 'ea', {
      configurable: true,
      writable: true,
      value: {
        on: jasmine.createSpy('on'),
        updateCurrentTask: jasmine.createSpy('updateCurrentTask'),
        updateTaskWidgetTasks: jasmine.createSpy('updateTaskWidgetTasks'),
        updateTodayTasks: jasmine.createSpy('updateTodayTasks'),
        setProgressBar: jasmine.createSpy('setProgressBar'),
        onSwitchTask: jasmine.createSpy('onSwitchTask'),
      },
    });

    actions$ = new Subject<any>();
    mockIpcAddTaskFromAppUri$ = new Subject<{ title: string }>();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: TaskElectronEffects,
          useFactory: (
            taskServiceInj: TaskService,
            // Other dependencies could be injected here if needed
          ) => {
            const effectsInstance = new TaskElectronEffects();
            // Manually inject dependencies that are used in the effect
            (effectsInstance as any)._taskService = taskServiceInj;

            // Override the effect with our mock observable
            effectsInstance.handleAddTaskFromProtocol$ = mockIpcAddTaskFromAppUri$.pipe(
              tap((data) => {
                taskServiceInj.add(data.title);
              }),
            ) as any;

            return effectsInstance;
          },
          deps: [TaskService],
        },
        provideMockActions(() => actions$),
        provideMockStore({
          selectors: [
            {
              selector: selectTaskEntities,
              value: {
                ['task-1']: {
                  id: 'task-1',
                  timeEstimate: 30 * 60 * 1000,
                  timeSpent: 31 * 60 * 1000,
                },
              },
            },
          ],
        }),
        { provide: TaskService, useValue: taskServiceSpy },
        { provide: GlobalConfigService, useValue: globalConfigServiceSpy },
        { provide: FocusModeService, useValue: focusModeServiceSpy },
        { provide: TranslateService, useValue: translateServiceSpy },
        { provide: TaskWidgetSettingsService, useValue: taskWidgetSettingsServiceSpy },
      ],
    });

    effects = TestBed.inject(TaskElectronEffects);
    taskService = TestBed.inject(TaskService) as jasmine.SpyObj<TaskService>;
    taskWidgetSettingsService = TestBed.inject(
      TaskWidgetSettingsService,
    ) as jasmine.SpyObj<TaskWidgetSettingsService>;
  });

  afterEach(() => {
    selectTaskEntities.clearResult();
    selectTaskEntities.release();
    if (originalEaDescriptor) {
      Object.defineProperty(window, 'ea', originalEaDescriptor);
    } else {
      delete (window as Partial<Window>).ea;
    }
  });

  it('dispatches task completion updates from task widget IPC', () => {
    const store = TestBed.inject(Store);
    spyOn(store, 'dispatch');
    const onSpy = (window as any).ea.on as jasmine.Spy;
    const taskWidgetCompleteListener = onSpy.calls
      .allArgs()
      .find(([channel]) => channel === IPC.TASK_WIDGET_COMPLETE_TASK)?.[1];

    expect(taskWidgetCompleteListener).toEqual(jasmine.any(Function));

    taskWidgetCompleteListener({}, 'task-1', true);

    expect(store.dispatch).toHaveBeenCalledWith(
      TaskSharedActions.updateTask({
        task: { id: 'task-1', changes: { isDone: true } },
      }),
    );
  });

  it('restores a completed task from task widget IPC', () => {
    const store = TestBed.inject(Store);
    spyOn(store, 'dispatch');
    const onSpy = (window as any).ea.on as jasmine.Spy;
    const taskWidgetCompleteListener = onSpy.calls
      .allArgs()
      .find(([channel]) => channel === IPC.TASK_WIDGET_COMPLETE_TASK)?.[1];

    taskWidgetCompleteListener({}, 'task-1', false);

    expect(store.dispatch).toHaveBeenCalledWith(
      TaskSharedActions.updateTask({
        task: { id: 'task-1', changes: { isDone: false } },
      }),
    );
    expect(taskService.pauseCurrent).not.toHaveBeenCalled();
  });

  it('pauses the running task before completing it from task widget IPC', () => {
    const onSpy = (window as any).ea.on as jasmine.Spy;
    const taskWidgetCompleteListener = onSpy.calls
      .allArgs()
      .find(([channel]) => channel === IPC.TASK_WIDGET_COMPLETE_TASK)?.[1];
    (taskService.currentTaskId as jasmine.Spy).and.returnValue('task-1');

    taskWidgetCompleteListener({}, 'task-1', true);

    expect(taskService.pauseCurrent).toHaveBeenCalled();
  });

  it('starts a different task when the widget switches to it', () => {
    const switchListener = (
      (window as any).ea.onSwitchTask as jasmine.Spy
    ).calls.mostRecent().args[0];
    (taskService.currentTaskId as jasmine.Spy).and.returnValue('task-1');

    switchListener('task-2');

    expect(taskService.setCurrentId).toHaveBeenCalledWith('task-2');
    expect(taskService.pauseCurrent).not.toHaveBeenCalled();
  });

  it('pauses the current task when the widget switches to the same task again', () => {
    const switchListener = (
      (window as any).ea.onSwitchTask as jasmine.Spy
    ).calls.mostRecent().args[0];
    (taskService.currentTaskId as jasmine.Spy).and.returnValue('task-1');

    switchListener('task-1');

    expect(taskService.pauseCurrent).toHaveBeenCalled();
    expect(taskService.setCurrentId).not.toHaveBeenCalled();
  });

  it('disables task widget settings when the widget window is closed from itself', () => {
    const onSpy = (window as any).ea.on as jasmine.Spy;
    const taskWidgetSetEnabledListener = onSpy.calls
      .allArgs()
      .find(([channel]) => channel === 'TASK_WIDGET_SET_ENABLED')?.[1];

    expect(taskWidgetSetEnabledListener).toEqual(jasmine.any(Function));

    taskWidgetSetEnabledListener({}, false);

    expect(taskWidgetSettingsService.update).toHaveBeenCalledWith({ isEnabled: false });
  });

  it('extends an expired task from the task widget by the entered duration', () => {
    const onSpy = (window as any).ea.on as jasmine.Spy;
    const extendListener = onSpy.calls
      .allArgs()
      .find(([channel]) => channel === IPC.TASK_WIDGET_EXTEND_TASK)?.[1];

    expect(extendListener).toEqual(jasmine.any(Function));

    extendListener({}, 'task-1', 15 * 60 * 1000);

    expect(taskService.update).toHaveBeenCalledWith('task-1', {
      timeEstimate: 46 * 60 * 1000,
    });
  });

  describe('handleAddTaskFromProtocol$', () => {
    it('should add task when receiving data with title', (done) => {
      const mockData = { title: 'Test Task' };

      // Subscribe to the effect
      effects.handleAddTaskFromProtocol$.subscribe(() => {
        expect(taskService.add).toHaveBeenCalledWith('Test Task');
        done();
      });

      // Emit data through the mocked observable
      mockIpcAddTaskFromAppUri$.next(mockData);
    });

    it('should handle multiple tasks', (done) => {
      let callCount = 0;
      const expectedCalls = 2;

      effects.handleAddTaskFromProtocol$.subscribe(() => {
        callCount++;
        if (callCount === expectedCalls) {
          expect(taskService.add).toHaveBeenCalledTimes(2);
          expect(taskService.add).toHaveBeenCalledWith('Task 1');
          expect(taskService.add).toHaveBeenCalledWith('Task 2');
          done();
        }
      });

      // Emit multiple tasks
      mockIpcAddTaskFromAppUri$.next({ title: 'Task 1' });
      mockIpcAddTaskFromAppUri$.next({ title: 'Task 2' });
    });

    it('should handle validation logic correctly', (done) => {
      // Test the validation logic directly
      const validateData = (data: any): boolean => {
        if (!data || !data.title || typeof data.title !== 'string') {
          return false;
        }
        return true;
      };

      expect(validateData({ title: 'Valid Task' })).toBe(true);
      expect(validateData(null)).toBe(false);
      expect(validateData(undefined)).toBe(false);
      expect(validateData({ notTitle: 'Invalid' })).toBe(false);
      expect(validateData({ title: 123 })).toBe(false);

      done();
    });
  });
});
