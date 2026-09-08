import {
  normalizeMuscleIds,
  normalizeMuscleRoles,
  type AnatomySize,
  type GovernedMuscleId,
} from './anatomy-system';

export type AnatomyFigureView = 'front' | 'rear';
export type AnatomyFramingPreset = 'thumbnail' | 'card' | 'hero' | 'dual';

export type AnatomyBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type AnatomyFraming = Readonly<{
  view: AnatomyFigureView;
  preset: AnatomyFramingPreset;
  targetBounds: AnatomyBounds;
  viewBox: AnatomyBounds;
  destinationAspectRatio: number;
  scale: number;
  translateX: number;
  translateY: number;
  isFullBody: boolean;
}>;

const MASTER_WIDTH = 418;
const MASTER_HEIGHT = 941;
const FULL_BODY: AnatomyBounds = Object.freeze({ x: 0, y: 0, width: MASTER_WIDTH, height: MASTER_HEIGHT });

/**
 * Canonical full-figure presentation presets. The padding lives in master-image
 * coordinates, outside the authored silhouette, so even a rounded or clipped
 * consumer frame cannot shave off a head, limb, or antialiased edge.
 */
export const ANATOMY_FRAMING_PRESETS: Readonly<Record<AnatomyFramingPreset, Readonly<{
  horizontalSafePadding: number;
  verticalSafePadding: number;
}>>> = Object.freeze({
  thumbnail: Object.freeze({ horizontalSafePadding: 20, verticalSafePadding: 24 }),
  card: Object.freeze({ horizontalSafePadding: 16, verticalSafePadding: 20 }),
  hero: Object.freeze({ horizontalSafePadding: 10, verticalSafePadding: 14 }),
  dual: Object.freeze({ horizontalSafePadding: 18, verticalSafePadding: 22 }),
});

type ViewBounds = Readonly<Partial<Record<GovernedMuscleId, AnatomyBounds>>>;

// Bounds use the canonical 418 x 941 anatomy master coordinate system and are
// the union of the independently registered masculine and feminine masks. A
// crop therefore cannot be correct for one presentation while clipping the
// other. They describe highlighted geometry, never display-name inference.
const FRONT_TARGET_BOUNDS: ViewBounds = Object.freeze({
  chest: { x: 117, y: 181, width: 224, height: 121 },
  front_delts: { x: 96, y: 180, width: 266, height: 99 },
  side_delts: { x: 88, y: 188, width: 282, height: 91 },
  traps: { x: 154, y: 148, width: 150, height: 63 },
  biceps: { x: 99, y: 249, width: 260, height: 111 },
  forearms: { x: 58, y: 334, width: 342, height: 150 },
  quads: { x: 136, y: 473, width: 188, height: 201 },
  adductors: { x: 197, y: 466, width: 70, height: 183 },
  abductors: { x: 138, y: 430, width: 182, height: 101 },
  calves: { x: 127, y: 666, width: 204, height: 175 },
  abs: { x: 190, y: 273, width: 82, height: 161 },
  obliques: { x: 143, y: 274, width: 172, height: 187 },
  serratus: { x: 142, y: 264, width: 175, height: 96 },
  hip_flexors: { x: 166, y: 415, width: 128, height: 101 },
  neck: { x: 188, y: 133, width: 82, height: 72 },
});

const REAR_TARGET_BOUNDS: ViewBounds = Object.freeze({
  side_delts: { x: 76, y: 187, width: 299, height: 91 },
  rear_delts: { x: 84, y: 187, width: 279, height: 85 },
  lats: { x: 115, y: 257, width: 210, height: 174 },
  upper_back: { x: 136, y: 195, width: 170, height: 114 },
  traps: { x: 141, y: 145, width: 163, height: 185 },
  triceps: { x: 83, y: 247, width: 278, height: 118 },
  forearms: { x: 43, y: 342, width: 363, height: 145 },
  hamstrings: { x: 121, y: 517, width: 200, height: 177 },
  glutes: { x: 121, y: 411, width: 199, height: 131 },
  abductors: { x: 120, y: 417, width: 202, height: 96 },
  calves: { x: 105, y: 671, width: 233, height: 171 },
  lower_back: { x: 152, y: 330, width: 138, height: 117 },
  neck: { x: 169, y: 105, width: 105, height: 88 },
});

function unionBounds(bounds: readonly AnatomyBounds[]): AnatomyBounds {
  if (!bounds.length) return FULL_BODY;
  const left = Math.min(...bounds.map((bound) => bound.x));
  const top = Math.min(...bounds.map((bound) => bound.y));
  const right = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

const framingCache = new Map<string, AnatomyFraming>();

export function resolveAnatomyFraming(input: Readonly<{
  primary?: readonly unknown[] | null;
  secondary?: readonly unknown[] | null;
  view: AnatomyFigureView;
  destinationAspectRatio: number;
  size?: AnatomySize;
  preset: AnatomyFramingPreset;
  preserveAll?: boolean;
}>): AnatomyFraming {
  const roles = input.preserveAll
    ? { primary: normalizeMuscleIds(input.primary), secondary: normalizeMuscleIds(input.secondary) }
    : normalizeMuscleRoles(input.primary, input.secondary);
  const allMuscles = [...roles.primary, ...roles.secondary];
  const aspect = Math.round(Math.min(3, Math.max(0.24, Number(input.destinationAspectRatio) || 1)) * 20) / 20;
  const size = input.size || 'card';
  const preset = input.preset;
  const cacheKey = [input.view, preset, size, aspect, input.preserveAll ? 'all' : 'roles', [...roles.primary].sort(), [...roles.secondary].sort()].join(':');
  const cached = framingCache.get(cacheKey);
  if (cached) return cached;

  const registry = input.view === 'front' ? FRONT_TARGET_BOUNDS : REAR_TARGET_BOUNDS;
  const visibleMuscles = allMuscles.filter((muscle) => Boolean(registry[muscle]));
  const rawTargetBounds = unionBounds(visibleMuscles.map((muscle) => registry[muscle]!));
  const safePadding = ANATOMY_FRAMING_PRESETS[preset];
  const viewBox: AnatomyBounds = Object.freeze({
    x: -safePadding.horizontalSafePadding,
    y: -safePadding.verticalSafePadding,
    width: MASTER_WIDTH + safePadding.horizontalSafePadding * 2,
    height: MASTER_HEIGHT + safePadding.verticalSafePadding * 2,
  });

  const framing: AnatomyFraming = Object.freeze({
    view: input.view,
    preset,
    targetBounds: rawTargetBounds,
    viewBox,
    destinationAspectRatio: aspect,
    scale: MASTER_HEIGHT / viewBox.height,
    translateX: -viewBox.x * (MASTER_HEIGHT / viewBox.height),
    translateY: -viewBox.y * (MASTER_HEIGHT / viewBox.height),
    isFullBody: true,
  });
  if (framingCache.size >= 240) framingCache.clear();
  framingCache.set(cacheKey, framing);
  return framing;
}

export function anatomyBoundsContains(container: AnatomyBounds, target: AnatomyBounds): boolean {
  const epsilon = 0.01;
  return target.x + epsilon >= container.x
    && target.y + epsilon >= container.y
    && target.x + target.width <= container.x + container.width + epsilon
    && target.y + target.height <= container.y + container.height + epsilon;
}
