import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';

type SessionScreenMode = 'pre_session' | 'active_session' | 'finished_session';
export type WorkoutProgressSetSegment = {
  key: string;
  group: 'primary' | 'secondary' | 'accessory';
  logged: boolean;
};

function SessionProgressRing({ progressPct, loggedSets, plannedSets }: {
  progressPct: number;
  loggedSets: number;
  plannedSets: number;
}) {
  const size = 86;
  const stroke = 8;
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
          stroke="rgba(148,163,184,0.16)"
          strokeWidth={stroke}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#8B5CF6"
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.progressRingCenter}>
        <Text style={styles.progressRingPct}>{Math.round(clampedProgress)}%</Text>
        <Text style={styles.progressRingSets}>{loggedSets} / {plannedSets || '—'} sets</Text>
      </View>
    </View>
  );
}

function SessionSetProgressStrip({ segments }: { segments: WorkoutProgressSetSegment[] }) {
  if (!segments.length) return null;
  return (
    <View style={styles.sessionSetStrip}>
      {segments.map((segment) => (
        <View
          key={segment.key}
          style={[
            styles.sessionSetBlock,
            segment.group === 'primary' && (segment.logged ? styles.sessionSetPrimaryDone : styles.sessionSetPrimaryFuture),
            segment.group === 'secondary' && (segment.logged ? styles.sessionSetSecondaryDone : styles.sessionSetSecondaryFuture),
            segment.group === 'accessory' && (segment.logged ? styles.sessionSetAccessoryDone : styles.sessionSetAccessoryFuture),
          ]}
        />
      ))}
    </View>
  );
}

export function SessionCommandStrip({
  unit,
  setUnit,
  restActive,
  restSeconds,
  canLog,
  openTimerPicker,
  stopRestTimer,
  formatRestTime,
  loggedSets,
  plannedSets,
  workoutStatus,
}: {
  unit: 'kg' | 'lb';
  setUnit: (unit: 'kg' | 'lb') => void;
  restActive: boolean;
  restSeconds: number;
  canLog: boolean;
  openTimerPicker: () => void;
  stopRestTimer: () => void;
  formatRestTime: (seconds: number) => string;
  loggedSets: number;
  plannedSets: number;
  workoutStatus?: string | null;
}) {
  void loggedSets;
  void plannedSets;
  void workoutStatus;

  return (
    <View style={styles.commandStripWrap}>
      <View style={[styles.commandStrip, restActive && styles.commandStripActive]}>
        <View style={styles.unitToggleRowInline}>
          <View style={styles.unitTogglePill}>
            <TouchableOpacity
              style={[
                styles.unitToggleOption,
                unit === 'kg' && styles.unitToggleOptionActive,
              ]}
              onPress={() => setUnit('kg')}
            >
              <Text
                style={[
                  styles.unitToggleText,
                  unit === 'kg' && styles.unitToggleTextActive,
                ]}
              >
                kg
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.unitToggleOption,
                unit === 'lb' && styles.unitToggleOptionActive,
              ]}
              onPress={() => setUnit('lb')}
            >
              <Text
                style={[
                  styles.unitToggleText,
                  unit === 'lb' && styles.unitToggleTextActive,
                ]}
              >
                lb
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.commandDivider} />

        <View style={[styles.commandTimerBlock, restActive && styles.commandTimerBlockActive]}>
          <Text style={[styles.commandTimerDot, !restActive && styles.commandTimerDotIdle]}>●</Text>
          <Text style={[styles.commandTimerValue, restActive && styles.commandTimerValueActive]}>
            {restActive && restSeconds > 0 ? formatRestTime(restSeconds) : '—'}
          </Text>
          <Text style={[styles.commandTimerMeta, restActive && styles.commandTimerMetaActive]}>
            Rest Timer
          </Text>
        </View>

        <View style={styles.commandDivider} />

        {canLog ? (
          !restActive ? (
            <TouchableOpacity style={styles.commandButton} onPress={openTimerPicker}>
              <Text style={styles.commandButtonText}>Set Timer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.commandButton, styles.commandButtonDanger]}
              onPress={stopRestTimer}
            >
              <Text style={styles.commandButtonText}>Stop</Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.commandButtonGhost}>
            <Text style={styles.commandButtonGhostText}>Ready</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function SessionIntentPanel({
  workout,
  screenMode,
  statusStyle,
  statusLabel,
  focusLine,
  loggedSets,
  plannedSets,
  progressPct,
  progressSegments,
  topLoggedText,
  canBegin,
  canEdit,
  actionLoading,
  onEditWorkout,
  onBeginWorkout,
}: {
  workout: { label?: string | null; date?: string | null; status?: string | null };
  screenMode: SessionScreenMode;
  statusStyle: { bg: string; border: string; text: string };
  statusLabel: string;
  focusLine: string;
  loggedSets: number;
  plannedSets: number;
  progressPct: number;
  progressSegments?: WorkoutProgressSetSegment[];
  topLoggedText?: string | null;
  canBegin: boolean;
  canEdit: boolean;
  actionLoading: null | 'begin' | 'complete' | 'cancel';
  onEditWorkout: () => void;
  onBeginWorkout: () => void;
}) {
  const isActiveSession = screenMode === 'active_session';
  const isFinishedSession = screenMode === 'finished_session';
  const statusBadge = workout.status ? (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: statusStyle.bg,
          borderColor: statusStyle.border,
        },
      ]}
    >
      <Text
        style={[
          styles.statusText,
          { color: statusStyle.text },
        ]}
      >
        {statusLabel}
      </Text>
    </View>
  ) : null;
  const actionRow = (canBegin || canEdit) ? (
    <View style={styles.sessionIntentActions}>
      {canEdit && (
        <TouchableOpacity
          style={[styles.actionButton, styles.actionSecondary]}
          onPress={onEditWorkout}
        >
          <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>
            Edit
          </Text>
        </TouchableOpacity>
      )}

      {canBegin && (
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.actionPrimary,
            actionLoading === 'begin' && { opacity: 0.7 },
          ]}
          onPress={onBeginWorkout}
          disabled={!!actionLoading}
        >
          {actionLoading === 'begin' ? (
            <ActivityIndicator size="small" color="#020617" />
          ) : (
            <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>
              Begin Workout
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  if (isActiveSession) {
    return (
      <View style={[styles.sessionIdentityShell, styles.sessionIdentityActive]}>
        <View style={styles.sessionIdentityBody}>
          <View style={styles.sessionIdentityTopRow}>
            <View style={styles.sessionIdentityTitleCol}>
              <Text style={styles.sessionModeKickerActive}>{statusLabel}</Text>
              <ThemedText variant="h1" style={styles.pageTitle}>
                {workout.label || 'Session'}
              </ThemedText>
              <Text style={styles.sessionIdentityMeta}>{workout.date || 'No date set'}</Text>
              {focusLine ? <Text style={styles.sessionFocusLine}>{focusLine}</Text> : null}
            </View>
            <SessionProgressRing
              progressPct={progressPct}
              loggedSets={loggedSets}
              plannedSets={plannedSets}
            />
          </View>
          <SessionSetProgressStrip segments={progressSegments || []} />
        </View>
      </View>
    );
  }

  if (isFinishedSession) {
    return (
      <View style={[styles.sessionIdentityShell, styles.sessionIdentityFinished]}>
        <View style={styles.sessionIdentityRailFinished} />
        <View style={styles.sessionIdentityBody}>
          <View style={styles.sessionIdentityTopRow}>
            <View style={styles.sessionIdentityTitleCol}>
              <Text style={styles.sessionModeKickerFinished}>Session Complete</Text>
              <ThemedText variant="h1" style={styles.pageTitle}>
                {workout.label || 'Session'}
              </ThemedText>
              <Text style={styles.sessionIdentityMeta}>{workout.date || 'No date set'}</Text>
            </View>
            {statusBadge}
          </View>
          <View style={styles.finishedRecapStrip}>
            <View style={styles.finishedRecapBlock}>
              <Text style={styles.finishedRecapLabel}>Work logged</Text>
              <Text style={styles.finishedRecapValue}>{loggedSets} / {plannedSets || '—'} sets</Text>
            </View>
            <View style={styles.finishedRecapDivider} />
            <View style={styles.finishedRecapBlockWide}>
              <Text style={styles.finishedRecapLabel}>Top work</Text>
              <Text style={styles.finishedRecapValue} numberOfLines={2}>
                {topLoggedText || 'Completed work logged'}
              </Text>
            </View>
          </View>
          <View style={styles.sessionProgressTrack}>
            <View style={[styles.sessionProgressFillFinished, { width: `${progressPct}%` }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.sessionIdentityShell, styles.sessionIdentityPre]}>
      <View style={styles.sessionIdentityBody}>
        <View style={styles.preSessionHeaderRow}>
          <View style={styles.sessionIdentityTitleCol}>
            <Text style={styles.sessionModeKickerPre}>Pre Session</Text>
            <ThemedText variant="h1" style={[styles.pageTitle, styles.preSessionTitle]}>
              {workout.label || 'Session'}
            </ThemedText>
            <Text style={styles.preSessionDate}>{workout.date || 'No date set'}</Text>
          </View>
          {statusBadge}
        </View>

        <View style={styles.preSessionFocusBlock}>
          <Text style={styles.preSessionIntentLabel}>Focus</Text>
          <Text style={styles.preSessionIntentText}>{focusLine || 'Training session'}</Text>
        </View>

        <View style={styles.preSessionPrepRow}>
          <View style={styles.preSessionPrepItem}>
            <Text style={styles.preSessionPrepLabel}>Planned work</Text>
            <Text style={styles.preSessionPrepValue}>{plannedSets || '—'} sets</Text>
          </View>
          <View style={styles.preSessionPrepItem}>
            <Text style={styles.preSessionPrepLabel}>Readiness</Text>
            <Text style={styles.preSessionPrepValue}>Before begin</Text>
          </View>
        </View>

        <View style={styles.preSessionPrepCard}>
          <View style={styles.preSessionPrepIcon}>
            <Ionicons name="calendar-outline" size={28} color="#A78BFA" />
          </View>
          <View style={styles.preSessionPrepCopy}>
            <Text style={styles.preSessionPrepCardTitle}>You have a workout assigned</Text>
            <Text style={styles.preSessionPrepCardText}>
              Review your plan and begin when you are ready.
            </Text>
          </View>
        </View>
        {actionRow}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  commandStripWrap: {
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  commandStrip: {
    marginHorizontal: 0,
    backgroundColor: 'transparent',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 10,
  },
  commandStripActive: {
    backgroundColor: 'transparent',
  },
  unitToggleRowInline: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,13,22,0.62)',
    borderRadius: 11,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  unitToggleOption: {
    minWidth: 46,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitToggleOptionActive: {
    backgroundColor: 'rgba(109,40,217,0.72)',
    shadowColor: '#5B4FCF',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  unitToggleText: {
    color: '#B8ACA1',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  unitToggleTextActive: {
    color: '#E5E7EB',
  },
  commandDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  commandTimerBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  commandTimerBlockActive: {
    backgroundColor: 'transparent',
  },
  commandTimerDot: {
    color: '#8B5CF6',
    fontSize: 10,
    marginTop: 1,
    textShadowColor: 'rgba(134,239,172,0.12)',
    textShadowRadius: 5,
  },
  commandTimerDotIdle: {
    color: '#64748B',
    textShadowRadius: 0,
  },
  commandTimerValue: {
    color: '#ECE5DA',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  commandTimerValueActive: {
    color: '#D9EDE1',
    textShadowColor: 'rgba(134,239,172,0.06)',
    textShadowRadius: 5,
  },
  commandTimerMeta: {
    color: '#B8ACA1',
    fontSize: 12,
    fontWeight: '500',
  },
  commandTimerMetaActive: {
    color: '#B8CDBF',
  },
  commandButton: {
    minWidth: 98,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,13,22,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
  },
  commandButtonDanger: {
    borderColor: 'rgba(239,68,68,0.18)',
    backgroundColor: 'rgba(40,12,18,0.42)',
  },
  commandButtonText: {
    color: '#ECE5DA',
    fontSize: 13,
    fontWeight: '700',
  },
  commandButtonGhost: {
    minWidth: 84,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24,16,15,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.045)',
  },
  commandButtonGhostText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionIdentityShell: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(11,16,28,0.76)',
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sessionIdentityPre: {
    backgroundColor: 'rgba(10,15,28,0.84)',
    borderColor: 'rgba(148,163,184,0.22)',
  },
  sessionIdentityActive: {
    backgroundColor: 'rgba(11,16,28,0.78)',
    borderColor: 'rgba(167,139,250,0.20)',
  },
  sessionIdentityFinished: {
    backgroundColor: 'rgba(24,16,17,0.24)',
    borderColor: 'rgba(129,140,248,0.10)',
  },
  sessionIdentityRailFinished: {
    width: 3,
    backgroundColor: '#818CF8',
    opacity: 0.54,
  },
  sessionIdentityBody: {
    flex: 1,
    paddingVertical: 18,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 16,
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
    color: '#B8ACA1',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  sessionFocusLine: {
    color: '#F8FAFC',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 5,
  },
  sessionModeKickerPre: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  preSessionTitle: {
    marginBottom: 6,
  },
  preSessionDate: {
    color: '#C7BEB4',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  sessionModeKickerActive: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  progressRingWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  progressRingSvg: {
    position: 'absolute',
  },
  progressRingCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingPct: {
    color: '#F8FAFC',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  progressRingSets: {
    color: '#C7BEB4',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    marginTop: 2,
  },
  sessionSetStrip: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    gap: 4,
  },
  sessionSetBlock: {
    flex: 1,
    minWidth: 5,
    height: '100%',
    borderRadius: 999,
  },
  sessionSetPrimaryDone: {
    backgroundColor: '#8B5CF6',
  },
  sessionSetPrimaryFuture: {
    backgroundColor: 'rgba(139,92,246,0.28)',
  },
  sessionSetSecondaryDone: {
    backgroundColor: '#F6B657',
  },
  sessionSetSecondaryFuture: {
    backgroundColor: 'rgba(246,182,87,0.28)',
  },
  sessionSetAccessoryDone: {
    backgroundColor: '#2DD4BF',
  },
  sessionSetAccessoryFuture: {
    backgroundColor: 'rgba(45,212,191,0.24)',
  },
  sessionModeKickerFinished: {
    color: '#C4B5FD',
    fontSize: 11,
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
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  preSessionIntentText: {
    color: '#F8FAFC',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
  },
  preSessionPrepRow: {
    flexDirection: 'row',
    gap: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.16)',
    paddingTop: 16,
  },
  preSessionPrepItem: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(167,139,250,0.46)',
    paddingLeft: 12,
    gap: 3,
  },
  preSessionPrepLabel: {
    color: '#A7B0C2',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  preSessionPrepValue: {
    color: '#F8FAFC',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  preSessionPrepCard: {
    minHeight: 84,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(13,18,32,0.72)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  preSessionPrepIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.16)',
  },
  preSessionPrepCopy: {
    flex: 1,
    gap: 4,
  },
  preSessionPrepCardTitle: {
    color: '#C4B5FD',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  preSessionPrepCardText: {
    color: '#C7BEB4',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  sessionIntentActions: {
    flexDirection: 'row',
    gap: 12,
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
    color: '#A7CBB5',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  activeProgressValue: {
    color: '#DED6CB',
    fontSize: 14,
    fontWeight: '800',
  },
  activeProgressPct: {
    color: '#B8CDBF',
    fontSize: 22,
    fontWeight: '800',
  },
  finishedRecapStrip: {
    flexDirection: 'row',
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
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  finishedRecapValue: {
    color: '#ECE5DA',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  sessionProgressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(222,198,166,0.075)',
  },
  sessionProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(134,239,172,0.56)',
  },
  sessionProgressFillFinished: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#818CF8',
  },
  pageTitle: {
    color: '#F8FAFC',
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
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionButton: {
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '900',
  },
  actionPrimary: {
    flex: 1.7,
    backgroundColor: '#6D28D9',
    borderColor: 'rgba(196,181,253,0.32)',
    shadowColor: '#6D28D9',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  actionPrimaryText: {
    color: '#F5F3FF',
  },
  actionSecondary: {
    flex: 0.8,
    backgroundColor: 'rgba(9,14,25,0.64)',
    borderColor: 'rgba(148,163,184,0.22)',
  },
  actionSecondaryText: {
    color: '#E2E8F0',
  },
});
