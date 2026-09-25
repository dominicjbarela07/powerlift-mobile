import { formatWeightFromKg, type DisplayWeightUnit } from './display-units';

/** Bodyweight is a reported measurement, not a plate load rounded to an increment. */
export function reportedBodyweightNumber(valueKg: number | null | undefined, unit: DisplayWeightUnit): string | null {
  return formatWeightFromKg(valueKg, unit)?.replace(/ (?:kg|lb)$/, '') ?? null;
}

/** A training date has no timezone; parse it at local noon to retain its calendar day. */
export function reportedBodyweightDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
