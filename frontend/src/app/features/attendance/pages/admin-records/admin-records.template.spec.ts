import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'admin-records.component.html'), 'utf8');
const component = readFileSync(join(__dirname, 'admin-records.component.ts'), 'utf8');
const styles = readFileSync(join(__dirname, 'admin-records.component.scss'), 'utf8');

describe('AdminRecords template', () => {
  it('shows the complete attendance record inside each session group', () => {
    for (const column of [
      'Student',
      'Session',
      'Location',
      'Scanned at',
      'Time',
      'Distance',
      'Status',
      'Attendance status',
    ]) {
      expect(template).toContain(`>${column}</th>`);
    }
    expect(template).toContain('{{ record.session }}');
    expect(template).toContain('{{ record.location }}');
    expect(template).toContain('{{ record.attendanceStatus }}');
    expect(template).not.toContain('Individual records');
  });

  it('wires Export to the attendance Excel API flow', () => {
    expect(template).toContain('(click)="onExport()"');
    expect(template).toContain('[disabled]="state.exporting()"');
  });

  it('shows recorded GPS accuracy and keeps only the scan map', () => {
    expect(component).toContain('record.accuracyMeters');
    expect(component).toContain('toDeviceCoordinates');
    expect(component).toContain('ScanMapComponent');
    expect(template).toContain('<dt>Accuracy</dt>');
    expect(template).toContain('{{ accuracyLabel(record) }}');
    expect(template).toContain('<section class="record-detail__map"');
    expect(template).toContain(
      '<app-scan-map class="scan-map--borderless" [device]="device" />',
    );
    expect(template).not.toContain('record-detail__map-copy');
    expect(styles).not.toContain('.record-detail__map-copy');
  });

  it('keeps the attendance detail dialog free of internal divider lines', () => {
    expect(template).toContain('<app-scan-map class="scan-map--borderless" [device]="device" />');
    expect(styles).not.toContain('border-top: 1px solid var(--border-subtle);');
  });

  it('links the scanned place to its exact GPS point without showing raw coordinates', () => {
    expect(template).not.toContain('<dt>Coordinates</dt>');
    expect(template).toContain('@if (googleMapsUrl(record); as mapsUrl)');
    expect(template).toContain('View on Google Maps');
    expect(template).toContain('target="_blank"');
    expect(template).toContain('rel="noopener noreferrer"');
    expect(component).toContain('buildGoogleMapsUrl');
  });
});
