import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/sl-text';
import {
  SLColors,
  SLControlSize,
  SLLayout,
  SLRadius,
  SLShadows,
  SLSpacing,
  SLTypography,
} from '@/constants/theme';
import { useSLReducedMotion } from '@/lib/motion';
import {
  formatTrainingHubPreviewDate,
  resolveTrainingHubSessionPreviewAction,
  trainingHubMovementPrescription,
} from '@/lib/training-hub-session-preview';
import type {
  AthleteTrainingProgram,
  AthleteTrainingSession,
} from './AthleteTrainingHubExperience';

type SessionContext = {
  blockName?: string | null;
  weekNumber?: number | null;
} | null;

type Props = {
  // Kept optional so in-flight anatomy work can supply its existing athlete
  // projection without coupling this release to that separate system.
  athlete?: unknown;
  context?: SessionContext;
  onClose: () => void;
  onOpen: () => void;
  program: AthleteTrainingProgram;
  session: AthleteTrainingSession | null;
  unit: 'kg' | 'lb';
};

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.85;
const MOVEMENT_PREVIEW_LIMIT = 5;

export function TrainingHubSessionPreviewBottomSheet({
  context,
  onClose,
  onOpen,
  program,
  session,
  unit,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useSLReducedMotion();
  const translateY = useRef(new Animated.Value(0)).current;
  const [opening, setOpening] = useState(false);

  const action = useMemo(() => resolveTrainingHubSessionPreviewAction({
    fallbackStatus: session?.status,
    stateLabel: session?.stateLabel,
    status: session?.lifecycleStatus,
  }), [session?.lifecycleStatus, session?.stateLabel, session?.status]);

  useEffect(() => {
    translateY.setValue(0);
    setOpening(false);
    if (session) {
      AccessibilityInfo.announceForAccessibility(
        `${action.statusLabel}. ${session.title}. Session preview.`,
      );
    }
  }, [action.statusLabel, session?.id, session?.title, translateY]);

  const settleSheet = () => {
    if (reduceMotion) {
      translateY.setValue(0);
      return;
    }
    Animated.spring(translateY, {
      damping: 24,
      mass: 0.7,
      stiffness: 280,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const dismissSheet = () => {
    if (reduceMotion) {
      onClose();
      return;
    }
    Animated.timing(translateY, {
      duration: 180,
      toValue: Math.max(height, 640),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const dragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
    ),
    onPanResponderMove: (_, gesture) => {
      translateY.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy >= DISMISS_DISTANCE || gesture.vy >= DISMISS_VELOCITY) {
        dismissSheet();
      } else {
        settleSheet();
      }
    },
    onPanResponderTerminate: settleSheet,
  }), [height, onClose, reduceMotion, translateY]);

  if (!session) return null;

  const completed = action.lifecycle === 'completed';
  const accent = lifecycleColor(action.lifecycle);
  const movementCount = Math.max(
    Number(session.movementCount || 0),
    session.movements?.length || 0,
  );
  const shownMovements = (session.movements || []).slice(0, MOVEMENT_PREVIEW_LIMIT);
  const remainingMovements = Math.max(0, movementCount - shownMovements.length);
  const contextLine = [
    context?.blockName,
    context?.weekNumber ? `Week ${context.weekNumber}` : null,
  ].filter(Boolean).join(' · ');

  const openCanonicalDestination = () => {
    if (!action.openable || opening) return;
    setOpening(true);
    onOpen();
  };

  return (
    <Modal
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Dismiss Session preview"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              maxHeight: Math.min(height * 0.88, 780),
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.dragArea} {...dragResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.sheetEyebrow}>SESSION PREVIEW</Text>
                <Text style={styles.sheetHeaderHint}>Swipe down to close</Text>
              </View>
              <Pressable
                accessibilityLabel="Close Session preview"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Ionicons color={SLColors.textStrong} name="close" size={21} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            bounces
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View accessibilityRole="summary" style={styles.identity}>
              <View style={styles.identityTopRow}>
                <View style={[styles.statusBadge, { borderColor: `${accent}88`, backgroundColor: `${accent}20` }]}>
                  <View style={[styles.statusDot, { backgroundColor: accent }]} />
                  <Text style={[styles.statusText, { color: accent }]}>{action.statusLabel.toUpperCase()}</Text>
                </View>
                <Text style={[styles.date, { color: accent }]}>{formatTrainingHubPreviewDate(session.date)}</Text>
              </View>
              <Text style={styles.title}>{session.title}</Text>
              <View style={styles.contextStack}>
                <Text style={styles.programName}>{program.name}</Text>
                {contextLine ? <Text style={styles.blockContext}>{contextLine}</Text> : null}
              </View>
              <View style={styles.identityMetrics}>
                <Ionicons color={SLColors.textMuted} name="barbell-outline" size={17} />
                <Text style={styles.identityMetricText}>{movementCount} movement{movementCount === 1 ? '' : 's'}</Text>
              </View>
            </View>

            {completed ? (
              <CompletedPreview session={session} unit={unit} />
            ) : (
              <View style={styles.previewSection}>
                <Text style={styles.sectionKicker}>MOVEMENT PREVIEW</Text>
                {shownMovements.length ? (
                  <View style={styles.movementList}>
                    {shownMovements.map((movement, index) => (
                      <View key={`${movement.label}-${index}`} style={styles.movementRow}>
                        <Text style={styles.movementNumber}>{index + 1}</Text>
                        <View style={styles.movementCopy}>
                          <Text numberOfLines={2} style={styles.movementName}>{movement.label}</Text>
                          <Text style={styles.movementPrescription}>
                            {trainingHubMovementPrescription(movement)}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {remainingMovements > 0 ? (
                      <Text style={styles.moreMovements}>+ {remainingMovements} more movement{remainingMovements === 1 ? '' : 's'}</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.emptyPreview}>Movement details are not available yet.</Text>
                )}
              </View>
            )}

            {session.focusMuscles?.length ? (
              <View style={styles.focusSection}>
                <Text style={styles.sectionKicker}>FOCUS</Text>
                <View style={styles.focusChips}>
                  {session.focusMuscles.slice(0, 5).map((muscle) => (
                    <View key={muscle} style={styles.focusChip}>
                      <Text style={styles.focusChipText}>{humanizeMuscle(muscle)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SLSpacing.md) }]}>
            {action.ctaLabel ? (
              <Pressable
                accessibilityLabel={action.ctaLabel}
                accessibilityRole="button"
                accessibilityState={{ busy: opening, disabled: opening }}
                disabled={opening}
                onPress={openCanonicalDestination}
                style={({ pressed }) => [
                  styles.primaryAction,
                  completed && styles.completedAction,
                  pressed && styles.primaryActionPressed,
                  opening && styles.primaryActionDisabled,
                ]}
              >
                <Text style={styles.primaryActionText}>{action.ctaLabel}</Text>
                <Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
              </Pressable>
            ) : (
              <View accessibilityRole="summary" style={styles.unavailableAction}>
                <Ionicons color={SLColors.textMuted} name="lock-closed-outline" size={18} />
                <Text style={styles.unavailableText}>This Session is not available to open.</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function CompletedPreview({ session, unit }: { session: AthleteTrainingSession; unit: 'kg' | 'lb' }) {
  const recap = session.recap;
  if (!recap) {
    return <View style={styles.previewSection}><Text style={styles.emptyPreview}>Completed Session evidence is available in the recap.</Text></View>;
  }
  return (
    <View style={styles.previewSection}>
      <Text style={styles.sectionKicker}>SESSION HIGHLIGHTS</Text>
      <View style={styles.completedMetrics}>
        <Metric label="SETS" value={String(recap.loggedSetCount || 0)} />
        <Metric label="PRs" value={String(recap.prCount || 0)} />
        <Metric label="RPE" value={recap.sessionRpe != null ? String(recap.sessionRpe) : '—'} />
      </View>
      {recap.totalVolumeKg ? <Text style={styles.completedVolume}>{formatVolume(recap.totalVolumeKg, unit)} total volume</Text> : null}
      {recap.topLifts?.slice(0, 3).map((lift) => (
        <View key={`${lift.workoutItemId}-${lift.movement}`} style={styles.topLiftRow}>
          <View style={styles.movementCopy}>
            <Text style={styles.movementName}>{lift.movement}</Text>
            <Text style={styles.movementPrescription}>{formatTopLift(lift, unit)}</Text>
          </View>
          {lift.hasPr ? <View style={styles.prBadge}><Text style={styles.prBadgeText}>PR</Text></View> : null}
        </View>
      ))}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function lifecycleColor(lifecycle: ReturnType<typeof resolveTrainingHubSessionPreviewAction>['lifecycle']) {
  if (lifecycle === 'completed') return SLColors.success;
  if (lifecycle === 'in_progress') return SLColors.accentViolet;
  if (lifecycle === 'missed' || lifecycle === 'canceled') return SLColors.danger;
  return SLColors.warning;
}

function humanizeMuscle(value: string) {
  return String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatVolume(valueKg: number, unit: 'kg' | 'lb') {
  const converted = unit === 'lb' ? valueKg * 2.2046226218 : valueKg;
  const formatted = converted >= 10000 ? `${(converted / 1000).toFixed(1)}K` : Math.round(converted).toLocaleString();
  return `${formatted} ${unit}`;
}

function formatTopLift(
  lift: NonNullable<NonNullable<AthleteTrainingSession['recap']>['topLifts']>[number],
  unit: 'kg' | 'lb',
) {
  const load = lift.weightKg != null
    ? `${Math.round(unit === 'lb' ? lift.weightKg * 2.2046226218 : lift.weightKg)} ${unit}`
    : 'Load not recorded';
  const reps = lift.reps != null ? ` × ${lift.reps}` : '';
  const rpe = lift.rpe != null ? ` @ ${lift.rpe}` : '';
  return `${load}${reps}${rpe}`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.74)' },
  sheet: { width: '100%', minHeight: 420, overflow: 'hidden', borderTopLeftRadius: SLRadius.radiusSheet, borderTopRightRadius: SLRadius.radiusSheet, borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderColor: SLColors.borderStrong, backgroundColor: '#050507', ...SLShadows.shadowSheet },
  dragArea: { backgroundColor: '#08080C' },
  dragHandle: { alignSelf: 'center', width: 42, height: 5, marginTop: SLSpacing.sm, borderRadius: SLRadius.pill, backgroundColor: SLColors.borderStrong },
  sheetHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SLLayout.sheetPadding, paddingBottom: SLSpacing.sm },
  headerCopy: { gap: SLSpacing.xxs },
  sheetEyebrow: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.8 },
  sheetHeaderHint: { ...SLTypography.caption, color: SLColors.textSubtle },
  closeButton: { width: SLControlSize.minimumTouchTarget, height: SLControlSize.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surfaceInset },
  pressed: { opacity: 0.72 },
  scrollContent: { paddingHorizontal: SLLayout.sheetPadding, paddingBottom: SLSpacing.xl, gap: SLSpacing.lg },
  identity: { gap: SLSpacing.sm, paddingVertical: SLSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  identityTopRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SLSpacing.sm },
  statusBadge: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, borderRadius: SLRadius.pill, borderWidth: StyleSheet.hairlineWidth },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...SLTypography.micro, fontWeight: '800', letterSpacing: 0.55 },
  date: { ...SLTypography.micro, flexShrink: 1, textAlign: 'right', letterSpacing: 0.45 },
  title: { ...SLTypography.title, color: SLColors.textStrong },
  contextStack: { gap: SLSpacing.xxs },
  programName: { ...SLTypography.bodyStrong, color: SLColors.text },
  blockContext: { ...SLTypography.caption, color: SLColors.textMuted },
  identityMetrics: { flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm },
  identityMetricText: { ...SLTypography.body, color: SLColors.textMuted },
  previewSection: { gap: SLSpacing.sm, borderRadius: SLRadius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle, backgroundColor: '#08090C', padding: SLSpacing.md },
  sectionKicker: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.7 },
  movementList: { gap: 0 },
  movementRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  movementNumber: { width: 22, ...SLTypography.bodyStrong, color: SLColors.textMuted, textAlign: 'center' },
  movementCopy: { flex: 1, minWidth: 0, gap: SLSpacing.xxs },
  movementName: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  movementPrescription: { ...SLTypography.caption, color: SLColors.textMuted },
  moreMovements: { ...SLTypography.caption, color: SLColors.accentMuted, paddingTop: SLSpacing.md },
  emptyPreview: { ...SLTypography.body, color: SLColors.textMuted },
  focusSection: { gap: SLSpacing.sm },
  focusChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SLSpacing.sm },
  focusChip: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 10, borderRadius: SLRadius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surfaceInset },
  focusChipText: { ...SLTypography.caption, color: SLColors.text },
  completedMetrics: { minHeight: 64, flexDirection: 'row' },
  metric: { flex: 1, justifyContent: 'center', gap: SLSpacing.xxs, borderRightWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  metricValue: { ...SLTypography.kpiNumber, color: SLColors.textStrong },
  metricLabel: { ...SLTypography.micro, color: SLColors.textMuted },
  completedVolume: { ...SLTypography.bodyStrong, color: SLColors.success },
  topLiftRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  prBadge: { minHeight: 24, justifyContent: 'center', paddingHorizontal: 7, borderRadius: SLRadius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: '#9D4AA4', backgroundColor: '#3A133D' },
  prBadgeText: { ...SLTypography.micro, color: '#F0A9F5', fontWeight: '800' },
  footer: { paddingHorizontal: SLLayout.sheetPadding, paddingTop: SLSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStrong, backgroundColor: '#08080C' },
  primaryAction: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SLSpacing.sm, borderRadius: SLRadius.md, backgroundColor: '#56239A' },
  completedAction: { backgroundColor: '#185B32' },
  primaryActionPressed: { opacity: 0.82 },
  primaryActionDisabled: { opacity: 0.58 },
  primaryActionText: { ...SLTypography.bodyStrong, color: '#FFFFFF' },
  unavailableAction: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SLSpacing.sm, borderRadius: SLRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surfaceInset },
  unavailableText: { ...SLTypography.body, color: SLColors.textMuted },
});
