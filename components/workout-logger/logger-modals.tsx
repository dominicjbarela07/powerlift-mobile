// @ts-nocheck

import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SLTactileOpacity as TouchableOpacity } from '@/components/ui/sl-motion';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLConfirmationModal } from '@/components/ui/sl-confirmation-modal';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { SLColors } from '@/constants/theme';
import {
  normalizeRestTimerSeconds,
  REST_TIMER_OPTIONS_SECONDS,
} from '@/lib/rest-timer-preference-core';

const REST_TIMER_OPTIONS = REST_TIMER_OPTIONS_SECONDS;
const REST_TIMER_ROW_HEIGHT = 44;
const REST_TIMER_VISIBLE_ROWS = 5;

function formatRestTimerOption(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs ? `${mins}:${String(secs).padStart(2, '0')}` : `${mins}:00`;
}

function nearestRestTimerIndex(value?: number | null) {
  return REST_TIMER_OPTIONS.indexOf(normalizeRestTimerSeconds(value));
}

export function TardyReasonModal({
  visible,
  tardyReason,
  setTardyReason,
  onClose,
  onSubmit,
  styles,
}: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose('dismissed')}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Tardy Session</Text>
          <Text style={styles.modalSubtitle}>
            This session is being logged late. Add a quick reason for your coach.
          </Text>
          <TextInput
            value={tardyReason}
            onChangeText={setTardyReason}
            placeholder="Reason"
            placeholderTextColor={SLColors.textSubtle}
            style={[styles.modalInput, { minHeight: 90, textAlignVertical: 'top' }]}
            multiline
            autoFocus
          />
          <View style={styles.modalActionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
              onPress={() => onClose('dismissed')}
            >
              <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]}
              onPress={onSubmit}
            >
              <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Begin</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function CancelResumeModal({
  visible,
  workoutStatus,
  actionLoading,
  onClose,
  onConfirm,
}: any) {
  const resuming = workoutStatus === 'completed';
  return <SLConfirmationModal
    body={resuming ? undefined : 'This will discard this training session, remove all logged sets, clear the session timer, and return the session to its assigned state.'}
    cancelLabel="Keep Session"
    confirmLabel={resuming ? 'Resume Session' : 'Cancel Session'}
    confirmTone={resuming ? 'primary' : 'danger'}
    loading={Boolean(actionLoading)}
    onCancel={onClose}
    onConfirm={onConfirm}
    testID="cancel-resume-session-confirmation"
    title={resuming ? 'Resume this training session?' : 'Cancel this training session?'}
    visible={visible}
  />;
}

export function RestTimerPickerModal({
  visible,
  timerWheelRef,
  timerPickerValue,
  setTimerPickerValue,
  startRestTimer,
  saveConfirmationVisible,
  onMounted,
  onClose,
  styles,
  embedded = false,
}: any) {
  React.useEffect(() => {
    if (visible) onMounted?.();
  }, [onMounted, visible]);

  const dragSettleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteracting = React.useRef(false);
  const centerPadding = REST_TIMER_ROW_HEIGHT * Math.floor(REST_TIMER_VISIBLE_ROWS / 2);
  const settleToIndex = (offsetY: number, animated = true) => {
    const idx = Math.max(
      0,
      Math.min(REST_TIMER_OPTIONS.length - 1, Math.round(offsetY / REST_TIMER_ROW_HEIGHT)),
    );
    setTimerPickerValue(REST_TIMER_OPTIONS[idx]);
    const targetY = idx * REST_TIMER_ROW_HEIGHT;
    if (Math.abs(offsetY - targetY) > 1) {
      timerWheelRef.current?.scrollTo({ y: targetY, animated });
    }
  };
  const settleAfterQuietDrag = (offsetY: number) => {
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
    dragSettleTimer.current = setTimeout(() => {
      isInteracting.current = false;
      settleToIndex(offsetY, true);
    }, 90);
  };

  React.useEffect(() => {
    if (!visible) return;
    if (isInteracting.current) return;
    const idx = nearestRestTimerIndex(timerPickerValue);
    setTimerPickerValue(REST_TIMER_OPTIONS[idx]);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        timerWheelRef.current?.scrollTo({
          y: idx * REST_TIMER_ROW_HEIGHT,
          animated: false,
        });
      });
    });
  }, [visible]);
  React.useEffect(() => () => {
    if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
  }, []);

  const pickerSurface = (
        <View style={[styles.coreWheelSheet, styles.restTimerPickerSheet, { flex: 1, maxWidth: undefined, borderWidth: 0, borderRadius: 0 }]}>
          <View style={styles.coreWheelHeaderRow}>
            <View style={styles.coreWheelHeaderCopy}>
              <Text style={styles.coreWheelTitle}>Rest Timer</Text>
              <Text style={styles.coreWheelSubtitle}>
                {saveConfirmationVisible ? 'Set logged · Choose your next rest window.' : 'Choose your next rest window.'}
              </Text>
            </View>
          </View>
          <View style={styles.timerWheelWrap}>
            <View pointerEvents="none" style={styles.timerWheelCenterIndicator} />
            <ScrollView
              ref={timerWheelRef}
              style={styles.timerWheel}
              contentOffset={{
                x: 0,
                y: nearestRestTimerIndex(timerPickerValue) * REST_TIMER_ROW_HEIGHT,
              }}
              contentContainerStyle={[
                styles.timerWheelContent,
                { paddingVertical: centerPadding },
              ]}
              showsVerticalScrollIndicator={false}
              snapToInterval={REST_TIMER_ROW_HEIGHT}
              decelerationRate="normal"
              snapToAlignment="start"
              scrollEventThrottle={16}
              onScrollBeginDrag={() => {
                isInteracting.current = true;
                if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
              }}
              onMomentumScrollBegin={() => {
                isInteracting.current = true;
                if (dragSettleTimer.current) clearTimeout(dragSettleTimer.current);
              }}
              onScrollEndDrag={(e) => {
                settleAfterQuietDrag(e.nativeEvent.contentOffset.y);
              }}
              onMomentumScrollEnd={(e) => {
                isInteracting.current = false;
                settleToIndex(e.nativeEvent.contentOffset.y, true);
              }}
            >
              {REST_TIMER_OPTIONS.map((value) => {
                const label = formatRestTimerOption(value);
                const selected = timerPickerValue === value;

                return (
                  <View
                    key={value}
                    style={[styles.timerWheelOption, selected && styles.timerWheelOptionActive]}
                  >
                    <Text style={[styles.timerWheelText, selected && styles.timerWheelTextActive]}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.coreWheelActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
              onPress={() => onClose('dismissed')}
            >
              <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]}
              onPress={() => {
                startRestTimer(REST_TIMER_OPTIONS[nearestRestTimerIndex(timerPickerValue)]);
                onClose('selected');
              }}
            >
              <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>
                Start Timer
              </Text>
            </TouchableOpacity>
          </View>
        </View>
  );
  return <StrengthLedgerBottomSheet
    accessibilityLabel="Rest Timer"
    contentSwipeEnabled={false}
    heightFraction={embedded ? 0.62 : 0.56}
    onDismiss={() => onClose('dismissed')}
    onRequestClose={() => onClose('dismissed')}
    visible={visible}
  >
    {pickerSurface}
  </StrengthLedgerBottomSheet>;
}
