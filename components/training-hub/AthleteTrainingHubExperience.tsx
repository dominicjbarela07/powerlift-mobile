import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  type ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/sl-text';
import { TrainingHubSessionPreviewBottomSheet } from '@/components/training-hub/TrainingHubSessionPreviewSheet';
import { TrainingHubMaterialSurface } from '@/components/training-hub/training-hub-material-surface';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import {
  movementCardStateAccent,
  type MovementCardMaterialState,
} from '@/lib/movement-card-material';

const PROGRAM_ART = require('@/assets/images/ledger-index-v2/ledger-hero-plate-v1.png');
const BLOCK_ART = require('@/assets/images/gym_vibe.jpg');
const BLOCK_STRENGTH_ART = require('@/assets/images/ledger-index-v2/ledger-chapter-variants-v1.png');
const BLOCK_HYPERTROPHY_ART = require('@/assets/images/ledger-index-v2/ledger-chapter-accessories-v1.png');
const BLOCK_FOUNDATION_ART = require('@/assets/images/ledger-index-v2/ledger-chapter-journey-v1.png');
const MUSCLE_ART: Record<string, ImageSourcePropType> = {
  abs: require('@/assets/images/muscle-regions/abs.png'),
  arms: require('@/assets/images/muscle-regions/arms.png'),
  biceps: require('@/assets/images/muscle-regions/biceps.png'),
  chest: require('@/assets/images/muscle-regions/chest.png'),
  core: require('@/assets/images/muscle-regions/core.png'),
  forearms: require('@/assets/images/muscle-regions/forearms.png'),
  front_delts: require('@/assets/images/muscle-regions/front-delts.png'),
  glutes: require('@/assets/images/muscle-regions/glutes.png'),
  hamstrings: require('@/assets/images/muscle-regions/hamstrings.png'),
  lats: require('@/assets/images/muscle-regions/lats.png'),
  lower_back: require('@/assets/images/muscle-regions/lower-back.png'),
  quads: require('@/assets/images/muscle-regions/quads.png'),
  rear_delts: require('@/assets/images/muscle-regions/rear-delts.png'),
  shoulders: require('@/assets/images/muscle-regions/shoulders.png'),
  traps: require('@/assets/images/muscle-regions/traps.png'),
  triceps: require('@/assets/images/muscle-regions/triceps.png'),
  upper_back: require('@/assets/images/muscle-regions/upper-back.png'),
};

export type AthleteTrainingMovement = {
  label: string;
  kind: 'core' | 'accessory';
  sets?: number | null;
  reps?: number | null;
  repsText?: string | null;
  prescription?: string | null;
  load?: string | null;
  primaryMuscleGroup?: string | null;
  secondaryMuscleGroups?: string[];
  movementFamily?: string | null;
  equipmentType?: string | null;
};

export type AthleteTrainingTopLift = {
  workoutItemId?: number | null;
  movement: string;
  weightKg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  hasPr?: boolean;
  prDelta?: number | null;
  prUnit?: string | null;
  prEventType?: string | null;
};

export type AthleteTrainingSessionRecap = {
  movementCount?: number | null;
  loggedSetCount?: number | null;
  plannedSetCount?: number | null;
  completionPercent?: number | null;
  totalVolumeKg?: number | null;
  prCount?: number | null;
  averageRpe?: number | null;
  sessionRpe?: number | null;
  topWork?: string | null;
  topLifts?: AthleteTrainingTopLift[];
};

export type AthleteTrainingSession = {
  id: number;
  title: string;
  date?: string | null;
  lifecycleStatus?: string | null;
  status: 'completed' | 'in_progress' | 'today' | 'upcoming' | 'missed' | 'moved';
  contentSummary?: string | null;
  dayLabel?: string | null;
  stateLabel?: string | null;
  movementCount?: number | null;
  accessoryCount?: number | null;
  movements?: AthleteTrainingMovement[];
  focusMuscles?: string[];
  recap?: AthleteTrainingSessionRecap | null;
};

export type AthleteTrainingDay = {
  key: string;
  date?: string | null;
  weekday: string;
  dayNumber?: string | null;
  status: 'completed' | 'in_progress' | 'today' | 'rest' | 'upcoming' | 'missed' | 'moved';
  sessions: AthleteTrainingSession[];
};

export type AthleteTrainingWeek = {
  key: string;
  number: number;
  rangeLabel: string;
  summary: string;
  current?: boolean;
  tag?: { key: string; label: string } | null;
  objective?: { text: string; updatedAt?: string | null } | null;
  days: AthleteTrainingDay[];
};

export type AthleteTrainingBlock = {
  id: number;
  name: string;
  status: 'completed' | 'current' | 'upcoming';
  currentWeek?: number | null;
  totalWeeks?: number | null;
  purpose?: string | null;
  phase?: string | null;
  dateRangeLabel?: string | null;
  progress?: number | null;
  coachContext?: string | null;
  weeks: AthleteTrainingWeek[];
};

export type AthleteTrainingProgram = {
  id: number;
  name: string;
  programType?: string | null;
  description?: string | null;
  coachName?: string | null;
  blockCount?: number | null;
  totalWeeks?: number | null;
  currentWeek?: number | null;
  progress?: number | null;
  blocks: AthleteTrainingBlock[];
};

export type AthleteTrainingHistory = {
  id: number;
  name: string;
  durationLabel?: string | null;
  completedLabel?: string | null;
};

export type AthletePreviousWeekRecap = {
  sessionsCompleted: number;
  sessionsAssigned: number;
  setsCompleted?: number | null;
  setsPlanned?: number | null;
  prCount?: number | null;
  totalVolumeKg?: number | null;
  videosReviewed?: number | null;
};

export type AthleteTrainingHubData = {
  athleteName?: string | null;
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: string | null;
  preferredUnits?: 'kg' | 'lb';
  activeProgram?: AthleteTrainingProgram | null;
  previousProgram?: AthleteTrainingHistory | null;
  connectedCoachName?: string | null;
  connectedCoachPhotoUrl?: string | null;
  connectedCoachPhotoVersion?: string | null;
  coachUpdates?: { id: number; summary: string; occurredAt?: string | null }[];
  previousWeekRecap?: AthletePreviousWeekRecap | null;
  pendingCoachChanges?: number;
};

export type AthleteTrainingHubAction =
  | { type: 'session'; id: number }
  | { type: 'block'; id: number }
  | { type: 'program-history'; id?: number }
  | { type: 'message-coach' };

export function AthleteTrainingHubExperience({
  data,
  onAction,
  initialExpandedWeekKey,
  initialSessionId,
}: {
  data: AthleteTrainingHubData;
  onAction: (action: AthleteTrainingHubAction) => void;
  initialExpandedWeekKey?: string | null;
  initialSessionId?: number | null;
}) {
  const currentBlock = data.activeProgram?.blocks.find((block) => block.status === 'current')
    || data.activeProgram?.blocks[0]
    || null;
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(currentBlock?.id ?? null);
  const selectedBlock = data.activeProgram?.blocks.find((block) => block.id === selectedBlockId) || currentBlock;
  const currentWeekKey = selectedBlock?.weeks.find((week) => week.current)?.key || null;
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(
    initialExpandedWeekKey === undefined ? currentWeekKey : initialExpandedWeekKey,
  );
  const allSessions = useMemo(
    () => data.activeProgram?.blocks.flatMap((block) => block.weeks.flatMap((week) => week.days.flatMap((day) => day.sessions))) || [],
    [data.activeProgram],
  );
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(initialSessionId ?? null);
  const selectedSession = allSessions.find((session) => session.id === selectedSessionId) || null;
  const selectedSessionContext = useMemo(() => {
    if (!selectedSessionId) return null;
    for (const block of data.activeProgram?.blocks || []) {
      for (const week of block.weeks) {
        if (week.days.some((day) => day.sessions.some((session) => session.id === selectedSessionId))) {
          return { blockName: block.name, weekNumber: week.number };
        }
      }
    }
    return null;
  }, [data.activeProgram, selectedSessionId]);

  useEffect(() => setSelectedBlockId(currentBlock?.id ?? null), [currentBlock?.id]);
  useEffect(() => {
    if (initialExpandedWeekKey === undefined) setExpandedWeekKey(currentWeekKey);
  }, [currentWeekKey, initialExpandedWeekKey, selectedBlock?.id]);

  if (!data.activeProgram) return <NoActiveProgram data={data} onAction={onAction} />;

  const program = data.activeProgram;
  const progress = clamp01(program.progress);
  return (
    <View style={styles.root}>
      <ProgramHero data={data} program={program} progress={progress} />

      <ProgramTimeline blocks={program.blocks} selectedBlockId={selectedBlock?.id} onSelect={setSelectedBlockId} />

      {selectedBlock ? (
        <BlockFocus block={selectedBlock} onOpen={() => onAction({ type: 'block', id: selectedBlock.id })} />
      ) : null}

      <Pressable
        onPress={() => onAction({ type: 'program-history' })}
        style={({ pressed }) => [styles.historyAction, pressed && styles.pressed]}
      >
        <View style={styles.historyIdentity}>
          <View style={styles.historyIcon}><Ionicons color={SLColors.text} name="book-outline" size={18} /></View>
          <View>
            <Text style={styles.historyTitle}>Program History</Text>
            <Text style={styles.historyMeta}>Review completed plans and sessions</Text>
          </View>
        </View>
        <Ionicons color={SLColors.textMuted} name="chevron-forward" size={18} />
      </Pressable>

      {data.previousWeekRecap ? (
        <LastWeekEvidence recap={data.previousWeekRecap} unit={data.preferredUnits || 'kg'} />
      ) : null}

      {data.coachUpdates?.length ? (
        <View style={styles.coachUpdates}>
          <Text style={styles.sectionKicker}>COACH UPDATES</Text>
          {data.coachUpdates.slice(0, 2).map((update) => (
            <View key={update.id} style={styles.coachUpdateRow}>
              <View style={styles.coachUpdateDot} />
              <Text style={styles.coachUpdateBody}>{update.summary}</Text>
              {update.occurredAt ? <Text style={styles.coachUpdateAge}>{formatUpdateAge(update.occurredAt)}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {selectedBlock ? (
        <View style={styles.weekStack}>
          {selectedBlock.weeks.map((week) => (
            <WeekSection
              expanded={expandedWeekKey === week.key}
              key={week.key}
              onOpenSession={setSelectedSessionId}
              onToggle={() => setExpandedWeekKey((current) => current === week.key ? null : week.key)}
              unit={data.preferredUnits || 'kg'}
              week={week}
            />
          ))}
        </View>
      ) : null}

      <TrainingHubSessionPreviewBottomSheet
        context={selectedSessionContext}
        onClose={() => setSelectedSessionId(null)}
        onOpen={() => {
          if (!selectedSession) return;
          const sessionId = selectedSession.id;
          setSelectedSessionId(null);
          requestAnimationFrame(() => onAction({ type: 'session', id: sessionId }));
        }}
        program={program}
        session={selectedSession}
        unit={data.preferredUnits || 'kg'}
      />
    </View>
  );
}

function ProgramHero({ data, program, progress }: { data: AthleteTrainingHubData; program: AthleteTrainingProgram; progress: number }) {
  return (
    <ImageBackground imageStyle={styles.programHeroImage} source={PROGRAM_ART} style={styles.programHero}>
      <LinearGradient colors={['rgba(2,2,4,0.22)', 'rgba(2,2,4,0.82)', '#030305']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.programHeroCopy}>
        <Text style={styles.sectionKicker}>CURRENT PROGRAM</Text>
        <Text numberOfLines={2} style={styles.programName}>{program.name}</Text>
        {program.coachName || data.connectedCoachName ? (
          <Text style={styles.coachLine}>Coached by {program.coachName || data.connectedCoachName}</Text>
        ) : null}
        <View style={styles.programMetaRow}>
          <Ionicons color={SLColors.textMuted} name="time-outline" size={14} />
          <Text style={styles.programMeta}>{programMeta(program)}</Text>
        </View>
      </View>
      {program.totalWeeks && program.currentWeek ? (
        <View style={styles.programProgressArea}>
          <View style={styles.progressCopy}>
            <Text style={styles.progressWeek}>Week {program.currentWeek} of {program.totalWeeks}</Text>
            <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
        </View>
      ) : null}
    </ImageBackground>
  );
}

function ProgramTimeline({ blocks, selectedBlockId, onSelect }: { blocks: AthleteTrainingBlock[]; selectedBlockId?: number; onSelect: (id: number) => void }) {
  if (!blocks.length) return null;
  return (
    <View style={styles.timeline}>
      {blocks.map((block, index) => {
        const selected = block.id === selectedBlockId;
        const complete = block.status === 'completed';
        const accent = complete ? SLColors.success : selected ? SLColors.warning : SLColors.textMuted;
        return (
          <React.Fragment key={block.id}>
            <Pressable onPress={() => onSelect(block.id)} style={({ pressed }) => [styles.timelineStep, pressed && styles.pressed]}>
              <Text numberOfLines={1} style={[styles.timelineName, selected && styles.timelineNameSelected]}>{shortBlockName(block.name)}</Text>
              <View style={[styles.timelineNode, { borderColor: accent }, complete && styles.timelineNodeComplete]}>
                {complete ? <Ionicons color="#06110A" name="checkmark" size={11} /> : selected ? <View style={styles.timelineNodeCurrent} /> : null}
              </View>
              <Text style={[styles.timelineState, { color: accent }]}>{complete ? 'COMPLETED' : selected ? 'YOU ARE HERE' : 'UPCOMING'}</Text>
            </Pressable>
            {index < blocks.length - 1 ? <View style={[styles.timelineConnector, complete && styles.timelineConnectorComplete]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function BlockFocus({ block, onOpen }: { block: AthleteTrainingBlock; onOpen: () => void }) {
  const progress = clamp01(block.progress ?? (block.currentWeek && block.totalWeeks ? block.currentWeek / block.totalWeeks : 0));
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.blockFocus, pressed && styles.pressed]}>
      <ImageBackground imageStyle={styles.blockImage} source={blockArtwork(block)} style={styles.blockImageArea}>
        <LinearGradient colors={['rgba(2,2,3,0.1)', 'rgba(2,2,3,0.86)']} style={StyleSheet.absoluteFillObject} />
      </ImageBackground>
      <View style={styles.blockCopy}>
        <Text style={styles.blockName}>{block.name}</Text>
        {block.phase || block.purpose ? <Text numberOfLines={1} style={styles.blockPhase}>{block.phase || block.purpose}</Text> : null}
        {block.currentWeek && block.totalWeeks ? <Text style={styles.blockWeek}>Week {block.currentWeek} of {block.totalWeeks}</Text> : null}
        {block.dateRangeLabel ? <Text style={styles.blockDates}>{block.dateRangeLabel}</Text> : null}
        <View style={styles.blockProgressRow}>
          <View style={styles.blockProgressTrack}><View style={[styles.blockProgressFill, { width: `${progress * 100}%` }]} /></View>
          <Text style={styles.blockProgressPercent}>{Math.round(progress * 100)}%</Text>
        </View>
      </View>
      <Ionicons color={SLColors.textMuted} name="chevron-forward" size={18} style={styles.blockChevron} />
    </Pressable>
  );
}

function LastWeekEvidence({ recap, unit }: { recap: AthletePreviousWeekRecap; unit: 'kg' | 'lb' }) {
  const setPercent = recap.setsPlanned ? Math.min(100, Math.round(((recap.setsCompleted || 0) / recap.setsPlanned) * 100)) : null;
  const sessionPercent = recap.sessionsAssigned ? Math.min(100, Math.round((recap.sessionsCompleted / recap.sessionsAssigned) * 100)) : 0;
  const completion = setPercent ?? sessionPercent;
  return (
    <TrainingHubMaterialSurface state="complete" style={styles.evidenceCard}>
      <Text style={styles.sectionKicker}>LAST WEEK SUMMARY</Text>
      <View style={styles.evidenceStrip}>
        <EvidenceMetric label="SESSIONS" value={`${recap.sessionsCompleted}/${recap.sessionsAssigned}`} />
        <EvidenceMetric label="SETS LOGGED" value={recap.setsPlanned != null ? `${recap.setsCompleted || 0}/${recap.setsPlanned}` : '—'} />
        <EvidenceMetric label="PRs" value={String(recap.prCount || 0)} />
        <EvidenceMetric label="COMPLETION" value={`${completion}%`} />
      </View>
      <View style={styles.evidenceProgress}><View style={[styles.evidenceProgressFill, { width: `${completion}%` }]} /></View>
      <View style={styles.evidenceFooter}>
        <Text style={styles.evidenceStatement}>{recap.sessionsCompleted >= recap.sessionsAssigned ? 'Every planned session finished.' : `${recap.sessionsCompleted} of ${recap.sessionsAssigned} sessions finished.`}</Text>
        {recap.totalVolumeKg ? <Text style={styles.evidenceVolume}>{formatVolume(recap.totalVolumeKg, unit)}</Text> : null}
      </View>
    </TrainingHubMaterialSurface>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.evidenceMetric}><Text style={styles.evidenceValue}>{value}</Text><Text style={styles.evidenceLabel}>{label}</Text></View>;
}

function WeekSection({ week, expanded, onToggle, onOpenSession, unit }: { week: AthleteTrainingWeek; expanded: boolean; onToggle: () => void; onOpenSession: (id: number) => void; unit: 'kg' | 'lb' }) {
  const sessions = week.days.flatMap((day) => day.sessions);
  const completed = sessions.filter((session) => session.status === 'completed').length;
  const state = week.current ? 'in_progress' : sessions.length > 0 && completed === sessions.length ? 'complete' : 'not_started';
  const accent = state === 'not_started' ? SLColors.textMuted : movementCardStateAccent(state);
  return (
    <TrainingHubMaterialSurface accentColor={accent} expanded={expanded} state={state} style={expanded ? styles.weekExpanded : styles.weekCollapsed}>
      <Pressable onPress={onToggle} style={({ pressed }) => [styles.weekHeader, pressed && styles.pressed]}>
        <View style={styles.weekHeaderCopy}>
          <Text style={[styles.weekTitle, week.current && { color: accent }]}>WEEK {week.number}</Text>
          <Text style={styles.weekRange}>{formatWeekRangeLabel(week.rangeLabel)}</Text>
        </View>
        <View style={styles.weekHeaderStatus}>
          <Text style={styles.weekCount}>{sessions.length ? `${sessions.length} Session${sessions.length === 1 ? '' : 's'}` : 'No Sessions planned'}</Text>
          {state === 'complete' ? <View style={styles.completeCheck}><Ionicons color="#07120B" name="checkmark" size={15} /></View> : <Ionicons color={SLColors.textMuted} name={expanded ? 'chevron-up' : 'chevron-forward'} size={17} />}
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.weekBody}>
          {week.objective ? <View style={styles.weekObjective}><Text style={styles.weekObjectiveKicker}>COACH FOCUS</Text><Text style={styles.weekObjectiveText}>{week.objective.text}</Text></View> : null}
          <View style={styles.dayStrip}>
            {week.days.slice(0, 7).map((day) => <DayChip day={day} key={day.key} />)}
          </View>
          <View style={styles.sessionStack}>
            {sessions.map((session) => <SessionCard key={session.id} onPress={() => onOpenSession(session.id)} session={session} unit={unit} />)}
            {!sessions.length ? <Text style={styles.emptyWeekText}>Recovery and mobility. No training Session is planned.</Text> : null}
          </View>
        </View>
      ) : null}
    </TrainingHubMaterialSurface>
  );
}

function DayChip({ day }: { day: AthleteTrainingDay }) {
  const status = day.sessions[0]?.status || day.status;
  const completed = status === 'completed';
  const today = status === 'today' || day.status === 'today';
  return (
    <View style={[styles.dayChip, completed && styles.dayChipComplete, today && styles.dayChipToday]}>
      <Text style={[styles.dayChipWeekday, today && styles.dayChipTextToday]}>{day.weekday}</Text>
      <Text style={[styles.dayChipNumber, today && styles.dayChipTextToday]}>{day.dayNumber || '—'}</Text>
      <View style={[styles.dayChipDot, completed && styles.dayChipDotComplete, status === 'upcoming' && styles.dayChipDotUpcoming, status === 'missed' && styles.dayChipDotMissed]} />
    </View>
  );
}

function SessionCard({ session, onPress, unit }: { session: AthleteTrainingSession; onPress: () => void; unit: 'kg' | 'lb' }) {
  const completed = session.status === 'completed';
  const active = session.status === 'in_progress' || session.status === 'today';
  const accent = completed ? SLColors.success : active ? SLColors.warning : SLColors.accentViolet;
  const recap = session.recap;
  const metric = completed && recap
    ? [recap.loggedSetCount ? `${recap.loggedSetCount} sets` : null, recap.totalVolumeKg ? formatVolume(recap.totalVolumeKg, unit) : null].filter(Boolean).join(' · ')
    : session.contentSummary;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sessionCard, { borderLeftColor: accent }, pressed && styles.pressed]}>
      <Image source={sessionArtwork(session)} style={styles.sessionArtwork} />
      <View style={styles.sessionCopy}>
        <View style={styles.sessionTitleRow}>
          <Text numberOfLines={1} style={styles.sessionTitle}>{session.title}</Text>
          {completed ? <Ionicons color={SLColors.success} name="checkmark-circle-outline" size={18} /> : null}
        </View>
        {session.focusMuscles?.length ? <Text numberOfLines={1} style={styles.sessionFocus}>{session.focusMuscles.slice(0, 3).map(humanizeMuscle).join(' · ')}</Text> : null}
        {metric ? <Text numberOfLines={1} style={styles.sessionMetric}>{metric}</Text> : null}
        <View style={styles.sessionStateRow}>
          <Text style={styles.sessionDay}>{session.dayLabel}</Text>
          <Text style={[styles.sessionState, { color: accent }]}>{session.stateLabel}</Text>
          {completed && recap?.prCount ? <View style={styles.prBadge}><Text style={styles.prBadgeText}>{recap.prCount} PR{recap.prCount === 1 ? '' : 's'}</Text></View> : null}
        </View>
      </View>
      <View style={[styles.sessionAction, { borderColor: colorWithAlpha(accent, 0.55) }]}>
        <Text style={[styles.sessionActionText, { color: accent }]}>{completed ? 'View' : active ? 'Resume' : 'Open'}</Text>
      </View>
    </Pressable>
  );
}

function SessionPreviewSheet({ session, program, onClose, onOpen, unit }: { session: AthleteTrainingSession | null; program: AthleteTrainingProgram; onClose: () => void; onOpen: () => void; unit: 'kg' | 'lb' }) {
  const insets = useSafeAreaInsets();
  if (!session) return null;
  const completed = session.status === 'completed';
  const accent = completed ? SLColors.success : session.status === 'in_progress' ? SLColors.warning : SLColors.accentViolet;
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen" visible>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.modalSafe}>
        <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          <View style={styles.modalHeader}>
            <Pressable accessibilityLabel="Close Session preview" onPress={onClose} style={styles.modalClose}><Ionicons color={SLColors.text} name="chevron-back" size={24} /></Pressable>
            <View style={styles.modalHeaderCopy}><Text style={styles.modalBrand}>STRENGTH</Text><Text style={styles.modalBrandSub}>— LEDGER —</Text></View>
            <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.modalClose}><Ionicons color={SLColors.text} name="close" size={23} /></Pressable>
          </View>
          <ImageBackground imageStyle={styles.previewHeroImage} source={sessionArtwork(session)} style={styles.previewHero}>
            <LinearGradient colors={['rgba(2,2,4,0.15)', '#030305']} style={StyleSheet.absoluteFillObject} />
            <View style={styles.previewStatus}><Text style={[styles.previewStatusText, { color: accent }]}>{session.stateLabel || (completed ? 'COMPLETED' : 'UPCOMING')}</Text></View>
          </ImageBackground>
          <Text style={[styles.previewDate, { color: accent }]}>{formatLongDate(session.date)}</Text>
          <Text style={styles.previewTitle}>{session.title}</Text>
          <Text style={styles.previewMeta}>{session.movementCount || session.movements?.length || 0} movements · {program.name}</Text>

          {completed ? <CompletedEvidence session={session} unit={unit} /> : <PlannedPreview session={session} />}

          {session.focusMuscles?.length ? (
            <View style={styles.focusSection}>
              <Text style={styles.sectionKicker}>FOCUS MUSCLES</Text>
              <View style={styles.focusArtworkRow}>
                {session.focusMuscles.slice(0, 3).map((muscle) => (
                  <View key={muscle} style={styles.focusArtworkCard}>
                    <Image source={muscleArtwork(muscle)} style={styles.focusArtwork} />
                    <Text numberOfLines={1} style={styles.focusArtworkLabel}>{humanizeMuscle(muscle)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable onPress={onOpen} style={({ pressed }) => [styles.primaryAction, completed && styles.completedAction, pressed && styles.pressed]}>
            <Text style={styles.primaryActionText}>{completed ? 'View Session Recap' : session.status === 'in_progress' ? 'Resume Session' : 'Open Session'}</Text>
            <Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PlannedPreview({ session }: { session: AthleteTrainingSession }) {
  const rows = session.movements || [];
  return (
    <View style={styles.previewSection}>
      <Text style={styles.sectionKicker}>SESSION PREVIEW</Text>
      <View style={styles.previewMovementList}>
        {rows.slice(0, 5).map((movement, index) => (
          <View key={`${movement.label}-${index}`} style={styles.previewMovementRow}>
            <Text style={styles.previewMovementNumber}>{index + 1}</Text>
            <View style={styles.previewMovementCopy}>
              <Text style={styles.previewMovementName}>{movement.label}</Text>
              <Text style={styles.previewMovementPrescription}>{movement.prescription || (movement.sets ? `${movement.sets} sets` : 'Programmed movement')}</Text>
            </View>
          </View>
        ))}
        {rows.length > 5 ? <Text style={styles.moreMovements}>＋ {rows.length - 5} more movements</Text> : null}
      </View>
    </View>
  );
}

function CompletedEvidence({ session, unit }: { session: AthleteTrainingSession; unit: 'kg' | 'lb' }) {
  const recap = session.recap;
  if (!recap) return null;
  return (
    <View style={styles.previewSection}>
      <Text style={styles.sectionKicker}>SESSION HIGHLIGHTS</Text>
      <View style={styles.completedMetrics}>
        <EvidenceMetric label="PRs" value={String(recap.prCount || 0)} />
        <EvidenceMetric label="SESSION RPE" value={recap.sessionRpe != null ? String(recap.sessionRpe) : '—'} />
        <EvidenceMetric label="PLANNED SETS" value={recap.completionPercent != null ? `${recap.completionPercent}%` : '—'} />
      </View>
      {recap.totalVolumeKg ? <Text style={styles.completedVolume}>{formatVolume(recap.totalVolumeKg, unit)} total volume</Text> : null}
      {recap.topLifts?.length ? (
        <View style={styles.topLiftList}>
          <Text style={styles.sectionKicker}>TOP LIFTS</Text>
          {recap.topLifts.slice(0, 4).map((lift) => (
            <View key={`${lift.workoutItemId}-${lift.movement}`} style={styles.topLiftRow}>
              <View style={styles.topLiftCopy}>
                <View style={styles.topLiftTitleRow}><Text style={styles.topLiftName}>{lift.movement}</Text>{lift.hasPr ? <View style={styles.prBadge}><Text style={styles.prBadgeText}>PR</Text></View> : null}</View>
                <Text style={styles.topLiftResult}>{formatSet(lift, unit)}</Text>
                {formatPrDelta(lift, unit) ? <Text style={styles.topLiftDelta}>{formatPrDelta(lift, unit)}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NoActiveProgram({ data, onAction }: { data: AthleteTrainingHubData; onAction: (action: AthleteTrainingHubAction) => void }) {
  return (
    <View style={styles.root}>
      <ImageBackground imageStyle={styles.noProgramImage} source={BLOCK_ART} style={styles.noProgramHero}>
        <LinearGradient colors={['rgba(2,2,4,0.2)', '#030305']} style={StyleSheet.absoluteFillObject} />
        <Text style={styles.sectionKicker}>TRAINING HUB</Text>
        <Text style={styles.noProgramTitle}>Your next program will live here.</Text>
        <Text style={styles.noProgramBody}>{data.connectedCoachName ? `${data.connectedCoachName} is preparing what comes next.` : 'Connect with a coach or create a plan to begin.'}</Text>
      </ImageBackground>
      {data.connectedCoachName ? <Pressable onPress={() => onAction({ type: 'message-coach' })} style={styles.primaryAction}><Text style={styles.primaryActionText}>Message Coach</Text><Ionicons color="#FFFFFF" name="arrow-forward" size={19} /></Pressable> : null}
      {data.previousProgram ? <Pressable onPress={() => onAction({ type: 'program-history', id: data.previousProgram?.id })} style={styles.historyAction}><View><Text style={styles.sectionKicker}>PROGRAM HISTORY</Text><Text style={styles.historyTitle}>{data.previousProgram.name}</Text><Text style={styles.historyMeta}>{[data.previousProgram.durationLabel, data.previousProgram.completedLabel].filter(Boolean).join(' · ')}</Text></View><Ionicons color={SLColors.textMuted} name="chevron-forward" size={18} /></Pressable> : null}
    </View>
  );
}

function sessionArtwork(session: AthleteTrainingSession): ImageSourcePropType {
  const focus = session.focusMuscles?.find((key) => MUSCLE_ART[normalizeMuscleKey(key)]);
  return focus ? MUSCLE_ART[normalizeMuscleKey(focus)] : BLOCK_ART;
}
function blockArtwork(block: AthleteTrainingBlock): ImageSourcePropType {
  const identity = `${block.name} ${block.phase || ''} ${block.purpose || ''}`.toLowerCase();
  if (/(hypertrophy|bodybuild|offseason|accessor|volume)/.test(identity)) return BLOCK_HYPERTROPHY_ART;
  if (/(strength|power|peak|competition|intens)/.test(identity)) return BLOCK_STRENGTH_ART;
  if (/(base|foundation|recovery|return|reverse|rebuild)/.test(identity)) return BLOCK_FOUNDATION_ART;
  return BLOCK_ART;
}
function muscleArtwork(value: string) { return MUSCLE_ART[normalizeMuscleKey(value)] || BLOCK_ART; }
function normalizeMuscleKey(value: string) { return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_'); }
function humanizeMuscle(value: string) { return normalizeMuscleKey(value).split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' '); }
function shortBlockName(value: string) { return String(value || 'Block').replace(/\s+Block$/i, ''); }
function clamp01(value?: number | null) { return Math.max(0, Math.min(1, Number(value || 0))); }
function programMeta(program: AthleteTrainingProgram) { return [program.blockCount ? `${program.blockCount} Blocks` : null, program.totalWeeks ? `${program.totalWeeks} Weeks` : null].filter(Boolean).join(' · ') || 'Program schedule'; }
function formatWeekRangeLabel(value: string) { return String(value || '').replace(/\s+-\s+/g, ' – '); }
function formatLongDate(value?: string | null) { if (!value) return 'SESSION'; const date = new Date(`${value}T12:00:00`); return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase() : value.toUpperCase(); }
function formatUpdateAge(value: string) { const elapsed = Date.now() - new Date(value).getTime(); if (!Number.isFinite(elapsed)) return ''; const days = Math.max(0, Math.floor(elapsed / 86400000)); return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d`; }
function kgToUnit(value: number, unit: 'kg' | 'lb') { return unit === 'lb' ? value * 2.2046226218 : value; }
function formatVolume(valueKg: number, unit: 'kg' | 'lb') { const value = kgToUnit(valueKg, unit); const suffix = unit === 'lb' ? 'lb' : 'kg'; return value >= 10000 ? `${(value / 1000).toFixed(1)}K ${suffix}` : `${Math.round(value).toLocaleString()} ${suffix}`; }
function formatSet(lift: AthleteTrainingTopLift, unit: 'kg' | 'lb') { const load = lift.weightKg != null ? `${Math.round(kgToUnit(lift.weightKg, unit))} ${unit}` : 'Load not recorded'; const reps = lift.reps != null ? ` × ${lift.reps}` : ''; const rpe = lift.rpe != null ? ` @ ${lift.rpe}` : ''; return `${load}${reps}${rpe}`; }
function formatPrDelta(lift: AthleteTrainingTopLift, unit: 'kg' | 'lb') { if (!lift.hasPr || lift.prDelta == null || Number(lift.prDelta) <= 0) return null; const sourceUnit = String(lift.prUnit || '').toLowerCase(); const sourceValue = Number(lift.prDelta); const displayValue = unit === 'lb' && sourceUnit === 'kg' ? sourceValue * 2.2046226218 : unit === 'kg' && sourceUnit.startsWith('lb') ? sourceValue / 2.2046226218 : sourceValue; const suffix = /e1rm/i.test(String(lift.prEventType || '')) ? ' e1RM' : ''; return `+${Math.round(displayValue)} ${unit}${suffix}`; }
function colorWithAlpha(color: string, alpha: number) { const match = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return match ? `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${alpha})` : color; }

const styles = StyleSheet.create({
  root: { width: '100%', gap: 12, backgroundColor: '#000000' },
  pressed: { opacity: 0.76 },
  sectionKicker: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.65 },
  programHero: { minHeight: 228, justifyContent: 'flex-end', overflow: 'hidden', borderBottomWidth: 1, borderColor: SLColors.borderSubtle },
  programHeroImage: { resizeMode: 'cover', opacity: 0.76 },
  programHeroCopy: { paddingHorizontal: 16, paddingTop: 72, gap: 4 },
  programName: { ...SLTypography.title, color: '#FFFFFF', fontSize: 27, lineHeight: 30 },
  coachLine: { ...SLTypography.body, color: '#C8B5E9' },
  programMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  programMeta: { ...SLTypography.caption, color: SLColors.textMuted },
  programProgressArea: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 15, gap: 8 },
  progressCopy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressWeek: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  progressPercent: { ...SLTypography.bodyStrong, color: SLColors.accentViolet },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#18151D', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: SLColors.accentViolet },
  timeline: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: SLColors.borderSubtle },
  timelineStep: { flex: 1, alignItems: 'center', gap: 4, zIndex: 1 },
  timelineName: { ...SLTypography.micro, color: SLColors.textMuted, textTransform: 'uppercase' },
  timelineNameSelected: { color: SLColors.textStrong },
  timelineNode: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, backgroundColor: '#050506', alignItems: 'center', justifyContent: 'center' },
  timelineNodeComplete: { backgroundColor: SLColors.success },
  timelineNodeCurrent: { width: 7, height: 7, borderRadius: 4, backgroundColor: SLColors.warning },
  timelineState: { fontSize: 8, lineHeight: 10, fontWeight: '700', letterSpacing: 0.35 },
  timelineConnector: { height: 1, flex: 0.28, marginHorizontal: -13, marginBottom: 11, backgroundColor: '#343039' },
  timelineConnectorComplete: { backgroundColor: colorWithAlpha(SLColors.success, 0.7) },
  blockFocus: { marginHorizontal: 8, minHeight: 148, borderRadius: SLRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#4C4028', backgroundColor: '#080808', flexDirection: 'row', alignItems: 'stretch' },
  blockImageArea: { width: '42%' },
  blockImage: { resizeMode: 'cover', opacity: 0.88 },
  blockCopy: { flex: 1, padding: 14, justifyContent: 'center', gap: 3 },
  blockName: { ...SLTypography.sectionTitle, fontSize: 21, lineHeight: 24, color: '#FFFFFF', textTransform: 'uppercase' },
  blockPhase: { ...SLTypography.micro, color: SLColors.warning, textTransform: 'uppercase' },
  blockWeek: { ...SLTypography.bodyStrong, color: SLColors.textStrong, marginTop: 5 },
  blockDates: { ...SLTypography.caption, color: SLColors.textMuted },
  blockProgressRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockProgressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#1E1A12', overflow: 'hidden' },
  blockProgressFill: { height: '100%', backgroundColor: SLColors.warning },
  blockProgressPercent: { ...SLTypography.micro, color: SLColors.textMuted },
  blockChevron: { alignSelf: 'center', marginRight: 9 },
  historyAction: { marginHorizontal: 8, minHeight: 58, borderWidth: 1, borderColor: SLColors.borderSubtle, borderRadius: SLRadius.md, backgroundColor: '#08090C', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, gap: 12 },
  historyIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#121019', alignItems: 'center', justifyContent: 'center' },
  historyTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  historyMeta: { ...SLTypography.micro, color: SLColors.textMuted, marginTop: 2 },
  evidenceCard: { marginHorizontal: 8, padding: 13, gap: 11 },
  evidenceStrip: { flexDirection: 'row', alignItems: 'stretch' },
  evidenceMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderRightWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  evidenceValue: { fontSize: 20, lineHeight: 23, fontWeight: '700', color: '#FFFFFF' },
  evidenceLabel: { fontSize: 8, lineHeight: 10, fontWeight: '700', color: SLColors.textMuted, textAlign: 'center', marginTop: 3 },
  evidenceProgress: { height: 7, borderRadius: 4, backgroundColor: '#0A1710', overflow: 'hidden' },
  evidenceProgressFill: { height: '100%', borderRadius: 4, backgroundColor: SLColors.success },
  evidenceFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  evidenceStatement: { ...SLTypography.caption, color: SLColors.textMuted, flex: 1 },
  evidenceVolume: { ...SLTypography.caption, color: SLColors.success },
  coachUpdates: { marginHorizontal: 12, gap: 7, paddingVertical: 4 },
  coachUpdateRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  coachUpdateDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: SLColors.accentViolet },
  coachUpdateBody: { ...SLTypography.caption, color: SLColors.text, flex: 1 },
  coachUpdateAge: { ...SLTypography.micro, color: SLColors.textMuted },
  weekStack: { gap: 9, paddingHorizontal: 8, paddingBottom: 8 },
  weekCollapsed: { paddingHorizontal: 13, paddingVertical: 12 },
  weekExpanded: { padding: 0, overflow: 'hidden' },
  weekHeader: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  weekHeaderCopy: { flex: 1, gap: 2 },
  weekTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  weekRange: { ...SLTypography.micro, color: SLColors.textMuted },
  weekHeaderStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekCount: { ...SLTypography.caption, color: SLColors.textMuted },
  completeCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: SLColors.success, alignItems: 'center', justifyContent: 'center' },
  weekBody: { borderTopWidth: 1, borderColor: SLColors.borderSubtle, padding: 10, gap: 10 },
  weekObjective: { borderLeftWidth: 2, borderColor: SLColors.accentViolet, paddingLeft: 9, gap: 2 },
  weekObjectiveKicker: { ...SLTypography.micro, color: SLColors.accentViolet },
  weekObjectiveText: { ...SLTypography.caption, color: SLColors.text },
  dayStrip: { flexDirection: 'row', gap: 5 },
  dayChip: { flex: 1, minWidth: 0, height: 53, borderRadius: 8, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: '#07080A', alignItems: 'center', justifyContent: 'center', gap: 1 },
  dayChipComplete: { backgroundColor: '#07120C', borderColor: '#1B5131' },
  dayChipToday: { borderColor: SLColors.warning, backgroundColor: '#181307' },
  dayChipWeekday: { fontSize: 9, lineHeight: 11, color: SLColors.textMuted },
  dayChipNumber: { fontSize: 14, lineHeight: 17, fontWeight: '700', color: SLColors.text },
  dayChipTextToday: { color: SLColors.warning },
  dayChipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#484550' },
  dayChipDotComplete: { backgroundColor: SLColors.success },
  dayChipDotUpcoming: { backgroundColor: SLColors.accentViolet },
  dayChipDotMissed: { backgroundColor: SLColors.danger },
  sessionStack: { gap: 7 },
  sessionCard: { minHeight: 82, borderRadius: 10, borderWidth: 1, borderLeftWidth: 3, borderColor: SLColors.borderSubtle, backgroundColor: '#090A0D', padding: 7, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sessionArtwork: { width: 66, height: 66, borderRadius: 8, resizeMode: 'cover', backgroundColor: '#0A0A0D' },
  sessionCopy: { flex: 1, minWidth: 0, gap: 2 },
  sessionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sessionTitle: { ...SLTypography.bodyStrong, color: '#FFFFFF', flex: 1 },
  sessionFocus: { ...SLTypography.micro, color: '#C3B2DD' },
  sessionMetric: { ...SLTypography.caption, color: SLColors.textMuted },
  sessionStateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  sessionDay: { ...SLTypography.micro, color: SLColors.textMuted },
  sessionState: { ...SLTypography.micro, fontWeight: '700' },
  sessionAction: { minWidth: 50, height: 30, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  sessionActionText: { ...SLTypography.micro, fontWeight: '700' },
  prBadge: { minHeight: 19, paddingHorizontal: 6, borderRadius: 6, backgroundColor: '#3A133D', borderWidth: 1, borderColor: '#9D4AA4', alignItems: 'center', justifyContent: 'center' },
  prBadgeText: { fontSize: 9, lineHeight: 11, fontWeight: '800', color: '#F0A9F5' },
  emptyWeekText: { ...SLTypography.caption, color: SLColors.textMuted, paddingVertical: 10, textAlign: 'center' },
  modalSafe: { flex: 1, backgroundColor: '#000000' },
  modalContent: { backgroundColor: '#000000' },
  modalHeader: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderColor: SLColors.borderSubtle },
  modalClose: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: '#08090C', alignItems: 'center', justifyContent: 'center' },
  modalHeaderCopy: { alignItems: 'center' },
  modalBrand: { fontSize: 13, lineHeight: 15, fontWeight: '800', letterSpacing: 2.1, color: '#FFFFFF' },
  modalBrandSub: { fontSize: 8, lineHeight: 10, letterSpacing: 2.2, color: SLColors.accentViolet },
  previewHero: { height: 210, justifyContent: 'flex-start', alignItems: 'flex-end', padding: 12 },
  previewHeroImage: { resizeMode: 'cover', opacity: 0.88 },
  previewStatus: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: 'rgba(10,8,13,0.88)', borderWidth: 1, borderColor: SLColors.borderSubtle },
  previewStatusText: { ...SLTypography.micro, fontWeight: '800' },
  previewDate: { ...SLTypography.micro, marginHorizontal: 16, marginTop: 2, letterSpacing: 0.6 },
  previewTitle: { ...SLTypography.title, color: '#FFFFFF', marginHorizontal: 16, marginTop: 4 },
  previewMeta: { ...SLTypography.body, color: SLColors.textMuted, marginHorizontal: 16, marginTop: 4 },
  previewSection: { margin: 14, padding: 12, borderWidth: 1, borderColor: SLColors.borderSubtle, borderRadius: SLRadius.md, backgroundColor: '#07080B', gap: 10 },
  previewMovementList: { gap: 1 },
  previewMovementRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  previewMovementNumber: { width: 22, fontSize: 16, fontWeight: '800', color: SLColors.textMuted, textAlign: 'center' },
  previewMovementCopy: { flex: 1, gap: 2 },
  previewMovementName: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  previewMovementPrescription: { ...SLTypography.caption, color: SLColors.textMuted },
  moreMovements: { ...SLTypography.caption, color: SLColors.textMuted, paddingTop: 10 },
  focusSection: { marginHorizontal: 14, gap: 9 },
  focusArtworkRow: { flexDirection: 'row', gap: 8 },
  focusArtworkCard: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: '#08090C', overflow: 'hidden' },
  focusArtwork: { width: '100%', aspectRatio: 0.95, resizeMode: 'contain', backgroundColor: '#030304' },
  focusArtworkLabel: { ...SLTypography.micro, color: SLColors.text, textAlign: 'center', padding: 7 },
  completedMetrics: { flexDirection: 'row', minHeight: 60 },
  completedVolume: { ...SLTypography.bodyStrong, color: SLColors.success },
  topLiftList: { gap: 2, marginTop: 4 },
  topLiftRow: { minHeight: 54, borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle, justifyContent: 'center' },
  topLiftCopy: { gap: 2 },
  topLiftTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topLiftName: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  topLiftResult: { ...SLTypography.caption, color: SLColors.textMuted },
  topLiftDelta: { ...SLTypography.caption, color: SLColors.success, marginTop: 1 },
  primaryAction: { marginHorizontal: 14, marginTop: 16, minHeight: 52, borderRadius: 10, backgroundColor: '#56239A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  completedAction: { backgroundColor: '#185B32' },
  primaryActionText: { ...SLTypography.bodyStrong, color: '#FFFFFF' },
  noProgramHero: { minHeight: 300, justifyContent: 'flex-end', padding: 18, gap: 8, borderBottomWidth: 1, borderColor: SLColors.borderSubtle },
  noProgramImage: { resizeMode: 'cover', opacity: 0.8 },
  noProgramTitle: { ...SLTypography.title, color: '#FFFFFF' },
  noProgramBody: { ...SLTypography.body, color: SLColors.textMuted },
});
