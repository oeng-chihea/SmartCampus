import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ActionMenuItem } from './action-menu.model';

/**
 * Compact ⋮ action trigger with a hover/click dropdown.
 * Reusable across tables and toolbars.
 */
@Component({
  selector: 'app-action-menu',
  templateUrl: './action-menu.component.html',
  styleUrl: './action-menu.component.scss',
  host: {
    class: 'app-action-menu-host',
    '[class.app-action-menu-host--open]': 'open()',
  },
})
export class ActionMenuComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly instanceId = `action-menu-${Math.random().toString(36).slice(2, 9)}`;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  /** Menu entries (already filtered by the caller when needed). */
  readonly items = input.required<ActionMenuItem[]>();
  /** Accessible name for the trigger button. */
  readonly ariaLabel = input('Actions');
  /** Prefer opening the panel above the trigger when true. */
  readonly preferUp = input(false);

  readonly itemSelect = output<string>();

  readonly open = signal(false);
  readonly openUpward = signal(false);

  listId(): string {
    return `${this.instanceId}-list`;
  }

  visibleItems(): ActionMenuItem[] {
    return this.items().filter((item) => item.visible !== false);
  }

  onMenuMouseEnter(): void {
    this.clearCloseTimer();
    this.openPanel();
  }

  onMenuMouseLeave(): void {
    this.scheduleClose();
  }

  toggle(event?: Event): void {
    event?.stopPropagation();
    if (this.open()) {
      this.close();
      return;
    }
    this.openPanel();
  }

  openPanel(): void {
    if (this.visibleItems().length === 0) {
      return;
    }
    this.updatePlacement();
    this.open.set(true);
  }

  close(): void {
    this.clearCloseTimer();
    this.open.set(false);
    this.openUpward.set(false);
  }

  selectItem(item: ActionMenuItem, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (item.disabled) {
      return;
    }
    this.itemSelect.emit(item.id);
    this.close();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        event.preventDefault();
        event.stopPropagation();
        if (!this.open()) {
          this.openPanel();
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          event.stopPropagation();
          this.close();
        }
        break;
      default:
        break;
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.open()) {
      this.updatePlacement();
    }
  }

  private scheduleClose(): void {
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => this.close(), 100);
  }

  private clearCloseTimer(): void {
    if (this.closeTimer != null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private updatePlacement(): void {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const estimatedHeight = Math.max(44, this.visibleItems().length * 40 + 12);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp =
      this.preferUp() ||
      (spaceBelow < estimatedHeight + 8 && spaceAbove > spaceBelow);
    this.openUpward.set(openUp);
  }
}
