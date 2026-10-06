import { KeyboardAvoidingView } from '@/components/keyboard/KeyboardSurface';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, View } from 'react-native';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLButton } from '@/components/ui/sl-button';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StrengthLedgerBottomSheet, StrengthLedgerBottomSheetScrollView } from '@/components/sheets/StrengthLedgerBottomSheet';

import { SLColors, SLMotion, SLRadius, SLTypography } from '@/constants/theme';
import {
  bodyweightKgToDisplay,
  clampReadinessPosition,
  crossedReadinessBoundary,
  normalizedReadinessToCanonical,
  readinessPositionFromRailX,
  shouldAnimateReadinessThumb,
  sleepHoursFromPosition,
  type ReadinessDisplayUnit,
} from '@/lib/readiness';
import { useSLMotionPreviewOverrides } from '@/lib/motion-preview';
import type { SessionReadinessObservation } from '@/lib/session-readiness-start';

export type ReadinessScaleProps = {
  label: string;
  prompt?: string;
  low: string;
  high: string;
  position: number;
  descriptors?: readonly string[];
  valueText?: string;
  reduceMotion: boolean;
  hapticBoundaries?: boolean;
  hapticsEnabled?: boolean;
  accessibilityStep?: number;
  onChange: (position: number) => void;
};

export function ReadinessScale({
  label,
  prompt,
  low,
  high,
  position,
  descriptors,
  valueText,
  reduceMotion,
  hapticBoundaries = false,
  hapticsEnabled = true,
  accessibilityStep = 0.25,
  onChange,
}: ReadinessScaleProps) {
  const [railWidth, setRailWidth] = useState(0);
  const heldScale = useRef(new Animated.Value(1)).current;
  const previewMotion = useSLMotionPreviewOverrides();
  const lastPosition = useRef(position);
  const descriptor = descriptors?.[normalizedReadinessToCanonical(position) - 1];
  useEffect(() => {
    lastPosition.current = position;
  }, [position]);

  const updateFromRailX = useCallback((x: number) => {
    if (!railWidth) return;
    const next = readinessPositionFromRailX(x, railWidth);
    if (hapticsEnabled && hapticBoundaries && crossedReadinessBoundary(lastPosition.current, next)) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    lastPosition.current = next;
    onChange(next);
  }, [hapticBoundaries, hapticsEnabled, onChange, railWidth]);
  const setHeld = useCallback((held: boolean) => {
    heldScale.stopAnimation();
    if (!shouldAnimateReadinessThumb(reduceMotion)) {
      heldScale.stopAnimation();
      heldScale.setValue(1);
      return;
    }
    Animated.spring(heldScale, {
      toValue: held ? 1.12 : 1,
      ...(previewMotion?.spring ?? SLMotion.directSpring),
      useNativeDriver: true,
    }).start();
  }, [heldScale, previewMotion?.spring, reduceMotion]);
  const railGesture = useMemo(
    () => Gesture.Pan()
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .runOnJS(true)
      .onBegin(({ x }) => {
        setHeld(true);
        updateFromRailX(x);
      })
      .onUpdate(({ x }) => updateFromRailX(x))
      .onEnd(({ x }) => updateFromRailX(x))
      .onFinalize(() => setHeld(false)),
    [setHeld, updateFromRailX],
  );
  const accessibilityPosition = (delta: number) => {
    const next = clampReadinessPosition((Number.isFinite(position) ? position : 0.5) + delta);
    if (hapticsEnabled && hapticBoundaries && crossedReadinessBoundary(position, next)) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    onChange(next);
  };
  const hasSelection = Number.isFinite(position);
  const visualPosition = hasSelection ? position : 0.5;
  const canonicalValue = normalizedReadinessToCanonical(visualPosition);

  return (
    <View style={styles.scaleGroup}>
      <View style={styles.scaleHeaderRow}>
        <Text typographyRole="shortTechnicalLabel" style={styles.sectionLabel}>{label}</Text>
        <Text typographyRole={hasSelection ? valueText ? 'numeric' : 'bodyStrong' : 'caption'} style={[styles.liveValue, hasSelection ? styles.selectedValue : styles.unselectedValue]}>{hasSelection ? valueText || descriptor : 'Tap to choose'}</Text>
      </View>
      {prompt ? <Text typographyRole="bodyStrong" style={styles.prompt}>{prompt}</Text> : null}
      <View style={styles.endpointRow}>
        <Text typographyRole="caption" style={styles.endpoint}>{low}</Text>
        <Text typographyRole="caption" style={styles.endpoint}>{high}</Text>
      </View>
      <GestureDetector gesture={railGesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${label}. ${low} to ${high}`}
          accessibilityValue={!hasSelection ? { text: 'Not selected' } : valueText
            ? { text: valueText }
            : { min: 1, max: 5, now: canonicalValue, text: descriptor }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => accessibilityPosition(
            event.nativeEvent.actionName === 'increment' ? accessibilityStep : -accessibilityStep,
          )}
          onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
          style={styles.railTouchTarget}
        >
          <View style={styles.rail} />
          <View
            pointerEvents="none"
            style={[
              styles.railFill,
              { width: railWidth && hasSelection ? visualPosition * railWidth : 0 },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              { opacity: hasSelection ? 1 : 0.35, left: railWidth ? visualPosition * (railWidth - 22) : 0, transform: [{ scale: heldScale }] },
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

export type ReadinessModalValues = {
  bodyweight: string;
  bodyweightSkipped: boolean;
  sleepPosition: number;
  energyPosition: number;
  sorenessPosition: number;
  stressPosition: number;
};

type Props = {
  visible: boolean;
  context?: 'session' | 'daily';
  unit: ReadinessDisplayUnit;
  priorBodyweightKg?: number | null;
  values: ReadinessModalValues;
  error?: string | null;
  submitting: boolean;
  checking?: boolean;
  readOnly?: boolean;
  existing?: SessionReadinessObservation | null;
  canSubmit?: boolean;
  reduceMotion: boolean;
  onChange: (next: ReadinessModalValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onSkip?: () => void;
};

export function ReadinessModal({
  visible,
  context = 'session',
  unit,
  priorBodyweightKg,
  values,
  error,
  submitting,
  checking = false,
  readOnly = false,
  existing = null,
  canSubmit = true,
  reduceMotion,
  onChange,
  onSubmit,
  onCancel,
  onSkip,
}: Props) {
  const isDaily = context === 'daily';
  const priorDisplay = bodyweightKgToDisplay(priorBodyweightKg, unit);
  const submitLabel = isDaily ? 'Save Check-In' : existing ? 'Continue to Session' : 'Save & Begin Session';
  const submitDisabled = submitting || checking || readOnly || !canSubmit;
  const update = <K extends keyof ReadinessModalValues>(key: K, value: ReadinessModalValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <StrengthLedgerBottomSheet
      accessibilityLabel={isDaily ? 'Daily Readiness Check-In' : 'Pre-Session Readiness Check-In'}
      dismissalBlocked={submitting}
      dismissalBlockedMessage="Finish saving the readiness check before closing."
      motionPreset={reduceMotion ? 'standard' : 'deliberate'}
      onDismiss={onCancel}
      onRequestClose={onCancel}
      showCloseButton={false}
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text typographyRole="shortTechnicalLabel" style={styles.eyebrow}>{isDaily ? 'DAILY CHECK-IN' : 'PRE-SESSION'}</Text>
              <Text typographyRole="modalTitle" style={styles.title}>{isDaily ? 'How are you feeling today?' : 'How are we feeling?'}</Text>
              <Text typographyRole="caption" style={styles.subtitle}>
                {isDaily
                  ? 'Record readiness, recovery, and optional body weight.'
                  : 'Take a quick moment to check in before we begin.'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel readiness check"
              disabled={submitting}
              onPress={onCancel}
              hitSlop={10}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={SLColors.textMuted} />
            </Pressable>
          </View>

          <StrengthLedgerBottomSheetScrollView
            style={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {readOnly ? <Text style={styles.subtitle}>Preview only. Readiness and Session start are disabled.</Text> : null}
            {checking ? <Text accessibilityLiveRegion="polite" style={styles.subtitle}>Checking for an existing check-in…</Text> : null}
            {existing ? <View style={styles.bodyweightGroup}>
              <Text typographyRole="bodyStrong" style={styles.liveValue}>Readiness already recorded</Text>
              <Text style={styles.subtitle}>Your check-in for this {existing.workout_id ? 'Session' : 'day'} is saved. Continue without submitting it again.</Text>
              <Text style={styles.subtitle}>{[
                existing.sleep_hours != null ? `Sleep ${existing.sleep_hours} hr` : null,
                existing.energy != null ? `Energy ${existing.energy}/5` : null,
                existing.soreness != null ? `Soreness ${existing.soreness}/5` : null,
                existing.stress != null ? `Stress ${existing.stress}/5` : null,
                existing.bodyweight_kg != null ? `${bodyweightKgToDisplay(existing.bodyweight_kg, unit)} ${unit}` : null,
              ].filter(Boolean).join(' · ')}</Text>
            </View> : <View pointerEvents={submitting || checking ? 'none' : 'auto'}>
            <View style={styles.bodyweightGroup}>
              <Text typographyRole="shortTechnicalLabel" style={styles.sectionLabel}>BODY WEIGHT</Text>
              {!values.bodyweightSkipped ? (
            <View style={styles.weightEntry}>
                  <TextInput
                    accessibilityLabel={`Body weight in ${unit === 'kg' ? 'kilograms' : 'pounds'}`}
                    accessibilityHint="Enter an exact body weight or skip for today"
                    editable={!submitting}
                    keyboardType="decimal-pad"
                    value={values.bodyweight}
                    onChangeText={(text) => update('bodyweight', text.replace(',', '.'))}
                    placeholder={unit === 'kg' ? '90.0' : '198.4'}
                    placeholderTextColor={SLColors.textMuted}
                    selectTextOnFocus
                    style={styles.weightInput}
                  />
                  <Text typographyRole="unit" style={styles.unit}>{unit}</Text>
                </View>
              ) : null}
              <View style={styles.weightMetaRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: values.bodyweightSkipped }}
                  accessibilityLabel="Skip body weight for today"
                  disabled={submitting}
                  onPress={() => update('bodyweightSkipped', !values.bodyweightSkipped)}
                  hitSlop={8}
                >
                  <Text typographyRole="bodyStrong" style={styles.skipAction}>
                    {values.bodyweightSkipped ? 'Add body weight' : 'Skip for today'}
                  </Text>
                </Pressable>
                <Text typographyRole="caption" style={styles.priorWeight}>
                  {priorDisplay ? `Profile ${priorDisplay} ${unit}` : 'No body weight on file'}
                </Text>
              </View>
            </View>

            <ReadinessScale
              label="SLEEP"
              low="3 hr"
              high="12 hr"
              position={values.sleepPosition}
              valueText={`${sleepHoursFromPosition(values.sleepPosition).toFixed(1)} hr`}
              reduceMotion={reduceMotion}
              accessibilityStep={1 / 18}
              onChange={(value) => update('sleepPosition', value)}
            />
            <ReadinessScale label="ENERGY" low="Drained" high="Fired up" position={values.energyPosition} descriptors={['Drained', 'Low', 'Ready', 'Strong', 'Fired up']} reduceMotion={reduceMotion} hapticBoundaries onChange={(value) => update('energyPosition', value)} />
            <ReadinessScale label="SORENESS" low="Fresh" high="Very sore" position={values.sorenessPosition} descriptors={['Fresh', 'Light', 'Moderate', 'Sore', 'Very sore']} reduceMotion={reduceMotion} hapticBoundaries onChange={(value) => update('sorenessPosition', value)} />
            <ReadinessScale label="STRESS" low="Relaxed" high="High stress" position={values.stressPosition} descriptors={['Relaxed', 'Settled', 'Manageable', 'Elevated', 'High stress']} reduceMotion={reduceMotion} hapticBoundaries onChange={(value) => update('stressPosition', value)} />
            </View>}

            {error ? (
              <Text typographyRole="errorText" accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            ) : null}

          </StrengthLedgerBottomSheetScrollView>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={submitting
                ? (isDaily ? 'Saving check-in' : 'Beginning session')
                : submitLabel}
              accessibilityState={{ busy: submitting, disabled: submitDisabled }}
              disabled={submitDisabled}
              onPress={onSubmit}
              style={[styles.primaryButton, submitDisabled ? styles.disabledAction : null]}
            >
              <LinearGradient colors={['#9c59ee', '#6726cf']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
                pointerEvents="none" style={StyleSheet.absoluteFillObject} />
              {submitting ? <ActivityIndicator color="#ffffff" /> : <>
                <Text typographyRole="longButtonLabel" style={styles.primaryLabel}>{submitLabel}</Text>
                <Ionicons name="arrow-forward" size={19} color="#ffffff" />
              </>}
            </Pressable>
            {onSkip && !isDaily ? <SLButton
              accessibilityLabel="Skip readiness and begin Session"
              disabled={submitting || readOnly}
              fullWidth
              label="Skip & Begin Session"
              onPress={onSkip}
              size="lg"
              variant="ghost"
              style={styles.skipButton}
              textStyle={styles.skipButtonLabel}
            /> : null}
            {isDaily ? <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel readiness check"
              disabled={submitting}
              onPress={onCancel}
              hitSlop={8}
              style={styles.cancelButton}
            >
              <Text typographyRole="shortButtonLabel" style={styles.cancelText}>Cancel</Text>
            </Pressable> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </StrengthLedgerBottomSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'transparent' },
  sheet: { flex: 1, width: '100%', backgroundColor: '#08080c' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  headerCopy: { flex: 1, paddingRight: 10 },
  eyebrow: { color: '#bc91ef', fontSize: 10, lineHeight: 15, letterSpacing: 1.5, marginBottom: 7 },
  title: { ...SLTypography.hero, color: '#f4f0fa', fontSize: 25, lineHeight: 31, letterSpacing: -0.6 },
  subtitle: { color: '#aaa5b5', fontSize: 13, lineHeight: 19, marginTop: 6 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -10 },
  formScroll: { flex: 1 },
  actions: { paddingHorizontal: 20, paddingBottom: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#292532', backgroundColor: '#08080c' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 14 },
  bodyweightGroup: { paddingTop: 0, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292532' },
  sectionLabel: { color: '#b7afc5', fontSize: 10, lineHeight: 15, letterSpacing: 1.2 },
  weightEntry: { height: 54, marginTop: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#3a3548', borderRadius: 12, backgroundColor: '#101017' },
  weightInput: { ...SLTypography.kpiNumber, flex: 1, height: 54, color: SLColors.text, fontWeight: '800', paddingHorizontal: 14 },
  unit: { ...SLTypography.sectionTitle, color: SLColors.textMuted, fontWeight: '800', paddingRight: 14 },
  weightMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 9 },
  skipAction: { color: '#c79cf6', fontSize: 14, lineHeight: 20 },
  priorWeight: { flex: 1, textAlign: 'right', color: SLColors.textMuted, fontSize: SLTypography.caption.fontSize },
  scaleGroup: { paddingTop: 12, paddingBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#211e29' },
  scaleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveValue: { color: '#f4f0fa', fontSize: 16, lineHeight: 22 },
  selectedValue: { color: '#c79cf6' },
  unselectedValue: { color: '#aaa5b5', fontSize: 13 },
  prompt: { color: '#e5dfef', fontSize: 14, lineHeight: 20, marginTop: 6 },
  endpointRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  endpoint: { color: '#9992a8', fontSize: 12, lineHeight: 18 },
  railTouchTarget: { height: 46, justifyContent: 'center' },
  rail: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: SLRadius.pill, backgroundColor: '#2e2839' },
  railFill: { position: 'absolute', left: 0, height: 4, borderRadius: SLRadius.pill, backgroundColor: '#b586ed' },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: SLRadius.pill, backgroundColor: '#c79cf6', borderWidth: 3, borderColor: '#08080c' },
  errorText: { color: SLColors.danger, fontSize: SLTypography.label.fontSize, lineHeight: 19, marginTop: 10 },
  primaryButton: { minHeight: 54, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: '#aa77e8', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryLabel: { color: '#ffffff', fontSize: 16, lineHeight: 22, flexShrink: 1, textAlign: 'center' },
  disabledAction: { opacity: 0.5 },
  skipButton: { marginTop: 4, minHeight: 44, paddingVertical: 10 },
  skipButtonLabel: { color: '#b9b2c9', fontSize: 14, lineHeight: 20 },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelText: { color: SLColors.textMuted, fontSize: SLTypography.label.fontSize, fontWeight: '700' },
});
