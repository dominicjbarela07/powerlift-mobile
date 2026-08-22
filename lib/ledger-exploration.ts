import { fetchJson } from '@/lib/api';
import { LedgerRequestError } from '@/lib/ledger-data';

export type LedgerMovementProgress = Readonly<{
  id: number;
  key: string;
  name: string;
  family: string;
  family_name?: string | null;
  body_region?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups: string[];
  kind: 'core' | 'accessory' | 'custom' | string;
  core_family?: 'squat' | 'bench' | 'deadlift' | 'press' | null;
  core_kind?: 'competition' | 'variant' | null;
  equipment_type?: string | null;
  equipment_manufacturer?: string | null;
  equipment_model?: string | null;
  comparison_scope?: string | null;
  comparison_confidence?: string | null;
  first_performed_on?: string | null;
  last_performed_on?: string | null;
  set_count: number;
  session_count: number;
  volume_kg: number;
  best_weight_kg?: number | null;
  best_reps?: number | null;
  latest_weight_kg?: number | null;
  latest_reps?: number | null;
  latest_rir?: number | null;
}>;

export type LedgerMuscleProgress = Readonly<{
  key: string;
  volume_kg: number;
  set_count: number;
  session_count: number;
  movement_count: number;
  last_performed_on?: string | null;
}>;

export type LedgerExplorationContext = Readonly<{
  program?: { id: number; name: string } | null;
  block?: { id: number; name: string; start_date?: string | null; end_date?: string | null } | null;
  week_number?: number | null;
  total_weeks?: number | null;
  block_completed_sessions: number;
  block_total_sessions: number;
  block_progress?: number | null;
  bodyweight_kg?: number | null;
  bodyweight_points: { date?: string | null; value_kg: number; reported_at?: string | null; workout_id?: number | null; source?: string | null }[];
  reported_bodyweight?: {
    point_count: number;
    latest?: { reported_bodyweight_kg: number; training_date?: string | null; workout_id?: number | null; source: string } | null;
    recent_observations?: { reported_bodyweight_kg: number; training_date?: string | null; reported_at?: string | null; workout_id?: number | null; source: string }[];
    comparison?: {
      start: { reported_bodyweight_kg: number; training_date?: string | null };
      end: { reported_bodyweight_kg: number; training_date?: string | null };
      delta_kg: number;
      span_days: number;
      policy: string;
    } | null;
    interpolated: false;
  } | null;
  training_frequency_per_week: number;
  lifetime_set_count: number;
}>;

export type LedgerExplorationIndex = Readonly<{
  athlete: { id: number; name: string; preferred_units?: string | null; sex?: string | null; anatomy_display_preference?: string | null };
  context: LedgerExplorationContext;
  movements: LedgerMovementProgress[];
  muscle_groups: LedgerMuscleProgress[];
  filters: {
    programs: { id: number; name: string; status: string }[];
    blocks: { id: number; name: string; program_id?: number | null }[];
    muscle_groups: string[];
    equipment: string[];
    exercise_types: string[];
  };
}>;

export type LedgerMovementSet = Readonly<{
  id: number;
  weight_kg: number;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
  date?: string | null;
  set_index?: number | null;
  performed_label?: string | null;
  comparison_confidence?: string | null;
}>;

export type LedgerMovementHistory = Readonly<{
  scope: 'exact_identity';
  comparison_allowed: boolean;
  identity: Record<string, unknown>;
  sets: LedgerMovementSet[];
  related_reference_only: {
    identity: Record<string, unknown>;
    last_performed_on?: string | null;
    set_count: number;
    session_count?: number;
    loads_comparable: false;
  }[];
  has_more?: boolean;
  next_cursor?: string | null;
}>;

async function requirePayload<T extends { ok: boolean; error?: string }>(path: string): Promise<T> {
  const response = await fetchJson<T>(path, { method: 'GET', auth: true });
  if (!response.ok || !response.json?.ok) {
    throw new LedgerRequestError(response.status, response.json?.error);
  }
  return response.json;
}

export async function fetchLedgerExplorationIndex(): Promise<LedgerExplorationIndex> {
  const payload = await requirePayload<{ ok: boolean; error?: string } & LedgerExplorationIndex>('/mobile/ledger/archive/movement-progress');
  return payload;
}

export async function fetchLedgerMovementHistory(athleteId: number, movementDefinitionId: number): Promise<LedgerMovementHistory> {
  const payload = await requirePayload<{ ok: boolean; error?: string } & LedgerMovementHistory>(
    `/workouts/mobile/athletes/${athleteId}/movement-history?movement_definition_id=${movementDefinitionId}&limit=49`,
  );
  return payload;
}
