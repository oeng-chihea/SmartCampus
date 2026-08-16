import { Injectable, inject } from '@angular/core';
import * as QRCode from 'qrcode';
import { buildDueAtFromLocalDateTime } from '../../../../core/utils/date.util';
import { buildAttendanceScanUrl } from '../../../../core/utils/qr-scan.util';
import { FieldErrors } from '../../../../models/alert.model';
import { AttendanceSession } from '../../../../models/session.model';
import { AlertService } from '../../../../services/alert.service';
import { ScanOriginService } from '../../../../services/scan-origin.service';
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
  private readonly scanOrigin = inject(ScanOriginService);
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
  onFieldInput(field: 'title' | 'locationId' | 'dueDate' | 'dueTime'): void {
    this.state.clearFieldError(field);
    if (this.state.dialogError() && !this.state.hasAnyFieldError()) {
      this.state.setDialogError(null);
    }
  }

  async createSession(): Promise<void> {
    const validation = this.validateCreateForm();
    this.state.setFieldErrors(validation.fieldErrors);

    if (!validation.valid || !validation.dueAt) {
      this.state.setDialogError(validation.summary || 'Please fix the highlighted fields.');
      return;
    }

    const form = this.state.getForm();

    this.state.beginCreate();
    try {
      const session = await this.sessionService.createSession({
        title: form.title,
        locationId: form.locationId,
        dueAt: validation.dueAt,
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
      const { dataUrl, scanUrl } = await this.qrFromPayload(qr.payload);
      this.state.setQrResult(qr, dataUrl, scanUrl);
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

  async deleteSession(sessionId: string): Promise<boolean> {
    this.state.beginDelete(sessionId);
    try {
      await this.sessionService.deleteSession(sessionId);
      this.state.setPageSuccess('Session deleted and removed from the log.');
      await this.reload();
      return true;
    } catch (error) {
      this.state.setPageError(
        this.sessionService.mapError(error, 'Could not delete the session.'),
      );
      return false;
    } finally {
      this.state.endDelete();
    }
  }

  /** Open the confirmation dialog before any destructive API call. */
  askDelete(session: AttendanceSession): void {
    this.state.requestDelete(session);
  }

  /** Close the confirmation dialog without deleting. */
  cancelDelete(): void {
    this.state.closeDeleteDialog();
  }

  /** Run the confirmed delete, then close the dialog (kept open on failure). */
  async deleteConfirmedSession(): Promise<void> {
    const target = this.state.deleteTarget();
    if (!target) {
      return;
    }
    const deleted = await this.deleteSession(target.id);
    if (deleted) {
      this.state.closeDeleteDialog();
    }
  }

  async copyPayload(): Promise<void> {
    const payload = this.state.qr()?.payload;
    if (!payload) {
      return;
    }
    try {
      const origin = await this.scanOrigin.resolve();
      const link = buildAttendanceScanUrl(payload, origin);
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
    dueAt: string | null;
  } {
    const form = this.state.getForm();
    const fieldErrors: FieldErrors = {
      title: null,
      locationId: null,
      dueDate: null,
      dueTime: null,
    };
    let dueAt: string | null = null;

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

    const missingDate = this.alerts.isBlank(form.dueDate);
    const missingTime = this.alerts.isBlank(form.dueTime);
    if (missingDate) {
      fieldErrors['dueDate'] = this.alerts.requiredMessage('Due date');
    }
    if (missingTime) {
      fieldErrors['dueTime'] = this.alerts.requiredMessage('Due time');
    }
    if (!missingDate && !missingTime) {
      dueAt = buildDueAtFromLocalDateTime(form.dueDate, form.dueTime);
      if (!dueAt) {
        fieldErrors['dueDate'] = 'Enter a valid due date and time.';
        fieldErrors['dueTime'] = 'Enter a valid due date and time.';
      }
    }

    const firstError =
      fieldErrors['title'] ||
      fieldErrors['locationId'] ||
      fieldErrors['dueDate'] ||
      fieldErrors['dueTime'];

    return {
      valid: !firstError && Boolean(dueAt),
      fieldErrors,
      summary: firstError ?? '',
      dueAt,
    };
  }

  private async refreshQrQuiet(sessionId: string): Promise<void> {
    if (this.state.selectedSessionId() !== sessionId) {
      return;
    }
    try {
      const qr = await this.sessionService.getQr(sessionId);
      const { dataUrl, scanUrl } = await this.qrFromPayload(qr.payload);
      this.state.setQrResult(qr, dataUrl, scanUrl);
    } catch {
      this.state.clearQrPanel();
    }
  }

  /** Encode a Wi-Fi deep-link URL (not the raw token alone) into the QR image. */
  private async qrFromPayload(
    rawPayload: string,
  ): Promise<{ dataUrl: string; scanUrl: string }> {
    const origin = await this.scanOrigin.resolve();
    const scanUrl = buildAttendanceScanUrl(rawPayload, origin);
    const dataUrl = await QRCode.toDataURL(scanUrl, {
      width: 240,
      margin: 2,
      color: { dark: '#14532d', light: '#ffffff' },
    });
    return { dataUrl, scanUrl };
  }
}
