import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { DailySettlementService } from './daily-settlement.service';
import { TaskService } from '../tasks/task.service';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { BeforeFinishDayService } from '../before-finish-day/before-finish-day.service';
import { SyncWrapperService } from '../../imex/sync/sync-wrapper.service';
import { OperationWriteFlushService } from '../../op-log/sync/operation-write-flush.service';
import { GlobalConfigService } from '../config/global-config.service';
import { IMPORTANT_TAG, URGENT_TAG } from '../tag/tag.const';

describe('DailySettlementService', () => {
  let service: DailySettlementService;
  let allTasks$: BehaviorSubject<Task[]>;
  let taskService: jasmine.SpyObj<TaskService>;

  const createTask = (task: Partial<Task>): Task => ({
    ...DEFAULT_TASK,
    id: task.id ?? 'task-id',
    title: task.title ?? task.id ?? 'Task',
    projectId: 'p1',
    ...task,
  });

  beforeEach(() => {
    allTasks$ = new BehaviorSubject<Task[]>([]);
    taskService = jasmine.createSpyObj<TaskService>(
      'TaskService',
      ['moveToArchive', 'updateTags'],
      {
        allTasks$: allTasks$.asObservable(),
      },
    );
    taskService.moveToArchive.and.resolveTo();

    const beforeFinishDayService = jasmine.createSpyObj<BeforeFinishDayService>(
      'BeforeFinishDayService',
      ['executeActions'],
    );
    beforeFinishDayService.executeActions.and.resolveTo('SUCCESS');

    const syncWrapperService = jasmine.createSpyObj<SyncWrapperService>(
      'SyncWrapperService',
      ['sync'],
      {
        afterCurrentSyncDoneOrSyncDisabled$: of(true),
      },
    );
    syncWrapperService.sync.and.resolveTo(undefined);

    const operationWriteFlushService = jasmine.createSpyObj<OperationWriteFlushService>(
      'OperationWriteFlushService',
      ['flushPendingWrites'],
    );
    operationWriteFlushService.flushPendingWrites.and.resolveTo();

    const globalConfigService = jasmine.createSpyObj<GlobalConfigService>(
      'GlobalConfigService',
      ['cfg'],
    );
    globalConfigService.cfg.and.returnValue({ sync: { isEnabled: false } } as any);

    TestBed.configureTestingModule({
      providers: [
        DailySettlementService,
        { provide: TaskService, useValue: taskService },
        { provide: BeforeFinishDayService, useValue: beforeFinishDayService },
        { provide: SyncWrapperService, useValue: syncWrapperService },
        { provide: OperationWriteFlushService, useValue: operationWriteFlushService },
        { provide: GlobalConfigService, useValue: globalConfigService },
      ],
    });

    service = TestBed.inject(DailySettlementService);
  });

  it('removes matrix tags from completed tasks without archiving them', async () => {
    const doneParent = createTask({
      id: 'done-parent',
      isDone: true,
      tagIds: [URGENT_TAG.id, IMPORTANT_TAG.id, 'keep-me'],
      subTaskIds: ['done-sub'],
    });
    const doneSubTask = createTask({
      id: 'done-sub',
      parentId: 'done-parent',
      isDone: true,
    });
    const undoneParent = createTask({ id: 'undone-parent', isDone: false });
    const orphanDoneSubTask = createTask({
      id: 'orphan-done-sub',
      parentId: 'other-parent',
      isDone: true,
    });
    allTasks$.next([doneParent, doneSubTask, undoneParent, orphanDoneSubTask]);

    const settledCount = await service.clearMatrixTagsFromCompletedTasks();

    expect(settledCount).toBe(1);
    expect(taskService.moveToArchive).not.toHaveBeenCalled();
    expect(taskService.updateTags).toHaveBeenCalledOnceWith(doneParent, ['keep-me']);
  });

  it('only clears tags for tasks completed before the automatic settlement boundary', async () => {
    const boundaryMs = new Date(2026, 0, 2, 4, 0).getTime();
    allTasks$.next([
      createTask({ id: 'old-done', isDone: true, doneOn: boundaryMs - 1 }),
      createTask({ id: 'legacy-done', isDone: true, doneOn: undefined }),
      createTask({ id: 'new-done', isDone: true, doneOn: boundaryMs + 1 }),
    ]);

    const settledCount = await service.clearMatrixTagsFromCompletedTasks({
      doneBefore: boundaryMs,
    });

    expect(settledCount).toBe(2);
    expect(taskService.updateTags.calls.allArgs().map(([task]) => task.id)).toEqual([
      'old-done',
      'legacy-done',
    ]);
  });
});
