import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../../t.const';
import { DailySettlementService } from '../../daily-settlement/daily-settlement.service';

@Component({
  selector: 'finish-day-btn',
  templateUrl: './finish-day-btn.component.html',
  styleUrls: ['./finish-day-btn.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatIcon, MatTooltip, TranslatePipe],
})
export class FinishDayBtnComponent {
  private readonly _dailySettlementService = inject(DailySettlementService);
  private readonly _router = inject(Router);

  hasDoneTasks = input.required<boolean>();
  readonly isSettling = signal(false);
  T = T;

  async finishDay(): Promise<void> {
    if (this.isSettling()) {
      return;
    }
    this.isSettling.set(true);
    try {
      await this._dailySettlementService.settleCompletedTasks();
      await this._router.navigateByUrl('/active/daily-summary');
    } finally {
      this.isSettling.set(false);
    }
  }
}
