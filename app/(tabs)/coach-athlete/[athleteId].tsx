import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import RefreshScreen from '@/components/refresh-screen';
import {
  SLErrorState,
  SLLoadingState,
  SLScreen,
  SLAthleteAvatar,
  SLStatusPill,
} from '@/components/ui';
import { SLColors, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';
import { fetchJson } from '@/lib/api';

type AthleteIdentity = {
  id: number;
  name: string;
  avatar_url?: string | null;
  sex?: string | null;
  bodyweight?: number | null;
  is_self?: boolean;
};

type StatusReason = {
  kind: string;
  label: string;
  detail?: string | null;
  priority?: 'high' | 'medium' | 'low' | string;
  workout_id?: number | null;
};

type WorkoutSummary = {
  workout_id: number;
  label: string;
  date?: string | null;
  status?: string | null;
  block_name?: string | null;
  submitted_at?: string | null;
  reviewed?: boolean;
  reviewed_at?: string | null;
};

type VideoReviewItem = {
  attachment_id: number;
  workout_id?: number | null;
  label: string;
  lift?: string | null;
  movement_name?: string | null;
  review_status?: string | null;
  session_date?: string | null;
  created_at?: string | null;
};

type SessionReviewItem = {
  workout_id: number;
  label: string;
  date?: string | null;
  submitted_at?: string | null;
  survey?: {
    rpe?: number | null;
    strength?: number | null;
    fatigue?: number | null;
    notes_preview?: string | null;
  } | null;
};

type AthleteCommandSummary = {
  ok: boolean;
  generated_at?: string;
  athlete: AthleteIdentity;
  operational_status: {
    primary_status?: string;
    label: string;
    tone?: string | null;
    reasons: StatusReason[];
  };
  programming_horizon: {
    programmed_through_date?: string | null;
    days_remaining?: number | null;
    status?: string | null;
    status_label?: string | null;
  };
  last_completed_session: WorkoutSummary | null;
  next_assigned_session: WorkoutSummary | null;
  pending_video_reviews: {
    count: number;
    items: VideoReviewItem[];
  };
  pending_session_reviews: {
    count: number;
    items: SessionReviewItem[];
  };
  unread_messages: {
    thread_id?: number | null;
    count: number;
    last_message_at?: string | null;
  } | null;
  meet_context: {
    meet_plan_id: number;
    meet_name?: string | null;
    meet_date?: string | null;
    days_until_meet?: number | null;
  } | null;
  coach_context: {
    pinned_note?: {
      id: number;
      title?: string | null;
      body_preview?: string | null;
      note_type?: string | null;
      updated_at?: string | null;
    } | null;
  };
  quick_actions: {
    message?: boolean;
    create_session?: boolean;
    open_next_session?: boolean;
    duplicate_session?: boolean;
    move_session?: boolean;
    review_video?: boolean;
    review_session_feedback?: boolean;
    open_web?: boolean;
  };
};

type CommandAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: SLStatusTone;
  onPress: () => void;
  meta?: string;
};

const SHEET_MATERIAL = {
  surface: 'rgba(8, 8, 10, 0.46)',
  surfaceSubtle: 'rgba(6, 6, 7, 0.30)',
  surfaceSoft: 'rgba(12, 13, 15, 0.42)',
  hairline: 'rgba(255, 255, 255, 0.052)',
} as const;

const validTones = new Set<SLStatusTone>(['neutral', 'info', 'success', 'warning', 'danger', 'review', 'accent']);

function statusTone(value?: string | null): SLStatusTone {
  return value && validTones.has(value as SLStatusTone) ? (value as SLStatusTone) : 'neutral';
}

function toneColor(tone: SLStatusTone) {
  return SLStatusTones[tone]?.icon ?? SLColors.accentSteel;
}

function formatShortDate(value?: string | null) {
  if (!value) return 'No date';
  const [year, month, day] = value.slice(0, 10).split('-').map((part) => Number(part));
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMeetLine(summary: AthleteCommandSummary) {
  const meet = summary.meet_context;
  if (!meet) return null;
  const days = meet.days_until_meet;
  const date = formatShortDate(meet.meet_date);
  if (typeof days === 'number') {
    if (days === 0) return `Meet today · ${date}`;
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} out · ${date}`;
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} past · ${date}`;
  }
  return meet.meet_name ? `${meet.meet_name} · ${date}` : date;
}

function formatWorkoutMeta(workout: WorkoutSummary | null) {
  if (!workout) return '';
  return [formatShortDate(workout.date), workout.block_name].filter(Boolean).join(' · ');
}

function cleanTitle(value?: string | null, fallback = 'Session') {
  const trimmed = (value || '').trim();
  if (!trimmed) return fallback;
  if (trimmed !== trimmed.toLowerCase()) return trimmed;
  return trimmed.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function formatProgrammingHorizon(summary: AthleteCommandSummary) {
  const horizon = summary.programming_horizon;
  if (typeof horizon.days_remaining === 'number') {
    if (horizon.days_remaining < 0) {
      return `${Math.abs(horizon.days_remaining)} day${Math.abs(horizon.days_remaining) === 1 ? '' : 's'} overdue`;
    }
    if (horizon.days_remaining === 0) return 'Runs out today';
    return `${horizon.days_remaining} day${horizon.days_remaining === 1 ? '' : 's'} remaining`;
  }
  if (horizon.programmed_through_date) return `Through ${formatShortDate(horizon.programmed_through_date)}`;
  return 'No programmed sessions';
}

function reasonPriority(priority?: string): 'high' | 'medium' | 'low' | 'neutral' {
  if (priority === 'high' || priority === 'medium' || priority === 'low') return priority;
  return 'neutral';
}

export default function CoachAthleteCommandSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const athleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const fallbackAthleteName = Array.isArray(params.athleteName) ? params.athleteName[0] : params.athleteName;

  const [summary, setSummary] = useState<AthleteCommandSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageOpening, setMessageOpening] = useState(false);

  const loadSummary = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!athleteId) {
        setError('Missing athlete.');
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setError(null);

      try {
        const resp = await fetchJson<AthleteCommandSummary>(`/coach/mobile/athletes/${athleteId}/summary`, {
          method: 'GET',
        });

        if (resp.status === 401) {
          router.replace('/login');
          return;
        }

        if (!resp.ok || !resp.json?.ok) {
          setError(resp.json && 'error' in resp.json ? String((resp.json as any).error) : `Unable to load athlete (${resp.status}).`);
          return;
        }

        setSummary(resp.json);
      } catch (err: any) {
        setError(err?.message || 'Unable to load athlete.');
      } finally {
        setLoading(false);
      }
    },
    [athleteId, router]
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSummary({ silent: true });
    setRefreshing(false);
  }, [loadSummary]);

  const athleteName = summary?.athlete.name || fallbackAthleteName || 'Athlete';

  const openTraining = useCallback(() => {
    if (!athleteId) return;
    router.push({
      pathname: '/(tabs)/workout',
      params: { athleteId: String(athleteId), athleteName },
    } as any);
  }, [athleteId, athleteName, router]);

  const openWorkout = useCallback(
    (workoutId?: number | null) => {
      if (!workoutId) return;
      router.push({
        pathname: '/workout/[workoutId]',
        params: { workoutId: String(workoutId) },
      } as any);
    },
    [router]
  );

  const openMessages = useCallback(async () => {
    const threadId = summary?.unread_messages?.thread_id;
    if (threadId) {
      router.push({
        pathname: '/(tabs)/messages/[threadId]',
        params: { threadId: String(threadId) },
      } as any);
      return;
    }

    if (!athleteId || messageOpening) return;
    setMessageOpening(true);
    try {
      const resp = await fetchJson<{ ok: boolean; thread_id?: number; error?: string }>(
        '/messenger/mobile/threads/ensure-athlete',
        {
          method: 'POST',
          body: JSON.stringify({ athlete_id: Number(athleteId) }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const json = resp.json;
      if (!resp.ok || !json?.ok || !json.thread_id) {
        throw new Error(json?.error || `Could not open messages. (${resp.status})`);
      }
      router.push({
        pathname: '/(tabs)/messages/[threadId]',
        params: { threadId: String(json.thread_id), athleteName },
      } as any);
    } catch (err: any) {
      Alert.alert('Messages unavailable', err?.message || 'Could not open athlete thread.');
      router.push('/(tabs)/messages' as any);
    } finally {
      setMessageOpening(false);
    }
  }, [athleteId, athleteName, messageOpening, router, summary?.unread_messages?.thread_id]);

  const openVideoReview = useCallback(() => {
    router.push('/(tabs)/coach-videos' as any);
  }, [router]);

  const openSessionReviews = useCallback((workoutId?: number | null) => {
    if (!athleteId) {
      router.push('/(tabs)/session-surveys' as any);
      return;
    }
    router.push({
      pathname: '/(tabs)/session-surveys',
      params: {
        athleteId: String(athleteId),
        athleteName,
        ...(workoutId ? { workoutId: String(workoutId) } : {}),
      },
    } as any);
  }, [athleteId, athleteName, router]);

  const openCreateSession = useCallback(() => {
    if (!athleteId) return;
    router.push({
      pathname: '/create-workout',
      params: { athleteId: String(athleteId), athleteName },
    } as any);
  }, [athleteId, athleteName, router]);

  const openCalendar = useCallback(() => {
    router.push('/(tabs)/coach-calendar' as any);
  }, [router]);

  const primaryActions = useMemo((): CommandAction[] => {
    if (!summary) return [];
    const hasVideo = (summary.pending_video_reviews?.count ?? 0) > 0;
    const hasSessionReviews = (summary.pending_session_reviews?.count ?? 0) > 0;
    const actions: CommandAction[] = [];

    if (summary.quick_actions?.message) {
      actions.push({
        label: 'Message',
        icon: 'chatbubble-ellipses-outline',
        tone: summary.unread_messages?.count ? 'warning' : 'accent',
        onPress: openMessages,
        meta: messageOpening
          ? 'Opening...'
          : summary.unread_messages?.count
            ? `${summary.unread_messages.count} unread`
            : undefined,
      });
    }

    if (hasVideo) {
      actions.push({
        label: 'Review Video',
        icon: 'videocam-outline',
        tone: 'review',
        onPress: openVideoReview,
        meta: `${summary.pending_video_reviews.count} waiting`,
      });
    }

    if (hasSessionReviews) {
      actions.push({
        label: 'Session Review',
        icon: 'clipboard-outline',
        tone: 'warning',
        onPress: () => openSessionReviews(summary.pending_session_reviews.items[0]?.workout_id),
        meta: `${summary.pending_session_reviews.count} waiting`,
      });
    }

    if (summary.next_assigned_session) {
      const nextWorkoutId = summary.next_assigned_session.workout_id;
      actions.push({
        label: 'Open Next Session',
        icon: 'calendar-outline',
        tone: 'info' as const,
        onPress: () => openWorkout(nextWorkoutId),
        meta: formatShortDate(summary.next_assigned_session.date),
      });
    }

    return actions;
  }, [messageOpening, openMessages, openSessionReviews, openVideoReview, openWorkout, summary]);

  const secondaryActions = useMemo((): CommandAction[] => {
    if (!summary) return [];
    const actions: CommandAction[] = [];

    if (summary.quick_actions?.create_session) {
      actions.push({
        label: 'Create Session',
        icon: 'add-circle-outline',
        tone: 'accent',
        onPress: openCreateSession,
      });
    }

    actions.push(
      {
        label: 'Open Training',
        icon: 'barbell-outline',
        tone: 'neutral',
        onPress: openTraining,
      },
      {
        label: 'Open Calendar',
        icon: 'calendar-clear-outline',
        tone: 'info',
        onPress: openCalendar,
      }
    );

    return actions;
  }, [openCalendar, openCreateSession, openTraining, summary]);

  if (loading && !refreshing && !summary) {
    return (
      <SLScreen edges="none">
        <View style={styles.centerState}>
          <SLLoadingState message="Building athlete context..." title="Loading Command Sheet" />
        </View>
      </SLScreen>
    );
  }

  return (
    <SLScreen edges="none" padded={false}>
      <RefreshScreen
        contentContainerStyle={styles.scrollContent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        style={styles.scroll}
      >
        {error && !summary ? (
          <View style={styles.centerState}>
            <SLErrorState
              actionLabel="Try Again"
              message={error}
              onActionPress={() => loadSummary()}
              title="Could not load athlete"
            />
          </View>
        ) : null}

        {summary ? (
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>Athlete Command Sheet</Text>
              <Text style={styles.title}>Command Sheet</Text>
              <Text style={styles.subtitle}>{athleteName}</Text>
            </View>

            <View style={styles.heroSurface}>
              <View style={[styles.heroRail, { backgroundColor: toneColor(statusTone(summary.operational_status.tone)) }]} />
              <View style={styles.heroTop}>
                <SLAthleteAvatar
                  imageUrl={summary.athlete.avatar_url}
                  name={summary.athlete.name}
                  size={54}
                  statusColor={SLStatusTones[statusTone(summary.operational_status.tone)].icon}
                />
                <View style={styles.heroCopy}>
                  <Text numberOfLines={1} style={styles.heroName}>
                    {summary.athlete.name}
                  </Text>
                  <View style={styles.heroPills}>
                    <SLStatusPill
                      label={summary.operational_status.label}
                      tone={statusTone(summary.operational_status.tone)}
                    />
                    {summary.meet_context ? <SLStatusPill label="Meet Prep" tone="review" /> : null}
                  </View>
                </View>
              </View>
              {summary.meet_context ? (
                <View style={styles.meetLine}>
                  <Ionicons color={SLColors.review} name="flag-outline" size={16} />
                  <Text numberOfLines={2} style={styles.meetText}>
                    {[summary.meet_context.meet_name, formatMeetLine(summary)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ) : null}
            </View>

            {error ? (
              <SLErrorState
                actionLabel="Try Again"
                message={error}
                onActionPress={() => loadSummary({ silent: true })}
                title="Refresh failed"
              />
            ) : null}

            <View style={styles.section}>
              <CommandSection eyebrow="Now" title="Current Status" />
              {summary.operational_status.reasons.length > 0 ? (
                <View style={styles.rowStack}>
                  {summary.operational_status.reasons.map((reason, index) => (
                    <CommandLedgerRow
                      icon={index === 0 ? 'alert-circle-outline' : 'ellipse-outline'}
                      key={`${reason.kind}-${index}`}
                      meta={reason.detail ?? undefined}
                      onPress={reason.workout_id ? () => openWorkout(reason.workout_id) : undefined}
                      priorityLabel={index === 0 ? 'Next' : undefined}
                      statusLabel={reason.priority === 'high' ? 'Urgent' : reason.priority === 'medium' ? 'Soon' : undefined}
                      statusTone={reason.priority === 'high' ? 'danger' : reason.priority === 'medium' ? 'warning' : 'neutral'}
                      title={reason.label}
                      dominant={index === 0 && reasonPriority(reason.priority) !== 'neutral'}
                    />
                  ))}
                </View>
              ) : (
                <InlineEmpty icon="checkmark-circle-outline" title="No immediate action" tone="success" />
              )}
            </View>

            <View style={styles.section}>
              <CommandSection title="Schedule Snapshot" />
              <View style={styles.rowStack}>
                {summary.last_completed_session ? (
                  <CommandLedgerRow
                    icon="checkmark-done-outline"
                    meta={formatWorkoutMeta(summary.last_completed_session)}
                    onPress={() => openWorkout(summary.last_completed_session?.workout_id)}
                    statusLabel="Last"
                    statusTone="success"
                    title={cleanTitle(summary.last_completed_session.label)}
                  />
                ) : (
                  <CommandLedgerRow
                    icon="checkmark-done-outline"
                    meta="No completed sessions yet"
                    statusLabel="Last"
                    statusTone="neutral"
                    title="Last completed session"
                  />
                )}

                {summary.next_assigned_session ? (
                  <CommandLedgerRow
                    icon="calendar-outline"
                    meta={formatWorkoutMeta(summary.next_assigned_session)}
                    onPress={() => openWorkout(summary.next_assigned_session?.workout_id)}
                    statusLabel="Next"
                    statusTone="info"
                    title={cleanTitle(summary.next_assigned_session.label)}
                  />
                ) : (
                  <CommandLedgerRow
                    icon="calendar-outline"
                    meta="No assigned session found"
                    statusLabel="Next"
                    statusTone="neutral"
                    title="Next assigned session"
                  />
                )}

                <CommandLedgerRow
                  icon="trail-sign-outline"
                  meta={summary.programming_horizon.programmed_through_date ? `Through ${formatShortDate(summary.programming_horizon.programmed_through_date)}` : undefined}
                  statusLabel={summary.programming_horizon.status_label || 'Programming'}
                  statusTone={statusTone(summary.programming_horizon.status === 'needs_programming' ? 'danger' : summary.programming_horizon.status === 'programming_soon' ? 'warning' : 'success')}
                  title={formatProgrammingHorizon(summary)}
                />
              </View>
            </View>

            <View style={styles.section}>
              <CommandSection title="Review Queue" />
              {summary.pending_video_reviews.count === 0 && summary.pending_session_reviews.count === 0 ? (
                <InlineEmpty icon="checkmark-circle-outline" title="Review queue clear" tone="success" />
              ) : (
                <View style={styles.rowStack}>
                  {summary.pending_video_reviews.items.map((item) => (
                    <CommandLedgerRow
                      icon="videocam-outline"
                      key={`video-${item.attachment_id}`}
                      meta={formatShortDate(item.session_date || item.created_at)}
                      onPress={openVideoReview}
                      statusLabel="Video"
                      statusTone="review"
                      title={cleanTitle(item.label, 'Set video')}
                    />
                  ))}
                  {summary.pending_session_reviews.items.map((item) => (
                    <CommandLedgerRow
                      icon="clipboard-outline"
                      key={`survey-${item.workout_id}`}
                      meta={[formatShortDate(item.submitted_at || item.date), item.survey?.notes_preview].filter(Boolean).join(' · ')}
                      onPress={() => openSessionReviews(item.workout_id)}
                      statusLabel="Feedback"
                      statusTone="warning"
                      title={cleanTitle(item.label)}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <CommandSection title="Coach Context" />
              {summary.coach_context.pinned_note ? (
                <View style={styles.noteStrip}>
                  <Text style={styles.noteTitle}>{summary.coach_context.pinned_note.title || 'Pinned note'}</Text>
                  {summary.coach_context.pinned_note.body_preview ? (
                    <Text style={styles.noteBody}>{summary.coach_context.pinned_note.body_preview}</Text>
                  ) : null}
                  {summary.coach_context.pinned_note.updated_at ? (
                    <Text style={styles.noteMeta}>Updated {formatShortDate(summary.coach_context.pinned_note.updated_at)}</Text>
                  ) : null}
                </View>
              ) : (
                <InlineEmpty icon="remove-outline" title="No pinned context" />
              )}
            </View>

            <View style={styles.section}>
              <CommandSection title="Quick Actions" />
              <View style={styles.actionStack}>
                {primaryActions.length ? (
                  <View style={styles.actionGroup}>
                    <Text style={styles.actionGroupTitle}>Primary</Text>
                    {primaryActions.map((action) => (
                      <CommandActionRow action={action} key={action.label} />
                    ))}
                  </View>
                ) : null}
                <View style={styles.actionGroup}>
                  <Text style={styles.actionGroupTitle}>Secondary</Text>
                  {secondaryActions.map((action) => (
                    <CommandActionRow action={action} key={action.label} />
                  ))}
                </View>
              </View>
            </View>
          </>
        ) : null}
      </RefreshScreen>
    </SLScreen>
  );
}

function CommandActionRow({ action }: { action: CommandAction }) {
  const tone = SLStatusTones[action.tone];
  return (
    <Pressable
      accessibilityLabel={action.label}
      accessibilityRole="button"
      onPress={action.onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
    >
      <View style={[styles.actionIcon, { backgroundColor: tone.background, borderColor: tone.border }]}>
        <Ionicons color={tone.icon} name={action.icon} size={18} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{action.label}</Text>
        {action.meta ? <Text style={styles.actionMeta}>{action.meta}</Text> : null}
      </View>
      <Ionicons color={SLColors.textMuted} name="chevron-forward" size={17} />
    </Pressable>
  );
}

function CommandSection({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionRail} />
      <View style={styles.sectionHeaderCopy}>
        {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
  );
}

function CommandLedgerRow({
  icon,
  title,
  meta,
  statusLabel,
  statusTone,
  priorityLabel,
  dominant,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta?: string;
  statusLabel?: string;
  statusTone: SLStatusTone;
  priorityLabel?: string;
  dominant?: boolean;
  onPress?: () => void;
}) {
  const color = toneColor(statusTone);
  const Wrapper = onPress ? Pressable : View;
  const rowContent = (
    <>
      <View style={[styles.ledgerRail, { backgroundColor: color }]} />
      <View style={[styles.ledgerIcon, { borderColor: color }]}>
        <Ionicons color={color} name={icon} size={15} />
      </View>
      <View style={styles.ledgerCopy}>
        <Text numberOfLines={1} style={styles.ledgerRowTitle}>{title}</Text>
        {meta ? <Text numberOfLines={1} style={styles.ledgerMeta}>{meta}</Text> : null}
      </View>
      <View style={styles.ledgerStatusWrap}>
        {priorityLabel ? <Text style={styles.priorityText}>{priorityLabel}</Text> : null}
        {statusLabel ? <Text style={[styles.ledgerStatus, { color }]}>{statusLabel}</Text> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.ledgerRow, dominant && styles.ledgerRowDominant, pressed && styles.pressed]}>
        {rowContent}
      </Pressable>
    );
  }

  return <Wrapper style={[styles.ledgerRow, dominant && styles.ledgerRowDominant]}>{rowContent}</Wrapper>;
}

function InlineEmpty({
  title,
  icon,
  tone = 'neutral',
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: SLStatusTone;
}) {
  const color = toneColor(tone);
  return (
    <View style={styles.inlineEmpty}>
      <Ionicons color={color} name={icon} size={16} />
      <Text style={styles.inlineEmptyText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    gap: 18,
    paddingBottom: 112,
    paddingTop: 3,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    gap: 3,
    paddingBottom: SLSpacing.sm,
    paddingLeft: SLSpacing.md,
    paddingTop: 4,
    position: 'relative',
  },
  pressed: {
    opacity: 0.78,
  },
  eyebrow: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.utilityLabel.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: SLTypography.utilityLabel.letterSpacing,
    lineHeight: SLTypography.utilityLabel.lineHeight,
    textTransform: 'uppercase',
  },
  title: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: SLTypography.commandTitle.fontSize,
    fontWeight: SLTypography.commandTitle.fontWeight,
    letterSpacing: SLTypography.commandTitle.letterSpacing,
    lineHeight: SLTypography.commandTitle.lineHeight,
  },
  subtitle: {
    color: '#9BA5B2',
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  heroSurface: {
    backgroundColor: SHEET_MATERIAL.surface,
    borderBottomColor: SHEET_MATERIAL.hairline,
    borderBottomWidth: 1,
    gap: SLSpacing.md,
    minHeight: 112,
    overflow: 'hidden',
    paddingHorizontal: SLSpacing.lg,
    paddingVertical: 18,
    position: 'relative',
  },
  heroRail: {
    bottom: 0,
    left: 0,
    opacity: 0.72,
    position: 'absolute',
    top: 0,
    width: 4,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: SLSpacing.sm,
    minWidth: 0,
  },
  heroName: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.commandTitle.fontFamily,
    fontSize: 20,
    fontWeight: SLTypography.commandTitle.fontWeight,
    letterSpacing: 0,
    lineHeight: 25,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLSpacing.xs,
  },
  meetLine: {
    alignItems: 'center',
    backgroundColor: SHEET_MATERIAL.surfaceSubtle,
    borderColor: SHEET_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
  },
  meetText: {
    color: SLColors.text,
    flex: 1,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.caption.lineHeight,
  },
  section: {
    gap: 9,
  },
  rowStack: {
    backgroundColor: SHEET_MATERIAL.surfaceSubtle,
    overflow: 'hidden',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 28,
  },
  sectionRail: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    height: 2,
    width: 22,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionEyebrow: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 9,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 11,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.sectionLabel.fontFamily,
    fontSize: SLTypography.sectionLabel.fontSize,
    fontWeight: SLTypography.sectionLabel.fontWeight,
    letterSpacing: SLTypography.sectionLabel.letterSpacing,
    lineHeight: SLTypography.sectionLabel.lineHeight,
    textTransform: 'uppercase',
  },
  ledgerRow: {
    alignItems: 'center',
    borderBottomColor: SHEET_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 60,
    overflow: 'hidden',
    paddingRight: SLSpacing.sm,
  },
  ledgerRowDominant: {
    backgroundColor: SHEET_MATERIAL.surfaceSoft,
    minHeight: 72,
  },
  ledgerRail: {
    alignSelf: 'stretch',
    opacity: 0.78,
    width: 4,
  },
  ledgerIcon: {
    alignItems: 'center',
    backgroundColor: SHEET_MATERIAL.surfaceSubtle,
    borderRadius: SLRadius.radiusSharp,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  ledgerCopy: {
    flex: 1,
    minWidth: 0,
  },
  ledgerRowTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  ledgerMeta: {
    color: '#9BA5B2',
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
    marginTop: 2,
  },
  ledgerStatusWrap: {
    alignItems: 'flex-end',
    maxWidth: 86,
  },
  priorityText: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 9,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  ledgerStatus: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.22,
    lineHeight: 13,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  inlineEmpty: {
    alignItems: 'center',
    backgroundColor: SHEET_MATERIAL.surfaceSubtle,
    borderBottomColor: SHEET_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 48,
    paddingHorizontal: SLSpacing.md,
  },
  inlineEmptyText: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  noteStrip: {
    backgroundColor: SHEET_MATERIAL.surfaceSubtle,
    borderBottomColor: SHEET_MATERIAL.hairline,
    borderBottomWidth: 1,
    gap: SLSpacing.xs,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.md,
  },
  noteTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.cardTitle.lineHeight,
  },
  noteBody: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.body.fontFamily,
    fontSize: SLTypography.body.fontSize,
    lineHeight: SLTypography.body.lineHeight,
  },
  noteMeta: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
  actionStack: {
    gap: 14,
  },
  actionGroup: {
    backgroundColor: SHEET_MATERIAL.surfaceSubtle,
    overflow: 'hidden',
  },
  actionGroupTitle: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.utilityLabel.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: SLTypography.utilityLabel.letterSpacing,
    lineHeight: SLTypography.utilityLabel.lineHeight,
    paddingHorizontal: SLSpacing.md,
    paddingTop: SLSpacing.sm,
    textTransform: 'uppercase',
  },
  actionRow: {
    alignItems: 'center',
    borderBottomColor: SHEET_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 52,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
  },
  actionRowPressed: {
    opacity: 0.78,
  },
  actionIcon: {
    alignItems: 'center',
    borderRadius: SLRadius.radiusSharp,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.body.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.body.lineHeight,
  },
  actionMeta: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: SLTypography.caption.lineHeight,
  },
});
