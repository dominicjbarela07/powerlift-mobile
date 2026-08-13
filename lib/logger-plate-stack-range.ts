import type { CoachDisplayUnit } from '@/lib/coach-session-editor';
import { KG_PER_LB, roundLoggerDisplayWeight } from '@/lib/logger-weight-format';

export type LoggerPlateStackRange = {
  low: number;
  high: number;
};

type CalculatedLoadRange = {
  lowKg?: number | null;
  highKg?: number | null;
};

function displayWeight(weightKg: number, unit: CoachDisplayUnit) {
  const converted = unit === 'lb' ? weightKg / KG_PER_LB : weightKg;
  return roundLoggerDisplayWeight(converted, unit);
}

export function calculatedLoggerPlateStackRange(
  calculated: CalculatedLoadRange | null,
  unit: CoachDisplayUnit,
): LoggerPlateStackRange | null {
  const lowKg = Number(calculated?.lowKg ?? calculated?.highKg);
  const highKg = Number(calculated?.highKg ?? calculated?.lowKg);
  if (!Number.isFinite(lowKg) || !Number.isFinite(highKg) || lowKg <= 0 || highKg <= 0) return null;
  const low = displayWeight(Math.min(lowKg, highKg), unit);
  const high = displayWeight(Math.max(lowKg, highKg), unit);
  return { low, high };
}

export function manualLoggerPlateStackRange(
  targetValue: string | number,
  marginValue: string | number,
): LoggerPlateStackRange | null {
  const target = Number(targetValue);
  const margin = Math.max(0, Number(marginValue) || 0);
  if (!Number.isFinite(target) || target <= 0) return null;
  return {
    low: Math.max(0, target - margin),
    high: target + margin,
  };
}

export function loggerPlateStackEndpoints(range: LoggerPlateStackRange) {
  return Math.abs(range.high - range.low) < 0.001
    ? [range.low]
    : [range.low, range.high];
}
