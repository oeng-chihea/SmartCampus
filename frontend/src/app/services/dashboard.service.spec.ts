import { describe, expect, it } from 'vitest';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('provides admin dashboard data for SmartCampus attendance overview', () => {
    const service = new DashboardService();
    const dashboard = service.getAdminDashboard();

    expect(dashboard.title).toBe('SmartCampus Attendance System');
    expect(dashboard.summaryCards).toHaveLength(4);
    expect(dashboard.summaryCards.every((card) => Boolean(card.icon))).toBe(true);
    expect(dashboard.monthlyTrend).toHaveLength(12);
    expect(dashboard.monthlyTrend[0].month).toBe('Jan');
    expect(dashboard.monthlyTrend[11].month).toBe('Dec');
    expect(dashboard.recentScans.length).toBeGreaterThanOrEqual(8);
    expect(dashboard.recentScans[0].studentId).toBeTruthy();
    expect(dashboard.recentScans[0].location).toBeTruthy();
    expect(dashboard.quickFilter.statusOptions).toContain('Present');
    expect(dashboard.quickFilter.statusOptions).toContain('Outside Location');
  });
});
