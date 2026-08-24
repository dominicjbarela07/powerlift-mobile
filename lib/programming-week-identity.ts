export type ServerProgrammingBlockWeek = {
  block_id?: number | null;
  block_week_index?: number | null;
  label?: string | null;
  week_start?: string | null;
  week_end?: string | null;
};

export type ProgrammingWeekIdentityBlock = {
  id: number;
  name?: string | null;
  order_idx?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  total_weeks?: number | null;
  weeks?: ServerProgrammingBlockWeek[] | null;
};

export type CanonicalProgrammingWeekIdentity = {
  blockId: number;
  blockName: string;
  blockOrder: number;
  blockWeekIndex: number;
  label: string;
  weekStart: string;
  weekEnd: string;
  source: 'server' | 'legacy-block-dates';
};

export function canonicalBlockRelativeWeeks(block: ProgrammingWeekIdentityBlock): CanonicalProgrammingWeekIdentity[] {
  const blockName = String(block.name || 'Training Block');
  const blockOrder = finitePositiveInteger(block.order_idx) || 0;
  const authoritative = (block.weeks || []).map((week): CanonicalProgrammingWeekIdentity | null => {
    const blockId = finitePositiveInteger(week.block_id);
    const blockWeekIndex = finitePositiveInteger(week.block_week_index);
    const weekStart = isoCalendarDate(week.week_start);
    const weekEnd = isoCalendarDate(week.week_end);
    if (blockId !== block.id || !blockWeekIndex || !weekStart || !weekEnd || weekEnd < weekStart) return null;
    return { blockId, blockName, blockOrder, blockWeekIndex, label: String(week.label || `Week ${blockWeekIndex}`), weekStart, weekEnd, source: 'server' as const };
  }).filter((week): week is CanonicalProgrammingWeekIdentity => week !== null)
    .sort((left, right) => left.blockWeekIndex - right.blockWeekIndex);
  if (authoritative.length && authoritative.every((week, offset) => week.blockWeekIndex === offset + 1)) return authoritative;

  const blockStart = isoCalendarDate(block.start_date);
  const blockEnd = isoCalendarDate(block.end_date);
  if (!blockStart || !blockEnd || blockEnd < blockStart) return [];
  const totalWeeks = finitePositiveInteger(block.total_weeks)
    || Math.max(1, Math.ceil((calendarDayNumber(blockEnd) - calendarDayNumber(blockStart) + 1) / 7));
  return Array.from({ length: totalWeeks }, (_, offset) => {
    const blockWeekIndex = offset + 1;
    const weekStart = addCalendarDays(blockStart, offset * 7);
    const naturalEnd = addCalendarDays(weekStart, 6);
    return { blockId: block.id, blockName, blockOrder, blockWeekIndex, label: `Week ${blockWeekIndex}`, weekStart, weekEnd: naturalEnd > blockEnd ? blockEnd : naturalEnd, source: 'legacy-block-dates' as const };
  });
}

export function canonicalProgramWeekDestinations(blocks: ProgrammingWeekIdentityBlock[]) {
  return [...blocks].sort((a, b) => Number(a.order_idx || 0) - Number(b.order_idx || 0)).flatMap(canonicalBlockRelativeWeeks);
}

export function canonicalProgrammingWeekKey(week: Pick<CanonicalProgrammingWeekIdentity, 'blockId' | 'blockWeekIndex' | 'weekStart'>) {
  return `${week.blockId}:${week.blockWeekIndex}:${week.weekStart}`;
}

function finitePositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isoCalendarDate(value: unknown) {
  const raw = String(value || '');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? raw : null;
}

function calendarDayNumber(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function addCalendarDays(value: string, days: number) {
  const next = new Date((calendarDayNumber(value) + days) * 86_400_000);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}
