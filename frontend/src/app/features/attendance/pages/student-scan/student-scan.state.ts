import { Injectable, signal } from '@angular/core';
import { GeolocationFailureReason } from '../../../../core/utils/geolocation.util';
import { AttendanceRecord } from '../../../../models/attendance.model';
import { OpenLiveSessionCard } from '../../../../models/session.model';

/** Shown when student tries to mark/scan after the session due time. */
export interface DueBlockedNotice {
  sessionTitle: string;
  dueAt: string | null;
  /** Whether the attempt came from a Camera deep-link QR. */
  fromScan: boolean;
}

/**
 * Shown when location permission is denied/unavailable (FR-02 hard gate).
 * No attendance request is sent in this case — "Try again" re-runs `retry`.
 */
export interface LocationBlockedNotice {
  sessionTitle: string;
  reason: GeolocationFailureReason;
  retry: () => Promise<void>;
}

/**
 * Student attendance page state — open live sessions + results.
 */
@Injectable()
export class StudentScanPageState {
  readonly loading = signal(true);
  readonly submittingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly openSessions = signal<OpenLiveSessionCard[]>([]);
  readonly myRecords = signal<AttendanceRecord[]>([]);

  /** Non-null while the due-time blocked confirm dialog is open. */
  readonly dueBlocked = signal<DueBlockedNotice | null>(null);

  /** Non-null while the location-permission blocked confirm dialog is open. */
  readonly locationBlocked = signal<LocationBlockedNotice | null>(null);

  beginLoad(): void {
    this.loading.set(true);
    this.error.set(null);
  }

  endLoad(): void {
    this.loading.set(false);
  }

  setOpenSessions(sessions: OpenLiveSessionCard[]): void {
    this.openSessions.set(sessions);
  }

  setHistory(records: AttendanceRecord[]): void {
    this.myRecords.set(records);
  }

  beginSubmit(sessionId: string): void {
    this.error.set(null);
    this.success.set(null);
    this.info.set(null);
    this.submittingId.set(sessionId);
  }

  endSubmit(): void {
    this.submittingId.set(null);
  }

  submitSucceeded(record: AttendanceRecord): void {
    this.success.set(`You’re marked ${record.status} for “${record.session}”.`);
    this.myRecords.update((rows) => [
      record,
      ...rows.filter((r) => r.id !== record.id),
    ]);
  }

  alreadySubmitted(record: AttendanceRecord | null): void {
    this.info.set('You already submitted attendance for this session.');
    this.error.set(null);
    if (record) {
      this.myRecords.update((rows) => {
        if (rows.some((r) => r.id === record.id)) {
          return rows;
        }
        return [record, ...rows];
      });
    }
  }

  setError(message: string | null): void {
    this.error.set(message);
  }

  setInfo(message: string | null): void {
    this.info.set(message);
  }

  openDueBlocked(notice: DueBlockedNotice): void {
    this.dueBlocked.set(notice);
    this.error.set(null);
    this.info.set(null);
  }

  closeDueBlocked(): void {
    this.dueBlocked.set(null);
  }

  openLocationBlocked(notice: LocationBlockedNotice): void {
    this.locationBlocked.set(notice);
    this.error.set(null);
    this.info.set(null);
  }

  closeLocationBlocked(): void {
    this.locationBlocked.set(null);
  }

  hasSubmittedFor(sessionTitle: string): boolean {
    return this.myRecords().some((row) => row.session === sessionTitle);
  }

  recordForSession(sessionTitle: string): AttendanceRecord | null {
    return this.myRecords().find((row) => row.session === sessionTitle) ?? null;
  }
}
