import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View } from 'react-native';

import { SLButton, SLAnimatedMetric, SLMotionEntrance, SLMotionPressable, SLTrophy } from '@/components/ui';
import { Text, TextInput } from '@/components/ui/sl-text';
import { useFloatingNavigationMotion } from '@/components/navigation/floating-navigation-motion';
import { CompletedSetSwipeRow } from '@/components/workout-logger/core-loggers';
import { LoggerFeedbackSurface, type RecognitionReplacementPhase } from '@/components/workout-logger/logger-feedback';
import { CanonicalRecordRecognition } from '@/components/workout-logger/canonical-record-recognition';
import {
  MajorVolumeMilestoneRecognition,
  type MajorVolumeMilestonePhase,
} from '@/components/workout-logger/major-volume-milestone-recognition';
import { ReadinessScale } from '@/components/workout-logger/readiness-modal';
import { SessionImpactPanel } from '@/components/workout-logger/stage5-impact-summary';
import { SLColors, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';
import { logSetActionPresentation, type LoggerFeedbackState } from '@/lib/logger-feedback';
import { triggerSessionCompletionHaptic, triggerSubmissionFailureHaptic } from '@/lib/logger-feedback-haptics';
import { SLEasing } from '@/lib/motion';
import { SLMotionPreviewProvider, type SLMotionPreviewOverrides } from '@/lib/motion-preview';
import { majorVolumeMilestoneEvent, recognitionScenario, sessionImpactSummary } from './mock-data';
import { animationMotionType, animationNavigationGroup, animationUses, type AnimationLibraryEntry, type PreviewHaptic } from './registry';

export type AnimationPreviewSettings = {
  playbackRate: 1 | 0.5 | 0.25;
  reduceMotion: boolean;
  hapticsEnabled: boolean;
  motion: Omit<SLMotionPreviewOverrides, 'playbackRate'>;
};

type Props = { entry: AnimationLibraryEntry; settings: AnimationPreviewSettings; libraryResetKey: number; favorite?: boolean; onToggleFavorite?: () => void };

async function firePreviewHaptic(kind: PreviewHaptic, enabled: boolean) {
  if (!enabled || kind === 'none') return;
  if (kind === 'success') await triggerSessionCompletionHaptic();
  else if (kind === 'warning/error') await triggerSubmissionFailureHaptic();
  else if (kind === 'heavy') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  else if (kind === 'medium') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  else if (kind === 'selection') await Haptics.selectionAsync().catch(() => undefined);
  else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function AnimationPreviewCard({ entry, settings, libraryResetKey, favorite = false, onToggleFavorite }: Props) {
  const [playKey, setPlayKey] = useState(0);
  const [status, setStatus] = useState('Ready');

  const reset = useCallback(() => {
    setPlayKey(0);
    setStatus('Ready');
  }, []);

  useEffect(reset, [libraryResetKey, reset]);

  const firePeakHaptic = useCallback(() => {
    void firePreviewHaptic(entry.haptic, settings.hapticsEnabled);
  }, [entry.haptic, settings.hapticsEnabled]);
  const fireImpactHaptic = useCallback(() => {
    void firePreviewHaptic('medium', settings.hapticsEnabled);
  }, [settings.hapticsEnabled]);

  const play = () => {
    setStatus('Playing');
    setPlayKey((value) => value + 1 || 1);
    if (!['weight-pr', 'rep-max-pr'].includes(entry.id) && entry.kind !== 'major-milestone') {
      void firePreviewHaptic(entry.haptic, settings.hapticsEnabled);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.cardHeadingCopy}>
          <Text style={styles.title}>{entry.title}</Text>
          <Text style={styles.description}>{entry.description}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'} onPress={onToggleFavorite} style={styles.favoriteButton}>
          <Ionicons name={favorite ? 'star' : 'star-outline'} size={20} color={favorite ? SLColors.warning : SLColors.textMuted} />
        </Pressable>
        <View style={styles.statusChip}><Text style={styles.statusText}>{status}</Text></View>
      </View>
      <View style={styles.previewStage}>
        <SLMotionPreviewProvider overrides={{ playbackRate: settings.playbackRate, ...settings.motion }}>
          <AnimationPreview
            entry={entry}
            playKey={playKey}
            settings={settings}
            onPhaseChange={setStatus}
            onImpact={fireImpactHaptic}
            onSettle={firePeakHaptic}
          />
        </SLMotionPreviewProvider>
      </View>
      <View style={styles.actions}>
        <SLButton label={playKey ? 'Replay' : 'Play'} size="sm" iconLeft="play" onPress={play} />
        <SLButton label="Reset" size="sm" variant="ghost" iconLeft="refresh-outline" onPress={reset} />
      </View>
      <View style={styles.inspector}>
        <InspectorRow label="Category" value={animationNavigationGroup(entry)} />
        <InspectorRow label="Uses" value={animationUses(entry).join(' · ')} />
        <InspectorRow label="Motion" value={animationMotionType(entry)} />
        <InspectorRow label="Timing" value={entry.timings.join(' · ')} />
        <InspectorRow label="Haptics" value={entry.hapticSequence ?? entry.haptic} />
        <InspectorRow label="Reduced Motion" value={entry.reducedMotion} />
      </View>
    </View>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.inspectorRow}><Text style={styles.inspectorLabel}>{label}</Text><Text style={styles.inspectorValue}>{value}</Text></View>;
}

function AnimationPreview({ entry, playKey, settings, onPhaseChange, onImpact, onSettle }: {
  entry: AnimationLibraryEntry;
  playKey: number;
  settings: AnimationPreviewSettings;
  onPhaseChange: (phase: string) => void;
  onImpact: () => void;
  onSettle: () => void;
}) {
  if (!playKey) return <ReadyStage interactive={entry.interactive} />;
  if (entry.kind === 'logging-state') return <LoggingStatePreview variant={entry.variant} settings={settings} onPhaseChange={onPhaseChange} />;
  if (entry.id === 'weight-pr') return <WeightPrRecognitionPreview key={entry.id} playKey={playKey} settings={settings} onPhaseChange={onPhaseChange} onImpact={onImpact} onSettle={onSettle} />;
  if (entry.id === 'rep-max-pr') return <WeightPrRecognitionPreview key={entry.id} playKey={playKey} settings={settings} onPhaseChange={onPhaseChange} onImpact={onImpact} onSettle={onSettle} repMaxDefaults={{ movement: 'Competition Squat', previous: 200, next: 205, unit: 'kg', repCount: 5 }} />;
  if (entry.kind === 'major-milestone') return <MajorVolumeMilestonePreview key={`${entry.id}-${playKey}`} entry={entry} playKey={playKey} settings={settings} onPhaseChange={onPhaseChange} onImpact={() => { void firePreviewHaptic('heavy', settings.hapticsEnabled); }} />;
  if (entry.kind === 'recognition') return <RecognitionPreview key={entry.id} variant={entry.variant} playKey={playKey} settings={settings} onPhaseChange={onPhaseChange} />;
  if (entry.kind === 'completed-set-swipe') return <SwipePreview key={`${entry.id}-${playKey}`} tooltip={entry.variant === 'tooltip'} settings={settings} onAction={onPhaseChange} />;
  if (entry.kind === 'session-completion') return <SessionPreview key={`${entry.id}-${playKey}`} playKey={playKey} settings={settings} onPhaseChange={onPhaseChange} />;
  if (entry.kind === 'readiness-rail') return <ReadinessPreview key={`${entry.id}-${playKey}`} settings={settings} />;
  if (entry.kind === 'control') return <ControlPreview key={`${entry.id}-${playKey}`} variant={entry.variant} settings={settings} onPhaseChange={onPhaseChange} />;
  if (entry.kind === 'navigation') return <NavigationPreview key={`${entry.id}-${playKey}`} variant={entry.variant} settings={settings} onPhaseChange={onPhaseChange} />;
  return <TransitionPreview key={`${entry.id}-${playKey}`} variant={entry.variant} settings={settings} onPhaseChange={onPhaseChange} />;
}

function MajorVolumeMilestonePreview({
  entry,
  playKey,
  settings,
  onPhaseChange,
  onImpact,
}: {
  entry: AnimationLibraryEntry;
  playKey: number;
  settings: AnimationPreviewSettings;
  onPhaseChange: (phase: string) => void;
  onImpact: () => void;
}) {
  const [scope, setScope] = useState<'total' | 'lift'>(entry.variant === 'lift' ? 'lift' : 'total');
  const [liftFamily, setLiftFamily] = useState<'squat' | 'bench' | 'deadlift'>('squat');
  const [previousTotal, setPreviousTotal] = useState('99420');
  const [newTotal, setNewTotal] = useState(scope === 'lift' ? '100240' : '100080');
  const [threshold, setThreshold] = useState('100000');
  const [accumulatedReps, setAccumulatedReps] = useState(scope === 'lift' ? '1842' : '14694');
  const [nextThreshold, setNextThreshold] = useState('250000');
  const [unit, setUnit] = useState<'kg' | 'lb'>('lb');
  const event = useMemo(() => {
    const toLb = (value: string) => Math.max(0, Number(value) || 0) / (unit === 'kg' ? 0.45359237 : 1);
    return majorVolumeMilestoneEvent(playKey + (scope === 'lift' ? 6100 : 6000), {
      scope,
      liftFamily,
      previousTotalLb: toLb(previousTotal),
      newTotalLb: toLb(newTotal),
      thresholdLb: toLb(threshold),
      accumulatedReps: Number(accumulatedReps) || 0,
      nextThresholdLb: Number(nextThreshold) > 0 ? toLb(nextThreshold) : null,
    });
  }, [accumulatedReps, liftFamily, newTotal, nextThreshold, playKey, previousTotal, scope, threshold, unit]);
  const handlePhase = (phase: MajorVolumeMilestonePhase) => {
    onPhaseChange(phase);
  };
  return (
    <View style={styles.recognitionPreview}>
      <View style={styles.inputGrid}>
        <View style={[styles.scenarioField, styles.wideInput]}>
          <Text style={styles.scenarioInputLabel}>SCOPE</Text>
          <View style={styles.recognitionFamilyOptions}>
            {(['total', 'lift'] as const).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: scope === option }}
                onPress={() => setScope(option)}
                style={[styles.recognitionFamilyOption, scope === option && styles.recognitionFamilyOptionActive]}
              >
                <Text style={styles.unitText}>{option === 'lift' ? 'Per-lift' : 'Total'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {scope === 'lift' ? (
          <View style={[styles.scenarioField, styles.wideInput]}>
            <Text style={styles.scenarioInputLabel}>LIFT</Text>
            <View style={styles.recognitionFamilyOptions}>
              {(['squat', 'bench', 'deadlift'] as const).map((lift) => (
                <Pressable
                  key={lift}
                  accessibilityRole="button"
                  accessibilityState={{ selected: liftFamily === lift }}
                  onPress={() => setLiftFamily(lift)}
                  style={[styles.recognitionFamilyOption, liftFamily === lift && styles.recognitionFamilyOptionActive]}
                >
                  <Text style={styles.unitText}>{lift[0].toUpperCase()}{lift.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {[
          ['PREVIOUS TOTAL', previousTotal, setPreviousTotal],
          ['NEW TOTAL', newTotal, setNewTotal],
          ['THRESHOLD', threshold, setThreshold],
          ['ACCUMULATED REPS', accumulatedReps, setAccumulatedReps],
          ['NEXT MILESTONE', nextThreshold, setNextThreshold],
        ].map(([label, value, setter]) => (
          <View key={String(label)} style={styles.scenarioField}>
            <Text style={styles.scenarioInputLabel}>{String(label)}</Text>
            <TextInput
              accessibilityLabel={String(label).toLowerCase()}
              keyboardType="number-pad"
              value={String(value)}
              onChangeText={setter as (value: string) => void}
              style={styles.input}
            />
          </View>
        ))}
        <Pressable accessibilityLabel={`Use ${unit === 'kg' ? 'pounds' : 'kilograms'}`} onPress={() => setUnit((value) => value === 'kg' ? 'lb' : 'kg')} style={styles.unitToggle}>
          <Text style={styles.unitText}>{unit}</Text>
        </Pressable>
      </View>
      <MajorVolumeMilestoneRecognition
        event={event}
        displayUnit={unit}
        reduceMotion={settings.reduceMotion}
        playbackRate={settings.playbackRate}
        onPhaseChange={handlePhase}
        onImpact={onImpact}
      />
    </View>
  );
}

function WeightPrRecognitionPreview({ playKey, settings, onPhaseChange, onImpact, onSettle, repMaxDefaults }: {
  playKey: number;
  settings: AnimationPreviewSettings;
  onPhaseChange: (value: string) => void;
  onImpact: () => void;
  onSettle: () => void;
  repMaxDefaults?: { movement: string; previous: number; next: number; unit: 'kg' | 'lb'; repCount: number };
}) {
  const [movement, setMovement] = useState(repMaxDefaults?.movement ?? 'Competition Deadlift');
  const [previous, setPrevious] = useState(String(repMaxDefaults?.previous ?? 265));
  const [next, setNext] = useState(String(repMaxDefaults?.next ?? 272.5));
  const [unit, setUnit] = useState<'kg' | 'lb'>(repMaxDefaults?.unit ?? 'kg');
  const [repCount, setRepCount] = useState(String(repMaxDefaults?.repCount ?? 5));
  const previousValue = Number(previous);
  const nextValue = Number(next);
  const isRepMax = Boolean(repMaxDefaults);
  const delta = Number.isFinite(previousValue) && Number.isFinite(nextValue)
    ? `+${Number((nextValue - previousValue).toFixed(2))} ${unit}`
    : null;
  const category = isRepMax ? `${Math.max(1, Number(repCount) || 1)} REP MAX` : 'WEIGHT PR';

  return (
    <View style={styles.weightPrPreview}>
      <View style={styles.inputGrid}>
        <View style={[styles.scenarioField, styles.wideInput]}>
          <Text style={styles.scenarioInputLabel}>MOVEMENT</Text>
          <TextInput value={movement} onChangeText={setMovement} style={styles.scenarioInput} />
        </View>
        {isRepMax ? (
          <View style={styles.scenarioField}>
            <Text style={styles.scenarioInputLabel}>REPS</Text>
            <TextInput value={repCount} onChangeText={setRepCount} keyboardType="number-pad" style={styles.scenarioInput} />
          </View>
        ) : null}
        <View style={styles.scenarioField}>
          <Text style={styles.scenarioInputLabel}>PREVIOUS</Text>
          <TextInput value={previous} onChangeText={setPrevious} keyboardType="decimal-pad" style={styles.scenarioInput} />
        </View>
        <View style={styles.scenarioField}>
          <Text style={styles.scenarioInputLabel}>NEW</Text>
          <TextInput value={next} onChangeText={setNext} keyboardType="decimal-pad" style={styles.scenarioInput} />
        </View>
        <View style={styles.scenarioField}>
          <Text style={styles.scenarioInputLabel}>UNIT</Text>
          <View style={styles.unitRow}>
            {(['kg', 'lb'] as const).map((option) => (
              <Pressable key={option} onPress={() => setUnit(option)} style={[styles.unitOption, unit === option ? styles.unitOptionActive : null]}>
                <Text style={unit === option ? styles.unitOptionTextActive : styles.unitOptionText}>{option.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <CanonicalRecordRecognition
        animationKey={playKey}
        movementLabel={movement || 'Core movement'}
        previousValue={Number.isFinite(previousValue) ? `${previousValue} ${unit}` : null}
        nextValue={Number.isFinite(nextValue) ? `${nextValue} ${unit}` : `0 ${unit}`}
        delta={delta}
        recordTitle={isRepMax ? `NEW ${category}` : 'NEW WEIGHT PR'}
        formerLabel={`FORMER ${category}`}
        newLabel={`NEW ${category}`}
        evidenceLabel={category}
        accessibilityLabel={`${category}. ${movement}. ${previous} to ${next} ${unit}.`}
        reduceMotion={settings.reduceMotion}
        playbackRate={settings.playbackRate}
        onPhaseChange={onPhaseChange}
        onImpact={onImpact}
        onSettle={onSettle}
      />
    </View>
  );
}
function LoggingStatePreview({ variant, settings, onPhaseChange }: { variant: string; settings: AnimationPreviewSettings; onPhaseChange: (value: string) => void }) {
  const statusByVariant: Record<string, LoggerFeedbackState['submission']['status']> = {
    pressed: 'idle', saving: 'submitting', logged: 'persisted_new_set', failed: 'failure', retry: 'failure',
  };
  const [status, setStatus] = useState(statusByVariant[variant] || 'idle');
  const presentation = logSetActionPresentation(status, true);
  const isFailure = presentation.tone === 'failure';
  return (
    <View style={styles.loggingState}>
      <SLButton
        label={presentation.label}
        loading={presentation.tone === 'saving' || presentation.tone === 'refreshing'}
        disabled={presentation.disabled && presentation.tone !== 'saving'}
        variant={isFailure ? 'danger' : 'primary'}
        accessibilityLabel={presentation.accessibilityLabel}
        onPress={() => {
          if (isFailure) {
            setStatus('idle');
            onPhaseChange('Ready to retry');
          } else {
            onPhaseChange('Pressed');
            void firePreviewHaptic('light', settings.hapticsEnabled);
          }
        }}
      />
      <Text style={[styles.loggingStatus, isFailure && styles.errorText]}>{presentation.accessibilityLabel}</Text>
    </View>
  );
}

function ReadyStage({ interactive }: { interactive?: boolean }) {
  return (
    <View style={styles.readyStage}>
      <Ionicons name={interactive ? 'hand-left-outline' : 'play-outline'} size={22} color={SLColors.textSubtle} />
      <Text style={styles.readyText}>{interactive ? 'Play, then interact directly' : 'Press Play to preview'}</Text>
    </View>
  );
}

type ReducedRecognitionFamily = 'weight' | 'rep' | 'rpe';

function RecognitionPreview({ variant, playKey, settings, onPhaseChange }: { variant: string; playKey: number; settings: AnimationPreviewSettings; onPhaseChange: (phase: RecognitionReplacementPhase | string) => void }) {
  const [movement, setMovement] = useState('Competition Squat');
  const [previous, setPrevious] = useState('180');
  const [next, setNext] = useState('190');
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [repCount, setRepCount] = useState('5');
  const [workloadWeight, setWorkloadWeight] = useState('180');
  const [previousRpe, setPreviousRpe] = useState('9');
  const [nextRpe, setNextRpe] = useState('8');
  const [reducedFamily, setReducedFamily] = useState<ReducedRecognitionFamily>('weight');
  const effectiveVariant = variant === 'reduced' ? reducedFamily : variant;
  const isMovementEfficiency = effectiveVariant === 'rpe';
  const isRepMax = effectiveVariant === 'rep';
  const toCanonicalKg = useCallback((value: string, fallback: number) => {
    const displayValue = Number(value) || fallback;
    return unit === 'lb' ? displayValue / 2.2046226218 : displayValue;
  }, [unit]);
  const event = useMemo(() => recognitionScenario(effectiveVariant, playKey + 1000, {
    movement,
    previous: toCanonicalKg(previous, 180),
    next: toCanonicalKg(next, 190),
    repCount: Math.max(1, Math.round(Number(repCount) || 5)),
    weight: toCanonicalKg(workloadWeight, 180),
    previousRpe: Number(previousRpe) || 9,
    nextRpe: Number(nextRpe) || 8,
  }), [effectiveVariant, movement, next, nextRpe, playKey, previous, previousRpe, repCount, toCanonicalKg, workloadWeight]);
  const reduceMotion = settings.reduceMotion || variant === 'reduced';
  return (
    <View style={styles.recognitionPreview}>
      {variant === 'reduced' ? (
        <View style={styles.recognitionFamilyPicker}>
          <Text style={styles.scenarioInputLabel}>RECOGNITION FAMILY</Text>
          <View style={styles.recognitionFamilyOptions}>
            {([
              ['weight', 'Weight PR'],
              ['rep', 'Rep-Max PR'],
              ['rpe', 'Movement Efficiency'],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: reducedFamily === value }}
                onPress={() => setReducedFamily(value)}
                style={[styles.recognitionFamilyOption, reducedFamily === value && styles.recognitionFamilyOptionActive]}
              >
                <Text style={[styles.recognitionFamilyOptionText, reducedFamily === value && styles.recognitionFamilyOptionTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.inputGrid}>
        <TextInput accessibilityLabel="Movement name" value={movement} onChangeText={setMovement} style={[styles.input, styles.wideInput]} />
        {isMovementEfficiency ? (
          <>
            <View style={styles.scenarioField}>
              <Text style={styles.scenarioInputLabel}>WEIGHT</Text>
              <TextInput accessibilityLabel="Movement Efficiency weight" keyboardType="decimal-pad" value={workloadWeight} onChangeText={setWorkloadWeight} style={styles.input} />
            </View>
            <View style={styles.scenarioField}>
              <Text style={styles.scenarioInputLabel}>REPS</Text>
              <TextInput accessibilityLabel="Movement Efficiency reps" keyboardType="number-pad" value={repCount} onChangeText={setRepCount} style={styles.input} />
            </View>
            <View style={styles.scenarioField}>
              <Text style={styles.scenarioInputLabel}>PREVIOUS RPE</Text>
              <TextInput accessibilityLabel="Previous RPE" keyboardType="decimal-pad" value={previousRpe} onChangeText={setPreviousRpe} style={styles.input} />
            </View>
            <View style={styles.scenarioField}>
              <Text style={styles.scenarioInputLabel}>NEW RPE</Text>
              <TextInput accessibilityLabel="New RPE" keyboardType="decimal-pad" value={nextRpe} onChangeText={setNextRpe} style={styles.input} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.scenarioField}>
              <Text style={styles.scenarioInputLabel}>PREVIOUS WEIGHT</Text>
              <TextInput accessibilityLabel="Previous best" keyboardType="decimal-pad" value={previous} onChangeText={setPrevious} style={styles.input} />
            </View>
            <View style={styles.scenarioField}>
              <Text style={styles.scenarioInputLabel}>NEW WEIGHT</Text>
              <TextInput accessibilityLabel="New best" keyboardType="decimal-pad" value={next} onChangeText={setNext} style={styles.input} />
            </View>
            {isRepMax ? (
              <View style={styles.scenarioField}>
                <Text style={styles.scenarioInputLabel}>REP COUNT</Text>
                <TextInput accessibilityLabel="Rep-Max rep count" keyboardType="number-pad" value={repCount} onChangeText={setRepCount} style={styles.input} />
              </View>
            ) : null}
          </>
        )}
        <Pressable accessibilityLabel={`Use ${unit === 'kg' ? 'pounds' : 'kilograms'}`} onPress={() => setUnit((value) => value === 'kg' ? 'lb' : 'kg')} style={styles.unitToggle}><Text style={styles.unitText}>{unit}</Text></Pressable>
      </View>
      <LoggerFeedbackSurface
        embedded
        saveConfirmationVisible={false}
        event={event}
        secondaryHighlightCount={0}
        reduceMotion={reduceMotion}
        displayUnit={unit}
        playbackRate={settings.playbackRate}
        onPresentationStarted={() => undefined}
        onDismissEvent={() => onPhaseChange('Dismissed')}
        onRecognitionPhaseChange={onPhaseChange}
      />
    </View>
  );
}

function SwipePreview({ tooltip, settings, onAction }: { tooltip: boolean; settings: AnimationPreviewSettings; onAction: (value: string) => void }) {
  return (
    <View style={styles.swipeStage}>
      <Text style={styles.gestureHint}>Swipe left to edit · right to delete</Text>
      <CompletedSetSwipeRow
        onEdit={() => { onAction('Edit revealed'); void firePreviewHaptic('selection', settings.hapticsEnabled); }}
        onDelete={() => { onAction('Delete revealed'); void firePreviewHaptic('warning/error', settings.hapticsEnabled); }}
        shouldShowCompletedSetSwipeTooltip={tooltip}
        reduceMotion={settings.reduceMotion}
        onCompletedSetSwipeTooltipStarted={() => onAction('Tooltip nudge')}
      >
        <View style={styles.completedRow}>
          <View><Text style={styles.rowTitle}>Set 3 complete</Text><Text style={styles.rowMeta}>190 kg × 1 @8</Text></View>
          <Ionicons name="checkmark-circle" size={24} color={SLColors.success} />
        </View>
      </CompletedSetSwipeRow>
      <View style={styles.accessibilityActions}>
        <SLButton label="Edit" size="sm" variant="secondary" onPress={() => onAction('Edit alternative')} />
        <SLButton label="Delete" size="sm" variant="danger" onPress={() => onAction('Delete alternative')} />
      </View>
    </View>
  );
}

function SessionPreview({ playKey, settings, onPhaseChange }: { playKey: number; settings: AnimationPreviewSettings; onPhaseChange: (value: string) => void }) {
  useEffect(() => onPhaseChange(settings.reduceMotion ? 'Recap' : 'Opening flame'), [onPhaseChange, settings.reduceMotion]);
  return (
    <View style={styles.sessionCrop}>
      <SessionImpactPanel
        summary={sessionImpactSummary(playKey + 3000)}
        displayUnit="kg"
        accomplishmentHistory={{ items: [], has_more: false, next_cursor: null }}
        reduceMotion={settings.reduceMotion}
        animateEntry
        showSessionTitle
        playbackRate={settings.playbackRate}
      />
    </View>
  );
}

function ReadinessPreview({ settings }: { settings: AnimationPreviewSettings }) {
  const [position, setPosition] = useState(0.5);
  return (
    <ReadinessScale
      label="ENERGY"
      low="Drained"
      high="Fired up"
      position={position}
      descriptors={['Drained', 'Low', 'Ready', 'Strong', 'Fired up']}
      reduceMotion={settings.reduceMotion}
      hapticBoundaries
      hapticsEnabled={settings.hapticsEnabled}
      onChange={setPosition}
    />
  );
}

function TransitionPreview({ variant, settings, onPhaseChange }: { variant: string; settings: AnimationPreviewSettings; onPhaseChange: (value: string) => void }) {
  const progress = useRef(new Animated.Value(settings.reduceMotion ? 1 : 0)).current;
  const entranceDistance = (settings.motion.distancePx ?? 12) * (variant === 'sheet' ? 3 : 1);
  const overshoot = settings.motion.overshootPx ?? 0;
  const emphasisScale = settings.motion.emphasisScale ?? 1;
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(settings.reduceMotion ? 1 : 0);
    const duration = settings.reduceMotion ? 0 : Math.round(settings.motion.entranceMs / settings.playbackRate);
    const animation = overshoot > 0 && duration > 0
      ? Animated.sequence([
        Animated.timing(progress, { toValue: 0.88, duration: Math.round(duration * 0.76), easing: SLEasing.enter, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 1, duration: Math.round(duration * 0.24), easing: SLEasing.enter, useNativeDriver: true }),
      ])
      : Animated.timing(progress, { toValue: 1, duration, easing: SLEasing.enter, useNativeDriver: true });
    animation.start(() => onPhaseChange('Settled'));
    return () => animation.stop();
  }, [onPhaseChange, overshoot, progress, settings.motion.entranceMs, settings.playbackRate, settings.reduceMotion]);
  return (
    <Animated.View style={[styles.transitionSurface, {
      opacity: progress,
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 0.88, 1], outputRange: [entranceDistance, -overshoot, 0] }) },
        { scale: progress.interpolate({ inputRange: [0, 0.88, 1], outputRange: [emphasisScale, 1.01, 1] }) },
      ],
    }]}>
      <Text style={styles.transitionEyebrow}>{variant.replace(/-/g, ' ').toUpperCase()}</Text>
      <Text style={styles.transitionTitle}>{variant === 'reflection' ? 'How did that feel?' : variant === 'begin' ? 'Session ready' : 'Focused task surface'}</Text>
      <Text style={styles.transitionCopy}>Local preview data only. No Session state is created.</Text>
    </Animated.View>
  );
}

function NavigationPreview({ variant, settings, onPhaseChange }: { variant: string; settings: AnimationPreviewSettings; onPhaseChange: (value: string) => void }) {
  const [expanded, setExpanded] = useState(variant !== 'collapse');
  const [active, setActive] = useState(0);
  const { animatedWidth: width, expandedItemsOpacity: opacity } = useFloatingNavigationMotion({
    expanded,
    collapsedWidth: 58,
    expandedWidth: 292,
    reduceMotion: settings.reduceMotion,
    playbackRate: settings.playbackRate,
    stateDurationMs: settings.motion.stateMs,
  });
  useEffect(() => {
    const timer = setTimeout(() => onPhaseChange(variant === 'collapse' ? 'Collapsed' : 'Expanded'), settings.reduceMotion ? 0 : Math.round(settings.motion.stateMs / settings.playbackRate));
    return () => clearTimeout(timer);
  }, [onPhaseChange, settings.motion.stateMs, settings.playbackRate, settings.reduceMotion, variant]);
  const tabs = ['home', 'barbell', 'calendar', 'sparkles'] as const;
  return (
    <View style={styles.navStage}>
      <Animated.View style={[styles.floatingNav, { width }]}>
        <Pressable onPress={() => setExpanded((value) => !value)} style={styles.navAnchor} accessibilityLabel="Toggle navigation">
          <Ionicons name={expanded ? 'close' : 'ellipsis-horizontal'} size={20} color={SLColors.textStrong} />
        </Pressable>
        <Animated.View style={[styles.navItems, { opacity }]}>
          {tabs.map((icon, index) => <SLMotionPressable key={icon} accessibilityRole="button" accessibilityLabel={`Select ${icon}`} onPress={() => { setActive(index); onPhaseChange('Active tab'); void firePreviewHaptic('selection', settings.hapticsEnabled); }} style={[styles.navItem, active === index && styles.navItemActive]}><Ionicons name={`${icon}-outline` as any} size={20} color={active === index ? SLColors.review : SLColors.textMuted} /></SLMotionPressable>)}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function ControlPreview({ variant, settings, onPhaseChange }: { variant: string; settings: AnimationPreviewSettings; onPhaseChange: (value: string) => void }) {
  const [selected, setSelected] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(variant === 'loading');
  const [failed, setFailed] = useState(variant === 'error');
  useEffect(() => {
    if (variant === 'loading') {
      const timer = setTimeout(() => { setLoading(false); onPhaseChange('Content'); }, Math.round((settings.motion.entranceMs + settings.motion.spatialMs) / settings.playbackRate));
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [onPhaseChange, settings.motion.entranceMs, settings.motion.spatialMs, settings.playbackRate, variant]);
  if (variant === 'metric') return <SLAnimatedMetric value={selected ? 190 : 180}><Pressable onPress={() => setSelected((value) => !value)} style={styles.metric}><Text style={styles.metricValue}>{selected ? '190' : '180'} kg</Text><Text style={styles.rowMeta}>Tap to update</Text></Pressable></SLAnimatedMetric>;
  if (variant === 'segment') return <View style={styles.segment}>{['kg', 'lb'].map((item, index) => <Pressable key={item} onPress={() => setSelected(Boolean(index))} style={[styles.segmentItem, selected === Boolean(index) && styles.segmentActive]}><Text style={styles.segmentText}>{item}</Text></Pressable>)}</View>;
  if (variant === 'toggle') return <Pressable accessibilityRole="switch" accessibilityState={{ checked: selected }} onPress={() => setSelected((value) => !value)} style={[styles.toggle, selected && styles.toggleOn]}><Animated.View style={[styles.toggleThumb, { transform: [{ translateX: selected ? 24 : 0 }] }]} /></Pressable>;
  if (variant === 'accordion') return <View><SLButton label={expanded ? 'Hide notes' : 'Show notes'} variant="secondary" iconRight={expanded ? 'chevron-up' : 'chevron-down'} onPress={() => setExpanded((value) => !value)} />{expanded ? <SLMotionEntrance motionKey="notes"><Text style={styles.note}>Keep the bar path stacked over mid-foot.</Text></SLMotionEntrance> : null}</View>;
  if (variant === 'loading') return <View style={styles.center}>{loading ? <ActivityIndicator color={SLColors.accentViolet} /> : <SLMotionEntrance><Text style={styles.rowTitle}>Training Session loaded</Text></SLMotionEntrance>}</View>;
  if (variant === 'error') return <View style={styles.errorState}>{failed ? <Text style={styles.errorText}>Set could not be saved.</Text> : <Text style={styles.successText}>Ready to try again.</Text>}<SLButton label="Retry" size="sm" variant="secondary" onPress={() => { setFailed(false); onPhaseChange('Retry ready'); }} /></View>;
  const buttonVariant = variant === 'danger' ? 'danger' : variant === 'secondary' ? 'secondary' : 'primary';
  return <SLButton label={variant === 'danger' ? 'Delete Set' : variant === 'secondary' ? 'History' : 'Log Set'} variant={buttonVariant} onPress={() => { onPhaseChange('Pressed'); void firePreviewHaptic(variant === 'danger' ? 'warning/error' : 'light', settings.hapticsEnabled); }} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: SLColors.surfaceFlat, borderColor: SLColors.borderSubtle, borderWidth: StyleSheet.hairlineWidth, borderRadius: SLRadius.radiusCard, padding: SLSpacing.md, gap: SLSpacing.md },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.sm },
  cardHeadingCopy: { flex: 1, gap: 4 },
  title: { ...SLTypography.cardTitle, color: SLColors.textStrong },
  description: { ...SLTypography.rowMeta, color: SLColors.textMuted },
  statusChip: { borderRadius: SLRadius.pill, backgroundColor: SLColors.surfaceSelected, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { ...SLTypography.micro, color: SLColors.review },
  favoriteButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.pill },
  previewStage: { minHeight: 132, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceCommand, borderColor: SLColors.borderSubtle, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', justifyContent: 'center', padding: SLSpacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SLSpacing.xs },
  inspector: { borderTopColor: SLColors.borderSubtle, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SLSpacing.sm, gap: 7 },
  inspectorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SLSpacing.md },
  inspectorLabel: { ...SLTypography.micro, color: SLColors.textSubtle, width: 96, textTransform: 'uppercase' },
  inspectorValue: { ...SLTypography.micro, color: SLColors.textMuted, flex: 1 },
  readyStage: { alignItems: 'center', justifyContent: 'center', gap: SLSpacing.sm, minHeight: 108 },
  readyText: { ...SLTypography.caption, color: SLColors.textSubtle },
  recognitionPreview: { gap: SLSpacing.sm },
  weightPrPreview: { gap: SLSpacing.sm },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: { minWidth: 70, flexGrow: 1, minHeight: 38, borderRadius: SLRadius.radiusControl, borderWidth: 1, borderColor: SLColors.borderSubtle, color: SLColors.textStrong, paddingHorizontal: 10, backgroundColor: SLColors.surfaceFlat },
  wideInput: { minWidth: 160, flexBasis: '100%' },
  scenarioField: { flexGrow: 1, minWidth: 84, gap: 4 },
  scenarioInputLabel: { ...SLTypography.micro, color: SLColors.textMuted },
  scenarioInput: { minHeight: 38, borderRadius: SLRadius.radiusControl, borderWidth: 1, borderColor: SLColors.borderSubtle, color: SLColors.textStrong, paddingHorizontal: 10, backgroundColor: SLColors.surfaceFlat },
  unitRow: { minHeight: 38, flexDirection: 'row', borderRadius: SLRadius.radiusControl, borderWidth: 1, borderColor: SLColors.borderSubtle, overflow: 'hidden' },
  unitOption: { minWidth: 48, flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceFlat },
  unitOptionActive: { backgroundColor: SLColors.surfaceSelected },
  unitOptionText: { ...SLTypography.micro, color: SLColors.textMuted },
  unitOptionTextActive: { ...SLTypography.micro, color: SLColors.review },
  recognitionFamilyPicker: { gap: 5 },
  recognitionFamilyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recognitionFamilyOption: { minHeight: 34, flexGrow: 1, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.radiusControl, borderWidth: 1, borderColor: SLColors.borderSubtle, paddingHorizontal: 10, backgroundColor: SLColors.surfaceFlat },
  recognitionFamilyOptionActive: { borderColor: SLColors.review, backgroundColor: SLColors.surfaceSelected },
  recognitionFamilyOptionText: { ...SLTypography.micro, color: SLColors.textMuted },
  recognitionFamilyOptionTextActive: { color: SLColors.textStrong },
  unitToggle: { minWidth: 52, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceSelected },
  unitText: { ...SLTypography.label, color: SLColors.review, textTransform: 'uppercase' },
  swipeStage: { gap: SLSpacing.sm },
  gestureHint: { ...SLTypography.micro, color: SLColors.textSubtle, textAlign: 'center' },
  completedRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SLSpacing.md, backgroundColor: SLColors.surfaceRaised, borderRadius: SLRadius.radiusControl },
  rowTitle: { ...SLTypography.rowTitle, color: SLColors.textStrong },
  rowMeta: { ...SLTypography.rowMeta, color: SLColors.textMuted },
  accessibilityActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SLSpacing.xs },
  sessionCrop: { maxHeight: 620, overflow: 'hidden' },
  transitionSurface: { padding: SLSpacing.lg, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceRaised, gap: 5 },
  transitionEyebrow: { ...SLTypography.sectionLabel, color: SLColors.review },
  transitionTitle: { ...SLTypography.cardTitle, color: SLColors.textStrong },
  transitionCopy: { ...SLTypography.caption, color: SLColors.textMuted },
  navStage: { alignItems: 'center', justifyContent: 'center', minHeight: 112 },
  floatingNav: { height: 58, flexDirection: 'row', alignItems: 'center', padding: 6, backgroundColor: SLColors.surfaceRaised, borderRadius: SLRadius.pill, borderWidth: 1, borderColor: SLColors.borderSubtle, overflow: 'hidden' },
  navAnchor: { width: 44, height: 44, borderRadius: SLRadius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surfaceSelected },
  navItems: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  navItem: { width: 42, height: 42, borderRadius: SLRadius.pill, alignItems: 'center', justifyContent: 'center' },
  navItemActive: { backgroundColor: SLColors.surfaceSelected },
  metric: { alignItems: 'center', gap: 4 },
  metricValue: { ...SLTypography.hero, color: SLColors.textStrong },
  segment: { flexDirection: 'row', alignSelf: 'center', padding: 3, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceFlat, borderWidth: 1, borderColor: SLColors.borderSubtle },
  segmentItem: { minWidth: 72, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.radiusControl },
  segmentActive: { backgroundColor: SLColors.surfaceSelected },
  segmentText: { ...SLTypography.label, color: SLColors.textStrong },
  toggle: { width: 54, height: 30, borderRadius: SLRadius.pill, padding: 3, backgroundColor: SLColors.surfaceSelected, alignSelf: 'center' },
  toggleOn: { backgroundColor: SLColors.accent },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: SLColors.textStrong },
  note: { ...SLTypography.caption, color: SLColors.textMuted, padding: SLSpacing.md },
  center: { minHeight: 80, alignItems: 'center', justifyContent: 'center' },
  errorState: { gap: SLSpacing.md, alignItems: 'center' },
  errorText: { ...SLTypography.bodyStrong, color: SLColors.danger },
  successText: { ...SLTypography.bodyStrong, color: SLColors.success },
  loggingState: { alignItems: 'stretch', gap: SLSpacing.sm, paddingHorizontal: SLSpacing.md },
  loggingStatus: { ...SLTypography.caption, color: SLColors.textMuted, textAlign: 'center' },
});
