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

const DEFAULT_FILTERS: AttendanceFilterState = {
  search: '',
  sessionId: 'all',
  status: 'all',
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
  readonly error = signal<string | null>(null);

  // ── Domain data ───────────────────────────────────────────
  readonly records = signal<AttendanceRecord[]>([]);
  readonly metrics = signal<StatCard[]>([]);

  /** Real statuses returned by the API (stable canonical order). */
  readonly statusOptions = signal<SelectOption[]>([
    { value: 'all', label: 'All statuses' },
  ]);

  // ── Filter state (not shown directly) ─────────────────────
  private readonly filterState = signal<AttendanceFilterState>(DEFAULT_FILTERS);

  // ── Derived ───────────────────────────────────────────────
  readonly filters = computed<AttendanceFilterOptions>(() => ({
    searchPlaceholder: 'Search student name or ID',
    statusOptions: this.statusOptions(),
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

  setPageError(message: string | null): void {
    this.error.set(message);
  }

  /** Store the API response: scan rows, summary cards, and real status list. */
  applyResponse(page: AdminAttendanceResponse): void {
    this.records.set(page.records);
    this.metrics.set(this.buildMetrics(page.metrics));
    this.statusOptions.set([
      { value: 'all', label: 'All statuses' },
      ...page.statusOptions.map((status) => ({ value: status, label: status })),
    ]);
  }

  private buildMetrics(metrics: AttendanceMetrics): StatCard[] {
    return [
      {
        label: 'Present',
        value: String(metrics.present),
        helper: 'Valid scans inside zone',
        icon: 'present',
        tone: 'green',
      },
      {
        label: 'Late',
        value: String(metrics.late),
        helper: 'After late threshold',
        icon: 'late',
        tone: 'amber',
      },
      {
        label: 'Absent',
        value: String(metrics.absent),
        helper: 'No successful check-in',
        icon: 'attendance',
        tone: 'violet',
      },
    ];
  }
}
