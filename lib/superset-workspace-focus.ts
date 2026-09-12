import type { SupersetRoundModel, SupersetRoundSourceItem } from './superset-rounds';

export type SupersetMemberSelection = Readonly<{ itemId: number; evidenceKey: string }> | null;

export function supersetEvidenceKey<T extends SupersetRoundSourceItem>(model: SupersetRoundModel<T>) {
  return JSON.stringify(model.movements.map(row => [row.itemId, row.position, row.requiredSets, row.loggedSetIndexes]));
}

/** Presentation focus never changes group order or writes/skips a performed Set.
 * Accepted evidence advances the suggested member; manual inspection survives
 * focus/unit/refresh events while that evidence remains the same.
 */
export function supersetWorkspaceFocus<T extends SupersetRoundSourceItem>(model: SupersetRoundModel<T>, selection: SupersetMemberSelection) {
  const evidenceKey = supersetEvidenceKey(model);
  const selected = selection?.evidenceKey === evidenceKey
    ? model.movements.find(row => row.itemId === selection.itemId) : undefined;
  const suggested = model.movements.find(row => row.itemId === model.suggestedNextItemId);
  const member = selected || suggested || model.movements[0];
  const next = member?.nextSetIndex != null ? member : suggested;
  return { evidenceKey, member, next, roundIndex: model.currentRoundIndex, roundCount: model.roundCount };
}

export function supersetMemberLabel(group: string, position: number) {
  return `${group}${position}`;
}
