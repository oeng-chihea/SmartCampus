import { Component, computed, signal } from '@angular/core';
import { AttendanceFilterState, AttendanceRecord } from '../../../../models/attendance.model';
import { AttendanceService } from '../../../../services/attendance.service';
import { AttendanceFilterComponent } from '../../../../shared/components/attendance-filter/attendance-filter.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { TableColumn } from '../../../../shared/components/table/table.model';

@Component({
  selector: 'app-admin-records',
  imports: [StatCardComponent, AttendanceFilterComponent, TableComponent],
  templateUrl: './admin-records.component.html',
  styleUrl: './admin-records.component.scss',
})
export class AdminRecordsComponent {
  private readonly attendanceService = new AttendanceService();
  private readonly pageData = this.attendanceService.getAdminAttendancePage();
  private readonly filterState = signal<AttendanceFilterState>({
    search: '',
    session: 'All sessions',
    status: 'All statuses',
    date: 'All dates',
  });

  readonly page = this.pageData;

  readonly filteredRecords = computed(() =>
    this.attendanceService.filterRecords(this.pageData.records, this.filterState()),
  );

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
      width: 'minmax(90px, 0.7fr)',
      value: (row) => row.submittedAt,
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

  onFilterApply(filters: AttendanceFilterState): void {
    this.filterState.set(filters);
  }
}
