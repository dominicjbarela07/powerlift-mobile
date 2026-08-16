export type HomePlotDatum = {
  date?: string | null;
  value?: number | null;
};

export type HomePlotPoint = {
  date: string;
  timestamp: number;
  value: number;
  x: number;
  y: number;
};

export type HomeLinePlot = {
  state: 'empty' | 'first_observation' | 'comparison' | 'trend';
  points: HomePlotPoint[];
  minValue: number | null;
  maxValue: number | null;
  firstDate: string | null;
  lastDate: string | null;
};

export type HomeBar = HomePlotPoint & {
  width: number;
  height: number;
};

function timestampForDate(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(`${String(value).slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function chronologicalHomePoints(raw: HomePlotDatum[], limit = 8) {
  const points = raw.flatMap((point) => {
    const timestamp = timestampForDate(point.date);
    const value = Number(point.value);
    return timestamp == null || !Number.isFinite(value)
      ? []
      : [{ date: String(point.date).slice(0, 10), timestamp, value }];
  });
  points.sort((left, right) => left.timestamp - right.timestamp);
  return points.slice(-Math.max(1, limit));
}

export function homeHistoryState(pointCount: number): HomeLinePlot['state'] {
  if (pointCount <= 0) return 'empty';
  if (pointCount === 1) return 'first_observation';
  if (pointCount === 2) return 'comparison';
  return 'trend';
}

export function buildHomeLinePlot(
  raw: HomePlotDatum[],
  width: number,
  height: number,
  limit = 8,
): HomeLinePlot {
  const clean = chronologicalHomePoints(raw, limit);
  if (!clean.length || width <= 0 || height <= 0) {
    return {
      state: 'empty', points: [], minValue: null, maxValue: null,
      firstDate: null, lastDate: null,
    };
  }
  const values = clean.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const valuePadding = Math.max((rawMax - rawMin) * 0.14, Math.abs(rawMax || 1) * 0.015, 0.25);
  const minValue = rawMin - valuePadding;
  const maxValue = rawMax + valuePadding;
  const valueSpan = maxValue - minValue || 1;
  const firstTime = clean[0].timestamp;
  const lastTime = clean[clean.length - 1].timestamp;
  const timeSpan = lastTime - firstTime;
  const left = 4;
  const right = Math.max(left, width - 4);
  const top = 4;
  const bottom = Math.max(top, height - 12);
  const points = clean.map((point, index) => ({
    ...point,
    x: timeSpan > 0
      ? left + ((point.timestamp - firstTime) / timeSpan) * (right - left)
      : left + ((index + 1) / (clean.length + 1)) * (right - left),
    y: bottom - ((point.value - minValue) / valueSpan) * (bottom - top),
  }));
  return {
    state: homeHistoryState(points.length),
    points,
    minValue: rawMin,
    maxValue: rawMax,
    firstDate: clean[0].date,
    lastDate: clean[clean.length - 1].date,
  };
}

export function buildHomeBarPlot(
  raw: HomePlotDatum[],
  width: number,
  height: number,
  limit = 6,
): HomeLinePlot & { bars: HomeBar[] } {
  const line = buildHomeLinePlot(raw, width, height, limit);
  if (!line.points.length) return { ...line, bars: [] };
  const maxValue = Math.max(...line.points.map((point) => point.value), 1);
  const gap = 4;
  const barWidth = Math.max(3, (width - gap * (line.points.length + 1)) / line.points.length);
  const plotHeight = Math.max(1, height - 13);
  const bars = line.points.map((point, index) => {
    const barHeight = Math.max(point.value > 0 ? 3 : 1, (point.value / maxValue) * plotHeight);
    return {
      ...point,
      x: gap + index * (barWidth + gap),
      y: plotHeight - barHeight,
      width: barWidth,
      height: barHeight,
    };
  });
  return { ...line, bars };
}

export function compactPlotDate(value?: string | null) {
  const timestamp = timestampForDate(value);
  if (timestamp == null) return '';
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
