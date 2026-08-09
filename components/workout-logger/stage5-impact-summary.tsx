import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';

import { HistoricalAccomplishmentList } from '@/components/core-accomplishments';
import { SLMotionEntrance } from '@/components/ui';
import { PostSessionLedgerCeremony } from '@/components/workout-logger/post-session-ledger-ceremony';
import { PostSessionSurface } from '@/components/workout-logger/post-session-surfaces';
import { fetchJson } from '@/lib/api';
import { SLColors, SLIconSize, SLRadius, SLShadows, SLSpacing, SLTypography } from '@/constants/theme';
import { recognitionPresentation, selectSessionHighlights, type LoggerRecognitionEvent } from '@/lib/logger-feedback';
import type { LoggerDisplayUnit } from '@/lib/logger-weight-format.js';
import { formatLoggerWeightDeltaKg, formatLoggerWeightKg, KG_PER_LB } from '@/lib/logger-weight-format.js';
import { SLEasing } from '@/lib/motion';
import { useSLMotionPreviewOverrides } from '@/lib/motion-preview';

export type SessionImpactSummary = {
  summary_id: string;
  workout_id: number;
  status: string;
  canonically_completed: boolean;
  completion_timestamp: string | null;
  title: string;
  date: string | null;
  completed_duration_seconds: number | null;
  completed_set_count: number;
  completed_movement_count: number;
  completed_core_prescription_count: number;
  session_streak: number;
  session_volume_kg: number;
  career_volume_before_kg: number;
  career_volume_after_kg: number;
  career_session_count_before: number;
  career_session_count_after: number;
  all_prescribed_work_logged: boolean;
  accomplishment_count: number;
  highlights: LoggerRecognitionEvent[];
  remaining_highlight_count: number;
  estimated_strength_insights?: LoggerRecognitionEvent[];
  workout_evidence_revision: number;
};

const isEstimatedStrengthInsight = (event: LoggerRecognitionEvent) => event.event_type === 'CORE_E1RM_PR';
const observedSessionHighlights = (events: LoggerRecognitionEvent[], workoutId?: number) =>
  selectSessionHighlights(events, workoutId).filter((event) => !isEstimatedStrengthInsight(event) && event.event_type !== 'CORE_BLOCK_E1RM_BEST');

export function SessionHighlightsPanel({
  events,
  workoutId,
  displayUnit,
  onOpen,
}: {
  events: LoggerRecognitionEvent[];
  workoutId: number;
  displayUnit: LoggerDisplayUnit;
  onOpen?: (count: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const highlights = useMemo(
    () => observedSessionHighlights(events, workoutId),
    [events, workoutId],
  );
  if (!highlights.length) return null;
  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) onOpen?.(highlights.length);
  };
  return (
    <View style={styles.activeHighlightsPanel}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Today's highlights, ${highlights.length}. ${expanded ? 'Collapse' : 'Expand'}`}
        onPress={toggle}
        style={styles.activeHighlightsHeader}
      >
        <View style={styles.flex}>
          <Text style={styles.activeHighlightsTitle}>Today&apos;s highlights · {highlights.length}</Text>
          <Text style={styles.activeHighlightsHint}>{expanded ? 'Hide session evidence' : 'Review session evidence'}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={SLIconSize.standard} color={SLColors.accentViolet} />
      </TouchableOpacity>
      {expanded ? (
        <SLMotionEntrance motionKey={`highlights-${highlights.length}`} distance={SLSpacing.xs}>
          {highlights.map((event) => {
            const presentation = recognitionPresentation(event, displayUnit, 'historical');
            if (!presentation) return null;
            return (
              <View key={event.id} style={styles.activeHighlightRow} accessible accessibilityLabel={presentation.accessibilityLabel}>
                <View style={styles.flex}>
                  <Text typographyRole="movementName" style={styles.highlightName}>{event.movement_label}</Text>
                  <Text style={styles.highlightKind}>{presentation.eyebrow}</Text>
                </View>
                <Text style={styles.highlightValue}>{presentation.value}</Text>
              </View>
            );
          })}
        </SLMotionEntrance>
      ) : null}
    </View>
  );
}

export function SessionImpactPanel({ summary, displayUnit, accomplishmentHistory, reduceMotion = false, animateEntry = false, showSessionTitle = true, playbackRate = 1 }: {
  summary: SessionImpactSummary;
  displayUnit: LoggerDisplayUnit;
  accomplishmentHistory?: { items: LoggerRecognitionEvent[]; has_more: boolean; next_cursor?: string | null; query?: { continuation_token?: string | null } } | null;
  reduceMotion?: boolean;
  animateEntry?: boolean;
  showSessionTitle?: boolean;
  playbackRate?: number;
}) {
  const previewMotion = useSLMotionPreviewOverrides();
  const entranceMs = previewMotion?.entranceMs ?? 420;
  const stateMs = previewMotion?.stateMs ?? 320;
  const spatialMs = previewMotion?.spatialMs ?? 520;
  const holdMs = previewMotion?.phaseDelayMs ?? 720;
  const durationMinutes = summary.completed_duration_seconds == null ? null : Math.max(0, Math.round(summary.completed_duration_seconds / 60));
  const sessionCountDelta = Math.max(0, summary.career_session_count_after - summary.career_session_count_before);
  const ceremonyProgress = useRef(new Animated.Value(animateEntry && !reduceMotion ? 0 : 1)).current;
  const [historicalEvents, setHistoricalEvents] = useState<LoggerRecognitionEvent[]>(observedSessionHighlights(accomplishmentHistory?.items || summary.highlights, summary.workout_id));
  const estimatedStrengthInsights = useMemo(() => {
    const explicit = summary.estimated_strength_insights || [];
    const source = explicit.length ? explicit : selectSessionHighlights(accomplishmentHistory?.items || [], summary.workout_id);
    return source.filter(isEstimatedStrengthInsight);
  }, [accomplishmentHistory?.items, summary.estimated_strength_insights, summary.workout_id]);
  const [nextCursor, setNextCursor] = useState<string | null>(accomplishmentHistory?.next_cursor || null);
  const [hasMore, setHasMore] = useState(Boolean(accomplishmentHistory?.has_more));
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [continuationToken, setContinuationToken] = useState<string | null>(accomplishmentHistory?.query?.continuation_token || null);
  useEffect(() => {
    setHistoricalEvents(observedSessionHighlights(accomplishmentHistory?.items || summary.highlights, summary.workout_id));
    setNextCursor(accomplishmentHistory?.next_cursor || null);
    setHasMore(Boolean(accomplishmentHistory?.has_more));
    setHistoryError(null);
    setContinuationToken(accomplishmentHistory?.query?.continuation_token || null);
  }, [accomplishmentHistory, summary.highlights, summary.workout_id]);
  useEffect(() => {
    ceremonyProgress.stopAnimation();
    if (!animateEntry || reduceMotion) {
      ceremonyProgress.setValue(1);
      return undefined;
    }

    ceremonyProgress.setValue(0);
    const safeStreak = Math.max(1, Math.round(Number(summary.session_streak) || 1));
    AccessibilityInfo.announceForAccessibility(`${safeStreak} session streak. Today's training is entered in your ledger.`);
    const animation = Animated.sequence([
      Animated.timing(ceremonyProgress, {
        toValue: 0.12,
        duration: Math.round(entranceMs / playbackRate),
        easing: SLEasing.enter,
        useNativeDriver: true,
      }),
      Animated.timing(ceremonyProgress, {
        toValue: 0.34,
        duration: Math.round(spatialMs / playbackRate),
        easing: SLEasing.enter,
        useNativeDriver: true,
      }),
      Animated.delay(Math.round(stateMs / playbackRate)),
      Animated.timing(ceremonyProgress, {
        toValue: 0.56,
        duration: Math.round(spatialMs / playbackRate),
        easing: SLEasing.enter,
        useNativeDriver: true,
      }),
      Animated.timing(ceremonyProgress, {
        toValue: 0.66,
        duration: Math.round(stateMs / playbackRate),
        easing: SLEasing.state,
        useNativeDriver: true,
      }),
      Animated.delay(Math.round(holdMs / playbackRate)),
      Animated.timing(ceremonyProgress, {
        toValue: 0.82,
        duration: Math.round(spatialMs / playbackRate),
        easing: SLEasing.exit,
        useNativeDriver: true,
      }),
      Animated.timing(ceremonyProgress, {
        toValue: 1,
        duration: Math.round(spatialMs / playbackRate),
        easing: SLEasing.enter,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animateEntry, ceremonyProgress, entranceMs, holdMs, playbackRate, reduceMotion, spatialMs, stateMs, summary.session_streak, summary.summary_id]);
  const digestOpacity = ceremonyProgress.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });
  const digestTranslate = ceremonyProgress.interpolate({
    inputRange: [0, 0.82, 1],
    outputRange: [SLSpacing.lg, SLSpacing.lg, 0],
    extrapolate: 'clamp',
  });
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setHistoryError(null);
    try {
      const query = new URLSearchParams({ cursor: nextCursor, limit: '50' });
      if (continuationToken) query.set('context_token', continuationToken);
      else query.set('workout_id', String(summary.workout_id));
      const response = await fetchJson(`/workouts/mobile/accomplishments?${query.toString()}`, { method: 'GET' });
      const page: any = response.json?.accomplishment_timeline;
      if (!response.ok || !response.json?.ok || !page) throw new Error(response.json?.error || `HTTP ${response.status}`);
      setHistoricalEvents((current) => observedSessionHighlights([...current, ...(page.items || [])], summary.workout_id));
      setNextCursor(page.next_cursor || null);
      setHasMore(Boolean(page.has_more));
      setContinuationToken(page.query?.continuation_token || continuationToken);
    } catch (error: any) {
      setHistoryError(error?.message || 'Older accomplishments could not load.');
    } finally {
      setLoadingMore(false);
    }
  };
  return (
    <View accessibilityRole="summary" style={styles.sessionPanel}>
      <PostSessionSurface tone="ceremony" style={styles.ceremonySurface}>
        <PostSessionLedgerCeremony
          title={summary.title}
          date={summary.date}
          streak={summary.session_streak}
          durationMinutes={durationMinutes}
          setCount={summary.completed_set_count}
          movementCount={summary.completed_movement_count}
          progress={ceremonyProgress}
          showSessionTitle={showSessionTitle}
        />
      </PostSessionSurface>
      <Animated.View style={[styles.digestEntrance, { opacity: digestOpacity, transform: [{ translateY: digestTranslate }] }]}>
        <PostSessionSurface tone="reflection" contentStyle={styles.digestContent}>
          <View style={styles.digestHeading}>
            <Text style={styles.digestEyebrow}>Entered in your ledger</Text>
            <Text style={styles.accomplishmentTitle}>Today&apos;s highlights</Text>
          </View>
          {historicalEvents.length ? (
            <HistoricalAccomplishmentList
              events={historicalEvents}
              displayUnit={displayUnit}
              title="Personal bests"
              error={historyError}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          ) : summary.all_prescribed_work_logged ? (
            <Text style={styles.assignedWorkComplete}>All assigned work logged</Text>
          ) : null}
          {estimatedStrengthInsights.length ? (
            <EstimatedStrengthInsights events={estimatedStrengthInsights} displayUnit={displayUnit} />
          ) : null}
          {summary.session_volume_kg > 0 ? (
            <ProgressRow
              icon="barbell-outline"
              label="Complete Training Volume"
              value={`${formatVolume(summary.career_volume_before_kg, displayUnit)} → ${formatVolume(summary.career_volume_after_kg, displayUnit)}`}
              detail={`+${formatVolume(summary.session_volume_kg, displayUnit)} this session`}
            />
          ) : null}
          <ProgressRow
            icon="flame-outline"
            label="Training exposure"
            value={`${summary.career_session_count_before} → ${summary.career_session_count_after} sessions`}
            detail={`+${sessionCountDelta} completed ${sessionCountDelta === 1 ? 'session' : 'sessions'}`}
          />
          {!summary.all_prescribed_work_logged ? <Text style={styles.incomplete}>Some prescribed work was left incomplete.</Text> : null}
        </PostSessionSurface>
      </Animated.View>
    </View>
  );
}

function EstimatedStrengthInsights({ events, displayUnit }: { events: LoggerRecognitionEvent[]; displayUnit: LoggerDisplayUnit }) {
  return (
    <View style={styles.estimatedStrengthSection}>
      <Text style={styles.estimatedStrengthTitle}>Estimated strength</Text>
      {events.map((event) => {
        const current = `${formatLoggerWeightKg(event.current_value, displayUnit)} ${displayUnit}`;
        const delta = event.delta == null
          ? null
          : `↑ +${formatLoggerWeightDeltaKg(Math.abs(event.delta), displayUnit)} ${displayUnit}`;
        const label = event.prior_value == null ? 'Estimated 1RM' : 'Estimated 1RM increased';
        return (
          <View
            key={event.id}
            accessible
            accessibilityLabel={[label, event.movement_label, current, delta].filter(Boolean).join('. ')}
            style={styles.estimatedStrengthRow}
          >
            <View style={styles.flex}>
              <Text style={styles.estimatedStrengthLabel}>{label}</Text>
              <Text typographyRole="movementName" style={styles.estimatedStrengthMovement}>{event.movement_label}</Text>
            </View>
            <View style={styles.estimatedStrengthMetric}>
              <Text style={styles.estimatedStrengthValue}>{current}</Text>
              {delta ? <Text style={styles.estimatedStrengthDelta}>{delta}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ProgressRow({ icon, label, value, detail }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; detail: string }) {
  return (
    <SLMotionEntrance motionKey={`${label}-${value}`} distance={SLSpacing.xs}>
      <View style={styles.progressRow}>
        <View style={styles.progressIcon}><Ionicons name={icon} size={SLIconSize.standard} color={SLColors.accentViolet} /></View>
        <View style={styles.flex}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={styles.progressValue}>{value}</Text>
          <Text style={styles.progressDetail}>{detail}</Text>
        </View>
      </View>
    </SLMotionEntrance>
  );
}

function formatVolume(valueKg: number, displayUnit: LoggerDisplayUnit) {
  const value = displayUnit === 'kg' ? Number(valueKg || 0) : Number(valueKg || 0) / KG_PER_LB;
  return `${Math.round(value).toLocaleString()} ${displayUnit}`;
}

const styles = {
  flex: { flex: 1 },
  sessionPanel: { marginHorizontal: 0, marginBottom: SLSpacing.xl },
  ceremonySurface: { ...SLShadows.card },
  digestEntrance: { marginTop: SLSpacing.md },
  digestContent: { paddingHorizontal: SLSpacing.lg, paddingVertical: SLSpacing.lg },
  digestHeading: { borderBottomColor: SLColors.borderSubtle, borderBottomWidth: 1, marginBottom: SLSpacing.sm, paddingBottom: SLSpacing.md },
  digestEyebrow: { ...SLTypography.micro, color: SLColors.success, letterSpacing: 0.8, marginBottom: SLSpacing.xs, textTransform: 'uppercase' as const },
  accomplishmentTitle: { ...SLTypography.sectionTitle, color: SLColors.textStrong },
  assignedWorkComplete: { ...SLTypography.bodyStrong, color: SLColors.success, textTransform: 'uppercase' as const, letterSpacing: 0.5, paddingVertical: SLSpacing.md, borderBottomWidth: 1, borderBottomColor: SLColors.borderSubtle },
  estimatedStrengthSection: { paddingVertical: SLSpacing.md, borderBottomWidth: 1, borderBottomColor: SLColors.borderSubtle },
  estimatedStrengthTitle: { ...SLTypography.sectionLabel, color: SLColors.textMuted, textTransform: 'uppercase' as const, marginBottom: SLSpacing.xs },
  estimatedStrengthRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SLSpacing.md, paddingVertical: SLSpacing.sm },
  estimatedStrengthLabel: { ...SLTypography.label, color: SLColors.textStrong },
  estimatedStrengthMovement: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 2 },
  estimatedStrengthMetric: { alignItems: 'flex-end' as const },
  estimatedStrengthValue: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  estimatedStrengthDelta: { ...SLTypography.caption, color: SLColors.success, marginTop: 2 },
  progressRow: { flexDirection: 'row' as const, gap: SLSpacing.md, paddingVertical: SLSpacing.md, borderBottomWidth: 1, borderBottomColor: SLColors.borderSubtle },
  progressIcon: { width: 36, height: 36, borderRadius: SLRadius.pill, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: SLColors.accentVioletSoft },
  progressLabel: { ...SLTypography.label, color: SLColors.textMuted },
  progressValue: { ...SLTypography.bodyStrong, color: SLColors.textStrong, marginTop: SLSpacing.xs },
  progressDetail: { ...SLTypography.caption, color: SLColors.accentViolet, marginTop: SLSpacing.xs },
  incomplete: { ...SLTypography.caption, color: SLColors.warning, marginTop: SLSpacing.md },
  highlightRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: SLSpacing.sm, borderBottomWidth: 1, borderBottomColor: SLColors.borderSubtle },
  highlightName: { ...SLTypography.label, color: SLColors.textStrong }, highlightKind: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: SLSpacing.xs }, highlightValue: { ...SLTypography.bodyStrong, color: SLColors.accentViolet, marginLeft: SLSpacing.md },
  emptyHighlight: { ...SLTypography.body, color: SLColors.textMuted, marginTop: SLSpacing.md }, remaining: { ...SLTypography.micro, color: SLColors.textSubtle, marginTop: SLSpacing.sm },
  activeHighlightsPanel: { marginHorizontal: 0, marginTop: SLSpacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surfaceEmbedded },
  activeHighlightsHeader: { minHeight: 56, flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: SLSpacing.md, paddingVertical: SLSpacing.sm },
  activeHighlightsTitle: { ...SLTypography.label, color: SLColors.textStrong, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  activeHighlightsHint: { ...SLTypography.micro, color: SLColors.textMuted, marginTop: SLSpacing.xs },
  activeHighlightRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: SLSpacing.md, paddingVertical: SLSpacing.sm, borderTopWidth: 1, borderTopColor: SLColors.borderSubtle },
};
