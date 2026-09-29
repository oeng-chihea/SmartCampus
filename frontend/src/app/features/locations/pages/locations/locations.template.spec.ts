import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'locations.component.html'), 'utf8');
const component = readFileSync(join(__dirname, 'locations.component.ts'), 'utf8');
const styles = readFileSync(join(__dirname, 'locations.component.scss'), 'utf8');

describe('Locations template', () => {
  it('wires Export to the location visits Excel API flow', () => {
    expect(template).toContain('(exportClick)="onExport()"');
    expect(template).toContain('[exporting]="state.exporting()"');
    expect(template).toContain('[showExport]="true"');
  });

  it('shows recorded GPS accuracy and keeps only the scan map', () => {
    expect(component).toContain('row.accuracyMeters');
    expect(component).toContain('toDeviceCoordinates');
    expect(component).toContain('ScanMapComponent');
    expect(template).toContain('<dt>Accuracy</dt>');
    expect(template).toContain('{{ accuracyLabel(visit) }}');
    expect(template).toContain('<section class="record-detail__map"');
    expect(template).toContain(
      '<app-scan-map class="scan-map--borderless" [device]="device" />',
    );
    expect(template).not.toContain('record-detail__map-copy');
    expect(styles).not.toContain('.record-detail__map-copy');
  });

  it('keeps the location detail dialog free of internal divider lines', () => {
    expect(template).toContain('<app-scan-map class="scan-map--borderless" [device]="device" />');
    expect(styles).not.toContain('border-top: 1px solid var(--border-subtle);');
  });
});
