import type { ArchiveItem, ArchiveLanding } from '@/lib/ledger-archive';
import type { AccomplishmentEvent, CurrentBest, LedgerProgression } from '@/lib/ledger-data';
import type { LedgerFixtureName, LedgerV2Scope, LedgerV2Snapshot } from './types';

const BLOCK = { program_id: 8, program_name: 'Powerbuilding II', block_id: 42, block_name: 'Hypertrophy Block' };
const PRIOR_BLOCK = { program_id: 8, program_name: 'Powerbuilding II', block_id: 38, block_name: 'Strength Block' };

function session(id: number, date: string, title: string, setCount: number, context = BLOCK): ArchiveItem {
  return {
    archive_item_type: 'session', source_id: id, athlete_id: 7, title, occurred_on: date,
    source_type: 'session', provenance_label: 'Strength Ledger Session', status: 'completed',
    performance: { set_count: setCount, movement_count: 5, total_volume_kg: 8300 + id * 12 },
    program_context: context, visibility: 'athlete_visible', correction_state: 'current_truth', invalidation_state: 'valid',
  };
}

function performedSet(input: {
  id: number; movementId: number; key: string; name: string; family: string; kind: 'core' | 'accessory';
  date: string; weight: number; reps: number; classification?: 'core' | 'accessory'; manufacturer?: string;
  implementation?: string; rpe?: number; block?: typeof BLOCK;
}): ArchiveItem {
  return {
    archive_item_type: 'set', source_id: input.id, athlete_id: 7, title: input.name,
    subtitle: `Set evidence · ${input.block?.block_name || BLOCK.block_name}`, occurred_on: input.date,
    occurred_at: `${input.date}T18:20:00Z`, source_type: 'set_log', provenance_label: 'Performed set', status: 'recorded',
    movement: {
      id: input.movementId, key: input.key, name: input.name, family: input.family, kind: input.kind,
      identity_specificity: 'exact', comparison_confidence: 'high', match_scope: 'exact',
    },
    performance: {
      weight_kg: input.weight, reps: input.reps, rpe: input.rpe ?? 8,
      set_index: 1, core_or_accessory: input.classification || (input.kind === 'accessory' ? 'accessory' : 'core'),
    },
    equipment: input.manufacturer ? {
      manufacturer: input.manufacturer, implementation: input.implementation || 'performed configuration', snapshot: true,
    } : null,
    program_context: input.block || BLOCK, visibility: 'athlete_visible', correction_state: 'current_truth', invalidation_state: 'valid',
  };
}

function event(input: Partial<AccomplishmentEvent> & Pick<AccomplishmentEvent, 'id' | 'event_type' | 'movement_label' | 'current_value'>): AccomplishmentEvent {
  return {
    priority: 1, occurred_at: '2026-08-11T18:25:00Z', workout_date: '2026-08-11', workout_title: 'Upper Body A',
    core_movement_key: 'competition_bench', prior_value: null, delta: null, unit: 'kg', source_set_log_id: 1001,
    workout_id: 901, workout_item_id: 920, training_block_id: 42, scope: 'career', is_current_best: true,
    evidence: { actual_weight_kg: input.current_value, actual_reps: 3, metric: 'weight' },
    ...input,
  };
}

const accomplishments: AccomplishmentEvent[] = [
  event({ id: 501, event_type: 'CORE_WEIGHT_PR', movement_label: 'Bench Press', current_value: 129.27, prior_value: 124.74, delta: 4.53, source_set_log_id: 1001 }),
  event({ id: 502, event_type: 'CORE_REP_PR', movement_label: 'Squat', core_movement_key: 'competition_squat', current_value: 5, prior_value: 4, delta: 1, unit: 'reps', occurred_at: '2026-08-09T18:20:00Z', source_set_log_id: 1002, evidence: { actual_weight_kg: 206.38, actual_reps: 5, rep_count: 5, metric: 'rep_max' } }),
  event({ id: 503, event_type: 'CORE_E1RM_PR', movement_label: 'Deadlift', core_movement_key: 'competition_deadlift', current_value: 342.5, prior_value: 337.1, delta: 5.4, source_set_log_id: 1003, occurred_at: '2026-08-07T18:20:00Z', evidence: { actual_weight_kg: 315.7, actual_reps: 3, metric: 'e1rm' } }),
  event({ id: 504, event_type: 'CORE_REP_PR', movement_label: 'Bench Press', current_value: 8, prior_value: 7, delta: 1, unit: 'reps', source_set_log_id: 1004, occurred_at: '2026-08-02T18:20:00Z', evidence: { actual_weight_kg: 92.99, actual_reps: 8, rep_count: 8, metric: 'rep_max' } }),
  event({ id: 505, event_type: 'CORE_BLOCK_WEIGHT_BEST', movement_label: 'Paused Squat', core_movement_key: 'paused_squat', current_value: 206.38, prior_value: 199.58, delta: 6.8, source_set_log_id: 1101, occurred_at: '2026-07-29T18:20:00Z', evidence: { actual_weight_kg: 206.38, actual_reps: 3, metric: 'weight' } }),
  event({ id: 506, event_type: 'CORE_WEIGHT_PR', movement_label: 'Squat', core_movement_key: 'competition_squat', current_value: 265.35, prior_value: 260.82, delta: 4.53, source_set_log_id: 1005, occurred_at: '2026-07-22T18:20:00Z' }),
  event({ id: 507, event_type: 'CORE_WEIGHT_PR', movement_label: 'Deadlift', core_movement_key: 'competition_deadlift', current_value: 328.85, prior_value: 324.32, delta: 4.53, source_set_log_id: 1006, occurred_at: '2026-07-12T18:20:00Z' }),
];

function best(id: number, lift: string, label: string, metric: string, value: number, source: AccomplishmentEvent, bucket?: string): CurrentBest {
  return {
    projection_id: id, core_movement_key: lift, movement_label: label, metric,
    best_value: value, unit: 'kg', comparison_bucket: bucket, scope: 'career', event: source,
  } as CurrentBest;
}

const currentBests: CurrentBest[] = [
  best(1, 'competition_squat', 'Squat', 'weight', 265.35, accomplishments[5]),
  best(2, 'competition_bench', 'Bench Press', 'weight', 129.27, accomplishments[0]),
  best(3, 'competition_deadlift', 'Deadlift', 'weight', 328.85, accomplishments[6]),
  best(4, 'competition_squat', 'Squat', 'e1rm', 278.2, accomplishments[1]),
  best(5, 'competition_bench', 'Bench Press', 'e1rm', 139.4, accomplishments[0]),
  best(6, 'competition_deadlift', 'Deadlift', 'e1rm', 342.5, accomplishments[2]),
  best(7, 'competition_squat', 'Squat', 'rep_max', 265.35, accomplishments[5], 'reps:1'),
  best(8, 'competition_squat', 'Squat', 'rep_max', 242.67, accomplishments[1], 'reps:5'),
  best(9, 'competition_bench', 'Bench Press', 'rep_max', 129.27, accomplishments[0], 'reps:3'),
  best(10, 'competition_bench', 'Bench Press', 'rep_max', 92.99, accomplishments[3], 'reps:8'),
  best(11, 'competition_deadlift', 'Deadlift', 'rep_max', 328.85, accomplishments[6], 'reps:1'),
  best(12, 'competition_deadlift', 'Deadlift', 'rep_max', 315.7, accomplishments[2], 'reps:3'),
];

const progression: LedgerProgression = {
  athlete: { id: 7, name: 'Storyboard Athlete', preferred_units: 'lb' },
  range: { start_date: '2026-05-15', end_date: '2026-08-12', label: 'Last 3 months' },
  big_three_arc: {
    estimated_total_kg: 760.1,
    lifts: [
      { key: 'squat', label: 'Squat', current_e1rm_kg: 278.2, best_e1rm_kg: 278.2, change_kg: 8.4, points: [{ date: '2026-05-20', value_kg: 261 }, { date: '2026-06-12', value_kg: 266 }, { date: '2026-07-09', value_kg: 271 }, { date: '2026-08-09', value_kg: 278.2 }] },
      { key: 'bench', label: 'Bench Press', current_e1rm_kg: 139.4, best_e1rm_kg: 139.4, change_kg: 5.1, points: [{ date: '2026-05-18', value_kg: 130 }, { date: '2026-06-22', value_kg: 133 }, { date: '2026-07-18', value_kg: 136 }, { date: '2026-08-11', value_kg: 139.4 }] },
      { key: 'deadlift', label: 'Deadlift', current_e1rm_kg: 342.5, best_e1rm_kg: 342.5, change_kg: 9.6, points: [{ date: '2026-05-26', value_kg: 321 }, { date: '2026-06-28', value_kg: 329 }, { date: '2026-07-17', value_kg: 336 }, { date: '2026-08-07', value_kg: 342.5 }] },
    ],
  },
  consistency: { sessions_assigned: 192, sessions_completed: 184, missed_or_incomplete: 8, completion_rate_pct: 95.8, current_streak: 4, best_streak: 18, training_age_years: 4.3 },
  bodyweight: { current_kg: 88.09, context_line: 'Most recent recorded bodyweight.' },
  metric_trends: { volume: { complete_training_volume_kg: 565600, points: [{ date: '2026-06-01', value_kg: 37800 }, { date: '2026-07-01', value_kg: 41200 }, { date: '2026-08-01', value_kg: 39700 }] } },
};

const sessions: ArchiveItem[] = [
  session(901, '2026-08-11', 'Upper Body A', 21), session(902, '2026-08-09', 'Lower Body A', 19),
  session(903, '2026-08-07', 'Deadlift Development', 18), session(904, '2026-08-04', 'Upper Body B', 22),
  session(905, '2026-08-02', 'Bench Volume', 17), session(906, '2026-07-29', 'Lower Body B', 20),
  session(840, '2026-06-22', 'Strength Peak', 16, PRIOR_BLOCK), session(839, '2026-06-19', 'Competition Practice', 15, PRIOR_BLOCK),
];

const evidence: ArchiveItem[] = [
  performedSet({ id: 1001, movementId: 102, key: 'competition_bench', name: 'Bench Press', family: 'bench', kind: 'core', date: '2026-08-11', weight: 129.27, reps: 3 }),
  performedSet({ id: 1002, movementId: 101, key: 'competition_squat', name: 'Squat', family: 'squat', kind: 'core', date: '2026-08-09', weight: 242.67, reps: 5 }),
  performedSet({ id: 1003, movementId: 103, key: 'competition_deadlift', name: 'Deadlift', family: 'deadlift', kind: 'core', date: '2026-08-07', weight: 315.7, reps: 3 }),
  performedSet({ id: 1004, movementId: 102, key: 'competition_bench', name: 'Bench Press', family: 'bench', kind: 'core', date: '2026-08-02', weight: 92.99, reps: 8 }),
  performedSet({ id: 1101, movementId: 201, key: 'paused_squat', name: 'Paused Squat', family: 'squat', kind: 'core', date: '2026-07-29', weight: 206.38, reps: 3 }),
  performedSet({ id: 1102, movementId: 202, key: 'close_grip_bench', name: 'Close-Grip Bench', family: 'bench', kind: 'core', date: '2026-08-04', weight: 102.06, reps: 5 }),
  performedSet({ id: 1103, movementId: 203, key: 'tempo_squat', name: 'Tempo Squat', family: 'squat', kind: 'core', date: '2026-07-23', weight: 183.7, reps: 4 }),
  performedSet({ id: 1104, movementId: 204, key: 'sumo_deadlift', name: 'Sumo Deadlift', family: 'deadlift', kind: 'core', date: '2026-07-20', weight: 274.42, reps: 3 }),
  performedSet({ id: 1201, movementId: 301, key: 'machine_chest_press', name: 'Machine Chest Press', family: 'chest_press', kind: 'accessory', date: '2026-08-11', weight: 83.91, reps: 8, manufacturer: 'Prime Fitness', implementation: 'Plate loaded' }),
  performedSet({ id: 1202, movementId: 301, key: 'machine_chest_press', name: 'Machine Chest Press', family: 'chest_press', kind: 'accessory', date: '2026-07-25', weight: 79.38, reps: 8, manufacturer: 'Prime Fitness', implementation: 'Plate loaded' }),
  performedSet({ id: 1203, movementId: 302, key: 'lat_pulldown', name: 'Lat Pulldown', family: 'vertical_pull', kind: 'accessory', date: '2026-08-10', weight: 72.57, reps: 10, manufacturer: 'Prime Fitness', implementation: 'Cable stack' }),
  performedSet({ id: 1204, movementId: 303, key: 'leg_press', name: 'Leg Press', family: 'quads', kind: 'accessory', date: '2026-08-09', weight: 267.62, reps: 12, manufacturer: 'Cybex', implementation: 'Plate loaded' }),
  performedSet({ id: 1205, movementId: 304, key: 'bayesian_cable_curl', name: 'Bayesian Cable Curl', family: 'biceps', kind: 'accessory', date: '2026-08-06', weight: 15.88, reps: 12, manufacturer: 'Prime Fitness', implementation: 'Cable stack' }),
  performedSet({ id: 1206, movementId: 305, key: 'lying_leg_curl', name: 'Lying Leg Curl', family: 'hamstrings', kind: 'accessory', date: '2026-08-05', weight: 61.23, reps: 10, manufacturer: 'Life Fitness', implementation: 'Selectorized' }),
  performedSet({ id: 1207, movementId: 306, key: 'triceps_pressdown', name: 'Triceps Pressdown', family: 'triceps', kind: 'accessory', date: '2026-08-04', weight: 34.02, reps: 15, manufacturer: 'Prime Fitness', implementation: 'Cable stack' }),
  ...sessions.slice(0, 4),
];

const landing: ArchiveLanding = {
  ok: true, athlete: { id: 7, name: 'Storyboard Athlete' }, recent: [sessions[0], evidence[0]],
  rediscovery: [sessions.at(-1)!], collection_summaries: { training: 184, media: 32, competition: 3 },
  supported_filters: { training: ['date_from', 'block_id', 'movement_id', 'classification'], media: ['date_from'], competition: ['date_from'] },
};

const sparseSet = performedSet({ id: 2001, movementId: 102, key: 'competition_bench', name: 'Bench Press', family: 'bench', kind: 'core', date: '2026-08-11', weight: 61.23, reps: 5 });
const sparseSession = session(1901, '2026-08-11', 'First Recorded Session', 3);

export function ledgerFixture(name: LedgerFixtureName, scope: LedgerV2Scope): LedgerV2Snapshot {
  if (name === 'sparse') {
    return {
      scope, apiRange: scope === '3m' ? '90d' : scope === 'year' ? '1y' : 'all', dateFrom: '2026-01-01',
      progression: { athlete: { id: 8, name: 'New Athlete', preferred_units: 'lb' }, consistency: { sessions_completed: 1, sessions_assigned: 1, training_age_years: 0 }, big_three_arc: { lifts: [] } },
      currentBests: [], accomplishments: [],
      landing: { ok: true, athlete: { id: 8, name: 'New Athlete' }, recent: [sparseSession], rediscovery: [], collection_summaries: { training: 1, media: 0, competition: 0 }, supported_filters: { training: [], media: [], competition: [] } },
      sessions: [sparseSession], evidence: [sparseSet, sparseSession],
    };
  }
  return {
    scope, apiRange: scope === '3m' ? '90d' : scope === 'year' ? '1y' : 'all', dateFrom: scope === 'all' ? '1900-01-01' : '2026-01-01',
    progression, currentBests, accomplishments, landing, sessions, evidence,
  };
}
