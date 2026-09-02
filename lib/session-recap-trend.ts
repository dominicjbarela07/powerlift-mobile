import {
  kilogramsToDisplayValue,
  type DisplayWeightUnit,
} from './display-units';

export type SessionRecapTrendPoint = {
  date?: string | null;
  workout_id?: number | null;
  set_log_id?: number | null;
  metric_value?: number | null;
  score?: number | null;
  weight_kg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
  current?: boolean;
};

export type SessionRecapTrend = {
  metric?: string | null;
  metric_label?: string | null;
  metric_unit?: string | null;
  direction?: 'higher_is_better' | 'lower_is_better' | null;
  delta_value?: number | null;
  delta_kg?: number | null;
  points?: SessionRecapTrendPoint[] | null;
};

export type SessionRecapPlotPoint = SessionRecapTrendPoint & {
  value: number;
  x: number;
  y: number;
};

export type SessionRecapTrendPlot = {
  points: SessionRecapPlotPoint[];
  gridY: number[];
  minValue: number;
  maxValue: number;
};

function dateValue(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function trendPointMetricValue(point: SessionRecapTrendPoint): number | null {
  for (const candidate of [point.metric_value, point.score, point.weight_kg]) {
    if (candidate == null) continue;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function chronologicalTrendPoints(
  points?: SessionRecapTrendPoint[] | null,
  limit = 6,
): SessionRecapTrendPoint[] {
  return (points || [])
    .filter((point) => trendPointMetricValue(point) != null)
    .map((point, index) => ({ point, index }))
    .sort((left, right) => {
      if (left.point.current !== right.point.current) return left.point.current ? 1 : -1;
      return dateValue(left.point.date) - dateValue(right.point.date)
        || Number(left.point.set_log_id || 0) - Number(right.point.set_log_id || 0)
        || left.index - right.index;
    })
    .slice(-Math.max(1, limit))
    .map(({ point }) => point);
}

export function buildSessionRecapTrendPlot({
  points,
  width,
  height,
  insetX = 7,
  insetY = 7,
}: {
  points?: SessionRecapTrendPoint[] | null;
  width: number;
  height: number;
  insetX?: number;
  insetY?: number;
}): SessionRecapTrendPlot {
  const ordered = chronologicalTrendPoints(points);
  const values = ordered.map((point) => trendPointMetricValue(point) as number);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 0;
  const naturalRange = rawMax - rawMin;
  const padding = naturalRange > 0 ? naturalRange * 0.12 : Math.max(Math.abs(rawMax) * 0.04, 1);
  const minValue = rawMin - padding;
  const maxValue = rawMax + padding;
  const range = Math.max(maxValue - minValue, 1);
  const innerWidth = Math.max(1, width - insetX * 2);
  const innerHeight = Math.max(1, height - insetY * 2);
  return {
    points: ordered.map((point, index) => {
      const value = trendPointMetricValue(point) as number;
      return {
        ...point,
        value,
        x: insetX + (index * innerWidth) / Math.max(ordered.length - 1, 1),
        y: insetY + (1 - (value - minValue) / range) * innerHeight,
      };
    }),
    gridY: [0, 0.5, 1].map((position) => insetY + position * innerHeight),
    minValue,
    maxValue,
  };
}

export function formatSessionRecapTrendValue(
  value: number | null | undefined,
  metricUnit: string | null | undefined,
  displayUnit: DisplayWeightUnit,
): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const numeric = metricUnit === 'kg'
    ? kilogramsToDisplayValue(Number(value), displayUnit)
    : Number(value);
  const suffix = metricUnit === 'kg' ? ` ${displayUnit}` : metricUnit === 'score' ? '' : ` ${metricUnit || ''}`;
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(numeric)}${suffix}`.trim();
}

export function formatSessionRecapTrendDelta(
  trend: SessionRecapTrend | null | undefined,
  displayUnit: DisplayWeightUnit,
): string | null {
  const raw = trend?.delta_value ?? trend?.delta_kg;
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const numeric = trend?.metric_unit === 'kg'
    ? kilogramsToDisplayValue(Math.abs(Number(raw)), displayUnit)
    : Math.abs(Number(raw));
  const improved = trend?.direction === 'lower_is_better' ? Number(raw) < 0 : Number(raw) > 0;
  const arrow = Number(raw) === 0 ? '→' : improved ? '↑' : '↓';
  const suffix = trend?.metric_unit === 'kg' ? ` ${displayUnit}` : trend?.metric_unit === 'score' ? '' : ` ${trend?.metric_unit || ''}`;
  return `${arrow} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(numeric)}${suffix}`.trim();
}
