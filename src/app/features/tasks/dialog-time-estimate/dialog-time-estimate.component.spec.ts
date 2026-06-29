import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { DEFAULT_TASK, Task } from '../task.model';
import { TaskService } from '../task.service';
import { DialogTimeEstimateComponent } from './dialog-time-estimate.component';

describe('DialogTimeEstimateComponent estimate-only mode', () => {
  let taskService: jasmine.SpyObj<TaskService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogTimeEstimateComponent>>;

  const task = {
    ...DEFAULT_TASK,
    id: 'task-1',
    projectId: 'INBOX',
    title: 'Test task',
    timeEstimate: 30 * 60 * 1000,
    timeSpentOnDay: {
      ['2026-06-29']: 10 * 60 * 1000,
    },
  } as Task;

  beforeEach(async () => {
    taskService = jasmine.createSpyObj<TaskService>('TaskService', ['update']);
    dialogRef = jasmine.createSpyObj<MatDialogRef<DialogTimeEstimateComponent>>(
      'MatDialogRef',
      ['close'],
    );

    await TestBed.configureTestingModule({
      imports: [
        DialogTimeEstimateComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MatDialog, useValue: jasmine.createSpyObj('MatDialog', ['open']) },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { task, isEstimateOnly: true },
        },
      ],
    }).compileComponents();
  });

  it('shows only the estimate editor', () => {
    const fixture = TestBed.createComponent(DialogTimeEstimateComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('input-duration-slider').length).toBe(
      1,
    );
    expect(fixture.nativeElement.querySelector('.other-days')).toBeNull();
  });

  it('updates only the estimate', () => {
    const component = TestBed.createComponent(
      DialogTimeEstimateComponent,
    ).componentInstance;
    component.taskCopy.timeEstimate = 45 * 60 * 1000;

    component.submit();

    expect(taskService.update).toHaveBeenCalledWith(task.id, {
      timeEstimate: 45 * 60 * 1000,
    });
    expect(dialogRef.close).toHaveBeenCalledWith({
      timeEstimate: 45 * 60 * 1000,
    });
  });
});
