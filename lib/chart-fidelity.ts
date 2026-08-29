export type AnalyticalMetricKind =
  | 'count'
  | 'hours'
  | 'percentage'
  | 'rate_per_100'
  | 'score'
  | 'volume'
  | 'weight';

export type AnalyticalMetricDefinition = Readonly<{
  key: string;
  label: string;
  kind: AnalyticalMetricKind;
  unit?: string;
  axisUnit?: string;
  minimum?: number;
  maximum?: number;
  includeZero?: boolean;
  signed?: boolean;
  maximumFractionDigits?: number;
}>;

export type NumericScale = Readonly<{
  minimum: number;
  maximum: number;
  ticks: readonly number[];
}>;

export type TimeTick = Readonly<{
  index: number;
  date: string;
  timestamp: number;
  label: string;
}>;

export type AnalyticalXDomainMode = 'chronological' | 'observationIndex';

export type AnalyticalXObservation = Readonly<{
  key: string;
  date: string;
  timestamp?: number | null;
}>;

export type AnalyticalXTick = Readonly<{
  index: number;
  key: string;
  date: string;
  label: string;
  x: number;
  textAnchor: 'start' | 'middle' | 'end';
}>;

export type AnalyticalXLayout = Readonly<{
  observations: readonly Readonly<AnalyticalXObservation & { timestamp: number; x: number }>[];
  ticks: readonly AnalyticalXTick[];
}>;

const METRIC_CONFIG: Record<string, AnalyticalMetricDefinition> = {
  max_progression: {
    key: 'max_progression', label: 'Max progression', kind: 'percentage', unit: '%', axisUnit: '%', includeZero: true, signed: true, maximumFractionDigits: 1,
  },
  dots_progression: {
    key: 'dots_progression', label: 'Estimated DOTS progression', kind: 'percentage', unit: '%', axisUnit: '%', includeZero: true, signed: true, maximumFractionDigits: 1,
  },
  adherence: {
    key: 'adherence', label: 'Adherence', kind: 'percentage', unit: '%', axisUnit: '%', minimum: 0, maximum: 100, maximumFractionDigits: 0,
  },
  pr_rate: {
    key: 'pr_rate', label: 'PR rate', kind: 'rate_per_100', unit: 'per 100 planned sets', axisUnit: '/100', includeZero: true, maximumFractionDigits: 1,
  },
  readiness: {
    key: 'readiness', label: 'Readiness', kind: 'score', unit: '/10', axisUnit: '/10', minimum: 0, maximum: 10, maximumFractionDigits: 1,
  },
  stress: {
    key: 'stress', label: 'Stress', kind: 'score', unit: '/10', axisUnit: '/10', minimum: 0, maximum: 10, maximumFractionDigits: 1,
  },
  energy: {
    key: 'energy', label: 'Energy', kind: 'score', unit: '/10', axisUnit: '/10', minimum: 0, maximum: 10, maximumFractionDigits: 1,
  },
  rpe: {
    key: 'rpe', label: 'RPE', kind: 'score', unit: '/10', axisUnit: '/10', minimum: 0, maximum: 10, maximumFractionDigits: 1,
  },
  rir: {
    key: 'rir', label: 'RIR', kind: 'score', unit: 'RIR', axisUnit: 'RIR', minimum: 0, maximum: 10, maximumFractionDigits: 1,
  },
  sleep: {
    key: 'sleep', label: 'Sleep', kind: 'hours', unit: 'h', axisUnit: 'h', includeZero: false, maximumFractionDigits: 1,
  },
};

export function analyticalMetricDefinition(
  key: string,
  overrides: Partial<AnalyticalMetricDefinition> = {},
): AnalyticalMetricDefinition {
  const configured = METRIC_CONFIG[key];
  const base: AnalyticalMetricDefinition = configured ?? {
    key,
    label: key.replaceAll('_', ' '),
    kind: 'count',
    maximumFractionDigits: 1,
  };
  return Object.assign({}, base, overrides);
}

function magnitude(value: number) {
  return 10 ** Math.floor(Math.log10(Math.max(Math.abs(value), Number.EPSILON)));
}

function niceStep(raw: number) {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const scale = magnitude(raw);
  const normalized = raw / scale;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return factor * scale;
}

function rounded(value: number) {
  return Number(value.toPrecision(12));
}

export function buildNumericScale(
  rawValues: readonly number[],
  metric: AnalyticalMetricDefinition,
  targetTickCount = 5,
): NumericScale {
  const values = rawValues.filter(Number.isFinite);
  const fixedMinimum = metric.minimum;
  const fixedMaximum = metric.maximum;
  if (fixedMinimum != null && fixedMaximum != null && fixedMaximum > fixedMinimum) {
    const step = niceStep((fixedMaximum - fixedMinimum) / Math.max(2, targetTickCount - 1));
    const ticks: number[] = [];
    for (let value = fixedMinimum; value <= fixedMaximum + step * 0.01; value += step) ticks.push(rounded(value));
    if (ticks.at(-1) !== fixedMaximum) ticks.push(fixedMaximum);
    return { minimum: fixedMinimum, maximum: fixedMaximum, ticks };
  }

  let observedMinimum = values.length ? Math.min(...values) : 0;
  let observedMaximum = values.length ? Math.max(...values) : 1;
  if (metric.includeZero) {
    observedMinimum = Math.min(0, observedMinimum);
    observedMaximum = Math.max(0, observedMaximum);
  }
  const reference = Math.max(Math.abs(observedMinimum), Math.abs(observedMaximum), 1);
  const observedSpan = observedMaximum - observedMinimum;
  const padding = Math.max(observedSpan * 0.12, reference * 0.04, metric.kind === 'weight' ? 1 : 0.25);
  let paddedMinimum = fixedMinimum ?? observedMinimum - padding;
  let paddedMaximum = fixedMaximum ?? observedMaximum + padding;
  if (metric.kind === 'weight' || metric.kind === 'volume' || metric.kind === 'hours' || metric.kind === 'count' || metric.kind === 'rate_per_100') {
    paddedMinimum = Math.max(0, paddedMinimum);
  }
  if (paddedMaximum <= paddedMinimum) paddedMaximum = paddedMinimum + Math.max(1, reference * 0.1);

  const step = niceStep((paddedMaximum - paddedMinimum) / Math.max(2, targetTickCount - 1));
  const minimum = fixedMinimum ?? Math.floor(paddedMinimum / step) * step;
  const maximum = fixedMaximum ?? Math.ceil(paddedMaximum / step) * step;
  const ticks: number[] = [];
  for (let value = minimum; value <= maximum + step * 0.01 && ticks.length < 9; value += step) ticks.push(rounded(value));
  return { minimum: rounded(minimum), maximum: rounded(maximum), ticks };
}

function compactNumber(value: number, digits: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(absolute >= 10_000 ? 0 : 1)}K`;
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatAnalyticalValue(
  value: number | null | undefined,
  metric: AnalyticalMetricDefinition,
  options: { axis?: boolean; signed?: boolean } = {},
) {
  if (value == null || !Number.isFinite(value)) return '—';
  const digits = metric.maximumFractionDigits ?? 1;
  const sign = (options.signed ?? metric.signed) && value > 0 ? '+' : '';
  const number = metric.kind === 'volume' ? compactNumber(value, digits) : value.toLocaleString('en-US', { maximumFractionDigits: digits });
  if (metric.kind === 'percentage') return `${sign}${number}%`;
  if (metric.kind === 'rate_per_100') return options.axis ? `${number}/100` : `${number} per 100 planned sets`;
  if (metric.kind === 'hours') return `${number} h`;
  if (metric.kind === 'score') return options.axis ? number : `${number}${metric.unit ? ` ${metric.unit}` : ''}`;
  return `${sign}${number}${metric.unit ? ` ${metric.unit}` : ''}`;
}

function dateTimestamp(value: string) {
  const timestamp = Date.parse(value.includes('T') ? value : `${value.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function estimateAxisLabelWidth(label: string, fontSize = 9) {
  return Math.ceil(String(label).length * fontSize * 0.58);
}

export function buildYAxisGutter(labels: readonly string[], fontSize = 9) {
  const widest = labels.reduce((maximum, label) => Math.max(maximum, estimateAxisLabelWidth(label, fontSize)), 0);
  return Math.max(43, widest + 10);
}

export function formatTimeTick(date: string, spanDays: number) {
  const parsed = new Date(dateTimestamp(date));
  if (!date || Number.isNaN(parsed.getTime())) return date;
  if (spanDays <= 14) return parsed.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  if (spanDays <= 370) return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return parsed.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export function buildTimeTicks(rawDates: readonly string[], width = 320): readonly TimeTick[] {
  const dates = rawDates
    .map((date, index) => ({ date, index, timestamp: dateTimestamp(date) }))
    .filter((row) => row.date && row.timestamp > 0)
    .sort((left, right) => left.timestamp - right.timestamp);
  if (!dates.length) return [];
  const maximumTicks = width < 330 ? 3 : width < 430 ? 4 : 5;
  const count = Math.min(maximumTicks, dates.length);
  const indexes = new Set<number>();
  for (let slot = 0; slot < count; slot += 1) indexes.add(Math.round(slot * (dates.length - 1) / Math.max(1, count - 1)));
  const spanDays = Math.max(0, (dates.at(-1)!.timestamp - dates[0].timestamp) / 86_400_000);
  const labels = new Set<string>();
  return [...indexes].sort((left, right) => left - right).flatMap((index) => {
    const row = dates[index];
    const label = formatTimeTick(row.date, spanDays);
    if (labels.has(label)) return [];
    labels.add(label);
    return [{ ...row, index, label }];
  });
}

function tickIndexes(count: number, maximumTicks: number) {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const indexes = new Set<number>([0, count - 1]);
  for (let slot = 1; slot < maximumTicks - 1; slot += 1) {
    indexes.add(Math.round(slot * (count - 1) / Math.max(1, maximumTicks - 1)));
  }
  return [...indexes].sort((left, right) => left - right);
}

function chronologicalTickIndexes(timestamps: readonly number[], maximumTicks: number) {
  if (timestamps.length <= maximumTicks) return timestamps.map((_timestamp, index) => index);
  const indexes = new Set<number>([0, timestamps.length - 1]);
  const first = timestamps[0];
  const span = Math.max(1, timestamps.at(-1)! - first);
  for (let slot = 1; slot < maximumTicks - 1; slot += 1) {
    const target = first + span * slot / (maximumTicks - 1);
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    timestamps.forEach((timestamp, index) => {
      const distance = Math.abs(timestamp - target);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    indexes.add(nearestIndex);
  }
  return [...indexes].sort((left, right) => left - right);
}

export function buildAnalyticalXLayout({
  observations,
  mode,
  plotLeft,
  plotRight,
  width,
  fontSize = 9,
}: {
  observations: readonly AnalyticalXObservation[];
  mode: AnalyticalXDomainMode;
  plotLeft: number;
  plotRight: number;
  width: number;
  fontSize?: number;
}): AnalyticalXLayout {
  const normalized = observations
    .map((row, sourceIndex) => ({
      ...row,
      sourceIndex,
      timestamp: Number(row.timestamp) > 0 ? Number(row.timestamp) : dateTimestamp(row.date),
    }))
    .filter((row) => row.date && row.timestamp > 0)
    .sort((left, right) => left.timestamp - right.timestamp || left.sourceIndex - right.sourceIndex);
  if (!normalized.length) return { observations: [], ticks: [] };

  const plotWidth = Math.max(1, width - plotLeft - plotRight);
  const minTime = normalized[0].timestamp;
  const maxTime = normalized.at(-1)!.timestamp;
  const timeSpan = Math.max(1, maxTime - minTime);
  const positioned = normalized.map((row, index) => ({
    key: row.key,
    date: row.date,
    timestamp: row.timestamp,
    x: normalized.length === 1
      ? plotLeft + plotWidth / 2
      : mode === 'observationIndex'
        ? plotLeft + (index / (normalized.length - 1)) * plotWidth
        : plotLeft + ((row.timestamp - minTime) / timeSpan) * plotWidth,
  }));

  const spanDays = Math.max(0, (maxTime - minTime) / 86_400_000);
  const labels = positioned.map((row, index) => mode === 'observationIndex' ? `#${index + 1}` : formatTimeTick(row.date, spanDays));
  const widest = Math.max(...labels.map((label) => estimateAxisLabelWidth(label, fontSize)), 1);
  const maximumTicks = Math.max(2, Math.min(5, Math.floor(plotWidth / Math.max(54, widest + 18))));
  const maximumCandidateTicks = Math.min(positioned.length, maximumTicks);
  const candidateIndexes = mode === 'chronological'
    ? chronologicalTickIndexes(positioned.map((row) => row.timestamp), maximumCandidateTicks)
    : tickIndexes(positioned.length, maximumCandidateTicks);
  const candidates = candidateIndexes.map((index) => ({
    index,
    row: positioned[index],
    label: labels[index],
    width: estimateAxisLabelWidth(labels[index], fontSize),
  }));

  const accepted: typeof candidates = [];
  candidates.forEach((candidate) => {
    const previous = accepted.at(-1);
    const isLast = candidate.index === positioned.length - 1;
    if (!previous) {
      accepted.push(candidate);
      return;
    }
    const clearance = previous.width / 2 + candidate.width / 2 + 10;
    if (candidate.row.x - previous.row.x >= clearance) {
      accepted.push(candidate);
      return;
    }
    if (isLast && previous.index !== 0) accepted.splice(accepted.length - 1, 1, candidate);
  });

  return {
    observations: positioned,
    ticks: accepted.map((candidate) => ({
      index: candidate.index,
      key: candidate.row.key,
      date: candidate.row.date,
      label: candidate.label,
      x: candidate.row.x,
      textAnchor: positioned.length === 1
        ? 'middle'
        : candidate.index === 0
          ? 'start'
          : candidate.index === positioned.length - 1
            ? 'end'
            : 'middle',
    })),
  };
}

export function nearestTimeIndex(timestamps: readonly number[], target: number) {
  if (!timestamps.length) return -1;
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  timestamps.forEach((timestamp, index) => {
    const next = Math.abs(timestamp - target);
    if (next < distance) { best = index; distance = next; }
  });
  return best;
}
