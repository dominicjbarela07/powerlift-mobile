import { formatLoggerWeightKg, type LoggerDisplayUnit } from '@/lib/logger-weight-format';

export type PerformedLoadSemantics = Readonly<{
  loadConvention?: string | null;
  measurementType?: string | null;
  loadingBehavior?: string | null;
}>;

function normalized(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function isAssistanceLoad(semantics?: PerformedLoadSemantics | null) {
  const convention = normalized(semantics?.loadConvention);
  const measurement = normalized(semantics?.measurementType);
  return convention === 'assistance_load'
    || normalized(semantics?.loadingBehavior) === 'assisted'
    || measurement.includes('assisted')
    || measurement.includes('assistance');
}

export function isBodyweightLoad(semantics?: PerformedLoadSemantics | null) {
  const convention = normalized(semantics?.loadConvention);
  const measurement = normalized(semantics?.measurementType);
  return convention === 'bodyweight_only'
    || convention === 'added_bodyweight'
    || convention === 'no_external_load'
    || measurement === 'bodyweight_reps'
    || measurement.includes('weighted_bodyweight')
    || measurement.includes('added_weight');
}

export function formatPerformedLoad(
  weightKg: number | null | undefined,
  unit: LoggerDisplayUnit,
  semantics?: PerformedLoadSemantics | null,
) {
  const numeric = weightKg == null ? null : Number(weightKg);
  const hasRecordedLoad = numeric != null && Number.isFinite(numeric);
  const positiveLoad = hasRecordedLoad && numeric > 0;
  const formatted = hasRecordedLoad ? formatLoggerWeightKg(numeric, unit) : null;

  if (isAssistanceLoad(semantics)) {
    return formatted == null ? 'Assistance' : `${formatted} ${unit} assistance`;
  }
  if (isBodyweightLoad(semantics)) {
    return positiveLoad ? `BW + ${formatted} ${unit}` : 'BW';
  }
  return formatted == null ? null : `${formatted} ${unit}`;
}

