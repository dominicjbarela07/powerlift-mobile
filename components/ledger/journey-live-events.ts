import {
  fetchArchiveCollection,
  type ArchiveCollection,
  type ArchiveItem,
} from '@/lib/ledger-archive';
import {
  fetchLedgerAccomplishmentPage,
  type AccomplishmentEvent,
  type LedgerUnit,
} from '@/lib/ledger-data';
import { buildJourneyMoments } from './journey-moments';
import type { JourneyMoment } from './model';

async function fetchAllArchive(collection: ArchiveCollection, maxPages = 20): Promise<{ items: ArchiveItem[]; complete: boolean }> {
  const items: ArchiveItem[] = [];
  let cursor: string | null = null;
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await fetchArchiveCollection(collection, { limit: 50, cursor: cursor ?? undefined });
    items.push(...page.items);
    cursor = page.next_cursor;
    if (!page.has_more || !cursor) return { items, complete: true };
  }
  return { items, complete: false };
}

async function fetchAllAccomplishments(maxPages = 20): Promise<{ items: AccomplishmentEvent[]; complete: boolean }> {
  const items: AccomplishmentEvent[] = [];
  let cursor: string | null = null;
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await fetchLedgerAccomplishmentPage(50, cursor);
    items.push(...page.items);
    cursor = page.nextCursor;
    if (!page.hasMore || !cursor) return { items, complete: true };
  }
  return { items, complete: false };
}

/**
 * Runtime Journey adapter. Archive and accomplishment services remain source
 * owners; this layer only collects canonical pages for the pure moment policy.
 */
export async function fetchJourneyArchiveEvents(unit: LedgerUnit = 'lb'): Promise<JourneyMoment[]> {
  const [training, media, competition, accomplishmentPage] = await Promise.all([
    fetchAllArchive('training'),
    fetchAllArchive('media'),
    fetchAllArchive('competition'),
    fetchAllAccomplishments(),
  ]);
  return buildJourneyMoments({
    archiveItems: [...training.items, ...media.items, ...competition.items],
    accomplishments: accomplishmentPage.items,
    archiveHistoryComplete: training.complete && competition.complete,
    accomplishmentHistoryComplete: accomplishmentPage.complete,
    unit,
  });
}
