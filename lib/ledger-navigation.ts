export type LedgerSection = 'records' | 'history' | 'milestones';
export type LedgerRecordFamily = 'core' | 'variants' | 'accessories';
export type LedgerHistoryCollection = 'training' | 'prs' | 'imports' | 'media' | 'competition';
export type LedgerNavigationState = Readonly<{
  section: LedgerSection;
  family: LedgerRecordFamily;
  history: LedgerHistoryCollection;
}>;

/** Flat destinations: choosing Film must not require first choosing History. */
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

export function currentLedgerDestination(state: LedgerNavigationState): LedgerDestination {
  const key = state.section === 'records' ? `records:${state.family}` : state.section === 'history' ? `history:${state.history}` : 'milestones';
  return LEDGER_DESTINATIONS.find(destination => destination.key === key) ?? LEDGER_DESTINATIONS[0];
}

/** Preserve the other chapter's selection. Unknown keys cannot become routes. */
export function selectLedgerDestination(state: LedgerNavigationState, key: string): LedgerNavigationState {
  const destination = LEDGER_DESTINATIONS.find(item => item.key === key);
  if (!destination) return state;
  if (destination.section === 'records') return { ...state, section: 'records', family: destination.family };
  if (destination.section === 'history') return { ...state, section: 'history', history: destination.filter };
  return { ...state, section: 'milestones' };
}

/** An inactive chapter cannot move the current view's scroll restoration key. */
export function ledgerNavigationLocation(state: LedgerNavigationState, detail: {lift?:string|null;variantId?:number|null;context?:boolean;standards?:boolean} = {}) {
  if (state.section === 'history') return `history:${state.history}`;
  if (state.section === 'milestones') return 'milestones';
  return `records:${state.family}:${detail.lift??''}:${detail.variantId??''}:${Boolean(detail.context)}:${Boolean(detail.standards)}`;
}
