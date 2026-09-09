import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { Text } from '@/components/ui/sl-text';
import { SLLayout, SLRadius, SLSpacing } from '@/constants/theme';
import {
  getCoachReviewHistory,
  getCoachReviewQueue,
  type CoachReviewItem,
} from '@/lib/api';
import { formatCoachRelativeDate } from '@/lib/coach-mobile-v2';

import { useCoachAthleteWorkspace } from './CoachAthleteWorkspaceContext';

type ReviewRow = CoachReviewItem | {
  key: string;
  review_type: 'check_in';
  source_id: number;
  athlete_id: number;
  athlete_name: string;
  title: string;
  submitted_at?: string | null;
  status: string;
  needs_followup?: boolean;
  summary?: string | null;
};

export function CoachAthleteReviews() {
  const router = useRouter();
  const workspace = useCoachAthleteWorkspace();
  const { bootstrap, reviewState, setReviewState } = workspace;
  const [queue, setQueue] = useState<CoachReviewItem[]>([]);
  const [history, setHistory] = useState<CoachReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSequenceRef = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!bootstrap) return;
    const sequence = ++loadSequenceRef.current;
    const isCurrent = () => !signal?.aborted && loadSequenceRef.current === sequence;
    setLoading(true);
    setError(null);
    try {
      const [queueResponse, historyResponse] = await Promise.all([
        getCoachReviewQueue({ athlete_id: bootstrap.athlete.id, per_page: 100 }, signal),
        getCoachReviewHistory({ athlete_id: bootstrap.athlete.id, per_page: 100 }, signal),
      ]);
      if (!isCurrent()) return;
      const queuePayload = queueResponse.json as any;
      const historyPayload = historyResponse.json as any;
      if (!queueResponse.ok || !queuePayload?.ok) throw new Error(queuePayload?.error || 'Review queue is unavailable.');
      if (!historyResponse.ok || !historyPayload?.ok) throw new Error(historyPayload?.error || 'Review history is unavailable.');
      const nextQueue = (queuePayload.items || []).filter((item: CoachReviewItem) => Number(item.athlete_id) === bootstrap.athlete.id);
      const nextHistory = (historyPayload.items || []).filter((item: CoachReviewItem) => Number(item.athlete_id) === bootstrap.athlete.id);
      setQueue(nextQueue);
      setHistory(nextHistory);
    } catch (caught: any) {
      if (isCurrent() && caught?.name !== 'AbortError') setError(caught?.message || 'Athlete reviews could not be loaded.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [bootstrap?.subject.subject_key]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]));

  const checkIns = useMemo<ReviewRow[]>(() => (bootstrap?.check_ins.items || []).map((item) => ({
    key: `check-in-${item.submission_id}`,
    review_type: 'check_in',
    source_id: item.submission_id,
    athlete_id: bootstrap?.athlete.id || 0,
    athlete_name: bootstrap?.athlete.name || 'Athlete',
    title: item.title,
    submitted_at: item.submitted_at,
    status: 'pending',
    summary: 'Submitted athlete Check-In',
  })), [bootstrap]);
  const rows = useMemo<ReviewRow[]>(() => {
    if (reviewState.segment === 'history') return history;
    if (reviewState.segment === 'followup') return queue.filter((item) => item.needs_followup);
    return [...queue, ...checkIns].sort((a, b) => String(a.submitted_at || '').localeCompare(String(b.submitted_at || '')));
  }, [checkIns, history, queue, reviewState.segment]);

  React.useEffect(() => {
    setReviewState((current) => ({
      ...current,
      itemKeys: rows.map((row) => row.key),
      position: Math.min(current.position, Math.max(0, rows.length - 1)),
    }));
  }, [rows.map((row) => row.key).join('|')]);

  if (!bootstrap) return null;
  const basePath = `/(tabs)/coach-athlete/${bootstrap.athlete.id}`;

  const openRow = (row: ReviewRow, index: number) => {
    setReviewState((current) => ({ ...current, itemKeys: rows.map((item) => item.key), position: index }));
    const returnParams = {
      athleteId: String(bootstrap.athlete.id),
      returnToWorkspace: '1',
      workspaceReturn: 'reviews',
      workspaceSubjectKey: workspace.subjectKey,
      reviewSegment: reviewState.segment,
      queuePosition: String(index),
    };
    if (row.review_type === 'session') {
      router.push({ pathname: '/(tabs)/coach-session-review', params: { ...returnParams, workoutId: String(row.source_id) } } as any);
    } else if (row.review_type === 'video') {
      router.push({ pathname: '/(tabs)/coach-video-review', params: { ...returnParams, videoId: String(row.source_id) } } as any);
    } else {
      router.push({ pathname: '/(tabs)/check-ins', params: { ...returnParams, submissionId: String(row.source_id) } } as any);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.intro}>
        <Text style={styles.kicker}>ATHLETE REVIEWS</Text>
        <Text style={styles.title}>One athlete. One queue.</Text>
        <Text style={styles.subtitle}>Session, video, and Check-In decisions without returning to the team hub.</Text>
      </View>
      <View style={styles.segmented}>
        <Segment label={`To Review ${queue.length + checkIns.length}`} selected={reviewState.segment === 'queue'} onPress={() => setReviewState((current) => ({ ...current, segment: 'queue', position: 0 }))} />
        <Segment label={`Follow-up ${queue.filter((item) => item.needs_followup).length}`} selected={reviewState.segment === 'followup'} onPress={() => setReviewState((current) => ({ ...current, segment: 'followup', position: 0 }))} />
        <Segment label="History" selected={reviewState.segment === 'history'} onPress={() => setReviewState((current) => ({ ...current, segment: 'history', position: 0 }))} />
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        contentOffset={{ x: 0, y: reviewState.scrollY }}
        onScroll={(event) => {
          const nextScrollY = event.nativeEvent.contentOffset.y;
          setReviewState((current) => ({ ...current, scrollY: nextScrollY }));
        }}
        scrollEventThrottle={180}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <View style={styles.state}><ActivityIndicator color={COACH_V2.violetBright} /><Text style={styles.stateText}>Loading athlete review queue…</Text></View> : error ? <Pressable onPress={() => void load()} style={styles.state}><Ionicons color={COACH_V2.magenta} name="warning-outline" size={21} /><View style={styles.flex}><Text style={styles.stateTitle}>{error}</Text><Text style={styles.stateText}>Tap to try again.</Text></View></Pressable> : !rows.length ? <View style={styles.state}><Ionicons color={COACH_V2.green} name="checkmark-done-circle-outline" size={24} /><View style={styles.flex}><Text style={styles.stateTitle}>{reviewState.segment === 'history' ? 'No review history yet' : 'Queue clear'}</Text><Text style={styles.stateText}>No governed item is present in this athlete scope.</Text></View></View> : rows.map((row, index) => <ReviewItem key={row.key} row={row} onPress={() => openRow(row, index)} />)}
        <Pressable onPress={() => router.push(`${basePath}/brief` as any)} style={styles.backToBrief}><Text style={styles.backToBriefText}>Return to athlete Brief</Text></Pressable>
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.segment, selected && styles.segmentActive]}><Text numberOfLines={1} style={[styles.segmentText, selected && styles.segmentTextActive]}>{label}</Text></Pressable>;
}

function ReviewItem({ row, onPress }: { row: ReviewRow; onPress: () => void }) {
  const icon = row.review_type === 'session' ? 'barbell-outline' : row.review_type === 'video' ? 'videocam-outline' : 'clipboard-outline';
  const tone = row.needs_followup ? COACH_V2.gold : row.review_type === 'video' ? COACH_V2.magenta : row.review_type === 'check_in' ? COACH_V2.cyan : COACH_V2.violetBright;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View style={[styles.itemIcon, { backgroundColor: `${tone}16` }]}><Ionicons color={tone} name={icon} size={21} /></View>
      <View style={styles.flex}>
        <View style={styles.itemTop}><Text style={[styles.itemKind, { color: tone }]}>{row.review_type.replace('_', ' ').toUpperCase()}</Text>{row.needs_followup ? <Text style={styles.followup}>FOLLOW-UP</Text> : null}</View>
        <Text numberOfLines={1} style={styles.itemTitle}>{row.title}</Text>
        <Text numberOfLines={2} style={styles.itemSummary}>{row.summary || ('actual' in row ? row.actual : null) || 'Open review evidence'}</Text>
        <Text style={styles.itemDate}>{row.submitted_at ? formatCoachRelativeDate(row.submitted_at) : (row as CoachReviewItem).reviewed_at ? formatCoachRelativeDate((row as CoachReviewItem).reviewed_at) : (row as CoachReviewItem).date || 'Date unavailable'}</Text>
      </View>
      <Ionicons color={COACH_V2.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  intro: { paddingHorizontal: SLLayout.screenGutter, paddingTop: SLSpacing.md },
  kicker: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: COACH_V2.text, fontSize: 27, fontWeight: '800', marginTop: 4 },
  subtitle: { color: COACH_V2.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  segmented: { backgroundColor: COACH_V2.surface, borderColor: COACH_V2.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 4, marginHorizontal: SLLayout.screenGutter, marginTop: 15, padding: 4 },
  segment: { alignItems: 'center', borderRadius: 10, flex: 1, justifyContent: 'center', minHeight: 37, paddingHorizontal: 6 },
  segmentActive: { backgroundColor: 'rgba(157,92,255,0.24)' },
  segmentText: { color: COACH_V2.muted, fontSize: 11, fontWeight: '800' },
  segmentTextActive: { color: COACH_V2.text },
  list: { gap: 9, padding: SLLayout.screenGutter, paddingBottom: 96 },
  item: { alignItems: 'center', backgroundColor: COACH_V2.surface, borderColor: COACH_V2.border, borderRadius: SLRadius.md, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 94, padding: 13 },
  itemIcon: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  flex: { flex: 1, minWidth: 0 },
  itemTop: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  itemKind: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  followup: { backgroundColor: 'rgba(243,184,62,0.12)', borderRadius: 999, color: COACH_V2.gold, fontSize: 8, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3 },
  itemTitle: { color: COACH_V2.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  itemSummary: { color: COACH_V2.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  itemDate: { color: COACH_V2.subtle, fontSize: 10, marginTop: 5 },
  state: { alignItems: 'center', backgroundColor: COACH_V2.surface, borderColor: COACH_V2.border, borderRadius: SLRadius.md, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 86, padding: 15 },
  stateTitle: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  stateText: { color: COACH_V2.muted, fontSize: 12, marginTop: 3 },
  pressed: { opacity: 0.72 },
  backToBrief: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  backToBriefText: { color: COACH_V2.violetBright, fontSize: 13, fontWeight: '800' },
  bottomSpace: { height: SLSpacing.xl },
});
