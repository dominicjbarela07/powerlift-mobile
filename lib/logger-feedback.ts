import { formatLoggerWeightDeltaKg, formatLoggerWeightKg, type LoggerDisplayUnit } from './logger-weight-format.js';

const KG_PER_VOLUME_LB = 0.45359237;
const volumeDisplayValue = (valueLb: number, unit: LoggerDisplayUnit) => Math.round(unit === 'lb' ? valueLb : valueLb * KG_PER_VOLUME_LB);
const formatVolumeValue = (value: number) => Math.round(value).toLocaleString('en-US');
const formatVolumeLb = (valueLb: number, unit: LoggerDisplayUnit) => `${formatVolumeValue(volumeDisplayValue(valueLb, unit))} ${unit.toUpperCase()}`;
const formatCompactVolumeLb = (valueLb: number, unit: LoggerDisplayUnit) => {
  const value = volumeDisplayValue(valueLb, unit);
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(2))}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return formatVolumeValue(value);
};

export const LOGGER_RECOGNITION_EVENT_TYPES = [
  'CORE_WEIGHT_PR',
  'CORE_REP_MAX_PR',
  'CORE_RPE_PR',
  'CORE_SAME_WEIGHT_REP_PR',
  'CORE_E1RM_PR',
  'CORE_BLOCK_WEIGHT_BEST',
  'CORE_BLOCK_REP_MAX_BEST',
  'CORE_BLOCK_SAME_WEIGHT_REP_BEST',
  'CORE_BLOCK_E1RM_BEST',
  'CORE_PRESCRIPTION_COMPLETED',
  'CORE_MOVEMENT_SESSION_COMPLETED',
  'CORE_LIFETIME_VOLUME_MILESTONE',
  'TOTAL_LIFETIME_VOLUME_MILESTONE',
] as const;

export type LoggerRecognitionEvent = {
  id: number; event_type: string; priority: number; core_movement_key: string; movement_label: string;
  current_value: number | null; prior_value: number | null; delta: number | null; unit: string | null;
  scope: string; comparison_bucket?: string | null; source_set_log_id?: number | null; trigger_set_log_id: number;
  source_revision: number; calculation_version: string; newly_generated: boolean; replayed: boolean; consumed: boolean;
  evidence?: Record<string, unknown>;
  workout_id?: number; workout_date?: string | null; workout_title?: string | null;
  historical?: boolean; presentation_mode?: 'transient' | 'historical'; is_current_best?: boolean;
  invalidated?: boolean; invalidated_at?: string | null; valid?: boolean;
  secondary_highlight_count?: number;
  transient_delivery_id?: string;
  source?: { workout_id?: number | null; workout_item_id?: number | null; set_log_id?: number | null };
};

export type CompletionBoundaryMetadata = {
  authority: 'canonical';
  movement_final_set: boolean;
  session_final_set: boolean;
  workout_evidence_revision?: number | null;
};

export function isNewCanonicalSessionFinalSet(result: {
  created?: boolean;
  replayed?: boolean;
  completionBoundary?: CompletionBoundaryMetadata | null;
}): boolean {
  return result.created === true
    && result.replayed !== true
    && result.completionBoundary?.authority === 'canonical'
    && result.completionBoundary.session_final_set === true;
}

export type LoggerFeedbackState = {
  submission: { status: 'idle' | 'submitting' | 'failure' | 'stale_conflict' | 'refreshing_stale' | 'persisted_new_set' | 'idempotent_replay'; activeItemId: number | null; lastSetLogId: number | null; accomplishmentCount: number };
  recognition: { status: 'idle' | 'queued' | 'displayed' | 'consumed'; saveConfirmationVisible: boolean; currentEvent: LoggerRecognitionEvent | null; queuedEvents: LoggerRecognitionEvent[]; displayedDeliveryIds: string[]; consumedDeliveryIds: string[] };
  timer: { status: 'idle' | 'picker_pending' | 'active' };
  appLifecycle: 'foreground' | 'background';
  sourceMutation: { status: 'none' | 'set_edited' | 'set_deleted'; sourceSetLogId: number | null };
  completionBoundary: { status: 'none' | 'movement_final_set' | 'session_final_set'; authority: 'unconfirmed' | 'canonical'; workoutEvidenceRevision: number | null };
};

export const initialLoggerFeedbackState: LoggerFeedbackState = {
  submission: { status: 'idle', activeItemId: null, lastSetLogId: null, accomplishmentCount: 0 },
  recognition: { status: 'idle', saveConfirmationVisible: false, currentEvent: null, queuedEvents: [], displayedDeliveryIds: [], consumedDeliveryIds: [] },
  timer: { status: 'idle' },
  appLifecycle: 'foreground',
  sourceMutation: { status: 'none', sourceSetLogId: null },
  completionBoundary: { status: 'none', authority: 'unconfirmed', workoutEvidenceRevision: null },
};

export type LoggerFeedbackAction =
  | { type: 'SUBMIT_STARTED'; itemId: number }
  | { type: 'SUBMIT_FAILED'; staleConflict?: boolean }
  | { type: 'STALE_REFRESH_STARTED' } | { type: 'STALE_REFRESH_SUCCEEDED' } | { type: 'STALE_REFRESH_FAILED' }
  | { type: 'SUBMIT_SUCCEEDED'; setLogId: number; created: boolean; replayed: boolean; events: LoggerRecognitionEvent[]; completionBoundary?: CompletionBoundaryMetadata | null }
  | { type: 'CANONICAL_COMPLETION_CONFIRMED'; completionBoundary: CompletionBoundaryMetadata }
  | { type: 'SAVE_CONFIRMATION_FINISHED' }
  | { type: 'TIMER_PICKER_PENDING' } | { type: 'TIMER_ACTIVE' } | { type: 'TIMER_IDLE' }
  | { type: 'DISPLAY_NEXT_RECOGNITION' } | { type: 'RECOGNITION_PRESENTATION_STARTED'; deliveryId: string } | { type: 'CONSUME_CURRENT_RECOGNITION' }
  | { type: 'RESTORE_PENDING'; events: LoggerRecognitionEvent[] } | { type: 'RESTORE_CONSUMED'; deliveryIds: string[] }
  | { type: 'INVALIDATE_EVENTS'; eventIds?: number[]; sourceSetLogId?: number }
  | { type: 'APP_BACKGROUNDED' } | { type: 'APP_RESUMED' }
  | { type: 'SET_EDITED'; sourceSetLogId: number } | { type: 'SET_DELETED'; sourceSetLogId: number }
  | { type: 'RESET' };

const MAX_DISPLAYED_IDS = 100;
const MAX_CONSUMED_IDS = 500;
const boundedUnique = (values: string[], limit: number) => [...new Set(values.map(String).filter(Boolean))].slice(-limit);
const recognitionStatus = (current: LoggerRecognitionEvent | null, queued: LoggerRecognitionEvent[], consumed = false): LoggerFeedbackState['recognition']['status'] => current ? 'displayed' : queued.length ? 'queued' : consumed ? 'consumed' : 'idle';

export function recognitionDeliveryId(event: LoggerRecognitionEvent): string {
  return String(event.transient_delivery_id || `legacy-event:${event.id}`);
}

export function attachTransientRecognitionDelivery(
  events: LoggerRecognitionEvent[] = [],
  context: { workoutId: string | number; clientSubmissionId?: string | null },
): LoggerRecognitionEvent[] {
  const workoutId = String(context.workoutId);
  const submissionId = String(context.clientSubmissionId || '').trim();
  return events.map((event) => ({
    ...event,
    transient_delivery_id: submissionId
      ? `${workoutId}:${submissionId}:${event.id}`
      : `${workoutId}:legacy:${event.id}:${event.source_revision}`,
  }));
}

export function normalizeRecognitionEvents(events: LoggerRecognitionEvent[] = []): LoggerRecognitionEvent[] {
  const unique = new Map<number, LoggerRecognitionEvent>();
  events.filter((event) => Number.isFinite(Number(event?.id)) && event.newly_generated && !event.replayed).forEach((event) => unique.set(Number(event.id), event));
  return [...unique.values()].sort((a, b) => a.priority - b.priority || a.id - b.id);
}

const COMPLETION_EVENT_TYPES = new Set([
  'CORE_PRESCRIPTION_COMPLETED',
  'CORE_MOVEMENT_SESSION_COMPLETED',
]);

const TRANSIENT_RECOGNITION_EVENT_TYPES = new Set([
  'CORE_WEIGHT_PR',
  'CORE_REP_MAX_PR',
  'CORE_RPE_PR',
  'CORE_BLOCK_WEIGHT_BEST',
  'CORE_BLOCK_REP_MAX_BEST',
  'CORE_LIFETIME_VOLUME_MILESTONE',
  'TOTAL_LIFETIME_VOLUME_MILESTONE',
]);
export const MAJOR_VOLUME_MILESTONE_EVENT_TYPES = new Set([
  'CORE_LIFETIME_VOLUME_MILESTONE',
  'TOTAL_LIFETIME_VOLUME_MILESTONE',
]);
const SESSION_HIGHLIGHT_EVENT_TYPES = new Set([
  ...TRANSIENT_RECOGNITION_EVENT_TYPES,
  'CORE_E1RM_PR',
  'CORE_BLOCK_E1RM_BEST',
]);

/**
 * Curate durable accomplishment truth into useful transient celebrations.
 * Completion bookkeeping remains available to history/summary surfaces, while
 * the logger shows one primary PR plus any separately earned major lifetime
 * landmarks. A landmark is not a secondary PR and can never be overwritten by
 * one; it follows the primary recognition in lift-before-total order.
 */
function curateRecognitionEvents(events: LoggerRecognitionEvent[]): LoggerRecognitionEvent[] {
  const eligible = events
    .filter(isEligibleCoreAccomplishment)
    .sort((a, b) => a.priority - b.priority || a.id - b.id);
  const grouped = new Map<string, LoggerRecognitionEvent[]>();
  eligible.forEach((event) => {
    const key = canonicalSourceKey(event);
    grouped.set(key, [...(grouped.get(key) || []), event]);
  });
  return [...grouped.values()].flatMap((group) => {
    const ordinary = group.filter((event) => !MAJOR_VOLUME_MILESTONE_EVENT_TYPES.has(event.event_type));
    const milestones = group
      .filter((event) => MAJOR_VOLUME_MILESTONE_EVENT_TYPES.has(event.event_type))
      .sort((a, b) => {
        const scopeOrder = (event: LoggerRecognitionEvent) => event.event_type === 'CORE_LIFETIME_VOLUME_MILESTONE' ? 0 : 1;
        return scopeOrder(a) - scopeOrder(b) || a.priority - b.priority || a.id - b.id;
      });
    const primary = ordinary[0];
    return [
      ...(primary ? [{ ...primary, secondary_highlight_count: Math.max(0, ordinary.length - 1) }] : []),
      ...milestones.map((event) => ({ ...event, secondary_highlight_count: 0 })),
    ];
  });
}

function canonicalSourceKey(event: LoggerRecognitionEvent): string {
  const sourceId = Number(event.source_set_log_id || event.trigger_set_log_id || event.id);
  return `${event.core_movement_key}:${sourceId}`;
}

function isEligibleCoreAccomplishment(event: LoggerRecognitionEvent): boolean {
  return TRANSIENT_RECOGNITION_EVENT_TYPES.has(event.event_type)
    && !COMPLETION_EVENT_TYPES.has(event.event_type)
    && (event.prior_value != null || event.event_type === 'CORE_REP_MAX_PR' || MAJOR_VOLUME_MILESTONE_EVENT_TYPES.has(event.event_type))
    && event.invalidated !== true
    && !event.invalidated_at
    && event.valid !== false;
}

function isEligibleSessionHighlight(event: LoggerRecognitionEvent): boolean {
  return SESSION_HIGHLIGHT_EVENT_TYPES.has(event.event_type)
    && !COMPLETION_EVENT_TYPES.has(event.event_type)
    && (event.prior_value != null || event.event_type === 'CORE_REP_MAX_PR')
    && event.invalidated !== true
    && !event.invalidated_at
    && event.valid !== false;
}

export function selectCelebrationEvents(events: LoggerRecognitionEvent[] = []): LoggerRecognitionEvent[] {
  return curateRecognitionEvents(normalizeRecognitionEvents(events));
}

export function selectSessionHighlights(events: LoggerRecognitionEvent[] = [], workoutId?: number): LoggerRecognitionEvent[] {
  const unique = new Map<number, LoggerRecognitionEvent>();
  events
    .filter((event) => Number.isFinite(Number(event?.id)))
    .filter((event) => workoutId == null || Number(event.workout_id || event.source?.workout_id) === Number(workoutId))
    .filter(isEligibleSessionHighlight)
    .forEach((event) => unique.set(Number(event.id), event));
  return [...unique.values()].sort((a, b) => a.priority - b.priority || a.id - b.id);
}

function canonicalBoundary(metadata: CompletionBoundaryMetadata): LoggerFeedbackState['completionBoundary'] {
  return {
    status: metadata.session_final_set ? 'session_final_set' : metadata.movement_final_set ? 'movement_final_set' : 'none',
    authority: 'canonical',
    workoutEvidenceRevision: Number.isFinite(Number(metadata.workout_evidence_revision)) ? Number(metadata.workout_evidence_revision) : null,
  };
}

export function loggerFeedbackReducer(state: LoggerFeedbackState, action: LoggerFeedbackAction): LoggerFeedbackState {
  switch (action.type) {
    case 'SUBMIT_STARTED': return { ...state, submission: { ...state.submission, status: 'submitting', activeItemId: action.itemId, accomplishmentCount: 0 } };
    case 'SUBMIT_FAILED': return { ...state, submission: { ...state.submission, status: action.staleConflict ? 'stale_conflict' : 'failure', accomplishmentCount: 0 }, recognition: { ...state.recognition, saveConfirmationVisible: false } };
    case 'STALE_REFRESH_STARTED': return { ...state, submission: { ...state.submission, status: 'refreshing_stale' } };
    case 'STALE_REFRESH_SUCCEEDED': return { ...state, submission: { ...state.submission, status: 'idle', activeItemId: null, accomplishmentCount: 0 } };
    case 'STALE_REFRESH_FAILED': return { ...state, submission: { ...state.submission, status: 'stale_conflict' } };
    case 'SUBMIT_SUCCEEDED': {
      const completionBoundary = action.completionBoundary ? canonicalBoundary(action.completionBoundary) : state.completionBoundary;
      if (action.replayed || !action.created) return { ...state, submission: { ...state.submission, status: 'idempotent_replay', lastSetLogId: action.setLogId, accomplishmentCount: 0 }, completionBoundary };
      const excluded = new Set([...state.recognition.consumedDeliveryIds, ...state.recognition.displayedDeliveryIds, ...state.recognition.queuedEvents.map(recognitionDeliveryId), state.recognition.currentEvent ? recognitionDeliveryId(state.recognition.currentEvent) : '']);
      const events = selectCelebrationEvents(action.events).filter((event) => !excluded.has(recognitionDeliveryId(event)));
      const queuedEvents = [...state.recognition.queuedEvents, ...events];
      return { ...state, submission: { ...state.submission, status: 'persisted_new_set', lastSetLogId: action.setLogId, accomplishmentCount: events.length }, recognition: { ...state.recognition, status: recognitionStatus(state.recognition.currentEvent, queuedEvents), saveConfirmationVisible: true, queuedEvents }, completionBoundary };
    }
    case 'CANONICAL_COMPLETION_CONFIRMED': return { ...state, completionBoundary: canonicalBoundary(action.completionBoundary) };
    case 'SAVE_CONFIRMATION_FINISHED': return { ...state, submission: { ...state.submission, status: 'idle', activeItemId: null }, recognition: { ...state.recognition, saveConfirmationVisible: false, status: recognitionStatus(state.recognition.currentEvent, state.recognition.queuedEvents) } };
    case 'TIMER_PICKER_PENDING': return { ...state, timer: { status: 'picker_pending' } };
    case 'TIMER_ACTIVE': return { ...state, timer: { status: 'active' } };
    case 'TIMER_IDLE': return { ...state, timer: { status: 'idle' } };
    case 'DISPLAY_NEXT_RECOGNITION': {
      if (state.appLifecycle === 'background' || state.timer.status === 'picker_pending' || state.recognition.saveConfirmationVisible || state.recognition.currentEvent || !state.recognition.queuedEvents.length) return state;
      const [currentEvent, ...queuedEvents] = state.recognition.queuedEvents;
      return { ...state, recognition: { ...state.recognition, status: 'displayed', currentEvent, queuedEvents } };
    }
    case 'RECOGNITION_PRESENTATION_STARTED': {
      if (!state.recognition.currentEvent || recognitionDeliveryId(state.recognition.currentEvent) !== action.deliveryId) return state;
      return { ...state, recognition: { ...state.recognition, displayedDeliveryIds: boundedUnique([...state.recognition.displayedDeliveryIds, action.deliveryId], MAX_DISPLAYED_IDS) } };
    }
    case 'CONSUME_CURRENT_RECOGNITION': {
      const event = state.recognition.currentEvent;
      if (!event) return state;
      const deliveryId = recognitionDeliveryId(event);
      return { ...state, recognition: { ...state.recognition, status: recognitionStatus(null, state.recognition.queuedEvents, true), currentEvent: null, consumedDeliveryIds: boundedUnique([...state.recognition.consumedDeliveryIds, deliveryId], MAX_CONSUMED_IDS) } };
    }
    case 'RESTORE_PENDING': {
      const excluded = new Set([...state.recognition.consumedDeliveryIds, ...state.recognition.displayedDeliveryIds, ...state.recognition.queuedEvents.map(recognitionDeliveryId), state.recognition.currentEvent ? recognitionDeliveryId(state.recognition.currentEvent) : '']);
      const restored = selectCelebrationEvents(action.events).filter((event) => !excluded.has(recognitionDeliveryId(event)));
      const queuedEvents = [...state.recognition.queuedEvents, ...restored];
      return { ...state, recognition: { ...state.recognition, queuedEvents, status: recognitionStatus(state.recognition.currentEvent, queuedEvents) } };
    }
    case 'RESTORE_CONSUMED': {
      const consumed = boundedUnique([...state.recognition.consumedDeliveryIds, ...action.deliveryIds], MAX_CONSUMED_IDS);
      const consumedSet = new Set(consumed);
      const currentEvent = state.recognition.currentEvent && consumedSet.has(recognitionDeliveryId(state.recognition.currentEvent)) ? null : state.recognition.currentEvent;
      const queuedEvents = state.recognition.queuedEvents.filter((event) => !consumedSet.has(recognitionDeliveryId(event)));
      return { ...state, recognition: { ...state.recognition, consumedDeliveryIds: consumed, currentEvent, queuedEvents, status: recognitionStatus(currentEvent, queuedEvents) } };
    }
    case 'INVALIDATE_EVENTS': {
      const invalidIds = new Set((action.eventIds || []).map(Number));
      const matches = (event: LoggerRecognitionEvent) => invalidIds.has(event.id) || (action.sourceSetLogId != null && (event.source_set_log_id === action.sourceSetLogId || event.trigger_set_log_id === action.sourceSetLogId));
      const currentEvent = state.recognition.currentEvent && matches(state.recognition.currentEvent) ? null : state.recognition.currentEvent;
      const queuedEvents = state.recognition.queuedEvents.filter((event) => !matches(event));
      return { ...state, recognition: { ...state.recognition, currentEvent, queuedEvents, status: recognitionStatus(currentEvent, queuedEvents) } };
    }
    case 'APP_BACKGROUNDED': return { ...state, appLifecycle: 'background' };
    case 'APP_RESUMED': return { ...state, appLifecycle: 'foreground' };
    case 'SET_EDITED': return loggerFeedbackReducer(
      { ...state, sourceMutation: { status: 'set_edited', sourceSetLogId: action.sourceSetLogId } },
      { type: 'INVALIDATE_EVENTS', sourceSetLogId: action.sourceSetLogId },
    );
    case 'SET_DELETED': return loggerFeedbackReducer(
      { ...state, sourceMutation: { status: 'set_deleted', sourceSetLogId: action.sourceSetLogId } },
      { type: 'INVALIDATE_EVENTS', sourceSetLogId: action.sourceSetLogId },
    );
    case 'RESET': return initialLoggerFeedbackState;
    default: return state;
  }
}

export type RecognitionPresentation = { eyebrow: string; value: string; detail: string | null; delta: string | null; progression: string | null; workload: string | null; accessibilityLabel: string; severity: 'career' | 'block' | 'completion' };
const count = (value: number | null | undefined) => value == null || !Number.isFinite(Number(value)) ? '—' : String(Number(value));
type RecognitionMetric = 'weight' | 'rep_max' | 'rpe' | 'reps' | 'sets';

function formatRpe(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `@${Number(value).toFixed(1).replace(/\.0$/, '')}`;
}

function formatCountMetric(value: number | null | undefined, singular: 'rep' | 'set'): string {
  const formatted = count(value);
  if (formatted === '—') return formatted;
  return `${formatted} ${Math.abs(Number(value)) === 1 ? singular : `${singular}s`}`;
}

function historicalRecognitionLabel(value: string): string {
  const label = value.replace(/^New /, '');
  return label.replace(/^weight PR/, 'Weight PR');
}

export function recognitionPresentation(event: LoggerRecognitionEvent, displayUnit: LoggerDisplayUnit, mode: 'transient' | 'historical' = 'transient'): RecognitionPresentation | null {
  if (mode === 'transient' && ['CORE_E1RM_PR', 'CORE_BLOCK_E1RM_BEST'].includes(event.event_type)) return null;
  if (MAJOR_VOLUME_MILESTONE_EVENT_TYPES.has(event.event_type)) {
    const evidence = event.evidence || {};
    const thresholdLb = Math.max(1, Number(evidence.threshold_lb) || Math.round(Number(event.current_value || 0) / 0.45359237));
    const exactKg = Math.max(0, Number(evidence.new_total_kg) || Number(event.current_value) || 0);
    const exactValue = displayUnit === 'kg' ? exactKg : exactKg / 0.45359237;
    const liftFamily = String(evidence.lift_family || '').trim();
    const isLift = event.event_type === 'CORE_LIFETIME_VOLUME_MILESTONE';
    const eyebrow = isLift ? `${liftFamily.toUpperCase()} LIFETIME VOLUME LANDMARK` : 'MAJOR LIFETIME VOLUME LANDMARK';
    const nextThresholdLb = Number(evidence.next_threshold_lb);
    const next = nextThresholdLb > 0 ? `Next ${formatVolumeLb(nextThresholdLb, displayUnit)}` : null;
    const value = `${formatCompactVolumeLb(thresholdLb, displayUnit)} ${displayUnit.toUpperCase()}`;
    const detail = `${formatVolumeValue(exactValue)} ${displayUnit.toUpperCase()} accumulated`;
    return {
      eyebrow,
      value,
      detail,
      delta: null,
      progression: next,
      workload: null,
      severity: 'career',
      accessibilityLabel: [eyebrow, value, detail, next].filter(Boolean).join('. '),
    };
  }
  const movement = event.movement_label || 'Core movement';
  const load = formatLoggerWeightKg(Number(event.evidence?.actual_weight_kg), displayUnit);
  const spokenUnit = displayUnit === 'kg' ? 'kilograms' : 'pounds';
  const repCount = Number(event.evidence?.rep_count ?? event.evidence?.actual_reps ?? String(event.comparison_bucket || '').replace(/^reps:/, ''));
  const repMaxTitle = Number.isInteger(repCount) && repCount > 0 ? `${repCount} REP MAX` : 'REP MAX';
  const map: Record<string, { eyebrow: string; accessibilityEyebrow?: string; severity: RecognitionPresentation['severity']; metric: RecognitionMetric }> = {
    CORE_WEIGHT_PR: { eyebrow: 'New weight PR', severity: 'career', metric: 'weight' },
    CORE_REP_MAX_PR: {
      eyebrow: event.prior_value == null ? `${repMaxTitle} ESTABLISHED` : `NEW ${repMaxTitle}`,
      severity: 'career',
      metric: 'rep_max',
    },
    CORE_RPE_PR: { eyebrow: 'MORE EFFICIENT', severity: 'career', metric: 'rpe' },
    CORE_SAME_WEIGHT_REP_PR: { eyebrow: `Rep PR at ${load} ${displayUnit}`, accessibilityEyebrow: `Rep PR at ${load} ${spokenUnit}`, severity: 'career', metric: 'reps' },
    CORE_E1RM_PR: { eyebrow: 'New e1RM PR', severity: 'career', metric: 'weight' },
    CORE_BLOCK_WEIGHT_BEST: { eyebrow: 'Block weight best', severity: 'block', metric: 'weight' },
    CORE_BLOCK_REP_MAX_BEST: { eyebrow: `${repMaxTitle} BLOCK BEST`, severity: 'block', metric: 'rep_max' },
    CORE_BLOCK_SAME_WEIGHT_REP_BEST: { eyebrow: `Block rep best at ${load} ${displayUnit}`, accessibilityEyebrow: `Block rep best at ${load} ${spokenUnit}`, severity: 'block', metric: 'reps' },
    CORE_BLOCK_E1RM_BEST: { eyebrow: 'Block e1RM best', severity: 'block', metric: 'weight' },
    CORE_PRESCRIPTION_COMPLETED: { eyebrow: 'Prescription logged', severity: 'completion', metric: 'sets' },
    CORE_MOVEMENT_SESSION_COMPLETED: { eyebrow: 'Movement work logged', severity: 'completion', metric: 'sets' },
  };
  const config = map[event.event_type]; if (!config) return null;
  const eyebrow = event.event_type === 'CORE_RPE_PR' && mode === 'historical'
    ? 'Movement Efficiency'
    : event.event_type === 'CORE_REP_MAX_PR' && mode === 'historical'
    ? (event.prior_value == null ? `${repMaxTitle} ESTABLISHED` : `${repMaxTitle} IMPROVED`)
    : mode === 'historical' ? historicalRecognitionLabel(config.eyebrow) : config.eyebrow;
  const accessibilityEyebrow = event.event_type === 'CORE_RPE_PR' && mode === 'historical'
    ? eyebrow
    : event.event_type === 'CORE_REP_MAX_PR' && mode === 'historical'
    ? eyebrow
    : mode === 'historical'
    ? historicalRecognitionLabel(config.accessibilityEyebrow || config.eyebrow)
    : (config.accessibilityEyebrow || config.eyebrow);
  const isWeightMetric = config.metric === 'weight' || config.metric === 'rep_max';
  const isRpeMetric = config.metric === 'rpe';
  const value = isWeightMetric
    ? `${formatLoggerWeightKg(event.current_value, displayUnit)} ${displayUnit}`
    : isRpeMetric
    ? formatRpe(event.current_value)
    : formatCountMetric(event.current_value, config.metric === 'reps' ? 'rep' : 'set');
  const detailValue = isWeightMetric
    ? `${formatLoggerWeightKg(event.prior_value, displayUnit)} ${displayUnit}`
    : isRpeMetric
    ? formatRpe(event.prior_value)
    : formatCountMetric(event.prior_value, config.metric === 'reps' ? 'rep' : 'set');
  const detail = event.prior_value == null ? null : `Previous ${detailValue}`;
  const deltaValue = isWeightMetric
    ? `${formatLoggerWeightDeltaKg(event.delta, displayUnit)} ${displayUnit}`
    : isRpeMetric
    ? `${Number(event.delta).toFixed(1)} RPE`
    : formatCountMetric(event.delta, config.metric === 'reps' ? 'rep' : 'set');
  const delta = event.delta != null && (event.delta > 0 || isRpeMetric)
    ? `${!isRpeMetric && event.delta > 0 ? '+' : ''}${deltaValue}`
    : null;
  const spokenValue = isWeightMetric ? `${formatLoggerWeightKg(event.current_value, displayUnit)} ${spokenUnit}` : value;
  const spokenDetail = event.prior_value == null ? null : isWeightMetric
    ? `Previous ${formatLoggerWeightKg(event.prior_value, displayUnit)} ${spokenUnit}`
    : detail;
  const progression = event.prior_value == null ? null : config.metric === 'reps'
    ? `${load} ${displayUnit} × ${count(event.prior_value)} → ${load} ${displayUnit} × ${count(event.current_value)}`
    : isRpeMetric
    ? `${detailValue} → ${value}`
    : `${detailValue} → ${value}`;
  const workload = isRpeMetric && Number.isInteger(repCount) && repCount > 0
    ? `${load} ${displayUnit} × ${repCount}`
    : null;
  const spokenWorkload = isRpeMetric && Number.isInteger(repCount) && repCount > 0
    ? `${load} ${spokenUnit} for ${repCount} reps`
    : null;
  return { eyebrow, value, detail, delta, progression, workload, severity: config.severity, accessibilityLabel: [accessibilityEyebrow, movement, spokenWorkload, spokenValue, spokenDetail, delta].filter(Boolean).join('. ') };
}

export function feedbackAnalytics(eventName: string, fields: Record<string, string | number | boolean | null | undefined> = {}) { console.info('[LOGGER_FEEDBACK]', { event_name: eventName, ...fields }); }
const CAREER_EVENT_TYPES = new Set(['CORE_WEIGHT_PR', 'CORE_REP_MAX_PR']);
const BLOCK_EVENT_TYPES = new Set(['CORE_BLOCK_WEIGHT_BEST', 'CORE_BLOCK_REP_MAX_BEST']);
export function acceptedSetHapticKind(events: LoggerRecognitionEvent[]): 'career' | 'block' | 'completion' | 'ordinary' { const primary = selectCelebrationEvents(events)[0]; if (primary?.event_type === 'CORE_RPE_PR') return 'block'; if (primary && CAREER_EVENT_TYPES.has(primary.event_type)) return 'career'; if (primary && BLOCK_EVENT_TYPES.has(primary.event_type)) return 'block'; return 'ordinary'; }
export async function safelyRunHaptic(effect: () => Promise<unknown>): Promise<boolean> { try { await effect(); return true; } catch { return false; } }
export function feedbackMotionDuration(durationMs: number, reduceMotion: boolean): number { return reduceMotion ? 0 : durationMs; }
export function submissionFailureHapticKind(): 'error' { return 'error'; }

export type LogSetActionPresentation = {
  label: 'Log Set' | 'Saving' | 'Logged' | 'Try Again' | 'Refresh' | 'Refreshing';
  tone: 'ready' | 'saving' | 'accepted' | 'failure' | 'refreshing';
  disabled: boolean;
  accessibilityLabel: string;
};

export function logSetActionPresentation(
  status: LoggerFeedbackState['submission']['status'],
  isActiveItem: boolean,
): LogSetActionPresentation {
  if (!isActiveItem || status === 'idle' || status === 'idempotent_replay') {
    return { label: 'Log Set', tone: 'ready', disabled: false, accessibilityLabel: 'Log set' };
  }
  if (status === 'submitting') {
    return { label: 'Saving', tone: 'saving', disabled: true, accessibilityLabel: 'Saving set' };
  }
  if (status === 'persisted_new_set') {
    return { label: 'Logged', tone: 'accepted', disabled: true, accessibilityLabel: 'Set logged' };
  }
  if (status === 'stale_conflict') {
    return { label: 'Refresh', tone: 'failure', disabled: false, accessibilityLabel: 'Set changed. Refresh Session' };
  }
  if (status === 'refreshing_stale') {
    return { label: 'Refreshing', tone: 'refreshing', disabled: true, accessibilityLabel: 'Refreshing Session' };
  }
  return { label: 'Try Again', tone: 'failure', disabled: false, accessibilityLabel: 'Set was not saved. Try again' };
}

export const ACCEPTED_SET_SHEET_DWELL_MS = 700;
export type LogSheetHandoffPlan = { delayMs: number; openTimerPicker: boolean };
export type TimerHandoffOutcome = 'selected' | 'dismissed' | 'unavailable';

/**
 * React Native supplies a press event when a callback is passed directly to
 * `onPress`. Treat every value except the explicit selected outcome as a
 * dismissal so a synthetic event can never strand the recognition queue.
 */
export function timerHandoffResolution(outcome: unknown): Exclude<TimerHandoffOutcome, 'unavailable'> {
  return outcome === 'selected' ? 'selected' : 'dismissed';
}

export type TimerHandoffReleaseController = {
  begin: (identity: string, onUnavailable: () => void) => boolean;
  mounted: (identity: string) => boolean;
  resolve: (identity: string) => boolean;
  reset: () => void;
};

/**
 * Owns the short mount handshake between the stable workout screen and the
 * native timer modal. Once mounted, user choice owns resolution. If the modal
 * cannot mount, recognition is released instead of waiting forever.
 */
export function createTimerHandoffReleaseController(
  scheduleMountCheck: (callback: () => void) => unknown = (callback) => setTimeout(callback, 250),
  cancelMountCheck: (handle: unknown) => void = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
): TimerHandoffReleaseController {
  let activeIdentity: string | null = null;
  let resolved = true;
  let mountCheckHandle: unknown = null;

  const clearMountCheck = () => {
    if (mountCheckHandle == null) return;
    cancelMountCheck(mountCheckHandle);
    mountCheckHandle = null;
  };

  return {
    begin(identity, onUnavailable) {
      if (!identity || (activeIdentity === identity && !resolved)) return false;
      clearMountCheck();
      activeIdentity = identity;
      resolved = false;
      mountCheckHandle = scheduleMountCheck(() => {
        mountCheckHandle = null;
        if (resolved || activeIdentity !== identity) return;
        resolved = true;
        onUnavailable();
      });
      return true;
    },
    mounted(identity) {
      if (resolved || activeIdentity !== identity) return false;
      clearMountCheck();
      return true;
    },
    resolve(identity) {
      if (resolved || activeIdentity !== identity) return false;
      resolved = true;
      clearMountCheck();
      return true;
    },
    reset() {
      resolved = true;
      activeIdentity = null;
      clearMountCheck();
    },
  };
}

export function logSheetHandoffPlan(status: LoggerFeedbackState['submission']['status']): LogSheetHandoffPlan | null {
  if (status === 'persisted_new_set') return { delayMs: ACCEPTED_SET_SHEET_DWELL_MS, openTimerPicker: true };
  if (status === 'idempotent_replay') return { delayMs: 0, openTimerPicker: false };
  return null;
}

export type LogSheetHandoffController = {
  begin: (
    status: LoggerFeedbackState['submission']['status'],
    setLogId: number | null,
    activeItemId: number | null,
    onHandoff: (plan: LogSheetHandoffPlan) => void,
  ) => boolean;
  cancelPending: () => void;
  reset: () => void;
};

export type CanonicalSetSubmissionOutcome<T> =
  | { status: 'accepted'; value: T }
  | { status: 'failed'; error: unknown }
  | { status: 'ignored_in_flight' }
  | { status: 'cancelled' };

export type CanonicalSetSubmissionController = {
  run: <TResponse, TAccepted = TResponse>(options: {
    request: () => Promise<TResponse>;
    onStarted: () => void;
    onAccepted?: (response: TResponse) => TAccepted;
    onFailure: (error: unknown) => void;
    onSettled?: () => void;
  }) => Promise<CanonicalSetSubmissionOutcome<TAccepted>>;
  reset: () => void;
  isInFlight: () => boolean;
};

/**
 * Owns only the canonical request lifecycle. Presentation is notified after
 * acceptance, but is never awaited and cannot keep persistence in-flight.
 */
export function createCanonicalSetSubmissionController(): CanonicalSetSubmissionController {
  let inFlight = false;
  let generation = 0;

  const run = async <TResponse, TAccepted = TResponse>({
    request,
    onStarted,
    onAccepted,
    onFailure,
    onSettled,
  }: {
    request: () => Promise<TResponse>;
    onStarted: () => void;
    onAccepted?: (response: TResponse) => TAccepted;
    onFailure: (error: unknown) => void;
    onSettled?: () => void;
  }): Promise<CanonicalSetSubmissionOutcome<TAccepted>> => {
    if (inFlight) return { status: 'ignored_in_flight' };

    inFlight = true;
    const runGeneration = generation;
    onStarted();

    try {
      const response = await request();
      if (runGeneration !== generation) return { status: 'cancelled' };
      const value = onAccepted ? onAccepted(response) : response as unknown as TAccepted;
      return { status: 'accepted', value };
    } catch (error) {
      if (runGeneration !== generation) return { status: 'cancelled' };
      onFailure(error);
      return { status: 'failed', error };
    } finally {
      if (runGeneration === generation) {
        inFlight = false;
        onSettled?.();
      }
    }
  };

  return {
    run,
    reset() {
      generation += 1;
      inFlight = false;
    },
    isInFlight() {
      return inFlight;
    },
  };
}

export type CanonicalSetResultGate = {
  consume: (workoutId: string | number, clientSubmissionId: string | null | undefined, response: any) => boolean;
  reset: () => void;
};

/**
 * Numeric set-log IDs are database-local and can be reused by the isolated
 * demo reset. Dedupe therefore follows the client submission identity first.
 */
export function createCanonicalSetResultGate(): CanonicalSetResultGate {
  const consumed = new Set<string>();
  return {
    consume(workoutId, clientSubmissionId, response) {
      const responseSubmissionId = String(response?.client_submission_id || response?.set?.client_submission_id || '').trim();
      const submissionId = String(clientSubmissionId || responseSubmissionId).trim();
      const setLogId = Number(response?.set?.id || 0);
      const identity = submissionId || (setLogId > 0 ? `legacy-set:${setLogId}` : 'missing-result-identity');
      const key = `${String(workoutId)}:${identity}`;
      if (consumed.has(key)) return false;
      consumed.add(key);
      return true;
    },
    reset() {
      consumed.clear();
    },
  };
}

export function createLogSheetHandoffController(
  schedule: (callback: () => void, delayMs: number) => unknown = (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle: unknown) => void = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
): LogSheetHandoffController {
  const consumed = new Set<string>();
  let pendingHandle: unknown = null;
  const cancelPending = () => {
    if (pendingHandle == null) return;
    cancel(pendingHandle);
    pendingHandle = null;
  };
  return {
    begin(status, setLogId, activeItemId, onHandoff) {
      const plan = logSheetHandoffPlan(status);
      if (!plan || setLogId == null || activeItemId == null) return false;
      const key = `${status}:${setLogId}:${activeItemId}`;
      if (consumed.has(key)) return false;
      consumed.add(key);
      cancelPending();
      if (plan.delayMs === 0) {
        onHandoff(plan);
      } else {
        pendingHandle = schedule(() => {
          pendingHandle = null;
          onHandoff(plan);
        }, plan.delayMs);
      }
      return true;
    },
    cancelPending,
    reset() {
      cancelPending();
      consumed.clear();
    },
  };
}

export type PrescribedOpportunity = {
  eyebrow: 'Movement closeout';
  message: string;
  accessibilityLabel: string;
};

/**
 * The only client-local anticipation we can state safely is structural:
 * whether the already-prescribed current set closes the movement. Historical
 * best opportunities require canonical server preview evidence and are not
 * inferred from mobile history.
 */
export function finalAssignedSetOpportunity(
  movementLabel: string,
  steps: { state: 'completed' | 'active' | 'locked' }[],
): PrescribedOpportunity | null {
  const activeCount = steps.filter((step) => step.state === 'active').length;
  const remainingCount = steps.filter((step) => step.state !== 'completed').length;
  if (activeCount !== 1 || remainingCount !== 1) return null;
  return {
    eyebrow: 'Movement closeout',
    message: `Complete this assigned set to finish ${movementLabel}.`,
    accessibilityLabel: `Movement closeout. Complete this assigned set to finish ${movementLabel}.`,
  };
}

export function recognitionVisibleDuration(event: LoggerRecognitionEvent | null): number {
  if (!event) return 0;
  if (MAJOR_VOLUME_MILESTONE_EVENT_TYPES.has(event.event_type)) return 7000;
  if (event.event_type === 'CORE_RPE_PR') return 4200;
  if (CAREER_EVENT_TYPES.has(event.event_type)) return 5000;
  if (BLOCK_EVENT_TYPES.has(event.event_type)) return 3400;
  return 2200;
}
