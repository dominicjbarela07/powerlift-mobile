import React from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';

import {
  CompletedSessionRecap,
  type CompletedRecapMovement,
  type CompletedSessionRecapPayload,
} from '@/components/coach-mobile/CompletedSessionRecap';

const dates = ['2026-06-12', '2026-06-26', '2026-07-10', '2026-07-24', '2026-08-09'];

function movement(
  itemId: number,
  label: string,
  primary: string,
  secondary: string[],
  weightKg: number,
  reps: number,
  options: { kind?: 'core' | 'accessory'; lift?: string; equipment?: string; pr?: boolean; video?: string; setCount?: number } = {},
): CompletedRecapMovement {
  const prior = dates.map((date, index) => ({
    date,
    workout_id: 700 + index,
    set_log_id: itemId * 100 + index,
    weight_kg: Math.max(1, weightKg - (dates.length - index) * 2.26796),
    reps,
    rir: 2,
    score: Math.max(1, weightKg - (dates.length - index) * 2.26796) * (1 + reps / 30),
    metric_value: Math.max(1, weightKg - (dates.length - index) * 2.26796) * (1 + reps / 30),
  }));
  const video = options.video ? {
    id: itemId * 1000 + 1,
    thumbnail_url: `sl-fixture://session-review/${options.video}`,
    url: null,
  } as any : null;
  const sets = Array.from({ length: options.setCount || 3 }, (_, offset) => ({
    id: itemId * 1000 + offset + 1,
    set_index: offset + 1,
    actual_weight_kg: weightKg - Math.max(0, offset - 1) * 2.26796,
    actual_reps: reps - (offset === 2 ? 1 : 0),
    actual_rir: offset === 2 ? 1 : 2,
    has_pr: !!options.pr && offset === 0,
    video_attachment_id: offset === 0 && video ? video.id : null,
    video: offset === 0 ? video : null,
  }));
  return {
    item_id: itemId,
    label,
    kind: options.kind || 'accessory',
    lift: options.lift || 'AX',
    variant: options.kind === 'core' ? 'STRAIGHT' : 'ACC',
    primary_muscle_group: primary,
    secondary_muscle_groups: secondary,
    sets,
    equipment: [{
      label: options.equipment || 'Rogue · Power Bar',
      manufacturer: (options.equipment || 'Rogue').split(' · ')[0],
      manufacturer_key: (options.equipment || 'rogue').split(' · ')[0].toLowerCase().replaceAll(' ', '-'),
      model: (options.equipment || 'Rogue · Power Bar').split(' · ')[1] || 'Power Bar',
      implementation_key: options.kind === 'core'
        ? 'barbell'
        : `${(options.equipment || 'equipment').split(' · ')[0].toLowerCase().replaceAll(' ', '_')}:${(options.equipment || '').toLowerCase().includes('plate loaded') ? 'plate_loaded' : 'selectorized'}`,
    }],
    has_pr: !!options.pr,
    measurement: {
      measurement_type: 'load_reps',
      comparison_eligible: true,
      comparison_scope: 'exact_movement_identity',
      canonical_identity_id: 9000 + itemId,
      comparison_identity_id: 9000 + itemId,
    },
    best_set: {
      set_log_id: sets[0].id,
      set_index: 1,
      weight_kg: weightKg,
      reps,
      rir: 2,
      has_pr: !!options.pr,
      video_attachment_id: video?.id || null,
      video,
    },
    trend: {
      metric: 'estimated_1rm_kg',
      metric_label: 'Estimated 1RM',
      metric_unit: 'kg',
      direction: 'higher_is_better',
      scope: options.kind === 'core' ? 'exact_core_identity' : 'exact_movement_identity',
      state: 'trend',
      delta_kg: 4.53592,
      delta_value: 4.53592,
      points: [...prior, {
        date: '2026-08-13', workout_id: 742, set_log_id: sets[0].id,
        weight_kg: weightKg, reps, rir: 2, score: weightKg * (1 + reps / 30),
        metric_value: weightKg * (1 + reps / 30), current: true,
      }],
    },
    projection: {
      metric: 'estimated_1rm', value_kg: weightKg * (1 + reps / 30),
      method: 'epley_rpe_adjusted_v1', source_set_log_id: sets[0].id, label: 'Estimated 1RM',
    },
    history_diagnostics: {
      movement_definition_id: 9000 + itemId,
      canonical_key: `certification-movement-${itemId}`,
      identity_scope: options.kind === 'core' ? 'exact_core_identity' : 'exact_movement_identity',
      historical_candidate_count: prior.length,
      accepted_candidate_count: prior.length,
      rejected_candidate_count: 0,
      rejected: [],
    },
  };
}

const competitionBench = movement(1, 'Competition Bench Press', 'chest', ['front_delts', 'triceps'], 124.738, 4, { kind: 'core', lift: 'BN', pr: true, video: 'hinge', setCount: 4 });
competitionBench.sets[0].actual_rpe = 6;
competitionBench.sets[0].actual_rir = null;
if (competitionBench.best_set) {
  competitionBench.best_set.rpe = 6;
  competitionBench.best_set.rir = null;
}

const movements = [
  competitionBench,
  movement(2, 'Machine Shoulder Press', 'front_delts', ['side_delts', 'triceps'], 70.3068, 10, { equipment: 'Newtech · Plate Loaded', pr: true, setCount: 4 }),
  movement(3, 'Walking Lunge', 'quads', ['glutes'], 61.235, 12, { equipment: 'Rogue · Dumbbells', pr: true }),
  movement(4, 'Machine Lateral Raise', 'side_delts', ['front_delts'], 36.2874, 13, { equipment: 'Matrix · Selectorized', video: 'machine' }),
  movement(5, 'Leg Extension', 'quads', [], 29.4835, 15, { equipment: 'Matrix · Selectorized' }),
  movement(6, 'Standing Calf Raise', 'calves', [], 40.8233, 15, { equipment: 'Bodymasters · Selectorized' }),
  movement(7, 'Single-Arm Cable Rear Delt Cross-Body Fly', 'rear_delts', ['upper_back'], 12.247, 14, { equipment: 'Prime Fitness · Functional Trainer' }),
];

const recap: CompletedSessionRecapPayload = {
  schema_version: 'completed-session-recap-v3',
  lifecycle_mode: 'completed_recap',
  workout_id: 742,
  athlete: { id: 77, name: 'Amanda LeFore', sex: 'F', anatomy_display_preference: 'feminine' },
  session: {
    label: 'W4 Lower B', date: '2026-08-13', status: 'completed',
    started_at: '2026-08-13T15:39:00-07:00',
    completed_at: '2026-08-13T16:23:00-07:00', duration_seconds: 2640,
    set_count: 23, movement_count: 7, video_count: 2, total_volume_kg: 7817.19,
    reported_bodyweight: { reported_bodyweight_kg: 64.772, training_date: '2026-08-13', source: 'PRE_SESSION_READINESS' },
    volume_trend: {
      scope: 'current_training_block', delta_kg: 544.31,
      points: [
        { date: '2026-07-10', workout_id: 710, volume_kg: 4626.65 },
        { date: '2026-07-24', workout_id: 724, volume_kg: 5352.39 },
        { date: '2026-08-02', workout_id: 732, volume_kg: 5896.7 },
        { date: '2026-08-09', workout_id: 739, volume_kg: 6758.51 },
        { date: '2026-08-13', workout_id: 742, volume_kg: 7817.19, current: true },
      ],
    },
  },
  highlights: {
    summary_id: 'session:742:certification', session_streak: 76, pr_count: 3,
    accomplishment_count: 3, session_volume_kg: 7817.19,
    all_prescribed_work_logged: true, prescribed_set_count: 23,
    completed_prescribed_set_count: 23, prescription_completion_percent: 100,
  },
  performed_movements: movements,
  muscle_focus: {
    primary: [{ muscle_id: 'hamstrings', score: 7 }, { muscle_id: 'quads', score: 6 }, { muscle_id: 'glutes', score: 4 }, { muscle_id: 'calves', score: 3 }],
    secondary: [{ muscle_id: 'adductors', score: 2.5 }, { muscle_id: 'lower_back', score: 1.5 }],
    source: 'performed',
  },
  accomplishments: [
    {
      id: 91, event_type: 'CORE_REP_MAX_PR', movement_label: 'Competition Bench Press', workout_item_id: 1,
      source_set_log_id: 1001, scope: 'career', current_value: 124.738, prior_value: 120.202, delta: 4.536,
      comparison_bucket: 'reps:4', unit: 'kg', evidence: { actual_weight_kg: 124.738, actual_reps: 4, actual_rpe: 6, rep_count: 4, prior_source_set_log_id: 901 },
      record_evidence: {
        metric: 'rep_max_load', scope: 'career', target_reps: 4,
        source_set: { set_log_id: 1001, date: '2026-08-13', workout_id: 742, weight_kg: 124.738, reps: 4, rpe: 6, rir: null },
        prior_set: { set_log_id: 901, date: '2026-07-24', workout_id: 724, weight_kg: 120.202, reps: 4, rpe: 6, rir: null },
        current_value: 124.738, prior_value: 120.202, delta: 4.536, unit: 'kg', first_record: false,
        progression: {
          metric: 'rep_max_load', metric_label: '4RM Progression', metric_unit: 'kg', direction: 'higher_is_better', state: 'trend', delta_value: 4.536,
          points: [
            { date: '2026-06-12', workout_id: 700, set_log_id: 701, metric_value: 111.13, weight_kg: 111.13, reps: 4 },
            { date: '2026-06-26', workout_id: 707, set_log_id: 708, metric_value: 115.666, weight_kg: 115.666, reps: 4 },
            { date: '2026-07-24', workout_id: 724, set_log_id: 901, metric_value: 120.202, weight_kg: 120.202, reps: 4, rpe: 6 },
            { date: '2026-08-13', workout_id: 742, set_log_id: 1001, metric_value: 124.738, weight_kg: 124.738, reps: 4, rpe: 6, current: true },
          ],
        },
      },
    },
    {
      id: 94, event_type: 'CORE_BLOCK_REP_MAX_BEST', movement_label: 'Competition Bench Press', workout_item_id: 1,
      source_set_log_id: 1001, scope: 'block', current_value: 124.738, prior_value: 120.202, delta: 4.536,
      comparison_bucket: 'reps:4', unit: 'kg', evidence: { actual_weight_kg: 124.738, actual_reps: 4, actual_rpe: 6, rep_count: 4, prior_source_set_log_id: 901 },
    },
    {
      id: 92, event_type: 'CORE_WEIGHT_PR', movement_label: 'Machine Shoulder Press', workout_item_id: 2, source_set_log_id: 2001, current_value: 70.3068, prior_value: 65.7709, delta: 4.5359, unit: 'kg',
      record_evidence: {
        metric: 'max_load', scope: 'career', source_set: { set_log_id: 2001, date: '2026-08-13', workout_id: 742, weight_kg: 70.3068, reps: 10, rir: 2 },
        prior_set: { set_log_id: 1901, date: '2026-08-02', workout_id: 732, weight_kg: 65.7709, reps: 10, rir: 2 }, current_value: 70.3068, prior_value: 65.7709, delta: 4.5359, unit: 'kg', first_record: false,
        progression: { metric: 'max_load', metric_label: 'Max Load Progression', metric_unit: 'kg', direction: 'higher_is_better', state: 'trend', delta_value: 4.5359, points: [
          { date: '2026-07-10', workout_id: 710, set_log_id: 1801, metric_value: 61.235, weight_kg: 61.235, reps: 10 },
          { date: '2026-08-02', workout_id: 732, set_log_id: 1901, metric_value: 65.7709, weight_kg: 65.7709, reps: 10 },
          { date: '2026-08-13', workout_id: 742, set_log_id: 2001, metric_value: 70.3068, weight_kg: 70.3068, reps: 10, current: true },
        ] },
      },
    },
    {
      id: 93, event_type: 'CORE_E1RM_PR', movement_label: 'Walking Lunge', workout_item_id: 3, source_set_log_id: 3001, current_value: 85.729, prior_value: 80.739, delta: 4.99, unit: 'kg',
      record_evidence: {
        metric: 'estimated_1rm', scope: 'career', source_set: { set_log_id: 3001, date: '2026-08-13', workout_id: 742, weight_kg: 61.235, reps: 12, rir: 2 },
        prior_set: { set_log_id: 2901, date: '2026-08-02', workout_id: 732, weight_kg: 57.153, reps: 12, rir: 2 }, current_value: 85.729, prior_value: 80.739, delta: 4.99, unit: 'kg', first_record: false,
        progression: { metric: 'estimated_1rm', metric_label: 'Estimated 1RM Progression', metric_unit: 'kg', direction: 'higher_is_better', state: 'trend', delta_value: 4.99, points: [
          { date: '2026-07-10', workout_id: 710, set_log_id: 2801, metric_value: 75.75, weight_kg: 54.431, reps: 12 },
          { date: '2026-08-02', workout_id: 732, set_log_id: 2901, metric_value: 80.739, weight_kg: 57.153, reps: 12 },
          { date: '2026-08-13', workout_id: 742, set_log_id: 3001, metric_value: 85.729, weight_kg: 61.235, reps: 12, current: true },
        ] },
      },
    },
  ],
  reflection: { session_rpe: 7, strength: 'strong', fatigue: 'medium', note: 'Felt strong today. Lower back held up well on RDLs. Lunges were brutal. 🔥', submitted_at: '2026-08-13T16:25:00-07:00' },
  coach_feedback: { feedback: 'Great execution today. Strong hamstring focus and excellent volume. RDL PR is solid—keep building consistency.', feedback_at: '2026-08-13T18:45:00-07:00', reviewed: true, reviewed_at: '2026-08-13T18:45:00-07:00', outcome: 'on_track', author: { id: 12, name: 'Coach John' } },
  readiness_context: { sleep_quality: 7.5, stress: 4, energy: 8, soreness: 5, readiness_score: 7.5, bodyweight_kg: 64.772 },
  plan: { available: true, programming_notes: 'Controlled eccentric on all posterior-chain work.', movements: movements.map((row) => ({ item_id: row.item_id, label: row.label, sets: row.sets.length, reps: row.best_set?.reps, rir_target: 2 })) },
  reviewer_v3: {
    schema_version: 'coach-session-reviewer-v3',
    comparator: { workout_id: 739, label: 'W3 Lower B', date: '2026-08-09', matched_movement_count: 7 },
    session_read: {
      performance: { state: 'improved', label: 'Improving', counts: { improved: 4, stable: 2, declined: 1 }, comparable_count: 7 },
      execution: { logged_sets: 23, planned_sets: 23, completion_percent: 100 },
      recovery: { state: 'below_baseline', label: 'Below baseline' },
      reflection: { state: 'higher_effort', label: 'Higher effort' },
      synthesis: 'Four of seven comparable movements improved. Recovery entered below the recent baseline.',
    },
    what_changed: {
      movement_outcomes: { improved: 4, stable: 2, declined: 1 },
      volume: { current_kg: 7817.19, previous_kg: 6758.51, delta_percent: 15.7 },
      logged_sets: { current: 23, previous: 20, delta: 3 },
      average_effort_rpe_equivalent: { current: 8.2, previous: 7.8, delta: 0.4 },
      pr_count: 3,
    },
    duration: { current_seconds: 2640, baseline_seconds: 3120, sample_size: 4 },
    recovery: {
      state: 'below_baseline', label: 'Below recent baseline', sample_size: 4,
      summary: 'Sleep was below the recent average while readiness, stress, and energy remained within their observed ranges.',
      metrics: {
        readiness: { value: 7.5, baseline: 7.3, delta: 0.2 },
        sleep: { value: 6.2, baseline: 7.1, delta: -0.9 },
        stress: { value: 4, baseline: 4.3, delta: -0.3 },
        energy: { value: 8, baseline: 7.4, delta: 0.6 },
        soreness: { value: 5, baseline: 4.8, delta: 0.2 },
      },
      trend: [
        { date: '2026-07-24', readiness: 7.1, sleep: 7.3, stress: 4.5, energy: 7.2, soreness: 4.4 },
        { date: '2026-08-02', readiness: 7.4, sleep: 7.0, stress: 4.1, energy: 7.5, soreness: 4.8 },
        { date: '2026-08-09', readiness: 7.3, sleep: 7.1, stress: 4.3, energy: 7.4, soreness: 4.9 },
        { date: '2026-08-13', readiness: 7.5, sleep: 6.2, stress: 4, energy: 8, soreness: 5, current: true },
      ],
    },
    reflection: {
      state: 'recorded', label: 'Athlete reflection recorded', sample_size: 4,
      session_rpe: { value: 7, baseline: 6.6, delta: 0.4 },
      strength: 'strong', fatigue: { value: 'medium', higher_than_prior_count: 2, prior_count: 4 },
      note: 'Felt strong today. Lower back held up well on RDLs. Lunges were brutal. 🔥',
    },
    coach_read: {
      performance: '4 improved · 2 stable · 1 declined', recovery: 'Below recent sleep baseline', reflection: 'Higher effort', execution: '23 / 23 sets',
      attention: [{ kind: 'movement_decline', label: 'Machine lateral raise declined across the exact comparable exposure.', item_id: 4 }],
    },
  },
};

const sparseMovement: CompletedRecapMovement = {
  ...movements[0],
  sets: movements[0].sets.slice(0, 1),
  best_set: movements[0].best_set ? { ...movements[0].best_set, has_pr: false, video_attachment_id: null, video: null } : null,
  has_pr: false,
  trend: movements[0].trend ? {
    ...movements[0].trend,
    state: 'first_comparable_performance',
    delta_kg: null,
    delta_value: null,
    points: movements[0].trend.points?.slice(-1),
  } : null,
};

const sparseRecap: CompletedSessionRecapPayload = {
  ...recap,
  workout_id: 743,
  session: {
    ...recap.session,
    label: 'First Exact Exposure',
    started_at: null,
    completed_at: null,
    duration_seconds: null,
    set_count: 1,
    movement_count: 1,
    video_count: 0,
    total_volume_kg: sparseMovement.sets[0]?.actual_weight_kg || 0,
    reported_bodyweight: null,
    volume_trend: null,
  },
  highlights: { session_streak: 0, pr_count: 0, accomplishment_count: 0, prescribed_set_count: 0, completed_prescribed_set_count: 0, prescription_completion_percent: null },
  performed_movements: [sparseMovement],
  muscle_focus: null,
  accomplishments: [],
  reflection: {},
  coach_feedback: { feedback: null, feedback_at: null, reviewed: false, reviewed_at: null, outcome: null, author: null },
  readiness_context: null,
  plan: { available: false, programming_notes: null, movements: [] },
  reviewer_v3: null,
};

const relatedLegPress = movement(8, 'Leg Press', 'quads', ['glutes'], 222.26, 12, {
  equipment: 'Rogers Athletic · Plate Loaded',
});
relatedLegPress.sets[0].actual_rir = 1;
if (relatedLegPress.best_set) relatedLegPress.best_set.rir = 1;
relatedLegPress.trend = relatedLegPress.trend ? {
  ...relatedLegPress.trend,
  state: 'first_comparable_performance',
  delta_kg: null,
  delta_value: null,
  points: relatedLegPress.trend.points?.slice(-1),
} : null;
relatedLegPress.projection = null;
relatedLegPress.related_history = {
  state: 'context_available',
  relationship: 'same_governed_movement_family',
  movement_family_id: 408,
  comparison_confidence: 'context_only',
  ranking_policy: 'canonical_related_history_order_v1',
  reference_only: true,
  loads_comparable: false,
  references: [
    {
      movement_definition_id: 9802,
      movement_family_id: 408,
      display_name: 'Cybex Leg Press',
      manufacturer: 'Cybex',
      equipment_model: 'VR3 Leg Press',
      equipment_type: 'machine',
      loading_implementation: 'selectorized_machine',
      load_convention: 'machine_stack_display',
      measurement_type: 'load_reps',
      last_performed_on: '2026-08-02',
      last_set: { set_log_id: 98002, weight_kg: 204.116, reps: 12, rir: 1, date: '2026-08-02' },
      reference_only: true,
      loads_comparable: false,
    },
    {
      movement_definition_id: 9803,
      movement_family_id: 408,
      display_name: 'Hammer Strength Leg Press',
      manufacturer: 'Hammer Strength',
      equipment_type: 'machine',
      loading_implementation: 'plate_loaded_machine',
      load_convention: 'plate_total',
      measurement_type: 'load_reps',
      last_performed_on: '2026-07-10',
      last_set: { set_log_id: 98003, weight_kg: 195.044, reps: 10, rpe: 8, date: '2026-07-10' },
      reference_only: true,
      loads_comparable: false,
    },
  ],
};
const relatedHistoryRecap: CompletedSessionRecapPayload = {
  ...sparseRecap,
  workout_id: 744,
  session: { ...sparseRecap.session, label: 'Related Equipment Context', set_count: relatedLegPress.sets.length },
  performed_movements: [relatedLegPress],
};

const firstRepPrCareer = {
  ...recap.accomplishments[0],
  prior_value: null,
  delta: null,
  evidence: { ...recap.accomplishments[0].evidence, prior_source_set_log_id: undefined },
  record_evidence: {
    ...recap.accomplishments[0].record_evidence,
    prior_set: null,
    prior_value: null,
    delta: null,
    first_record: true,
    progression: {
      ...recap.accomplishments[0].record_evidence.progression,
      state: 'first_instance',
      delta_value: null,
      points: recap.accomplishments[0].record_evidence.progression.points.slice(-1),
    },
  },
};
const firstRepPrRecap: CompletedSessionRecapPayload = {
  ...recap,
  session: { ...recap.session, movement_count: 1, set_count: competitionBench.sets.length },
  performed_movements: [competitionBench],
  highlights: { ...recap.highlights, pr_count: 2, accomplishment_count: 2 },
  accomplishments: [
    firstRepPrCareer,
    { ...recap.accomplishments[1], prior_value: null, delta: null },
  ],
};

export default function SessionRecapCertificationScreen() {
  const params = useLocalSearchParams<{ mode?: string; units?: string; offset?: string; expand?: string; tab?: string; tools?: string; scenario?: string }>();
  const initialScrollOffsetY = Math.max(0, Number(params.offset) || 0);
  const activeRecap = params.scenario === 'sparse'
    ? sparseRecap
    : params.scenario === 'related' ? relatedHistoryRecap
    : params.scenario === 'first-pr' ? firstRepPrRecap : recap;
  if (!__DEV__) return null;
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <CompletedSessionRecap
      recap={activeRecap}
      preferredUnits={params.units === 'kg' ? 'kg' : 'lbs'}
      sessionTimeZone="America/Los_Angeles"
      viewerMode={params.mode === 'coach' ? 'coach' : 'athlete'}
      initialTab={params.tab === 'coach' ? 'coach' : params.tab === 'plan' ? 'plan' : params.tab === 'personal_bests' ? 'personal_bests' : params.tab === 'performed' ? 'performed' : 'overview'}
      initialToolsOpen={params.tools === '1'}
      initialScrollOffsetY={initialScrollOffsetY}
      initialExpandedItemId={Number(params.expand) || undefined}
      coachReview={params.mode === 'coach' ? {
        draft: {
          coach_feedback: recap.coach_feedback.feedback || '',
          coach_note: 'Posterior-chain loading progressed as intended.',
          review_outcome: 'on_track',
          review_priority: 'normal',
          followup_adjust_programming: false,
          followup_message_athlete: true,
          followup_consider_tm: false,
          followup_monitor_next: true,
          send_feedback_message: true,
        },
        outcomes: [{ value: 'on_track', label: 'On Track' }, { value: 'adjust', label: 'Adjust' }],
        priorities: [{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }],
        onDraftChange: () => undefined,
        onSave: () => undefined,
      } : undefined}
      onClose={() => undefined}
      onDone={() => undefined}
      onViewLedger={() => undefined}
      onViewCalendar={() => undefined}
      onLogNextSession={() => undefined}
      onOpenProgramming={() => undefined}
      onResumeSession={() => undefined}
      onEditSetEvidence={() => undefined}
      onEditSessionNotes={() => undefined}
      onCorrectEquipment={() => undefined}
      onViewSessionHistory={() => undefined}
      onOpenMovementHistory={() => undefined}
    />
  </>;
}
