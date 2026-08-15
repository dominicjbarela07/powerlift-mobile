import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CompletedSessionRecapPayload } from '@/components/coach-mobile/CompletedSessionRecap';
import {
  CoachCardChevron,
  CoachSparkline,
  CoachStatusBadge,
  COACH_V2,
} from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLAthleteAvatar } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { canonicalAccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';
import { fetchJson } from '@/lib/api';
import {
  attentionActionLabel,
  formatCoachRelativeDate,
  formatCoachVolume,
  formatCoachWeight,
} from '@/lib/coach-mobile-v2';
import {
  openCoachDestination,
  type CoachAthleteSummaryResponse,
  type CoachRecentTrainingSession,
  type CoachRosterAthlete,
} from '@/lib/coach-mobile';
import { useSLReducedMotion } from '@/lib/motion';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';

type WorkoutRecapResponse = {
  ok?: boolean;
  workout?: { completed_recap?: CompletedSessionRecapPayload | null };
};

type Props = {
  athlete: CoachRosterAthlete | null;
  onClose: () => void;
  previewSummary?: CoachAthleteSummaryResponse | null;
  previewRecap?: CompletedSessionRecapPayload | null;
};

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.85;

function toneForStatus(tone?: string) {
  if (tone === 'danger') return 'danger' as const;
  if (tone === 'warning') return 'warning' as const;
  return 'success' as const;
}

function focusNames(session?: CoachRecentTrainingSession | null) {
  return [
    ...(session?.muscle_focus?.primary || []),
    ...(session?.muscle_focus?.secondary || []),
  ].map((item) => item.muscle_id).filter(Boolean);
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function movementPrescription(movement: CompletedSessionRecapPayload['performed_movements'][number], preferredUnits?: string | null) {
  const performed = movement.sets.filter((set) => set.actual_reps != null || set.actual_weight_kg != null);
  if (!performed.length) return 'Performed evidence recorded';
  const first = performed[0];
  const weight = first.actual_weight_kg == null ? null : formatCoachWeight(first.actual_weight_kg, preferredUnits);
  return [
    `${performed.length} set${performed.length === 1 ? '' : 's'}`,
    weight && first.actual_reps != null ? `${weight} × ${first.actual_reps}` : weight,
  ].filter(Boolean).join(' · ');
}

export function CoachAthleteHubSheet({ athlete, onClose, previewRecap, previewSummary }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useSLReducedMotion();
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const notesY = useRef(0);
  const requestRef = useRef(0);
  const [summary, setSummary] = useState<CoachAthleteSummaryResponse | null>(previewSummary || null);
  const [recap, setRecap] = useState<CompletedSessionRecapPayload | null>(previewRecap || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athlete) return;
    if (previewSummary) {
      setSummary(previewSummary);
      setRecap(previewRecap || null);
      return;
    }
    const sequence = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJson(`/coach/mobile/athletes/${athlete.id}/summary`, { method: 'GET' });
      const payload = response.json as CoachAthleteSummaryResponse | null;
      if (sequence !== requestRef.current) return;
      if (!response.ok || !payload?.ok) {
        setError(response.status === 403
          ? 'This athlete is not in your active coaching relationships.'
          : payload?.error || `Could not load athlete context. (${response.status})`);
        return;
      }
      const normalized = {
        ...payload,
        athlete: { ...payload.athlete, ...normalizeProfilePhotoPayload(payload.athlete) },
      };
      setSummary(normalized);

      const completedId = payload.last_completed_session?.workout_id;
      if (completedId) {
        const recapResponse = await fetchJson(`/workouts/mobile/${completedId}?view=coach-preview`, { method: 'GET' });
        const recapPayload = recapResponse.json as WorkoutRecapResponse | null;
        if (sequence === requestRef.current && recapResponse.ok) {
          setRecap(recapPayload?.workout?.completed_recap || null);
        }
      }
    } catch (loadError) {
      if (sequence !== requestRef.current) return;
      console.warn('Coach Athlete Hub sheet load failed', loadError);
      setError('Network error. Try again.');
    } finally {
      if (sequence === requestRef.current) setLoading(false);
    }
  }, [athlete, previewRecap, previewSummary]);

  useEffect(() => {
    requestRef.current += 1;
    translateY.setValue(0);
    setSummary(previewSummary || null);
    setRecap(previewRecap || null);
    setError(null);
    if (athlete) {
      AccessibilityInfo.announceForAccessibility(`${athlete.name} Athlete Hub opened.`);
      void load();
    }
  }, [athlete, load, previewRecap, previewSummary, translateY]);

  const settleSheet = useCallback(() => {
    if (reduceMotion) {
      translateY.setValue(0);
      return;
    }
    Animated.spring(translateY, {
      damping: 24,
      mass: 0.7,
      stiffness: 280,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, translateY]);

  const dismissSheet = useCallback(() => {
    requestRef.current += 1;
    if (reduceMotion) {
      onClose();
      return;
    }
    Animated.timing(translateY, {
      duration: 180,
      toValue: Math.max(height, 640),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [height, onClose, reduceMotion, translateY]);

  const dragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy >= DISMISS_DISTANCE || gesture.vy >= DISMISS_VELOCITY) dismissSheet();
      else settleSheet();
    },
    onPanResponderTerminate: settleSheet,
  }), [dismissSheet, settleSheet, translateY]);

  const navigate = useCallback((target: Parameters<typeof router.push>[0]) => {
    onClose();
    setTimeout(() => router.push(target as any), 0);
  }, [onClose, router]);

  if (!athlete) return null;

  const details = summary;
  const training = details?.current_training || athlete.current_training;
  const status = details?.operational_status || {
    primary_status: athlete.status.classification,
    label: athlete.status.label,
    tone: athlete.status.tone,
    reasons: athlete.attention_reasons,
  };
  const primaryReason = status.reasons?.[0];
  const readiness = details?.readiness || athlete.readiness;
  const bodyweight = details?.reported_bodyweight || athlete.reported_bodyweight;
  const recentTraining = details?.recent_training || athlete.recent_training || [];
  const lastSession = recentTraining.find((session) => session.evidence_mode === 'performed')
    || (athlete.last_completed_session ? {
      ...athlete.last_completed_session,
      set_count: 0,
      movement_count: 0,
      pr_count: 0,
      evidence_mode: 'performed' as const,
    } : null);
  const focus = focusNames(lastSession);
  const focusAsset = accessoryMuscleRegionAsset(canonicalAccessoryMuscleRegionKey(focus[0]));
  const preferredUnits = details?.athlete.preferred_units || athlete.preferred_units;
  const week = details?.week_summary || athlete.week_summary;
  const highlights = recap?.highlights;
  const prCount = highlights?.pr_count ?? lastSession?.pr_count ?? week?.pr_count ?? 0;
  const volume = recap?.session.total_volume_kg ?? lastSession?.total_volume_kg;

  const message = () => {
    const threadId = details?.unread_messages?.thread_id || athlete.unread_messages?.thread_id;
    navigate(threadId
      ? { pathname: '/(tabs)/messages/[threadId]', params: { threadId: String(threadId) } } as any
      : { pathname: '/(tabs)/messages', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any);
  };
  const program = () => navigate({ pathname: '/(tabs)/workout', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any);
  const schedule = () => navigate({ pathname: '/(tabs)/coach-calendar', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any);
  const more = () => navigate({ pathname: '/(tabs)/coach-more', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any);
  const note = details?.coach_context.pinned_note || athlete.coach_context?.pinned_note;
  const scrollToNotes = () => scrollRef.current?.scrollTo({ y: Math.max(0, notesY.current - 20), animated: !reduceMotion });
  const openPrimaryReason = () => {
    if (!primaryReason) return;
    onClose();
    setTimeout(() => openCoachDestination(router, primaryReason.destination), 0);
  };
  const openLastSession = () => {
    if (!lastSession?.workout_id) return;
    navigate({ pathname: '/(tabs)/workout/[workoutId]', params: { workoutId: String(lastSession.workout_id), athleteView: 'coach-preview' } } as any);
  };

  return (
    <Modal
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={dismissSheet}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Dismiss Athlete Hub" accessibilityRole="button" onPress={dismissSheet} style={StyleSheet.absoluteFillObject} />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              maxHeight: Math.min(height * 0.96, 900),
              paddingBottom: Math.max(insets.bottom, 10),
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.dragArea} {...dragResponder.panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetActions}>
              <Pressable accessibilityLabel="More athlete actions" accessibilityRole="button" onPress={more} style={styles.roundButton}>
                <Ionicons color={COACH_V2.text} name="ellipsis-horizontal" size={21} />
              </Pressable>
              <Pressable accessibilityLabel="Close Athlete Hub" accessibilityRole="button" onPress={dismissSheet} style={styles.roundButton}>
                <Ionicons color={COACH_V2.text} name="close" size={24} />
              </Pressable>
            </View>
          </View>

          <ScrollView ref={scrollRef} bounces contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <LinearGradient colors={['rgba(157,92,255,0.16)', 'rgba(0,0,0,0)']} style={styles.identityGlow} />
            <View style={styles.identity}>
              <SLAthleteAvatar
                imageUrl={details?.athlete.profilePhotoUrl || athlete.profilePhotoUrl}
                imageVersion={details?.athlete.profilePhotoVersion || athlete.profilePhotoVersion}
                name={athlete.name}
                size={92}
                statusColor={status.tone === 'danger' ? COACH_V2.magenta : status.tone === 'warning' ? COACH_V2.gold : COACH_V2.green}
              />
              <View style={styles.identityCopy}>
                <Text numberOfLines={1} style={styles.athleteName}>{athlete.name}</Text>
                <Text numberOfLines={2} style={styles.programLine}>
                  {training.status === 'active'
                    ? [training.block_name || training.program_name, training.week_position && training.week_total ? `Week ${training.week_position} of ${training.week_total}` : null].filter(Boolean).join(' · ')
                    : training.label}
                </Text>
                <CoachStatusBadge label={status.label} tone={toneForStatus(status.tone)} />
              </View>
            </View>

            <View style={styles.quickActions}>
              <QuickAction icon="chatbubble-ellipses-outline" label="Message" onPress={message} />
              <QuickAction icon="calendar-outline" label="Program" onPress={program} primary />
              <QuickAction icon="calendar-number-outline" label="Schedule" onPress={schedule} primary />
              <QuickAction icon="document-text-outline" label="Notes" onPress={scrollToNotes} />
              <QuickAction icon="ellipsis-horizontal" label="More" onPress={more} />
            </View>

            {primaryReason ? (
              <Pressable accessibilityRole="button" onPress={openPrimaryReason} style={({ pressed }) => [styles.attentionCard, pressed && styles.pressed]}>
                <LinearGradient colors={['rgba(255,71,103,0.24)', 'rgba(37,8,18,0.96)']} style={StyleSheet.absoluteFillObject} />
                <View style={styles.attentionIcon}><Ionicons color={COACH_V2.magenta} name="calendar-outline" size={24} /></View>
                <View style={styles.attentionCopy}>
                  <Text style={styles.attentionEyebrow}>{primaryReason.title}</Text>
                  <Text numberOfLines={2} style={styles.attentionTitle}>{primaryReason.supporting_text || attentionActionLabel(primaryReason)}</Text>
                </View>
                <CoachCardChevron />
              </Pressable>
            ) : null}

            <SectionTitle title="Current Status" />
            <View style={styles.statusGrid}>
              <StatusCard label="Readiness" value={readiness?.score == null ? '—' : readiness.score.toFixed(1)} accent={readiness?.delta != null && readiness.delta < 0 ? COACH_V2.magenta : COACH_V2.cyan}>
                <CoachSparkline color={readiness?.delta != null && readiness.delta < 0 ? COACH_V2.magenta : COACH_V2.cyan} values={(readiness?.history || []).map((point) => point.score)} />
              </StatusCard>
              <StatusCard label="Bodyweight" value={formatCoachWeight(bodyweight?.latest?.reported_bodyweight_kg, preferredUnits)} accent={COACH_V2.cyan}>
                <CoachSparkline color={COACH_V2.cyan} values={(bodyweight?.recent_observations || []).map((point) => point.reported_bodyweight_kg)} />
              </StatusCard>
              <View style={styles.focusCard}>
                <Image resizeMode="contain" source={focusAsset.source} style={styles.focusImage} />
                <Text style={styles.statusLabel}>Training Focus</Text>
                <Text numberOfLines={2} style={styles.focusLabel}>{focus.length ? focus.slice(0, 2).map(humanize).join(', ') : 'No performed focus yet'}</Text>
              </View>
            </View>

            <SectionTitle title="Last Session" />
            {lastSession ? (
              <Pressable accessibilityLabel={`Open ${lastSession.label}`} accessibilityRole="button" onPress={openLastSession} style={({ pressed }) => [styles.lastSessionCard, pressed && styles.pressed]}>
                <View style={styles.lastSessionTop}>
                  <View style={styles.lastSessionArtwork}><Image resizeMode="contain" source={focusAsset.source} style={styles.lastSessionImage} /></View>
                  <View style={styles.lastSessionCopy}>
                    <Text style={styles.lastSessionTitle}>{lastSession.label}</Text>
                    <Text style={styles.lastSessionMeta}>{formatCoachRelativeDate(lastSession.date)} · Completed</Text>
                  </View>
                  <CoachStatusBadge label="Completed" tone="success" />
                </View>
                <View style={styles.sessionMetrics}>
                  <SessionMetric label="Sets" value={String(recap?.session.set_count ?? lastSession.set_count ?? '—')} />
                  <SessionMetric label="Volume" value={formatCoachVolume(volume, preferredUnits) || '—'} />
                  <SessionMetric label="PRs" value={String(prCount)} />
                  <SessionMetric label="Session RPE" value={recap?.reflection.session_rpe == null ? '—' : String(recap.reflection.session_rpe)} />
                </View>
                {recap?.performed_movements?.length ? (
                  <View style={styles.movementList}>
                    {recap.performed_movements.slice(0, 4).map((movement) => (
                      <View key={`${movement.item_id || movement.label}`} style={styles.movementPill}>
                        <Text numberOfLines={1} style={styles.movementName}>{movement.label}</Text>
                        <Text numberOfLines={1} style={styles.movementEvidence}>{movementPrescription(movement, preferredUnits)}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.evidenceFallback}>Open the completed Session for performed movement evidence.</Text>
                )}
                <View style={styles.sessionOpenRow}>
                  <Text style={styles.sessionOpenText}>View completed Session</Text>
                  <CoachCardChevron />
                </View>
              </Pressable>
            ) : <View style={styles.emptyCard}><Text style={styles.emptyText}>No completed Session evidence is available.</Text></View>}

            <SectionTitle action="View all" onAction={() => navigate({ pathname: '/(tabs)/coach-athlete/[athleteId]', params: { athleteId: String(athlete.id), athleteName: athlete.name } } as any)} title="Recent Highlights" />
            <View style={styles.highlightGrid}>
              <HighlightCard accent={COACH_V2.magenta} icon="medal-outline" label="Rep PRs" value={String(prCount)} />
              <HighlightCard accent={COACH_V2.green} icon="checkmark-circle-outline" label="Sessions" value={week ? `${week.completed_sessions}/${week.scheduled_sessions}` : '—'} />
              <HighlightCard accent={COACH_V2.violetBright} icon="flash-outline" label="Volume" value={formatCoachVolume(volume, preferredUnits) || '—'} />
              <HighlightCard accent={COACH_V2.gold} icon="trophy-outline" label="Streak" value={highlights?.session_streak == null ? '—' : String(highlights.session_streak)} />
            </View>

            <View onLayout={(event) => { notesY.current = event.nativeEvent.layout.y; }}>
              <SectionTitle title="Notes & Next Steps" />
              <View style={styles.notesCard}>
                <Ionicons color={COACH_V2.violetBright} name="document-text-outline" size={20} />
                <View style={styles.notesCopy}>
                  <Text style={styles.notesTitle}>{note?.title || 'No pinned coaching note'}</Text>
                  <Text style={styles.notesText}>{note?.body_preview || 'Add coaching context from the athlete’s canonical workspace when it is needed.'}</Text>
                </View>
              </View>
            </View>

            {error ? (
              <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryCard}>
                <Text style={styles.retryText}>{error} Tap to retry.</Text>
              </Pressable>
            ) : loading ? <Text style={styles.loadingText}>Loading the latest athlete evidence…</Text> : null}

            <Pressable accessibilityRole="button" onPress={lastSession ? openLastSession : program} style={({ pressed }) => [styles.primaryCta, pressed && styles.pressed]}>
              <LinearGradient colors={['#5E24A8', '#8D43E8']} style={StyleSheet.absoluteFillObject} />
              <Text style={styles.primaryCtaText}>{lastSession ? 'Open Last Session' : 'Open Programming'}</Text>
              <Ionicons color={COACH_V2.text} name="arrow-forward" size={20} />
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function QuickAction({ icon, label, onPress, primary = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <Ionicons color={primary ? COACH_V2.violetBright : COACH_V2.text} name={icon} size={22} />
      <Text numberOfLines={1} style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ action, onAction, title }: { action?: string; onAction?: () => void; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? <Pressable accessibilityRole="button" onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

function StatusCard({ accent, children, label, value }: { accent: string; children: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statusValue}>{value}</Text>
      <View style={styles.statusTrend}>{children}</View>
      <View style={[styles.statusAccent, { backgroundColor: accent }]} />
    </View>
  );
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.sessionMetric}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.sessionMetricValue}>{value}</Text><Text style={styles.sessionMetricLabel}>{label}</Text></View>;
}

function HighlightCard({ accent, icon, label, value }: { accent: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={[styles.highlightCard, { borderColor: `${accent}45`, backgroundColor: `${accent}0C` }]}>
      <Ionicons color={accent} name={icon} size={22} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.highlightValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.highlightLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { width: '100%', minHeight: '88%', overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: COACH_V2.borderStrong, backgroundColor: COACH_V2.black },
  dragArea: { minHeight: 66, paddingTop: 10, paddingHorizontal: 14 },
  dragHandle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 3, backgroundColor: '#5C6070' },
  sheetActions: { marginTop: 7, flexDirection: 'row', justifyContent: 'flex-end', gap: 9 },
  roundButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 14, padding: 14, paddingTop: 0 },
  identityGlow: { position: 'absolute', top: 0, left: -14, right: -14, height: 140 },
  identity: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityCopy: { flex: 1, minWidth: 0, gap: 5 },
  athleteName: { color: COACH_V2.text, fontSize: 26, lineHeight: 31, fontWeight: '700' },
  programLine: { color: COACH_V2.muted, fontSize: 12, lineHeight: 17 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 },
  quickAction: { minWidth: 54, flex: 1, alignItems: 'center', gap: 5, paddingVertical: 7 },
  quickActionLabel: { color: COACH_V2.text, fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  attentionCard: { minHeight: 92, overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: `${COACH_V2.magenta}66`, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  attentionIcon: { width: 48, height: 48, borderRadius: 13, backgroundColor: `${COACH_V2.magenta}15`, alignItems: 'center', justifyContent: 'center' },
  attentionCopy: { flex: 1, minWidth: 0, gap: 5 },
  attentionEyebrow: { color: COACH_V2.magenta, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  attentionTitle: { color: COACH_V2.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  sectionTitleRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: COACH_V2.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionAction: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '700' },
  statusGrid: { flexDirection: 'row', gap: 7 },
  statusCard: { minHeight: 126, flex: 1, overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 10 },
  statusLabel: { color: COACH_V2.subtle, fontSize: 8, fontWeight: '900', letterSpacing: 0.35, textTransform: 'uppercase' },
  statusValue: { marginTop: 8, color: COACH_V2.text, fontSize: 19, fontWeight: '700' },
  statusTrend: { marginTop: 'auto', height: 34 },
  statusAccent: { position: 'absolute', left: 10, bottom: 8, width: 16, height: 2, borderRadius: 1 },
  focusCard: { minHeight: 126, flex: 1, overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 8, alignItems: 'center' },
  focusImage: { width: '100%', height: 75 },
  focusLabel: { marginTop: 4, color: COACH_V2.text, fontSize: 10, lineHeight: 13, fontWeight: '700', textAlign: 'center' },
  lastSessionCard: { borderRadius: 13, borderWidth: 1, borderColor: COACH_V2.borderStrong, backgroundColor: COACH_V2.surface, overflow: 'hidden', padding: 11 },
  lastSessionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lastSessionArtwork: { width: 66, height: 66, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#050609' },
  lastSessionImage: { width: '100%', height: '100%' },
  lastSessionCopy: { flex: 1, minWidth: 0 },
  lastSessionTitle: { color: COACH_V2.text, fontSize: 18, fontWeight: '800' },
  lastSessionMeta: { marginTop: 4, color: COACH_V2.muted, fontSize: 11 },
  sessionMetrics: { marginTop: 12, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COACH_V2.border },
  sessionMetric: { minHeight: 56, flex: 1, alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: COACH_V2.border, paddingHorizontal: 4 },
  sessionMetricValue: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  sessionMetricLabel: { marginTop: 3, color: COACH_V2.subtle, fontSize: 8, textTransform: 'uppercase' },
  movementList: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  movementPill: { width: '48%', minHeight: 49, borderRadius: 8, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: '#11131B', padding: 7 },
  movementName: { color: COACH_V2.text, fontSize: 10, fontWeight: '800' },
  movementEvidence: { marginTop: 4, color: COACH_V2.muted, fontSize: 8 },
  evidenceFallback: { marginTop: 11, color: COACH_V2.muted, fontSize: 10 },
  sessionOpenRow: { minHeight: 38, marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  sessionOpenText: { color: COACH_V2.violetBright, fontSize: 10, fontWeight: '800' },
  emptyCard: { borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 16 },
  emptyText: { color: COACH_V2.muted, fontSize: 11 },
  highlightGrid: { flexDirection: 'row', gap: 6 },
  highlightCard: { minHeight: 90, flex: 1, borderRadius: 10, borderWidth: 1, padding: 9 },
  highlightValue: { marginTop: 8, color: COACH_V2.text, fontSize: 18, fontWeight: '700' },
  highlightLabel: { marginTop: 3, color: COACH_V2.muted, fontSize: 8 },
  notesCard: { minHeight: 84, flexDirection: 'row', gap: 10, borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, padding: 12 },
  notesCopy: { flex: 1, minWidth: 0 },
  notesTitle: { color: COACH_V2.text, fontSize: 12, fontWeight: '800' },
  notesText: { marginTop: 5, color: COACH_V2.muted, fontSize: 11, lineHeight: 16 },
  retryCard: { borderRadius: 9, borderWidth: 1, borderColor: `${COACH_V2.magenta}66`, backgroundColor: `${COACH_V2.magenta}0C`, padding: 11 },
  retryText: { color: COACH_V2.magenta, fontSize: 10 },
  loadingText: { color: COACH_V2.subtle, fontSize: 10, textAlign: 'center' },
  primaryCta: { minHeight: 55, overflow: 'hidden', borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryCtaText: { color: COACH_V2.text, fontSize: 14, fontWeight: '900' },
});
