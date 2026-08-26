export interface ChartCurvePoint {
  x: number;
  y: number;
}

/** Cubic Bézier path through every point, without overshooting plateaus. */
export function toCurvePath(points: ChartCurvePoint[]): string {
  if (!points.length) {
    return '';
  }
  if (points.length === 1) {
    return `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  }

  const tangents = monotoneTangents(points);
  let path = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;

  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index];
    const end = points[index + 1];
    const dx = (end.x - start.x) / 3;
    path += ` C ${fmt(start.x + dx)} ${fmt(start.y + tangents[index] * dx)} ${fmt(end.x - dx)} ${fmt(end.y - tangents[index + 1] * dx)} ${fmt(end.x)} ${fmt(end.y)}`;
  }

  return path;
}

export function toAreaPath(points: ChartCurvePoint[], baselineY: number): string {
  if (!points.length) {
    return '';
  }
  const curve = toCurvePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${curve} L ${fmt(last.x)} ${fmt(baselineY)} L ${fmt(first.x)} ${fmt(baselineY)} Z`;
}

function monotoneTangents(points: ChartCurvePoint[]): number[] {
  const last = points.length - 1;
  const slopes = points.slice(0, last).map((point, index) => {
    const dx = points[index + 1].x - point.x;
    return dx === 0 ? 0 : (points[index + 1].y - point.y) / dx;
  });

  const tangents = points.map((_, index) => {
    if (index === 0) {
      return slopes[0] ?? 0;
    }
    if (index === last) {
      return slopes[last - 1] ?? 0;
    }
    if (slopes[index - 1] * slopes[index] <= 0) {
      return 0;
    }
    return (slopes[index - 1] + slopes[index]) / 2;
  });

  for (let index = 0; index < last; index++) {
    if (slopes[index] === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }

    const alpha = tangents[index] / slopes[index];
    const beta = tangents[index + 1] / slopes[index];
    const length = alpha * alpha + beta * beta;
    if (length > 9) {
      const scale = 3 / Math.sqrt(length);
      tangents[index] = scale * alpha * slopes[index];
      tangents[index + 1] = scale * beta * slopes[index];
    }
  }

  return tangents;
}

function fmt(value: number): string {
  return value.toFixed(1);
}
