export type EquipmentSelectionContinuation =
  | { kind: 'none' }
  | { kind: 'accessory_set'; itemId: number }
  | {
      kind: 'group_round';
      groupLabel: string;
      roundIndex: number;
    };

export type EquipmentIdentityLike = {
  id: number;
  key: string;
  display_name: string;
  family_id?: number | null;
  family_display_name?: string | null;
  identity_specificity?: 'broad' | 'exact' | 'unknown' | string;
  equipment_type?: string | null;
  loading_implementation?: string | null;
  load_convention?: string | null;
  measurement_type?: string | null;
  sidedness?: string | null;
  implementation_key?: string | null;
  manufacturer?: {
    id: number;
    key: string;
    display_name: string;
  } | null;
  equipment_model?: {
    id: number;
    key: string;
    display_name: string;
  } | null;
  material_parameters?: {
    note?: string | null;
    custom_manufacturer_name?: string | null;
  } | null;
  equipment_context?: {
    remembered_status?: string | null;
    last_used_at?: string | null;
    option_kind?: 'catalog' | 'other' | 'unknown' | string;
  } | null;
  comparison_policy?: {
    confidence?: string | null;
    comparison_scope?: string | null;
    recognition_enabled?: false;
  } | null;
};

export type EquipmentAwareWorkoutItem = {
  id: number;
  movement?: string | null;
  movement_identity?: EquipmentIdentityLike | null;
  performed_movement_identity?: EquipmentIdentityLike | null;
  dev_accessory_intelligence?: {
    kind?: string | null;
  } | null;
};

const MACHINE_EQUIPMENT_TERMS = [
  'machine',
  'selectorized',
  'selectorised',
  'plate loaded',
  'plate-loaded',
  'leverage',
  'cable',
  'cable stack',
  'pulley',
] as const;

const PORTABLE_EQUIPMENT_TERMS = [
  'dumbbell',
  'barbell',
  'free weight',
  'bodyweight',
  'kettlebell',
  'band',
  'farmer handle',
] as const;

const LEGACY_MACHINE_MOVEMENT_TERMS = [
  'machine',
  'cable',
  'pulldown',
  'pushdown',
  'pressdown',
  'pec deck',
  'hack squat',
  'leg press',
  'pendulum squat',
  'leg extension',
  'leg curl',
  'assisted pull up',
  'assisted dip',
] as const;

const LEGACY_PORTABLE_MOVEMENT_TERMS = [
  'barbell',
  'dumbbell',
  'db',
  'kettlebell',
  'bodyweight',
  'band',
  'farmer handle',
] as const;

function normalized(value: unknown): string {
  return String(value || '')
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function identityEquipmentText(identity?: EquipmentIdentityLike | null): string {
  return [
    identity?.equipment_type,
    identity?.loading_implementation,
    identity?.load_convention,
  ].filter(Boolean).join(' ');
}

function containsNormalizedTerm(value: string, term: string): boolean {
  return ` ${value} `.includes(` ${term} `);
}

function isLegacyMachineMovementLabel(movement?: string | null): boolean {
  const value = normalized(movement);
  if (!value) return false;
  if (
    LEGACY_PORTABLE_MOVEMENT_TERMS.some((term) => (
      containsNormalizedTerm(value, term)
    ))
  ) {
    return false;
  }
  return LEGACY_MACHINE_MOVEMENT_TERMS.some((term) => (
    containsNormalizedTerm(value, term)
  ));
}

type EquipmentClassification = 'machine' | 'portable' | 'unknown';

function equipmentClassification(
  identity: EquipmentIdentityLike | null | undefined,
): EquipmentClassification {
  const text = normalized(identityEquipmentText(identity));
  if (!text) return 'unknown';

  // Cable stations are fixed equipment. This check intentionally precedes the
  // portable-equipment check so legacy values such as "Common cable" cannot
  // bypass the same equipment workflow used by other machines.
  if (
    MACHINE_EQUIPMENT_TERMS.some((term) => (
      containsNormalizedTerm(text, normalized(term))
    ))
  ) {
    return 'machine';
  }
  if (
    PORTABLE_EQUIPMENT_TERMS.some((term) => (
      containsNormalizedTerm(text, normalized(term))
    ))
  ) {
    return 'portable';
  }
  return 'unknown';
}

export function isMachineEquipmentIdentity(
  identity: EquipmentIdentityLike | null | undefined,
): boolean {
  return equipmentClassification(identity) === 'machine';
}

export function isMachineAccessoryItem(
  item: EquipmentAwareWorkoutItem | null | undefined,
): boolean {
  if (!item) return false;
  const performedClassification = equipmentClassification(
    item.performed_movement_identity,
  );
  if (performedClassification !== 'unknown') {
    return performedClassification === 'machine';
  }
  const prescribedClassification = equipmentClassification(item.movement_identity);
  if (prescribedClassification !== 'unknown') {
    return prescribedClassification === 'machine';
  }

  const developmentKind = normalized(item.dev_accessory_intelligence?.kind);
  if (developmentKind === 'machine' || developmentKind === 'cable') return true;
  if (isLegacyMachineMovementLabel(item.movement)) return true;
  if (
    developmentKind === 'portable'
    || developmentKind === 'free weight'
    || developmentKind === 'bodyweight'
  ) {
    return false;
  }
  return false;
}

function isConfiguredMachineIdentity(
  identity: EquipmentIdentityLike | null | undefined,
): identity is EquipmentIdentityLike {
  if (
    !identity
    || identity.identity_specificity !== 'exact'
    || !isMachineEquipmentIdentity(identity)
    || identity.equipment_context?.option_kind === 'unknown'
    || normalized(identity.loading_implementation).includes('unknown')
  ) {
    return false;
  }
  return Boolean(identity.manufacturer?.id || identity.implementation_key);
}

export function activeEquipmentIdentity(
  item: EquipmentAwareWorkoutItem | null | undefined,
): EquipmentIdentityLike | null {
  if (!item || !isMachineAccessoryItem(item)) return null;
  if (isConfiguredMachineIdentity(item.performed_movement_identity)) {
    return item.performed_movement_identity;
  }
  const prescribed = item.movement_identity;
  if (isConfiguredMachineIdentity(prescribed)) return prescribed;
  return null;
}

export function needsEquipmentSelection(
  item: EquipmentAwareWorkoutItem | null | undefined,
): boolean {
  return isMachineAccessoryItem(item) && !activeEquipmentIdentity(item);
}

function optionPriority(
  identity: EquipmentIdentityLike,
  activeIdentityId: number | null,
): number {
  if (Number(identity.id) === Number(activeIdentityId)) return 0;
  const rememberedStatus = identity.equipment_context?.remembered_status;
  if (rememberedStatus === 'current') return 1;
  if (rememberedStatus === 'used_before') return 2;
  if (identity.equipment_context?.option_kind === 'other') return 90;
  if (
    identity.equipment_context?.option_kind === 'unknown'
    || identity.identity_specificity === 'unknown'
  ) return 95;
  return 10;
}

export function orderEquipmentChoices<T extends EquipmentIdentityLike>(
  choices: readonly T[],
  activeIdentityId?: number | null,
): T[] {
  return [...choices].sort((left, right) => {
    const priorityDelta = optionPriority(left, activeIdentityId ?? null)
      - optionPriority(right, activeIdentityId ?? null);
    if (priorityDelta !== 0) return priorityDelta;
    const leftUsed = Date.parse(left.equipment_context?.last_used_at || '') || 0;
    const rightUsed = Date.parse(right.equipment_context?.last_used_at || '') || 0;
    if (leftUsed !== rightUsed) return rightUsed - leftUsed;
    return left.display_name.localeCompare(right.display_name);
  });
}

export function equipmentSnapshotForSet(
  identity: EquipmentIdentityLike | null | undefined,
) {
  if (!identity) return {};
  return {
    performed_movement_definition_id: identity.id,
    equipment_manufacturer_id: identity.manufacturer?.id ?? null,
    equipment_model_id: identity.equipment_model?.id ?? null,
    implementation_key_snapshot: identity.implementation_key || identity.key,
    performed_label_snapshot: identity.display_name,
    identity_source_snapshot: 'dev_equipment_selection',
  };
}
