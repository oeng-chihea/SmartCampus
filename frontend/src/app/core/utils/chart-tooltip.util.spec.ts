import { describe, expect, it } from 'vitest';
import { buildChartTooltipStyle } from './chart-tooltip.util';

const layout = { width: 800, height: 220 };

describe('buildChartTooltipStyle', () => {
  it('keeps a mid-chart point above and to the right of the marker', () => {
    const style = buildChartTooltipStyle({ x: 400, y: 140 }, layout);

    expect(style.below).toBe(false);
    expect(style.left).toBe('50%');
    expect(style.transform).toBe('translate(8px, calc(-100% - 12px))');
  });

  it('flips below a peak so the header is not clipped', () => {
    const style = buildChartTooltipStyle({ x: 513, y: 16 }, layout);

    expect(style.below).toBe(true);
    expect(style.transform).toBe('translate(8px, 14px)');
  });

  it('flips left near the right edge so December stays inside the card', () => {
    const style = buildChartTooltipStyle({ x: 784, y: 140 }, layout);

    expect(style.left).toBe('98%');
    expect(style.below).toBe(false);
    expect(style.transform).toBe('translate(calc(-100% - 8px), calc(-100% - 12px))');
  });
});
