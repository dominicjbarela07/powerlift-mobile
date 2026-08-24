export type GovernedAccessoryIdentity = {
  id: number;
  display_name: string;
};

export type GovernedAccessoryDraft = {
  movement: string;
  movement_definition_id?: number | null;
  movement_identity?: GovernedAccessoryIdentity | null;
};

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function governedIdentityFromSelection(
  selection: GovernedAccessoryIdentity,
): GovernedAccessoryIdentity {
  const id = positiveInteger(selection?.id);
  const displayName = String(selection?.display_name || '').trim();
  if (!id || !displayName) {
    throw new Error('Invalid governed movement catalog row.');
  }
  return { id, display_name: displayName };
}

export function governedMovementDefinitionId(
  draft: GovernedAccessoryDraft,
): number | null {
  return positiveInteger(draft?.movement_definition_id)
    || positiveInteger(draft?.movement_identity?.id);
}

export function materializeGovernedAccessoryDraft<T extends GovernedAccessoryDraft>(
  draft: T,
  identity?: GovernedAccessoryIdentity | null,
): T & {
  movement_definition_id: number;
  movement_identity: GovernedAccessoryIdentity;
} {
  const selectedIdentity = identity
    ? governedIdentityFromSelection(identity)
    : draft.movement_identity
      ? governedIdentityFromSelection(draft.movement_identity)
      : null;
  const directId = positiveInteger(draft.movement_definition_id);
  if (directId && selectedIdentity?.id && directId !== selectedIdentity.id) {
    throw new Error('Accessory draft contains conflicting governed movement identities.');
  }
  const id = directId || selectedIdentity?.id || null;
  const displayName = String(selectedIdentity?.display_name || draft.movement || '').trim();

  if (!id || !displayName) {
    throw new Error('Accessory draft does not contain a governed movement identity.');
  }

  const authoritativeIdentity = selectedIdentity
    ? { ...selectedIdentity, id }
    : { id, display_name: displayName };
  return {
    ...draft,
    movement: authoritativeIdentity.display_name,
    movement_definition_id: id,
    movement_identity: authoritativeIdentity,
  };
}
