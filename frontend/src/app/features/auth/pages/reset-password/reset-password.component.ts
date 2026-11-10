import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertMessage } from '../../../../models/alert.model';
import { AlertService } from '../../../../services/alert.service';
import { AuthService } from '../../../../services/auth.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink, AlertComponent],
  templateUrl: './reset-password.component.html',
  styleUrl: '../login/login.component.scss',
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertService);
  private readonly router = inject(Router);
  private readonly token = this.takeTokenFromUrl();

  password = '';
  confirm = '';
  readonly hasToken = !!this.token;
  readonly submitting = signal(false);
  readonly alert = signal<AlertMessage | null>(null);

  async submit(): Promise<void> {
    const problem = this.validate();
    if (problem || !this.token) {
      this.alert.set(this.alerts.error(problem ?? 'This link is invalid.'));
      return;
    }

    this.submitting.set(true);
    const result = await this.auth.resetPassword(this.token, this.password);
    this.submitting.set(false);

    if (!result.ok) {
      this.alert.set(this.alerts.error(result.message));
      return;
    }

    this.auth.logout();
    await this.router.navigate(['/auth/student'], {
      queryParams: { reset: 'done' },
    });
  }

  private validate(): string | null {
    const problem = this.alerts.validatePassword(this.password, {
      minLength: MIN_PASSWORD_LENGTH,
      fieldLabel: 'New password',
    });
    if (problem) {
      return problem;
    }
    return this.password === this.confirm
      ? null
      : 'The two passwords do not match.';
  }

  private takeTokenFromUrl(): string | null {
    const token = new URLSearchParams(location.hash.slice(1)).get('token');
    history.replaceState(history.state, '', location.pathname);
    return token;
  }
}
