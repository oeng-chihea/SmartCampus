import { Component, computed, input, signal } from '@angular/core';
import { MonthlyAttendancePoint } from '../../../services/dashboard.service';

/** Fixed SVG coordinate system for the monthly chart */
const LAYOUT = {
  width: 640,
  height: 240,
  padLeft: 40,
  padRight: 16,
  padTop: 24,
  padBottom: 28,
} as const;

export interface ChartPoint extends MonthlyAttendancePoint {
  index: number;
  x: number;
  y: number;
}

@Component({
  selector: 'app-attendance-chart',
  templateUrl: './attendance-chart.component.html',
  styleUrl: './attendance-chart.component.scss',
})
export class AttendanceChartComponent {
  readonly monthlyTrend = input.required<MonthlyAttendancePoint[]>();
  readonly year = input(2026);

  /** Hovered month index; null when pointer leaves the chart */
  readonly activeIndex = signal<number | null>(null);

  readonly plotWidth = LAYOUT.width - LAYOUT.padLeft - LAYOUT.padRight;
  readonly plotHeight = LAYOUT.height - LAYOUT.padTop - LAYOUT.padBottom;
  readonly viewBox = `0 0 ${LAYOUT.width} ${LAYOUT.height}`;
  readonly baselineY = LAYOUT.padTop + this.plotHeight;

  readonly points = computed<ChartPoint[]>(() => {
    const data = this.monthlyTrend();
    if (!data.length) {
      return [];
    }

    const last = Math.max(data.length - 1, 1);

    return data.map((item, index) => {
      const rate = clamp(item.presentRate, 0, 100);
      return {
        ...item,
        index,
        x: LAYOUT.padLeft + (index / last) * this.plotWidth,
        y: LAYOUT.padTop + (1 - rate / 100) * this.plotHeight,
      };
    });
  });

  readonly linePath = computed(() => toLinePath(this.points()));
  readonly areaPath = computed(() => toAreaPath(this.points(), this.baselineY));

  readonly yTicks = [100, 75, 50, 25].map((rate) => ({
    rate,
    y: LAYOUT.padTop + (1 - rate / 100) * this.plotHeight,
  }));

  readonly avgRate = computed(() => {
    const data = this.monthlyTrend();
    if (!data.length) {
      return 0;
    }
    const total = data.reduce((sum, row) => sum + row.presentRate, 0);
    return Math.round(total / data.length);
  });

  readonly peakMonth = computed(() => {
    const data = this.monthlyTrend();
    if (!data.length) {
      return '—';
    }
    return data.reduce((best, row) => (row.presentRate > best.presentRate ? row : best)).month;
  });

  readonly activePoint = computed(() => {
    const index = this.activeIndex();
    if (index === null) {
      return null;
    }
    return this.points()[index] ?? null;
  });

  /** Tooltip position as % of the plot box (for HTML overlay) */
  readonly tooltipStyle = computed(() => {
    const point = this.activePoint();
    if (!point) {
      return null;
    }

    const left = (point.x / LAYOUT.width) * 100;
    const top = (point.y / LAYOUT.height) * 100;
    const flip = left > 72;

    return {
      left: `${left}%`,
      top: `${top}%`,
      transform: flip
        ? 'translate(-100%, calc(-100% - 12px))'
        : 'translate(8px, calc(-100% - 12px))',
    };
  });

  readonly guideX = computed(() => this.activePoint()?.x ?? null);

  showMonth(index: number): void {
    this.activeIndex.set(index);
  }

  hideMonth(): void {
    this.activeIndex.set(null);
  }

  isActive(index: number): boolean {
    return this.activeIndex() === index;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toLinePath(points: ChartPoint[]): string {
  if (!points.length) {
    return '';
  }
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${fmt(point.x)} ${fmt(point.y)}`)
    .join(' ');
}

function toAreaPath(points: ChartPoint[], baselineY: number): string {
  if (!points.length) {
    return '';
  }
  const line = toLinePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${fmt(last.x)} ${fmt(baselineY)} L ${fmt(first.x)} ${fmt(baselineY)} Z`;
}

function fmt(value: number): string {
  return value.toFixed(1);
}
