export type Focal = Readonly<{ focalX: number; focalY: number; scale: number; biasX: number; biasY: number }>;
export type Presentation = Focal & Readonly<{ thumbnailFocalX?: number; thumbnailFocalY?: number; thumbnailScale?: number; cropMode?: 'contain' | 'focal' }>;
type Geometry = { width: number; height: number; left: number; top: number };
export const DEFAULT_FOCAL: Focal;
export type MovementAtmosphereFraming = Readonly<{ sourceWidth: number; sourceHeight: number; left: number; right: number; top: number; bottom: number }>;
export function movementAtmosphereHeaderHeight(width: number, framing?: MovementAtmosphereFraming, captionHeight?: number): number;
export function thumbnailGeometry(size: number, focal: Focal, preset?: Partial<Presentation>): Geometry;
export function movementHeroGeometry(width: number, height: number, focal: Presentation, crop?: LoggerCrop): Geometry;
export function movementHeroSourceFrame(box: Geometry, sourceWidth?: number, sourceHeight?: number): Geometry;
export function movementAtmosphereFrame(box: Geometry, sourceWidth: number | undefined, sourceHeight: number | undefined, width: number, height: number, framing?: MovementAtmosphereFraming): Geometry;

export type LoggerCrop = Readonly<{ fit: 'original' | 'contain' | 'focal'; zoom: number; x: number; y: number }>;
export const DEFAULT_LOGGER_CROP: LoggerCrop;
