import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSLReducedMotion } from '@/lib/motion';
import { SLColors, SLShadows } from '@/constants/theme';
import { STRENGTH_LEDGER_APP_HEADER } from '@/components/navigation/StrengthLedgerAppHeader';

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.85;

export type StrengthLedgerBottomSheetHandle = Readonly<{
  dismiss: () => void;
}>;

type Props = Readonly<{
  accessibilityLabel: string;
  children: React.ReactNode;
  heightFraction?: number;
  presentationBoundary?: 'viewport' | 'app-shell';
  motionPreset?: 'standard' | 'deliberate';
  onDismiss: () => void;
  onRequestClose?: () => void;
  testID?: string;
  visible: boolean;
}>;

export const StrengthLedgerBottomSheet = forwardRef<StrengthLedgerBottomSheetHandle, Props>(function StrengthLedgerBottomSheet({
  accessibilityLabel,
  children,
  heightFraction = 0.93,
  presentationBoundary = 'viewport',
  motionPreset = 'standard',
  onDismiss,
  onRequestClose,
  testID,
  visible,
}, ref) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useSLReducedMotion();
  const translateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dismissingRef = useRef(false);
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
      return;
    }
    if (deliberateMotion) {
      Animated.timing(translateY, {
        duration: 280,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        toValue: 0,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.spring(translateY, {
      damping: 24,
      mass: 0.7,
      stiffness: 280,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [deliberateMotion, reduceMotion, translateY]);

  const dismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    if (reduceMotion) {
      onDismiss();
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
      if (finished) onDismiss();
      else dismissingRef.current = false;
    });
  }, [backdropOpacity, deliberateMotion, height, onDismiss, reduceMotion, translateY]);

  const requestClose = useCallback(() => {
    if (onRequestClose) onRequestClose();
    else dismiss();
  }, [dismiss, onRequestClose]);

  useImperativeHandle(ref, () => ({ dismiss }), [dismiss]);

  useEffect(() => {
    if (!visible) return;
    dismissingRef.current = false;
    if (reduceMotion) {
      translateY.setValue(0);
      backdropOpacity.setValue(1);
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
    ]).start();
  }, [backdropOpacity, deliberateMotion, height, reduceMotion, translateY, visible]);

  const dragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy >= DISMISS_DISTANCE || gesture.vy >= DISMISS_VELOCITY) {
        if (onRequestClose) {
          settle();
          requestClose();
        } else dismiss();
      } else settle();
    },
    onPanResponderTerminate: settle,
  }), [dismiss, onRequestClose, requestClose, settle, translateY]);

  return (
    <Modal animationType="none" onRequestClose={requestClose} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={visible}>
      <View style={styles.stage} testID={testID}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: backdropOpacity }]} />
        <Pressable accessibilityLabel={`Dismiss ${accessibilityLabel}`} accessibilityRole="button" onPress={requestClose} style={StyleSheet.absoluteFillObject} />
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
          <View style={styles.chrome} {...dragResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <Pressable accessibilityLabel={`Close ${accessibilityLabel}`} accessibilityRole="button" onPress={requestClose} style={styles.closeButton}>
              <Ionicons color={SLColors.textPrimary} name="close" size={21} />
            </Pressable>
          </View>
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  stage: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { width: '100%', overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: SLColors.borderStrong, backgroundColor: SLColors.canvas, ...SLShadows.shadowSheet },
  chrome: { position: 'relative', height: 34, flexShrink: 0, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 },
  dragHandle: { width: 46, height: 5, borderRadius: 3, backgroundColor: '#5C6070' },
  closeButton: { position: 'absolute', top: 4, right: 10, width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: SLColors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, minHeight: 0 },
});
