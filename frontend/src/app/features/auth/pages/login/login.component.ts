import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AlertMessage, FieldErrors } from '../../../../models/alert.model';
import { DemoAccount } from '../../../../models/auth.model';
import { UserRole } from '../../../../models/user.model';
import { AlertService } from '../../../../services/alert.service';
import { AuthService } from '../../../../services/auth.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';

const ROLE_COPY: Record<
  UserRole,
  { title: string; lead: string; demoHeading: string }
> = {
  admin: {
    title: 'Admin sign in',
    lead: 'Sign in with your SmartCampus admin account to manage students and attendance.',
    demoHeading: 'Admin demo account',
  },
  teacher: {
    title: 'Teacher sign in',
    lead: 'Sign in with your SmartCampus teacher account to run sessions and QR attendance.',
    demoHeading: 'Teacher demo account',
  },
  student: {
    title: 'Student sign in',
    lead: 'Sign in with your SmartCampus student account to submit attendance.',
    demoHeading: 'Student demo account',
  },
};

@Component({
  selector: 'app-login',
  imports: [FormsModule, AlertComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';

  /** Form-level banner (API failures, summary of field issues). */
  readonly alert = signal<AlertMessage | null>(null);
  /** Per-field validation messages (email / password). */
  readonly fieldErrors = signal<FieldErrors>({});
  readonly submitting = signal(false);
  /** True while the card shake animation is playing. */
  readonly shaking = signal(false);

  /** Route param :role from /auth/:role */
  private readonly roleParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('role'))),
    { initialValue: this.route.snapshot.paramMap.get('role') },
  );

  readonly portalRole = computed<UserRole | null>(() => {
    const value = this.roleParam();
    return this.auth.isLoginRole(value) ? value : null;
  });

  readonly copy = computed(() => {
    const role = this.portalRole();
    return role ? ROLE_COPY[role] : null;
  });

  readonly demoAccounts = computed<DemoAccount[]>(() => {
    const role = this.portalRole();
    return role ? this.auth.demoAccountsForRole(role) : [];
  });

  hasFieldError(field: string): boolean {
    return this.alerts.hasFieldError(this.fieldErrors(), field);
  }

  fieldError(field: string): string | null {
    const message = this.fieldErrors()[field];
    return typeof message === 'string' && message.length > 0 ? message : null;
  }

  /** Clear a single field error while the user edits. */
  onFieldInput(field: 'email' | 'password'): void {
    if (!this.hasFieldError(field) && !this.alert()) {
      return;
    }

    const next: FieldErrors = { ...this.fieldErrors(), [field]: null };
    this.fieldErrors.set(next);

    if (
      !this.alerts.hasFieldError(next, 'email') &&
      !this.alerts.hasFieldError(next, 'password')
    ) {
      this.alert.set(null);
    }
  }

  async submit(): Promise<void> {
    const expectedRole = this.portalRole();
    if (!expectedRole) {
      this.alert.set(this.alerts.error('Open a valid role sign-in URL to continue.'));
      return;
    }

    const validation = this.alerts.validateLoginForm(this.email, this.password);
    this.fieldErrors.set(validation.fieldErrors);
    this.alert.set(validation.alert);

    if (!validation.valid) {
      this.triggerShake();
      return;
    }

    this.submitting.set(true);

    try {
      const result = await this.auth.login(
        {
          email: this.email,
          password: this.password,
        },
        expectedRole,
      );

      if (!result.ok) {
        this.applyLoginFailure(result.message);
        return;
      }

      this.clearValidation();
      await this.router.navigateByUrl(this.auth.homePathForRole(result.user.role));
    } finally {
      this.submitting.set(false);
    }
  }

  fillDemo(account: DemoAccount): void {
    this.email = account.email;
    this.password = account.password;
    this.clearValidation();
  }

  private applyLoginFailure(message: string): void {
    const lower = message.toLowerCase();
    const credentialsLike =
      lower.includes('invalid') ||
      lower.includes('password') ||
      lower.includes('credentials');

    if (credentialsLike) {
      const copy = this.alerts.invalidCredentialsMessage();
      this.alert.set(this.alerts.error(copy));
      this.fieldErrors.set({ email: copy, password: copy });
    } else {
      // Role mismatch, network, or other API message — highlight fields + banner.
      this.alert.set(this.alerts.error(message));
      this.fieldErrors.set({
        email: message,
        password: message,
      });
    }

    this.triggerShake();
  }

  private triggerShake(): void {
    // Toggle off then on so the CSS animation restarts on every failed submit.
    this.shaking.set(false);
    requestAnimationFrame(() => {
      this.shaking.set(true);
    });
  }

  onShakeEnd(event: AnimationEvent): void {
    // Ignore bubbled child animations and the initial card-enter keyframes.
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.animationName !== 'card-shake') {
      return;
    }
    this.shaking.set(false);
  }

  private clearValidation(): void {
    this.alert.set(null);
    this.fieldErrors.set({});
  }
}
