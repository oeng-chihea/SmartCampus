import { Component, OnInit, inject, signal } from '@angular/core';
import {
  formatAttendanceDateTime,
  formatAttendanceDateTimeLabel,
} from '../../../../core/utils/date.util';
import {
  distanceBadgeVariant,
  formatDistanceMeters,
  formatScanAccuracy,
  formatScanCoordinates,
  formatScannedAtCell,
} from '../../../../core/utils/format.util';
import {
  AttendanceFilterState,
  AttendanceRecord,
} from '../../../../models/attendance.model';
import { AttendanceFilterComponent } from '../../../../shared/components/attendance-filter/attendance-filter.component';
import { ModalDialogComponent } from '../../../../shared/components/modal-dialog/modal-dialog.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { TableColumn } from '../../../../shared/components/table/table.model';
import { AdminRecordsFlow } from './admin-records.flow';
import { AdminRecordsState } from './admin-records.state';

/**
 * Thin UI shell for the Admin attendance records page.
 *
 * - State  → `admin-records.state.ts`  (signals, filters, derived)
 * - Flow   → `admin-records.flow.ts`   (API + orchestration)
 * - View   → this file + html/scss
 * - Filter toolbar → shared `app-attendance-filter`
 * - Scan log → shared `app-table`
 */
@Component({
  selector: 'app-admin-records',
  imports: [
    StatCardComponent,
    AttendanceFilterComponent,
    TableComponent,
    ModalDialogComponent,
  ],
  templateUrl: './admin-records.component.html',
  styleUrl: './admin-records.component.scss',
  providers: [AdminRecordsState, AdminRecordsFlow],
})
export class AdminRecordsComponent implements OnInit {
  /** Template binds to `state.*` for all reactive UI. */
  readonly state = inject(AdminRecordsState);
  private readonly flow = inject(AdminRecordsFlow);

  /** Row opened in the shared detail dialog. */
  readonly selectedRecord = signal<AttendanceRecord | null>(null);

  /** Attendance scan-log columns (titles owned by this page). */
  readonly attendanceColumns: TableColumn<AttendanceRecord>[] = [
    {
      key: 'student',
      header: 'Student',
      type: 'primary',
      width: 'minmax(7rem, 0.85fr)',
      primary: (row) => ({ title: row.student, subtitle: row.studentId }),
    },
    {
      key: 'session',
      header: 'Session',
      width: 'minmax(6.5rem, 0.75fr)',
      value: (row) => row.session,
    },
    {
      key: 'location',
      header: 'Location',
      width: 'minmax(0, 0.65fr)',
      value: (row) => row.location,
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
      key: 'distance',
      header: 'Distance',
      type: 'badge',
      width: 'minmax(5.75rem, 0.8fr)',
      align: 'start',
      value: (row) => formatDistanceMeters(row.distanceMeters),
      badgeVariant: (row) => distanceBadgeVariant(row.distanceMeters),
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

  ngOnInit(): void {
    void this.flow.load();
  }

  onFilterApply(filters: AttendanceFilterState): void {
    void this.flow.applyFilters(filters);
  }

  onRecordSelect(record: AttendanceRecord): void {
    this.selectedRecord.set(record);
  }

  closeRecordDetail(): void {
    this.selectedRecord.set(null);
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
}
