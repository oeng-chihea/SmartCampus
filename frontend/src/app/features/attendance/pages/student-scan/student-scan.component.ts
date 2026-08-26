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
import {
  isMarkAllVoiceRequest,
  speakMarkAllResult,
} from '../../../../core/utils/voice-mark-all.util';
import {
  describeMatches,
  matchVisibleRows,
} from '../../../../core/utils/voice-row-match.util';
import { AttendanceRecord } from '../../../../models/attendance.model';
import { OpenLiveSessionCard } from '../../../../models/session.model';
import {
  VoiceActArgs,
  VoiceConfirmArgs,
  VoiceControlArgs,
  VoiceSelectArgs,
  VoiceToolResult,
} from '../../../../models/voice-live.model';
import { AuthService } from '../../../../services/auth.service';
import { VoiceLiveService } from '../../../../services/voice-live.service';
import { VoicePageRegistry } from '../../../../services/voice-page-registry.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalDialogComponent } from '../../../../shared/components/modal-dialog/modal-dialog.component';
import { ScanMapComponent } from '../../../../shared/components/scan-map/scan-map.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { TableColumn } from '../../../../shared/components/table/table.model';
import { VoiceAssistantComponent } from '../../../../shared/components/voice-assistant/voice-assistant.component';
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
  imports: [
    ConfirmDialogComponent,
    ModalDialogComponent,
    ScanMapComponent,
    TableComponent,
    VoiceAssistantComponent,
  ],
  templateUrl: './student-scan.component.html',
  styleUrl: './student-scan.component.scss',
  providers: [StudentScanPageState, StudentScanPageFlow],
})
export class StudentScanComponent implements OnInit, OnDestroy {
  readonly state = inject(StudentScanPageState);
  private readonly flow = inject(StudentScanPageFlow);
  private readonly auth = inject(AuthService);
  private readonly voice = inject(VoiceLiveService);
  private readonly voicePages = inject(VoicePageRegistry);
  private selectedSessionId: string | null = null;

  readonly user = computed(() => this.auth.user());

  readonly recordedLiveCount = computed(
    () => this.state.openSessions().filter((row) => this.state.hasSubmittedFor(row.id)).length,
  );

  readonly notRecordedLiveCount = computed(
    () => this.state.openSessions().filter((row) => !this.state.hasSubmittedFor(row.id)).length,
  );

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
    this.voicePages.register({
      page: 'scan',
      startContext: () => this.voiceStatusMessage(),
      control: (args) => this.voiceControl(args),
      select: (args) => this.voiceSelect(args),
      act: (args) => this.voiceAct(args),
      confirm: (args) => this.voiceConfirm(args),
    });
    await this.flow.init();
  }

  ngOnDestroy(): void {
    this.voicePages.unregister('scan');
    this.flow.destroy();
    void this.voice.stop();
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
    void this.voice.stop();
    this.flow.logout();
  }

  private voiceStatusMessage(): string {
    const sessions = this.state.openSessions();
    const recordedLive = sessions.filter((row) => this.alreadyDone(row.id));
    const notRecorded = sessions.filter((row) => !this.alreadyDone(row.id));
    const stillOpen = notRecorded.filter((row) => !isSessionPastDue(row.dueAt));
    const duePassed = notRecorded.filter((row) => isSessionPastDue(row.dueAt));
    const gps = this.state.deviceFix()
      ? 'Location is on.'
      : this.state.deviceFixReason() === 'denied'
        ? 'Location is blocked. Allow it or the check-in cannot be sent.'
        : 'Waiting for location.';
    if (!sessions.length) {
      return `The student is on Mark attendance. No live class is open yet. ${this.state.myRecords().length} recorded scans in history. ${gps}`;
    }
    const recordedNames = recordedLive.map((row) => row.title).join(', ') || 'none';
    const openNames = stillOpen.map((row) => row.title).join(', ') || 'none';
    const dueNames = duePassed.map((row) => row.title).join(', ') || 'none';
    return `The student is on Mark attendance. Already recorded live classes: ${recordedLive.length} (${recordedNames}). Not yet recorded: ${notRecorded.length}. Still open to mark: ${stillOpen.length} (${openNames}). Due passed and not recorded: ${duePassed.length} (${dueNames}). ${gps}`;
  }

  private async voiceControl(args: VoiceControlArgs): Promise<VoiceToolResult> {
    if (args.action === 'refresh' || args.action === 'status') {
      if (args.action === 'refresh') {
        await this.flow.reload(true);
      }
      return { ok: true, message: this.voiceStatusMessage() };
    }
    return {
      ok: false,
      message: 'On Mark attendance I can refresh, tell you the live classes, or mark you present.',
    };
  }

  private async voiceSelect(args: VoiceSelectArgs): Promise<VoiceToolResult> {
    const match = matchVisibleRows({
      rows: this.state.openSessions(),
      getId: (row) => row.id,
      getLabels: (row) => [row.title, row.id, row.locationName, row.teacherName],
      rowId: args.row_id,
      query: args.query,
      position: args.position,
      lastPosition: args.last_position,
    });
    if (match.kind === 'none') {
      return { ok: false, message: 'I could not find that live class. Say the class name again.' };
    }
    if (match.kind === 'many') {
      return {
        ok: false,
        message: `Several live classes match. ${describeMatches(match.rows, (row) => row.title)}`,
        matches: match.rows.map((row) => ({ id: row.id, label: row.title })),
      };
    }
    const session = match.rows[0];
    this.selectedSessionId = session.id;
    const recorded = this.alreadyDone(session.id);
    const due = isSessionPastDue(session.dueAt);
    const state = recorded
      ? 'already recorded'
      : due
        ? 'not yet recorded, due passed, cannot mark present'
        : 'not yet recorded';
    return {
      ok: true,
      message: `Selected ${session.title}, ${state}.`,
      selected_id: session.id,
    };
  }

  private async voiceAct(args: VoiceActArgs): Promise<VoiceToolResult> {
    if (args.action !== 'mark_present') {
      return { ok: false, message: 'On Mark attendance I can mark you present for a live class.' };
    }

    if (isMarkAllVoiceRequest(args)) {
      return this.voiceMarkAll();
    }

    const hasTarget = Boolean(
      args.row_id || args.query || args.position || args.last_position || this.selectedSessionId,
    );
    if (hasTarget) {
      const selected = await this.voiceSelect({
        ...args,
        row_id: args.row_id || this.selectedSessionId || undefined,
      });
      if (!selected.ok) {
        return selected;
      }
    }

    let session = this.resolveMarkSession(args);
    if (!session) {
      const eligible = this.eligibleSessions();
      if (eligible.length === 1) {
        session = eligible[0];
        this.selectedSessionId = session.id;
      } else if (!eligible.length) {
        return {
          ok: false,
          message: this.state.openSessions().length
            ? 'There is no live class left to mark present. Due time may have passed, or you already recorded it.'
            : 'No live class is open yet. Ask your teacher to create a session.',
        };
      } else {
        return {
          ok: false,
          message: `Which class should I mark present, or say mark all for every live class still open? ${describeMatches(eligible, (row) => row.title)}`,
          matches: eligible.map((row) => ({ id: row.id, label: row.title })),
        };
      }
    }

    if (this.alreadyDone(session.id)) {
      return {
        ok: true,
        message: `You already recorded ${session.title}. It is in My attendance.`,
      };
    }

    await this.flow.markPresent(session);
    if (this.state.locationBlocked()) {
      return {
        ok: false,
        confirmation_required: true,
        message:
          'Location is blocked. Allow location on this phone, then say try again. Without location the check-in cannot be sent and you will be absent after due time.',
      };
    }
    if (this.state.dueBlocked()) {
      return {
        ok: false,
        message: `Due time has passed for ${session.title}. You cannot mark present for this class.`,
      };
    }
    if (this.state.error()) {
      return { ok: false, message: this.state.error() ?? 'Could not mark present.' };
    }
    return {
      ok: true,
      message: this.state.success() || this.state.info() || `Marked present for ${session.title}.`,
    };
  }

  private async voiceMarkAll(): Promise<VoiceToolResult> {
    const sessions = this.state.openSessions();
    const skippedRecordedTitles = sessions
      .filter((row) => this.alreadyDone(row.id))
      .map((row) => row.title);
    const skippedDueTitles = sessions
      .filter((row) => !this.alreadyDone(row.id) && isSessionPastDue(row.dueAt))
      .map((row) => row.title);
    const targets = sessions.filter(
      (row) => !this.alreadyDone(row.id) && !isSessionPastDue(row.dueAt),
    );
    const markedTitles: string[] = [];

    for (const session of targets) {
      await this.flow.markPresent(session, { reload: false });
      if (this.state.locationBlocked()) {
        await this.flow.reload(false);
        return {
          ok: false,
          confirmation_required: true,
          message: speakMarkAllResult({
            markedTitles,
            skippedRecordedTitles,
            skippedDueTitles,
            locationBlocked: true,
            error: null,
          }),
        };
      }
      if (this.state.dueBlocked()) {
        skippedDueTitles.push(session.title);
        this.flow.dismissDueBlocked();
        continue;
      }
      if (this.state.error()) {
        await this.flow.reload(false);
        return {
          ok: false,
          message: speakMarkAllResult({
            markedTitles,
            skippedRecordedTitles,
            skippedDueTitles,
            locationBlocked: false,
            error: this.state.error(),
          }),
        };
      }
      if (this.alreadyDone(session.id)) {
        markedTitles.push(session.title);
      }
    }

    await this.flow.reload(false);
    return {
      ok:
        markedTitles.length > 0 ||
        skippedRecordedTitles.length > 0 ||
        skippedDueTitles.length > 0,
      message: speakMarkAllResult({
        markedTitles,
        skippedRecordedTitles,
        skippedDueTitles,
        locationBlocked: false,
        error: null,
      }),
    };
  }

  private resolveMarkSession(args: VoiceActArgs): OpenLiveSessionCard | null {
    const id = String(args.row_id ?? this.selectedSessionId ?? '').trim();
    if (!id) {
      return null;
    }
    return this.state.openSessions().find((row) => row.id === id) ?? null;
  }

  private eligibleSessions(): OpenLiveSessionCard[] {
    return this.state
      .openSessions()
      .filter((row) => !this.alreadyDone(row.id) && !isSessionPastDue(row.dueAt));
  }

  private async voiceConfirm(args: VoiceConfirmArgs): Promise<VoiceToolResult> {
    if (this.state.locationBlocked()) {
      if (args.confirm) {
        await this.flow.retryAfterLocationBlocked();
        return { ok: true, message: this.state.success() || 'Trying location again.' };
      }
      this.flow.dismissLocationBlocked();
      return { ok: true, message: 'Cancelled. Location is still required to mark present.' };
    }
    if (this.state.dueBlocked()) {
      this.flow.dismissDueBlocked();
      return { ok: true, message: 'Closed the due time notice.' };
    }
    return { ok: false, message: 'There is nothing to confirm right now.' };
  }
}
