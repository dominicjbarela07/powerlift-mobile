export type Focal = Readonly<{ focalX: number; focalY: number; scale: number; biasX: number; biasY: number }>;
export type Presentation = Focal & Readonly<{ thumbnailFocalX?: number; thumbnailFocalY?: number; thumbnailScale?: number; cropMode?: 'contain' | 'focal' }>;
type Geometry = { width: number; height: number; left: number; top: number };
export const DEFAULT_FOCAL: Focal;
export function thumbnailGeometry(size: number, focal: Focal, preset?: Partial<Presentation>): Geometry;
export function movementHeroGeometry(width: number, height: number, focal: Presentation): Geometry;
