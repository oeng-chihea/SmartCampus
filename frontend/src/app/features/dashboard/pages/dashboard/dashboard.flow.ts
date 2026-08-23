import { Injectable, inject } from '@angular/core';
import { DashboardService } from '../../../../services/dashboard.service';
import { DashboardState } from './dashboard.state';

/**
 * Dashboard flow — API calls + orchestration.
 * Reads/writes `DashboardState`; does not own signals itself.
 */
@Injectable()
export class DashboardFlow {
  private readonly state = inject(DashboardState);
  private readonly dashboardService = inject(DashboardService);

  async load(): Promise<void> {
    this.state.beginLoad();
    try {
      this.state.applyDashboard(await this.dashboardService.fetchAdminDashboard());
    } catch (error) {
      this.state.setPageError(
        this.dashboardService.mapError(
          error,
          'Failed to load the dashboard from the API.',
        ),
      );
    } finally {
      this.state.endLoad();
    }
  }
}
