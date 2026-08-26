import { fetchJson } from '@/lib/api';
import type { DisplayWeightUnit } from '@/lib/display-units';

export type ArchiveCollection = 'training' | 'media' | 'competition';
export type ArchiveItemType = 'session' | 'set' | 'video' | 'meet' | 'movement' | 'historical_performance';

export type ArchiveItem = {
  archive_item_type: ArchiveItemType;
  source_id: number;
  athlete_id: number;
  title: string;
  subtitle?: string | null;
  occurred_on?: string;
  occurred_at?: string | null;
  created_at?: string | null;
  date_precision?: 'date' | 'datetime';
  source_type?: string;
  provenance_label?: string;
  status?: string | null;
  movement?: Record<string, unknown> | null;
  performance?: Record<string, unknown> | null;
  reported_bodyweight?: {
    reported_bodyweight_kg: number;
    reported_at?: string | null;
    training_date?: string | null;
    source: string;
  } | null;
  media?: Record<string, unknown> | null;
  program_context?: Record<string, unknown> | null;
  meet_context?: Record<string, unknown> | null;
  visibility?: 'athlete_visible';
  correction_state?: string;
  invalidation_state?: string;
  deep_link?: string;
  thumbnail_reference?: Record<string, unknown> | null;
  derived_annotations?: unknown[];
  unavailable?: { state: 'unavailable'; reason: string } | null;
};

export type ArchivePage = {
  ok: boolean;
  collection: ArchiveCollection | 'search';
  items: ArchiveItem[];
  next_cursor: string | null;
  has_more: boolean;
  ordering: string;
  error?: string;
};

export type ArchiveLanding = {
  ok: boolean;
  athlete: { id: number; name: string };
  recent: ArchiveItem[];
  rediscovery: ArchiveItem[];
  collection_summaries: Record<ArchiveCollection, number>;
  supported_filters: Record<ArchiveCollection, string[]>;
};

export type ArchiveQuery = Record<string, string | number | boolean | null | undefined> & {
  athlete_id?: number;
  cursor?: string;
  limit?: number;
  q?: string;
};

function queryString(query: ArchiveQuery = {}): string {
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return params.length ? `?${params.join('&')}` : '';
}

export class ArchiveRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ArchiveRequestError';
    this.status = status;
  }
}

async function requirePayload<T extends { ok: boolean; error?: string }>(path: string): Promise<T> {
  const response = await fetchJson<T>(path, { auth: true });
  if (!response.json || !response.ok || !response.json.ok) {
    throw new ArchiveRequestError(
      response.json?.error || `Archive request failed (${response.status}).`,
      response.status,
    );
  }
  return response.json;
}

export function fetchArchiveLanding(query: ArchiveQuery = {}): Promise<ArchiveLanding> {
  return requirePayload<ArchiveLanding>(`/mobile/ledger/archive${queryString(query)}`);
}

export function fetchArchiveCollection(collection: ArchiveCollection, query: ArchiveQuery = {}): Promise<ArchivePage> {
  return requirePayload<ArchivePage>(`/mobile/ledger/archive/${collection}${queryString(query)}`);
}

export function searchArchive(query: ArchiveQuery): Promise<ArchivePage> {
  return requirePayload<ArchivePage>(`/mobile/ledger/archive/search${queryString(query)}`);
}

export function fetchArchiveDetail(itemType: ArchiveItemType, sourceId: number, athleteId?: number): Promise<{ ok: true; item: ArchiveItem }> {
  return requirePayload<{ ok: true; item: ArchiveItem }>(
    `/mobile/ledger/archive/detail/${encodeURIComponent(itemType)}/${sourceId}${queryString({ athlete_id: athleteId })}`,
  );
}

export function archiveDetailHref(
  itemType: ArchiveItemType,
  sourceId: number,
  returnState: { collection?: ArchiveCollection; q?: string; athleteId?: number; dateFrom?: string; dateTo?: string; displayUnit?: DisplayWeightUnit } = {},
): string {
  return `/(tabs)/ledger/archive/${itemType}/${sourceId}${queryString({
    collection: returnState.collection,
    q: returnState.q,
    athlete_id: returnState.athleteId,
    date_from: returnState.dateFrom,
    date_to: returnState.dateTo,
    displayUnit: returnState.displayUnit,
  })}`;
}
