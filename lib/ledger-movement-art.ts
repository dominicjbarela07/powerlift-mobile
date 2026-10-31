import catalog from '@/config/governed-movement-art-taxonomy.json';
import { canonicalArtworkInputFromDefinition, type CanonicalMovementArtworkInput, type MovementArtDefinition } from './canonical-movement-art-subject';
import type { RecordLift } from './ledger-records';
import type { CoreVariantMovement } from './ledger-variants';
import type { ArchiveItem } from './ledger-archive';

/** Static Competition chapter identity; never a replacement for a saved set ID. */
export function ledgerCompetitionArtwork(lift: RecordLift): CanonicalMovementArtworkInput | null {
  const key = `competition_${lift}`;
  const definition = catalog.movements.find(row => row.key === key && row.kind === 'core' && row.core_kind === 'competition');
  return canonicalArtworkInputFromDefinition(definition);
}

/** A typed global Core key selects presentation only; saved source IDs stay put. */
export function ledgerCoreKeyArtwork(key?:string|null):CanonicalMovementArtworkInput|null {
  const definition=key?catalog.movements.find(row=>row.kind==='core'&&row.key===key):null;
  return canonicalArtworkInputFromDefinition(definition);
}

/** This endpoint names a CoreMovementDefinition ID, not a physical definition ID. */
export function ledgerVariantArtwork(movement: Pick<CoreVariantMovement, 'core_movement_id' | 'key' | 'family'>): CanonicalMovementArtworkInput {
  return { core_movement_id: movement.core_movement_id, key: movement.key,
    identity_type: 'core', kind: 'variant', core_kind: 'variant', core_family: movement.family, family: movement.family };
}

/** Archive/exploration references are physical MovementDefinitions. A physical
 * Core ID must never be accidentally sent as a CoreMovementDefinition ID. Thin
 * old references may be enriched only by an exact registered ID + key pair. */
export function ledgerDefinitionArtwork(definition?: MovementArtDefinition | null): CanonicalMovementArtworkInput | null {
  if (!definition || !Number.isInteger(definition.id) || Number(definition.id) <= 0) return null;
  if (definition.kind === 'core' && !definition.core_movement_definition_id) {
    const registered = catalog.movements.find(row => row.id === definition.id && row.key === definition.key && row.kind === 'core');
    return registered ? canonicalArtworkInputFromDefinition({ ...registered, ...definition,
      core_movement_definition_id: registered.core_movement_definition_id }) : null;
  }
  return canonicalArtworkInputFromDefinition(definition);
}

export function ledgerArchiveArtwork(item: Pick<ArchiveItem, 'movement'>): CanonicalMovementArtworkInput | null {
  return ledgerDefinitionArtwork(item.movement as MovementArtDefinition | null);
}
