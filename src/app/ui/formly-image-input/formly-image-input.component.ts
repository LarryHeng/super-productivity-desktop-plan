import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FieldType } from '@ngx-formly/material';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogUnsplashPickerComponent } from '../dialog-unsplash-picker/dialog-unsplash-picker.component';
import { UnsplashService } from '../../core/unsplash/unsplash.service';
import { SnackService } from '../../core/snack/snack.service';
import { T } from '../../t.const';
import { IS_ELECTRON } from '../../app.constants';
import { Log } from '../../core/log';
import { startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { resolveBgImageToDataUrl } from '../../core/theme/resolve-bg-image-to-data-url.util';
import { normalizeBackgroundFocus } from '../../core/theme/background-focus.util';

const MAX_BACKGROUND_IMAGE_FILE_SIZE_BYTES = 256 * 1024;

@Component({
  selector: 'formly-image-input',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    FormlyModule,
    MatInput,
    MatButton,
    MatIcon,
    TranslatePipe,
  ],
  templateUrl: './formly-image-input.component.html',
  styleUrls: ['./formly-image-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormlyImageInputComponent
  extends FieldType<FormlyFieldConfig>
  implements OnInit
{
  private _dialog = inject(MatDialog);
  private _unsplashService = inject(UnsplashService);
  private _snackService = inject(SnackService);
  private _destroyRef = inject(DestroyRef);
  private _pathResolveGeneration = 0;
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  readonly T = T;
  readonly IS_ELECTRON = IS_ELECTRON;
  // Guard against double-click while the main-side dialog + import is in
  // flight. A second click would otherwise queue a second IPC that opens
  // a second dialog after the first resolves and orphan all but the last
  // selected import in the main-owned background image cache.
  readonly isPickerBusy = signal(false);
  readonly isLibraryPickerBusy = signal(false);
  readonly taskWidgetBackgroundReference = signal('');
  readonly backgroundLibraryPath = signal('');
  readonly backgroundPreview = signal<string | null>(null);
  readonly backgroundFocusX = signal(50);
  readonly backgroundFocusY = signal(50);

  ngOnInit(): void {
    this._syncBackgroundFocusFromModel();
    this.formControl.valueChanges
      .pipe(startWith(this.formControl.value), takeUntilDestroyed(this._destroyRef))
      .subscribe((value) => {
        void this._updateManagedImagePath(value);
        void this._updateBackgroundPreview(value);
      });
    void this._loadBackgroundLibraryPath();
  }

  get isUnsplashAvailable(): boolean {
    return this._unsplashService.isAvailable();
  }

  async openFileExplorer(): Promise<void> {
    if (!this.IS_ELECTRON || this.isPickerBusy()) {
      return;
    }
    // Post-#8228: dialog + import are atomic in main. The renderer never
    // sees the absolute path and cannot trigger an import without a real
    // user-driven dialog interaction. Old cached images are not deleted here:
    // the surrounding form save can still be cancelled or fail.
    this.isPickerBusy.set(true);
    try {
      const result = await window.ea.imagePickAndImport();
      if (result instanceof Error) {
        // Validation failure (extension, size cap, etc.). User-cancel
        // returns null. See electron/local-file-sync.ts IMAGE_PICK_AND_IMPORT.
        this._snackService.open({
          msg: T.F.PROJECT.FORM_THEME.S_BACKGROUND_IMAGE_READ_ERROR,
          type: 'ERROR',
        });
        return;
      }
      if (!result) {
        return; // user cancelled
      }
      this._resetBackgroundFocus();
      this.formControl.setValue(`image:${result.id}`);
    } finally {
      this.isPickerBusy.set(false);
    }
  }

  clearImage(): void {
    this.formControl.setValue(null);
  }

  restoreTaskWidgetTheme(): void {
    this.formControl.setValue('task-widget:theme');
  }

  useGlobalTaskWidgetBackground(): void {
    this.formControl.setValue(null);
  }

  async chooseBackgroundLibraryDirectory(): Promise<void> {
    if (
      !this.IS_ELECTRON ||
      this.isLibraryPickerBusy() ||
      typeof window.ea?.imageCachePickDirectory !== 'function'
    ) {
      return;
    }

    this.isLibraryPickerBusy.set(true);
    try {
      const result = await window.ea.imageCachePickDirectory();
      if (!result) return;
      if ('error' in result) {
        this._snackService.open({
          msg: result.error,
          type: 'ERROR',
          isSkipTranslate: true,
        });
        return;
      }
      this.backgroundLibraryPath.set(result.effectiveDir);
      await this._updateManagedImagePath(this.formControl.value);
      this._snackService.open({
        msg: T.F.PROJECT.FORM_THEME.S_BACKGROUND_LIBRARY_CHANGED,
        type: 'SUCCESS',
        translateParams: { path: result.effectiveDir },
      });
    } finally {
      this.isLibraryPickerBusy.set(false);
    }
  }

  setBackgroundFocus(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = normalizeBackgroundFocus(((event.clientX - rect.left) / rect.width) * 100);
    const y = normalizeBackgroundFocus(((event.clientY - rect.top) / rect.height) * 100);
    const scrollHost = this._findScrollHost(target);
    const scrollTop = scrollHost?.scrollTop;
    this._writeBackgroundFocus(x, y);
    if (scrollHost && scrollTop !== undefined) {
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          if (scrollHost.isConnected) {
            scrollHost.scrollTop = scrollTop;
          }
          requestAnimationFrame(() => {
            if (scrollHost.isConnected) {
              scrollHost.scrollTop = scrollTop;
            }
          });
        });
      });
    }
  }

  get isTaskWidgetBackgroundMode(): boolean {
    return !!(
      (this.props as Record<string, unknown>)?.['taskWidgetBackgroundModes'] ??
      (this.field.templateOptions as Record<string, unknown> | undefined)?.[
        'taskWidgetBackgroundModes'
      ]
    );
  }

  get isTaskWidgetThemeSelected(): boolean {
    return this.formControl.value === 'task-widget:theme';
  }

  get isTaskWidgetGlobalSelected(): boolean {
    return this.formControl.value === null;
  }

  get isManagedImageSelected(): boolean {
    return (
      typeof this.formControl.value === 'string' &&
      this.formControl.value.startsWith('image:')
    );
  }

  get hasBackgroundFocusPicker(): boolean {
    return !!(this._backgroundFocusXKey && this._backgroundFocusYKey);
  }

  get hasManagedImageLibraryControls(): boolean {
    return !!this._getOption('managedImageLibraryControls');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (file.size > MAX_BACKGROUND_IMAGE_FILE_SIZE_BYTES) {
      this._snackService.open({
        msg: T.F.PROJECT.FORM_THEME.S_BACKGROUND_IMAGE_TOO_LARGE,
        type: 'ERROR',
        translateParams: {
          maxSizeKb: Math.round(MAX_BACKGROUND_IMAGE_FILE_SIZE_BYTES / 1024),
        },
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this._resetBackgroundFocus();
      this.formControl.setValue(result);
    };
    reader.onerror = () => {
      this._snackService.open({
        msg: T.F.PROJECT.FORM_THEME.S_BACKGROUND_IMAGE_READ_ERROR,
        type: 'ERROR',
      });
    };
    reader.readAsDataURL(file);
  }

  openUnsplashPicker(): void {
    if (!this.isUnsplashAvailable) {
      Log.warn('Unsplash service is not available - no API key configured');
      return;
    }

    const dialogRef = this._dialog.open(DialogUnsplashPickerComponent, {
      width: '900px',
      maxWidth: '95vw',
    });

    dialogRef.afterClosed().subscribe((result: string | { url: string } | null) => {
      if (result) {
        // Handle both string (legacy) and object (new) return formats
        const url = typeof result === 'string' ? result : result.url;
        if (url) {
          this._resetBackgroundFocus();
          this.formControl.setValue(url);
          // TODO: Store attribution data if needed for compliance display
        }
      }
    });
  }

  private async _updateManagedImagePath(value: unknown): Promise<void> {
    const generation = ++this._pathResolveGeneration;
    if (typeof value !== 'string' || !value.startsWith('image:')) {
      this.taskWidgetBackgroundReference.set(
        typeof value === 'string' && value !== 'task-widget:theme' ? value : '',
      );
      return;
    }

    const id = value.substring('image:'.length);
    const getDisplayPath = window.ea?.imageCacheGetDisplayPath;
    if (!this.IS_ELECTRON || !id || typeof getDisplayPath !== 'function') {
      this.taskWidgetBackgroundReference.set(value);
      return;
    }

    const displayPath = await getDisplayPath(id);
    if (generation === this._pathResolveGeneration) {
      this.taskWidgetBackgroundReference.set(displayPath ?? value);
    }
  }

  private async _updateBackgroundPreview(value: unknown): Promise<void> {
    if (
      !this.hasBackgroundFocusPicker ||
      typeof value !== 'string' ||
      value === 'task-widget:theme'
    ) {
      this.backgroundPreview.set(null);
      return;
    }
    this.backgroundPreview.set(await resolveBgImageToDataUrl(value));
  }

  private async _loadBackgroundLibraryPath(): Promise<void> {
    if (
      !this.IS_ELECTRON ||
      !this.hasManagedImageLibraryControls ||
      typeof window.ea?.imageCacheGetPathInfo !== 'function'
    ) {
      return;
    }
    const info = await window.ea.imageCacheGetPathInfo();
    this.backgroundLibraryPath.set(info.effectiveDir);
  }

  private _getOption(key: string): unknown {
    return (
      (this.props as Record<string, unknown>)?.[key] ??
      (this.field.templateOptions as Record<string, unknown> | undefined)?.[key]
    );
  }

  private get _backgroundFocusXKey(): string | null {
    const value = this._getOption('backgroundFocusXKey');
    return typeof value === 'string' && value ? value : null;
  }

  private get _backgroundFocusYKey(): string | null {
    const value = this._getOption('backgroundFocusYKey');
    return typeof value === 'string' && value ? value : null;
  }

  private _syncBackgroundFocusFromModel(): void {
    const model = this.model as Record<string, unknown> | undefined;
    this.backgroundFocusX.set(
      normalizeBackgroundFocus(
        this._backgroundFocusXKey ? model?.[this._backgroundFocusXKey] : 50,
      ),
    );
    this.backgroundFocusY.set(
      normalizeBackgroundFocus(
        this._backgroundFocusYKey ? model?.[this._backgroundFocusYKey] : 50,
      ),
    );
  }

  private _resetBackgroundFocus(): void {
    if (this.hasBackgroundFocusPicker) {
      this._writeBackgroundFocus(50, 50);
    }
  }

  private _writeBackgroundFocus(x: number, y: number): void {
    const xKey = this._backgroundFocusXKey;
    const yKey = this._backgroundFocusYKey;
    if (!xKey || !yKey) return;

    this.backgroundFocusX.set(x);
    this.backgroundFocusY.set(y);

    const model = this.model as Record<string, unknown> | undefined;
    if (model) {
      model[xKey] = x;
      model[yKey] = y;
    }

    const xControl = this.form?.get(xKey) ?? this.formControl.parent?.get(xKey);
    const yControl = this.form?.get(yKey) ?? this.formControl.parent?.get(yKey);
    if (xControl && yControl) {
      // Emit only after both values are current. Emitting X and Y separately
      // rebuilds the live Formly model twice and can move the settings viewport.
      xControl.setValue(x, { emitEvent: false });
      yControl.setValue(y);
      return;
    }

    if (model) {
      this.formControl.setValue(this.formControl.value);
    }
  }

  private _findScrollHost(start: HTMLElement): HTMLElement | null {
    let candidate: HTMLElement | null = start.parentElement;
    while (candidate) {
      const overflowY = getComputedStyle(candidate).overflowY;
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        candidate.scrollHeight > candidate.clientHeight
      ) {
        return candidate;
      }
      candidate = candidate.parentElement;
    }
    return document.scrollingElement instanceof HTMLElement
      ? document.scrollingElement
      : null;
  }
}
