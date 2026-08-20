import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  join(__dirname, 'attendance-filter.component.html'),
  'utf8',
);

describe('AttendanceFilter template', () => {
  it('filters Status as inside/outside and Attendance status as present/absent', () => {
    expect(template).toContain('>Status<');
    expect(template).toContain('>Attendance status<');
    expect(template).toContain('filters().statusOptions');
    expect(template).toContain('filters().attendanceStatusOptions');
    expect(template).toContain('onStatusChange');
    expect(template).toContain('onAttendanceStatusChange');
    expect(template).not.toContain('Apply');
  });
});
