import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { type ReactNode } from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';

import { SLButton, SLProfileAvatar, SLSurface } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius } from '@/constants/theme';
import { buildAthleteHomeWeek, type AthleteHomeWeekSession } from '@/lib/athlete-home-week';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';

const TRAINING_IMAGE = require('@/assets/images/gym_vibe.jpg');

export type TodayHomeAction = {
  kind?: string | null;
  label?: string | null;
  route?: string | null;
  workout_id?: number | null;
  thread_id?: number | null;
  meet_plan_id?: number | null;
};

type SessionSummary = {
  id: number;
  label?: string | null;
  date?: string | null;
  status?: string | null;
  estimated_duration_minutes?: number | null;
  preview?: {
    primary_lifts?: string[];
    summary?: string | null;
    core_count?: number;
    accessory_count?: number;
    estimated_duration_minutes?: number | null;
  } | null;
};

type DaySummary = {
  date?: string | null;
  kind?: string | null;
  title?: string | null;
  workout_id?: number | null;
};

type CoachItem = {
  id?: number | null;
  thread_id?: number | null;
  sender_name?: string | null;
  title?: string | null;
  body?: string | null;
  created_at?: string | null;
  route?: string | null;
};

export type TodayHomeData = {
  date: string;
  athlete?: {
    id?: number;
    name?: string | null;
    profilePhotoUrl?: string | null;
    profilePhotoVersion?: string | null;
    bodyweight_kg?: number | null;
  } | null;
  coach?: { id?: number; name?: string | null; email?: string | null } | null;
  phase?: {
    label?: string | null;
    active_program?: { id?: number | null; name?: string | null; start_date?: string | null; end_date?: string | null } | null;
    block?: { id?: number; name?: string | null; start_date?: string | null; end_date?: string | null } | null;
    meet?: { id?: number | null; name?: string | null; date?: string | null; days_until?: number | null; status?: string | null } | null;
  } | null;
  mission?: {
    kind?: string;
    title?: string | null;
    date?: string | null;
    status?: string | null;
    body?: string | null;
    focus?: string[];
    session?: SessionSummary | null;
  } | null;
  readiness?: {
    score?: number | null;
    message?: string | null;
    latest?: { sleep_quality?: number | null; energy?: number | null; soreness?: number | null; stress?: number | null } | null;
    metrics?: { sleep?: number | null; energy?: number | null; soreness?: number | null; stress?: number | null } | null;
  } | null;
  coach_guidance?: { source?: string | null; title?: string | null; body?: string | null; created_at?: string | null; route?: string | null; workout_id?: number | null } | null;
  latest_announcement?: CoachItem | null;
  latest_message?: CoachItem | null;
  recent_glance?: { title?: string | null; date?: string | null; status?: string | null; workout_id?: number | null } | null;
  week_preview?: AthleteHomeWeekSession[] | null;
  yesterday?: DaySummary | null;
  next_glance?: {
    title?: string | null;
    date?: string | null;
    status?: string | null;
    workout_id?: number | null;
    week?: { assigned?: number; logged?: number; missed?: number; pct?: number | null; start_date?: string | null; end_date?: string | null } | null;
  } | null;
  tomorrow?: DaySummary | null;
  progress_signal?: { kind?: string | null; label?: string | null; value?: number | null; unit?: string | null; delta?: number | null; body?: string | null } | null;
  primary_action?: TodayHomeAction | null;
};

type Props = {
  today: TodayHomeData;
  isIndividual?: boolean;
  onAction: (action?: TodayHomeAction | null) => void;
  supplementaryContent?: ReactNode;
  trainingImage?: ImageSourcePropType;
};

export function TodayHomeExperience({
  today,
  isIndividual = false,
  onAction,
  supplementaryContent,
  trainingImage = TRAINING_IMAGE,
}: Props) {
  const isEmpty = isNewAthleteState(today);
  return (
    <View style={styles.page}>
      <AthleteGreeting today={today} welcome={isEmpty} />
      {isEmpty ? (
        <NewAthleteContent isIndividual={isIndividual} onAction={onAction} today={today} />
      ) : (
        <PopulatedContent
          onAction={onAction}
          supplementaryContent={supplementaryContent}
          today={today}
          trainingImage={trainingImage}
        />
      )}
    </View>
  );
}

function AthleteGreeting({ today, welcome = false }: { today: TodayHomeData; welcome?: boolean }) {
  const name = firstName(today.athlete?.name) || 'Athlete';
  return (
    <View style={styles.identityRow}>
      <SLProfileAvatar
        name={today.athlete?.name}
        profilePhotoUrl={today.athlete?.profilePhotoUrl}
        profilePhotoVersion={today.athlete?.profilePhotoVersion}
        size={54}
        borderRadius={27}
        style={styles.avatar}
      />
      <View style={styles.identityCopy}>
        <Text style={styles.greeting}>{`${welcome ? 'Welcome' : greetingForNow()}, ${name}`}</Text>
        <Text style={styles.dateText}>{formatLongDate(today.date)}</Text>
      </View>
    </View>
  );
}

function PopulatedContent({
  today,
  onAction,
  supplementaryContent,
  trainingImage,
}: {
  today: TodayHomeData;
  onAction: Props['onAction'];
  supplementaryContent?: ReactNode;
  trainingImage: ImageSourcePropType;
}) {
  const session = today.mission?.session;
  const coachAction = getCoachAction(today);
  const upcoming = getUpcoming(today);
  const hasMemory = Boolean(today.progress_signal?.kind && today.progress_signal.kind !== 'empty');

  return (
    <>
      <TrainingHero onAction={onAction} session={session} today={today} trainingImage={trainingImage} />
      {supplementaryContent}
      {coachAction ? <CoachActionRow item={coachAction} onAction={onAction} /> : null}
      <WeekRail today={today} />
      {upcoming.length ? <UpcomingRow items={upcoming} onAction={onAction} /> : null}
      {hasMemory ? <LedgerMemory onAction={onAction} today={today} /> : null}
    </>
  );
}

function TrainingHero({
  today,
  session,
  onAction,
  trainingImage,
}: {
  today: TodayHomeData;
  session?: SessionSummary | null;
  onAction: Props['onAction'];
  trainingImage: ImageSourcePropType;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 410;
  const duration = session?.estimated_duration_minutes ?? session?.preview?.estimated_duration_minutes;
  const status = String(session?.status ?? today.mission?.status ?? '').toLowerCase();
  const actionLabel = status.includes('progress')
    ? 'Resume Session'
    : status.includes('complete') || status.includes('logged') || status.includes('done')
      ? 'View Recap'
      : 'Begin Session';
  const programLine = buildProgramLine(today);
  const movementLine = buildMovementLine(session);
  const responsiveMovementLine = compact
    ? movementLine.replace(/ · (?=\d+\s+accessor)/i, '\n')
    : movementLine;
  const readiness = readinessPresentation(today.readiness);

  return (
    <SLSurface
      level={3}
      materialAccent={SLColors.illuminationAccent}
      materialQuality="full"
      style={styles.trainingHero}
      contentStyle={styles.trainingHeroContent}
    >
      <View style={styles.heroAtmosphere}>
        <View pointerEvents="none" style={[styles.heroMedia, compact && styles.heroMediaCompact]}>
          <ImageBackground
            accessible={false}
            resizeMode="cover"
            source={trainingImage}
            style={StyleSheet.absoluteFillObject}
          >
            <LinearGradient
              colors={[
                'rgba(5, 5, 10, 1)',
                'rgba(7, 6, 14, 0.96)',
                'rgba(8, 6, 16, 0.52)',
                'rgba(3, 3, 8, 0.10)',
              ]}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.22, 0.64, 1]}
              start={{ x: 0, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={['rgba(3, 3, 7, 0.06)', 'rgba(3, 3, 7, 0.38)']}
              end={{ x: 0.5, y: 1 }}
              start={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </ImageBackground>
        </View>
        <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
          <Text style={styles.sectionEyebrow}>TODAY&apos;S TRAINING</Text>
          <Text numberOfLines={2} style={styles.heroTitle}>{session?.label || today.mission?.title || 'Training session'}</Text>
          {programLine ? <Text numberOfLines={1} style={styles.supporting}>{programLine}</Text> : null}
          {duration ? (
            <View style={styles.inlineMeta}>
              <Ionicons color={SLColors.textMuted} name="time-outline" size={15} />
              <Text style={styles.supporting}>{`About ${Math.round(duration)} min`}</Text>
            </View>
          ) : null}
          {responsiveMovementLine ? <Text numberOfLines={2} style={styles.movementSummary}>{responsiveMovementLine}</Text> : null}
        </View>
        {readiness ? (
          <Pressable
            accessibilityLabel={`Readiness ${readiness.title}. ${readiness.detail}`}
            accessibilityRole="button"
            onPress={() => onAction({ route: 'session_surveys', label: 'Open readiness' })}
            style={({ pressed }) => [styles.readinessRow, pressed && styles.pressed]}
          >
            <View style={styles.readinessIcon}>
              <Ionicons color={SLColors.accentViolet} name="pulse-outline" size={22} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{readiness.title}</Text>
              <Text numberOfLines={1} style={styles.rowDetail}>{readiness.detail}</Text>
            </View>
            <Ionicons color={SLColors.iconPrimary} name="arrow-forward" size={18} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.heroCta}>
        <SLButton
          fullWidth
          iconRight="arrow-forward"
          iconRightPosition="edge"
          label={actionLabel}
          onPress={() => onAction(today.primary_action ?? { route: 'workout', workout_id: session?.id })}
        />
      </View>
    </SLSurface>
  );
}

function CoachActionRow({ item, onAction }: { item: ReturnType<typeof getCoachAction>; onAction: Props['onAction'] }) {
  if (!item) return null;
  return (
    <SLSurface
      accessibilityLabel={item.title}
      interactive
      level={2}
      materialAccent={SLColors.illuminationAccent}
      onPress={() => onAction(item.action)}
      style={styles.coachRow}
      contentStyle={styles.horizontalRow}
    >
      <Ionicons color={SLColors.iconPrimary} name="person-outline" size={20} />
      <Text numberOfLines={2} style={styles.coachTitle}>{item.title}</Text>
      {item.age ? <Text style={styles.rowDetail}>{item.age}</Text> : null}
      <Ionicons color={SLColors.iconMuted} name="chevron-forward" size={18} />
    </SLSurface>
  );
}

function WeekRail({ today, empty = false }: { today: TodayHomeData; empty?: boolean }) {
  const days = buildWeek(today, empty);
  const week = today.next_glance?.week;
  return (
    <SLSurface level={1} materialAccent={SLColors.illuminationAccent} style={styles.weekCard} contentStyle={styles.weekContent}>
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionEyebrow}>THIS WEEK</Text>
        {!empty && week?.assigned ? <Text style={styles.sectionMeta}>{`${week.logged ?? 0} of ${week.assigned} complete`}</Text> : null}
      </View>
      <View style={styles.weekRail}>
        {days.map((day) => (
          <View
            accessibilityLabel={day.accessibilityLabel}
            accessible
            key={day.date}
            style={[styles.dayCell, day.isToday && styles.dayCellToday]}
          >
            <Text style={[styles.dayName, day.isToday && styles.dayTodayText]}>{day.day}</Text>
            <View style={styles.dayState}>
              {day.isToday ? <Text style={styles.todayLabel}>TODAY</Text> : null}
              {day.state === 'complete' ? (
                <Ionicons color={SLColors.success} name="checkmark-circle" size={15} />
              ) : day.state === 'session' ? (
                <Ionicons color={SLColors.accentViolet} name="barbell-outline" size={15} />
              ) : day.state === 'missed' ? (
                <Ionicons color={SLColors.danger} name="alert-circle" size={15} />
              ) : !day.isToday ? (
                <Text style={styles.dayDash}>—</Text>
              ) : null}
              {day.sessionCount > 1 ? <Text style={styles.dayCount}>{day.sessionCount}</Text> : null}
            </View>
            <Text style={styles.dayDate}>{day.label}</Text>
          </View>
        ))}
      </View>
      {empty ? <Text style={styles.emptyWeekCopy}>Your schedule will appear here.</Text> : null}
    </SLSurface>
  );
}

function UpcomingRow({ items, onAction }: { items: ReturnType<typeof getUpcoming>; onAction: Props['onAction'] }) {
  return (
    <View style={styles.upcomingRow}>
      {items.map((item) => (
        <SLSurface
          accessibilityLabel={`${item.eyebrow}: ${item.title}`}
          interactive
          key={`${item.eyebrow}-${item.title}`}
          level={1}
          materialAccent={SLColors.illuminationAccent}
          onPress={() => onAction(item.action)}
          style={styles.upcomingCard}
          contentStyle={styles.upcomingContent}
        >
          <Text style={styles.sectionEyebrow}>{item.eyebrow}</Text>
          <View style={styles.upcomingTitleRow}>
            <View style={styles.rowCopy}>
              <Text numberOfLines={2} style={styles.rowTitle}>{item.title}</Text>
              {item.detail ? <Text style={styles.rowDetail}>{item.detail}</Text> : null}
            </View>
            <Ionicons color={SLColors.iconPrimary} name="chevron-forward" size={17} />
          </View>
        </SLSurface>
      ))}
    </View>
  );
}

function LedgerMemory({ today, onAction }: { today: TodayHomeData; onAction: Props['onAction'] }) {
  const signal = today.progress_signal;
  return (
    <SLSurface
      accessibilityLabel={`Open Ledger. ${signal?.label || 'Strength memory'}`}
      interactive
      level={2}
      materialAccent={SLColors.illuminationAccent}
      onPress={() => onAction({ route: 'ledger', label: 'Open Ledger' })}
      style={styles.ledgerCard}
      contentStyle={styles.ledgerContent}
    >
      <View style={styles.ledgerIcon}>
        <Ionicons color={SLColors.accentViolet} name="book-outline" size={31} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.sectionEyebrow}>LEDGER</Text>
        <Text numberOfLines={2} style={styles.rowTitle}>{signal?.label || 'A moment worth remembering'}</Text>
        {signal?.body ? <Text numberOfLines={2} style={styles.rowDetail}>{signal.body}</Text> : null}
      </View>
      <Ionicons color={SLColors.iconPrimary} name="chevron-forward" size={18} />
    </SLSurface>
  );
}

function NewAthleteContent({ today, isIndividual, onAction }: { today: TodayHomeData; isIndividual: boolean; onAction: Props['onAction'] }) {
  const coachName = firstName(today.coach?.name);
  const hasCoach = Boolean(today.coach?.id || today.coach?.name || today.coach?.email);
  const completed = hasCoach ? 1 : 0;
  return (
    <>
      <SLSurface
        level={3}
        materialAccent="rgba(232, 61, 154, 0.20)"
        materialQuality="full"
        style={styles.emptyHero}
        contentStyle={styles.emptyHeroContent}
      >
        <View style={styles.emptyHeroTop}>
          <View style={styles.emptyHeroCopy}>
            <Text style={styles.sectionEyebrow}>TODAY</Text>
            <Text style={styles.emptyHeroTitle}>{isIndividual ? 'Your first session starts with you' : 'Your first session is on its way'}</Text>
            <Text style={styles.emptyHeroBody}>
              {isIndividual
                ? 'Create your first plan when you are ready.'
                : hasCoach
                  ? `Your coach${coachName ? `, ${coachName},` : ''} is building your plan.`
                  : 'Connect with a coach to begin building your plan.'}
            </Text>
          </View>
          <Ionicons color={SLColors.accentViolet} name="clipboard-outline" size={80} style={styles.clipboard} />
        </View>
        {hasCoach ? (
          <SLButton
            fullWidth
            iconLeft="chatbubble-outline"
            iconRight="arrow-forward"
            iconRightPosition="edge"
            label="Message Coach"
            onPress={() => onAction({ route: 'messages', label: 'Message Coach' })}
            variant="primary"
          />
        ) : null}
      </SLSurface>

      <SLSurface level={2} materialAccent={SLColors.illuminationAccent} style={styles.setupCard} contentStyle={styles.setupContent}>
        <Text style={styles.sectionEyebrow}>{`SET YOUR STARTING POINT · ${completed} OF 3`}</Text>
        <SetupRow active={!hasCoach} complete={hasCoach} detail={hasCoach ? 'You’re all set' : 'Choose how you want to train'} index="1" label={hasCoach ? 'Coach connected' : 'Choose your coaching setup'} onPress={() => onAction({ route: hasCoach ? 'messages' : 'training', label: 'Coaching setup' })} />
        <SetupRow active={hasCoach} detail="Tell your coach what matters" index="2" label="Add training goals" onPress={() => onAction({ route: 'training_focus', label: 'Add training goals' })} />
        <SetupRow detail="Help your coach get the full picture" index="3" label="Complete first check-in" onPress={() => onAction({ route: 'session_surveys', label: 'Complete first check-in' })} />
      </SLSurface>

      <WeekRail empty today={today} />

      <SLSurface
        accessibilityLabel="Open The Ledger"
        interactive
        level={2}
        materialAccent={SLColors.illuminationAccent}
        onPress={() => onAction({ route: 'ledger', label: 'Open The Ledger' })}
        style={styles.ledgerCard}
        contentStyle={styles.ledgerContent}
      >
        <View style={styles.ledgerIcon}>
          <Ionicons color={SLColors.accentViolet} name="book-outline" size={31} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.sectionEyebrow}>LEDGER</Text>
          <Text style={styles.rowTitle}>Your Ledger begins here —</Text>
          <Text style={styles.rowDetail}>Every session becomes part of your story.</Text>
        </View>
        <Ionicons color={SLColors.iconPrimary} name="chevron-forward" size={18} />
      </SLSurface>
    </>
  );
}

function SetupRow({ active = false, complete = false, detail, index, label, onPress }: { active?: boolean; complete?: boolean; detail: string; index: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.setupRow, active && styles.setupRowActive, pressed && styles.pressed]}>
      <View style={[styles.setupNumber, complete && styles.setupComplete]}>
        {complete ? <Ionicons color={SLColors.success} name="checkmark" size={16} /> : <Text style={[styles.setupNumberText, active && styles.setupNumberTextActive]}>{index}</Text>}
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.setupLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Ionicons color={SLColors.iconPrimary} name="chevron-forward" size={17} />
    </Pressable>
  );
}

function isNewAthleteState(today: TodayHomeData) {
  const week = today.next_glance?.week;
  const hasHistory = Boolean(today.recent_glance?.workout_id || (week?.logged ?? 0) > 0);
  const hasPlan = Boolean(today.phase?.active_program?.id || today.phase?.block?.id || (week?.assigned ?? 0) > 0);
  const hasSignal = Boolean(today.progress_signal?.kind && today.progress_signal.kind !== 'empty');
  return !today.mission?.session && !hasHistory && !hasPlan && !hasSignal;
}

function getCoachAction(today: TodayHomeData) {
  const guidance = today.coach_guidance;
  const hasActionableGuidance = Boolean(
    guidance?.source
      && guidance.source !== 'empty'
      && guidance.title
      && !guidance.title.trim().toLowerCase().startsWith('no coach update'),
  );
  if (hasActionableGuidance && guidance) {
    return {
      title: guidance.title!,
      age: relativeAge(guidance.created_at),
      action: { route: guidance.route || 'feedback', workout_id: guidance.workout_id },
    };
  }
  if (today.latest_announcement?.title || today.latest_announcement?.body) {
    return {
      title: today.latest_announcement.title || today.latest_announcement.body || 'Coach announcement',
      age: relativeAge(today.latest_announcement.created_at),
      action: { route: today.latest_announcement.route || 'announcements' },
    };
  }
  if (today.latest_message?.body || today.latest_message?.title) {
    return {
      title: today.latest_message.body || today.latest_message.title || 'Coach message',
      age: relativeAge(today.latest_message.created_at),
      action: { route: today.latest_message.route || 'message_thread', thread_id: today.latest_message.thread_id },
    };
  }
  return null;
}

function getUpcoming(today: TodayHomeData) {
  const items: { eyebrow: string; title: string; detail?: string; action: TodayHomeAction }[] = [];
  if (today.next_glance?.workout_id && today.next_glance.title) {
    items.push({
      eyebrow: 'NEXT UP',
      title: today.next_glance.title,
      detail: formatCompactDate(today.next_glance.date),
      action: { route: 'workout', workout_id: today.next_glance.workout_id },
    });
  }
  if (today.phase?.meet?.id && today.phase.meet.name) {
    items.push({
      eyebrow: 'MEET',
      title: today.phase.meet.name,
      detail: typeof today.phase.meet.days_until === 'number' ? `${today.phase.meet.days_until} days` : formatCompactDate(today.phase.meet.date),
      action: { route: 'meet', meet_plan_id: today.phase.meet.id },
    });
  }
  return items;
}

function buildProgramLine(today: TodayHomeData) {
  const program = today.phase?.active_program;
  const name = program?.name || today.phase?.block?.name;
  if (!name) return '';
  const week = programWeek(program?.start_date, today.date);
  return week ? `${name} · Week ${week}` : name;
}

function buildMovementLine(session?: SessionSummary | null) {
  const lifts = (session?.preview?.primary_lifts || []).map(simplifyMobileMovementName).filter(Boolean);
  const primary = lifts.slice(0, 2).join(' · ');
  const accessories = session?.preview?.accessory_count ?? 0;
  if (!primary && !accessories) return '';
  return [primary, accessories ? `${accessories} accessor${accessories === 1 ? 'y' : 'ies'}` : ''].filter(Boolean).join(' · ');
}

function readinessPresentation(readiness?: TodayHomeData['readiness']) {
  const score = readiness?.score;
  if (score == null) return null;
  const displayScore = score <= 5 ? Math.round(score * 2) : Math.round(score);
  const energy = readiness?.latest?.energy ?? readiness?.metrics?.energy;
  const soreness = readiness?.latest?.soreness ?? readiness?.metrics?.soreness;
  const detail = [energy != null ? `Energy ${readinessWord(energy, false)}` : '', soreness != null ? `Soreness ${readinessWord(soreness, true)}` : '']
    .filter(Boolean)
    .join(' · ');
  return { title: `Ready ${displayScore}/10`, detail: detail || readiness?.message || 'Readiness recorded' };
}

function readinessWord(value: number, inverse: boolean) {
  const high = value >= 4;
  const low = value <= 2;
  if (inverse) return high ? 'high' : low ? 'low' : 'steady';
  return high ? 'high' : low ? 'low' : 'steady';
}

function buildWeek(today: TodayHomeData, empty: boolean) {
  const fallbackSessions: AthleteHomeWeekSession[] = [
    today.yesterday,
    today.tomorrow,
    today.next_glance,
    today.recent_glance,
    today.mission?.session,
  ].filter((item): item is AthleteHomeWeekSession => Boolean(item?.date));

  return buildAthleteHomeWeek({
    todayDate: today.date,
    sessions: today.week_preview,
    fallbackSessions,
    empty,
  });
}

function greetingForNow() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function firstName(value?: string | null) {
  return String(value || '').trim().split(/\s+/)[0] || '';
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLongDate(value?: string | null) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
}

function formatCompactDate(value?: string | null) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}

function programWeek(start?: string | null, current?: string | null) {
  const startDate = parseDate(start);
  const currentDate = parseDate(current);
  if (!startDate || !currentDate || currentDate < startDate) return null;
  return Math.floor((currentDate.getTime() - startDate.getTime()) / 604800000) + 1;
}

function relativeAge(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  page: { gap: 10, paddingTop: 10, paddingBottom: 118 },
  identityRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  avatar: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.objectRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard },
  identityCopy: { flex: 1, minWidth: 0 },
  greeting: { color: SLColors.textSecondary, fontSize: 15, lineHeight: 20 },
  dateText: { color: SLColors.textMuted, fontSize: 14, lineHeight: 19 },
  sectionEyebrow: { color: SLColors.accentViolet, fontSize: 11, lineHeight: 15, letterSpacing: 0.45, fontWeight: '700' },
  trainingHero: {
    minHeight: 282,
    overflow: 'hidden',
    backgroundColor: SLColors.canvasRaised,
    borderColor: SLColors.borderFocus,
  },
  trainingHeroContent: { padding: 0, overflow: 'hidden' },
  heroAtmosphere: { minHeight: 224, position: 'relative', gap: 10, overflow: 'hidden', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  heroMedia: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '54%', overflow: 'hidden' },
  heroMediaCompact: { width: '50%' },
  heroCopy: { zIndex: 2, width: '64%', minHeight: 144, gap: 4, paddingTop: 1 },
  heroCopyCompact: { width: '74%' },
  heroCta: { zIndex: 2, paddingHorizontal: 12, paddingBottom: 12 },
  heroTitle: { color: SLColors.textPrimary, fontSize: 21, lineHeight: 26, fontWeight: '700', marginTop: 5 },
  supporting: { color: SLColors.textMuted, fontSize: 13, lineHeight: 18 },
  inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  movementSummary: { color: SLColors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  readinessRow: { minHeight: 49, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, backgroundColor: SLColors.surfaceInset, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 7 },
  readinessIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: SLColors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: SLColors.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  rowDetail: { color: SLColors.textMuted, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
  coachRow: { minHeight: 48 },
  horizontalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 9 },
  coachTitle: { flex: 1, color: SLColors.textSecondary, fontSize: 13, lineHeight: 18 },
  weekCard: { minHeight: 122, backgroundColor: SLColors.canvasRaised },
  weekContent: { gap: 8, paddingHorizontal: 9, paddingVertical: 10 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionMeta: { color: SLColors.textMuted, fontSize: 12 },
  weekRail: { flexDirection: 'row', gap: 4 },
  dayCell: { flex: 1, minWidth: 0, height: 72, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderHairline, backgroundColor: SLColors.surfaceInset, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  dayCellToday: { borderColor: SLColors.borderFocus, backgroundColor: SLColors.accentSoft },
  dayName: { color: SLColors.textMuted, fontSize: 10, lineHeight: 13 },
  dayTodayText: { color: SLColors.textSecondary },
  dayState: { minHeight: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  todayLabel: { color: SLColors.accentViolet, fontSize: 8, fontWeight: '700' },
  dayCount: { color: SLColors.textMuted, fontSize: 8, fontWeight: '800' },
  dayDash: { color: SLColors.textSubtle, fontSize: 14 },
  dayDate: { color: SLColors.textMuted, fontSize: 9 },
  emptyWeekCopy: { color: SLColors.textMuted, fontSize: 12, paddingHorizontal: 4 },
  upcomingRow: { flexDirection: 'row', gap: 8 },
  upcomingCard: { flex: 1, minWidth: 0, minHeight: 84, backgroundColor: SLColors.canvasRaised },
  upcomingContent: { gap: 7, paddingHorizontal: 12, paddingVertical: 10 },
  upcomingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ledgerCard: { minHeight: 86, backgroundColor: SLColors.canvasRaised },
  ledgerContent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 11 },
  ledgerIcon: { width: 50, alignItems: 'center', justifyContent: 'center' },
  emptyHero: { minHeight: 216 },
  emptyHeroContent: { gap: 14, padding: 13 },
  emptyHeroTop: { minHeight: 132, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyHeroCopy: { flex: 1, minWidth: 0, gap: 7 },
  emptyHeroTitle: { color: SLColors.textPrimary, fontSize: 22, lineHeight: 27, fontWeight: '700' },
  emptyHeroBody: { color: SLColors.textSecondary, fontSize: 14, lineHeight: 20 },
  clipboard: { width: 92, textAlign: 'center', opacity: 0.9 },
  setupCard: { minHeight: 190, backgroundColor: SLColors.canvasRaised },
  setupContent: { gap: 4, paddingHorizontal: 13, paddingVertical: 12 },
  setupRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: SLRadius.md, paddingHorizontal: 7 },
  setupRowActive: { backgroundColor: SLColors.accentSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderFocus },
  setupNumber: { width: 31, height: 31, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  setupComplete: { borderColor: SLColors.success, backgroundColor: 'rgba(143, 178, 154, 0.14)' },
  setupNumberText: { color: SLColors.textSecondary, fontSize: 13 },
  setupNumberTextActive: { color: SLColors.accentViolet, fontWeight: '700' },
  setupLabel: { color: SLColors.textSecondary, fontSize: 14, lineHeight: 18, fontWeight: '600' },
});
