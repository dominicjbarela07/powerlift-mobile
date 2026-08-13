export type ShippingMobileViewMode = 'athlete' | 'coach' | 'individual';

export const SHIPPING_ATHLETE_TAB_ROUTES = [
  'athlete-dashboard',
  'workout/index',
  'athlete-calendar',
  'ledger',
] as const;

export const SHIPPING_COACH_TAB_ROUTES = [
  'coach-roster',
  'coach-calendar',
  'coach-videos',
  'messages/index',
] as const;

export const SHIPPING_UNLINKED_ATHLETE_TAB_ROUTES = [
  'link-coach',
  'settings',
] as const;

export const SHIPPING_TAB_PRESENTATION = {
  'athlete-dashboard': { label: 'Today', icon: 'home-outline' },
  'workout/index': { label: 'Training', icon: 'barbell-outline' },
  'athlete-calendar': { label: 'Calendar', icon: 'calendar-outline' },
  ledger: { label: 'Ledger', icon: 'book-outline' },
  'coach-roster': { label: 'Roster', icon: 'people-outline' },
  'coach-calendar': { label: 'Calendar', icon: 'calendar-outline' },
  'coach-videos': { label: 'Reviews', icon: 'clipboard-outline' },
  'messages/index': { label: 'Messages', icon: 'chatbubbles-outline' },
} as const;

export function shippingTabRouteNames({
  isCoach,
  isIndividual,
  isUnlinkedAthlete,
  viewMode,
  hasMeetDate,
}: {
  isCoach: boolean;
  isIndividual: boolean;
  isUnlinkedAthlete: boolean;
  viewMode: ShippingMobileViewMode;
  hasMeetDate: boolean;
}): string[] {
  if (isUnlinkedAthlete) return [...SHIPPING_UNLINKED_ATHLETE_TAB_ROUTES];
  if (isIndividual) return [...SHIPPING_ATHLETE_TAB_ROUTES];
  if (isCoach && viewMode === 'coach') return [...SHIPPING_COACH_TAB_ROUTES];

  const athleteRoutes: string[] = [...SHIPPING_ATHLETE_TAB_ROUTES];
  if (hasMeetDate) athleteRoutes.splice(3, 0, 'athlete-meet-plan');
  return athleteRoutes;
}
