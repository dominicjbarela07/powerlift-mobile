import { KG_PER_LB, formatLoggerWeightKg } from '@/lib/logger-weight-format';

/** Keep visible Set-sheet prescription copy in the same unit as its picker. */
export function convertLoggerPrescriptionUnit(
  value: string | null | undefined,
  nextUnit: 'kg' | 'lb',
): string | null {
  if (!value) return null;
  return value.replace(/([\d,]+(?:\.\d+)?)\s*(kg|lb)\b/gi, (_match, rawValue: string, sourceUnit: string) => {
    const numericValue = Number(rawValue.replaceAll(',', ''));
    if (!Number.isFinite(numericValue)) return _match;
    const weightKg = sourceUnit.toLowerCase() === 'kg' ? numericValue : numericValue * KG_PER_LB;
    return `${formatLoggerWeightKg(weightKg, nextUnit)} ${nextUnit}`;
  });
}
