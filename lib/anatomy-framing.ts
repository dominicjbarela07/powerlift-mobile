import {
  normalizeMuscleRoles,
  type AnatomySize,
  type GovernedMuscleId,
} from './anatomy-system';

export type AnatomyFigureView = 'front' | 'rear';
export type AnatomyFramingSurface = 'auto' | 'wide' | 'square' | 'preview' | 'portrait';

export type AnatomyBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type AnatomyFraming = Readonly<{
  view: AnatomyFigureView;
  surface: Exclude<AnatomyFramingSurface, 'auto'>;
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

const UPPER_TORSO_CONTEXT: AnatomyBounds = Object.freeze({ x: 68, y: 112, width: 322, height: 370 });
const ARM_CONTEXT: AnatomyBounds = Object.freeze({ x: 65, y: 155, width: 330, height: 350 });
const CORE_CONTEXT: AnatomyBounds = Object.freeze({ x: 108, y: 175, width: 244, height: 340 });
const THIGH_CONTEXT: AnatomyBounds = Object.freeze({ x: 88, y: 378, width: 282, height: 370 });
const CALF_CONTEXT: AnatomyBounds = Object.freeze({ x: 92, y: 590, width: 276, height: 330 });
const NECK_CONTEXT: AnatomyBounds = Object.freeze({ x: 120, y: 66, width: 220, height: 225 });

function contextForMuscle(muscle: GovernedMuscleId): AnatomyBounds {
  if (muscle === 'biceps' || muscle === 'triceps' || muscle === 'forearms') return ARM_CONTEXT;
  if (muscle === 'abs' || muscle === 'obliques' || muscle === 'serratus' || muscle === 'lower_back') return CORE_CONTEXT;
  if (muscle === 'quads' || muscle === 'hamstrings' || muscle === 'glutes' || muscle === 'adductors' || muscle === 'abductors' || muscle === 'hip_flexors') return THIGH_CONTEXT;
  if (muscle === 'calves') return CALF_CONTEXT;
  if (muscle === 'neck') return NECK_CONTEXT;
  return UPPER_TORSO_CONTEXT;
}
function unionBounds(bounds: readonly AnatomyBounds[]): AnatomyBounds {
  if (!bounds.length) return FULL_BODY;
  const left = Math.min(...bounds.map((bound) => bound.x));
  const top = Math.min(...bounds.map((bound) => bound.y));
  const right = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function classifySurface(
  destinationAspectRatio: number,
  size: AnatomySize,
  requested: AnatomyFramingSurface,
): Exclude<AnatomyFramingSurface, 'auto'> {
  if (requested !== 'auto') return requested;
  if (size === 'thumbnail') return 'preview';
  if (destinationAspectRatio >= 1.18) return 'wide';
  if (destinationAspectRatio >= 0.78) return 'square';
  return 'portrait';
}

function interpolateContext(target: AnatomyBounds, context: AnatomyBounds, weight: number): AnatomyBounds {
  const left = target.x + (Math.min(target.x, context.x) - target.x) * weight;
  const top = target.y + (Math.min(target.y, context.y) - target.y) * weight;
  const right = target.x + target.width
    + (Math.max(target.x + target.width, context.x + context.width) - (target.x + target.width)) * weight;
  const bottom = target.y + target.height
    + (Math.max(target.y + target.height, context.y + context.height) - (target.y + target.height)) * weight;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function clampAxis(start: number, length: number, maximum: number): readonly [number, number] {
  const boundedLength = Math.max(1, length);
  if (boundedLength >= maximum) return [(maximum - boundedLength) / 2, boundedLength];
  const boundedStart = Math.min(maximum - boundedLength, Math.max(0, start));
  return [boundedStart, boundedLength];
}

function fitAspect(bounds: AnatomyBounds, destinationAspectRatio: number): AnatomyBounds {
  const aspect = Math.min(3, Math.max(0.24, destinationAspectRatio));
  let width = bounds.width;
  let height = bounds.height;
  if (width / height < aspect) width = height * aspect;
  else height = width / aspect;
  const [x, clampedWidth] = clampAxis(bounds.x + bounds.width / 2 - width / 2, width, MASTER_WIDTH);
  const [y, clampedHeight] = clampAxis(bounds.y + bounds.height / 2 - height / 2, height, MASTER_HEIGHT);
  return { x, y, width: clampedWidth, height: clampedHeight };
}

function trueFullBodyTarget(muscles: readonly GovernedMuscleId[]): boolean {
  const upper = muscles.some((muscle) => ['chest', 'front_delts', 'side_delts', 'rear_delts', 'lats', 'upper_back', 'traps', 'biceps', 'triceps'].includes(muscle));
  const lower = muscles.some((muscle) => ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'].includes(muscle));
  return muscles.length >= 7 || (muscles.length >= 6 && upper && lower);
}

const framingCache = new Map<string, AnatomyFraming>();

export function resolveAnatomyFraming(input: Readonly<{
  primary?: readonly unknown[] | null;
  secondary?: readonly unknown[] | null;
  view: AnatomyFigureView;
  destinationAspectRatio: number;
  size?: AnatomySize;
  surface?: AnatomyFramingSurface;
}>): AnatomyFraming {
  const roles = normalizeMuscleRoles(input.primary, input.secondary);
  const allMuscles = [...roles.primary, ...roles.secondary];
  const aspect = Math.round(Math.min(3, Math.max(0.24, Number(input.destinationAspectRatio) || 1)) * 20) / 20;
  const size = input.size || 'card';
  const surface = classifySurface(aspect, size, input.surface || 'auto');
  const cacheKey = [input.view, surface, size, aspect, [...roles.primary].sort(), [...roles.secondary].sort()].join(':');
  const cached = framingCache.get(cacheKey);
  if (cached) return cached;

  const registry = input.view === 'front' ? FRONT_TARGET_BOUNDS : REAR_TARGET_BOUNDS;
  const visibleMuscles = allMuscles.filter((muscle) => Boolean(registry[muscle]));
  const rawTargetBounds = unionBounds(visibleMuscles.map((muscle) => registry[muscle]!));
  const isFullBody = trueFullBodyTarget(allMuscles) || !visibleMuscles.length;
  let viewBox = FULL_BODY;

  if (!isFullBody) {
    const contextBounds = unionBounds(visibleMuscles.map(contextForMuscle));
    const baseWeight = surface === 'preview' ? 0.54 : surface === 'wide' ? 0.62 : surface === 'square' ? 0.74 : 0.68;
    const breadthAdjustment = Math.min(0.16, Math.max(0, visibleMuscles.length - 1) * 0.035);
    const contextual = interpolateContext(rawTargetBounds, contextBounds, baseWeight + breadthAdjustment);
    viewBox = fitAspect(contextual, aspect);
  }

  const framing: AnatomyFraming = Object.freeze({
    view: input.view,
    surface,
    targetBounds: rawTargetBounds,
    viewBox,
    destinationAspectRatio: aspect,
    scale: MASTER_HEIGHT / viewBox.height,
    translateX: -viewBox.x * (MASTER_HEIGHT / viewBox.height),
    translateY: -viewBox.y * (MASTER_HEIGHT / viewBox.height),
    isFullBody,
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
