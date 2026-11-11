// Shared by governed mobile rendering and the private DEV web review preview.
// Geometry describes composition; callers still own positive approval checks.
export const DEFAULT_FOCAL = Object.freeze({ focalX: .5, focalY: .46, scale: 1, biasX: 0, biasY: 0 });
const clamp = (n, low, high) => Math.min(high, Math.max(low, Number.isFinite(n) ? n : low));
const atmosphereScale = (width, framing) => Math.min(
  width / (framing.right - framing.left), width * .82 / (framing.bottom - framing.top));

// Each source owns its visible action bounds. Tall figures keep a substantial
// scene while floor-level poses lose the empty studio space above them.
export function movementAtmosphereHeaderHeight(width, framing, captionHeight = 80) {
  if (!framing) return clamp(width * .95, 300, 420);
  const actionHeight = framing.bottom - framing.top;
  const scale = atmosphereScale(width, framing);
  return Math.ceil(actionHeight * scale + 24 + Math.max(64, captionHeight));
}

/** Match contentFit=contain's actual raster bounds. Edge integration belongs on
 * the photograph, not on an imaginary square around a non-square export. */
export function movementHeroSourceFrame(box, sourceWidth, sourceHeight) {
  if (!(sourceWidth > 0 && sourceHeight > 0)) return box;
  const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
  const width = sourceWidth * scale, height = sourceHeight * scale;
  return { width, height, left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2 };
}

/** A header background fills the available width. Containing a square source
 * inside a short header recreates the owner's rejected thumbnail. Preserve
 * proportions and reviewed placement, but bound its focal point to the header;
 * source background may extend outside the canvas. */
export function movementAtmosphereFrame(box, sourceWidth, sourceHeight, width, height, framing) {
  if (framing && width > 0 && height > 0) {
    const scale = atmosphereScale(width, framing);
    return {
      width: framing.sourceWidth * scale,
      height: framing.sourceHeight * scale,
      left: width / 2 - (framing.left + framing.right) / 2 * scale,
      top: 12 - framing.top * scale,
    };
  }
  const source = movementHeroSourceFrame(box, sourceWidth, sourceHeight);
  if (!(width > 0 && height > 0 && source.width > 0 && source.height > 0)) {
    return { width: 0, height: 0, left: 0, top: 0 };
  }
  const scale = width / source.width;
  const frameWidth = source.width * scale;
  const frameHeight = source.height * scale;
  return {
    width: frameWidth,
    height: frameHeight,
    left: 0,
    top: clamp(source.top + (source.height - frameHeight) / 2,
      Math.min(0, height - frameHeight), Math.max(0, height - frameHeight)),
  };
}

export function thumbnailGeometry(size, focal, preset = {}) {
  const edge = size * (preset.cropMode === 'contain' ? 1 : (preset.thumbnailScale || 1));
  return { width: edge, height: edge,
    left: Math.min(0, Math.max(size - edge, size * .5 - edge * (preset.thumbnailFocalX ?? focal.focalX))),
    top: Math.min(0, Math.max(size - edge, size * .48 - edge * (preset.thumbnailFocalY ?? focal.focalY))) };
}

function baseHeroGeometry(width, height, focal) {
  if (focal.cropMode === 'contain') {
    // Use the whole background, including the space behind the prescription.
    // Source-frame containment preserves the entire composition and aspect ratio.
    return { width: Math.max(0, width), height: Math.max(0, height), left: 0, top: 0 };
  }
  const size = Math.min(520, Math.max(width * 1.06, height * 1.12)) * clamp(focal.scale, .8, 1.25);
  const x = width * (.55 + clamp(focal.biasX, -.12, .12));
  const y = height * (.65 + clamp(focal.biasY, -.12, .12));
  return { width: size, height: size,
    left: x - size * clamp(focal.focalX, .2, .8),
    top: y - size * clamp(focal.focalY, .2, .8) };
}

// Additional owner-reviewed Logger composition over the shared background.
// Thumbnails and original candidate metadata are never rewritten.
export const DEFAULT_LOGGER_CROP = Object.freeze({ fit: 'original', zoom: 1, x: 0, y: 0 });
export function movementHeroGeometry(width, height, focal, crop = DEFAULT_LOGGER_CROP) {
  const composition = crop.fit === 'contain' || crop.fit === 'focal' ? { ...focal, cropMode: crop.fit } : focal;
  const box = baseHeroGeometry(width, height, composition);
  const zoom = clamp(crop.zoom ?? 1, .5, 1.6);
  return { width: box.width * zoom, height: box.height * zoom,
    left: box.left - box.width * (zoom - 1) / 2 + width * clamp(crop.x ?? 0, -.5, .5),
    top: box.top - box.height * (zoom - 1) / 2 + height * clamp(crop.y ?? 0, -.5, .5) };
}
