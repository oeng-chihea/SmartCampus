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
  it('plots Present and Absent attendance status without location mix-in', () => {
    expect(template).toContain('12-month attendance status');
    expect(template).toContain('<dt>Present</dt>');
    expect(template).toContain('<dt>Absent</dt>');
    expect(template).toContain('chart__legend--absent');
    expect(template).toContain('presentLinePath()');
    expect(template).toContain('absentLinePath()');
    expect(component).toContain('toCurvePath');
    expect(template).not.toContain('<dt>Outside</dt>');
    expect(template).not.toContain('<dt>Inside</dt>');
    expect(template).not.toContain('<dt>Late</dt>');
    expect(component).toContain('monthsWithRecords');
    expect(component).toContain('row.present + row.absent > 0');
    expect(component).not.toContain('outsideLocation');
  });

  it('sizes the plot from the live container so month labels stay in one row', () => {
    expect(component).toContain('ResizeObserver');
    expect(template).toContain('chart__viewport');
    expect(styles).toContain('repeat(12, minmax(0, 1fr))');
    expect(styles).not.toContain('repeat(6,');
  });

  it('keeps the hover tooltip inside the plot instead of clipping peaks', () => {
    expect(component).toContain('buildChartTooltipStyle');
    expect(template).toContain('chart__tooltip--below');
    expect(styles).toContain('overflow: visible');
  });
});
