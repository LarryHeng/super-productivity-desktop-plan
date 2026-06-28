import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { Observable } from 'rxjs';
import { PlannerDay } from '../planner.model';
import { PlannerService } from '../planner.service';
import { PlannerDayComponent } from '../planner-day/planner-day.component';
import { AsyncPipe } from '@angular/common';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { parseDbDateStr } from '../../../util/parse-db-date-str';

@Component({
  selector: 'planner-plan-view',
  templateUrl: './planner-plan-view.component.html',
  styleUrl: './planner-plan-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlannerDayComponent, AsyncPipe],
})
export class PlannerPlanViewComponent {
  private _plannerService = inject(PlannerService);
  private _destroyRef = inject(DestroyRef);
  private _globalTrackingIntervalService = inject(GlobalTrackingIntervalService);

  readonly overdueDays = input<ReadonlySet<string>>(new Set());
  days$: Observable<PlannerDay[]> = this._plannerService.days$;
  visibleDayDate = signal<string | null>(
    this._globalTrackingIntervalService.todayDateStr(),
  );

  constructor() {
    this._destroyRef.onDestroy(() => {
      this._plannerService.resetScrollState();
    });
  }

  scrollToDay(dayDate: string): void {
    this.visibleDayDate.set(dayDate);
    this._plannerService.showWeekContaining(dayDate);
  }

  shiftWeek(offset: number): void {
    this._plannerService.shiftWeek(offset);
    const current = this.visibleDayDate();
    const date = parseDbDateStr(
      current ?? this._globalTrackingIntervalService.todayDateStr(),
    );
    const dayOffset = offset * 7;
    date.setDate(date.getDate() + dayOffset);
    this.visibleDayDate.set(getDbDateStr(date));
  }

  showCurrentWeek(): void {
    const today = this._globalTrackingIntervalService.todayDateStr();
    this.visibleDayDate.set(today);
    this._plannerService.showCurrentWeek();
  }
}
