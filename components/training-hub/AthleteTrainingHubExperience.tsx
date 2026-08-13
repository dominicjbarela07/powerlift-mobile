import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SLProfileAvatar } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLSurface } from '@/components/ui/sl-workspace';
import { TrainingHubMaterialSurface } from '@/components/training-hub/training-hub-material-surface';
import { SLColors, SLMovementCardMaterial, SLRadius, SLTypography } from '@/constants/theme';
import {
  movementCardStateAccent,
  type MovementCardMaterialState,
} from '@/lib/movement-card-material';

export type AthleteTrainingSession = {
  id: number;
  title: string;
  date?: string | null;
  status: 'completed' | 'today' | 'upcoming' | 'missed' | 'moved';
  contentSummary?: string | null;
  dayLabel?: string | null;
  stateLabel?: string | null;
};

export type AthleteTrainingDay = {
  key: string;
  weekday: string;
  dayNumber?: string | null;
  status: 'completed' | 'today' | 'rest' | 'upcoming' | 'missed' | 'moved';
  sessions: AthleteTrainingSession[];
};

export type AthleteTrainingWeek = {
  key: string;
  number: number;
  rangeLabel: string;
  summary: string;
  current?: boolean;
  tag?: {
    key: string;
    label: string;
  } | null;
  objective?: {
    text: string;
    updatedAt?: string | null;
  } | null;
  days: AthleteTrainingDay[];
};

export type AthleteTrainingBlock = {
  id: number;
  name: string;
  status: 'completed' | 'current' | 'upcoming';
  currentWeek?: number | null;
  totalWeeks?: number | null;
  purpose?: string | null;
  coachContext?: string | null;
  weeks: AthleteTrainingWeek[];
};

export type AthleteTrainingProgram = {
  id: number;
  name: string;
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
  videosReviewed?: number | null;
};

export type AthleteTrainingHubData = {
  athleteName?: string | null;
  profilePhotoUrl?: string | null;
  profilePhotoVersion?: string | null;
  activeProgram?: AthleteTrainingProgram | null;
  previousProgram?: AthleteTrainingHistory | null;
  connectedCoachName?: string | null;
  connectedCoachPhotoUrl?: string | null;
  connectedCoachPhotoVersion?: string | null;
  coachUpdates?: {
    id: number;
    summary: string;
    occurredAt?: string | null;
  }[];
  previousWeekRecap?: AthletePreviousWeekRecap | null;
  /** Legacy DEV fixture compatibility; the live route uses structured coachUpdates. */
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
}: {
  data: AthleteTrainingHubData;
  onAction: (action: AthleteTrainingHubAction) => void;
}) {
  const currentBlock = data.activeProgram?.blocks.find((block) => block.status === 'current')
    || data.activeProgram?.blocks[0]
    || null;
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(currentBlock?.id ?? null);
  const selectedBlock = data.activeProgram?.blocks.find((block) => block.id === selectedBlockId) || currentBlock;
  const selectedCurrentWeekKey = selectedBlock?.weeks.find((week) => week.current)?.key || null;
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(selectedCurrentWeekKey);

  useEffect(() => {
    setSelectedBlockId(currentBlock?.id ?? null);
  }, [currentBlock?.id]);

  useEffect(() => {
    setExpandedWeekKey(selectedCurrentWeekKey);
  }, [selectedBlock?.id, selectedCurrentWeekKey]);

  if (!data.activeProgram) {
    return <NoActiveProgram data={data} onAction={onAction} />;
  }

  const program = data.activeProgram;
  const progress = Math.max(0, Math.min(1, Number(program.progress || 0)));
  const initials = athleteInitials(data.athleteName);
  const programAccent = SLColors.accentViolet;
  const previousWeekLines = previousWeekNarrative(data.previousWeekRecap);

  return (
    <View style={styles.root}>
      <TrainingHubMaterialSurface accentColor={programAccent} state="in_progress" style={styles.programCard}>
        <View style={styles.programIdentityRow}>
          <AthleteAvatar
            imageUrl={data.profilePhotoUrl}
            imageVersion={data.profilePhotoVersion}
            initials={initials}
          />
          <View style={styles.flex}>
            <Text style={[styles.kicker, styles.programKicker]}>CURRENT PROGRAM</Text>
            <Text style={styles.programName} numberOfLines={2}>{program.name}</Text>
            {program.coachName ? (
              <Text style={styles.secondary}>
                <Text style={styles.coachPrefix}>Coached by </Text>
                {program.coachName}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={15} color={SLColors.textMuted} />
              <Text style={styles.meta}>{programMeta(program)}</Text>
            </View>
          </View>
        </View>
        {program.totalWeeks && program.currentWeek ? (
          <>
            <View style={styles.progressCopy}>
              <Text style={styles.progressLabel}>Week {program.currentWeek} of {program.totalWeeks}</Text>
              <Text style={[styles.progressPercent, { color: programAccent }]}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { backgroundColor: programAccent, width: `${progress * 100}%` }]} />
            </View>
          </>
        ) : null}
        <Pressable style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]} onPress={() => onAction({ type: 'program-history' })}>
          <View style={styles.actionLabelRow}>
            <Ionicons name="book-outline" size={17} color={SLColors.text} />
            <Text style={styles.secondaryActionText}>Program History</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={SLColors.textMuted} />
        </Pressable>
      </TrainingHubMaterialSurface>

      {data.coachUpdates?.length ? (
        <View style={styles.contextSection}>
          <Text style={styles.contextKicker}>COACH UPDATES</Text>
          {data.coachUpdates.slice(0, 2).map((update) => (
            <View key={update.id} style={styles.contextRow}>
              <Text style={styles.contextBody}>{update.summary}</Text>
              {update.occurredAt ? <Text style={styles.contextMeta}>{formatUpdateAge(update.occurredAt)}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {previousWeekLines.length ? (
        <View style={styles.contextSection}>
          <Text style={styles.contextKicker}>LAST WEEK</Text>
          <Text style={styles.recapLead}>{previousWeekLines[0]}</Text>
          {previousWeekLines.slice(1).map((line) => (
            <Text key={line} style={styles.recapSupport}>{line}</Text>
          ))}
        </View>
      ) : null}

      {program.blocks.length ? (
        <View style={styles.blockSelector}>
          {program.blocks.map((block) => {
            const selected = block.id === selectedBlock?.id;
            const state = blockMaterialState(block.status);
            const accent = movementCardStateAccent(state);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={block.id}
                onPress={() => setSelectedBlockId(block.id)}
                style={({ pressed }) => [styles.blockOption, pressed && styles.pressed]}
              >
                {selected ? (
                  <LinearGradient
                    colors={[
                      colorWithAlpha(accent, 0),
                      colorWithAlpha(accent, 0.035),
                      colorWithAlpha(accent, 0.2),
                    ]}
                    end={{ x: 0.5, y: 1 }}
                    locations={[0, 0.55, 1]}
                    pointerEvents="none"
                    start={{ x: 0.5, y: 0 }}
                    style={styles.blockOptionUnderglow}
                  />
                ) : null}
                <Text style={[styles.blockOptionName, selected && { color: accent }]} numberOfLines={1}>
                  {shortBlockName(block.name)}
                </Text>
                {selected ? <View style={[styles.blockOptionIndicator, { backgroundColor: accent }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {selectedBlock ? (
        <>
          <TrainingHubMaterialSurface state={blockMaterialState(selectedBlock.status)} style={styles.blockCard}>
            <Pressable style={({ pressed }) => [styles.blockSummaryRow, pressed && styles.pressed]} onPress={() => onAction({ type: 'block', id: selectedBlock.id })}>
              <View style={styles.blockIcon}>
                <Ionicons name="barbell-outline" size={24} color={movementCardStateAccent(blockMaterialState(selectedBlock.status))} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.blockName} numberOfLines={2}>{selectedBlock.name}</Text>
                {selectedBlock.currentWeek && selectedBlock.totalWeeks ? (
                  <Text style={styles.blockWeek}>Week {selectedBlock.currentWeek} of {selectedBlock.totalWeeks}</Text>
                ) : null}
                {selectedBlock.purpose ? <Text style={styles.secondary} numberOfLines={2}>{selectedBlock.purpose}</Text> : null}
                {selectedBlock.coachContext ? <Text style={styles.coachContext} numberOfLines={2}>{selectedBlock.coachContext}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} />
            </Pressable>
          </TrainingHubMaterialSurface>

          <View style={styles.weeks}>
            {selectedBlock.weeks.map((week) => {
              const materialState = weekMaterialState(week, selectedBlock.currentWeek);
              return (
                <WeekSection
                  expanded={expandedWeekKey === week.key}
                  key={week.key}
                  materialState={materialState}
                  coachName={data.connectedCoachName || program.coachName || 'Coach'}
                  coachPhotoUrl={data.connectedCoachPhotoUrl}
                  coachPhotoVersion={data.connectedCoachPhotoVersion}
                  onOpenSession={(id) => onAction({ type: 'session', id })}
                  onToggle={() => setExpandedWeekKey((value) => value === week.key ? null : week.key)}
                  week={week}
                />
              );
            })}
          </View>
        </>
      ) : (
        <SLSurface level={1} contentStyle={styles.compactEmpty}>
          <Text style={styles.emptyTitle}>Program structure is being prepared.</Text>
          <Text style={styles.secondary}>Blocks and weekly sessions will appear here when they are assigned.</Text>
        </SLSurface>
      )}
    </View>
  );
}

function NoActiveProgram({ data, onAction }: { data: AthleteTrainingHubData; onAction: (action: AthleteTrainingHubAction) => void }) {
  return (
    <View style={styles.root}>
      <AthleteAvatar
        imageUrl={data.profilePhotoUrl}
        imageVersion={data.profilePhotoVersion}
        initials={athleteInitials(data.athleteName)}
      />
      <SLSurface level={2} contentStyle={styles.noProgramCard}>
        <Text style={styles.kicker}>TRAINING</Text>
        <View style={styles.clipboard}><Ionicons name="clipboard-outline" size={72} color={SLColors.accentViolet} /></View>
        <Text style={styles.noProgramTitle}>No active program</Text>
        <Text style={styles.noProgramBody}>
          {data.connectedCoachName
            ? `${data.connectedCoachName} is preparing what comes next.`
            : 'Your next training plan will appear here when it is assigned.'}
        </Text>
        {data.connectedCoachName ? (
          <Pressable style={({ pressed }) => [styles.messageAction, pressed && styles.pressed]} onPress={() => onAction({ type: 'message-coach' })}>
            <View style={styles.actionLabelRow}>
              <Ionicons name="chatbubble-outline" size={19} color={SLColors.text} />
              <Text style={styles.messageActionText}>Message Coach</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={SLColors.text} />
          </Pressable>
        ) : null}
        <Text style={styles.noProgramFoot}>{data.connectedCoachName ? "You'll be notified when it's ready." : 'Connect with a coach or create a plan to begin.'}</Text>
      </SLSurface>

      <SLSurface level={1} contentStyle={styles.orientationCard}>
        <Text style={styles.kicker}>HOW YOUR TRAINING IS ORGANIZED</Text>
        <View style={styles.orientationRow}>
          <OrientationStep icon="book-outline" label="Program" />
          <View style={styles.dash} />
          <OrientationStep icon="barbell-outline" label="Block" />
          <View style={styles.dash} />
          <OrientationStep icon="calendar-outline" label={'Week &\nSessions'} />
        </View>
        <Text style={styles.orientationFoot}>Your full plan will appear here when it is assigned.</Text>
      </SLSurface>

      {data.previousProgram ? (
        <SLSurface level={1} contentStyle={styles.historyCard}>
          <Text style={styles.kicker}>PROGRAM HISTORY</Text>
          <Pressable style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]} onPress={() => onAction({ type: 'program-history', id: data.previousProgram?.id })}>
            <View style={styles.historyIcon}><Ionicons name="book-outline" size={25} color={SLColors.accentViolet} /></View>
            <View style={styles.flex}>
              <Text style={styles.historyName} numberOfLines={2}>{data.previousProgram.name}</Text>
              <Text style={styles.meta}>{[data.previousProgram.durationLabel, data.previousProgram.completedLabel].filter(Boolean).join(' · ')}</Text>
            </View>
            <View style={styles.viewProgram}><Text style={styles.viewProgramText}>View Program</Text><Ionicons name="chevron-forward" size={15} color={SLColors.text} /></View>
          </Pressable>
        </SLSurface>
      ) : (
        <SLSurface level={1} contentStyle={styles.compactEmpty}>
          <Text style={styles.kicker}>PROGRAM HISTORY</Text>
          <Text style={styles.emptyTitle}>Your program history will build here.</Text>
          <Text style={styles.secondary}>Completed plans and their sessions will remain available for review.</Text>
        </SLSurface>
      )}
    </View>
  );
}

function AthleteAvatar({
  imageUrl,
  imageVersion,
  initials,
}: {
  imageUrl?: string | null;
  imageVersion?: string | null;
  initials: string;
}) {
  return (
    <SLProfileAvatar
      fallbackInitials={initials}
      profilePhotoUrl={imageUrl}
      profilePhotoVersion={imageVersion}
      size={70}
      borderRadius={35}
      style={styles.avatar}
    />
  );
}

function WeekSection({
  week,
  expanded,
  materialState,
  coachName,
  coachPhotoUrl,
  coachPhotoVersion,
  onToggle,
  onOpenSession,
}: {
  week: AthleteTrainingWeek;
  expanded: boolean;
  materialState: MovementCardMaterialState;
  coachName: string;
  coachPhotoUrl?: string | null;
  coachPhotoVersion?: string | null;
  onToggle: () => void;
  onOpenSession: (id: number) => void;
}) {
  const accent = movementCardStateAccent(materialState);
  return (
    <TrainingHubMaterialSurface
      expanded={expanded}
      state={materialState}
      style={expanded ? styles.weekExpanded : styles.weekCollapsed}
    >
      <Pressable style={({ pressed }) => [styles.weekHeader, pressed && styles.pressed]} onPress={onToggle}>
        <View style={styles.weekIdentity}>
          <Text style={[styles.weekLabel, week.current && { color: accent }]}>
            WEEK {week.number}{week.rangeLabel ? ` · ${formatWeekRangeLabel(week.rangeLabel)}` : ''}
          </Text>
          {week.tag ? (
            <View style={[styles.weekTag, { borderColor: colorWithAlpha(accent, 0.48), backgroundColor: colorWithAlpha(accent, 0.10) }]}>
              <Text style={[styles.weekTagText, { color: accent }]}>{week.tag.label}</Text>
            </View>
          ) : null}
        </View>
        {!expanded ? <Text style={styles.weekSummary}>{week.summary}</Text> : null}
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={17} color={week.current ? accent : SLColors.textMuted} />
      </Pressable>
      {expanded ? (
        <>
          {week.objective ? (
            <View style={styles.weekObjective}>
              <SLProfileAvatar
                fallbackInitials={athleteInitials(coachName)}
                profilePhotoUrl={coachPhotoUrl}
                profilePhotoVersion={coachPhotoVersion}
                size={42}
                borderRadius={21}
                style={styles.weekObjectiveAvatar}
              />
              <View style={styles.weekObjectiveCopy}>
                <Text style={[styles.weekObjectiveKicker, { color: accent }]}>{"COACH'S FOCUS"}</Text>
                <Text style={styles.weekObjectiveBody}>{week.objective.text}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.dayRail}>
            {week.days.slice(0, 7).map((day) => (
              <View key={day.key} style={[styles.day, day.status === 'today' && styles.dayToday]}>
                <Text style={styles.dayWeekday}>{day.weekday}</Text>
                <DayStatus status={day.status} />
                <Text style={styles.dayNumber}>{day.dayNumber || '—'}</Text>
              </View>
            ))}
          </View>
          <View style={styles.sessions}>
            {week.days.flatMap((day) => day.sessions).map((session) => (
              <View style={styles.sessionRow} key={session.id}>
                <DayStatus status={session.status} compact />
                <View style={styles.flex}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>{session.title}</Text>
                  {session.contentSummary ? (
                    <Text style={styles.sessionContentSummary}>{session.contentSummary}</Text>
                  ) : null}
                  <View style={styles.sessionMetaRow}>
                    {session.dayLabel ? <Text style={styles.meta}>{session.dayLabel}</Text> : null}
                    {session.dayLabel && session.stateLabel ? <Text style={styles.sessionMetaSeparator}>·</Text> : null}
                    {session.stateLabel ? (
                      <Text style={[styles.sessionStateLabel, { color: sessionStateColor(session.stateLabel) }]}>
                        {session.stateLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Pressable style={({ pressed }) => [styles.viewSession, pressed && styles.pressed]} onPress={() => onOpenSession(session.id)}>
                  <Text style={styles.viewSessionText}>View Session</Text>
                </Pressable>
              </View>
            ))}
            {!week.days.some((day) => day.sessions.length) ? <Text style={styles.secondary}>No sessions assigned this week.</Text> : null}
          </View>
        </>
      ) : null}
    </TrainingHubMaterialSurface>
  );
}

function DayStatus({ status, compact = false }: { status: AthleteTrainingDay['status'] | AthleteTrainingSession['status']; compact?: boolean }) {
  const icon = status === 'completed' ? 'checkmark' : status === 'missed' ? 'close' : status === 'moved' ? 'swap-horizontal' : status === 'today' ? 'ellipse' : status === 'rest' ? 'remove' : 'ellipse-outline';
  return (
    <View
      style={[
        styles.statusIcon,
        compact && styles.statusIconCompact,
        status === 'today' && styles.statusToday,
        status === 'completed' && styles.statusCompleted,
        status === 'missed' && styles.statusMissed,
      ]}
    >
      <Ionicons name={icon as any} size={compact ? 12 : 11} color={SLColors.text} />
    </View>
  );
}

function OrientationStep({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return <View style={styles.orientationStep}><View style={styles.orientationIcon}><Ionicons name={icon} size={25} color={SLColors.accentViolet} /></View><Text style={styles.orientationLabel}>{label}</Text></View>;
}

function athleteInitials(name?: string | null) {
  const parts = String(name || 'Athlete').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function programMeta(program: AthleteTrainingProgram) {
  return [program.blockCount ? `${program.blockCount} block${program.blockCount === 1 ? '' : 's'}` : null, program.totalWeeks ? `${program.totalWeeks} weeks` : null].filter(Boolean).join(' · ') || 'Program schedule';
}

function shortBlockName(name: string) { return name.replace(/\s+Block$/i, '') || 'Block'; }
function formatWeekRangeLabel(value: string) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\s*[-–]\s*(\d{1,2})\/(\d{1,2})$/);
  if (!match) return String(value || '').toUpperCase().replace(/\s+-\s+/g, ' – ');
  const startMonth = months[Number(match[1]) - 1];
  const endMonth = months[Number(match[3]) - 1];
  if (!startMonth || !endMonth) return String(value || '').toUpperCase();
  return `${startMonth} ${Number(match[2])} – ${endMonth} ${Number(match[4])}`;
}
function formatUpdateAge(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
function previousWeekNarrative(recap?: AthletePreviousWeekRecap | null): string[] {
  if (!recap || recap.sessionsAssigned <= 0) return [];
  const lines: string[] = [];
  if (recap.sessionsCompleted >= recap.sessionsAssigned) {
    lines.push('Every planned session finished.');
  } else if (recap.sessionsCompleted <= 0) {
    lines.push('No planned sessions finished.');
  } else {
    lines.push(`${recap.sessionsCompleted} of ${recap.sessionsAssigned} planned sessions finished.`);
  }
  if (
    recap.setsCompleted != null
    && recap.setsPlanned != null
    && recap.setsPlanned > 0
  ) {
    lines.push(
      recap.setsCompleted >= recap.setsPlanned
        ? 'Every planned set logged.'
        : `${recap.setsCompleted} of ${recap.setsPlanned} planned sets logged.`,
    );
  }
  if (recap.videosReviewed) {
    lines.push(`Coach reviewed ${recap.videosReviewed} training video${recap.videosReviewed === 1 ? '' : 's'}.`);
  }
  return lines.slice(0, 3);
}
function blockMaterialState(status: AthleteTrainingBlock['status']): MovementCardMaterialState {
  return status === 'completed' ? 'complete' : status === 'current' ? 'in_progress' : 'not_started';
}
function weekMaterialState(week: AthleteTrainingWeek, currentWeek?: number | null): MovementCardMaterialState {
  if (week.current) return 'in_progress';
  if (currentWeek && week.number < currentWeek) return 'complete';
  return 'not_started';
}
function sessionStateColor(label: string) {
  if (label === 'Completed') return movementCardStateAccent('complete');
  if (label === 'In Progress') return movementCardStateAccent('in_progress');
  if (label === 'Missed' || label === 'Incomplete' || label === 'Canceled') return SLColors.danger;
  if (label === 'Moved') return SLColors.accentViolet;
  return movementCardStateAccent('not_started');
}

function colorWithAlpha(color: string, alpha: number) {
  const match = String(color || '').trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return color;
  return `rgba(${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)}, ${alpha})`;
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: 12, backgroundColor: 'transparent' },
  flex: { flex: 1 },
  programIdentityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 1.5, borderColor: SLColors.accentViolet, backgroundColor: SLColors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  programCard: { padding: 16, gap: 7 },
  kicker: { ...SLTypography.micro, color: SLColors.warning, letterSpacing: 0.45 },
  programKicker: { color: SLColors.accentViolet },
  programName: { ...SLTypography.sectionTitle, color: SLColors.textStrong },
  secondary: { ...SLTypography.rowMeta, color: SLColors.textMuted },
  coachPrefix: { color: SLColors.accentViolet },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  meta: { ...SLTypography.caption, color: SLColors.textMuted },
  progressCopy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  progressLabel: { ...SLTypography.bodyStrong, color: SLColors.text },
  progressPercent: { ...SLTypography.caption, color: SLColors.textMuted },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#030304', borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderHairline, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  secondaryAction: { marginTop: 7, marginHorizontal: -16, marginBottom: -16, paddingHorizontal: 16, minHeight: 43, borderTopWidth: 1, borderTopColor: SLColors.borderSubtle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  secondaryActionText: { ...SLTypography.body, color: SLColors.text },
  pressed: { opacity: 0.72 },
  blockSelector: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 1, borderBottomColor: SLColors.borderSubtle },
  blockOption: { flex: 1, minWidth: 0, minHeight: 58, paddingHorizontal: 8, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  blockOptionName: { ...SLTypography.caption, zIndex: 1, color: SLColors.text, textTransform: 'uppercase' },
  blockOptionUnderglow: { position: 'absolute', bottom: 0, left: 2, right: 2, height: 34 },
  blockOptionIndicator: { position: 'absolute', bottom: -1, left: 10, right: 10, height: 2, borderRadius: 1 },
  blockCard: { padding: 0 },
  blockSummaryRow: { padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  blockIcon: { width: 48, height: 48, borderRadius: SLRadius.md, backgroundColor: '#050507', borderWidth: 1, borderColor: SLColors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  blockName: { ...SLTypography.sectionTitle, color: SLColors.textStrong },
  blockWeek: { ...SLTypography.body, color: SLColors.text },
  coachContext: { ...SLTypography.caption, color: SLColors.textMuted, marginTop: 2 },
  contextSection: { paddingHorizontal: 4, paddingVertical: 7, gap: 6 },
  contextKicker: { ...SLTypography.micro, color: SLColors.accentViolet, letterSpacing: 0.45 },
  contextRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  contextBody: { ...SLTypography.caption, flex: 1, color: SLColors.text },
  contextMeta: { ...SLTypography.micro, color: SLColors.textMuted },
  recapLead: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  recapSupport: { ...SLTypography.caption, color: SLColors.textMuted },
  weeks: { gap: 10 },
  weekExpanded: { padding: 14, gap: 11 },
  weekCollapsed: { paddingHorizontal: 14, paddingVertical: 12 },
  weekHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 7 },
  weekIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  weekLabel: { ...SLTypography.caption, flexShrink: 1, color: SLColors.text },
  weekTag: { flexShrink: 0, minHeight: 20, paddingHorizontal: 7, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  weekTagText: { ...SLTypography.micro, textTransform: 'uppercase', letterSpacing: 0.4 },
  weekSummary: { ...SLTypography.caption, color: SLColors.textMuted },
  weekObjective: { paddingVertical: 5, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  weekObjectiveAvatar: { backgroundColor: SLColors.surfaceRaised, borderWidth: 1, borderColor: SLColors.borderSubtle },
  weekObjectiveCopy: { flex: 1, gap: 4 },
  weekObjectiveKicker: { ...SLTypography.micro, letterSpacing: 0.45 },
  weekObjectiveBody: { ...SLTypography.bodyStrong, color: SLColors.textStrong, lineHeight: 22 },
  dayRail: { flexDirection: 'row', gap: 5 },
  day: { flex: 1, minWidth: 0, height: 63, borderRadius: SLRadius.sm, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: '#050507', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  dayToday: { borderColor: SLMovementCardMaterial.stateAccent.in_progress, backgroundColor: 'rgba(200,171,114,0.08)' },
  dayWeekday: { ...SLTypography.micro, color: SLColors.text },
  dayNumber: { ...SLTypography.micro, color: SLColors.textMuted },
  statusIcon: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: SLColors.textMuted, alignItems: 'center', justifyContent: 'center' },
  statusIconCompact: { width: 22, height: 22, borderRadius: 11 },
  statusToday: { borderColor: SLMovementCardMaterial.stateAccent.in_progress, backgroundColor: 'rgba(200,171,114,0.14)' },
  statusCompleted: { borderColor: SLMovementCardMaterial.stateAccent.complete, backgroundColor: 'rgba(143,178,154,0.10)' },
  statusMissed: { borderColor: SLColors.railDanger, backgroundColor: SLColors.railDanger },
  sessions: { borderTopWidth: 1, borderTopColor: SLColors.borderSubtle },
  sessionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: SLColors.borderHairline, paddingVertical: 7 },
  sessionTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  sessionContentSummary: { ...SLTypography.caption, color: SLColors.accentViolet },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  sessionMetaSeparator: { ...SLTypography.caption, color: SLColors.textSubtle },
  sessionStateLabel: { ...SLTypography.caption },
  viewSession: { minHeight: 32, paddingHorizontal: 11, borderRadius: SLRadius.sm, borderWidth: 1, borderColor: SLColors.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  viewSessionText: { ...SLTypography.caption, color: SLColors.text },
  compactEmpty: { padding: 15, gap: 7 },
  emptyTitle: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  noProgramCard: { padding: 15, alignItems: 'stretch', gap: 8 },
  clipboard: { alignSelf: 'center', paddingVertical: 8 },
  noProgramTitle: { ...SLTypography.title, color: SLColors.textStrong, textAlign: 'center' },
  noProgramBody: { ...SLTypography.rowMeta, color: SLColors.textMuted, textAlign: 'center' },
  noProgramFoot: { ...SLTypography.caption, color: SLColors.textMuted, textAlign: 'center' },
  messageAction: { minHeight: 50, marginTop: 4, borderWidth: 1, borderColor: SLColors.accentViolet, borderRadius: SLRadius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  messageActionText: { ...SLTypography.bodyStrong, color: SLColors.text },
  orientationCard: { padding: 15, gap: 14 },
  orientationRow: { flexDirection: 'row', alignItems: 'flex-start' },
  orientationStep: { width: 74, alignItems: 'center', gap: 7 },
  orientationIcon: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: SLColors.accentViolet, alignItems: 'center', justifyContent: 'center' },
  orientationLabel: { ...SLTypography.caption, color: SLColors.text, textAlign: 'center' },
  dash: { flex: 1, marginTop: 25, borderTopWidth: 1, borderStyle: 'dashed', borderColor: SLColors.textSubtle },
  orientationFoot: { ...SLTypography.caption, color: SLColors.textMuted, textAlign: 'center' },
  historyCard: { padding: 14, gap: 9 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyIcon: { width: 48, height: 48, borderRadius: SLRadius.md, backgroundColor: SLColors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  historyName: { ...SLTypography.bodyStrong, color: SLColors.textStrong },
  viewProgram: { minHeight: 34, paddingHorizontal: 10, borderWidth: 1, borderColor: SLColors.borderSubtle, borderRadius: SLRadius.sm, flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewProgramText: { ...SLTypography.caption, color: SLColors.text },
});
