import {
  BARBELL_EMPTY_WEIGHT_LB,
  loadingForTotalWeightLb,
} from './loading';
import { loadingForTotalWeightKg } from './kg-loading';
import {
  renderEquivalentPlateDenominationLb,
  type PlateDenominationKg,
} from './render-denomination-mapping';
import type { PlateDenominationLb } from './plate-metadata';

export type PlateStackRenderUnit = 'lb' | 'kg';

export type PlateStackRenderGeometry = Readonly<{
  requestedWeight: number;
  requestedUnit: PlateStackRenderUnit;
  platesPerSide: readonly (PlateDenominationLb | PlateDenominationKg)[];
  renderEquivalentPlatesPerSideLb: readonly PlateDenominationLb[];
  catalogKeyLb: number;
}>;

function catalogKeyForRenderPlates(
  platesPerSide: readonly PlateDenominationLb[],
): number {
  return BARBELL_EMPTY_WEIGHT_LB
    + (platesPerSide.reduce((total, denomination) => total + denomination, 0) * 2);
}

/**
 * Resolves a unit-native barbell loading into the existing unlabelled render
 * geometry. The kg branch translates plate denominations only; it never
 * converts or rounds the requested kilogram total into pounds.
 */
export function resolvePlateStackRenderGeometry(
  weight: number,
  unit: PlateStackRenderUnit,
): PlateStackRenderGeometry {
  if (unit === 'lb') {
    const platesPerSide = loadingForTotalWeightLb(weight);
    return Object.freeze({
      requestedWeight: weight,
      requestedUnit: unit,
      platesPerSide: Object.freeze([...platesPerSide]),
      renderEquivalentPlatesPerSideLb: Object.freeze([...platesPerSide]),
      catalogKeyLb: catalogKeyForRenderPlates(platesPerSide),
    });
  }

  const platesPerSide = loadingForTotalWeightKg(weight);
  const renderEquivalentPlatesPerSideLb = platesPerSide.map(
    renderEquivalentPlateDenominationLb,
  );
  return Object.freeze({
    requestedWeight: weight,
    requestedUnit: unit,
    platesPerSide: Object.freeze([...platesPerSide]),
    renderEquivalentPlatesPerSideLb: Object.freeze([
      ...renderEquivalentPlatesPerSideLb,
    ]),
    catalogKeyLb: catalogKeyForRenderPlates(renderEquivalentPlatesPerSideLb),
  });
}

export function plateStackCatalogKeyForWeight(
  weight: number,
  unit: PlateStackRenderUnit,
): number {
  return resolvePlateStackRenderGeometry(weight, unit).catalogKeyLb;
}
