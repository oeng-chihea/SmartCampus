import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  join(__dirname, 'location-filter.component.html'),
  'utf8',
);

describe('LocationFilter template', () => {
  it('applies Building and Status immediately and has no Apply button', () => {
    expect(template).toContain('>Building<');
    expect(template).toContain('>Status<');
    expect(template).toContain('filters().buildingOptions');
    expect(template).toContain('filters().statusOptions');
    expect(template).toContain('onBuildingChange');
    expect(template).toContain('onStatusChange');
    expect(template).toContain('onSearchChange');
    expect(template).not.toContain('Apply');
    expect(template).not.toContain('type="submit"');
  });
});
