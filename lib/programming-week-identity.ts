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

/**
 * Returns the canonical 1-based Week identities owned by a Training Block.
 * New backends provide the exact sequence. The date fallback keeps an OTA
 * compatible with an older server while still anchoring exclusively to the
 * server-owned Block start/end dates (never Program/global/array position).
 */
export function canonicalBlockRelativeWeeks(
  block: ProgrammingWeekIdentityBlock,
): CanonicalProgrammingWeekIdentity[] {
  const blockName = String(block.name || 'Training Block');
  const blockOrder = finitePositiveInteger(block.order_idx) || 0;
  const authoritative = (block.weeks || [])
    .map((week): CanonicalProgrammingWeekIdentity | null => {
      const blockId = finitePositiveInteger(week.block_id);
      const blockWeekIndex = finitePositiveInteger(week.block_week_index);
      const weekStart = isoCalendarDate(week.week_start);
      const weekEnd = isoCalendarDate(week.week_end);
      if (blockId !== block.id || !blockWeekIndex || !weekStart || !weekEnd || weekEnd < weekStart) {
        return null;
      }
      return {
        blockId,
        blockName,
        blockOrder,
        blockWeekIndex,
        label: String(week.label || `Week ${blockWeekIndex}`),
        weekStart,
        weekEnd,
        source: 'server' as const,
      };
    })
    .filter((week): week is CanonicalProgrammingWeekIdentity => week !== null)
    .sort((left, right) => left.blockWeekIndex - right.blockWeekIndex);

  if (authoritative.length && authoritative.every((week, offset) => week.blockWeekIndex === offset + 1)) {
    return authoritative;
  }

  const blockStart = isoCalendarDate(block.start_date);
  const blockEnd = isoCalendarDate(block.end_date);
  if (!blockStart || !blockEnd || blockEnd < blockStart) return [];
  const totalWeeks = finitePositiveInteger(block.total_weeks)
    || Math.max(1, Math.ceil((calendarDayNumber(blockEnd) - calendarDayNumber(blockStart) + 1) / 7));

  return Array.from({ length: totalWeeks }, (_, offset) => {
    const blockWeekIndex = offset + 1;
    const weekStart = addCalendarDays(blockStart, offset * 7);
    const naturalEnd = addCalendarDays(weekStart, 6);
    const weekEnd = naturalEnd > blockEnd ? blockEnd : naturalEnd;
    return {
      blockId: block.id,
      blockName,
      blockOrder,
      blockWeekIndex,
      label: `Week ${blockWeekIndex}`,
      weekStart,
      weekEnd,
      source: 'legacy-block-dates' as const,
    };
  });
}

export function canonicalProgramWeekDestinations(
  blocks: ProgrammingWeekIdentityBlock[],
): CanonicalProgrammingWeekIdentity[] {
  return [...blocks]
    .sort((left, right) => Number(left.order_idx || 0) - Number(right.order_idx || 0))
    .flatMap(canonicalBlockRelativeWeeks);
}

export function canonicalProgrammingWeekKey(
  week: Pick<CanonicalProgrammingWeekIdentity, 'blockId' | 'blockWeekIndex' | 'weekStart'>,
) {
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
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;
  return raw;
}

function calendarDayNumber(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function addCalendarDays(value: string, days: number) {
  const next = new Date((calendarDayNumber(value) + days) * 86_400_000);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}
