import projection from '@/config/governed-movement-art-taxonomy.json';
import artworkReuse from '@/config/governed-movement-art-reuse.json';

/** Public catalog taxonomy, independent of exact-image generation and approval. */
export type GovernedArtworkTaxonomy = typeof projection.movements[number];
// Explicit retired definitions enrich old saved references without selecting a
// different movement or changing the active catalog. Current definitions win.
const accessories = [
  ...artworkReuse.legacy_artwork_identities.map(row => row.taxonomy),
  ...projection.movements.filter(row => row.kind === 'accessory'),
];
const byId = new Map(accessories.map(row => [row.id, row]));
const byKey = new Map(accessories.map(row => [row.key, row]));
const coreById = new Map(projection.movements.filter(row => row.kind === 'core' && row.core_movement_definition_id)
  .map(row => [row.core_movement_definition_id, row]));

export function governedAccessoryArtworkTaxonomy(id: number | null, key?: string | null) {
  const registered = id ? byId.get(id) : key ? byKey.get(key) : undefined;
  // Unknown or contradictory typed references never borrow another movement.
  if (!registered || (key && key !== registered.key)) return null;
  return registered;
}

export function governedCoreArtworkTaxonomy(coreId: number | null, key?: string | null) {
  const registered = coreId ? coreById.get(coreId) : undefined;
  return registered && (!key || key === registered.key) ? registered : null;
}
