import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';

import { SLMotionEntrance } from '@/components/ui';
import { SLColors, SLFontFamilies, SLRadius, SLTypography } from '@/constants/theme';
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

type FocusDraft = Record<'SQ' | 'BN' | 'DL', string[]>;

type TrainingHistorySession = {
  id: number;
  title?: string | null;
  date?: string | null;
  duration?: string | null;
  lift_count?: number | null;
  exercise_count?: number | null;
  accessory_count?: number | null;
  route?: {
    type?: string | null;
    workout_id?: number | null;
  } | null;
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
    training_history?: TrainingHistorySession[];
    film_study?: {
      rooms?: FilmStudyRoom[];
    };
  };
  error?: string;
};

const colors = {
  text: SLColors.text,
  textStrong: SLColors.textStrong,
  muted: SLColors.textMuted,
  subtle: SLColors.textSubtle,
  line: SLColors.borderSubtle,
  lineSoft: SLColors.borderHairline,
  surface: SLColors.surfaceEmbedded,
  surfaceStrong: SLColors.focus,
  violet: SLColors.accentViolet,
  violetStrong: SLColors.accent,
  violetSoft: SLColors.accentVioletSoft,
  amber: SLColors.warning,
  green: SLColors.success,
  pink: SLColors.danger,
  cyan: SLColors.info,
};

const SBD_LIFTS: Array<{ lift: 'SQ' | 'BN' | 'DL'; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { lift: 'SQ', label: 'Squat', icon: 'body-outline' },
  { lift: 'BN', label: 'Bench', icon: 'barbell-outline' },
  { lift: 'DL', label: 'Deadlift', icon: 'walk-outline' },
];

const reflectionAtmosphere = require('@/assets/images/reflection.jpeg');

export default function LegacyReflectionRoute() {
  if (__DEV__) return <Redirect href="/(tabs)/training-focus" />;
  return <TrainingFocusScreen />;
}

export function TrainingFocusScreen({ focusOnly = false }: { focusOnly?: boolean } = {}) {
  const router = useRouter();
  const [focusLifts, setFocusLifts] = useState<FocusLift[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<TrainingHistorySession[]>([]);
  const [filmRooms, setFilmRooms] = useState<FilmStudyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusError, setFocusError] = useState<string | null>(null);
  const [focusEditorOpen, setFocusEditorOpen] = useState(false);
  const [focusDraft, setFocusDraft] = useState<FocusDraft>({ SQ: ['', '', ''], BN: ['', '', ''], DL: ['', '', ''] });
  const [savingFocus, setSavingFocus] = useState(false);

  const loadReflection = useCallback(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setFocusError(null);
      const response = await fetchJson<ReflectionPayload>(
        focusOnly ? '/athletes/mobile/reflection?focus_only=1' : '/athletes/mobile/reflection',
        { method: 'GET', auth: true }
      );
      if (cancelled) return;
      if (!response.ok || !response.json?.ok) {
        setFocusError(response.json?.error || 'Unable to load Reflection.');
        setFocusLifts([]);
        setTrainingHistory([]);
        setFilmRooms([]);
        setLoading(false);
        return;
      }
      setFocusLifts(response.json.reflection?.current_coaching_focus?.lifts || []);
      setTrainingHistory(focusOnly ? [] : response.json.reflection?.training_history || []);
      setFilmRooms(focusOnly ? [] : response.json.reflection?.film_study?.rooms || []);
      setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [focusOnly]);

  useFocusEffect(loadReflection);

  const hasFocusCues = useMemo(
    () => focusLifts.some((lift) => (lift.cues || []).length > 0),
    [focusLifts]
  );

  const sbdFocusLifts = useMemo(() => (
    SBD_LIFTS.map((liftRow) => (
      focusLifts.find((row) => row.lift === liftRow.lift) || { lift: liftRow.lift, label: liftRow.label, cues: [] }
    ))
  ), [focusLifts]);

  const totalClips = useMemo(
    () => filmRooms.reduce((sum, room) => sum + Number(room.clip_count || 0), 0),
    [filmRooms]
  );

  const openFocusEditor = useCallback(() => {
    const nextDraft: FocusDraft = { SQ: ['', '', ''], BN: ['', '', ''], DL: ['', '', ''] };
    SBD_LIFTS.forEach(({ lift }) => {
      const cues = focusLifts.find((row) => row.lift === lift)?.cues || [];
      nextDraft[lift] = [0, 1, 2].map((idx) => cues[idx]?.text || '');
    });
    setFocusDraft(nextDraft);
    setFocusError(null);
    setFocusEditorOpen(true);
  }, [focusLifts]);

  const updateFocusDraft = useCallback((lift: 'SQ' | 'BN' | 'DL', index: number, value: string) => {
    setFocusDraft((prev) => ({
      ...prev,
      [lift]: prev[lift].map((cue, cueIndex) => cueIndex === index ? value : cue),
    }));
  }, []);

  const saveFocusDraft = useCallback(async () => {
    try {
      setSavingFocus(true);
      setFocusError(null);
      const response = await fetchJson<{ ok?: boolean; error?: string; current_coaching_focus?: { lifts?: FocusLift[] } }>(
        '/athletes/mobile/reflection/coaching-focus',
        {
          method: 'POST',
          auth: true,
          body: {
            cues: {
              SQ: focusDraft.SQ.map((cue) => cue.trim()).filter(Boolean),
              BN: focusDraft.BN.map((cue) => cue.trim()).filter(Boolean),
              DL: focusDraft.DL.map((cue) => cue.trim()).filter(Boolean),
            },
          } as any,
        }
      );
      const payload = response.json || {};
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Could not save training focus (${response.status})`);
      }
      setFocusLifts(payload.current_coaching_focus?.lifts || []);
      setFocusEditorOpen(false);
    } catch (err: any) {
      setFocusError(err?.message || 'Could not save training focus.');
    } finally {
      setSavingFocus(false);
    }
  }, [focusDraft]);

  const openFilmRoom = useCallback((room?: FilmStudyRoom | null) => {
    const lift = room?.route?.params?.lift;
    if (lift) {
      router.push({ pathname: '/(tabs)/video-archive', params: { lift } } as any);
      return;
    }
    router.push('/(tabs)/video-archive' as any);
  }, [router]);

  const openWorkout = useCallback((session: TrainingHistorySession) => {
    const workoutId = session.route?.workout_id || session.id;
    if (!workoutId) return;
    router.push({ pathname: '/workout/[workoutId]', params: { workoutId: String(workoutId) } } as any);
  }, [router]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <ImageBackground
          source={reflectionAtmosphere}
          resizeMode="cover"
          style={styles.headerImage}
          imageStyle={styles.headerImageAsset}
        >
          <View style={styles.headerImageDim} />
          <View pointerEvents="none" style={styles.headerScrim} />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{focusOnly ? 'Training Focus' : 'Reflection'}</Text>
            <Text style={styles.subtitle}>{focusOnly ? 'Keep today’s coaching priorities close.' : 'Look back. Learn. Build forward.'}</Text>
          </View>
        </ImageBackground>
      </View>

      <SLMotionEntrance motionKey={`focus-${loading}-${focusLifts.length}`} distance={6}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelTitleRow}>
            <View style={[styles.sectionIcon, styles.sectionIconViolet]}>
              <Ionicons name="radio-button-on-outline" size={22} color={colors.violetStrong} />
            </View>
            <Text style={styles.panelKicker}>Current Focus</Text>
          </View>
          <TouchableOpacity onPress={openFocusEditor} activeOpacity={0.78} style={styles.textButton}>
            <Text style={styles.textButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.violet} />
            <Text style={styles.emptyBody}>Loading training focus...</Text>
          </View>
        ) : focusError ? (
          <EmptyState title="Focus unavailable" body={focusError} />
        ) : hasFocusCues ? (
          <View style={styles.focusList}>
            {sbdFocusLifts
              .filter((lift) => (lift.cues || []).length > 0)
              .map((lift) => (
                <FocusRow key={lift.lift} lift={lift} />
              ))}
          </View>
        ) : (
          <EmptyState
            title="No current focus yet."
            body="Set the priorities you want to keep in front of you."
            action="Edit Focus"
            onPress={openFocusEditor}
          />
        )}
      </View>
      </SLMotionEntrance>

      {focusOnly ? null : <SLMotionEntrance motionKey={`history-${trainingHistory.length}`} delay={42} distance={6}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelTitleRow}>
            <View style={[styles.sectionIcon, styles.sectionIconAmber]}>
              <Ionicons name="time-outline" size={21} color={colors.amber} />
            </View>
            <Text style={styles.panelKicker}>Training History</Text>
          </View>
          {trainingHistory.length ? (
            <TouchableOpacity onPress={() => router.push('/(tabs)/workout/session-history' as any)} activeOpacity={0.78}>
              <Text style={styles.textButtonText}>View All</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {trainingHistory.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.historyRail}
          >
            {trainingHistory.map((session, index) => (
              <TrainingHistoryCard
                key={session.id}
                session={session}
                tone={historyTone(index)}
                onPress={() => openWorkout(session)}
              />
            ))}
          </ScrollView>
        ) : (
          <EmptyState
            title="Your completed sessions will appear here."
            body="Finish Training Sessions and they will become part of your training history."
          />
        )}
      </View>
      </SLMotionEntrance>}

      {focusOnly ? null : <SLMotionEntrance motionKey={`film-${filmRooms.length}`} delay={84} distance={6}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelTitleRow}>
            <View style={[styles.sectionIcon, styles.sectionIconViolet]}>
              <Ionicons name="videocam-outline" size={21} color={colors.violetStrong} />
            </View>
            <Text style={styles.panelKicker}>Film Room</Text>
          </View>
          {totalClips > 0 ? (
            <TouchableOpacity onPress={() => openFilmRoom(null)} activeOpacity={0.78}>
              <Text style={styles.textButtonText}>View All</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filmRows}>
          <FilmSummaryRow
            icon="play-circle-outline"
            title="Recent Videos"
            subtitle={totalClips ? `${totalClips} video${totalClips === 1 ? '' : 's'}` : 'Videos you save or review will appear here.'}
            onPress={totalClips ? () => openFilmRoom(null) : undefined}
          />
          <FilmFolders rooms={filmRooms} onPress={openFilmRoom} />
          <FilmSummaryRow
            icon="bookmark-outline"
            title="Saved Clips"
            subtitle="Saved clips will appear here."
          />
        </View>
      </View>
      </SLMotionEntrance>}

      <FocusEditorModal
        draft={focusDraft}
        error={focusError}
        onChange={updateFocusDraft}
        onClose={() => setFocusEditorOpen(false)}
        onSave={saveFocusDraft}
        saving={savingFocus}
        visible={focusEditorOpen}
      />
    </ScrollView>
  );
}

function FocusRow({ lift }: { lift: FocusLift }) {
  const tone = focusTone(lift.lift);
  const firstCue = lift.cues?.[0]?.text || 'Focus cue';
  return (
    <View style={styles.focusRow}>
      <View style={[styles.focusIcon, { backgroundColor: tone.bg }]}>
        <Ionicons name={focusIcon(lift.lift)} size={23} color={tone.color} />
      </View>
      <View style={styles.focusCopy}>
        <Text style={styles.focusTitle}>{lift.label}</Text>
        <Text style={styles.focusBody}>{firstCue}</Text>
      </View>
      <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
    </View>
  );
}

function TrainingHistoryCard({
  onPress,
  session,
  tone,
}: {
  onPress: () => void;
  session: TrainingHistorySession;
  tone: { color: string; bg: string };
}) {
  const exerciseCount = Number(session.exercise_count || 0);
  const liftCount = Number(session.lift_count || 0);
  const details = [
    session.duration,
    exerciseCount ? `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}` : liftCount ? `${liftCount} lift${liftCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity style={[styles.historyCard, { borderColor: tone.color }]} activeOpacity={0.82} onPress={onPress}>
      <View style={[styles.historyMemory, { backgroundColor: tone.bg }]}>
        <View style={[styles.historyIcon, { backgroundColor: tone.color }]}>
          <Ionicons name="calendar-outline" size={22} color={SLColors.textInverted} />
        </View>
        <View style={styles.historySignalLine} />
      </View>
      <View style={styles.historyCardCopy}>
        <Text typographyRole="workoutName" style={styles.historyTitle} numberOfLines={2}>{session.title || 'Training Session'}</Text>
        <Text style={styles.historyDate}>{formatDisplayDate(session.date)}</Text>
        {details ? <Text style={styles.historyDetails}>{details}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function FilmSummaryRow({
  icon,
  onPress,
  subtitle,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  subtitle: string;
  title: string;
}) {
  const content = (
    <>
      <View style={styles.filmIcon}>
        <Ionicons name={icon} size={22} color={colors.violetStrong} />
      </View>
      <View style={styles.filmCopy}>
        <Text style={styles.filmTitle}>{title}</Text>
        <Text style={styles.filmSubtitle}>{subtitle}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={19} color={colors.muted} /> : null}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={styles.filmRow} activeOpacity={0.78} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.filmRow}>{content}</View>;
}

function FilmFolders({ rooms, onPress }: { rooms: FilmStudyRoom[]; onPress: (room: FilmStudyRoom) => void }) {
  return (
    <View style={styles.filmFolderRow}>
      <View style={styles.filmIcon}>
        <Ionicons name="folder-outline" size={22} color={colors.violetStrong} />
      </View>
      <View style={styles.filmCopy}>
        <Text style={styles.filmTitle}>Movement Folders</Text>
        <Text style={styles.filmSubtitle}>
          {rooms.length ? `${rooms.length} folder${rooms.length === 1 ? '' : 's'}` : 'Video folders will appear here.'}
        </Text>
        {rooms.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderChips}>
            {rooms.map((room) => (
              <Pressable key={room.key} style={styles.folderChip} onPress={() => onPress(room)}>
                <Ionicons name="folder" size={14} color={colors.muted} />
                <Text style={styles.folderChipText}>{room.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

function EmptyState({
  action,
  body,
  onPress,
  title,
}: {
  action?: string;
  body: string;
  onPress?: () => void;
  title: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action && onPress ? (
        <TouchableOpacity style={styles.emptyButton} onPress={onPress} activeOpacity={0.78}>
          <Text style={styles.emptyButtonText}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function FocusEditorModal({
  draft,
  error,
  onChange,
  onClose,
  onSave,
  saving,
  visible,
}: {
  draft: FocusDraft;
  error?: string | null;
  onChange: (lift: 'SQ' | 'BN' | 'DL', index: number, value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  visible: boolean;
}) {
  const [activeLift, setActiveLift] = useState<'SQ' | 'BN' | 'DL'>('SQ');
  const activeLiftMeta = SBD_LIFTS.find((item) => item.lift === activeLift) || SBD_LIFTS[0];

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={16}
        style={styles.modalScrim}
      >
        <View style={styles.focusEditor}>
          <View style={styles.editorHeader}>
            <View style={styles.editorTitleCopy}>
              <Text style={styles.editorTitle}>Current Focus</Text>
              <Text style={styles.editorBody}>Pin the cues you want in your head for the next block of work.</Text>
            </View>
            <TouchableOpacity style={styles.editorIconButton} onPress={onClose} activeOpacity={0.78}>
              <Ionicons name="close" size={20} color={colors.textStrong} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.editorScroll}
            contentContainerStyle={styles.editorContent}
          >
            <View style={styles.editorLiftTabs}>
              {SBD_LIFTS.map(({ lift, label }) => {
                const active = lift === activeLift;
                const count = draft[lift].filter((cue) => cue.trim()).length;
                return (
                  <TouchableOpacity
                    key={lift}
                    style={[styles.editorLiftTab, active && styles.editorLiftTabActive]}
                    onPress={() => setActiveLift(lift)}
                    activeOpacity={0.78}
                  >
                    <Text style={[styles.editorLiftTabText, active && styles.editorLiftTabTextActive]}>{label}</Text>
                    {count ? <Text style={styles.editorLiftTabCount}>{count}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.editorLiftBlock}>
              <Text style={styles.editorLiftLabel}>{activeLiftMeta.label}</Text>
              {[0, 1, 2].map((index) => (
                <TextInput
                  key={`${activeLift}-${index}`}
                  value={draft[activeLift][index]}
                  onChangeText={(value) => onChange(activeLift, index, value)}
                  placeholder={index === 0 ? `${activeLiftMeta.label} priority` : 'Optional cue'}
                  placeholderTextColor={colors.subtle}
                  maxLength={240}
                  style={styles.focusInput}
                  returnKeyType={index === 2 ? 'done' : 'next'}
                />
              ))}
            </View>
            {error ? <Text style={styles.editorError}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.editorActions}>
            <TouchableOpacity style={styles.editorSecondaryButton} onPress={onClose} activeOpacity={0.78}>
              <Text style={styles.editorSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editorPrimaryButton, saving && styles.editorButtonDisabled]}
              onPress={onSave}
              activeOpacity={0.78}
              disabled={saving}
            >
              <Text style={styles.editorPrimaryText}>{saving ? 'Saving...' : 'Save Focus'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function focusTone(lift: string) {
  if (lift === 'BN') return { color: colors.cyan, bg: SLColors.infoSoft };
  if (lift === 'DL') return { color: colors.pink, bg: SLColors.dangerSoft };
  return { color: colors.violetStrong, bg: SLColors.accentSoft };
}

function focusIcon(lift: string): keyof typeof Ionicons.glyphMap {
  if (lift === 'BN') return 'barbell-outline';
  if (lift === 'DL') return 'walk-outline';
  return 'body-outline';
}

function historyTone(index: number) {
  const tones = [
    { color: colors.violetStrong, bg: SLColors.surfaceMuted },
    { color: colors.cyan, bg: SLColors.infoSoft },
    { color: colors.pink, bg: SLColors.dangerSoft },
    { color: colors.amber, bg: SLColors.warningSoft },
  ];
  return tones[index % tones.length];
}

function formatDisplayDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingTop: 12,
    paddingBottom: 32,
    gap: 18,
  },
  header: {
    minHeight: 172,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceStrong,
  },
  headerImage: {
    minHeight: 172,
    justifyContent: 'flex-end',
  },
  headerImageAsset: {
    opacity: 0.48,
  },
  headerImageDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,10,9,0.46)',
  },
  headerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,5,8,0.62)',
  },
  headerCopy: {
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 20,
  },
  title: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 38,
    lineHeight: 43,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.cardTitle.fontSize,
    color: colors.muted,
  },
  panel: {
    gap: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.radiusCard,
    padding: 18,
    backgroundColor: colors.surface,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconViolet: {
    backgroundColor: colors.violetSoft,
  },
  sectionIconAmber: {
    backgroundColor: 'rgba(243,190,85,0.14)',
  },
  panelKicker: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.text,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  textButton: {
    minHeight: 30,
    justifyContent: 'center',
  },
  textButtonText: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.body.fontSize,
    color: colors.violetStrong,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  focusList: {
    gap: 0,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  focusIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusCopy: {
    flex: 1,
    gap: 4,
  },
  focusTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    color: colors.textStrong,
  },
  focusBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 20,
    color: colors.muted,
  },
  emptyState: {
    gap: 7,
    paddingVertical: 8,
  },
  emptyTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    color: colors.textStrong,
  },
  emptyBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    color: colors.muted,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 36,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.md,
    backgroundColor: SLColors.accent,
    borderWidth: 1,
    borderColor: SLColors.accent,
  },
  emptyButtonText: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.label.fontSize,
    color: SLColors.textInverted,
  },
  historyRail: {
    gap: 12,
    paddingRight: 4,
  },
  historyCard: {
    width: 190,
    minHeight: 244,
    borderWidth: 1,
    borderRadius: SLRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceStrong,
  },
  historyMemory: {
    height: 116,
    padding: 14,
    justifyContent: 'space-between',
  },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySignalLine: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  historyCardCopy: {
    gap: 6,
    padding: 14,
  },
  historyTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.sectionTitle.fontSize,
    lineHeight: 23,
    color: colors.textStrong,
  },
  historyDate: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.rowTitle.fontSize,
    color: colors.muted,
  },
  historyDetails: {
    marginTop: 2,
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.label.fontSize,
    color: colors.text,
  },
  filmRows: {
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  filmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  filmFolderRow: {
    flexDirection: 'row',
    gap: 13,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  filmIcon: {
    width: 52,
    height: 52,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.violetSoft,
  },
  filmCopy: {
    flex: 1,
    gap: 4,
  },
  filmTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    color: colors.textStrong,
  },
  filmSubtitle: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    color: colors.muted,
  },
  folderChips: {
    gap: 8,
    paddingTop: 8,
  },
  folderChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  folderChipText: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.label.fontSize,
    color: colors.text,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  focusEditor: {
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: SLColors.surfaceInset,
    overflow: 'hidden',
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  editorTitleCopy: {
    flex: 1,
    gap: 5,
  },
  editorTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.title.fontSize,
    color: colors.textStrong,
  },
  editorBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    color: colors.muted,
  },
  editorIconButton: {
    width: 40,
    height: 40,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  editorScroll: {
    maxHeight: 460,
  },
  editorContent: {
    gap: 16,
    padding: 18,
  },
  editorLiftTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  editorLiftTab: {
    flex: 1,
    minHeight: 42,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  editorLiftTabActive: {
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.surfaceSelected,
  },
  editorLiftTabText: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.label.fontSize,
    color: colors.muted,
  },
  editorLiftTabTextActive: {
    color: colors.textStrong,
  },
  editorLiftTabCount: {
    position: 'absolute',
    top: 3,
    right: 6,
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 10,
    color: colors.violetStrong,
  },
  editorLiftBlock: {
    gap: 10,
  },
  editorLiftLabel: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.text,
    textTransform: 'uppercase',
  },
  focusInput: {
    minHeight: 50,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.body.fontSize,
    color: colors.textStrong,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  editorError: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: SLTypography.label.fontSize,
    color: SLColors.danger,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  editorSecondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  editorSecondaryText: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.body.fontSize,
    color: colors.text,
  },
  editorPrimaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.md,
    backgroundColor: colors.violetStrong,
  },
  editorPrimaryText: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.body.fontSize,
    color: SLColors.textInverted,
  },
  editorButtonDisabled: {
    opacity: 0.58,
  },
});
