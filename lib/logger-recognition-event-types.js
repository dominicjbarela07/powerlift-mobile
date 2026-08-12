/**
 * The governed recognition truth emitted by the Logger backend contract.
 * Kept as plain JavaScript so both Metro and the repository's Node regression
 * harness consume the exact same list without a generated build artifact.
 */
export const LOGGER_RECOGNITION_EVENT_TYPES = Object.freeze([
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
]);
