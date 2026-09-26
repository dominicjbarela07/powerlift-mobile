import { normalizeCurrentWorkoutItem } from './current-session-movement';
import { equipmentPresentationLabel } from '@/lib/equipment-presentation';
import { exposureFromHistoryRecord, presentSessionExposure, type RecordedExposure } from './session-exposure-snapshot';
import type { PerformedLoadSemantics } from './performed-load-semantics';

export type EquipmentSelectionContinuation =
  | { kind: 'none' }
  | { kind: 'evidence_correction' }
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
  optional_equipment_domains?: readonly string[] | null;
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
    last_exposure?: RecordedExposure | null;
    equipment_type_last_exposure?: Record<string, RecordedExposure> | null;
    equipment_latest_exposures?: Record<string, RecordedExposure> | null;
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
  movement_definition_id?: number | null;
  movement_identity_contract?: number;
  movement?: string | null;
  movement_identity?: EquipmentIdentityLike | null;
  performed_movement_identity?: EquipmentIdentityLike | null;
  dev_accessory_intelligence?: {
    kind?: string | null;
  } | null;
};

export type EquipmentSelectionOperation =
  | 'configuration'
  | 'future_sets'
  | 'evidence_correction';

export function equipmentSelectionOperation({
  sessionStatus,
  plannedSetCount,
  loggedSetCount,
}: {
  sessionStatus?: string | null;
  plannedSetCount?: number | null;
  loggedSetCount?: number | null;
}): EquipmentSelectionOperation {
  const logged = Math.max(0, Number(loggedSetCount) || 0);
  const planned = Math.max(0, Number(plannedSetCount) || 0);
  if (logged === 0) return 'configuration';

  const status = String(sessionStatus || '').trim().toLowerCase();
  if (['completed', 'logged', 'done'].includes(status)) {
    return 'evidence_correction';
  }
  if (status === 'in_progress' && planned > 0 && logged >= planned) {
    return 'evidence_correction';
  }
  return 'future_sets';
}

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
  if (item.movement_definition_id || item.movement_identity_contract === 1) {
    const current = normalizeCurrentWorkoutItem(item);
    if (current.movement_identity?.optional_equipment_domains?.includes('machine')) {
      return isConfiguredMachineIdentity(current.performed_movement_identity);
    }
    return equipmentClassification(current.movement_identity as EquipmentIdentityLike | null) === 'machine';
  }
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

/** An optional machine setup does not force bodyweight/added-weight logging
 * through equipment selection. The selected setup owns load comparisons. */
export function canConfigureMachineEquipment(item: EquipmentAwareWorkoutItem | null | undefined): boolean {
  return Boolean(item && (normalizeCurrentWorkoutItem(item).movement_identity?.optional_equipment_domains?.includes('machine')
    || isMachineAccessoryItem(item)));
}

export function optionalMachineLoadIdentity(item: EquipmentAwareWorkoutItem | null | undefined): EquipmentIdentityLike | null {
  if (!item || !normalizeCurrentWorkoutItem(item).movement_identity?.optional_equipment_domains?.includes('machine')) return null;
  return activeEquipmentIdentity(item);
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
  // Current selection never outranks actual movement-specific performed use.
  void activeIdentityId;
  return [...choices].sort((left, right) => {
    const recencyDelta = equipmentRecency(right) - equipmentRecency(left);
    if (recencyDelta !== 0) return recencyDelta;
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

function equipmentRecency(identity: EquipmentIdentityLike, equipmentType?: string): number {
  const context = identity.equipment_context;
  const exposure = equipmentType ? context?.equipment_type_last_exposure?.[equipmentType] : context?.last_exposure;
  const used = Boolean(exposure) || (equipmentType
    ? equipmentTypeWasPreviouslyUsed(identity, equipmentType) : equipmentWasPreviouslyUsed(identity));
  if (!used) return 0;
  const date = exposure?.performed_at || exposure?.date || (equipmentType
    ? context?.equipment_type_last_used_at?.[equipmentType] : context?.last_used_at);
  const time = Date.parse(date || '');
  return Number.isFinite(time) ? time : 1;
}

export function orderEquipmentTypeChoices<T extends { key: string }>(choices: readonly T[], identity: EquipmentIdentityLike): T[] {
  return [...choices].sort((left, right) => equipmentRecency(identity, right.key) - equipmentRecency(identity, left.key)
    || left.key.localeCompare(right.key, 'en-US'));
}

export type RecentEquipmentChoice<T extends EquipmentIdentityLike> = Readonly<{
  manufacturer: T;
  equipmentType: 'plate_loaded' | 'selectorized';
  equipmentDefinitionId: number;
  exposure: RecordedExposure;
}>;

export type EquipmentLastSetDraft = Readonly<{
  equipmentDefinitionId: number;
  weightKg: number;
  reps: number;
  rir: number;
  date: string;
}>;

/** A draft may only come from a prior saved Set on the selected exact equipment. */
export function equipmentLastSetDraft(
  rows: readonly EquipmentIdentityLike[], equipmentDefinitionId: number,
  currentWorkoutId: number,
): EquipmentLastSetDraft | null {
  if (!Number.isInteger(equipmentDefinitionId) || equipmentDefinitionId <= 0) return null;
  for (const row of rows) {
    const record = row.equipment_context?.equipment_latest_exposures?.[String(equipmentDefinitionId)];
    const set = record?.last_set;
    if (!record || Number(record.equipment?.id) !== equipmentDefinitionId
      || Number(record.equipment?.manufacturer?.id) !== Number(row.manufacturer?.id)
      || Number(record.workout_id) <= 0 || Number(record.workout_id) === currentWorkoutId
      || !/^\d{4}-\d{2}-\d{2}/.test(record.date)
      || !set || typeof set.weight_kg !== 'number' || !Number.isFinite(set.weight_kg) || set.weight_kg < 0
      || typeof set.reps !== 'number' || !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 30
      || typeof set.rir !== 'number' || !Number.isFinite(set.rir) || set.rir < 0 || set.rir > 5
      || set.rir * 2 !== Math.round(set.rir * 2)) continue;
    return { equipmentDefinitionId, weightKg: set.weight_kg, reps: set.reps,
      rir: set.rir, date: record.date };
  }
  return null;
}

function recordedEquipmentType(record: RecordedExposure): 'plate_loaded' | 'selectorized' | null {
  const equipment = record.equipment;
  const implementation = String(equipment?.implementation_key || '');
  const type = String(equipment?.equipment_type || '');
  if (implementation.endsWith(':plate_loaded') || type === 'plate_loaded_machine') return 'plate_loaded';
  if (implementation.endsWith(':selectorized') || type === 'selectorized_machine') return 'selectorized';
  return null;
}

/** The first selectable canonical equipment ID from this movement's History evidence. */
export function mostRecentEquipmentChoice<T extends EquipmentIdentityLike>(
  rows: readonly T[], allowedTypes: readonly ('plate_loaded' | 'selectorized')[],
): RecentEquipmentChoice<T> | null {
  const candidates = rows.flatMap((manufacturer) => Object.values(
    manufacturer.equipment_context?.equipment_latest_exposures || {},
  ).flatMap((exposure) => {
    const equipmentType = recordedEquipmentType(exposure);
    const equipmentDefinitionId = Number(exposure.equipment?.id);
    if (!equipmentType || !allowedTypes.includes(equipmentType)
        || !Number.isInteger(equipmentDefinitionId) || equipmentDefinitionId <= 0
        || exposure.equipment?.manufacturer?.id !== manufacturer.manufacturer?.id
        || !exposureFromHistoryRecord(exposure)) return [];
    return [{ manufacturer, equipmentType, equipmentDefinitionId, exposure }];
  }));
  candidates.sort((left, right) => (Date.parse(right.exposure.performed_at || right.exposure.date) || 0)
    - (Date.parse(left.exposure.performed_at || left.exposure.date) || 0)
    || right.exposure.workout_id - left.exposure.workout_id
    || right.equipmentDefinitionId - left.equipmentDefinitionId);
  return candidates[0] || null;
}

export type EquipmentHistoryPresentation = Readonly<{ performance?: string; detail: string; status: string }>;

export function presentEquipmentHistory(identity: EquipmentIdentityLike, unit: 'kg' | 'lb', current: boolean,
  equipmentType?: string, semantics?: PerformedLoadSemantics): EquipmentHistoryPresentation {
  const context = identity.equipment_context;
  const record = equipmentType ? context?.equipment_type_last_exposure?.[equipmentType] : context?.last_exposure;
  const content = presentSessionExposure(record ? exposureFromHistoryRecord(record) : null, unit, 'accessory', semantics);
  const equipmentDetail = record?.equipment?.equipment_model?.display_name || (!equipmentType && record?.equipment?.equipment_type
    ? equipmentPresentationLabel(record.equipment.equipment_type, 'Machine') : null);
  if (content) return { performance: [content.performance, content.effort].filter(Boolean).join(' '),
    detail: [`Last used ${content.date}`, equipmentDetail].filter(Boolean).join(' · '), status: current ? 'CURRENT' : '' };
  const used = equipmentType ? equipmentTypeWasPreviouslyUsed(identity, equipmentType) : equipmentWasPreviouslyUsed(identity);
  return { detail: used ? 'Previous performance unavailable' : 'Not used for this movement', status: current ? 'CURRENT' : '' };
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
