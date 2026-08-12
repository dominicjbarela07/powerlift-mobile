import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import RefreshScreen from '@/components/refresh-screen';
import { ReviewFilterRow } from '@/components/reviews/review-filter-row';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import { getCoachSessionReview, saveCoachSessionReview, type CoachReviewItem } from '@/lib/api';

type Option = { value: string; label: string };
type Row = { label: string; value: string };
type SetRow = { movement?: string; set?: string; load?: string; reps?: string; rpe?: string };
type SessionReview = {
  title?: string;
  date?: string;
  athlete?: string;
  status?: string;
  reviewStatus?: string;
  athleteInput?: Row[];
  context?: Row[];
  prescription?: Array<Record<string, unknown>>;
  execution?: {
    sets?: SetRow[];
    completion?: string;
    deviations?: unknown[];
    missedWork?: unknown[];
  };
  feedback?: Row[];
  privateCoachNote?: string;
  athleteCoachFeedback?: string;
};
type Payload = {
  ok: boolean;
  item: CoachReviewItem;
  review: SessionReview;
  review_controls: {
    outcomes: Option[];
    priorities: Option[];
    outcome?: string | null;
    priority?: string | null;
    followup_adjust_programming?: boolean;
    followup_message_athlete?: boolean;
    followup_consider_tm?: boolean;
    followup_monitor_next?: boolean;
  };
  readiness?: Record<string, number | string | null> | null;
};

function EvidenceRows({ rows }: { rows?: Row[] }) {
  if (!rows?.length) return null;
  return (
    <View style={styles.evidenceRows}>
      {rows.map((row) => (
        <View key={`${row.label}-${row.value}`} style={styles.evidenceRow}>
          <Text style={styles.evidenceLabel}>{row.label}</Text>
          <Text style={styles.evidenceValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: SLColors.borderStandard, true: SLColors.accentSoft }}
        thumbColor={value ? SLColors.accentViolet : SLColors.textMuted}
      />
    </View>
  );
}

export default function CoachSessionReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ workoutId?: string }>();
  const workoutId = Number(params.workoutId);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'save' | 'complete' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [outcome, setOutcome] = useState('');
  const [priority, setPriority] = useState('');
  const [adjustProgramming, setAdjustProgramming] = useState(false);
  const [messageAthlete, setMessageAthlete] = useState(false);
  const [considerTm, setConsiderTm] = useState(false);
  const [monitorNext, setMonitorNext] = useState(false);
  const [sendMessage, setSendMessage] = useState(false);

  const hydrate = useCallback((next: Payload) => {
    setPayload(next);
    setFeedback(next.review?.athleteCoachFeedback || '');
    setPrivateNote(next.review?.privateCoachNote || '');
    setOutcome(next.review_controls?.outcome || '');
    setPriority(next.review_controls?.priority || '');
    setAdjustProgramming(!!next.review_controls?.followup_adjust_programming);
    setMessageAthlete(!!next.review_controls?.followup_message_athlete);
    setConsiderTm(!!next.review_controls?.followup_consider_tm);
    setMonitorNext(!!next.review_controls?.followup_monitor_next);
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (!Number.isFinite(workoutId) || workoutId <= 0) {
      setError('This Session review link is invalid.');
      setLoading(false);
      return;
    }
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      const res = await getCoachSessionReview(workoutId);
      const next = res.json as Payload | null;
      if (!res.ok || !next?.ok) {
        if (res.status === 401) router.replace('/login');
        throw new Error((res.json as any)?.error || 'Could not load this Session review.');
      }
      hydrate(next);
    } catch (caught: any) {
      setError(caught?.message || 'Could not load this Session review.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hydrate, router, workoutId]);

  useEffect(() => { load(); }, [load]);

  const submission = useMemo(() => ({
    coach_feedback: feedback,
    coach_note: privateNote,
    review_outcome: outcome,
    review_priority: priority,
    followup_adjust_programming: adjustProgramming,
    followup_message_athlete: messageAthlete,
    followup_consider_tm: considerTm,
    followup_monitor_next: monitorNext,
    send_feedback_message: sendMessage,
  }), [adjustProgramming, considerTm, feedback, messageAthlete, monitorNext, outcome, priority, privateNote, sendMessage]);

  const submit = useCallback(async (action: 'save' | 'complete') => {
    if (saving) return;
    try {
      setSaving(action);
      setError(null);
      const res = await saveCoachSessionReview(workoutId, { ...submission, action });
      const next = res.json as any;
      if (!res.ok || !next?.ok) throw new Error(next?.error || 'Could not save this review.');
      if (action === 'complete') {
        Alert.alert('Review completed', 'This Session is now part of review history.', [
          { text: 'Done', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Draft saved', 'Your review notes were saved.');
      }
    } catch (caught: any) {
      setError(caught?.message || 'Could not save this review. Your entries have been preserved.');
    } finally {
      setSaving(null);
    }
  }, [router, saving, submission, workoutId]);

  const review = payload?.review;
  const sets = review?.execution?.sets || [];

  return (
    <RefreshScreen
      refreshing={refreshing}
      onRefresh={() => load(true)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.screen}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Back to Review Hub">
          <Ionicons name="chevron-back" size={22} color={SLColors.textStrong} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Session Review</Text>
          <Text style={styles.title}>{review?.title || payload?.item?.title || 'Session'}</Text>
          <Text style={styles.subtitle}>{review?.athlete || payload?.item?.athlete_name} · {review?.date || payload?.item?.date}</Text>
        </View>
      </View>

      {loading && !payload ? <View style={styles.center}><ActivityIndicator color={SLColors.accentViolet} /></View> : null}
      {error ? (
        <Pressable onPress={() => load()} style={styles.error}>
          <Ionicons name="alert-circle-outline" size={22} color={SLColors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      ) : null}

      {payload ? (
        <>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Athlete Context</Text>
            <EvidenceRows rows={review?.athleteInput} />
            <EvidenceRows rows={review?.feedback?.filter((row) => row.label !== 'Coach Feedback')} />
            {payload.readiness ? (
              <View style={styles.readinessRow}>
                {Object.entries(payload.readiness).filter(([, value]) => value != null).map(([key, value]) => (
                  <View key={key} style={styles.metric}>
                    <Text style={styles.metricLabel}>{key.replaceAll('_', ' ')}</Text>
                    <Text style={styles.metricValue}>{String(value)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Execution Evidence</Text>
            {review?.execution?.completion ? <Text style={styles.completion}>{review.execution.completion}</Text> : null}
            {sets.length ? sets.map((set, index) => (
              <View key={`${set.movement}-${set.set}-${index}`} style={styles.setRow}>
                <View style={styles.setCopy}>
                  <Text style={styles.setMovement}>{set.movement || 'Movement'}</Text>
                  <Text style={styles.setMeta}>{set.set || `Set ${index + 1}`}</Text>
                </View>
                <Text style={styles.setActual}>{[set.load, set.reps, set.rpe].filter(Boolean).join(' ') || 'No logged result'}</Text>
              </View>
            )) : <Text style={styles.muted}>No logged sets were captured.</Text>}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Coach Review</Text>
            <Text style={styles.fieldLabel}>Athlete Feedback</Text>
            <TextInput
              accessibilityLabel="Athlete feedback"
              multiline
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Write clear feedback the athlete can act on..."
              placeholderTextColor={SLColors.textSubtle}
              style={styles.textarea}
            />
            <Text style={styles.fieldLabel}>Private Coach Note</Text>
            <TextInput
              accessibilityLabel="Private coach note"
              multiline
              value={privateNote}
              onChangeText={setPrivateNote}
              placeholder="Private interpretation and programming context..."
              placeholderTextColor={SLColors.textSubtle}
              style={styles.textarea}
            />
            <Text style={styles.fieldLabel}>Outcome</Text>
            <ReviewFilterRow
              options={[{ value: '', label: 'Not set' }, ...(payload.review_controls?.outcomes || [])]}
              selected={outcome}
              onSelect={setOutcome}
              accessibilityLabel="Review outcome"
            />
            <Text style={styles.fieldLabel}>Priority</Text>
            <ReviewFilterRow
              options={[{ value: '', label: 'Not set' }, ...(payload.review_controls?.priorities || [])]}
              selected={priority}
              onSelect={setPriority}
              accessibilityLabel="Review priority"
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Follow-Up</Text>
            <ToggleRow label="Adjust programming" value={adjustProgramming} onChange={setAdjustProgramming} />
            <ToggleRow label="Message athlete" value={messageAthlete} onChange={setMessageAthlete} />
            <ToggleRow label="Consider TM update" value={considerTm} onChange={setConsiderTm} />
            <ToggleRow label="Monitor next Session" value={monitorNext} onChange={setMonitorNext} />
            <ToggleRow label="Send feedback as a message" value={sendMessage} onChange={setSendMessage} />
          </View>

          <View style={styles.actions}>
            <Pressable
              disabled={Boolean(saving)}
              onPress={() => submit('save')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryButtonText}>{saving === 'save' ? 'Saving…' : 'Save Draft'}</Text>
            </Pressable>
            <Pressable
              disabled={Boolean(saving)}
              onPress={() => submit('complete')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Ionicons name="checkmark" size={21} color={SLColors.white} />
              <Text style={styles.primaryButtonText}>{saving === 'complete' ? 'Completing…' : 'Complete Review'}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </RefreshScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: SLSpacing.md, padding: SLSpacing.lg, paddingBottom: 130 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: SLSpacing.sm },
  backButton: {
    alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.md, borderWidth: 1, height: 42, justifyContent: 'center', width: 42,
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: SLColors.accentMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: SLColors.textStrong, fontSize: 27, fontWeight: '800', marginTop: 3 },
  subtitle: { color: SLColors.textMuted, fontSize: 15, marginTop: 4 },
  center: { alignItems: 'center', minHeight: 180, justifyContent: 'center' },
  error: {
    alignItems: 'center', backgroundColor: SLColors.dangerSoft, borderColor: SLColors.danger,
    borderRadius: SLRadius.md, borderWidth: 1, flexDirection: 'row', gap: 8, padding: SLSpacing.md,
  },
  errorText: { color: SLColors.danger, flex: 1, fontSize: 14 },
  sectionCard: {
    backgroundColor: SLColors.object, borderColor: SLColors.borderStandard, borderRadius: SLRadius.lg,
    borderWidth: 1, gap: SLSpacing.sm, padding: SLSpacing.md,
  },
  sectionTitle: { color: SLColors.textStrong, fontSize: 19, fontWeight: '800' },
  evidenceRows: { gap: 8 },
  evidenceRow: { borderTopColor: SLColors.shellHairline, borderTopWidth: 1, gap: 4, paddingTop: 8 },
  evidenceLabel: { color: SLColors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  evidenceValue: { color: SLColors.textStrong, fontSize: 16, lineHeight: 22 },
  readinessRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { backgroundColor: SLColors.surfaceInset, borderRadius: SLRadius.sm, minWidth: 92, padding: 10 },
  metricLabel: { color: SLColors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  metricValue: { color: SLColors.textStrong, fontSize: 17, fontWeight: '800', marginTop: 2 },
  completion: { color: SLColors.accentMuted, fontSize: 14, fontWeight: '700' },
  setRow: { alignItems: 'center', borderTopColor: SLColors.shellHairline, borderTopWidth: 1, flexDirection: 'row', gap: 12, paddingTop: 10 },
  setCopy: { flex: 1 },
  setMovement: { color: SLColors.textStrong, fontSize: 15, fontWeight: '700' },
  setMeta: { color: SLColors.textMuted, fontSize: 12, marginTop: 2 },
  setActual: { color: SLColors.textSecondary, fontSize: 14, maxWidth: '48%', textAlign: 'right' },
  muted: { color: SLColors.textMuted, fontSize: 14 },
  fieldLabel: { color: SLColors.textMuted, fontSize: 12, fontWeight: '800', marginTop: 6, textTransform: 'uppercase' },
  textarea: {
    backgroundColor: SLColors.surfaceInset, borderColor: SLColors.borderStandard, borderRadius: SLRadius.md,
    borderWidth: 1, color: SLColors.textStrong, fontSize: 16, minHeight: 104, padding: 13, textAlignVertical: 'top',
  },
  toggleRow: { alignItems: 'center', borderTopColor: SLColors.shellHairline, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52 },
  toggleLabel: { color: SLColors.textStrong, flex: 1, fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: SLSpacing.sm },
  secondaryButton: {
    alignItems: 'center', backgroundColor: SLColors.object, borderColor: SLColors.borderFocus,
    borderRadius: SLRadius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 56,
  },
  secondaryButtonText: { color: SLColors.accentMuted, fontSize: 16, fontWeight: '800' },
  primaryButton: {
    alignItems: 'center', backgroundColor: SLColors.accentViolet, borderRadius: SLRadius.md,
    flex: 1.35, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 56,
  },
  primaryButtonText: { color: SLColors.white, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.78 },
});
