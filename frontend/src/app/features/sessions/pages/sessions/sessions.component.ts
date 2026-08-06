import { DatePipe, formatDate } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AttendanceSession } from '../../../../models/session.model';
import { ModalDialogComponent } from '../../../../shared/components/modal-dialog/modal-dialog.component';
import { SelectDropdownComponent } from '../../../../shared/components/select-dropdown/select-dropdown.component';
import { SelectOption } from '../../../../shared/components/select-dropdown/select-dropdown.model';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import {
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
 * - Create dialog shell / shake → shared `app-modal-dialog`
 * - Session list → shared `app-table`
 */
@Component({
  selector: 'app-sessions',
  imports: [
    FormsModule,
    StatCardComponent,
    DatePipe,
    ModalDialogComponent,
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

  /** Campus location options for the shared animated dropdown. */
  readonly locationOptions = computed<SelectOption[]>(() =>
    this.state.locations().map((location) => ({
      value: location.id,
      label: `${location.building}, Room ${location.room}`,
      hint: `${location.radiusMeters}m geofence radius`,
    })),
  );

  /**
   * Session log columns (titles owned by this page).
   * Actions re-read closingId from state so labels stay in sync.
   */
  readonly sessionColumns = computed<TableColumn<AttendanceSession>[]>(() => {
    const closingId = this.state.closingId();
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
        value: (row) => row.locationName,
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
        value: (row) => formatDate(row.openedAt, 'short', 'en-US'),
      },
      {
        key: 'status',
        header: 'Status',
        type: 'badge',
        width: 'minmax(72px, 0.5fr)',
        value: (row) => row.status,
        badgeVariant: (row) => row.status.toLowerCase(),
      },
      {
        key: 'actions',
        header: 'Actions',
        type: 'actions',
        width: 'minmax(160px, 0.95fr)',
        actions: (row) => {
          if (row.status !== 'Open') {
            return [];
          }
          return [
            { id: 'show-qr', label: 'Show QR' },
            {
              id: 'close',
              label: closingId === row.id ? 'Closing…' : 'Close',
              variant: 'danger',
              disabled: closingId === row.id,
            },
          ];
        },
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    await this.flow.reload();
  }

  ngOnDestroy(): void {
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

  onFieldInput(field: 'title' | 'locationId' | 'lateAfterMinutes'): void {
    this.flow.onFieldInput(field);
  }

  createSession(): Promise<void> {
    return this.flow.createSession();
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

  onSessionAction(event: TableActionEvent<AttendanceSession>): void {
    if (event.actionId === 'show-qr') {
      void this.showQr(event.row.id);
      return;
    }
    if (event.actionId === 'close') {
      void this.closeSession(event.row.id);
    }
  }
}
