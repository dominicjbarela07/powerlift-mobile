import { PLATE_DENOMINATIONS_DESCENDING, PLATE_METADATA, type PlateDenominationLb } from './plate-metadata';

/** A 45 lb bar plus matched left/right plates can only change total load by 5 lb. */
export const BARBELL_EMPTY_WEIGHT_LB = 45;
export const SYMMETRICAL_LOADING_INCREMENT_LB = 5;

/**
 * Converts an arbitrary display/unit-conversion value to a load that can be
 * assembled with the paired plate inventory. Keep this at the unit boundary;
 * `loadingForTotalWeightLb` deliberately remains strict and will reject an
 * invalid physical total such as 662.5 lb.
 */
export function nearestSupportedTotalWeightLb(totalWeightLb: number): number {
  if (!Number.isFinite(totalWeightLb)) throw new Error(`Unsupported total weight: ${totalWeightLb}`);
  return Math.max(BARBELL_EMPTY_WEIGHT_LB, BARBELL_EMPTY_WEIGHT_LB + Math.round((totalWeightLb - BARBELL_EMPTY_WEIGHT_LB) / SYMMETRICAL_LOADING_INCREMENT_LB) * SYMMETRICAL_LOADING_INCREMENT_LB);
}

export type PlatePlacement = {
  denomination: PlateDenominationLb;
  /** Bore-centre position along the fixed sleeve X axis. */
  x: number;
};

/**
 * Converts a barbell total into a single side's plates. The caller owns any
 * unit conversion; this helper always uses a 45 lb bar and preserves physical
 * inside-to-outside loading order.
 */
export function loadingForTotalWeightLb(totalWeightLb: number): PlateDenominationLb[] {
  const sideLoad = (totalWeightLb - BARBELL_EMPTY_WEIGHT_LB) / 2;
  if (!Number.isFinite(sideLoad) || sideLoad < 0) throw new Error(`Unsupported total weight: ${totalWeightLb}`);

  let remaining = Math.round(sideLoad * 2) / 2;
  const loading: PlateDenominationLb[] = [];
  for (const denomination of PLATE_DENOMINATIONS_DESCENDING) {
    while (remaining + 0.0001 >= denomination) {
      loading.push(denomination);
      remaining = Math.round((remaining - denomination) * 2) / 2;
    }
  }
  if (Math.abs(remaining) > 0.0001) throw new Error(`Cannot represent ${totalWeightLb} lb with supported plate denominations.`);
  return loading;
}

/**
 * The exported plate nodes are bore-centred, so each plate centre is placed at
 * the current inner-face cursor plus one half of its metadata thickness. Every
 * downstream location therefore follows the single canonical metadata table.
 */
export function platePlacements(plates: readonly PlateDenominationLb[]): PlatePlacement[] {
  let innerFaceOffset = 0;
  return plates.map((denomination) => {
    const metadata = PLATE_METADATA[denomination];
    if (!metadata) throw new Error(`Unsupported plate denomination: ${denomination}`);
    const placement = { denomination, x: innerFaceOffset + metadata.thickness / 2 };
    innerFaceOffset += metadata.thickness;
    return placement;
  });
}
