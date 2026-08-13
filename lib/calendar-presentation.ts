export type CalendarPresentationDay = {
  date: string;
  isToday?: boolean;
  sessions: { id: number }[];
  personalEvents?: { id: number }[];
};

export function selectFeaturedCalendarEventKey(days: CalendarPresentationDay[], today: string) {
  const orderedDays = [...days].sort((left, right) => left.date.localeCompare(right.date));
  const selectedDay = orderedDays.find((day) => (day.isToday || day.date === today) && hasEvents(day))
    || orderedDays.find((day) => day.date >= today && hasEvents(day))
    || orderedDays.find(hasEvents);
  if (!selectedDay) return null;

  const session = selectedDay.sessions[0];
  if (session) return `session:${session.id}`;
  const personalEvent = selectedDay.personalEvents?.[0];
  return personalEvent ? `personal:${personalEvent.id}` : null;
}

function hasEvents(day: CalendarPresentationDay) {
  return day.sessions.length > 0 || (day.personalEvents?.length || 0) > 0;
}
