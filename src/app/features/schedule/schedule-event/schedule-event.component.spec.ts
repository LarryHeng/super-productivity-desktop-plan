import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideMockStore } from '@ngrx/store/testing';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TranslateModule } from '@ngx-translate/core';
import { ScheduleEventComponent } from './schedule-event.component';
import { SVEType } from '../schedule.const';
import { ScheduleEvent } from '../schedule.model';
import { MatDialog } from '@angular/material/dialog';
import { TaskService } from '../../tasks/task.service';
import { CalendarEventActionsService } from '../../calendar-integration/calendar-event-actions.service';
import { DateTimeFormatService } from '../../../core/date-time-format/date-time-format.service';

const makeCalendarScheduleEvent = (isReferenceCalendar: boolean): ScheduleEvent => ({
  id: 'cal-1',
  type: SVEType.CalendarEvent,
  style: '',
  startHours: 10,
  timeLeftInHours: 1,
  data: {
    id: 'cal-1',
    title: 'Test Event',
    start: Date.now(),
    duration: 3600000,
    issueProviderKey: 'ICAL',
    icon: 'event',
    isReferenceCalendar,
  } as any,
});

const makeTaskScheduleEvent = (overlap?: ScheduleEvent['overlap']): ScheduleEvent => ({
  id: 'task-1',
  type: SVEType.Task,
  style: 'grid-column: 2;  grid-row: 121 / span 12',
  startHours: 10,
  timeLeftInHours: 1,
  overlap,
  data: { id: 'task-1', title: 'Task', timeEstimate: 3600000 } as any,
});

const makeRepeatProjectionScheduleEvent = (
  plannedForDay?: string,
  id = 'repeat_cfg_with_underscores_2026-07-04',
): ScheduleEvent => ({
  id,
  type: SVEType.RepeatProjection,
  style: '',
  startHours: 10,
  timeLeftInHours: 1,
  plannedForDay,
  data: {
    id: 'repeat_cfg_with_underscores',
    title: 'Repeated task',
  } as any,
});

describe('ScheduleEventComponent – isReferenceCalendar', () => {
  let fixture: ComponentFixture<ScheduleEventComponent>;
  let component: ScheduleEventComponent;
  let matDialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    matDialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    await TestBed.configureTestingModule({
      imports: [ScheduleEventComponent, DragDropModule, TranslateModule.forRoot()],
      providers: [
        provideMockStore(),
        { provide: MatDialog, useValue: matDialog },
        {
          provide: TaskService,
          useValue: { setSelectedId: jasmine.createSpy('setSelectedId') },
        },
        {
          provide: CalendarEventActionsService,
          useValue: {
            hasEventUrl: jasmine.createSpy('hasEventUrl').and.returnValue(false),
            isPluginEvent: jasmine.createSpy('isPluginEvent').and.returnValue(false),
            canMoveEvent: jasmine.createSpy('canMoveEvent').and.returnValue(false),
            createAsTask: jasmine.createSpy('createAsTask'),
            hideForever: jasmine.createSpy('hideForever'),
          },
        },
        {
          provide: DateTimeFormatService,
          useValue: { is24HourFormat: true },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleEventComponent);
    component = fixture.componentInstance;
  });

  describe('isReferenceCalendar signal', () => {
    it('should return true for a CalendarEvent whose data has isReferenceCalendar: true', () => {
      fixture.componentRef.setInput('event', makeCalendarScheduleEvent(true));
      fixture.detectChanges();

      expect(component.isReferenceCalendar()).toBe(true);
    });

    it('should return false for a CalendarEvent whose data has isReferenceCalendar: false', () => {
      fixture.componentRef.setInput('event', makeCalendarScheduleEvent(false));
      fixture.detectChanges();

      expect(component.isReferenceCalendar()).toBe(false);
    });

    it('should return false for a non-CalendarEvent type', () => {
      fixture.componentRef.setInput('event', makeTaskScheduleEvent());
      fixture.detectChanges();

      expect(component.isReferenceCalendar()).toBe(false);
    });
  });

  describe('canRescheduleCalendarEvent signal', () => {
    it('should return false when the calendar provider cannot update events', () => {
      fixture.componentRef.setInput('event', makeCalendarScheduleEvent(false));
      fixture.detectChanges();

      expect(component.canRescheduleCalendarEvent()).toBe(false);
    });

    it('should return true when the calendar provider can update events', () => {
      const calActions = TestBed.inject(
        CalendarEventActionsService,
      ) as jasmine.SpyObj<CalendarEventActionsService>;
      calActions.canMoveEvent.and.returnValue(true);
      fixture.componentRef.setInput('event', makeCalendarScheduleEvent(false));
      fixture.detectChanges();

      expect(component.canRescheduleCalendarEvent()).toBe(true);
    });
  });

  describe('clickHandler – reference calendar with empty menu', () => {
    it('should not throw when clicking a reference calendar event with no menu items', async () => {
      fixture.componentRef.setInput('event', makeCalendarScheduleEvent(true));
      fixture.detectChanges();

      await expectAsync(
        component.clickHandler(new MouseEvent('click')),
      ).not.toBeRejected();
    });

    it('should not open menu for a reference calendar event when no items are rendered', async () => {
      fixture.componentRef.setInput('event', makeCalendarScheduleEvent(true));
      fixture.detectChanges();

      const trigger = component.calMenuTrigger();
      if (trigger) {
        spyOn(trigger, 'openMenu');
      }

      await component.clickHandler(new MouseEvent('click'));

      if (trigger) {
        expect(trigger.openMenu).not.toHaveBeenCalled();
      } else {
        // calMenuTrigger is undefined when MatMenuTrigger is not resolved – openMenu was never called
        expect(trigger).toBeUndefined();
      }
    });
  });

  describe('clickHandler – repeat projection target date', () => {
    it('uses plannedForDay when the repeat configuration id contains underscores', async () => {
      fixture.componentRef.setInput(
        'event',
        makeRepeatProjectionScheduleEvent('2026-07-04'),
      );

      await component.clickHandler(new MouseEvent('click'));

      expect(matDialog.open).toHaveBeenCalledWith(jasmine.any(Function), {
        data: {
          repeatCfg: jasmine.objectContaining({
            id: 'repeat_cfg_with_underscores',
          }),
          targetDate: '2026-07-04',
        },
      });
    });

    it('falls back to a strict date suffix when plannedForDay is absent', async () => {
      fixture.componentRef.setInput('event', makeRepeatProjectionScheduleEvent());

      await component.clickHandler(new MouseEvent('click'));

      expect(matDialog.open).toHaveBeenCalledWith(jasmine.any(Function), {
        data: {
          repeatCfg: jasmine.any(Object),
          targetDate: '2026-07-04',
        },
      });
    });

    it('does not treat an arbitrary id segment as a target date', async () => {
      fixture.componentRef.setInput(
        'event',
        makeRepeatProjectionScheduleEvent(undefined, 'repeat_cfg_with_underscores'),
      );

      await component.clickHandler(new MouseEvent('click'));

      expect(matDialog.open).toHaveBeenCalledWith(jasmine.any(Function), {
        data: {
          repeatCfg: jasmine.any(Object),
          targetDate: undefined,
        },
      });
    });

    it('rejects a calendar-invalid date suffix', async () => {
      fixture.componentRef.setInput(
        'event',
        makeRepeatProjectionScheduleEvent(undefined, 'repeat_cfg_2026-13-40'),
      );

      await component.clickHandler(new MouseEvent('click'));

      expect(matDialog.open).toHaveBeenCalledWith(jasmine.any(Function), {
        data: {
          repeatCfg: jasmine.any(Object),
          targetDate: undefined,
        },
      });
    });
  });

  describe('resize handle', () => {
    it('should hide resizing when resize is disabled', () => {
      fixture.componentRef.setInput('event', makeTaskScheduleEvent());
      fixture.detectChanges();

      expect(component.isResizable()).toBe(true);

      fixture.componentRef.setInput('isResizeDisabled', true);
      fixture.detectChanges();

      expect(component.isResizable()).toBe(false);
    });

    it('should hide resizing for drag previews', () => {
      fixture.componentRef.setInput('event', makeTaskScheduleEvent());
      fixture.componentRef.setInput('isDragPreview', true);
      fixture.detectChanges();

      expect(component.isResizable()).toBe(false);
    });

    it('should not resize a completed planned task', () => {
      fixture.componentRef.setInput('event', {
        ...makeTaskScheduleEvent(),
        type: SVEType.CompletedPlannedTask,
        data: {
          ...makeTaskScheduleEvent().data,
          isDone: true,
        },
      });
      fixture.detectChanges();

      expect(component.isResizable()).toBe(false);
    });
  });

  it('uses a time-table context menu that hides spent-time editing', () => {
    fixture.componentRef.setInput('event', makeTaskScheduleEvent());
    fixture.detectChanges();

    expect(component.taskContextMenu()?.isTimeSpentEditHidden()).toBe(true);
  });

  it('opens manual recording with the planned block interval', () => {
    const start = new Date(2026, 5, 28, 9, 0).getTime();
    const duration = 30 * 60 * 1000;
    fixture.componentRef.setInput('event', {
      ...makeTaskScheduleEvent(),
      start,
      duration,
    });

    component.openManualRecord();

    expect(matDialog.open).toHaveBeenCalledWith(jasmine.any(Function), {
      data: {
        task: jasmine.objectContaining({ id: 'task-1' }),
        start,
        end: start + duration,
        isFromPlannedBlock: true,
      },
    });
  });

  describe('style', () => {
    it('should render overlapping events in equal-width lanes', () => {
      fixture.componentRef.setInput(
        'event',
        makeTaskScheduleEvent({ count: 2, offset: 1 }),
      );
      fixture.detectChanges();

      expect(component.style()).toBe(
        'margin-left: calc(50% + var(--margin-left)); ' +
          'width: calc(50% - var(--margin-left) - var(--margin-right)); ' +
          'overflow: hidden !important; ' +
          'grid-column: 2;  grid-row: 121 / span 12',
      );
    });

    it('should not lane events in month view', () => {
      fixture.componentRef.setInput(
        'event',
        makeTaskScheduleEvent({ count: 2, offset: 1 }),
      );
      fixture.componentRef.setInput('isMonthView', true);
      fixture.detectChanges();

      expect(component.style()).toBe('grid-column: 2;  grid-row: 121 / span 12');
    });
  });
});
