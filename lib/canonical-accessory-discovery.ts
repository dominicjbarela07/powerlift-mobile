import { equipmentPresentationLabel } from '@/lib/equipment-presentation';
import type { AccessoryRegionalArtworkKey } from '@/lib/accessory-muscle-region-assets';

export const ACCESSORY_MUSCLE_GROUPS = [
  ['chest', 'Chest'],
  ['front_delts', 'Front Delts'],
  ['side_delts', 'Side Delts'],
  ['rear_delts', 'Rear Delts'],
  ['lats', 'Lats'],
  ['upper_back', 'Upper Back'],
  ['traps', 'Traps'],
  ['biceps', 'Biceps'],
  ['triceps', 'Triceps'],
  ['forearms', 'Forearms'],
  ['quads', 'Quads'],
  ['hamstrings', 'Hamstrings'],
  ['glutes', 'Glutes'],
  ['adductors', 'Adductors'],
  ['abductors', 'Abductors'],
  ['calves', 'Calves'],
  ['abs', 'Abs'],
  ['obliques', 'Obliques'],
  ['lower_back', 'Lower Back'],
  ['serratus', 'Serratus'],
  ['hip_flexors', 'Hip Flexors'],
  ['neck', 'Neck'],
] as const;

export const ACCESSORY_EXECUTION_FAMILIES = [
  ['FREE_WEIGHT', 'Free Weight'],
  ['MACHINE', 'Machine'],
  ['CABLE', 'Cable'],
  ['BODYWEIGHT', 'Bodyweight'],
  ['BAND', 'Band'],
  ['OTHER_PORTABLE', 'Other Portable'],
] as const;

export type AccessoryExecutionFamilyKey = (typeof ACCESSORY_EXECUTION_FAMILIES)[number][0];

const SWAP_EQUIPMENT_TYPE_FILTER_ORDER: readonly AccessoryExecutionFamilyKey[] = [
  'FREE_WEIGHT',
  'MACHINE',
  'CABLE',
  'BAND',
  'BODYWEIGHT',
  'OTHER_PORTABLE',
];

export const SWAP_EQUIPMENT_TYPE_FILTERS = SWAP_EQUIPMENT_TYPE_FILTER_ORDER.map((key) => ({
  key,
  label: key === 'OTHER_PORTABLE'
    ? 'Other'
    : ACCESSORY_EXECUTION_FAMILIES.find(([familyKey]) => familyKey === key)?.[1] || key,
}));

export type AccessoryExecutionFamilyFacet = Readonly<{
  key?: string | null;
  count?: number | null;
}>;

export function governedAccessoryExecutionFamilyKey(value?: string | null): AccessoryExecutionFamilyKey | null {
  const normalized = String(value || '').trim().toUpperCase();
  return ACCESSORY_EXECUTION_FAMILIES.some(([key]) => key === normalized)
    ? normalized as AccessoryExecutionFamilyKey
    : null;
}

/**
 * Keeps Swap equipment chips on governed definition metadata. Server facets
 * cover the complete muscle result set; row fallback preserves compatibility
 * with an older additive API response without inspecting movement names.
 */
export function availableSwapEquipmentTypeFilters(
  facets?: readonly AccessoryExecutionFamilyFacet[] | null,
  fallbackItems: readonly AccessoryDiscoveryIdentity[] = [],
) {
  const available = new Set<AccessoryExecutionFamilyKey>();
  if (facets?.length) {
    facets.forEach((facet) => {
      const key = governedAccessoryExecutionFamilyKey(facet.key);
      if (key && Number(facet.count || 0) > 0) available.add(key);
    });
  } else {
    fallbackItems.forEach((item) => {
      const key = governedAccessoryExecutionFamilyKey(item.execution_family);
      if (key) available.add(key);
    });
  }
  return SWAP_EQUIPMENT_TYPE_FILTERS.filter(({ key }) => available.has(key));
}

export type AccessoryPickerRegion = Readonly<{
  key: string;
  label: string;
  artwork: AccessoryRegionalArtworkKey;
  muscles: readonly string[];
}>;

export const ACCESSORY_PICKER_REGIONS = [
  { key: 'chest', label: 'Chest', artwork: 'chest', muscles: ['chest', 'serratus'] },
  { key: 'back', label: 'Back', artwork: 'back_region', muscles: ['lats', 'upper_back', 'traps', 'lower_back'] },
  { key: 'shoulders', label: 'Shoulders', artwork: 'side_delts', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { key: 'arms', label: 'Arms', artwork: 'arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'legs', label: 'Legs', artwork: 'quads', muscles: ['quads', 'hamstrings', 'adductors', 'abductors', 'calves'] },
  { key: 'glutes_hips', label: 'Glutes / Hips', artwork: 'glutes', muscles: ['glutes', 'hip_flexors'] },
  { key: 'core', label: 'Core', artwork: 'core', muscles: ['abs', 'obliques'] },
  { key: 'other', label: 'Other', artwork: 'neck', muscles: ['neck'] },
] as const satisfies readonly AccessoryPickerRegion[];

export function accessoryTaxonomyLabel(value?: string | null) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const muscle = ACCESSORY_MUSCLE_GROUPS.find(([key]) => key === normalized.toLowerCase());
  if (muscle) return muscle[1];
  const execution = ACCESSORY_EXECUTION_FAMILIES.find(([key]) => key === normalized.toUpperCase());
  if (execution) return execution[1];
  return equipmentPresentationLabel(normalized, normalized);
}

export type AccessoryDiscoveryIdentity = {
  id: number;
  display_name: string;
  family?: string | null;
  family_display_name?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: string[] | null;
  execution_family?: string | null;
  requires_equipment_configuration?: boolean | null;
};

export type SimilarAccessoryCandidate<T extends AccessoryDiscoveryIdentity> = {
  identity: T;
  reason: string;
  score: number;
};

const normalized = (value?: string | null) => String(value || '').trim().toLowerCase();

/** Rank only governed taxonomy signals; display-name similarity is deliberately excluded. */
export function rankSimilarAccessoryMovements<T extends AccessoryDiscoveryIdentity>(
  current: AccessoryDiscoveryIdentity,
  candidates: readonly T[],
  limit = 4,
): SimilarAccessoryCandidate<T>[] {
  const currentId = Number(current.id);
  const primary = normalized(current.primary_muscle_group);
  const execution = normalized(current.execution_family);
  const family = normalized(current.family);
  const secondary = new Set((current.secondary_muscle_groups || []).map(normalized).filter(Boolean));

  return candidates
    .filter((candidate) => Number(candidate.id) !== currentId)
    .map((candidate) => {
      const candidatePrimary = normalized(candidate.primary_muscle_group);
      const candidateExecution = normalized(candidate.execution_family);
      const candidateFamily = normalized(candidate.family);
      const candidateSecondary = (candidate.secondary_muscle_groups || []).map(normalized).filter(Boolean);
      const samePrimary = Boolean(primary && candidatePrimary === primary);
      const sameExecution = Boolean(execution && candidateExecution === execution);
      const sameFamily = Boolean(family && candidateFamily === family);
      const sharedSecondary = candidateSecondary.some((muscle) => secondary.has(muscle));
      const relatedPrimary = Boolean(candidatePrimary && secondary.has(candidatePrimary));
      const sameEquipmentRequirement = current.requires_equipment_configuration === candidate.requires_equipment_configuration;
      const score = (samePrimary ? 100 : 0)
        + (sameExecution ? 18 : 0)
        + (sameFamily ? 14 : 0)
        + (sharedSecondary ? 8 : 0)
        + (relatedPrimary ? 6 : 0)
        + (sameEquipmentRequirement ? 2 : 0);
      let reason = '';
      if (samePrimary && sameExecution) {
        reason = `Same primary emphasis · ${accessoryTaxonomyLabel(candidate.execution_family)} alternative`;
      } else if (samePrimary) {
        reason = 'Same primary emphasis';
      } else if (sameFamily) {
        reason = `Similar ${accessoryTaxonomyLabel(candidate.family) || 'movement-family'} emphasis`;
      } else if (relatedPrimary) {
        reason = `Related ${accessoryTaxonomyLabel(candidate.primary_muscle_group)} emphasis`;
      } else if (sharedSecondary) {
        reason = 'Shared secondary-muscle emphasis';
      }
      return { identity: candidate, reason, score };
    })
    .filter((candidate) => candidate.score >= 8 && candidate.reason)
    .sort((left, right) => right.score - left.score || left.identity.display_name.localeCompare(right.identity.display_name))
    .slice(0, Math.max(0, limit));
}
