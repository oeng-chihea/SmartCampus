import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  join(__dirname, 'attendance-chart.component.html'),
  'utf8',
);
const component = readFileSync(
  join(__dirname, 'attendance-chart.component.ts'),
  'utf8',
);
const styles = readFileSync(
  join(__dirname, 'attendance-chart.component.scss'),
  'utf8',
);

describe('AttendanceChart template', () => {
  it('shows attendance rate without the retired Late breakdown', () => {
    expect(template).toContain('Attendance rate %');
    expect(template).toContain('<dt>Present</dt>');
    expect(template).toContain('<dt>Absent</dt>');
    expect(template).toContain('<dt>Outside</dt>');
    expect(template).not.toContain('<dt>Late</dt>');
    expect(component).toContain('monthsWithRecords');
  });

  it('sizes the plot from the live container so month labels stay in one row', () => {
    expect(component).toContain('ResizeObserver');
    expect(template).toContain('chart__viewport');
    expect(styles).toContain('repeat(12, minmax(0, 1fr))');
    expect(styles).not.toContain('repeat(6,');
  });
});
