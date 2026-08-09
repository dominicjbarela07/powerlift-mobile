import type { LoggerRecognitionEvent } from './logger-feedback';

export const LOGGER_FEEDBACK_STORAGE_VERSION = 6;
export const MAX_CONSUMED_RECOGNITION_IDS = 500;

export type LoggerFeedbackStoredDocument = {
  version: 6;
  pending: LoggerRecognitionEvent[];
  consumed: string[];
  invalidatedEventIds: number[];
  invalidatedSourceSetLogIds: number[];
};

export type LoggerFeedbackStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const validTypes = new Set<string>([
  'CORE_WEIGHT_PR', 'CORE_REP_MAX_PR', 'CORE_RPE_PR', 'CORE_SAME_WEIGHT_REP_PR', 'CORE_E1RM_PR',
  'CORE_BLOCK_WEIGHT_BEST', 'CORE_BLOCK_REP_MAX_BEST', 'CORE_BLOCK_SAME_WEIGHT_REP_BEST', 'CORE_BLOCK_E1RM_BEST',
  'CORE_PRESCRIPTION_COMPLETED', 'CORE_MOVEMENT_SESSION_COMPLETED',
]);
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const nullableFinite = (value: unknown) => value == null || finite(value);
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const storedDeliveryId = (event: LoggerRecognitionEvent) => String(event.transient_delivery_id || `legacy-event:${event.id}`);

export function isValidStoredRecognitionEvent(value: unknown): value is LoggerRecognitionEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return Number.isInteger(event.id) && Number(event.id) > 0 && validTypes.has(String(event.event_type)) &&
    finite(event.priority) && nonEmpty(event.core_movement_key) && nonEmpty(event.movement_label) &&
    nullableFinite(event.current_value) && nullableFinite(event.prior_value) && nullableFinite(event.delta) &&
    (event.unit == null || typeof event.unit === 'string') && nonEmpty(event.scope) &&
    (event.source_set_log_id == null || (Number.isInteger(event.source_set_log_id) && Number(event.source_set_log_id) > 0)) &&
    Number.isInteger(event.trigger_set_log_id) && Number(event.trigger_set_log_id) > 0 &&
    Number.isInteger(event.source_revision) && Number(event.source_revision) > 0 && nonEmpty(event.calculation_version) &&
    typeof event.newly_generated === 'boolean' && typeof event.replayed === 'boolean' && typeof event.consumed === 'boolean' &&
    (event.transient_delivery_id == null || nonEmpty(event.transient_delivery_id)) &&
    (event.evidence == null || (typeof event.evidence === 'object' && !Array.isArray(event.evidence)));
}

const validDeliveryIds = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter((id): id is string => nonEmpty(id)).map((id) => id.trim()))].slice(-MAX_CONSUMED_RECOGNITION_IDS)
  : [];
const validIds = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter((id): id is number => Number.isInteger(id) && Number(id) > 0))].slice(-MAX_CONSUMED_RECOGNITION_IDS)
  : [];
const emptyDocument = (): LoggerFeedbackStoredDocument => ({ version: LOGGER_FEEDBACK_STORAGE_VERSION, pending: [], consumed: [], invalidatedEventIds: [], invalidatedSourceSetLogIds: [] });

export function parseLoggerFeedbackDocument(raw: string | null): LoggerFeedbackStoredDocument {
  if (!raw) return emptyDocument();
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || value.version !== LOGGER_FEEDBACK_STORAGE_VERSION || !Array.isArray(value.pending) || !Array.isArray(value.consumed)) return emptyDocument();
    const consumed = validDeliveryIds(value.consumed);
    const invalidatedEventIds = validIds(value.invalidatedEventIds);
    const invalidatedSourceSetLogIds = validIds(value.invalidatedSourceSetLogIds);
    const consumedSet = new Set(consumed);
    const invalidEvents = new Set(invalidatedEventIds);
    const invalidSources = new Set(invalidatedSourceSetLogIds);
    const pendingById = new Map<string, LoggerRecognitionEvent>();
    value.pending.filter(isValidStoredRecognitionEvent).forEach((event) => {
      if (!consumedSet.has(storedDeliveryId(event)) && !invalidEvents.has(event.id) && !invalidSources.has(Number(event.source_set_log_id)) && !invalidSources.has(event.trigger_set_log_id)) pendingById.set(storedDeliveryId(event), event);
    });
    return { version: LOGGER_FEEDBACK_STORAGE_VERSION, pending: [...pendingById.values()], consumed, invalidatedEventIds, invalidatedSourceSetLogIds };
  } catch {
    return emptyDocument();
  }
}

export function createLoggerFeedbackStorage(adapter: LoggerFeedbackStorageAdapter) {
  const queues = new Map<string, Promise<void>>();
  const storageKey = (workoutId: string | number) => `logger-feedback:v6:${workoutId}`;

  const waitForPrior = async (workoutId: string | number) => { await queues.get(String(workoutId))?.catch(() => undefined); };
  const read = async (workoutId: string | number) => parseLoggerFeedbackDocument(await adapter.getItem(storageKey(workoutId)));
  const mutate = (workoutId: string | number, operation: (document: LoggerFeedbackStoredDocument) => LoggerFeedbackStoredDocument) => {
    const id = String(workoutId);
    const prior = queues.get(id) || Promise.resolve();
    const next = prior.catch(() => undefined).then(async () => {
      const current = await read(workoutId);
      const updated = operation(current);
      await adapter.setItem(storageKey(workoutId), JSON.stringify(updated));
    });
    queues.set(id, next);
    void next.finally(() => { if (queues.get(id) === next) queues.delete(id); }).catch(() => undefined);
    return next;
  };

  return {
    async load(workoutId: string | number) { await waitForPrior(workoutId); const document = await read(workoutId); return { pending: document.pending, consumed: document.consumed }; },
    persist(workoutId: string | number, events: LoggerRecognitionEvent[]) {
      return mutate(workoutId, (document) => {
        const incoming = events.filter(isValidStoredRecognitionEvent);
        const incomingEventIds = new Set(incoming.map((event) => event.id));
        const incomingSourceIds = new Set(incoming.flatMap((event) => [Number(event.source_set_log_id), event.trigger_set_log_id]).filter(Number.isFinite));
        // Numeric database IDs can be reused by the isolated demo reset. A new
        // canonical delivery identity supersedes old invalidation tombstones.
        const invalidatedEventIds = document.invalidatedEventIds.filter((id) => !incomingEventIds.has(id));
        const invalidatedSourceSetLogIds = document.invalidatedSourceSetLogIds.filter((id) => !incomingSourceIds.has(id));
        const consumed = new Set(document.consumed);
        const byId = new Map(document.pending.map((event) => [storedDeliveryId(event), event]));
        incoming.forEach((event) => { if (!consumed.has(storedDeliveryId(event))) byId.set(storedDeliveryId(event), event); });
        return { ...document, pending: [...byId.values()], invalidatedEventIds, invalidatedSourceSetLogIds };
      });
    },
    consume(workoutId: string | number, deliveryId: string) {
      return mutate(workoutId, (document) => ({ ...document, pending: document.pending.filter((event) => storedDeliveryId(event) !== deliveryId), consumed: [...new Set([...document.consumed, deliveryId])].filter(Boolean).slice(-MAX_CONSUMED_RECOGNITION_IDS) }));
    },
    invalidateSet(workoutId: string | number, sourceSetLogId: number) {
      return mutate(workoutId, (document) => ({ ...document, pending: document.pending.filter((event) => event.source_set_log_id !== sourceSetLogId && event.trigger_set_log_id !== sourceSetLogId), invalidatedSourceSetLogIds: [...new Set([...document.invalidatedSourceSetLogIds, sourceSetLogId])].slice(-MAX_CONSUMED_RECOGNITION_IDS) }));
    },
    invalidateEvents(workoutId: string | number, eventIds: number[]) {
      if (!eventIds.length) return Promise.resolve();
      const invalid = new Set(eventIds.map(Number));
      return mutate(workoutId, (document) => ({ ...document, pending: document.pending.filter((event) => !invalid.has(event.id)), invalidatedEventIds: [...new Set([...document.invalidatedEventIds, ...invalid])].filter((id) => Number.isInteger(id) && id > 0).slice(-MAX_CONSUMED_RECOGNITION_IDS) }));
    },
  };
}
