import { KG_PER_LB } from './logger-weight-format.js';
import { normalizeDisplayWeightUnit } from './display-units';

export type ReadinessDisplayUnit = 'kg' | 'lb';

export type ReadinessFormValues = {
  sleepPosition: number;
  energyPosition: number;
  sorenessPosition: number;
  stressPosition: number;
  bodyweight: string;
  bodyweightSkipped: boolean;
};

export type ReadinessPayload = {
  sleep_hours: number;
  energy: number;
  soreness: number;
  stress: number;
  bodyweight_kg: number | null;
};

const MIN_BODYWEIGHT_KG = 25;
const MAX_BODYWEIGHT_KG = 350;
export const MIN_SLEEP_HOURS = 3;
export const MAX_SLEEP_HOURS = 12;

export function clampReadinessPosition(value: number): number {
  return Math.max(0, Math.min(1, Number(value)));
}

export function readinessPositionFromRailX(x: number, railWidth: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(railWidth) || railWidth <= 0) return 0;
  return clampReadinessPosition(x / railWidth);
}

export function normalizedReadinessToCanonical(value: number): number {
  return Math.round(clampReadinessPosition(value) * 4) + 1;
}

export function readinessPositionFromCanonical(value: number | null | undefined, fallback = 0.5): number {
  if (value == null) return clampReadinessPosition(fallback);
  const canonical = Number(value);
  if (!Number.isFinite(canonical)) return clampReadinessPosition(fallback);
  return clampReadinessPosition((canonical - 1) / 4);
}

export function continuousReadinessFromPosition(value: number): number {
  const raw = 1 + clampReadinessPosition(value) * 4;
  return Math.round(raw * 10) / 10;
}

export function sleepHoursFromPosition(value: number): number {
  const raw = MIN_SLEEP_HOURS + clampReadinessPosition(value) * (MAX_SLEEP_HOURS - MIN_SLEEP_HOURS);
  return Math.round(raw * 2) / 2;
}

export function sleepPositionFromHours(hours: number): number {
  return clampReadinessPosition((hours - MIN_SLEEP_HOURS) / (MAX_SLEEP_HOURS - MIN_SLEEP_HOURS));
}

export function readinessBoundary(value: number): number {
  return normalizedReadinessToCanonical(value) - 1;
}

export function crossedReadinessBoundary(previous: number, next: number): boolean {
  return readinessBoundary(previous) !== readinessBoundary(next);
}

export function shouldAnimateReadinessThumb(reduceMotion: boolean): boolean {
  return !reduceMotion;
}

export function normalizeReadinessUnit(value?: string | null): ReadinessDisplayUnit {
  return normalizeDisplayWeightUnit(value);
}

export function bodyweightDisplayToKg(
  raw: string,
  unit: ReadinessDisplayUnit,
): { value: number | null; error: string | null } {
  const normalized = String(raw || '').trim();
  if (!/^(?:\d+|\d*\.\d+)$/.test(normalized)) {
    return { value: null, error: 'Enter a valid body weight.' };
  }
  const displayValue = Number(normalized);
  const valueKg = unit === 'kg' ? displayValue : displayValue * KG_PER_LB;
  if (!Number.isFinite(valueKg) || valueKg < MIN_BODYWEIGHT_KG || valueKg > MAX_BODYWEIGHT_KG) {
    const range = unit === 'kg' ? '25–350 kg' : '55–772 lb';
    return { value: null, error: `Enter a body weight between ${range}.` };
  }
  return { value: Math.round(valueKg * 1000) / 1000, error: null };
}

export function bodyweightKgToDisplay(
  valueKg: number | null | undefined,
  unit: ReadinessDisplayUnit,
): string | null {
  if (valueKg == null || !Number.isFinite(Number(valueKg)) || Number(valueKg) <= 0) return null;
  const displayValue = unit === 'kg' ? Number(valueKg) : Number(valueKg) / KG_PER_LB;
  return displayValue.toFixed(1).replace(/\.0$/, '');
}

export function buildReadinessPayload(
  form: ReadinessFormValues,
  unit: ReadinessDisplayUnit,
): { payload: ReadinessPayload | null; error: string | null } {
  const positions = [form.sleepPosition, form.energyPosition, form.sorenessPosition, form.stressPosition];
  if (positions.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    return { payload: null, error: 'Complete each readiness check before beginning.' };
  }

  let bodyweightKg: number | null = null;
  if (!form.bodyweightSkipped) {
    const parsed = bodyweightDisplayToKg(form.bodyweight, unit);
    if (parsed.error) return { payload: null, error: parsed.error };
    bodyweightKg = parsed.value;
  }

  return {
    payload: {
      sleep_hours: sleepHoursFromPosition(form.sleepPosition),
      energy: continuousReadinessFromPosition(form.energyPosition),
      soreness: continuousReadinessFromPosition(form.sorenessPosition),
      stress: continuousReadinessFromPosition(form.stressPosition),
      bodyweight_kg: bodyweightKg,
    },
    error: null,
  };
}

export function createReadinessSubmissionGate() {
  let inFlight = false;
  return {
    async run(task: () => Promise<void>): Promise<boolean> {
      if (inFlight) return false;
      inFlight = true;
      try {
        await task();
        return true;
      } finally {
        inFlight = false;
      }
    },
    isInFlight: () => inFlight,
  };
}

export async function persistReadinessThenBegin(
  persist: () => Promise<void>,
  begin: () => void,
): Promise<void> {
  await persist();
  begin();
}
