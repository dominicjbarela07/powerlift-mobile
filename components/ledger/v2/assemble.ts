import type { ArchiveLanding, ArchivePage } from '@/lib/ledger-archive';
import type {
  AccomplishmentPage,
  CurrentBest,
  LedgerProgression,
  LedgerRange,
} from '@/lib/ledger-data';
import type {
  LedgerV2DataIssue,
  LedgerV2DataSource,
  LedgerV2Scope,
  LedgerV2Snapshot,
} from './types';

export type LedgerV2Requests = Readonly<{
  progression: (range: LedgerRange) => Promise<LedgerProgression>;
  currentBests: () => Promise<CurrentBest[]>;
  accomplishments: () => Promise<AccomplishmentPage>;
  landing: () => Promise<ArchiveLanding>;
  training: (dateFrom: string) => Promise<ArchivePage>;
  search: (dateFrom: string) => Promise<ArchivePage>;
}>;

function scopeDateFrom(scope: LedgerV2Scope, today = new Date()): string {
  if (scope === 'all') return '1900-01-01';
  if (scope === 'year') return `${today.getFullYear()}-01-01`;
  const start = new Date(today);
  start.setDate(start.getDate() - 89);
  return start.toISOString().slice(0, 10);
}

function apiRange(scope: LedgerV2Scope): '90d' | '1y' | 'all' {
  if (scope === '3m') return '90d';
  if (scope === 'year') return '1y';
  return 'all';
}

function issueFor(source: LedgerV2DataSource, error: unknown): LedgerV2DataIssue {
  const status = typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : null;
  const kind = status === 401 || status === 403
    ? 'unauthorized'
    : status === 404 || status === 410
      ? 'unavailable'
      : 'error';
  return { source, status, kind };
}

function fallbackLanding(
  progression: LedgerV2Snapshot['progression'],
  sessionCount: number,
): ArchiveLanding {
  return {
    ok: true,
    athlete: {
      id: progression.athlete?.id ?? 0,
      name: progression.athlete?.name || 'Athlete',
    },
    recent: [],
    rediscovery: [],
    collection_summaries: {
      training: progression.consistency?.sessions_completed ?? sessionCount,
      media: 0,
      competition: 0,
    },
    supported_filters: { training: [], media: [], competition: [] },
  };
}

function normalizeLanding(
  value: ArchiveLanding | null,
  progression: LedgerV2Snapshot['progression'],
  sessionCount: number,
): ArchiveLanding {
  const fallback = fallbackLanding(progression, sessionCount);
  if (!value || typeof value !== 'object') return fallback;
  return {
    ...fallback,
    ...value,
    athlete: value.athlete && typeof value.athlete === 'object' ? value.athlete : fallback.athlete,
    recent: Array.isArray(value.recent) ? value.recent : [],
    rediscovery: Array.isArray(value.rediscovery) ? value.rediscovery : [],
    collection_summaries: {
      ...fallback.collection_summaries,
      ...(value.collection_summaries && typeof value.collection_summaries === 'object' ? value.collection_summaries : {}),
    },
    supported_filters: {
      ...fallback.supported_filters,
      ...(value.supported_filters && typeof value.supported_filters === 'object' ? value.supported_filters : {}),
    },
  };
}

export async function assembleLedgerV2Snapshot(
  scope: LedgerV2Scope,
  requests: LedgerV2Requests,
): Promise<LedgerV2Snapshot> {
  const dateFrom = scopeDateFrom(scope);
  const range = apiRange(scope);
  const results = await Promise.allSettled([
    requests.progression(range),
    requests.currentBests(),
    requests.accomplishments(),
    requests.landing(),
    requests.training(dateFrom),
    requests.search(dateFrom),
  ] as const);
  const sources: LedgerV2DataSource[] = [
    'progression', 'current_bests', 'accomplishments',
    'archive_landing', 'archive_training', 'archive_search',
  ];
  const issues = results.flatMap((result, index) =>
    result.status === 'rejected' ? [issueFor(sources[index], result.reason)] : []
  );
  if (issues.length === results.length) {
    throw results.find((result): result is PromiseRejectedResult => result.status === 'rejected')!.reason;
  }

  if (issues.length > 0) console.warn('[LedgerV2] partial evidence response', issues);

  const progressionResult = results[0];
  const bestsResult = results[1];
  const accomplishmentsResult = results[2];
  const landingResult = results[3];
  const trainingResult = results[4];
  const searchResult = results[5];
  const progression = progressionResult.status === 'fulfilled' && progressionResult.value && typeof progressionResult.value === 'object'
    ? progressionResult.value
    : {};
  const sessions = trainingResult.status === 'fulfilled' && Array.isArray(trainingResult.value?.items)
    ? trainingResult.value.items
    : [];

  return {
    scope,
    apiRange: range,
    dateFrom,
    progression,
    currentBests: bestsResult.status === 'fulfilled' && Array.isArray(bestsResult.value) ? bestsResult.value : [],
    accomplishments: accomplishmentsResult.status === 'fulfilled' && Array.isArray(accomplishmentsResult.value?.items)
      ? accomplishmentsResult.value.items
      : [],
    landing: normalizeLanding(landingResult.status === 'fulfilled' ? landingResult.value : null, progression, sessions.length),
    sessions,
    evidence: searchResult.status === 'fulfilled' && Array.isArray(searchResult.value?.items) ? searchResult.value.items : [],
    issues,
  };
}
