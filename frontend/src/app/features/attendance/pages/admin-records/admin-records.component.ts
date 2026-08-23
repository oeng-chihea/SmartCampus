import { Component, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import {
  formatAttendanceDateTime,
  formatAttendanceDateTimeLabel,
} from '../../../../core/utils/date.util';
import {
  distanceBadgeVariant,
  formatDistanceMeters,
  formatScanCoordinates,
  formatScannedAtCell,
} from '../../../../core/utils/format.util';
import {
  AttendanceFilterState,
  AttendanceRecord,
} from '../../../../models/attendance.model';
import {
  describeMatches,
  matchVisibleRows,
} from '../../../../core/utils/voice-row-match.util';
import {
  VoiceControlArgs,
  VoiceSelectArgs,
  VoiceToolResult,
} from '../../../../models/voice-live.model';
import { VoicePageRegistry } from '../../../../services/voice-page-registry.service';
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
export class AdminRecordsComponent implements OnInit, OnDestroy {
  /** Template binds to `state.*` for all reactive UI. */
  readonly state = inject(AdminRecordsState);
  private readonly flow = inject(AdminRecordsFlow);
  private readonly voicePages = inject(VoicePageRegistry);
  private readonly filter = viewChild(AttendanceFilterComponent);

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
        formatScannedAtCell(row.scannedLocation, row.latitude, row.longitude),
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
    {
      key: 'attendanceStatus',
      header: 'Attendance status',
      type: 'badge',
      width: 'minmax(8.75rem, 0.9fr)',
      align: 'start',
      value: (row) => row.attendanceStatus,
      badgeVariant: (row) => row.attendanceStatus.toLowerCase(),
    },
  ];

  ngOnInit(): void {
    this.voicePages.register({
      page: 'attendance',
      startContext: () =>
        `The staff is on Attendance. ${this.state.records().length} records visible.`,
      control: (args) => this.voiceControl(args),
      select: (args) => this.voiceSelect(args),
      act: () =>
        Promise.resolve({
          ok: false,
          message: 'Attendance has no row buttons. Search, filter, or export instead.',
        }),
      confirm: () =>
        Promise.resolve({ ok: false, message: 'Nothing is waiting for confirmation.' }),
    });
    void this.flow.load();
  }

  ngOnDestroy(): void {
    this.voicePages.unregister('attendance');
  }

  private async voiceControl(args: VoiceControlArgs): Promise<VoiceToolResult> {
    const toolbar = this.filter();
    if (args.action === 'refresh' || args.action === 'status') {
      if (args.action === 'refresh') {
        await this.flow.load();
      }
      return {
        ok: true,
        message: `${this.state.records().length} attendance records visible.`,
      };
    }
    if (args.action === 'export') {
      await this.flow.exportExcel();
      return { ok: true, message: 'Exported attendance to Excel.' };
    }
    if (args.action === 'clear_search') {
      toolbar?.applyFromVoice({ search: '' });
      return { ok: true, message: 'Cleared attendance search.' };
    }
    if (args.action === 'search' && args.query) {
      toolbar?.applyFromVoice({ search: args.query });
      return { ok: true, message: `Searching attendance for ${args.query}.` };
    }
    if (args.action === 'filter') {
      toolbar?.applyFromVoice({
        status: this.normalizeLocationStatus(args.status_filter),
        attendanceStatus: args.attendance_status,
        date: args.date_filter,
        search: args.query,
      });
      return { ok: true, message: 'Applied attendance filters.' };
    }
    return { ok: false, message: 'On Attendance I can search, filter, refresh, or export.' };
  }

  private async voiceSelect(args: VoiceSelectArgs): Promise<VoiceToolResult> {
    const match = matchVisibleRows({
      rows: this.state.records(),
      getId: (row) => row.id,
      getLabels: (row) => [row.student, row.studentId, row.session],
      rowId: args.row_id,
      query: args.query,
      position: args.position,
      lastPosition: args.last_position,
    });
    if (match.kind === 'none') {
      return { ok: false, message: 'Record not found. Say the student name or ID.' };
    }
    if (match.kind === 'many') {
      return {
        ok: false,
        message: `Several records match. ${describeMatches(match.rows, (row) => `${row.student} ${row.studentId}`)}`,
      };
    }
    this.selectedRecord.set(match.rows[0]);
    return {
      ok: true,
      message: `Selected ${match.rows[0].student}.`,
      item_summary: `${match.rows[0].student} ${match.rows[0].studentId}`,
      selected_id: match.rows[0].id,
    };
  }

  private normalizeLocationStatus(value?: string): string | undefined {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) {
      return undefined;
    }
    if (raw === 'inside' || raw === 'outside' || raw === 'all') {
      return raw;
    }
    return undefined;
  }

  onFilterApply(filters: AttendanceFilterState): void {
    void this.flow.applyFilters(filters);
  }

  onExport(): void {
    void this.flow.exportExcel();
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
