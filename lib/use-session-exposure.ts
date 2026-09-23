import { useEffect, useSyncExternalStore } from 'react';
import { fetchCanonicalMovementHistory } from './canonical-movement-history';
import type { MovementHistoryLaunchTarget } from './movement-history-launch';
import { exposureSnapshotKey, sessionExposureCache, type ExposureSnapshotIdentity, type SessionExposureContext } from './session-exposure-cache';
import { exposureFromAccessoryHistory, exposureFromCoreHistory, exposureFromHydration, type HydratedExposureHistory, type SessionExposure } from './session-exposure-snapshot';

export type SessionExposureRead = Readonly<{
  status: 'loading' | 'found' | 'empty' | 'error' | 'unresolved' | 'unavailable';
  exposure: SessionExposure;
  retry?: () => void;
}>;

export function sessionExposureIdentity(context: SessionExposureContext | undefined, target: MovementHistoryLaunchTarget | null): ExposureSnapshotIdentity | null {
  if (!context?.ownerId || !Number.isInteger(context.workoutId) || context.workoutId <= 0
    || !/^\d{4}-\d{2}-\d{2}/.test(context.sessionDate) || !target
    || target.athleteId !== context.athleteId || !Number.isInteger(context.athleteId) || context.athleteId <= 0
    || Boolean(target.coreMovementId) === Boolean(target.movementDefinitionId)) return null;
  const id = target.coreMovementId || target.movementDefinitionId;
  if (!Number.isInteger(id) || Number(id) <= 0) return null;
  return { ...context, coreMovementId: target.coreMovementId, movementDefinitionId: target.movementDefinitionId,
    equipmentId: target.equipmentContextDefinitionId };
}

/** A single existing exact-movement endpoint, six exposure cards, no Ledger or
 * per-row requests. The canonical series also resolves older scheduled Sessions.
 * Exhaustive range is essential: a recent-only window cannot prove no history.
 */
export async function loadCoreSessionExposure(identity: ExposureSnapshotIdentity): Promise<SessionExposure> {
  const history = await fetchCanonicalMovementHistory({ athleteId: identity.athleteId,
    coreMovementId: identity.coreMovementId, range: 'all', limit: 6 });
  if (history.scope !== 'exact_core_identity' || history.comparison_allowed !== true
    || history.filters.date_range !== 'all') throw new Error('Exact exposure could not be determined.');
  const exposure = exposureFromCoreHistory(history, identity);
  if (!exposure && history.summary.set_count > 0
    && String(history.summary.first_performed_on || '').slice(0, 10) < identity.sessionDate.slice(0, 10)) {
    // Known prior evidence with no usable comparable projection is unavailable,
    // not proof that this athlete never performed the movement.
    throw new Error('Prior evidence is unavailable for exact comparison.');
  }
  return exposure;
}

/** Same canonical subject and All History query as the History destination.
 * A missing/stale Session summary says nothing about this endpoint's evidence.
 * Page until prior usable evidence or an authoritative end, including when an
 * older scheduled Session falls outside the first six exposure cards. */
export async function loadAccessoryEditorExposure(identity: ExposureSnapshotIdentity): Promise<SessionExposure> {
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const history = await fetchCanonicalMovementHistory({ athleteId: identity.athleteId,
      movementDefinitionId: identity.movementDefinitionId,
      equipmentContextDefinitionId: identity.equipmentId, range: 'all', limit: 6, cursor });
    if (history.scope !== 'exact_identity' || history.filters.date_range !== 'all'
      || history.filters.selected_scope !== 'all_history') throw new Error('Exact exposure could not be determined.');
    const exposure = exposureFromAccessoryHistory(history, identity);
    if (exposure) return exposure;
    if (!history.has_more) {
      if (history.summary.set_count > 0
        && String(history.summary.first_performed_on || '').slice(0, 10) < identity.sessionDate.slice(0, 10)) {
        throw new Error('Prior evidence is unavailable for this summary.');
      }
      return null;
    }
    if (!history.next_cursor || seen.has(history.next_cursor)) throw new Error('Exact exposure history is incomplete.');
    cursor = history.next_cursor;
    seen.add(cursor);
  } while (cursor);
  return null;
}

export function hydratedSessionExposureRead(history: HydratedExposureHistory | null | undefined, identity: ExposureSnapshotIdentity): SessionExposureRead {
  if (!history || history.identity_scope === 'unresolved_identity') return { status: 'unresolved', exposure: null };
  if (history.identity_scope !== 'exact_identity' || history.movement_definition_id !== identity.movementDefinitionId
    || history.comparison_allowed !== true || !history.comparison_identity_key
    || (history.comparison_scope === 'exact_implementation'
      && (!identity.equipmentId || history.equipment_configuration_identity_id !== identity.equipmentId))) return { status: 'unavailable', exposure: null };
  const exposure = exposureFromHydration(history, { ...identity, comparisonKey: history.comparison_identity_key });
  if (exposure) return { status: 'found', exposure };
  return { status: history.previous_exposure === null ? 'empty' : 'unavailable', exposure: null };
}

/** Shared by Logger and authoring. The authorized Session response supplies the
 * athlete; the canonical movement resolver supplies the exact subject. Draft
 * prescription, units, scrolling, focus and render clocks are not cache keys.
 */
export function useSessionExposure({ context, target, history, canonicalEditorHistory = false }: {
  context?: SessionExposureContext; target: MovementHistoryLaunchTarget | null;
  history?: HydratedExposureHistory | null;
  canonicalEditorHistory?: boolean;
}): SessionExposureRead {
  const identity = sessionExposureIdentity(context, target);
  const key = identity ? exposureSnapshotKey(identity) : null;
  const revision = useSyncExternalStore(sessionExposureCache.subscribe, sessionExposureCache.snapshot);
  useEffect(() => {
    if (!identity || (!identity.coreMovementId && !canonicalEditorHistory)) return;
    void sessionExposureCache.ensure(identity, () => identity.coreMovementId
      ? loadCoreSessionExposure(identity) : loadAccessoryEditorExposure(identity));
    // Only the exact subject and explicit evidence invalidation drive reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision, canonicalEditorHistory]);
  if (!identity) return { status: 'unresolved', exposure: null };
  if (!identity.coreMovementId && !canonicalEditorHistory) return hydratedSessionExposureRead(history, identity);
  const exposure = sessionExposureCache.get(identity);
  const retry = () => sessionExposureCache.retry(identity);
  if (exposure) return { status: 'found', exposure };
  const status = sessionExposureCache.status(identity);
  if (status === 'error' || status === 'blocked') return { status: 'error', exposure: null, ...(status === 'error' ? { retry } : {}) };
  if (status === 'ready' && exposure === null) return { status: 'empty', exposure: null };
  return { status: 'loading', exposure: null };
}
