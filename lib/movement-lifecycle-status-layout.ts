export const MOVEMENT_STATUS_MIN_WIDTH = 84;
export const MOVEMENT_STATUS_COLUMN_WIDTH = 88;

const MOVEMENT_CARD_HORIZONTAL_PADDING = 24;

export function movementHeaderTitleWidth({
  viewportWidth,
  artworkWidth,
  compact,
}: {
  viewportWidth: number;
  artworkWidth: number;
  compact: boolean;
}) {
  const interColumnGap = compact ? 8 : 12;
  return Math.max(
    0,
    viewportWidth
      - MOVEMENT_CARD_HORIZONTAL_PADDING
      - artworkWidth
      - MOVEMENT_STATUS_COLUMN_WIDTH
      - (interColumnGap * 2),
  );
}
