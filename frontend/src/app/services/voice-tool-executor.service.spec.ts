import { describe, expect, it } from 'vitest';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { APP_ROUTES } from '../core/constants/app-routes';

describe('voice tool routes', () => {
  it('maps campus pages to existing admin paths and campus record reads', () => {
    expect(`/${APP_ROUTES.dashboard}`).toBe('/dashboard');
    expect(`/${APP_ROUTES.attendance}`).toBe('/attendance');
    expect(`/${APP_ROUTES.locations}`).toBe('/locations');
    expect(`/${APP_ROUTES.sessions}`).toBe('/sessions');
    expect(`/${APP_ROUTES.students}`).toBe('/students');
    expect(`/${APP_ROUTES.studentScan}`).toBe('/student/scan');
    expect(API_ENDPOINTS.aiCampusRecords).toBe('/ai/campus-records');
  });
});
