import { fetchJson } from '@/lib/api';

export type AthleteScratchpad = {
  relationship_id: number;
  note_id: number | null;
  body: string;
  body_preview: string | null;
  updated_at: string | null;
  updated_by: { id: number; name: string } | null;
  version: string | null;
  is_empty: boolean;
};

export type AthleteScratchpadResponse = {
  ok: boolean;
  error?: string;
  code?: string;
  athlete?: { id: number; name: string };
  scratchpad?: AthleteScratchpad;
};

const cache = new Map<string, AthleteScratchpad>();
const MAX_CACHE_ENTRIES = 24;

export function cachedAthleteScratchpad(cacheKey: string): AthleteScratchpad | null {
  return cache.get(cacheKey) || null;
}

export function cacheAthleteScratchpad(cacheKey: string, scratchpad: AthleteScratchpad): void {
  cache.delete(cacheKey);
  cache.set(cacheKey, scratchpad);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const first = cache.keys().next().value as string | undefined;
    if (first == null) break;
    cache.delete(first);
  }
}

export async function getAthleteScratchpad(athleteId: number, signal?: AbortSignal) {
  return fetchJson<AthleteScratchpadResponse>(`/coach/mobile/athletes/${athleteId}/scratchpad`, { signal });
}

export async function saveAthleteScratchpad(athleteId: number, body: string, expectedVersion: string | null) {
  return fetchJson<AthleteScratchpadResponse>(`/coach/mobile/athletes/${athleteId}/scratchpad`, {
    method: 'PUT',
    body: JSON.stringify({ body, expected_version: expectedVersion }),
    requestImportance: 'critical-mutation',
  });
}
