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
  options: { kind?: 'core' | 'accessory'; lift?: string; equipment?: string; pr?: boolean; video?: string } = {},
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
  const sets = [0, 1, 2].map((offset) => ({
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
    measurement: { measurement_type: 'load_reps', comparison_eligible: true, comparison_scope: 'exact_movement_identity' },
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

const movements = [
  movement(1, 'Romanian Deadlift', 'hamstrings', ['glutes', 'lower_back'], 83.9146, 10, { kind: 'core', lift: 'DL', pr: true, video: 'hinge' }),
  movement(2, 'Machine Shoulder Press', 'front_delts', ['side_delts', 'triceps'], 70.3068, 10, { equipment: 'Newtech · Plate Loaded' }),
  movement(3, 'Walking Lunge', 'quads', ['glutes'], 61.235, 12, { equipment: 'Rogue · Dumbbells' }),
  movement(4, 'Machine Lateral Raise', 'side_delts', ['front_delts'], 36.2874, 13, { equipment: 'Matrix · Selectorized', video: 'machine' }),
  movement(5, 'Leg Extension', 'quads', [], 29.4835, 15, { equipment: 'Matrix · Selectorized' }),
  movement(6, 'Standing Calf Raise', 'calves', [], 40.8233, 15, { equipment: 'Bodymasters · Selectorized' }),
];

const recap: CompletedSessionRecapPayload = {
  schema_version: 'completed-session-recap-v3',
  lifecycle_mode: 'completed_recap',
  workout_id: 742,
  athlete: { id: 77, name: 'Amanda LeFore', sex: 'F', anatomy_display_preference: 'feminine' },
  session: {
    label: 'W4 Lower B', date: '2026-08-13', status: 'completed',
    completed_at: '2026-08-13T16:23:00-07:00', duration_seconds: 2640,
    set_count: 20, movement_count: 6, video_count: 2, total_volume_kg: 7302.82,
    reported_bodyweight: { reported_bodyweight_kg: 64.772, training_date: '2026-08-13', source: 'PRE_SESSION_READINESS' },
    volume_trend: {
      scope: 'current_training_block', delta_kg: 544.31,
      points: [
        { date: '2026-07-10', workout_id: 710, volume_kg: 4626.65 },
        { date: '2026-07-24', workout_id: 724, volume_kg: 5352.39 },
        { date: '2026-08-02', workout_id: 732, volume_kg: 5896.7 },
        { date: '2026-08-09', workout_id: 739, volume_kg: 6758.51 },
        { date: '2026-08-13', workout_id: 742, volume_kg: 7302.82, current: true },
      ],
    },
  },
  highlights: {
    summary_id: 'session:742:certification', session_streak: 76, pr_count: 1,
    accomplishment_count: 1, session_volume_kg: 7302.82,
    all_prescribed_work_logged: true, prescribed_set_count: 20,
    completed_prescribed_set_count: 20, prescription_completion_percent: 100,
  },
  performed_movements: movements,
  muscle_focus: {
    primary: [{ muscle_id: 'hamstrings', score: 7 }, { muscle_id: 'quads', score: 6 }, { muscle_id: 'glutes', score: 4 }, { muscle_id: 'calves', score: 3 }],
    secondary: [{ muscle_id: 'adductors', score: 2.5 }, { muscle_id: 'lower_back', score: 1.5 }],
    source: 'performed',
  },
  accomplishments: [{ id: 91, event_type: 'CORE_REP_MAX_PR', movement_label: 'Romanian Deadlift', workout_item_id: 1, source_set_log_id: 1001 }],
  reflection: { session_rpe: 7, strength: 'strong', fatigue: 'medium', note: 'Felt strong today. Lower back held up well on RDLs. Lunges were brutal. 🔥', submitted_at: '2026-08-13T16:25:00-07:00' },
  coach_feedback: { feedback: 'Great execution today. Strong hamstring focus and excellent volume. RDL PR is solid—keep building consistency.', feedback_at: '2026-08-13T18:45:00-07:00', reviewed: true, reviewed_at: '2026-08-13T18:45:00-07:00', outcome: 'on_track', author: { id: 12, name: 'Coach John' } },
  readiness_context: { sleep_quality: 7.5, stress: 4, energy: 8, soreness: 5, readiness_score: 7.5, bodyweight_kg: 64.772 },
  plan: { available: true, programming_notes: 'Controlled eccentric on all posterior-chain work.', movements: movements.map((row) => ({ item_id: row.item_id, label: row.label, sets: row.sets.length, reps: row.best_set?.reps, rir_target: 2 })) },
};

export default function SessionRecapCertificationScreen() {
  const params = useLocalSearchParams<{ mode?: string; units?: string; offset?: string; expand?: string; tab?: string }>();
  const initialScrollOffsetY = Math.max(0, Number(params.offset) || 0);
  if (!__DEV__) return null;
  return <>
    <Stack.Screen options={{ headerShown: false }} />
    <CompletedSessionRecap
      recap={recap}
      preferredUnits={params.units === 'kg' ? 'kg' : 'lbs'}
      viewerMode={params.mode === 'coach' ? 'coach' : 'athlete'}
      initialTab={params.tab === 'plan' ? 'plan' : 'performed'}
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
        onSave: () => undefined,
      } : undefined}
      onClose={() => undefined}
      onDone={() => undefined}
      onViewLedger={() => undefined}
      onViewCalendar={() => undefined}
      onLogNextSession={() => undefined}
      onOpenProgramming={() => undefined}
    />
  </>;
}
