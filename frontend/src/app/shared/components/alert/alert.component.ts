import { Component, input, output } from '@angular/core';
import { AlertMessage, AlertSeverity } from '../../../models/alert.model';

/**
 * Reusable inline alert banner for form / page validation feedback.
 * Use severity `error` (red) for missing or wrong field input.
 */
@Component({
  selector: 'app-alert',
  standalone: true,
  templateUrl: './alert.component.html',
  styleUrl: './alert.component.scss',
})
export class AlertComponent {
  /** Full alert payload (preferred). */
  readonly alert = input<AlertMessage | null>(null);

  /** Convenience: message string when not using the full object. */
  readonly message = input<string | null>(null);

  /** Convenience severity when using `message` alone (default error). */
  readonly severity = input<AlertSeverity>('error');

  /** Optional dismiss control. */
  readonly dismissible = input(false);

  readonly dismissed = output<void>();

  protected resolvedSeverity(): AlertSeverity {
    return this.alert()?.severity ?? this.severity();
  }

  protected resolvedMessage(): string | null {
    const fromAlert = this.alert()?.message?.trim();
    if (fromAlert) {
      return fromAlert;
    }
    const direct = this.message()?.trim();
    return direct || null;
  }

  protected onDismiss(): void {
    this.dismissed.emit();
  }
}
