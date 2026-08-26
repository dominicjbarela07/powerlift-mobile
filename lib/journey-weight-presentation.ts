import {
  formatCalculatedWeightFromKg,
  formatWeightFromKg,
  type DisplayWeightUnit,
} from './display-units';

export type JourneyWeightPerformance = Readonly<{
  weight_kg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
  e1rm_kg?: number | null;
}>;

export function journeyPerformanceDetail(
  eventType: string,
  performance: JourneyWeightPerformance | null | undefined,
  displayUnit: DisplayWeightUnit,
  fallbackDetail: string,
): string {
  if (eventType === 'E1RM_PR' && performance?.e1rm_kg != null) {
    const estimate = formatCalculatedWeightFromKg(performance.e1rm_kg, displayUnit);
    return estimate ? `${estimate} estimated 1RM` : fallbackDetail;
  }
  if (performance?.weight_kg == null) return fallbackDetail;
  const weight = formatWeightFromKg(performance.weight_kg, displayUnit);
  if (!weight) return fallbackDetail;
  const reps = performance.reps != null ? ` × ${performance.reps}` : '';
  const effort = performance.rpe != null
    ? ` @ RPE ${performance.rpe}`
    : performance.rir != null
      ? ` · ${performance.rir} RIR`
      : '';
  return `${weight}${reps}${effort}`;
}
