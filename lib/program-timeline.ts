export type ProgramTimelineLifecycle =
  | 'completed'
  | 'in_progress'
  | 'today'
  | 'upcoming'
  | 'missed'
  | 'no_session';

export type ProgramTimelineSession = {
  id: number;
  title: string;
  date: string;
  lifecycle: Exclude<ProgramTimelineLifecycle, 'no_session'>;
  movementCount: number | null;
  setCount: number | null;
  plannedSetCount: number | null;
  sessionRpe: number | null;
  estimatedDurationMinutes: number | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

export type ProgramTimelineDay = {
  date: string;
  weekday: string;
  dayNumber: string;
  isToday: boolean;
  sessions: ProgramTimelineSession[];
};

export type ProgramTimelineWeek = {
  key: string;
  number: number;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
  current: boolean;
  lifecycle: ProgramTimelineLifecycle;
  sessionCount: number;
  completedCount: number;
  missedCount: number;
  plannedSetCount: number;
  programmingState: 'programmed' | 'unbuilt';
  days: ProgramTimelineDay[];
};

export type ProgramTimelineBlock = {
  id: number;
  name: string;
  status: 'completed' | 'current' | 'upcoming';
  totalWeeks: number;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
  weeks: ProgramTimelineWeek[];
};

export type ProgramTimelinePayload = {
  today: string;
  program: {
    id: number;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string;
    dateRangeLabel: string;
    blockCount: number;
    totalWeeks: number;
    totalSessions: number;
    currentBlockId: number | null;
    currentWeekKey: string | null;
    positionPercent: number;
  };
  blocks: ProgramTimelineBlock[];
};

type RawSession = Record<string, any>;
type RawBlock = Record<string, any>;

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateFromKey(value?: string | null) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function formatDate(value?: string | null) {
  const date = dateFromKey(value);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}

function formatRange(start?: string | null, end?: string | null) {
  if (!start && !end) return '';
  return [formatDate(start), formatDate(end)].filter(Boolean).join(' – ');
}

function inclusiveWeekCount(start?: string | null, end?: string | null) {
  const first = dateFromKey(start);
  const last = dateFromKey(end);
  if (!first || !last || last < first) return 0;
  return Math.max(1, Math.ceil((last.getTime() - first.getTime() + DAY_MS) / (7 * DAY_MS)));
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sessionTitle(session: RawSession) {
  return String(session.label || session.title || session.name || 'Session').trim() || 'Session';
}

function sessionLifecycle(session: RawSession, date: string, today: string): ProgramTimelineSession['lifecycle'] {
  const status = String(session.status || session.kind || session.lifecycle_status || '').toLowerCase();
  if (['completed', 'complete', 'logged', 'done'].some((value) => status.includes(value))) return 'completed';
  if (['in_progress', 'started', 'active'].some((value) => status.includes(value))) return 'in_progress';
  if (['missed', 'past_due', 'incomplete'].some((value) => status.includes(value))) return 'missed';
  if (date === today) return 'today';
  return date < today ? 'missed' : 'upcoming';
}

function primaryMuscles(session: RawSession) {
  const muscleFocus = session.preview?.muscle_focus?.primary;
  if (Array.isArray(muscleFocus)) {
    return muscleFocus
      .map((row: any) => typeof row === 'string' ? row : row?.muscle_id)
      .filter((value: unknown): value is string => Boolean(value) && value !== 'full_body');
  }
  const focus = session.focus?.primary;
  if (Array.isArray(focus)) return focus.map(String).filter((value) => value && value !== 'full_body');
  const previewFocus = session.preview?.focus_muscles;
  return Array.isArray(previewFocus)
    ? previewFocus.map(String).filter((value) => value && value !== 'full_body')
    : [];
}

function secondaryMuscles(session: RawSession) {
  const muscleFocus = session.preview?.muscle_focus?.secondary;
  return Array.isArray(muscleFocus)
    ? muscleFocus
      .map((row: any) => typeof row === 'string' ? row : row?.muscle_id)
      .filter((value: unknown): value is string => Boolean(value) && value !== 'full_body')
    : [];
}

function plannedSetCount(session: RawSession) {
  const explicit = asNumber(session.recap?.planned_set_count ?? session.preview?.set_count);
  if (explicit != null) return explicit;
  const rows = Array.isArray(session.preview?.movements)
    ? session.preview.movements
    : Array.isArray(session.preview?.core)
      ? session.preview.core
      : [];
  if (!rows.length) return null;
  return rows.reduce((sum: number, row: any) => sum + Math.max(0, Number(row?.sets || 0)), 0);
}

function mapSession(session: RawSession, date: string, today: string): ProgramTimelineSession | null {
  const id = asNumber(session.id);
  if (!id) return null;
  return {
    id,
    title: sessionTitle(session),
    date,
    lifecycle: sessionLifecycle(session, date, today),
    movementCount: asNumber(session.preview?.movement_count ?? session.recap?.movement_count),
    setCount: asNumber(session.recap?.logged_set_count ?? session.recap?.planned_set_count ?? session.preview?.set_count),
    plannedSetCount: plannedSetCount(session),
    sessionRpe: asNumber(session.recap?.session_rpe ?? session.recap?.average_rpe),
    estimatedDurationMinutes: asNumber(session.estimated_duration_minutes ?? session.preview?.estimated_duration_minutes),
    primaryMuscles: primaryMuscles(session),
    secondaryMuscles: secondaryMuscles(session),
  };
}

function uniqueSessions(rows: RawSession[]) {
  const seen = new Set<number>();
  return rows.filter((row) => {
    const id = asNumber(row?.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function blockSessions(blockId: number, pendingMap: Record<string, RawSession[]>, completedMap: Record<string, RawSession[]>) {
  return uniqueSessions([
    ...(Array.isArray(pendingMap[String(blockId)]) ? pendingMap[String(blockId)] : []),
    ...(Array.isArray(completedMap[String(blockId)]) ? completedMap[String(blockId)] : []),
  ]);
}

function weekLifecycle(week: Omit<ProgramTimelineWeek, 'lifecycle'>, today: string): ProgramTimelineLifecycle {
  if (week.current) return 'today';
  if (week.sessionCount === 0) return 'no_session';
  if (week.completedCount === week.sessionCount) return 'completed';
  if (week.endDate < today && week.missedCount > 0) return 'missed';
  return week.startDate > today ? 'upcoming' : 'in_progress';
}

function blockStatus(index: number, currentIndex: number): ProgramTimelineBlock['status'] {
  if (index === currentIndex) return 'current';
  return index < currentIndex ? 'completed' : 'upcoming';
}

export function buildProgramTimelinePayload(raw: any): ProgramTimelinePayload | null {
  const activeProgram = raw?.training_hub?.active_program || raw?.hub?.active_program || raw?.active_program;
  if (!activeProgram?.id) return null;

  const today = String(raw?.training_hub?.today || raw?.hub?.today || raw?.today || new Date().toISOString().slice(0, 10));
  const pendingMap = raw?.pending_map || {};
  const completedMap = raw?.completed_map || {};
  const currentBlockId = asNumber(raw?.training_hub?.current_block?.id ?? raw?.hub?.current_block?.id);
  const rawBlocks: RawBlock[] = (Array.isArray(raw?.blocks) ? raw.blocks : [])
    .filter((block: RawBlock) => Number(block.training_program_id) === Number(activeProgram.id))
    .sort((left: RawBlock, right: RawBlock) => Number(left.order_idx || 0) - Number(right.order_idx || 0));
  if (!rawBlocks.length) return null;

  let currentIndex = rawBlocks.findIndex((block) => Number(block.id) === currentBlockId);
  if (currentIndex < 0) {
    currentIndex = rawBlocks.findIndex((block) => String(block.start_date || '') <= today && today <= String(block.end_date || ''));
  }
  if (currentIndex < 0) currentIndex = today < String(rawBlocks[0]?.start_date || today) ? 0 : rawBlocks.length - 1;

  const mappedBlocks: ProgramTimelineBlock[] = rawBlocks.map((block, blockIndex) => {
    const id = Number(block.id);
    const start = dateFromKey(block.start_date);
    const totalWeeks = Math.max(1, Number(block.total_weeks || inclusiveWeekCount(block.start_date, block.end_date) || 1));
    const sessions = blockSessions(id, pendingMap, completedMap);
    const byDate = new Map<string, RawSession[]>();
    sessions.forEach((session) => {
      const key = String(session.date || '').slice(0, 10);
      if (!key) return;
      byDate.set(key, [...(byDate.get(key) || []), session]);
    });
    const currentWeek = Number(block.current_week || raw?.training_hub?.current_block?.current_week || 0);
    const weeks: ProgramTimelineWeek[] = Array.from({ length: totalWeeks }, (_, offset) => {
      const weekStart = start ? addDays(start, offset * 7) : dateFromKey(block.start_date) || new Date(0);
      const naturalEnd = addDays(weekStart, 6);
      const blockEnd = dateFromKey(block.end_date);
      const weekEnd = blockEnd && blockEnd < naturalEnd ? blockEnd : naturalEnd;
      const startDate = dateKey(weekStart);
      const endDate = dateKey(weekEnd);
      const days: ProgramTimelineDay[] = Array.from({ length: 7 }, (_, dayOffset) => {
        const day = addDays(weekStart, dayOffset);
        const key = dateKey(day);
        return {
          date: key,
          weekday: WEEKDAYS[day.getUTCDay()],
          dayNumber: String(day.getUTCDate()),
          isToday: key === today,
          sessions: (byDate.get(key) || [])
            .map((session) => mapSession(session, key, today))
            .filter((session): session is ProgramTimelineSession => Boolean(session)),
        };
      });
      const weekSessions = days.flatMap((day) => day.sessions);
      const baseWeek = {
        key: `${id}-${offset + 1}`,
        number: offset + 1,
        startDate,
        endDate,
        dateRangeLabel: formatRange(startDate, endDate),
        current: blockIndex === currentIndex && (currentWeek ? currentWeek === offset + 1 : startDate <= today && today <= endDate),
        sessionCount: weekSessions.length,
        completedCount: weekSessions.filter((session) => session.lifecycle === 'completed').length,
        missedCount: weekSessions.filter((session) => session.lifecycle === 'missed').length,
        plannedSetCount: weekSessions.reduce((sum, session) => sum + Number(session.plannedSetCount || 0), 0),
        programmingState: weekSessions.length ? 'programmed' as const : 'unbuilt' as const,
        days,
      };
      return { ...baseWeek, lifecycle: weekLifecycle(baseWeek, today) };
    });
    return {
      id,
      name: String(block.name || `Block ${blockIndex + 1}`),
      status: blockStatus(blockIndex, currentIndex),
      totalWeeks,
      startDate: String(block.start_date || weeks[0]?.startDate || ''),
      endDate: String(block.end_date || weeks.at(-1)?.endDate || ''),
      dateRangeLabel: String(block.date_range_label || formatRange(block.start_date, block.end_date)),
      weeks,
    };
  });

  const totalWeeks = mappedBlocks.reduce((sum, block) => sum + block.totalWeeks, 0);
  const currentBlock = mappedBlocks[currentIndex] || null;
  const currentWeek = currentBlock?.weeks.find((week) => week.current) || currentBlock?.weeks[0] || null;
  const weeksBefore = mappedBlocks.slice(0, currentIndex).reduce((sum, block) => sum + block.totalWeeks, 0);
  const currentOffset = currentWeek ? currentWeek.number - 0.5 : 0;
  const positionPercent = totalWeeks ? Math.max(0, Math.min(1, (weeksBefore + currentOffset) / totalWeeks)) : 0;
  const totalSessions = new Set(mappedBlocks.flatMap((block) => block.weeks.flatMap((week) => week.days.flatMap((day) => day.sessions.map((session) => session.id))))).size;

  return {
    today,
    program: {
      id: Number(activeProgram.id),
      name: String(activeProgram.name || 'Current program'),
      description: activeProgram.description ? String(activeProgram.description) : null,
      startDate: String(activeProgram.start_date || mappedBlocks[0]?.startDate || ''),
      endDate: String(activeProgram.end_date || mappedBlocks.at(-1)?.endDate || ''),
      dateRangeLabel: formatRange(activeProgram.start_date || mappedBlocks[0]?.startDate, activeProgram.end_date || mappedBlocks.at(-1)?.endDate),
      blockCount: mappedBlocks.length,
      totalWeeks,
      totalSessions,
      currentBlockId: currentBlock?.id || null,
      currentWeekKey: currentWeek?.key || null,
      positionPercent,
    },
    blocks: mappedBlocks,
  };
}
