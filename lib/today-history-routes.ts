/** Shared athlete/self-coach destinations. Personal history has no roster scope. */
export function todayHistoryHref(route?: string | null) {
  if (route === 'my_videos') return {
    pathname: '/(tabs)/ledger/archive', params: { collection: 'media', returnTo: 'today' },
  } as const;
  if (route === 'training_history') return '/(tabs)/workout/session-history' as const;
  if (route === 'movement_history') return '/(tabs)/workout/movement-history' as const;
  return null;
}
