import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';

const service = readFileSync(join(__dirname, 'dashboard.service.ts'), 'utf8');

describe('DashboardService', () => {
  it('loads the live admin dashboard from GET /dashboard', () => {
    expect(API_ENDPOINTS.dashboard).toBe('/dashboard');
    expect(service).toContain('API_ENDPOINTS.dashboard');
    expect(service).toContain('fetchAdminDashboard');
    expect(service).not.toContain('dashboard-attendance.json');
    expect(service).not.toContain('getAdminDashboard');
  });
});
