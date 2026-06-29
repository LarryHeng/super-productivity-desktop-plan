import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { formatLocalIsoWithoutSeconds } from '../../../util/format-local-iso-without-seconds';
import { T } from '../../../t.const';
import { SnackService } from '../../../core/snack/snack.service';
import { DateService } from '../../../core/date/date.service';
import { InputDurationSliderComponent } from '../../../ui/duration/input-duration-slider/input-duration-slider.component';
import { Task } from '../../tasks/task.model';
import { SelectTaskComponent } from '../../tasks/select-task/select-task.component';
import { TaskService } from '../../tasks/task.service';
import { selectTimeTrackingState } from '../../time-tracking/store/time-tracking.selectors';
import {
  getTaskUpdateAfterManualRecord,
  ManualRecordContinuation,
  validateManualTimeRange,
} from './manual-time-record.util';

const DEFAULT_MANUAL_RECORD_DURATION = 30 * 60 * 1000;

export interface DialogManualTimeRecordData {
  task?: Task;
  start?: number;
  end?: number;
  isFromPlannedBlock?: boolean;
}

@Component({
  selector: 'dialog-manual-time-record',
  templateUrl: './dialog-manual-time-record.component.html',
  styleUrls: ['./dialog-manual-time-record.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatIcon,
    MatRadioGroup,
    MatRadioButton,
    TranslatePipe,
    SelectTaskComponent,
    InputDurationSliderComponent,
  ],
})
export class DialogManualTimeRecordComponent {
  readonly T = T;
  readonly data = inject<DialogManualTimeRecordData>(MAT_DIALOG_DATA);
  private readonly _dialogRef =
    inject<MatDialogRef<DialogManualTimeRecordComponent>>(MatDialogRef);
  private readonly _taskService = inject(TaskService);
  private readonly _store = inject(Store);
  private readonly _dateService = inject(DateService);
  private readonly _snackService = inject(SnackService);
  private readonly _timeTrackingState = this._store.selectSignal(selectTimeTrackingState);

  selectedTask: Task | null = this.data.task ?? null;
  startValue: string;
  endValue: string;
  continuation: ManualRecordContinuation | null = null;
  remainingEstimate = 25 * 60 * 1000;
  errorKey: string | null = null;

  constructor() {
    const end = this.data.end ?? Date.now();
    const start = this.data.start ?? end - DEFAULT_MANUAL_RECORD_DURATION;
    this.startValue = formatLocalIsoWithoutSeconds(start);
    this.endValue = formatLocalIsoWithoutSeconds(end);

    if (this.data.task && this.data.isFromPlannedBlock) {
      this.remainingEstimate = Math.max(
        0,
        this.data.task.timeEstimate - this.data.task.timeSpent - Math.max(0, end - start),
      );
    }
  }

  selectTask(taskOrTitle: Task | string): void {
    this.selectedTask = typeof taskOrTitle === 'string' ? null : taskOrTitle;
  }

  cancel(): void {
    this._dialogRef.close();
  }

  submit(): void {
    this.errorKey = null;
    const task = this.selectedTask;
    const start = new Date(this.startValue).getTime();
    const end = new Date(this.endValue).getTime();
    if (!task) {
      this.errorKey = T.F.SCHEDULE.MANUAL_RECORD_TASK_REQUIRED;
      return;
    }
    if (this._dateService.todayStr(start) !== this._dateService.todayStr(end)) {
      this.errorKey = T.F.SCHEDULE.MANUAL_RECORD_SAME_DAY;
      return;
    }
    if (this.data.isFromPlannedBlock && !this.continuation) {
      this.errorKey = T.F.SCHEDULE.MANUAL_RECORD_CONTINUATION_REQUIRED;
      return;
    }

    const state = this._timeTrackingState();
    const existingSegments = Object.values(state?.taskSegments ?? {}).flat();
    const rangeError = validateManualTimeRange(
      start,
      end,
      existingSegments,
      this._taskService.activeActualTimeSegment(),
    );
    if (rangeError) {
      this.errorKey =
        rangeError === 'overlap'
          ? T.F.SCHEDULE.MANUAL_RECORD_OVERLAP
          : rangeError === 'future'
            ? T.F.SCHEDULE.MANUAL_RECORD_FUTURE
            : T.F.SCHEDULE.MANUAL_RECORD_INVALID;
      return;
    }

    const duration = end - start;
    this._taskService.addManualTimeSegment(task, start, end);
    if (this.data.isFromPlannedBlock && this.continuation) {
      this._taskService.update(
        task.id,
        getTaskUpdateAfterManualRecord(
          task,
          duration,
          this.continuation,
          this.remainingEstimate,
        ),
      );
    }
    this._snackService.open({
      msg: T.F.SCHEDULE.MANUAL_RECORD_SAVED,
      type: 'SUCCESS',
    });
    this._dialogRef.close(true);
  }
}
