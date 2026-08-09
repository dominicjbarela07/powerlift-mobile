import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLButton } from '@/components/ui/sl-button';
import { SLMaterialOverlay } from '@/components/ui/sl-workspace';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { SLColors, SLMotion, SLRadius, SLShadows, SLTypography } from '@/constants/theme';
import {
  bodyweightKgToDisplay,
  clampReadinessPosition,
  crossedReadinessBoundary,
  normalizedReadinessToCanonical,
  shouldAnimateReadinessThumb,
  sleepHoursFromPosition,
  type ReadinessDisplayUnit,
} from '@/lib/readiness';
import { useSLMotionPreviewOverrides } from '@/lib/motion-preview';

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
  onChange,
}: ReadinessScaleProps) {
  const [railWidth, setRailWidth] = useState(0);
  const railRef = useRef<View>(null);
  const railWindowX = useRef<number | null>(null);
  const heldScale = useRef(new Animated.Value(1)).current;
  const previewMotion = useSLMotionPreviewOverrides();
  const lastPosition = useRef(position);
  const descriptor = descriptors?.[normalizedReadinessToCanonical(position) - 1];
  useEffect(() => {
    lastPosition.current = position;
  }, [position]);

  const measureRail = useCallback(() => {
    railRef.current?.measureInWindow((x) => {
      railWindowX.current = x;
    });
  }, []);

  const updateFromEvent = (event: any) => {
    if (!railWidth) return;
    const { locationX, pageX } = event.nativeEvent;
    const x = railWindowX.current != null && Number.isFinite(pageX)
      ? pageX - railWindowX.current
      : locationX;
    const next = clampReadinessPosition(x / railWidth);
    if (hapticsEnabled && hapticBoundaries && crossedReadinessBoundary(lastPosition.current, next)) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    lastPosition.current = next;
    onChange(next);
  };
  const setHeld = (held: boolean) => {
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
  };

  return (
    <View style={styles.scaleGroup}>
      <View style={styles.scaleHeaderRow}>
        <Text typographyRole="shortTechnicalLabel" style={styles.sectionLabel}>{label}</Text>
        <Text typographyRole={valueText ? 'numeric' : 'bodyStrong'} style={styles.liveValue}>{valueText || descriptor}</Text>
      </View>
      {prompt ? <Text typographyRole="bodyStrong" style={styles.prompt}>{prompt}</Text> : null}
      <View style={styles.endpointRow}>
        <Text typographyRole="caption" style={styles.endpoint}>{low}</Text>
        <Text typographyRole="caption" style={styles.endpoint}>{high}</Text>
      </View>
      <View
        ref={railRef}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${label}. ${low} to ${high}`}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(position * 100), text: valueText || descriptor }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => onChange(clampReadinessPosition(position + (event.nativeEvent.actionName === 'increment' ? 0.05 : -0.05)))}
        onLayout={(event) => {
          setRailWidth(event.nativeEvent.layout.width);
          measureRail();
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => { measureRail(); setHeld(true); updateFromEvent(event); }}
        onResponderMove={updateFromEvent}
        onResponderRelease={(event) => { updateFromEvent(event); setHeld(false); }}
        onResponderTerminate={() => setHeld(false)}
        style={styles.railTouchTarget}
      >
        <View style={styles.rail} />
        <View
          pointerEvents="none"
          style={[
            styles.railFill,
            { width: railWidth ? position * railWidth : 0 },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            { left: railWidth ? position * (railWidth - 22) : 0, transform: [{ scale: heldScale }] },
          ]}
        />
      </View>
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
  unit: ReadinessDisplayUnit;
  priorBodyweightKg?: number | null;
  values: ReadinessModalValues;
  error?: string | null;
  submitting: boolean;
  reduceMotion: boolean;
  onChange: (next: ReadinessModalValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export function ReadinessModal({
  visible,
  unit,
  priorBodyweightKg,
  values,
  error,
  submitting,
  reduceMotion,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  const priorDisplay = bodyweightKgToDisplay(priorBodyweightKg, unit);
  const update = <K extends keyof ReadinessModalValues>(key: K, value: ReadinessModalValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={() => !submitting && onCancel()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet} accessibilityViewIsModal>
          <SLMaterialOverlay level={3} />
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text typographyRole="modalTitle" style={styles.title}>How are we feeling?</Text>
              <Text typographyRole="modalBody" style={styles.subtitle}>Take a quick moment to check in before we begin.</Text>
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

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.bodyweightGroup}>
              <Text typographyRole="shortTechnicalLabel" style={styles.sectionLabel}>BODY WEIGHT</Text>
              {!values.bodyweightSkipped ? (
            <View style={styles.weightEntry}>
              <SLMaterialOverlay compact level={2} />
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
              prompt="How much sleep did you get?"
              low="3 hr"
              high="12 hr"
              position={values.sleepPosition}
              valueText={`${sleepHoursFromPosition(values.sleepPosition).toFixed(1)} hr`}
              reduceMotion={reduceMotion}
              onChange={(value) => update('sleepPosition', value)}
            />
            <ReadinessScale label="ENERGY" low="Drained" high="Fired up" position={values.energyPosition} descriptors={['Drained', 'Low', 'Ready', 'Strong', 'Fired up']} reduceMotion={reduceMotion} hapticBoundaries onChange={(value) => update('energyPosition', value)} />
            <ReadinessScale label="SORENESS" low="Fresh" high="Very sore" position={values.sorenessPosition} descriptors={['Fresh', 'Light', 'Moderate', 'Sore', 'Very sore']} reduceMotion={reduceMotion} hapticBoundaries onChange={(value) => update('sorenessPosition', value)} />
            <ReadinessScale label="STRESS" low="Relaxed" high="High stress" position={values.stressPosition} descriptors={['Relaxed', 'Settled', 'Manageable', 'Elevated', 'High stress']} reduceMotion={reduceMotion} hapticBoundaries onChange={(value) => update('stressPosition', value)} />

            {error ? (
              <Text typographyRole="errorText" accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            ) : null}

            <SLButton
              accessibilityLabel={submitting ? 'Beginning session' : 'Begin Session'}
              accessibilityState={{ busy: submitting, disabled: submitting }}
              disabled={submitting}
              fullWidth
              label="Begin Session"
              loading={submitting}
              onPress={onSubmit}
              size="lg"
              style={styles.primaryButton}
              variant="primary"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel readiness check"
              disabled={submitting}
              onPress={onCancel}
              hitSlop={8}
              style={styles.cancelButton}
            >
              <Text typographyRole="shortButtonLabel" style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: SLColors.surfaceScrim, paddingHorizontal: 8 },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '94%', alignSelf: 'center', backgroundColor: SLColors.surfaceFloating, borderTopLeftRadius: SLRadius.radiusSheet, borderTopRightRadius: SLRadius.radiusSheet, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStrong, borderTopColor: SLColors.borderFocus, overflow: 'hidden', ...SLShadows.level3 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  headerCopy: { flex: 1, paddingRight: 10 },
  title: { ...SLTypography.hero, color: SLColors.text, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { color: SLColors.textMuted, fontSize: SLTypography.label.fontSize, lineHeight: 20, marginTop: 5 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -10 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 16 },
  bodyweightGroup: { paddingTop: 5, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.border },
  sectionLabel: { color: SLColors.textMuted, fontSize: SLTypography.caption.fontSize, fontWeight: '900', letterSpacing: 1.2 },
  weightEntry: { height: 54, marginTop: 9, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: SLColors.borderStrong, borderRadius: SLRadius.md, backgroundColor: SLColors.surfaceRaised },
  weightInput: { ...SLTypography.kpiNumber, flex: 1, height: 54, color: SLColors.text, fontWeight: '800', paddingHorizontal: 14 },
  unit: { ...SLTypography.sectionTitle, color: SLColors.textMuted, fontWeight: '800', paddingRight: 14 },
  weightMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 9 },
  skipAction: { color: SLColors.textStrong, fontSize: SLTypography.label.fontSize, fontWeight: '800' },
  priorWeight: { flex: 1, textAlign: 'right', color: SLColors.textMuted, fontSize: SLTypography.caption.fontSize },
  scaleGroup: { paddingTop: 15 },
  scaleHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveValue: { color: SLColors.text, fontSize: SLTypography.label.fontSize, fontWeight: '800' },
  prompt: { color: SLColors.text, fontSize: SLTypography.label.fontSize, fontWeight: '700', marginTop: 5 },
  endpointRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  endpoint: { color: SLColors.textMuted, fontSize: SLTypography.caption.fontSize, fontWeight: '700' },
  railTouchTarget: { height: 42, justifyContent: 'center' },
  rail: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: SLRadius.pill, backgroundColor: SLColors.borderStrong },
  railFill: { position: 'absolute', left: 0, height: 4, borderRadius: SLRadius.pill, backgroundColor: SLColors.accent },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: SLRadius.pill, backgroundColor: SLColors.accent, borderWidth: 3, borderColor: SLColors.surfaceFloating },
  errorText: { color: SLColors.danger, fontSize: SLTypography.label.fontSize, lineHeight: 19, marginTop: 10 },
  primaryButton: { marginTop: 16 },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelText: { color: SLColors.textMuted, fontSize: SLTypography.label.fontSize, fontWeight: '700' },
});
