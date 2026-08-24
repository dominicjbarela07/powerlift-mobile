import { fetchJson } from '@/lib/api';

export { samePrimaryHistoryObservation } from '@/lib/canonical-movement-history-contract';

export type MovementHistoryUnit = 'kg' | 'lb';

export type CanonicalHistoryEquipment = Readonly<{
  id: number;
  key: string;
  label: string;
  display_name?: string | null;
  manufacturer?: { id: number; key: string; display_name: string } | null;
  equipment_model?: { id: number; key: string; display_name: string } | null;
  equipment_type?: string | null;
  implementation_key?: string | null;
  comparison_scope?: string | null;
  load_convention?: string | null;
  measurement_type?: string | null;
  comparison_confidence?: string | null;
}>;

export type CanonicalHistorySet = Readonly<{
  id: number;
  set_index: number;
  weight_kg: number;
  reps?: number | null;
  rpe?: number | null;
  rir?: number | null;
  e10rm_kg?: number | null;
  performed_label?: string | null;
  comparison_scope?: string | null;
  load_convention?: string | null;
  measurement_type?: string | null;
  video?: { id: number; thumbnail_url?: string | null; review_status?: string | null } | null;
  pr_indicators?: string[];
}>;

export type CanonicalHistoryPoint = Readonly<{
  exposure_id: string;
  workout_id: number;
  date: string;
  performed_at?: string | null;
  equipment?: CanonicalHistoryEquipment | null;
  e10rm_kg?: number | null;
  weight_kg?: number | null;
  reps?: number | null;
  rir?: number | null;
  rpe?: number | null;
  set_log_id?: number | null;
}>;

export type CanonicalHistoryExposure = Readonly<{
  id: string;
  workout_id: number;
  date: string;
  performed_at?: string | null;
  session_title: string;
  status?: string | null;
  equipment?: CanonicalHistoryEquipment | null;
  comparison_scope?: string | null;
  comparison_identity_key?: string | null;
  identity_sources?: string[];
  set_count: number;
  total_volume_kg: number;
  best_set?: CanonicalHistorySet | null;
  e10rm_kg?: number | null;
}>;

export type CanonicalHistoryExposureDetail = CanonicalHistoryExposure & Readonly<{
  sets: CanonicalHistorySet[];
  duration_seconds?: number | null;
  session_notes?: string | null;
  movement_notes?: string[];
  videos?: { id: number; thumbnail_url?: string | null; review_status?: string | null }[];
  session: { id: number; label: string; date: string; status?: string | null };
}>;

export type CanonicalMovementHistory = Readonly<{
  schema_version: 'canonical-movement-history-v2';
  scope: 'exact_identity' | 'exact_core_identity';
  comparison_allowed: boolean;
  movement: {
    id: number;
    key: string;
    display_name: string;
    identity_type?: 'accessory' | 'core';
    family?: 'squat' | 'bench' | 'deadlift' | 'press' | string | null;
    kind?: 'competition' | 'variant' | string | null;
    primary_muscle_group?: string | null;
    secondary_muscle_groups?: string[];
    is_favorite?: boolean;
    favorite_supported?: boolean;
    [key: string]: unknown;
  };
  athlete: {
    id: number;
    name: string;
    preferred_units: MovementHistoryUnit;
    sex?: string | null;
    anatomy_display_preference?: string | null;
  };
  summary: {
    exposure_count: number;
    set_count: number;
    first_performed_on?: string | null;
    last_performed_on?: string | null;
    canonical_identity_exposure_count?: number;
    legacy_resolved_exposure_count?: number;
  };
  filters: {
    date_range: MovementHistoryDateRange;
    date_range_label: string;
    date_range_options: { key: MovementHistoryDateRange; label: string }[];
    selected_scope: string;
    selected_equipment_definition_id?: number | null;
    all_comparable_available: boolean;
    analytics_scope?: string;
    analytics_basis?: 'exact_comparable' | 'recorded_unknown_equipment';
    filtered_exposure_count?: number;
    analytics_exposure_count?: number;
    comparable_exposure_count?: number;
    rir_max?: number | null;
    rep_min?: number | null;
    rep_max?: number | null;
  };
  equipment_breakdown: (CanonicalHistoryEquipment & {
    exposure_count: number;
    set_count: number;
    best_performance?: CanonicalHistorySet | null;
    last_used: string;
    scope_key: string;
    selected: boolean;
    current_context?: boolean;
  })[];
  performance_trend: CanonicalHistoryPoint[];
  load_progression: CanonicalHistoryPoint[];
  load_rep_profile: (CanonicalHistorySet & { exposure_id: string; date: string })[];
  statistics: {
    estimated_strength_pr?: { value_kg: number; date: string; delta_kg?: number | null; exposure_id: string } | null;
    load_pr?: (CanonicalHistorySet & { date: string }) | null;
    rep_pr_at_load?: (CanonicalHistorySet & { previous_reps?: number | null }) | null;
    best_n_rep_load?: (CanonicalHistorySet & { target_reps: number }) | null;
  };
  exposures: CanonicalHistoryExposure[];
  has_more: boolean;
  next_cursor?: string | null;
  recognition_enabled: boolean;
}>;

export type MovementHistoryDateRange = '1m' | '3m' | '6m' | '1y' | 'all';

export type MovementHistoryQuery = Readonly<{
  athleteId: number;
  movementDefinitionId?: number | null;
  coreMovementId?: number | null;
  equipmentDefinitionId?: number | null;
  equipmentContextDefinitionId?: number | null;
  range?: MovementHistoryDateRange;
  rirMax?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  cursor?: string | null;
  limit?: number;
}>;

function queryParams(query: MovementHistoryQuery) {
  const params = new URLSearchParams({
    view: 'v2',
    range: query.range || 'all',
    limit: String(query.limit || 12),
  });
  if (query.coreMovementId) params.set('core_movement_id', String(query.coreMovementId));
  else if (query.movementDefinitionId) params.set('movement_definition_id', String(query.movementDefinitionId));
  else throw new Error('A governed movement identity is required.');
  if (query.equipmentDefinitionId === 0) params.set('equipment_not_recorded', '1');
  else if (query.equipmentDefinitionId) params.set('equipment_definition_id', String(query.equipmentDefinitionId));
  if (query.equipmentContextDefinitionId) {
    params.set('equipment_context_definition_id', String(query.equipmentContextDefinitionId));
  }
  if (query.rirMax != null) params.set('rir_max', String(query.rirMax));
  if (query.repMin != null) params.set('rep_min', String(query.repMin));
  if (query.repMax != null) params.set('rep_max', String(query.repMax));
  if (query.cursor) params.set('analytics_cursor', query.cursor);
  return params;
}

export async function fetchCanonicalMovementHistory(query: MovementHistoryQuery) {
  const response = await fetchJson<{ ok: boolean; error?: string; movement_history?: CanonicalMovementHistory }>(
    `/workouts/mobile/athletes/${query.athleteId}/movement-history?${queryParams(query).toString()}`,
    { method: 'GET', auth: true },
  );
  if (!response.ok || !response.json?.ok || !response.json.movement_history) {
    throw new Error(response.json?.error || 'Movement History could not load.');
  }
  return response.json.movement_history;
}

export async function fetchCanonicalMovementExposure(query: MovementHistoryQuery, exposureId: string) {
  const params = queryParams(query);
  params.delete('view');
  params.delete('analytics_cursor');
  params.delete('equipment_definition_id');
  params.delete('equipment_not_recorded');
  params.delete('equipment_context_definition_id');
  const response = await fetchJson<{ ok: boolean; error?: string; exposure?: CanonicalHistoryExposureDetail }>(
    `/workouts/mobile/athletes/${query.athleteId}/movement-history/exposures/${encodeURIComponent(exposureId)}?${params.toString()}`,
    { method: 'GET', auth: true },
  );
  if (!response.ok || !response.json?.ok || !response.json.exposure) {
    throw new Error(response.json?.error || 'Exposure evidence could not load.');
  }
  return response.json.exposure;
}

export async function setCanonicalMovementFavorite(
  movementDefinitionId: number,
  athleteId: number,
  favorite: boolean,
) {
  const response = await fetchJson<{ ok: boolean; error?: string; is_favorite?: boolean }>(
    `/workouts/mobile/movement-definitions/${movementDefinitionId}/favorite?athlete_id=${athleteId}`,
    { method: favorite ? 'PUT' : 'DELETE', auth: true },
  );
  if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Favorite could not update.');
  return Boolean(response.json.is_favorite);
}
