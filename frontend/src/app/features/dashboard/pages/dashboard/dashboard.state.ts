import { Injectable, signal } from '@angular/core';
import {
  AdminDashboard,
  MonthlyAttendancePoint,
  RecentScan,
} from '../../../../models/dashboard.model';
import { StatCard } from '../../../../shared/components/stat-card/stat-card.model';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function emptyTrend(): MonthlyAttendancePoint[] {
  return MONTHS.map((month) => ({
    month,
    presentRate: 0,
    present: 0,
    absent: 0,
    outsideLocation: 0,
  }));
}

/**
 * Dashboard page state only — signals. No HTTP.
 * Orchestration belongs in `dashboard.flow.ts`.
 */
@Injectable()
export class DashboardState {
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly title = signal('SmartCampus Attendance System');
  readonly subtitle = signal(
    'Live view of identity-verified scans, time stamps, location checks, and attendance status.',
  );
  readonly summaryCards = signal<StatCard[]>([]);
  readonly monthlyTrend = signal<MonthlyAttendancePoint[]>(emptyTrend());
  readonly trendYear = signal(new Date().getFullYear());
  readonly recentScans = signal<RecentScan[]>([]);

  beginLoad(): void {
    this.loading.set(true);
    this.error.set(null);
  }

  endLoad(): void {
    this.loading.set(false);
  }

  applyDashboard(page: AdminDashboard): void {
    this.title.set(page.title);
    this.subtitle.set(page.subtitle);
    this.summaryCards.set(page.summaryCards);
    this.monthlyTrend.set(page.monthlyTrend);
    this.trendYear.set(page.trendYear);
    this.recentScans.set(page.recentScans);
  }

  setPageError(message: string): void {
    this.error.set(message);
  }
}
