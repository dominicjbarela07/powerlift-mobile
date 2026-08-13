export const STREAK_PLATFORM_RISE = {
  compact: 5,
  standard: 6,
  proMax: 7,
} as const;

export const STREAK_PLATFORM_BASE_HEIGHT = {
  compact: 24,
  standard: 26,
  proMax: 28,
} as const;

export function streakPlatformRiseForWidth(viewportWidth: number) {
  if (viewportWidth <= 375) return STREAK_PLATFORM_RISE.compact;
  if (viewportWidth <= 410) return STREAK_PLATFORM_RISE.standard;
  return STREAK_PLATFORM_RISE.proMax;
}

export function streakPlatformBaseHeightForWidth(viewportWidth: number) {
  if (viewportWidth <= 375) return STREAK_PLATFORM_BASE_HEIGHT.compact;
  if (viewportWidth <= 410) return STREAK_PLATFORM_BASE_HEIGHT.standard;
  return STREAK_PLATFORM_BASE_HEIGHT.proMax;
}

export function streakPlatformHeight(index: number, count: number, baseHeight: number, rise: number) {
  if (count <= 1) return baseHeight;
  const boundedIndex = Math.max(0, Math.min(count - 1, index));
  return baseHeight + boundedIndex * rise;
}

export function streakPlatformDeckHeight(count: number, baseHeight: number, rise: number) {
  return streakPlatformHeight(Math.max(0, count - 1), count, baseHeight, rise);
}
