import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'admin-records.component.html'), 'utf8');
const component = readFileSync(join(__dirname, 'admin-records.component.ts'), 'utf8');

describe('AdminRecords template', () => {
  it('names the attendance status column and detail field', () => {
    expect(component).toContain("header: 'Attendance status'");
    expect(component).toContain("key: 'attendanceStatus'");
    expect(template).toContain('Attendance status');
    expect(template).toContain('record.attendanceStatus');
  });

  it('wires Export to the attendance Excel API flow', () => {
    expect(template).toContain('(exportClick)="onExport()"');
    expect(template).toContain('[exporting]="state.exporting()"');
  });

  it('does not show GPS accuracy on the scanned-at column or detail dialog', () => {
    expect(component).not.toContain('row.accuracyMeters');
    expect(component).not.toContain('accuracyLabel');
    expect(template).not.toContain('<dt>Accuracy</dt>');
  });
});
