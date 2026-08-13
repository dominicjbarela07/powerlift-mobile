import type { ArchiveItem, ArchiveLanding } from '@/lib/ledger-archive';
import type {
  AccomplishmentEvent,
  CurrentBest,
  LedgerProgression,
  LedgerRange,
  LedgerUnit,
} from '@/lib/ledger-data';

export type LedgerV2Scope = '3m' | 'year' | 'all';
export type LedgerFixtureName = 'mature' | 'sparse';

export type LedgerV2Snapshot = Readonly<{
  scope: LedgerV2Scope;
  apiRange: LedgerRange;
  dateFrom: string;
  progression: LedgerProgression;
  currentBests: CurrentBest[];
  accomplishments: AccomplishmentEvent[];
  landing: ArchiveLanding;
  sessions: ArchiveItem[];
  evidence: ArchiveItem[];
}>;

export type LedgerMovementEvidence = Readonly<{
  id: number;
  key: string;
  name: string;
  family: string;
  kind: string;
  classification: 'core' | 'variant' | 'accessory';
  comparisonConfidence: string | null;
  sets: ArchiveItem[];
  latest: ArchiveItem;
  best: ArchiveItem;
  totalVolumeKg: number;
  performedSets: number;
}>;

export type LedgerBlockChapter = Readonly<{
  id: number;
  name: string;
  programId: number | null;
  programName: string | null;
  sessions: ArchiveItem[];
  firstDate: string | null;
  lastDate: string | null;
}>;

export type LedgerCoreLiftKey = 'squat' | 'bench' | 'deadlift';

export const LEDGER_SCOPE_OPTIONS: readonly { key: LedgerV2Scope; label: string }[] = [
  { key: '3m', label: 'Last 3 Months' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
] as const;

export function unitFor(snapshot: LedgerV2Snapshot): LedgerUnit {
  return snapshot.progression.athlete?.preferred_units?.toLowerCase().startsWith('lb') ? 'lb' : 'kg';
}

export function recordString(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function recordNumber(record: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function itemMovementId(item: ArchiveItem): number | null {
  const value = recordNumber(item.movement, 'id');
  return value !== null && Number.isInteger(value) ? value : null;
}

export function itemMovementName(item: ArchiveItem): string {
  return recordString(item.movement, 'name') || item.title || 'Movement';
}

export function itemDate(item: ArchiveItem): string | null {
  return item.occurred_on || item.occurred_at || null;
}

export function isPerformedSet(item: ArchiveItem): boolean {
  return item.archive_item_type === 'set' && item.unavailable?.state !== 'unavailable';
}

export function coreLiftKey(value?: string | null): LedgerCoreLiftKey | null {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('squat')) return 'squat';
  if (normalized.includes('bench')) return 'bench';
  if (normalized.includes('deadlift')) return 'deadlift';
  return null;
}

export function isCompetitionIdentity(key: string, name: string): boolean {
  const normalizedKey = key.toLowerCase();
  const normalizedName = name.trim().toLowerCase();
  return normalizedKey.startsWith('competition_')
    || ['squat', 'bench', 'bench press', 'deadlift', 'competition squat', 'competition bench press', 'competition deadlift'].includes(normalizedName);
}

function movementClassification(item: ArchiveItem): LedgerMovementEvidence['classification'] {
  const kind = recordString(item.movement, 'kind') || '';
  const key = recordString(item.movement, 'key') || '';
  const name = itemMovementName(item);
  const performedClass = recordString(item.performance, 'core_or_accessory');
  if (performedClass === 'accessory' || kind === 'accessory' || kind === 'custom') return 'accessory';
  if (kind === 'core' && !isCompetitionIdentity(key, name)) return 'variant';
  return 'core';
}

function bestSet(items: ArchiveItem[]): ArchiveItem {
  return [...items].sort((left, right) => {
    const leftWeight = recordNumber(left.performance, 'weight_kg') || 0;
    const rightWeight = recordNumber(right.performance, 'weight_kg') || 0;
    const leftReps = recordNumber(left.performance, 'reps') || 0;
    const rightReps = recordNumber(right.performance, 'reps') || 0;
    return (rightWeight * Math.max(1, rightReps)) - (leftWeight * Math.max(1, leftReps));
  })[0];
}

export function movementEvidence(snapshot: LedgerV2Snapshot): LedgerMovementEvidence[] {
  const grouped = new Map<number, ArchiveItem[]>();
  snapshot.evidence.filter(isPerformedSet).forEach((item) => {
    const id = itemMovementId(item);
    if (id === null) return;
    const rows = grouped.get(id) || [];
    rows.push(item);
    grouped.set(id, rows);
  });

  return [...grouped.entries()].map(([id, sets]) => {
    const latest = [...sets].sort((left, right) => String(itemDate(right) || '').localeCompare(String(itemDate(left) || '')))[0];
    const name = itemMovementName(latest);
    const key = recordString(latest.movement, 'key') || `movement-${id}`;
    return {
      id,
      key,
      name,
      family: recordString(latest.movement, 'family') || 'unclassified',
      kind: recordString(latest.movement, 'kind') || 'unknown',
      classification: movementClassification(latest),
      comparisonConfidence: recordString(latest.movement, 'comparison_confidence'),
      sets,
      latest,
      best: bestSet(sets),
      totalVolumeKg: sets.reduce((total, item) => total + ((recordNumber(item.performance, 'weight_kg') || 0) * (recordNumber(item.performance, 'reps') || 0)), 0),
      performedSets: sets.length,
    } satisfies LedgerMovementEvidence;
  }).sort((left, right) => String(itemDate(right.latest) || '').localeCompare(String(itemDate(left.latest) || '')));
}

export function blockChapters(snapshot: LedgerV2Snapshot): LedgerBlockChapter[] {
  const grouped = new Map<number, ArchiveItem[]>();
  snapshot.sessions.filter((item) => item.archive_item_type === 'session').forEach((item) => {
    const id = recordNumber(item.program_context, 'block_id');
    if (id === null) return;
    const rows = grouped.get(id) || [];
    rows.push(item);
    grouped.set(id, rows);
  });
  return [...grouped.entries()].map(([id, sessions]) => {
    const dates = sessions.map(itemDate).filter((value): value is string => Boolean(value)).sort();
    const context = sessions[0]?.program_context;
    return {
      id,
      name: recordString(context, 'block_name') || `Block ${id}`,
      programId: recordNumber(context, 'program_id'),
      programName: recordString(context, 'program_name'),
      sessions,
      firstDate: dates[0] || null,
      lastDate: dates.at(-1) || null,
    } satisfies LedgerBlockChapter;
  }).sort((left, right) => String(right.lastDate || '').localeCompare(String(left.lastDate || '')));
}
