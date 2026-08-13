export type SessionDurationExercise = {
  sets: number;
  reps?: number | null;
  plannedReps?: Array<number | null>;
  variant?: string | null;
  targetRpe?: number | null;
  targetRir?: number | null;
  isCore: boolean;
  supersetGroup?: string | null;
};

export type SessionDurationEstimate = {
  lowMinutes: number;
  highMinutes: number;
  label: string;
  modelVersion: 'deterministic-v1';
};

type MinuteRange = { low: number; high: number };

const SESSION_SETUP: MinuteRange = { low: 4, high: 6 };
const FIRST_CORE_WARMUP: MinuteRange = { low: 8, high: 12 };
const LATER_CORE_WARMUP: MinuteRange = { low: 5, high: 8 };
const ACCESSORY_WARMUP: MinuteRange = { low: 1, high: 3 };
const EXERCISE_TRANSITION: MinuteRange = { low: 2, high: 4 };

function finitePositive(value: number | null | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function effortScore(exercise: SessionDurationExercise) {
  if (exercise.targetRpe != null && Number.isFinite(exercise.targetRpe)) return exercise.targetRpe;
  if (exercise.targetRir != null && Number.isFinite(exercise.targetRir)) return 10 - exercise.targetRir;
  return exercise.isCore ? 8 : 7;
}

function restRange(exercise: SessionDurationExercise): MinuteRange {
  const effort = effortScore(exercise);
  const variant = String(exercise.variant || '').toUpperCase();
  const isPeakSet = variant === 'TOP' || variant === 'AMRAP';

  if (exercise.isCore) {
    if (isPeakSet || effort >= 9) return { low: 3, high: 5 };
    if (effort >= 8) return { low: 2.5, high: 4 };
    return { low: 2, high: 3 };
  }

  if (effort >= 9) return { low: 1.5, high: 2.5 };
  return { low: 1, high: 2 };
}

function setExecutionRange(exercise: SessionDurationExercise): MinuteRange {
  const plannedReps = exercise.plannedReps?.filter((value): value is number => value != null && value > 0) || [];
  const averageReps = plannedReps.length
    ? plannedReps.reduce((sum, value) => sum + value, 0) / plannedReps.length
    : finitePositive(exercise.reps, exercise.isCore ? 5 : 10);

  // Includes unracking/setup plus roughly 3-5 seconds of controlled work per rep.
  return {
    low: 0.25 + (averageReps * 3) / 60,
    high: 0.5 + (averageReps * 5) / 60,
  };
}

function roundDownToFive(value: number) {
  return Math.floor(value / 5) * 5;
}

function roundUpToFive(value: number) {
  return Math.ceil(value / 5) * 5;
}

/**
 * Deterministic baseline. Its component boundaries intentionally allow a future
 * athlete-history calibration layer to adjust each contribution independently.
 */
export function estimateSessionDuration(exercises: SessionDurationExercise[]): SessionDurationEstimate | null {
  const valid = exercises.filter((exercise) => exercise.sets > 0);
  if (!valid.length) return null;

  let low = SESSION_SETUP.low;
  let high = SESSION_SETUP.high;
  let coreIndex = 0;

  valid.forEach((exercise, exerciseIndex) => {
    const warmup = exercise.isCore
      ? coreIndex++ === 0 ? FIRST_CORE_WARMUP : LATER_CORE_WARMUP
      : ACCESSORY_WARMUP;
    low += warmup.low;
    high += warmup.high;

    const execution = setExecutionRange(exercise);
    low += execution.low * exercise.sets;
    high += execution.high * exercise.sets;

    const rest = restRange(exercise);
    const restPeriods = Math.max(0, exercise.sets - 1);
    low += rest.low * restPeriods;
    high += rest.high * restPeriods;

    if (exerciseIndex > 0) {
      const sharesSuperset = Boolean(
        exercise.supersetGroup &&
        exercise.supersetGroup === valid[exerciseIndex - 1]?.supersetGroup,
      );
      low += sharesSuperset ? 0.5 : EXERCISE_TRANSITION.low;
      high += sharesSuperset ? 1 : EXERCISE_TRANSITION.high;
    }
  });

  const lowMinutes = Math.max(20, roundDownToFive(low));
  const highMinutes = Math.max(lowMinutes + 5, roundUpToFive(high));
  return {
    lowMinutes,
    highMinutes,
    label: `${lowMinutes}–${highMinutes}`,
    modelVersion: 'deterministic-v1',
  };
}
