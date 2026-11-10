import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AlertMessage } from '../../../../models/alert.model';
import { AlertService } from '../../../../services/alert.service';
import { AuthService } from '../../../../services/auth.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink, AlertComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: '../login/login.component.scss',
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly alerts = inject(AlertService);

  email = '';
  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly alert = signal<AlertMessage | null>(null);

  async submit(): Promise<void> {
    const problem = this.alerts.validateEmail(this.email);
    if (problem) {
      this.alert.set(this.alerts.error(problem));
      return;
    }

    this.submitting.set(true);
    const result = await this.auth.requestPasswordReset(this.email);
    this.submitting.set(false);

    this.sent.set(result.ok);
    this.alert.set(
      result.ok
        ? this.alerts.success(result.message)
        : this.alerts.error(result.message),
    );
  }
}
