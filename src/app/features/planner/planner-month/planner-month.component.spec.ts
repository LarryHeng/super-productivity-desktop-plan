import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PlannerMonthComponent } from './planner-month.component';
import { PlannerDay } from '../planner.model';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';
import { DateService } from '../../../core/date/date.service';
import { TranslateModule } from '@ngx-translate/core';

describe('PlannerMonthComponent', () => {
  let fixture: ComponentFixture<PlannerMonthComponent>;
  let component: PlannerMonthComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlannerMonthComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: DateTimeFormatService,
          useValue: { currentLocale: () => 'en-US' },
        },
        {
          provide: DateService,
          useValue: { todayStr: () => '2026-06-27' },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlannerMonthComponent);
    component = fixture.componentInstance;
  });

  it('renders task titles without rendering schedule times', () => {
    fixture.componentRef.setInput('daysToShow', ['2026-06-27']);
    fixture.componentRef.setInput('days', [
      {
        dayDate: '2026-06-27',
        tasks: [{ id: 'task-1', title: 'Write report' }],
        deadlineTasks: [],
        scheduledIItems: [],
        noStartTimeRepeatProjections: [],
        allDayEvents: [],
        timeEstimate: 0,
        timeLimit: 0,
        itemsTotal: 1,
      } as unknown as PlannerDay,
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Write report');
    expect(text).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it('emits the clicked date', () => {
    const selectedDays: string[] = [];
    fixture.componentRef.setInput('daysToShow', ['2026-06-27']);
    component.daySelected.subscribe((day) => selectedDays.push(day));
    fixture.detectChanges();

    fixture.debugElement.query(By.css('[data-day="2026-06-27"]')).nativeElement.click();

    expect(selectedDays).toEqual(['2026-06-27']);
  });

  it('uses the same translucent month template and return-to-today action', () => {
    fixture.componentRef.setInput('daysToShow', ['2026-06-27']);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('month-grid'))).not.toBeNull();
    expect(
      fixture.debugElement.query(By.css('[data-testid="return-to-today"]')),
    ).not.toBeNull();
  });
});
