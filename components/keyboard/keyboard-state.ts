import { useSyncExternalStore } from 'react';
import { AppState, Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';
import type { WindowRect } from '@/lib/keyboard-layout';

type KeyboardState = { visible: boolean; frame: WindowRect | null };
const hidden: KeyboardState = { visible: false, frame: null };
let state = hidden;
const listeners = new Set<() => void>();
let cleanup: (() => void) | undefined;
function update(next: KeyboardState) {
  if (JSON.stringify(state) === JSON.stringify(next)) return;
  state = next;
  listeners.forEach(listener => listener());
}
function reconcile() {
  const metrics = Keyboard.metrics();
  update(AppState.currentState === 'active' && Keyboard.isVisible() && metrics
    ? { visible: true, frame: { x: metrics.screenX, y: metrics.screenY, width: metrics.width, height: metrics.height } }
    : hidden);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!cleanup) {
    const change = (event: KeyboardEvent) => {
      if (AppState.currentState !== 'active') return;
      const f = event.endCoordinates;
      const visible = f.height > 0 && f.screenY < Dimensions.get('screen').height;
      update(visible ? { visible, frame: { x: f.screenX, y: f.screenY, width: f.width, height: f.height } } : hidden);
    };
    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', change),
      Keyboard.addListener('keyboardDidHide', () => update(hidden)),
      AppState.addEventListener('change', value => {
        if (value === 'active') reconcile();
        else { Keyboard.dismiss(); update(hidden); }
      }),
      Dimensions.addEventListener('change', reconcile),
    ];
    if (Platform.OS === 'ios') subscriptions.push(
      Keyboard.addListener('keyboardWillChangeFrame', change),
      Keyboard.addListener('keyboardWillShow', change),
      Keyboard.addListener('keyboardWillHide', () => update(hidden)),
    );
    cleanup = () => subscriptions.forEach(subscription => subscription.remove());
    reconcile();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { cleanup?.(); cleanup = undefined; state = hidden; }
  };
}
export function useKeyboardState() { return useSyncExternalStore(subscribe, () => state, () => hidden); }
