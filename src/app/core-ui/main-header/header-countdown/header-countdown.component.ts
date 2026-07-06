import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { GlobalConfigService } from '../../../features/config/global-config.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Component({
  selector: 'header-countdown',
  standalone: true,
  template: `
    @if (name() && daysRemaining() !== null) {
      <div class="header-countdown">
        <span
          class="countdown-prefix"
          [style.color]="commonColor()"
          [style.font-size.px]="commonFontSize()"
          >距离</span
        >
        <span
          class="countdown-name"
          [style.color]="nameColor()"
          [style.font-size.px]="nameFontSize()"
          [style.font-weight]="isBold() ? 'bold' : 'normal'"
          >{{ name() }}</span
        >
        <span
          class="countdown-prefix"
          [style.color]="commonColor()"
          [style.font-size.px]="commonFontSize()"
          >还剩</span
        >
        <span
          class="countdown-days"
          [style.color]="daysColor()"
          [style.font-size.px]="daysFontSize()"
          [style.font-weight]="isBold() ? 'bold' : 'normal'"
          >{{ daysRemaining() }}天</span
        >
      </div>
    } @else if (name() && daysRemaining() !== null && daysRemaining() === 0) {
      <div class="header-countdown">
        <span class="countdown-prefix">今天就是</span>
        <span
          class="countdown-name"
          [style.color]="nameColor()"
          [style.font-size.px]="nameFontSize()"
          >{{ name() }}！</span
        >
      </div>
    }
  `,
  styles: [
    `
      :host {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        justify-content: center;
      }

      .header-countdown {
        text-align: center;
        max-width: 100%;
        min-width: 0;
        padding: 0 var(--s2);
        user-select: none;
        cursor: default;
        white-space: nowrap;
        display: flex;
        align-items: baseline;
        gap: 4px;
      }

      .countdown-prefix {
        font-size: 13px;
        font-style: italic;
        color: var(--c-secondary-text, rgba(128, 128, 128, 0.7));
        flex-shrink: 0;
      }

      .countdown-name {
        flex-shrink: 0;
      }

      .countdown-days {
        flex-shrink: 0;
      }

      @media (max-width: 600px) {
        .header-countdown {
          display: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderCountdownComponent implements OnDestroy {
  private readonly _globalConfigService = inject(GlobalConfigService);

  private readonly _now = signal(Date.now());
  private _intervalId?: ReturnType<typeof setInterval>;

  readonly name = computed<string>(
    () => (this._globalConfigService.misc()?.countdownTargetName as string) || '',
  );
  readonly targetDate = computed<string>(
    () => (this._globalConfigService.misc()?.countdownTargetDate as string) || '',
  );

  readonly nameColor = computed<string>(
    () => (this._globalConfigService.misc()?.countdownNameColor as string) ?? '#e53935',
  );
  readonly nameFontSize = computed<number>(
    () => (this._globalConfigService.misc()?.countdownNameFontSize as number) ?? 14,
  );
  readonly daysColor = computed<string>(
    () => (this._globalConfigService.misc()?.countdownDaysColor as string) ?? '#e53935',
  );
  readonly daysFontSize = computed<number>(
    () => (this._globalConfigService.misc()?.countdownDaysFontSize as number) ?? 16,
  );
  readonly isBold = computed<boolean>(
    () => (this._globalConfigService.misc()?.countdownIsBold as boolean) ?? true,
  );
  readonly commonColor = computed<string>(
    () => (this._globalConfigService.misc()?.countdownCommonColor as string) ?? '#888888',
  );
  readonly commonFontSize = computed<number>(
    () => (this._globalConfigService.misc()?.countdownCommonFontSize as number) ?? 13,
  );

  readonly daysRemaining = computed<number | null>(() => {
    const dateStr = this.targetDate();
    const now = this._now();
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    const targetMs = Date.UTC(y, m - 1, d, 16, 0, 0, 0);
    return Math.ceil((targetMs - now) / MS_PER_DAY);
  });

  constructor() {
    this._intervalId = setInterval(() => {
      this._now.set(Date.now());
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
    }
  }
}
