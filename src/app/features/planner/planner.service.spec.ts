import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { PlannerService } from './planner.service';
import { DateService } from '../../core/date/date.service';
import { CalendarIntegrationService } from '../calendar-integration/calendar-integration.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';

describe('PlannerService weekly pages', () => {
  let service: PlannerService;
  let todayDateStr$: BehaviorSubject<string>;
  let dateService: DateService;

  beforeEach(() => {
    todayDateStr$ = new BehaviorSubject('2026-01-14');

    TestBed.configureTestingModule({
      providers: [
        PlannerService,
        DateService,
        provideMockStore(),
        {
          provide: CalendarIntegrationService,
          useValue: { calendarEvents$: of([]) },
        },
        {
          provide: GlobalTrackingIntervalService,
          useValue: { todayDateStr$: todayDateStr$.asObservable() },
        },
      ],
    });

    service = TestBed.inject(PlannerService);
    dateService = TestBed.inject(DateService);
    spyOn(dateService, 'todayStr').and.returnValue('2026-01-14');
  });

  it('shows exactly Monday through Sunday for the current logical week', async () => {
    expect(await firstValueFrom(service.daysToShow$)).toEqual([
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-01-15',
      '2026-01-16',
      '2026-01-17',
      '2026-01-18',
    ]);
  });

  it('opens a historical week selected from the month calendar', async () => {
    service.showWeekContaining('2025-12-03');

    expect(await firstValueFrom(service.daysToShow$)).toEqual([
      '2025-12-01',
      '2025-12-02',
      '2025-12-03',
      '2025-12-04',
      '2025-12-05',
      '2025-12-06',
      '2025-12-07',
    ]);
  });

  it('keeps a selected Monday in its own week', async () => {
    service.showWeekContaining('2026-06-15');

    expect(await firstValueFrom(service.daysToShow$)).toEqual([
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
      '2026-06-18',
      '2026-06-19',
      '2026-06-20',
      '2026-06-21',
    ]);
  });

  it('moves by one complete week', async () => {
    service.showWeekContaining('2026-01-14');
    service.shiftWeek(1);

    const days = await firstValueFrom(service.daysToShow$);
    expect(days[0]).toBe('2026-01-19');
    expect(days[6]).toBe('2026-01-25');
  });

  it('returns to the current logical week', async () => {
    service.showWeekContaining('2025-12-03');
    service.resetScrollState();

    const days = await firstValueFrom(service.daysToShow$);
    expect(days[0]).toBe('2026-01-12');
    expect(days[6]).toBe('2026-01-18');
    expect(service.isLoadingMore$.value).toBeFalse();
  });
});
