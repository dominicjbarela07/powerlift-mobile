import { useSyncExternalStore } from 'react';
const owners = new Map<string, number>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => owners.size > 0;
/** Focus lifecycle registration, independent of names and pathname heuristics. */
export function registerFocusedSession(owner: string) {
  owners.set(owner, Date.now()); listeners.forEach(listener => listener());
  return () => { owners.delete(owner); listeners.forEach(listener => listener()); };
}
export function useFocusedSession() { return useSyncExternalStore(subscribe, snapshot, snapshot); }
export function focusedSessionSince(owner: string): number | null { return owners.get(owner) ?? null; }
