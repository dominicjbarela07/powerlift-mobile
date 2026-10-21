import projection from '@/config/governed-movement-art-taxonomy.json';
import artworkReuse from '@/config/governed-movement-art-reuse.json';

/** Public catalog taxonomy, independent of exact-image generation and approval. */
export type GovernedArtworkTaxonomy = typeof projection.movements[number];
// Explicit retired definitions enrich old saved references without selecting a
// different movement or changing the active catalog. Current definitions win.
const protectedCompatibility = (projection as typeof projection & {compatibility_movements?: typeof projection.movements}).compatibility_movements || [];
const accessories = [
  ...artworkReuse.legacy_artwork_identities.map(row => row.taxonomy),
  ...protectedCompatibility.filter(row => row.kind === 'accessory'),
  ...projection.movements.filter(row => row.kind === 'accessory'),
];
const byId = new Map(accessories.map(row => [row.id, row]));
const byKey = new Map(accessories.map(row => [row.key, row]));
const coreById = new Map(projection.movements.filter(row => row.kind === 'core' && row.core_movement_definition_id)
  .map(row => [row.core_movement_definition_id, row]));
const publicByKey = new Map([
  ...artworkReuse.legacy_artwork_identities.map(row => row.taxonomy),
  ...protectedCompatibility, ...projection.movements,
].map(row => [row.key, row]));

/** Only an explicit typed global server reference may cross database sequences.
 * This enriches artwork metadata; it never changes the reference's current ID.
 */
export function governedGlobalArtworkTaxonomy(reference?: {
  id?: number | null; key?: string | null; kind?: string | null;
  family?: string | null; ownership_scope?: string | null;
} | null) {
  if (reference?.ownership_scope !== 'global' || !reference.key
    || !Number.isInteger(reference.id) || Number(reference.id) <= 0) return null;
  const registered = publicByKey.get(reference.key);
  return registered && reference.kind === registered.kind
    && (!reference.family || reference.family === registered.family) ? registered : null;
}

/** A named CoreMovementDefinition reference is already a global typed catalog
 * boundary. Its immutable key, family and competition/variant kind must agree.
 */
export function governedCoreArtworkReference(reference?: {
  id?: number | null; key?: string | null; family?: string | null; kind?: string | null;
} | null) {
  if (!reference?.key || !Number.isInteger(reference.id) || Number(reference.id) <= 0) return null;
  const registered = publicByKey.get(reference.key);
  return registered?.kind === 'core' && 'core_kind' in registered && reference.family === registered.family
    && reference.kind === registered.core_kind ? registered : null;
}

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
