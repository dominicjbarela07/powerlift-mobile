import {
  LOGGER_RECOGNITION_EVENT_TYPES,
  type LoggerRecognitionEventType,
} from './logger-recognition-event-types.js';

export { LOGGER_RECOGNITION_EVENT_TYPES } from './logger-recognition-event-types.js';
export type { LoggerRecognitionEventType } from './logger-recognition-event-types.js';
export type RecognitionMotionPrimitive =
  | 'record-takeover'
  | 'movement-efficiency'
  | 'major-volume'
  | 'completion-evidence';

export type RecognitionMotionConfig = {
  primitive: RecognitionMotionPrimitive;
  workshopEntryId: string;
  haptics: readonly ['medium-impact', 'success-settle'] | readonly ['heavy-impact'] | readonly [];
  reducedMotion: 'final-evidence-only';
};

/**
 * The single production registry used by both the Session Logger and the DEV
 * Motion Workshop. Known recognition truth can never fall through to a generic
 * presentation; adding a new event type requires an explicit mapping here.
 */
export const CANONICAL_RECOGNITION_MOTION_REGISTRY = {
  CORE_WEIGHT_PR: { primitive: 'record-takeover', workshopEntryId: 'weight-pr', haptics: ['medium-impact', 'success-settle'], reducedMotion: 'final-evidence-only' },
  CORE_REP_MAX_PR: { primitive: 'record-takeover', workshopEntryId: 'rep-max-pr', haptics: ['medium-impact', 'success-settle'], reducedMotion: 'final-evidence-only' },
  CORE_RPE_PR: { primitive: 'movement-efficiency', workshopEntryId: 'rpe-pr', haptics: ['medium-impact', 'success-settle'], reducedMotion: 'final-evidence-only' },
  CORE_SAME_WEIGHT_REP_PR: { primitive: 'record-takeover', workshopEntryId: 'rep-max-pr', haptics: ['medium-impact', 'success-settle'], reducedMotion: 'final-evidence-only' },
  CORE_E1RM_PR: { primitive: 'record-takeover', workshopEntryId: 'weight-pr', haptics: ['medium-impact', 'success-settle'], reducedMotion: 'final-evidence-only' },
  CORE_BLOCK_WEIGHT_BEST: { primitive: 'record-takeover', workshopEntryId: 'weight-pr', haptics: ['medium-impact', 'success-settle'], reducedMotion: 'final-evidence-only' },
  CORE_BLOCK_REP_MAX_BEST: { primitive: 'record-takeover', workshopEntryId: 'rep-max-pr', haptics: ['medium-impact', 'success-settle'], reducedMotion: 'final-evidence-only' },
  CORE_BLOCK_SAME_WEIGHT_REP_BEST: { primitive: 'record-takeover', workshopEntryId: 'rep-max-pr', haptics: ['medium-impact', 'success-settle'], reducedMotion: 'final-evidence-only' },
  CORE_BLOCK_E1RM_BEST: { primitive: 'record-takeover', workshopEntryId: 'weight-pr', haptics: ['medium-impact', 'success-settle'], reducedMotion: 'final-evidence-only' },
  CORE_PRESCRIPTION_COMPLETED: { primitive: 'completion-evidence', workshopEntryId: 'completed-row-insertion', haptics: [], reducedMotion: 'final-evidence-only' },
  CORE_MOVEMENT_SESSION_COMPLETED: { primitive: 'completion-evidence', workshopEntryId: 'completed-row-insertion', haptics: [], reducedMotion: 'final-evidence-only' },
  CORE_LIFETIME_VOLUME_MILESTONE: { primitive: 'major-volume', workshopEntryId: 'major-volume-lift', haptics: ['heavy-impact'], reducedMotion: 'final-evidence-only' },
  TOTAL_LIFETIME_VOLUME_MILESTONE: { primitive: 'major-volume', workshopEntryId: 'major-volume-total', haptics: ['heavy-impact'], reducedMotion: 'final-evidence-only' },
} as const satisfies Record<LoggerRecognitionEventType, RecognitionMotionConfig>;

export const CANONICAL_RECORD_RECOGNITION_MOTION = {
  entranceMs: 307,
  stateMs: 244,
  spatialMs: 403,
  staggerMs: 28,
  phaseDelayMs: 543,
  distancePx: 8,
  overshootPx: 12,
  emphasisScale: 1,
  spring: { stiffness: 260, damping: 14, mass: 0.68 },
} as const;

export function isKnownRecognitionEventType(value: string): value is LoggerRecognitionEventType {
  return Object.prototype.hasOwnProperty.call(CANONICAL_RECOGNITION_MOTION_REGISTRY, value);
}

export function recognitionMotionConfig(value: string | null | undefined): RecognitionMotionConfig | null {
  return value && isKnownRecognitionEventType(value)
    ? CANONICAL_RECOGNITION_MOTION_REGISTRY[value]
    : null;
}
