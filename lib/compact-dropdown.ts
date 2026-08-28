export type CompactDropdownAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CompactDropdownInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CompactDropdownLayout = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: 'above' | 'below';
};

const VIEWPORT_GUTTER = 8;
const ANCHOR_GAP = 7;

export function resolveCompactDropdownLayout({
  anchor,
  estimatedHeight,
  insets,
  minWidth,
  preferredMaxHeight,
  viewportHeight,
  viewportWidth,
}: {
  anchor: CompactDropdownAnchor;
  estimatedHeight: number;
  insets: CompactDropdownInsets;
  minWidth: number;
  preferredMaxHeight: number;
  viewportHeight: number;
  viewportWidth: number;
}): CompactDropdownLayout {
  const safeLeft = insets.left + VIEWPORT_GUTTER;
  const safeRight = viewportWidth - insets.right - VIEWPORT_GUTTER;
  const safeTop = insets.top + VIEWPORT_GUTTER;
  const safeBottom = viewportHeight - insets.bottom - VIEWPORT_GUTTER;
  const availableWidth = Math.max(0, safeRight - safeLeft);
  const width = Math.min(Math.max(anchor.width, minWidth), availableWidth);
  const left = Math.min(Math.max(anchor.x, safeLeft), Math.max(safeLeft, safeRight - width));
  const desiredHeight = Math.min(estimatedHeight, preferredMaxHeight);
  const belowTop = anchor.y + anchor.height + ANCHOR_GAP;
  const availableBelow = Math.max(0, safeBottom - belowTop);
  const availableAbove = Math.max(0, anchor.y - ANCHOR_GAP - safeTop);
  const placement = availableBelow < desiredHeight && availableAbove > availableBelow
    ? 'above'
    : 'below';
  const availableHeight = placement === 'above' ? availableAbove : availableBelow;
  const maxHeight = Math.max(0, Math.min(desiredHeight, availableHeight));
  const top = placement === 'above'
    ? Math.max(safeTop, anchor.y - ANCHOR_GAP - maxHeight)
    : Math.min(belowTop, Math.max(safeTop, safeBottom - maxHeight));

  return { left, top, width, maxHeight, placement };
}
