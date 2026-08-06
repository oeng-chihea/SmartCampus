import { Component, computed, signal } from '@angular/core';
import {
  CampusLocation,
  LocationDetail,
  LocationFilterState,
} from '../../../../models/location.model';
import { LocationService } from '../../../../services/location.service';
import { LocationDetailDialogComponent } from '../../../../shared/components/location-detail-dialog/location-detail-dialog.component';
import { LocationFilterComponent } from '../../../../shared/components/location-filter/location-filter.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { TableColumn } from '../../../../shared/components/table/table.model';

@Component({
  selector: 'app-locations',
  imports: [
    StatCardComponent,
    LocationFilterComponent,
    TableComponent,
    LocationDetailDialogComponent,
  ],
  templateUrl: './locations.component.html',
  styleUrl: './locations.component.scss',
})
export class LocationsComponent {
  private readonly locationService = new LocationService();
  private readonly pageData = this.locationService.getLocationManagement();
  private readonly filterState = signal<LocationFilterState>({
    search: '',
    building: 'All buildings',
    status: 'All statuses',
  });

  readonly page = this.pageData;
  readonly selectedDetail = signal<LocationDetail | null>(null);

  readonly filteredLocations = computed(() =>
    this.locationService.filterLocations(this.pageData.locations, this.filterState()),
  );

  /** Location directory columns (titles owned by this page). */
  readonly locationColumns: TableColumn<CampusLocation>[] = [
    {
      key: 'location',
      header: 'Location',
      type: 'primary',
      width: 'minmax(0, 1.5fr)',
      primary: (row) => ({ title: row.name, subtitle: row.id }),
    },
    {
      key: 'building',
      header: 'Building',
      width: 'minmax(90px, 0.85fr)',
      value: (row) => row.building,
    },
    {
      key: 'room',
      header: 'Room',
      width: 'minmax(56px, 0.4fr)',
      value: (row) => row.room,
    },
    {
      key: 'radius',
      header: 'Radius',
      width: 'minmax(64px, 0.4fr)',
      value: (row) => `${row.radiusMeters} m`,
    },
    {
      key: 'coordinates',
      header: 'Coordinates',
      width: 'minmax(110px, 0.9fr)',
      value: (row) => `${row.latitude.toFixed(4)}, ${row.longitude.toFixed(4)}`,
    },
    {
      key: 'status',
      header: 'Status',
      type: 'badge',
      width: 'minmax(72px, 0.45fr)',
      value: (row) => row.status,
      badgeVariant: (row) => row.status.toLowerCase(),
    },
    {
      key: 'sessions',
      header: 'Sessions',
      width: 'minmax(64px, 0.4fr)',
      value: (row) => row.sessionsUsing,
    },
  ];

  onFilterApply(filters: LocationFilterState): void {
    this.filterState.set(filters);
  }

  onLocationSelect(location: CampusLocation): void {
    this.selectedDetail.set(this.locationService.getLocationDetail(location));
  }

  onDetailClose(): void {
    this.selectedDetail.set(null);
  }
}
