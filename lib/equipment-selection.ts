import { equipmentPresentationLabel } from '@/lib/equipment-presentation';

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
    usage_status?: 'used' | 'not_used' | string | null;
    is_current?: boolean | null;
    last_used_at?: string | null;
    used_equipment_type_keys?: string[] | null;
    equipment_type_last_used_at?: Record<string, string | null> | null;
    used_equipment_definition_ids?: number[] | null;
    used_equipment_model_ids?: number[] | null;
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

export type ActiveEquipmentPresentation = Readonly<{
  identity: EquipmentIdentityLike;
  manufacturerName: string;
  equipmentTypeLabel: string;
  contextLabel: string;
}>;

/**
 * Resolves compact athlete-facing context for the equipment that is actually
 * active on a machine movement. A manufacturer is required because generic or
 * unresolved equipment copy is not useful context on a movement card.
 */
export function activeEquipmentPresentation(
  item: EquipmentAwareWorkoutItem | null | undefined,
): ActiveEquipmentPresentation | null {
  const identity = activeEquipmentIdentity(item);
  if (!identity) return null;

  const manufacturerName = String(
    identity.manufacturer?.display_name
      || identity.material_parameters?.custom_manufacturer_name
      || '',
  ).trim();
  if (!manufacturerName) return null;

  const equipmentTypeLabel = equipmentPresentationLabel(
    identity.equipment_type || identity.loading_implementation,
    'Machine',
  );
  return {
    identity,
    manufacturerName,
    equipmentTypeLabel,
    contextLabel: `${manufacturerName} · ${equipmentTypeLabel}`,
  };
}

export function needsEquipmentSelection(
  item: EquipmentAwareWorkoutItem | null | undefined,
): boolean {
  return isMachineAccessoryItem(item) && !activeEquipmentIdentity(item);
}

function canonicalEquipmentChoiceLabel(identity: EquipmentIdentityLike): string {
  return String(identity.manufacturer?.display_name || identity.display_name || '').trim();
}

function equipmentChoiceSection(identity: EquipmentIdentityLike): number {
  if (identity.equipment_context?.option_kind === 'other') return 2;
  if (
    identity.equipment_context?.option_kind === 'unknown'
    || identity.identity_specificity === 'unknown'
  ) return 1;
  return 0;
}

export function orderEquipmentChoices<T extends EquipmentIdentityLike>(
  choices: readonly T[],
  activeIdentityId?: number | null,
): T[] {
  // Current and historical state are presentation metadata, never sort keys.
  // Keep the parameter for source compatibility with existing consumers.
  void activeIdentityId;
  return [...choices].sort((left, right) => {
    const sectionDelta = equipmentChoiceSection(left) - equipmentChoiceSection(right);
    if (sectionDelta !== 0) return sectionDelta;
    const leftLabel = canonicalEquipmentChoiceLabel(left);
    const rightLabel = canonicalEquipmentChoiceLabel(right);
    const caseInsensitiveDelta = leftLabel.localeCompare(rightLabel, 'en-US', {
      sensitivity: 'base',
    });
    if (caseInsensitiveDelta !== 0) return caseInsensitiveDelta;
    const exactLabelDelta = leftLabel.localeCompare(rightLabel, 'en-US', {
      sensitivity: 'variant',
    });
    if (exactLabelDelta !== 0) return exactLabelDelta;
    const keyDelta = String(left.manufacturer?.key || left.key).localeCompare(
      String(right.manufacturer?.key || right.key),
      'en-US',
    );
    if (keyDelta !== 0) return keyDelta;
    return Number(left.id) - Number(right.id);
  });
}

function normalizedUsageValue(value: unknown): string {
  return String(value || '').trim().toLocaleLowerCase('en-US').replace(/[\s-]+/g, '_');
}

export function equipmentWasPreviouslyUsed(
  identity: EquipmentIdentityLike | null | undefined,
): boolean {
  if (!identity) return false;
  const usageStatus = normalizedUsageValue(identity.equipment_context?.usage_status);
  if (usageStatus) return usageStatus === 'used';
  // Backward compatibility for payloads predating movement-scoped usage_status.
  // A legacy "current" value is intentionally not treated as historical use.
  return normalizedUsageValue(identity.equipment_context?.remembered_status) === 'used_before';
}

export function equipmentSelectionStatusLabels(
  identity: EquipmentIdentityLike | null | undefined,
  current: boolean,
): string[] {
  return [
    ...(current ? ['CURRENT'] : []),
    equipmentWasPreviouslyUsed(identity) ? 'USED' : 'NOT USED',
  ];
}

export function equipmentTypeWasPreviouslyUsed(
  identity: EquipmentIdentityLike | null | undefined,
  equipmentType: string | null | undefined,
): boolean {
  if (!identity) return false;
  const requestedType = normalizedUsageValue(equipmentType);
  if (!requestedType) return false;
  return (identity.equipment_context?.used_equipment_type_keys || []).some(
    (candidate) => normalizedUsageValue(candidate) === requestedType,
  );
}

export function equipmentTypeSelectionStatusLabels(
  identity: EquipmentIdentityLike | null | undefined,
  equipmentType: string | null | undefined,
  current: boolean,
): string[] {
  return [
    ...(current ? ['CURRENT'] : []),
    equipmentTypeWasPreviouslyUsed(identity, equipmentType) ? 'USED' : 'NOT USED',
  ];
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
