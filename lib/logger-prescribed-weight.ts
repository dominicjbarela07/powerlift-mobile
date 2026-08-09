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

export type ResolvedLoggerPrescribedWeight = Readonly<{
  canonicalWeightKg: number;
  requestedWeight: number;
  requestedUnit: 'kg' | 'lb';
  displayValue: string;
  displayLabel: string;
  resolution: 'exact' | 'range_lower_bound';
  source: 'planned_manual' | 'planned_target' | 'planned_suggested' | 'item_target';
}>;

function positiveFinite(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function resolveBounds(
  lowValue: unknown,
  highValue: unknown,
): Pick<ResolvedLoggerPrescribedWeight, 'canonicalWeightKg' | 'resolution'> | null {
  const low = positiveFinite(lowValue);
  const high = positiveFinite(highValue);

  if (low == null) return null;
  if (high == null) {
    return {
      canonicalWeightKg: low,
      resolution: 'exact',
    };
  }

  const lowerBound = Math.min(low, high);
  return {
    canonicalWeightKg: Math.abs(low - high) <= 0.01 ? ((low + high) / 2) : lowerBound,
    resolution: Math.abs(low - high) <= 0.01 ? 'exact' : 'range_lower_bound',
  };
}

function finalizeResolution(
  resolved: Pick<ResolvedLoggerPrescribedWeight, 'canonicalWeightKg' | 'resolution'>,
  requestedUnit: 'kg' | 'lb',
  source: ResolvedLoggerPrescribedWeight['source'],
): ResolvedLoggerPrescribedWeight | null {
  const displayValue = formatLoggerWeightKg(
    resolved.canonicalWeightKg,
    requestedUnit,
  );
  const requestedWeight = Number(displayValue);
  if (!Number.isFinite(requestedWeight) || requestedWeight <= 0) return null;

  return Object.freeze({
    ...resolved,
    requestedWeight,
    requestedUnit,
    displayValue,
    displayLabel: `${displayValue} ${requestedUnit}`,
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
      { canonicalWeightKg: plannedTarget, resolution: 'exact' },
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
