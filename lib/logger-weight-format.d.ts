export type LoggerDisplayUnit = 'kg' | 'lb';
export const KG_PER_LB: number;
export const LBS_INCREMENT_THRESHOLD: number;
export const LBS_INCREMENT_BELOW_THRESHOLD: number;
export const LBS_INCREMENT_AT_OR_ABOVE_THRESHOLD: number;
export const KG_INCREMENT_THRESHOLD: number;
export const KG_INCREMENT_BELOW_THRESHOLD: number;
export const KG_INCREMENT_AT_OR_ABOVE_THRESHOLD: number;
export function loggerWeightIncrement(value: number, displayUnit: LoggerDisplayUnit): number;
export function roundLoggerDisplayWeight(value: number, displayUnit: LoggerDisplayUnit): number;
export function roundToNearestGymIncrementLb(value: number): number;
export function roundToNearestGymIncrementKg(value: number): number;
export function formatLoggerWeightKg(weightKg: number | null | undefined, displayUnit: LoggerDisplayUnit): string;
export function formatLoggerWeightRangeKg(
  lowKg: number | null | undefined,
  highKg: number | null | undefined,
  displayUnit: LoggerDisplayUnit,
): string | null;
export function formatLoggerWeightDeltaKg(deltaKg: number | null | undefined, displayUnit: LoggerDisplayUnit): string | null;
