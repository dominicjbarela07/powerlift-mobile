import { kilogramsToDisplayValue } from '@/lib/display-units';
import type { MovementHistoryUnit } from '@/lib/canonical-movement-history';

export type LoadRepProfileObservation = Readonly<{
  id: number;
  exposure_id: string;
  date: string;
  weight_kg: number;
  reps?: number | null;
  rir?: number | null;
  rpe?: number | null;
}>;

export type LoadRepProfileDatum = LoadRepProfileObservation & Readonly<{
  load: number;
}>;

export type LoadRepProfileCoordinate = Readonly<{
  key: string;
  reps: number;
  load: number;
  x: number;
  y: number;
  radius: number;
  observations: LoadRepProfileDatum[];
}>;

export type LoadRepProfileLayout = Readonly<{
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  xTicks: number[];
  yTicks: number[];
  coordinates: LoadRepProfileCoordinate[];
  observationCount: number;
}>;

const NICE_FRACTIONS = [1, 2, 2.5, 5, 10] as const;

function niceStep(rawStep: number) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / power;
  return (NICE_FRACTIONS.find((candidate) => candidate >= fraction) || 10) * power;
}

function numericTicks(minimum: number, maximum: number, step: number) {
  const count = Math.max(1, Math.round((maximum - minimum) / step));
  return Array.from({ length: count + 1 }, (_, index) => Number((minimum + index * step).toFixed(6)));
}

export function loadRepProfileDomains(data: readonly LoadRepProfileDatum[]) {
  if (!data.length) {
    return {
      xDomain: [1, 5] as const,
      yDomain: [1, 5] as const,
      xTicks: [1, 2, 3, 4, 5],
      yTicks: [1, 2, 3, 4, 5],
    };
  }

  const reps = data.map((point) => point.reps as number);
  const loads = data.map((point) => point.load);
  const rawMinRep = Math.min(...reps);
  const rawMaxRep = Math.max(...reps);
  const repSpan = Math.max(1, rawMaxRep - rawMinRep);
  const xStep = Math.max(1, Math.round(niceStep(repSpan / 4)));
  const xPadding = Math.max(1, xStep);
  const xMinimum = Math.max(1, Math.floor((rawMinRep - xPadding) / xStep) * xStep);
  const xMaximum = Math.max(xMinimum + xStep, Math.ceil((rawMaxRep + xPadding) / xStep) * xStep);

  const rawMinLoad = Math.min(...loads);
  const rawMaxLoad = Math.max(...loads);
  const loadReference = Math.max(Math.abs(rawMinLoad), Math.abs(rawMaxLoad), 1);
  const loadSpan = Math.max(rawMaxLoad - rawMinLoad, loadReference * 0.08);
  const yStep = niceStep(loadSpan / 4);
  const yPadding = Math.max(yStep, loadSpan * 0.08);
  let yMinimum = Math.floor((rawMinLoad - yPadding) / yStep) * yStep;
  const yMaximum = Math.max(yMinimum + yStep, Math.ceil((rawMaxLoad + yPadding) / yStep) * yStep);
  if (rawMinLoad > 0 && yMinimum <= 0) yMinimum = Math.min(yStep, rawMinLoad);

  return {
    xDomain: [xMinimum, xMaximum] as const,
    yDomain: [Number(yMinimum.toFixed(6)), Number(yMaximum.toFixed(6))] as const,
    xTicks: numericTicks(xMinimum, xMaximum, xStep),
    yTicks: numericTicks(yMinimum, yMaximum, yStep),
  };
}

export function buildLoadRepProfileLayout({
  observations,
  unit,
  plotLeft,
  plotRight,
  plotTop,
  plotBottom,
}: {
  observations: readonly LoadRepProfileObservation[];
  unit: MovementHistoryUnit;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
}): LoadRepProfileLayout {
  const data = observations
    .filter((point) => Number.isFinite(Number(point.weight_kg)) && Number(point.weight_kg) > 0 && Number.isFinite(Number(point.reps)) && Number(point.reps) > 0)
    .map((point) => ({
      ...point,
      reps: Number(point.reps),
      weight_kg: Number(point.weight_kg),
      load: kilogramsToDisplayValue(Number(point.weight_kg), unit),
    }));
  const domains = loadRepProfileDomains(data);
  const [xMinimum, xMaximum] = domains.xDomain;
  const [yMinimum, yMaximum] = domains.yDomain;
  const groups = new Map<string, LoadRepProfileDatum[]>();

  data.forEach((point) => {
    const key = `${point.reps}:${point.load.toFixed(6)}`;
    groups.set(key, [...(groups.get(key) || []), point]);
  });

  const coordinates = [...groups.entries()].map(([key, grouped]) => {
    const sorted = [...grouped].sort((left, right) => right.date.localeCompare(left.date) || right.id - left.id);
    const point = sorted[0];
    return {
      key,
      reps: point.reps as number,
      load: point.load,
      x: plotLeft + (((point.reps as number) - xMinimum) / Math.max(xMaximum - xMinimum, 1)) * (plotRight - plotLeft),
      y: plotBottom - ((point.load - yMinimum) / Math.max(yMaximum - yMinimum, 1)) * (plotBottom - plotTop),
      radius: Math.min(10, 5 + Math.sqrt(sorted.length - 1) * 1.7),
      observations: sorted,
    };
  });

  return {
    ...domains,
    coordinates,
    observationCount: data.length,
  };
}

export function loadRepProfileAccessibilityLabel(
  coordinate: LoadRepProfileCoordinate,
  unit: MovementHistoryUnit,
  seriesLabel: string,
) {
  const latest = coordinate.observations[0];
  const unitName = unit === 'lb' ? 'pounds' : 'kilograms';
  const effort = latest.rir != null
    ? `${latest.rir} RIR`
    : latest.rpe != null
      ? `RPE ${latest.rpe}`
      : 'effort not recorded';
  const repeated = coordinate.observations.length > 1 ? `, ${coordinate.observations.length} performed sets at this coordinate` : '';
  return `${coordinate.load.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unitName} for ${coordinate.reps} reps, ${effort}, ${latest.date}, ${seriesLabel}${repeated}.`;
}
