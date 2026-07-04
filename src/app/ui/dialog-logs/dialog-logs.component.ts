import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { Log } from '../../core/log';
import { download } from '../../util/download';
import { IS_ELECTRON } from '../../app.constants';
import { SnackService } from '../../core/snack/snack.service';
import { ShareService } from '../../core/share/share.service';

interface DialogLogsData {
  logs: string;
}

@Component({
  selector: 'dialog-logs',
  templateUrl: './dialog-logs.component.html',
  styleUrls: ['./dialog-logs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatIcon,
    TranslatePipe,
  ],
})
export class DialogLogsComponent {
  private readonly _dialogRef = inject<MatDialogRef<DialogLogsComponent>>(MatDialogRef);
  private readonly _snackService = inject(SnackService);
  private readonly _shareService = inject(ShareService);
  readonly data = inject<DialogLogsData>(MAT_DIALOG_DATA);

  readonly T: typeof T = T;
  readonly isNative = IS_ELECTRON;

  clear(): void {
    Log.clearLogHistory();
    // Refresh by reopening the dialog or updating data — for simplicity,
    // close and let the user reopen. The hint text already guides this.
    this._dialogRef.close();
  }

  async copy(): Promise<void> {
    const result = await this._shareService.copyToClipboard(this.data.logs, 'Logs');
    if (!result.success) {
      this._snackService.open(T.DIALOG_LOGS.S_COPY_FAILED);
    }
  }

  async openFolder(): Promise<void> {
    try {
      const result = await download('SP-logs.json', this.data.logs);
      if (result.path && window.ea?.openPath) {
        const dir = result.path.replace(/[^/\\]*$/, '');
        window.ea.openPath(dir);
      }
    } catch (e) {
      Log.err('Log file share failed', e);
      this._snackService.open(T.DIALOG_LOGS.S_SHARE_FAILED);
    }
  }

  close(): void {
    this._dialogRef.close();
  }
}
