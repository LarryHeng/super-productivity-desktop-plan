import { Injectable, signal } from '@angular/core';
import { TaskWidgetConfig } from './global-config.model';
import { IS_ELECTRON } from '../../app.constants';
import { Log } from '../../core/log';

const STORAGE_KEY = 'sp_task_widget_settings';
const IMAGE_CACHE_PREFIX = 'image:';
export const TASK_WIDGET_THEME_BACKGROUND = 'task-widget:theme';

const DEFAULT_TASK_WIDGET_CONFIG: Required<TaskWidgetConfig> = {
  isEnabled: false,
  isAlwaysShow: true,
  opacity: 95,
  contentOpacity: 100,
  backgroundImage: TASK_WIDGET_THEME_BACKGROUND,
  backgroundImageOpacity: 45,
  backgroundPositionX: 50,
  backgroundPositionY: 50,
};

const getCachedImageId = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.startsWith(IMAGE_CACHE_PREFIX)
    ? value.substring(IMAGE_CACHE_PREFIX.length) || null
    : null;

/**
 * The task widget settings live in localStorage rather than the synced global
 * config because OS behavior (window dragging/resizing, transparency support)
 * differs enough between platforms that one shared value across machines makes
 * little sense.
 */
@Injectable({ providedIn: 'root' })
export class TaskWidgetSettingsService {
  private readonly _settings = signal<Required<TaskWidgetConfig>>(
    this._loadFromStorage(),
  );
  readonly settings = this._settings.asReadonly();

  constructor() {
    if (IS_ELECTRON) {
      this._notifyElectron(this._settings());
    }
  }

  update(partial: Partial<TaskWidgetConfig>): void {
    const prev = this._settings();
    const next: Required<TaskWidgetConfig> = { ...this._settings(), ...partial };
    this._settings.set(next);
    this._persistToStorage(next);
    if (Object.prototype.hasOwnProperty.call(partial, 'backgroundImage')) {
      this._cleanupReplacedCachedImage(prev.backgroundImage, next.backgroundImage);
    }
    if (IS_ELECTRON) {
      this._notifyElectron(next);
    }
  }

  private _loadFromStorage(): Required<TaskWidgetConfig> {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_TASK_WIDGET_CONFIG };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_TASK_WIDGET_CONFIG };
      const parsed = JSON.parse(raw) as Partial<TaskWidgetConfig>;
      return { ...DEFAULT_TASK_WIDGET_CONFIG, ...parsed };
    } catch (e) {
      Log.err('Failed to read task widget settings from localStorage', e);
      return { ...DEFAULT_TASK_WIDGET_CONFIG };
    }
  }

  private _persistToStorage(value: Required<TaskWidgetConfig>): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (e) {
      Log.err('Failed to persist task widget settings to localStorage', e);
    }
  }

  private _notifyElectron(value: Required<TaskWidgetConfig>): void {
    if (typeof window === 'undefined' || !window.ea) return;
    window.ea.updateTaskWidgetSettings(value);
  }

  private _cleanupReplacedCachedImage(
    prevImage: string | null | undefined,
    nextImage: string | null | undefined,
  ): void {
    const prevId = getCachedImageId(prevImage);
    const nextId = getCachedImageId(nextImage);
    if (!prevId || prevId === nextId || !IS_ELECTRON || typeof window === 'undefined') {
      return;
    }
    void window.ea?.imageCacheRemove(prevId).catch((e) => {
      Log.err('Failed to remove previous task widget background image', e);
    });
  }
}
