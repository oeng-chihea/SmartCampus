import { Injectable, signal } from '@angular/core';
import { AttendanceRecord } from '../../../../models/attendance.model';
import { OpenLiveSessionCard } from '../../../../models/session.model';

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
  /** In-app camera scanner open on this page. */
  readonly cameraOpen = signal(false);
  readonly cameraError = signal<string | null>(null);
  readonly openSessions = signal<OpenLiveSessionCard[]>([]);
  readonly lastRecord = signal<AttendanceRecord | null>(null);
  readonly myRecords = signal<AttendanceRecord[]>([]);

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
    this.lastRecord.set(record);
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
      this.lastRecord.set(record);
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

  openCamera(): void {
    this.cameraError.set(null);
    this.error.set(null);
    this.cameraOpen.set(true);
  }

  closeCamera(): void {
    this.cameraOpen.set(false);
    this.cameraError.set(null);
  }

  setCameraError(message: string | null): void {
    this.cameraError.set(message);
  }

  hasSubmittedFor(sessionTitle: string): boolean {
    return this.myRecords().some((row) => row.session === sessionTitle);
  }

  recordForSession(sessionTitle: string): AttendanceRecord | null {
    return this.myRecords().find((row) => row.session === sessionTitle) ?? null;
  }
}
