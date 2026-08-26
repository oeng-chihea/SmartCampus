import { computed, Injectable, signal } from '@angular/core';
import { defaultDueLocal } from '../../../../core/utils/date.util';
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
  readonly editing = signal(false);
  readonly closingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly dialogError = signal<string | null>(null);
  readonly createDialogOpen = signal(false);
  readonly qrLoading = signal(false);

  /** Session awaiting delete confirmation (null = confirm dialog closed). */
  readonly deleteTarget = signal<AttendanceSession | null>(null);

  /** Session being edited in the form dialog (null = create mode). */
  readonly editTarget = signal<AttendanceSession | null>(null);

  /** Per-field create-form errors (title / locationId / dueDate / dueTime). */
  readonly fieldErrors = signal<FieldErrors>({});

  // ── Domain data ───────────────────────────────────────────
  readonly locations = signal<CampusLocation[]>([]);
  readonly sessions = signal<AttendanceSession[]>([]);
  readonly selectedSessionId = signal<string | null>(null);
  readonly qr = signal<SessionQrResponse | null>(null);
  readonly qrDataUrl = signal<string | null>(null);
  /** Deep-link encoded into the QR (public site URL). */
  readonly scanUrl = signal<string | null>(null);

  // ── Dialog form (ngModel; plain fields) ───────────────────
  title = '';
  locationId = '';
  /** HTML `type="date"` value (local YYYY-MM-DD) — calendar day attendance stops. */
  dueDate = '';
  /** HTML `type="time"` value (local HH:mm) — clock time attendance stops. */
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

  readonly isEditDialog = computed(() => this.editTarget() !== null);

  /** Create or edit submit in flight — blocks dialog dismiss. */
  readonly formBusy = computed(() => this.creating() || this.editing());

  // ── Local state helpers (no API) ──────────────────────────

  resetCreateForm(): void {
    this.title = '';
    this.locationId = this.defaultLocationId();
    // Suggested start: 30 minutes from now (rolls to tomorrow if that crosses midnight).
    const due = defaultDueLocal(30);
    this.dueDate = due.date;
    this.dueTime = due.time;
    this.dialogError.set(null);
    this.fieldErrors.set({});
  }

  /** Prefer Building A, Room 201 (KIT Phnom Penh) when it is still Active. */
  private defaultLocationId(): string {
    const rows = this.locations();
    const preferred = rows.find(
      (row) => row.id === 'LOC-001' && row.status === 'Active',
    );
    if (preferred) {
      return preferred.id;
    }
    return rows.find((row) => row.status === 'Active')?.id ?? '';
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
    this.editTarget.set(null);
    this.resetCreateForm();
    this.createDialogOpen.set(true);
    // Body scroll lock is owned by shared `app-modal-dialog`.
  }

  openEditDialog(session: AttendanceSession): void {
    this.dialogError.set(null);
    this.error.set(null);
    this.success.set(null);
    this.editTarget.set(session);
    this.fillFormFromSession(session);
    this.createDialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.formBusy()) {
      return;
    }
    this.createDialogOpen.set(false);
    this.editTarget.set(null);
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
    this.editTarget.set(null);
    this.createDialogOpen.set(false);
    this.success.set(`Session “${sessionTitle}” is open. Show the QR to students.`);
  }

  beginEdit(): void {
    this.dialogError.set(null);
    this.error.set(null);
    this.success.set(null);
    this.editing.set(true);
  }

  endEdit(): void {
    this.editing.set(false);
  }

  editSucceeded(sessionTitle: string): void {
    this.fieldErrors.set({});
    this.editTarget.set(null);
    this.createDialogOpen.set(false);
    this.success.set(`Session “${sessionTitle}” was updated.`);
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

  hasAnyFieldError(): boolean {
    return Object.values(this.fieldErrors()).some(
      (message) => typeof message === 'string' && message.length > 0,
    );
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

  setQrResult(qr: SessionQrResponse, dataUrl: string, scanUrl: string): void {
    this.qr.set(qr);
    this.qrDataUrl.set(dataUrl);
    this.scanUrl.set(scanUrl);
  }

  endQrLoad(): void {
    this.qrLoading.set(false);
  }

  clearQrPanel(): void {
    this.stopQrRefresh();
    this.selectedSessionId.set(null);
    this.qr.set(null);
    this.qrDataUrl.set(null);
    this.scanUrl.set(null);
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

  getForm(): SessionsFormState {
    return {
      title: this.title.trim(),
      locationId: this.locationId,
      dueDate: this.dueDate.trim(),
      dueTime: this.dueTime.trim(),
    };
  }

  private fillFormFromSession(session: AttendanceSession): void {
    this.title = session.title;
    this.locationId = session.locationId;
    this.dueDate = '';
    this.dueTime = '';
    this.dialogError.set(null);
    this.fieldErrors.set({});
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
