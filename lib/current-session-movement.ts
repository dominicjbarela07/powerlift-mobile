import catalog from '@/config/governed-movement-art-taxonomy.json';

type Row = Record<string, any>;
const byId = new Map(catalog.movements.map(row => [row.id, row]));
const byKey = new Map(catalog.movements.map(row => [row.key, row]));
const byCoreId = new Map(catalog.movements.filter(row => row.kind === 'core').map(row => [row.core_movement_definition_id, row]));
const id = (value: unknown): number | null => (typeof value === 'number' || typeof value === 'string')
  && Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const equipmentOnly = (ref?: Row | null) => String(ref?.key || '').startsWith('machine_equipment_')
  || Boolean(ref?.manufacturer?.id && ref?.implementation_key);

/** Decode the old wire protocol once. These fields never compete in current state. */
function decodeLegacyMovementId(row: Row): number | null {
  const claims = [row.effective_movement_definition_id, row.effective_movement_identity?.id,
    row.performed_canonical_movement_definition_id, row.performed_canonical_movement_identity?.id].map(id).filter(Boolean);
  if (new Set(claims).size > 1) return null;
  for (const ref of [row.movement_identity, row.effective_movement_identity, row.performed_canonical_movement_identity]) {
    const known = byId.get(id(ref?.id) || -1);
    if (known && ref?.key && ref.key !== known.key) return null;
  }
  const scalar = id(row.effective_movement_definition_id) || id(row.performed_canonical_movement_definition_id);
  const refs = [row.effective_movement_identity, row.performed_canonical_movement_identity,
    equipmentOnly(row.performed_movement_identity) ? null : row.performed_movement_identity];
  const explicit = scalar || refs.map(ref => id(ref?.id)).find(Boolean);
  if (explicit) return explicit;
  const core = row.performed_core_movement || row.core_movement;
  const coreDefinition = byCoreId.get(id(core?.id || row.core_movement_id));
  if (coreDefinition) return coreDefinition.id;
  if (row.is_substituted) return null;
  return id(row.movement_definition_id) || (equipmentOnly(row.movement_identity) ? null : id(row.movement_identity?.id))
    || id(row.legacy?.effective_movement_definition_id) || id(row.legacy?.effective_movement_identity?.id)
    || byKey.get(row.movement_identity?.key)?.id || null;
}

/**
 * Current Session DTO. Initial GET and Swap replies cross this same boundary.
 * Contract 1 takes only movement_definition_id; legacy fields are wire adapters
 * and provenance, never alternate authorities after decoding.
 */
export function normalizeCurrentWorkoutItem<T extends object>(input: T) {
  const row = input as Row;
  const currentId = row.movement_identity_contract === 1 ? id(row.movement_definition_id) : decodeLegacyMovementId(row);
  const registered = currentId ? byId.get(currentId) : null;
  const refs = [row.movement_identity, row.effective_movement_identity, row.performed_canonical_movement_identity,
    row.performed_movement_identity, row.legacy?.effective_movement_identity];
  const matching = refs.filter(ref => ref && id(ref.id) === currentId && !equipmentOnly(ref));
  const identity: Row | null = currentId ? { ...registered, ...Object.assign({}, ...matching.reverse()), id: currentId } : null;
  if (identity && registered) {
    for (const [key, value] of Object.entries(registered)) if (identity[key] == null) identity[key] = value;
    identity.key = registered.key; // Canonical ID owns its key, regardless of stale presentation data.
  }
  const coreId = id(identity?.core_movement_definition_id);
  const oldCore = [row.core_movement, row.performed_core_movement].find(ref => id(ref?.id) === coreId);
  const core = coreId ? { ...identity, ...oldCore, id: coreId, kind: registered?.core_kind || oldCore?.kind } : null;
  return {
    ...input,
    movement_identity_contract: 1 as const,
    movement_definition_id: currentId,
    movement_identity: identity,
    movement: identity?.display_name || row.movement,
    // Compatibility presentation aliases all derive from the one current ID.
    effective_movement_definition_id: currentId,
    effective_movement_identity: identity,
    performed_canonical_movement_definition_id: currentId,
    performed_canonical_movement_identity: identity,
    performed_movement_identity: equipmentOnly(row.performed_movement_identity) ? row.performed_movement_identity : identity,
    core_movement_id: coreId,
    core_movement: core,
    performed_core_movement: core,
  };
}

/** Only known Session containers are decoded; immutable SetLogs/recaps stay intact. */
export function normalizeSessionMovementResponse<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  const envelope = value as Row;
  const workout = envelope.workout;
  const normalizeGroups = (groups: any[]) => groups.map(group => ({ ...group, items: (group.items || []).map(normalizeCurrentWorkoutItem) }));
  const result: Row = { ...envelope };
  if (workout && (Array.isArray(workout.core_items) || Array.isArray(workout.accessory_groups))) {
    result.workout = { ...workout,
      ...(Array.isArray(workout.core_items) ? { core_items: workout.core_items.map(normalizeCurrentWorkoutItem) } : {}),
      ...(Array.isArray(workout.accessory_groups) ? { accessory_groups: normalizeGroups(workout.accessory_groups) } : {}),
    };
  }
  for (const key of ['core_items', 'acc_items']) {
    if (Array.isArray(envelope[key])) result[key] = envelope[key].map(normalizeCurrentWorkoutItem);
  }
  if (envelope.item && typeof envelope.item === 'object' && (
    'movement_definition_id' in envelope.item || 'effective_movement_identity' in envelope.item
  )) result.item = normalizeCurrentWorkoutItem(envelope.item);
  return result as T;
}
