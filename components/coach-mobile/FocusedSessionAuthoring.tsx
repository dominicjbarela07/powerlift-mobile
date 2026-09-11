import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { StrengthLedgerBottomSheetHandle } from '@/components/sheets/StrengthLedgerBottomSheet';
import { useSLReducedMotion } from '@/lib/motion';
import { SLColors } from '@/constants/theme';

/** Full-height authoring owns navigation; the originating week stays mounted. */
export const FocusedSessionAuthoring = forwardRef<StrengthLedgerBottomSheetHandle, {
  visible: boolean;
  children: React.ReactNode;
  onRequestClose: () => void;
  onDismiss: () => void;
  onPresent: () => void;
}>(function FocusedSessionAuthoring({ visible, children, onRequestClose, onDismiss, onPresent }, ref) {
  const reduceMotion = useSLReducedMotion();
  const [presented, setPresented] = useState(visible);
  const dismissing = useRef(false);
  useEffect(() => { if (visible) { dismissing.current = false; setPresented(true); } }, [visible]);
  useImperativeHandle(ref, () => ({ dismiss() {
    if (dismissing.current) return;
    dismissing.current = true;
    setPresented(false);
    if (Platform.OS !== 'ios') onDismiss();
  } }), [onDismiss]);
  return <Modal visible={visible && presented} presentationStyle="fullScreen" animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onRequestClose} onShow={onPresent} onDismiss={() => { if (dismissing.current && Platform.OS === 'ios') onDismiss(); }}>
    <GestureHandlerRootView style={styles.root}><SafeAreaProvider initialMetrics={initialWindowMetrics}><SafeAreaView edges={['top']} style={styles.root}>{children}</SafeAreaView></SafeAreaProvider></GestureHandlerRootView>
  </Modal>;
});
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: SLColors.canvas } });
