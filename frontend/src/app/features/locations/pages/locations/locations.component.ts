import { Component, OnInit, inject, signal } from '@angular/core';
import { formatAttendanceDateTime, formatAttendanceDateTimeLabel } from '../../../../core/utils/date.util';
import {
  distanceBadgeVariant,
  formatCampusLocationLabel,
  formatDistanceMeters,
  formatScanAccuracy,
  formatScanCoordinates,
  formatScannedAtCell,
} from '../../../../core/utils/format.util';
import {
  LocationFilterState,
  LocationVisit,
} from '../../../../models/location.model';
import { LocationFilterComponent } from '../../../../shared/components/location-filter/location-filter.component';
import { ModalDialogComponent } from '../../../../shared/components/modal-dialog/modal-dialog.component';
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
  imports: [StatCardComponent, LocationFilterComponent, TableComponent, ModalDialogComponent],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss',
  providers: [LocationsPageState, LocationsPageFlow],
})
export class LocationsComponent implements OnInit {
  readonly state = inject(LocationsPageState);
  private readonly flow = inject(LocationsPageFlow);

  readonly title = 'Locations';
  readonly subtitle =
    'Areas students visited when they scanned a QR or marked present.';

  /** Row opened in the shared detail dialog. */
  readonly selectedVisit = signal<LocationVisit | null>(null);

  readonly visitColumns: TableColumn<LocationVisit>[] = [
    {
      key: 'student',
      header: 'Student',
      type: 'primary',
      width: 'minmax(7rem, 0.85fr)',
      primary: (row) => ({
        title: row.student,
        subtitle: row.studentId,
      }),
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
      value: (row) => formatCampusLocationLabel(row.building, row.room),
    },
    {
      key: 'building',
      header: 'Building',
      width: 'minmax(0, 0.5fr)',
      value: (row) => row.building,
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
      key: 'recorded',
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
  ];

  ngOnInit(): void {
    void this.flow.load();
  }

  onFilterApply(filters: LocationFilterState): void {
    void this.flow.applyFilters(filters);
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

  distanceLabel(visit: LocationVisit): string {
    return formatDistanceMeters(visit.distanceMeters);
  }

  recordedLabel(visit: LocationVisit): string {
    return formatAttendanceDateTimeLabel(visit.recordedAt);
  }

  statusClass(status: string): string {
    return `record-detail__badge record-detail__badge--${status.toLowerCase().replace(/\s+/g, '-')}`;
  }
}
