import type { ArchiveItem, ArchiveItemType } from '@/lib/ledger-archive';
import type { AccomplishmentEvent } from '@/lib/ledger-data';
import type {
  JourneyEvidenceReference,
  JourneyMoment,
  JourneyMomentImportance,
  JourneyMomentType,
} from './model';

const ACHIEVEMENTS_HREF = '/(tabs)/ledger/achievements';
const STRENGTH_HREF = '/(tabs)/ledger/strength';
const CAREER_PR_TYPES = new Set([
  'CORE_WEIGHT_PR',
  'CORE_E1RM_PR',
  'CORE_REP_MAX_PR',
]);
const COMPLETED_WORKOUT_STATUSES = new Set(['completed', 'logged', 'done']);
const COMPLETED_MEET_STATUSES = new Set(['completed', 'archived']);
const IMPORTANCE_PRIORITY: Record<JourneyMomentImportance, number> = {
  landmark: 300,
  major: 200,
  supporting: 100,
};
const EVIDENCE_PRIORITY: Record<JourneyEvidenceReference['kind'], number> = {
  workout: 10,
  meet: 10,
  'historical-performance': 10,
  set: 20,
  video: 30,
  'coach-feedback': 40,
  strength: 50,
  achievement: 60,
};

function archiveDetailHref(itemType: ArchiveItemType, sourceId: number): string {
  return `/(tabs)/ledger/archive/${itemType}/${sourceId}`;
}

type JourneySourceBundle = Readonly<{
  archiveItems: readonly ArchiveItem[];
  accomplishments: readonly AccomplishmentEvent[];
  archiveHistoryComplete: boolean;
  accomplishmentHistoryComplete: boolean;
  now?: Date;
}>;

type MutableEpisode = {
  key: string;
  occurredAt: string;
  archiveItems: ArchiveItem[];
  accomplishments: AccomplishmentEvent[];
  qualifiesAsFirstWorkout: boolean;
  qualifiesAsFirstMeet: boolean;
  qualifiesAsImportedHistory: boolean;
};

function validDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function occurredAt(item: ArchiveItem): string | null {
  return item.occurred_at || item.occurred_on || null;
}

function dayKey(value?: string | null): string | null {
  const parsed = validDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function eventDate(value: string): { year: string; date: string } {
  const parsed = validDate(value);
  if (!parsed) return { year: 'UNDATED', date: 'DATE' };
  return {
    year: String(parsed.getFullYear()),
    date: parsed.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase(),
  };
}

function recordNumber(record: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function recordString(record: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function recordObject(record: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  const value = record?.[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isCurrentArchiveEvidence(item: ArchiveItem): boolean {
  if (item.unavailable || item.invalidation_state === 'invalid') return false;
  return !['deleted', 'invalidated', 'superseded'].includes((item.correction_state || '').toLowerCase());
}

function isCompletedSession(item: ArchiveItem): boolean {
  return item.archive_item_type === 'session'
    && COMPLETED_WORKOUT_STATUSES.has((item.status || '').toLowerCase());
}

function isCompletedMeet(item: ArchiveItem): boolean {
  return item.archive_item_type === 'meet'
    && COMPLETED_MEET_STATUSES.has((item.status || '').toLowerCase());
}

function isReviewedVideo(item: ArchiveItem): boolean {
  if (item.archive_item_type !== 'video') return false;
  return recordString(item.media, 'review_status') === 'reviewed'
    || item.media?.has_athlete_visible_feedback === true;
}

function isMeaningfulPr(event: AccomplishmentEvent): boolean {
  return CAREER_PR_TYPES.has(event.event_type)
    && typeof event.prior_value === 'number'
    && typeof event.current_value === 'number'
    && typeof event.delta === 'number'
    && event.delta > 0;
}

function eventEpisodeKey(event: AccomplishmentEvent): string | null {
  if (event.workout_id) return `workout:${event.workout_id}`;
  const day = dayKey(event.occurred_at || event.workout_date);
  return day ? `performance:${day}:${event.core_movement_key || event.movement_label || event.id}` : null;
}

function archiveEpisodeKey(item: ArchiveItem): string | null {
  if (item.archive_item_type === 'session') return `workout:${item.source_id}`;
  if (item.archive_item_type === 'video') {
    const workoutId = recordNumber(item.media, 'workout_id');
    return workoutId ? `workout:${workoutId}` : `video:${item.source_id}`;
  }
  if (item.archive_item_type === 'meet') return `meet:${item.source_id}`;
  if (item.archive_item_type === 'historical_performance') return `historical:${item.source_id}`;
  return null;
}

function evidenceReference(item: ArchiveItem): JourneyEvidenceReference {
  const labels: Partial<Record<ArchiveItemType, string>> = {
    session: 'Training Session',
    set: 'Set evidence',
    video: 'Lift video',
    meet: 'Meet result',
    historical_performance: 'Historical performance',
  };
  const kind = item.archive_item_type === 'session'
    ? 'workout'
    : item.archive_item_type === 'historical_performance'
      ? 'historical-performance'
      : item.archive_item_type as JourneyEvidenceReference['kind'];
  return {
    id: `archive:${item.archive_item_type}:${item.source_id}`,
    kind,
    label: labels[item.archive_item_type] || 'Source evidence',
    href: archiveDetailHref(item.archive_item_type, item.source_id),
  };
}

function setEvidenceReference(event: AccomplishmentEvent): JourneyEvidenceReference | null {
  if (!event.source_set_log_id) return null;
  return {
    id: `archive:set:${event.source_set_log_id}`,
    kind: 'set',
    label: 'Qualifying set',
    href: archiveDetailHref('set', event.source_set_log_id),
  };
}

function dedupeEvidence(items: readonly JourneyEvidenceReference[]): JourneyEvidenceReference[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
    .sort((left, right) => EVIDENCE_PRIORITY[left.kind] - EVIDENCE_PRIORITY[right.kind] || left.id.localeCompare(right.id));
}

function formatValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function performanceDetail(event: AccomplishmentEvent): string {
  if (event.event_type === 'CORE_REP_MAX_PR') {
    const reps = recordNumber(event.evidence, 'rep_count') ?? recordNumber(event.evidence, 'actual_reps');
    return `${formatValue(event.current_value)} ${event.unit || 'kg'} ${reps == null ? 'REP MAX' : `${formatValue(reps)} REP MAX`} · +${formatValue(event.delta)} ${event.unit || 'kg'}`;
  }
  const metric = event.event_type === 'CORE_E1RM_PR' ? 'estimated 1RM' : 'weight';
  return `${formatValue(event.current_value)} ${event.unit || 'kg'} ${metric} · +${formatValue(event.delta)} ${event.unit || 'kg'}`;
}

function prTitle(event: AccomplishmentEvent, biggest: boolean): string {
  const movement = event.movement_label || 'Movement';
  if (biggest) return `${movement} · biggest recorded PR jump`;
  if (event.event_type === 'CORE_E1RM_PR') return `${movement} e1RM PR`;
  if (event.event_type === 'CORE_REP_MAX_PR') {
    const reps = recordNumber(event.evidence, 'rep_count') ?? recordNumber(event.evidence, 'actual_reps');
    return `${movement} ${reps == null ? 'REP MAX PR' : `${formatValue(reps)} REP MAX PR`}`;
  }
  return `${movement} weight PR`;
}

function presentation(type: JourneyMomentType): { icon: string; tone: string; tag: string } {
  switch (type) {
    case 'competition':
    case 'first-meet': return { icon: 'trophy-outline', tone: '#E4A624', tag: 'MEET' };
    case 'imported-history': return { icon: 'time-outline', tone: '#7FA7D8', tag: 'HISTORICAL' };
    case 'first-workout': return { icon: 'barbell-outline', tone: '#A86BFF', tag: 'FIRST TRAINING SESSION' };
    case 'training-anniversary': return { icon: 'calendar-outline', tone: '#42D5C2', tag: 'ANNIVERSARY' };
    case 'biggest-pr-jump': return { icon: 'trending-up-outline', tone: '#E4A624', tag: 'CAREER PR' };
    default: return { icon: 'trophy-outline', tone: '#A86BFF', tag: 'CAREER PR' };
  }
}

function makeMoment(input: {
  id: string;
  type: JourneyMomentType;
  importance: JourneyMomentImportance;
  occurredAt: string;
  title: string;
  detail: string;
  expandedDetail: string;
  evidence: JourneyEvidenceReference[];
}): JourneyMoment {
  const date = eventDate(input.occurredAt);
  const visual = presentation(input.type);
  const evidence = dedupeEvidence(input.evidence);
  return {
    id: input.id,
    type: input.type,
    importance: input.importance,
    presentationPriority: IMPORTANCE_PRIORITY[input.importance],
    year: date.year,
    date: date.date,
    occurredAt: input.occurredAt,
    title: input.title,
    detail: input.detail,
    expandedDetail: input.expandedDetail,
    icon: visual.icon,
    tone: visual.tone,
    tags: [
      { label: visual.tag, tone: visual.tone },
      ...(evidence.length > 1 ? [{ label: `${evidence.length} SOURCES`, tone: '#8D98A9' }] : []),
    ],
    evidence,
    href: evidence[0]?.href,
  };
}

function ensureEpisode(episodes: Map<string, MutableEpisode>, key: string, date: string): MutableEpisode {
  const existing = episodes.get(key);
  if (existing) {
    // Supporting evidence can be uploaded or reviewed after the performance.
    // A Journey moment remains anchored to the earliest source occurrence.
    if (Date.parse(date) < Date.parse(existing.occurredAt)) existing.occurredAt = date;
    return existing;
  }
  const created: MutableEpisode = {
    key,
    occurredAt: date,
    archiveItems: [],
    accomplishments: [],
    qualifiesAsFirstWorkout: false,
    qualifiesAsFirstMeet: false,
    qualifiesAsImportedHistory: false,
  };
  episodes.set(key, created);
  return created;
}

export function buildJourneyMoments({
  archiveItems,
  accomplishments,
  archiveHistoryComplete,
  accomplishmentHistoryComplete,
  now = new Date(),
}: JourneySourceBundle): JourneyMoment[] {
  const validArchive = archiveItems.filter(isCurrentArchiveEvidence);
  const sessions = validArchive.filter(isCompletedSession)
    .sort((left, right) => Date.parse(occurredAt(left) || '') - Date.parse(occurredAt(right) || ''));
  const meets = validArchive.filter(isCompletedMeet)
    .sort((left, right) => Date.parse(occurredAt(left) || '') - Date.parse(occurredAt(right) || ''));
  const historical = validArchive.filter((item) => item.archive_item_type === 'historical_performance')
    .sort((left, right) => Date.parse(occurredAt(left) || '') - Date.parse(occurredAt(right) || ''));
  const meaningfulPrs = accomplishments.filter(isMeaningfulPr);
  const episodes = new Map<string, MutableEpisode>();

  for (const item of validArchive) {
    const key = archiveEpisodeKey(item);
    const date = occurredAt(item);
    if (!key || !date || (!isCompletedSession(item) && !isCompletedMeet(item) && item.archive_item_type !== 'historical_performance' && item.archive_item_type !== 'video')) continue;
    ensureEpisode(episodes, key, date).archiveItems.push(item);
  }
  for (const event of meaningfulPrs) {
    const key = eventEpisodeKey(event);
    const date = event.occurred_at || event.workout_date;
    if (!key || !date) continue;
    ensureEpisode(episodes, key, date).accomplishments.push(event);
  }

  if (archiveHistoryComplete && sessions[0]) {
    const key = archiveEpisodeKey(sessions[0]);
    if (key) ensureEpisode(episodes, key, occurredAt(sessions[0]) as string).qualifiesAsFirstWorkout = true;
  }
  if (archiveHistoryComplete && meets[0]) {
    const key = archiveEpisodeKey(meets[0]);
    if (key) ensureEpisode(episodes, key, occurredAt(meets[0]) as string).qualifiesAsFirstMeet = true;
  }
  if (archiveHistoryComplete && historical[0]) {
    const key = archiveEpisodeKey(historical[0]);
    if (key) ensureEpisode(episodes, key, occurredAt(historical[0]) as string).qualifiesAsImportedHistory = true;
  }

  const biggestPr = accomplishmentHistoryComplete
    ? [...meaningfulPrs]
      .filter((event) => event.event_type === 'CORE_WEIGHT_PR')
      .sort((left, right) => (right.delta || 0) - (left.delta || 0) || left.id - right.id)[0]
    : undefined;
  const moments: JourneyMoment[] = [];

  for (const episode of episodes.values()) {
    const archiveEvidence = episode.archiveItems.map(evidenceReference);
    const reviewedVideoEvidence = episode.archiveItems
      .filter(isReviewedVideo)
      .map((item) => ({
        ...evidenceReference(item),
        id: `coach-review:${item.source_id}`,
        kind: 'coach-feedback' as const,
        label: 'Coach review',
      }));
    const rankedPrs = [...episode.accomplishments].sort((left, right) =>
      (left.priority ?? 999) - (right.priority ?? 999)
      || (right.delta ?? 0) - (left.delta ?? 0)
      || left.id - right.id);
    const primaryPr = rankedPrs[0];
    const setEvidence = rankedPrs.map(setEvidenceReference).filter((item): item is JourneyEvidenceReference => Boolean(item));
    const roomEvidence: JourneyEvidenceReference[] = primaryPr ? [
      { id: `strength:${primaryPr.id}`, kind: 'strength', label: 'Strength progression', href: STRENGTH_HREF },
      { id: `achievement:${primaryPr.id}`, kind: 'achievement', label: 'Achievement', href: ACHIEVEMENTS_HREF },
    ] : [];
    const evidence = dedupeEvidence([...archiveEvidence, ...setEvidence, ...reviewedVideoEvidence, ...roomEvidence]);

    if (episode.qualifiesAsFirstMeet || episode.archiveItems.some(isCompletedMeet)) {
      const meet = episode.archiveItems.find(isCompletedMeet);
      if (!meet) continue;
      const total = recordNumber(recordObject(meet.meet_context, 'result_summary'), 'total_kg');
      const federation = recordString(meet.meet_context, 'federation');
      const first = episode.qualifiesAsFirstMeet;
      moments.push(makeMoment({
        id: `journey:${episode.key}`,
        type: first ? 'first-meet' : 'competition',
        importance: first ? 'landmark' : 'major',
        occurredAt: episode.occurredAt,
        title: first ? `First meet · ${meet.title}` : meet.title,
        detail: [federation, total == null ? null : `${formatValue(total)} kg total`].filter(Boolean).join(' · ') || 'Completed competition preserved in Archive.',
        expandedDetail: 'A completed competition backed by its canonical meet result.',
        evidence,
      }));
      continue;
    }

    if (primaryPr) {
      const isBiggest = biggestPr?.id === primaryPr.id;
      const sourceCount = rankedPrs.length;
      moments.push(makeMoment({
        id: `journey:${episode.key}`,
        type: isBiggest ? 'biggest-pr-jump' : 'major-pr',
        importance: isBiggest ? 'landmark' : 'major',
        occurredAt: episode.occurredAt,
        title: sourceCount > 1 ? `${primaryPr.workout_title || 'Training'} · ${sourceCount} career bests` : prTitle(primaryPr, isBiggest),
        detail: performanceDetail(primaryPr),
        expandedDetail: `${sourceCount} qualifying career accomplishment${sourceCount === 1 ? '' : 's'} grouped with ${evidence.length} canonical evidence source${evidence.length === 1 ? '' : 's'}.`,
        evidence,
      }));
      continue;
    }

    if (episode.qualifiesAsFirstWorkout) {
      const workout = episode.archiveItems.find(isCompletedSession);
      if (!workout) continue;
      moments.push(makeMoment({
        id: `journey:${episode.key}`,
        type: 'first-workout',
        importance: 'landmark',
        occurredAt: episode.occurredAt,
        title: 'First recorded Training Session',
        detail: workout.title,
        expandedDetail: 'The earliest completed Training Session preserved in this Ledger.',
        evidence,
      }));
      continue;
    }

    if (episode.qualifiesAsImportedHistory) {
      const entry = episode.archiveItems.find((item) => item.archive_item_type === 'historical_performance');
      if (!entry) continue;
      moments.push(makeMoment({
        id: `journey:${episode.key}`,
        type: 'imported-history',
        importance: 'supporting',
        occurredAt: episode.occurredAt,
        title: `Earliest preserved history · ${entry.title}`,
        detail: entry.subtitle || entry.provenance_label || 'Historical performance preserved before the Ledger timeline.',
        expandedDetail: 'The earliest canonical historical performance currently preserved in Archive.',
        evidence,
      }));
    }
  }

  const firstWorkoutDate = archiveHistoryComplete && sessions[0]
    ? validDate(occurredAt(sessions[0]))
    : null;
  if (firstWorkoutDate
    && firstWorkoutDate.getMonth() === now.getMonth()
    && firstWorkoutDate.getDate() === now.getDate()) {
    const years = now.getFullYear() - firstWorkoutDate.getFullYear();
    if (years > 0) {
      moments.push(makeMoment({
        id: `journey:training-anniversary:${now.getFullYear()}`,
        type: 'training-anniversary',
        importance: years % 5 === 0 ? 'major' : 'supporting',
        occurredAt: now.toISOString(),
        title: `${years} year${years === 1 ? '' : 's'} in the Ledger`,
        detail: `Since the first recorded Training Session on ${firstWorkoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
        expandedDetail: 'A deterministic anniversary of the earliest completed Training Session preserved in Archive.',
        evidence: [evidenceReference(sessions[0] as ArchiveItem)],
      }));
    }
  }

  return moments.sort((left, right) =>
    Date.parse(right.occurredAt || '') - Date.parse(left.occurredAt || '')
    || right.presentationPriority - left.presentationPriority
    || left.id.localeCompare(right.id));
}
