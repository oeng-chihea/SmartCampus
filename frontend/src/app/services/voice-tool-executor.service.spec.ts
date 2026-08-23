import { describe, expect, it } from 'vitest';
import { APP_ROUTES } from '../core/constants/app-routes';

describe('voice tool routes', () => {
  it('maps campus pages to existing admin paths', () => {
    expect(`/${APP_ROUTES.dashboard}`).toBe('/dashboard');
    expect(`/${APP_ROUTES.attendance}`).toBe('/attendance');
    expect(`/${APP_ROUTES.locations}`).toBe('/locations');
    expect(`/${APP_ROUTES.sessions}`).toBe('/sessions');
    expect(`/${APP_ROUTES.students}`).toBe('/students');
    expect(`/${APP_ROUTES.reports}`).toBe('/reports');
  });
});
