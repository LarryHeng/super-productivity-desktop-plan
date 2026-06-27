import { PlannerDay, ScheduleItemType } from '../planner.model';

export interface PlannerMonthItem {
  id: string;
  title: string;
}

export const getPlannerMonthItems = (day: PlannerDay): PlannerMonthItem[] => {
  const items = new Map<string, PlannerMonthItem>();
  const add = (id: string, title: string | null | undefined): void => {
    if (title && !items.has(id)) {
      items.set(id, { id, title });
    }
  };

  day.tasks.forEach((task) => add(`task:${task.id}`, task.title));
  day.deadlineTasks.forEach((task) => add(`task:${task.id}`, task.title));

  day.scheduledIItems.forEach((item) => {
    switch (item.type) {
      case ScheduleItemType.Task:
        add(`task:${item.task.id}`, item.task.title);
        break;
      case ScheduleItemType.RepeatProjection:
        add(`repeat:${item.repeatCfg.id}`, item.repeatCfg.title);
        break;
      case ScheduleItemType.CalEvent:
        add(`calendar:${item.id}`, item.calendarEvent.title);
        break;
    }
  });

  day.noStartTimeRepeatProjections.forEach((item) =>
    add(`repeat:${item.repeatCfg.id}`, item.repeatCfg.title),
  );
  day.allDayEvents.forEach((item) => add(`calendar:${item.id}`, item.title));

  return [...items.values()];
};
