import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';

import {
  isMajorVolumeMilestoneEvent,
  MajorVolumeMilestoneMark,
} from '@/components/workout-logger/major-volume-milestone-recognition';
import { SLColors, SLIconSize, SLSpacing, SLTypography } from '@/constants/theme';
import { feedbackAnalytics, recognitionPresentation, type LoggerRecognitionEvent } from '@/lib/logger-feedback';
import type { LoggerDisplayUnit } from '@/lib/logger-weight-format.js';

export type AccomplishmentSignal = {
  count: number;
  highest_priority: LoggerRecognitionEvent;
  movement_labels: string[];
};

export type CoreCurrentBest = {
  projection_id: number;
  core_movement_key: string;
  movement_label: string;
  scope: 'career' | 'block' | string;
  training_block_id?: number | null;
  training_block_label?: string | null;
  metric: 'weight' | 'rep_max' | 'rpe' | 'reps' | 'e1rm' | string;
  comparison_bucket?: string | null;
  best_value: number;
  unit?: string | null;
  event: LoggerRecognitionEvent;
};

export function CompactAccomplishmentSignal({ signal, displayUnit }: { signal?: AccomplishmentSignal | null; displayUnit: LoggerDisplayUnit }) {
  const presentation = signal?.highest_priority ? recognitionPresentation(signal.highest_priority, displayUnit, 'historical') : null;
  if (!signal || !presentation) return null;
  return (
    <View accessibilityLabel={`${signal.count} recognized core accomplishments. ${presentation.accessibilityLabel}`} style={styles.compact}>
      <Ionicons name="trending-up-outline" size={SLIconSize.compact} color={SLColors.accentViolet} />
      <Text typographyRole="supportingBody" numberOfLines={1} style={styles.compactText}>
        {signal.count === 1 ? `${signal.highest_priority.movement_label} · ${presentation.eyebrow}` : `${signal.count} recognized core accomplishments`}
      </Text>
    </View>
  );
}

export function CurrentBestList({ items, displayUnit }: { items: CoreCurrentBest[]; displayUnit: LoggerDisplayUnit }) {
  const rows = useMemo(() => items.map((item) => ({ item, presentation: recognitionPresentation(item.event, displayUnit, 'historical') })).filter((row) => row.presentation), [displayUnit, items]);
  useEffect(() => {
    if (rows.length) feedbackAnalytics('current_best_viewed', { count: rows.length });
  }, [rows.length]);
  if (!rows.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Current bests</Text>
      {rows.map(({ item, presentation }) => (
        <View accessibilityLabel={`Current ${presentation!.accessibilityLabel}`} key={item.projection_id} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>{presentation!.eyebrow}</Text>
            <Text style={styles.meta}>{item.scope === 'block' ? `Block best · ${item.training_block_label || 'Specified block'}` : 'Career best'}</Text>
          </View>
          <Text style={styles.value}>{presentation!.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function HistoricalAccomplishmentList({
  events,
  displayUnit,
  title = 'Recognized core accomplishments',
  emptyMessage,
  loading = false,
  error,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onOpenSource,
}: {
  events: LoggerRecognitionEvent[];
  displayUnit: LoggerDisplayUnit;
  title?: string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string | null;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onOpenSource?: (workoutId: number) => void;
}) {
  const rows = useMemo(() => events.map((event) => ({ event, presentation: recognitionPresentation(event, displayUnit, 'historical') })).filter((row) => row.presentation), [displayUnit, events]);
  useEffect(() => {
    if (rows.length) feedbackAnalytics('historical_accomplishment_viewed', { count: rows.length });
    else if (!loading && !error && emptyMessage) feedbackAnalytics('historical_accomplishment_empty', {});
  }, [emptyMessage, error, loading, rows.length]);
  if (loading) return <StateLine text="Loading recognized core accomplishments" />;
  if (error && !rows.length) return <StateLine text={error} danger />;
  if (!rows.length && !emptyMessage) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {rows.length ? rows.map(({ event, presentation }) => {
        const workoutId = Number(event.source?.workout_id || event.workout_id || 0);
        const canOpen = workoutId > 0 && !!onOpenSource;
        const isMajorVolumeMilestone = isMajorVolumeMilestoneEvent(event);
        const content = (
          <>
            {isMajorVolumeMilestone ? (
              <View style={styles.landmarkMark}>
                <MajorVolumeMilestoneMark event={event} displayUnit={displayUnit} />
              </View>
            ) : null}
            <View style={styles.copy}>
              <Text typographyRole="movementName" style={styles.rowTitle}>{event.movement_label}</Text>
              <Text style={styles.meta}>{[presentation!.eyebrow, formatDate(event.workout_date)].filter(Boolean).join(' · ')}</Text>
              {presentation!.detail ? <Text style={styles.detail}>{presentation!.detail}{presentation!.delta ? ` · ${presentation!.delta}` : ''}</Text> : null}
              {(['CORE_REP_MAX_PR', 'CORE_RPE_PR'].includes(event.event_type) || isMajorVolumeMilestone) && presentation!.progression ? <Text style={styles.detail}>{presentation!.progression}</Text> : null}
              {event.event_type === 'CORE_REP_MAX_PR' && Number(event.evidence?.actual_reps) > 0 ? (
                <Text style={styles.detail}>Source set: {presentation!.value} × {Number(event.evidence?.actual_reps)}</Text>
              ) : null}
              {event.event_type === 'CORE_RPE_PR' && presentation!.workload ? (
                <Text style={styles.detail}>Same work: {presentation!.workload}</Text>
              ) : null}
            </View>
            <Text style={styles.value}>{presentation!.value}</Text>
            {canOpen ? <Ionicons name="chevron-forward" size={SLIconSize.compact} color={SLColors.textSubtle} /> : null}
          </>
        );
        return canOpen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${presentation!.accessibilityLabel}. Open source Training Session.`}
            key={event.id}
            onPress={() => {
              feedbackAnalytics('historical_source_workout_opened', { event_id: event.id, workout_id: workoutId });
              onOpenSource!(workoutId);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >{content}</Pressable>
        ) : <View accessibilityLabel={presentation!.accessibilityLabel} key={event.id} style={styles.row}>{content}</View>;
      }) : <Text style={styles.empty}>{emptyMessage}</Text>}
      {error && rows.length ? <Text style={styles.error}>{error}</Text> : null}
      {hasMore && onLoadMore ? (
        <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => { feedbackAnalytics('historical_accomplishment_pagination_requested', { displayed_count: rows.length }); onLoadMore(); }} style={styles.loadMore}>
          {loadingMore ? <ActivityIndicator color={SLColors.accentViolet} /> : <Text style={styles.loadMoreText}>Load more</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

function StateLine({ text, danger = false }: { text: string; danger?: boolean }) {
  return <View style={styles.state}><ActivityIndicator color={danger ? SLColors.danger : SLColors.accentViolet} /><Text style={styles.empty}>{text}</Text></View>;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  section: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: SLColors.borderSubtle, paddingVertical: SLSpacing.md },
  sectionLabel: { ...SLTypography.sectionLabel, color: SLColors.textMuted, textTransform: 'uppercase', marginBottom: SLSpacing.xs },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, borderBottomWidth: 1, borderColor: SLColors.borderSubtle, paddingVertical: SLSpacing.sm },
  copy: { flex: 1, gap: 2 },
  landmarkMark: { height: 52, width: 52 },
  rowTitle: { ...SLTypography.label, color: SLColors.textStrong },
  meta: { ...SLTypography.caption, color: SLColors.textMuted },
  detail: { ...SLTypography.micro, color: SLColors.textSubtle },
  value: { ...SLTypography.bodyStrong, color: SLColors.accentViolet },
  compact: { flexDirection: 'row', alignItems: 'center', gap: SLSpacing.xs, marginTop: SLSpacing.xs },
  compactText: { ...SLTypography.caption, color: SLColors.accentViolet, flex: 1 },
  empty: { ...SLTypography.body, color: SLColors.textMuted, paddingVertical: SLSpacing.sm },
  error: { ...SLTypography.caption, color: SLColors.danger, paddingVertical: SLSpacing.sm },
  state: { flexDirection: 'row', alignItems: 'center', gap: SLSpacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: SLColors.borderSubtle, paddingVertical: SLSpacing.md },
  loadMore: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: SLSpacing.sm },
  loadMoreText: { ...SLTypography.label, color: SLColors.textStrong },
  pressed: { opacity: 0.7 },
});
