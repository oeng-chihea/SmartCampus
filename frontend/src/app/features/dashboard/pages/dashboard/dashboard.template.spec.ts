import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'dashboard.component.html'), 'utf8');
const component = readFileSync(join(__dirname, 'dashboard.component.ts'), 'utf8');

describe('Dashboard template', () => {
  it('loads live dashboard state without the Quick lookup card', () => {
    expect(component).toContain('DashboardState');
    expect(component).toContain('DashboardFlow');
    expect(component).not.toContain('QuickLookupComponent');
    expect(template).not.toContain('app-quick-lookup');
    expect(template).toContain('[scans]="state.recentScans()"');
    expect(template).toContain('[monthlyTrend]="state.monthlyTrend()"');
    expect(template).toContain('[reviewAllHref]="attendancePath"');
  });
});
