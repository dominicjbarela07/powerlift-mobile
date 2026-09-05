import type { LoggerProgressEvidence } from '@/lib/logger-visual-context';
import type { EquipmentIdentityLike } from '@/lib/equipment-selection';
import {
  MANUFACTURER_REGISTRY,
  resolveManufacturerBrand,
} from '@/lib/manufacturer-registry';
import {
  MACHINE_EQUIPMENT_TYPES,
  machineEquipmentTypeForValue,
  type MachineEquipmentType,
} from '@/lib/machine-equipment';

export type WorkoutDetailFixtureScenario =
  | 'primary-squat'
  | 'bench-rep-max'
  | 'deadlift-prior-session'
  | 'accessory-minimal'
  | 'coach-photo-fallback'
  | 'no-progress-context'
  | 'completed-recap-v2'
  | 'final-session-completion';

export type WorkoutDetailLifecycle =
  | 'pre_session'
  | 'active_session'
  | 'post_session';

export const CANONICAL_LOGGER_ENTRY_LIFECYCLES: Readonly<
  Record<string, WorkoutDetailLifecycle>
> = Object.freeze({
  'canonical-logger-pre-session': 'pre_session',
  'canonical-logger-active-session': 'active_session',
  'canonical-logger-final-session-completion': 'active_session',
  'canonical-logger-post-session': 'post_session',
});

export function workoutDetailLifecycleForEntryId(
  entryId: string | null | undefined,
): WorkoutDetailLifecycle | null {
  return CANONICAL_LOGGER_ENTRY_LIFECYCLES[String(entryId || '')] || null;
}

export function normalizeWorkoutDetailLifecycle(
  value: string | null | undefined,
): WorkoutDetailLifecycle | null {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'pre' || normalized === 'pre_session') return 'pre_session';
  if (normalized === 'active' || normalized === 'active_session') return 'active_session';
  if (normalized === 'post' || normalized === 'post_session') return 'post_session';
  return null;
}

export const WORKOUT_DETAIL_FIXTURE_SCENARIOS: readonly WorkoutDetailFixtureScenario[] = [
  'primary-squat',
  'bench-rep-max',
  'deadlift-prior-session',
  'accessory-minimal',
  'coach-photo-fallback',
  'no-progress-context',
  'completed-recap-v2',
  'final-session-completion',
];

export const CANONICAL_LOGGER_VISUAL_COVERAGE = {
  coreSchemes: [
    'top-set-backoffs',
    'top-1-backdown-2',
    'top-2-backdown-3',
    'top-3-backdown-1',
    'straight-sets',
    'full-custom',
    'percentage',
    'rpe',
    'manual-weight',
  ],
  coreIdentities: ['primary-squat', 'primary-bench', 'primary-deadlift', 'core-variant'],
  accessoryFamilies: [
    'dumbbell',
    'barbell',
    'plate-loaded-machine',
    'selectorized-machine',
    'cable',
    'bodyweight',
    'weighted-bodyweight',
    'assisted-bodyweight',
    'custom-equipment',
  ],
  prescriptions: [
    'fixed-reps',
    'rep-range',
    'rir',
    'amrap',
    'timed',
    'distance',
    'unilateral',
    'bilateral',
    'alternating',
    'superset',
  ],
  completionStates: ['not-started', 'in-progress', 'completed'],
  historyStates: ['rich-history', 'minimal-history', 'first-time', 'recent-pr', 'no-history'],
  edgeCases: ['long-name', 'long-equipment-name', 'long-note', 'different-set-counts'],
} as const;

const LB_225_KG = 102.05828325;
const LB_220_KG = 99.7903214;
const LB_395_KG = 179.1680946;
const LB_405_KG = 183.70487985;
const LB_495_KG = 224.52833925;
const KG_PER_LB = 0.45359237;

type FixtureIdentity = {
  id: number;
  key: string;
  display_name: string;
  family_id?: number | null;
  family_display_name?: string | null;
  identity_specificity: 'broad' | 'exact' | 'unknown';
  equipment_type: string;
  loading_implementation?: string | null;
  load_convention?: string | null;
  measurement_type?: string | null;
  sidedness?: string | null;
  implementation_key?: string | null;
  manufacturer: { id: number; key: string; display_name: string } | null;
  equipment_model?: { id: number; key: string; display_name: string } | null;
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
  comparison_policy: {
    confidence: string;
    comparison_scope: string;
    recognition_enabled: false;
  };
};

type MachineEvidence = {
  identity: FixtureIdentity;
  last: {
    weightLb: number;
    reps: number;
    rir: number;
    date: string;
  } | null;
  best: {
    weightLb: number;
    reps: number;
    rir: number;
    date: string;
  } | null;
  suggestedWeightLb: number | null;
};

const INCLINE_PRESS_FAMILY_ID = 991100;
export type WorkoutDetailEquipmentVariant = MachineEquipmentType;
export const WORKOUT_DETAIL_EQUIPMENT_VARIANTS = MACHINE_EQUIPMENT_TYPES;

function deterministicFixtureIdentityId(key: string): number {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash * 31) + key.charCodeAt(index)) >>> 0;
  }
  return 800_000_000 + (hash % 100_000_000);
}

function variantKeyForEquipmentType(
  equipmentType: string | null | undefined,
): WorkoutDetailEquipmentVariant {
  return machineEquipmentTypeForValue(equipmentType);
}

export function workoutDetailEquipmentIdentityKey(
  identity: Pick<
    EquipmentIdentityLike,
    'manufacturer' | 'equipment_type' | 'equipment_context'
  >,
): string {
  const other = identity.equipment_context?.option_kind === 'other'
    || !identity.manufacturer?.key;
  const resolvedManufacturer = resolveManufacturerBrand(
    identity.manufacturer?.display_name || identity.manufacturer?.key,
  );
  const manufacturerKey = other
    ? 'other'
    : resolvedManufacturer.key || identity.manufacturer!.key;
  return `machine-equipment:${manufacturerKey}:${variantKeyForEquipmentType(identity.equipment_type)}`;
}

const machineIdentity = ({
  brand,
  equipmentType,
  rememberedStatus = null,
  usageStatus,
  lastUsedAt = null,
  usedEquipmentTypeKeys = [],
  equipmentTypeLastUsedAt = {},
  usedEquipmentDefinitionIds = [],
  optionKind = 'catalog',
}: {
  brand: string;
  equipmentType: string;
  rememberedStatus?: string | null;
  usageStatus?: 'used' | 'not_used';
  lastUsedAt?: string | null;
  usedEquipmentTypeKeys?: string[];
  equipmentTypeLastUsedAt?: Record<string, string | null>;
  usedEquipmentDefinitionIds?: number[];
  optionKind?: 'catalog' | 'other';
}): FixtureIdentity => {
  const other = optionKind === 'other' || brand === 'Other';
  const resolvedBrand = resolveManufacturerBrand(other ? null : brand);
  const manufacturerKey = other
    ? 'other'
    : resolvedBrand.key || String(brand).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const manufacturerName = other ? 'Other' : resolvedBrand.displayName;
  const variant = variantKeyForEquipmentType(equipmentType);
  const canonicalType = WORKOUT_DETAIL_EQUIPMENT_VARIANTS.find(
    (candidate) => candidate.key === variant,
  )!.label;
  const key = `machine-equipment:${manufacturerKey}:${variant}`;
  return {
    id: deterministicFixtureIdentityId(key),
    key,
    display_name: `${manufacturerName} · ${canonicalType}`,
    family_id: null,
    family_display_name: null,
    identity_specificity: 'exact',
    equipment_type: canonicalType,
    loading_implementation: variant === 'plate_loaded'
      ? 'plate_loaded_machine'
      : 'selectorized_machine',
    load_convention: variant === 'plate_loaded'
      ? 'plate_total'
      : 'machine_stack_display',
    measurement_type: 'load_reps',
    sidedness: 'bilateral',
    implementation_key: key,
    manufacturer: other
      ? null
      : {
          id: deterministicFixtureIdentityId(`manufacturer:${manufacturerKey}`),
          key: manufacturerKey,
          display_name: manufacturerName,
        },
    equipment_model: null,
    material_parameters: null,
    equipment_context: {
      remembered_status: rememberedStatus,
      usage_status: usageStatus || (lastUsedAt ? 'used' : 'not_used'),
      is_current: rememberedStatus === 'current',
      last_used_at: lastUsedAt,
      used_equipment_type_keys: usedEquipmentTypeKeys,
      equipment_type_last_used_at: equipmentTypeLastUsedAt,
      used_equipment_definition_ids: usedEquipmentDefinitionIds,
      used_equipment_model_ids: [],
      option_kind: optionKind,
    },
    comparison_policy: {
      confidence: 'exact',
      comparison_scope: 'manufacturer_equipment_type',
      recognition_enabled: false,
    },
  };
};

function normalizedWorkoutDetailMachineIdentity(
  identity: EquipmentIdentityLike,
): FixtureIdentity {
  const other = identity.equipment_context?.option_kind === 'other'
    || !identity.manufacturer?.key;
  return machineIdentity({
    brand: other
      ? 'Other'
      : identity.manufacturer?.display_name || identity.manufacturer?.key || 'Other',
    equipmentType: variantKeyForEquipmentType(identity.equipment_type) === 'plate_loaded'
      ? 'Plate Loaded'
      : 'Selectorized',
    rememberedStatus: identity.equipment_context?.remembered_status || null,
    usageStatus: identity.equipment_context?.usage_status === 'used' ? 'used' : 'not_used',
    lastUsedAt: identity.equipment_context?.last_used_at || null,
    usedEquipmentTypeKeys: identity.equipment_context?.used_equipment_type_keys || [],
    equipmentTypeLastUsedAt: identity.equipment_context?.equipment_type_last_used_at || {},
    usedEquipmentDefinitionIds: identity.equipment_context?.used_equipment_definition_ids || [],
    optionKind: other ? 'other' : 'catalog',
  });
}

const MACHINE_EVIDENCE: readonly MachineEvidence[] = [
  {
    identity: machineIdentity({
      brand: 'Hammer Strength',
      equipmentType: 'Plate Loaded',
      rememberedStatus: 'Used before',
      lastUsedAt: '2026-06-18',
    }),
    last: { weightLb: 210, reps: 10, rir: 2, date: '2026-06-18' },
    best: { weightLb: 220, reps: 8, rir: 1, date: '2026-06-02' },
    suggestedWeightLb: 215,
  },
  {
    identity: machineIdentity({
      brand: 'Prime Fitness',
      equipmentType: 'Selectorized',
      rememberedStatus: 'Used before',
      lastUsedAt: '2026-05-29',
    }),
    last: { weightLb: 180, reps: 12, rir: 2, date: '2026-05-29' },
    best: { weightLb: 190, reps: 9, rir: 1, date: '2026-05-08' },
    suggestedWeightLb: 185,
  },
  {
    identity: machineIdentity({
      brand: 'Arsenal Strength',
      equipmentType: 'Plate Loaded',
      rememberedStatus: 'Used before',
      lastUsedAt: '2026-04-12',
    }),
    last: { weightLb: 205, reps: 9, rir: 1, date: '2026-04-12' },
    best: { weightLb: 205, reps: 9, rir: 1, date: '2026-04-12' },
    suggestedWeightLb: 210,
  },
  {
    identity: machineIdentity({
      brand: 'Technogym',
      equipmentType: 'Selectorized',
      rememberedStatus: 'Used before',
      lastUsedAt: '2026-03-08',
    }),
    last: { weightLb: 75, reps: 11, rir: 2, date: '2026-03-08' },
    best: { weightLb: 80, reps: 8, rir: 1, date: '2026-02-17' },
    suggestedWeightLb: 80,
  },
  {
    identity: machineIdentity({
      brand: 'Other',
      equipmentType: 'Plate Loaded',
      optionKind: 'other',
    }),
    last: null,
    best: null,
    suggestedWeightLb: null,
  },
] as const;

const broadInclinePressIdentity: FixtureIdentity = {
  id: INCLINE_PRESS_FAMILY_ID,
  key: 'incline-chest-press',
  display_name: 'Incline Chest Press',
  family_id: INCLINE_PRESS_FAMILY_ID,
  family_display_name: 'Incline Chest Press',
  identity_specificity: 'broad',
  equipment_type: 'Machine',
  manufacturer: null,
  comparison_policy: {
    confidence: 'broad',
    comparison_scope: 'family',
    recognition_enabled: false,
  },
};

function historySet(
  value: MachineEvidence['last'] | MachineEvidence['best'],
  itemId = 990022,
  movement = 'Incline Chest Press',
) {
  if (!value) return null;
  return {
    weight_kg: value.weightLb * KG_PER_LB,
    reps: value.reps,
    rir: value.rir,
    date: value.date,
    workout_id: 989920,
    item_id: itemId,
    movement,
    set_index: 3,
  };
}

function machineHistory(selected: MachineEvidence, item: Record<string, any>) {
  const movement = String(item.movement || 'Machine accessory');
  const recent = historySet(selected.last, Number(item.id), movement);
  const best = historySet(selected.best, Number(item.id), movement);
  const selectedEquipmentKey = workoutDetailEquipmentIdentityKey(selected.identity);
  return {
    canonical_key: selected.identity.key,
    movement_pattern: movement.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    loading_behavior: 'normal',
    most_recent_logged_set: recent,
    best_logged_set: best,
    recent_sets: recent ? [recent] : [],
    recent_sessions: recent ? [recent] : [],
    identity_scope: 'exact_identity',
    movement_definition_id: selected.identity.id,
    related_reference_history: MACHINE_EVIDENCE
      .filter((row) => (
        workoutDetailEquipmentIdentityKey(row.identity) !== selectedEquipmentKey
        && row.last
      ))
      .map((row) => ({
        movement_definition_id: row.identity.id,
        display_name: row.identity.display_name,
        manufacturer: row.identity.manufacturer?.display_name || null,
        equipment_type: row.identity.equipment_type,
        implementation_key: row.identity.key,
        last_performed_on: row.last?.date || null,
        last_set: historySet(row.last, Number(item.id), movement),
        has_history: true,
        reference_only: true as const,
        loads_comparable: false as const,
      })),
  };
}

function emptyMachineHistory(
  identity: EquipmentIdentityLike,
  item: Record<string, any>,
) {
  const movement = String(item.movement || 'Machine accessory');
  return {
    canonical_key: identity.key,
    movement_pattern: movement.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, ''),
    loading_behavior: 'normal',
    most_recent_logged_set: null,
    best_logged_set: null,
    recent_sets: [],
    recent_sessions: [],
    identity_scope: 'exact_identity',
    movement_definition_id: identity.id,
    related_reference_history: [],
  };
}

const REGISTRY_MACHINE_IDENTITIES: readonly FixtureIdentity[] =
  MANUFACTURER_REGISTRY.flatMap((manufacturer) => (
    WORKOUT_DETAIL_EQUIPMENT_VARIANTS.map((variant) => {
      const existingEvidence = MACHINE_EVIDENCE.find((row) => (
        workoutDetailEquipmentIdentityKey(row.identity)
          === `machine-equipment:${manufacturer.key}:${variant.key}`
      ));
      return existingEvidence?.identity || machineIdentity({
        brand: manufacturer.displayName,
        equipmentType: variant.label,
      });
    })
  ));

const OTHER_MACHINE_IDENTITIES: readonly FixtureIdentity[] =
  WORKOUT_DETAIL_EQUIPMENT_VARIANTS.map((variant) => {
    const existing = MACHINE_EVIDENCE.find((row) => (
      row.identity.equipment_context?.option_kind === 'other'
      && variantKeyForEquipmentType(row.identity.equipment_type) === variant.key
    ));
    return existing?.identity || machineIdentity({
      brand: 'Other',
      equipmentType: variant.label,
      optionKind: 'other',
    });
  });

export const WORKOUT_DETAIL_MACHINE_IDENTITIES: readonly FixtureIdentity[] = [
  ...REGISTRY_MACHINE_IDENTITIES,
  ...OTHER_MACHINE_IDENTITIES,
];

export function workoutDetailMachineIdentityChoices(
  query = '',
  _familyId?: number | null,
  familyDisplayName?: string | null,
  movementDefinitionId?: number | null,
) {
  const needle = query.trim().toLowerCase();
  const unscopedManufacturerChoices = [
    ...MANUFACTURER_REGISTRY.map((manufacturer) => (
      REGISTRY_MACHINE_IDENTITIES.find((identity) => (
        identity.manufacturer?.key === manufacturer.key
        && Boolean(identity.equipment_context?.last_used_at)
      ))
      || REGISTRY_MACHINE_IDENTITIES.find(
        (identity) => identity.manufacturer?.key === manufacturer.key,
      )
    )).filter(Boolean),
    OTHER_MACHINE_IDENTITIES[0],
  ] as FixtureIdentity[];
  const manufacturerChoices = unscopedManufacturerChoices.map((identity) => {
    const manufacturerKey = identity.manufacturer?.key || 'other';
    const evidence = Number(movementDefinitionId) === INCLINE_PRESS_FAMILY_ID
      ? MACHINE_EVIDENCE.filter((row) => (
          (row.identity.manufacturer?.key || 'other') === manufacturerKey
          && Boolean(row.last)
        ))
      : [];
    const typeLastUsedAt = Object.fromEntries(evidence.map((row) => [
      variantKeyForEquipmentType(row.identity.equipment_type),
      row.last?.date || null,
    ]));
    const lastUsedAt = evidence
      .map((row) => row.last?.date || '')
      .filter(Boolean)
      .sort()
      .at(-1) || null;
    return {
      ...identity,
      equipment_context: {
        ...identity.equipment_context,
        remembered_status: evidence.length ? 'used_before' : 'never_used',
        usage_status: evidence.length ? 'used' : 'not_used',
        is_current: false,
        last_used_at: lastUsedAt,
        used_equipment_type_keys: Object.keys(typeLastUsedAt).sort(),
        equipment_type_last_used_at: typeLastUsedAt,
        used_equipment_definition_ids: evidence.map((row) => row.identity.id).sort(),
        used_equipment_model_ids: [],
      },
    } as FixtureIdentity;
  });
  return manufacturerChoices
    .filter((identity) => {
      if (!needle) return true;
      return [
        identity.manufacturer?.display_name,
        familyDisplayName,
        identity.display_name,
      ].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
}

export function workoutDetailMachineVariantIdentity(
  manufacturerChoice: EquipmentIdentityLike,
  variant: WorkoutDetailEquipmentVariant,
): FixtureIdentity | null {
  const other = manufacturerChoice.equipment_context?.option_kind === 'other';
  const manufacturerKey = manufacturerChoice.manufacturer?.key || null;
  const baseIdentity = WORKOUT_DETAIL_MACHINE_IDENTITIES.find((identity) => (
    variantKeyForEquipmentType(identity.equipment_type) === variant
    && (
      other
        ? identity.equipment_context?.option_kind === 'other'
        : identity.manufacturer?.key === manufacturerKey
    )
  )) || null;
  if (!baseIdentity) return null;
  return {
    ...baseIdentity,
    equipment_context: {
      ...baseIdentity.equipment_context,
      ...manufacturerChoice.equipment_context,
    },
  };
}

export function applyWorkoutDetailMachineIdentity(
  item: Record<string, any>,
  identityId: number | null,
  selectedIdentity?: EquipmentIdentityLike | null,
) {
  if (identityId == null) {
    return {
      ...item,
      performed_movement_identity: null,
      lookback_best: null,
      movement_history: null,
      target_low_kg: null,
      target_high_kg: null,
      dev_accessory_intelligence: {
        ...item.dev_accessory_intelligence,
        recommendation_kind: 'starting_point',
        recommendation_weight_kg: null,
        recommendation_delta_kg: null,
      },
    };
  }
  const rawIdentity = (selectedIdentity || WORKOUT_DETAIL_MACHINE_IDENTITIES.find(
    (candidate) => Number(candidate.id) === Number(identityId),
  )) as FixtureIdentity | undefined;
  if (!rawIdentity) return item;
  const identity = normalizedWorkoutDetailMachineIdentity(rawIdentity);
  const sameMovementFamily = Number(item.movement_identity?.family_id)
    === INCLINE_PRESS_FAMILY_ID;
  const equipmentKey = workoutDetailEquipmentIdentityKey(identity);
  const recordedEvidence = sameMovementFamily
    ? MACHINE_EVIDENCE.find(
        (row) => workoutDetailEquipmentIdentityKey(row.identity) === equipmentKey,
      )
    : undefined;
  const evidence = recordedEvidence
    ? { ...recordedEvidence, identity }
    : {
        identity,
        last: null,
        best: null,
        suggestedWeightLb: null,
      };
  const previous = historySet(
    evidence.last,
    Number(item.id),
    String(item.movement || 'Machine accessory'),
  );
  const targetKg = evidence.suggestedWeightLb == null
    ? null
    : evidence.suggestedWeightLb * KG_PER_LB;
  return {
    ...item,
    performed_movement_identity: evidence.identity,
    lookback_best: previous
      ? {
          workout_id: previous.workout_id,
          date: previous.date,
          actual_weight_kg: previous.weight_kg,
          actual_reps: previous.reps,
          actual_rir: previous.rir,
        }
      : null,
    movement_history: recordedEvidence
      ? machineHistory(evidence, item)
      : emptyMachineHistory(identity, item),
    target_low_kg: null,
    target_high_kg: null,
    dev_accessory_intelligence: {
      kind: 'machine',
      previous_label: 'Last on this machine',
      recommendation_label: 'Concept next set',
      recommendation_kind: 'starting_point',
      recommendation_weight_kg: targetKg,
      recommendation_delta_kg: null,
    },
  };
}

type RememberedEquipmentSelection =
  | { kind: 'clear' }
  | { kind: 'identity'; identity: EquipmentIdentityLike };

const REMEMBERED_DEV_EQUIPMENT = new Map<string, RememberedEquipmentSelection>();

function rememberedEquipmentKey(workoutId: number | string, itemId: number | string) {
  return `${workoutId}:${itemId}`;
}

export function rememberWorkoutDetailEquipmentSelection(
  workoutId: number | string,
  itemId: number | string,
  identity: EquipmentIdentityLike | null,
) {
  REMEMBERED_DEV_EQUIPMENT.set(
    rememberedEquipmentKey(workoutId, itemId),
    identity ? { kind: 'identity', identity } : { kind: 'clear' },
  );
}

export function hydrateWorkoutDetailEquipmentSelections<T extends Record<string, any>>(
  payload: T,
): T {
  const workoutId = payload.workout?.id;
  if (workoutId == null) return payload;
  let changed = false;
  const accessoryGroups = (payload.workout?.accessory_groups || []).map((group: Record<string, any>) => ({
    ...group,
    items: (group.items || []).map((item: Record<string, any>) => {
      const key = rememberedEquipmentKey(workoutId, item.id);
      if (!REMEMBERED_DEV_EQUIPMENT.has(key)) return item;
      changed = true;
      const remembered = REMEMBERED_DEV_EQUIPMENT.get(key);
      if (!remembered || remembered.kind === 'clear') {
        return applyWorkoutDetailMachineIdentity(item, null);
      }
      return applyWorkoutDetailMachineIdentity(
        item,
        Number(remembered.identity.id),
        remembered.identity,
      );
    }),
  }));
  if (!changed) return payload;
  return {
    ...payload,
    workout: {
      ...payload.workout,
      accessory_groups: accessoryGroups,
    },
  };
}

export function resetRememberedWorkoutDetailEquipmentSelections() {
  REMEMBERED_DEV_EQUIPMENT.clear();
}

function coreItem({
  id,
  lift,
  movement,
  designation,
  sets,
  reps,
  rpe,
  weightKg,
  note,
  lookback,
  progressContext,
  variant = 'STRAIGHT',
  scheme = variant,
  mode = 'RPE',
  pct = null,
  plannedSets = [],
  setLogs = [],
  parentItemId = null,
  coverageTags = [],
}: {
  id: number;
  lift: 'SQ' | 'BN' | 'DL';
  movement: string;
  designation: string;
  sets: number;
  reps: number;
  rpe: number | null;
  weightKg: number | null;
  note: string | null;
  lookback: Record<string, unknown> | null;
  progressContext: LoggerProgressEvidence | null;
  variant?: 'STRAIGHT' | 'VR' | 'TOP' | 'BK' | 'FULL_CUSTOM';
  scheme?: string | null;
  mode?: 'RPE' | 'PCT';
  pct?: number | null;
  plannedSets?: Record<string, unknown>[];
  setLogs?: Record<string, unknown>[];
  parentItemId?: number | null;
  coverageTags?: string[];
}) {
  return {
    id,
    lift,
    designation,
    variant,
    scheme,
    planned_sets: plannedSets,
    movement,
    original_movement: movement,
    is_substituted: false,
    selected_sub_movement: null,
    approved_subs: [],
    sets,
    reps,
    reps_text: String(reps),
    mode,
    rpe_target: rpe,
    pct,
    rir_target: null,
    target_low_kg: weightKg,
    target_high_kg: weightKg,
    baseline_low_kg: weightKg,
    baseline_high_kg: weightKg,
    actual_weight_kg: null,
    actual_reps: null,
    actual_rpe: null,
    notes: note,
    progress_context: progressContext,
    superset_group: null,
    superset_pos: null,
    set_logs: setLogs,
    lookback_best: lookback,
    movement_identity: null,
    performed_movement_identity: null,
    parent_item_id: parentItemId,
    dev_core_family: variant === 'VR'
      ? lift === 'SQ'
        ? 'squat'
        : lift === 'BN'
          ? 'bench'
          : 'deadlift'
      : null,
    dev_visual_coverage: coverageTags,
  };
}

function fixtureSetLog({
  id,
  setIndex,
  weightLb,
  reps,
  rpe = null,
  rir = null,
}: {
  id: number;
  setIndex: number;
  weightLb: number;
  reps: number;
  rpe?: number | null;
  rir?: number | null;
}) {
  return {
    id,
    set_index: setIndex,
    actual_weight_kg: weightLb * KG_PER_LB,
    actual_reps: reps,
    actual_rpe: rpe,
    actual_rir: rir,
  };
}

function plannedSet({
  setIndex,
  reps,
  rpe = null,
  pct = null,
  manualWeightLb = null,
  manualRangeLb = null,
}: {
  setIndex: number;
  reps: number;
  rpe?: number | null;
  pct?: number | null;
  manualWeightLb?: number | null;
  manualRangeLb?: number | null;
}) {
  return {
    set_index: setIndex,
    reps,
    rpe_target: rpe,
    pct,
    manual_target_kg: manualWeightLb == null ? null : manualWeightLb * KG_PER_LB,
    manual_pm_kg: manualRangeLb == null ? null : manualRangeLb * KG_PER_LB,
    suggested_low_kg: null,
    suggested_high_kg: null,
  };
}

function canonicalCoreItems() {
  const squatTopId = 990101;
  const squatTop = coreItem({
    id: squatTopId,
    lift: 'SQ',
    movement: 'Competition Squat',
    designation: 'Primary',
    variant: 'TOP',
    scheme: 'TOP_BACKDOWN',
    sets: 1,
    reps: 1,
    rpe: 8,
    weightKg: LB_405_KG,
    note: 'Stay patient out of the hole.',
    lookback: {
      workout_id: 989901,
      date: '2026-07-17',
      actual_weight_kg: LB_395_KG,
      actual_reps: 1,
      actual_rpe: 8,
    },
    progressContext: {
      kind: 'weight_pr',
      qualification: 'qualified',
      targetWeightKg: LB_405_KG,
      previousWeightKg: LB_395_KG,
    },
    setLogs: [
      fixtureSetLog({
        id: 9901101,
        setIndex: 1,
        weightLb: 405,
        reps: 1,
        rpe: 8,
      }),
    ],
    coverageTags: ['core', 'top-set-backoffs', 'rpe', 'in-progress', 'recent-pr', 'rich-history'],
  });
  const squatBackoffs = coreItem({
    id: 990102,
    lift: 'SQ',
    movement: 'Competition Squat',
    designation: 'Backoff',
    variant: 'BK',
    scheme: 'BACKDOWNS',
    sets: 2,
    reps: 3,
    rpe: 7,
    weightKg: 365 * KG_PER_LB,
    note: null,
    lookback: null,
    progressContext: null,
    parentItemId: squatTopId,
    setLogs: [
      fixtureSetLog({
        id: 9901102,
        setIndex: 1,
        weightLb: 365,
        reps: 3,
        rpe: 7,
      }),
    ],
    coverageTags: ['core', 'backoff-child', 'top-1-backdown-2', 'rpe', 'in-progress'],
  });
  const benchTopId = 990108;
  const benchTop = coreItem({
    id: benchTopId,
    lift: 'BN',
    movement: 'Two-Count Paused Competition Bench Press',
    designation: 'Secondary',
    variant: 'TOP',
    scheme: 'TOP_BACKDOWN',
    sets: 2,
    reps: 2,
    rpe: 8,
    weightKg: 275 * KG_PER_LB,
    note: null,
    lookback: null,
    progressContext: null,
    coverageTags: [
      'core',
      'top-set-backoffs',
      'top-2-backdown-3',
      'rpe',
      'not-started',
      'no-history',
    ],
  });
  const benchBackoffs = coreItem({
    id: 990109,
    lift: 'BN',
    movement: 'Two-Count Paused Competition Bench Press',
    designation: 'Backoff',
    variant: 'BK',
    scheme: 'BACKDOWNS',
    sets: 3,
    reps: 5,
    rpe: 7,
    weightKg: 245 * KG_PER_LB,
    note: null,
    lookback: null,
    progressContext: null,
    parentItemId: benchTopId,
    coverageTags: ['core', 'backoff-child', 'top-2-backdown-3', 'rpe', 'not-started'],
  });
  const deadliftTopId = 990110;
  const deadliftTop = coreItem({
    id: deadliftTopId,
    lift: 'DL',
    movement: 'Competition Deadlift',
    designation: 'Secondary',
    variant: 'TOP',
    scheme: 'TOP_BACKDOWN',
    sets: 3,
    reps: 1,
    rpe: 8,
    weightKg: 495 * KG_PER_LB,
    note: null,
    lookback: null,
    progressContext: null,
    setLogs: [1, 2, 3].map((setIndex) => fixtureSetLog({
      id: 9901500 + setIndex,
      setIndex,
      weightLb: 495,
      reps: 1,
      rpe: 8,
    })),
    coverageTags: [
      'core',
      'top-set-backoffs',
      'top-3-backdown-1',
      'rpe',
      'completed',
      'minimal-history',
    ],
  });
  const deadliftBackoff = coreItem({
    id: 990111,
    lift: 'DL',
    movement: 'Competition Deadlift',
    designation: 'Backoff',
    variant: 'BK',
    scheme: 'BACKDOWNS',
    sets: 1,
    reps: 4,
    rpe: 7,
    weightKg: 405 * KG_PER_LB,
    note: null,
    lookback: null,
    progressContext: null,
    parentItemId: deadliftTopId,
    setLogs: [
      fixtureSetLog({
        id: 9901601,
        setIndex: 1,
        weightLb: 405,
        reps: 4,
        rpe: 7,
      }),
    ],
    coverageTags: ['core', 'backoff-child', 'top-3-backdown-1', 'rpe', 'completed'],
  });
  const benchPercentage = coreItem({
    id: 990103,
    lift: 'BN',
    movement: 'Competition Bench Press',
    designation: 'Primary',
    sets: 3,
    reps: 5,
    rpe: null,
    weightKg: 225 * KG_PER_LB,
    mode: 'PCT',
    pct: 75,
    note: 'Pause every rep on the chest without relaxing the upper back.',
    lookback: {
      workout_id: 989902,
      date: '2026-07-17',
      actual_weight_kg: LB_220_KG,
      actual_reps: 5,
      actual_rpe: 8,
    },
    progressContext: {
      kind: 'rep_max',
      qualification: 'qualified',
      targetWeightKg: LB_225_KG,
      previousWeightKg: LB_220_KG,
      reps: 5,
    },
    setLogs: [1, 2, 3].map((setIndex) => fixtureSetLog({
      id: 9901200 + setIndex,
      setIndex,
      weightLb: 225,
      reps: 5,
      rpe: 8,
    })),
    coverageTags: ['core', 'straight-sets', 'percentage', 'completed', 'minimal-history'],
  });
  const deadliftFullCustom = coreItem({
    id: 990104,
    lift: 'DL',
    movement: 'Competition Deadlift',
    designation: 'Primary',
    variant: 'FULL_CUSTOM',
    scheme: 'FULL_CUSTOM',
    sets: 4,
    reps: 1,
    rpe: 7,
    weightKg: 455 * KG_PER_LB,
    note: 'Treat the first two sets as technical primers. The final single is optional if bar speed degrades.',
    lookback: null,
    progressContext: null,
    plannedSets: [
      plannedSet({ setIndex: 1, reps: 3, rpe: 6, manualWeightLb: 405 }),
      plannedSet({ setIndex: 2, reps: 2, rpe: 7, manualWeightLb: 435 }),
      plannedSet({ setIndex: 3, reps: 1, rpe: 8, manualWeightLb: 465, manualRangeLb: 10 }),
      plannedSet({ setIndex: 4, reps: 1, rpe: 8.5, manualWeightLb: 475, manualRangeLb: 10 }),
    ],
    coverageTags: ['core', 'full-custom', 'manual-weight', 'rpe', 'not-started', 'no-history'],
  });
  const pauseSquat = coreItem({
    id: 990105,
    lift: 'SQ',
    movement: 'Three-Count Pause Squat from Competition Stance',
    designation: 'Variant',
    variant: 'VR',
    sets: 2,
    reps: 3,
    rpe: 7,
    weightKg: 315 * KG_PER_LB,
    note: null,
    lookback: null,
    progressContext: null,
    coverageTags: ['core-variant', 'pause', 'manual-weight', 'not-started', 'first-time', 'long-name'],
  });
  const closeGripBench = coreItem({
    id: 990106,
    lift: 'BN',
    movement: 'Close-Grip Bench Press',
    designation: 'Variant',
    variant: 'VR',
    sets: 4,
    reps: 6,
    rpe: 7.5,
    weightKg: 185 * KG_PER_LB,
    note: 'Keep the touch point consistent and let the elbows track naturally.',
    lookback: {
      workout_id: 989906,
      date: '2026-07-03',
      actual_weight_kg: 180 * KG_PER_LB,
      actual_reps: 6,
      actual_rpe: 8,
    },
    progressContext: {
      kind: 'prior_session',
      qualification: 'qualified',
      weightKg: 180 * KG_PER_LB,
      reps: 6,
      rpe: 8,
      date: '2026-07-03',
    },
    setLogs: [
      fixtureSetLog({
        id: 9901301,
        setIndex: 1,
        weightLb: 185,
        reps: 6,
        rpe: 7.5,
      }),
      fixtureSetLog({
        id: 9901302,
        setIndex: 2,
        weightLb: 185,
        reps: 6,
        rpe: 8,
      }),
    ],
    coverageTags: ['core-variant', 'close-grip', 'rpe', 'in-progress', 'rich-history'],
  });
  const deficitDeadlift = coreItem({
    id: 990107,
    lift: 'DL',
    movement: 'Two-Inch Deficit Deadlift',
    designation: 'Variant',
    variant: 'VR',
    sets: 3,
    reps: 4,
    rpe: null,
    weightKg: 365 * KG_PER_LB,
    mode: 'PCT',
    pct: 67.5,
    note: null,
    lookback: {
      workout_id: 989907,
      date: '2026-06-26',
      actual_weight_kg: 355 * KG_PER_LB,
      actual_reps: 4,
      actual_rpe: 7,
    },
    progressContext: null,
    setLogs: [1, 2, 3].map((setIndex) => fixtureSetLog({
      id: 9901400 + setIndex,
      setIndex,
      weightLb: 365,
      reps: 4,
      rpe: 7,
    })),
    coverageTags: ['core-variant', 'deficit', 'percentage', 'completed', 'minimal-history'],
  });

  return [
    squatTop,
    squatBackoffs,
    benchTop,
    benchBackoffs,
    deadliftTop,
    deadliftBackoff,
    benchPercentage,
    deadliftFullCustom,
    pauseSquat,
    closeGripBench,
    deficitDeadlift,
  ];
}

function finalSessionCompletionItems() {
  return [
    coreItem({
      id: 990301,
      lift: 'SQ',
      movement: 'Competition Squat',
      designation: 'Primary',
      variant: 'STRAIGHT',
      scheme: 'STRAIGHT',
      sets: 2,
      reps: 3,
      rpe: 7,
      weightKg: 315 * KG_PER_LB,
      note: 'Completed movement establishes a genuine multi-movement Session boundary.',
      lookback: null,
      progressContext: null,
      setLogs: [1, 2].map((setIndex) => fixtureSetLog({
        id: 9903010 + setIndex,
        setIndex,
        weightLb: 315,
        reps: 3,
        rpe: 7,
      })),
      coverageTags: ['core', 'straight-sets', 'completed'],
    }),
    coreItem({
      id: 990302,
      lift: 'BN',
      movement: 'Competition Bench Press',
      designation: 'Primary',
      variant: 'STRAIGHT',
      scheme: 'STRAIGHT',
      sets: 2,
      reps: 5,
      rpe: 8,
      weightKg: 225 * KG_PER_LB,
      note: 'Log Set 2 to exercise the canonical final-set completion transition.',
      lookback: {
        workout_id: 989902,
        date: '2026-07-10',
        actual_weight_kg: 220 * KG_PER_LB,
        actual_reps: 5,
        actual_rpe: 8,
      },
      progressContext: {
        kind: 'weight_pr',
        qualification: 'qualified',
        targetWeightKg: 225 * KG_PER_LB,
        previousWeightKg: 220 * KG_PER_LB,
      },
      setLogs: [fixtureSetLog({
        id: 9903021,
        setIndex: 1,
        weightLb: 225,
        reps: 5,
        rpe: 8,
      })],
      coverageTags: ['core', 'straight-sets', 'in-progress', 'recent-pr'],
    }),
  ];
}

function baseAccessoryItem({
  id,
  movement,
  originalMovement,
  sets,
  reps,
  rir,
  targetWeightLb,
  lookback,
  movementIdentity,
  performedMovementIdentity = null,
  movementHistory = null,
  devKind,
  repsText = String(reps ?? ''),
  notes = null,
  setLogs = [],
  supersetGroup = null,
  supersetPos = null,
  coverageTags = [],
}: {
  id: number;
  movement: string;
  originalMovement: string;
  sets: number;
  reps: number | null;
  rir: number | null;
  targetWeightLb: number | null;
  lookback: Record<string, unknown> | null;
  movementIdentity: Record<string, unknown> | null;
  performedMovementIdentity?: Record<string, unknown> | null;
  movementHistory?: Record<string, unknown> | null;
  devKind:
    | 'portable'
    | 'machine'
    | 'cable'
    | 'bodyweight'
    | 'weighted_bodyweight'
    | 'assisted_bodyweight'
    | 'timed'
    | 'carry'
    | 'custom';
  repsText?: string;
  notes?: string | null;
  setLogs?: Record<string, unknown>[];
  supersetGroup?: string | null;
  supersetPos?: number | null;
  coverageTags?: string[];
}) {
  const targetKg = targetWeightLb == null ? null : targetWeightLb * KG_PER_LB;
  return {
    id,
    lift: 'ACC',
    designation: 'Accessory',
    variant: 'ACC',
    scheme: null,
    planned_sets: [],
    movement,
    original_movement: originalMovement,
    is_substituted: false,
    selected_sub_movement: null,
    approved_subs: [],
    sets,
    reps,
    reps_text: repsText,
    mode: 'RIR',
    rpe_target: null,
    pct: null,
    rir_target: rir,
    target_low_kg: null,
    target_high_kg: null,
    baseline_low_kg: null,
    baseline_high_kg: null,
    actual_weight_kg: null,
    actual_reps: null,
    actual_rpe: null,
    notes,
    progress_context: null,
    superset_group: supersetGroup,
    superset_pos: supersetPos,
    set_logs: setLogs,
    lookback_best: lookback,
    movement_history: movementHistory,
    movement_identity: movementIdentity,
    performed_movement_identity: performedMovementIdentity,
    parent_item_id: null,
    dev_accessory_intelligence: {
      kind: devKind,
      previous_label: devKind === 'machine' ? 'Last on this machine' : 'Last session',
      history_empty_label: coverageTags.includes('first-time')
        ? 'First time movement'
        : coverageTags.includes('no-history')
          ? 'No previous performance'
          : null,
      recommendation_label: 'Concept next set',
      recommendation_kind: devKind === 'portable' ? 'increase' : 'starting_point',
      recommendation_weight_kg: targetKg,
      recommendation_delta_kg: devKind === 'portable' ? 5 * KG_PER_LB : null,
    },
    dev_visual_coverage: coverageTags,
  };
}

function portableAccessoryItem() {
  const previous = {
    workout_id: 989921,
    date: '2026-06-21',
    actual_weight_kg: 100 * KG_PER_LB,
    actual_reps: 10,
    actual_rir: 2,
  };
  const identity = {
    id: 991201,
    key: 'dumbbell-incline-bench',
    display_name: 'Dumbbell Incline Bench',
    family_id: 991200,
    family_display_name: 'Dumbbell Incline Bench',
    identity_specificity: 'exact',
    equipment_type: 'Dumbbell',
    manufacturer: null,
    comparison_policy: {
      confidence: 'portable',
      comparison_scope: 'canonical_identity',
      recognition_enabled: false,
    },
  };
  return baseAccessoryItem({
    id: 990021,
    movement: 'Dumbbell Incline Bench',
    originalMovement: 'Incline DB',
    sets: 3,
    reps: 10,
    rir: 2,
    targetWeightLb: 105,
    lookback: previous,
    movementIdentity: identity,
    movementHistory: {
      canonical_key: identity.key,
      movement_pattern: 'incline_press',
      loading_behavior: 'normal',
      most_recent_logged_set: {
        weight_kg: previous.actual_weight_kg,
        reps: previous.actual_reps,
        rir: previous.actual_rir,
        date: previous.date,
        workout_id: previous.workout_id,
        item_id: 990021,
        movement: 'Dumbbell Incline Bench',
        set_index: 3,
      },
      best_logged_set: {
        weight_kg: previous.actual_weight_kg,
        reps: previous.actual_reps,
        rir: previous.actual_rir,
        date: previous.date,
        workout_id: previous.workout_id,
        item_id: 990021,
        movement: 'Dumbbell Incline Bench',
        set_index: 3,
      },
      recent_sets: [],
      recent_sessions: [],
      identity_scope: 'exact_identity',
      movement_definition_id: identity.id,
      related_reference_history: [],
    },
    devKind: 'portable',
  });
}

function machineAccessoryItem() {
  const hammer = MACHINE_EVIDENCE[0];
  return applyWorkoutDetailMachineIdentity(
    baseAccessoryItem({
      id: 990022,
      movement: 'Incline Chest Press',
      originalMovement: 'Machine Incline Press',
      sets: 3,
      reps: 10,
      rir: 2,
      targetWeightLb: hammer.suggestedWeightLb,
      lookback: null,
      movementIdentity: broadInclinePressIdentity,
      performedMovementIdentity: hammer.identity,
      movementHistory: null,
      devKind: 'machine',
    }),
    hammer.identity.id,
  );
}

function cableAccessoryItem() {
  const previous = {
    workout_id: 989923,
    date: '2026-06-20',
    actual_weight_kg: 140 * KG_PER_LB,
    actual_reps: 12,
    actual_rir: 2,
  };
  const identity = {
    id: 991301,
    key: 'cable-row-common',
    display_name: 'Cable Row',
    family_id: 991300,
    family_display_name: 'Cable Row',
    identity_specificity: 'exact',
    equipment_type: 'Common cable',
    manufacturer: null,
    comparison_policy: {
      confidence: 'shared',
      comparison_scope: 'canonical_identity',
      recognition_enabled: false,
    },
  };
  return baseAccessoryItem({
    id: 990023,
    movement: 'Cable Row',
    originalMovement: 'Seated Cable Row',
    sets: 3,
    reps: 12,
    rir: 2,
    targetWeightLb: 145,
    lookback: previous,
    movementIdentity: identity,
    movementHistory: {
      canonical_key: identity.key,
      movement_pattern: 'horizontal_pull',
      loading_behavior: 'normal',
      most_recent_logged_set: {
        weight_kg: previous.actual_weight_kg,
        reps: previous.actual_reps,
        rir: previous.actual_rir,
        date: previous.date,
        workout_id: previous.workout_id,
        item_id: 990023,
        movement: 'Cable Row',
        set_index: 3,
      },
      best_logged_set: {
        weight_kg: previous.actual_weight_kg,
        reps: previous.actual_reps,
        rir: previous.actual_rir,
        date: previous.date,
        workout_id: previous.workout_id,
        item_id: 990023,
        movement: 'Cable Row',
        set_index: 3,
      },
      recent_sets: [],
      recent_sessions: [],
      identity_scope: 'exact_identity',
      movement_definition_id: identity.id,
      related_reference_history: [],
    },
    devKind: 'cable',
  });
}

function minimalAccessoryItem() {
  return baseAccessoryItem({
    id: 990024,
    movement: 'Chest-Supported Row',
    originalMovement: 'Chest-Supported Row',
    sets: 3,
    reps: 10,
    rir: 3,
    targetWeightLb: null,
    lookback: null,
    movementIdentity: null,
    devKind: 'portable',
  });
}

function accessoryIdentity({
  id,
  key,
  displayName,
  familyDisplayName = displayName,
  equipmentType,
  loadingImplementation,
  loadConvention,
  measurementType = 'load_reps',
  sidedness = 'bilateral',
  specificity = 'exact',
}: {
  id: number;
  key: string;
  displayName: string;
  familyDisplayName?: string;
  equipmentType: string;
  loadingImplementation: string;
  loadConvention: string;
  measurementType?: string;
  sidedness?: 'bilateral' | 'unilateral' | 'alternating';
  specificity?: 'broad' | 'exact' | 'unknown';
}) {
  return {
    id,
    key,
    display_name: displayName,
    family_id: id,
    family_display_name: familyDisplayName,
    identity_specificity: specificity,
    equipment_type: equipmentType,
    loading_implementation: loadingImplementation,
    load_convention: loadConvention,
    measurement_type: measurementType,
    sidedness,
    manufacturer: null,
    comparison_policy: {
      confidence: specificity === 'exact' ? 'exact' : specificity,
      comparison_scope: specificity === 'exact' ? 'canonical_identity' : 'family',
      recognition_enabled: false,
    },
  };
}

function accessoryLookback({
  itemId,
  movement,
  weightLb,
  reps,
  rir,
  date,
}: {
  itemId: number;
  movement: string;
  weightLb: number;
  reps: number;
  rir: number;
  date: string;
}) {
  const lookback = {
    workout_id: 989900 + itemId,
    date,
    actual_weight_kg: weightLb * KG_PER_LB,
    actual_reps: reps,
    actual_rir: rir,
  };
  const historySetValue = {
    weight_kg: lookback.actual_weight_kg,
    reps,
    rir,
    date,
    workout_id: lookback.workout_id,
    item_id: itemId,
    movement,
    set_index: 3,
  };
  return {
    lookback,
    movementHistory: {
      canonical_key: movement.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      movement_pattern: 'fixture',
      loading_behavior: 'normal',
      most_recent_logged_set: historySetValue,
      best_logged_set: historySetValue,
      recent_sets: [historySetValue],
      recent_sessions: [historySetValue],
      identity_scope: 'exact_identity',
      movement_definition_id: itemId,
      related_reference_history: [],
    },
  };
}

function canonicalAccessoryGroups() {
  const dumbbellIncline = portableAccessoryItem();
  dumbbellIncline.set_logs = [
    fixtureSetLog({
      id: 9902101,
      setIndex: 1,
      weightLb: 105,
      reps: 10,
      rir: 2,
    }),
  ];
  dumbbellIncline.dev_visual_coverage = [
    'accessory',
    'dumbbell',
    'bilateral',
    'fixed-reps',
    'rir',
    'in-progress',
    'rich-history',
    'alias-resolution',
  ];

  const rowId = 990202;
  const rowMovement = 'Single-Arm Dumbbell Row';
  const rowHistory = accessoryLookback({
    itemId: rowId,
    movement: rowMovement,
    weightLb: 90,
    reps: 12,
    rir: 2,
    date: '2026-07-14',
  });
  const dumbbellRow = baseAccessoryItem({
    id: rowId,
    movement: rowMovement,
    originalMovement: '1 Arm DB Row',
    sets: 3,
    reps: 12,
    repsText: '10–12 / side',
    rir: 2,
    targetWeightLb: 95,
    lookback: rowHistory.lookback,
    movementHistory: rowHistory.movementHistory,
    movementIdentity: accessoryIdentity({
      id: rowId,
      key: 'single-arm-dumbbell-row',
      displayName: rowMovement,
      equipmentType: 'Dumbbell',
      loadingImplementation: 'free_weight',
      loadConvention: 'per_hand',
      sidedness: 'unilateral',
    }),
    devKind: 'portable',
    coverageTags: [
      'accessory',
      'dumbbell',
      'unilateral',
      'rep-range',
      'rir',
      'not-started',
      'minimal-history',
    ],
  });

  const rdlId = 990203;
  const rdlMovement = 'Barbell Romanian Deadlift';
  const rdlHistory = accessoryLookback({
    itemId: rdlId,
    movement: rdlMovement,
    weightLb: 245,
    reps: 8,
    rir: 2,
    date: '2026-07-11',
  });
  const barbellRdl = baseAccessoryItem({
    id: rdlId,
    movement: rdlMovement,
    originalMovement: 'RDL',
    sets: 3,
    reps: 8,
    rir: 2,
    targetWeightLb: 250,
    lookback: rdlHistory.lookback,
    movementHistory: rdlHistory.movementHistory,
    movementIdentity: accessoryIdentity({
      id: rdlId,
      key: 'barbell-romanian-deadlift',
      displayName: rdlMovement,
      equipmentType: 'Barbell',
      loadingImplementation: 'free_weight',
      loadConvention: 'total_external_load',
    }),
    devKind: 'portable',
    setLogs: [1, 2, 3].map((setIndex) => fixtureSetLog({
      id: 9902200 + setIndex,
      setIndex,
      weightLb: 250,
      reps: 8,
      rir: 2,
    })),
    coverageTags: ['accessory', 'barbell', 'bilateral', 'fixed-reps', 'rir', 'completed', 'rich-history'],
  });

  const hammerMachine = machineAccessoryItem() as Record<string, any>;
  hammerMachine.dev_visual_coverage = [
    'accessory',
    'plate-loaded-machine',
    'bilateral',
    'fixed-reps',
    'rir',
    'not-started',
    'rich-history',
    'exact-machine-history',
    'related-history',
  ];

  const machineRowId = 990205;
  const machineRowMovement = 'Iso-Lateral High Row with Independent Converging Arms';
  const machineRowHistory = accessoryLookback({
    itemId: machineRowId,
    movement: machineRowMovement,
    weightLb: 180,
    reps: 10,
    rir: 1,
    date: '2026-07-09',
  });
  const machineRow = baseAccessoryItem({
    id: machineRowId,
    movement: machineRowMovement,
    originalMovement: 'High Row Machine',
    sets: 4,
    reps: 8,
    repsText: '8–10',
    rir: 2,
    targetWeightLb: 185,
    lookback: machineRowHistory.lookback,
    movementHistory: machineRowHistory.movementHistory,
    movementIdentity: accessoryIdentity({
      id: machineRowId,
      key: 'iso-lateral-high-row',
      displayName: machineRowMovement,
      equipmentType: 'Plate loaded machine',
      loadingImplementation: 'plate_loaded_machine',
      loadConvention: 'total_external_load',
      sidedness: 'unilateral',
    }),
    performedMovementIdentity: machineIdentity({
      brand: 'Rogers Athletic',
      equipmentType: 'Plate Loaded',
      rememberedStatus: 'Used before',
      lastUsedAt: '2026-07-09',
    }),
    devKind: 'machine',
    setLogs: [
      fixtureSetLog({
        id: 9902301,
        setIndex: 1,
        weightLb: 185,
        reps: 10,
        rir: 2,
      }),
      fixtureSetLog({
        id: 9902302,
        setIndex: 2,
        weightLb: 185,
        reps: 9,
        rir: 1,
      }),
    ],
    coverageTags: [
      'accessory',
      'plate-loaded-machine',
      'unilateral',
      'rep-range',
      'rir',
      'in-progress',
      'rich-history',
      'long-name',
      'long-equipment-name',
    ],
  });

  const legExtensionId = 990216;
  const legExtensionHistory = accessoryLookback({
    itemId: legExtensionId,
    movement: 'Leg Extension',
    weightLb: 150,
    reps: 15,
    rir: 2,
    date: '2026-06-30',
  });
  const selectorizedLegExtension = baseAccessoryItem({
    id: legExtensionId,
    movement: 'Leg Extension',
    originalMovement: 'Quad Extension Machine',
    sets: 3,
    reps: 15,
    repsText: '12–15',
    rir: 2,
    targetWeightLb: 155,
    lookback: legExtensionHistory.lookback,
    movementHistory: legExtensionHistory.movementHistory,
    movementIdentity: accessoryIdentity({
      id: legExtensionId,
      key: 'leg-extension-selectorized',
      displayName: 'Leg Extension',
      equipmentType: 'Selectorized machine',
      loadingImplementation: 'selectorized_machine',
      loadConvention: 'machine_stack',
    }),
    performedMovementIdentity: machineIdentity({
      brand: 'Prime Fitness',
      equipmentType: 'Selectorized',
      rememberedStatus: 'Used before',
      lastUsedAt: '2026-06-30',
    }),
    devKind: 'machine',
    coverageTags: [
      'accessory',
      'selectorized-machine',
      'bilateral',
      'rep-range',
      'rir',
      'not-started',
      'minimal-history',
    ],
  });

  const cableRow = cableAccessoryItem();
  cableRow.set_logs = [1, 2, 3].map((setIndex) => fixtureSetLog({
    id: 9902400 + setIndex,
    setIndex,
    weightLb: 145,
    reps: 12,
    rir: 2,
  }));
  cableRow.dev_visual_coverage = [
    'accessory',
    'cable',
    'bilateral',
    'fixed-reps',
    'rir',
    'completed',
    'rich-history',
  ];

  const pullUpId = 990207;
  const pullUp = baseAccessoryItem({
    id: pullUpId,
    movement: 'Pull-Up',
    originalMovement: 'Pullups',
    sets: 5,
    reps: null,
    repsText: 'AMRAP',
    rir: null,
    targetWeightLb: null,
    lookback: null,
    movementIdentity: accessoryIdentity({
      id: pullUpId,
      key: 'pull-up-bodyweight',
      displayName: 'Pull-Up',
      equipmentType: 'Bodyweight',
      loadingImplementation: 'bodyweight',
      loadConvention: 'bodyweight_only',
      measurementType: 'bodyweight_reps',
    }),
    devKind: 'bodyweight',
    coverageTags: ['accessory', 'bodyweight', 'bilateral', 'amrap', 'not-started', 'first-time'],
  });

  const weightedPullUpId = 990208;
  const weightedPullUpHistory = accessoryLookback({
    itemId: weightedPullUpId,
    movement: 'Weighted Pull-Up',
    weightLb: 45,
    reps: 6,
    rir: 1,
    date: '2026-07-16',
  });
  const weightedPullUp = baseAccessoryItem({
    id: weightedPullUpId,
    movement: 'Weighted Pull-Up',
    originalMovement: 'Chin over bar + weight',
    sets: 4,
    reps: 8,
    repsText: '5–8',
    rir: 1,
    targetWeightLb: 50,
    lookback: weightedPullUpHistory.lookback,
    movementHistory: weightedPullUpHistory.movementHistory,
    movementIdentity: accessoryIdentity({
      id: weightedPullUpId,
      key: 'weighted-pull-up',
      displayName: 'Weighted Pull-Up',
      equipmentType: 'Weighted bodyweight',
      loadingImplementation: 'bodyweight',
      loadConvention: 'added_weight',
      measurementType: 'added_weight_reps',
    }),
    devKind: 'weighted_bodyweight',
    coverageTags: [
      'accessory',
      'weighted-bodyweight',
      'bilateral',
      'rep-range',
      'rir',
      'not-started',
      'rich-history',
    ],
  });

  const assistedPullUpId = 990209;
  const assistedPullUpHistory = accessoryLookback({
    itemId: assistedPullUpId,
    movement: 'Assisted Pull-Up',
    weightLb: 70,
    reps: 10,
    rir: 2,
    date: '2026-07-06',
  });
  const assistedPullUp = baseAccessoryItem({
    id: assistedPullUpId,
    movement: 'Assisted Pull-Up',
    originalMovement: 'Band or machine assisted pull-up',
    sets: 3,
    reps: 10,
    repsText: '8–10',
    rir: 2,
    targetWeightLb: 65,
    lookback: assistedPullUpHistory.lookback,
    movementHistory: assistedPullUpHistory.movementHistory,
    movementIdentity: accessoryIdentity({
      id: assistedPullUpId,
      key: 'assisted-pull-up',
      displayName: 'Assisted Pull-Up',
      equipmentType: 'Assisted bodyweight',
      loadingImplementation: 'assisted_bodyweight',
      loadConvention: 'assistance_weight',
      measurementType: 'assisted_reps',
    }),
    devKind: 'assisted_bodyweight',
    coverageTags: [
      'accessory',
      'assisted-bodyweight',
      'bilateral',
      'rep-range',
      'rir',
      'not-started',
      'minimal-history',
    ],
  });

  const splitSquatId = 990210;
  const splitSquat = baseAccessoryItem({
    id: splitSquatId,
    movement: 'Rear-Foot-Elevated Bulgarian Split Squat',
    originalMovement: 'RFESS',
    sets: 3,
    reps: 10,
    repsText: '10 / side',
    rir: 2,
    targetWeightLb: 70,
    lookback: null,
    movementIdentity: accessoryIdentity({
      id: splitSquatId,
      key: 'rear-foot-elevated-split-squat',
      displayName: 'Rear-Foot-Elevated Bulgarian Split Squat',
      equipmentType: 'Dumbbell',
      loadingImplementation: 'free_weight',
      loadConvention: 'per_hand',
      sidedness: 'unilateral',
    }),
    devKind: 'portable',
    notes: 'Keep the front foot planted, descend under control, maintain a quiet pelvis, and complete every rep on the left side before switching.',
    coverageTags: [
      'accessory',
      'dumbbell',
      'unilateral',
      'fixed-reps',
      'rir',
      'not-started',
      'no-history',
      'long-name',
      'long-note',
    ],
  });

  const plankId = 990211;
  const plank = baseAccessoryItem({
    id: plankId,
    movement: 'RKC Plank',
    originalMovement: 'Hardstyle Plank',
    sets: 3,
    reps: 45,
    repsText: '45 sec',
    rir: null,
    targetWeightLb: null,
    lookback: null,
    movementIdentity: accessoryIdentity({
      id: plankId,
      key: 'rkc-plank',
      displayName: 'RKC Plank',
      equipmentType: 'Bodyweight',
      loadingImplementation: 'bodyweight',
      loadConvention: 'bodyweight_only',
      measurementType: 'duration',
    }),
    devKind: 'timed',
    coverageTags: ['accessory', 'bodyweight', 'timed', 'bilateral', 'not-started', 'no-history'],
  });

  const carryId = 990212;
  const carry = baseAccessoryItem({
    id: carryId,
    movement: 'Farmer Carry',
    originalMovement: 'Farmers Walk',
    sets: 4,
    reps: 30,
    repsText: '30 m',
    rir: null,
    targetWeightLb: null,
    lookback: null,
    movementIdentity: accessoryIdentity({
      id: carryId,
      key: 'farmer-carry',
      displayName: 'Farmer Carry',
      equipmentType: 'Farmer handles',
      loadingImplementation: 'free_weight',
      loadConvention: 'per_hand',
      measurementType: 'distance_load',
    }),
    devKind: 'carry',
    coverageTags: ['accessory', 'carry', 'distance', 'bilateral', 'not-started', 'no-history'],
  });

  const cableFlyId = 990213;
  const cableFly = baseAccessoryItem({
    id: cableFlyId,
    movement: 'Low-to-High Cable Fly',
    originalMovement: 'Low Cable Fly',
    sets: 3,
    reps: 15,
    repsText: '12–15',
    rir: 1,
    targetWeightLb: null,
    lookback: null,
    movementIdentity: accessoryIdentity({
      id: cableFlyId,
      key: 'low-to-high-cable-fly',
      displayName: 'Low-to-High Cable Fly',
      equipmentType: 'Common cable',
      loadingImplementation: 'cable',
      loadConvention: 'machine_stack',
    }),
    devKind: 'cable',
    supersetGroup: 'A',
    supersetPos: 1,
    coverageTags: [
      'accessory',
      'cable',
      'bilateral',
      'rep-range',
      'rir',
      'superset',
      'not-started',
      'first-time',
    ],
  });

  const pressdownId = 990214;
  const pressdownHistory = accessoryLookback({
    itemId: pressdownId,
    movement: 'Single-Arm Cross-Body Cable Pressdown',
    weightLb: 25,
    reps: 15,
    rir: 1,
    date: '2026-07-18',
  });
  const pressdown = baseAccessoryItem({
    id: pressdownId,
    movement: 'Single-Arm Cross-Body Cable Pressdown',
    originalMovement: '1 Arm Cable Extension',
    sets: 3,
    reps: 15,
    repsText: '12–15 / side',
    rir: 1,
    targetWeightLb: 30,
    lookback: pressdownHistory.lookback,
    movementHistory: pressdownHistory.movementHistory,
    movementIdentity: accessoryIdentity({
      id: pressdownId,
      key: 'single-arm-cross-body-cable-pressdown',
      displayName: 'Single-Arm Cross-Body Cable Pressdown',
      equipmentType: 'Common cable',
      loadingImplementation: 'cable',
      loadConvention: 'machine_stack',
      sidedness: 'unilateral',
    }),
    devKind: 'cable',
    supersetGroup: 'A',
    supersetPos: 2,
    coverageTags: [
      'accessory',
      'cable',
      'unilateral',
      'rep-range',
      'rir',
      'superset',
      'not-started',
      'rich-history',
      'long-name',
    ],
  });

  const customId = 990215;
  const customMovement = 'Standing Alternating Cross-Body Dumbbell Curl with Three-Second Eccentric';
  const custom = baseAccessoryItem({
    id: customId,
    movement: customMovement,
    originalMovement: customMovement,
    sets: 2,
    reps: 12,
    repsText: '12 / side',
    rir: 3,
    targetWeightLb: null,
    lookback: null,
    movementIdentity: accessoryIdentity({
      id: customId,
      key: 'custom-alternating-cross-body-curl',
      displayName: customMovement,
      equipmentType: 'Custom equipment implementation not yet identified',
      loadingImplementation: 'other',
      loadConvention: 'unknown',
      sidedness: 'alternating',
      specificity: 'unknown',
    }),
    devKind: 'custom',
    coverageTags: [
      'accessory',
      'custom-equipment',
      'alternating',
      'fixed-reps',
      'rir',
      'not-started',
      'first-time',
      'long-name',
      'long-equipment-name',
    ],
  });

  return [
    {
      group: null,
      items: [
        dumbbellIncline,
        dumbbellRow,
        barbellRdl,
        hammerMachine,
        machineRow,
        selectorizedLegExtension,
        cableRow,
        pullUp,
        weightedPullUp,
        assistedPullUp,
        splitSquat,
        plank,
        carry,
        custom,
      ],
    },
    {
      group: 'A',
      dev_execution_hint: 'Alternate continuously',
      items: [cableFly, pressdown],
    },
  ];
}

function fixtureMovement(scenario: WorkoutDetailFixtureScenario) {
  if (scenario === 'bench-rep-max') {
    return coreItem({
      id: 990012,
      lift: 'BN',
      movement: 'Competition Bench Press',
      designation: 'Primary',
      sets: 3,
      reps: 5,
      rpe: 8,
      weightKg: LB_225_KG,
      note: 'Pause cleanly, then drive through the full foot.',
      lookback: {
        workout_id: 989902,
        date: '2026-07-17',
        actual_weight_kg: LB_220_KG,
        actual_reps: 5,
        actual_rpe: 8,
      },
      progressContext: {
        kind: 'rep_max',
        qualification: 'qualified',
        targetWeightKg: LB_225_KG,
        previousWeightKg: LB_220_KG,
        reps: 5,
      },
    });
  }

  if (scenario === 'deadlift-prior-session') {
    return coreItem({
      id: 990013,
      lift: 'DL',
      movement: 'Competition Deadlift',
      designation: 'Primary',
      sets: 3,
      reps: 3,
      rpe: 7.5,
      weightKg: LB_495_KG,
      note: 'Stay patient to the knee and finish tall.',
      lookback: {
        workout_id: 989903,
        date: '2026-07-10',
        actual_weight_kg: LB_495_KG,
        actual_reps: 3,
        actual_rpe: 8,
      },
      progressContext: {
        kind: 'prior_session',
        qualification: 'qualified',
        weightKg: LB_495_KG,
        reps: 3,
        rpe: 8,
        date: '2026-07-10',
      },
    });
  }

  const hasContext = scenario !== 'no-progress-context';
  return coreItem({
    id: 990011,
    lift: 'SQ',
    movement: 'Competition Squat',
    designation: 'Primary',
    sets: 1,
    reps: 1,
    rpe: 8,
    weightKg: LB_405_KG,
    note: 'Stay patient out of the hole.',
    lookback: hasContext
      ? {
          workout_id: 989901,
          date: '2026-07-17',
          actual_weight_kg: LB_395_KG,
          actual_reps: 1,
          actual_rpe: 8,
        }
      : null,
    progressContext: hasContext
      ? {
          kind: 'weight_pr',
          qualification: 'qualified',
          targetWeightKg: LB_405_KG,
          previousWeightKg: LB_395_KG,
        }
      : null,
  });
}

function fixturePlannedSetCount(item: Record<string, any>) {
  if (Array.isArray(item.planned_sets) && item.planned_sets.length > 0) {
    return item.planned_sets.length;
  }
  const count = Number(item.sets);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function fixtureDefaultReps(item: Record<string, any>, plannedSet?: Record<string, any> | null) {
  const direct = Number(plannedSet?.reps ?? item.reps);
  if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
  const parsed = String(item.reps_text || '').match(/\d+/g);
  if (parsed?.length) return Number(parsed[parsed.length - 1]);
  const prior = Number(item.lookback_best?.actual_reps);
  return Number.isFinite(prior) && prior > 0 ? Math.floor(prior) : 10;
}

function fixtureDefaultWeightKg(item: Record<string, any>, plannedSet?: Record<string, any> | null) {
  const candidates = [
    plannedSet?.manual_target_kg,
    item.target_low_kg,
    item.target_high_kg,
    item.dev_accessory_intelligence?.recommendation_weight_kg,
    item.lookback_best?.actual_weight_kg,
  ];
  const resolved = candidates.map(Number).find((value) => Number.isFinite(value) && value >= 0);
  return resolved ?? 0;
}

function completedFixtureLogs(item: Record<string, any>) {
  const count = fixturePlannedSetCount(item);
  const existing = new Map(
    (item.set_logs || []).map((log: Record<string, any>) => [Number(log.set_index), log]),
  );
  return Array.from({ length: count }, (_, offset) => {
    const setIndex = offset + 1;
    const prior = existing.get(setIndex);
    if (prior) return prior;
    const plannedSet = Array.isArray(item.planned_sets)
      ? item.planned_sets.find((candidate: Record<string, any>) => Number(candidate.set_index) === setIndex)
      : null;
    return {
      id: Number(item.id) * 100 + setIndex,
      set_index: setIndex,
      actual_weight_kg: fixtureDefaultWeightKg(item, plannedSet),
      actual_reps: fixtureDefaultReps(item, plannedSet),
      actual_rpe: plannedSet?.rpe_target ?? item.rpe_target ?? null,
      actual_rir: item.rir_target ?? null,
    };
  });
}

function fixtureCompletedSetCount(workout: Record<string, any>) {
  const coreCount = (workout.core_items || []).reduce(
    (total: number, item: Record<string, any>) => total + (item.set_logs || []).length,
    0,
  );
  return (workout.accessory_groups || []).reduce(
    (total: number, group: Record<string, any>) =>
      total +
      (group.items || []).reduce(
        (groupTotal: number, item: Record<string, any>) =>
          groupTotal + (item.set_logs || []).length,
        0,
      ),
    coreCount,
  );
}

function fixtureCompletedMovementCount(workout: Record<string, any>) {
  const visibleCoreCount = (workout.core_items || []).filter(
    (item: Record<string, any>) => item.parent_item_id == null,
  ).length;
  const accessoryCount = (workout.accessory_groups || []).reduce(
    (total: number, group: Record<string, any>) => total + (group.items || []).length,
    0,
  );
  return visibleCoreCount + accessoryCount;
}

function fixtureSessionVolumeKg(workout: Record<string, any>) {
  const items = [
    ...(workout.core_items || []),
    ...(workout.accessory_groups || []).flatMap(
      (group: Record<string, any>) => group.items || [],
    ),
  ];
  return items.reduce(
    (total: number, item: Record<string, any>) =>
      total +
      (item.set_logs || []).reduce(
        (itemTotal: number, log: Record<string, any>) =>
          itemTotal +
          Math.max(0, Number(log.actual_weight_kg) || 0) *
            Math.max(0, Number(log.actual_reps) || 0),
        0,
      ),
    0,
  );
}

function completedRecapVideoSet({
  id,
  setIndex,
  weightKg,
  reps,
  effort,
  video = false,
  pr = false,
  thumbnailKind = 'machine',
}: {
  id: number;
  setIndex: number;
  weightKg: number;
  reps: number;
  effort: number;
  video?: boolean;
  pr?: boolean;
  thumbnailKind?: 'competition-squat' | 'hinge' | 'machine';
}) {
  const videoId = video ? id + 800_000 : null;
  return {
    id,
    set_index: setIndex,
    actual_weight_kg: weightKg,
    actual_reps: reps,
    actual_rpe: null,
    actual_rir: effort,
    has_pr: pr,
    video_attachment_id: videoId,
    video_id: videoId,
    video: videoId ? {
      id: videoId,
      set_log_id: id,
      review_status: 'reviewed',
      upload_status: 'ready',
      has_feedback: false,
      thumbnail_url: `sl-fixture://session-review/${thumbnailKind}`,
      url: null,
    } : null,
  };
}

function completedRecapAccessory({
  id,
  movement,
  primaryMuscle,
  weightKg,
  reps,
  manufacturer,
  manufacturerKey,
  model,
  implementation,
  video = false,
  pr = false,
}: {
  id: number;
  movement: string;
  primaryMuscle: string;
  weightKg: number;
  reps: number;
  manufacturer?: string;
  manufacturerKey?: string;
  model?: string;
  implementation?: string;
  video?: boolean;
  pr?: boolean;
}) {
  const item = baseAccessoryItem({
    id,
    movement,
    originalMovement: movement,
    sets: 3,
    reps,
    rir: 1,
    targetWeightLb: null,
    lookback: null,
    movementIdentity: null,
    devKind: implementation?.includes('selectorized') ? 'machine' : 'portable',
    setLogs: [1, 2, 3].map((setIndex) => completedRecapVideoSet({
      id: id * 100 + setIndex,
      setIndex,
      weightKg,
      reps,
      effort: 1,
      video,
      pr: pr && setIndex === 1,
      thumbnailKind: movement === 'RDL' ? 'hinge' : 'machine',
    })),
  });
  return {
    ...item,
    dev_primary_muscle_group: primaryMuscle,
    dev_completed_equipment: manufacturer || model || implementation ? [{
      manufacturer: manufacturer || null,
      manufacturer_key: manufacturerKey || null,
      model: model || null,
      model_key: model ? model.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null,
      implementation_key: implementation || null,
      label: [manufacturer, model].filter(Boolean).join(' · ') || implementation || null,
    }] : [],
  };
}

function completedRecapV2Items() {
  const squat = coreItem({
    id: 990301,
    lift: 'SQ',
    movement: 'Competition Squat',
    designation: 'Primary',
    sets: 3,
    reps: 3,
    rpe: 7,
    weightKg: 174.633,
    note: 'Own the bottom position and drive through the full foot.',
    lookback: null,
    progressContext: { kind: 'rep_max', qualification: 'qualified', targetWeightKg: 174.633, previousWeightKg: 170, reps: 3 },
    setLogs: [1, 2, 3].map((setIndex) => ({
      ...completedRecapVideoSet({ id: 99030100 + setIndex, setIndex, weightKg: 174.633, reps: 3, effort: 7, video: true, pr: setIndex === 1, thumbnailKind: 'competition-squat' }),
      actual_rpe: 7,
      actual_rir: null,
    })),
  });
  (squat as any).dev_completed_equipment = [{
    manufacturer: 'Rogue',
    manufacturer_key: 'rogue',
    model: 'Power Bar',
    model_key: 'power-bar',
    implementation_key: 'plates-kg',
    label: 'Rogue · Power Bar',
  }];
  const accessories = [
    completedRecapAccessory({ id: 990302, movement: 'Kneeling Single-Leg Curl', primaryMuscle: 'Hamstrings', weightKg: 60, reps: 12, manufacturer: 'Matrix', manufacturerKey: 'matrix', model: 'Selectorized', implementation: 'selectorized-machine', video: true, pr: true }),
    completedRecapAccessory({ id: 990303, movement: 'RDL', primaryMuscle: 'Hamstrings', weightKg: 163.293, reps: 12, manufacturer: 'Rogue', manufacturerKey: 'rogue', model: 'Power Bar', implementation: 'plates-kg', video: true, pr: true }),
    completedRecapAccessory({ id: 990304, movement: 'Leg Extension', primaryMuscle: 'Quadriceps', weightKg: 72.5, reps: 15, manufacturer: 'Matrix', manufacturerKey: 'matrix', model: 'Selectorized', implementation: 'selectorized-machine' }),
    completedRecapAccessory({ id: 990305, movement: 'Neutral-Grip Lat Pulldown', primaryMuscle: 'Lats', weightKg: 75, reps: 12, manufacturer: 'Matrix', manufacturerKey: 'matrix', model: 'Selectorized', implementation: 'selectorized-machine' }),
    completedRecapAccessory({ id: 990306, movement: 'Standing Calf Raise', primaryMuscle: 'Calves', weightKg: 100, reps: 15, manufacturer: 'Matrix', manufacturerKey: 'matrix', model: 'Selectorized', implementation: 'selectorized-machine' }),
    completedRecapAccessory({ id: 990307, movement: 'Cable Crunch', primaryMuscle: 'Abs', weightKg: 45, reps: 15, manufacturer: 'Matrix', manufacturerKey: 'matrix', model: 'Cable Stack', implementation: 'cable-stack' }),
  ];
  return { coreItems: [squat], accessoryGroups: [{ group: null, items: accessories }] };
}

function completedRecapV2Item(item: Record<string, any>) {
  const machine = item.performed_movement_identity?.manufacturer;
  const model = item.performed_movement_identity?.equipment_model;
  const equipment = item.dev_completed_equipment || (
    machine || model || item.performed_movement_identity?.implementation_key
      ? [{
          manufacturer: machine?.display_name || null,
          manufacturer_key: machine?.key || null,
          model: model?.display_name || null,
          model_key: model?.key || null,
          implementation_key: item.performed_movement_identity?.implementation_key || null,
          label: [machine?.display_name, model?.display_name].filter(Boolean).join(' · ')
            || item.performed_movement_identity?.implementation_key
            || null,
        }]
      : []
  );
  const sets = (item.set_logs || []).map((row: Record<string, any>) => ({ ...row }));
  const hasPr = sets.some((row: Record<string, any>) => row.has_pr);
  const best = [...sets].sort((left, right) => (
    (Number(right.actual_weight_kg) * (1 + Number(right.actual_reps) / 30))
    - (Number(left.actual_weight_kg) * (1 + Number(left.actual_reps) / 30))
  ))[0] || null;
  const currentScore = best
    ? Number(best.actual_weight_kg) * (1 + Number(best.actual_reps) / 30)
    : 0;
  const primaryMuscle = String(item.dev_primary_muscle_group || item.performed_movement_identity?.primary_muscle_group || '')
    .trim().toLowerCase().replaceAll(' ', '_')
    .replace('quadriceps', 'quads').replace('abs', 'core');
  const secondaryByPrimary: Record<string, string[]> = {
    quads: ['glutes'], hamstrings: ['glutes'], lats: ['biceps'], calves: [], core: [],
  };
  const trendPoints: Array<{
    date: string | null;
    workout_id: number | null;
    set_log_id: number | null;
    weight_kg: number;
    reps: number;
    score: number;
    current?: boolean;
  }> = best ? [
    ...[0.82, 0.87, 0.91, 0.95].map((factor, index) => ({
      date: ['2026-06-12', '2026-06-26', '2026-07-10', '2026-08-02'][index],
      workout_id: 989900 + index,
      set_log_id: 989990 + index,
      weight_kg: Number(best.actual_weight_kg) * factor,
      reps: Number(best.actual_reps),
      score: currentScore * factor,
    })),
    {
      date: null,
      workout_id: null,
      set_log_id: best.id,
      weight_kg: Number(best.actual_weight_kg),
      reps: Number(best.actual_reps),
      score: currentScore,
      current: true,
    },
  ] : [];
  return {
    item_id: item.id,
    label: item.movement || item.original_movement || 'Movement',
    kind: item.variant === 'ACC' ? 'accessory' : 'core',
    lift: item.lift,
    variant: item.variant,
    designation: item.designation,
    superset_group: item.superset_group,
    superset_pos: item.superset_pos,
    primary_muscle_group: primaryMuscle || null,
    secondary_muscle_groups: secondaryByPrimary[primaryMuscle] || [],
    sets,
    equipment,
    has_pr: hasPr,
    accomplishment_count: hasPr ? 1 : 0,
    accomplishment_ids: hasPr ? [9900901] : [],
    measurement: {
      measurement_type: 'load_reps',
      load_convention: item.variant === 'ACC' ? 'performed_implementation' : 'total_external_load',
      equipment_type: item.variant === 'ACC' ? 'Performed equipment' : 'Barbell',
      comparison_eligible: true,
      comparison_scope: item.variant === 'ACC' ? 'exact_movement_identity' : 'exact_core_identity',
    },
    best_set: best ? {
      set_log_id: best.id,
      set_index: best.set_index,
      weight_kg: best.actual_weight_kg,
      reps: best.actual_reps,
      rpe: best.actual_rpe,
      rir: best.actual_rir,
      has_pr: best.has_pr,
      video_attachment_id: best.video_attachment_id,
      video: best.video,
    } : null,
    trend: trendPoints.length > 1 ? {
      metric: 'estimated_1rm_kg',
      scope: item.variant === 'ACC' ? 'exact_movement_identity' : 'exact_core_identity',
      points: trendPoints,
      delta_kg: best ? Number(best.actual_weight_kg) * 0.05 : null,
    } : null,
    projection: best ? {
      metric: 'estimated_1rm',
      value_kg: currentScore,
      method: 'epley_rpe_adjusted_v1',
      source_set_log_id: best.id,
      label: 'Estimated 1RM',
    } : null,
  };
}

function buildCompletedRecapV2(workout: Record<string, any>, athlete: Record<string, any>, impactSummary: Record<string, any>) {
  const items = [
    ...(workout.core_items || []),
    ...(workout.accessory_groups || []).flatMap((group: Record<string, any>) => group.items || []),
  ];
  const performed = items.filter((item: Record<string, any>) => (item.set_logs || []).length > 0).map(completedRecapV2Item);
  const accomplishments = [
    {
      id: 9900901,
      event_type: 'CORE_REP_MAX_PR',
      movement_label: 'Competition Squat',
      workout_item_id: performed[0]?.item_id,
      source_set_log_id: performed[0]?.sets?.[0]?.id,
      headline: '3-rep max PR',
    },
    { id: 9900902, event_type: 'CORE_WEIGHT_PR', movement_label: 'RDL', headline: 'Weight PR' },
    { id: 9900903, event_type: 'CORE_BLOCK_REP_MAX_BEST', movement_label: 'Kneeling Single-Leg Curl', headline: 'Block rep best' },
  ];
  return {
    schema_version: 'completed-session-recap-v2',
    source: 'canonical_workout_evidence',
    lifecycle_mode: 'completed_recap',
    workout_id: workout.id,
    athlete: { id: athlete.id, name: athlete.name, sex: 'male', anatomy_display_preference: 'automatic' },
    session: {
      label: workout.label,
      date: workout.date,
      status: 'completed',
      started_at: workout.started_at,
      completed_at: impactSummary.completion_timestamp,
      duration_seconds: workout.completed_duration_seconds,
      set_count: fixtureCompletedSetCount(workout),
      movement_count: fixtureCompletedMovementCount(workout),
      video_count: performed.flatMap((item: Record<string, any>) => item.sets).filter((set: Record<string, any>) => set.video_attachment_id || set.video_id || set.video?.id).length,
      total_volume_kg: fixtureSessionVolumeKg(workout),
      volume_trend: {
        scope: 'current_training_block',
        delta_kg: fixtureSessionVolumeKg(workout) - 14_900 * KG_PER_LB,
        points: [
          { date: '2026-07-10', workout_id: 989901, volume_kg: 10_200 * KG_PER_LB },
          { date: '2026-07-24', workout_id: 989902, volume_kg: 11_800 * KG_PER_LB },
          { date: '2026-08-02', workout_id: 989903, volume_kg: 13_000 * KG_PER_LB },
          { date: '2026-08-09', workout_id: 989904, volume_kg: 14_900 * KG_PER_LB },
          { date: workout.date, workout_id: workout.id, volume_kg: fixtureSessionVolumeKg(workout), current: true },
        ],
      },
      reported_bodyweight: {
        reported_bodyweight_kg: 188.6 * 0.45359237,
        weight_kg: 188.6 * 0.45359237,
        reported_at: '2026-08-12T15:54:00Z',
        training_date: workout.date,
        date: workout.date,
        workout_id: workout.id,
        source: 'PRE_SESSION_READINESS',
        resolution: 'exact_session',
      },
    },
    highlights: {
      summary_id: impactSummary.summary_id,
      session_streak: 4,
      pr_count: 3,
      accomplishment_count: accomplishments.length,
      session_volume_kg: fixtureSessionVolumeKg(workout),
      all_prescribed_work_logged: true,
      prescribed_set_count: fixtureCompletedSetCount(workout),
      completed_prescribed_set_count: fixtureCompletedSetCount(workout),
      prescription_completion_percent: 100,
      canonical_items: accomplishments,
      remaining_highlight_count: 0,
    },
    performed_movements: performed,
    muscle_focus: {
      primary: [
        { muscle_id: 'hamstrings', score: 10 },
        { muscle_id: 'glutes', score: 7 },
        { muscle_id: 'quads', score: 5.5 },
        { muscle_id: 'calves', score: 2 },
      ],
      secondary: [{ muscle_id: 'lower_back', score: 1.5 }],
      source: 'performed',
      evidence_movement_count: 7,
      weights: { primary_set: 1, secondary_set: 0.5 },
    },
    accomplishments,
    reflection: {
      session_rpe: 8,
      strength: 'strong',
      fatigue: 'moderate',
      note: 'Strong positions today. Squat depth stayed consistent and accessory tempo was controlled.',
      submitted_at: '2026-08-12T18:24:00Z',
    },
    coach_feedback: {
      feedback: workout.post_session_coach_feedback,
      feedback_at: workout.post_session_coach_feedback_at,
      reviewed: true,
      reviewed_at: workout.post_session_coach_feedback_at,
      outcome: 'reviewed',
      author: { id: 990040, name: 'Coach Adrian Cole' },
    },
    readiness_context: {
      sleep_quality: 7.5,
      sleep_hours: 7.2,
      soreness: 4,
      stress: 3,
      energy: 8,
      readiness_score: 7.5,
      bodyweight_kg: 188.6 * 0.45359237,
    },
    plan: {
      programming_notes: 'Own the competition positions, then keep one rep in reserve on accessories.',
      movements: items.map((item: Record<string, any>) => ({
        item_id: item.id,
        label: item.movement || item.original_movement,
        variant: item.variant,
        designation: item.designation,
        sets: item.sets,
        reps: item.reps,
        reps_text: item.reps_text,
        mode: item.mode,
        rpe_target: item.rpe_target,
        rir_target: item.rir_target,
        pct: item.pct,
        target_low_kg: item.target_low_kg,
        target_high_kg: item.target_high_kg,
        planned_sets: item.planned_sets || [],
        notes: item.notes || '',
        superset_group: item.superset_group,
        superset_pos: item.superset_pos,
      })),
    },
  };
}

function applyWorkoutDetailLifecycle<T extends Record<string, any>>(
  payload: T,
  lifecycle: WorkoutDetailLifecycle,
): T {
  if (lifecycle === 'active_session') return payload;

  const isPostSession = lifecycle === 'post_session';
  const mapItem = (item: Record<string, any>) => ({
    ...item,
    set_logs: isPostSession ? completedFixtureLogs(item) : [],
  });
  const workout = {
    ...payload.workout,
    core_items: (payload.workout?.core_items || []).map(mapItem),
    accessory_groups: (payload.workout?.accessory_groups || []).map(
      (group: Record<string, any>) => ({
        ...group,
        items: (group.items || []).map(mapItem),
      }),
    ),
  };

  if (!isPostSession) {
    return {
      ...payload,
      permissions: {
        ...payload.permissions,
        can_log: true,
      },
      workout: {
        ...workout,
        status: 'assigned',
        started_at: null,
        completed_duration_seconds: null,
        loggable: true,
        programming_notes:
          'Arrive ready to move well. Review the primary lift cues, confirm machine variants, and begin only when your setup is complete.',
        post_session_coach_feedback: null,
        post_session_coach_feedback_at: null,
        impact_summary: null,
      },
    };
  }

  const completedSetCount = fixtureCompletedSetCount(workout);
  const completedMovementCount = fixtureCompletedMovementCount(workout);
  const sessionVolumeKg = fixtureSessionVolumeKg(workout);
  const completedWorkout = {
    ...workout,
    status: 'completed',
    started_at: '2026-08-12T17:02:00Z',
    completed_duration_seconds: 4920,
    loggable: false,
    programming_notes: '',
    post_session_coach_feedback:
      'Strong execution today. The competition work stayed composed, and you kept the accessory rounds moving without sacrificing position.',
    post_session_coach_feedback_at: '2026-08-12T18:28:00Z',
    impact_summary: {
      summary_id: 'canonical-post-session-990001',
      workout_id: workout.id,
      status: 'completed',
      canonically_completed: true,
      completion_timestamp: '2026-08-12T18:24:00Z',
      title: workout.label || 'Completed Session',
      date: workout.date,
      completed_duration_seconds: 4920,
      completed_set_count: completedSetCount,
      completed_movement_count: completedMovementCount,
      completed_core_prescription_count: (workout.core_items || []).length,
      session_streak: 4,
      session_volume_kg: sessionVolumeKg,
      career_volume_before_kg: 1_182_420,
      career_volume_after_kg: 1_182_420 + sessionVolumeKg,
      career_session_count_before: 183,
      career_session_count_after: 184,
      all_prescribed_work_logged: true,
      prescribed_set_count: completedSetCount,
      completed_prescribed_set_count: completedSetCount,
      prescription_completion_percent: 100,
      accomplishment_count: 3,
      highlights: [],
      remaining_highlight_count: 0,
      estimated_strength_insights: [],
      workout_evidence_revision: 1,
    },
  };
  return {
    ...payload,
    permissions: {
      ...payload.permissions,
      can_log: false,
      can_hot_swap: false,
    },
    workout: {
      ...completedWorkout,
      completed_recap: buildCompletedRecapV2(completedWorkout, payload.athlete, completedWorkout.impact_summary),
    },
  };
}

export function createWorkoutDetailFixture(
  requestedScenario: WorkoutDetailFixtureScenario | string = 'primary-squat',
  requestedLifecycle: WorkoutDetailLifecycle | string = 'active_session',
) {
  const scenario = WORKOUT_DETAIL_FIXTURE_SCENARIOS.includes(requestedScenario as WorkoutDetailFixtureScenario)
    ? requestedScenario as WorkoutDetailFixtureScenario
    : 'primary-squat';
  const lifecycle = normalizeWorkoutDetailLifecycle(requestedLifecycle) || 'active_session';
  const accessoryOnly = scenario === 'accessory-minimal';
  const coachHasPhoto = scenario !== 'coach-photo-fallback';
  const recapV2 = scenario === 'completed-recap-v2' ? completedRecapV2Items() : null;
  const coreItems = recapV2
    ? recapV2.coreItems
    : accessoryOnly
    ? []
    : scenario === 'final-session-completion'
      ? finalSessionCompletionItems()
    : scenario === 'primary-squat'
      ? canonicalCoreItems()
      : [fixtureMovement(scenario)];
  const accessoryGroups = recapV2
    ? recapV2.accessoryGroups
    : accessoryOnly
    ? [{ group: null, items: [minimalAccessoryItem()] }]
    : scenario === 'final-session-completion'
      ? []
    : scenario === 'primary-squat'
      ? canonicalAccessoryGroups()
      : [{
          group: null,
          items: [
            portableAccessoryItem(),
            machineAccessoryItem(),
            cableAccessoryItem(),
          ],
        }];

  return applyWorkoutDetailLifecycle({
    ok: true,
    permissions: {
      can_log: true,
      can_coach: false,
      is_self_coached: false,
      can_hot_swap: false,
    },
    athlete: {
      id: 990001,
      name: scenario === 'completed-recap-v2' ? 'Dominic Barela' : 'Maya Chen',
      preferred_units: 'lb',
      bodyweight_kg: 74.8,
    },
    coach: {
      id: 990040,
      name: 'Adrian Cole',
      avatar_url: null,
      avatar_uploaded_at: null,
      avatar_fixture: coachHasPhoto ? 'coach-adrien' : null,
    },
    readiness_survey: {
      id: 990001,
      bodyweight_kg: 74.8,
      sleep_quality: 7.5,
      sleep_hours: 7.2,
      soreness: 4,
      stress: 3,
      energy: 8,
      readiness_score: 7.5,
    },
    workout: {
      id: 990001,
      athlete_id: 990001,
      date: scenario === 'completed-recap-v2' ? '2026-08-12' : '2026-07-24',
      label: accessoryOnly
        ? 'Upper Back Volume'
        : scenario === 'completed-recap-v2'
          ? 'W3 Legs'
        : scenario === 'final-session-completion'
          ? 'Final-Set Completion Validation'
          : 'Canonical Logger · Complete Ecosystem',
      status: 'in_progress',
      started_at: null,
      completed_duration_seconds: null,
      estimated_duration_minutes: 45,
      estimated_duration_low_minutes: 40,
      estimated_duration_high_minutes: 50,
      estimated_duration_model_version: 'deterministic-v1',
      completion_reminder_sent_at: null,
      timeliness: 'on_time',
      loggable: true,
      requires_tardy_reason: false,
      tardy_reason: null,
      block_reason: null,
      training_block_id: 990004,
      programming_notes: '',
      post_session_coach_feedback: null,
      post_session_coach_feedback_at: null,
      impact_summary: null,
      dev_visual_coverage: scenario === 'primary-squat'
        ? CANONICAL_LOGGER_VISUAL_COVERAGE
        : null,
      accomplishment_history: {
        items: [],
        next_cursor: null,
        has_more: false,
      },
      core_items: coreItems,
      accessory_groups: accessoryGroups,
    },
  }, lifecycle);
}
