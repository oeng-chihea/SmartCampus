import { Component, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import {
  formatAttendanceDateTime,
  formatAttendanceDateTimeLabel,
} from '../../../../core/utils/date.util';
import {
  buildGoogleMapsUrl,
  formatDistanceMeters,
  formatGeofenceStatus,
  formatScanAccuracy,
  formatScannedAtPlace,
  geofenceBadgeVariant,
} from '../../../../core/utils/format.util';
import { DeviceCoordinates, toDeviceCoordinates } from '../../../../core/utils/geolocation.util';
import { AttendanceFilterState, AttendanceRecord } from '../../../../models/attendance.model';
import { describeMatches, matchVisibleRows } from '../../../../core/utils/voice-row-match.util';
import {
  formatAttendanceVoiceSummary,
  summarizeAttendanceRecords,
  VOICE_RECORD_DETAIL_HINT,
} from '../../../../core/utils/voice-record-summary.util';
import {
  VoiceControlArgs,
  VoiceSelectArgs,
  VoiceToolResult,
} from '../../../../models/voice-live.model';
import { VoicePageRegistry } from '../../../../services/voice-page-registry.service';
import { AttendanceFilterComponent } from '../../../../shared/components/attendance-filter/attendance-filter.component';
import { ModalDialogComponent } from '../../../../shared/components/modal-dialog/modal-dialog.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { ScanMapComponent } from '../../../../shared/components/scan-map/scan-map.component';
import { AdminRecordsFlow } from './admin-records.flow';
import { AdminRecordsState } from './admin-records.state';

interface AttendanceSessionGroup {
  sessionId: string;
  session: string;
  location: string;
  recordedAt: string;
  records: AttendanceRecord[];
  presentCount: number;
  absentCount: number;
}

/**
 * Thin UI shell for the Admin attendance records page.
 *
 * - State  → `admin-records.state.ts`  (signals, filters, derived)
 * - Flow   → `admin-records.flow.ts`   (API + orchestration)
 * - View   → this file + html/scss
 * - Filter toolbar → shared `app-attendance-filter`
 */
@Component({
  selector: 'app-admin-records',
  imports: [
    StatCardComponent,
    AttendanceFilterComponent,
    ModalDialogComponent,
    ScanMapComponent,
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

  /** Group the visible records by session ID so repeated titles stay separate. */
  readonly sessionGroups = computed<AttendanceSessionGroup[]>(() => {
    const groups = new Map<string, AttendanceSessionGroup>();

    for (const record of this.state.records()) {
      let group = groups.get(record.sessionId);
      if (!group) {
        group = {
          sessionId: record.sessionId,
          session: record.session,
          location: record.location,
          recordedAt: record.recordedAt,
          records: [],
          presentCount: 0,
          absentCount: 0,
        };
        groups.set(record.sessionId, group);
      }

      group.records.push(record);
      if (record.attendanceStatus === 'Absent') {
        group.absentCount += 1;
      } else {
        group.presentCount += 1;
      }
    }

    for (const group of groups.values()) {
      group.records.sort(
        (left, right) =>
          left.student.localeCompare(right.student) ||
          left.studentId.localeCompare(right.studentId),
      );
    }

    return Array.from(groups.values());
  });

  ngOnInit(): void {
    this.voicePages.register({
      page: 'attendance',
      startContext: () =>
        `The staff is on Attendance. ${this.voiceStatusMessage()} ${VOICE_RECORD_DETAIL_HINT}`,
      control: (args) => this.voiceControl(args),
      select: (args) => this.voiceSelect(args),
      act: () =>
        Promise.resolve({
          ok: false,
          message: 'I can’t perform attendance actions. Search, filter, or export instead.',
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
        message: this.voiceStatusMessage(),
        attendance: summarizeAttendanceRecords(this.state.records()),
      };
    }
    if (args.action === 'export') {
      await this.flow.exportExcel();
      return { ok: true, message: 'Exported attendance to Excel.' };
    }
    if (args.action === 'clear_search' || args.action === 'clear_filters') {
      toolbar?.applyFromVoice({
        search: '',
        status: 'all',
        attendanceStatus: 'all',
        date: 'all',
        sessionId: 'all',
      });
      return {
        ok: true,
        message:
          args.action === 'clear_filters'
            ? 'Cleared attendance filters. Showing every record.'
            : 'Cleared attendance search.',
      };
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

  private voiceStatusMessage(): string {
    return formatAttendanceVoiceSummary(summarizeAttendanceRecords(this.state.records()));
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
    const raw = String(value ?? '')
      .trim()
      .toLowerCase();
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

  sessionDateLabel(group: AttendanceSessionGroup): string {
    return formatAttendanceDateTime(group.recordedAt).title;
  }

  attendanceTime(record: AttendanceRecord): { title: string; subtitle?: string } {
    return formatAttendanceDateTime(record.recordedAt);
  }

  statusBadgeClass(status: string | null): string {
    return `attendance-status-badge attendance-status-badge--${geofenceBadgeVariant(status)}`;
  }

  onExport(): void {
    void this.flow.exportExcel();
  }

  onRecordSelect(record: AttendanceRecord): void {
    this.selectedRecord.set(record);
  }

  onRecordKeydown(event: KeyboardEvent, record: AttendanceRecord): void {
    if (event.key === 'Enter' || event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      this.onRecordSelect(record);
    }
  }

  closeRecordDetail(): void {
    this.selectedRecord.set(null);
  }

  accuracyLabel(record: AttendanceRecord): string {
    return formatScanAccuracy(record.accuracyMeters) ?? '—';
  }

  scanDevice(record: AttendanceRecord): DeviceCoordinates | null {
    return toDeviceCoordinates(record.latitude, record.longitude, record.accuracyMeters);
  }

  scannedAtLabel(record: AttendanceRecord): string {
    if (record.attendanceStatus === 'Absent') {
      return 'No scan';
    }
    return formatScannedAtPlace(record.scannedLocation, record.location);
  }

  googleMapsUrl(record: AttendanceRecord): string | null {
    return buildGoogleMapsUrl(record.latitude, record.longitude);
  }

  locationStatusLabel(status: string | null): string {
    return formatGeofenceStatus(status);
  }

  distanceLabel(record: AttendanceRecord): string {
    return formatDistanceMeters(record.distanceMeters);
  }

  recordedLabel(record: AttendanceRecord): string {
    return formatAttendanceDateTimeLabel(record.recordedAt);
  }
}
