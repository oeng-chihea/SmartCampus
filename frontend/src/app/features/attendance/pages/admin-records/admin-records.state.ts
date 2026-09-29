import { Injectable, computed, signal } from '@angular/core';
import {
  AdminAttendanceResponse,
  AttendanceFilterOptions,
  AttendanceFilterState,
  AttendanceMetrics,
  AttendanceRecord,
} from '../../../../models/attendance.model';
import { SelectOption } from '../../../../shared/components/select-dropdown/select-dropdown.model';
import { StatCard } from '../../../../shared/components/stat-card/stat-card.model';

const DATE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This week' },
];

const LOCATION_STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'inside', label: 'Inside' },
  { value: 'outside', label: 'Outside Location' },
];

const ATTENDANCE_STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All attendance statuses' },
  { value: 'Present', label: 'Present' },
  { value: 'Absent', label: 'Absent' },
];

const DEFAULT_FILTERS: AttendanceFilterState = {
  search: '',
  sessionId: 'all',
  status: 'all',
  attendanceStatus: 'all',
  date: 'all',
};

/**
 * Admin records page state only — signals, filters, derived values.
 * No HTTP. Mutations that only touch local data live here.
 * Orchestration / API belongs in `admin-records.flow.ts`.
 *
 * Session filter uses the paginated session picker modal (not a dropdown list).
 */
@Injectable()
export class AdminRecordsState {
  // ── UI flags ──────────────────────────────────────────────
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);

  // ── Domain data ───────────────────────────────────────────
  readonly records = signal<AttendanceRecord[]>([]);
  readonly metrics = signal<StatCard[]>([]);

  // ── Filter state (not shown directly) ─────────────────────
  private readonly filterState = signal<AttendanceFilterState>(DEFAULT_FILTERS);

  // ── Derived ───────────────────────────────────────────────
  readonly filters = computed<AttendanceFilterOptions>(() => ({
    searchPlaceholder: 'Search student name or ID',
    statusOptions: LOCATION_STATUS_OPTIONS,
    attendanceStatusOptions: ATTENDANCE_STATUS_OPTIONS,
    dateOptions: DATE_OPTIONS,
  }));

  // ── Local state helpers (no API) ──────────────────────────

  getFilters(): AttendanceFilterState {
    return this.filterState();
  }

  setFilters(filters: AttendanceFilterState): void {
    this.filterState.set(filters);
  }

  beginLoad(): void {
    this.loading.set(true);
    this.error.set(null);
  }

  endLoad(): void {
    this.loading.set(false);
  }

  beginExport(): void {
    this.exporting.set(true);
    this.error.set(null);
  }

  endExport(): void {
    this.exporting.set(false);
  }

  setPageError(message: string | null): void {
    this.error.set(message);
  }

  /** Store the API response: scan rows, summary cards, and real status list. */
  applyResponse(page: AdminAttendanceResponse): void {
    this.records.set(
      page.records.map((row) => ({
        ...row,
        attendanceStatus:
          row.attendanceStatus ??
          (row.status === null ? 'Absent' : 'Present'),
      })),
    );
    this.metrics.set(this.buildMetrics(page.metrics));
  }

  private buildMetrics(metrics: AttendanceMetrics): StatCard[] {
    return [
      {
        label: 'Present',
        value: String(metrics.present),
        helper: 'Attendance marked before the due time',
        icon: 'present',
        tone: 'green',
      },
      {
        label: 'Outside Location',
        value: String(metrics.outsideLocation ?? 0),
        helper: 'Scanned on time, outside geofence',
        icon: 'locations',
        tone: 'amber',
      },
      {
        label: 'Absent',
        value: String(metrics.absent),
        helper: 'No scan / mark present',
        icon: 'attendance',
        tone: 'violet',
      },
    ];
  }
}
