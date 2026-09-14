// Shared by governed mobile rendering and the private DEV web review preview.
// Geometry describes composition; callers still own positive approval checks.
export const DEFAULT_FOCAL = Object.freeze({ focalX: .5, focalY: .46, scale: 1, biasX: 0, biasY: 0 });
const clamp = (n, low, high) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));

export function thumbnailGeometry(size, focal, preset = {}) {
  const edge = size * (preset.cropMode === 'contain' ? 1 : (preset.thumbnailScale || 1));
  return { width: edge, height: edge,
    left: Math.min(0, Math.max(size - edge, size * .5 - edge * (preset.thumbnailFocalX ?? focal.focalX))),
    top: Math.min(0, Math.max(size - edge, size * .48 - edge * (preset.thumbnailFocalY ?? focal.focalY))) };
}

export function movementHeroGeometry(width, height, focal) {
  const size = Math.min(360, height * 1.08) * clamp(focal.scale, .8, 1.25);
  const x = width * (.77 + clamp(focal.biasX, -.12, .12));
  const y = height * (.68 + clamp(focal.biasY, -.12, .12));
  return { width: size, height: size,
    left: x - size * clamp(focal.focalX, .2, .8),
    top: y - size * clamp(focal.focalY, .2, .8) };
}
