import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { safeFormatDate } from '../../util/safe-format-date';
import { parseDbDateStr } from '../../util/parse-db-date-str';
import { LocaleDatePipe } from '../pipes/locale-date.pipe';
import { MonthGridDay } from './month-grid.model';
import { T } from '../../t.const';

@Component({
  selector: 'month-grid',
  imports: [LocaleDatePipe, MatButton, MatIcon, TranslatePipe],
  templateUrl: './month-grid.component.html',
  styleUrl: './month-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class MonthGridComponent {
  private _dateTimeFormatService = inject(DateTimeFormatService);

  readonly days = input<MonthGridDay[]>([]);
  readonly daysToShow = input<string[]>([]);
  readonly weeksToShow = input(6);
  readonly firstDayOfWeek = input(1);
  readonly todayDate = input('');
  readonly referenceMonth = input<Date | null>(null);
  readonly daySelected = output<string>();
  readonly todaySelected = output<void>();

  readonly T = T;
  readonly dayMap = computed(() => new Map(this.days().map((day) => [day.dayDate, day])));
  readonly effectiveReferenceMonth = computed(() => {
    const provided = this.referenceMonth();
    if (provided) {
      return provided;
    }
    const days = this.daysToShow();
    return days.length ? parseDbDateStr(days[Math.floor(days.length / 2)]) : new Date();
  });
  readonly weekdayHeaders = computed(() => {
    const firstDay = this.firstDayOfWeek();
    const sunday = new Date(2000, 0, 2);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + ((firstDay + index) % 7));
      return safeFormatDate(day, 'EEE', this._dateTimeFormatService.currentLocale());
    });
  });

  getDayClass(dayDate: string): string {
    const classes = ['is-translucent'];
    const day = parseDbDateStr(dayDate);
    const reference = this.effectiveReferenceMonth();
    if (
      day.getMonth() !== reference.getMonth() ||
      day.getFullYear() !== reference.getFullYear()
    ) {
      classes.push('other-month');
    }
    if (dayDate === this.todayDate()) {
      classes.push('today');
    }
    if (this.dayMap().get(dayDate)?.isOverdue) {
      classes.push('overdue');
    }
    return classes.join(' ');
  }

  getWeekIndex(dayIndex: number): number {
    return Math.floor(dayIndex / 7);
  }

  getDayIndex(dayIndex: number): number {
    return dayIndex % 7;
  }
}
