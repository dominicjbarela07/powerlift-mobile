export type PlateDenominationLb = 45 | 35 | 25 | 10 | 5 | 2.5;

type PlateMetadata = {
  key: string;
  /**
   * Model-space axial thickness in Blender units, measured along global X
   * after the exported node rotation. Values are editable tuning inputs.
   * The exported meshes are bore-centred; no inter-plate spacing correction
   * is applied.
   */
  thickness: number;
};

/**
 * Canonical denomination metadata for every loaded sleeve in the app.
 * Bounds were measured from the exported GLB node geometry after its node
 * scale: 45=.04445, 35=.03802, 25=.03062, 10=.01905, 5=.01630,
 * 2.5=.01444 model units along the sleeve X axis.
 */
export const PLATE_METADATA: Record<PlateDenominationLb, PlateMetadata> = {
  45: { key: '45', thickness: 0.04445 },
  35: { key: '35', thickness: 0.03802 },
  25: { key: '25', thickness: 0.03062 },
  10: { key: '10', thickness: 0.01905 },
  5: { key: '5', thickness: 0.0163 },
  2.5: { key: '2.5', thickness: 0.01444 },
};

// Physical loading intentionally excludes 35 lb plates. The 35 lb mesh stays
// registered only as the render-equivalent artwork for canonical 15 kg plates.
export const PLATE_DENOMINATIONS_DESCENDING: readonly PlateDenominationLb[] = [45, 25, 10, 5, 2.5];

export function isPlateDenomination(value: number): value is PlateDenominationLb {
  return Object.prototype.hasOwnProperty.call(PLATE_METADATA, value);
}
