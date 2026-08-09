import { computed, Injectable, signal } from '@angular/core';
import { FieldErrors } from '../../../../models/alert.model';
import { CampusLocation } from '../../../../models/location.model';
import {
  AttendanceSession,
  SessionQrResponse,
  SessionsFormState,
} from '../../../../models/session.model';
import { StatCard } from '../../../../shared/components/stat-card/stat-card.model';

/**
 * Sessions page state only — signals, form fields, derived values.
 * No HTTP. Mutations that only touch local data live here.
 * Orchestration / API belongs in `sessions.flow.ts`.
 */
@Injectable()
export class SessionsPageState {
  // ── UI flags ──────────────────────────────────────────────
  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly closingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly dialogError = signal<string | null>(null);
  readonly createDialogOpen = signal(false);
  readonly qrLoading = signal(false);

  /** Session awaiting delete confirmation (null = confirm dialog closed). */
  readonly deleteTarget = signal<AttendanceSession | null>(null);

  /** Per-field create-form errors (title / locationId / dueTime). */
  readonly fieldErrors = signal<FieldErrors>({});

  // ── Domain data ───────────────────────────────────────────
  readonly locations = signal<CampusLocation[]>([]);
  readonly sessions = signal<AttendanceSession[]>([]);
  readonly selectedSessionId = signal<string | null>(null);
  readonly qr = signal<SessionQrResponse | null>(null);
  readonly qrDataUrl = signal<string | null>(null);

  // ── Dialog form (ngModel; plain fields) ───────────────────
  title = '';
  locationId = '';
  /** HTML `type="time"` value (local HH:mm) — when attendance stops. */
  dueTime = '';

  /** Interval handle for QR rotation — not shown in the template. */
  qrRefreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── Derived ───────────────────────────────────────────────
  readonly metrics = computed<StatCard[]>(() => {
    const rows = this.sessions();
    const open = rows.filter((row) => row.status === 'Open').length;
    const closed = rows.filter((row) => row.status === 'Closed').length;
    return [
      {
        label: 'Open sessions',
        value: String(open),
        helper: 'Accepting student scans',
        icon: 'sessions',
        tone: 'green',
      },
      {
        label: 'Closed',
        value: String(closed),
        helper: 'QR no longer issued',
        icon: 'attendance',
        tone: 'violet',
      },
      {
        label: 'Total',
        value: String(rows.length),
        helper: 'Created this server run',
        icon: 'locations',
        tone: 'blue',
      },
    ];
  });

  readonly selectedSession = computed(() => {
    const id = this.selectedSessionId();
    if (!id) {
      return null;
    }
    return this.sessions().find((row) => row.id === id) ?? null;
  });

  // ── Local state helpers (no API) ──────────────────────────

  resetCreateForm(): void {
    this.title = '';
    this.locationId = '';
    // Default: 30 minutes from now so teachers rarely hit "must be in the future".
    const due = new Date(Date.now() + 30 * 60 * 1000);
    this.dueTime = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
    this.dialogError.set(null);
    this.fieldErrors.set({});
  }

  setLocations(locations: CampusLocation[]): void {
    this.locations.set(locations);
  }

  setSessions(sessions: AttendanceSession[]): void {
    this.sessions.set(sessions);
  }

  openDialog(): void {
    this.dialogError.set(null);
    this.error.set(null);
    this.resetCreateForm();
    this.createDialogOpen.set(true);
    // Body scroll lock is owned by shared `app-modal-dialog`.
  }

  closeDialog(): void {
    if (this.creating()) {
      return;
    }
    this.createDialogOpen.set(false);
    this.dialogError.set(null);
    this.fieldErrors.set({});
  }

  beginCreate(): void {
    this.dialogError.set(null);
    this.error.set(null);
    this.success.set(null);
    this.creating.set(true);
  }

  endCreate(): void {
    this.creating.set(false);
  }

  createSucceeded(sessionTitle: string): void {
    this.title = '';
    this.locationId = '';
    this.fieldErrors.set({});
    this.createDialogOpen.set(false);
    this.success.set(`Session “${sessionTitle}” is open. Show the QR to students.`);
  }

  setDialogError(message: string | null): void {
    this.dialogError.set(message);
  }

  setFieldErrors(errors: FieldErrors): void {
    this.fieldErrors.set(errors);
  }

  clearFieldError(field: string): void {
    if (!this.fieldErrors()[field]) {
      return;
    }
    this.fieldErrors.set({ ...this.fieldErrors(), [field]: null });
  }

  hasFieldError(field: string): boolean {
    const message = this.fieldErrors()[field];
    return typeof message === 'string' && message.length > 0;
  }

  fieldError(field: string): string | null {
    const message = this.fieldErrors()[field];
    return typeof message === 'string' && message.length > 0 ? message : null;
  }

  setPageError(message: string | null): void {
    this.error.set(message);
  }

  setPageSuccess(message: string | null): void {
    this.success.set(message);
  }

  beginLoad(): void {
    this.loading.set(true);
    this.error.set(null);
  }

  endLoad(): void {
    this.loading.set(false);
  }

  beginQrLoad(sessionId: string): void {
    this.error.set(null);
    this.selectedSessionId.set(sessionId);
    this.qrLoading.set(true);
  }

  setQrResult(qr: SessionQrResponse, dataUrl: string): void {
    this.qr.set(qr);
    this.qrDataUrl.set(dataUrl);
  }

  endQrLoad(): void {
    this.qrLoading.set(false);
  }

  clearQrPanel(): void {
    this.stopQrRefresh();
    this.selectedSessionId.set(null);
    this.qr.set(null);
    this.qrDataUrl.set(null);
  }

  /** After reload: drop QR if selected session is missing or closed. */
  syncQrAfterReload(sessions: AttendanceSession[]): void {
    const selectedId = this.selectedSessionId();
    if (!selectedId) {
      return;
    }
    const stillThere = sessions.find((row) => row.id === selectedId);
    if (!stillThere || stillThere.status !== 'Open') {
      this.clearQrPanel();
    }
  }

  beginClose(sessionId: string): void {
    this.error.set(null);
    this.success.set(null);
    this.closingId.set(sessionId);
  }

  endClose(): void {
    this.closingId.set(null);
  }

  beginDelete(sessionId: string): void {
    this.error.set(null);
    this.success.set(null);
    this.deletingId.set(sessionId);
  }

  endDelete(): void {
    this.deletingId.set(null);
  }

  /** Open the delete confirmation dialog for a session. */
  requestDelete(session: AttendanceSession): void {
    this.error.set(null);
    this.success.set(null);
    this.deleteTarget.set(session);
  }

  /** Close the delete confirmation dialog (no-op while the delete is running). */
  closeDeleteDialog(): void {
    if (this.deletingId()) {
      return;
    }
    this.deleteTarget.set(null);
  }

  /** Drop a row locally after a successful API delete (before reload). */
  removeSession(sessionId: string): void {
    this.sessions.set(this.sessions().filter((row) => row.id !== sessionId));
    if (this.selectedSessionId() === sessionId) {
      this.clearQrPanel();
    }
  }

  getForm(): SessionsFormState {
    return {
      title: this.title.trim(),
      locationId: this.locationId,
      dueTime: this.dueTime.trim(),
    };
  }

  stopQrRefresh(): void {
    if (this.qrRefreshTimer) {
      clearInterval(this.qrRefreshTimer);
      this.qrRefreshTimer = null;
    }
  }

  startQrRefresh(onTick: () => void, intervalMs = 30_000): void {
    this.stopQrRefresh();
    this.qrRefreshTimer = setInterval(onTick, intervalMs);
  }
}
