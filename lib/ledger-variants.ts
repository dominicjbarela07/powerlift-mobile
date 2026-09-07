import { fetchJson } from '@/lib/api';

export type CoreVariantFamily = 'squat' | 'bench' | 'deadlift';

export type CoreVariantSetEvidence = Readonly<{
  set_log_id: number;
  workout_id: number;
  date: string;
  weight_kg: number;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
  training_block_name?: string | null;
}>;

export type CoreVariantProgression = Readonly<{
  kind: 'more_weight_same_reps' | 'more_reps_same_weight' | 'lower_effort_same_task';
  load_delta_kg: number;
  reps_delta: number;
  effort_delta?: number | null;
  effort_kind?: 'rpe' | 'rir' | null;
  current: CoreVariantSetEvidence;
  prior: CoreVariantSetEvidence;
  occurred_on: string;
  workout_id: number;
  training_block_id?: number | null;
  training_block_name?: string | null;
}>;

export type CoreVariantBlockUsage = Readonly<{
  block_id: number;
  block_name: string;
  start_date?: string | null;
  end_date?: string | null;
  programmed: boolean;
  session_count: number;
  set_count: number;
  volume_kg: number;
}>;

export type CoreVariantMovement = Readonly<{
  core_movement_id: number;
  key: string;
  name: string;
  family: CoreVariantFamily;
  parent_lift_label: string;
  currently_programmed: boolean;
  recognition_status: string;
  session_count: number;
  set_count: number;
  volume_kg: number;
  first_performed_on?: string | null;
  last_performed_on?: string | null;
  latest_best?: CoreVariantSetEvidence | null;
  historical_load_best?: CoreVariantSetEvidence | null;
  latest_progression?: CoreVariantProgression | null;
  progressions: CoreVariantProgression[];
  weight_progression: CoreVariantSetEvidence[];
  volume_progression: Readonly<{
    workout_id: number;
    date: string;
    volume_kg: number;
    set_count: number;
    training_block_name?: string | null;
  }>[];
  rep_strength: (CoreVariantSetEvidence & { reps: number })[];
  block_usage: CoreVariantBlockUsage[];
  recent_exposures: Readonly<{
    workout_id: number;
    date: string;
    session_title: string;
    status?: string | null;
    training_block_id?: number | null;
    training_block_name?: string | null;
    identity_sources: string[];
    set_count: number;
    volume_kg: number;
    best_set?: CoreVariantSetEvidence | null;
  }>[];
  source_set_log_ids: number[];
}>;

export type CoreVariantFamilySummary = Readonly<{
  family: CoreVariantFamily;
  label: string;
  recorded_count: number;
  active_count: number;
  session_count: number;
  set_count: number;
  volume_kg: number;
  last_performed_on?: string | null;
  strongest_progression?: CoreVariantProgression | null;
}>;

export type LedgerCoreVariantsStory = Readonly<{
  schema_version: 'core-variants-ledger-v1';
  athlete: { id: number; name: string; preferred_units?: string | null };
  current_block?: { id: number; name: string; start_date?: string | null; end_date?: string | null } | null;
  current_rotation: {
    count: number;
    families: {
      family: CoreVariantFamily;
      label: string;
      variants: { core_movement_id: number; key: string; name: string }[];
    }[];
  };
  families: CoreVariantFamilySummary[];
  making_progress_ids: number[];
  movements: CoreVariantMovement[];
  evidence_policy: {
    membership: 'exact_governed_core_variant_identity';
    competition_carryover_claimed: false;
    weight_progression: string;
    rep_strength: string;
    comparable_performance: string[];
    volume: string;
  };
}>;

export async function fetchLedgerCoreVariants(athleteId?: number | null) {
  const suffix = athleteId ? `?athlete_id=${athleteId}` : '';
  const response = await fetchJson<{ ok: boolean; error?: string } & Partial<LedgerCoreVariantsStory>>(
    `/mobile/ledger/archive/core-variants${suffix}`,
    { method: 'GET', auth: true },
  );
  if (!response.ok || !response.json?.ok || response.json.schema_version !== 'core-variants-ledger-v1') {
    throw new Error(response.json?.error || 'Core Variant evidence could not be loaded.');
  }
  return response.json as { ok: true } & LedgerCoreVariantsStory;
}
