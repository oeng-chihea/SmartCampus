import { Component, input, output } from '@angular/core';
import { ModalDialogComponent } from '../modal-dialog/modal-dialog.component';

/**
 * Reusable confirmation dialog built on the shared `app-modal-dialog` shell.
 *
 * - Danger-styled confirm action; dismissible via ×, Escape, backdrop, or Cancel
 * - `busy` disables both buttons (and blocks dismissal) while a request runs
 * - Content: warning icon + message + optional detail line
 *
 * Host listens for `confirmed` / `cancelled`; no module-specific logic here.
 */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  imports: [ModalDialogComponent],
})
export class ConfirmDialogComponent {
  /** Small uppercase label above the title (e.g. "Delete session"). */
  readonly eyebrow = input<string>('Confirm');

  /** Main dialog title. */
  readonly title = input.required<string>();

  /** Primary question / instruction text. */
  readonly message = input.required<string>();

  /** Optional secondary line (e.g. record id) rendered muted below the message. */
  readonly detail = input<string>('');

  /** Label for the destructive action button. */
  readonly confirmLabel = input<string>('Delete');

  /** Label for the dismiss button. */
  readonly cancelLabel = input<string>('Cancel');

  /** While true: buttons are disabled, dismissal is blocked, busy label shows. */
  readonly busy = input(false);

  /** Replaces `confirmLabel` while `busy` is true (e.g. "Deleting…"). */
  readonly busyLabel = input<string>('');

  /** When true, outside click / Escape shake instead of cancelling. */
  readonly lockDismiss = input(false);

  /** Emitted when the user confirms the destructive action. */
  readonly confirmed = output<void>();

  /** Emitted when the user cancels via Cancel, ×, Escape, or backdrop. */
  readonly cancelled = output<void>();

  confirm(): void {
    if (this.busy()) {
      return;
    }
    this.confirmed.emit();
  }

  cancel(): void {
    if (this.busy()) {
      return;
    }
    this.cancelled.emit();
  }
}
