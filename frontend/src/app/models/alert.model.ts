/** Severity used by the reusable alert banner and AlertService. */
export type AlertSeverity = 'error' | 'success' | 'info' | 'warning';

/** Form / page level alert message. */
export interface AlertMessage {
  severity: AlertSeverity;
  message: string;
}

/** Field-level validation errors keyed by control name. */
export type FieldErrors = Record<string, string | null | undefined>;
