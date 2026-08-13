import type { PlateDenominationLb } from './plate-metadata';

export type PlateDenominationKg = 20 | 15 | 10 | 5 | 2.5 | 1.25;

export type RenderDenominationMapping = Readonly<{
  kg: PlateDenominationKg;
  renderEquivalentLb: PlateDenominationLb;
}>;

/**
 * The sole kg-to-render geometry mapping.
 *
 * These values do not convert units. They select the existing unlabelled plate
 * model with the same physical role in the corresponding kg plate inventory.
 */
export const KG_RENDER_DENOMINATION_MAPPING: readonly RenderDenominationMapping[] =
  Object.freeze([
    Object.freeze({ kg: 20, renderEquivalentLb: 45 }),
    Object.freeze({ kg: 15, renderEquivalentLb: 35 }),
    Object.freeze({ kg: 10, renderEquivalentLb: 25 }),
    Object.freeze({ kg: 5, renderEquivalentLb: 10 }),
    Object.freeze({ kg: 2.5, renderEquivalentLb: 5 }),
    Object.freeze({ kg: 1.25, renderEquivalentLb: 2.5 }),
  ]);

export const KG_PLATE_DENOMINATIONS_DESCENDING: readonly PlateDenominationKg[] =
  Object.freeze(KG_RENDER_DENOMINATION_MAPPING.map(({ kg }) => kg));

const RENDER_EQUIVALENT_LB_BY_KG = new Map<PlateDenominationKg, PlateDenominationLb>(
  KG_RENDER_DENOMINATION_MAPPING.map(({ kg, renderEquivalentLb }) => [
    kg,
    renderEquivalentLb,
  ]),
);

export function renderEquivalentPlateDenominationLb(
  denominationKg: PlateDenominationKg,
): PlateDenominationLb {
  const denominationLb = RENDER_EQUIVALENT_LB_BY_KG.get(denominationKg);
  if (denominationLb == null) {
    throw new Error(`Unsupported kilogram plate denomination: ${denominationKg}`);
  }
  return denominationLb;
}
