import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LayoutService } from '../../../core-ui/layout/layout.service';
import { pickRandomTip } from '../../productivity-tips.const';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
  selector: 'header-productivity-tip',
  standalone: true,
  imports: [MatTooltip],
  template: `
    @if (!layoutService.isXs()) {
      <div
        class="header-quote"
        [matTooltip]="tipBody()"
        [matTooltipPosition]="'below'"
      >
        {{ tipHeading() }}
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
        overflow: hidden;
      }

      .header-quote {
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
        font-style: italic;
        color: var(--c-secondary-text, rgba(128, 128, 128, 0.7));
        max-width: 100%;
        min-width: 0;
        padding: 0 var(--s2);
        user-select: none;
        cursor: default;
      }

      @media (max-width: 600px) {
        .header-quote {
          display: none;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderProductivityTipComponent {
  private readonly _tip = pickRandomTip();
  readonly layoutService = inject(LayoutService);

  readonly tipHeading = computed(() => this._tip[0]);
  readonly tipBody = computed(() => (this._tip[0] === this._tip[1] ? '' : this._tip[1]));
}
