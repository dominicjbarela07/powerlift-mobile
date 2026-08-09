// @ts-nocheck

import React from 'react';
import { BlurView } from 'expo-blur';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLColors } from '@/constants/theme';

const REST_TIMER_OPTIONS = Array.from({ length: 12 }, (_, idx) => (idx + 1) * 30);
const REST_TIMER_ROW_HEIGHT = 44;
const REST_TIMER_VISIBLE_ROWS = 5;

function formatRestTimerOption(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs ? `${mins}:${String(secs).padStart(2, '0')}` : `${mins}:00`;
}

function nearestRestTimerIndex(value?: number | null) {
  const seconds = Number(value || 120);
  let bestIndex = REST_TIMER_OPTIONS.indexOf(120);
  let bestDelta = Number.POSITIVE_INFINITY;
  REST_TIMER_OPTIONS.forEach((option, index) => {
    const delta = Math.abs(option - seconds);
    if (delta < bestDelta) {
      bestIndex = index;
      bestDelta = delta;
    }
  });
  return bestIndex;
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
  styles,
}: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.postSessionTitle}>
            {workoutStatus === 'completed' ? 'Resume this training session?' : 'Cancel this training session?'}
          </Text>

          {workoutStatus !== 'completed' ? (
            <Text style={styles.postSessionSubtitle}>
              This will discard this training session, remove all logged sets, clear the session timer, and return the session to its assigned state.
            </Text>
          ) : null}

          <View style={styles.modalActionsRow}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionSecondary,
                { flex: 1 },
              ]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  styles.actionSecondaryText,
                ]}
              >
                Keep Session
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                workoutStatus === 'completed' ? styles.actionPrimary : styles.actionDanger,
                { flex: 1 },
              ]}
              onPress={onConfirm}
            >
              <Text style={[styles.actionButtonText, workoutStatus === 'completed' ? styles.actionPrimaryText : styles.actionDangerText]}>
                {workoutStatus === 'completed' ? 'Resume Session' : 'Cancel Session'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.coreWheelBackdrop, styles.restTimerPickerBackdrop]}>
        <BlurView
          experimentalBlurMethod="dimezisBlurView"
          intensity={28}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          tint="dark"
        />
        <View style={[styles.coreWheelBackdropHit, styles.restTimerPickerBackdropHit]} />
        <View style={[styles.coreWheelSheet, styles.restTimerPickerSheet]}>
          <View style={styles.coreWheelHandle} />
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
      </View>
    </Modal>
  );
}
