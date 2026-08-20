import { Injectable, computed, signal } from '@angular/core';
import {
  LocationFilterState,
  LocationFilters,
  LocationVisit,
  LocationVisitMetrics,
  LocationVisitPage,
} from '../../../../models/location.model';
import { SelectOption } from '../../../../shared/components/select-dropdown/select-dropdown.model';
import { StatCard } from '../../../../shared/components/stat-card/stat-card.model';

const ALL_BUILDINGS: SelectOption = {
  value: 'All buildings',
  label: 'All buildings',
};
const ALL_STATUSES: SelectOption = {
  value: 'All statuses',
  label: 'All statuses',
};

const DEFAULT_FILTERS: LocationFilterState = {
  search: '',
  building: ALL_BUILDINGS.value,
  status: ALL_STATUSES.value,
};

const EMPTY_FILTERS: LocationFilters = {
  searchPlaceholder: 'Search student, location name, ID, or room',
  buildingOptions: [ALL_BUILDINGS],
  statusOptions: [
    ALL_STATUSES,
    { value: 'Present', label: 'Present' },
    { value: 'Outside Location', label: 'Outside Location' },
  ],
};

function toSelectOptions(values: string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }));
}

/**
 * Locations page state only — signals, filters, derived values.
 * No HTTP. Orchestration belongs in `locations.flow.ts`.
 */
@Injectable()
export class LocationsPageState {
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);

  readonly visits = signal<LocationVisit[]>([]);

  private readonly filterState = signal<LocationFilterState>(DEFAULT_FILTERS);
  private readonly apiBuildingOptions = signal<string[]>([]);
  private readonly apiStatusOptions = signal<string[]>([
    'Present',
    'Outside Location',
  ]);
  private readonly visitMetrics = signal<LocationVisitMetrics>({
    total: 0,
    present: 0,
    outsideLocation: 0,
  });

  readonly metrics = computed<StatCard[]>(() =>
    this.buildMetrics(this.visitMetrics()),
  );

  readonly filterOptions = computed<LocationFilters>(() => {
    const buildings = this.apiBuildingOptions();
    const statuses = this.apiStatusOptions();
    if (buildings.length === 0 && statuses.length === 0) {
      return EMPTY_FILTERS;
    }
    return {
      searchPlaceholder: EMPTY_FILTERS.searchPlaceholder,
      buildingOptions: [ALL_BUILDINGS, ...toSelectOptions(buildings)],
      statusOptions: [
        ALL_STATUSES,
        ...(statuses.length > 0
          ? toSelectOptions(statuses)
          : EMPTY_FILTERS.statusOptions.slice(1)),
      ],
    };
  });

  readonly hasActiveFilters = computed(() => {
    const filters = this.filterState();
    return (
      Boolean(filters.search.trim()) ||
      filters.building !== 'All buildings' ||
      filters.status !== 'All statuses'
    );
  });

  getFilters(): LocationFilterState {
    return this.filterState();
  }

  beginLoad(): void {
    this.loading.set(true);
    this.error.set(null);
  }

  endLoad(): void {
    this.loading.set(false);
  }

  beginExport(): void {
    this.exporting.set(true);
    this.error.set(null);
  }

  endExport(): void {
    this.exporting.set(false);
  }

  setPageError(message: string | null): void {
    this.error.set(message);
  }

  setFilters(filters: LocationFilterState): void {
    this.filterState.set(filters);
  }

  applyResponse(page: LocationVisitPage): void {
    this.visits.set(page.visits);
    this.visitMetrics.set(page.metrics);
    this.apiBuildingOptions.set(page.buildingOptions);
    this.apiStatusOptions.set(page.statusOptions);
  }

  private buildMetrics(metrics: LocationVisitMetrics): StatCard[] {
    return [
      {
        label: 'Total visits',
        value: String(metrics.total),
        helper: 'Student scans and mark-present records',
        icon: 'locations',
        tone: 'green',
      },
      {
        label: 'Present',
        value: String(metrics.present),
        helper: 'Inside the session geofence',
        icon: 'present',
        tone: 'blue',
      },
      {
        label: 'Outside location',
        value: String(metrics.outsideLocation),
        helper: 'Recorded outside the session radius',
        icon: 'attendance',
        tone: 'violet',
      },
    ];
  }
}
