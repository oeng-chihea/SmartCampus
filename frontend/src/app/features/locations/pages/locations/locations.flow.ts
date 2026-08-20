import { Injectable, inject } from '@angular/core';
import { messageFromHttpError } from '../../../../core/utils/http-error.util';
import { LocationFilterState } from '../../../../models/location.model';
import { LocationService } from '../../../../services/location.service';
import { LocationsPageState } from './locations.state';

/**
 * Locations page flow — API calls + orchestration.
 * Reads/writes `LocationsPageState`; does not own signals itself.
 */
@Injectable()
export class LocationsPageFlow {
  private readonly state = inject(LocationsPageState);
  private readonly locationService = inject(LocationService);

  async load(): Promise<void> {
    await this.fetchVisits();
  }

  async applyFilters(filters: LocationFilterState): Promise<void> {
    this.state.setFilters(filters);
    await this.fetchVisits();
  }

  async exportExcel(): Promise<void> {
    if (this.state.exporting()) {
      return;
    }
    this.state.beginExport();
    try {
      await this.locationService.exportVisitsExcel(this.state.getFilters());
    } catch (error) {
      this.state.setPageError(
        await messageFromHttpError(
          error,
          'Could not export location visits. Try again.',
        ),
      );
    } finally {
      this.state.endExport();
    }
  }

  private async fetchVisits(): Promise<void> {
    this.state.beginLoad();
    try {
      this.state.applyResponse(
        await this.locationService.queryVisits(this.state.getFilters()),
      );
    } catch (error) {
      this.state.setPageError(
        this.locationService.mapError(
          error,
          'Failed to load student location visits from the API.',
        ),
      );
    } finally {
      this.state.endLoad();
    }
  }
}
