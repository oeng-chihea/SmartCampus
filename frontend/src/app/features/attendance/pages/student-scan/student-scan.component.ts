import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import {
  formatSessionDue,
  formatSessionOpened,
  isSessionPastDue,
} from '../../../../core/utils/date.util';
import { GeolocationFailureReason } from '../../../../core/utils/geolocation.util';
import {
  formatCampusLocationLabel,
  formatScannedAtCell,
} from '../../../../core/utils/format.util';
import { AttendanceRecord } from '../../../../models/attendance.model';
import { OpenLiveSessionCard } from '../../../../models/session.model';
import { AuthService } from '../../../../services/auth.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
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
  imports: [ConfirmDialogComponent, TableComponent],
  templateUrl: './student-scan.component.html',
  styleUrl: './student-scan.component.scss',
  providers: [StudentScanPageState, StudentScanPageFlow],
})
export class StudentScanComponent implements OnInit, OnDestroy {
  readonly state = inject(StudentScanPageState);
  private readonly flow = inject(StudentScanPageFlow);
  private readonly auth = inject(AuthService);

  readonly user = computed(() => this.auth.user());

  /** My attendance columns — titles owned by this page. */
  readonly attendanceColumns: TableColumn<AttendanceRecord>[] = [
    {
      key: 'session',
      header: 'Session',
      type: 'primary',
      width: 'minmax(0, 1.4fr)',
      primary: (row) => ({ title: row.session, subtitle: row.id }),
    },
    {
      key: 'location',
      header: 'Location',
      width: 'minmax(120px, 1.1fr)',
      value: (row) => formatCampusLocationLabel(row.location),
    },
    {
      key: 'scannedAt',
      header: 'Scanned at',
      type: 'primary',
      width: 'minmax(160px, 1.4fr)',
      primary: (row) =>
        formatScannedAtCell(row.scannedLocation, row.latitude, row.longitude),
    },
    {
      key: 'time',
      header: 'Recorded',
      width: 'minmax(110px, 0.9fr)',
      value: (row) => formatSessionOpened(row.recordedAt),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'badge',
      width: 'minmax(6.5rem, 0.7fr)',
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

  alreadyDone(sessionTitle: string): boolean {
    return this.state.hasSubmittedFor(sessionTitle);
  }

  isPastDue(session: OpenLiveSessionCard): boolean {
    return isSessionPastDue(session.dueAt);
  }

  formatDue(value: string | null | undefined): string {
    return formatSessionDue(value);
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

  logout(): void {
    this.flow.logout();
  }
}
