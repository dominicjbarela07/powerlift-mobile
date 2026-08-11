// @ts-nocheck

import React from 'react';
import {
  Image,
  type ImageSourcePropType,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import {
  SLAccessoryIcon,
  SLButton,
  SLMotionPressable,
  SLProfileAvatar,
  type SLAccessoryIconName,
} from '@/components/ui';
import {
  SLColors,
  SLFontFamilies,
  SLMovementCardMaterial,
  SLMotion,
  SLRadius,
  SLSpacing,
  SLTypography,
} from '@/constants/theme';
import {
  CoreVariantBadge,
  type CoreVariantFamily,
} from '@/components/workout-logger/core-variant-badge';
import { AccessoryMuscleRegionMedallion } from '@/components/workout-logger/accessory-muscle-region-medallion';
import { MovementCardMaterial } from '@/components/workout-logger/movement-card-material';
import { LoggerPlateStackVisual } from '@/components/workout-logger/logger-primitives';
import { movementCardStateAccent } from '@/lib/movement-card-material';
import { logSetActionPresentation, type LoggerFeedbackState, type PrescribedOpportunity } from '@/lib/logger-feedback';
import type { LoggerPlateStackPresentation, LoggerProgressContext } from '@/lib/logger-visual-context';
import {
  coreLoggerHeaderMetadataLines,
  coreLoggerMovementStateLabel,
  coreLoggerVisibleExpandedContent,
  coreLoggerVisibleMovementNote,
} from '@/lib/core-logger-header';
import { coreLoggerHeroLoadLayout } from '@/lib/core-logger-hero';
import type { AccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';

export type SetRailStep = {
  key: string;
  label: string;
  state: 'completed' | 'active' | 'locked';
};

export type MovementLoggerFocusModel = {
  itemId?: number | null;
  groupItemId?: number | null;
  movementName: string;
  designation?: string | null;
  liftType?: string | null;
  currentSetLabel: string;
  currentSetPositionLabel: string;
  currentSetRepsLabel?: string | null;
  currentSetLoadLabel?: string | null;
  currentSetHistoryPlaceholder?: boolean;
  currentSetEffortLabel?: string | null;
  progressionLabel: string;
  targetLine?: string | null;
  prescriptionLine?: string | null;
  recentContext?: string | null;
  opportunity?: PrescribedOpportunity | null;
  rail: SetRailStep[];
  canLog: boolean;
  canRepeat: boolean;
  onLogSet?: () => void;
  onRepeatLast?: () => void;
  onViewHistory?: () => void;
  accessoryPresentation?: boolean;
};

export type ActiveMovementVisualContext = {
  liftLabel: string;
  liftAccentColor: string;
  liftIconSource?: ImageSourcePropType | null;
  accessoryIconName?: SLAccessoryIconName | null;
  accessoryMuscleRegion?: AccessoryMuscleRegionKey | null;
  coreVariantFamily?: CoreVariantFamily | null;
  plateStack?: LoggerPlateStackPresentation | null;
  progress?: LoggerProgressContext | null;
  coach?: {
    name: string;
    profilePhotoUrl?: string | null;
    profilePhotoVersion?: string | null;
    previewSource?: ImageSourcePropType | null;
  } | null;
};

export type ActiveMovementDetailRow = {
  key: string;
  setLogId?: number | null;
  label: string;
  timelineLabel?: string | null;
  state: 'completed' | 'active' | 'locked';
  target?: string | null;
  prescription?: string | null;
  resultText?: string | null;
  videoLabel?: string | null;
  videoStatus?: string | null;
  videoDisabled?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onVideo?: () => void;
  onLogSet?: () => void;
};

export type SessionMovementCardLifecycle =
  | 'pre_session'
  | 'active_session'
  | 'finished_session';

function splitLoadLabel(value?: string | null) {
  const match = String(value || '').trim().match(/^(.*?)\s*(kg|lb)$/i);
  return match
    ? { value: match[1].trim(), unit: match[2].toLowerCase() }
    : { value: String(value || '').trim(), unit: '' };
}

function metricValue(value?: string | null, suffix?: string) {
  const normalized = String(value || '').trim();
  return suffix ? normalized.replace(new RegExp(`\\s*${suffix}$`, 'i'), '') : normalized;
}

export function CompletedSetSwipeRow({
  onEdit,
  onDelete,
  shouldShowCompletedSetSwipeTooltip = false,
  reduceMotion = false,
  onCompletedSetSwipeTooltipStarted,
  children,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  shouldShowCompletedSetSwipeTooltip?: boolean;
  reduceMotion?: boolean;
  onCompletedSetSwipeTooltipStarted?: () => void;
  children: React.ReactNode;
}) {
  const enabled = !!onEdit || !!onDelete;
  const translateX = useSharedValue(0);
  const completedSetSwipeTooltipStartedRef = React.useRef(false);
  const completedSetSwipeTooltipTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompletedSetSwipeTooltipStartedRef = React.useRef(onCompletedSetSwipeTooltipStarted);
  const [completedSetSwipeTooltipTextVisible, setCompletedSetSwipeTooltipTextVisible] = React.useState(false);

  React.useEffect(() => {
    onCompletedSetSwipeTooltipStartedRef.current = onCompletedSetSwipeTooltipStarted;
  }, [onCompletedSetSwipeTooltipStarted]);

  React.useEffect(() => () => {
    if (completedSetSwipeTooltipTimerRef.current) clearTimeout(completedSetSwipeTooltipTimerRef.current);
  }, []);

  React.useEffect(() => {
    if (!shouldShowCompletedSetSwipeTooltip || completedSetSwipeTooltipStartedRef.current) return;
    completedSetSwipeTooltipStartedRef.current = true;
    onCompletedSetSwipeTooltipStartedRef.current?.();

    if (reduceMotion) {
      setCompletedSetSwipeTooltipTextVisible(true);
      completedSetSwipeTooltipTimerRef.current = setTimeout(() => setCompletedSetSwipeTooltipTextVisible(false), 2400);
      return;
    }

    translateX.value = withSequence(
      withTiming(-20, { duration: 120 }),
      withTiming(0, { duration: 140 }),
      withTiming(20, { duration: 120 }),
      withTiming(0, { duration: 140 }),
    );
  }, [reduceMotion, shouldShowCompletedSetSwipeTooltip, translateX]);

  const pan = enabled ? Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      translateX.value = Math.max(-96, Math.min(96, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX <= -72 && onEdit) {
        translateX.value = withTiming(0, { duration: 180 });
        runOnJS(onEdit)();
        return;
      }
      if (event.translationX >= 72 && onDelete) {
        translateX.value = withTiming(0, { duration: 180 });
        runOnJS(onDelete)();
        return;
      }
      translateX.value = withTiming(0, { duration: 180 });
    }) : Gesture.Tap().enabled(false);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const deleteActionStyle = useAnimatedStyle(() => ({
    width: Math.max(0, translateX.value),
  }));
  const editActionStyle = useAnimatedStyle(() => ({
    width: Math.max(0, -translateX.value),
  }));

  if (!enabled) return <>{children}</>;

  return (
    <View style={styles.completedSetSwipeFrame}>
      <Animated.View
        style={[
          styles.completedSetSwipeAction,
          styles.completedSetSwipeDelete,
          deleteActionStyle,
        ]}
      >
        <View style={styles.completedSetSwipeActionButton}>
          <Text style={styles.completedSetSwipeActionText}>Delete</Text>
        </View>
      </Animated.View>
      <Animated.View
        style={[
          styles.completedSetSwipeAction,
          styles.completedSetSwipeEdit,
          editActionStyle,
        ]}
      >
        <View style={styles.completedSetSwipeActionButton}>
          <Text style={styles.completedSetSwipeActionText}>Edit</Text>
        </View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.completedSetSwipeContent, animatedStyle]}
          accessibilityRole="button"
          accessibilityLabel="Completed set"
          accessibilityActions={[
            ...(onEdit ? [{ name: 'edit', label: 'Edit set' }] : []),
            ...(onDelete ? [{ name: 'delete', label: 'Delete set' }] : []),
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'edit') onEdit?.();
            if (event.nativeEvent.actionName === 'delete') onDelete?.();
          }}
        >
          {children}
        </Animated.View>
      </GestureDetector>
      {completedSetSwipeTooltipTextVisible ? (
        <Text pointerEvents="none" style={styles.completedSetSwipeTooltipText}>
          Swipe this set to edit or delete
        </Text>
      ) : null}
    </View>
  );
}

export function CoreMovementLedgerRow({
  state,
  title,
  designation,
  variantLabel,
  scheme,
  headerPrescription,
  meta,
  top,
  movementNote,
  loggerFocus,
  expanded,
  detailRows,
  auxAction,
  expandedIdentityContext,
  sessionIndex,
  sessionLifecycle,
  visualContext,
  submissionStatus = 'idle',
  submissionItemId,
  reduceMotion = false,
  completedSetSwipeTooltipSetLogId,
  onCompletedSetSwipeTooltipStarted,
  onOpportunityDisplayed,
  onOpen,
}: {
  state: 'complete' | 'logged' | 'not_started';
  title: string;
  designation?: string | null;
  variantLabel: string;
  scheme?: React.ReactNode;
  headerPrescription?: string | null;
  meta?: string | null;
  top?: string | null;
  movementNote?: string | null;
  loggerFocus?: MovementLoggerFocusModel | null;
  expanded?: boolean;
  detailRows?: ActiveMovementDetailRow[];
  auxAction?: React.ReactNode;
  expandedIdentityContext?: React.ReactNode;
  sessionIndex?: number;
  sessionLifecycle?: SessionMovementCardLifecycle;
  visualContext?: ActiveMovementVisualContext | null;
  submissionStatus?: LoggerFeedbackState['submission']['status'];
  submissionItemId?: number | null;
  reduceMotion?: boolean;
  completedSetSwipeTooltipSetLogId?: number | null;
  onCompletedSetSwipeTooltipStarted?: () => void;
  onOpportunityDisplayed?: (opportunity: PrescribedOpportunity) => void;
  onOpen: () => void;
}) {
  const { width: viewportWidth, fontScale } = useWindowDimensions();
  const compactMovementLayout = viewportWidth < 390 || fontScale >= 1.2;
  const isPreSessionCard = sessionLifecycle === 'pre_session';
  const stateLabel = coreLoggerMovementStateLabel(state);
  const movementHeaderMetadata = coreLoggerHeaderMetadataLines({
    title,
    designation,
    schemeLabel: variantLabel,
    prescription: headerPrescription,
  });
  const visibleMovementNote = coreLoggerVisibleMovementNote(expanded, movementNote);
  const visibleProgressContext = isPreSessionCard
    ? null
    : coreLoggerVisibleExpandedContent(expanded, visualContext?.progress);
  // P0 invariant: render every prescribed detail row from the API.
  // Do not filter this list down to completed/logged rows only.
  // Coach prescription, API payload, and athlete UI must match in meaning.
  const allDetailRows = detailRows || [];
  const lifecycleDetailRows = isPreSessionCard
    ? allDetailRows.map((row) => ({
        ...row,
        state: 'locked' as const,
        resultText: null,
        videoLabel: null,
        videoStatus: null,
        onEdit: undefined,
        onDelete: undefined,
        onVideo: undefined,
        onLogSet: undefined,
      }))
    : allDetailRows;
  const visibleDetailRows = expanded ? lifecycleDetailRows : [];
  const isActiveMovement =
    sessionLifecycle === 'active_session' && !!loggerFocus;
  const isComplete = state === 'complete';
  const logAction = logSetActionPresentation(
    submissionStatus,
    submissionItemId != null && submissionItemId === loggerFocus?.itemId,
  );
  // The canonical card is the production movement-card language. Mock mode
  // supplies data; it must never decide which visual implementation mounts.
  const canonicalMovementCard = sessionIndex != null;
  const canonicalExpandedWorkspace = Boolean(canonicalMovementCard && expanded);
  const cardMaterialState = state === 'logged'
    ? 'in_progress' as const
    : state === 'complete'
      ? 'complete' as const
      : 'not_started' as const;
  const cardStateAccent = movementCardStateAccent(cardMaterialState);
  const artworkAccent = visualContext?.liftAccentColor || SLColors.accentViolet;
  const opportunityAnnouncementRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const opportunity = loggerFocus?.opportunity;
    if (!opportunity || opportunityAnnouncementRef.current === opportunity.accessibilityLabel) return;
    opportunityAnnouncementRef.current = opportunity.accessibilityLabel;
    onOpportunityDisplayed?.(opportunity);
  }, [loggerFocus?.opportunity, onOpportunityDisplayed]);
  const showCollapsedVariant = !expanded && !isComplete && variantLabel;
  const showScheme = !!scheme && (expanded || !isComplete);
  const reviewRail =
    !loggerFocus && expanded && lifecycleDetailRows.length
      ? lifecycleDetailRows.map((row) => ({
          key: row.key,
          label: row.label,
          state: row.state === 'completed' ? 'completed' : 'locked',
        }))
      : [];
  const collapseCompletedGesture = isComplete && expanded
    ? Gesture.Pan()
      .activeOffsetX([-16, 16])
      .failOffsetY([-16, 16])
      .runOnJS(true)
      .onEnd((event) => {
        if (event.translationX <= -56) onOpen();
      })
    : null;

  if (sessionIndex != null) {
    const sessionRail = loggerFocus?.rail || reviewRail;
    const sessionMovementCard = (
      <View style={[
        styles.activeMovementCard,
        expanded && styles.activeMovementCardExpanded,
        canonicalMovementCard && styles.activeMovementCardCanonical,
      ]}>
        {canonicalMovementCard ? (
          <MovementCardMaterial
            expanded={Boolean(expanded)}
            state={cardMaterialState}
          />
        ) : null}
        <View style={[
          styles.activeMovementHeader,
          compactMovementLayout && styles.activeMovementHeaderCompact,
          canonicalExpandedWorkspace && styles.activeMovementHeaderExpanded,
        ]}>
          <View style={[
            styles.activeMovementLiftArtwork,
            visualContext?.accessoryMuscleRegion && styles.activeMovementAccessoryArtwork,
            compactMovementLayout && styles.activeMovementLiftArtworkCompact,
            compactMovementLayout && visualContext?.accessoryMuscleRegion && styles.activeMovementAccessoryArtworkCompact,
          ]}>
            {visualContext?.accessoryMuscleRegion ? (
              <AccessoryMuscleRegionMedallion
                compact={compactMovementLayout}
                regionKey={visualContext.accessoryMuscleRegion}
              />
            ) : visualContext?.coreVariantFamily && visualContext.liftIconSource ? (
              <CoreVariantBadge
                accentColor={visualContext.liftAccentColor}
                compact={compactMovementLayout}
                family={visualContext.coreVariantFamily}
                liftArtworkSource={visualContext.liftIconSource}
              />
            ) : visualContext?.liftIconSource ? (
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel={`${visualContext.liftLabel} movement`}
                resizeMode="contain"
                source={visualContext.liftIconSource}
                style={[
                  styles.activeMovementLiftIcon,
                  compactMovementLayout && styles.activeMovementLiftIconCompact,
                  canonicalMovementCard && { shadowColor: artworkAccent },
                ]}
              />
            ) : visualContext?.accessoryIconName ? (
              <SLAccessoryIcon
                accessibilityLabel={`${title} accessory movement`}
                name={visualContext.accessoryIconName}
                size={compactMovementLayout ? 52 : 58}
              />
            ) : (
              <View style={[
                styles.activeMovementAccessoryIcon,
                compactMovementLayout && styles.activeMovementAccessoryIconCompact,
              ]}>
                <Ionicons name="barbell-outline" size={34} color={SLColors.textMuted} />
              </View>
            )}
          </View>
          <View style={styles.activeMovementHeadingCopy}>
            <Text
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              typographyRole="shortTechnicalLabel"
              style={styles.activeMovementEyebrow}
            >
              Movement {sessionIndex}
            </Text>
            <Text
              maxFontSizeMultiplier={1.35}
              typographyRole="movementName"
              style={styles.activeMovementTitle}
            >
              {title}
            </Text>
            {movementHeaderMetadata.schemeLine ? (
              <Text
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.25}
                minimumFontScale={0.55}
                numberOfLines={1}
                style={[
                  styles.activeMovementSchemeType,
                  canonicalMovementCard && styles.activeMovementMetadataAnodized,
                ]}
              >
                {movementHeaderMetadata.schemeLine}
              </Text>
            ) : null}
            {movementHeaderMetadata.prescriptionLine ? (
              <Text
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.25}
                minimumFontScale={0.55}
                numberOfLines={1}
                style={[
                  styles.activeMovementPrescription,
                  canonicalMovementCard && styles.activeMovementPrescriptionAnodized,
                ]}
              >
                {movementHeaderMetadata.prescriptionLine}
              </Text>
            ) : null}
          </View>
          <View style={styles.activeMovementActions}>
            <Text style={[
              styles.activeMovementState,
              state === 'complete' && styles.ledgerStateCompleted,
              state === 'logged' && styles.ledgerStateActive,
              canonicalMovementCard && { color: cardStateAccent },
            ]}>{stateLabel}</Text>
            <SLMotionPressable
              accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
              accessibilityRole="button"
              accessibilityState={{ expanded: Boolean(expanded) }}
              style={styles.activeMovementDisclosure}
              onPress={onOpen}
            >
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={canonicalMovementCard ? cardStateAccent : SLColors.accentViolet}
              />
            </SLMotionPressable>
          </View>
        </View>

        {visibleProgressContext ? (
          <View
            accessible
            accessibilityLabel={visibleProgressContext.accessibilityLabel}
            style={[
              styles.movementProgressContext,
              canonicalExpandedWorkspace && styles.movementProgressContextExpanded,
            ]}
          >
            <View style={styles.movementProgressIcon}>
              <Ionicons
                name={visibleProgressContext.kind === 'prior_session' ? 'time-outline' : 'trending-up-outline'}
                size={21}
                color={visualContext.liftAccentColor}
              />
            </View>
            <View style={styles.movementProgressCopy}>
              <Text typographyRole="bodyStrong" style={styles.movementProgressPrimary}>
                {visibleProgressContext.primary}
              </Text>
              <Text typographyRole="supportingBody" style={styles.movementProgressSupporting}>
                {visibleProgressContext.eyebrow}
                {visibleProgressContext.supporting ? ` · ${visibleProgressContext.supporting}` : ''}
              </Text>
            </View>
          </View>
        ) : null}

        {visibleMovementNote ? (
          <View style={[
            styles.movementCoachNote,
            canonicalExpandedWorkspace && styles.movementCoachNoteExpanded,
          ]}>
            <SLProfileAvatar
              accessibilityLabel={`${visualContext?.coach?.name || 'Coach'} profile photo`}
              name={visualContext?.coach?.name || 'Coach'}
              previewSource={visualContext?.coach?.previewSource || undefined}
              profilePhotoUrl={visualContext?.coach?.profilePhotoUrl}
              profilePhotoVersion={visualContext?.coach?.profilePhotoVersion}
              size={40}
            />
            <View style={styles.movementCoachNoteCopy}>
              <Text typographyRole="modalBody" style={styles.movementNoteText}>{visibleMovementNote}</Text>
              <Text typographyRole="supportingBody" style={styles.movementNoteAttribution}>
                — {visualContext?.coach?.name || 'Coach'}
              </Text>
            </View>
          </View>
        ) : null}

        {expanded && expandedIdentityContext ? expandedIdentityContext : null}

        {expanded ? (
          <View style={[
            styles.activeMovementWorkspace,
            canonicalExpandedWorkspace && styles.activeMovementWorkspaceExpanded,
          ]}>
            {!loggerFocus && sessionRail.length ? <SetRail steps={sessionRail} /> : null}
            {loggerFocus?.accessoryPresentation ? (
              loggerFocus.canLog && loggerFocus.onLogSet ? (
                <View style={styles.accessoryPrimaryAction}>
                  <LogSetAction
                    action={logAction}
                    prominent={canonicalMovementCard}
                    reduceMotion={reduceMotion}
                    onPress={loggerFocus.onLogSet}
                  />
                </View>
              ) : null
            ) : loggerFocus ? (
              <View style={[
                styles.activeNextSetRow,
                visualContext?.plateStack && styles.activeNextSetRowWithPlate,
                compactMovementLayout && styles.activeNextSetRowCompact,
              ]}>
                <View style={styles.activeNextSetHero}>
                  <View style={styles.activeNextSetCopy}>
                    <Text
                      maxFontSizeMultiplier={1.2}
                      numberOfLines={1}
                      style={styles.activeNextSetKicker}
                    >
                      {loggerFocus.currentSetPositionLabel}
                    </Text>
                    {loggerFocus.currentSetHistoryPlaceholder ? (
                      <View style={styles.activeNextSetHistoryPlaceholder}>
                        <Text typographyRole="shortTechnicalLabel" style={styles.activeNextSetHistoryKicker}>Movement history</Text>
                        <Text typographyRole="supportingBody" style={styles.activeNextSetHistoryCopy}>History coming soon</Text>
                      </View>
                    ) : loggerFocus.currentSetLoadLabel && visualContext?.plateStack?.mode !== 'range' ? (() => {
                      const load = splitLoadLabel(loggerFocus.currentSetLoadLabel);
                      const loadLayout = coreLoggerHeroLoadLayout(
                        load.value,
                        viewportWidth,
                        Boolean(load.unit),
                      );
                      const responsiveLoadStyle = {
                        fontSize: SLTypography.hero.fontSize * 1.72 * loadLayout.fontScale,
                        lineHeight: SLTypography.hero.lineHeight * 1.65 * loadLayout.fontScale,
                        letterSpacing: -2.8 * loadLayout.fontScale,
                      };
                      const responsiveUnitStyle = {
                        fontSize: SLTypography.title.fontSize * 1.15 * loadLayout.unitScale,
                      };
                      return (
                        <View style={[
                          styles.activeNextSetLoadRow,
                          { marginTop: loadLayout.topInset },
                        ]}>
                          <MaskedView
                            accessible={false}
                            pointerEvents="none"
                            style={styles.activeNextSetLoadMask}
                            maskElement={(
                              <View style={styles.activeNextSetLoadMaskRow}>
                                <Text style={[styles.activeNextSetLoad, responsiveLoadStyle]}>{load.value}</Text>
                                {load.unit ? (
                                  <Text
                                    typographyRole="unit"
                                    style={[
                                      styles.activeNextSetLoadUnit,
                                      responsiveUnitStyle,
                                      styles.activeNextSetLoadMaskUnit,
                                    ]}
                                  >
                                    {load.unit}
                                  </Text>
                                ) : null}
                              </View>
                            )}
                          >
                            <BlurView
                              experimentalBlurMethod="dimezisBlurView"
                              intensity={18}
                              tint="dark"
                              style={StyleSheet.absoluteFill}
                            />
                            <View style={styles.activeNextSetLoadFrost} />
                          </MaskedView>
                          <Text
                            adjustsFontSizeToFit
                            minimumFontScale={0.72}
                            numberOfLines={1}
                            style={[
                              styles.activeNextSetLoad,
                              responsiveLoadStyle,
                              styles.activeNextSetLoadSizer,
                            ]}
                          >
                            {load.value}
                          </Text>
                          {load.unit ? (
                            <Text
                              typographyRole="unit"
                              style={[styles.activeNextSetLoadUnit, responsiveUnitStyle]}
                            >
                              {load.unit}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })() : null}
                  </View>
                  {visualContext?.plateStack ? (
                    visualContext.plateStack.mode === 'range' ? (
                      <View style={[styles.activeNextSetPlateStage, styles.activeNextSetPlateRangeStage]}>
                        <View style={styles.activeNextSetPlateRangeRow}>
                          {visualContext.plateStack.endpoints.map((endpoint, endpointIndex) => (
                            <View
                              key={`${endpoint.displayLabel}-${endpointIndex}`}
                              style={styles.activeNextSetPlateEndpoint}
                            >
                              <Text
                                adjustsFontSizeToFit
                                maxFontSizeMultiplier={1.15}
                                minimumFontScale={0.78}
                                numberOfLines={1}
                                style={styles.activeNextSetPlateEndpointLabel}
                              >
                                {endpoint.displayLabel}
                              </Text>
                              {endpoint.plateStack ? (
                                <LoggerPlateStackVisual
                                  plateStack={endpoint.plateStack}
                                  style={[
                                    styles.activeNextSetPlateRange,
                                    endpoint.plateStack.presentationStyle,
                                  ]}
                                />
                              ) : (
                                <View
                                  accessibilityLabel={`${endpoint.displayLabel} plate stack unavailable`}
                                  style={styles.activeNextSetPlateUnavailable}
                                >
                                  <Ionicons name="barbell-outline" size={32} color={SLColors.textSubtle} />
                                  <Text style={styles.activeNextSetPlateUnavailableText}>Stack unavailable</Text>
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : visualContext.plateStack.endpoints[0]?.plateStack ? (
                      <View style={styles.activeNextSetPlateStage}>
                        <LoggerPlateStackVisual
                          plateStack={visualContext.plateStack.endpoints[0].plateStack}
                          style={[
                            styles.activeNextSetPlate,
                            visualContext.plateStack.endpoints[0].plateStack.presentationStyle,
                          ]}
                        />
                      </View>
                    ) : null
                  ) : null}
                </View>
                <View style={styles.activeNextSetMetricRow}>
                  <View style={styles.activeNextSetMetricBlock}>
                    <Text typographyRole="numeric" style={styles.activeNextSetMetricValue}>{metricValue(loggerFocus.currentSetRepsLabel, 'reps')}</Text>
                    <Text typographyRole="shortTechnicalLabel" style={styles.activeNextSetMetricLabel}>Rep</Text>
                  </View>
                  <View style={styles.activeNextSetMetricCenterDivider} />
                  <View style={styles.activeNextSetMetricBlock}>
                    <Text
                      typographyRole="numeric"
                      style={styles.activeNextSetMetricValue}
                    >
                      {metricValue(loggerFocus.currentSetEffortLabel, loggerFocus.currentSetEffortLabel?.toLowerCase().includes('rir') ? 'rir' : 'rpe')}
                    </Text>
                    <Text typographyRole="shortTechnicalLabel" style={styles.activeNextSetMetricLabel}>
                      {loggerFocus.currentSetEffortLabel?.toLowerCase().includes('rir') ? 'RIR' : 'RPE'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
            {visibleDetailRows.length > 0 ? (
              <SetTimeline
                rows={visibleDetailRows}
                totalCount={allDetailRows.length}
                compact={canonicalMovementCard}
                openSurface={canonicalExpandedWorkspace}
                reduceMotion={reduceMotion}
                completedSetSwipeTooltipSetLogId={completedSetSwipeTooltipSetLogId}
                onCompletedSetSwipeTooltipStarted={onCompletedSetSwipeTooltipStarted}
              />
            ) : null}
            <View style={styles.activeMovementButtonRow}>
              {loggerFocus?.canLog && loggerFocus.onLogSet && !loggerFocus.accessoryPresentation ? (
                <LogSetAction
                  action={logAction}
                  prominent={canonicalMovementCard}
                  reduceMotion={reduceMotion}
                  onPress={loggerFocus.onLogSet}
                />
              ) : null}
              {(canonicalMovementCard && auxAction) || loggerFocus?.onViewHistory ? (
                <View style={styles.activeSecondaryActionRow}>
                  {canonicalMovementCard ? auxAction : null}
                  {loggerFocus?.onViewHistory ? (
                    <SLMotionPressable style={styles.activeHistoryButton} onPress={loggerFocus.onViewHistory}>
                      <Ionicons name="time-outline" size={18} color={SLColors.textMuted} />
                      <Text style={styles.activeHistoryButtonText}>History</Text>
                    </SLMotionPressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    );
    return collapseCompletedGesture ? (
      <GestureDetector gesture={collapseCompletedGesture}>
        {sessionMovementCard}
      </GestureDetector>
    ) : sessionMovementCard;
  }

  return (
    <View
      style={[
        styles.ledgerRow,
        expanded && styles.ledgerRowExpanded,
        isActiveMovement && styles.ledgerRowActive,
        state === 'logged' && styles.ledgerRowCurrent,
        state === 'complete' && styles.ledgerRowCompleted,
      ]}
    >
      <View style={styles.ledgerMain}>
        <View style={styles.ledgerHeader}>
          <View style={styles.ledgerTitleColumn}>
            <Text typographyRole="movementName" style={[styles.ledgerTitle, loggerFocus && styles.ledgerTitleActive]}>
              {title}
            </Text>
          </View>
          <View style={styles.ledgerHeaderActions}>
            <Text
              style={[
                styles.ledgerState,
                state === 'complete' && styles.ledgerStateCompleted,
                isActiveMovement && styles.ledgerStateActive,
              ]}
            >
              {stateLabel}
            </Text>
            {auxAction}
            <SLMotionPressable style={styles.ledgerActionButton} onPress={onOpen}>
              <Text style={[styles.ledgerAction, expanded && styles.ledgerActionExpanded]}>
                {expanded ? 'Collapse  ^' : 'Expand  v'}
              </Text>
            </SLMotionPressable>
          </View>
        </View>
        {showCollapsedVariant ? <Text typographyRole="supportingBody" style={styles.ledgerVariant}>{variantLabel}</Text> : null}
        {showScheme ? <Text style={styles.ledgerScheme}>{scheme}</Text> : null}
        {!expanded && meta ? <Text style={styles.ledgerMeta}>{meta}</Text> : null}
        {expanded && top ? <Text style={styles.ledgerTop}>{top}</Text> : null}
        {visibleMovementNote ? (
          <View style={styles.movementNoteBlock}>
            <Text typographyRole="shortTechnicalLabel" style={styles.movementNoteLabel}>Coach Note</Text>
            <Text typographyRole="modalBody" style={styles.movementNoteText}>{visibleMovementNote}</Text>
          </View>
        ) : null}
        {expanded && expandedIdentityContext ? expandedIdentityContext : null}
        {expanded && (loggerFocus || visibleDetailRows.length > 0) ? (
          <View style={styles.currentFocusBlock}>
            {loggerFocus ? <SetRail steps={loggerFocus.rail} /> : <SetRail steps={reviewRail} />}
            {loggerFocus ? (
              <View style={styles.nextSetPanel}>
                <View style={styles.currentTargetCopy}>
                  <Text style={styles.currentSetBadgeLabel}>Next Set</Text>
                  {loggerFocus.targetLine ? (
                    <Text style={styles.currentTarget}>{loggerFocus.targetLine}</Text>
                  ) : null}
                  <View style={styles.currentSetSummaryRow}>
                    <Text style={styles.currentSetBadgeValue}>{loggerFocus.currentSetLabel}</Text>
                    {loggerFocus.prescriptionLine ? (
                      <Text style={styles.currentPrescription}>{loggerFocus.prescriptionLine}</Text>
                    ) : null}
                  </View>
                </View>
                {loggerFocus.canLog && loggerFocus.onLogSet ? (
                  <SLMotionPressable style={styles.currentPrimaryAction} onPress={loggerFocus.onLogSet}>
                    <Text style={styles.currentPrimaryActionText}>Log Set</Text>
                  </SLMotionPressable>
                ) : null}
                <View style={styles.currentActionRow}>
                  {loggerFocus.canRepeat && loggerFocus.onRepeatLast ? (
                    <SLMotionPressable style={styles.currentSecondaryAction} onPress={loggerFocus.onRepeatLast}>
                      <Text style={styles.currentSecondaryActionText}>Repeat Last</Text>
                    </SLMotionPressable>
                  ) : null}
                  {loggerFocus.onViewHistory ? (
                    <SLMotionPressable style={styles.currentSecondaryAction} onPress={loggerFocus.onViewHistory}>
                      <Text style={styles.currentSecondaryActionText}>History</Text>
                    </SLMotionPressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            {visibleDetailRows.length > 0 ? (
              <SetTimeline
                rows={visibleDetailRows}
                totalCount={allDetailRows.length}
                compact={canonicalMovementCard}
                openSurface={canonicalExpandedWorkspace}
                reduceMotion={reduceMotion}
                completedSetSwipeTooltipSetLogId={completedSetSwipeTooltipSetLogId}
                onCompletedSetSwipeTooltipStarted={onCompletedSetSwipeTooltipStarted}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function setTimelinePrescription(row: ActiveMovementDetailRow) {
  if (row.state === 'completed' && row.resultText) return row.resultText;
  const target = String(row.target || '').trim();
  const prescription = String(row.prescription || '').trim();
  if (!target) return prescription || 'Planned';
  if (!prescription) return target;
  const normalizedTarget = target.toLowerCase().replace(/[@\s]/g, '');
  const normalizedPrescription = prescription.toLowerCase().replace(/[@\s]/g, '');
  return normalizedTarget.includes(normalizedPrescription)
    ? target
    : `${target} · ${prescription}`;
}

function SetTimeline({
  rows,
  totalCount,
  compact,
  openSurface,
  reduceMotion,
  completedSetSwipeTooltipSetLogId,
  onCompletedSetSwipeTooltipStarted,
}: {
  rows: ActiveMovementDetailRow[];
  totalCount: number;
  compact: boolean;
  openSurface: boolean;
  reduceMotion: boolean;
  completedSetSwipeTooltipSetLogId?: number | null;
  onCompletedSetSwipeTooltipStarted?: () => void;
}) {
  const completedCount = rows.filter((row) => row.state === 'completed').length;
  return (
    <View style={[
      styles.setTimeline,
      compact && styles.setTimelineCompact,
      openSurface && styles.setTimelineOpenSurface,
    ]}>
      <View style={[styles.setTimelineHeader, compact && styles.setTimelineHeaderCompact]}>
        <Text style={styles.setTimelineTitle}>SET TIMELINE</Text>
        <Text style={styles.setTimelineProgress}>
          {completedCount} / {totalCount} SETS COMPLETED
        </Text>
      </View>

      <View style={styles.setTimelineRows}>
        {rows.map((row, index) => {
          const isCompleted = row.state === 'completed';
          const isActive = row.state === 'active';
          const semanticNodeLabel = String(row.timelineLabel || '').trim();
          const nodeLabel = semanticNodeLabel || row.label.match(/\d+/)?.[0] || String(index + 1);
          const hasSemanticNodeLabel = Boolean(semanticNodeLabel);
          const stateLabel = isCompleted ? 'Completed' : 'Upcoming';
          const supportingLabel = compact
            ? isCompleted
              ? null
              : isActive
                ? 'Ready to log'
                : null
            : isCompleted
              ? 'Logged'
              : isActive
                ? 'Ready to log'
                : 'Upcoming';
          const canLog = Boolean(row.onLogSet);
          return (
            <CompletedSetSwipeRow
              key={row.key}
              onEdit={isCompleted ? row.onEdit : undefined}
              onDelete={isCompleted ? row.onDelete : undefined}
              shouldShowCompletedSetSwipeTooltip={isCompleted && row.setLogId === completedSetSwipeTooltipSetLogId}
              reduceMotion={reduceMotion}
              onCompletedSetSwipeTooltipStarted={onCompletedSetSwipeTooltipStarted}
            >
              <View style={[
                styles.setTimelineRow,
                compact && styles.setTimelineRowCompact,
                index < rows.length - 1 && styles.setTimelineRowSeparated,
              ]}>
                <View style={[
                  styles.setTimelineNodeColumn,
                  compact && styles.setTimelineNodeColumnCompact,
                  hasSemanticNodeLabel && styles.setTimelineNodeColumnSemantic,
                ]}>
                  <View style={[
                    styles.setTimelineNode,
                    compact && styles.setTimelineNodeCompact,
                    hasSemanticNodeLabel && styles.setTimelineNodeSemantic,
                    hasSemanticNodeLabel && compact && styles.setTimelineNodeSemanticCompact,
                    isActive && styles.setTimelineNodeActive,
                    isCompleted && styles.setTimelineNodeCompleted,
                  ]}>
                    <Text style={[
                      styles.setTimelineNodeText,
                      compact && styles.setTimelineNodeTextCompact,
                      hasSemanticNodeLabel && styles.setTimelineNodeTextSemantic,
                      isActive && styles.setTimelineNodeTextActive,
                      isCompleted && styles.setTimelineNodeTextCompleted,
                    ]}>
                      {nodeLabel}
                    </Text>
                  </View>
                  {index < rows.length - 1 ? (
                    <View style={[
                      styles.setTimelineConnector,
                      compact && styles.setTimelineConnectorCompact,
                      hasSemanticNodeLabel && styles.setTimelineConnectorSemantic,
                      hasSemanticNodeLabel && compact && styles.setTimelineConnectorSemanticCompact,
                      isCompleted && styles.setTimelineConnectorCompleted,
                    ]} />
                  ) : null}
                </View>

                <View style={[styles.setTimelineCopy, compact && styles.setTimelineCopyCompact]}>
                  <Text style={[styles.setTimelinePrescription, compact && styles.setTimelinePrescriptionCompact]}>
                    {setTimelinePrescription(row)}
                    {!compact ? <Text style={styles.setTimelineInlineState}> · {stateLabel}</Text> : null}
                  </Text>
                  {supportingLabel || row.videoStatus ? (
                    <Text style={[
                      styles.setTimelineSupporting,
                      compact && styles.setTimelineSupportingCompact,
                      isActive && styles.setTimelineSupportingActive,
                      isCompleted && styles.setTimelineSupportingCompleted,
                    ]}>
                      {[supportingLabel, row.videoStatus].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>

                {!compact && !isCompleted ? (
                  <SLMotionPressable
                    accessibilityRole="button"
                    accessibilityLabel={`Log ${row.label}`}
                    accessibilityState={{ disabled: !canLog }}
                    disabled={!canLog}
                    onPress={row.onLogSet}
                    style={[styles.setTimelineAction, !canLog && styles.setTimelineActionDisabled]}
                  >
                    <Text style={[styles.setTimelineActionText, !canLog && styles.setTimelineActionTextDisabled]}>
                      Log
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={canLog ? SLColors.accentViolet : SLColors.textSubtle}
                    />
                  </SLMotionPressable>
                ) : isCompleted && row.onVideo && row.videoLabel ? (
                  <SLMotionPressable
                    accessibilityRole="button"
                    disabled={row.videoDisabled}
                    onPress={row.onVideo}
                    style={[styles.setTimelineAction, row.videoDisabled && styles.setTimelineActionDisabled]}
                  >
                    <Text style={styles.setTimelineActionText}>{row.videoLabel}</Text>
                  </SLMotionPressable>
                ) : null}
              </View>
            </CompletedSetSwipeRow>
          );
        })}
      </View>
    </View>
  );
}

function SetRail({ steps }: { steps: SetRailStep[] }) {
  if (!steps.length) return null;
  return (
    <View style={styles.railWrap}>
      {steps.map((step, index) => (
        <React.Fragment key={step.key}>
          <View style={styles.railStep}>
            <View
              style={[
                styles.railNode,
                step.state === 'completed' && styles.railNodeCompleted,
                step.state === 'active' && styles.railNodeActive,
              ]}
            >
              <Text
                style={[
                  styles.railNodeText,
                  step.state === 'completed' && styles.railNodeTextCompleted,
                  step.state === 'active' && styles.railNodeTextActive,
                ]}
              >
                {step.state === 'completed' ? '✓' : step.label.replace(/[^0-9]/g, '') || '•'}
              </Text>
            </View>
            <Text
              style={[
                styles.railLabel,
                step.state === 'active' && styles.railLabelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
          {index < steps.length - 1 ? <View style={styles.railConnector} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

function LogSetAction({ action, prominent = false, reduceMotion, onPress }: {
  action: ReturnType<typeof logSetActionPresentation>;
  prominent?: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  if (prominent && action.tone !== 'accepted' && action.tone !== 'failure') {
    return (
      <SLButton
        accessibilityLabel={action.accessibilityLabel}
        accessibilityState={{ disabled: action.disabled, busy: action.tone === 'saving' || action.tone === 'refreshing' }}
        disabled={action.disabled}
        fullWidth
        iconRight="chevron-forward"
        iconRightPosition="edge"
        label={action.label}
        loading={action.tone === 'saving' || action.tone === 'refreshing'}
        onPress={onPress}
        size="lg"
        style={styles.prominentLogButton}
        variant="primary"
      />
    );
  }
  return (
    <SLMotionPressable
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessibilityState={{ disabled: action.disabled, busy: action.tone === 'saving' }}
      disabled={action.disabled}
      onPress={onPress}
      pressScale={reduceMotion ? 1 : SLMotion.prominentPressScale}
      style={[
        styles.activeLogButton,
        action.tone === 'accepted' && styles.activeLogButtonAccepted,
        action.tone === 'failure' && styles.activeLogButtonFailure,
      ]}
    >
      {action.tone === 'accepted' ? <Ionicons name="checkmark" size={20} color={SLColors.textStrong} /> : null}
      <Text style={styles.activeLogButtonText}>{action.label}</Text>
    </SLMotionPressable>
  );
}

export function CoreSchemeDetail({ children }: { children: React.ReactNode }) {
  return <Text style={styles.coreSchemeDetail}>{children}</Text>;
}

const styles = StyleSheet.create({
  completedSetSwipeFrame: {
    position: 'relative',
    overflow: 'hidden',
  },
  completedSetSwipeContent: {
    backgroundColor: 'transparent',
  },
  completedSetSwipeTooltipText: {
    position: 'absolute',
    right: 12,
    bottom: 5,
    color: SLColors.textStrong,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    backgroundColor: 'transparent',
  },
  completedSetSwipeAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  completedSetSwipeDelete: {
    left: 0,
    backgroundColor: SLColors.dangerSoft,
  },
  completedSetSwipeEdit: {
    right: 0,
    backgroundColor: SLColors.reviewSoft,
  },
  completedSetSwipeActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedSetSwipeActionText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  activeMovementCard: {
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: SLRadius.none,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.borderSubtle,
    backgroundColor: 'transparent',
  },
  activeMovementCardExpanded: {
    backgroundColor: SLColors.surfaceCommand,
  },
  activeMovementCardCanonical: {
    marginBottom: 14,
    borderWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLMovementCardMaterial.neutralBorder,
    borderRadius: SLRadius.lg,
    backgroundColor: SLMovementCardMaterial.base,
    position: 'relative',
    overflow: 'hidden',
  },
  activeMovementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 92,
  },
  activeMovementHeaderCompact: {
    gap: 8,
    minHeight: 82,
  },
  activeMovementHeaderExpanded: {
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLColors.borderSubtle,
  },
  activeMovementLiftArtwork: {
    width: 100,
    height: 88,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  activeMovementLiftArtworkCompact: {
    width: 86,
    height: 78,
  },
  activeMovementAccessoryArtwork: {
    width: 72,
    height: 72,
  },
  activeMovementAccessoryArtworkCompact: {
    width: 60,
    height: 64,
  },
  activeMovementCategoryArtwork: {
    width: '100%',
    height: '100%',
  },
  activeMovementHeadingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  activeMovementLiftIcon: {
    width: 104,
    height: 92,
    shadowColor: '#A65CFF',
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  activeMovementLiftIconCompact: {
    width: 90,
    height: 82,
  },
  activeMovementAccessoryIcon: {
    width: 88,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeMovementAccessoryIconCompact: {
    width: 76,
    height: 68,
  },
  accessoryPrimaryAction: {
    minHeight: 58,
    marginTop: 12,
  },
  activeMovementEyebrow: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: SLTypography.micro.lineHeight,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  activeMovementTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.title.fontSize,
    lineHeight: SLTypography.title.lineHeight,
    fontWeight: '800',
  },
  activeMovementSchemeType: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
    fontWeight: '700',
    flexShrink: 1,
  },
  activeMovementMetadataAnodized: {
    color: SLColors.textSecondary,
  },
  activeMovementPrescription: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
    fontWeight: '700',
    flexShrink: 1,
  },
  activeMovementPrescriptionAnodized: {
    color: SLColors.textStrong,
  },
  activeMovementActions: {
    width: 76,
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    gap: 4,
  },
  activeMovementState: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  activeMovementDisclosure: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movementProgressContext: {
    minHeight: 68,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: SLRadius.radiusRow,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: SLColors.surfaceEmbedded,
    overflow: 'hidden',
  },
  movementProgressContextExpanded: {
    minHeight: 62,
    marginTop: 0,
    paddingHorizontal: 2,
    paddingVertical: 11,
    borderWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLColors.borderSubtle,
    borderRadius: SLRadius.none,
    backgroundColor: 'transparent',
  },
  movementProgressIcon: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.accentVioletSoft,
  },
  movementProgressCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  movementProgressPrimary: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    fontWeight: '800',
  },
  movementProgressSupporting: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
  },
  movementCoachNote: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  movementCoachNoteExpanded: {
    marginTop: 0,
    paddingHorizontal: 2,
    paddingVertical: 11,
    borderTopWidth: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLColors.borderSubtle,
    borderRadius: SLRadius.none,
    backgroundColor: 'transparent',
  },
  movementCoachNoteCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  activeMovementWorkspace: {
    marginTop: 14,
    paddingTop: 0,
    gap: 12,
  },
  activeMovementWorkspaceExpanded: {
    marginTop: 0,
    gap: 12,
  },
  activeNextSetRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    minHeight: 356,
    paddingTop: 18,
    paddingBottom: 0,
  },
  activeNextSetRowWithPlate: {
    minHeight: 376,
  },
  activeNextSetRowCompact: {
    minHeight: 346,
    paddingTop: 16,
  },
  activeNextSetHero: {
    position: 'relative',
    minHeight: 265,
    width: '100%',
    overflow: 'visible',
  },
  activeNextSetCopy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    gap: 6,
    zIndex: 2,
  },
  activeNextSetPlate: {
    width: 390,
    height: 310,
  },
  activeNextSetPlateStage: {
    position: 'absolute',
    top: -20,
    left: -14,
    right: -14,
    height: 310,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  activeNextSetPlateRangeStage: {
    top: 18,
    left: 0,
    right: 0,
    height: 238,
  },
  activeNextSetPlateRangeRow: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
  },
  activeNextSetPlateEndpoint: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  activeNextSetPlateEndpointLabel: {
    color: SLColors.textStrong,
    fontFamily: SLFontFamilies.numeric,
    fontSize: SLTypography.title.fontSize * 1.05,
    lineHeight: SLTypography.title.lineHeight * 1.05,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
    zIndex: 2,
  },
  activeNextSetPlateRange: {
    width: '100%',
    height: 204,
    marginTop: -5,
  },
  activeNextSetPlateUnavailable: {
    flex: 1,
    minHeight: 178,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  activeNextSetPlateUnavailableText: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: SLTypography.micro.lineHeight,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeNextSetKicker: {
    color: SLColors.accentViolet,
    fontFamily: SLFontFamilies.bodyBold,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.75,
    marginBottom: 0,
    paddingLeft: 8,
    textAlign: 'left',
  },
  activeNextSetLoadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 0,
  },
  activeNextSetLoadMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  activeNextSetLoadMaskRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  activeNextSetLoadMaskUnit: {
    opacity: 0,
  },
  activeNextSetLoadFrost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 248, 252, 0.82)',
  },
  activeNextSetLoadSizer: {
    opacity: 0,
  },
  activeNextSetLoad: {
    color: SLColors.textStrong,
    fontFamily: SLFontFamilies.numeric,
    fontSize: SLTypography.hero.fontSize * 1.72,
    lineHeight: SLTypography.hero.lineHeight * 1.65,
    fontWeight: '800',
    letterSpacing: -2.8,
  },
  activeNextSetLoadUnit: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.title.fontSize * 1.15,
    fontWeight: '800',
    marginLeft: 7,
  },
  activeNextSetMetricRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: SLColors.borderSubtle,
    paddingTop: 13,
    width: '100%',
  },
  activeNextSetMetricBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  activeNextSetMetricCenterDivider: {
    width: 1,
    backgroundColor: SLColors.borderStrong,
  },
  activeNextSetMetricValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.title.fontSize * 1.4,
    lineHeight: SLTypography.title.lineHeight * 1.4,
    fontWeight: '900',
  },
  activeNextSetMetricLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  activeMovementButtonRow: {
    flexDirection: 'column',
    gap: 10,
  },
  activeSecondaryActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  prominentLogButton: {
    height: 58,
  },
  activeLogButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.accent,
    borderRadius: SLRadius.radiusRow,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 8,
  },
  activeLogButtonPressed: { transform: [{ scale: 0.975 }], opacity: 0.88 },
  activeLogButtonAccepted: { backgroundColor: SLColors.successSoft, borderWidth: 1, borderColor: SLColors.success },
  activeLogButtonFailure: { backgroundColor: SLColors.dangerSoft, borderWidth: 1, borderColor: SLColors.danger },
  activeLogButtonText: {
    color: SLColors.textInverted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  activeHistoryButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: SLRadius.radiusRow,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
  },
  activeHistoryButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  activeNextSetHistoryPlaceholder: {
    alignItems: 'center',
    marginBottom: 14,
  },
  activeNextSetHistoryKicker: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  activeNextSetHistoryCopy: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
    marginTop: 3,
  },
  setTimeline: {
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surface,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  setTimelineCompact: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 3,
  },
  setTimelineOpenSurface: {
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SLColors.borderSubtle,
    borderRadius: SLRadius.none,
    backgroundColor: 'transparent',
    paddingHorizontal: 2,
    paddingTop: 14,
    paddingBottom: 3,
  },
  setTimelineHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 4,
    marginBottom: 8,
  },
  setTimelineHeaderCompact: {
    marginBottom: 4,
  },
  setTimelineTitle: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  setTimelineProgress: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
  setTimelineRows: {
    width: '100%',
  },
  setTimelineRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  setTimelineRowCompact: {
    minHeight: 64,
  },
  setTimelineRowSeparated: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLColors.borderSubtle,
  },
  setTimelineNodeColumn: {
    width: 58,
    alignItems: 'center',
    paddingTop: 13,
    position: 'relative',
  },
  setTimelineNodeColumnCompact: {
    width: 46,
    paddingTop: 10,
  },
  setTimelineNodeColumnSemantic: {
    width: 64,
  },
  setTimelineNode: {
    zIndex: 1,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: SLColors.borderStrong,
    backgroundColor: SLColors.surface,
  },
  setTimelineNodeCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  setTimelineNodeSemantic: {
    width: 58,
    height: 34,
    borderRadius: 17,
  },
  setTimelineNodeSemanticCompact: {
    width: 54,
    height: 32,
    borderRadius: 16,
  },
  setTimelineNodeActive: {
    borderColor: SLColors.accentViolet,
    shadowColor: SLColors.accentViolet,
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  setTimelineNodeCompleted: {
    borderColor: SLColors.success,
    backgroundColor: SLColors.successSoft,
  },
  setTimelineNodeText: {
    color: SLColors.textMuted,
    fontFamily: SLFontFamilies.numeric,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '400',
  },
  setTimelineNodeTextCompact: {
    fontSize: 16,
    lineHeight: 20,
  },
  setTimelineNodeTextSemantic: {
    fontFamily: SLFontFamilies.bodyBold,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  setTimelineNodeTextActive: {
    color: SLColors.accentViolet,
  },
  setTimelineNodeTextCompleted: {
    color: SLColors.success,
  },
  setTimelineConnector: {
    position: 'absolute',
    top: 64,
    bottom: -25,
    width: 1,
    backgroundColor: SLColors.borderStandard,
  },
  setTimelineConnectorCompact: {
    top: 49,
    bottom: -16,
  },
  setTimelineConnectorSemantic: {
    top: 48,
  },
  setTimelineConnectorSemanticCompact: {
    top: 43,
  },
  setTimelineConnectorCompleted: {
    backgroundColor: SLColors.success,
  },
  setTimelineCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: 12,
    paddingLeft: 10,
    paddingRight: 6,
  },
  setTimelineCopyCompact: {
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 4,
  },
  setTimelinePrescription: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 21,
    fontWeight: '700',
  },
  setTimelinePrescriptionCompact: {
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 18,
  },
  setTimelineInlineState: {
    color: SLColors.textMuted,
    fontWeight: '500',
  },
  setTimelineSupporting: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 3,
  },
  setTimelineSupportingCompact: {
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 18,
    marginTop: 1,
  },
  setTimelineSupportingActive: {
    color: SLColors.accentMuted,
  },
  setTimelineSupportingCompleted: {
    color: SLColors.success,
  },
  setTimelineAction: {
    minWidth: 62,
    minHeight: 44,
    paddingHorizontal: 4,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  setTimelineActionDisabled: {
    opacity: 0.58,
  },
  setTimelineActionText: {
    color: SLColors.accentMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: SLTypography.label.lineHeight,
    fontWeight: '700',
  },
  setTimelineActionTextDisabled: {
    color: SLColors.textSubtle,
  },
  activeResultList: {
    borderTopWidth: 1,
    borderTopColor: SLColors.borderSubtle,
  },
  activeResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.borderSubtle,
  },
  activeResultRowCompleted: { backgroundColor: SLColors.surfaceEmbedded },
  activeResultStamp: {
    width: 28,
    height: 28,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
  },
  activeResultStampCompleted: { borderColor: SLColors.success, backgroundColor: SLColors.successSoft },
  activeResultStampText: { color: SLColors.textStrong, fontSize: SLTypography.caption.fontSize, fontWeight: '900' },
  activeResultCopy: {
    flex: 1,
  },
  activeResultLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
  },
  activeResultValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  activeResultState: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  coreSchemeDetail: {
    color: SLColors.textMuted,
    fontWeight: '600',
  },
  ledgerRow: {
    position: 'relative',
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingLeft: 20,
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceCommand,
    overflow: 'hidden',
  },
  ledgerRowExpanded: {
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.surfaceSelected,
  },
  ledgerRowActive: {
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.surfaceSelected,
  },
  ledgerRowCurrent: {
    backgroundColor: SLColors.surfaceCommand,
  },
  ledgerRowCompleted: {
    borderColor: 'rgba(143,178,154,0.36)',
    backgroundColor: SLColors.surfaceCommand,
  },
  ledgerRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 0,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: SLColors.railViolet,
  },
  ledgerRailCompleted: {
    backgroundColor: SLColors.railSuccess,
  },
  ledgerRailUpcoming: {
    backgroundColor: SLColors.warning,
  },
  ledgerRailAccessory: {
    backgroundColor: SLColors.accentCyanMuted,
  },
  ledgerRailActive: {
    backgroundColor: SLColors.railViolet,
  },
  ledgerMain: {
    flex: 1,
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  ledgerHeaderActions: {
    alignItems: 'flex-end',
    gap: 5,
  },
  ledgerTitleColumn: {
    flex: 1,
  },
  ledgerTitle: {
    color: SLColors.textStrong,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '900',
  },
  ledgerTitleActive: {
    color: SLColors.textStrong,
    fontSize: 30,
    lineHeight: 36,
  },
  ledgerState: {
    color: SLColors.warning,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ledgerStateCompleted: {
    color: SLColors.success,
  },
  ledgerStateActive: {
    color: SLColors.review,
  },
  ledgerVariant: {
    color: SLColors.review,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  ledgerMetaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  ledgerMetaChip: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    paddingRight: 2,
  },
  ledgerScheme: {
    color: SLColors.text,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 23,
    fontWeight: '700',
    marginTop: 4,
  },
  ledgerMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  ledgerTop: {
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  movementNoteBlock: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.075)',
  },
  movementNoteLabel: {
    color: SLColors.warning,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  movementNoteText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    fontWeight: '700',
  },
  movementNoteAttribution: {
    color: SLColors.warning,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
  ledgerAction: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  ledgerActionExpanded: {
    color: SLColors.warning,
  },
  ledgerActionButton: {
    alignSelf: 'flex-end',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: SLColors.surfaceFlat,
  },
  currentFocusBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.075)',
  },
  nextSetPanel: {
    padding: 14,
    borderRadius: SLRadius.md,
    backgroundColor: SLColors.surfaceInset,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  currentSetRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  currentSetBadge: {
    minWidth: 76,
    paddingTop: 1,
  },
  currentSetBadgeLabel: {
    color: SLColors.review,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentSetBadgeValue: {
    color: SLColors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 0,
  },
  currentTargetCopy: {
    flex: 1,
  },
  currentSetSummaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  currentProgression: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  currentTarget: {
    color: SLColors.textStrong,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    marginTop: 5,
  },
  currentPrescription: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 0,
  },
  railWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
    flexWrap: 'nowrap',
  },
  railStep: {
    alignItems: 'center',
    gap: 5,
  },
  railNode: {
    width: 30,
    height: 30,
    borderRadius: SLRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceFlat,
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
  },
  railNodeCompleted: {
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
  },
  railNodeActive: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.lg,
    backgroundColor: SLColors.accent,
    borderColor: SLColors.accent,
  },
  railNodeText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  railNodeTextCompleted: {
    color: SLColors.success,
  },
  railNodeTextActive: {
    color: SLColors.textInverted,
  },
  railLabel: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  railLabelActive: {
    color: SLColors.review,
  },
  railConnector: {
    flex: 1,
    minWidth: 28,
    height: 1,
    marginHorizontal: 2,
    marginBottom: 22,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(222,198,166,0.08)',
  },
  currentActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  currentSecondaryAction: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceFlat,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  currentSecondaryActionText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  currentPrimaryAction: {
    minHeight: 58,
    width: '100%',
    paddingHorizontal: 16,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: SLColors.accent,
    borderWidth: 1,
    borderColor: SLColors.accent,
  },
  currentPrimaryActionText: {
    color: SLColors.textInverted,
    fontSize: 19,
    fontWeight: '900',
  },
  currentLoggedList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(222,198,166,0.065)',
    gap: 6,
  },
  currentLoggedKicker: {
    color: SLColors.review,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  currentLoggedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    opacity: 0.82,
  },
  currentPlannedLine: {
    opacity: 0.9,
  },
  currentPlannedLineActive: {
    opacity: 1,
  },
  currentLoggedText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '700',
  },
  currentPlannedText: {
    color: SLColors.textMuted,
  },
  currentPlannedTextActive: {
    color: SLColors.review,
  },
  currentVideoStatus: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 16,
    fontWeight: '800',
  },
  currentVideoStatusPending: {
    color: SLColors.warning,
  },
  currentVideoStatusError: {
    color: SLColors.danger,
  },
  currentLoggedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentLoggedAction: {
    minHeight: 22,
    paddingHorizontal: 6,
    borderRadius: SLRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  currentLoggedActionDisabled: {
    opacity: 0.55,
  },
  currentLoggedActionText: {
    color: SLColors.review,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
  },
});
