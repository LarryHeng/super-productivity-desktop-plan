/* eslint-disable @typescript-eslint/naming-convention */
import { plannerInitialState, plannerReducer } from './planner.reducer';
import { PlannerActions } from './planner.actions';
import { DEFAULT_TASK } from '../../tasks/task.model';

describe('Planner Reducer', () => {
  describe('an unknown action', () => {
    it('should return the previous state', () => {
      const action = {} as any;
      const result = plannerReducer(plannerInitialState, action);
      expect(result).toBe(plannerInitialState);
    });
  });

  describe('moveBeforeTask', () => {
    it('should do nothing when the target does not exist', () => {
      const action = PlannerActions.moveBeforeTask({
        fromTask: { ...DEFAULT_TASK, id: '1', projectId: 'test' },
        toTaskId: '2',
      });
      const result = plannerReducer(
        {
          ...plannerInitialState,
          days: {
            someDay: [],
          },
        },
        action,
      );
      expect(result).toEqual({
        ...plannerInitialState,
        days: {
          someDay: [],
        },
      });
    });

    it('should move to index before target task', () => {
      const action = PlannerActions.moveBeforeTask({
        fromTask: { ...DEFAULT_TASK, id: '1', projectId: 'test' },
        toTaskId: '2',
      });
      const result = plannerReducer(
        {
          ...plannerInitialState,
          days: {
            someDay: ['2'],
          },
        },
        action,
      );
      expect(result).toEqual({
        ...plannerInitialState,
        days: {
          someDay: ['1', '2'],
        },
      });
    });
  });

  describe('cleanupOldAndUndefinedPlannerTasks', () => {
    it('preserves missing task references on historical days but cleans current days', () => {
      const result = plannerReducer(
        {
          ...plannerInitialState,
          days: {
            '2026-06-20': ['existing', 'deleted'],
            '2026-06-27': ['existing'],
          },
        },
        PlannerActions.cleanupOldAndUndefinedPlannerTasks({
          today: '2026-06-27',
          allTaskIds: ['existing'],
        }),
      );

      expect(result.days).toEqual({
        '2026-06-20': ['existing', 'deleted'],
        '2026-06-27': ['existing'],
      });
    });
  });

  // NOTE: planTaskForDay is now tested in planner-shared.reducer.spec.ts
});
