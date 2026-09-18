// Shared by governed mobile rendering and the private DEV web review preview.
// Geometry describes composition; callers still own positive approval checks.
export const DEFAULT_FOCAL = Object.freeze({ focalX: .5, focalY: .46, scale: 1, biasX: 0, biasY: 0 });
const clamp = (n, low, high) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));

/** Match contentFit=contain's actual raster bounds. Edge integration belongs on
 * the photograph, not on an imaginary square around a non-square export. */
export function movementHeroSourceFrame(box, sourceWidth, sourceHeight) {
  if (!(sourceWidth > 0 && sourceHeight > 0)) return box;
  const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
  const width = sourceWidth * scale, height = sourceHeight * scale;
  return { width, height, left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2 };
}

export function thumbnailGeometry(size, focal, preset = {}) {
  const edge = size * (preset.cropMode === 'contain' ? 1 : (preset.thumbnailScale || 1));
  return { width: edge, height: edge,
    left: Math.min(0, Math.max(size - edge, size * .5 - edge * (preset.thumbnailFocalX ?? focal.focalX))),
    top: Math.min(0, Math.max(size - edge, size * .48 - edge * (preset.thumbnailFocalY ?? focal.focalY))) };
}

function baseHeroGeometry(width, height, focal) {
  if (focal.cropMode === 'contain') {
    // Let full compositions extend farther behind the foreground information.
    // The shared canvas scrim keeps that larger footprint atmospheric while
    // containment retains the source's complete machine and contact points.
    const size = Math.max(0, Math.min(360, width * .68, height * .86));
    return { width: size, height: size, left: Math.max(0, width - size - width * .02), top: height - size };
  }
  const size = Math.min(360, height * 1.08) * clamp(focal.scale, .8, 1.25);
  const x = width * (.77 + clamp(focal.biasX, -.12, .12));
  const y = height * (.68 + clamp(focal.biasY, -.12, .12));
  return { width: size, height: size,
    left: x - size * clamp(focal.focalX, .2, .8),
    top: y - size * clamp(focal.focalY, .2, .8) };
}

// Additional owner-reviewed Logger composition. Default is exactly the existing
// framing; thumbnails and original candidate metadata are never rewritten.
export const DEFAULT_LOGGER_CROP = Object.freeze({ fit: 'original', zoom: 1, x: 0, y: 0 });
export function movementHeroGeometry(width, height, focal, crop = DEFAULT_LOGGER_CROP) {
  const composition = crop.fit === 'contain' || crop.fit === 'focal' ? { ...focal, cropMode: crop.fit } : focal;
  const box = baseHeroGeometry(width, height, composition);
  const zoom = clamp(crop.zoom ?? 1, .5, 1.6);
  return { width: box.width * zoom, height: box.height * zoom,
    left: box.left - box.width * (zoom - 1) / 2 + width * clamp(crop.x ?? 0, -.5, .5),
    top: box.top - box.height * (zoom - 1) / 2 + height * clamp(crop.y ?? 0, -.5, .5) };
}
