export type MovementScrollGeometry = {
  cardTop: number;
  cardHeight: number;
  scrollY: number;
  viewportHeight: number;
  contentHeight: number;
  comfortableInset?: number;
};

const finite = (value: number) => Number.isFinite(value);
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

/**
 * Returns no target when the expanded movement is already comfortably visible.
 * Otherwise, centers the movement when it fits and top-aligns oversized cards.
 */
export function movementScrollTarget({
  cardTop,
  cardHeight,
  scrollY,
  viewportHeight,
  contentHeight,
  comfortableInset = 24,
}: MovementScrollGeometry): number | null {
  if (
    ![cardTop, cardHeight, scrollY, viewportHeight, contentHeight, comfortableInset].every(finite) ||
    cardHeight <= 0 ||
    viewportHeight <= 0
  ) return null;

  const inset = clamp(comfortableInset, 0, viewportHeight / 3);
  const currentY = Math.max(0, scrollY);
  const visibleTop = currentY + inset;
  const visibleBottom = currentY + viewportHeight - inset;
  const cardBottom = cardTop + cardHeight;

  if (cardTop >= visibleTop && cardBottom <= visibleBottom) return null;

  const usableHeight = Math.max(0, viewportHeight - inset * 2);
  const preferredY = cardHeight <= usableHeight
    ? cardTop - (viewportHeight - cardHeight) / 2
    : cardTop - inset;
  const maxScrollY = Math.max(0, contentHeight - viewportHeight);
  const targetY = clamp(preferredY, 0, maxScrollY);

  return Math.abs(targetY - currentY) < 1 ? null : targetY;
}
