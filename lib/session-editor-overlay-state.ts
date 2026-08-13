import { useSyncExternalStore } from 'react';

let movementEditorOpen = false;
let completedSessionRecapOpen = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return movementEditorOpen || completedSessionRecapOpen;
}

export function setSessionEditorOverlayOpen(open: boolean) {
  if (movementEditorOpen === open) return;
  movementEditorOpen = open;
  listeners.forEach((listener) => listener());
}

export function setCompletedSessionRecapOpen(open: boolean) {
  if (completedSessionRecapOpen === open) return;
  completedSessionRecapOpen = open;
  listeners.forEach((listener) => listener());
}

export function useSessionEditorOverlayOpen() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
