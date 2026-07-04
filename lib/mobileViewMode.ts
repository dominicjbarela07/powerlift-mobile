import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export type MobileViewMode = 'coach' | 'athlete' | 'individual';

export const MOBILE_VIEW_MODE_KEY = 'mobile_view_mode';
const MOBILE_VIEW_MODE_CHANGED = 'mobile_view_mode_changed';

function normalizeMode(value: string | null): MobileViewMode {
  if (value === 'individual') return 'individual';
  return value === 'athlete' ? 'athlete' : 'coach';
}

export async function getMobileViewMode(isCoach: boolean): Promise<MobileViewMode> {
  if (!isCoach) return 'athlete';

  try {
    return normalizeMode(await AsyncStorage.getItem(MOBILE_VIEW_MODE_KEY));
  } catch {
    return 'coach';
  }
}

export async function saveMobileViewMode(mode: MobileViewMode) {
  await AsyncStorage.setItem(MOBILE_VIEW_MODE_KEY, mode);
  DeviceEventEmitter.emit(MOBILE_VIEW_MODE_CHANGED, mode);
}

export function subscribeMobileViewModeChanged(callback: (mode: MobileViewMode) => void) {
  const subscription = DeviceEventEmitter.addListener(MOBILE_VIEW_MODE_CHANGED, callback);
  return () => subscription.remove();
}
