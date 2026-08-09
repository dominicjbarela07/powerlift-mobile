const BASE_COPY_TOP = -16;

export type CoreLoggerHeroLoadLayout = {
  fontScale: number;
  unitScale: number;
  topInset: number;
  effectiveCopyTop: number;
};

export function coreLoggerHeroLoadLayout(
  formattedValue: string,
  viewportWidth: number,
  hasUnit = true,
): CoreLoggerHeroLoadLayout {
  const value = String(formattedValue || '').trim();
  const glyphCount = Math.max(1, value.replace(/\s/g, '').length);
  const densityScale =
    glyphCount <= 3 ? 1 :
    glyphCount === 4 ? 0.94 :
    glyphCount === 5 ? 0.86 :
    glyphCount === 6 ? 0.78 :
    0.72;
  const availableWidth = Math.max(
    220,
    Math.min(Number(viewportWidth) || 390, 480) - 48 - (hasUnit ? 42 : 0),
  );
  const estimatedWidth = glyphCount * 42;
  const widthScale = Math.min(1, availableWidth / estimatedWidth);
  const compactScale = viewportWidth < 390 ? 0.94 : 1;
  const fontScale = Math.max(
    0.72,
    Math.min(1, densityScale, widthScale) * compactScale,
  );
  const topInset =
    glyphCount <= 3 ? 0 :
    glyphCount === 4 ? 8 :
    16;

  return {
    fontScale,
    unitScale: Math.max(0.82, fontScale),
    topInset,
    effectiveCopyTop: BASE_COPY_TOP + topInset,
  };
}
