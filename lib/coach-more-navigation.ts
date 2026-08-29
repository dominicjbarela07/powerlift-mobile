export type CoachMoreDestinationKey =
  | 'programming'
  | 'review-hub'
  | 'coach-calendar'
  | 'check-ins'
  | 'team-brief'
  | 'settings';

export type CoachMoreLaunchContext = Readonly<{
  athleteId?: string;
  athleteName?: string;
}>;

export type CoachMoreDestination = Readonly<{
  key: CoachMoreDestinationKey;
  label: string;
  detail: string;
  icon: string;
  accent: 'violet' | 'cyan' | 'green' | 'gold' | 'magenta' | 'muted';
  pathname: string;
  navigation: 'navigate' | 'push';
}>;

export const COACH_MORE_TOOL_DESTINATIONS: readonly CoachMoreDestination[] = [
  { key: 'programming', label: 'Programming', detail: 'Athlete plans', icon: 'barbell-outline', accent: 'violet', pathname: '/(tabs)/workout', navigation: 'navigate' },
  { key: 'review-hub', label: 'Review Hub', detail: 'Reviews', icon: 'clipboard-outline', accent: 'cyan', pathname: '/(tabs)/coach-videos', navigation: 'navigate' },
  { key: 'coach-calendar', label: 'Coach Calendar', detail: 'Schedule', icon: 'calendar-outline', accent: 'gold', pathname: '/(tabs)/coach-calendar', navigation: 'navigate' },
  { key: 'check-ins', label: 'Check-Ins', detail: 'Athlete status', icon: 'checkbox-outline', accent: 'green', pathname: '/(tabs)/check-ins', navigation: 'push' },
] as const;

export const COACH_MORE_ACCOUNT_DESTINATIONS: readonly CoachMoreDestination[] = [
  { key: 'team-brief', label: 'Team Brief', detail: 'Team intelligence', icon: 'reader-outline', accent: 'magenta', pathname: '/coach-team-brief', navigation: 'push' },
  { key: 'settings', label: 'Settings', detail: 'Account', icon: 'settings-outline', accent: 'muted', pathname: '/(tabs)/settings', navigation: 'push' },
] as const;

export const COACH_MORE_DESTINATIONS = [
  ...COACH_MORE_TOOL_DESTINATIONS,
  ...COACH_MORE_ACCOUNT_DESTINATIONS,
] as const;

export function coachMoreDestinationTarget(
  destination: CoachMoreDestination,
  context?: CoachMoreLaunchContext,
) {
  const athleteId = context?.athleteId?.trim();
  const athleteName = context?.athleteName?.trim();
  const acceptsAthleteContext = destination.key === 'programming'
    || destination.key === 'review-hub'
    || destination.key === 'coach-calendar'
    || destination.key === 'check-ins';

  return {
    pathname: destination.pathname,
    params: acceptsAthleteContext && athleteId
      ? { athleteId, ...(athleteName ? { athleteName } : {}) }
      : undefined,
  };
}
