import { buildSupersetRoundModel, type SupersetRoundSourceItem } from './superset-rounds';

type AcceptedSet = { id?: number; item_id?: number; set_index?: number };
type AcceptedResult = {
  created?: boolean; replayed?: boolean; set?: AcceptedSet; item_id?: number;
  entries?: { set?: AcceptedSet; item_id?: number }[];
  skipped_item_ids?: number[];
  completion_boundary?: { authority?: string; session_final_set?: boolean };
};

/** Runs only on canonical acceptance; timer choice is not performed evidence. */
export function shouldOfferRestAfterAcceptedSet(
  result: AcceptedResult,
  groups: readonly { group: string | null; items: readonly SupersetRoundSourceItem[] }[],
  submittedItemId?: number,
): boolean {
  if (result.created !== true || result.replayed === true || !result.set?.id) return false;
  if (result.completion_boundary?.authority === 'canonical' && result.completion_boundary.session_final_set) return false;
  const itemId = result.set.item_id || result.item_id || submittedItemId;
  const group = groups.find(row => row.group && row.items.some(item => item.id === itemId));
  if (!group) return true; // Includes the last Set of a movement when the Session continues.
  const accepted = result.entries?.length ? result.entries : [result];
  const reconciledItems = group.items.map(item => ({ ...item, set_logs: [
    ...(item.set_logs || []),
    ...accepted.filter(entry => (entry.set?.item_id || entry.item_id || submittedItemId) === item.id)
      .flatMap(entry => entry.set ? [entry.set] : []),
  ] }));
  const round = buildSupersetRoundModel(reconciledItems).rounds.find(row => row.index === result.set?.set_index);
  if (!round) return true; // An explicit extra/custom Set beyond prescribed rounds.
  const skipped = new Set(result.skipped_item_ids || []);
  return round.entries.every(entry => entry.log != null || skipped.has(entry.itemId));
}
