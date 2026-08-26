import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  formatSessionDue,
  formatSessionOpened,
} from '../../../../core/utils/date.util';
import { formatCampusLocationLabel } from '../../../../core/utils/format.util';
import { VOICE_RECORD_DETAIL_HINT } from '../../../../core/utils/voice-record-summary.util';
import {
  describeMatches,
  matchVisibleRows,
} from '../../../../core/utils/voice-row-match.util';
import { AttendanceSession } from '../../../../models/session.model';
import {
  VoiceActArgs,
  VoiceConfirmArgs,
  VoiceControlArgs,
  VoiceSelectArgs,
  VoiceToolResult,
} from '../../../../models/voice-live.model';
import { VoicePageRegistry } from '../../../../services/voice-page-registry.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalDialogComponent } from '../../../../shared/components/modal-dialog/modal-dialog.component';
import { SelectDropdownComponent } from '../../../../shared/components/select-dropdown/select-dropdown.component';
import { SelectOption } from '../../../../shared/components/select-dropdown/select-dropdown.model';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import {
  TableAction,
  TableActionEvent,
  TableColumn,
} from '../../../../shared/components/table/table.model';
import { SessionsPageFlow } from './sessions.flow';
import { SessionsPageState } from './sessions.state';

/**
 * Thin UI shell for the Sessions page.
 *
 * - State  → `sessions.state.ts`  (signals, form, derived)
 * - Flow   → `sessions.flow.ts`  (API + orchestration)
 * - Types  → `models/session.model.ts`
 * - View   → this file + html/scss
 * - Create / edit dialog shell / shake → shared `app-modal-dialog`
 * - Session list → shared `app-table`
 */
@Component({
  selector: 'app-sessions',
  imports: [
    FormsModule,
    StatCardComponent,
    ModalDialogComponent,
    ConfirmDialogComponent,
    SelectDropdownComponent,
    TableComponent,
  ],
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss',
  providers: [SessionsPageState, SessionsPageFlow],
})
export class SessionsComponent implements OnInit, OnDestroy {
  /** Template binds to `state.*` for all reactive UI. */
  readonly state = inject(SessionsPageState);
  private readonly flow = inject(SessionsPageFlow);
  private readonly voicePages = inject(VoicePageRegistry);
  private pendingCloseId: string | null = null;

  /** Campus location options for the shared animated dropdown. */
  readonly locationOptions = computed<SelectOption[]>(() =>
    this.state.locations().map((location) => ({
      value: location.id,
      label: formatCampusLocationLabel(location.building, location.room),
      hint: `${location.radiusMeters}m geofence radius`,
    })),
  );

  /**
   * Session log columns (titles owned by this page).
   * Actions re-read closing/deleting/editing ids from state so labels stay in sync.
   */
  readonly sessionColumns = computed<TableColumn<AttendanceSession>[]>(() => {
    const closingId = this.state.closingId();
    const deletingId = this.state.deletingId();
    const editingId = this.state.editing()
      ? (this.state.editTarget()?.id ?? null)
      : null;
    return [
      {
        key: 'session',
        header: 'Session',
        type: 'primary',
        width: 'minmax(0, 1.4fr)',
        primary: (row) => ({ title: row.title, subtitle: row.id }),
      },
      {
        key: 'location',
        header: 'Location',
        width: 'minmax(120px, 1fr)',
        value: (row) => formatCampusLocationLabel(row.locationName),
      },
      {
        key: 'teacher',
        header: 'Teacher',
        width: 'minmax(100px, 0.8fr)',
        value: (row) => row.teacherName,
      },
      {
        key: 'opened',
        header: 'Opened',
        width: 'minmax(110px, 0.85fr)',
        value: (row) => formatSessionOpened(row.openedAt),
      },
      {
        key: 'due',
        header: 'Due',
        width: 'minmax(110px, 0.85fr)',
        value: (row) => formatSessionDue(row.dueAt),
      },
      {
        key: 'status',
        header: 'Status',
        type: 'badge',
        // Wider track + left edge so the badge lines up under STATUS (away from Actions).
        width: 'minmax(6.5rem, 0.7fr)',
        align: 'start',
        value: (row) => row.status,
        badgeVariant: (row) => row.status.toLowerCase(),
      },
      {
        key: 'actions',
        header: 'Actions',
        type: 'actions',
        // Wide enough for the ⋮ trigger + last-column padding so it never clips.
        width: 'minmax(5.5rem, 6rem)',
        align: 'center',
        actions: (row) => {
          const busy =
            closingId === row.id ||
            deletingId === row.id ||
            editingId === row.id ||
            this.state.formBusy();
          const items: TableAction[] = [];

          if (row.status === 'Open') {
            items.push({ id: 'show-qr', label: 'Show QR', disabled: busy });
          }

          items.push({
            id: 'edit-session',
            label: editingId === row.id ? 'Saving…' : 'Edit session',
            disabled: busy,
          });

          if (row.status === 'Open') {
            items.push({
              id: 'close',
              label: closingId === row.id ? 'Closing…' : 'Close',
              variant: 'danger',
              disabled: busy,
            });
          }

          items.push({
            id: 'delete',
            label: deletingId === row.id ? 'Deleting…' : 'Delete',
            variant: 'danger',
            disabled: busy,
          });

          return items;
        },
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    this.voicePages.register({
      page: 'sessions',
      startContext: () => this.voiceStartContext(),
      control: (args) => this.voiceControl(args),
      select: (args) => this.voiceSelect(args),
      act: (args) => this.voiceAct(args),
      confirm: (args) => this.voiceConfirm(args),
    });
    await this.flow.reload();
  }

  ngOnDestroy(): void {
    this.voicePages.unregister('sessions');
    // Modal restores body scroll on destroy; belt-and-suspenders if open on leave.
    if (this.state.createDialogOpen()) {
      document.body.style.overflow = '';
    }
    this.flow.destroy();
  }

  // ── Template event bridges ────────────────────────────────

  reload(): Promise<void> {
    return this.flow.reload();
  }

  openCreateDialog(): void {
    this.flow.openCreateDialog();
  }

  closeCreateDialog(): void {
    this.flow.closeCreateDialog();
  }

  cancelDelete(): void {
    this.flow.cancelDelete();
  }

  deleteConfirmedSession(): Promise<void> {
    return this.flow.deleteConfirmedSession();
  }

  onFieldInput(field: 'title' | 'locationId' | 'dueDate' | 'dueTime'): void {
    this.flow.onFieldInput(field);
  }

  formatDue(value: string | null | undefined): string {
    return formatSessionDue(value);
  }

  submitSessionForm(): Promise<void> {
    return this.flow.submitSessionForm();
  }

  showQr(sessionId: string): Promise<void> {
    return this.flow.showQr(sessionId);
  }

  refreshQrNow(): Promise<void> {
    return this.flow.refreshQrNow();
  }

  closeSession(sessionId: string): Promise<void> {
    return this.flow.closeSession(sessionId);
  }

  copyPayload(): Promise<void> {
    return this.flow.copyPayload();
  }

  /** Display label for QR panel / any location name string. */
  formatLocation(name: string): string {
    return formatCampusLocationLabel(name);
  }

  onSessionAction(event: TableActionEvent<AttendanceSession>): void {
    if (event.actionId === 'show-qr') {
      void this.showQr(event.row.id);
      return;
    }
    if (event.actionId === 'edit-session') {
      this.flow.openEditDialog(event.row);
      return;
    }
    if (event.actionId === 'close') {
      void this.closeSession(event.row.id);
      return;
    }
    if (event.actionId === 'delete') {
      this.flow.askDelete(event.row);
    }
  }

  private voiceStartContext(): string {
    const rows = this.state.sessions();
    const open = rows.filter((row) => row.status === 'Open').length;
    return `The staff is on Sessions. Open sessions: ${open}. Closed: ${rows.length - open}. ${VOICE_RECORD_DETAIL_HINT}`;
  }

  private async voiceControl(args: VoiceControlArgs): Promise<VoiceToolResult> {
    if (args.action === 'refresh' || args.action === 'status') {
      if (args.action === 'refresh') {
        await this.flow.reload();
      }
      return {
        ok: true,
        message: this.voiceStartContext(),
        item_summary: this.voiceStartContext(),
      };
    }
    if (args.action === 'open_create') {
      this.flow.openCreateDialog();
      return { ok: true, message: 'Opened the create session form.' };
    }
    if (args.action === 'search' && args.query) {
      return this.voiceSelect({ query: args.query });
    }
    return {
      ok: false,
      message: 'On Sessions I can refresh, open create, show QR, edit, close, or delete.',
    };
  }

  private async voiceSelect(args: VoiceSelectArgs): Promise<VoiceToolResult> {
    const match = matchVisibleRows({
      rows: this.state.sessions(),
      getId: (row) => row.id,
      getLabels: (row) => [row.title, row.id, row.locationName, row.teacherName],
      rowId: args.row_id,
      query: args.query,
      position: args.position,
      lastPosition: args.last_position,
    });
    if (match.kind === 'none') {
      return { ok: false, message: 'Session not found. Say the title or first open session.' };
    }
    if (match.kind === 'many') {
      return {
        ok: false,
        message: `Several sessions match. ${describeMatches(match.rows, (row) => row.title)}`,
        matches: match.rows.map((row) => ({ id: row.id, label: row.title })),
      };
    }
    const session = match.rows[0];
    return {
      ok: true,
      message: `Selected ${session.title}.`,
      item_summary: session.title,
      selected_id: session.id,
    };
  }

  private async voiceAct(args: VoiceActArgs): Promise<VoiceToolResult> {
    if (args.action === 'open_add_student' || args.action === 'toggle_login') {
      return { ok: false, message: 'That action is for Students, not Sessions.' };
    }
    const selected = await this.voiceSelect(args);
    if (!selected.ok || !selected.selected_id) {
      return selected;
    }
    const session = this.state
      .sessions()
      .find((row) => row.id === selected.selected_id);
    if (!session) {
      return { ok: false, message: 'Session not found.' };
    }
    if (args.action === 'show_qr') {
      await this.flow.showQr(session.id);
      return {
        ok: true,
        message: `Showing QR for ${session.title}.`,
        item_summary: session.title,
      };
    }
    if (args.action === 'edit') {
      this.flow.openEditDialog(session);
      return {
        ok: true,
        message: `Opened edit for ${session.title}.`,
        item_summary: session.title,
      };
    }
    if (args.action === 'close') {
      if (session.status !== 'Open') {
        return { ok: false, message: `${session.title} is already closed.` };
      }
      this.pendingCloseId = session.id;
      return {
        ok: true,
        confirmation_required: true,
        message: `Close ${session.title}? Say yes or no.`,
        item_summary: session.title,
      };
    }
    if (args.action === 'delete') {
      this.flow.askDelete(session);
      return {
        ok: true,
        confirmation_required: true,
        message: `Delete ${session.title}? Say yes or no.`,
        item_summary: session.title,
      };
    }
    return { ok: false, message: 'I can show QR, edit, close, or delete a session.' };
  }

  private async voiceConfirm(args: VoiceConfirmArgs): Promise<VoiceToolResult> {
    if (!args.confirm) {
      this.pendingCloseId = null;
      this.flow.cancelDelete();
      return { ok: true, message: 'Cancelled.' };
    }
    if (this.pendingCloseId) {
      const id = this.pendingCloseId;
      this.pendingCloseId = null;
      await this.flow.closeSession(id);
      return { ok: true, message: 'Session closed.' };
    }
    if (this.state.deleteTarget()) {
      await this.flow.deleteConfirmedSession();
      return { ok: true, message: 'Session deleted.' };
    }
    return { ok: false, message: 'Nothing is waiting for confirmation.' };
  }
}
