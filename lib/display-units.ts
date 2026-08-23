import {
  formatCalculatedWeightValue as formatCalculatedWeightValueBase,
  roundCalculatedWeightForDisplay as roundCalculatedWeightForDisplayBase,
} from './calculated-weight-format.js';

export type DisplayWeightUnit = 'kg' | 'lb';

export const KG_TO_LB = 2.2046226218;
export const DEFAULT_DISPLAY_WEIGHT_UNIT: DisplayWeightUnit = 'lb';

export function parseDisplayWeightUnit(value?: string | null): DisplayWeightUnit | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'kg' || normalized === 'kgs') return 'kg';
  if (normalized === 'lb' || normalized === 'lbs') return 'lb';
  return null;
}

export function normalizeDisplayWeightUnit(
  value?: string | null,
  fallback: DisplayWeightUnit = DEFAULT_DISPLAY_WEIGHT_UNIT,
): DisplayWeightUnit {
  return parseDisplayWeightUnit(value) || fallback;
}

export function resolveDisplayWeightUnit({
  localOverride,
  viewerPreference,
  fallback = DEFAULT_DISPLAY_WEIGHT_UNIT,
}: {
  localOverride?: string | null;
  viewerPreference?: string | null;
  fallback?: DisplayWeightUnit;
}): DisplayWeightUnit {
  return parseDisplayWeightUnit(localOverride)
    || parseDisplayWeightUnit(viewerPreference)
    || fallback;
}

export function preferredUnitFromSettingsPayload(payload: unknown): DisplayWeightUnit | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, any>;
  const profile = root.training_profile;
  return parseDisplayWeightUnit(
    profile?.preferred_units
      ?? profile?.context?.preferred_units
      ?? root.user?.preferred_units
      ?? root.settings?.preferred_units
      ?? root.preferred_units,
  );
}

export function kilogramsToDisplayValue(valueKg: number, unit: DisplayWeightUnit): number {
  return unit === 'lb' ? Number(valueKg) * KG_TO_LB : Number(valueKg);
}

/**
 * Presentation-only precision for calculated/estimated weight evidence.
 * Pounds use the platform-law 0.5 lb precision. Kilograms retain the
 * established one-decimal presentation rule. Never use this for stored data,
 * prescriptions, performed set loads, or bar-loading mechanics.
 */
export function roundCalculatedWeightForDisplay(
  value: number,
  unit: DisplayWeightUnit,
): number {
  return roundCalculatedWeightForDisplayBase(value, unit);
}

export function formatCalculatedWeightValue(
  value: number | null | undefined,
  unit: DisplayWeightUnit,
): string | null {
  return formatCalculatedWeightValueBase(value, unit);
}

export function formatCalculatedWeightFromKg(
  valueKg: number | null | undefined,
  unit: DisplayWeightUnit = DEFAULT_DISPLAY_WEIGHT_UNIT,
): string | null {
  if (valueKg == null || !Number.isFinite(Number(valueKg)) || Number(valueKg) <= 0) return null;
  const formatted = formatCalculatedWeightValue(
    kilogramsToDisplayValue(Number(valueKg), unit),
    unit,
  );
  return formatted == null ? null : `${formatted} ${unit}`;
}

export function formatCalculatedWeightDeltaFromKg(
  deltaKg: number | null | undefined,
  unit: DisplayWeightUnit = DEFAULT_DISPLAY_WEIGHT_UNIT,
  signStyle: 'arrow' | 'signed' = 'arrow',
): string | null {
  if (deltaKg == null || !Number.isFinite(Number(deltaKg))) return null;
  const numeric = Number(deltaKg);
  const formatted = formatCalculatedWeightValue(
    kilogramsToDisplayValue(Math.abs(numeric), unit),
    unit,
  );
  if (formatted == null) return null;
  if (signStyle === 'signed') {
    const sign = numeric > 0 ? '+' : numeric < 0 ? '-' : '';
    return `${sign}${formatted} ${unit}`;
  }
  const arrow = numeric < 0 ? '↓' : numeric > 0 ? '↑' : '→';
  return `${arrow} ${formatted} ${unit}`;
}

export function formatWeightFromKg(
  valueKg?: number | null,
  unit: DisplayWeightUnit = DEFAULT_DISPLAY_WEIGHT_UNIT,
  maximumFractionDigits = 1,
): string | null {
  if (valueKg == null || !Number.isFinite(Number(valueKg)) || Number(valueKg) <= 0) return null;
  const value = kilogramsToDisplayValue(Number(valueKg), unit);
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value)} ${unit}`;
}

export function formatWeightDeltaFromKg(
  deltaKg?: number | null,
  unit: DisplayWeightUnit = DEFAULT_DISPLAY_WEIGHT_UNIT,
): string | null {
  if (deltaKg == null || !Number.isFinite(Number(deltaKg))) return null;
  const value = kilogramsToDisplayValue(Math.abs(Number(deltaKg)), unit);
  const arrow = Number(deltaKg) < 0 ? '↓' : Number(deltaKg) > 0 ? '↑' : '→';
  return `${arrow} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

export function formatCompactVolumeValueFromKg(
  valueKg?: number | null,
  unit: DisplayWeightUnit = DEFAULT_DISPLAY_WEIGHT_UNIT,
): string | null {
  if (valueKg == null || !Number.isFinite(Number(valueKg)) || Number(valueKg) <= 0) return null;
  const converted = kilogramsToDisplayValue(Number(valueKg), unit);
  const value = converted >= 1000
    ? `${(converted / 1000).toFixed(1)}K`
    : Math.round(converted).toLocaleString('en-US');
  return `${value} ${unit}`;
}

export function convertDisplayWeightValue(
  value: number,
  sourceUnit: DisplayWeightUnit,
  targetUnit: DisplayWeightUnit,
): number {
  if (sourceUnit === targetUnit) return Number(value);
  return sourceUnit === 'kg' ? Number(value) * KG_TO_LB : Number(value) / KG_TO_LB;
}

export function formatCompactWeightFromKg(
  valueKg?: number | null,
  unit: DisplayWeightUnit = DEFAULT_DISPLAY_WEIGHT_UNIT,
): string | null {
  if (valueKg == null || !Number.isFinite(Number(valueKg)) || Number(valueKg) <= 0) return null;
  const converted = kilogramsToDisplayValue(Number(valueKg), unit);
  const value = converted >= 10_000
    ? `${(converted / 1000).toFixed(1)}K`
    : Math.round(converted).toLocaleString('en-US');
  return `${value} ${unit}`;
}

export function formatTotalVolumeFromKg(
  valueKg?: number | null,
  unit: DisplayWeightUnit = DEFAULT_DISPLAY_WEIGHT_UNIT,
): string | null {
  const volume = formatCompactVolumeValueFromKg(valueKg, unit);
  return volume ? `${volume} Total Volume` : null;
}

export function formatSessionVolumeSummary({
  loggedSetCount,
  totalVolumeKg,
  unit,
}: {
  loggedSetCount?: number | null;
  totalVolumeKg?: number | null;
  unit: DisplayWeightUnit;
}): string | null {
  const parts = [
    loggedSetCount ? `${loggedSetCount} sets` : null,
    formatTotalVolumeFromKg(totalVolumeKg, unit),
  ].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(' · ') : null;
}
