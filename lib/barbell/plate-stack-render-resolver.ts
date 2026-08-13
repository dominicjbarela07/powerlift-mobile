import {
  lookupPlateStackRenderCatalogAsset,
  type PlateStackRenderCatalogAsset,
} from './plate-stack-render-catalog';
import {
  resolvePlateStackRenderGeometry,
  type PlateStackRenderGeometry,
  type PlateStackRenderUnit,
} from './plate-stack-render-geometry';

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

export type { PlateStackRenderUnit } from './plate-stack-render-geometry';
