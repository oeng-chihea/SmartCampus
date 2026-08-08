import { Injectable, inject } from '@angular/core';
import * as QRCode from 'qrcode';
import { buildAttendanceScanUrl } from '../../../../core/utils/qr-scan.util';
import { FieldErrors } from '../../../../models/alert.model';
import { AlertService } from '../../../../services/alert.service';
import { SessionService } from '../../../../services/session.service';
import { SessionsPageState } from './sessions.state';

/**
 * Sessions page flow only — API calls + orchestration.
 * Reads/writes `SessionsPageState`; does not own signals itself.
 */
@Injectable()
export class SessionsPageFlow {
  private readonly state = inject(SessionsPageState);
  private readonly sessionService = inject(SessionService);
  private readonly alerts = inject(AlertService);

  async reload(): Promise<void> {
    this.state.beginLoad();
    try {
      const [locations, sessions] = await Promise.all([
        this.sessionService.listActiveLocations(),
        this.sessionService.listSessions(),
      ]);
      this.state.setLocations(locations);
      this.state.setSessions(sessions);
      this.state.syncQrAfterReload(sessions);
    } catch (error) {
      this.state.setPageError(
        this.sessionService.mapError(error, 'Failed to load sessions from the API.'),
      );
    } finally {
      this.state.endLoad();
    }
  }

  openCreateDialog(): void {
    this.state.openDialog();
  }

  closeCreateDialog(): void {
    this.state.closeDialog();
  }

  /** Clear a single field error while the teacher edits. */
  onFieldInput(field: 'title' | 'locationId' | 'lateAfterMinutes'): void {
    this.state.clearFieldError(field);
    if (this.state.dialogError() && !this.hasAnyFieldError()) {
      this.state.setDialogError(null);
    }
  }

  async createSession(): Promise<void> {
    const validation = this.validateCreateForm();
    this.state.setFieldErrors(validation.fieldErrors);

    if (!validation.valid) {
      this.state.setDialogError(validation.summary || 'Please fix the highlighted fields.');
      return;
    }

    const form = this.state.getForm();

    this.state.beginCreate();
    try {
      const session = await this.sessionService.createSession({
        title: form.title,
        locationId: form.locationId,
        lateAfterMinutes: form.lateAfterMinutes,
      });
      this.state.createSucceeded(session.title);
      await this.reload();
      await this.showQr(session.id);
    } catch (error) {
      this.state.setDialogError(
        this.sessionService.mapError(error, 'Could not create the attendance session.'),
      );
    } finally {
      this.state.endCreate();
    }
  }

  async showQr(sessionId: string): Promise<void> {
    this.state.beginQrLoad(sessionId);
    try {
      const qr = await this.sessionService.getQr(sessionId);
      // Deep-link URL so iPhone Camera can open /student/scan?payload=...
      const dataUrl = await this.qrDataUrlFromPayload(qr.payload);
      this.state.setQrResult(qr, dataUrl);
      this.state.startQrRefresh(() => {
        void this.refreshQrQuiet(sessionId);
      });
    } catch (error) {
      this.state.clearQrPanel();
      this.state.setPageError(
        this.sessionService.mapError(error, 'Could not load the session QR code.'),
      );
    } finally {
      this.state.endQrLoad();
    }
  }

  async refreshQrNow(): Promise<void> {
    const id = this.state.selectedSessionId();
    if (id) {
      await this.showQr(id);
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    this.state.beginClose(sessionId);
    try {
      await this.sessionService.closeSession(sessionId);
      this.state.setPageSuccess('Session closed. QR codes are no longer issued.');
      if (this.state.selectedSessionId() === sessionId) {
        this.state.clearQrPanel();
      }
      await this.reload();
    } catch (error) {
      this.state.setPageError(
        this.sessionService.mapError(error, 'Could not close the session.'),
      );
    } finally {
      this.state.endClose();
    }
  }

  async copyPayload(): Promise<void> {
    const payload = this.state.qr()?.payload;
    if (!payload) {
      return;
    }
    try {
      const link = buildAttendanceScanUrl(payload);
      await navigator.clipboard.writeText(link);
      this.state.setPageSuccess(
        'Scan link copied. Students can open it (or scan the QR) to mark present.',
      );
    } catch {
      this.state.setPageError('Could not copy to clipboard.');
    }
  }

  destroy(): void {
    this.state.stopQrRefresh();
  }

  private validateCreateForm(): {
    valid: boolean;
    fieldErrors: FieldErrors;
    summary: string;
  } {
    const form = this.state.getForm();
    const fieldErrors: FieldErrors = {
      title: null,
      locationId: null,
      lateAfterMinutes: null,
    };

    if (this.alerts.isBlank(form.title)) {
      fieldErrors['title'] = this.alerts.requiredMessage('Session title');
    } else if (form.title.length < 3) {
      fieldErrors['title'] = 'Enter a session title (at least 3 characters).';
    }

    if (this.alerts.isBlank(form.locationId)) {
      fieldErrors['locationId'] = this.alerts.requiredMessage('Campus location');
    } else if (
      !this.state.locations().some((location) => location.id === form.locationId)
    ) {
      fieldErrors['locationId'] = 'Choose an active campus location.';
    }

    if (
      form.lateAfterMinutes === null ||
      form.lateAfterMinutes === undefined ||
      Number.isNaN(form.lateAfterMinutes)
    ) {
      fieldErrors['lateAfterMinutes'] = this.alerts.requiredMessage('Late after (minutes)');
    } else if (
      !Number.isFinite(form.lateAfterMinutes) ||
      form.lateAfterMinutes < 0 ||
      form.lateAfterMinutes > 180 ||
      !Number.isInteger(form.lateAfterMinutes)
    ) {
      fieldErrors['lateAfterMinutes'] =
        'Late after must be a whole number between 0 and 180.';
    }

    const firstError =
      fieldErrors['title'] ||
      fieldErrors['locationId'] ||
      fieldErrors['lateAfterMinutes'];

    return {
      valid: !firstError,
      fieldErrors,
      summary: firstError ?? '',
    };
  }

  private hasAnyFieldError(): boolean {
    const errors = this.state.fieldErrors();
    return Object.values(errors).some(
      (message) => typeof message === 'string' && message.length > 0,
    );
  }

  private async refreshQrQuiet(sessionId: string): Promise<void> {
    if (this.state.selectedSessionId() !== sessionId) {
      return;
    }
    try {
      const qr = await this.sessionService.getQr(sessionId);
      const dataUrl = await this.qrDataUrlFromPayload(qr.payload);
      this.state.setQrResult(qr, dataUrl);
    } catch {
      this.state.clearQrPanel();
    }
  }

  /** Encode a deep-link URL (not the raw token alone) into the QR image. */
  private qrDataUrlFromPayload(rawPayload: string): Promise<string> {
    return QRCode.toDataURL(buildAttendanceScanUrl(rawPayload), {
      width: 240,
      margin: 2,
      color: { dark: '#14532d', light: '#ffffff' },
    });
  }
}
