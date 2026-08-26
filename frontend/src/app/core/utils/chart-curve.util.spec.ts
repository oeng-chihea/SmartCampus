import { describe, expect, it } from 'vitest';
import { toAreaPath, toCurvePath } from './chart-curve.util';

describe('toCurvePath', () => {
  it('returns an empty path when there are no points', () => {
    expect(toCurvePath([])).toBe('');
  });

  it('moves to a single point without drawing a segment', () => {
    expect(toCurvePath([{ x: 10, y: 20 }])).toBe('M 10.0 20.0');
  });

  it('draws cubic curves instead of sharp line segments', () => {
    const path = toCurvePath([
      { x: 0, y: 40 },
      { x: 10, y: 10 },
      { x: 20, y: 40 },
    ]);
    expect(path.startsWith('M 0.0 40.0')).toBe(true);
    expect(path).toContain(' C ');
    expect(path).not.toMatch(/\sL /);
  });

  it('keeps a flat series on one y so the baseline stays clean', () => {
    const path = toCurvePath([
      { x: 0, y: 50 },
      { x: 10, y: 50 },
      { x: 20, y: 50 },
      { x: 30, y: 50 },
    ]);
    const numbers = path.match(/-?\d+\.\d+/g) ?? [];
    const ys = numbers.filter((_, index) => index % 2 === 1);
    expect(ys.length).toBeGreaterThan(0);
    expect(ys.every((value) => value === '50.0')).toBe(true);
  });
});

describe('toAreaPath', () => {
  it('closes the smooth line down to the baseline', () => {
    const path = toAreaPath(
      [
        { x: 0, y: 20 },
        { x: 10, y: 8 },
        { x: 20, y: 20 },
      ],
      40,
    );
    expect(path).toContain(' C ');
    expect(path.endsWith('L 20.0 40.0 L 0.0 40.0 Z')).toBe(true);
  });
});
