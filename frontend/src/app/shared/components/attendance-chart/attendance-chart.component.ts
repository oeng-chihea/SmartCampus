import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MonthlyAttendancePoint } from '../../../models/dashboard.model';

const FALLBACK_WIDTH = 800;
const FALLBACK_HEIGHT = 220;

export interface ChartPoint extends MonthlyAttendancePoint {
  index: number;
  x: number;
  y: number;
}

interface ChartLayout {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  plotWidth: number;
  plotHeight: number;
}

@Component({
  selector: 'app-attendance-chart',
  templateUrl: './attendance-chart.component.html',
  styleUrl: './attendance-chart.component.scss',
})
export class AttendanceChartComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly plotRef = viewChild<ElementRef<HTMLElement>>('plot');

  readonly monthlyTrend = input.required<MonthlyAttendancePoint[]>();
  readonly year = input(2026);

  /** Hovered / tapped month index; null when the pointer leaves the chart */
  readonly activeIndex = signal<number | null>(null);
  readonly frame = signal({ width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT });

  readonly layout = computed<ChartLayout>(() => layoutFor(this.frame()));
  readonly viewBox = computed(() => {
    const { width, height } = this.layout();
    return `0 0 ${width} ${height}`;
  });
  readonly baselineY = computed(() => {
    const box = this.layout();
    return box.padTop + box.plotHeight;
  });

  readonly points = computed<ChartPoint[]>(() => {
    const data = this.monthlyTrend();
    if (!data.length) {
      return [];
    }

    const box = this.layout();
    const last = Math.max(data.length - 1, 1);

    return data.map((item, index) => {
      const rate = clamp(item.presentRate, 0, 100);
      return {
        ...item,
        index,
        x: box.padLeft + (index / last) * box.plotWidth,
        y: box.padTop + (1 - rate / 100) * box.plotHeight,
      };
    });
  });

  readonly linePath = computed(() => toLinePath(this.points()));
  readonly areaPath = computed(() => toAreaPath(this.points(), this.baselineY()));

  readonly yTicks = computed(() => {
    const box = this.layout();
    return [100, 75, 50, 25].map((rate) => ({
      rate,
      y: box.padTop + (1 - rate / 100) * box.plotHeight,
    }));
  });

  readonly avgRate = computed(() => {
    const data = monthsWithRecords(this.monthlyTrend());
    if (!data.length) {
      return 0;
    }
    const total = data.reduce((sum, row) => sum + row.presentRate, 0);
    return Math.round(total / data.length);
  });

  readonly peakMonth = computed(() => {
    const data = monthsWithRecords(this.monthlyTrend());
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

    const { width, height } = this.layout();
    const left = (point.x / width) * 100;
    const top = (point.y / height) * 100;
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

  ngAfterViewInit(): void {
    const element = this.plotRef()?.nativeElement;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) {
        return;
      }
      const width = Math.max(1, Math.round(box.width));
      const height = Math.max(1, Math.round(box.height));
      const current = this.frame();
      if (current.width === width && current.height === height) {
        return;
      }
      this.frame.set({ width, height });
    });

    observer.observe(element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

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

function layoutFor(frame: { width: number; height: number }): ChartLayout {
  const width = Math.max(frame.width, 1);
  const height = Math.max(frame.height, 1);
  const padLeft = width < 480 ? 28 : 40;
  const padRight = width < 480 ? 8 : 16;
  const padTop = 16;
  const padBottom = 10;
  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    plotWidth: Math.max(width - padLeft - padRight, 1),
    plotHeight: Math.max(height - padTop - padBottom, 1),
  };
}

function monthsWithRecords(
  data: MonthlyAttendancePoint[],
): MonthlyAttendancePoint[] {
  return data.filter(
    (row) => row.present + row.absent + row.outsideLocation > 0,
  );
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
