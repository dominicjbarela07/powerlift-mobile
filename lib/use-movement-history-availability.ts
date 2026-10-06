import { useEffect, useState, useSyncExternalStore } from 'react';
import { sessionExposureIdentity } from './use-session-exposure';
import { evidenceReadCache } from './evidence-read-cache';
import { fetchCanonicalMovementHistory } from './canonical-movement-history';
import type { MovementHistoryLaunchTarget } from './movement-history-launch';
import type { SessionExposureContext } from './session-exposure-cache';

type Availability = { status: 'loading' | 'found' | 'empty' | 'error' };

/** Existence of exact recorded history only. Other equipment can establish a
 * History link, never a comparable performance or PR. Only expanded empty
 * logger peeks request this read; units and render clocks do not refresh it. */
export function useMovementHistoryAvailability({ context, target, enabled }: {
  context: SessionExposureContext; target: MovementHistoryLaunchTarget; enabled: boolean;
}): Availability {
  const revision = useSyncExternalStore(evidenceReadCache.subscribe, evidenceReadCache.snapshot);
  const key = JSON.stringify([context.ownerId, context.athleteId, context.workoutId, context.sessionDate,
    target.athleteId, target.coreMovementId || null, target.movementDefinitionId || null, revision]);
  const [result, setResult] = useState<{ key: string; status: Availability['status'] } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (!sessionExposureIdentity(context, target)) {
      setResult({ key, status: 'error' });
      return;
    }
    let active = true;
    setResult({ key, status: 'loading' });
    // No equipment restriction: this answers whether the exact movement has
    // recorded evidence anywhere, not whether a different machine is comparable.
    void fetchCanonicalMovementHistory({ athleteId: target.athleteId,
      coreMovementId: target.coreMovementId, movementDefinitionId: target.movementDefinitionId,
      range: 'all', limit: 1 }).then(history => {
      if (!active) return;
      const expectedScope = target.coreMovementId ? 'exact_core_identity' : 'exact_identity';
      if (context.athleteId !== target.athleteId || history.scope !== expectedScope
        || history.filters.date_range !== 'all' || history.filters.selected_scope !== 'all_history'
        || !Number.isInteger(history.summary.set_count) || history.summary.set_count < 0) {
        throw new Error('Exact History availability could not be determined.');
      }
      setResult({ key, status: history.summary.set_count > 0 ? 'found' : 'empty' });
    }).catch(() => { if (active) setResult({ key, status: 'error' }); });
    return () => { active = false; };
    // Exact authorized subject/Session and explicit evidence revision drive reads.
    // Equipment intentionally does not change full-history existence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return result?.key === key ? { status: result.status } : { status: 'loading' };
}
