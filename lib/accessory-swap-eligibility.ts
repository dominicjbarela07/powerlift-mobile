export type AccessorySwapItemEvidence = {
  set_logs?: Array<{ id?: number | null }> | null;
  has_performed_evidence?: boolean | null;
};

export type AccessorySwapAction = 'Swap' | 'Sub';

export function itemHasPersistedSetLogs(
  item: AccessorySwapItemEvidence | null | undefined,
): boolean {
  return Boolean(item?.has_performed_evidence || (item?.set_logs?.length ?? 0) > 0);
}

export function accessorySwapActionForItem(input: {
  canHotSwap: boolean;
  hasApprovedSubstitutions: boolean;
  isCoachPreview: boolean;
  sessionStatus?: string | null;
  item?: AccessorySwapItemEvidence | null;
}): AccessorySwapAction | null {
  if (input.isCoachPreview || itemHasPersistedSetLogs(input.item)) return null;

  const status = String(input.sessionStatus || '').trim().toLowerCase();
  if (!['assigned', 'tardy', 'in_progress'].includes(status)) return null;

  if (input.canHotSwap) return 'Swap';
  if (input.hasApprovedSubstitutions) return 'Sub';
  return null;
}
