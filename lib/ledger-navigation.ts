export type LedgerSection = 'records' | 'history' | 'milestones';
export type LedgerRecordFamily = 'core' | 'variants' | 'accessories';
export type LedgerHistoryCollection = 'training' | 'prs' | 'imports' | 'media' | 'competition';
export type LedgerNavigationState = Readonly<{
  section: LedgerSection;
  family: LedgerRecordFamily;
  history: LedgerHistoryCollection;
}>;

/** Stable view identities; only the active chapter exposes its local choices. */
export const LEDGER_DESTINATIONS = [
  { key: 'records:core', section: 'records', family: 'core', label: 'Core lifts', icon: 'barbell-outline', testID: 'ledger-family-core' },
  { key: 'records:variants', section: 'records', family: 'variants', label: 'Variants', icon: 'options-outline', testID: 'ledger-family-variants' },
  { key: 'records:accessories', section: 'records', family: 'accessories', label: 'Accessories', icon: 'grid-outline', testID: 'ledger-family-accessories' },
  { key: 'history:training', section: 'history', filter: 'training', label: 'Training', icon: 'calendar-outline', testID: 'ledger-history-training' },
  { key: 'history:prs', section: 'history', filter: 'prs', label: 'Personal bests', icon: 'trending-up-outline', testID: 'ledger-history-prs' },
  { key: 'history:imports', section: 'history', filter: 'imports', label: 'Past entries', icon: 'documents-outline', testID: 'ledger-history-imports' },
  { key: 'history:media', section: 'history', filter: 'media', label: 'Film', icon: 'film-outline', testID: 'ledger-history-media' },
  { key: 'history:competition', section: 'history', filter: 'competition', label: 'Meets', icon: 'trophy-outline', testID: 'ledger-history-competition' },
  { key: 'milestones', section: 'milestones', label: 'Milestones', icon: 'ribbon-outline', testID: 'ledger-milestones' },
] as const;
export type LedgerDestination = typeof LEDGER_DESTINATIONS[number];
export const LEDGER_CHAPTERS = [
  { key: 'records', label: 'Records' },
  { key: 'history', label: 'History' },
  { key: 'milestones', label: 'Milestones' },
] as const;

export function ledgerContextOptions(section:'records'|'history') {
  return LEDGER_DESTINATIONS.filter(destination => destination.section === section);
}
export function ledgerContextDestination(section:'records'|'history', key:string) {
  return LEDGER_DESTINATIONS.find(destination => destination.section === section && destination.key === key) ?? null;
}

/** An inactive chapter cannot move the current view's scroll restoration key. */
export function ledgerNavigationLocation(state: LedgerNavigationState, detail: {lift?:string|null;variantId?:number|null;context?:boolean;standards?:boolean} = {}) {
  if (state.section === 'history') return `history:${state.history}`;
  if (state.section === 'milestones') return 'milestones';
  return `records:${state.family}:${detail.lift??''}:${detail.variantId??''}:${Boolean(detail.context)}:${Boolean(detail.standards)}`;
}
