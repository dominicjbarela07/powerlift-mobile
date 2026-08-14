export const REST_TIMER_OPTIONS_SECONDS = Object.freeze(
  Array.from({ length: 12 }, (_, index) => (index + 1) * 30),
) as readonly number[];

export const DEFAULT_REST_TIMER_SECONDS = 120;

const REST_TIMER_PREFERENCE_STORAGE_PREFIX =
  'strength-ledger:rest-timer-preference:v1:user';

export function restTimerPreferenceStorageKey(
  ownerUserId: string | number | null | undefined,
): string | null {
  const normalizedOwnerUserId = String(ownerUserId ?? '').trim();
  if (!normalizedOwnerUserId) return null;
  return `${REST_TIMER_PREFERENCE_STORAGE_PREFIX}:${encodeURIComponent(normalizedOwnerUserId)}`;
}

export function normalizeRestTimerSeconds(
  value: unknown,
  options: readonly number[] = REST_TIMER_OPTIONS_SECONDS,
  fallback = DEFAULT_REST_TIMER_SECONDS,
): number {
  const validOptions = options
    .map(Number)
    .filter((option) => Number.isFinite(option) && option > 0);
  if (!validOptions.length) return fallback;

  const numericValue = Number(value);
  const target = Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : fallback;

  return validOptions.reduce((nearest, option) =>
    Math.abs(option - target) < Math.abs(nearest - target) ? option : nearest,
  validOptions[0]);
}

export function resolveRestTimerPickerInitialSeconds(input: {
  activeTimerSeconds?: unknown;
  sessionSelectedSeconds?: unknown;
  prescribedSeconds?: unknown;
  lastUsedSeconds?: unknown;
  options?: readonly number[];
  fallback?: number;
}): number {
  const options = input.options ?? REST_TIMER_OPTIONS_SECONDS;
  const fallback = input.fallback ?? DEFAULT_REST_TIMER_SECONDS;
  const candidates = [
    input.activeTimerSeconds,
    input.sessionSelectedSeconds,
    input.prescribedSeconds,
    input.lastUsedSeconds,
  ];
  const selected = candidates.find((candidate) => {
    const numericCandidate = Number(candidate);
    return Number.isFinite(numericCandidate) && numericCandidate > 0;
  });
  return normalizeRestTimerSeconds(selected, options, fallback);
}
