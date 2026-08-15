export type AthleteCalendarDropCell = {
  date: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function canSelfCoachRescheduleSessions(input: {
  canEditProgramming?: boolean | null;
  isSelfCoached?: boolean | null;
}) {
  return input.canEditProgramming === true && input.isSelfCoached === true;
}

export function isAthleteCalendarSessionMovable(session: { status?: string | null }) {
  const status = String(session.status || '').trim().toLowerCase();
  return !['completed', 'logged', 'done'].includes(status);
}

export function isAthleteCalendarDropTargetValid(input: {
  session: { date?: string | null; status?: string | null };
  destinationDate: string;
  today: string;
}) {
  const { destinationDate, session, today } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(destinationDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  if (!isAthleteCalendarSessionMovable(session)) return false;
  if (destinationDate < today) return false;
  return !!session.date && destinationDate !== session.date;
}

export function athleteCalendarDateAtPoint(
  absoluteX: number,
  absoluteY: number,
  cells: Iterable<AthleteCalendarDropCell>,
) {
  for (const cell of cells) {
    if (
      absoluteX >= cell.x
      && absoluteX <= cell.x + cell.width
      && absoluteY >= cell.y
      && absoluteY <= cell.y + cell.height
    ) return cell.date;
  }
  return null;
}

export function withAthleteCalendarSessionDate<
  TSession extends { workout_id: number; date?: string | null },
  TDay extends { date: string; sessions?: TSession[] },
  TPayload extends { days?: TDay[]; month_summaries?: { month: string }[] },
>(payload: TPayload | null, session: TSession, destinationDate: string): TPayload | null {
  if (!payload?.days || !destinationDate) return payload;
  const source = payload.days
    .flatMap((day) => day.sessions || [])
    .find((candidate) => Number(candidate.workout_id) === Number(session.workout_id)) || session;
  const projected = { ...source, date: destinationDate };
  const affectedMonths = new Set(
    [source.date, destinationDate]
      .filter((value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
      .map((value) => value.slice(0, 7)),
  );
  return {
    ...payload,
    days: payload.days.map((day) => {
      const sessions = (day.sessions || []).filter(
        (candidate) => Number(candidate.workout_id) !== Number(session.workout_id),
      );
      if (day.date === destinationDate) sessions.push(projected);
      return { ...day, sessions };
    }),
    ...(payload.month_summaries ? {
      month_summaries: payload.month_summaries.filter((summary) => !affectedMonths.has(summary.month)),
    } : {}),
  };
}
