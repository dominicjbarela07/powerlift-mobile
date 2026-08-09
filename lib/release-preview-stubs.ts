import type { AuthUser } from '@/context/AuthContext';
import type { Href } from 'expo-router';

type WorkoutDetailLifecycle = 'pre_session' | 'active_session' | 'post_session';

export function isProductionIdealStateActive(): false {
  return false;
}

export function productionIdealAuthUser(): AuthUser | undefined {
  return undefined;
}

export function resolveProductionIdealRequest<T = unknown>(
  _path?: string,
  _init?: RequestInit,
): null {
  return null;
}

type ReleasePreviewSession = {
  entryId: string;
  title: string;
  mode: 'live' | 'ideal';
  contextLabel?: string;
  returnHref: Href;
};

export function useDevLiveScreenSession(): ReleasePreviewSession | null {
  return null;
}

export function workoutDetailLifecycleForEntryId(): null {
  return null;
}

export function normalizeWorkoutDetailLifecycle(
  value: string | null | undefined,
): WorkoutDetailLifecycle | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'pre' || normalized === 'pre_session') return 'pre_session';
  if (normalized === 'active' || normalized === 'active_session') return 'active_session';
  if (normalized === 'post' || normalized === 'post_session') return 'post_session';
  return null;
}

export const workoutDetailMachineIdentityChoices: (...args: any[]) => any[] = () => [];
export const workoutDetailMachineVariantIdentity: (...args: any[]) => null = () => null;
export const rememberWorkoutDetailEquipmentSelection: (...args: any[]) => void = () => {};

export function applyWorkoutDetailMachineIdentity<T>(value: T): T {
  return value;
}

export function hydrateWorkoutDetailEquipmentSelections<T>(value: T): T {
  return value;
}

export function createWorkoutDetailFixture(): never {
  throw new Error('Development workout fixtures are not available in release builds.');
}
