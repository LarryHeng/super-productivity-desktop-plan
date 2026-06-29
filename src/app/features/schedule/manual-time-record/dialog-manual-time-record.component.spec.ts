import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { SnackService } from '../../../core/snack/snack.service';
import { DateService } from '../../../core/date/date.service';
import { DEFAULT_TASK, Task } from '../../tasks/task.model';
import { TaskService } from '../../tasks/task.service';
import { DialogManualTimeRecordComponent } from './dialog-manual-time-record.component';

describe('DialogManualTimeRecordComponent', () => {
  let taskService: jasmine.SpyObj<TaskService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogManualTimeRecordComponent>>;

  const task = {
    ...DEFAULT_TASK,
    id: 'task-1',
    projectId: 'INBOX',
    title: 'Task',
    timeEstimate: 60 * 60 * 1000,
    timeSpent: 15 * 60 * 1000,
  } as Task;
  const start = new Date(2026, 5, 28, 9, 0).getTime();
  const end = new Date(2026, 5, 28, 9, 30).getTime();

  beforeEach(async () => {
    taskService = jasmine.createSpyObj<TaskService>(
      'TaskService',
      ['addManualTimeSegment', 'update'],
      {
        activeActualTimeSegment: signal(null),
      },
    );
    dialogRef = jasmine.createSpyObj<MatDialogRef<DialogManualTimeRecordComponent>>(
      'MatDialogRef',
      ['close'],
    );

    await TestBed.configureTestingModule({
      imports: [
        DialogManualTimeRecordComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideMockStore({
          initialState: {
            timeTracking: {
              project: {},
              tag: {},
              taskSegments: {},
            },
          },
        }),
        { provide: TaskService, useValue: taskService },
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: SnackService,
          useValue: jasmine.createSpyObj('SnackService', ['open']),
        },
        { provide: DateService, useValue: { todayStr: () => '2026-06-29' } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { task, start, end, isFromPlannedBlock: true },
        },
      ],
    })
      .overrideComponent(DialogManualTimeRecordComponent, { set: { template: '' } })
      .compileComponents();
  });

  it('records the planned interval and preserves requested remaining work', () => {
    const component = TestBed.createComponent(
      DialogManualTimeRecordComponent,
    ).componentInstance;
    component.continuation = 'continue';
    component.remainingEstimate = 20 * 60 * 1000;

    component.submit();

    expect(taskService.addManualTimeSegment).toHaveBeenCalledWith(task, start, end);
    expect(taskService.update).toHaveBeenCalledWith(task.id, {
      isDone: false,
      timeEstimate: 65 * 60 * 1000,
    });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('marks the task done while retaining the recorded block', () => {
    const component = TestBed.createComponent(
      DialogManualTimeRecordComponent,
    ).componentInstance;
    component.continuation = 'done';

    component.submit();

    expect(taskService.addManualTimeSegment).toHaveBeenCalledWith(task, start, end);
    expect(taskService.update).toHaveBeenCalledWith(task.id, {
      isDone: true,
      timeEstimate: 45 * 60 * 1000,
    });
  });
});
