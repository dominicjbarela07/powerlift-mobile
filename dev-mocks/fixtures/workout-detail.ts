export type WorkoutDetailLifecycle = 'pre_session' | 'active_session' | 'post_session';

export function workoutDetailLifecycleForEntryId(_entryId: string | null | undefined): WorkoutDetailLifecycle | null {
  return null;
}

export function normalizeWorkoutDetailLifecycle(value: string | null | undefined): WorkoutDetailLifecycle | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'pre' || normalized === 'pre_session') return 'pre_session';
  if (normalized === 'active' || normalized === 'active_session') return 'active_session';
  if (normalized === 'post' || normalized === 'post_session') return 'post_session';
  return null;
}

export function createWorkoutDetailFixture(): never {
  throw new Error('DEV workout fixtures are not included in release builds.');
}

export function hydrateWorkoutDetailEquipmentSelections<T>(payload: T): T { return payload; }
export function rememberWorkoutDetailEquipmentSelection() {}
export function workoutDetailMachineIdentityChoices(
  _query = '',
  _familyId?: number | null,
  _familyDisplayName?: string | null,
  _movementDefinitionId?: number | null,
): never[] { return []; }
export function workoutDetailMachineVariantIdentity(): null { return null; }
export function applyWorkoutDetailMachineIdentity<T>(item: T): T { return item; }
