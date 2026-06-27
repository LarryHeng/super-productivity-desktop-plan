import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  DailySettlementSchedulerService,
  getDailySettlementBoundaryMs,
} from './daily-settlement-scheduler.service';
import { DailySettlementService } from './daily-settlement.service';
import { DateService } from '../../core/date/date.service';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';

describe('getDailySettlementBoundaryMs()', () => {
  const fourHours = 4 * 60 * 60 * 1000;

  it('uses the previous 04:00 boundary before the configured day start', () => {
    expect(
      getDailySettlementBoundaryMs(new Date(2026, 0, 2, 3, 0).getTime(), fourHours),
    ).toBe(new Date(2026, 0, 1, 4, 0).getTime());
  });

  it('uses the current 04:00 boundary after the configured day start', () => {
    expect(
      getDailySettlementBoundaryMs(new Date(2026, 0, 2, 5, 0).getTime(), fourHours),
    ).toBe(new Date(2026, 0, 2, 4, 0).getTime());
  });
});

describe('DailySettlementSchedulerService', () => {
  let service: DailySettlementSchedulerService;
  let dailySettlementService: jasmine.SpyObj<DailySettlementService>;
  let dateService: jasmine.SpyObj<DateService>;

  beforeEach(() => {
    localStorage.removeItem('sp_last_auto_daily_settlement_boundary');

    dailySettlementService = jasmine.createSpyObj<DailySettlementService>(
      'DailySettlementService',
      ['settleCompletedTasks'],
    );
    dailySettlementService.settleCompletedTasks.and.resolveTo(0);

    dateService = jasmine.createSpyObj<DateService>('DateService', [
      'getStartOfNextDayDiffMs',
    ]);
    dateService.getStartOfNextDayDiffMs.and.returnValue(4 * 60 * 60 * 1000);

    TestBed.configureTestingModule({
      providers: [
        DailySettlementSchedulerService,
        { provide: DailySettlementService, useValue: dailySettlementService },
        { provide: DateService, useValue: dateService },
        {
          provide: DataInitStateService,
          useValue: { isAllDataLoadedInitially$: new Subject<void>() },
        },
        {
          provide: GlobalTrackingIntervalService,
          useValue: { todayDateStr$: new Subject<string>() },
        },
      ],
    });

    service = TestBed.inject(DailySettlementSchedulerService);
  });

  afterEach(() => {
    localStorage.removeItem('sp_last_auto_daily_settlement_boundary');
  });

  it('runs automatic settlement once for a day boundary', async () => {
    const now = new Date(2026, 0, 2, 5, 0).getTime();
    const boundaryMs = new Date(2026, 0, 2, 4, 0).getTime();
    const oneHourMs = 60 * 60 * 1000;

    await service.checkAutoSettlement(now);
    await service.checkAutoSettlement(now + oneHourMs);

    expect(dailySettlementService.settleCompletedTasks).toHaveBeenCalledOnceWith({
      doneBefore: boundaryMs,
      isShowSnack: false,
    });
  });
});
