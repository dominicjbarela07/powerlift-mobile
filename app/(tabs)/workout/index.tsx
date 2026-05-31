import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { fetchJson } from '@/lib/api';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';

type SessionFocus = {
  primary?: string[];
  core_count?: number | null;
  accessory_count?: number | null;
};

type SessionRecap = {
  top_work?: string | null;
  execution_summary?: string | null;
  feedback_preview?: string | null;
};

type HubSession = {
  id: number;
  title?: string | null;
  label?: string | null;
  date?: string | null;
  status?: string | null;
  kind?: 'in_progress' | 'today' | 'upcoming' | 'completed' | 'missed' | 'incomplete' | 'past_due' | string | null;
  training_block_id?: number | null;
  block_name?: string | null;
  focus?: SessionFocus | null;
  recap?: SessionRecap | null;
  log_count?: number | null;
  timeliness?: string | null;
  missed_acknowledged_at?: string | null;
  incomplete_acknowledged_at?: string | null;
  attention?: {
    type?: 'missed' | 'incomplete' | string | null;
    label?: string | null;
  } | null;
};

type HubDay = {
  date: string;
  label?: string | null;
  day_number?: number | null;
  is_today?: boolean | null;
  kind?: 'session' | 'rest' | string | null;
  sessions?: HubSession[];
  completed?: number | null;
  assigned?: number | null;
  missed?: number | null;
};

type MovementLift = {
  key: 'squat' | 'bench' | 'deadlift' | string;
  label: string;
  last_trained_date?: string | null;
  recent_session_id?: number | null;
  recent_session_title?: string | null;
  movement?: string | null;
};

type TrainingHubPayload = {
  athlete?: {
    id?: number | null;
    name?: string | null;
    timezone?: string | null;
  } | null;
  today?: string | null;
  current_block?: {
    id?: number | null;
    name?: string | null;
    phase?: string | null;
    week_label?: string | null;
    date_range_label?: string | null;
    progress?: {
      completed?: number | null;
      total?: number | null;
      percent?: number | null;
    } | null;
    cadence?: {
      this_week_total?: number | null;
      this_week_completed?: number | null;
      this_week_missed?: number | null;
      rhythm?: string | null;
    } | null;
  } | null;
  flow?: HubSession[];
  week?: {
    start_date?: string | null;
    end_date?: string | null;
    days?: HubDay[];
  } | null;
  movement_history?: {
    lifts?: MovementLift[];
    film_room?: {
      label?: string | null;
      route?: string | null;
    } | null;
  } | null;
  memory?: {
    last_completed?: HubSession | null;
    next_up?: HubSession | null;
    momentum?: string | null;
  } | null;
};

type AttentionModalState =
  | { type: 'missed'; session: HubSession }
  | { type: 'incomplete'; session: HubSession }
  | null;

const colors = {
  text: '#ECE5DA',
  textStrong: SLColors.textStrong,
  muted: '#B8ACA1',
  subtle: '#82766D',
  line: 'rgba(222, 198, 166, 0.10)',
  lineSoft: 'rgba(222, 198, 166, 0.058)',
  surface: 'rgba(20, 14, 13, 0.32)',
  surfaceStrong: 'rgba(24, 16, 15, 0.50)',
  violet: SLColors.accentViolet,
  violetSoft: 'rgba(167, 139, 250, 0.13)',
  green: '#A7CBB5',
  amber: '#D6A75E',
  red: SLColors.railDanger,
};

const missedReasons = [
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'sick_injured', label: 'Sick/Injured' },
  { key: 'travel', label: 'Travel' },
  { key: 'forgot', label: 'Forgot' },
  { key: 'other', label: 'Other' },
];

const incompleteReasons = [
  { key: 'time', label: 'Time' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'pain_injury', label: 'Pain/Injury' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'interrupted', label: 'Interrupted' },
  { key: 'other', label: 'Other' },
];

export default function TrainingIndexScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string }>();
  const rosterAthleteId = params.athleteId ? String(params.athleteId) : null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hub, setHub] = useState<TrainingHubPayload | null>(null);
  const [attentionModal, setAttentionModal] = useState<AttentionModalState>(null);
  const [attentionReason, setAttentionReason] = useState('');
  const [attentionComment, setAttentionComment] = useState('');
  const [attentionSubmitting, setAttentionSubmitting] = useState(false);

  const loadTraining = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const endpoint = rosterAthleteId
      ? `/workouts/my_list/mobile/${rosterAthleteId}`
      : '/workouts/my_list/mobile';

    try {
      const resp = await fetchJson(endpoint, { method: 'GET' });
      const res: any = resp.json;
      if (!resp.ok || !res?.ok) {
        setError(res?.error || res?.message || `HTTP ${resp.status}`);
        setHub(null);
        return;
      }
      setHub(res.training_hub || null);
    } catch (err: any) {
      setError(err?.message || 'Training Hub could not load.');
      setHub(null);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [rosterAthleteId]);

  useEffect(() => {
    loadTraining();
  }, [loadTraining]);

  const weekDays = useMemo(() => hub?.week?.days || [], [hub?.week?.days]);
  const movementLifts = useMemo(
    () => (hub?.movement_history?.lifts || []).filter(hasMovementHistory),
    [hub?.movement_history?.lifts]
  );

  const openWorkout = (workoutId?: number | null) => {
    if (!workoutId) return;
    router.push({
      pathname: '/workout/[workoutId]',
      params: { workoutId: String(workoutId) },
    });
  };

  const openFilmRoom = () => {
    router.push('/(tabs)/video-archive' as any);
  };

  const openBlockDetails = () => {
    router.push('/(tabs)/workout/block-details' as any);
  };

  const openSessionHistory = () => {
    router.push('/(tabs)/workout/session-history' as any);
  };

  const openMovementHistory = () => {
    router.push('/(tabs)/workout/movement-history' as any);
  };

  const openAttentionModal = (type: 'missed' | 'incomplete', session: HubSession) => {
    setAttentionModal({ type, session });
    setAttentionReason(type === 'missed' ? missedReasons[0].key : incompleteReasons[0].key);
    setAttentionComment('');
  };

  const coordinateWithCoach = (session: HubSession) => {
    const sessionName = sessionTitle(session);
    const sessionDate = formatLongDate(session.date);
    const draft = [
      `Hey coach, I need to adjust ${sessionName}${sessionDate ? ` from ${sessionDate}` : ''}.`,
      session.block_name ? `Block: ${session.block_name}.` : null,
      'What should I do next?',
    ].filter(Boolean).join('\n');

    router.push({
      pathname: '/(tabs)/messages',
      params: {
        draft,
        contextType: 'training_session',
        workoutId: String(session.id),
        draftNonce: String(Date.now()),
      },
    } as any);
  };

  const submitAttention = async () => {
    if (!attentionModal) return;
    const endpoint = attentionModal.type === 'missed'
      ? `/workouts/mobile/${attentionModal.session.id}/acknowledge-missed`
      : `/workouts/mobile/${attentionModal.session.id}/mark-incomplete`;

    try {
      setAttentionSubmitting(true);
      const resp = await fetchJson<any>(endpoint, {
        method: 'POST',
        body: {
          reason: attentionReason,
          comment: attentionComment,
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setAttentionModal(null);
      setAttentionReason('');
      setAttentionComment('');
      await loadTraining({ silent: true });
    } catch (err: any) {
      Alert.alert('Could not save context', err?.message || 'Please try again.');
    } finally {
      setAttentionSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTraining({ silent: true })} tintColor={colors.muted} />}
      >
        <TrainingHubHeader today={hub?.today} />

        {loading ? (
          <StateLine icon="barbell-outline" title="Loading Training Hub" body="Finding your current rhythm." />
        ) : error ? (
          <StateLine icon="alert-circle-outline" title="Training Hub unavailable" body={error} />
        ) : (
          <>
            <CurrentBlockAnchor
              block={hub?.current_block || null}
              onViewBlock={openBlockDetails}
            />
            <CurrentPosition block={hub?.current_block || null} memory={hub?.memory || null} days={weekDays} onOpen={openWorkout} />
            <WeekRhythm days={weekDays} onOpen={openWorkout} />
            <TrainingDetails
              block={hub?.current_block || null}
              movementLifts={movementLifts}
              onViewBlock={openBlockDetails}
              onSessionHistory={openSessionHistory}
              onMovementHistory={openMovementHistory}
              onFilmRoom={openFilmRoom}
            />
          </>
        )}
      </ScrollView>

      <AttentionModal
        state={attentionModal}
        reason={attentionReason}
        comment={attentionComment}
        submitting={attentionSubmitting}
        onReasonChange={setAttentionReason}
        onCommentChange={setAttentionComment}
        onClose={() => setAttentionModal(null)}
        onSubmit={submitAttention}
        onMessageCoach={coordinateWithCoach}
      />
    </View>
  );
}

function TrainingHubHeader({ today }: { today?: string | null }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerIdentity}>
        <Text style={styles.title}>Training Hub</Text>
        <Text style={styles.headerDate}>{formatLongDate(today) || 'Today'}</Text>
      </View>
    </View>
  );
}

function CurrentBlockAnchor({
  block,
  onViewBlock,
}: {
  block: NonNullable<TrainingHubPayload['current_block']> | null;
  onViewBlock: () => void;
}) {
  const progress = Math.max(0, Math.min(1, Number(block?.progress?.percent || 0)));
  const hasBlock = !!block;

  return (
    <View style={styles.blockZone}>
      <View style={styles.blockRail} />
      <View style={styles.blockMain}>
        <Text style={styles.zoneKicker}>Current Block</Text>
        <Text style={styles.blockName}>{block?.name || 'No active block'}</Text>
        <View style={styles.blockMetaLine}>
          <Text style={styles.blockMeta}>{block?.week_label || block?.phase || 'No active week'}</Text>
          {block?.date_range_label ? <Text style={styles.blockDot}>/</Text> : null}
          {block?.date_range_label ? <Text style={styles.blockMeta}>{block.date_range_label}</Text> : null}
        </View>

        {hasBlock ? (
          <View style={styles.progressLine}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        ) : null}

        <View style={styles.blockActionRow}>
          <Pressable style={({ pressed }) => [styles.blockAction, pressed && styles.pressed]} onPress={onViewBlock}>
            <Text style={styles.blockActionText}>View Block</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.textStrong} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function CurrentPosition({
  block,
  memory,
  days,
  onOpen,
}: {
  block: NonNullable<TrainingHubPayload['current_block']> | null;
  memory: TrainingHubPayload['memory'] | null;
  days: HubDay[];
  onOpen: (id?: number | null) => void;
}) {
  const weekCompleted = Number(block?.cadence?.this_week_completed || 0);
  const weekTotal = Number(block?.cadence?.this_week_total || 0);
  const todayDay = days.find((day) => day.is_today) || null;
  const todaySession = todayDay?.sessions?.[0] || null;
  const next = memory?.next_up || null;
  const todayText = todaySession ? sessionTitle(todaySession) : 'Rest';
  const nextText = next ? sessionTitle(next) : 'Rest';
  const weekPosition = weekTotal
    ? `${weekCompleted}/${weekTotal} complete this week`
    : 'No sessions this week';
  const cue = positionCue(block, weekCompleted, weekTotal);

  return (
    <View style={styles.positionZone}>
      <View style={styles.positionRail} />
      <View style={styles.positionMain}>
        <Text style={styles.zoneKicker}>Current Position</Text>
        <Text style={styles.positionPrimary}>Today: {todayText}</Text>
        <View style={styles.positionMetaGrid}>
          <View style={styles.positionMetaItem}>
            <Text style={styles.positionMetaLabel}>This week</Text>
            <Text style={styles.positionMetaValue}>{weekPosition}</Text>
          </View>
          <View style={styles.positionMetaItemWide}>
            <Text style={styles.positionMetaLabel}>Next</Text>
            <Text style={styles.positionMetaValue} numberOfLines={1}>{nextText}</Text>
          </View>
        </View>
        {cue ? <Text style={styles.positionCue}>{cue}</Text> : null}
        {todaySession?.id ? (
          <View style={styles.positionActionRow}>
            <Pressable style={({ pressed }) => [styles.positionAction, pressed && styles.pressed]} onPress={() => onOpen(todaySession.id)}>
              <Text style={styles.blockActionText}>View Session</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.textStrong} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function TrainingDetails({
  block,
  movementLifts,
  onViewBlock,
  onSessionHistory,
  onMovementHistory,
  onFilmRoom,
}: {
  block: NonNullable<TrainingHubPayload['current_block']> | null;
  movementLifts: MovementLift[];
  onViewBlock: () => void;
  onSessionHistory: () => void;
  onMovementHistory: () => void;
  onFilmRoom: () => void;
}) {
  const movementSummary = movementLifts.length
    ? movementLifts.map((lift) => lift.label).join(' / ')
    : 'No history yet';

  return (
    <View style={styles.accessZone}>
      <Text style={styles.zoneKicker}>Training Details</Text>
      <View style={styles.accessList}>
        <DetailRow
          label="Block Details"
          value={block?.name || 'No active block'}
          icon="layers-outline"
          tone={colors.violet}
          onPress={onViewBlock}
        />
        <DetailRow
          label="Session History"
          value="Past Sessions"
          icon="time-outline"
          tone={colors.green}
          onPress={onSessionHistory}
        />
        <DetailRow
          label="Movement History"
          value={movementSummary}
          icon="analytics-outline"
          tone={colors.amber}
          onPress={onMovementHistory}
        />
        <DetailRow
          label="Film Room"
          value="Training clips"
          icon="videocam-outline"
          tone={colors.violet}
          onPress={onFilmRoom}
        />
      </View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  icon,
  tone,
  onPress,
  disabled,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.accessRow, pressed && !disabled && styles.pressed, disabled && styles.accessRowDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.accessRail, { backgroundColor: tone }]} />
      <Ionicons name={icon} size={17} color={disabled ? colors.subtle : colors.textStrong} />
      <View style={styles.accessCopy}>
        <Text style={[styles.accessLabel, disabled && styles.accessTextDisabled]}>{label}</Text>
        <Text style={[styles.accessValue, disabled && styles.accessTextDisabled]} numberOfLines={1}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={disabled ? colors.subtle : colors.muted} />
    </Pressable>
  );
}

function WeekRhythm({ days, onOpen }: { days: HubDay[]; onOpen: (id?: number | null) => void }) {
  return (
    <View style={styles.weekZone}>
      <View style={styles.zoneHeader}>
        <Text style={styles.zoneKicker}>This Week</Text>
      </View>
      <View style={styles.weekList}>
        {days.length ? days.map((day) => {
          const firstSession = day.sessions?.[0] || null;
          const isRest = day.kind !== 'session';
          const tone = firstSession ? toneForSession(firstSession) : colors.line;
          return (
            <Pressable
              key={day.date}
              style={[styles.weekDayRow, day.is_today && styles.weekDayToday]}
              onPress={() => firstSession ? onOpen(firstSession.id) : undefined}
              disabled={!firstSession}
            >
              <View style={styles.weekDayStamp}>
                <Text style={[styles.weekLabel, day.is_today && styles.weekLabelToday]}>{day.label || formatWeekday(day.date)}</Text>
                <Text style={styles.weekNumber}>{day.day_number || dateNumber(day.date)}</Text>
              </View>
              <View style={[styles.weekMarkerRail, { backgroundColor: isRest ? colors.lineSoft : tone }]} />
              <View style={styles.weekDayContent}>
                <Text style={styles.weekStatus} numberOfLines={1}>
                  {isRest ? 'Rest' : sessionTitle(firstSession)}
                </Text>
                {!isRest && firstSession ? (
                  <Text style={[styles.weekKind, { color: tone }]}>{labelForKind(firstSession)}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        }) : (
          <Text style={styles.quietLine}>No sessions this week.</Text>
        )}
      </View>
    </View>
  );
}

function StateLine({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.stateLine}>
      <Ionicons name={icon} size={18} color={colors.violet} />
      <View style={styles.stateCopy}>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateBody}>{body}</Text>
      </View>
      {title.toLowerCase().includes('loading') ? <ActivityIndicator color={colors.violet} /> : null}
    </View>
  );
}

function AttentionModal({
  state,
  reason,
  comment,
  submitting,
  onReasonChange,
  onCommentChange,
  onClose,
  onSubmit,
  onMessageCoach,
}: {
  state: AttentionModalState;
  reason: string;
  comment: string;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onMessageCoach: (session: HubSession) => void;
}) {
  const options = state?.type === 'missed' ? missedReasons : incompleteReasons;
  const title = state?.type === 'missed' ? 'Check in on this session' : 'Add session context';

  return (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalKicker}>Training context</Text>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalBody}>{state ? sessionTitle(state.session) : ''}</Text>

          <View style={styles.reasonGrid}>
            {options.map((option) => {
              const selected = reason === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.reasonOption, selected && styles.reasonOptionSelected]}
                  onPress={() => onReasonChange(option.key)}
                >
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={comment}
            onChangeText={onCommentChange}
            placeholder="Add a note for your coach"
            placeholderTextColor={colors.subtle}
            style={styles.commentInput}
            multiline
            maxLength={1000}
          />

          <View style={styles.modalActions}>
            {state ? (
              <Pressable style={styles.secondaryAction} onPress={() => onMessageCoach(state.session)}>
                <Text style={styles.secondaryActionText}>Message coach</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryAction} onPress={onClose} disabled={submitting}>
              <Text style={styles.secondaryActionText}>Close</Text>
            </Pressable>
            <Pressable style={styles.primaryAction} onPress={onSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color={colors.textStrong} /> : <Text style={styles.primaryActionText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function sessionTitle(session?: HubSession | null) {
  return (session?.title || session?.label || 'Training Session').trim();
}

function hasMovementHistory(lift: MovementLift) {
  return Boolean(
    lift.last_trained_date &&
    (lift.recent_session_id || lift.movement || lift.recent_session_title)
  );
}

function focusLine(focus?: SessionFocus | null) {
  const primary = (focus?.primary || []).filter(Boolean);
  const pieces = [];
  if (primary.length) pieces.push(primary.join(' / '));
  const core = Number(focus?.core_count || 0);
  const accessories = Number(focus?.accessory_count || 0);
  if (core || accessories) {
    const work = [
      core ? `${core} core` : null,
      accessories ? `${accessories} accessory` : null,
    ].filter(Boolean).join(' / ');
    if (work) pieces.push(work);
  }
  return pieces.join(' • ');
}

function normalizedKind(session?: HubSession | null) {
  return (session?.kind || session?.status || '').toString().trim().toLowerCase();
}

function toneForSession(session?: HubSession | null) {
  const kind = normalizedKind(session);
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return colors.green;
  if (kind === 'today' || kind === 'in_progress') return colors.violet;
  if (kind === 'missed' || kind === 'past_due' || kind === 'incomplete') return colors.red;
  return colors.amber;
}

function labelForKind(session: HubSession) {
  const kind = normalizedKind(session);
  if (kind === 'in_progress') return 'In progress';
  if (kind === 'today') return 'Today';
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return 'Complete';
  if (kind === 'missed') return 'Missed';
  if (kind === 'incomplete') return 'Incomplete';
  if (kind === 'past_due') return 'Past due';
  return 'Up next';
}

function positionCue(
  block: NonNullable<TrainingHubPayload['current_block']> | null,
  weekCompleted: number,
  weekTotal: number
) {
  const phase = `${block?.phase || ''} ${block?.week_label || ''}`.toLowerCase();
  if (phase.includes('deload') || phase.includes('recovery')) return 'Recover and absorb the work.';
  if (weekTotal > 0 && weekCompleted >= weekTotal) return 'Week complete. Recover and reset.';

  const progress = Math.max(0, Math.min(1, Number(block?.progress?.percent || 0)));
  if (!block) return 'Start with the next assigned session.';
  if (progress < 0.25) return 'Establish consistency early.';
  if (progress >= 0.75) return 'Finish the block well.';
  if (weekTotal > 0 && weekCompleted / weekTotal >= 0.5) return 'Stay on pace.';
  return 'Continue building momentum.';
}

function actionForSession(session: HubSession) {
  const kind = normalizedKind(session);
  if (kind === 'in_progress') return 'Resume';
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return 'Review';
  if (kind === 'missed' || kind === 'incomplete' || kind === 'past_due') return 'Open';
  return 'Start';
}

function formatFlowDate(value?: string | null) {
  if (!value) return 'Undated';
  const date = parseDate(value);
  if (!date) return value;
  return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${date.getMonth() + 1}/${date.getDate()}`;
}

function formatShortDate(value?: string | null) {
  if (!value) return '';
  const date = parseDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatLongDate(value?: string | null) {
  if (!value) return '';
  const date = parseDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatWeekday(value?: string | null) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString(undefined, { weekday: 'short' }) : '';
}

function dateNumber(value?: string | null) {
  const date = parseDate(value);
  return date ? date.getDate() : '';
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingTop: 16,
    paddingBottom: 36,
    gap: 26,
  },
  header: {
    gap: 10,
    paddingTop: 2,
  },
  headerIdentity: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  title: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  headerDate: {
    ...SLTypography.caption,
    color: colors.subtle,
    textAlign: 'right',
    flexShrink: 0,
  },
  blockZone: {
    position: 'relative',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(24, 16, 15, 0.20)',
    overflow: 'hidden',
  },
  blockRail: {
    width: 3,
    backgroundColor: colors.violet,
    opacity: 0.82,
  },
  blockMain: {
    flex: 1,
    paddingVertical: 22,
    paddingLeft: 16,
    paddingRight: 14,
    gap: 12,
  },
  zoneKicker: {
    ...SLTypography.label,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  blockName: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 25,
    lineHeight: 31,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  blockMetaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  blockMeta: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  blockDot: {
    ...SLTypography.caption,
    color: colors.violet,
  },
  progressLine: {
    height: 2,
    backgroundColor: colors.lineSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.violet,
  },
  statusStrip: {
    gap: 5,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 10,
  },
  rhythmText: {
    ...SLTypography.body,
    color: colors.text,
  },
  progressText: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  blockActionRow: {
    alignItems: 'flex-start',
  },
  blockAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.violet,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  blockActionText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  positionZone: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.16)',
  },
  positionRail: {
    width: 2,
    backgroundColor: colors.green,
    opacity: 0.78,
  },
  positionMain: {
    flex: 1,
    paddingVertical: 15,
    paddingLeft: 14,
    paddingRight: 12,
    gap: 10,
  },
  positionPrimary: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  positionMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 1,
  },
  positionMetaItem: {
    minWidth: 96,
    gap: 2,
  },
  positionMetaItemWide: {
    flex: 1,
    minWidth: 150,
    gap: 2,
  },
  positionMetaLabel: {
    ...SLTypography.label,
    color: colors.subtle,
    textTransform: 'uppercase',
  },
  positionMetaValue: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  positionCue: {
    ...SLTypography.body,
    color: colors.muted,
    paddingTop: 2,
  },
  positionActionRow: {
    alignItems: 'flex-start',
    paddingTop: 2,
  },
  positionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.green,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  accessZone: {
    gap: 12,
  },
  accessList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  accessRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.16)',
    paddingVertical: 10,
  },
  accessRowDisabled: {
    opacity: 0.58,
  },
  accessRail: {
    width: 2,
    alignSelf: 'stretch',
    opacity: 0.85,
  },
  accessCopy: {
    flex: 1,
    gap: 2,
  },
  accessLabel: {
    ...SLTypography.body,
    color: colors.textStrong,
  },
  accessValue: {
    ...SLTypography.caption,
    color: colors.muted,
  },
  accessTextDisabled: {
    color: colors.subtle,
  },
  flowZone: {
    gap: 14,
  },
  zoneHeader: {
    gap: 4,
  },
  zoneTitle: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
  },
  flowList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  flowRow: {
    flexDirection: 'row',
    minHeight: 108,
  },
  flowRowDivider: {
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  timeline: {
    width: 26,
    alignItems: 'center',
    paddingTop: 19,
  },
  timelineNode: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
  },
  timelineLine: {
    flex: 1,
    width: 1,
    marginTop: 4,
    backgroundColor: colors.lineSoft,
  },
  flowBody: {
    flex: 1,
    paddingVertical: 15,
    paddingLeft: 8,
    gap: 7,
  },
  flowBodyDisabled: {
    opacity: 0.66,
  },
  flowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flowDate: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  flowKind: {
    ...SLTypography.label,
  },
  flowTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  flowFocus: {
    ...SLTypography.body,
    color: colors.muted,
  },
  flowRecap: {
    ...SLTypography.caption,
    color: colors.subtle,
  },
  flowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 2,
  },
  contextButton: {
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.36)',
    backgroundColor: 'rgba(127, 29, 29, 0.18)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  contextButtonText: {
    ...SLTypography.label,
    color: '#FECACA',
  },
  launchStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderLeftWidth: 2,
    borderLeftColor: colors.violet,
    backgroundColor: 'rgba(24, 16, 15, 0.36)',
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  launchStripText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  weekZone: {
    gap: 14,
  },
  weekList: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  weekDayRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: 'rgba(24, 16, 15, 0.18)',
  },
  weekDayStamp: {
    width: 42,
    alignItems: 'center',
    gap: 2,
  },
  weekDayToday: {
    borderColor: 'rgba(167, 139, 250, 0.28)',
    backgroundColor: 'rgba(167, 139, 250, 0.055)',
  },
  weekLabel: {
    ...SLTypography.caption,
    color: colors.subtle,
    textAlign: 'center',
  },
  weekLabelToday: {
    color: colors.violet,
  },
  weekNumber: {
    fontFamily: SLFontFamilies.monoSemiBold,
    fontSize: 16,
    color: colors.textStrong,
    textAlign: 'center',
  },
  weekMarkerRail: {
    width: 2,
    alignSelf: 'stretch',
    minHeight: 32,
  },
  weekDayContent: {
    flex: 1,
    gap: 2,
  },
  weekStatus: {
    ...SLTypography.body,
    color: colors.textStrong,
  },
  weekKind: {
    ...SLTypography.caption,
  },
  quietLine: {
    ...SLTypography.body,
    color: colors.subtle,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 14,
  },
  stateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 16,
  },
  stateCopy: {
    flex: 1,
    gap: 2,
  },
  stateTitle: {
    ...SLTypography.cardTitle,
    color: colors.textStrong,
  },
  stateBody: {
    ...SLTypography.body,
    color: colors.muted,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  modalSheet: {
    backgroundColor: 'rgba(24, 16, 15, 0.96)',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 10,
    paddingBottom: 24,
    paddingLeft: 18,
    paddingRight: 18,
    gap: 14,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 3,
    backgroundColor: colors.line,
    borderRadius: 999,
    marginBottom: 4,
  },
  modalKicker: {
    ...SLTypography.label,
    color: colors.violet,
    textTransform: 'uppercase',
  },
  modalTitle: {
    ...SLTypography.sectionTitle,
    color: colors.textStrong,
  },
  modalBody: {
    ...SLTypography.body,
    color: colors.muted,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonOption: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  reasonOptionSelected: {
    borderColor: 'rgba(167, 139, 250, 0.44)',
    backgroundColor: colors.violetSoft,
  },
  reasonText: {
    ...SLTypography.label,
    color: colors.muted,
  },
  reasonTextSelected: {
    color: colors.textStrong,
  },
  commentInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(24, 16, 15, 0.34)',
    color: colors.textStrong,
    textAlignVertical: 'top',
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontFamily: SLFontFamilies.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  secondaryAction: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  secondaryActionText: {
    ...SLTypography.label,
    color: colors.muted,
  },
  primaryAction: {
    minWidth: 84,
    alignItems: 'center',
    borderLeftWidth: 2,
    borderLeftColor: colors.violet,
    backgroundColor: colors.surfaceStrong,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  primaryActionText: {
    ...SLTypography.label,
    color: colors.textStrong,
  },
  pressed: {
    opacity: 0.72,
  },
});
