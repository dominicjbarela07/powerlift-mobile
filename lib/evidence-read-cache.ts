/** Short-lived navigation reuse. Authorization credentials never leave memory.
 * Every mutation invalidates both completed reads and older in-flight results.
 * Server reads still authorize the relationship; this is not an access grant.
 */
export class EvidenceReadCache {
  private entries = new Map<string, { promise: Promise<any>; expires: number; generation: number }>();
  private scope = '';
  private generation = 0;
  private evidenceRevision = 0;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.evidenceRevision;
  constructor(private readonly ttlMs = 10_000, private readonly now = Date.now) {}
  invalidate(notify = true) { this.generation += 1; this.entries.clear(); if (notify) { this.evidenceRevision += 1; this.listeners.forEach((listener) => listener()); } }
  read<T extends { ok: boolean; json: unknown }>(scope: string, key: string, load: () => Promise<T>): Promise<T> {
    if (scope !== this.scope) { this.invalidate(false); this.scope = scope; }
    const existing = this.entries.get(key);
    if (existing && existing.expires > this.now()) return existing.promise;
    const generation = this.generation;
    const entry = { promise: null as unknown as Promise<T>, expires: Infinity, generation };
    entry.promise = load().then((result) => {
      if (generation !== this.generation || !result.ok || !result.json
        || (typeof result.json === 'object' && 'ok' in result.json && result.json.ok === false)) {
        if (this.entries.get(key) === entry) this.entries.delete(key);
      } else entry.expires = this.now() + this.ttlMs;
      return result;
    }, (error) => { if (this.entries.get(key) === entry) this.entries.delete(key); throw error; });
    this.entries.set(key, entry);
    while (this.entries.size > 32) this.entries.delete(this.entries.keys().next().value!);
    return entry.promise;
  }
}
export const evidenceReadCache = new EvidenceReadCache();
export const invalidateEvidenceReads = () => evidenceReadCache.invalidate();
export function isEvidenceRead(path: string) {
  // Only the pure, selected-week projection is eligible; legacy training reads
  // can attach Sessions by date and must never enter this cache.
  if (/^\/workouts\/mobile\/programming\/composition(?:\?|$)/.test(path)) return true;
  return /^(\/mobile\/ledger(?:\/|\?|$)|\/athletes\/mobile\/progression(?:\?|$)|\/workouts\/mobile\/accomplishments(?:\/|\?|$))/.test(path);
}
