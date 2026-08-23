import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  join(__dirname, 'recent-scan-list.component.html'),
  'utf8',
);

describe('RecentScanList template', () => {
  it('links Review all to the attendance records page', () => {
    expect(template).toContain('[routerLink]="reviewAllHref()"');
    expect(template).toContain('Review all');
    expect(template).toContain('loading()');
    expect(template).toContain('emptyTitle()');
  });
});
