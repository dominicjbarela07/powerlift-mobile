import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchArchiveCollection, type ArchiveCollection, type ArchiveItem } from '@/lib/ledger-archive';
import { fetchLedgerAccomplishmentPage, type AccomplishmentEvent } from '@/lib/ledger-data';
import { CAREER_PR_EVENT_TYPES } from '@/lib/ledger-rewards';
import type { HistoryDateRange } from '@/lib/ledger-history-presentation';
import { useEvidenceRevision } from './use-ledger-resource';
export type HistoryFilter = ArchiveCollection | 'prs' | 'imports';
type Result = { key: string; items: ArchiveItem[]; events: AccomplishmentEvent[]; cursor: string | null; error?: unknown };

/** Bounded, cursor-backed reads. A filter/subject change cannot accept an older response. */
export function useLedgerHistory(subject: string, athleteId: number | undefined, filter: HistoryFilter, query: string, range: HistoryDateRange = {}) {
  const evidenceRevision = useEvidenceRevision();
  const [retry, setRetry] = useState(0), [result, setResult] = useState<Result | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const key = `${subject}:${filter}:${query}:${range.from??''}:${range.to??''}:${retry}:${evidenceRevision}`;
  const current = useRef(key); current.current = key;
  const sequence = useRef(0), inFlight = useRef(false);
  const load = useCallback(async (cursor?: string) => {
    if (inFlight.current && cursor) return;
    const ticket = ++sequence.current; inFlight.current = true; setBusyKey(key);
    try {
      let items: ArchiveItem[] = [], events: AccomplishmentEvent[] = [], next: string | null = null;
      if (filter === 'prs') {
        const page = await fetchLedgerAccomplishmentPage(24, cursor, athleteId, undefined, [...CAREER_PR_EVENT_TYPES]);
        events = page.items; next = page.hasMore ? page.nextCursor : null;
      } else {
        const request = { athlete_id: athleteId, limit: 24, cursor, q: query || undefined, source_type: filter==='imports'?'historical':undefined, date_from:range.from,date_to:range.to };
        const page = await fetchArchiveCollection(filter==='imports'?'training':filter, request);
        items = page.items; next = page.has_more ? page.next_cursor : null;
      }
      if (ticket !== sequence.current || current.current !== key) return;
      setResult(old => ({ key, items: cursor && old?.key === key ? [...new Map([...old.items, ...items].map(i => [`${i.archive_item_type}:${i.source_id}`,i])).values()] : items,
        events: cursor && old?.key === key ? [...new Map([...old.events,...events].map(e => [e.id,e])).values()] : events, cursor: next }));
    } catch (error) {
      if (ticket === sequence.current && current.current === key) { const denied=[401,403].includes(Number((error as {status?:number}).status)); setResult(old => !denied && old?.key === key ? {...old,error} : {key,items:[],events:[],cursor:denied ? null : cursor ?? null,error}); }
    } finally { if (ticket === sequence.current) { inFlight.current = false; setBusyKey(null); } }
  }, [athleteId,filter,key,query,range.from,range.to]);
  useEffect(() => { inFlight.current = false; void load(); return () => { sequence.current++; inFlight.current = false; }; }, [load]);
  const visible = result?.key === key ? result : null;
  return { items: visible?.items ?? [], events: visible?.events ?? [], cursor: visible?.cursor ?? null,
    error: visible?.error, loading: !visible, loadingMore: Boolean(visible && busyKey === key),
    more: () => visible?.cursor && load(visible.cursor), reload: () => setRetry(n => n+1) };
}
