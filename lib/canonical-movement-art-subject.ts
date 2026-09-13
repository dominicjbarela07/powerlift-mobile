import { governedAccessoryArtworkTaxonomy, governedCoreArtworkTaxonomy } from './governed-movement-art-taxonomy';
import { CANONICAL_ACCESSORY_ARTWORK_IDENTITIES, RETIRED_ACCESSORY_ARTWORK_IDENTITIES } from './canonical-accessory-artwork-identities';
import { focusedAccessoryMuscleRegionKey, type FocusedAccessoryMuscleRegionKey } from './accessory-muscle-group';

export type CanonicalCoreArtworkFamily = 'squat' | 'bench' | 'deadlift' | 'press';

/** An ID inside this explicitly named reference is a definition ID, never a row ID. */
export type MovementArtDefinition = Readonly<{
  id?: number | null;
  key?: string | null;
  kind?: string | null;
  identity_type?: string | null;
  family?: string | null;
  core_family?: string | null;
  core_kind?: string | null;
  equipment_type?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: readonly string[] | null;
  material_parameters?: Readonly<{
    accessory_taxonomy?: Readonly<{
      primary_muscle_group?: string | null;
      secondary_muscle_groups?: readonly string[] | null;
    }> | null;
  }> | null;
}>;

type Evidence = Readonly<{
  performed_canonical_movement_definition_id?: number | null;
  performed_canonical_movement_identity?: MovementArtDefinition | null;
  primary_muscle_group_snapshot?: string | null;
  secondary_muscle_groups_snapshot?: readonly string[] | null;
  identity_snapshot?: Readonly<{
    performed_canonical_movement_definition_id?: number | null;
    primary_muscle_group?: string | null;
    secondary_muscle_groups?: readonly string[] | null;
  }> | null;
}>;

/** Serialized movement/evidence contracts. Deliberately has no generic `id`. */
export type CanonicalMovementArtworkInput = Evidence & Readonly<{
  key?: string | null;
  family?: string | null;
  kind?: string | null;
  identity_type?: string | null;
  lift?: string | null;
  variant?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: readonly string[] | null;
  equipment_type?: string | null;
  core_family?: string | null;
  core_kind?: string | null;
  movement_definition_id?: number | null;
  effective_movement_definition_id?: number | null;
  core_movement_id?: number | null;
  movement_identity?: MovementArtDefinition | null;
  performed_movement_identity?: MovementArtDefinition | null;
  effective_movement_identity?: MovementArtDefinition | null;
  is_substituted?: boolean | null;
  core_movement?: MovementArtDefinition | null;
  performed_core_movement?: MovementArtDefinition | null;
  item_id?: number | null;
  set_log_id?: number | null;
  sets?: readonly Evidence[] | number | null;
  measurement?: Readonly<{
    canonical_identity_id?: number | null;
    canonical_identity_key?: string | null;
    equipment_type?: string | null;
  }> | null;
  legacy?: Readonly<{
    state?: string | null;
    effective_movement_definition_id?: number | null;
    effective_movement_identity?: MovementArtDefinition | null;
  }> | null;
}>;

export type MovementArtFailure = 'missing_canonical_identity' | 'missing_governed_taxonomy'
  | 'unsupported_core_family' | 'conflicting_canonical_identity';

export type CanonicalMovementArtSubject = Readonly<{
  artSubjectVersion: 1;
  domain: 'core' | 'accessory' | null;
  canonicalIdentityId: number | null;
  canonicalKey: string | null;
  movementDefinitionId: number | null;
  effectiveMovementDefinitionId: number | null;
  performedMovementDefinitionId: number | null;
  family: string | null;
  primaryMuscleGroup: FocusedAccessoryMuscleRegionKey | null;
  taxonomySource?: 'identity' | 'matching_reference' | 'catalog' | null;
  secondaryMuscleGroups: readonly string[];
  equipmentType: string | null;
  coreFamily: CanonicalCoreArtworkFamily | null;
  coreVariant: boolean;
  source: 'performed_evidence' | 'performed_canonical' | 'effective' | 'performed_movement'
    | 'governed_legacy' | 'definition' | 'measurement' | 'governed_taxonomy' | 'unresolved';
  reason: MovementArtFailure | null;
  sessionItemId: number | null;
  evidenceId: number | null;
}>;

export type MovementArtInput = CanonicalMovementArtworkInput | CanonicalMovementArtSubject;
const token = (value: unknown) => String(value || '').trim().toLowerCase();
const positiveId = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const coreFamily = (value: unknown): CanonicalCoreArtworkFamily | null => {
  const family = token(value);
  return ['squat', 'bench', 'deadlift', 'press'].includes(family) ? family as CanonicalCoreArtworkFamily : null;
};
const liftFamily = (value: unknown) => ({ SQ: 'squat', BN: 'bench', BP: 'bench', DL: 'deadlift', OHP: 'press' } as const)[String(value || '').toUpperCase() as 'SQ'];
const equipmentOnly = (value?: MovementArtDefinition | null) => token(value?.key).startsWith('machine_equipment_');

function taxonomy(identity?: MovementArtDefinition | null) {
  const nested = identity?.material_parameters?.accessory_taxonomy;
  return {
    primary: focusedAccessoryMuscleRegionKey(identity?.primary_muscle_group)
      || focusedAccessoryMuscleRegionKey(nested?.primary_muscle_group)
      || focusedAccessoryMuscleRegionKey(identity?.family),
    secondary: identity?.secondary_muscle_groups || nested?.secondary_muscle_groups || [],
  };
}

/** Call only at a typed MovementDefinition/CanonicalHistory/Ledger definition boundary. */
export function canonicalArtworkInputFromDefinition(definition?: MovementArtDefinition | null): CanonicalMovementArtworkInput | null {
  if (!definition) return null;
  if (definition.identity_type === 'core' || ['core', 'competition', 'variant'].includes(token(definition.kind)) || definition.core_family) {
    return { kind: definition.kind, core_family: definition.core_family, core_kind: definition.core_kind,
      core_movement_id: definition.id, core_movement: definition };
  }
  return { kind: 'accessory', movement_definition_id: definition.id, movement_identity: definition };
}

/** One read-only subject for every artwork consumer. No labels, fuzzy matching or artwork policy. */
export function normalizeCanonicalMovementArtSubject(input?: MovementArtInput | null): CanonicalMovementArtSubject {
  if (input && 'artSubjectVersion' in input) return input;
  const row: CanonicalMovementArtworkInput = input || {};
  const base: CanonicalMovementArtSubject = {
    artSubjectVersion: 1, domain: null, canonicalIdentityId: null, canonicalKey: null,
    movementDefinitionId: positiveId(row.movement_definition_id || row.movement_identity?.id),
    effectiveMovementDefinitionId: positiveId(row.effective_movement_definition_id || row.effective_movement_identity?.id),
    performedMovementDefinitionId: positiveId(row.performed_canonical_movement_definition_id || row.performed_canonical_movement_identity?.id),
    family: null, primaryMuscleGroup: null, secondaryMuscleGroups: [], equipmentType: null,
    coreFamily: null, coreVariant: false, source: 'unresolved', reason: 'missing_canonical_identity',
    sessionItemId: positiveId(row.item_id), evidenceId: positiveId(row.set_log_id),
  };
  const fail = (reason: MovementArtFailure) => ({ ...base, reason });
  const conflicts = (a?: MovementArtDefinition | null, b?: MovementArtDefinition | null) => Boolean(a && b && (
    (positiveId(a.id) && positiveId(b.id) && positiveId(a.id) !== positiveId(b.id))
    || (a.key && b.key && a.key !== b.key)
  ));
  if (conflicts(row.effective_movement_identity, row.performed_canonical_movement_identity)) return fail('conflicting_canonical_identity');

  const core = row.performed_core_movement || row.core_movement;
  const isCore = Boolean(core || row.core_movement_id || row.core_family || row.core_kind
    || row.identity_type === 'core' || ['core', 'variant'].includes(token(row.kind)));
  if (isCore) {
    const id = positiveId(core?.id || row.core_movement_id || row.measurement?.canonical_identity_id);
    const registeredCore = governedCoreArtworkTaxonomy(id, core?.key || row.measurement?.canonical_identity_key || row.key);
    const family = coreFamily(core?.family || row.core_family || row.family) || coreFamily(registeredCore?.family) || liftFamily(row.lift) || null;
    return { ...base, domain: 'core', canonicalIdentityId: id,
      canonicalKey: core?.key || row.measurement?.canonical_identity_key || row.key || registeredCore?.key || null,
      family, coreFamily: family, coreVariant: token(core?.kind || row.core_kind || registeredCore?.core_kind || row.kind) === 'variant' || token(row.variant) === 'vr',
      source: row.performed_core_movement ? 'performed_canonical' : row.measurement ? 'measurement' : 'definition',
      reason: !id ? 'missing_canonical_identity' : !family ? 'unsupported_core_family' : null };
  }

  const evidence = Array.isArray(row.sets) ? row.sets : [row];
  const saved = evidence.filter(set => positiveId(set.performed_canonical_movement_identity?.id
    || set.performed_canonical_movement_definition_id || set.identity_snapshot?.performed_canonical_movement_definition_id));
  let identity: MovementArtDefinition | null = null;
  let identityId: number | null = null;
  let source: CanonicalMovementArtSubject['source'] = 'unresolved';
  if (saved.length) {
    const ids = saved.map(set => positiveId(set.performed_canonical_movement_identity?.id
      || set.performed_canonical_movement_definition_id || set.identity_snapshot?.performed_canonical_movement_definition_id));
    if (new Set(ids).size !== 1) return fail('conflicting_canonical_identity');
    const set = saved[0];
    identityId = ids[0];
    if (saved.some(entry => [entry.identity_snapshot?.performed_canonical_movement_definition_id, entry.performed_canonical_movement_definition_id]
      .some(value => positiveId(value) && positiveId(value) !== identityId))) return fail('conflicting_canonical_identity');
    if (saved.some(other => conflicts(set.performed_canonical_movement_identity, other.performed_canonical_movement_identity))) return fail('conflicting_canonical_identity');
    identity = set.performed_canonical_movement_identity || [row.performed_canonical_movement_identity, row.effective_movement_identity, row.movement_identity]
      .find(reference => positiveId(reference?.id) === identityId) || null;
    const matchingMeasurement = positiveId(row.measurement?.canonical_identity_id) === identityId;
    // Frozen taxonomy wins when supplied; current definition metadata only enriches the same persisted ID.
    identity = { ...(identity || {}), id: identityId,
      key: identity?.key || (matchingMeasurement ? row.measurement?.canonical_identity_key : null),
      primary_muscle_group: set.primary_muscle_group_snapshot || set.identity_snapshot?.primary_muscle_group
        || identity?.primary_muscle_group || (matchingMeasurement ? row.primary_muscle_group : null),
      secondary_muscle_groups: set.secondary_muscle_groups_snapshot || set.identity_snapshot?.secondary_muscle_groups
        || identity?.secondary_muscle_groups || (matchingMeasurement ? row.secondary_muscle_groups : null),
    };
    source = Array.isArray(row.sets) || row.identity_snapshot || row.set_log_id ? 'performed_evidence' : 'performed_canonical';
  } else if (row.performed_canonical_movement_identity) {
    identity = row.performed_canonical_movement_identity; source = 'performed_canonical';
  } else if (row.effective_movement_identity) {
    identity = row.effective_movement_identity; source = 'effective';
    if (base.effectiveMovementDefinitionId && positiveId(identity.id) !== base.effectiveMovementDefinitionId) return fail('conflicting_canonical_identity');
  } else if (base.effectiveMovementDefinitionId) {
    identityId = base.effectiveMovementDefinitionId;
    identity = positiveId(row.movement_identity?.id) === identityId ? row.movement_identity || null : { id: identityId };
    source = 'effective';
  } else if (row.performed_movement_identity && !equipmentOnly(row.performed_movement_identity)
    && (taxonomy(row.performed_movement_identity).primary
      || governedAccessoryArtworkTaxonomy(positiveId(row.performed_movement_identity.id))
      || governedAccessoryArtworkTaxonomy(null, row.performed_movement_identity.key))) {
    identity = row.performed_movement_identity; source = 'performed_movement';
  } else if (row.measurement?.canonical_identity_id) {
    identity = { id: row.measurement.canonical_identity_id, key: row.measurement.canonical_identity_key,
      family: row.family, primary_muscle_group: row.primary_muscle_group, secondary_muscle_groups: row.secondary_muscle_groups,
      equipment_type: row.measurement.equipment_type };
    source = 'measurement';
  } else {
    if (row.is_substituted) return fail('missing_canonical_identity');
    const legacy = row.legacy;
    // Historical state can remain legacy_unresolved after an owner-governed read mapping.
    // The server's explicit effective reference is authoritative; labels/state never create identity.
    if (legacy?.effective_movement_identity) {
      identity = legacy.effective_movement_identity; identityId = positiveId(legacy.effective_movement_definition_id || identity.id);
      if (positiveId(identity.id) && positiveId(identity.id) !== identityId) return fail('conflicting_canonical_identity');
      source = 'governed_legacy';
    } else if (row.movement_identity) {
      identity = { ...row.movement_identity,
        primary_muscle_group: row.movement_identity.primary_muscle_group || row.primary_muscle_group,
        secondary_muscle_groups: row.movement_identity.secondary_muscle_groups || row.secondary_muscle_groups };
      identityId = positiveId(row.movement_definition_id || identity.id);
      if (positiveId(identity.id) && positiveId(identity.id) !== identityId) return fail('conflicting_canonical_identity');
      source = 'definition';
    } else if (['accessory', 'custom'].includes(token(row.kind)) || row.identity_type === 'accessory') {
      identity = { id: row.movement_definition_id, key: row.key, family: row.family,
        primary_muscle_group: row.primary_muscle_group, secondary_muscle_groups: row.secondary_muscle_groups, equipment_type: row.equipment_type };
      source = positiveId(row.movement_definition_id) ? 'definition' : 'governed_taxonomy';
    }
  }
  if (!identity || equipmentOnly(identity)) return fail('missing_canonical_identity');
  identityId = identityId || positiveId(identity.id);
  const registeredTaxonomy = governedAccessoryArtworkTaxonomy(identityId);
  if (registeredTaxonomy && identity.key && identity.key !== registeredTaxonomy.key) return fail('conflicting_canonical_identity');
  const registered = identityId ? CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[identityId as keyof typeof CANONICAL_ACCESSORY_ARTWORK_IDENTITIES]
    || RETIRED_ACCESSORY_ARTWORK_IDENTITIES[identityId as keyof typeof RETIRED_ACCESSORY_ARTWORK_IDENTITIES] : null;
  const muscles = taxonomy(identity);
  let taxonomySource: CanonicalMovementArtSubject['taxonomySource'] = muscles.primary ? 'identity' : null;
  // Enrich only references to this exact subject. A thin preferred reference
  // must not discard richer same-ID taxonomy. Programmed A cannot enrich B.
  const matchingReferences = [row.performed_canonical_movement_identity, row.effective_movement_identity,
    row.movement_identity, row.legacy?.effective_movement_identity].filter(reference => reference
      && positiveId(reference.id) === identityId && identityId != null
      && (!identity?.key || !reference.key || reference.key === identity.key));
  if (!muscles.primary) {
    const matching = matchingReferences.find(reference => taxonomy(reference).primary);
    if (matching) {
      const enriched = taxonomy(matching);
      muscles.primary = enriched.primary;
      muscles.secondary = identity.secondary_muscle_groups || enriched.secondary;
      taxonomySource = 'matching_reference';
      identity = { ...matching, ...identity, key: identity.key || matching.key, family: identity.family || matching.family,
        equipment_type: identity.equipment_type || matching.equipment_type };
    }
  }
  // A generic row's key does not establish definition identity. Key-only recovery
  // is restricted to explicitly typed definition/measurement/legacy references.
  const catalog = identityId || source !== 'governed_taxonomy'
    ? governedAccessoryArtworkTaxonomy(identityId, identity.key) : null;
  if (catalog) {
    if (!identityId) identityId = catalog.id;
    if (!muscles.primary) {
      muscles.primary = taxonomy(catalog).primary;
      muscles.secondary = identity.secondary_muscle_groups || catalog.secondary_muscle_groups || [];
      taxonomySource = 'catalog';
    }
    identity = { ...identity, key: identity.key || catalog.key, family: identity.family || catalog.family,
      equipment_type: identity.equipment_type || catalog.equipment_type };
  }
  // Retired exact registrations retain their historical anatomy provenance.
  if (!muscles.primary && registered && (!identity.key || identity.key === registered.key)) {
    muscles.primary = registered.primary;
    taxonomySource = 'catalog';
  }
  return { ...base, domain: 'accessory', canonicalIdentityId: identityId, canonicalKey: identity.key || null, taxonomySource,
    performedMovementDefinitionId: ['performed_evidence', 'performed_canonical', 'performed_movement'].includes(source) ? identityId : base.performedMovementDefinitionId,
    family: identity.family || null, primaryMuscleGroup: muscles.primary, secondaryMuscleGroups: muscles.secondary,
    equipmentType: identity.equipment_type || row.measurement?.equipment_type || null, source,
    reason: muscles.primary ? null : identityId ? 'missing_governed_taxonomy' : 'missing_canonical_identity' };
}
