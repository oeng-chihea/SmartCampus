import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
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
 * - Module-specific fields / actions go in projected content
 * - Outside click / Escape: shake (lockDismiss) or emit closed
 * - Shake uses Web Animations API so it restarts on every outside click
 *   without replaying the CSS enter animation
 */
@Component({
  selector: 'app-modal-dialog',
  templateUrl: './modal-dialog.component.html',
  styleUrl: './modal-dialog.component.scss',
})
export class ModalDialogComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('dialogPanel');

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

  /** Panel width preset — md ~560px, lg ~720px, xl ~960px. */
  readonly size = input<'md' | 'lg' | 'xl'>('lg');

  /** Optional min-height on the panel so short forms still feel spacious. */
  readonly spacious = input(true);

  /** Emitted when the user closes via × (always) or backdrop/Escape (if not locked). */
  readonly closed = output<void>();

  /** Stable id for aria-labelledby (unique per instance). */
  readonly titleId: string;

  private static nextTitleId = 0;
  private shakeToken = 0;

  constructor() {
    this.titleId = `modal-dialog-title-${ModalDialogComponent.nextTitleId++}`;
  }

  ngOnInit(): void {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.destroyRef.onDestroy(() => {
      this.cancelShake();
      document.body.style.overflow = previousOverflow;
    });
  }

  close(): void {
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
