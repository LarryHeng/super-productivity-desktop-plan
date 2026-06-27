import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlannerPlanViewComponent } from './planner-plan-view.component';
import { PlannerService } from '../planner.service';
import { provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import {
  selectUndoneOverdue,
  selectUndoneOverdueDeadlineTasks,
} from '../../tasks/store/task.selectors';
import { GlobalTrackingIntervalService } from '../../../core/global-tracking-interval/global-tracking-interval.service';

describe('PlannerPlanViewComponent', () => {
  let fixture: ComponentFixture<PlannerPlanViewComponent>;
  let component: PlannerPlanViewComponent;
  let mockPlannerService: jasmine.SpyObj<PlannerService>;

  beforeEach(() => {
    mockPlannerService = jasmine.createSpyObj('PlannerService', [
      'resetScrollState',
      'showWeekContaining',
      'shiftWeek',
      'showCurrentWeek',
    ]);
    mockPlannerService.days$ = of([]);

    TestBed.configureTestingModule({
      imports: [PlannerPlanViewComponent],
      providers: [
        { provide: PlannerService, useValue: mockPlannerService },
        {
          provide: GlobalTrackingIntervalService,
          useValue: { todayDateStr: () => '2026-06-27' },
        },
        provideMockStore({
          selectors: [
            { selector: selectUndoneOverdue, value: [] },
            { selector: selectUndoneOverdueDeadlineTasks, value: [] },
          ],
        }),
      ],
    });

    fixture = TestBed.createComponent(PlannerPlanViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens the week that contains a date selected in the month view', () => {
    component.scrollToDay('2026-05-13');

    expect(component.visibleDayDate()).toBe('2026-05-13');
    expect(mockPlannerService.showWeekContaining).toHaveBeenCalledOnceWith('2026-05-13');
  });

  it('moves one complete week at a time', () => {
    component.scrollToDay('2026-06-24');
    component.shiftWeek(1);

    expect(mockPlannerService.shiftWeek).toHaveBeenCalledOnceWith(1);
    expect(component.visibleDayDate()).toBe('2026-07-01');
  });

  it('returns to the logical current week', () => {
    component.scrollToDay('2025-12-03');
    component.showCurrentWeek();

    expect(mockPlannerService.showCurrentWeek).toHaveBeenCalledTimes(1);
    expect(component.visibleDayDate()).toBe('2026-06-27');
  });

  it('resets the selected week on destroy', () => {
    fixture.destroy();

    expect(mockPlannerService.resetScrollState).toHaveBeenCalledTimes(1);
  });
});
