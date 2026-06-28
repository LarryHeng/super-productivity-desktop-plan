import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { PlannerDay } from '../planner.model';
import { getPlannerMonthItems, PlannerMonthItem } from './planner-month.util';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { DateService } from '../../../core/date/date.service';
import { safeFormatDate } from '../../../util/safe-format-date';
import { parseDbDateStr } from '../../../util/parse-db-date-str';
import { MonthGridComponent } from '../../../ui/month-grid/month-grid.component';
import { MonthGridDay } from '../../../ui/month-grid/month-grid.model';

@Component({
  selector: 'planner-month',
  imports: [MonthGridComponent],
  templateUrl: './planner-month.component.html',
  styleUrl: './planner-month.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class PlannerMonthComponent {
  private _dateTimeFormatService = inject(DateTimeFormatService);
  private _dateService = inject(DateService);

  readonly days = input<PlannerDay[]>([]);
  readonly daysToShow = input<string[]>([]);
  readonly overdueDays = input<ReadonlySet<string>>(new Set());
  readonly daySelected = output<string>();
  readonly todaySelected = output<void>();

  readonly weekdayHeaders = computed(() => {
    const monday = new Date(2000, 0, 3);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      return safeFormatDate(day, 'EEE', this._dateTimeFormatService.currentLocale());
    });
  });

  readonly referenceMonth = computed(() => {
    const days = this.daysToShow();
    return days.length ? parseDbDateStr(days[Math.floor(days.length / 2)]) : new Date();
  });

  readonly dayMap = computed(() => new Map(this.days().map((day) => [day.dayDate, day])));
  readonly gridDays = computed<MonthGridDay[]>(() =>
    this.daysToShow().map((dayDate) => ({
      dayDate,
      isOverdue: this.overdueDays().has(dayDate),
      items: this.getItems(dayDate).map((item) => ({
        id: item.id,
        title: item.title,
      })),
    })),
  );
  readonly todayDate = this._dateService.todayStr();

  getItems(dayDate: string): PlannerMonthItem[] {
    const day = this.dayMap().get(dayDate);
    return day ? getPlannerMonthItems(day) : [];
  }

  getDayClass(dayDate: string): string {
    const classes: string[] = [];
    const day = parseDbDateStr(dayDate);
    if (day.getMonth() !== this.referenceMonth().getMonth()) {
      classes.push('other-month');
    }
    if (dayDate === this._dateService.todayStr()) {
      classes.push('today');
    }
    return classes.join(' ');
  }

  selectDay(dayDate: string): void {
    this.daySelected.emit(dayDate);
  }

  getWeekIndex(dayIndex: number): number {
    return Math.floor(dayIndex / 7);
  }

  getDayIndex(dayIndex: number): number {
    return dayIndex % 7;
  }
}
