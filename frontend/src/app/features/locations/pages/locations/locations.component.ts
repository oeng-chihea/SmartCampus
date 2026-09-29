import { Component, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import {
  formatAttendanceDateTime,
  formatAttendanceDateTimeLabel,
} from '../../../../core/utils/date.util';
import {
  distanceBadgeVariant,
  formatCampusLocationLabel,
  formatDistanceMeters,
  formatGeofenceStatus,
  formatScanAccuracy,
  formatScanCoordinates,
  formatScannedAtCell,
  formatScannedAtPlace,
  geofenceBadgeVariant,
} from '../../../../core/utils/format.util';
import { DeviceCoordinates, toDeviceCoordinates } from '../../../../core/utils/geolocation.util';
import { LocationFilterState, LocationVisit } from '../../../../models/location.model';
import {
  formatLocationVoiceSummary,
  VOICE_RECORD_DETAIL_HINT,
} from '../../../../core/utils/voice-record-summary.util';
import { describeMatches, matchVisibleRows } from '../../../../core/utils/voice-row-match.util';
import {
  VoiceControlArgs,
  VoiceSelectArgs,
  VoiceToolResult,
} from '../../../../models/voice-live.model';
import { VoicePageRegistry } from '../../../../services/voice-page-registry.service';
import { LocationFilterComponent } from '../../../../shared/components/location-filter/location-filter.component';
import { ModalDialogComponent } from '../../../../shared/components/modal-dialog/modal-dialog.component';
import { ScanMapComponent } from '../../../../shared/components/scan-map/scan-map.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { TableColumn } from '../../../../shared/components/table/table.model';
import { LocationsPageFlow } from './locations.flow';
import { LocationsPageState } from './locations.state';

/**
 * Thin UI shell for the student location visit log.
 *
 * - State  → `locations.state.ts`
 * - Flow   → `locations.flow.ts` (POST /api/locations/visits)
 * - View   → this file + html/scss
 */
@Component({
  selector: 'app-locations',
  imports: [
    StatCardComponent,
    LocationFilterComponent,
    TableComponent,
    ModalDialogComponent,
    ScanMapComponent,
  ],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss',
  providers: [LocationsPageState, LocationsPageFlow],
})
export class LocationsComponent implements OnInit, OnDestroy {
  readonly state = inject(LocationsPageState);
  private readonly flow = inject(LocationsPageFlow);
  private readonly voicePages = inject(VoicePageRegistry);
  private readonly filter = viewChild(LocationFilterComponent);

  readonly title = 'Locations';
  readonly subtitle = 'Areas students visited when they marked present.';

  /** Row opened in the shared detail dialog. */
  readonly selectedVisit = signal<LocationVisit | null>(null);

  readonly visitColumns: TableColumn<LocationVisit>[] = [
    {
      key: 'student',
      header: 'Student',
      type: 'primary',
      width: 'minmax(9rem, 1fr)',
      primary: (row) => ({
        title: row.student,
        subtitle: row.studentId,
      }),
    },
    {
      key: 'session',
      header: 'Session',
      width: 'minmax(7.5rem, 0.85fr)',
      value: (row) => row.session,
    },
    {
      key: 'location',
      header: 'Location',
      width: 'minmax(8rem, 0.8fr)',
      value: (row) => formatCampusLocationLabel(row.building, row.room),
    },
    {
      key: 'building',
      header: 'Building',
      width: 'minmax(6.5rem, 0.55fr)',
      value: (row) => row.building,
    },
    {
      key: 'scannedAt',
      header: 'Scanned at',
      type: 'primary',
      width: 'minmax(12rem, 1.8fr)',
      cellClass: 'data-table__cell--scanned-at',
      primary: (row) =>
        formatScannedAtCell(
          row.scannedLocation,
          row.latitude,
          row.longitude,
          row.accuracyMeters,
          formatCampusLocationLabel(row.building, row.room) || row.locationName,
        ),
    },
    {
      key: 'recorded',
      header: 'Time',
      type: 'primary',
      width: 'minmax(6.5rem, 0.65fr)',
      primary: (row) => formatAttendanceDateTime(row.recordedAt),
    },
    {
      key: 'distance',
      header: 'Distance',
      type: 'badge',
      width: 'minmax(5.75rem, 0.5fr)',
      align: 'start',
      value: (row) => formatDistanceMeters(row.distanceMeters),
      badgeVariant: (row) => distanceBadgeVariant(row.distanceMeters),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'badge',
      width: 'minmax(12.5rem, 0.95fr)',
      align: 'start',
      value: (row) => formatGeofenceStatus(row.status),
      badgeVariant: (row) => geofenceBadgeVariant(row.status),
    },
  ];

  ngOnInit(): void {
    this.voicePages.register({
      page: 'locations',
      startContext: () =>
        `The staff is on Locations. ${this.voiceStatusMessage()} ${VOICE_RECORD_DETAIL_HINT}`,
      control: (args) => this.voiceControl(args),
      select: (args) => this.voiceSelect(args),
      act: () =>
        Promise.resolve({
          ok: false,
          message: 'Locations has no row buttons. Search, filter, or export instead.',
        }),
      confirm: () =>
        Promise.resolve({ ok: false, message: 'Nothing is waiting for confirmation.' }),
    });
    void this.flow.load();
  }

  ngOnDestroy(): void {
    this.voicePages.unregister('locations');
  }

  private async voiceControl(args: VoiceControlArgs): Promise<VoiceToolResult> {
    const toolbar = this.filter();
    if (args.action === 'refresh' || args.action === 'status') {
      if (args.action === 'refresh') {
        await this.flow.load();
      }
      return { ok: true, message: this.voiceStatusMessage() };
    }
    if (args.action === 'export') {
      await this.flow.exportExcel();
      return { ok: true, message: 'Exported location visits to Excel.' };
    }
    if (args.action === 'clear_search' || args.action === 'clear_filters') {
      toolbar?.applyFromVoice({
        search: '',
        building: 'All buildings',
        status: 'All statuses',
      });
      return {
        ok: true,
        message:
          args.action === 'clear_filters'
            ? 'Cleared location filters. Showing every visit.'
            : 'Cleared location search.',
      };
    }
    if (args.action === 'search' && args.query) {
      toolbar?.applyFromVoice({ search: args.query });
      return { ok: true, message: `Searching visits for ${args.query}.` };
    }
    if (args.action === 'filter') {
      toolbar?.applyFromVoice({
        search: args.query,
        building: args.building,
        status: this.normalizeVisitStatus(args.status_filter),
      });
      return { ok: true, message: 'Applied location filters.' };
    }
    return { ok: false, message: 'On Locations I can search, filter, refresh, or export.' };
  }

  private voiceStatusMessage(): string {
    return formatLocationVoiceSummary(this.state.visits());
  }

  private async voiceSelect(args: VoiceSelectArgs): Promise<VoiceToolResult> {
    const match = matchVisibleRows({
      rows: this.state.visits(),
      getId: (row) => row.id,
      getLabels: (row) => [row.student, row.studentId, row.session, row.building],
      rowId: args.row_id,
      query: args.query,
      position: args.position,
      lastPosition: args.last_position,
    });
    if (match.kind === 'none') {
      return { ok: false, message: 'Visit not found. Say the student name or ID.' };
    }
    if (match.kind === 'many') {
      return {
        ok: false,
        message: `Several visits match. ${describeMatches(match.rows, (row) => `${row.student} ${row.studentId}`)}`,
      };
    }
    this.selectedVisit.set(match.rows[0]);
    return {
      ok: true,
      message: `Selected ${match.rows[0].student}.`,
      item_summary: `${match.rows[0].student} ${match.rows[0].studentId}`,
      selected_id: match.rows[0].id,
    };
  }

  private normalizeVisitStatus(value?: string): string | undefined {
    const raw = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!raw) {
      return undefined;
    }
    if (raw === 'present' || raw === 'inside') {
      return 'Inside';
    }
    if (raw.includes('outside')) {
      return 'Outside Location';
    }
    if (raw === 'all') {
      return 'All statuses';
    }
    return value;
  }

  onFilterApply(filters: LocationFilterState): void {
    void this.flow.applyFilters(filters);
  }

  onExport(): void {
    void this.flow.exportExcel();
  }

  onVisitSelect(visit: LocationVisit): void {
    this.selectedVisit.set(visit);
  }

  closeVisitDetail(): void {
    this.selectedVisit.set(null);
  }

  campusLabel(visit: LocationVisit): string {
    return formatCampusLocationLabel(visit.building, visit.room);
  }

  coordinatesLabel(visit: LocationVisit): string {
    return formatScanCoordinates(visit.latitude, visit.longitude);
  }

  accuracyLabel(visit: LocationVisit): string {
    return formatScanAccuracy(visit.accuracyMeters) ?? '—';
  }

  scanDevice(visit: LocationVisit): DeviceCoordinates | null {
    return toDeviceCoordinates(visit.latitude, visit.longitude, visit.accuracyMeters);
  }

  scannedAtLabel(visit: LocationVisit): string {
    return formatScannedAtPlace(
      visit.scannedLocation,
      this.campusLabel(visit) || visit.locationName,
    );
  }

  locationStatusLabel(status: string | null): string {
    return formatGeofenceStatus(status);
  }

  distanceLabel(visit: LocationVisit): string {
    return formatDistanceMeters(visit.distanceMeters);
  }

  recordedLabel(visit: LocationVisit): string {
    return formatAttendanceDateTimeLabel(visit.recordedAt);
  }

  statusClass(status: string | null): string {
    return `record-detail__badge record-detail__badge--${geofenceBadgeVariant(status)}`;
  }
}
