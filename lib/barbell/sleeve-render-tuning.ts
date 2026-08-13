import type { PlateDenominationLb } from '@/lib/barbell/plate-metadata';

// Both presets use the same GLB renderer. `hero` is the large card header;
// `milestone` is the compact progression rail.
export type SleeveCameraPreset = 'hero' | 'milestone';

type Vector3 = readonly [number, number, number];

export type PlateRenderTransform = {
  /** Local position nudge in exported Blender coordinates. */
  offset: Vector3;
  /** Rotation added on top of the authored model orientation. */
  rotationDegrees: Vector3;
  /** Non-uniform local scale. Use only for render framing, never loading math. */
  scale: Vector3;
  /** Axial gap inserted before this denomination's plate, after the prior plate. */
  gapFromPrevious: number;
};

export type ObjectRenderTransform = {
  offset: Vector3;
  rotationDegrees: Vector3;
  scale: Vector3;
};

export type SleeveRenderTuning = {
  /** Smaller values zoom in; this controls lens framing, not plate geometry. */
  fov: number;
  /** Camera position in exported Blender world coordinates. */
  cameraPosition: Vector3;
  /** The point the camera is aimed at. Keep Y near the plate hub height. */
  lookAt: Vector3;
  /** Uniform visual scale for the entire finished assembly. */
  assemblyScale: number;
  /** Additional non-uniform assembly scale for visual tuning. */
  assemblyScaleXYZ: Vector3;
  /** Move the entire rendered assembly inside its React Native stage. */
  assemblyOffset: Vector3;
  /** Rotate the entire rendered assembly in degrees: [x, y, z]. */
  assemblyRotationDegrees: Vector3;
  /** Local transform for the collar + Olympic sleeve GLB only. */
  sleeveTransform: ObjectRenderTransform;
  ambientIntensity: number;
  keyLightPosition: Vector3;
  keyLightIntensity: number;
  currentKeyLightIntensity: number;
  fillLightPosition: Vector3;
  fillLightIntensity: number;
  currentFillLightIntensity: number;
  /** Per-denomination live controls. These never change loading calculations. */
  plateTransforms: Partial<Record<PlateDenominationLb, PlateRenderTransform>>;
};

/**
 * HERO SUPPORT-SURFACE TUNING
 *
 * This is intentionally separate from the hero camera/assembly controls
 * above. `verticalOffset` is applied to the dynamically measured lowest
 * world-space point of the finished hero assembly: floorY = lowestY + offset.
 * The contact shadow follows those completed world-space bounds. The support
 * plane deliberately extends beyond the hero camera's far range so its
 * perimeter can never enter the crop. None of these values can move or
 * rescale the assembly.
 */
export const HERO_FLOOR_TUNING = {
  verticalOffset: -0.002,
  surface: {
    width: 24,
    depth: 24,
    color: '#0F1722',
    opacity: 0.04,
    roughness: 0.88,
    metalness: 0.035,
    reflectivity: 0.14,
  },
  shadow: {
    mapSize: 2048,
    softness: 2.2,
    bias: -0.0003,
    normalBias: 0.012,
    castOpacity: 0.22,
    contactOpacity: 0.18,
    contactWidthScale: 0.92,
    contactDepthScale: 0.58,
    contactOffsetXScale: -0.045,
    contactOffsetZScale: 0.04,
  },
  lighting: {
    hemisphereMultiplier: 0.52,
    keyMultiplier: 1.36,
    fillMultiplier: 0.92,
    rimIntensity: 0.82,
  },
  material: {
    plateMetalness: 0.62,
    plateRoughness: 0.64,
    plateCurrentEmissive: 0.018,
    sleeveMetalness: 0.68,
    sleeveRoughness: 0.22,
    sleeveEmissive: '#0E141A',
  },
} as const;

/**
 * USER RENDER TUNING
 *
 * Keep this in its own non-component module. Editing a value here lets Expo
 * refresh the affected sleeve canvas without treating app navigation as a
 * component-module refresh.
 *
 * `hero` controls only the large header sleeve. It never changes loading,
 * assets, or plate offsets. Adjusting these values refreshes only the hero.
 * Fast Refresh should retain the current route while this file changes.
 */
export const SLEEVE_RENDER_TUNING: Record<SleeveCameraPreset, SleeveRenderTuning> = {
  hero: {
    fov: 30,
    cameraPosition: [1.35, 0.46, 0.58],
    lookAt: [0.11, 0.225, 0],
    assemblyScale: 1.65,
    assemblyScaleXYZ: [1, 1, 1],
    assemblyOffset: [-0.3, -0.16, 0],
    assemblyRotationDegrees: [0, 28, 0],
    sleeveTransform: { offset: [0.2, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1] },
    ambientIntensity: 1.1,
    keyLightPosition: [1.4, 2.9, 2.4],
    keyLightIntensity: 2.9,
    currentKeyLightIntensity: 1.6,
    fillLightPosition: [-0.45, 0.45, 0.7],
    fillLightIntensity: 0.28,
    currentFillLightIntensity: 0.72,
    plateTransforms: {
      45: { offset: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1], gapFromPrevious: 0.002 },
    },
  },
  milestone: {
    fov: 30,
    cameraPosition: [1.12, 0.37, 0.48],
    lookAt: [0.11, 0.225, 0],
    assemblyScale: 1.4,
    assemblyScaleXYZ: [1, 1, 1],
    assemblyOffset: [-0.2, -0.11, 0],
    assemblyRotationDegrees: [0, 35, 0],
    sleeveTransform: { offset: [0.2, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1] },
    ambientIntensity: 1.5,
    keyLightPosition: [1.4, 1.1, 1.8],
    keyLightIntensity: 1.6,
    currentKeyLightIntensity: 2.1,
    fillLightPosition: [-0.45, 0.45, 0.7],
    fillLightIntensity: 0.28,
    currentFillLightIntensity: 0.72,
    plateTransforms: {
      45: { offset: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1], gapFromPrevious: 0.002 },
    },
  },
};
