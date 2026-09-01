import { formatLoggerWeightKg } from '@/lib/logger-weight-format';
import type { SmartWarmupLoading } from '@/lib/smart-warmup';

export type LoggerPhysicalLoadingEndpoint = Readonly<{
  canonicalWeightKg: number;
  requestedWeight: number;
  requestedUnit: 'kg' | 'lb';
}>;

const CANONICAL_WEIGHT_EPSILON_KG = 0.0001;
const DISPLAY_WEIGHT_EPSILON = 0.0001;

/**
 * Select the server-resolved physical loading that represents a Logger
 * prescription endpoint. Core prescriptions retain their canonical kg
 * envelope, while Logger copy intentionally rounds each endpoint to a gym-
 * loadable display value. A 187.5 kg lower bound therefore displays as 415 lb
 * and must select the movement configuration's physical 415 lb option rather
 * than fall through to a generic 45 lb-bar render.
 */
export function resolveLoggerPhysicalLoading(
  options: readonly SmartWarmupLoading[],
  endpoint: LoggerPhysicalLoadingEndpoint,
): SmartWarmupLoading | null {
  const exactCanonical = options.find(
    (option) => Math.abs(option.total_kg - endpoint.canonicalWeightKg) < CANONICAL_WEIGHT_EPSILON_KG,
  );
  if (exactCanonical) return exactCanonical;

  const displayMatches = options.filter((option) => {
    const displayWeight = Number(formatLoggerWeightKg(option.total_kg, endpoint.requestedUnit));
    return Number.isFinite(displayWeight)
      && Math.abs(displayWeight - endpoint.requestedWeight) < DISPLAY_WEIGHT_EPSILON;
  });
  if (!displayMatches.length) return null;

  return displayMatches.reduce((closest, option) => (
    Math.abs(option.total_kg - endpoint.canonicalWeightKg)
      < Math.abs(closest.total_kg - endpoint.canonicalWeightKg)
      ? option
      : closest
  ));
}
