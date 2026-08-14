import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeRestTimerSeconds,
  restTimerPreferenceStorageKey,
} from '@/lib/rest-timer-preference-core';

type StoredRestTimerPreference = Readonly<{
  ownerUserId: string;
  seconds: number;
}>;

export async function loadLastUsedRestTimerSeconds(
  ownerUserId: string | number | null | undefined,
): Promise<number | null> {
  const key = restTimerPreferenceStorageKey(ownerUserId);
  if (!key) return null;

  const normalizedOwnerUserId = String(ownerUserId).trim();
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredRestTimerPreference>;
    const parsedSeconds = Number(parsed.seconds);
    if (
      String(parsed.ownerUserId ?? '') !== normalizedOwnerUserId
      || !Number.isFinite(parsedSeconds)
      || parsedSeconds <= 0
    ) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return normalizeRestTimerSeconds(parsedSeconds);
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function persistLastUsedRestTimerSeconds(
  ownerUserId: string | number | null | undefined,
  seconds: number,
): Promise<number | null> {
  const key = restTimerPreferenceStorageKey(ownerUserId);
  if (!key) return null;

  const normalizedSeconds = normalizeRestTimerSeconds(seconds);
  const preference: StoredRestTimerPreference = {
    ownerUserId: String(ownerUserId).trim(),
    seconds: normalizedSeconds,
  };
  await AsyncStorage.setItem(key, JSON.stringify(preference));
  return normalizedSeconds;
}
