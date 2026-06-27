import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DateService } from '../../core/date/date.service';
import { PlannerActions } from './store/planner.actions';
import { selectTaskFeatureState } from '../tasks/store/task.selectors';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { T } from '../../t.const';
import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { PlannerPlanViewComponent } from './planner-plan-view/planner-plan-view.component';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { PlannerCalendarNavComponent } from './planner-calendar-nav/planner-calendar-nav.component';
import { PlannerService } from './planner.service';
import { LayoutService } from '../../core-ui/layout/layout.service';
import { MatIcon } from '@angular/material/icon';
import { MatFabButton, MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { parseDbDateStr } from '../../util/parse-db-date-str';
import { getDbDateStr } from '../../util/get-db-date-str';
import { getPlannerWeekStart } from './util/get-planner-week-start';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { selectPlannerState } from './store/planner.selectors';
import { plannerInitialState } from './store/planner.reducer';

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
    MatFabButton,
    MatIconButton,
    MatTooltip,
    TranslatePipe,
  ],
})
export class PlannerComponent {
  private _store = inject(Store);
  private _dateService = inject(DateService);
  private _plannerService = inject(PlannerService);
  private _globalTrackingIntervalService = inject(GlobalTrackingIntervalService);
  layoutService = inject(LayoutService);

  readonly T = T;

  private _days = toSignal(this._plannerService.days$, { initialValue: [] });
  private _plannerState = toSignal(this._store.select(selectPlannerState), {
    initialValue: plannerInitialState,
  });
  private _weekStart = toSignal(this._plannerService.selectedWeekStart$, {
    initialValue: getDbDateStr(
      getPlannerWeekStart(
        parseDbDateStr(this._globalTrackingIntervalService.todayDateStr()),
      ),
    ),
  });
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
