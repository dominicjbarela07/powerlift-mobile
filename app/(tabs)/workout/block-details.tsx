import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { fetchJson } from '@/lib/api';
import { simplifyMobileMovementList } from '@/lib/mobileMovementNames';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';

type HubSession = {
  id: number;
  title?: string | null;
  label?: string | null;
  date?: string | null;
  kind?: string | null;
  status?: string | null;
  focus?: { primary?: string[]; core_count?: number | null; accessory_count?: number | null } | null;
};

type BlockDetailsPayload = {
  block?: {
    name?: string | null;
    week_label?: string | null;
    phase?: string | null;
    date_range_label?: string | null;
    progress?: { completed?: number | null; total?: number | null; percent?: number | null } | null;
    cadence?: { this_week_completed?: number | null; this_week_total?: number | null; this_week_missed?: number | null } | null;
  } | null;
  summary?: { total?: number | null; completed?: number | null; upcoming?: number | null; missed?: number | null } | null;
  weeks?: { week: number; label?: string | null; sessions?: HubSession[] }[];
};

const colors = {
  text: SLColors.text,
  textStrong: SLColors.textStrong,
  muted: SLColors.textMuted,
  subtle: SLColors.textSubtle,
  line: 'rgba(205, 194, 176, 0.095)',
  lineSoft: 'rgba(205, 194, 176, 0.055)',
  surface: 'rgba(10, 11, 11, 0.24)',
  violet: SLColors.accentViolet,
  green: SLColors.railSuccess,
  amber: SLColors.railWarning,
  red: SLColors.railDanger,
};

export default function BlockDetailsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<BlockDetailsPayload | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const resp = await fetchJson('/workouts/mobile/training-hub/block-details', { method: 'GET' });
      const json: any = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setDetails(json.block_details || null);
    } catch (err: any) {
      setError(err?.message || 'Block details could not load.');
      setDetails(null);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const block = details?.block || null;
  const progress = Math.max(0, Math.min(1, Number(block?.progress?.percent || 0)));

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.muted} />}
      >
        <ReturnControl onPress={() => router.push('/(tabs)/workout' as any)} />
        <Header title="Block Details" />
        {loading ? <StateLine title="Loading block" /> : error ? <StateLine title={error} tone="danger" /> : !block ? (
          <Text style={styles.quietLine}>No active block.</Text>
        ) : (
          <>
            <View style={styles.anchor}>
              <View style={styles.anchorRail} />
              <View style={styles.anchorBody}>
                <Text style={styles.kicker}>Current Block</Text>
                <Text style={styles.blockName}>{block.name || 'Training Block'}</Text>
                <Text style={styles.meta}>{[block.week_label || block.phase, block.date_range_label].filter(Boolean).join(' / ')}</Text>
                <View style={styles.progressLine}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={styles.meta}>{Number(block.progress?.completed || 0)}/{Number(block.progress?.total || 0)} complete</Text>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <Summary label="Total" value={details?.summary?.total || 0} />
              <Summary label="Done" value={details?.summary?.completed || 0} />
              <Summary label="Next" value={details?.summary?.upcoming || 0} />
              <Summary label="Missed" value={details?.summary?.missed || 0} />
            </View>
            {(details?.weeks || []).map((week) => (
              <View key={week.week} style={styles.weekGroup}>
                <Text style={styles.kicker}>{week.label || `Week ${week.week}`}</Text>
                <View style={styles.list}>
                  {(week.sessions || []).map((session) => (
                    <SessionRow key={session.id} session={session} onPress={() => router.push({ pathname: '/workout/[workoutId]', params: { workoutId: String(session.id) } })} />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ReturnControl({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.returnControl, pressed && styles.pressed]} onPress={onPress}>
      <Ionicons name="arrow-back" size={15} color={colors.muted} />
      <Text style={styles.returnText}>Return to Training Hub</Text>
    </Pressable>
  );
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function StateLine({ title, tone }: { title: string; tone?: 'danger' }) {
  return (
    <View style={styles.stateLine}>
      {tone ? <Ionicons name="alert-circle-outline" size={18} color={colors.red} /> : <ActivityIndicator color={colors.violet} />}
      <Text style={styles.stateText}>{title}</Text>
    </View>
  );
}

function Summary({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value ?? 0}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SessionRow({ session, onPress }: { session: HubSession; onPress: () => void }) {
  const tone = toneForKind(session.kind || session.status);
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.rowRail, { backgroundColor: tone }]} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>{session.title || session.label || 'Training Session'}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{[formatShortDate(session.date), focusLine(session.focus)].filter(Boolean).join(' / ')}</Text>
      </View>
      <Text style={[styles.status, { color: tone }]}>{labelForKind(session.kind || session.status)}</Text>
    </Pressable>
  );
}

function focusLine(focus?: HubSession['focus']) {
  const primary = simplifyMobileMovementList(focus?.primary);
  return primary.join(' / ');
}

function toneForKind(value?: string | null) {
  const kind = (value || '').toLowerCase();
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return colors.green;
  if (kind === 'today' || kind === 'in_progress') return colors.violet;
  if (kind === 'missed' || kind === 'past_due' || kind === 'incomplete') return colors.red;
  return colors.amber;
}

function labelForKind(value?: string | null) {
  const kind = (value || '').toLowerCase();
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return 'Complete';
  if (kind === 'today') return 'Today';
  if (kind === 'in_progress') return 'In progress';
  if (kind === 'missed') return 'Missed';
  if (kind === 'incomplete') return 'Incomplete';
  if (kind === 'past_due') return 'Past due';
  return 'Upcoming';
}

function formatShortDate(value?: string | null) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  scrollView: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingTop: 16, paddingBottom: 36, gap: 24 },
  header: { paddingTop: 2 },
  title: { fontFamily: SLFontFamilies.sansBold, fontSize: 28, lineHeight: 34, color: colors.textStrong, letterSpacing: 0 },
  returnControl: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderLeftWidth: 2, borderLeftColor: colors.violet, backgroundColor: 'rgba(10, 11, 11, 0.22)', paddingVertical: 8, paddingHorizontal: 10 },
  returnText: { ...SLTypography.label, color: colors.muted },
  kicker: { ...SLTypography.label, color: colors.subtle, textTransform: 'uppercase' },
  anchor: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  anchorRail: { width: 3, backgroundColor: colors.violet },
  anchorBody: { flex: 1, paddingVertical: 20, paddingLeft: 16, gap: 10 },
  blockName: { fontFamily: SLFontFamilies.sansBold, fontSize: 24, lineHeight: 30, color: colors.textStrong, letterSpacing: 0 },
  meta: { ...SLTypography.caption, color: colors.muted },
  progressLine: { height: 2, backgroundColor: colors.lineSoft, overflow: 'hidden' },
  progressFill: { height: 2, backgroundColor: colors.violet },
  summaryRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft },
  summaryItem: { flex: 1, paddingVertical: 12, gap: 3 },
  summaryValue: { fontFamily: SLFontFamilies.monoSemiBold, fontSize: 18, color: colors.textStrong },
  summaryLabel: { ...SLTypography.caption, color: colors.subtle },
  weekGroup: { gap: 10 },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: colors.lineSoft, backgroundColor: 'rgba(10, 11, 11, 0.16)', paddingVertical: 11 },
  rowRail: { width: 2, alignSelf: 'stretch' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { ...SLTypography.body, color: colors.textStrong },
  rowMeta: { ...SLTypography.caption, color: colors.muted },
  status: { ...SLTypography.label },
  quietLine: { ...SLTypography.body, color: colors.subtle, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft, paddingVertical: 14 },
  stateLine: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 16 },
  stateText: { ...SLTypography.body, color: colors.muted },
  pressed: { opacity: 0.72 },
});
