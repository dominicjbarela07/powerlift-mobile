import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type SessionScreenMode = 'pre_session' | 'active_session' | 'finished_session';

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
        <View style={styles.sessionIdentityRailActive} />
        <View style={styles.sessionIdentityBody}>
          <View style={styles.sessionIdentityTopRow}>
            <View style={styles.sessionIdentityTitleCol}>
              <ThemedText variant="h1" style={styles.pageTitle}>
                {workout.label || 'Session'}
              </ThemedText>
              <Text style={styles.sessionIdentityMeta}>{workout.date || 'No date set'}</Text>
              {focusLine ? <Text style={styles.sessionFocusLine}>{focusLine}</Text> : null}
            </View>
            {statusBadge}
          </View>
          <View style={styles.sessionProgressTrack}>
            <View style={[styles.sessionProgressFill, { width: `${progressPct}%` }]} />
          </View>
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
      <View style={styles.sessionIdentityRailPre} />
      <View style={styles.sessionIdentityBody}>
        <View style={styles.sessionIdentityTopRow}>
          <View style={styles.sessionIdentityTitleCol}>
            <Text style={styles.sessionModeKickerPre}>Pre Session</Text>
            <ThemedText variant="h1" style={styles.pageTitle}>
              {workout.label || 'Session'}
            </ThemedText>
            <Text style={styles.sessionIdentityMeta}>{workout.date || 'No date set'}</Text>
          </View>
          {statusBadge}
        </View>

        <View style={styles.preSessionIntentBand}>
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
    paddingHorizontal: 8,
    gap: 8,
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
    backgroundColor: 'rgba(24,16,15,0.28)',
    borderRadius: 11,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.06)',
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
    backgroundColor: 'rgba(91,79,207,0.26)',
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
    backgroundColor: 'rgba(222,198,166,0.07)',
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
    color: '#A7CBB5',
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
    fontSize: 24,
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
    minWidth: 84,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24,16,15,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.07)',
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
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(148,163,184,0.055)',
    backgroundColor: 'rgba(24,16,15,0.26)',
    marginTop: 6,
    marginBottom: 12,
  },
  sessionIdentityPre: {
    backgroundColor: 'rgba(24,16,15,0.24)',
  },
  sessionIdentityActive: {
    backgroundColor: 'rgba(24,17,15,0.22)',
    borderColor: 'rgba(134,239,172,0.055)',
  },
  sessionIdentityFinished: {
    backgroundColor: 'rgba(24,16,17,0.24)',
    borderColor: 'rgba(129,140,248,0.10)',
  },
  sessionIdentityRailPre: {
    width: 3,
    backgroundColor: '#A5B4FC',
    opacity: 0.56,
  },
  sessionIdentityRailActive: {
    width: 3,
    backgroundColor: '#A7CBB5',
    opacity: 0.48,
  },
  sessionIdentityRailFinished: {
    width: 3,
    backgroundColor: '#818CF8',
    opacity: 0.54,
  },
  sessionIdentityBody: {
    flex: 1,
    paddingVertical: 17,
    paddingLeft: 15,
    paddingRight: 13,
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  sessionFocusLine: {
    color: '#D8CFC4',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginTop: 5,
  },
  sessionModeKickerPre: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  sessionModeKickerActive: {
    color: '#A7CBB5',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  sessionModeKickerFinished: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 5,
  },
  preSessionIntentBand: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(148,163,184,0.055)',
    paddingVertical: 10,
    gap: 4,
  },
  preSessionIntentLabel: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  preSessionIntentText: {
    color: '#ECE5DA',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  preSessionPrepRow: {
    flexDirection: 'row',
    gap: 10,
  },
  preSessionPrepItem: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(165,180,252,0.34)',
    paddingLeft: 9,
    gap: 2,
  },
  preSessionPrepLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  preSessionPrepValue: {
    color: '#ECE5DA',
    fontSize: 13,
    fontWeight: '800',
  },
  sessionIntentActions: {
    flexDirection: 'row',
    gap: 10,
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
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 2,
    paddingTop: 2,
    paddingBottom: 2,
  },
  statusBadge: {
    minHeight: 26,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
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
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionPrimary: {
    backgroundColor: 'rgba(91,79,207,0.20)',
    borderColor: 'rgba(167,139,250,0.16)',
  },
  actionPrimaryText: {
    color: '#F5F3FF',
  },
  actionSecondary: {
    backgroundColor: 'rgba(24,16,15,0.18)',
    borderColor: 'rgba(148,163,184,0.08)',
  },
  actionSecondaryText: {
    color: '#E2E8F0',
  },
});
