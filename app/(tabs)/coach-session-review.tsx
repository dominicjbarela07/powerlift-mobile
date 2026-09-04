import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type CoachReviewDraft,
  type CompletedSessionRecapPayload,
} from '@/components/coach-mobile/CompletedSessionRecap';
import { CoachSessionReviewerV3 } from '@/components/coach-mobile/CoachSessionReviewerV3';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies, SLRadius } from '@/constants/theme';
import { fetchJson, getCoachSessionReview, saveCoachSessionReview, type CoachReviewItem } from '@/lib/api';
import {
  movementHistorySheetRoute,
  resolveMovementHistoryLaunchFromMeasurement,
} from '@/lib/movement-history-launch';
import {
  advanceCoachSessionReviewVisit,
  canonicalCoachSessionReviewIdentity,
  coachSessionReviewPresentationKey,
} from '@/lib/coach-session-review-presentation';

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
    scheduled_timezone?: string | null;
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
  const params = useLocalSearchParams<{ workoutId?: string }>();
  const reviewIdentity = canonicalCoachSessionReviewIdentity(params.workoutId);
  const [visitRevision, setVisitRevision] = useState(0);

  return <CoachSessionReviewContent
    key={coachSessionReviewPresentationKey(reviewIdentity, visitRevision)}
    workoutId={reviewIdentity ? Number(reviewIdentity) : Number.NaN}
    onEndVisit={() => setVisitRevision(advanceCoachSessionReviewVisit)}
  />;
}

function CoachSessionReviewContent({ workoutId, onEndVisit }: { workoutId: number; onEndVisit: () => void }) {
  const router = useRouter();
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
      if (refresh) setRefreshing(true);
      else setLoading(true);
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

  const closeReview = useCallback(() => {
    onEndVisit();
    router.back();
  }, [onEndVisit, router]);

  const save = useCallback(async (nextDraft: CoachReviewDraft, action: 'save' | 'complete') => {
    if (saving) return;
    try {
      setSaving(action);
      setError(null);
      setDraft(nextDraft);
      const result = await saveCoachSessionReview(workoutId, { ...nextDraft, action });
      if (!result.ok || !(result.json as any)?.ok) throw new Error((result.json as any)?.error || 'Could not save this review.');
      if (action === 'complete') {
        Alert.alert('Review completed', 'The review is now in history.', [{ text: 'Done', onPress: closeReview }]);
      } else {
        Alert.alert('Draft saved', 'Your review notes were saved.');
        await load(true);
      }
    } catch (caught: any) {
      setError(caught?.message || 'Could not save this review. Your entries have been preserved.');
    } finally {
      setSaving(null);
    }
  }, [closeReview, load, saving, workoutId]);

  const coachReview = useMemo(() => review && review.review_controls?.editable !== false ? {
    draft,
    outcomes: review.review_controls?.outcomes || [],
    priorities: review.review_controls?.priorities || [],
    saving,
    onDraftChange: setDraft,
    onSave: save,
  } : null, [draft, review, save, saving]);

  const recap = detail?.workout?.completed_recap;
  if (recap && review) {
    return <CoachSessionReviewerV3
      recap={recap}
      impactSummary={detail?.workout?.impact_summary}
      preferredUnits={detail?.athlete?.preferred_units}
      sessionTimeZone={detail?.workout?.scheduled_timezone}
      coachReview={coachReview}
      coachReviewUnavailableReason={review.review_controls?.edit_unavailable_reason}
      refreshing={refreshing}
      onRefresh={() => { void load(true); }}
      onClose={closeReview}
      onDone={closeReview}
      onOpenProgramming={() => router.push({ pathname: '/(tabs)/workout', params: { athleteId: String(detail?.athlete?.id || '') } } as never)}
      onOpenMovementHistory={(movement) => {
        const resolution = resolveMovementHistoryLaunchFromMeasurement({
          athleteId: detail?.athlete?.id,
          movementDefinitionId: movement.measurement?.canonical_identity_id,
          identityType: movement.kind,
          equipmentContextDefinitionId: movement.measurement?.equipment_configuration_identity_id,
        });
        if (!resolution.ok) {
          Alert.alert('History unavailable', resolution.message);
          return;
        }
        router.push(movementHistorySheetRoute(resolution.target) as never);
      }}
    />;
  }

  return <SafeAreaView style={styles.stateScreen}><View style={styles.stateCard}>{loading ? <ActivityIndicator color={SLColors.accentMuted} /> : <Ionicons name="alert-circle-outline" size={27} color={SLColors.danger} />}<Text style={styles.stateTitle}>{loading ? 'Loading Session review' : 'Session review unavailable'}</Text>{error ? <Text style={styles.stateBody}>{error}</Text> : null}{!loading ? <Pressable onPress={() => { void load(); }} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryText}>Try Again</Text></Pressable> : null}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  stateScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#020306' },
  stateCard: { width: '100%', maxWidth: 420, alignItems: 'center', padding: 28, borderRadius: SLRadius.xl, borderWidth: 1, borderColor: SLColors.borderStandard, backgroundColor: SLColors.object },
  stateTitle: { marginTop: 12, color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 19 },
  stateBody: { marginTop: 7, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retry: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 11, borderRadius: SLRadius.md, backgroundColor: SLColors.accentViolet },
  retryText: { color: SLColors.white, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 },
  pressed: { opacity: 0.72 },
});
