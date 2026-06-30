import {
  addTaskRepeatCfgToTask,
  deleteTaskRepeatCfg,
  deleteTaskRepeatCfgs,
  updateTaskRepeatCfg,
  updateTaskRepeatCfgs,
  upsertTaskRepeatCfg,
  deleteTaskRepeatCfgInstance,
} from './task-repeat-cfg.actions';
import { TaskRepeatCfg, TaskRepeatCfgState } from '../task-repeat-cfg.model';
import { createReducer, on } from '@ngrx/store';
import { loadAllData } from '../../../root-store/meta/load-all-data.action';
import { TaskSharedActions } from '../../../root-store/meta/task-shared.actions';
import { isValidTaskRepeatOccurrenceDay } from '../get-task-repeat-occurrence-day.util';
import { adapter } from './task-repeat-cfg.selectors';

export { TASK_REPEAT_CFG_FEATURE_NAME } from './task-repeat-cfg.selectors';

export const { selectIds, selectEntities, selectAll, selectTotal } =
  adapter.getSelectors();

export const initialTaskRepeatCfgState: TaskRepeatCfgState = adapter.getInitialState({
  // additional entity state properties
});

export const taskRepeatCfgReducer = createReducer<TaskRepeatCfgState>(
  initialTaskRepeatCfgState,

  on(loadAllData, (oldState, { appDataComplete }) =>
    appDataComplete.taskRepeatCfg ? appDataComplete.taskRepeatCfg : oldState,
  ),

  // delete all project tasks from tags on project delete
  on(TaskSharedActions.deleteProject, (state, { projectId }) => {
    const taskRepeatCfgs = state.ids.map((id) => state.entities[id] as TaskRepeatCfg);
    const allCfgIdsForProject = taskRepeatCfgs.filter(
      (cfg) => cfg.projectId === projectId,
    );
    return adapter.removeMany(
      allCfgIdsForProject.map((repeatCfg) => repeatCfg.id),
      state,
    );

    // const cfgsIdsToRemove: string[] = allCfgIdsForProject
    //   .filter((cfg) => !cfg.tagIds || cfg.tagIds.length === 0)
    //   .map((cfg) => cfg.id as string);
    // if (cfgsIdsToRemove.length > 0) {
    //   // this._taskRepeatCfgService.deleteTaskRepeatCfgsNoTaskCleanup(cfgsIdsToRemove);
    //   return adapter.removeMany(cfgsIdsToRemove, state);
    // }

    // const cfgsToUpdate: string[] = allCfgIdsForProject
    //   .filter((cfg) => cfg.tagIds && cfg.tagIds.length > 0)
    //   .map((taskRepeatCfg) => taskRepeatCfg.id as string);
    // if (cfgsToUpdate.length > 0) {
    //   // this._taskRepeatCfgService.updateTaskRepeatCfgs(cfgsToUpdate, { projectId: null });
    // }
  }),
  on(TaskSharedActions.deleteTaskRepeatCfg, (state, { taskRepeatCfgId }) =>
    adapter.removeOne(taskRepeatCfgId, state),
  ),
  on(
    TaskSharedActions.stopTaskRepeatCfgFromDate,
    (state, { taskRepeatCfgId, stopDate, endDate, taskRepeatCfgSnapshot }) => {
      if (
        !isValidTaskRepeatOccurrenceDay(stopDate) ||
        !isValidTaskRepeatOccurrenceDay(endDate)
      ) {
        return state;
      }
      const validSnapshot =
        taskRepeatCfgSnapshot?.id === taskRepeatCfgId ? taskRepeatCfgSnapshot : undefined;
      const cfg = state.entities[taskRepeatCfgId];
      if (!cfg && !validSnapshot) return state;
      const baseCfg = cfg ?? validSnapshot!;
      const snapshotEndDate = validSnapshot?.endDate;
      const effectiveEndDate =
        [baseCfg.endDate, snapshotEndDate, endDate]
          .filter((date): date is string => !!date)
          .sort()[0] ?? endDate;
      const snapshotChanges = validSnapshot ?? baseCfg;
      const deletedInstanceDates = Array.from(
        new Set([
          ...(baseCfg.deletedInstanceDates ?? []),
          ...(validSnapshot?.deletedInstanceDates ?? []),
        ]),
      ).filter((date) => date <= effectiveEndDate);
      const stoppedCfg: TaskRepeatCfg = {
        ...baseCfg,
        ...snapshotChanges,
        id: taskRepeatCfgId,
        endDate: effectiveEndDate,
        deletedInstanceDates,
      };
      return cfg
        ? adapter.updateOne(
            {
              id: taskRepeatCfgId,
              changes: stoppedCfg,
            },
            state,
          )
        : adapter.addOne(stoppedCfg, state);
    },
  ),
  on(
    TaskSharedActions.materializeTaskRepeatCfgInstance,
    (state, { repeatCfgId, occurrenceDay }) => {
      const cfg = state.entities[repeatCfgId];
      if (!cfg) return state;
      if (cfg.endDate && occurrenceDay > cfg.endDate) {
        return state;
      }

      const deletedInstanceDates = cfg.deletedInstanceDates ?? [];
      if (deletedInstanceDates.includes(occurrenceDay)) {
        return state;
      }

      return adapter.updateOne(
        {
          id: repeatCfgId,
          changes: {
            deletedInstanceDates: [...deletedInstanceDates, occurrenceDay],
          },
        },
        state,
      );
    },
  ),

  // INTERNAL
  on(addTaskRepeatCfgToTask, (state, { taskRepeatCfg }) =>
    adapter.addOne(taskRepeatCfg, state),
  ),
  on(updateTaskRepeatCfg, (state, { taskRepeatCfg }) =>
    adapter.updateOne(taskRepeatCfg, state),
  ),
  on(upsertTaskRepeatCfg, (state, { taskRepeatCfg }) =>
    adapter.upsertOne(taskRepeatCfg, state),
  ),
  on(deleteTaskRepeatCfg, (state, { id }) => adapter.removeOne(id, state)),
  on(deleteTaskRepeatCfgs, (state, { ids }) => adapter.removeMany(ids, state)),
  on(updateTaskRepeatCfgs, (state, { ids, changes }) =>
    adapter.updateMany(
      ids.map((id) => ({
        id,
        changes,
      })),
      state,
    ),
  ),
  on(deleteTaskRepeatCfg, (state, { id }) => adapter.removeOne(id, state)),
  on(deleteTaskRepeatCfgInstance, (state, { repeatCfgId, dateStr }) => {
    const cfg = state.entities[repeatCfgId];
    if (
      !cfg ||
      !isValidTaskRepeatOccurrenceDay(dateStr) ||
      (cfg.endDate && dateStr > cfg.endDate)
    ) {
      return state;
    }

    const deletedDates = cfg.deletedInstanceDates || [];
    if (!deletedDates.includes(dateStr)) {
      return adapter.updateOne(
        {
          id: repeatCfgId,
          changes: {
            deletedInstanceDates: [...deletedDates, dateStr],
          },
        },
        state,
      );
    }
    return state;
  }),
);
