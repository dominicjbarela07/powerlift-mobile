import { useSyncExternalStore } from 'react';

let movementEditorOpen = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return movementEditorOpen;
}

export function setSessionEditorOverlayOpen(open: boolean) {
  if (movementEditorOpen === open) return;
  movementEditorOpen = open;
  listeners.forEach((listener) => listener());
}

export function useSessionEditorOverlayOpen() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
