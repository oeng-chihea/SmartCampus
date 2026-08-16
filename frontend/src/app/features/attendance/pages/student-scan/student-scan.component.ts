import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  formatAttendanceDateTime,
  formatAttendanceDateTimeLabel,
  formatSessionDue,
  isSessionPastDue,
} from '../../../../core/utils/date.util';
import { sessionToZone } from '../../../../core/utils/geofence.util';
import { GeolocationFailureReason } from '../../../../core/utils/geolocation.util';
import {
  formatCampusLocationLabel,
  formatDistanceMeters,
  formatScanAccuracy,
  formatScanCoordinates,
  formatScannedAtCell,
} from '../../../../core/utils/format.util';
import { AttendanceRecord } from '../../../../models/attendance.model';
import { OpenLiveSessionCard } from '../../../../models/session.model';
import { AuthService } from '../../../../services/auth.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalDialogComponent } from '../../../../shared/components/modal-dialog/modal-dialog.component';
import { ScanMapComponent } from '../../../../shared/components/scan-map/scan-map.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { TableColumn } from '../../../../shared/components/table/table.model';
import {
  StudentScanPageFlow,
  dueBlockedDetail,
  dueBlockedMessage,
  locationBlockedDetail,
  locationBlockedMessage,
} from './student-scan.flow';
import { StudentScanPageState } from './student-scan.state';

/**
 * Student attendance page.
 * Mark present via the button, or via the teacher-QR deep link (iPhone Camera).
 * History uses shared `app-table` (no separate last-record hero card).
 */
@Component({
  selector: 'app-student-scan',
  imports: [ConfirmDialogComponent, ModalDialogComponent, ScanMapComponent, TableComponent],
  templateUrl: './student-scan.component.html',
  styleUrl: './student-scan.component.scss',
  providers: [StudentScanPageState, StudentScanPageFlow],
})
export class StudentScanComponent implements OnInit, OnDestroy {
  readonly state = inject(StudentScanPageState);
  private readonly flow = inject(StudentScanPageFlow);
  private readonly auth = inject(AuthService);

  readonly user = computed(() => this.auth.user());

  /** Row opened in the shared detail dialog. */
  readonly selectedRecord = signal<AttendanceRecord | null>(null);

  /** My attendance columns — titles owned by this page. */
  readonly attendanceColumns: TableColumn<AttendanceRecord>[] = [
    {
      key: 'session',
      header: 'Session',
      type: 'primary',
      width: 'minmax(8rem, 1.2fr)',
      primary: (row) => ({ title: row.session, subtitle: row.id }),
    },
    {
      key: 'location',
      header: 'Location',
      width: 'minmax(0, 0.8fr)',
      value: (row) => formatCampusLocationLabel(row.location),
    },
    {
      key: 'scannedAt',
      header: 'Scanned at',
      type: 'primary',
      width: 'minmax(16rem, 2.5fr)',
      cellClass: 'data-table__cell--scanned-at',
      primary: (row) =>
        formatScannedAtCell(
          row.scannedLocation,
          row.latitude,
          row.longitude,
          row.accuracyMeters,
        ),
    },
    {
      key: 'time',
      header: 'Time',
      type: 'primary',
      width: 'minmax(7.25rem, 1.05fr)',
      primary: (row) => formatAttendanceDateTime(row.recordedAt),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'badge',
      width: 'minmax(9.5rem, 0.95fr)',
      align: 'start',
      value: (row) => row.status,
      badgeVariant: (row) => row.status.toLowerCase().replace(/\s+/g, '-'),
    },
  ];

  async ngOnInit(): Promise<void> {
    await this.flow.init();
  }

  ngOnDestroy(): void {
    this.flow.destroy();
  }

  refresh(): Promise<void> {
    return this.flow.reload(true);
  }

  markPresent(session: OpenLiveSessionCard): Promise<void> {
    return this.flow.markPresent(session);
  }

  alreadyDone(sessionId: string): boolean {
    return this.state.hasSubmittedFor(sessionId);
  }

  isPastDue(session: OpenLiveSessionCard): boolean {
    return isSessionPastDue(session.dueAt);
  }

  formatDue(value: string | null | undefined): string {
    return formatSessionDue(value);
  }

  sessionZone(session: OpenLiveSessionCard) {
    return sessionToZone(session);
  }

  dueDialogMessage(fromScan: boolean): string {
    return dueBlockedMessage(fromScan);
  }

  dueDialogDetail(sessionTitle: string, dueAt: string | null): string {
    return dueBlockedDetail(sessionTitle, dueAt);
  }

  dismissDueBlocked(): void {
    this.flow.dismissDueBlocked();
  }

  locationDialogMessage(reason: GeolocationFailureReason): string {
    return locationBlockedMessage(reason);
  }

  locationBlockedDetail(sessionTitle: string): string {
    return locationBlockedDetail(sessionTitle);
  }

  retryAfterLocationBlocked(): Promise<void> {
    return this.flow.retryAfterLocationBlocked();
  }

  dismissLocationBlocked(): void {
    this.flow.dismissLocationBlocked();
  }

  onRecordSelect(record: AttendanceRecord): void {
    this.selectedRecord.set(record);
  }

  closeRecordDetail(): void {
    this.selectedRecord.set(null);
  }

  campusLabel(record: AttendanceRecord): string {
    return formatCampusLocationLabel(record.location);
  }

  coordinatesLabel(record: AttendanceRecord): string {
    return formatScanCoordinates(record.latitude, record.longitude);
  }

  accuracyLabel(record: AttendanceRecord): string {
    return formatScanAccuracy(record.accuracyMeters) ?? '—';
  }

  distanceLabel(record: AttendanceRecord): string {
    return formatDistanceMeters(record.distanceMeters);
  }

  recordedLabel(record: AttendanceRecord): string {
    return formatAttendanceDateTimeLabel(record.recordedAt);
  }

  statusClass(status: string): string {
    return `record-detail__badge record-detail__badge--${status.toLowerCase().replace(/\s+/g, '-')}`;
  }

  logout(): void {
    this.flow.logout();
  }
}
