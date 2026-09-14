import React, { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Keyboard, Modal as NativeModal, ScrollView as NativeScrollView, StyleSheet, View, useWindowDimensions,
  type KeyboardAvoidingViewProps, type ModalProps, type ScrollViewProps, type TextInput, type ViewProps } from 'react-native';
import { focusedFieldScrollDelta, keyboardOverlap, type WindowRect } from '@/lib/keyboard-layout';
import { useKeyboardState } from './keyboard-state';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ViewportContext = createContext<number | null>(null);
export function useKeyboardViewportHeight() { return useContext(ViewportContext); }

/** One resizing owner per native presentation. Nested legacy avoidance becomes a plain view. */
export const KeyboardViewport = forwardRef<View, ViewProps & { independent?: boolean }>(function KeyboardViewport({ children, style, onLayout, independent = false, ...props }, ref) {
  const parent = useContext(ViewportContext);
  return parent !== null && !independent
    ? <View ref={ref} {...props} onLayout={onLayout} style={style}>{children}</View>
    : <MeasuredViewport viewportRef={ref} {...props} style={style} onLayout={onLayout}>{children}</MeasuredViewport>;
});
function MeasuredViewport({ children, style, onLayout, viewportRef, ...props }: ViewProps & { viewportRef?: React.Ref<View> }) {
  const outer = useRef<View>(null);
  const window = useWindowDimensions();
  const keyboard = useKeyboardState();
  const [frame, setFrame] = useState<WindowRect>({ x: 0, y: 0, width: window.width, height: window.height });
  const measure = useCallback(() => outer.current?.measureInWindow((x, y, width, height) => {
    if (width <= 0 || height <= 0) return;
    setFrame(previous => previous.x === x && previous.y === y && previous.width === width && previous.height === height ? previous : { x, y, width, height });
  }), []);
  useEffect(() => { const id = requestAnimationFrame(measure); return () => cancelAnimationFrame(id); }, [keyboard, window.width, window.height, measure]);
  const overlap = keyboardOverlap(frame, keyboard.frame);
  return <View {...props} ref={instance => { outer.current = instance; if (typeof viewportRef === 'function') viewportRef(instance); else if (viewportRef) viewportRef.current = instance; }} collapsable={false} style={[styles.viewport, style]} onLayout={event => { measure(); onLayout?.(event); }}>
    <View style={[styles.viewport, { paddingBottom: overlap }]}>
      <ViewportContext.Provider value={Math.max(0, frame.height - overlap)}>{children}</ViewportContext.Provider>
    </View>
  </View>;
}

/** Compatibility for existing flex/absolute containers; offsets and nested padding have no ownership. */
export const KeyboardAvoidingView = forwardRef<View, KeyboardAvoidingViewProps>(function KeyboardAvoidingView(
  { behavior: _behavior, keyboardVerticalOffset: _offset, contentContainerStyle: _content, enabled: _enabled, ...props }, ref,
) { return <KeyboardViewport ref={ref} {...props} />; });

/** A native modal has a new viewport even though React context crosses its portal. */
export function KeyboardModal({ children, onRequestClose, onDismiss, visible, ...props }: ModalProps) {
  const previouslyVisible = useRef(visible !== false);
  const keyboard = useKeyboardState();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (previouslyVisible.current && visible === false) Keyboard.dismiss();
    previouslyVisible.current = visible !== false;
  }, [visible]);
  return <NativeModal {...props} visible={visible} onRequestClose={event => { Keyboard.dismiss(); onRequestClose?.(event); }}
    onDismiss={onDismiss}>
    <KeyboardViewport independent style={styles.viewport}>
      <View style={[styles.viewport, props.transparent && keyboard.visible ? { paddingTop: insets.top } : null]}>{children}</View>
    </KeyboardViewport>
  </NativeModal>;
}

type FocusOwner = { focus: (input: TextInput | null) => void; blur: (input: TextInput | null) => void; reveal: () => void };
export const KeyboardFocusContext = createContext<FocusOwner | null>(null);

/** Measured scrolling preserves caller refs, refresh handlers and native body gestures. */
export const KeyboardScrollView = forwardRef<NativeScrollView, ScrollViewProps & { focusClearance?: number }>(function KeyboardScrollView({
  children, onScroll, onLayout, onContentSizeChange, keyboardShouldPersistTaps = 'handled', horizontal,
  automaticallyAdjustKeyboardInsets: _nativeKeyboardInset, contentContainerStyle, focusClearance = 12, ...props
}, forwardedRef) {
  const native = useRef<NativeScrollView>(null);
  const focused = useRef<TextInput | null>(null);
  const scrollY = useRef(0);
  const pending = useRef<number | null>(null);
  const parentFocus = useContext(KeyboardFocusContext);
  const keyboard = useKeyboardState();
  const availableHeight = useKeyboardViewportHeight();
  const reveal = useCallback(() => {
    if (horizontal || !focused.current) return;
    if (pending.current !== null) cancelAnimationFrame(pending.current);
    pending.current = requestAnimationFrame(() => {
      pending.current = null;
      const input = focused.current;
      if (!input?.isFocused()) return;
      native.current?.getNativeScrollRef()?.measureInWindow((x, y, width, height) => {
        input.measureInWindow((fx, fy, fw, fh) => {
          if (input !== focused.current || !input.isFocused() || height <= 0) return;
          const delta = focusedFieldScrollDelta({ x: fx, y: fy, width: fw, height: fh }, { x, y, width, height }, focusClearance);
          if (Math.abs(delta) > 1) native.current?.scrollTo({ y: Math.max(0, scrollY.current + delta), animated: false });
        });
      });
    });
  }, [horizontal, focusClearance]);
  const owner = React.useMemo<FocusOwner>(() => ({
    focus: input => { focused.current = input; reveal(); },
    blur: input => { if (focused.current === input) focused.current = null; },
    reveal,
  }), [reveal]);
  useEffect(() => { reveal(); }, [keyboard, availableHeight, reveal]);
  useEffect(() => () => { if (pending.current !== null) cancelAnimationFrame(pending.current); }, []);
  return <KeyboardFocusContext.Provider value={horizontal ? parentFocus : owner}>
    <NativeScrollView {...props} horizontal={horizontal} ref={instance => {
      native.current = instance;
      if (typeof forwardedRef === 'function') forwardedRef(instance); else if (forwardedRef) forwardedRef.current = instance;
    }} keyboardShouldPersistTaps={keyboardShouldPersistTaps} automaticallyAdjustKeyboardInsets={false}
      contentContainerStyle={[contentContainerStyle, !horizontal && keyboard.visible ? {
        paddingBottom: Math.max(56, Number(StyleSheet.flatten(contentContainerStyle)?.paddingBottom) || 0),
      } : null]}
      scrollEventThrottle={props.scrollEventThrottle ?? 16}
      onLayout={event => { onLayout?.(event); reveal(); }}
      onContentSizeChange={(width, height) => { onContentSizeChange?.(width, height); reveal(); }}
      onScroll={event => { scrollY.current = event.nativeEvent.contentOffset.y; onScroll?.(event); }}>
      {children}
    </NativeScrollView>
  </KeyboardFocusContext.Provider>;
});

// Retain the native instance type for existing imperative refs.
export type KeyboardScrollView = NativeScrollView;
const styles = StyleSheet.create({ viewport: { flex: 1, minHeight: 0 } });
