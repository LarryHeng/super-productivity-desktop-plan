import { createFeature, createReducer, on } from '@ngrx/store';
import { PlannerActions } from './planner.actions';
import { moveItemInArray } from '../../../util/move-item-in-array';
import { loadAllData } from '../../../root-store/meta/load-all-data.action';
import { TaskSharedActions } from '../../../root-store/meta/task-shared.actions';
import { Log } from '../../../core/log';

export const plannerFeatureKey = 'planner';

export interface PlannerState {
  days: {
    [dayDate: string]: string[];
  };
  addPlannedTasksDialogLastShown: string | undefined;
}

export const plannerInitialState: PlannerState = {
  days: {},
  addPlannedTasksDialogLastShown: undefined,
  // addPlannedTasksDialogLastShown: undefined,
};

export const plannerReducer = createReducer(
  plannerInitialState,

  // META ACTIONS
  // ------------
  on(loadAllData, (state, { appDataComplete }) =>
    appDataComplete.planner ? appDataComplete.planner : state,
  ),

  on(TaskSharedActions.scheduleTaskWithTime, (state, action) => {
    const daysCopy = { ...state.days };
    Object.keys(daysCopy).forEach((day) => {
      const filtered = daysCopy[day].filter((id) => id !== action.task.id);
      if (filtered.length !== daysCopy[day].length) {
        daysCopy[day] = filtered;
      }
    });
    return {
      ...state,
      days: {
        ...daysCopy,
      },
    };
  }),

  on(TaskSharedActions.unscheduleTask, (state, action) => {
    const daysCopy = { ...state.days };
    Object.keys(daysCopy).forEach((day) => {
      const filtered = daysCopy[day].filter((id) => id !== action.id);
      if (filtered.length !== daysCopy[day].length) {
        daysCopy[day] = filtered;
      }
    });
    return {
      ...state,
      days: {
        ...daysCopy,
      },
    };
  }),

  // STANDARD_ACTIONS
  // ------------

  on(PlannerActions.upsertPlannerDay, (state, action) => ({
    ...state,
    days: {
      ...state.days,
      [action.day]: action.taskIds,
    },
  })),

  on(
    PlannerActions.cleanupOldAndUndefinedPlannerTasks,
    (state, { allTaskIds, today }) => {
      const daysCopy = { ...state.days };
      // Use Set for O(1) lookup instead of O(n) .includes() in filter
      const allTaskIdSet = new Set(allTaskIds);
      let wasChanged = false;
      Object.keys(daysCopy).forEach((day) => {
        if (day < today) {
          return;
        }
        const newDayVal = daysCopy[day].filter((id) => allTaskIdSet.has(id));
        if (newDayVal.length !== daysCopy[day].length) {
          daysCopy[day] = newDayVal;
          wasChanged = true;
        }
      });
      if (!wasChanged) {
        return state;
      }

      return {
        ...state,
        days: {
          ...daysCopy,
        },
      };
    },
  ),

  // NOTE: transferTask is now handled in planner-shared.reducer.ts

  on(PlannerActions.moveInList, (state, action) => {
    const targetDays = state.days[action.targetDay] || [];
    return {
      ...state,
      days: {
        ...state.days,
        [action.targetDay]: moveItemInArray(targetDays, action.fromIndex, action.toIndex),
      },
    };
  }),

  on(PlannerActions.moveBeforeTask, (state, action) => {
    // TODO check if we can mutate less
    const daysCopy = { ...state.days };
    // filter out from other days
    let wasMutated = false;
    Object.keys(daysCopy).forEach((dayI) => {
      // Use indexOf once instead of includes + filter (avoids double scan)
      const fromIndex = daysCopy[dayI].indexOf(action.fromTask.id);
      if (fromIndex !== -1) {
        daysCopy[dayI] = [
          ...daysCopy[dayI].slice(0, fromIndex),
          ...daysCopy[dayI].slice(fromIndex + 1),
        ];
        wasMutated = true;
      }
      const toIndex = daysCopy[dayI].indexOf(action.toTaskId);
      if (toIndex > -1) {
        Log.log('toIndex', toIndex);
        const tidsForDay = [...daysCopy[dayI]];
        tidsForDay.splice(toIndex, 0, action.fromTask.id);
        daysCopy[dayI] = tidsForDay;
        wasMutated = true;
      }
    });
    if (!wasMutated) {
      return state;
    }

    return {
      ...state,
      days: {
        ...daysCopy,
      },
    };
  }),

  // NOTE: planTaskForDay is now handled in planner-shared.reducer.ts

  on(PlannerActions.updatePlannerDialogLastShown, (state, { today }) => ({
    ...state,
    addPlannedTasksDialogLastShown: today,
  })),
);

export const plannerFeature = createFeature({
  name: plannerFeatureKey,
  reducer: plannerReducer,
});
