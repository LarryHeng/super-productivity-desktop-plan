import { inject, Injectable, OnDestroy } from '@angular/core';
import { merge, Subscription, timer } from 'rxjs';
import { first, switchMap } from 'rxjs/operators';
import { DateService } from '../../core/date/date.service';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { Log } from '../../core/log';
import { DailySettlementService } from './daily-settlement.service';

export const LAST_AUTO_DAILY_SETTLEMENT_BOUNDARY_KEY =
  'sp_last_auto_daily_settlement_boundary';

const AUTO_SETTLEMENT_CHECK_INTERVAL_MS = 60 * 1000;

export const getDailySettlementBoundaryMs = (
  now: number,
  startOfNextDayDiffMs: number,
): number => {
  const logicalToday = new Date(now - startOfNextDayDiffMs);
  return (
    new Date(
      logicalToday.getFullYear(),
      logicalToday.getMonth(),
      logicalToday.getDate(),
    ).getTime() + startOfNextDayDiffMs
  );
};

@Injectable({
  providedIn: 'root',
})
export class DailySettlementSchedulerService implements OnDestroy {
  private readonly _dailySettlementService = inject(DailySettlementService);
  private readonly _dateService = inject(DateService);
  private readonly _dataInitStateService = inject(DataInitStateService);
  private readonly _globalTrackingIntervalService = inject(GlobalTrackingIntervalService);
  private _sub?: Subscription;

  init(): void {
    if (this._sub) {
      return;
    }

    this._sub = this._dataInitStateService.isAllDataLoadedInitially$
      .pipe(
        first(),
        switchMap(() =>
          merge(
            timer(0, AUTO_SETTLEMENT_CHECK_INTERVAL_MS),
            this._globalTrackingIntervalService.todayDateStr$,
          ),
        ),
      )
      .subscribe(() => {
        this.checkAutoSettlement().catch((err) =>
          Log.err('[DailySettlementScheduler] Automatic settlement failed:', err),
        );
      });
  }

  async checkAutoSettlement(now: number = Date.now()): Promise<void> {
    const boundaryMs = getDailySettlementBoundaryMs(
      now,
      this._dateService.getStartOfNextDayDiffMs(),
    );
    const boundaryKey = String(boundaryMs);
    if (this._getLastSettledBoundary() === boundaryKey) {
      return;
    }

    await this._dailySettlementService.settleCompletedTasks({
      doneBefore: boundaryMs,
      isShowSnack: false,
    });
    this._setLastSettledBoundary(boundaryKey);
  }

  ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  private _getLastSettledBoundary(): string | null {
    return typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(LAST_AUTO_DAILY_SETTLEMENT_BOUNDARY_KEY);
  }

  private _setLastSettledBoundary(boundaryKey: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_AUTO_DAILY_SETTLEMENT_BOUNDARY_KEY, boundaryKey);
    }
  }
}
