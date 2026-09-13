import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
  Modal as ReactNativeModal,
  type ModalProps,
  ScrollView,
  type ScrollViewProps,
  type ViewProps,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSLReducedMotion } from '@/lib/motion';
import { SLColors, SLShadows } from '@/constants/theme';
import { STRENGTH_LEDGER_APP_HEADER } from '@/components/navigation/StrengthLedgerAppHeader';
import {
  BOTTOM_SHEET_ACTIVATION_DISTANCE,
  BOTTOM_SHEET_DRAG_REGION_HEIGHT,
  bottomSheetVelocityFromGestureHandler,
  shouldDismissBottomSheet,
} from '@/lib/bottom-sheet-gesture';

export type StrengthLedgerSheetCloseReason = 'backdrop' | 'close-button' | 'gesture' | 'programmatic' | 'system-back';

export type StrengthLedgerBottomSheetHandle = Readonly<{
  dismiss: () => void;
}>;

type Props = Readonly<{
  accessibilityLabel: string;
  children: React.ReactNode;
  dismissalBlocked?: boolean;
  dismissalBlockedMessage?: string;
  heightFraction?: number;
  presentationBoundary?: 'viewport' | 'app-shell';
  motionPreset?: 'standard' | 'deliberate';
  onDismiss: () => void;
  onDismissBlocked?: (reason: StrengthLedgerSheetCloseReason) => void;
  onPresent?: () => void;
  onRequestClose?: (reason: StrengthLedgerSheetCloseReason) => void;
  showCloseButton?: boolean;
  testID?: string;
  visible: boolean;
}>;

// Kept as a transparent compatibility export: scroll views own their complete
// touch sequences. No scroll offset or boundary can grant sheet dismissal.
export const StrengthLedgerBottomSheetScrollView = forwardRef<ScrollView, ScrollViewProps>(function StrengthLedgerBottomSheetScrollView(props, ref) {
  return <ScrollView {...props} ref={ref} />;
});

type ChromeGestureCallbacks = Readonly<{
  update: (dy: number) => void;
  release: (dy: number, vy: number) => void;
  cancel: () => void;
}>;

function useSheetChromeGesture({ update, release, cancel }: ChromeGestureCallbacks) {
  return useMemo(() => Gesture.Pan()
    .minPointers(1).maxPointers(1)
    .activeOffsetY(BOTTOM_SHEET_ACTIVATION_DISTANCE)
    .failOffsetY(-BOTTOM_SHEET_ACTIVATION_DISTANCE)
    .failOffsetX([-18, 18])
    .cancelsTouchesInView(false)
    .runOnJS(true)
    .onUpdate(event => update(Math.max(0, event.translationY)))
    .onEnd((event, success) => {
      if (success) release(event.translationY, bottomSheetVelocityFromGestureHandler(event.velocityY));
    })
    .onFinalize((_event, success) => { if (!success) cancel(); }),
  [cancel, release, update]);
}

const SheetChromeContext = createContext<ChromeGestureCallbacks | null>(null);

/** Explicit top chrome for legacy layouts; never wrap list/form content here. */
export function StrengthLedgerSheetDragRegion({ children, style, ...props }: ViewProps) {
  const callbacks = useContext(SheetChromeContext);
  if (!callbacks) throw new Error('Sheet drag region requires a governed sheet boundary');
  return <LegacySheetChrome callbacks={callbacks} style={style} {...props}>{children}</LegacySheetChrome>;
}

function LegacySheetChrome({ callbacks, children, style, ...props }: ViewProps & { callbacks: ChromeGestureCallbacks }) {
  const gesture = useSheetChromeGesture(callbacks);
  return <GestureDetector gesture={gesture}><View {...props} collapsable={false} style={[styles.legacyChrome, style]}>{children ?? <View style={[styles.dragHandle, { alignSelf: 'center' }]} />}</View></GestureDetector>;
}

/**
 * Compatibility boundary for legacy sheet layouts that still own their visual
 * chrome. New surfaces should use StrengthLedgerBottomSheet directly. The
 * adapter centralizes the same drag threshold, keyboard cleanup, system-back
 * callback, and reduced-motion behavior while those layouts are consolidated.
 */
type StrengthLedgerSheetModalAdapterProps = Omit<ModalProps, 'onRequestClose'> & Readonly<{
  onRequestClose?: () => void;
}>;

function useLegacySheetMotion(onRequestClose: (() => void) | undefined, visible = true) {
  const reduceMotion = useSLReducedMotion();
  const { height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const settle = useCallback(() => {
    if (reduceMotion) {
      translateY.setValue(0);
      opacity.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(translateY, { damping: 24, mass: 0.7, stiffness: 280, toValue: 0, useNativeDriver: true }),
      Animated.timing(opacity, { duration: 140, toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [opacity, reduceMotion, translateY]);

  const close = useCallback(() => {
    Keyboard.dismiss();
    if (reduceMotion) {
      onRequestClose?.();
      settle();
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, { duration: 180, easing: Easing.out(Easing.quad), toValue: Math.max(height, 640), useNativeDriver: true }),
      Animated.timing(opacity, { duration: 160, toValue: 0, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onRequestClose?.();
      // A guarded callback may keep the sheet open (saving or unsaved draft).
      // Never leave that live sheet translated off-screen.
      settle();
    });
  }, [height, onRequestClose, opacity, reduceMotion, settle, translateY]);

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(0);
    opacity.setValue(1);
  }, [opacity, translateY, visible]);

  const update = useCallback((dy: number) => {
    translateY.setValue(dy);
    opacity.setValue(Math.max(0.4, 1 - (dy / Math.max(height, 1)) * 0.6));
  }, [height, opacity, translateY]);
  const release = useCallback((dy: number, vy: number) => {
    if (shouldDismissBottomSheet({ dy, vy })) close();
    else settle();
  }, [close, settle]);
  const chrome = useMemo(() => ({ update, release, cancel: settle }), [update, release, settle]);

  return { chrome, animatedStyle: { opacity, transform: [{ translateY }] } };
}

export function StrengthLedgerSheetModalAdapter({ children, onRequestClose, visible, ...props }: StrengthLedgerSheetModalAdapterProps) {
  const { chrome, animatedStyle } = useLegacySheetMotion(onRequestClose, visible);
  return <ReactNativeModal {...props} onRequestClose={() => onRequestClose?.()} visible={visible}>
    <GestureHandlerRootView style={styles.gestureModalRoot}>
      <SheetChromeContext.Provider value={chrome}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>
      </SheetChromeContext.Provider>
    </GestureHandlerRootView>
  </ReactNativeModal>;
}

/** A bottom sheet embedded in an existing modal (for example video review).
 * The existing modal supplies GestureHandlerRootView; player and popovers stay
 * outside this surface and never become draggable. */
export function StrengthLedgerSheetGestureSurface({ children, onRequestClose, style, ...props }: ViewProps & { onRequestClose: () => void }) {
  const { chrome, animatedStyle } = useLegacySheetMotion(onRequestClose);
  return <SheetChromeContext.Provider value={chrome}><Animated.View {...props} style={[style, animatedStyle]}>{children}</Animated.View></SheetChromeContext.Provider>;
}

export const StrengthLedgerBottomSheet = forwardRef<StrengthLedgerBottomSheetHandle, Props>(function StrengthLedgerBottomSheet({
  accessibilityLabel,
  children,
  dismissalBlocked = false,
  dismissalBlockedMessage = 'Please wait for the current action to finish.',
  heightFraction = 0.93,
  presentationBoundary = 'viewport',
  motionPreset = 'standard',
  onDismiss,
  onDismissBlocked,
  onPresent,
  onRequestClose,
  showCloseButton = true,
  testID,
  visible,
}, ref) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useSLReducedMotion();
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dismissingRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const onPresentRef = useRef(onPresent);
  onPresentRef.current = onPresent;
  const blockedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const topBoundary = presentationBoundary === 'app-shell'
    ? insets.top + STRENGTH_LEDGER_APP_HEADER.contentHeight
    : Math.max(insets.top + 8, 28);
  const usableHeight = Math.max(0, height - topBoundary);
  const sheetHeight = presentationBoundary === 'app-shell'
    ? usableHeight
    : Math.min(usableHeight, Math.round(height * Math.max(0.35, Math.min(0.93, heightFraction))));
  const deliberateMotion = motionPreset === 'deliberate';

  const settle = useCallback(() => {
    if (reduceMotion) {
      translateY.setValue(0);
      backdropOpacity.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: deliberateMotion ? 220 : 140,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
      deliberateMotion ? Animated.timing(translateY, {
        duration: 280,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        toValue: 0,
        useNativeDriver: true,
      }) : Animated.spring(translateY, {
        damping: 24,
        mass: 0.7,
        stiffness: 280,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, deliberateMotion, reduceMotion, translateY]);

  const dismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Keyboard.dismiss();
    if (reduceMotion) {
      onDismissRef.current();
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        duration: deliberateMotion ? 320 : 180,
        easing: deliberateMotion ? Easing.bezier(0.4, 0, 0.2, 1) : Easing.linear,
        toValue: Math.max(height, 640),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        duration: deliberateMotion ? 280 : 160,
        easing: Easing.out(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDismissRef.current();
      else dismissingRef.current = false;
    });
  }, [backdropOpacity, deliberateMotion, height, reduceMotion, translateY]);

  const requestClose = useCallback((reason: StrengthLedgerSheetCloseReason) => {
    Keyboard.dismiss();
    if (dismissalBlocked) {
      settle();
      setBlockedNotice(dismissalBlockedMessage);
      AccessibilityInfo.announceForAccessibility(dismissalBlockedMessage);
      if (blockedTimerRef.current) clearTimeout(blockedTimerRef.current);
      blockedTimerRef.current = setTimeout(() => setBlockedNotice(null), 2200);
      onDismissBlocked?.(reason);
      return;
    }
    if (onRequestClose) onRequestClose(reason);
    else dismiss();
  }, [dismiss, dismissalBlocked, dismissalBlockedMessage, onDismissBlocked, onRequestClose, settle]);

  useImperativeHandle(ref, () => ({ dismiss }), [dismiss]);

  useEffect(() => {
    if (!visible) return;
    dismissingRef.current = false;
    if (reduceMotion) {
      translateY.setValue(0);
      backdropOpacity.setValue(1);
      onPresentRef.current?.();
      return;
    }
    translateY.setValue(Math.max(height, 640));
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: deliberateMotion ? 300 : 160,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
      deliberateMotion
        ? Animated.timing(translateY, {
            duration: 440,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            toValue: 0,
            useNativeDriver: true,
          })
        : Animated.spring(translateY, {
            damping: 24,
            mass: 0.7,
            stiffness: 280,
            toValue: 0,
            useNativeDriver: true,
          }),
    ]).start(({ finished }) => {
      if (finished) onPresentRef.current?.();
    });
  }, [backdropOpacity, deliberateMotion, height, reduceMotion, translateY, visible]);

  useEffect(() => () => {
    if (blockedTimerRef.current) clearTimeout(blockedTimerRef.current);
  }, []);

  const updateDrag = useCallback((dy: number) => {
    const clamped = Math.max(0, dy);
    translateY.setValue(clamped);
    backdropOpacity.setValue(Math.max(0.28, 1 - (clamped / Math.max(sheetHeight, 1)) * 0.72));
  }, [backdropOpacity, sheetHeight, translateY]);

  const finishDrag = useCallback((dy: number, vy: number) => {
    if (shouldDismissBottomSheet({ dy, vy })) {
      if (onRequestClose || dismissalBlocked) {
        settle();
        requestClose('gesture');
      } else dismiss();
    } else settle();
  }, [dismiss, dismissalBlocked, onRequestClose, requestClose, settle]);

  const chromeDismissGesture = useSheetChromeGesture({ update: updateDrag, release: finishDrag, cancel: settle });

  return (
    <ReactNativeModal animationType="none" onRequestClose={() => requestClose('system-back')} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible}>
      <GestureHandlerRootView style={styles.gestureModalRoot}>
        <View style={styles.stage} testID={testID}>
          <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: backdropOpacity }]} />
          <Pressable accessibilityLabel={`Dismiss ${accessibilityLabel}`} accessibilityRole="button" onPress={() => requestClose('backdrop')} style={StyleSheet.absoluteFillObject} />
            <Animated.View
              accessibilityLabel={accessibilityLabel}
              accessibilityViewIsModal
              style={[
                styles.sheet,
                {
                  height: sheetHeight,
                  paddingBottom: Math.max(insets.bottom, 10),
                  transform: [{ translateY }],
                },
              ]}
            >
              <GestureDetector gesture={chromeDismissGesture}>
                <View collapsable={false} style={styles.chrome}>
                  <View accessibilityLabel={`Swipe down to close ${accessibilityLabel}`} accessibilityRole="adjustable" style={styles.dragHandle} />
                  {showCloseButton ? <Pressable accessibilityLabel={`Close ${accessibilityLabel}`} accessibilityRole="button" onPress={() => requestClose('close-button')} style={styles.closeButton}>
                    <Ionicons color={SLColors.textPrimary} name="close" size={21} />
                  </Pressable> : null}
                </View>
              </GestureDetector>
              {blockedNotice ? <View accessibilityLiveRegion="polite" style={styles.blockedNotice}><Text style={styles.blockedNoticeText}>{blockedNotice}</Text></View> : null}
              <View style={styles.content}>{children}</View>
            </Animated.View>
        </View>
      </GestureHandlerRootView>
    </ReactNativeModal>
  );
});

const styles = StyleSheet.create({
  gestureModalRoot: { flex: 1 },
  stage: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { width: '100%', overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: SLColors.borderStrong, backgroundColor: SLColors.canvasRaised, ...SLShadows.shadowSheet },
  chrome: { position: 'relative', height: BOTTOM_SHEET_DRAG_REGION_HEIGHT, flexShrink: 0, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 },
  legacyChrome: { minHeight: BOTTOM_SHEET_DRAG_REGION_HEIGHT, flexShrink: 0, alignSelf: 'stretch', justifyContent: 'center' },
  dragHandle: { width: 46, height: 5, borderRadius: 3, backgroundColor: '#5C6070' },
  closeButton: { position: 'absolute', top: 4, right: 10, width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minHeight: 0 },
  blockedNotice: { marginHorizontal: 14, marginBottom: 6, borderRadius: 10, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: SLColors.surfaceRaised, paddingHorizontal: 12, paddingVertical: 8 },
  blockedNoticeText: { color: SLColors.textPrimary, fontSize: 13, textAlign: 'center' },
});
