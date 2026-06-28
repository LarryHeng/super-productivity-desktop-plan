import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { DateService } from '../../core/date/date.service';
import { PlannerActions } from './store/planner.actions';
import {
  selectTaskFeatureState,
  selectUndoneOverdue,
  selectUndoneOverdueDeadlineTasks,
} from '../tasks/store/task.selectors';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { T } from '../../t.const';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { PlannerPlanViewComponent } from './planner-plan-view/planner-plan-view.component';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { PlannerCalendarNavComponent } from './planner-calendar-nav/planner-calendar-nav.component';
import { PlannerService } from './planner.service';
import { LayoutService } from '../../core-ui/layout/layout.service';
import { MatIcon } from '@angular/material/icon';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { parseDbDateStr } from '../../util/parse-db-date-str';
import { getDbDateStr } from '../../util/get-db-date-str';
import { getPlannerWeekStart } from './util/get-planner-week-start';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { selectPlannerState } from './store/planner.selectors';
import { plannerInitialState } from './store/planner.reducer';
import { PlannerMonthComponent } from './planner-month/planner-month.component';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'planner',
  templateUrl: './planner.component.html',
  styleUrl: './planner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDropListGroup,
    PlannerPlanViewComponent,
    CdkScrollable,
    PlannerCalendarNavComponent,
    MatIcon,
    MatButton,
    MatIconButton,
    MatTooltip,
    TranslatePipe,
    PlannerMonthComponent,
  ],
})
export class PlannerComponent {
  private _store = inject(Store);
  private _dateService = inject(DateService);
  private _plannerService = inject(PlannerService);
  private _globalTrackingIntervalService = inject(GlobalTrackingIntervalService);
  layoutService = inject(LayoutService);

  readonly T = T;
  private _planView = viewChild(PlannerPlanViewComponent);
  readonly plannerView = signal<'week' | 'month'>('week');
  readonly isMonthView = computed(() => this.plannerView() === 'month');

  private _days = toSignal(this._plannerService.days$, { initialValue: [] });
  private _plannerState = toSignal(this._store.select(selectPlannerState), {
    initialValue: plannerInitialState,
  });
  private _overdueTasks = toSignal(this._store.select(selectUndoneOverdue), {
    initialValue: [],
  });
  private _overdueDeadlineTasks = toSignal(
    this._store.select(selectUndoneOverdueDeadlineTasks),
    { initialValue: [] },
  );
  private _weekStart = toSignal(this._plannerService.selectedWeekStart$, {
    initialValue: getDbDateStr(
      getPlannerWeekStart(
        parseDbDateStr(this._globalTrackingIntervalService.todayDateStr()),
      ),
    ),
  });
  private _selectedMonth = signal(
    new Date(
      parseDbDateStr(this._globalTrackingIntervalService.todayDateStr()).getFullYear(),
      parseDbDateStr(this._globalTrackingIntervalService.todayDateStr()).getMonth(),
      1,
    ),
  );
  readonly monthDaysToShow = computed(() => {
    const month = this._selectedMonth();
    const cursor = getPlannerWeekStart(
      new Date(month.getFullYear(), month.getMonth(), 1),
    );
    return Array.from({ length: 42 }, () => {
      const day = getDbDateStr(cursor);
      cursor.setDate(cursor.getDate() + 1);
      return day;
    });
  });
  readonly monthDays = toSignal(
    toObservable(this.monthDaysToShow).pipe(
      switchMap((days) => this._plannerService.getDaysForDates$(days)),
    ),
    { initialValue: [] },
  );
  readonly monthLabel = computed(() =>
    this._selectedMonth().toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    }),
  );
  weekLabel = computed(() => {
    const start = parseDbDateStr(this._weekStart());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })} - ${end.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  });
  isCurrentWeek = computed(() => {
    const currentWeekStart = getDbDateStr(
      getPlannerWeekStart(
        parseDbDateStr(this._globalTrackingIntervalService.todayDateStr()),
      ),
    );
    return this._weekStart() === currentWeekStart;
  });
  isCurrentPeriod = computed(() => {
    if (!this.isMonthView()) {
      return this.isCurrentWeek();
    }
    const selected = this._selectedMonth();
    const today = parseDbDateStr(this._globalTrackingIntervalService.todayDateStr());
    return (
      selected.getFullYear() === today.getFullYear() &&
      selected.getMonth() === today.getMonth()
    );
  });
  private _prevDaysWithTasksKey = '';
  private _prevDaysWithTasks: ReadonlySet<string> = new Set();
  daysWithTasks = computed<ReadonlySet<string>>(() => {
    const days = this._days();
    const dayDates = new Set(
      Object.entries(this._plannerState()?.days ?? {})
        .filter(([, taskIds]) => taskIds.length > 0)
        .map(([dayDate]) => dayDate),
    );
    for (const day of days) {
      if (
        day.tasks.length > 0 ||
        day.deadlineTasks.length > 0 ||
        day.scheduledIItems.length > 0 ||
        day.noStartTimeRepeatProjections.length > 0 ||
        day.allDayEvents.length > 0
      ) {
        dayDates.add(day.dayDate);
      }
    }
    const sortedDayDates = [...dayDates].sort();
    const key = sortedDayDates.join(',');
    if (key === this._prevDaysWithTasksKey) {
      return this._prevDaysWithTasks;
    }
    this._prevDaysWithTasksKey = key;
    this._prevDaysWithTasks = new Set(sortedDayDates);
    return this._prevDaysWithTasks;
  });
  overdueDays = computed<ReadonlySet<string>>(() => {
    const dates = new Set<string>();
    for (const task of this._overdueTasks()) {
      const dayDate =
        typeof task.dueWithTime === 'number'
          ? getDbDateStr(task.dueWithTime)
          : task.dueDay;
      if (dayDate) {
        dates.add(dayDate);
      }
    }
    for (const task of this._overdueDeadlineTasks()) {
      const dayDate =
        typeof task.deadlineWithTime === 'number'
          ? getDbDateStr(task.deadlineWithTime)
          : task.deadlineDay;
      if (dayDate) {
        dates.add(dayDate);
      }
    }
    return dates;
  });

  selectPlannerView(view: 'week' | 'month'): void {
    if (view === 'month') {
      const weekDate = parseDbDateStr(this._weekStart());
      this._selectedMonth.set(new Date(weekDate.getFullYear(), weekDate.getMonth(), 1));
    }
    this.plannerView.set(view);
  }

  shiftMonth(offset: number): void {
    const current = this._selectedMonth();
    this._selectedMonth.set(
      new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  goToPreviousPeriod(): void {
    if (this.isMonthView()) {
      this.shiftMonth(-1);
    } else {
      this._planView()?.shiftWeek(-1);
    }
  }

  goToNextPeriod(): void {
    if (this.isMonthView()) {
      this.shiftMonth(1);
    } else {
      this._planView()?.shiftWeek(1);
    }
  }

  goToToday(): void {
    if (this.isMonthView()) {
      this.showCurrentMonth();
    } else {
      this._planView()?.showCurrentWeek();
    }
  }

  showCurrentMonth(): void {
    const today = parseDbDateStr(this._globalTrackingIntervalService.todayDateStr());
    this._selectedMonth.set(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  onMonthDaySelected(dayDate: string): void {
    const planView = this._planView();
    if (planView) {
      planView.scrollToDay(dayDate);
    } else {
      this._plannerService.showWeekContaining(dayDate);
    }
    this.plannerView.set('week');
  }

  constructor() {
    this._store
      .select(selectTaskFeatureState)
      .pipe(takeUntilDestroyed())
      .subscribe((taskState) => {
        this._store.dispatch(
          PlannerActions.cleanupOldAndUndefinedPlannerTasks({
            today: this._dateService.todayStr(),
            allTaskIds: taskState.ids as string[],
          }),
        );
      });
  }
}
