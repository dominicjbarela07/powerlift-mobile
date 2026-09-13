import { evidenceReadCache } from './evidence-read-cache';
import type { SessionExposure } from './session-exposure-snapshot';

export type ExposureSnapshotIdentity = Readonly<{
  ownerId: string; athleteId: number; workoutId: number; sessionDate: string;
  coreMovementId?: number; movementDefinitionId?: number; equipmentId?: number;
  comparisonKey?: string | null;
}>;
export type SessionExposureContext = Pick<ExposureSnapshotIdentity, 'ownerId' | 'athleteId' | 'workoutId' | 'sessionDate'>;
export type ExposureReadStatus = 'idle' | 'loading' | 'ready' | 'error' | 'blocked';

export function exposureSnapshotKey(identity: ExposureSnapshotIdentity) {
  return JSON.stringify([identity.ownerId, identity.athleteId, identity.workoutId, identity.sessionDate,
    identity.coreMovementId ? 'core' : 'accessory', identity.coreMovementId || identity.movementDefinitionId,
    identity.equipmentId || null, identity.comparisonKey || null]);
}

/** Session-scoped evidence, not a freshness timer. No credentials or disk storage.
 * A changed revision invalidates the request, never the last successful value.
 * The containing Session must still pass its normal authorization/hydration gate.
 */
export class SessionExposureCache<T> {
  private entries = new Map<string, { identity: ExposureSnapshotIdentity; value: T | undefined;
    revision: number; attempted: number; error?: boolean; pending?: Promise<void> }>();
  private listeners = new Set<() => void>();
  private version = 0;
  private blocked = false;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.version;
  private emit() { this.version++; this.listeners.forEach(listener => listener()); }
  clear() { this.blocked = false; this.entries.clear(); this.emit(); }
  deny() { this.blocked = true; this.entries.clear(); this.emit(); }
  authorize() { if (this.blocked) { this.blocked = false; this.emit(); } }
  get(identity: ExposureSnapshotIdentity) { return this.entries.get(exposureSnapshotKey(identity))?.value; }
  status(identity: ExposureSnapshotIdentity): ExposureReadStatus {
    if (this.blocked) return 'blocked';
    const entry = this.entries.get(exposureSnapshotKey(identity));
    if (entry?.error) return 'error';
    if (entry?.pending) return 'loading';
    return entry && entry.value !== undefined && entry.attempted === entry.revision ? 'ready' : 'idle';
  }
  retry(identity: ExposureSnapshotIdentity) {
    if (this.blocked) return;
    const entry = this.entries.get(exposureSnapshotKey(identity));
    if (entry) { entry.revision++; entry.error = false; }
    this.emit();
  }
  invalidate(change: { path?: string } = {}) {
    // All current-Session mutations are excluded from its prior exposure. Another
    // Session's edits/deletes/completion may change history. Explicit refreshes
    // and catalog/policy changes invalidate without guessing a movement by name.
    const path = change.path?.split('?')[0];
    const workoutId = path?.match(/^\/workouts\/mobile\/(\d+)(?:\/|$)/)?.[1];
    if (path && !workoutId && !/movement|equipment|history|setlog|import/.test(path)) return;
    if (path && /\/(readiness|checkin|checkout|post_session_survey|begin)$/.test(path)) return;
    let changed = false;
    for (const entry of this.entries.values()) {
      if (workoutId && Number(workoutId) === entry.identity.workoutId) continue;
      entry.revision++; changed = true;
    }
    if (changed) this.emit();
  }
  async ensure(identity: ExposureSnapshotIdentity, load: () => Promise<T>): Promise<void> {
    if (this.blocked) return;
    const key = exposureSnapshotKey(identity);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { identity, value: undefined, revision: 0, attempted: -1 };
      this.entries.set(key, entry);
      // Bounded navigation reuse, independent of time or units.
      if (this.entries.size > 32) this.entries.delete(this.entries.keys().next().value!);
    }
    if (entry.pending) return entry.pending;
    if (entry.attempted === entry.revision) return;
    const revision = entry.revision;
    entry.attempted = revision;
    const active = entry;
    active.error = false;
    active.pending = Promise.resolve().then(load).then(value => {
      if (this.entries.get(key) !== active || active.revision !== revision) return;
      if (JSON.stringify(active.value) !== JSON.stringify(value)) { active.value = value; this.emit(); }
    }).catch(() => {
      if (this.entries.get(key) !== active || active.revision !== revision) return;
      // An unsuccessful read is never a successful empty result. Keep known
      // evidence, expose failure, and retry only on explicit invalidation.
      active.error = true;
      this.emit();
    }).finally(() => {
      active.pending = undefined;
      if (this.entries.get(key) === active && active.revision !== revision) void this.ensure(identity, load);
      else if (this.entries.get(key) === active && active.value == null) this.emit();
    });
    if (active.value == null) this.emit();
    return active.pending;
  }
}

export const sessionExposureCache = new SessionExposureCache<SessionExposure>();
evidenceReadCache.onInvalidation(change => sessionExposureCache.invalidate(change));
