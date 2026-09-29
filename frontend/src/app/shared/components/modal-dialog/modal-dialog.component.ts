import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  AfterViewInit,
  OnInit,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * Generic modal shell for admin/teacher flows.
 *
 * - Layout: backdrop + panel + header (eyebrow/title/×) + projected body
 * - Footer: `.record-detail__actions` or `[modalFooter]` sit below a hairline
 * - Module-specific fields / actions go in projected content
 * - Outside click / Escape: shake (lockDismiss) or emit closed
 * - Shake uses Web Animations API so it restarts on every outside click
 *   without replaying the CSS enter animation
 * - Host is teleported to `document.body` so `position: fixed` is always
 *   viewport-relative (page fade-in animations use `transform`, which would
 *   otherwise trap the overlay inside a card / table region)
 */
@Component({
  selector: 'app-modal-dialog',
  templateUrl: './modal-dialog.component.html',
  styleUrl: './modal-dialog.component.scss',
})
export class ModalDialogComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('dialogPanel');
  private readonly closeButtonRef = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  /** Small uppercase label above the title (e.g. "New session"). */
  readonly eyebrow = input<string>('');

  /** Main dialog title (also used for aria-labelledby). */
  readonly title = input.required<string>();

  /** Accessible label for the × control. */
  readonly closeAriaLabel = input<string>('Close dialog');

  /**
   * When true (default): outside click and Escape shake the panel and do not close.
   * When false: outside click and Escape emit `closed` (dismissible modal).
   */
  readonly lockDismiss = input(true);

  /** When true, the header close button is disabled while an operation is in flight. */
  readonly closeDisabled = input(false);

  /** Panel width preset — md ~560px, lg ~720px, xl ~960px. */
  readonly size = input<'md' | 'lg' | 'xl'>('lg');

  /** Optional min-height on the panel so short forms still feel spacious. */
  readonly spacious = input(true);

  /** Emitted when the user closes via × or backdrop/Escape (when dismissal is allowed). */
  readonly closed = output<void>();

  /** Stable id for aria-labelledby (unique per instance). */
  readonly titleId: string;

  private static nextTitleId = 0;
  private shakeToken = 0;
  private previouslyFocusedElement: HTMLElement | null = null;

  constructor() {
    this.titleId = `modal-dialog-title-${ModalDialogComponent.nextTitleId++}`;
  }

  ngOnInit(): void {
    this.previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Escape ancestor transform/filter containing blocks (e.g. fade-in cards).
    // After move, Angular's default detach looks at the *original* parent and
    // can leave an orphan node on <body> — always remove ourselves on destroy.
    const hostEl = this.host.nativeElement;
    if (hostEl.parentElement !== document.body) {
      document.body.appendChild(hostEl);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.cancelShake();
      document.body.style.overflow = previousOverflow;
      if (hostEl.isConnected) {
        hostEl.remove();
      }
      this.previouslyFocusedElement?.focus({ preventScroll: true });
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      const target = this.closeDisabled()
        ? this.panelRef()?.nativeElement
        : this.closeButtonRef()?.nativeElement;
      target?.focus({ preventScroll: true });
    });
  }

  close(): void {
    if (this.closeDisabled()) {
      return;
    }
    this.cancelShake();
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (this.lockDismiss()) {
      this.shake();
      return;
    }
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lockDismiss()) {
      this.shake();
      return;
    }
    this.close();
  }

  @HostListener('document:keydown', ['$event'])
  onTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const panel = this.panelRef()?.nativeElement;
    if (!panel) {
      return;
    }

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!active || !panel.contains(active) || !focusable.includes(active as HTMLElement)) {
      event.preventDefault();
      first?.focus({ preventScroll: true });
      return;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Public so a parent can re-trigger attention shake if needed.
   * Plays one full left/right cycle on the panel.
   */
  shake(): void {
    const panel = this.panelRef()?.nativeElement;
    if (!panel) {
      return;
    }

    this.shakeToken += 1;
    panel.getAnimations().forEach((animation) => animation.cancel());

    const animation = panel.animate(
      [
        { transform: 'translateX(0) rotate(0deg)' },
        { transform: 'translateX(-14px) rotate(-0.6deg)' },
        { transform: 'translateX(14px) rotate(0.6deg)' },
        { transform: 'translateX(-10px) rotate(-0.4deg)' },
        { transform: 'translateX(10px) rotate(0.4deg)' },
        { transform: 'translateX(-6px) rotate(-0.2deg)' },
        { transform: 'translateX(6px) rotate(0.2deg)' },
        { transform: 'translateX(-3px) rotate(0deg)' },
        { transform: 'translateX(2px) rotate(0deg)' },
        { transform: 'translateX(0) rotate(0deg)' },
      ],
      {
        duration: 480,
        easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        fill: 'none',
      },
    );

    void animation.finished.catch(() => undefined);
  }

  private cancelShake(): void {
    this.shakeToken += 1;
    this.panelRef()
      ?.nativeElement.getAnimations()
      .forEach((animation) => animation.cancel());
  }
}
