import { Component } from '@angular/core';
import { AttendanceChartComponent } from '../../../../shared/components/attendance-chart/attendance-chart.component';
import { QuickLookupComponent } from '../../../../shared/components/quick-lookup/quick-lookup.component';
import { RecentScanListComponent } from '../../../../shared/components/recent-scan-list/recent-scan-list.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { DashboardService } from '../../../../services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [AttendanceChartComponent, QuickLookupComponent, RecentScanListComponent, StatCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly dashboardService = new DashboardService();

  readonly dashboard = this.dashboardService.getAdminDashboard();
}
