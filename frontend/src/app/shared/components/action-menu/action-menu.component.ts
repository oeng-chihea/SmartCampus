import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { computeActionMenuPosition } from './action-menu-position.util';
import { ActionMenuItem } from './action-menu.model';

/**
 * Compact ⋮ action trigger with a hover/click dropdown.
 * The panel is portaled to document.body and pinned to the trigger in
 * viewport coordinates so table overflow / sticky columns cannot clip it.
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly triggerRef =
    viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly instanceId = `action-menu-${Math.random().toString(36).slice(2, 9)}`;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private repositionBound = false;
  private readonly onReposition = (): void => {
    if (this.open()) {
      this.updatePlacement();
    }
  };

  /** Menu entries (already filtered by the caller when needed). */
  readonly items = input.required<ActionMenuItem[]>();
  /** Accessible name for the trigger button. */
  readonly ariaLabel = input('Actions');
  /** Prefer opening the panel above the trigger when true. */
  readonly preferUp = input(false);

  readonly itemSelect = output<string>();

  readonly open = signal(false);
  readonly openUpward = signal(false);
  readonly panelTop = signal(0);
  readonly panelLeft = signal(0);
  /** True after the panel is on document.body with viewport coords. */
  readonly panelReady = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.teardown());
  }

  listId(): string {
    return `${this.instanceId}-list`;
  }

  visibleItems(): ActionMenuItem[] {
    return this.items().filter((item) => item.visible !== false);
  }

  onMenuMouseEnter(): void {
    if (!this.canHoverOpen()) {
      return;
    }
    this.clearCloseTimer();
    this.openPanel();
  }

  onMenuMouseLeave(): void {
    if (!this.canHoverOpen()) {
      return;
    }
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
    if (this.open()) {
      this.updatePlacement();
      return;
    }
    this.updatePlacement();
    this.panelReady.set(false);
    this.open.set(true);
    this.listenReposition();
    requestAnimationFrame(() => {
      this.attachPanelToBody();
      this.updatePlacement();
      this.panelReady.set(true);
    });
  }

  close(): void {
    this.clearCloseTimer();
    this.unlistenReposition();
    this.returnPanelToHost();
    this.panelReady.set(false);
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
    if (!target) {
      return;
    }
    if (this.host.nativeElement.contains(target)) {
      return;
    }
    if (this.panelRef()?.nativeElement.contains(target)) {
      return;
    }
    this.close();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.open()) {
      this.updatePlacement();
    }
  }

  private scheduleClose(): void {
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => this.close(), 120);
  }

  private clearCloseTimer(): void {
    if (this.closeTimer != null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private canHoverOpen(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  private attachPanelToBody(): void {
    const panel = this.panelRef()?.nativeElement;
    if (!panel || typeof document === 'undefined') {
      return;
    }
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
  }

  private returnPanelToHost(): void {
    const panel = this.panelRef()?.nativeElement;
    const menu = this.host.nativeElement.querySelector('.action-menu');
    if (!panel || !menu) {
      return;
    }
    if (panel.parentElement === document.body) {
      menu.appendChild(panel);
    }
  }

  private listenReposition(): void {
    if (this.repositionBound || typeof document === 'undefined') {
      return;
    }
    document.addEventListener('scroll', this.onReposition, true);
    this.repositionBound = true;
  }

  private unlistenReposition(): void {
    if (!this.repositionBound || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('scroll', this.onReposition, true);
    this.repositionBound = false;
  }

  private teardown(): void {
    this.clearCloseTimer();
    this.unlistenReposition();
    const panel = this.panelRef()?.nativeElement;
    if (panel?.parentElement === document.body) {
      panel.remove();
    }
  }

  private updatePlacement(): void {
    const trigger = this.triggerRef()?.nativeElement ?? this.host.nativeElement;
    const panel = this.panelRef()?.nativeElement;
    const triggerBox = trigger.getBoundingClientRect();
    const itemCount = this.visibleItems().length;
    const panelSize = {
      width: panel?.offsetWidth || 156,
      height: panel?.offsetHeight || Math.max(44, itemCount * 40 + 12),
    };
    const placed = computeActionMenuPosition(
      triggerBox,
      panelSize,
      { width: window.innerWidth, height: window.innerHeight },
      { preferUp: this.preferUp() },
    );
    this.panelTop.set(placed.top);
    this.panelLeft.set(placed.left);
    this.openUpward.set(placed.openUpward);
  }
}
