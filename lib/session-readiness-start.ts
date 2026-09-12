import type { CanonicalDailyReadinessObservation } from './daily-readiness-home';

export type SessionReadinessObservation = CanonicalDailyReadinessObservation & {
  athlete_id?: number | null;
  score?: number | null;
};

/** Use the server's exact Session association or its explicit Session-less day row. */
export function applicableSessionReadiness(
  observation: SessionReadinessObservation | null | undefined,
  subject: { workoutId: number; athleteId: number; date: string },
): observation is SessionReadinessObservation {
  if (!observation?.id || observation.date !== subject.date) return false;
  if (observation.athlete_id != null && observation.athlete_id !== subject.athleteId) return false;
  if (observation.workout_id != null && observation.workout_id !== subject.workoutId) return false;
  const score = observation.readiness_score ?? observation.score;
  return typeof score === 'number' && Number.isFinite(score) && score >= 0;
}

/** A synchronous intent lock spans lookup, human choice, persistence and start. */
export function createSessionReadinessStartGate() {
  type Intent = { scope: string; workoutId: number; preview: boolean };
  let current: Intent | null = null;
  let working = false;
  return {
    open(intent: Intent) {
      if (current || working) return null;
      current = intent;
      return intent;
    },
    current: () => current,
    isCurrent: (intent: Intent | null) => intent != null && current === intent,
    isWorking: () => working,
    cancel() {
      if (working) return false;
      current = null;
      return true;
    },
    invalidate() { current = null; },
    async choose(intent: Intent, persist: (() => Promise<void>) | null, begin: () => Promise<void>) {
      if (current !== intent || working || intent.preview) return false;
      working = true;
      try {
        if (persist) await persist();
        if (current !== intent) return false;
        await begin();
        if (current === intent) current = null;
        return true;
      } finally {
        working = false;
      }
    },
  };
}
