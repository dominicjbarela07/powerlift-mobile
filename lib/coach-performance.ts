import type { LedgerProgression } from '@/lib/ledger-data';

export type CoachingPeriod = '30d' | '90d' | '180d';
export type CoachingPerformance = LedgerProgression & {
  projection_version: 'coach-performance-v2';
  workspace_subject: { subject_key: string; athlete_id: number; coach_user_id: number };
  coaching_context: {
    period_days: number;
    working_sets: number;
    volume_kg: number;
    volume_change_pct: number | null;
    frequency_per_week: number;
    comparison: { start_date: string; end_date: string; set_count: number; volume_kg: number };
    weekly: { date: string; set_count: number; volume_kg: number; session_count: number }[];
    bodyweight: { training_date: string; reported_bodyweight_kg: number }[];
    readiness: { date: string; value: number }[];
    latest_readiness: { date: string; sleep_hours: number | null; sleep_quality: number | null; soreness: number | null; stress: number | null; energy: number | null } | null;
  };
};

export function acceptsCoachingPerformance(data: CoachingPerformance | null | undefined, subject: string, athleteId: number): data is CoachingPerformance {
  return Boolean(data && data.projection_version === 'coach-performance-v2'
    && data.workspace_subject?.subject_key === subject
    && data.workspace_subject?.athlete_id === athleteId
    && data.athlete?.id === athleteId);
}

export function coachingTotalChange(data: CoachingPerformance | null) {
  const lifts = data?.big_three_arc?.lifts || [];
  // One observation establishes a level, never a trajectory.
  return lifts.length === 3 && lifts.every((lift) => (lift.points?.length || 0) >= 2)
    ? data?.big_three_arc?.estimated_total_change_kg ?? null : null;
}

export function workspaceLedgerParams(athleteId: number, destination = 'performance') {
  return {
    athleteId: String(athleteId), athlete_id: String(athleteId),
    workspaceAthleteId: String(athleteId), returnToWorkspace: '1', workspaceReturn: destination,
  };
}
