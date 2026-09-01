import { formatLoggerWeightKg } from '@/lib/logger-weight-format';

export type LoggerPrescribedWeightItem = Readonly<{
  target_low_kg?: number | null;
  target_high_kg?: number | null;
}>;

export type LoggerPlannedWeight = Readonly<{
  manual_target_kg?: number | null;
  manual_pm_kg?: number | null;
  target_kg?: number | null;
  suggested_low_kg?: number | null;
  suggested_high_kg?: number | null;
}>;

export type ResolvedLoggerPrescribedWeightEndpoint = Readonly<{
  canonicalWeightKg: number;
  requestedWeight: number;
  requestedUnit: 'kg' | 'lb';
  displayValue: string;
  displayLabel: string;
}>;

export type ResolvedLoggerPrescribedWeight = Readonly<{
  canonicalWeightKg: number;
  requestedWeight: number;
  requestedUnit: 'kg' | 'lb';
  displayValue: string;
  displayLabel: string;
  resolution: 'exact' | 'range';
  endpoints: readonly ResolvedLoggerPrescribedWeightEndpoint[];
  source: 'planned_manual' | 'planned_target' | 'planned_suggested' | 'item_target';
}>;

type ResolvedLoggerPrescribedWeightBounds = Readonly<{
  lowerWeightKg: number;
  upperWeightKg: number;
}>;

function positiveFinite(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function resolveBounds(
  lowValue: unknown,
  highValue: unknown,
): ResolvedLoggerPrescribedWeightBounds | null {
  const low = positiveFinite(lowValue);
  const high = positiveFinite(highValue);

  if (low == null) return null;
  if (high == null) {
    return {
      lowerWeightKg: low,
      upperWeightKg: low,
    };
  }

  return {
    lowerWeightKg: Math.min(low, high),
    upperWeightKg: Math.max(low, high),
  };
}

function resolveEndpoint(
  canonicalWeightKg: number,
  requestedUnit: 'kg' | 'lb',
): ResolvedLoggerPrescribedWeightEndpoint | null {
  const displayValue = formatLoggerWeightKg(canonicalWeightKg, requestedUnit);
  const requestedWeight = Number(displayValue);
  if (!Number.isFinite(requestedWeight) || requestedWeight <= 0) return null;

  return Object.freeze({
    canonicalWeightKg,
    requestedWeight,
    requestedUnit,
    displayValue,
    displayLabel: `${displayValue} ${requestedUnit}`,
  });
}

function finalizeResolution(
  bounds: ResolvedLoggerPrescribedWeightBounds,
  requestedUnit: 'kg' | 'lb',
  source: ResolvedLoggerPrescribedWeight['source'],
): ResolvedLoggerPrescribedWeight | null {
  const lower = resolveEndpoint(bounds.lowerWeightKg, requestedUnit);
  const upper = resolveEndpoint(bounds.upperWeightKg, requestedUnit);
  if (!lower || !upper) return null;

  // Prescription shape is authoritative. A narrow range remains a range even
  // when display rounding makes its endpoints look alike; warmups and display
  // formatting may never collapse the programmed envelope into a single load.
  const endpoints = bounds.lowerWeightKg === bounds.upperWeightKg
    ? Object.freeze([lower])
    : Object.freeze([lower, upper]);
  const resolution = endpoints.length === 1 ? 'exact' : 'range';
  const displayLabel = resolution === 'exact'
    ? lower.displayLabel
    : `${lower.displayValue}–${upper.displayValue} ${requestedUnit}`;

  return Object.freeze({
    canonicalWeightKg: lower.canonicalWeightKg,
    requestedWeight: lower.requestedWeight,
    requestedUnit: lower.requestedUnit,
    displayValue: lower.displayValue,
    displayLabel,
    resolution,
    endpoints,
    source,
  });
}

export function resolveLoggerPrescribedWeight({
  item,
  planned,
  unit,
}: {
  item: LoggerPrescribedWeightItem;
  planned?: LoggerPlannedWeight | null;
  unit: 'kg' | 'lb';
}): ResolvedLoggerPrescribedWeight | null {
  const manualTarget = positiveFinite(planned?.manual_target_kg);
  if (manualTarget != null) {
    const manualRange = Math.max(0, Number(planned?.manual_pm_kg) || 0);
    const resolved = resolveBounds(
      manualTarget - manualRange,
      manualTarget + manualRange,
    );
    if (resolved) return finalizeResolution(resolved, unit, 'planned_manual');
  }

  const plannedTarget = positiveFinite(planned?.target_kg);
  if (plannedTarget != null) {
    return finalizeResolution(
      { lowerWeightKg: plannedTarget, upperWeightKg: plannedTarget },
      unit,
      'planned_target',
    );
  }

  const suggested = resolveBounds(
    planned?.suggested_low_kg,
    planned?.suggested_high_kg,
  );
  if (suggested) return finalizeResolution(suggested, unit, 'planned_suggested');

  const itemTarget = resolveBounds(item.target_low_kg, item.target_high_kg);
  return itemTarget
    ? finalizeResolution(itemTarget, unit, 'item_target')
    : null;
}
