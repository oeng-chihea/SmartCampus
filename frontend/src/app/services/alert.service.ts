import { Injectable } from '@angular/core';
import { AlertMessage, AlertSeverity, FieldErrors } from '../models/alert.model';

/** Loose email shape for client-side checks (full RFC not required). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reusable validation messages and field helpers for forms across the app.
 * Pages own their UI state (signals); this service supplies consistent copy
 * and pure checks for required / format / wrong-input cases.
 */
@Injectable({ providedIn: 'root' })
export class AlertService {
  /** Build a typed alert payload for the shared banner. */
  create(severity: AlertSeverity, message: string): AlertMessage {
    return { severity, message: message.trim() };
  }

  error(message: string): AlertMessage {
    return this.create('error', message);
  }

  success(message: string): AlertMessage {
    return this.create('success', message);
  }

  info(message: string): AlertMessage {
    return this.create('info', message);
  }

  warning(message: string): AlertMessage {
    return this.create('warning', message);
  }

  /** Standard “field is required” copy. */
  requiredMessage(fieldLabel: string): string {
    return `${fieldLabel} is required.`;
  }

  /** Standard email format copy (client + server alignment). */
  invalidEmailMessage(): string {
    return 'Email must be a valid email address.';
  }

  /** Wrong credentials / mismatch input. */
  invalidCredentialsMessage(): string {
    return 'Invalid email or password. Check your details and try again.';
  }

  /** Generic wrong-input message for a named field. */
  invalidFieldMessage(fieldLabel: string): string {
    return `${fieldLabel} is invalid.`;
  }

  /** True when the value is empty after trim. */
  isBlank(value: string | null | undefined): boolean {
    return !value || !String(value).trim();
  }

  /** True when value looks like an email. Empty values return false. */
  isValidEmail(value: string | null | undefined): boolean {
    if (this.isBlank(value)) {
      return false;
    }
    return EMAIL_PATTERN.test(String(value).trim());
  }

  /**
   * Validate a required text field.
   * @returns error message or null when valid
   */
  validateRequired(
    value: string | null | undefined,
    fieldLabel: string,
  ): string | null {
    if (this.isBlank(value)) {
      return this.requiredMessage(fieldLabel);
    }
    return null;
  }

  /**
   * Validate email: required + format.
   * @returns error message or null when valid
   */
  validateEmail(value: string | null | undefined): string | null {
    if (this.isBlank(value)) {
      return this.requiredMessage('Email');
    }
    if (!this.isValidEmail(value)) {
      return this.invalidEmailMessage();
    }
    return null;
  }

  /**
   * Validate password: required (optional min length).
   * @returns error message or null when valid
   */
  validatePassword(
    value: string | null | undefined,
    options?: { minLength?: number; fieldLabel?: string },
  ): string | null {
    const label = options?.fieldLabel ?? 'Password';
    if (this.isBlank(value)) {
      return this.requiredMessage(label);
    }
    const min = options?.minLength;
    if (min != null && String(value).length < min) {
      return `${label} must be at least ${min} characters.`;
    }
    return null;
  }

  /**
   * Login form validation used by all role portals.
   * Returns field errors and a summary alert when anything fails.
   */
  validateLoginForm(
    email: string,
    password: string,
  ): { valid: boolean; fieldErrors: FieldErrors; alert: AlertMessage | null } {
    const emailError = this.validateEmail(email);
    const passwordError = this.validatePassword(password);

    const fieldErrors: FieldErrors = {
      email: emailError,
      password: passwordError,
    };

    const hasError = !!(emailError || passwordError);
    if (!hasError) {
      return { valid: true, fieldErrors, alert: null };
    }

    // Prefer the first field message as the banner summary.
    const summary = emailError ?? passwordError ?? 'Please fix the highlighted fields.';
    return {
      valid: false,
      fieldErrors,
      alert: this.error(summary),
    };
  }

  /** Whether a field key has an active error string. */
  hasFieldError(fieldErrors: FieldErrors, field: string): boolean {
    const message = fieldErrors[field];
    return typeof message === 'string' && message.length > 0;
  }
}
