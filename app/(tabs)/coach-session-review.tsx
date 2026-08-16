import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CompletedSessionRecap,
  type CoachReviewDraft,
  type CompletedSessionRecapPayload,
} from '@/components/coach-mobile/CompletedSessionRecap';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies, SLRadius } from '@/constants/theme';
import { fetchJson, getCoachSessionReview, saveCoachSessionReview, type CoachReviewItem } from '@/lib/api';

type Option = { value: string; label: string };
type ReviewPayload = {
  ok: boolean;
  item: CoachReviewItem;
  review: {
    privateCoachNote?: string;
    athleteCoachFeedback?: string;
  };
  review_controls: {
    editable?: boolean;
    edit_unavailable_reason?: string | null;
    outcomes: Option[];
    priorities: Option[];
    outcome?: string | null;
    priority?: string | null;
    followup_adjust_programming?: boolean;
    followup_message_athlete?: boolean;
    followup_consider_tm?: boolean;
    followup_monitor_next?: boolean;
  };
};

type DetailPayload = {
  ok: boolean;
  athlete?: { id?: number; name?: string; preferred_units?: string };
  workout?: {
    impact_summary?: Record<string, any> | null;
    completed_recap?: CompletedSessionRecapPayload | null;
  };
};

const emptyDraft: CoachReviewDraft = {
  coach_feedback: '',
  coach_note: '',
  review_outcome: '',
  review_priority: '',
  followup_adjust_programming: false,
  followup_message_athlete: false,
  followup_consider_tm: false,
  followup_monitor_next: false,
  send_feedback_message: false,
};

function draftFromReview(payload: ReviewPayload): CoachReviewDraft {
  return {
    coach_feedback: payload.review?.athleteCoachFeedback || '',
    coach_note: payload.review?.privateCoachNote || '',
    review_outcome: payload.review_controls?.outcome || '',
    review_priority: payload.review_controls?.priority || '',
    followup_adjust_programming: !!payload.review_controls?.followup_adjust_programming,
    followup_message_athlete: !!payload.review_controls?.followup_message_athlete,
    followup_consider_tm: !!payload.review_controls?.followup_consider_tm,
    followup_monitor_next: !!payload.review_controls?.followup_monitor_next,
    send_feedback_message: false,
  };
}

export default function CoachSessionReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutId?: string }>();
  const workoutId = Number(params.workoutId);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [draft, setDraft] = useState<CoachReviewDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<'save' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!Number.isFinite(workoutId) || workoutId <= 0) {
      setError('This Session review link is invalid.');
      setLoading(false);
      return;
    }
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const [detailResult, reviewResult] = await Promise.all([
        fetchJson<DetailPayload>(`/workouts/mobile/${workoutId}?view=coach-preview`, { method: 'GET', auth: true }),
        getCoachSessionReview(workoutId),
      ]);
      const nextDetail = detailResult.json as DetailPayload | null;
      const nextReview = reviewResult.json as ReviewPayload | null;
      if (!detailResult.ok || !nextDetail?.ok || !nextDetail.workout?.completed_recap) {
        if (detailResult.status === 401) router.replace('/login');
        throw new Error((detailResult.json as any)?.error || 'The completed Session record is unavailable.');
      }
      if (!reviewResult.ok || !nextReview?.ok) {
        if (reviewResult.status === 401) router.replace('/login');
        throw new Error((reviewResult.json as any)?.error || 'Coach review controls are unavailable.');
      }
      setDetail(nextDetail);
      setReview(nextReview);
      setDraft(draftFromReview(nextReview));
    } catch (caught: any) {
      setError(caught?.message || 'Could not load this Session review.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, workoutId]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (nextDraft: CoachReviewDraft, action: 'save' | 'complete') => {
    if (saving) return;
    try {
      setSaving(action);
      setError(null);
      setDraft(nextDraft);
      const result = await saveCoachSessionReview(workoutId, { ...nextDraft, action });
      if (!result.ok || !(result.json as any)?.ok) throw new Error((result.json as any)?.error || 'Could not save this review.');
      if (action === 'complete') {
        Alert.alert('Review completed', 'The review is now in history.', [{ text: 'Done', onPress: () => router.back() }]);
      } else {
        Alert.alert('Draft saved', 'Your review notes were saved.');
        await load(true);
      }
    } catch (caught: any) {
      setError(caught?.message || 'Could not save this review. Your entries have been preserved.');
    } finally {
      setSaving(null);
    }
  }, [load, router, saving, workoutId]);

  const coachReview = useMemo(() => review && review.review_controls?.editable !== false ? {
    draft,
    outcomes: review.review_controls?.outcomes || [],
    priorities: review.review_controls?.priorities || [],
    saving,
    onSave: save,
  } : null, [draft, review, save, saving]);

  const recap = detail?.workout?.completed_recap;
  if (recap && review) {
    return <CompletedSessionRecap
      recap={recap}
      impactSummary={detail?.workout?.impact_summary}
      preferredUnits={detail?.athlete?.preferred_units}
      viewerMode="coach"
      coachReview={coachReview}
      coachReviewUnavailableReason={review.review_controls?.edit_unavailable_reason}
      refreshing={refreshing}
      onRefresh={() => { void load(true); }}
      onClose={() => router.back()}
      onDone={() => router.back()}
      onViewCalendar={() => router.push({ pathname: '/(tabs)/coach-calendar', params: { athleteId: String(detail?.athlete?.id || '') } } as any)}
      onOpenProgramming={() => router.push({ pathname: '/(tabs)/workout', params: { athleteId: String(detail?.athlete?.id || ''), athleteName: detail?.athlete?.name || '' } } as any)}
    />;
  }

  return <SafeAreaView style={styles.screen}><View style={styles.stateCard}>{loading ? <ActivityIndicator color={SLColors.accentMuted} /> : <Ionicons name="alert-circle-outline" size={27} color={SLColors.danger} />}<Text style={styles.stateTitle}>{loading ? 'Loading Session review' : 'Session review unavailable'}</Text>{error ? <Text style={styles.stateBody}>{error}</Text> : null}{!loading ? <Pressable onPress={() => { void load(); }} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryText}>Try Again</Text></Pressable> : null}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#020306' },
  stateCard: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 28, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.object },
  stateTitle: { marginTop: 12, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 19 },
  stateBody: { marginTop: 7, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retry: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 11, borderRadius: SLRadius.md, backgroundColor: SLColors.accentViolet },
  retryText: { color: SLColors.white, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 },
  pressed: { opacity: 0.72 },
});
