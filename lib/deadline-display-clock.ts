/** Shared display pulse only. Deadlines remain owned by the timer store. */
export function createDeadlineDisplayClock(deps: {
  now: () => number;
  schedule: (tick: () => void) => unknown;
  cancel: (handle: unknown) => void;
  subscribeForeground: (listener: (active: boolean) => void) => () => void;
  isForeground: () => boolean;
}) {
  const listeners = new Set<() => void>();
  let nowMs = deps.now();
  let handle: unknown = null;
  let removeForeground: (() => void) | null = null;
  const tick = () => { nowMs = deps.now(); listeners.forEach(listener => listener()); };
  const stop = () => { if (handle != null) deps.cancel(handle); handle = null; };
  const sync = (active: boolean) => {
    stop();
    tick();
    if (active && listeners.size) handle = deps.schedule(tick);
  };
  return {
    getNow: () => nowMs,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        removeForeground = deps.subscribeForeground(sync);
        sync(deps.isForeground());
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { stop(); removeForeground?.(); removeForeground = null; }
      };
    },
  };
}
