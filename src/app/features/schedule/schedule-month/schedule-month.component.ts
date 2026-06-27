import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { ScheduleEvent } from '../schedule.model';
import { safeFormatDate } from 'src/app/util/safe-format-date';
import { T } from '../../../t.const';
import { ScheduleService } from '../schedule.service';
import { LocaleDatePipe } from 'src/app/ui/pipes/locale-date.pipe';
import { DateTimeFormatService } from 'src/app/core/date-time-format/date-time-format.service';
import { parseDbDateStr } from 'src/app/util/parse-db-date-str';
import {
  buildScheduleMonthSummary,
  formatWorkedDuration,
} from './schedule-month-summary.util';
import { MonthGridComponent } from '../../../ui/month-grid/month-grid.component';
import { MonthGridDay } from '../../../ui/month-grid/month-grid.model';

@Component({
  selector: 'schedule-month',
  imports: [LocaleDatePipe, MonthGridComponent],
  templateUrl: './schedule-month.component.html',
  styleUrl: './schedule-month.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ScheduleMonthComponent {
  private _scheduleService = inject(ScheduleService);
  private _dateTimeFormatService = inject(DateTimeFormatService);

  readonly events = input<ScheduleEvent[] | null>([]);
  readonly daysToShow = input<string[]>([]);
  readonly weeksToShow = input<number>(6);
  readonly firstDayOfWeek = input<number>(1);
  readonly daySelected = output<string>();
  readonly todaySelected = output<void>();
  readonly daySummaries = computed(() => buildScheduleMonthSummary(this.events() ?? []));
  readonly todayDate = this._scheduleService.getTodayStr();
  readonly gridDays = computed<MonthGridDay[]>(() => {
    const summaries = this.daySummaries();
    return this.daysToShow().map((dayDate) => {
      const summary = summaries[dayDate];
      return {
        dayDate,
        total: summary ? this.formatDuration(summary.totalDurationMs) : undefined,
        items:
          summary?.tasks.map((task) => ({
            id: task.taskId,
            title: task.title,
            meta: this.formatDuration(task.durationMs),
          })) ?? [],
      };
    });
  });

  // Generate weekday headers based on firstDayOfWeek setting
  readonly weekdayHeaders = computed(() => {
    const firstDay = this.firstDayOfWeek();
    const headers: string[] = [];

    // Create a date for each day of week (using a week starting on Sunday)
    // January 2, 2000 was a Sunday
    const sundayDate = new Date(2000, 0, 2);

    for (let i = 0; i < 7; i++) {
      const dayIndex = (firstDay + i) % 7;
      const date = new Date(sundayDate);
      date.setDate(sundayDate.getDate() + dayIndex);
      // 'EEE' format gives abbreviated day name (e.g., 'Mon', 'Tue')
      headers.push(
        safeFormatDate(date, 'EEE', this._dateTimeFormatService.currentLocale()),
      );
    }

    return headers;
  });

  // Determine the reference month from the displayed days
  // Find the first day that's actually in the target month (not padding days)
  readonly referenceMonth = computed(() => {
    const days = this.daysToShow();
    if (days.length === 0) return new Date();

    // Use the middle day as reference (around day 14-15 of the month)
    // This ensures we get a day that's actually in the target month
    const middleIndex = Math.floor(days.length / 2);
    return parseDbDateStr(days[middleIndex]);
  });

  T: typeof T = T;

  getDayClass(day: string): string {
    return this._scheduleService.getDayClass(day, this.referenceMonth());
  }

  getWeekIndex(dayIndex: number): number {
    return Math.floor(dayIndex / 7);
  }

  getDayIndex(dayIndex: number): number {
    return dayIndex % 7;
  }

  selectDay(day: string): void {
    this.daySelected.emit(day);
  }

  formatDuration(durationMs: number): string {
    return formatWorkedDuration(durationMs, this._dateTimeFormatService.currentLocale());
  }

  getEventsForDay(day: string): ScheduleEvent[] {
    return this._scheduleService.getEventsForDay(day, this.events() || []);
  }

  getEventDayStr(ev: ScheduleEvent): string | null {
    return this._scheduleService.getEventDayStr(ev);
  }
}
