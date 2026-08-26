export interface ChartTooltipPoint {
  x: number;
  y: number;
}

export interface ChartTooltipLayout {
  width: number;
  height: number;
}

export interface ChartTooltipStyle {
  left: string;
  top: string;
  transform: string;
  below: boolean;
}

const FLIP_X_PERCENT = 72;
/** Header + stats + padding + gap — enough to keep the box inside the plot. */
const TOP_CLEARANCE_PX = 108;

/**
 * Places the hover tooltip next to a month point without clipping the plot.
 * Flips below a peak and to the left of the right edge.
 */
export function buildChartTooltipStyle(
  point: ChartTooltipPoint,
  layout: ChartTooltipLayout,
): ChartTooltipStyle {
  const width = Math.max(layout.width, 1);
  const height = Math.max(layout.height, 1);
  const left = (point.x / width) * 100;
  const top = (point.y / height) * 100;
  const flipX = left > FLIP_X_PERCENT;
  const below = point.y < TOP_CLEARANCE_PX;

  return {
    left: `${left}%`,
    top: `${top}%`,
    transform: `translate(${flipX ? 'calc(-100% - 8px)' : '8px'}, ${
      below ? '14px' : 'calc(-100% - 12px)'
    })`,
    below,
  };
}
