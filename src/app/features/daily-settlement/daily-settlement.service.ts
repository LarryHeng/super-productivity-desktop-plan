import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { first, timeout } from 'rxjs/operators';
import { BeforeFinishDayService } from '../before-finish-day/before-finish-day.service';
import { Task } from '../tasks/task.model';
import { TaskService } from '../tasks/task.service';
import { SyncWrapperService } from '../../imex/sync/sync-wrapper.service';
import { OperationWriteFlushService } from '../../op-log/sync/operation-write-flush.service';
import { GlobalConfigService } from '../config/global-config.service';
import { SYNC_WAIT_TIMEOUT_MS } from '../../imex/sync/sync.const';
import { Log } from '../../core/log';
import { IMPORTANT_TAG, URGENT_TAG } from '../tag/tag.const';

const DAILY_SETTLEMENT_SYNC_WAIT_TIMEOUT_MS = 30000;

export type CompletedTaskSettlementOptions = Readonly<{
  doneBefore?: number;
}>;

export type SettleCompletedTasksOptions = CompletedTaskSettlementOptions &
  Readonly<{
    isShowSnack?: boolean;
  }>;

@Injectable({
  providedIn: 'root',
})
export class DailySettlementService {
  private readonly _beforeFinishDayService = inject(BeforeFinishDayService);
  private readonly _taskService = inject(TaskService);
  private readonly _syncWrapperService = inject(SyncWrapperService);
  private readonly _operationWriteFlushService = inject(OperationWriteFlushService);
  private readonly _globalConfigService = inject(GlobalConfigService);

  async settleCompletedTasks(options: SettleCompletedTasksOptions = {}): Promise<number> {
    await this.prepareForSettlement();
    const settledCount = await this.clearMatrixTagsFromCompletedTasks(options);
    await this.finishPersistenceAndSync();
    return settledCount;
  }

  async prepareForSettlement(): Promise<void> {
    await this._beforeFinishDayService.executeActions();
    await firstValueFrom(
      this._syncWrapperService.afterCurrentSyncDoneOrSyncDisabled$.pipe(
        first(),
        timeout(DAILY_SETTLEMENT_SYNC_WAIT_TIMEOUT_MS),
      ),
    ).catch((err) => {
      Log.warn(
        '[DailySettlement] Sync wait timed out after 30s, proceeding anyway:',
        err,
      );
    });
  }

  async clearMatrixTagsFromCompletedTasks(
    options: CompletedTaskSettlementOptions = {},
  ): Promise<number> {
    const allTasks = await firstValueFrom(this._taskService.allTasks$.pipe(first()));
    const doneTasks = allTasks.filter((task) =>
      this._isTaskReadyForSettlement(task, options.doneBefore),
    );

    for (const task of doneTasks) {
      this._taskService.updateTags(
        task,
        (task.tagIds ?? []).filter(
          (tagId) => tagId !== URGENT_TAG.id && tagId !== IMPORTANT_TAG.id,
        ),
      );
    }

    return doneTasks.length;
  }

  async finishPersistenceAndSync(): Promise<boolean> {
    const cfg = this._globalConfigService.cfg();
    let isLocalStateFlushed = false;
    try {
      await this._operationWriteFlushService.flushPendingWrites();
      isLocalStateFlushed = true;
      if (cfg?.sync?.isEnabled) {
        await this._runFinalSyncBeforeFinishDay();
      }
    } catch (err) {
      Log.warn(
        '[DailySettlement] Final persistence or sync before finishing day failed:',
        err,
      );
    }
    return isLocalStateFlushed;
  }

  private _isTaskReadyForSettlement(task: Task, doneBefore?: number): boolean {
    if (!task.isDone || task.parentId) {
      return false;
    }
    if (typeof doneBefore !== 'number') {
      return true;
    }
    return !task.doneOn || task.doneOn <= doneBefore;
  }

  private async _runFinalSyncBeforeFinishDay(): Promise<void> {
    let syncTimeoutId: number | undefined;
    try {
      await Promise.race([
        this._syncWrapperService.sync(),
        new Promise<never>((_, reject) => {
          syncTimeoutId = window.setTimeout(
            () => reject(new Error('Daily settlement final sync timed out')),
            SYNC_WAIT_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (syncTimeoutId !== undefined) {
        window.clearTimeout(syncTimeoutId);
      }
    }
  }
}
