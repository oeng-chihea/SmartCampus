import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'locations.component.html'), 'utf8');
const component = readFileSync(join(__dirname, 'locations.component.ts'), 'utf8');

describe('Locations template', () => {
  it('wires Export to the location visits Excel API flow', () => {
    expect(template).toContain('(exportClick)="onExport()"');
    expect(template).toContain('[exporting]="state.exporting()"');
    expect(template).toContain('[showExport]="true"');
  });

  it('does not show GPS accuracy on the scanned-at column or detail dialog', () => {
    expect(component).not.toContain('row.accuracyMeters');
    expect(component).not.toContain('accuracyLabel');
    expect(template).not.toContain('<dt>Accuracy</dt>');
  });
});
