import { computed, effect, inject, Injectable } from '@angular/core';
import { GlobalConfigService } from '../features/config/global-config.service';
import { Log, LogLevel } from './log';

/**
 * Diagnostic logging service — controlled by the "Diagnostic logging" toggle
 * in Settings → General → Misc Settings.
 *
 * When enabled, the global Log level is elevated to DEBUG so all log entries
 * (including VERBOSE-level NgRx action traces from the actionLoggerReducer)
 * are visible in the console and captured in the exportable log history
 * (Settings → Logs dialog).
 *
 * Use debug() for diagnostic-only log points that should be silent when the
 * toggle is off — no need to guard with `if (enabled)` at every call site.
 *
 * GlobalConfigService is injected optionally so the service degrades
 * gracefully to a no-op in test environments that don't set up NgRx Store.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosticLogService {
  private readonly _globalConfigService = inject(GlobalConfigService, { optional: true });

  readonly isEnabled = computed(() => {
    try {
      return this._globalConfigService?.cfg()?.misc?.isDiagnosticLoggingEnabled ?? false;
    } catch {
      return false;
    }
  });

  constructor() {
    if (this._globalConfigService) {
      effect(() => {
        try {
          if (this.isEnabled()) {
            Log.setLevel(LogLevel.DEBUG);
            Log.debug('DIAG', 'Diagnostic logging enabled');
          } else {
            Log.setLevel(LogLevel.VERBOSE);
          }
        } catch {
          // noop when GlobalConfigService mock lacks a proper Signal cfg
        }
      });
    }
  }

  /** Log diagnostic data — only emitted when the toggle is on. */
  debug(context: string, ...args: unknown[]): void {
    if (this.isEnabled()) {
      Log.debug(context, ...args);
    }
  }
}
