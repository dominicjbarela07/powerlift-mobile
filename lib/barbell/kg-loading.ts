import {
  KG_PLATE_DENOMINATIONS_DESCENDING,
  type PlateDenominationKg,
} from './render-denomination-mapping';

export const BARBELL_EMPTY_WEIGHT_KG = 20;
export const SYMMETRICAL_LOADING_INCREMENT_KG = 2.5;

/**
 * Returns the canonical single-side kg loading for a 20 kg bar.
 *
 * This preserves the kg loading behavior previously owned by the milestones
 * layout. Render selection must consume this result rather than converting the
 * requested total into pounds.
 */
export function loadingForTotalWeightKg(totalWeightKg: number): PlateDenominationKg[] {
  if (!Number.isFinite(totalWeightKg) || totalWeightKg < BARBELL_EMPTY_WEIGHT_KG) {
    throw new Error(`Unsupported kilogram total: ${totalWeightKg}`);
  }

  let remainingPerSideKg =
    Math.round(((totalWeightKg - BARBELL_EMPTY_WEIGHT_KG) / 2) * 4) / 4;
  const loading: PlateDenominationKg[] = [];

  for (const denomination of KG_PLATE_DENOMINATIONS_DESCENDING) {
    while (remainingPerSideKg + 0.0001 >= denomination) {
      loading.push(denomination);
      remainingPerSideKg =
        Math.round((remainingPerSideKg - denomination) * 4) / 4;
    }
  }

  if (Math.abs(remainingPerSideKg) > 0.0001) {
    throw new Error(
      `Cannot represent ${totalWeightKg} kg with supported plate denominations.`,
    );
  }

  return loading;
}
