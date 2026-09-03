import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import {
  StrengthLedgerBottomSheet,
  StrengthLedgerBottomSheetScrollView,
} from '@/components/sheets/StrengthLedgerBottomSheet';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SessionUnitFloatingControl } from '@/components/workout-logger/logger-primitives';
import { API_BASE, fetchJson } from '@/lib/api';
import { resolveBarConfigurationAsset } from '@/lib/barbell/bar-configuration-assets';
import { formatLoggerWeightKg } from '@/lib/logger-weight-format';
import { resolvePhysicalPlateStackRender } from '@/lib/barbell/plate-stack-render-resolver';
import { useSLReducedMotion } from '@/lib/motion';
import { formatWarmupPhysicalConfiguration } from '@/lib/smart-warmup';
import type { SmartWarmupEnvelope, SmartWarmupFeedback, SmartWarmupSession, SmartWarmupStep } from '@/lib/smart-warmup';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';

type CoreWarmupItem = Readonly<{
  id: number;
  movement: string | null;
  has_performed_evidence?: boolean;
  smart_warmup?: SmartWarmupEnvelope | null;
}>;

const BAR_PRESETS = {
  kg: ['kg_15', 'kg_20', 'kg_25'],
  lb: ['lb_35', 'lb_45', 'lb_55'],
} as const;
const EMPTY_WARMUP_STEPS: SmartWarmupStep[] = [];
const COLLAR_ASSET = require('@/assets/images/barbell_collar.png');
const STYLE_STOPS = { minimal: 3, standard: 4, gradual: 5 } as const;
const STYLE_HINTS = { minimal: 'Fewer sets\nbigger jumps', standard: 'Balanced\nprogression', gradual: 'More sets\nsmaller jumps' } as const;
const FEEDBACK_OPTIONS = [
  { key: 'flies', label: 'Flies' },
  { key: 'expected', label: 'Normal' },
  { key: 'heavy', label: 'Heavy' },
  { key: 'very_heavy', label: 'Very Heavy' },
] as const;

function weightLabel(weightKg: number, unit: 'kg' | 'lb') {
  return `${formatLoggerWeightKg(weightKg, unit)} ${unit}`;
}

function titleCase(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function feedbackLabel(value: SmartWarmupFeedback) {
  return FEEDBACK_OPTIONS.find((option) => option.key === value)?.label
    || (value === 'fast' ? 'Flies' : value === 'slow' ? 'Heavy' : titleCase(value.replaceAll('_', ' ')));
}

function configSummary(warmup: SmartWarmupSession, displayUnit: 'kg' | 'lb') {
  return `${titleCase(warmup.preference)} · ${formatWarmupPhysicalConfiguration(warmup.loading_configuration, displayUnit)}`;
}

function ProgressionGlyph({ preference, selected }: { preference: keyof typeof STYLE_STOPS; selected: boolean }) {
  const stops = STYLE_STOPS[preference];
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.progressionGlyph}>
    {Array.from({ length: stops }).map((_, index) => (
      <LinearGradient
        colors={selected ? ['#A970FF', '#2A2038'] : ['#625373', '#15131B']}
        end={{ x: 0, y: 1 }}
        key={`${preference}-${index}`}
        start={{ x: 0, y: 0 }}
        style={[styles.progressionStep, { height: 14 + index * (preference === 'minimal' ? 17 : preference === 'standard' ? 12 : 8) }]}
      />
    ))}
  </View>;
}

function barPresetCopy(barKey: string, displayUnit: 'kg' | 'lb') {
  const physical = Number(barKey.split('_')[1]);
  const converted = displayUnit === 'lb' ? physical * 0.45359237 : physical / 0.45359237;
  return {
    label: `${physical} ${displayUnit}`,
    conversion: displayUnit === 'lb' ? `${converted.toFixed(1)} kg` : `${converted.toFixed(1)} lb`,
  };
}

function EquipmentTile({
  accessibilityLabel,
  children,
  disabled = false,
  label,
  onPress,
  selected,
  testID,
  value,
}: {
  accessibilityLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  selected: boolean;
  testID?: string;
  value?: string;
}) {
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} onPressIn={() => { if (!disabled) void Haptics.selectionAsync().catch(() => undefined); }} style={({ pressed }) => [styles.equipmentTile, selected && styles.equipmentTileSelected, pressed && styles.selectionTilePressed, disabled && styles.equipmentTileDisabled]} testID={testID}>
    {selected ? <View style={styles.equipmentCheck}><Ionicons name="checkmark" size={11} color="#FFFFFF" /></View> : null}
    <View style={styles.equipmentVisual}>{children}</View>
    <Text numberOfLines={1} style={styles.equipmentLabel}>{label}</Text>
    {value ? <Text numberOfLines={1} style={styles.equipmentValue}>{value}</Text> : null}
  </Pressable>;
}

function NoCollarsVisual() {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.noCollarsVisual}><View style={styles.noCollarsRing} /><View style={styles.noCollarsSlash} /></View>;
}

function PhysicalConfigurationPreview({ warmup, displayUnit }: { warmup: SmartWarmupSession; displayUnit: 'kg' | 'lb' }) {
  const config = warmup.loading_configuration;
  return <View style={styles.previewCard} testID="smart-warmup-configuration-preview">
    <View style={styles.previewCopy}><Text style={styles.previewEyebrow}>PREVIEW</Text><Text style={styles.previewValue}>{weightLabel(config.bar_weight_kg, displayUnit)}</Text><Text style={styles.previewCaption}>Bar</Text></View>
    <View style={styles.previewHardware}>
      <Image accessibilityIgnoresInvertColors accessibilityLabel="Configured complete barbell" resizeMode="contain" source={resolveBarConfigurationAsset(config.bar_key, config.collar_key)} style={styles.previewBarAsset} />
    </View>
    <View style={[styles.previewCopy, styles.previewCopyRight]}><Text style={styles.previewValue}>{weightLabel(config.collar_weight_kg, displayUnit)}</Text><Text style={styles.previewCaption}>Collars</Text></View>
  </View>;
}

function CustomWeightEditor({ busy, displayUnit, kind, onCancel, onSave, value }: { busy: boolean; displayUnit: 'kg' | 'lb'; kind: 'bar' | 'collar'; onCancel: () => void; onSave: (value: number) => Promise<boolean>; value: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const label = kind === 'bar' ? 'Custom Bar Weight' : 'Custom Collar Pair Weight';
  return <View accessibilityViewIsModal style={styles.customEditorStage} testID={`smart-warmup-custom-${kind}-editor`}>
    <Pressable accessibilityLabel={`Cancel ${label.toLowerCase()}`} onPress={onCancel} style={styles.customEditorBackdrop} />
    <View style={styles.customEditorSheet}>
      <View style={styles.configHandle} />
      <View style={styles.customEditorHeader}><View><Text style={styles.customEditorTitle}>{label}</Text><Text style={styles.customEditorSubtitle}>{kind === 'bar' ? 'Set the exact physical bar weight.' : 'Both collars combined.'}</Text></View><Pressable accessibilityLabel={`Close ${label.toLowerCase()}`} onPress={onCancel} style={styles.configClose}><Ionicons name="close" size={22} color={SLColors.textStrong} /></Pressable></View>
      <View style={styles.customEditorInputRow}><TextInput accessibilityLabel={`${label} in ${displayUnit}`} autoFocus keyboardType="decimal-pad" onChangeText={setDraft} placeholder="0" placeholderTextColor={SLColors.textMuted} style={styles.customEditorInput} value={draft} /><Text style={styles.customEditorUnit}>{displayUnit}</Text></View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { const numeric = Number(draft); if (Number.isFinite(numeric) && numeric > 0) void onSave(numeric); }} onPressIn={() => { if (!busy) void Haptics.selectionAsync().catch(() => undefined); }} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, pressed && styles.primaryButtonPressedMotion]} testID={`smart-warmup-custom-${kind}-save`}>
        {busy ? <View style={styles.primaryButtonLoading}><ActivityIndicator color="#FFFFFF" size="small" /><Text style={styles.primaryButtonText}>Saving…</Text></View> : <Text style={styles.primaryButtonText}>Use This Weight</Text>}
      </Pressable>
    </View>
  </View>;
}

export function SmartWarmupSheet({
  item,
  workoutId,
  preferredUnit,
  visible,
  onClose,
  onRefresh,
  onOpenRestTimerPicker,
  restTimerActive = false,
  restTimerSeconds = 0,
  onStopRestTimer,
  restTimerPicker,
}: {
  item: CoreWarmupItem | null;
  workoutId: number;
  preferredUnit: 'kg' | 'lb';
  visible: boolean;
  onClose: () => void;
  onRefresh: () => Promise<unknown>;
  onOpenRestTimerPicker: (suggestedSeconds: number) => void;
  restTimerActive?: boolean;
  restTimerSeconds?: number;
  onStopRestTimer?: () => void;
  restTimerPicker?: React.ReactNode;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const reduceMotion = useSLReducedMotion();
  const [warmup, setWarmup] = useState<SmartWarmupSession | null>(item?.smart_warmup?.session || null);
  const [displayUnit, setDisplayUnit] = useState<'kg' | 'lb'>(item?.smart_warmup?.session?.loading_configuration.unit || preferredUnit);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configVisible, setConfigVisible] = useState(false);
  const [customBarDraft, setCustomBarDraft] = useState('');
  const [customBarEditing, setCustomBarEditing] = useState(false);
  const [customCollarDraft, setCustomCollarDraft] = useState('');
  const [customCollarEditing, setCustomCollarEditing] = useState(false);
  const [configurationChangedAfterProgress, setConfigurationChangedAfterProgress] = useState(false);
  const [configurationNotice, setConfigurationNotice] = useState<string | null>(null);
  const [adaptationNotice, setAdaptationNotice] = useState<string | null>(null);
  const [inspectedSequence, setInspectedSequence] = useState<number | null>(null);
  const startAttemptRef = useRef<string | null>(null);
  const displayItemIdRef = useRef<number | null>(item?.id ?? null);
  const mutationInFlightRef = useRef(false);
  const progressionRef = useRef<ScrollView>(null);

  useEffect(() => {
    const nextWarmup = item?.smart_warmup?.session || null;
    setWarmup(nextWarmup);
    const nextItemId = item?.id ?? null;
    if (displayItemIdRef.current !== nextItemId) {
      displayItemIdRef.current = nextItemId;
      setDisplayUnit(nextWarmup?.loading_configuration.unit || preferredUnit);
    }
    if (nextWarmup) {
      setBusy(false);
    }
  }, [item?.id, item?.smart_warmup?.session, preferredUnit]);
  useEffect(() => {
    if (!warmup) setDisplayUnit(preferredUnit);
  }, [item?.id, preferredUnit, warmup]);
  useEffect(() => {
    const config = warmup?.loading_configuration;
    if (!config || config.bar_key !== 'custom') return;
    const physicalWeight = displayUnit === 'kg'
      ? config.bar_weight_kg
      : config.bar_weight_kg / 0.45359237;
    setCustomBarDraft(String(Number(physicalWeight.toFixed(2))));
  }, [displayUnit, warmup?.id, warmup?.loading_configuration, warmup?.loading_configuration.bar_key, warmup?.loading_configuration.bar_weight_kg]);
  useEffect(() => {
    const config = warmup?.loading_configuration;
    if (!config || !['custom', 'light'].includes(config.collar_key)) return;
    const physicalWeight = displayUnit === 'kg'
      ? config.collar_weight_kg
      : config.collar_weight_kg / 0.45359237;
    setCustomCollarDraft(String(Number(physicalWeight.toFixed(2))));
  }, [displayUnit, warmup?.id, warmup?.loading_configuration, warmup?.loading_configuration.collar_key, warmup?.loading_configuration.collar_weight_kg]);
  useEffect(() => {
    if (!visible) {
      mutationInFlightRef.current = false;
      setBusy(false);
      setPendingAction(null);
      setError(null);
      setConfigVisible(false);
      setCustomBarEditing(false);
      setCustomCollarEditing(false);
      setConfigurationChangedAfterProgress(false);
      setConfigurationNotice(null);
      setAdaptationNotice(null);
      setInspectedSequence(null);
      startAttemptRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    const itemId = item?.id;
    const suppliedWarmup = item?.smart_warmup?.session || null;
    if (!visible || !itemId || suppliedWarmup || warmup || error) return;
    const attemptKey = `${workoutId}:${itemId}:${preferredUnit}`;
    if (startAttemptRef.current === attemptKey) return;
    startAttemptRef.current = attemptKey;
    let current = true;
    setBusy(true);
    setError(null);
    void fetchJson(`${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/warmup`, {
      method: 'POST', auth: true, body: { loading_unit: preferredUnit, preference: 'standard' } as any,
    }).then(({ ok, json }) => {
      if (!current) return;
      if (!ok || !json?.ok) throw new Error(json?.error || 'Could not begin warmups');
      // Clear the startup lock before publishing the new session. Publishing it
      // changes this effect's dependencies and runs cleanup; a guarded finally
      // alone can therefore leave the controls disabled forever.
      setBusy(false);
      setWarmup(json.warmup?.session || null);
      void onRefresh();
    }).catch((reason) => {
      if (!current) return;
      setBusy(false);
      setError(reason?.message || 'Could not begin warmups');
    });
    return () => { current = false; };
  }, [error, item?.id, item?.smart_warmup?.session, onRefresh, preferredUnit, visible, warmup, workoutId]);

  const mutate = async (body: Record<string, unknown>): Promise<boolean> => {
    if (!item || mutationInFlightRef.current) return false;
    mutationInFlightRef.current = true;
    setBusy(true);
    setPendingAction(typeof body.action === 'string' ? body.action : 'update');
    setError(null);
    if (body.feedback) setAdaptationNotice(null);
    try {
      const { ok, json } = await fetchJson(`${API_BASE}/workouts/mobile/${workoutId}/items/${item.id}/warmup`, {
        method: 'PATCH', auth: true, body: body as any,
      });
      if (!ok || !json?.ok) throw new Error(json?.error || 'Warmup update failed');
      const nextWarmup = json.warmup?.session || null;
      if (nextWarmup && body.action === 'complete_step' && typeof body.feedback === 'string') {
        const previousCount = warmup?.progression.adaptations?.length || 0;
        const nextAdaptations = nextWarmup.progression.adaptations || [];
        if (nextAdaptations.length > previousCount) {
          const latest = nextAdaptations[nextAdaptations.length - 1];
          const remaining = Math.max(0, nextWarmup.progression.steps.length - nextWarmup.completed_steps.length);
          const changed = JSON.stringify(latest?.previous_future_kg || []) !== JSON.stringify(latest?.adapted_future_kg || []);
          setAdaptationNotice(changed
            ? `${remaining} future warmup${remaining === 1 ? '' : 's'} updated`
            : 'Warmup ramp confirmed');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
      }
      setWarmup(nextWarmup);
      await onRefresh();
      return true;
    } catch (reason: any) {
      setError(reason?.message || 'Warmup update failed');
      return false;
    } finally {
      mutationInFlightRef.current = false;
      setPendingAction(null);
      setBusy(false);
    }
  };

  const changeDisplayUnit = (nextUnit: 'kg' | 'lb') => {
    setDisplayUnit(nextUnit);
  };

  const configure = (body: Record<string, unknown>) => {
    if ((warmup?.completed_steps.length || 0) > 0) setConfigurationChangedAfterProgress(true);
    return mutate({ action: 'configure', ...body });
  };

  const openConfiguration = () => {
    setConfigurationChangedAfterProgress(false);
    setConfigurationNotice(null);
    setConfigVisible(true);
  };

  const finishConfiguration = () => {
    setCustomBarEditing(false);
    setCustomCollarEditing(false);
    setConfigVisible(false);
    if (!configurationChangedAfterProgress || !warmup) return;
    const remaining = Math.max(0, warmup.progression.steps.length - warmup.completed_steps.length);
    setConfigurationNotice(`${remaining} remaining warmup${remaining === 1 ? '' : 's'} updated`);
  };

  const requestSheetClose = () => {
    if (customBarEditing) {
      setCustomBarEditing(false);
      return;
    }
    if (customCollarEditing) {
      setCustomCollarEditing(false);
      return;
    }
    if (configVisible) {
      finishConfiguration();
      return;
    }
    onClose();
  };

  const steps = warmup?.progression?.steps || EMPTY_WARMUP_STEPS;
  const activeStepIndex = warmup?.status === 'active'
    ? Math.max(0, Math.min(warmup.active_step_index, Math.max(steps.length - 1, 0)))
    : Math.max(steps.length - 1, 0);
  const activeStep = warmup?.status === 'active' ? steps[activeStepIndex] : null;
  const inspectedStep = inspectedSequence == null
    ? null
    : steps.find((step) => step.sequence === inspectedSequence && warmup?.completed_steps.includes(step.sequence)) || null;
  const lastCompletedSequence = warmup?.last_completed_sequence
    ?? (warmup?.completed_steps.length ? Math.max(...warmup.completed_steps) : null);
  const progressionCardWidth = Math.max(116, Math.min(142, Math.round(viewportWidth * 0.35)));
  const progressionStride = progressionCardWidth + 8;
  const recommendation = warmup?.recommended_target_kg || null;
  const recommendationLoading = warmup && recommendation
    ? warmup.allowed_working_loads.find((option) => Math.abs(option.total_kg - recommendation) < 0.0001) || warmup.progression.recommendation?.loading || null
    : null;
  const recommendationRender = recommendationLoading ? resolvePhysicalPlateStackRender(recommendationLoading) : null;

  useEffect(() => {
    if (inspectedSequence != null && !inspectedStep) setInspectedSequence(null);
  }, [inspectedSequence, inspectedStep]);

  const undoStep = (sequence: number) => {
    if (!warmup || busy) return;
    const hasDownstreamProgress = warmup.completed_steps.some((value) => value > sequence)
      || warmup.diagnostic_feedback.some((entry) => entry.sequence > sequence);
    const performUndo = () => {
      void mutate({ action: 'undo_step', sequence }).then((didUndo) => {
        if (!didUndo) return;
        setInspectedSequence(null);
        if (restTimerActive) onStopRestTimer?.();
      });
    };
    if (!hasDownstreamProgress) {
      performUndo();
      return;
    }
    Alert.alert(
      `Undo warmup ${sequence}?`,
      'Later completed warmups, diagnostic feedback, and the current recommendation will be cleared.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Undo', style: 'destructive', onPress: performUndo }],
    );
  };

  const undoLastStep = () => {
    if (!warmup || busy || lastCompletedSequence == null) return;
    void mutate({ action: 'undo_last_step', expected_sequence: lastCompletedSequence }).then((didUndo) => {
      if (!didUndo) return;
      setInspectedSequence(null);
      if (restTimerActive) onStopRestTimer?.();
    });
  };

  useEffect(() => {
    if (!visible || !steps.length) return;
    progressionRef.current?.scrollTo({
      x: Math.max(0, (inspectedStep ? steps.indexOf(inspectedStep) : activeStepIndex) * progressionStride - 8),
      animated: !reduceMotion,
    });
  }, [activeStepIndex, inspectedStep, progressionStride, reduceMotion, steps, visible]);

  return (
    <StrengthLedgerBottomSheet
      accessibilityLabel={`${item?.movement || 'Core lift'} warmup`}
      dismissalBlocked={busy}
      dismissalBlockedMessage="Finish the warmup update before closing."
      motionPreset="deliberate"
      visible={visible}
      onDismiss={onClose}
      onRequestClose={requestSheetClose}
    >
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>{item?.movement || 'Core Lift'} Warmup</Text>
          </View>
        </View>
        {busy && !warmup ? <View style={styles.loading}><ActivityIndicator color={SLColors.accentViolet} /><Text style={styles.muted}>Building a loadable warmup…</Text></View> : null}
        {error ? <View style={styles.errorPanel}><Text style={styles.error}>{error}</Text>{!warmup ? <Pressable onPress={() => { startAttemptRef.current = null; setError(null); }} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Try Again</Text></Pressable> : null}</View> : null}
        {warmup ? (
          <StrengthLedgerBottomSheetScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.targetCard}>
              <View style={styles.targetColumn}><Text style={styles.eyebrow}>TODAY&apos;S RANGE</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.target}>{weightLabel(warmup.prescribed_low_kg, displayUnit)} – {weightLabel(warmup.prescribed_high_kg, displayUnit)}</Text></View>
              <View style={styles.targetDivider} />
              <View style={styles.targetColumn}><Text style={styles.eyebrow}>INITIAL TARGET</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.target}>{weightLabel(warmup.initial_target_kg, displayUnit)}</Text></View>
            </View>

            {warmup.status === 'active' ? (
              <Pressable accessibilityLabel="Edit warmup configuration" accessibilityRole="button" disabled={busy} onPress={openConfiguration} style={styles.configSummary} testID="smart-warmup-edit-configuration">
                <View style={styles.configCopy}><Ionicons name="options-outline" size={18} color={SLColors.accentViolet} /><Text numberOfLines={1} style={styles.configSummaryText}>{configSummary(warmup, displayUnit)}</Text></View>
                <Text style={styles.editLabel}>Edit</Text>
              </Pressable>
            ) : null}
            {configurationNotice ? <Text accessibilityLiveRegion="polite" style={styles.configurationNotice}>{configurationNotice}</Text> : null}
            {adaptationNotice ? <Text accessibilityLiveRegion="polite" style={styles.adaptationNotice}>{adaptationNotice}</Text> : null}

            <View style={styles.progressionSection}>
              <View style={styles.progressionHeader}><Text style={styles.progressionTitle}>WARMUP SETS</Text><Text style={styles.progressionCount}>{warmup.completed_steps.length} / {steps.length} COMPLETE</Text></View>
              <ScrollView
                ref={progressionRef}
                accessibilityLabel="Warmup progression"
                contentContainerStyle={styles.progressionTrack}
                decelerationRate="fast"
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToAlignment="start"
                snapToInterval={progressionStride}
              >
                {steps.map((step, index) => (
                  <WarmupCarouselCard
                    key={step.sequence}
                    active={warmup.status === 'active' && index === activeStepIndex}
                    completed={warmup.completed_steps.includes(step.sequence)}
                    displayUnit={displayUnit}
                    next={warmup.status === 'active' && index === activeStepIndex + 1}
                    onPress={warmup.completed_steps.includes(step.sequence)
                      ? () => setInspectedSequence(step.sequence)
                      : warmup.status === 'active' && index === activeStepIndex
                        ? () => setInspectedSequence(null)
                        : undefined}
                    selected={inspectedSequence === step.sequence}
                    step={step}
                    width={progressionCardWidth}
                  />
                ))}
              </ScrollView>
            </View>

            {inspectedStep ? (
              <CompletedWarmupWorkspace
                busy={busy}
                displayUnit={displayUnit}
                hasActiveStep={Boolean(activeStep)}
                onReturnToActive={() => setInspectedSequence(null)}
                onUndo={() => undoStep(inspectedStep.sequence)}
                step={inspectedStep}
                undoing={pendingAction === 'undo_step'}
              />
            ) : warmup.status === 'active' && activeStep ? (
              <ActiveWarmupWorkspace
                busy={busy}
                completing={pendingAction === 'complete_step'}
                displayUnit={displayUnit}
                lastCompletedSequence={lastCompletedSequence}
                onComplete={(feedback) => mutate({ action: 'complete_step', sequence: activeStep.sequence, ...(feedback ? { feedback } : {}) })}
                onDisplayUnitChange={changeDisplayUnit}
                onOpenRestTimerPicker={onOpenRestTimerPicker}
                onStopRestTimer={onStopRestTimer}
                onUndoLast={undoLastStep}
                onSkip={!warmup.completed_steps.length ? () => { void mutate({ action: 'skip' }).then((didSkip) => { if (didSkip) onClose(); }); } : undefined}
                restTimerActive={restTimerActive}
                restTimerSeconds={restTimerSeconds}
                step={activeStep}
                undoing={pendingAction === 'undo_last_step'}
              />
            ) : null}

            {!inspectedStep && warmup.status === 'completed' && recommendation ? (
              <View style={styles.completeCard}>
                <Text style={styles.completeSignal}>{warmup.progression.recommendation?.signal === 'strong' ? 'LOOKING STRONG TODAY ↗' : warmup.progression.recommendation?.signal === 'protective' ? 'PROTECT THE WORKING SET TODAY' : warmup.progression.recommendation?.signal === 'conservative' ? 'BUILD CONSERVATIVELY TODAY' : 'MOVING AS EXPECTED'}</Text>
                <Text style={styles.completeLabel}>Suggested starting load</Text>
                <Text style={styles.recommendation}>{weightLabel(recommendation, displayUnit)}</Text>
                <Text style={styles.muted}>Inside today&apos;s prescribed range.</Text>
                {warmup.progression.recommendation?.explanation ? <Text style={styles.recommendationExplanation}>{warmup.progression.recommendation.explanation}</Text> : null}
                {recommendationRender ? <Image accessibilityLabel="Suggested starting load plate stack" resizeMode="contain" source={recommendationRender.imageSource} style={styles.plateStack} /> : null}
                {recommendationLoading ? <Text style={styles.plates}>{`Per side: ${recommendationLoading.plates_per_side.length ? recommendationLoading.plates_per_side.map((plate) => `${plate.count}×${plate.denomination} ${recommendationLoading.unit}`).join(' · ') : 'Empty bar'}`}</Text> : null}
                <Text style={styles.equation}>{configSummary(warmup, displayUnit)}</Text>
                {warmup.diagnostic_feedback.map((entry) => <Text key={entry.sequence} style={styles.muted}>Warmup {entry.sequence}: {feedbackLabel(entry.response)}</Text>)}
                {lastCompletedSequence != null ? <QuickUndoButton busy={busy} label="Undo Last Warmup" onPress={undoLastStep} sequence={lastCompletedSequence} undoing={pendingAction === 'undo_last_step'} /> : null}
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.primaryButton} testID="smart-warmup-return-to-logger"><Text style={styles.primaryButtonText}>Return to Logger</Text></Pressable>
                <Text style={styles.inspectHint}>Tap any completed Warmup Set above to inspect or undo it.</Text>
              </View>
            ) : null}

          </StrengthLedgerBottomSheetScrollView>
        ) : null}

        {warmup && configVisible ? (
          <View style={styles.configStage}>
            <View pointerEvents="none" style={styles.configBackdrop} />
            <View accessibilityViewIsModal style={styles.configSheet}>
              <View style={styles.configHandle} />
              <StrengthLedgerBottomSheetScrollView contentContainerStyle={styles.configContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.configHeader}><View style={styles.configHeaderCopy}><Text style={styles.configTitle}>Warmup Configuration</Text><Text style={styles.configSubtitle}>Set your warmup approach</Text></View><Pressable accessibilityLabel="Close warmup configuration" onPress={() => setConfigVisible(false)} onPressIn={() => { void Haptics.selectionAsync().catch(() => undefined); }} style={({ pressed }) => [styles.configClose, pressed && styles.selectionTilePressed]} testID="smart-warmup-config-close"><Ionicons name="close" size={25} color={SLColors.textStrong} /></Pressable></View>
              <Text style={styles.sectionTitle}>WARMUP STYLE</Text>
              <View style={styles.styleGrid}>{(['minimal', 'standard', 'gradual'] as const).map((preference) => {
                const selected = warmup.preference === preference;
                return <Pressable accessibilityLabel={`${titleCase(preference)} warmup style, ${STYLE_HINTS[preference]}`} accessibilityRole="button" accessibilityState={{ selected }} key={preference} disabled={busy} onPress={() => { void configure({ preference }); }} onPressIn={() => { if (!busy) void Haptics.selectionAsync().catch(() => undefined); }} style={({ pressed }) => [styles.styleTile, selected && styles.equipmentTileSelected, pressed && styles.selectionTilePressed]} testID={`smart-warmup-style-${preference}`}>
                  {selected ? <View style={styles.equipmentCheck}><Ionicons name="checkmark" size={11} color="#FFFFFF" /></View> : null}
                  <Text style={styles.styleTileLabel}>{titleCase(preference)}</Text>
                  <Text style={styles.styleTileHint}>{STYLE_HINTS[preference]}</Text>
                  <ProgressionGlyph preference={preference} selected={selected} />
                </Pressable>;
              })}</View>
              <View style={styles.progressionConsequenceRow}><Ionicons name="stats-chart" size={17} color={SLColors.accentViolet} /><Text style={styles.progressionConsequence}>Today&apos;s progression: <Text style={styles.progressionConsequenceValue}>{warmup.progression.steps.length} sets</Text></Text></View>
              <View style={styles.configDivider} />
              <Text style={styles.sectionTitle}>BAR WEIGHT</Text>
              <View style={styles.barGrid}>{BAR_PRESETS[displayUnit].map((barKey) => { const copy = barPresetCopy(barKey, displayUnit); return <EquipmentTile accessibilityLabel={`${copy.label} bar`} disabled={busy} key={barKey} label={copy.label} onPress={() => { setCustomBarEditing(false); void configure({ loading_unit: displayUnit, bar_key: barKey }); }} selected={warmup.loading_configuration.bar_key === barKey && !customBarEditing} value={copy.conversion}><Image accessibilityIgnoresInvertColors resizeMode="contain" source={resolveBarConfigurationAsset(barKey, 'none')} style={styles.barAssetImage} /></EquipmentTile>; })}<EquipmentTile accessibilityLabel="Custom bar weight" disabled={busy} label="Custom" onPress={() => { setCustomBarEditing(true); if (warmup.loading_configuration.bar_key !== 'custom') setCustomBarDraft(''); }} selected={warmup.loading_configuration.bar_key === 'custom'} value={warmup.loading_configuration.bar_key === 'custom' ? weightLabel(warmup.loading_configuration.bar_weight_kg, displayUnit) : undefined}><View style={styles.customEquipmentVisual}><Image accessibilityIgnoresInvertColors resizeMode="contain" source={resolveBarConfigurationAsset('custom', 'none')} style={styles.barAssetImage} /><View style={styles.customEquipmentBadge}><Ionicons name="options-outline" size={14} color={SLColors.accentViolet} /></View></View></EquipmentTile></View>
              <Text style={styles.sectionTitle}>COLLARS</Text>
              <View style={styles.collarGrid}>
                <EquipmentTile accessibilityLabel="No collars, zero collar weight" disabled={busy} label="None" onPress={() => { setCustomCollarEditing(false); void configure({ collar_key: 'none' }); }} selected={warmup.loading_configuration.collar_key === 'none' && !customCollarEditing} testID="smart-warmup-collars-none" value={`0 ${displayUnit}`}><NoCollarsVisual /></EquipmentTile>
                <EquipmentTile accessibilityLabel="Competition collars, 5 kilogram pair" disabled={busy} label="Competition" onPress={() => { setCustomCollarEditing(false); void configure({ collar_key: 'competition' }); }} selected={warmup.loading_configuration.collar_key === 'competition' && !customCollarEditing} testID="smart-warmup-collars-competition" value={displayUnit === 'lb' ? '5 kg pair · ≈11 lb' : '5 kg pair'}><Image accessibilityIgnoresInvertColors resizeMode="contain" source={COLLAR_ASSET} style={styles.competitionCollarImage} /></EquipmentTile>
                <EquipmentTile accessibilityLabel="Custom collar pair weight" disabled={busy} label="Custom" onPress={() => { setCustomCollarEditing(true); if (!customCollarDraft) setCustomCollarDraft(''); }} selected={['custom', 'light'].includes(warmup.loading_configuration.collar_key)} testID="smart-warmup-collars-custom" value={['custom', 'light'].includes(warmup.loading_configuration.collar_key) ? `${weightLabel(warmup.loading_configuration.collar_weight_kg, displayUnit)} pair` : 'Set weight'}><View style={styles.customCollarVisual}><Image accessibilityIgnoresInvertColors resizeMode="contain" source={COLLAR_ASSET} style={styles.collarImage} /><View style={styles.customEquipmentBadge}><Ionicons name="options-outline" size={14} color={SLColors.accentViolet} /></View></View></EquipmentTile>
              </View>
              <PhysicalConfigurationPreview displayUnit={displayUnit} warmup={warmup} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={finishConfiguration} onPressIn={() => { if (!busy) void Haptics.selectionAsync().catch(() => undefined); }} style={({ pressed }) => [styles.configDone, pressed && styles.primaryButtonPressed, pressed && !reduceMotion && styles.primaryButtonPressedMotion]} testID="smart-warmup-config-done"><LinearGradient colors={['#7F35E4', '#B144F3']} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={styles.configDoneGradient}><Text style={styles.primaryButtonText}>Done</Text></LinearGradient></Pressable>
              </StrengthLedgerBottomSheetScrollView>
            </View>
            {customBarEditing ? <CustomWeightEditor busy={busy} displayUnit={displayUnit} kind="bar" onCancel={() => setCustomBarEditing(false)} onSave={async (value) => { const saved = await configure({ loading_unit: displayUnit, bar_key: 'custom', custom_bar_weight: value, custom_bar_weight_unit: displayUnit }); if (saved) setCustomBarEditing(false); return saved; }} value={customBarDraft} /> : null}
            {customCollarEditing ? <CustomWeightEditor busy={busy} displayUnit={displayUnit} kind="collar" onCancel={() => setCustomCollarEditing(false)} onSave={async (value) => { const saved = await configure({ collar_key: 'custom', custom_collar_weight: value, custom_collar_weight_unit: displayUnit }); if (saved) setCustomCollarEditing(false); return saved; }} value={customCollarDraft} /> : null}
          </View>
        ) : null}
        {restTimerPicker}
      </View>
    </StrengthLedgerBottomSheet>
  );
}

function WarmupCarouselCard({ active, completed, displayUnit, next, onPress, selected, step, width }: { active: boolean; completed: boolean; displayUnit: 'kg' | 'lb'; next: boolean; onPress?: () => void; selected: boolean; step: SmartWarmupStep; width: number }) {
  const physicalRender = useMemo(() => resolvePhysicalPlateStackRender(step), [step]);
  const content = <View style={[styles.carouselCard, { width }, active && styles.carouselCardActive, completed && styles.carouselCardComplete, selected && styles.carouselCardSelected, next && styles.carouselCardNext, !active && !next && !completed && styles.carouselCardFuture]}>
    <View style={styles.carouselCardTop}>
      <View style={[styles.stepCircle, active && styles.stepCircleActive, completed && styles.stepCircleDone]}>{completed ? <Ionicons name="checkmark" size={15} color="#08110B" /> : <Text style={styles.stepNumber}>{step.sequence}</Text>}</View>
      <View style={styles.carouselCardMetrics}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.carouselWeight}>{weightLabel(step.total_kg, displayUnit)}</Text>
        <Text numberOfLines={1} style={styles.carouselReps}>{step.reps} {step.reps === '1' ? 'rep' : 'reps'}</Text>
      </View>
    </View>
    <View style={styles.carouselPlateStage}>
      {physicalRender ? <Image accessibilityLabel={`Warmup ${step.sequence} plate stack`} resizeMode="contain" source={physicalRender.imageSource} style={styles.carouselPlateStack} /> : <View style={styles.carouselPlatePlaceholder} />}
    </View>
  </View>;
  return onPress ? <Pressable accessibilityLabel={completed ? `Inspect completed warmup ${step.sequence}` : `Return to active warmup ${step.sequence}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.carouselCardPressable, pressed && styles.carouselCardPressed]} testID={completed ? `smart-warmup-inspect-${step.sequence}` : `smart-warmup-active-${step.sequence}`}>{content}</Pressable> : content;
}

function CompletedWarmupWorkspace({ step, displayUnit, busy, undoing, hasActiveStep, onUndo, onReturnToActive }: { step: SmartWarmupStep; displayUnit: 'kg' | 'lb'; busy: boolean; undoing: boolean; hasActiveStep: boolean; onUndo: () => void; onReturnToActive: () => void }) {
  const reduceMotion = useSLReducedMotion();
  const physicalRender = useMemo(() => resolvePhysicalPlateStackRender(step), [step]);
  const loadingConfig = { unit: step.unit, bar_key: step.bar_key, bar_weight_kg: step.bar_weight_kg, collar_key: step.collar_key, collar_weight_kg: step.collar_weight_kg, plates: [] } as SmartWarmupSession['loading_configuration'];
  return <View style={styles.completedWorkspace}>
    <View style={styles.activeTop}>
      <View style={styles.activeStepIdentity}><View style={[styles.stepCircle, styles.stepCircleDone]}><Ionicons name="checkmark" size={15} color="#08110B" /></View><Text style={styles.completedBadge}>WARMUP SET {step.sequence} — COMPLETED</Text></View>
    </View>
    <View style={styles.activeMetrics}><Text style={styles.activeWeight}>{weightLabel(step.total_kg, displayUnit)}</Text><Text style={styles.activeReps}>{step.reps} {step.reps === '1' ? 'rep' : 'reps'}</Text></View>
    <Text style={styles.equation}>{formatWarmupPhysicalConfiguration(loadingConfig, displayUnit)}</Text>
    {physicalRender ? <Image accessibilityLabel={`Completed warmup ${step.sequence} plate stack`} resizeMode="contain" source={physicalRender.imageSource} style={styles.plateStack} /> : null}
    <Text style={styles.plates}>{`Per side: ${step.plates_per_side.length ? step.plates_per_side.map((plate) => `${plate.count}×${plate.denomination} ${step.unit}`).join(' · ') : 'Empty bar'}`}</Text>
    <Pressable
      accessibilityLabel={undoing ? `Undoing warmup ${step.sequence} completion` : `Undo warmup ${step.sequence} completion`}
      accessibilityRole="button"
      accessibilityState={{ busy: undoing, disabled: busy || undoing }}
      disabled={busy || undoing}
      onPress={onUndo}
      onPressIn={() => { if (!busy) void Haptics.selectionAsync().catch(() => undefined); }}
      style={({ pressed }) => [styles.undoButton, pressed && styles.undoButtonPressed, pressed && !reduceMotion && styles.primaryButtonPressedMotion]}
      testID={`smart-warmup-undo-${step.sequence}`}
    >
      {undoing ? <View style={styles.primaryButtonLoading}><ActivityIndicator color={SLColors.accentViolet} size="small" /><Text style={styles.undoButtonText}>Undoing…</Text></View> : <Text style={styles.undoButtonText}>Undo Completion</Text>}
    </Pressable>
    {hasActiveStep ? <Pressable accessibilityLabel="Return to active warmup set" accessibilityRole="button" disabled={busy} onPress={onReturnToActive} style={styles.returnToActiveButton} testID="smart-warmup-return-to-active"><Text style={styles.returnToActiveText}>Return to Active Set</Text></Pressable> : null}
  </View>;
}

function QuickUndoButton({ busy, label = 'Undo Last', onPress, sequence, undoing }: { busy: boolean; label?: string; onPress: () => void; sequence: number; undoing: boolean }) {
  const reduceMotion = useSLReducedMotion();
  return <Pressable
    accessibilityLabel={undoing ? `Undoing warmup ${sequence}` : `${label}, warmup ${sequence}`}
    accessibilityRole="button"
    accessibilityState={{ busy: undoing, disabled: busy || undoing }}
    disabled={busy || undoing}
    onPress={onPress}
    onPressIn={() => { if (!busy) void Haptics.selectionAsync().catch(() => undefined); }}
    style={({ pressed }) => [styles.quickUndoButton, pressed && styles.quickUndoButtonPressed, pressed && !reduceMotion && styles.quickUndoButtonPressedMotion]}
    testID="smart-warmup-undo-last"
  >
    {undoing ? <ActivityIndicator color={SLColors.accentViolet} size="small" /> : <Ionicons color={SLColors.accentViolet} name="arrow-undo-outline" size={16} />}
    <Text style={styles.quickUndoText}>{undoing ? 'Undoing…' : label}</Text>
  </Pressable>;
}

function ActiveWarmupWorkspace({ step, displayUnit, busy, completing, lastCompletedSequence, onComplete, onDisplayUnitChange, onOpenRestTimerPicker, onStopRestTimer, onUndoLast, onSkip, restTimerActive, restTimerSeconds, undoing }: { step: SmartWarmupStep; displayUnit: 'kg' | 'lb'; busy: boolean; completing: boolean; lastCompletedSequence: number | null; onComplete: (feedback?: Exclude<SmartWarmupFeedback, 'fast' | 'slow'>) => Promise<boolean>; onDisplayUnitChange: (unit: 'kg' | 'lb') => void; onOpenRestTimerPicker: (seconds: number) => void; onStopRestTimer?: () => void; onUndoLast: () => void; onSkip?: () => void; restTimerActive: boolean; restTimerSeconds: number; undoing: boolean }) {
  const reduceMotion = useSLReducedMotion();
  const physicalRender = useMemo(() => resolvePhysicalPlateStackRender(step), [step]);
  const loadingConfig = { unit: step.unit, bar_key: step.bar_key, bar_weight_kg: step.bar_weight_kg, collar_key: step.collar_key, collar_weight_kg: step.collar_weight_kg, plates: [] } as SmartWarmupSession['loading_configuration'];
  const restLabel = `${Math.floor(step.rest_seconds / 60)}:${String(step.rest_seconds % 60).padStart(2, '0')}`;
  const activeRestLabel = `${Math.floor(restTimerSeconds / 60)}:${String(restTimerSeconds % 60).padStart(2, '0')}`;
  return <View style={styles.activeWorkspace}>
    <View style={styles.activeTop}><View style={styles.activeStepIdentity}><View style={[styles.stepCircle, styles.stepCircleActive]}><Text style={styles.stepNumber}>{step.sequence}</Text></View><Text style={styles.activeBadge}>ACTIVE SET</Text></View>{lastCompletedSequence != null ? <QuickUndoButton busy={busy} onPress={onUndoLast} sequence={lastCompletedSequence} undoing={undoing} /> : <View style={styles.suggestedRest}><Ionicons name="timer-outline" size={16} color={SLColors.textMuted} /><Text style={styles.restLabel}>Suggested rest: {restLabel}</Text></View>}</View>
    {lastCompletedSequence != null ? <View style={styles.suggestedRestBelow}><Ionicons name="timer-outline" size={16} color={SLColors.textMuted} /><Text style={styles.restLabel}>Suggested rest: {restLabel}</Text></View> : null}
    <View style={styles.activeMetrics}><Text style={styles.activeWeight}>{weightLabel(step.total_kg, displayUnit)}</Text><Text style={styles.activeReps}>{step.reps} {step.reps === '1' ? 'rep' : 'reps'}</Text></View>
    <Text style={styles.equation}>{formatWarmupPhysicalConfiguration(loadingConfig, displayUnit)}</Text>
    {physicalRender ? <Image accessibilityLabel="Required plate stack" resizeMode="contain" source={physicalRender.imageSource} style={styles.plateStack} /> : null}
    <Text style={styles.plates}>{`Per side: ${step.plates_per_side.length ? step.plates_per_side.map((plate) => `${plate.count}×${plate.denomination} ${step.unit}`).join(' · ') : 'Empty bar'}`}</Text>
    <View style={styles.timerControl}><Pressable accessibilityLabel={`Set warmup rest timer, suggested ${restLabel}`} accessibilityRole="button" onPress={() => onOpenRestTimerPicker(step.rest_seconds)} style={styles.timerOpen} testID="smart-warmup-rest-timer"><View style={styles.timerCopy}><Ionicons name="timer-outline" size={20} color={SLColors.warning} /><View><Text style={styles.timerEyebrow}>{restTimerActive ? 'REST TIMER RUNNING' : 'REST TIMER'}</Text><Text style={styles.timerValue}>{restTimerActive ? activeRestLabel : restLabel}</Text></View></View><Text style={styles.timerAction}>Adjust</Text></Pressable>{restTimerActive && onStopRestTimer ? <Pressable accessibilityLabel="Stop warmup rest timer" accessibilityRole="button" onPress={onStopRestTimer} style={styles.timerStop} testID="smart-warmup-rest-timer-stop"><Text style={styles.timerStopText}>Stop</Text></Pressable> : null}</View>
    {step.diagnostic ? <View><Text style={styles.feedbackPrompt}>How did that move?</Text><View style={styles.feedbackRow}>{FEEDBACK_OPTIONS.map((feedback) => <Pressable accessibilityLabel={`Warmup moved ${feedback.label.toLowerCase()}`} accessibilityRole="button" accessibilityState={{ disabled: busy }} key={feedback.key} disabled={busy} onPress={() => onComplete(feedback.key)} onPressIn={() => { if (!busy) void Haptics.selectionAsync().catch(() => undefined); }} style={[styles.feedback, feedback.key === 'flies' ? styles.flies : feedback.key === 'heavy' ? styles.heavy : feedback.key === 'very_heavy' ? styles.veryHeavy : null]} testID={`smart-warmup-feedback-${feedback.key}`}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.feedbackText}>{feedback.label}</Text></Pressable>)}</View></View> : (
      <Pressable
        accessibilityLabel={completing ? 'Completing warmup set' : 'Complete Warmup Set'}
        accessibilityRole="button"
        accessibilityState={{ busy: completing, disabled: busy || completing }}
        disabled={busy || completing}
        onPress={() => onComplete()}
        onPressIn={() => {
          if (!busy) void Haptics.selectionAsync().catch(() => undefined);
        }}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
          pressed && !reduceMotion && styles.primaryButtonPressedMotion,
          completing && styles.primaryButtonCompleting,
        ]}
        testID="smart-warmup-complete-set"
      >
        {completing ? (
          <View style={styles.primaryButtonLoading}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.primaryButtonText}>Completing…</Text>
          </View>
        ) : <Text style={styles.primaryButtonText}>Complete Warmup Set</Text>}
      </Pressable>
    )}
    <View pointerEvents="box-none" style={styles.activeFooter}>
      {onSkip ? <Pressable accessibilityLabel="Skip warmups" accessibilityRole="button" disabled={busy} onPress={onSkip} style={styles.skip} testID="smart-warmup-skip"><Text style={styles.skipText}>Skip Warmups</Text></Pressable> : null}
      <SessionUnitFloatingControl bottom={2} disabled={busy} onChange={onDisplayUnitChange} unit={displayUnit} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#030407' },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: SLColors.borderHairline }, headerCopy: { flex: 1, minWidth: 0 }, title: { ...SLTypography.title, color: SLColors.textStrong, fontSize: 19, lineHeight: 23, fontWeight: '800' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, content: { flexGrow: 1, paddingBottom: 12, gap: 8 }, errorPanel: { paddingHorizontal: 12, paddingBottom: 8 }, error: { color: SLColors.danger },
  targetCard: { marginHorizontal: 8, flexDirection: 'row', alignItems: 'stretch', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: SLColors.borderHairline, borderRadius: SLRadius.radiusCard, backgroundColor: SLColors.object }, targetColumn: { flex: 1, minWidth: 0 }, targetDivider: { width: 1, backgroundColor: SLColors.borderHairline }, eyebrow: { ...SLTypography.micro, color: SLColors.textMuted }, target: { ...SLTypography.bodyStrong, color: SLColors.accentViolet, marginTop: 3 },
  configSummary: { marginHorizontal: 8, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: SLColors.borderHairline, borderRadius: 12, backgroundColor: '#090A0F' }, configCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 }, configSummaryText: { ...SLTypography.caption, color: SLColors.textStrong, flex: 1 }, editLabel: { ...SLTypography.label, color: SLColors.accentViolet },
  progressionSection: { minHeight: 174, borderTopWidth: 1, borderBottomWidth: 1, borderColor: SLColors.borderHairline, backgroundColor: '#05060A' }, progressionHeader: { minHeight: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, progressionTitle: { ...SLTypography.micro, color: SLColors.accentViolet }, progressionCount: { ...SLTypography.micro, color: SLColors.textMuted }, progressionTrack: { paddingHorizontal: 6, paddingBottom: 8, gap: 8 },
  carouselCardPressable: { borderRadius: 13 }, carouselCardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  carouselCard: { height: 132, paddingHorizontal: 6, paddingTop: 7, paddingBottom: 6, borderRadius: 13, borderWidth: 1, borderColor: SLColors.borderDefault, backgroundColor: '#090A0F', overflow: 'hidden' }, carouselCardActive: { borderColor: SLColors.borderSelected, backgroundColor: '#15101D' }, carouselCardComplete: { borderColor: 'rgba(143,178,154,0.48)', backgroundColor: '#0A0F0D' }, carouselCardSelected: { borderColor: SLColors.accentViolet, backgroundColor: '#15101D' }, carouselCardNext: { opacity: 0.82, borderColor: 'rgba(120,170,180,0.42)' }, carouselCardFuture: { opacity: 0.58 }, carouselCardTop: { minHeight: 36, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 5 }, carouselCardMetrics: { flex: 1, minWidth: 0, alignItems: 'flex-end' }, carouselWeight: { ...SLTypography.bodyStrong, color: SLColors.textStrong, textAlign: 'right' }, carouselReps: { ...SLTypography.caption, color: SLColors.textSecondary, textAlign: 'right', marginTop: -1 }, carouselPlateStage: { flex: 1, minHeight: 0, alignItems: 'stretch', justifyContent: 'center', marginTop: 1 }, carouselPlateStack: { width: '100%', height: 68 }, carouselPlatePlaceholder: { flex: 1, minHeight: 62 },
  stepCircle: { width: 27, height: 27, borderRadius: 14, borderWidth: 1, borderColor: SLColors.textMuted, alignItems: 'center', justifyContent: 'center' }, stepCircleDone: { backgroundColor: SLColors.success, borderColor: SLColors.success }, stepCircleActive: { borderColor: SLColors.accentViolet, backgroundColor: SLColors.accentVioletSoft }, stepNumber: { color: SLColors.textStrong }, muted: { ...SLTypography.caption, color: SLColors.textMuted }, restLabel: { ...SLTypography.caption, color: SLColors.textMuted }, activeBadge: { ...SLTypography.micro, color: SLColors.accentViolet, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: SLColors.accentVioletSoft }, completedBadge: { ...SLTypography.micro, color: SLColors.success, flexShrink: 1 },
  activeWorkspace: { marginHorizontal: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 9, borderRadius: 16, borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: '#090A0F' }, activeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, activeStepIdentity: { flexDirection: 'row', alignItems: 'center', gap: 7 }, suggestedRest: { flexDirection: 'row', alignItems: 'center', gap: 4 }, activeMetrics: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }, activeWeight: { fontSize: 34, lineHeight: 39, color: SLColors.textStrong, fontWeight: '700' }, activeReps: { ...SLTypography.title, color: SLColors.textStrong }, equation: { ...SLTypography.caption, color: SLColors.textMuted }, plateStack: { width: '100%', height: 92, marginTop: 1 }, plates: { ...SLTypography.caption, color: SLColors.textSecondary, textAlign: 'center', marginTop: -3, marginBottom: 5 },
  completedWorkspace: { marginHorizontal: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 9, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(143,178,154,0.58)', backgroundColor: '#080D0B' }, undoButton: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: SLColors.accentViolet, alignItems: 'center', justifyContent: 'center', marginTop: 8, backgroundColor: SLColors.accentVioletSoft }, undoButtonPressed: { backgroundColor: '#251533', opacity: 0.94 }, undoButtonText: { ...SLTypography.bodyStrong, color: SLColors.accentViolet }, returnToActiveButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 3 }, returnToActiveText: { ...SLTypography.label, color: SLColors.textStrong }, inspectHint: { ...SLTypography.caption, color: SLColors.textMuted, textAlign: 'center', marginTop: 10 },
  quickUndoButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: SLColors.accentVioletSoft }, quickUndoButtonPressed: { backgroundColor: '#251533', opacity: 0.94 }, quickUndoButtonPressedMotion: { transform: [{ scale: 0.98 }] }, quickUndoText: { ...SLTypography.label, color: SLColors.accentViolet }, suggestedRestBelow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  activeFooter: { minHeight: 54, position: 'relative' },
  timerControl: { minHeight: 46, flexDirection: 'row', alignItems: 'stretch', borderRadius: 11, borderWidth: 1, borderColor: SLColors.borderHairline, backgroundColor: '#0D0E12', overflow: 'hidden' }, timerOpen: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }, timerCopy: { flexDirection: 'row', alignItems: 'center', gap: 9 }, timerEyebrow: { ...SLTypography.micro, color: SLColors.warning }, timerValue: { ...SLTypography.bodyStrong, color: SLColors.warning, marginTop: -2 }, timerAction: { ...SLTypography.label, color: SLColors.accentViolet }, timerStop: { minWidth: 62, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: SLColors.borderHairline }, timerStopText: { ...SLTypography.label, color: SLColors.danger },
  sectionTitle: { ...SLTypography.label, color: SLColors.accentViolet, marginTop: 18, marginBottom: 10, letterSpacing: 0.45 },
  styleGrid: { flexDirection: 'row', gap: 8 },
  styleTile: { flex: 1, minWidth: 0, minHeight: 154, paddingHorizontal: 8, paddingTop: 18, paddingBottom: 10, alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: '#090A0F', overflow: 'hidden' },
  styleTileLabel: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  styleTileHint: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 6, minHeight: 36, maxWidth: '100%', textAlign: 'center', lineHeight: 18 },
  progressionGlyph: { width: '100%', height: 65, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, marginTop: 10, paddingHorizontal: 7 },
  progressionStep: { flex: 1, maxWidth: 24, minWidth: 9, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  progressionConsequenceRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  progressionConsequence: { ...SLTypography.caption, color: SLColors.textMuted, textAlign: 'center' },
  progressionConsequenceValue: { color: SLColors.accentCyanMuted },
  configDivider: { height: 1, backgroundColor: SLColors.borderHairline },
  barGrid: { flexDirection: 'row', gap: 7 },
  collarGrid: { flexDirection: 'row', gap: 7 },
  equipmentTile: { flex: 1, minWidth: 0, minHeight: 132, paddingHorizontal: 6, paddingTop: 11, paddingBottom: 9, alignItems: 'center', justifyContent: 'flex-end', borderRadius: 14, borderWidth: 1, borderColor: SLColors.borderStrong, backgroundColor: '#090A0F', overflow: 'hidden' },
  equipmentTileSelected: { backgroundColor: '#171020', borderColor: '#B77AFF', shadowColor: '#A86BFF', shadowOpacity: 0.26, shadowRadius: 9, shadowOffset: { width: 0, height: 0 } },
  selectionTilePressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  equipmentTileDisabled: { opacity: 0.58 },
  equipmentCheck: { position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9B62EE', zIndex: 4 },
  equipmentVisual: { height: 74, width: '100%', alignItems: 'center', justifyContent: 'center' },
  equipmentLabel: { ...SLTypography.label, color: SLColors.textStrong, marginTop: 2 },
  equipmentValue: { ...SLTypography.micro, color: SLColors.textMuted, marginTop: 1, maxWidth: '100%' },
  barAssetImage: { width: '112%', height: 72 },
  collarImage: { width: 66, height: 58 },
  competitionCollarImage: { width: 86, height: 62 },
  customCollarVisual: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  customEquipmentVisual: { width: '100%', height: 74, alignItems: 'center', justifyContent: 'center' },
  customEquipmentBadge: { position: 'absolute', right: 5, bottom: 1, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D1029', borderWidth: 1, borderColor: SLColors.borderSelected },
  noCollarsVisual: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  noCollarsRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 7, borderColor: '#40374F' },
  noCollarsSlash: { position: 'absolute', width: 64, height: 7, borderRadius: 4, backgroundColor: '#40374F', transform: [{ rotate: '-45deg' }] },
  previewCard: { minHeight: 118, marginTop: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: SLColors.borderSelected, borderRadius: 15, backgroundColor: '#100C17', overflow: 'hidden' },
  previewCopy: { width: 66, zIndex: 2 }, previewCopyRight: { alignItems: 'flex-end' }, previewEyebrow: { ...SLTypography.micro, color: SLColors.accentViolet, marginBottom: 7 }, previewValue: { ...SLTypography.title, color: SLColors.textStrong, fontSize: 20, lineHeight: 24 }, previewCaption: { ...SLTypography.caption, color: SLColors.textMuted },
  previewHardware: { flex: 1, minWidth: 0, height: 96, alignItems: 'center', justifyContent: 'center' },
  previewBarAsset: { width: '118%', height: 92 },
  configurationNotice: { ...SLTypography.caption, color: SLColors.success, textAlign: 'center', marginTop: -2, marginBottom: 2 },
  adaptationNotice: { ...SLTypography.caption, color: SLColors.accentViolet, textAlign: 'center', marginTop: -2, marginBottom: 2 },
  configStage: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end' }, configBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.78)' }, configSheet: { maxHeight: '97%', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: '#292B36', backgroundColor: '#07080C' }, configContent: { paddingBottom: 4 }, configHandle: { width: 48, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: '#616575', marginBottom: 12 }, configHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, configHeaderCopy: { flex: 1, minWidth: 0 }, configTitle: { ...SLTypography.title, color: SLColors.textStrong, fontWeight: '800', fontSize: 23, lineHeight: 28 }, configSubtitle: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 4 }, configClose: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: '#17101F' },
  configDone: { minHeight: 54, marginTop: 14, borderRadius: 13, overflow: 'hidden' }, configDoneGradient: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  customEditorStage: { ...StyleSheet.absoluteFillObject, zIndex: 40, justifyContent: 'flex-end' }, customEditorBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.68)' }, customEditorSheet: { paddingHorizontal: 16, paddingTop: 9, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: SLColors.borderStrong, backgroundColor: '#0A0B10' }, customEditorHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, customEditorTitle: { ...SLTypography.title, color: SLColors.textStrong, fontWeight: '800' }, customEditorSubtitle: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 4 }, customEditorInputRow: { minHeight: 72, marginTop: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 13, borderWidth: 1, borderColor: SLColors.borderSelected, backgroundColor: '#06070A' }, customEditorInput: { flex: 1, minWidth: 0, color: SLColors.textStrong, fontSize: 30, lineHeight: 36 }, customEditorUnit: { ...SLTypography.title, color: SLColors.accentViolet },
  primaryButton: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8, backgroundColor: '#7134CF' },
  primaryButtonPressed: { backgroundColor: '#5F2CAF', opacity: 0.92 },
  primaryButtonPressedMotion: { transform: [{ scale: 0.98 }] },
  primaryButtonCompleting: { backgroundColor: '#5F2CAF' },
  primaryButtonLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryButtonText: { ...SLTypography.bodyStrong, color: '#FFFFFF' }, secondaryButton: { minHeight: 48, flexDirection: 'row', gap: 8, borderWidth: 1, borderColor: SLColors.borderSelected, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, secondaryButtonText: { ...SLTypography.label, color: SLColors.textStrong }, feedbackPrompt: { ...SLTypography.label, color: SLColors.textStrong, textAlign: 'center', marginVertical: 7 }, feedbackRow: { flexDirection: 'row', gap: 6 }, feedback: { flex: 1, minWidth: 0, minHeight: 42, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.object }, flies: { backgroundColor: 'rgba(49,184,102,0.45)' }, heavy: { backgroundColor: 'rgba(226,161,55,0.38)' }, veryHeavy: { backgroundColor: 'rgba(207,67,82,0.48)' }, feedbackText: { ...SLTypography.caption, color: SLColors.textStrong, fontWeight: '800', textAlign: 'center' },
  completeCard: { marginHorizontal: 8, padding: 16, borderRadius: SLRadius.radiusCard, borderWidth: 1, borderColor: SLColors.success, backgroundColor: '#08110B' }, completeSignal: { ...SLTypography.label, color: SLColors.success, textAlign: 'center' }, completeLabel: { ...SLTypography.caption, color: SLColors.textMuted, textAlign: 'center', marginTop: 12 }, recommendation: { fontSize: 40, lineHeight: 46, color: SLColors.success, fontWeight: '800', textAlign: 'center' }, recommendationExplanation: { ...SLTypography.caption, color: SLColors.textStrong, textAlign: 'center', marginTop: 5, marginBottom: 2 }, optionRow: { gap: 8 }, loadOption: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: SLColors.borderHairline }, skip: { minHeight: 32, alignItems: 'center', justifyContent: 'center', marginTop: 2 }, skipText: { ...SLTypography.caption, color: SLColors.textMuted }, lockedCopy: { ...SLTypography.caption, color: SLColors.textMuted, textAlign: 'center', marginTop: 12 },
});
