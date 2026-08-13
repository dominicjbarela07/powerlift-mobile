export const KG_PER_LB = 0.45359237;
export const LBS_INCREMENT_THRESHOLD = 150;
export const LBS_INCREMENT_BELOW_THRESHOLD = 2.5;
export const LBS_INCREMENT_AT_OR_ABOVE_THRESHOLD = 5;
export const KG_INCREMENT_THRESHOLD = 70;
export const KG_INCREMENT_BELOW_THRESHOLD = 1.25;
export const KG_INCREMENT_AT_OR_ABOVE_THRESHOLD = 2.5;

function roundHalfUp(value, step) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(step)) || step <= 0) {
    return Number(value);
  }
  const sign = Number(value) < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(Number(value)) / step) + 0.5) * step;
}

export function loggerWeightIncrement(value, displayUnit) {
  const magnitude = Math.abs(Number(value));
  if (displayUnit === 'lb') {
    return magnitude < LBS_INCREMENT_THRESHOLD
      ? LBS_INCREMENT_BELOW_THRESHOLD
      : LBS_INCREMENT_AT_OR_ABOVE_THRESHOLD;
  }
  return magnitude < KG_INCREMENT_THRESHOLD
    ? KG_INCREMENT_BELOW_THRESHOLD
    : KG_INCREMENT_AT_OR_ABOVE_THRESHOLD;
}

export function roundLoggerDisplayWeight(value, displayUnit) {
  return roundHalfUp(Number(value), loggerWeightIncrement(value, displayUnit));
}

export function roundToNearestGymIncrementLb(value) {
  return roundLoggerDisplayWeight(value, 'lb');
}

export function roundToNearestGymIncrementKg(value) {
  return roundLoggerDisplayWeight(value, 'kg');
}

function compact(value) {
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function formatLoggerWeightKg(weightKg, displayUnit) {
  if (weightKg == null || !Number.isFinite(Number(weightKg))) return '?';
  const converted = displayUnit === 'kg'
    ? Number(weightKg)
    : Number(weightKg) / KG_PER_LB;
  return compact(roundLoggerDisplayWeight(converted, displayUnit));
}

export function formatLoggerWeightRangeKg(lowKg, highKg, displayUnit) {
  if (
    lowKg == null ||
    highKg == null ||
    !Number.isFinite(Number(lowKg)) ||
    !Number.isFinite(Number(highKg))
  ) {
    return null;
  }
  const low = formatLoggerWeightKg(Number(lowKg), displayUnit);
  const high = formatLoggerWeightKg(Number(highKg), displayUnit);
  return low === high
    ? `${low} ${displayUnit}`
    : `${low}–${high} ${displayUnit}`;
}

export function formatLoggerWeightDeltaKg(deltaKg, displayUnit) {
  if (deltaKg == null || !Number.isFinite(Number(deltaKg))) return null;
  const converted = displayUnit === 'kg'
    ? Number(deltaKg)
    : Number(deltaKg) / KG_PER_LB;
  return compact(roundLoggerDisplayWeight(converted, displayUnit));
}
