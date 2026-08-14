import { fetchJson } from '@/lib/api';

export type JourneyEventType =
  | 'FIRST_WORKOUT'
  | 'SESSION_COMPLETED'
  | 'SESSION_SUMMARY'
  | 'PERFORMANCE'
  | 'PROGRAM_STARTED'
  | 'PROGRAM_COMPLETED'
  | 'BLOCK_STARTED'
  | 'WEIGHT_PR'
  | 'REP_PR'
  | 'E1RM_PR'
  | 'COMPETITION'
  | 'ACHIEVEMENT_EARNED'
  | 'VOLUME_MILESTONE'
  | 'IMPORTED_HISTORY'
  | 'SIGNIFICANT_VIDEO'
  | 'MOVEMENT_ADDED'
  | 'VARIANT_INTRODUCED';

export type JourneyEntry = Readonly<{
  id: string;
  event_type: JourneyEventType;
  importance: 'landmark' | 'major' | 'supporting';
  occurred_on: string;
  occurred_at?: string | null;
  title: string;
  detail: string;
  source_kind: 'persisted' | 'reconstructed';
  source: {
    type: string;
    id: number;
    workout_id?: number | null;
    workout_item_id?: number | null;
    set_log_id?: number | null;
    href?: string | null;
  };
  movement?: {
    key?: string | null;
    label?: string | null;
    family?: string | null;
    kind?: string | null;
    identity_source?: string | null;
  } | null;
  performance?: {
    weight_kg?: number | null;
    reps?: number | null;
    rpe?: number | null;
    rir?: number | null;
    e1rm_kg?: number | null;
    current_value?: number | null;
    prior_value?: number | null;
    delta?: number | null;
    prior_value_kg?: number | null;
    delta_kg?: number | null;
    unit?: string | null;
    metric?: string | null;
    comparison_bucket?: string | null;
  } | null;
  training_block_id?: number | null;
  training_program_id?: number | null;
  evidence?: Record<string, unknown>;
  projection_version: string;
}>;

export type JourneyOverview = Readonly<{
  ok: true;
  projection_version: string;
  athlete: { id: number; name: string; preferred_units: 'kg' | 'lbs' | 'lb' | string; timezone?: string | null };
  earliest_record?: { date: string; event_type: JourneyEventType; source: JourneyEntry['source'] } | null;
  lifetime: {
    sessions_completed: number;
    total_sets: number;
    pr_count: number;
    program_count: number;
    block_count: number;
    major_achievement_count: number;
  };
  current_block?: { id: number; name: string; start_date?: string | null; end_date?: string | null; training_program_id?: number | null } | null;
  bodyweight_context: {
    point_count: number;
    latest?: ReportedBodyweightObservation | null;
    comparison?: { start: ReportedBodyweightObservation; end: ReportedBodyweightObservation; delta_kg: number; span_days: number; policy: string } | null;
    recent_observations: ReportedBodyweightObservation[];
    interpolated: false;
  };
  event_consolidation?: { raw_event_count: number; contextual_performance_count: number };
  recent_major: JourneyEntry[];
}>;

export type JourneyBlock = Readonly<{
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  state: 'upcoming' | 'current' | 'historical_range';
  session_count: number;
  pr_count: number;
  program?: { id: number; name: string; status: string } | null;
  reported_bodyweight?: {
    start?: ReportedBodyweightObservation | null;
    end_or_latest?: ReportedBodyweightObservation | null;
    change_kg?: number | null;
    boundary_window_days: number;
    interpolated: false;
  } | null;
}>;

export type ReportedBodyweightObservation = Readonly<{
  id: number;
  reported_bodyweight_kg: number;
  weight_kg?: number;
  reported_at?: string | null;
  training_date?: string | null;
  date?: string | null;
  workout_id?: number | null;
  session?: { id: number; label: string; date?: string | null } | null;
  source: 'PRE_SESSION_READINESS' | string;
}>;

export type ReportedBodyweightPage = Readonly<{
  ok: true;
  items: ReportedBodyweightObservation[];
  has_more: boolean;
  next_cursor?: string | null;
  interpolated: false;
}>;

export type JourneyTimelinePage = Readonly<{
  ok: true;
  projection_version: string;
  items: JourneyEntry[];
  next_cursor?: string | null;
  has_more: boolean;
  ordering: string;
}>;

export type JourneyBootstrap = JourneyOverview & Readonly<{
  blocks: { ok: true; items: JourneyBlock[]; ordering: string; projection_version: string };
  timeline: JourneyTimelinePage;
}>;

export class JourneyRequestError extends Error {
  readonly status: number;

  constructor(status: number, detail?: string) {
    super(detail || `Journey request failed (${status}).`);
    this.name = 'JourneyRequestError';
    this.status = status;
  }
}

async function requirePayload<T extends { ok: boolean; error?: string }>(path: string): Promise<T> {
  const response = await fetchJson<T>(path, { method: 'GET', auth: true });
  if (!response.ok || !response.json?.ok) {
    throw new JourneyRequestError(response.status, response.json?.error);
  }
  return response.json;
}

export function fetchJourneyOverview(): Promise<JourneyOverview> {
  return requirePayload<JourneyOverview>('/mobile/ledger/journey');
}

export function fetchJourneyBootstrap(options: { limit?: number; includeSessions?: boolean } = {}): Promise<JourneyBootstrap> {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(options.limit ?? 24, 50))),
    include_sessions: options.includeSessions ? 'true' : 'false',
  });
  return requirePayload<JourneyBootstrap>(`/mobile/ledger/journey?${params.toString()}`);
}

export async function fetchJourneyBlocks(): Promise<JourneyBlock[]> {
  const payload = await requirePayload<{ ok: true; items: JourneyBlock[] }>('/mobile/ledger/journey/blocks');
  return payload.items;
}

export function fetchReportedBodyweightHistory(options: { cursor?: string | null; limit?: number } = {}): Promise<ReportedBodyweightPage> {
  const params = new URLSearchParams({ limit: String(Math.max(1, Math.min(options.limit ?? 24, 50))) });
  if (options.cursor) params.set('cursor', options.cursor);
  return requirePayload<ReportedBodyweightPage>(`/mobile/ledger/journey/reported-bodyweight?${params.toString()}`);
}

export function fetchJourneyTimelinePage(options: {
  limit?: number;
  cursor?: string | null;
  includeSessions?: boolean;
  eventTypes?: JourneyEventType[];
  startDate?: string;
  endDate?: string;
  blockId?: number;
} = {}): Promise<JourneyTimelinePage> {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(options.limit ?? 24, 50))),
    include_sessions: options.includeSessions ? 'true' : 'false',
  });
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.eventTypes?.length) params.set('event_types', options.eventTypes.join(','));
  if (options.startDate) params.set('start_date', options.startDate);
  if (options.endDate) params.set('end_date', options.endDate);
  if (options.blockId) params.set('block_id', String(options.blockId));
  return requirePayload<JourneyTimelinePage>(`/mobile/ledger/journey/timeline?${params.toString()}`);
}
