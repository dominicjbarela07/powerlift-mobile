export type EquipmentIdentityLike = {
  id: number;
  key: string;
  display_name: string;
  identity_specificity?: 'broad' | 'exact' | 'unknown' | string;
  equipment_type?: string | null;
  loading_implementation?: string | null;
  load_convention?: string | null;
  implementation_key?: string | null;
  manufacturer?: {
    id: number;
    key: string;
    display_name: string;
  } | null;
  equipment_context?: {
    remembered_status?: string | null;
    last_used_at?: string | null;
    option_kind?: 'catalog' | 'other' | 'unknown' | string;
  } | null;
};

export type EquipmentAwareWorkoutItem = {
  id: number;
  movement?: string | null;
  movement_identity?: EquipmentIdentityLike | null;
  performed_movement_identity?: EquipmentIdentityLike | null;
};

const MACHINE_TERMS = [
  'machine',
  'selectorized',
  'selectorised',
  'plate loaded',
  'plate-loaded',
  'leverage',
  'cable',
  'pulley',
] as const;

const PORTABLE_TERMS = [
  'dumbbell',
  'barbell',
  'kettlebell',
  'bodyweight',
  'band',
  'free weight',
] as const;

function normalize(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function identityEquipmentText(identity?: EquipmentIdentityLike | null): string {
  return normalize([
    identity?.equipment_type,
    identity?.loading_implementation,
    identity?.load_convention,
  ].filter(Boolean).join(' '));
}

function containsTerm(value: string, term: string): boolean {
  return ` ${value} `.includes(` ${normalize(term)} `);
}

function equipmentClass(
  identity?: EquipmentIdentityLike | null,
): 'machine' | 'portable' | 'unknown' {
  const value = identityEquipmentText(identity);
  if (!value) return 'unknown';
  if (MACHINE_TERMS.some((term) => containsTerm(value, term))) return 'machine';
  if (PORTABLE_TERMS.some((term) => containsTerm(value, term))) return 'portable';
  return 'unknown';
}

export function isMachineAccessoryItem(
  item?: EquipmentAwareWorkoutItem | null,
): boolean {
  if (!item) return false;
  const performedClass = equipmentClass(item.performed_movement_identity);
  if (performedClass !== 'unknown') return performedClass === 'machine';
  return equipmentClass(item.movement_identity) === 'machine';
}

function isConfiguredMachineIdentity(
  identity?: EquipmentIdentityLike | null,
): identity is EquipmentIdentityLike {
  return Boolean(
    identity
      && identity.identity_specificity === 'exact'
      && equipmentClass(identity) === 'machine'
      && identity.equipment_context?.option_kind !== 'unknown'
      && !normalize(identity.loading_implementation).includes('unknown')
      && (identity.manufacturer?.id || identity.implementation_key),
  );
}

export function activeEquipmentIdentity(
  item?: EquipmentAwareWorkoutItem | null,
): EquipmentIdentityLike | null {
  if (!item || !isMachineAccessoryItem(item)) return null;
  if (isConfiguredMachineIdentity(item.performed_movement_identity)) {
    return item.performed_movement_identity;
  }
  if (isConfiguredMachineIdentity(item.movement_identity)) {
    return item.movement_identity;
  }
  return null;
}

export function needsEquipmentSelection(
  item?: EquipmentAwareWorkoutItem | null,
): boolean {
  return isMachineAccessoryItem(item) && !activeEquipmentIdentity(item);
}

function optionPriority(identity: EquipmentIdentityLike): number {
  const status = identity.equipment_context?.remembered_status;
  if (status === 'current') return 0;
  if (status === 'used_before') return 1;
  if (identity.equipment_context?.option_kind === 'other') return 90;
  return 10;
}

export function orderEquipmentChoices<T extends EquipmentIdentityLike>(
  choices: readonly T[],
): T[] {
  return [...choices].sort((left, right) => {
    const priority = optionPriority(left) - optionPriority(right);
    if (priority !== 0) return priority;
    const leftUsed = Date.parse(left.equipment_context?.last_used_at || '') || 0;
    const rightUsed = Date.parse(right.equipment_context?.last_used_at || '') || 0;
    if (leftUsed !== rightUsed) return rightUsed - leftUsed;
    return left.display_name.localeCompare(right.display_name);
  });
}
