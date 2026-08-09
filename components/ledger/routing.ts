export type LedgerRoom =
  | 'home'
  | 'journey'
  | 'strength'
  | 'achievements'
  | 'archive';

export type LedgerScreen = LedgerRoom;

export type LedgerDestination = Readonly<{
  key: LedgerRoom;
  entryId: `ledger-${string}`;
  entryTitle: string;
  title: string;
  label: string;
  icon: string;
  description: string;
  route: `/(tabs)/ledger/${LedgerRoom}`;
  validationMarker: string;
}>;

export const LEDGER_DESTINATIONS: readonly LedgerDestination[] = [
  { key: 'home', entryId: 'ledger-home', entryTitle: 'The Ledger — Home', title: 'The Ledger', label: 'Home', icon: 'sparkles-outline', description: 'A curated entry point into the authenticated athlete’s evidence and history.', route: '/(tabs)/ledger/home', validationMarker: 'What deserves your attention today' },
  { key: 'journey', entryId: 'ledger-journey', entryTitle: 'Journey', title: 'Journey', label: 'Journey', icon: 'map-outline', description: 'Chronological career chapters and turning points.', route: '/(tabs)/ledger/journey', validationMarker: 'Career timeline' },
  { key: 'strength', entryId: 'ledger-strength', entryTitle: 'Strength', title: 'Strength', label: 'Strength', icon: 'barbell-outline', description: 'Current strength, progression, evidence, and historical context.', route: '/(tabs)/ledger/strength', validationMarker: 'Current strength' },
  { key: 'achievements', entryId: 'ledger-achievements', entryTitle: 'Achievements Overview', title: 'Achievements', label: 'Achievements', icon: 'trophy-outline', description: 'A separate overview of earned accomplishments.', route: '/(tabs)/ledger/achievements', validationMarker: 'Latest accomplishment' },
  { key: 'archive', entryId: 'ledger-archive', entryTitle: 'Archive', title: 'Archive', label: 'Archive', icon: 'archive-outline', description: 'The durable source repository for preserved athlete records.', route: '/(tabs)/ledger/archive', validationMarker: 'Preserved source material' },
] as const;

export const LEDGER_DESTINATION_BY_KEY = Object.fromEntries(
  LEDGER_DESTINATIONS.map((destination) => [destination.key, destination]),
) as Record<LedgerRoom, LedgerDestination>;

export function resolveLedgerDestination(value: string | string[] | undefined): LedgerDestination | null {
  const requested = Array.isArray(value) ? value[0] : value;
  if (!requested) return null;
  return LEDGER_DESTINATION_BY_KEY[requested as LedgerRoom] ?? null;
}

export function resolveLedgerDestinationFromPathname(pathname: string | undefined): LedgerDestination | null {
  if (!pathname) return null;

  const normalizedPathname = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, '');
  const requested = normalizedPathname?.split('/').pop();
  if (!requested || requested === 'ledger' || requested === '[screen]') return null;

  return resolveLedgerDestination(decodeURIComponent(requested));
}

export function ledgerHrefFor(screen: LedgerRoom) {
  return LEDGER_DESTINATION_BY_KEY[screen].route;
}
