import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import SetVideoPlayerModal from '@/components/SetVideoPlayerModal';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';
import { fetchJson } from '@/lib/api';

type FocusCue = {
  id: number;
  text: string;
  sort_order: number;
};

type FocusLift = {
  lift: 'SQ' | 'BN' | 'DL';
  label: string;
  cues: FocusCue[];
};

type ReflectionPayload = {
  ok: boolean;
  reflection?: {
    athlete?: {
      id: number;
      name: string;
    };
    current_coaching_focus?: {
      updated_at?: string | null;
      lifts?: FocusLift[];
    };
    recent_coach_feedback?: FeedbackItem[];
    film_study?: {
      rooms?: FilmStudyRoom[];
    };
    feedback_timeline?: TimelineItem[];
  };
  error?: string;
};

type FeedbackItem = {
  id: string;
  kind: 'video_review' | 'coach_note' | 'follow_up' | 'pinned_cue' | string;
  movement?: string | null;
  lift?: string | null;
  title: string;
  body?: string | null;
  created_at?: string | null;
  status_label?: string | null;
  has_video?: boolean;
  video_id?: number | null;
  workout_id?: number | null;
  route?: {
    type?: string | null;
    video_id?: number | null;
  } | null;
};

type FilmStudyRow = {
  movement: string;
  clips: string;
  latest: string;
  focus: string;
};

type FilmStudyRoom = {
  key: 'SQ' | 'BN' | 'DL' | 'ACCESSORIES' | string;
  label: string;
  clip_count: number;
  latest_review?: string | null;
  latest_video_id?: number | null;
  route?: {
    type?: string | null;
    filter?: string | null;
    params?: {
      lift?: string | null;
    } | null;
  } | null;
};

type TimelineItem = {
  id: string;
  event_type: 'coaching_focus' | 'video_review' | 'follow_up' | 'meet_note' | string;
  title: string;
  body?: string | null;
  date: string;
  display_date?: string | null;
  lift?: 'SQ' | 'BN' | 'DL' | null;
  movement?: string | null;
  route?: {
    type?: 'video' | 'film_room' | 'meet_plan' | null | string;
    video_id?: number | null;
    lift?: string | null;
  } | null;
};

const colors = {
  text: '#ECE5DA',
  textStrong: '#F9FAFB',
  muted: '#B8ACA1',
  subtle: '#82766D',
  line: 'rgba(222, 198, 166, 0.10)',
  lineSoft: 'rgba(222, 198, 166, 0.06)',
  surface: 'rgba(20, 14, 13, 0.24)',
  surfaceStrong: 'rgba(31, 20, 22, 0.46)',
  violet: SLColors.accentViolet,
  violetSoft: 'rgba(167, 139, 250, 0.18)',
  amber: '#D6A75E',
  green: '#A7CBB5',
  steel: '#9DB5C1',
};

function formatFeedbackDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function filmRoomLiftParam(lift?: string | null) {
  const normalized = String(lift || '').toUpperCase();
  if (normalized === 'SQ') return 'squat';
  if (normalized === 'BN') return 'bench';
  if (normalized === 'DL') return 'deadlift';
  return '';
}

export default function ReflectionScreen() {
  const router = useRouter();
  const [focusLifts, setFocusLifts] = useState<FocusLift[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackItem[]>([]);
  const [filmRooms, setFilmRooms] = useState<FilmStudyRoom[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loadingFocus, setLoadingFocus] = useState(true);
  const [focusError, setFocusError] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);

  const loadReflection = useCallback(() => {
    let cancelled = false;
    async function run() {
      setLoadingFocus(true);
      setFocusError(null);
      const response = await fetchJson<ReflectionPayload>('/athletes/mobile/reflection', {
        method: 'GET',
        auth: true,
      });
      if (cancelled) return;
      if (!response.ok || !response.json?.ok) {
        setFocusError(response.json?.error || 'Unable to load coaching focus.');
        setFocusLifts([]);
        setRecentFeedback([]);
        setFilmRooms([]);
        setTimelineItems([]);
        setLoadingFocus(false);
        return;
      }
      setFocusLifts(response.json.reflection?.current_coaching_focus?.lifts || []);
      setRecentFeedback(response.json.reflection?.recent_coach_feedback || []);
      setFilmRooms(response.json.reflection?.film_study?.rooms || []);
      setTimelineItems(response.json.reflection?.feedback_timeline || []);
      setLoadingFocus(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(loadReflection);

  const hasFocusCues = useMemo(
    () => focusLifts.some((lift) => (lift.cues || []).length > 0),
    [focusLifts]
  );
  const selectedVideoPath = selectedVideoId ? `/video-review/mobile/attachments/${selectedVideoId}/url` : null;
  const openFilmRoom = useCallback((room: FilmStudyRoom) => {
    const lift = room.route?.params?.lift;
    if (lift) {
      router.push({ pathname: '/(tabs)/video-archive', params: { lift } } as any);
      return;
    }
    router.push('/(tabs)/video-archive' as any);
  }, [router]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>Reflection</Text>
        <Text style={styles.subtitle}>Feedback, film, and coaching notes</Text>
      </View>

      <View style={styles.focusZone}>
        <View style={styles.focusRail} />
        <View style={styles.focusCopy}>
          <Text style={styles.zoneKicker}>Current Coaching Focus</Text>
          {loadingFocus ? (
            <View style={styles.focusLoading}>
              <ActivityIndicator color={colors.violet} />
              <Text style={styles.focusEmptyBody}>Loading coaching focus...</Text>
            </View>
          ) : focusError ? (
            <View style={styles.focusEmpty}>
              <Text style={styles.focusEmptyTitle}>Focus unavailable</Text>
              <Text style={styles.focusEmptyBody}>{focusError}</Text>
            </View>
          ) : hasFocusCues ? (
            <View style={styles.focusLiftList}>
              {focusLifts.map((lift) => (
                <FocusLiftBlock key={lift.lift} lift={lift} />
              ))}
            </View>
          ) : (
            <View style={styles.focusEmpty}>
              <Text style={styles.focusEmptyTitle}>No current coaching focus yet.</Text>
              <Text style={styles.focusEmptyBody}>When your coach pins cues, they’ll appear here.</Text>
            </View>
          )}
        </View>
      </View>

      <Section title="Recent Coach Feedback">
        {recentFeedback.length ? (
          <ScrollView
            style={styles.feedbackRail}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {recentFeedback.map((item) => (
              <FeedbackRow
                key={item.id}
                item={item}
                onOpenVideo={item.video_id ? () => setSelectedVideoId(item.video_id || null) : undefined}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.feedbackEmpty}>
            <Text style={styles.focusEmptyTitle}>No coach feedback this week.</Text>
            <Text style={styles.focusEmptyBody}>New reviews and follow-ups will appear here.</Text>
          </View>
        )}
      </Section>

      <Section title="Film Study">
        {filmRooms.length ? (
          filmRooms.map((room) => (
            <FilmRow key={room.key} row={room} onPress={() => openFilmRoom(room)} />
          ))
        ) : (
          <View style={styles.feedbackEmpty}>
            <Text style={styles.focusEmptyTitle}>No film rooms yet.</Text>
            <Text style={styles.focusEmptyBody}>Videos you save or submit will organize here by movement.</Text>
          </View>
        )}
      </Section>

      <Section title="Feedback Timeline" right={timelineItems.length ? 'Learning history' : undefined}>
        {timelineItems.length ? (
          <View style={styles.timeline}>
            {timelineItems.map((item, index) => (
              <TimelineRow
                key={item.id || `${item.title}-${index}`}
                item={item}
                last={index === timelineItems.length - 1}
                onOpenVideo={item.route?.type === 'video' && item.route.video_id ? () => setSelectedVideoId(item.route?.video_id || null) : undefined}
                onOpenMeet={item.route?.type === 'meet_plan' ? () => router.push('/(tabs)/athlete-meet-plan' as any) : undefined}
                onOpenFilmRoom={item.route?.type === 'film_room' ? () => {
                  const lift = filmRoomLiftParam(item.route?.lift);
                  if (lift) {
                    router.push({ pathname: '/(tabs)/video-archive', params: { lift } } as any);
                    return;
                  }
                  router.push('/(tabs)/video-archive' as any);
                } : undefined}
              />
            ))}
          </View>
        ) : (
          <View style={styles.feedbackEmpty}>
            <Text style={styles.focusEmptyTitle}>No coaching timeline yet.</Text>
            <Text style={styles.focusEmptyBody}>Focus cues, reviewed videos, and meet-day notes will build here.</Text>
          </View>
        )}
      </Section>

      <SetVideoPlayerModal
        visible={selectedVideoId != null}
        videoId={selectedVideoId}
        initialUrl={null}
        refreshPath={selectedVideoPath}
        initialCoachFeedbackOpen
        allowExport
        onClose={() => setSelectedVideoId(null)}
      />
    </ScrollView>
  );
}

function FocusLiftBlock({ lift }: { lift: FocusLift }) {
  if (!lift.cues?.length) return null;
  const tone = lift.lift === 'SQ' ? colors.violet : lift.lift === 'BN' ? colors.steel : colors.amber;
  return (
    <View style={styles.focusLiftBlock}>
      <Text style={[styles.focusLiftLabel, { color: tone }]}>{lift.label}</Text>
      <View style={styles.focusCueList}>
        {lift.cues.map((cue) => (
          <View key={`${lift.lift}-${cue.id}`} style={styles.focusCue}>
            <View style={[styles.cueDot, { backgroundColor: tone }]} />
            <Text style={styles.focusCueText}>{cue.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.zoneKicker}>{title}</Text>
        {right ? <Text style={styles.sectionMeta}>{right}</Text> : null}
      </View>
      <View style={styles.ledger}>{children}</View>
    </View>
  );
}

function FeedbackRow({ item, onOpenVideo }: { item: FeedbackItem; onOpenVideo?: () => void }) {
  const hasVideo = !!item.has_video || !!item.video_id;
  const when = formatFeedbackDate(item.created_at);
  const status = item.status_label || 'Coach note';
  const content = (
    <>
      <View style={[styles.rowRail, { backgroundColor: hasVideo ? colors.violet : colors.steel }]} />
      <View style={styles.rowIcon}>
        <Ionicons name={hasVideo ? 'videocam-outline' : 'chatbubble-ellipses-outline'} size={17} color={hasVideo ? colors.violet : colors.steel} />
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTopline}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          {when ? <Text style={styles.rowMeta}>{when}</Text> : null}
        </View>
        {item.body ? <Text style={styles.rowBody}>{item.body}</Text> : null}
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </>
  );
  if (onOpenVideo) {
    return (
      <TouchableOpacity style={styles.feedbackRow} activeOpacity={0.78} onPress={onOpenVideo}>
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.feedbackRow}>
      {content}
    </View>
  );
}

function FilmRow({ row, onPress }: { row: FilmStudyRoom; onPress?: () => void }) {
  const clipLabel = `${row.clip_count} clip${row.clip_count === 1 ? '' : 's'}`;
  const content = (
    <>
      <View style={styles.filmMark}>
        <Ionicons name="play-outline" size={16} color={colors.textStrong} />
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTopline}>
          <Text style={styles.rowTitle}>{row.label}</Text>
          <Text style={styles.rowMeta}>{clipLabel}</Text>
        </View>
        <Text style={styles.rowBody}>{row.latest_review || 'Latest clips ready for study'}</Text>
      </View>
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={styles.filmRow} activeOpacity={0.78} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.filmRow}>
      {content}
    </View>
  );
}

function TimelineRow({
  item,
  last,
  onOpenFilmRoom,
  onOpenMeet,
  onOpenVideo,
}: {
  item: TimelineItem;
  last?: boolean;
  onOpenFilmRoom?: () => void;
  onOpenMeet?: () => void;
  onOpenVideo?: () => void;
}) {
  const action = onOpenVideo || onOpenMeet || onOpenFilmRoom;
  const kind = timelineKindLabel(item.event_type);
  const when = item.display_date || formatFeedbackDate(item.date);
  const content = (
    <>
      <View style={styles.timelineGutter}>
        <View style={[styles.timelineDot, { backgroundColor: timelineTone(item.event_type) }]} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTopline}>
          <Text style={styles.timelineKind}>{kind}</Text>
          {when ? <Text style={styles.rowMeta}>{when}</Text> : null}
        </View>
        <Text style={styles.rowTitle}>{item.title}</Text>
        {item.body ? <Text style={styles.rowBody}>{item.body}</Text> : null}
      </View>
    </>
  );
  if (action) {
    return (
      <TouchableOpacity style={styles.timelineRow} activeOpacity={0.78} onPress={action}>
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.timelineRow}>
      {content}
    </View>
  );
}

function timelineKindLabel(value?: string | null) {
  switch (value) {
    case 'coaching_focus':
      return 'Focus';
    case 'video_review':
      return 'Video review';
    case 'follow_up':
      return 'Follow-up';
    case 'meet_note':
      return 'Meet note';
    default:
      return 'Coach';
  }
}

function timelineTone(value?: string | null) {
  switch (value) {
    case 'coaching_focus':
      return colors.violet;
    case 'video_review':
      return colors.steel;
    case 'follow_up':
      return colors.amber;
    case 'meet_note':
      return colors.green;
    default:
      return colors.amber;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingTop: 12,
    paddingBottom: 32,
    gap: 20,
  },
  header: {
    gap: 3,
  },
  title: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textStrong,
  },
  subtitle: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 13,
    color: colors.muted,
  },
  zoneKicker: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.muted,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  focusZone: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 18,
    backgroundColor: colors.surfaceStrong,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  focusRail: {
    width: 3,
    backgroundColor: colors.violet,
  },
  focusCopy: {
    flex: 1,
    gap: 12,
  },
  focusTitle: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 20,
    lineHeight: 25,
    color: colors.textStrong,
  },
  focusCueList: {
    gap: 8,
  },
  focusLiftList: {
    gap: 13,
  },
  focusLiftBlock: {
    gap: 7,
    paddingTop: 2,
  },
  focusLiftLabel: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  focusCue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  cueDot: {
    width: 7,
    height: 7,
  },
  focusCueText: {
    flex: 1,
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  focusLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  focusEmpty: {
    gap: 4,
    paddingVertical: 4,
  },
  focusEmptyTitle: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  focusEmptyBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 14,
  },
  sectionMeta: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: SLFontFamilies.sans,
    fontSize: 11,
    color: colors.subtle,
  },
  ledger: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface,
  },
  feedbackRail: {
    maxHeight: 218,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  feedbackEmpty: {
    gap: 4,
    paddingVertical: 14,
  },
  rowRail: {
    width: 3,
  },
  rowIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236, 229, 218, 0.05)',
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowTitle: {
    flex: 1,
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textStrong,
  },
  rowMeta: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 11,
    color: colors.subtle,
  },
  rowBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  statusText: {
    alignSelf: 'flex-start',
    marginTop: 2,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.violet,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  filmRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  filmMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.violetSoft,
  },
  timeline: {
    paddingVertical: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  timelineGutter: {
    width: 18,
    alignItems: 'center',
  },
  timelineDot: {
    width: 8,
    height: 8,
    backgroundColor: colors.amber,
  },
  timelineLine: {
    flex: 1,
    width: 1,
    marginTop: 5,
    backgroundColor: colors.line,
  },
  timelineKind: {
    flex: 1,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.steel,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
});
