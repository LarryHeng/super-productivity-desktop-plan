import {
  Component,
  ElementRef,
  Output,
  EventEmitter,
  ViewChild,
  Input,
  TemplateRef,
  AfterContentChecked,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { isInputOrTextAreaElement, getContentEditableCaretCoords } from './mention-utils';
import { getCaretCoordinates } from './caret-coords';
import { MentionItem } from './mention-config';
import { Log } from '../../core/log';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'mention-list',
  styleUrls: ['./mention-list.component.scss'],
  imports: [CommonModule, MatIcon],
  template: `
    <ng-template
      #defaultItemTemplate
      let-item="item"
    >
      <div class="custom-option-layout">
        @if (item && item.icon) {
          @if (item && item.isEmoji) {
            <span
              class="tag-ico-emoji"
              [style.color]="item.color"
            >
              {{ item.icon }}
            </span>
          } @else {
            <mat-icon
              class="option-main-icon"
              [style.color]="item.color"
            >
              {{ item.icon }}
            </mat-icon>
          }
        }
        <span class="option-title">{{ (item && item[labelKey]) || item }}</span>
      </div>
    </ng-template>
    <ul
      #list
      [hidden]="hidden()"
      class="dropdown-menu scrollable-menu"
      [class.mention-menu]="!styleOff"
      [class.mention-dropdown]="!styleOff && dropUp"
    >
      @for (item of items(); track item; let i = $index) {
        <li
          [class.active]="activeIndex === i"
          [class.mention-active]="!styleOff && activeIndex === i"
        >
          <a
            class="dropdown-item"
            [class.mention-item]="!styleOff"
            (mousedown)="activeIndex = i; itemClick.emit(); $event.preventDefault()"
          >
            <ng-template
              [ngTemplateOutlet]="itemTemplate"
              [ngTemplateOutletContext]="{ item: item }"
            ></ng-template>
          </a>
        </li>
      }
    </ul>
  `,
  standalone: true,
})
export class MentionListComponent implements AfterContentChecked {
  @Input() labelKey: string = 'label';
  @Input() itemTemplate?: TemplateRef<{ $implicit: MentionItem; index: number }>;
  @Output() itemClick = new EventEmitter();
  @ViewChild('list', { static: true }) list!: ElementRef;
  @ViewChild('defaultItemTemplate', { static: true })
  defaultItemTemplate!: TemplateRef<{ $implicit: MentionItem; index: number }>;
  items = signal<MentionItem[] | string[]>([]);
  hidden = signal(false);
  activeIndex: number = 0;
  dropUp: boolean = false;
  styleOff: boolean = false;
  private coords: { top: number; left: number } = { top: 0, left: 0 };
  private offset: number = 0;
  private readonly element = inject(ElementRef);

  ngAfterContentChecked(): void {
    if (!this.itemTemplate) {
      this.itemTemplate = this.defaultItemTemplate;
    }
  }

  // lots of confusion here between relative coordinates and containers
  position(
    nativeParentElement: HTMLInputElement,
    iframe: HTMLIFrameElement | null = null,
  ): void {
    if (isInputOrTextAreaElement(nativeParentElement)) {
      this.coords = getCaretCoordinates(
        nativeParentElement,
        nativeParentElement.selectionStart || 0,
        undefined,
      );
      this.coords.top =
        nativeParentElement.offsetTop + this.coords.top - nativeParentElement.scrollTop;
      this.coords.left =
        nativeParentElement.offsetLeft +
        this.coords.left -
        nativeParentElement.scrollLeft;
      this.offset = this.getBlockCursorDimensions(nativeParentElement).height;
    } else if (iframe) {
      const context: { iframe: HTMLIFrameElement | null; parent: Element | null } = {
        iframe: iframe,
        parent: iframe.offsetParent,
      };
      this.coords = getContentEditableCaretCoords(context);
    } else {
      const doc = document.documentElement;
      const scrollLeft = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0);
      const scrollTop = (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0);
      const caretRelativeToView = getContentEditableCaretCoords({
        iframe: iframe,
        parent: null,
      });
      const parentRelativeToContainer: ClientRect =
        nativeParentElement.getBoundingClientRect();
      this.coords.top =
        caretRelativeToView.top -
        parentRelativeToContainer.top +
        nativeParentElement.offsetTop -
        scrollTop;
      this.coords.left =
        caretRelativeToView.left -
        parentRelativeToContainer.left +
        nativeParentElement.offsetLeft -
        scrollLeft;
    }
    this.positionElement();
  }

  get activeItem(): MentionItem | string | null {
    const currentItems = this.items();
    if (!currentItems || !Array.isArray(currentItems) || currentItems.length === 0) {
      return null;
    }
    if (this.activeIndex < 0 || this.activeIndex >= currentItems.length) {
      Log.warn(
        `MentionListComponent: activeIndex ${this.activeIndex} is out of bounds for items array of length ${currentItems.length}`,
      );
      return null;
    }
    return currentItems[this.activeIndex];
  }

  activateNextItem(): void {
    const currentItems = this.items();
    const listEl: HTMLElement = this.list.nativeElement;
    const activeEl = listEl.getElementsByClassName('active').item(0);
    if (activeEl) {
      const nextLiEl: HTMLElement = <HTMLElement>activeEl.nextSibling;
      if (nextLiEl && nextLiEl.nodeName == 'LI') {
        const nextLiRect: ClientRect = nextLiEl.getBoundingClientRect();
        if (nextLiRect.bottom > listEl.getBoundingClientRect().bottom) {
          listEl.scrollTop = nextLiEl.offsetTop + nextLiRect.height - listEl.clientHeight;
        }
      }
    }
    this.activeIndex = Math.max(
      Math.min(this.activeIndex + 1, currentItems.length - 1),
      0,
    );
  }

  activatePreviousItem(): void {
    const currentItems = this.items();
    const listEl: HTMLElement = this.list.nativeElement;
    const activeEl = listEl.getElementsByClassName('active').item(0);
    if (activeEl) {
      const prevLiEl: HTMLElement = <HTMLElement>activeEl.previousSibling;
      if (prevLiEl && prevLiEl.nodeName == 'LI') {
        const prevLiRect: ClientRect = prevLiEl.getBoundingClientRect();
        if (prevLiRect.top < listEl.getBoundingClientRect().top) {
          listEl.scrollTop = prevLiEl.offsetTop;
        }
      }
    }
    this.activeIndex = Math.max(
      Math.min(this.activeIndex - 1, currentItems.length - 1),
      0,
    );
  }

  reset(): void {
    this.list.nativeElement.scrollTop = 0;
    this.checkBounds();
  }

  private checkBounds(): void {
    let left = this.coords.left;
    const top = this.coords.top;
    let dropUp = this.dropUp;
    const bounds: ClientRect = this.list.nativeElement.getBoundingClientRect();
    if (bounds.left + bounds.width > window.innerWidth) {
      left -= bounds.left + bounds.width - window.innerWidth + 10;
    }
    if (bounds.top < 0) {
      dropUp = false;
    }
    this.positionElement(left, top, dropUp);
  }

  private positionElement(
    left: number = this.coords.left,
    top: number = this.coords.top,
    dropUp: boolean = this.dropUp,
  ): void {
    const el: HTMLElement = this.element.nativeElement;
    top += dropUp ? 0 : this.offset;
    el.className = dropUp ? 'dropup' : '';
    el.style.position = 'absolute';
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  private getBlockCursorDimensions(nativeParentElement: HTMLInputElement): {
    height: number;
    width: number;
  } {
    const parentStyles = window.getComputedStyle(nativeParentElement);
    return {
      height: parseFloat(parentStyles.lineHeight),
      width: parseFloat(parentStyles.fontSize),
    };
  }
}
