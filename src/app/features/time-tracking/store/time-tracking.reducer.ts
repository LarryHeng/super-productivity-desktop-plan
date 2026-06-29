import {
  TimeTrackingActions,
  updateWorkContextData,
  syncTimeTracking,
} from './time-tracking.actions';
import { Action, ActionReducer, createFeature, createReducer, on } from '@ngrx/store';
import { TimeTrackingFeatureState, TimeTrackingState } from '../time-tracking.model';
import { loadAllData } from '../../../root-store/meta/load-all-data.action';
import { AppDataComplete } from '../../../op-log/model/model-config';
import { roundTsToMinutes } from '../../../util/round-ts-to-minutes';
import { TODAY_TAG } from '../../tag/tag.const';

export const TIME_TRACKING_FEATURE_KEY = 'timeTracking' as const;

// export const initialTimeTrackingState: TimeTrackingState = {
export const initialTimeTrackingState: TimeTrackingFeatureState = {
  tag: {},
  project: {},
  taskSegments: {},
  // lastFlush: 0,
} as const;

const normalizeTimeTrackingState = (
  state: TimeTrackingState | undefined,
): TimeTrackingFeatureState | undefined =>
  state && !state.taskSegments
    ? {
        ...initialTimeTrackingState,
        ...state,
        taskSegments: state.taskSegments ?? {},
      }
    : (state as TimeTrackingFeatureState | undefined);

const timeTrackingReducerInternal = createReducer(
  initialTimeTrackingState,

  on(loadAllData, (state, { appDataComplete }) => {
    const loadedState = (appDataComplete as AppDataComplete).timeTracking;
    return loadedState
      ? {
          ...initialTimeTrackingState,
          ...loadedState,
          taskSegments: loadedState.taskSegments ?? {},
        }
      : state;
  }),
  on(TimeTrackingActions.updateWholeState, (state, { newState }) => ({
    ...newState,
    taskSegments: newState.taskSegments ?? {},
  })),

  on(TimeTrackingActions.addTimeSpent, (state, { task, date }) => {
    const isUpdateProject = !!task.projectId;

    return {
      ...state,
      ...(isUpdateProject
        ? {
            project: {
              ...state.project,
              [task.projectId]: {
                ...state.project[task.projectId],
                [date]: {
                  ...state.project[task.projectId]?.[date],
                  e: roundTsToMinutes(Date.now()),
                  s: roundTsToMinutes(
                    state.project[task.projectId]?.[date]?.s || Date.now(),
                  ),
                },
              },
            },
          }
        : {}),
      tag: {
        ...state.tag,
        ...([TODAY_TAG.id, ...(task.tagIds || [])] as string[]).reduce((acc, tagId) => {
          acc[tagId] = {
            ...state.tag[tagId],
            [date]: {
              ...state.tag[tagId]?.[date],
              e: roundTsToMinutes(Date.now()),
              s: roundTsToMinutes(state.tag[tagId]?.[date]?.s || Date.now()),
            },
          };
          return acc;
        }, {}),
      },
    };
  }),

  on(
    TimeTrackingActions.addActualTimeSegment,
    (state, { taskId, date, start, end, source }) => {
      if (
        !taskId ||
        !date ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
      ) {
        return state;
      }

      const existingSegments = state.taskSegments?.[date] ?? [];
      const isDuplicate = existingSegments.some(
        (segment) =>
          segment.taskId === taskId &&
          segment.start === start &&
          segment.end === end &&
          segment.source === source,
      );
      if (isDuplicate) {
        return state;
      }

      return {
        ...state,
        taskSegments: {
          ...(state.taskSegments ?? {}),
          [date]: [
            ...existingSegments,
            {
              taskId,
              start,
              end,
              ...(source ? { source } : {}),
            },
          ],
        },
      };
    },
  ),

  on(updateWorkContextData, (state, { ctx, date, updates }) => {
    const prop = ctx.type === 'TAG' ? 'tag' : 'project';

    return {
      ...state,
      [prop]: {
        ...state[prop],
        [ctx.id]: {
          ...(state[prop]?.[ctx.id] || {}),
          [date]: {
            ...(state[prop]?.[ctx.id]?.[date] || {}),
            ...updates,
          },
        },
      },
    };
  }),

  on(syncTimeTracking, (state, { contextType, contextId, date, data }) => {
    const prop = contextType === 'TAG' ? 'tag' : 'project';

    return {
      ...state,
      [prop]: {
        ...state[prop],
        [contextId]: {
          ...(state[prop]?.[contextId] || {}),
          [date]: data,
        },
      },
    };
  }),
);

export const timeTrackingReducer = (
  state: TimeTrackingState | undefined,
  action: Action,
): TimeTrackingFeatureState =>
  timeTrackingReducerInternal(normalizeTimeTrackingState(state), action);

const timeTrackingFeatureReducer: ActionReducer<TimeTrackingFeatureState> = (
  state,
  action,
) => timeTrackingReducer(state, action);

export const timeTrackingFeature = createFeature({
  name: TIME_TRACKING_FEATURE_KEY,
  reducer: timeTrackingFeatureReducer,
});
