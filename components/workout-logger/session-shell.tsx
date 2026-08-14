import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { SLAnimatedMetric, SLButton, SLMotionPressable } from '@/components/ui';
import {
  SLColors,
  SLFontFamilies,
  SLRadius,
  SLShadows,
  SLSpacing,
  SLTypography,
} from '@/constants/theme';
import type { SessionDurationEstimate } from '@/lib/session-duration-estimator';

type SessionScreenMode = 'pre_session' | 'active_session' | 'finished_session';

function SessionProgressRing({ progressPct, loggedSets, plannedSets }: {
  progressPct: number;
  loggedSets: number;
  plannedSets: number;
}) {
  const size = 92;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(100, progressPct || 0));
  const dashOffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <View style={styles.progressRingWrap}>
      <Svg width={size} height={size} style={styles.progressRingSvg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={SLColors.borderSubtle}
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={SLColors.railViolet}
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View
        accessible
        accessibilityLabel={`${loggedSets} of ${plannedSets || 'unknown'} sets completed`}
        style={styles.progressRingCenter}
      >
        <SLAnimatedMetric value={loggedSets} style={styles.progressRingMetric}>
          <Text
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1}
            minimumFontScale={0.68}
            numberOfLines={1}
            style={styles.progressRingFraction}
          >
            {loggedSets}/{plannedSets || '—'}
          </Text>
        </SLAnimatedMetric>
        <Text typographyRole="shortTechnicalLabel" style={styles.progressRingLabel}>sets</Text>
      </View>
    </View>
  );
}

export function SessionCommandStrip({
  restActive,
  restSeconds,
  restPromoted,
  canLog,
  openTimerPicker,
  stopRestTimer,
  formatRestTime,
  loggedSets,
  plannedSets,
  progressPct,
  sessionElapsedLabel,
  onRestTimerLayout,
}: {
  restActive: boolean;
  restSeconds: number;
  restPromoted: boolean;
  canLog: boolean;
  openTimerPicker: () => void;
  stopRestTimer: () => void;
  formatRestTime: (seconds: number) => string;
  loggedSets: number;
  plannedSets: number;
  progressPct: number;
  sessionElapsedLabel: string;
  onRestTimerLayout?: (origin: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}) {
  const restTimerBlockRef = React.useRef<View>(null);
  const reportRestTimerLayout = React.useCallback(() => {
    requestAnimationFrame(() => {
      restTimerBlockRef.current?.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) return;
        onRestTimerLayout?.({ x, y, width, height });
      });
    });
  }, [onRestTimerLayout]);

  const showTimerControls = canLog;
  const restUrgent = restActive && restSeconds <= 10;

  if (!showTimerControls) return null;

  return (
    <View style={styles.commandStripWrap}>
      <View style={[styles.commandStrip, restActive && styles.commandStripActive]}>
        <View style={styles.commandProgressBlock} testID="session-progress-zone">
          <SessionProgressRing
            progressPct={progressPct}
            loggedSets={loggedSets}
            plannedSets={plannedSets}
          />
        </View>

        <View style={styles.commandDivider} />

        <View style={[
          styles.commandTimerBlock,
          restActive && styles.commandTimerBlockActive,
          restUrgent && styles.commandTimerBlockUrgent,
          restPromoted && styles.commandTimerBlockPromoted,
        ]}
          collapsable={false}
          onLayout={reportRestTimerLayout}
          ref={restTimerBlockRef}
        >
          {!restActive ? (
            <SLMotionPressable
              accessibilityLabel="Set rest timer"
              accessibilityRole="button"
              onPress={openTimerPicker}
              style={styles.commandTimerIdleControl}
              testID="session-rest-timer-idle"
            >
              <Ionicons name="timer-outline" size={22} color={SLColors.accentViolet} />
              <Text typographyRole="longButtonLabel" style={styles.commandTimerIdleText}>Set Timer</Text>
            </SLMotionPressable>
          ) : (
            <>
              <View style={styles.commandTimerTextStack}>
                <Text
                  typographyRole="shortTechnicalLabel"
                  style={[
                    styles.commandTimerMeta,
                    styles.commandTimerMetaActive,
                    restUrgent && styles.commandTimerMetaUrgent,
                  ]}
                >
                  Rest Timer
                </Text>
                <SLAnimatedMetric value={restSeconds}>
                  <Text
                    typographyRole="numeric"
                    style={[
                      styles.commandTimerValue,
                      styles.commandTimerValueActive,
                      restUrgent && styles.commandTimerValueUrgent,
                    ]}
                  >
                    {formatRestTime(Math.max(0, restSeconds))}
                  </Text>
                </SLAnimatedMetric>
              </View>
              <SLMotionPressable
                accessibilityLabel="Stop rest timer"
                accessibilityRole="button"
                onPress={stopRestTimer}
                style={styles.commandStopButton}
                testID="session-rest-timer-stop"
              >
                <Text typographyRole="shortButtonLabel" style={styles.commandStopButtonText}>Stop</Text>
              </SLMotionPressable>
            </>
          )}
        </View>

        <View style={styles.commandDivider} />

        <View
          accessible
          accessibilityLabel={`Elapsed session time ${sessionElapsedLabel}`}
          style={styles.commandElapsedBlock}
          testID="session-elapsed-zone"
        >
          <Text typographyRole="shortTechnicalLabel" style={styles.commandElapsedMeta}>Elapsed</Text>
          <SLAnimatedMetric value={sessionElapsedLabel} style={styles.commandElapsedMetric}>
            <Text
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1}
              minimumFontScale={0.7}
              numberOfLines={1}
              typographyRole="numeric"
              style={styles.commandElapsedValue}
            >
              {sessionElapsedLabel}
            </Text>
          </SLAnimatedMetric>
        </View>
      </View>
    </View>
  );
}

function SessionTitleStatus({
  screenMode,
  statusLabel,
}: {
  screenMode: SessionScreenMode;
  statusLabel: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`Session status: ${statusLabel}`}
      style={styles.sessionTitleStatus}
    >
      <View style={[
        styles.sessionTitleStatusDot,
        screenMode === 'active_session' && styles.sessionTitleStatusDotActive,
        screenMode === 'finished_session' && styles.sessionTitleStatusDotFinished,
      ]} />
      <Text
        maxFontSizeMultiplier={1.2}
        numberOfLines={2}
        style={[
          styles.sessionTitleStatusText,
          screenMode === 'active_session' && styles.sessionTitleStatusTextActive,
          screenMode === 'finished_session' && styles.sessionTitleStatusTextFinished,
        ]}
      >
        {statusLabel}
      </Text>
    </View>
  );
}

export function SessionIntentPanel({
  workout,
  screenMode,
  statusLabel,
  focusLine,
  loggedSets,
  plannedSets,
  exerciseCount,
  durationEstimate,
  canEdit,
  onBackToTrainingHub,
  onEditWorkout,
}: {
  workout: { label?: string | null; date?: string | null; status?: string | null };
  screenMode: SessionScreenMode;
  statusLabel: string;
  focusLine: string;
  loggedSets: number;
  plannedSets: number;
  exerciseCount: number;
  durationEstimate: SessionDurationEstimate | null;
  canEdit: boolean;
  onBackToTrainingHub: () => void;
  onEditWorkout: () => void;
}) {
  const isActiveSession = screenMode === 'active_session';
  const isFinishedSession = screenMode === 'finished_session';
  const actionRow = canEdit ? (
    <View style={styles.preSessionActions}>
      <SLMotionPressable
        style={[styles.actionButton, styles.actionSecondary, styles.preSessionActionButton]}
        onPress={onEditWorkout}
      >
        <Ionicons name="create-outline" size={19} color={SLColors.textStrong} />
        <Text typographyRole="longButtonLabel" style={[styles.actionButtonText, styles.actionSecondaryText]}>Edit Session</Text>
      </SLMotionPressable>
    </View>
  ) : null;

  if (isFinishedSession) {
    return (
      <View style={[styles.sessionIdentityShell, styles.sessionIdentityFinished]}>
        <View style={[styles.sessionIdentityBody, styles.finishedSessionIdentityBody]}>
          <View style={styles.sessionIdentityTopRow}>
            <ThemedText
              typographyRole="workoutName"
              maxFontSizeMultiplier={1.35}
              variant="h1"
              style={[styles.pageTitle, styles.preSessionTitle]}
              numberOfLines={2}
            >
              {workout.label || 'Session'}
            </ThemedText>
            <SessionTitleStatus screenMode={screenMode} statusLabel={statusLabel} />
          </View>
          <View style={styles.sessionDateRow}>
            <Ionicons name="calendar-outline" size={17} color={SLColors.textMuted} />
            <Text typographyRole="supportingBody" style={styles.preSessionDate}>{formatSessionDate(workout.date)}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (isActiveSession) {
    return (
      <View style={[styles.sessionIdentityShell, styles.sessionIdentityActive]}>
        <View style={[styles.sessionIdentityBody, styles.activeSessionIdentityBody]}>
          <View style={styles.sessionIdentityTopRow}>
            <View style={styles.sessionIdentityTitleCol}>
              <ThemedText
                typographyRole="workoutName"
                maxFontSizeMultiplier={1.35}
                variant="h1"
                style={[styles.pageTitle, styles.preSessionTitle, styles.activeSessionTitle]}
                numberOfLines={2}
              >
                {workout.label || 'Session'}
              </ThemedText>
              <View style={styles.activeSessionMetaStack}>
                <View style={styles.sessionDateRow}>
                  <Ionicons name="calendar-outline" size={17} color={SLColors.textMuted} />
                  <Text typographyRole="supportingBody" style={styles.sessionIdentityMeta}>{formatSessionDate(workout.date)}</Text>
                </View>
                <Text typographyRole="supportingBody" style={styles.preSessionMetaFocus}>
                  <Text typographyRole="shortTechnicalLabel" style={styles.preSessionMetaLabel}>Focus:{'\u00A0'}</Text>
                  {focusLine || 'Training session'}
                </Text>
              </View>
            </View>
            <SessionTitleStatus screenMode={screenMode} statusLabel={statusLabel} />
          </View>
          <View style={styles.activePrepRow}>
            <View style={styles.preSessionPrepItem}>
              <Text typographyRole="shortTechnicalLabel" adjustsFontSizeToFit maxFontSizeMultiplier={1.2} minimumFontScale={0.8} numberOfLines={1} style={styles.preSessionPrepLabel}>Planned sets</Text>
              <Text typographyRole="numeric" adjustsFontSizeToFit maxFontSizeMultiplier={1.25} minimumFontScale={0.78} numberOfLines={1} style={styles.preSessionPrepNumber}>{plannedSets || '—'}</Text>
              <Text typographyRole="unit" maxFontSizeMultiplier={1.25} style={styles.preSessionPrepUnit}>sets</Text>
            </View>
            <View style={styles.preSessionStatDivider} />
            <View style={styles.preSessionPrepItem}>
              <Text typographyRole="shortTechnicalLabel" adjustsFontSizeToFit maxFontSizeMultiplier={1.2} minimumFontScale={0.8} numberOfLines={1} style={styles.preSessionPrepLabel}>Exercises</Text>
              <Text typographyRole="numeric" adjustsFontSizeToFit maxFontSizeMultiplier={1.25} minimumFontScale={0.78} numberOfLines={1} style={styles.preSessionPrepNumber}>{exerciseCount || '—'}</Text>
              <Text typographyRole="unit" maxFontSizeMultiplier={1.25} style={styles.preSessionPrepUnit}>exercises</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.sessionIdentityShell, styles.sessionIdentityPre]}>
      <View style={[styles.sessionIdentityBody, styles.preSessionIdentityBody]}>
        <SLMotionPressable
          accessibilityLabel="Back to Training Hub"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBackToTrainingHub}
          style={styles.backToTrainingHub}
        >
          <Ionicons name="chevron-back" size={15} color={SLColors.textMuted} />
          <Text style={styles.backToTrainingHubText}>Back to Training Hub</Text>
        </SLMotionPressable>

        <View style={styles.sessionIdentityTopRow}>
          <ThemedText typographyRole="workoutName" maxFontSizeMultiplier={1.35} variant="h1" numberOfLines={2} style={[styles.pageTitle, styles.preSessionTitle]}>
            {workout.label || 'Session'}
          </ThemedText>
          <SessionTitleStatus screenMode={screenMode} statusLabel={statusLabel} />
        </View>

        <View style={styles.preSessionMetaStack}>
          <View style={styles.sessionDateRow}>
            <Ionicons name="calendar-outline" size={17} color={SLColors.textMuted} />
            <Text typographyRole="supportingBody" style={styles.preSessionDate}>{formatSessionDate(workout.date)}</Text>
          </View>
          <Text typographyRole="supportingBody" style={styles.preSessionMetaFocus}>
            <Text typographyRole="shortTechnicalLabel" style={styles.preSessionMetaLabel}>Focus:{'\u00A0'}</Text>
            {focusLine || 'Training session'}
          </Text>
        </View>

        <View style={styles.preSessionPrepRow}>
          <View style={styles.preSessionPrepItem}>
            <Text typographyRole="shortTechnicalLabel" adjustsFontSizeToFit maxFontSizeMultiplier={1.2} minimumFontScale={0.8} numberOfLines={1} style={styles.preSessionPrepLabel}>Planned sets</Text>
            <Text typographyRole="numeric" adjustsFontSizeToFit maxFontSizeMultiplier={1.25} minimumFontScale={0.78} numberOfLines={1} style={styles.preSessionPrepNumber}>{plannedSets || '—'}</Text>
            <Text typographyRole="unit" maxFontSizeMultiplier={1.25} style={styles.preSessionPrepUnit}>sets</Text>
          </View>
          <View style={styles.preSessionStatDivider} />
          <View style={styles.preSessionPrepItem}>
            <Text typographyRole="shortTechnicalLabel" adjustsFontSizeToFit maxFontSizeMultiplier={1.2} minimumFontScale={0.8} numberOfLines={1} style={styles.preSessionPrepLabel}>Exercises</Text>
            <Text typographyRole="numeric" adjustsFontSizeToFit maxFontSizeMultiplier={1.25} minimumFontScale={0.78} numberOfLines={1} style={styles.preSessionPrepNumber}>{exerciseCount || '—'}</Text>
            <Text typographyRole="unit" maxFontSizeMultiplier={1.25} style={styles.preSessionPrepUnit}>exercises</Text>
          </View>
          <View style={styles.preSessionStatDivider} />
          <View style={styles.preSessionPrepItem}>
            <Text typographyRole="shortTechnicalLabel" adjustsFontSizeToFit maxFontSizeMultiplier={1.2} minimumFontScale={0.8} numberOfLines={1} style={styles.preSessionPrepLabel}>Est. time</Text>
            <Text typographyRole="numeric" adjustsFontSizeToFit maxFontSizeMultiplier={1.25} minimumFontScale={0.72} numberOfLines={1} style={styles.preSessionPrepNumber}>{durationEstimate?.label || '—'}</Text>
            <Text typographyRole="unit" maxFontSizeMultiplier={1.25} style={styles.preSessionPrepUnit}>min</Text>
          </View>
        </View>
        {actionRow}
      </View>
    </View>
  );
}

export function SessionBeginAction({
  actionLoading,
  onBeginWorkout,
}: {
  actionLoading: null | 'begin' | 'complete' | 'cancel';
  onBeginWorkout: () => void;
}) {
  return (
    <SLButton
      label="Begin Session"
      onPress={onBeginWorkout}
      disabled={!!actionLoading}
      loading={actionLoading === 'begin'}
      variant="primary"
      size="lg"
      iconRight="chevron-forward"
      iconRightPosition="edge"
      fullWidth
      accessibilityLabel="Begin training session"
      style={styles.preSessionActionButton}
    />
  );
}

function formatSessionDate(value?: string | null) {
  if (!value) return 'No date set';
  const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  commandStripWrap: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  commandStrip: {
    marginHorizontal: 0,
    backgroundColor: 'transparent',
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 5,
  },
  commandStripActive: {
    backgroundColor: 'transparent',
  },
  commandProgressBlock: {
    width: 96,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commandDivider: {
    width: 1,
    height: 48,
    backgroundColor: SLColors.borderSubtle,
  },
  commandTimerBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.md,
    backgroundColor: SLColors.surfaceFlat,
  },
  commandTimerBlockActive: {
    borderColor: 'rgba(143,178,154,0.24)',
    backgroundColor: SLColors.successSoft,
  },
  commandTimerBlockUrgent: {
    borderColor: SLColors.danger,
    backgroundColor: SLColors.dangerSoft,
  },
  commandTimerBlockPromoted: {
    opacity: 0.16,
  },
  commandTimerIdleControl: {
    width: '100%',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  commandTimerIdleText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  commandTimerTextStack: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minWidth: 0,
  },
  commandTimerValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    lineHeight: 21,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  commandTimerValueActive: {
    color: SLColors.textStrong,
    fontSize: SLTypography.title.fontSize,
    lineHeight: 25,
    textShadowRadius: 0,
  },
  commandTimerMeta: {
    color: SLColors.textMuted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  commandTimerMetaActive: {
    color: SLColors.success,
  },
  commandTimerMetaUrgent: {
    color: SLColors.danger,
  },
  commandTimerValueUrgent: {
    color: SLColors.danger,
  },
  commandStopButton: {
    minWidth: 52,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.danger,
    backgroundColor: SLColors.dangerSoft,
  },
  commandStopButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  commandElapsedBlock: {
    width: 94,
    minWidth: 0,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  commandElapsedMeta: {
    color: SLColors.textMuted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  commandElapsedMetric: {
    width: '100%',
    alignItems: 'center',
  },
  commandElapsedValue: {
    width: '100%',
    color: SLColors.textStrong,
    fontFamily: SLFontFamilies.numeric,
    fontSize: SLTypography.sectionTitle.fontSize,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  sessionIdentityShell: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceCommand,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: SLRadius.md,
    overflow: 'hidden',
  },
  sessionIdentityPre: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: SLRadius.none,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderSubtle,
    marginTop: 4,
    marginBottom: 18,
  },
  sessionIdentityActive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: SLRadius.none,
    borderTopWidth: 1,
    borderColor: SLColors.borderSubtle,
    marginTop: 4,
    marginBottom: 0,
  },
  activeSessionIdentityBody: {
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 12,
    paddingBottom: SLSpacing.md,
  },
  sessionTitleStatus: {
    minWidth: 88,
    maxWidth: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 5,
    flexShrink: 0,
  },
  sessionTitleStatusDot: {
    width: 8,
    height: 8,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.warning,
  },
  sessionTitleStatusDotActive: {
    backgroundColor: SLColors.success,
  },
  sessionTitleStatusDotFinished: {
    backgroundColor: SLColors.accentViolet,
  },
  sessionTitleStatusText: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'right',
    letterSpacing: 0.7,
  },
  sessionTitleStatusTextActive: {
    color: SLColors.success,
  },
  sessionTitleStatusTextFinished: {
    color: SLColors.accentViolet,
  },
  activeSessionMetaStack: {
    marginTop: 12,
    gap: SLSpacing.xs,
  },
  sessionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SLSpacing.sm,
  },
  activeSessionTitle: {
    marginBottom: 0,
  },
  activePrepRow: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderSubtle,
    paddingVertical: 16,
  },
  sessionIdentityFinished: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: SLRadius.none,
    marginTop: 4,
    marginBottom: SLSpacing.lg,
  },
  sessionIdentityRailFinished: {
    width: 3,
    backgroundColor: SLColors.accentViolet,
    opacity: 0.54,
  },
  sessionIdentityBody: {
    flex: 1,
    paddingVertical: 18,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 16,
  },
  preSessionIdentityBody: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  backToTrainingHub: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 0,
    paddingRight: SLSpacing.sm,
  },
  backToTrainingHubText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  finishedSessionIdentityBody: {
    paddingHorizontal: 0,
    paddingVertical: SLSpacing.lg,
    gap: SLSpacing.xs,
  },
  preSessionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  sessionIdentityTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionIdentityTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  sessionIdentityMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 20,
    fontWeight: '600',
  },
  sessionFocusLine: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 5,
  },
  activeSessionStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderSubtle,
    paddingVertical: 10,
  },
  activeSessionStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceFlat,
    gap: 12,
  },
  activeSessionStatLabel: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  activeSessionStatValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.screenTitle.fontSize,
    lineHeight: 29,
    fontWeight: '900',
  },
  sessionModeKickerPre: {
    color: SLColors.warning,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  preSessionTitle: {
    marginBottom: 2,
    fontSize: SLTypography.hero.fontSize,
    lineHeight: 38,
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  preSessionDate: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontWeight: '600',
  },
  preSessionMetaStack: {
    gap: SLSpacing.xs,
  },
  preSessionMetaLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '600',
  },
  preSessionMetaFocus: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  sessionModeKickerActive: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  progressRingWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingSvg: {
    position: 'absolute',
  },
  progressRingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingMetric: {
    alignItems: 'center',
    width: 78,
  },
  progressRingFraction: {
    color: SLColors.textStrong,
    fontFamily: SLFontFamilies.numeric,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '600',
    letterSpacing: -0.7,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    width: '100%',
  },
  progressRingLabel: {
    color: SLColors.textSubtle,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '500',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.65,
  },
  sessionModeKickerFinished: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  preSessionFocusBlock: {
    paddingTop: 2,
    gap: 4,
  },
  preSessionIntentLabel: {
    color: SLColors.review,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  preSessionIntentText: {
    color: SLColors.textStrong,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  preSessionPrepRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: SLColors.borderSubtle,
    paddingTop: 15,
  },
  preSessionPrepItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
  },
  preSessionPrepLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  preSessionPrepNumber: {
    color: SLColors.textStrong,
    fontSize: SLTypography.title.fontSize,
    lineHeight: 29,
    fontWeight: '900',
  },
  preSessionPrepUnit: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '600',
  },
  preSessionStatDivider: {
    width: 1,
    backgroundColor: SLColors.borderSubtle,
  },
  preSessionPrepCard: {
    minHeight: 84,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceFlat,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  preSessionPrepIcon: {
    width: 52,
    height: 52,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.accentSoft,
  },
  preSessionPrepCopy: {
    flex: 1,
    gap: 4,
  },
  preSessionPrepCardTitle: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.cardTitle.fontSize,
    lineHeight: 22,
    fontWeight: '900',
  },
  preSessionPrepCardText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontWeight: '600',
  },
  preSessionActions: {
    gap: 10,
    width: '100%',
  },
  preSessionActionButton: {
    alignSelf: 'stretch',
    width: '100%',
  },
  activeProgressBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(134,239,172,0.045)',
    paddingVertical: 10,
  },
  activeProgressCopy: {
    flex: 1,
    gap: 2,
  },
  activeProgressLabel: {
    color: SLColors.success,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  activeProgressValue: {
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
  },
  activeProgressPct: {
    color: SLColors.success,
    fontSize: SLTypography.title.fontSize,
    fontWeight: '800',
  },
  finishedRecapStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(129,140,248,0.09)',
    paddingVertical: 11,
  },
  finishedRecapBlock: {
    minWidth: 86,
    gap: 3,
  },
  finishedRecapBlockWide: {
    flex: 1,
    gap: 3,
  },
  finishedRecapDivider: {
    width: 1,
    backgroundColor: 'rgba(222,198,166,0.10)',
  },
  finishedRecapLabel: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  finishedRecapValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
    marginTop: 4,
  },
  sessionProgressTrack: {
    height: 5,
    borderRadius: SLRadius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(222,198,166,0.075)',
  },
  sessionProgressFill: {
    height: '100%',
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.success,
  },
  sessionProgressFillFinished: {
    height: '100%',
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.accentViolet,
  },
  pageTitle: {
    color: SLColors.textStrong,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 2,
    paddingTop: 2,
    paddingBottom: 2,
  },
  statusBadge: {
    minHeight: 26,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...SLShadows.shadowSoft,
  },
  statusText: {
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionButton: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
  },
  actionPrimary: {
    flex: 1.7,
    backgroundColor: SLColors.accent,
    borderColor: SLColors.accent,
    ...SLShadows.raised,
  },
  actionPrimaryText: {
    color: SLColors.textInverted,
  },
  actionSecondary: {
    flex: 0.8,
    backgroundColor: SLColors.surfaceFlat,
    borderColor: SLColors.borderSubtle,
  },
  actionSecondaryText: {
    color: SLColors.text,
  },
});
