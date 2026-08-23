/** Presentation-only precision for calculated/estimated weight evidence. */
export const KG_TO_LB = 2.2046226218;

export function roundCalculatedWeightForDisplay(value, unit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number.NaN;
  if (unit !== 'lb') return numeric;
  const sign = numeric < 0 ? -1 : 1;
  return sign * (Math.round(Math.abs(numeric) * 2) / 2);
}

export function formatCalculatedWeightValue(value, unit) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const rounded = roundCalculatedWeightForDisplay(Number(value), unit);
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(rounded);
}

export function formatCalculatedWeightFromKgValue(valueKg, unit) {
  if (valueKg == null || !Number.isFinite(Number(valueKg))) return null;
  const displayValue = unit === 'lb' ? Number(valueKg) * KG_TO_LB : Number(valueKg);
  return formatCalculatedWeightValue(displayValue, unit);
}
