/** Geometry is in window coordinates. Android resize may already remove all overlap. */
export type WindowRect = { x: number; y: number; width: number; height: number };
export function keyboardOverlap(view: WindowRect, keyboard: WindowRect | null) {
  if (!keyboard || keyboard.height <= 0 || keyboard.width <= 0
    || keyboard.x >= view.x + view.width || keyboard.x + keyboard.width <= view.x) return 0;
  if (keyboard.y >= view.y + view.height || keyboard.y + keyboard.height <= view.y) return 0;
  return Math.max(0, Math.min(view.height, view.y + view.height - keyboard.y));
}

/** Reveal only the obscured edge; retain nearby context and avoid jumps for visible fields. */
export function focusedFieldScrollDelta(field: WindowRect, viewport: WindowRect, clearance = 12) {
  const top = viewport.y + clearance;
  const bottom = viewport.y + viewport.height - clearance;
  const fieldBottom = field.y + Math.min(field.height, Math.max(0, bottom - top));
  if (field.y < top) return field.y - top;
  if (fieldBottom > bottom) return fieldBottom - bottom;
  return 0;
}

export function multilineInputHeight(contentHeight: number, availableHeight: number, minimum = 44, maximum = 160) {
  const cap = Math.max(44, Math.min(maximum, Math.floor(availableHeight * 0.36)));
  const min = Math.min(minimum, cap);
  return { height: Math.max(min, Math.min(cap, contentHeight || min)), minHeight: min, maxHeight: cap };
}
