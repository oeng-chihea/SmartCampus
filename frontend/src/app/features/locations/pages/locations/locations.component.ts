import { Component, OnInit, inject } from '@angular/core';
import { formatSessionOpened } from '../../../../core/utils/date.util';
import {
  formatCampusLocationLabel,
  formatScannedAtCell,
} from '../../../../core/utils/format.util';
import {
  LocationFilterState,
  LocationVisit,
} from '../../../../models/location.model';
import { LocationFilterComponent } from '../../../../shared/components/location-filter/location-filter.component';
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
  imports: [StatCardComponent, LocationFilterComponent, TableComponent],
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

  readonly visitColumns: TableColumn<LocationVisit>[] = [
    {
      key: 'student',
      header: 'Student',
      type: 'primary',
      width: 'minmax(0, 1.3fr)',
      primary: (row) => ({
        title: row.student,
        subtitle: row.studentId,
      }),
    },
    {
      key: 'session',
      header: 'Session',
      width: 'minmax(0, 1.1fr)',
      value: (row) => row.session,
    },
    {
      key: 'location',
      header: 'Location',
      width: 'minmax(0, 1.1fr)',
      value: (row) => formatCampusLocationLabel(row.building, row.room),
    },
    {
      key: 'building',
      header: 'Building',
      width: 'minmax(72px, 0.7fr)',
      value: (row) => row.building,
    },
    {
      key: 'scannedAt',
      header: 'Scanned at',
      type: 'primary',
      width: 'minmax(0, 1.4fr)',
      primary: (row) =>
        formatScannedAtCell(row.scannedLocation, row.latitude, row.longitude),
    },
    {
      key: 'distance',
      header: 'Distance',
      width: 'minmax(72px, 0.55fr)',
      value: (row) =>
        row.distanceMeters == null ? '—' : `${row.distanceMeters} m`,
    },
    {
      key: 'status',
      header: 'Status',
      type: 'badge',
      // Wider track + left edge so the badge sits under STATUS, away from Recorded.
      width: 'minmax(9.5rem, 0.75fr)',
      align: 'start',
      value: (row) => row.status,
      badgeVariant: (row) => row.status.toLowerCase().replace(/\s+/g, '-'),
    },
    {
      key: 'recorded',
      header: 'Recorded',
      width: 'minmax(7.5rem, 0.8fr)',
      value: (row) => formatSessionOpened(row.recordedAt),
    },
  ];

  ngOnInit(): void {
    void this.flow.load();
  }

  onFilterApply(filters: LocationFilterState): void {
    void this.flow.applyFilters(filters);
  }
}
