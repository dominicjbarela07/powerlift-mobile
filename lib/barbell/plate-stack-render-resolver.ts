import {
  lookupPlateStackRenderCatalogAsset,
  type PlateStackRenderCatalogAsset,
} from './plate-stack-render-catalog';
import {
  resolvePlateStackRenderGeometry,
  type PlateStackRenderGeometry,
  type PlateStackRenderUnit,
} from './plate-stack-render-geometry';
import { renderEquivalentPlateDenominationLb } from './render-denomination-mapping';

export type PlateStackRenderRequest = Readonly<{
  weight: number;
  unit: PlateStackRenderUnit;
}>;

export type ResolvedPlateStackRender =
  PlateStackRenderGeometry
  & PlateStackRenderCatalogAsset;

/**
 * Unit-agnostic runtime entry point for the canonical plate-stack catalog.
 * Invalid physical totals and catalog misses deliberately return null so UI
 * consumers can retain their bounded render-unavailable fallback.
 */
export function resolvePlateStackRender(
  request: PlateStackRenderRequest,
): ResolvedPlateStackRender | null {
  try {
    const geometry = resolvePlateStackRenderGeometry(
      request.weight,
      request.unit,
    );
    const asset = lookupPlateStackRenderCatalogAsset(geometry.catalogKeyLb);
    return asset
      ? Object.freeze({
          ...geometry,
          ...asset,
        })
      : null;
  } catch {
    return null;
  }
}

export type PhysicalPlateStackRenderRequest = Readonly<{
  unit: PlateStackRenderUnit;
  plates_per_side: readonly Readonly<{ denomination: number; count: number }>[];
  plate_stack_known?: boolean;
}>;

const SUPPORTED_PHYSICAL_PLATES = Object.freeze({
  lb: new Set([45, 25, 10, 5, 2.5]),
  kg: new Set([20, 15, 10, 5, 2.5, 1.25]),
});

/**
 * Canonical catalog entry point for a server-resolved physical plate stack.
 * The catalog artwork represents plates, while the calling surface retains
 * the authoritative configured bar/collar mass and equation as text.
 */
export function resolvePhysicalPlateStackRender(
  request: PhysicalPlateStackRenderRequest,
): (PlateStackRenderCatalogAsset & Readonly<{ catalogKeyLb: number }>) | null {
  if (request.plate_stack_known === false) return null;
  const rendered: number[] = [];
  for (const row of request.plates_per_side || []) {
    if (!Number.isFinite(row.denomination) || !Number.isInteger(row.count) || row.count < 1) return null;
    if (!SUPPORTED_PHYSICAL_PLATES[request.unit].has(row.denomination)) return null;
    const equivalent = request.unit === 'kg'
      ? renderEquivalentPlateDenominationLb(row.denomination as never)
      : row.denomination;
    for (let count = 0; count < row.count; count += 1) rendered.push(equivalent);
  }
  const catalogKeyLb = 45 + (rendered.reduce((sum, value) => sum + value, 0) * 2);
  const asset = lookupPlateStackRenderCatalogAsset(catalogKeyLb);
  return asset ? Object.freeze({ ...asset, catalogKeyLb }) : null;
}

export type { PlateStackRenderUnit } from './plate-stack-render-geometry';
