export type SessionLoggerPayloadShape = {
  workout?: {
    id?: string | number | null;
    status?: string | null;
    core_items?: unknown[] | null;
    accessory_groups?: { items?: unknown[] | null }[] | null;
  } | null;
};

export type SessionLoggerPayloadValidation =
  | { ok: true; movementCount: number }
  | {
      ok: false;
      reason:
        | 'missing_workout'
        | 'wrong_workout'
        | 'invalid_movement_collections'
        | 'movement_collection_regressed';
    };

export function sessionLoggerMovementCount(
  payload: SessionLoggerPayloadShape | null | undefined,
): number {
  const workout = payload?.workout;
  if (!workout) return 0;
  const coreCount = Array.isArray(workout.core_items) ? workout.core_items.length : 0;
  const accessoryCount = Array.isArray(workout.accessory_groups)
    ? workout.accessory_groups.reduce(
        (total, group) => total + (Array.isArray(group?.items) ? group.items.length : 0),
        0,
      )
    : 0;
  return coreCount + accessoryCount;
}

/**
 * A foreground refresh may replace the currently rendered Session only when it
 * is structurally complete and still belongs to the active route. A transient
 * empty response must never erase a known-good active Logger body.
 */
export function validateSessionLoggerPayload(args: {
  candidate: SessionLoggerPayloadShape | null | undefined;
  current: SessionLoggerPayloadShape | null | undefined;
  requestedWorkoutId: string;
}): SessionLoggerPayloadValidation {
  const { candidate, current, requestedWorkoutId } = args;
  const workout = candidate?.workout;
  if (!workout) return { ok: false, reason: 'missing_workout' };
  if (String(workout.id) !== requestedWorkoutId) {
    return { ok: false, reason: 'wrong_workout' };
  }
  if (
    !Array.isArray(workout.core_items)
    || !Array.isArray(workout.accessory_groups)
    || workout.accessory_groups.some((group) => !Array.isArray(group?.items))
  ) {
    return { ok: false, reason: 'invalid_movement_collections' };
  }

  const movementCount = sessionLoggerMovementCount(candidate);
  const currentIsSameWorkout = String(current?.workout?.id) === requestedWorkoutId;
  if (
    currentIsSameWorkout
    && sessionLoggerMovementCount(current) > 0
    && movementCount === 0
  ) {
    return { ok: false, reason: 'movement_collection_regressed' };
  }

  return { ok: true, movementCount };
}

export function createSessionLoggerRecoveryGate(options?: {
  maxBodyRecoveryAttempts?: number;
  lifecycleDedupeMs?: number;
}) {
  const maxBodyRecoveryAttempts = Math.max(1, options?.maxBodyRecoveryAttempts ?? 1);
  const lifecycleDedupeMs = Math.max(0, options?.lifecycleDedupeMs ?? 600);
  let bodyRecoveryAttempts = 0;
  let lastLifecycleRecoveryAt = Number.NEGATIVE_INFINITY;

  return {
    beginLifecycleRecovery(nowMs: number): boolean {
      if (nowMs - lastLifecycleRecoveryAt < lifecycleDedupeMs) return false;
      lastLifecycleRecoveryAt = nowMs;
      bodyRecoveryAttempts = 0;
      return true;
    },
    acquireBodyRecovery(): boolean {
      if (bodyRecoveryAttempts >= maxBodyRecoveryAttempts) return false;
      bodyRecoveryAttempts += 1;
      return true;
    },
    markBodyHealthy(): void {
      bodyRecoveryAttempts = 0;
    },
    reset(): void {
      bodyRecoveryAttempts = 0;
      lastLifecycleRecoveryAt = Number.NEGATIVE_INFINITY;
    },
  };
}
