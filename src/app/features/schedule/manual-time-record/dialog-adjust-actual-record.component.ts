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
import { MatIcon } from '@angular/material/icon';
import { Task } from '../../tasks/task.model';

export interface DialogAdjustActualRecordData {
  taskTitle: string;
  currentDurationMs: number;
  /** Hard upper bound — original duration at segment creation time */
  maxDurationMs: number;
  startTimestamp: number;
  dayStr: string;
  task: Task;
}

@Component({
  selector: 'dialog-adjust-actual-record',
  templateUrl: './dialog-adjust-actual-record.component.html',
  styleUrls: ['./dialog-adjust-actual-record.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatIcon,
  ],
})
export class DialogAdjustActualRecordComponent {
  readonly data = inject<DialogAdjustActualRecordData>(MAT_DIALOG_DATA);
  private readonly _dialogRef =
    inject<MatDialogRef<DialogAdjustActualRecordComponent>>(MatDialogRef);

  maxDurationMs: number;
  durationInput = '';
  parsedMs = 0;
  errorMsg = '';

  constructor() {
    this.maxDurationMs = this.data.maxDurationMs || this.data.currentDurationMs;
    this.durationInput = this._msToInput(this.data.currentDurationMs);
    this.parsedMs = this.data.currentDurationMs;
  }

  get maxMinutes(): number {
    return Math.round(this.maxDurationMs / 60000);
  }

  get isValid(): boolean {
    return this.parsedMs > 0 && this.parsedMs <= this.maxDurationMs;
  }

  formatDuration(ms: number): string {
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  get startTimeStr(): string {
    const d = new Date(this.data.startTimestamp);
    return (
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    );
  }

  parseDuration(): void {
    this.errorMsg = '';
    const input = this.durationInput.trim();
    if (!input) {
      this.parsedMs = 0;
      return;
    }
    const ms = this._parseDuration(input);
    if (ms === null) {
      this.errorMsg = '格式错误，请使用例如 1h 30m 或 90m 的格式';
      this.parsedMs = 0;
      return;
    }
    this.parsedMs = ms;
    if (ms <= 0) {
      this.errorMsg = '时长必须大于0';
    } else if (ms > this.maxDurationMs) {
      this.errorMsg = `不得超过最大时长 ${this.formatDuration(this.maxDurationMs)}`;
    }
  }

  private _msToInput(ms: number): string {
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  private _parseDuration(input: string): number | null {
    input = input.replace(/\s+/g, '').toLowerCase();
    // e.g. "1h30m", "1h", "30m", "90"
    let totalMin = 0;
    let matched = false;
    const hMatch = input.match(/^(\d+)h/);
    if (hMatch) {
      totalMin += Number.parseInt(hMatch[1], 10) * 60;
      input = input.slice(hMatch[0].length);
      matched = true;
    }
    const mMatch = input.match(/^(\d+)m/);
    if (mMatch) {
      totalMin += Number.parseInt(mMatch[1], 10);
      input = input.slice(mMatch[0].length);
      matched = true;
    }
    if (!matched) {
      const rawMatch = input.match(/^(\d+)$/);
      if (rawMatch) {
        totalMin = Number.parseInt(rawMatch[1], 10);
        matched = true;
      }
    }
    if (!matched || input.length > 0) return null;
    return totalMin * 60 * 1000;
  }

  save(): void {
    if (!this.isValid) return;
    this._dialogRef.close({ action: 'save', newDurationMs: this.parsedMs });
  }

  deleteRecord(): void {
    this._dialogRef.close({ action: 'delete' });
  }

  cancel(): void {
    this._dialogRef.close(undefined);
  }
}
