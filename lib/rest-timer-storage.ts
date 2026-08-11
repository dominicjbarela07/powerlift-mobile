import AsyncStorage from '@react-native-async-storage/async-storage';

const REST_TIMER_STORAGE_PREFIX = 'strength-ledger:rest-timer:v1';

export type RestTimerExpiry = Readonly<{
  workoutId: string;
  endAtMs: number;
}>;

function storageKey(workoutId: string | number): string {
  return `${REST_TIMER_STORAGE_PREFIX}:${String(workoutId)}`;
}

export async function persistRestTimerExpiry(
  workoutId: string | number,
  endAtMs: number,
): Promise<void> {
  if (!Number.isFinite(endAtMs) || endAtMs <= Date.now()) {
    await clearRestTimerExpiry(workoutId);
    return;
  }
  const payload: RestTimerExpiry = {
    workoutId: String(workoutId),
    endAtMs,
  };
  await AsyncStorage.setItem(storageKey(workoutId), JSON.stringify(payload));
}

export async function loadRestTimerExpiry(
  workoutId: string | number,
  nowMs = Date.now(),
): Promise<RestTimerExpiry | null> {
  const key = storageKey(workoutId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RestTimerExpiry>;
    const endAtMs = Number(parsed.endAtMs);
    if (
      parsed.workoutId !== String(workoutId)
      || !Number.isFinite(endAtMs)
      || endAtMs <= nowMs
    ) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return Object.freeze({
      workoutId: String(workoutId),
      endAtMs,
    });
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function clearRestTimerExpiry(
  workoutId: string | number,
): Promise<void> {
  await AsyncStorage.removeItem(storageKey(workoutId));
}
