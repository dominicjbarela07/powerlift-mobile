import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { TrainingHubSessionPreviewBottomSheet } from '@/components/training-hub/TrainingHubSessionPreviewSheet';
import { TrainingHubMaterialSurface } from '@/components/training-hub/training-hub-material-surface';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import { formatSessionVolumeSummary, formatTotalVolumeFromKg } from '@/lib/display-units';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';

const PROGRAM_ART = require('@/assets/images/ledger-index-v2/ledger-hero-plate-v1.png');
const BLOCK_ART = require('@/assets/images/gym_vibe.jpg');
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
  muscleFocus?: {
    primary: string[];
    secondary: string[];
    source?: string | null;
  } | null;
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
  athleteSex?: string | null;
  anatomyDisplayPreference?: string | null;
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
  | { type: 'program-timeline'; id: number }
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
  const { unit, setUnit } = useSurfaceWeightUnit(data.preferredUnits);
  const program = data.activeProgram;
  const currentBlock = program?.blocks.find((block) => block.status === 'current') || program?.blocks[0] || null;
  const initialBlock = program?.blocks.find((block) => block.weeks.some((week) => week.key === initialExpandedWeekKey)) || currentBlock;
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(initialBlock?.id ?? null);
  const selectedBlock = program?.blocks.find((block) => block.id === selectedBlockId) || currentBlock;
  const currentWeekKey = selectedBlock?.weeks.find((week) => week.current)?.key || selectedBlock?.weeks[0]?.key || null;
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(initialExpandedWeekKey || currentWeekKey);
  const selectedWeek = selectedBlock?.weeks.find((week) => week.key === selectedWeekKey)
    || selectedBlock?.weeks.find((week) => week.current)
    || selectedBlock?.weeks[0]
    || null;
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const allSessions = useMemo(
    () => program?.blocks.flatMap((block) => block.weeks.flatMap((week) => week.days.flatMap((day) => day.sessions))) || [],
    [program],
  );
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(initialSessionId ?? null);
  const selectedSession = allSessions.find((session) => session.id === selectedSessionId) || null;
  const selectedSessionContext = useMemo(() => {
    if (!selectedSessionId) return null;
    for (const block of program?.blocks || []) {
      for (const week of block.weeks) {
        if (week.days.some((day) => day.sessions.some((session) => session.id === selectedSessionId))) {
          return { blockName: block.name, weekNumber: week.number };
        }
      }
    }
    return null;
  }, [program, selectedSessionId]);

  useEffect(() => {
    setSelectedBlockId((id) => program?.blocks.some((block) => block.id === id) ? id : currentBlock?.id ?? null);
  }, [currentBlock?.id, program?.id]);
  useEffect(() => {
    setSelectedWeekKey((key) => selectedBlock?.weeks.some((week) => week.key === key) ? key : currentWeekKey);
  }, [selectedBlock?.id, currentWeekKey]);
  useEffect(() => {
    setSelectedDayKey((key) => selectedWeek?.days.some((day) => day.key === key)
      ? key
      : selectedWeek?.days.find((day) => day.status === 'today')?.key || selectedWeek?.days[0]?.key || null);
  }, [selectedWeek?.key]);

  if (!program) return <NoActiveProgram data={data} onAction={onAction} />;

  const selectWeek = (index: number) => {
    const week = selectedBlock?.weeks[index];
    if (!week) return;
    setSelectedWeekKey(week.key);
    setSelectedDayKey(week.days.find((day) => day.status === 'today')?.key || week.days[0]?.key || null);
  };
  const selectedWeekIndex = selectedBlock?.weeks.findIndex((week) => week.key === selectedWeek?.key) ?? -1;
  const selectedDay = selectedWeek?.days.find((day) => day.key === selectedDayKey) || null;
  return (
    <View style={styles.root}>
      <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} testID="training-hub-unit-toggle" />
      <ProgramHero data={data} program={program} progress={clamp01(program.progress)} />
      {selectedBlock ? (
        <TrainingPosition
          block={selectedBlock}
          onOpenBlock={() => onAction({ type: 'block', id: selectedBlock.id })}
          onOpenMap={() => onAction({ type: 'program-timeline', id: program.id })}
        />
      ) : null}
      {selectedWeek ? (
        <>
          <TrainingWeekNavigation
            canNext={selectedWeekIndex < (selectedBlock?.weeks.length || 0) - 1}
            canPrevious={selectedWeekIndex > 0}
            onNext={() => selectWeek(selectedWeekIndex + 1)}
            onPrevious={() => selectWeek(selectedWeekIndex - 1)}
            onSelectDay={setSelectedDayKey}
            selectedDayKey={selectedDayKey}
            week={selectedWeek}
          />
          <TrainingSessionSequence
            onOpenSession={setSelectedSessionId}
            selectedDay={selectedDay}
            unit={unit}
            week={selectedWeek}
          />
        </>
      ) : <View style={styles.noWeek}><Text style={styles.noWeekText}>No Weeks are available in this Block.</Text></View>}
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
      {data.previousWeekRecap ? <LastWeekEvidence recap={data.previousWeekRecap} unit={unit} /> : null}
      <TrainingHubSessionPreviewBottomSheet
        athlete={{ sex: data.athleteSex, anatomy_display_preference: data.anatomyDisplayPreference }}
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
        unit={unit}
      />
    </View>
  );
}

function TrainingPosition({ block, onOpenBlock, onOpenMap }: { block: AthleteTrainingBlock; onOpenBlock: () => void; onOpenMap: () => void }) {
  const totalWeeks = Math.max(1, block.totalWeeks || block.weeks.length);
  const currentWeek = block.status === 'current' && block.currentWeek
    ? Math.max(1, Math.min(totalWeeks, block.currentWeek))
    : null;
  const eyebrow = block.status === 'completed' ? 'COMPLETED BLOCK' : block.status === 'upcoming' ? 'UPCOMING BLOCK' : 'CURRENT BLOCK';
  return (
    <View style={styles.position}>
      <View style={styles.positionTop}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${block.name} details`} onPress={onOpenBlock} style={styles.positionIdentity}>
          <Text style={styles.positionEyebrow}>{eyebrow}</Text>
          <Text numberOfLines={2} style={styles.positionTitle}>{block.name}</Text>
          <Text style={styles.positionMeta}>{currentWeek ? `Week ${currentWeek} of ${totalWeeks}` : `${totalWeeks}-Week Block`}{block.phase ? ` · ${block.phase}` : ''}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Program map" onPress={onOpenMap} style={styles.programMapAction} testID="training-hub-program-timeline">
          <Text style={styles.programMapText}>Program map</Text><Ionicons name="arrow-forward" size={15} color={SLColors.accentViolet} />
        </Pressable>
      </View>
      <View accessibilityLabel={currentWeek ? `Week ${currentWeek} of ${totalWeeks}` : `${eyebrow}, ${totalWeeks} Weeks`} style={styles.positionRail}>
        {Array.from({ length: totalWeeks }, (_, index) => <View key={index} style={[styles.positionSegment, (block.status === 'completed' || (currentWeek != null && index < currentWeek - 1)) && styles.positionSegmentPast, currentWeek != null && index === currentWeek - 1 && styles.positionSegmentCurrent]} />)}
      </View>
    </View>
  );
}

function TrainingWeekNavigation({ week, selectedDayKey, onSelectDay, canPrevious, canNext, onPrevious, onNext }: { week: AthleteTrainingWeek; selectedDayKey: string | null; onSelectDay: (key: string) => void; canPrevious: boolean; canNext: boolean; onPrevious: () => void; onNext: () => void }) {
  return <View style={styles.weekNavigation}>
    <View style={styles.weekNavigationTop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous Week" accessibilityState={{ disabled: !canPrevious }} disabled={!canPrevious} onPress={onPrevious} style={styles.weekArrow}><Ionicons name="chevron-back" size={19} color={canPrevious ? SLColors.textStrong : SLColors.textSubtle} /></Pressable>
      <View style={styles.weekNavigationTitle}><Text style={styles.weekNavigationName}>Week {week.number}</Text><Text style={styles.weekNavigationRange}>{formatWeekRangeLabel(week.rangeLabel)}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next Week" accessibilityState={{ disabled: !canNext }} disabled={!canNext} onPress={onNext} style={styles.weekArrow}><Ionicons name="chevron-forward" size={19} color={canNext ? SLColors.textStrong : SLColors.textSubtle} /></Pressable>
    </View>
    <View style={styles.weekDays}>{week.days.slice(0, 7).map((day) => {
      const selected = day.key === selectedDayKey;
      const completed = day.sessions.length > 0 && day.sessions.every((session) => session.status === 'completed');
      return <Pressable key={day.key} accessibilityRole="button" accessibilityLabel={`${day.weekday} ${day.dayNumber || ''}, ${day.sessions.length} Sessions`} accessibilityState={{ selected }} onPress={() => onSelectDay(day.key)} style={[styles.weekDay, selected && styles.weekDaySelected]}>
        <Text style={[styles.weekDayLabel, selected && styles.weekDayLabelSelected]}>{day.weekday}</Text>
        <Text style={[styles.weekDayNumber, selected && styles.weekDayNumberSelected]}>{day.dayNumber || '—'}</Text>
        <View style={[styles.weekDayDot, completed && styles.weekDayDotComplete, day.sessions.length > 0 && !completed && styles.weekDayDotPlanned, selected && styles.weekDayDotSelected]} />
      </Pressable>;
    })}</View>
  </View>;
}

function TrainingSessionSequence({ week, selectedDay, onOpenSession, unit }: { week: AthleteTrainingWeek; selectedDay: AthleteTrainingDay | null; onOpenSession: (id: number) => void; unit: 'kg' | 'lb' }) {
  const sessions = week.days.flatMap((day) => day.sessions);
  return <View style={styles.sequence}>
    <View style={styles.sequenceHeading}><Text style={styles.sequenceTitle}>SESSION SEQUENCE</Text><Text style={styles.sequenceCount}>{sessions.length} Session{sessions.length === 1 ? '' : 's'}</Text></View>
    {sessions.length > 0 && selectedDay && !selectedDay.sessions.length ? <Text style={styles.selectedDayEmpty}>No Session planned for {formatSelectedDay(selectedDay)}.</Text> : null}
    {sessions.length ? <View style={styles.sequenceRows}>{week.days.flatMap((day) => day.sessions.map((session) => <TrainingSessionRow key={session.id} session={session} day={day} selected={day.key === selectedDay?.key} onPress={() => onOpenSession(session.id)} unit={unit} />))}</View> : <View style={styles.emptySequence}><Text style={styles.emptySequenceTitle}>No Sessions planned this Week.</Text><Text style={styles.emptySequenceMeta}>Your Program map still shows where this Week sits in the Block.</Text></View>}
    {week.objective ? <View style={styles.weekFocus}><Text style={styles.weekFocusLabel}>COACH FOCUS</Text><Text style={styles.weekFocusText}>{week.objective.text}</Text></View> : null}
  </View>;
}

function TrainingSessionRow({ session, day, selected, onPress, unit }: { session: AthleteTrainingSession; day: AthleteTrainingDay; selected: boolean; onPress: () => void; unit: 'kg' | 'lb' }) {
  const completed = session.status === 'completed';
  const active = session.status === 'in_progress' || session.status === 'today';
  const names = (session.movements || []).map((movement) => movement.label).filter(Boolean);
  const movementSummary = names.length ? `${names.slice(0, 3).join(' · ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : session.contentSummary || null;
  const plannedSets = (session.movements || []).reduce((sum, movement) => sum + Math.max(0, Number(movement.sets || 0)), 0);
  const evidence = completed && session.recap
    ? formatSessionVolumeSummary({ loggedSetCount: session.recap.loggedSetCount, totalVolumeKg: session.recap.totalVolumeKg, unit })
    : plannedSets > 0 ? `${plannedSets} prescribed sets` : null;
  return <Pressable accessibilityRole="button" accessibilityLabel={[session.title, session.stateLabel, movementSummary, evidence].filter(Boolean).join(', ')} onPress={onPress} style={({ pressed }) => [styles.sequenceRow, completed && styles.sequenceRowComplete, active && styles.sequenceRowActive, selected && styles.sequenceRowSelected, pressed && styles.pressed]}>
    <View style={styles.sequenceDate}><Text style={styles.sequenceDay}>{day.weekday}</Text><Text style={styles.sequenceNumber}>{day.dayNumber || '—'}</Text></View>
    <View style={styles.sequenceCopy}>
      <Text numberOfLines={2} style={styles.sequenceSessionTitle}>{session.title}</Text>
      {movementSummary ? <Text numberOfLines={1} style={styles.sequenceMovement}>{movementSummary}</Text> : null}
      {evidence ? <Text numberOfLines={1} style={styles.sequenceEvidence}>{evidence}</Text> : null}
      <View style={styles.sequenceStateLine}><Text style={[styles.sequenceState, completed && styles.sequenceStateComplete, active && styles.sequenceStateActive]}>{session.stateLabel || (completed ? 'Completed' : active ? 'In Progress' : 'Upcoming')}</Text>{completed && session.recap?.prCount ? <Text style={styles.sequencePr}>{session.recap.prCount} PR{session.recap.prCount === 1 ? '' : 's'}</Text> : null}</View>
    </View>
    <Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} />
  </Pressable>;
}

function ProgramHero({ data, program, progress }: { data: AthleteTrainingHubData; program: AthleteTrainingProgram; progress: number }) {
  return (
    <ImageBackground imageStyle={styles.programHeroImage} source={PROGRAM_ART} style={styles.programHero}>
      <LinearGradient colors={['#050507', 'rgba(5,5,7,0.89)', 'rgba(5,5,7,0.24)']} locations={[0, 0.58, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFillObject} />
      <View style={styles.programHeroCopy}>
        <Text style={styles.sectionKicker}>CURRENT PROGRAM</Text>
        <Text numberOfLines={2} style={styles.programName}>{program.name}</Text>
        {program.coachName || data.connectedCoachName ? <Text numberOfLines={1} style={styles.coachLine}>Coached by {program.coachName || data.connectedCoachName}</Text> : null}
        {program.progress != null ? <Text style={styles.programContext}>{Math.round(progress * 100)}% through Program</Text> : null}
        {program.totalWeeks && program.currentWeek ? <View style={styles.compactProgress}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View> : null}
      </View>
    </ImageBackground>
  );
}

function formatSelectedDay(day: AthleteTrainingDay) {
  if (!day.date) return day.weekday;
  const parsed = new Date(`${day.date}T12:00:00`);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    : `${day.weekday} ${day.dayNumber || ''}`.trim();
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
        {recap.totalVolumeKg ? <Text style={styles.evidenceVolume}>{formatTotalVolumeFromKg(recap.totalVolumeKg, unit)}</Text> : null}
      </View>
    </TrainingHubMaterialSurface>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.evidenceMetric}><Text style={styles.evidenceValue}>{value}</Text><Text style={styles.evidenceLabel}>{label}</Text></View>;
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

function clamp01(value?: number | null) { return Math.max(0, Math.min(1, Number(value || 0))); }
function formatWeekRangeLabel(value: string) { return String(value || '').replace(/\s+-\s+/g, ' – '); }
function formatUpdateAge(value: string) { const elapsed = Date.now() - new Date(value).getTime(); if (!Number.isFinite(elapsed)) return ''; const days = Math.max(0, Math.floor(elapsed / 86400000)); return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d`; }
const styles = StyleSheet.create({
  root: { width: '100%', backgroundColor: '#000000' },
  pressed: { opacity: 0.76 },
  sectionKicker: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.65 },
  programHero: { minHeight: 143, justifyContent: 'center', overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  programHeroImage: { resizeMode: 'cover', opacity: 0.62 },
  programHeroCopy: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16, gap: 4 },
  programName: { ...SLTypography.title, color: '#FFFFFF', fontSize: 23, lineHeight: 27, maxWidth: '82%' },
  coachLine: { ...SLTypography.caption, color: '#C8B5E9' },
  programContext: { ...SLTypography.caption, color: SLColors.textMuted },
  compactProgress: { height: 4, maxWidth: 290, marginTop: 6, borderRadius: 2, overflow: 'hidden', backgroundColor: '#2B2132' },
  position: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  positionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  positionIdentity: { flex: 1, minWidth: 0, gap: 2 },
  positionEyebrow: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.7 },
  positionTitle: { ...SLTypography.sectionTitle, color: SLColors.textStrong, fontSize: 21, lineHeight: 25 },
  positionMeta: { ...SLTypography.caption, color: SLColors.textMuted },
  programMapAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  programMapText: { ...SLTypography.caption, color: SLColors.accentViolet, fontWeight: '700' },
  positionRail: { flexDirection: 'row', gap: 4, marginTop: 13 },
  positionSegment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#302739' },
  positionSegmentPast: { backgroundColor: '#654784' },
  positionSegmentCurrent: { backgroundColor: SLColors.accentViolet },
  weekNavigation: { backgroundColor: '#07080B', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  weekNavigationTop: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekArrow: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  weekNavigationTitle: { flex: 1, alignItems: 'center' },
  weekNavigationName: { ...SLTypography.bodyStrong, color: SLColors.textStrong, fontSize: 17 },
  weekNavigationRange: { ...SLTypography.micro, color: SLColors.textMuted },
  weekDays: { flexDirection: 'row', paddingHorizontal: 8 },
  weekDay: { flex: 1, minWidth: 0, minHeight: 55, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', gap: 2, borderBottomWidth: 2, borderColor: 'transparent' },
  weekDaySelected: { backgroundColor: '#1A1024', borderColor: SLColors.accentViolet },
  weekDayLabel: { ...SLTypography.micro, color: SLColors.textMuted },
  weekDayLabelSelected: { color: SLColors.accentViolet },
  weekDayNumber: { ...SLTypography.bodyStrong, color: SLColors.textStrong, fontSize: 16 },
  weekDayNumberSelected: { color: SLColors.accentViolet },
  weekDayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4C4752' },
  weekDayDotComplete: { backgroundColor: SLColors.success },
  weekDayDotPlanned: { backgroundColor: SLColors.accentViolet },
  weekDayDotSelected: { backgroundColor: SLColors.accentViolet },
  sequence: { paddingBottom: 10 },
  sequenceHeading: { minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sequenceTitle: { ...SLTypography.micro, color: SLColors.textStrong, letterSpacing: 0.7 },
  sequenceCount: { ...SLTypography.caption, color: SLColors.textMuted },
  selectedDayEmpty: { ...SLTypography.caption, color: SLColors.textMuted, paddingHorizontal: 16, paddingBottom: 10 },
  sequenceRows: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  sequenceRow: { minHeight: 96, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderLeftWidth: 3, borderLeftColor: '#594364', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.borderSubtle, backgroundColor: '#090A0E' },
  sequenceRowComplete: { borderLeftColor: SLColors.success },
  sequenceRowActive: { borderLeftColor: SLColors.accentViolet, backgroundColor: '#100C17' },
  sequenceRowSelected: { backgroundColor: '#181020' },
  sequenceDate: { width: 38, alignItems: 'flex-start', gap: 1 },
  sequenceDay: { ...SLTypography.micro, color: SLColors.textMuted, textTransform: 'uppercase' },
  sequenceNumber: { ...SLTypography.bodyStrong, color: SLColors.textStrong, fontSize: 18 },
  sequenceCopy: { flex: 1, minWidth: 0, gap: 3 },
  sequenceSessionTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong, fontSize: 17, lineHeight: 22 },
  sequenceMovement: { ...SLTypography.caption, color: SLColors.text, fontSize: 12 },
  sequenceEvidence: { ...SLTypography.caption, color: SLColors.textMuted },
  sequenceStateLine: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  sequenceState: { ...SLTypography.micro, color: SLColors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  sequenceStateActive: { color: SLColors.accentViolet },
  sequenceStateComplete: { color: SLColors.success },
  sequencePr: { ...SLTypography.micro, color: SLColors.accentMagenta, fontWeight: '800' },
  emptySequence: { minHeight: 100, justifyContent: 'center', paddingHorizontal: 16, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  emptySequenceTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  emptySequenceMeta: { ...SLTypography.caption, color: SLColors.textMuted },
  weekFocus: { marginHorizontal: 16, marginTop: 15, paddingLeft: 10, gap: 3, borderLeftWidth: 2, borderColor: SLColors.accentViolet },
  weekFocusLabel: { ...SLTypography.micro, color: SLColors.accentViolet },
  weekFocusText: { ...SLTypography.caption, color: SLColors.text },
  noWeek: { padding: 20 },
  noWeekText: { ...SLTypography.body, color: SLColors.textMuted },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: SLColors.accentViolet },
  historyAction: { marginHorizontal: 8, minHeight: 58, borderWidth: 1, borderColor: SLColors.borderSubtle, borderRadius: SLRadius.md, backgroundColor: '#08090C', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, gap: 12 },
  historyTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  historyMeta: { ...SLTypography.micro, color: SLColors.textMuted, marginTop: 2 },
  evidenceCard: { marginHorizontal: 8, marginTop: 14, padding: 13, gap: 11 },
  evidenceStrip: { flexDirection: 'row', alignItems: 'stretch' },
  evidenceMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderRightWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle },
  evidenceValue: { fontSize: 20, lineHeight: 23, fontWeight: '700', color: '#FFFFFF' },
  evidenceLabel: { minHeight: 30, fontSize: 12, lineHeight: 15, fontWeight: '700', color: SLColors.textMuted, textAlign: 'center', marginTop: 3 },
  evidenceProgress: { height: 7, borderRadius: 4, backgroundColor: '#0A1710', overflow: 'hidden' },
  evidenceProgressFill: { height: '100%', borderRadius: 4, backgroundColor: SLColors.success },
  evidenceFooter: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  evidenceStatement: { ...SLTypography.caption, color: SLColors.textMuted, flex: 1, minWidth: 0 },
  evidenceVolume: { ...SLTypography.caption, color: SLColors.success, flexShrink: 1, maxWidth: '46%', textAlign: 'right' },
  coachUpdates: { marginHorizontal: 16, marginTop: 16, gap: 7, paddingVertical: 4 },
  coachUpdateRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  coachUpdateDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: SLColors.accentViolet },
  coachUpdateBody: { ...SLTypography.caption, color: SLColors.text, flex: 1 },
  coachUpdateAge: { ...SLTypography.micro, color: SLColors.textMuted },
  primaryAction: { marginHorizontal: 14, marginTop: 16, minHeight: 52, borderRadius: 10, backgroundColor: '#56239A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  completedAction: { backgroundColor: '#185B32' },
  primaryActionText: { ...SLTypography.bodyStrong, color: '#FFFFFF' },
  noProgramHero: { minHeight: 300, justifyContent: 'flex-end', padding: 18, gap: 8, borderBottomWidth: 1, borderColor: SLColors.borderSubtle },
  noProgramImage: { resizeMode: 'cover', opacity: 0.8 },
  noProgramTitle: { ...SLTypography.title, color: '#FFFFFF' },
  noProgramBody: { ...SLTypography.body, color: SLColors.textMuted },
});
