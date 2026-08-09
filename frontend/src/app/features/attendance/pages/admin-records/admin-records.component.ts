import { Component, OnInit, inject } from '@angular/core';
import { formatSessionOpened } from '../../../../core/utils/date.util';
import {
  AttendanceFilterState,
  AttendanceRecord,
} from '../../../../models/attendance.model';
import { AttendanceFilterComponent } from '../../../../shared/components/attendance-filter/attendance-filter.component';
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
  imports: [StatCardComponent, AttendanceFilterComponent, TableComponent],
  templateUrl: './admin-records.component.html',
  styleUrl: './admin-records.component.scss',
  providers: [AdminRecordsState, AdminRecordsFlow],
})
export class AdminRecordsComponent implements OnInit {
  /** Template binds to `state.*` for all reactive UI. */
  readonly state = inject(AdminRecordsState);
  private readonly flow = inject(AdminRecordsFlow);

  /** Attendance scan-log columns (titles owned by this page). */
  readonly attendanceColumns: TableColumn<AttendanceRecord>[] = [
    {
      key: 'student',
      header: 'Student',
      type: 'primary',
      width: 'minmax(0, 1.35fr)',
      primary: (row) => ({ title: row.student, subtitle: row.studentId }),
    },
    {
      key: 'session',
      header: 'Session',
      width: 'minmax(120px, 1.1fr)',
      value: (row) => row.session,
    },
    {
      key: 'location',
      header: 'Location',
      width: 'minmax(120px, 1.1fr)',
      value: (row) => row.location,
    },
    {
      key: 'time',
      header: 'Time',
      width: 'minmax(100px, 0.7fr)',
      value: (row) => formatSessionOpened(row.recordedAt),
    },
    {
      key: 'distance',
      header: 'Distance',
      width: 'minmax(70px, 0.5fr)',
      value: (row) => (row.distanceMeters == null ? '—' : `${row.distanceMeters} m`),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'badge',
      width: 'minmax(100px, 0.7fr)',
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
}
