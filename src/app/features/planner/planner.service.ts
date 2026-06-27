import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { distinctUntilChanged, first, map, shareReplay, switchMap } from 'rxjs/operators';
import { selectAllTasksWithDueTime } from '../tasks/store/task.selectors';
import { Store } from '@ngrx/store';
import { CalendarIntegrationService } from '../calendar-integration/calendar-integration.service';
import { PlannerDay } from './planner.model';
import { selectPlannerDays } from './store/planner.selectors';
import { TaskWithDueTime } from '../tasks/task.model';
import { DateService } from '../../core/date/date.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { selectTodayTaskIds } from '../work-context/store/work-context.selectors';
import { msToString } from '../../ui/duration/ms-to-string.pipe';
import { getDbDateStr } from '../../util/get-db-date-str';
import { parseDbDateStr } from '../../util/parse-db-date-str';
import { selectActiveTaskRepeatCfgs } from '../task-repeat-cfg/store/task-repeat-cfg.selectors';
import { getPlannerWeekStart } from './util/get-planner-week-start';

@Injectable({
  providedIn: 'root',
})
export class PlannerService {
  private _store = inject(Store);
  private _calendarIntegrationService = inject(CalendarIntegrationService);
  private _dateService = inject(DateService);
  private _globalTrackingIntervalService = inject(GlobalTrackingIntervalService);
  private _selectedWeekStart$ = new BehaviorSubject<string | null>(null);
  public isLoadingMore$ = new BehaviorSubject<boolean>(false);

  includedWeekDays$ = of([0, 1, 2, 3, 4, 5, 6]);

  readonly selectedWeekStart$ = combineLatest([
    this._selectedWeekStart$,
    this._globalTrackingIntervalService.todayDateStr$,
  ]).pipe(
    map(
      ([selectedWeekStart, todayStr]) =>
        selectedWeekStart ?? this._getWeekStart(todayStr),
    ),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  daysToShow$ = this.selectedWeekStart$.pipe(
    map((weekStartStr) => {
      const cursor = parseDbDateStr(weekStartStr);
      const days: string[] = [];
      for (let i = 0; i < 7; i++) {
        days.push(getDbDateStr(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return days;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  allDueWithTimeTasks$: Observable<TaskWithDueTime[]> = this._store.select(
    selectAllTasksWithDueTime,
  );

  // TODO this needs to be more performant
  days$: Observable<PlannerDay[]> = this._createPlannerDays$(this.daysToShow$);

  tomorrow$ = this._createPlannerDays$(
    this._globalTrackingIntervalService.todayDateStr$.pipe(
      map(() => [getDbDateStr(this._dateService.getLogicalTomorrowMs())]),
    ),
  ).pipe(
    map((days) => days[0] ?? null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private _createPlannerDays$(dayDates$: Observable<string[]>): Observable<PlannerDay[]> {
    return dayDates$.pipe(
      switchMap((daysToShow) =>
        combineLatest([
          this._store.select(selectActiveTaskRepeatCfgs),
          this._store.select(selectTodayTaskIds),
          this._calendarIntegrationService.calendarEvents$,
          this.allDueWithTimeTasks$,
          this._globalTrackingIntervalService.todayDateStr$,
        ]).pipe(
          switchMap(
            ([
              taskRepeatCfgs,
              todayListTaskIds,
              calendarEvents,
              allTasksPlanned,
              todayStr,
            ]) =>
              this._store.select(
                selectPlannerDays(
                  daysToShow,
                  taskRepeatCfgs,
                  todayListTaskIds,
                  calendarEvents,
                  allTasksPlanned,
                  todayStr,
                ),
              ),
          ),
        ),
      ),
      // for better performance
      // TODO better solution, gets called very often
      // tap((val) => Log.log('days$', val)),
      // tap((val) => Log.log('days$ SIs', val[0]?.scheduledIItems)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  // plannedTaskDayMap$: Observable<{ [taskId: string]: string }> = this._store
  //   .select(selectTaskIdPlannedDayMap)
  //   // make this more performant by sharing stream
  //   .pipe(shareReplay(1));

  getDayOnce$(dayStr: string): Observable<PlannerDay | undefined> {
    return this.days$.pipe(
      map((days) => days.find((d) => d.dayDate === dayStr)),
      first(),
    );
  }

  getSnackExtraStr(dayStr: string): Promise<string> {
    return this.getDayOnce$(dayStr)
      .pipe(
        map((day) => {
          if (!day) {
            return '';
          }
          if (day.timeEstimate === 0) {
            return ` – ∑ ${day.itemsTotal}`;
          }

          return `<br />∑ ${day.itemsTotal} ｜ ${msToString(day.timeEstimate)}`;
        }),
      )
      .toPromise();
  }

  loadMoreDays(): void {
    this.shiftWeek(1);
  }

  ensureDayLoaded(dayDate: string): void {
    this.showWeekContaining(dayDate);
  }

  resetScrollState(): void {
    this.isLoadingMore$.next(false);
    this.showCurrentWeek();
  }

  showWeekContaining(dayDate: string): void {
    this._selectedWeekStart$.next(this._getWeekStart(dayDate));
  }

  showCurrentWeek(): void {
    this._selectedWeekStart$.next(null);
  }

  shiftWeek(offset: number): void {
    const currentStart = parseDbDateStr(
      this._selectedWeekStart$.value ?? this._getWeekStart(this._dateService.todayStr()),
    );
    const dayOffset = offset * 7;
    currentStart.setDate(currentStart.getDate() + dayOffset);
    this._selectedWeekStart$.next(getDbDateStr(currentStart));
  }

  private _getWeekStart(dayDate: string): string {
    return getDbDateStr(getPlannerWeekStart(parseDbDateStr(dayDate)));
  }
}
