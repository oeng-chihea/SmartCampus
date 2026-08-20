import { describe, expect, it } from 'vitest';
import { computeActionMenuPosition } from './action-menu-position.util';

const panel = { width: 160, height: 120 };
const viewport = { width: 800, height: 600 };

function triggerAt(x: number, y: number, size = 32) {
  return {
    top: y,
    left: x,
    width: size,
    height: size,
    right: x + size,
    bottom: y + size,
  };
}

describe('computeActionMenuPosition', () => {
  it('opens below and right-aligns with the ⋮ trigger', () => {
    const placed = computeActionMenuPosition(triggerAt(600, 80), panel, viewport);

    expect(placed.openUpward).toBe(false);
    expect(placed.top).toBe(80 + 32 + 4);
    expect(placed.left).toBe(632 - 160);
  });

  it('flips above when the trigger sits near the bottom of the viewport', () => {
    const placed = computeActionMenuPosition(triggerAt(600, 520), panel, viewport);

    expect(placed.openUpward).toBe(true);
    expect(placed.top).toBe(520 - 120 - 4);
  });

  it('keeps the panel on-screen when the trigger is on a narrow right edge', () => {
    const narrow = { width: 360, height: 640 };
    const placed = computeActionMenuPosition(
      triggerAt(328, 200),
      panel,
      narrow,
    );

    expect(placed.left).toBeGreaterThanOrEqual(8);
    expect(placed.left + panel.width).toBeLessThanOrEqual(narrow.width - 8);
  });

  it('clamps vertically so a tall panel is not pushed off the top', () => {
    const placed = computeActionMenuPosition(
      triggerAt(40, 4),
      { width: 160, height: 280 },
      { width: 360, height: 300 },
      { preferUp: true },
    );

    expect(placed.top).toBeGreaterThanOrEqual(8);
  });
});
