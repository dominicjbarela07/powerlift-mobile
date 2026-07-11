export type UpdateBlocker = 'workout' | 'video_upload' | 'billing_browser';

const blockers: Record<UpdateBlocker, boolean> = {
  workout: false,
  video_upload: false,
  billing_browser: false,
};
const listeners = new Set<() => void>();

export function setUpdateBlocker(blocker: UpdateBlocker, active: boolean) {
  if (blockers[blocker] === active) return;
  blockers[blocker] = active;
  listeners.forEach((listener) => listener());
}

export function isUpdateReloadSafe() {
  return !Object.values(blockers).some(Boolean);
}

export function subscribeUpdateSafety(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
