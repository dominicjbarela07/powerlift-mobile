import { fetchJson } from '@/lib/api';
import { strengthMetricForMovementClass } from '@/lib/movement-strength-metric';

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
  e1rm_kg?: number | null;
  strength_metric_kg?: number | null;
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
  e1rm_kg?: number | null;
  strength_metric_kg?: number | null;
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
  e1rm_kg?: number | null;
  strength_metric_kg?: number | null;
}>;

export type CanonicalHistoryExposureDetail = CanonicalHistoryExposure & Readonly<{
  strength_metric?: CanonicalMovementHistory['strength_metric'];
  sets: CanonicalHistorySet[];
  duration_seconds?: number | null;
  session_notes?: string | null;
  movement_notes?: string[];
  videos?: { id: number; thumbnail_url?: string | null; review_status?: string | null }[];
  session: { id: number; label: string; date: string; status?: string | null };
}>;

export type CanonicalMovementHistory = Readonly<{
  strength_metric: {
    key: 'e1rm' | 'e10rm';
    metric: 'estimated_1rm_kg' | 'estimated_10rm_kg';
    projection_metric: 'estimated_1rm' | 'estimated_10rm';
    label: 'Estimated 1RM' | 'Estimated 10RM';
    short_label: 'e1RM' | 'e10RM';
    method: string;
  };
  identity_resolution: {
    status: 'resolved';
    subject_type: 'core' | 'accessory';
    subject_id: number;
    membership_set_log_count: number;
    membership_sha256: string;
  };
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

function normalizeStrengthValue(
  row: { strength_metric_kg?: number | null; e10rm_kg?: number | null; e1rm_kg?: number | null },
  expected: ReturnType<typeof strengthMetricForMovementClass>,
  reportedKey?: 'e1rm' | 'e10rm' | null,
) {
  if (row.strength_metric_kg != null && reportedKey === expected.key) return Number(row.strength_metric_kg);
  const source = row.strength_metric_kg ?? row.e1rm_kg ?? row.e10rm_kg;
  if (source == null || !Number.isFinite(Number(source))) return null;
  // Older payloads exposed an Epley e1RM value under e10rm_kg. Correct that
  // compatibility boundary for Accessories without mutating SetLog evidence.
  if (!reportedKey) return expected.key === 'e10rm' ? Number(source) * 0.75 : Number(source);
  if (reportedKey === expected.key) return Number(source);
  return expected.key === 'e10rm' ? Number(source) * 0.75 : Number(source) / 0.75;
}

function normalizeStrengthRow<T extends { strength_metric_kg?: number | null; e10rm_kg?: number | null; e1rm_kg?: number | null }>(
  row: T,
  expected: ReturnType<typeof strengthMetricForMovementClass>,
  reportedKey?: 'e1rm' | 'e10rm' | null,
) {
  const value = normalizeStrengthValue(row, expected, reportedKey);
  return { ...row, strength_metric_kg: value, [`${expected.key}_kg`]: value } as T;
}

function normalizeHistoryStrengthMetric(history: CanonicalMovementHistory): CanonicalMovementHistory {
  const expected = strengthMetricForMovementClass(history.identity_resolution.subject_type);
  const reportedKey = history.strength_metric?.key || null;
  const normalizeExposure = (row: CanonicalHistoryExposure) => ({
    ...normalizeStrengthRow(row, expected, reportedKey),
    best_set: row.best_set ? normalizeStrengthRow(row.best_set, expected, reportedKey) : row.best_set,
  });
  const strength = history.statistics.estimated_strength_pr;
  const strengthFactor = reportedKey === expected.key ? 1 : expected.key === 'e10rm' ? 0.75 : 1 / 0.75;
  return {
    ...history,
    strength_metric: {
      key: expected.key,
      metric: expected.metric,
      projection_metric: expected.projectionMetric,
      label: expected.label,
      short_label: expected.shortLabel,
      method: expected.method,
    },
    performance_trend: history.performance_trend.map((row) => normalizeStrengthRow(row, expected, reportedKey)),
    load_progression: history.load_progression.map((row) => normalizeStrengthRow(row, expected, reportedKey)),
    load_rep_profile: history.load_rep_profile.map((row) => normalizeStrengthRow(row, expected, reportedKey)),
    equipment_breakdown: history.equipment_breakdown.map((row) => ({
      ...row,
      best_performance: row.best_performance ? normalizeStrengthRow(row.best_performance, expected, reportedKey) : row.best_performance,
    })),
    statistics: {
      ...history.statistics,
      estimated_strength_pr: strength ? {
        ...strength,
        value_kg: strength.value_kg * strengthFactor,
        delta_kg: strength.delta_kg == null ? strength.delta_kg : strength.delta_kg * strengthFactor,
      } : strength,
      load_pr: history.statistics.load_pr ? normalizeStrengthRow(history.statistics.load_pr, expected, reportedKey) : history.statistics.load_pr,
      rep_pr_at_load: history.statistics.rep_pr_at_load ? normalizeStrengthRow(history.statistics.rep_pr_at_load, expected, reportedKey) : history.statistics.rep_pr_at_load,
      best_n_rep_load: history.statistics.best_n_rep_load ? normalizeStrengthRow(history.statistics.best_n_rep_load, expected, reportedKey) : history.statistics.best_n_rep_load,
    },
    exposures: history.exposures.map(normalizeExposure),
  };
}

export async function fetchCanonicalMovementHistory(query: MovementHistoryQuery) {
  const response = await fetchJson<{ ok: boolean; error?: string; movement_history?: CanonicalMovementHistory }>(
    `/workouts/mobile/athletes/${query.athleteId}/movement-history?${queryParams(query).toString()}`,
    { method: 'GET', auth: true },
  );
  if (!response.ok || !response.json?.ok || !response.json.movement_history) {
    throw new Error(response.json?.error || 'Movement History could not load.');
  }
  const history = response.json.movement_history;
  const expectedType = query.coreMovementId ? 'core' : 'accessory';
  const expectedId = Number(query.coreMovementId || query.movementDefinitionId);
  const resolution = history.identity_resolution;
  if (
    resolution?.status !== 'resolved'
    || resolution.subject_type !== expectedType
    || Number(resolution.subject_id) !== expectedId
  ) {
    throw new Error('Movement History identity could not be resolved safely.');
  }
  return normalizeHistoryStrengthMetric(history);
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
  const expected = strengthMetricForMovementClass(query.coreMovementId ? 'core' : 'accessory');
  const detail = response.json.exposure;
  const reportedKey = detail.strength_metric?.key || null;
  return {
    ...normalizeStrengthRow(detail, expected, reportedKey),
    best_set: detail.best_set ? normalizeStrengthRow(detail.best_set, expected, reportedKey) : detail.best_set,
    sets: detail.sets.map((row) => normalizeStrengthRow(row, expected, reportedKey)),
  } as CanonicalHistoryExposureDetail;
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
