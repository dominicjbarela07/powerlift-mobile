import type { Href } from 'expo-router';

export type DevLiveScreenSession = {
  entryId: string;
  title: string;
  mode: 'live' | 'ideal';
  contextLabel?: string;
  returnHref: Href;
};

export function beginDevLiveScreenSession(_session: DevLiveScreenSession) {}
export function endDevLiveScreenSession() {}
export function getDevLiveScreenSession(): DevLiveScreenSession | null { return null; }
export function subscribeDevLiveScreenSession(_listener: (session: DevLiveScreenSession | null) => void) {
  return () => {};
}
export function useDevLiveScreenSession(): DevLiveScreenSession | null { return null; }
