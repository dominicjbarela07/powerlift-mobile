import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { MuscleMap } from '@/components/anatomy/MuscleMap';
import { HomeTrendPlot } from '@/components/home/HomeTrendPlot';
import { SLProfileAvatar } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';
import { SLColors } from '@/constants/theme';
import {
  type AthleteHomeState,
  type AthleteHomeV3Projection,
  type HomeAction,
  type HomeAchievement,
  type HomeSessionEvidence,
  resolveHomeState,
} from '@/lib/athlete-home-v3';
import {
  convertDisplayWeightValue,
  formatCalculatedWeightFromKg,
  formatCompactVolumeValueFromKg,
  formatWeightDeltaFromKg,
  formatWeightFromKg,
  kilogramsToDisplayValue,
  normalizeDisplayWeightUnit,
} from '@/lib/display-units';
import type { HomePlotDatum } from '@/lib/home-trend-plot';
import { SESSION_RECAP_ARCHIVE_ART } from '@/lib/session-recap-assets';

const TRAINING_ART = require('@/assets/images/gym_vibe.jpg');
const RECOVERY_ART = require('@/assets/images/chair.png');
const ACHIEVEMENT_ART = require('@/assets/images/ledger-index-v2/ledger-career-pr-medallion-v1.png');
const MEET_ART = require('@/assets/images/gym_vibe.jpg');
const MEET_RACK_ART = require('@/assets/images/ledger-index-v2/ledger-core-squat-rack-v1.png');
const SESSION_FOCUS_ART = require('@/assets/images/ledger-index-v2/ledger-core-squat-rack-v1.png');
const REST_ART = require('@/assets/images/ledger-index-v2/ledger-chapter-journey-v1.png');

type Today = {
  date: string;
  athlete?: {
    name?: string | null;
    profilePhotoUrl?: string | null;
    profilePhotoVersion?: string | null;
    preferred_units?: string | null;
    anatomy_display_preference?: string | null;
    sex?: string | null;
  } | null;
  daily_check_in?: {
    readiness_score?: number | null;
    bodyweight_kg?: number | null;
    energy?: number | null;
    soreness?: number | null;
  } | null;
  daily_check_in_action?: HomeAction | null;
  capabilities?: { can_daily_check_in?: boolean; has_daily_check_in?: boolean } | null;
  home_v3?: AthleteHomeV3Projection | null;
};

type Props = {
  today: Today;
  isIndividual?: boolean;
  preferredUnits?: string | null;
  onAction: (action?: HomeAction | null) => void;
  supplementaryContent?: React.ReactNode;
};

export function AthleteHomeV3({ today, isIndividual = false, preferredUnits, onAction, supplementaryContent }: Props) {
  const home = today.home_v3 || {};
  const state = resolveHomeState(home);
  const unit = normalizeDisplayWeightUnit(preferredUnits ?? today.athlete?.preferred_units);

  return (
    <View style={styles.page}>
      <Greeting today={today} state={state} />
      <StateHero home={home} onAction={onAction} state={state} today={today} unit={unit} />
      {supplementaryContent}
      <WeekSection home={home} onAction={onAction} today={today} unit={unit} />
      {home.next_up ? <SessionCard eyebrow="NEXT UP" onAction={onAction} session={home.next_up} today={today} unit={unit} /> : null}
      {home.last_session ? <LastSessionCard home={home} onAction={onAction} today={today} unit={unit} /> : null}
      <TrendsSection home={home} onAction={onAction} unit={unit} />
      {home.strength ? (
        <StrengthCard home={home} onAction={onAction} unit={unit} />
      ) : null}
      {home.achievement ? <AchievementCard achievement={home.achievement} onAction={onAction} unit={unit} /> : null}
      {isIndividual ? <SelfCoachedActions actions={home.self_coached_actions || []} onAction={onAction} /> : null}
    </View>
  );
}

function Greeting({ today, state }: { today: Today; state: AthleteHomeState }) {
  const first = String(today.athlete?.name || 'Athlete').trim().split(/\s+/)[0];
  return (
    <View style={styles.greetingRow}>
      <SLProfileAvatar
        name={today.athlete?.name}
        profilePhotoUrl={today.athlete?.profilePhotoUrl}
        profilePhotoVersion={today.athlete?.profilePhotoVersion}
        size={42}
        borderRadius={21}
      />
      <View style={styles.flex}>
        <Text style={styles.greeting}>{`${greetingForNow()}, ${first}`}</Text>
        <Text style={styles.greetingDate}>{formatLongDate(today.date)}</Text>
      </View>
      <View style={[styles.stateDot, { backgroundColor: stateColor(state) }]} />
    </View>
  );
}

function StateHero({ home, onAction, state, today, unit }: {
  home: AthleteHomeV3Projection;
  onAction: Props['onAction'];
  state: AthleteHomeState;
  today: Today;
  unit: 'kg' | 'lb';
}) {
  if (state === 'meet') return <MeetHero home={home} onAction={onAction} />;
  if (state === 'achievement') return <AchievementHero achievement={home.hero?.achievement || home.achievement} onAction={onAction} unit={unit} />;
  if (state === 'recovery') return <RecoveryHero onAction={onAction} today={today} unit={unit} />;
  if (state === 'rest') return <RestHero home={home} onAction={onAction} />;
  return <TrainingHero home={home} onAction={onAction} today={today} />;
}

function HeroFrame({ art, children, accent = '#9C4DFF' }: { art: any; children: React.ReactNode; accent?: string }) {
  return (
    <View style={[styles.hero, { borderColor: `${accent}66` }]}>
      <ImageBackground source={art} resizeMode="cover" style={StyleSheet.absoluteFillObject}>
        <LinearGradient colors={['#030306', 'rgba(3,3,7,0.92)', 'rgba(3,3,7,0.22)']} locations={[0, 0.44, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(3,3,7,0.04)', 'rgba(3,3,7,0.80)']} style={StyleSheet.absoluteFillObject} />
      </ImageBackground>
      {children}
    </View>
  );
}

function TrainingHero({ home, onAction, today }: { home: AthleteHomeV3Projection; onAction: Props['onAction']; today: Today }) {
  const session = home.hero?.session;
  const status = String(session?.status || '').toLowerCase();
  const completed = ['completed', 'logged', 'done'].includes(status);
  const actionLabel = status === 'in_progress' ? 'Resume Session' : completed ? 'View Session Recap' : 'Open Session';
  const focus = muscleIds(session);
  const programLine = [home.program?.name, home.program?.week_number ? `Week ${home.program.week_number}` : null].filter(Boolean).join(' · ');
  return (
    <HeroFrame art={TRAINING_ART}>
      <View style={styles.heroCopy}>
        <Text style={styles.heroEyebrow}>{completed ? 'COMPLETED TODAY' : status === 'in_progress' ? 'IN PROGRESS' : 'TODAY'}</Text>
        <Text numberOfLines={2} style={styles.heroTitle}>{session?.title || 'Training Session'}</Text>
        {programLine ? <Text style={styles.heroMeta}>{programLine}</Text> : null}
        <View style={styles.heroEvidence}>
          <Evidence icon="layers-outline" text={setEvidence(session, completed)} />
          {focus.labels.length ? <Evidence icon="accessibility-outline" text={focus.labels.slice(0, 3).join(' · ')} /> : null}
          <Evidence icon="pulse-outline" text={completed ? 'Performed evidence' : 'Programmed focus'} />
        </View>
      </View>
      {focus.primary.length ? (
        <View pointerEvents="none" style={styles.heroAnatomy}>
          <MuscleMap athlete={today.athlete} primary={focus.primary} secondary={focus.secondary} size="card" />
        </View>
      ) : null}
      <HeroButton label={actionLabel} onPress={() => onAction(session?.action || { route: 'workout', workout_id: session?.id })} />
    </HeroFrame>
  );
}

function RecoveryHero({ onAction, today, unit }: { onAction: Props['onAction']; today: Today; unit: 'kg' | 'lb' }) {
  const checkIn = today.daily_check_in;
  const score = normalizedReadiness(checkIn?.readiness_score);
  const weight = formatWeightFromKg(checkIn?.bodyweight_kg, unit);
  return (
    <HeroFrame accent="#38D39F" art={RECOVERY_ART}>
      <Image resizeMode="cover" source={RECOVERY_ART} style={styles.recoveryScene} />
      <View style={styles.heroCopy}>
        <Text style={[styles.heroEyebrow, styles.green]}>TODAY · RECOVERY DAY</Text>
        <Text style={styles.heroTitle}>Recovery Day</Text>
        <Text style={styles.heroMeta}>{[homeContext(today), checkIn ? 'Check-in recorded' : null].filter(Boolean).join(' · ')}</Text>
        {checkIn ? (
          <View style={styles.recoveryMetrics}>
            <HeroMetric label="READINESS" value={score == null ? 'Recorded' : `${score}/10`} />
            {weight ? <HeroMetric label="REPORTED BW" value={weight} /> : null}
          </View>
        ) : (
          <View style={styles.optionalBox}>
            <Text style={styles.heroEyebrow}>OPTIONAL CHECK-IN</Text>
            <Text style={styles.optionalText}>Record readiness, recovery & bodyweight</Text>
          </View>
        )}
      </View>
      <HeroButton
        label={checkIn ? "View Today's Check-In" : 'Check In'}
        onPress={() => onAction(today.daily_check_in_action || { route: 'daily_readiness' })}
        accent="#38D39F"
      />
    </HeroFrame>
  );
}

function AchievementHero({ achievement, onAction, unit }: { achievement?: HomeAchievement | null; onAction: Props['onAction']; unit: 'kg' | 'lb' }) {
  return (
    <HeroFrame accent="#F2B94B" art={ACHIEVEMENT_ART}>
      <View style={styles.heroCopy}>
        <Text style={[styles.heroEyebrow, styles.gold]}>TODAY · {achievementLabel(achievement)}</Text>
        <Text style={styles.heroTitle}>PR Day! 🎉</Text>
        <Text style={[styles.achievementValue, styles.green]}>{achievementValue(achievement, unit)}</Text>
        <Text style={styles.heroMeta}>{achievement?.movement_label || 'New personal record'}</Text>
      </View>
      <View style={styles.achievementMedallion}><Image resizeMode="contain" source={ACHIEVEMENT_ART} style={styles.achievementImage} /></View>
      <HeroButton label="View PR in Ledger" onPress={() => onAction(achievement?.action || { route: 'ledger_achievement', workout_id: achievement?.workout_id })} />
    </HeroFrame>
  );
}

function MeetHero({ home, onAction }: { home: AthleteHomeV3Projection; onAction: Props['onAction'] }) {
  const meet = home.hero?.meet;
  return (
    <HeroFrame accent="#DA4BFF" art={MEET_ART}>
      <Image resizeMode="contain" source={MEET_RACK_ART} style={styles.meetRackArt} />
      <View style={styles.heroCopy}>
        <Text style={styles.heroEyebrow}>TODAY</Text>
        <Text style={[styles.heroTitle, styles.magenta]}>Meet Day</Text>
        <Text style={styles.heroMeta}>{meet?.name || 'Competition'}</Text>
        <View style={styles.meetTimeline}>
          {(meet?.timeline || []).slice(0, 4).map((item, index) => (
            <View key={`${item.label}-${index}`} style={styles.meetLine}>
              <Ionicons name="ellipse" color="#BC68FF" size={6} />
              <Text style={styles.meetLabel}>{item.label}</Text>
              {item.time ? <Text style={styles.meetTime}>{item.time}</Text> : null}
            </View>
          ))}
        </View>
      </View>
      <HeroButton label="Meet Dashboard" onPress={() => onAction(meet?.action || { route: 'meet', meet_plan_id: meet?.id })} />
    </HeroFrame>
  );
}

function RestHero({ home, onAction }: { home: AthleteHomeV3Projection; onAction: Props['onAction'] }) {
  return (
    <HeroFrame accent="#5C8CFF" art={REST_ART}>
      <View style={styles.heroCopy}>
        <Text style={styles.heroEyebrow}>TODAY</Text>
        <Text style={styles.heroTitle}>Rest Day</Text>
        <Text style={styles.heroMeta}>{home.next_up ? `Next: ${home.next_up.title}` : 'No programmed Session'}</Text>
        <View style={styles.restLinks}>
          <MiniLink icon="calendar-outline" label="Open Calendar" onPress={() => onAction({ route: 'calendar' })} />
          <MiniLink icon="book-outline" label="View The Ledger" onPress={() => onAction({ route: 'ledger' })} />
        </View>
      </View>
    </HeroFrame>
  );
}

function HeroButton({ accent = '#7C37D9', label, onPress }: { accent?: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.heroButton, { backgroundColor: accent }, pressed && styles.pressed]}>
      <Text style={styles.heroButtonText}>{label}</Text>
      <Ionicons color="#FFFFFF" name="arrow-forward-circle" size={19} />
    </Pressable>
  );
}

function WeekSection({ home, onAction, today, unit }: { home: AthleteHomeV3Projection; onAction: Props['onAction']; today: Today; unit: 'kg' | 'lb' }) {
  const days = sevenDays(home, today.date);
  const metrics = home.week?.performed || {};
  const available = projectionAvailable(home);
  return (
    <Pressable accessibilityRole="button" onPress={() => onAction(home.week?.action || { route: 'calendar' })} style={({ pressed }) => [styles.weekSection, pressed && styles.pressed]}>
      <SectionHeader label="THIS WEEK" meta={`${metrics.sessions ?? 0} completed`} />
      <View style={styles.weekRail}>
        {days.map((day) => <DayCell day={day} key={day.date} />)}
      </View>
      <View style={styles.metricStrip}>
        <Metric value={metricValue(metrics.sessions, available)} label="Sessions" />
        <Metric value={metricValue(metrics.sets, available)} label="Sets" />
        <Metric value={formatCompactVolumeValueFromKg(metrics.total_volume_kg, unit) || missingMetricLabel(available, metrics.total_volume_kg)} label="Total Volume" />
        <Metric value={metricValue(metrics.pr_count, available)} label="PRs" />
      </View>
    </Pressable>
  );
}

function DayCell({ day }: { day: ReturnType<typeof sevenDays>[number] }) {
  const icon = day.kind === 'completed' ? 'checkmark-circle' : day.kind === 'meet' ? 'trophy' : day.kind === 'recovery' ? 'moon' : day.kind === 'session' || day.kind === 'in_progress' ? 'barbell' : null;
  const color = day.kind === 'completed' ? '#43D38A' : day.kind === 'meet' ? '#F0B84B' : day.kind === 'recovery' ? '#50C7D8' : '#A85BFF';
  return (
    <View style={[styles.dayCell, day.is_today && styles.dayToday]}>
      <Text style={[styles.dayName, day.is_today && styles.violet]}>{weekday(day.date)}</Text>
      {icon ? <Ionicons color={color} name={icon as any} size={15} /> : <View style={styles.emptyDot} />}
      <Text style={styles.dayDate}>{dayNumber(day.date)}</Text>
      {day.achievement ? <Ionicons color="#F0B84B" name="sparkles" size={8} style={styles.dayAchievement} /> : null}
    </View>
  );
}

function SessionCard({ eyebrow, onAction, session, today, unit }: { eyebrow: string; onAction: Props['onAction']; session: HomeSessionEvidence; today: Today; unit: 'kg' | 'lb' }) {
  const focus = muscleIds(session);
  const completed = ['completed', 'logged', 'done'].includes(String(session.status || '').toLowerCase());
  return (
    <Pressable accessibilityRole="button" onPress={() => onAction(session.action || { route: 'workout', workout_id: session.id })} style={({ pressed }) => [styles.visualCard, pressed && styles.pressed]}>
      <View style={styles.sessionCopy}>
        <Text style={styles.sectionEyebrow}>{`${eyebrow}${session.date ? ` · ${relativeDay(session.date, today.date)}` : ''}`}</Text>
        <Text numberOfLines={2} style={styles.cardTitle}>{session.title || session.label || 'Training Session'}</Text>
        {focus.labels.length ? <Text numberOfLines={1} style={styles.cardBody}>{focus.labels.join(' · ')}</Text> : null}
        <Text style={styles.sessionEvidence}>{sessionEvidenceLine(session, completed, unit)}</Text>
      </View>
      {focus.primary.length ? (
        <View style={styles.sessionAnatomy}><MuscleMap athlete={today.athlete} primary={focus.primary} secondary={focus.secondary} size="thumbnail" /></View>
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={completed ? SESSION_RECAP_ARCHIVE_ART : SESSION_FOCUS_ART}
          style={styles.sessionFallbackArt}
        />
      )}
      <Ionicons color={SLColors.textSecondary} name="chevron-forward" size={20} />
    </Pressable>
  );
}

function LastSessionCard({ home, onAction, today, unit }: { home: AthleteHomeV3Projection; onAction: Props['onAction']; today: Today; unit: 'kg' | 'lb' }) {
  const session = home.last_session!;
  const available = projectionAvailable(home);
  return (
    <View>
      <SectionHeader label="LAST SESSION" meta={session.date ? relativeDay(session.date, today.date) : undefined} />
      <SessionCard eyebrow="COMPLETED" onAction={onAction} session={session} today={today} unit={unit} />
      <View style={styles.lastMetrics}>
        <Metric value={metricValue(session.performed_set_count, available)} label="Sets" />
        <Metric value={formatCompactVolumeValueFromKg(session.performed_volume_kg, unit) || missingMetricLabel(available, session.performed_volume_kg)} label="Total Volume" />
        <Metric value={session.session_rpe != null ? String(session.session_rpe) : available ? 'Not logged' : 'Unavailable'} label="Session RPE" />
        <Metric value={metricValue(session.pr_count, available)} label="PRs" />
      </View>
    </View>
  );
}

function TrendsSection({ home, onAction, unit }: { home: AthleteHomeV3Projection; onAction: Props['onAction']; unit: 'kg' | 'lb' }) {
  const readiness = home.trends?.readiness;
  const bodyweight = home.trends?.bodyweight;
  const volume = home.trends?.volume;
  const latestBodyweight = formatWeightFromKg(bodyweight?.latest_kg, unit);
  const volumeValue = formatCompactVolumeValueFromKg(volume?.this_week_kg, unit);
  const available = projectionAvailable(home);
  const readinessPoints = React.useMemo(
    () => (readiness?.points || []).flatMap((point) => point.value == null ? [] : [{ date: point.date, value: normalizedReadiness(point.value) }]),
    [readiness?.points],
  );
  const bodyweightPoints = React.useMemo(
    () => (bodyweight?.points || []).flatMap((point) => point.value_kg == null ? [] : [{ date: point.date, value: kilogramsToDisplayValue(Number(point.value_kg), unit) }]),
    [bodyweight?.points, unit],
  );
  const volumePoints = React.useMemo(
    () => (volume?.points || []).flatMap((point) => point.value_kg == null ? [] : [{ date: point.date, value: kilogramsToDisplayValue(Number(point.value_kg), unit) }]),
    [unit, volume?.points],
  );
  const bodyweightDetail = bodyweightPoints.length === 1
    ? 'First report'
    : bodyweight?.delta_kg != null
      ? `${formatWeightDeltaFromKg(bodyweight.delta_kg, unit)} / ${bodyweight.comparison_span_days || bodyweight.window_days || 28}d`
      : `${bodyweightPoints.length} real reports`;
  const readinessDetail = readinessPoints.length
    ? readiness?.delta_vs_prior_7d != null
      ? `${formatReadinessDelta(readiness.delta_vs_prior_7d)} vs prior 7d`
      : '7-day avg'
    : available ? 'Check in to begin' : 'Refresh to retry';
  const volumeDetail = volumePoints.length
    ? volume?.delta_kg != null
      ? `${formatCompactVolumeDelta(volume.delta_kg, unit)} vs prior week`
      : 'This week · 5-week view'
    : available ? 'Log sets to begin' : 'Refresh to retry';
  return (
    <View style={styles.sectionGap}>
      <SectionHeader label="YOUR TRENDS" />
      <View style={styles.trendRow}>
        <TrendCard accent="#44D38A" emptyLabel={available ? 'No check-ins yet' : 'Refresh unavailable'} label="READINESS" metric="Daily Readiness · last 7 days · 10-point display" value={readiness?.latest != null ? formatReadiness(readiness.latest) : available ? 'No data' : 'Unavailable'} detail={readinessDetail} points={readinessPoints} onPress={() => onAction(readiness?.action)} />
        <TrendCard accent="#4AB7FF" emptyLabel={available ? 'No reports yet' : 'Refresh unavailable'} label="REPORTED BW" metric={`Reported Bodyweight · last ${bodyweight?.window_days || 28} days · ${unit}`} value={latestBodyweight || (available ? 'No reports' : 'Unavailable')} detail={bodyweightPoints.length ? bodyweightDetail : available ? 'Report in readiness' : 'Refresh to retry'} points={bodyweightPoints} onPress={() => onAction(bodyweight?.action)} />
        <TrendCard accent="#B44CFF" emptyLabel={available ? 'No completed volume' : 'Refresh unavailable'} kind="bar" label="VOLUME" metric={`Weekly Total Volume · last ${volume?.window_weeks || 5} weeks · ${unit}`} value={volumeValue || (volume?.this_week_kg === 0 && available ? `0 ${unit}` : available ? 'No volume' : 'Unavailable')} detail={volumeDetail} points={volumePoints} onPress={() => onAction(volume?.action)} />
      </View>
    </View>
  );
}

function TrendCard({ accent, detail, emptyLabel, kind = 'line', label, metric, onPress, points, value }: { accent: string; detail: string; emptyLabel: string; kind?: 'line' | 'bar'; label: string; metric: string; onPress: () => void; points: HomePlotDatum[]; value: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.trendCard, pressed && styles.pressed]}>
      <Text style={styles.trendLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.trendValue}>{value}</Text>
      <Text style={styles.trendDetail}>{detail}</Text>
      <HomeTrendPlot accent={accent} emptyLabel={emptyLabel} kind={kind} metric={metric} points={points} />
    </Pressable>
  );
}

function StrengthCard({ home, onAction, unit }: { home: AthleteHomeV3Projection; onAction: Props['onAction']; unit: 'kg' | 'lb' }) {
  const strength = home.strength!;
  const available = projectionAvailable(home);
  const value = formatCalculatedWeightFromKg(strength.current_e1rm_kg, unit) || (available ? 'No history' : 'Unavailable');
  const points = React.useMemo(
    () => (strength.points || []).flatMap(point => point.value_kg == null ? [] : [{ date: point.date, value: kilogramsToDisplayValue(Number(point.value_kg), unit) }]),
    [strength.points, unit],
  );
  return (
    <Pressable accessibilityRole="button" onPress={() => onAction(strength.action)} style={({ pressed }) => [styles.strengthCard, pressed && styles.pressed]}>
      <View style={styles.strengthMedallion}><Image source={ACHIEVEMENT_ART} resizeMode="contain" style={styles.strengthImage} /></View>
      <View style={styles.flex}>
        <Text style={styles.sectionEyebrow}>FROM YOUR LEDGER</Text>
        <Text style={styles.strengthLabel}>STRENGTH TREND</Text>
        <Text style={styles.strengthFamily}>{strength.family ? titleCase(strength.family) : 'No governed lift history yet'}</Text>
        <Text style={styles.strengthValue}>{value} {strength.current_e1rm_kg != null ? <Text style={styles.strengthUnit}>e1RM</Text> : null}</Text>
        {strength.delta_kg != null ? <Text style={styles.strengthDelta}>{formatWeightDeltaFromKg(strength.delta_kg, unit)} from prior marker</Text> : null}
      </View>
      <View style={styles.strengthSpark}><HomeTrendPlot accent="#43D38A" emptyLabel={available ? 'Log a governed lift' : 'Refresh unavailable'} metric={`${titleCase(strength.family || 'Governed lift')} e1RM · ${unit}`} points={points} /></View>
      <Ionicons color={SLColors.textSecondary} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function AchievementCard({ achievement, onAction, unit }: { achievement: HomeAchievement; onAction: Props['onAction']; unit: 'kg' | 'lb' }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => onAction(achievement.action || { route: 'ledger_achievement', workout_id: achievement.workout_id })} style={({ pressed }) => [styles.achievementCard, pressed && styles.pressed]}>
      <Image source={ACHIEVEMENT_ART} resizeMode="contain" style={styles.achievementCardImage} />
      <View style={styles.flex}>
        <Text style={[styles.sectionEyebrow, styles.gold]}>RECENT ACHIEVEMENT</Text>
        <Text style={styles.achievementLabel}>{achievementLabel(achievement)}</Text>
        <Text style={styles.cardTitle}>{achievement.movement_label || 'Strength milestone'}</Text>
        <Text style={styles.achievementCardValue}>{achievementValue(achievement, unit)}</Text>
      </View>
      <Ionicons color="#F0B84B" name="chevron-forward" size={20} />
    </Pressable>
  );
}

function SelfCoachedActions({ actions, onAction }: { actions: HomeAction[]; onAction: Props['onAction'] }) {
  if (!actions.length) return null;
  return (
    <View style={styles.selfActions}>
      {actions.slice(0, 2).map((action, index) => (
        <Pressable key={`${action.route}-${index}`} onPress={() => onAction(action)} style={({ pressed }) => [styles.selfAction, pressed && styles.pressed]}>
          <Ionicons color={SLColors.accentViolet} name={action.route === 'calendar' ? 'calendar-outline' : 'create-outline'} size={18} />
          <Text style={styles.selfActionText}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionHeader({ label, meta }: { label: string; meta?: string }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionEyebrow}>{label}</Text>{meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}</View>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text><Text numberOfLines={1} style={styles.metricLabel}>{label}</Text></View>;
}

function Evidence({ icon, text }: { icon: any; text: string }) {
  return <View style={styles.evidenceRow}><Ionicons color="#B58AFF" name={icon} size={13} /><Text numberOfLines={1} style={styles.evidenceText}>{text}</Text></View>;
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.heroMetric}><Text style={styles.heroMetricLabel}>{label}</Text><Text style={styles.heroMetricValue}>{value}</Text></View>;
}

function MiniLink({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.miniLink}><Ionicons color="#74C9FF" name={icon} size={14} /><Text style={styles.miniLinkText}>{label}</Text><Ionicons color={SLColors.textMuted} name="chevron-forward" size={14} /></Pressable>;
}

function muscleIds(session?: HomeSessionEvidence | null) {
  const primary = (session?.muscle_focus?.primary || []).map(item => String(item.muscle_id || '')).filter(Boolean);
  const secondary = (session?.muscle_focus?.secondary || []).map(item => String(item.muscle_id || '')).filter(Boolean);
  return { primary, secondary, labels: primary.map(titleCase) };
}

function sevenDays(home: AthleteHomeV3Projection, todayValue: string) {
  const supplied = home.week?.days || [];
  const byDate = new Map(supplied.map(day => [day.date, day]));
  const start = parseDate(home.week?.start_date) || startOfWeek(parseDate(todayValue) || new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = ymd(date);
    return { date: key, kind: 'empty', is_today: key === todayValue, achievement: false, session_count: 0, ...(byDate.get(key) || {}) };
  });
}

function sessionEvidenceLine(session: HomeSessionEvidence, completed: boolean, unit: 'kg' | 'lb') {
  if (completed) return [session.performed_set_count != null ? `${session.performed_set_count} sets` : null, formatCompactVolumeValueFromKg(session.performed_volume_kg, unit), session.session_rpe != null ? `RPE ${session.session_rpe}` : null, session.pr_count ? `${session.pr_count} PR${session.pr_count === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'No performed sets logged';
  return [session.movement_count != null ? `${session.movement_count} movements` : null, session.programmed_set_count != null ? `${session.programmed_set_count} sets` : null].filter(Boolean).join(' · ') || 'Session preview';
}

function setEvidence(session?: HomeSessionEvidence | null, completed = false) {
  const value = completed ? session?.performed_set_count : session?.programmed_set_count;
  return value != null ? `${value} ${completed ? 'performed' : 'programmed'} sets` : 'Session plan';
}

function achievementValue(achievement: HomeAchievement | null | undefined, unit: 'kg' | 'lb') {
  const sourceUnit = String(achievement?.unit || '').toLowerCase();
  const kg = achievement?.evidence?.actual_weight_kg
    ?? (sourceUnit === 'kg' ? achievement?.current_value : null);
  const weight = formatWeightFromKg(kg, unit, 0);
  const convertedWeight = achievement?.current_value != null && (sourceUnit === 'kg' || sourceUnit === 'lb')
    ? `${Math.round(convertDisplayWeightValue(Number(achievement.current_value), sourceUnit, unit))} ${unit}`
    : null;
  const reps = achievement?.evidence?.actual_reps ?? achievement?.evidence?.rep_count;
  if (weight && reps) return `${weight} × ${reps}`;
  if (convertedWeight && reps) return `${convertedWeight} × ${reps}`;
  if (weight) return weight;
  if (convertedWeight) return convertedWeight;
  return achievement?.current_value != null ? `${achievement.current_value}${achievement.unit ? ` ${achievement.unit}` : ''}` : 'New record';
}

function achievementLabel(achievement?: HomeAchievement | null) {
  const value = String(achievement?.event_type || '').replace(/^CORE_/, '').replaceAll('_', ' ');
  return value ? titleCase(value) : 'Achievement';
}

function homeContext(_today: Today) { return 'Recovery and mobility'; }
function projectionAvailable(home: AthleteHomeV3Projection) { return home.data_status?.state === 'ready' || home.projection_version === 'athlete-home-v3'; }
function missingMetricLabel(available: boolean, value?: number | null) { return value === 0 && available ? '0' : available ? 'No data' : 'Unavailable'; }
function metricValue(value: number | null | undefined, available: boolean) { return value == null ? (available ? 'No data' : 'Unavailable') : String(value); }
function normalizedReadiness(value?: number | null) { if (value == null) return null; const parsed = Number(value); return Math.round((parsed <= 5 ? parsed * 2 : parsed) * 10) / 10; }
function formatReadiness(value: number) { const parsed = normalizedReadiness(value); return parsed == null ? '—' : String(parsed); }
function formatReadinessDelta(value: number) { const display = Math.round(Number(value) * 20) / 10; return `${display > 0 ? '+' : ''}${display}`; }
function formatCompactVolumeDelta(value: number, unit: 'kg' | 'lb') { const formatted = formatCompactVolumeValueFromKg(Math.abs(value), unit); return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatted}`; }
function stateColor(state: AthleteHomeState) { return state === 'meet' || state === 'achievement' ? '#F0B84B' : state === 'training' ? '#9C4DFF' : state === 'recovery' ? '#43D38A' : '#4AB7FF'; }
function greetingForNow() { const hour = new Date().getHours(); return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'; }
function parseDate(value?: string | null) { if (!value) return null; const parsed = new Date(`${value.slice(0, 10)}T12:00:00`); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function startOfWeek(value: Date) { const copy = new Date(value); const day = (copy.getDay() + 6) % 7; copy.setDate(copy.getDate() - day); return copy; }
function ymd(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function weekday(value?: string | null) { const parsed = parseDate(value); return parsed ? parsed.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2).toUpperCase() : '—'; }
function dayNumber(value?: string | null) { const parsed = parseDate(value); return parsed ? String(parsed.getDate()) : '—'; }
function formatLongDate(value?: string | null) { const parsed = parseDate(value); return parsed ? parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''; }
function relativeDay(value?: string | null, today?: string | null) { const date = parseDate(value); const current = parseDate(today); if (!date || !current) return ''; const days = Math.round((date.getTime() - current.getTime()) / 86400000); if (days === 0) return 'Today'; if (days === 1) return 'Tomorrow'; if (days === -1) return 'Yesterday'; return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function titleCase(value?: string | null) { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, match => match.toUpperCase()); }

const styles = StyleSheet.create({
  page: { gap: 11, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 112 },
  flex: { flex: 1, minWidth: 0 },
  greetingRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2 },
  greeting: { color: '#DAD7E1', fontSize: 13, lineHeight: 18 },
  greetingDate: { color: '#777481', fontSize: 11, lineHeight: 15 },
  stateDot: { width: 8, height: 8, borderRadius: 4, shadowColor: '#A45BFF', shadowOpacity: 0.7, shadowRadius: 8 },
  hero: { minHeight: 282, overflow: 'hidden', position: 'relative', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, backgroundColor: '#050509' },
  heroCopy: { zIndex: 2, minHeight: 222, width: '70%', gap: 5, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 8 },
  recoveryScene: { position: 'absolute', zIndex: 1, top: 0, right: 0, bottom: 0, width: '62%', height: '100%', opacity: 0.52 },
  meetRackArt: { position: 'absolute', zIndex: 1, right: -10, top: 34, width: '48%', height: '68%', opacity: 0.72 },
  heroEyebrow: { color: '#B86DFF', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.65 },
  heroTitle: { color: '#F7F5FA', fontSize: 26, lineHeight: 31, fontWeight: '700', letterSpacing: -0.35 },
  heroMeta: { color: '#AAA6B2', fontSize: 12, lineHeight: 17 },
  heroEvidence: { gap: 5, marginTop: 6 },
  evidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  evidenceText: { color: '#C8C3CE', fontSize: 11, lineHeight: 15 },
  heroAnatomy: { position: 'absolute', zIndex: 1, right: 4, top: 24, width: 142, height: 186, overflow: 'hidden', opacity: 0.96 },
  heroButton: { zIndex: 4, minHeight: 45, marginHorizontal: 12, marginBottom: 12, borderRadius: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  green: { color: '#43D38A' },
  gold: { color: '#F0B84B' },
  magenta: { color: '#D260FF' },
  recoveryMetrics: { flexDirection: 'row', gap: 8, marginTop: 10 },
  heroMetric: { minWidth: 96, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#2B463C', backgroundColor: 'rgba(5,18,14,0.78)', padding: 9 },
  heroMetricLabel: { color: '#7E9D91', fontSize: 8, fontWeight: '700' },
  heroMetricValue: { color: '#F5F7F5', fontSize: 17, lineHeight: 22, fontWeight: '700', marginTop: 3 },
  optionalBox: { marginTop: 10, padding: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#5A3479', backgroundColor: 'rgba(18,8,25,0.78)' },
  optionalText: { color: '#DBD6E1', fontSize: 11, lineHeight: 16, marginTop: 3 },
  achievementMedallion: { position: 'absolute', right: 4, top: 32, width: 150, height: 150 },
  achievementImage: { width: '100%', height: '100%' },
  achievementValue: { fontSize: 25, lineHeight: 30, fontWeight: '800', marginTop: 5 },
  meetTimeline: { gap: 4, marginTop: 7 },
  meetLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  meetLabel: { flex: 1, color: '#D4CED9', fontSize: 10 },
  meetTime: { color: '#8B8491', fontSize: 9 },
  restLinks: { gap: 5, marginTop: 10 },
  miniLink: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 9, borderRadius: 8, backgroundColor: 'rgba(8,11,17,0.76)', borderWidth: StyleSheet.hairlineWidth, borderColor: '#203241' },
  miniLinkText: { flex: 1, color: '#D1D4D9', fontSize: 10 },
  weekSection: { gap: 9, padding: 11, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#24222A', backgroundColor: '#08090D' },
  sectionHeader: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  sectionEyebrow: { color: '#AF62F5', fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.55 },
  sectionMeta: { color: '#777481', fontSize: 10 },
  weekRail: { flexDirection: 'row', gap: 4 },
  dayCell: { flex: 1, minWidth: 0, height: 65, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#1F2027', backgroundColor: '#08090D', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, position: 'relative' },
  dayToday: { borderColor: '#7440A5', backgroundColor: '#1A0E28' },
  dayName: { color: '#7D7A84', fontSize: 8 },
  violet: { color: '#BE79FF' },
  dayDate: { color: '#AAA7AF', fontSize: 9 },
  emptyDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#3B3A42' },
  dayAchievement: { position: 'absolute', top: 3, right: 3 },
  metricStrip: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#24242B', paddingTop: 9 },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 3, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#24242B' },
  metricValue: { color: '#F1EFF4', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  metricLabel: { color: '#817E87', fontSize: 8, lineHeight: 11, marginTop: 1 },
  visualCard: { minHeight: 126, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#30273A', backgroundColor: '#090A0F', overflow: 'hidden' },
  sessionCopy: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: { color: '#F3F0F6', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  cardBody: { color: '#A7A2AC', fontSize: 11, lineHeight: 15 },
  sessionEvidence: { color: '#7C7883', fontSize: 10, lineHeight: 14 },
  sessionAnatomy: { width: 55, height: 88, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sessionFallbackArt: { width: 64, height: 88, opacity: 0.9 },
  lastMetrics: { marginTop: -1, flexDirection: 'row', paddingVertical: 10, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderTopWidth: 0, borderColor: '#30273A', backgroundColor: '#07080C' },
  sectionGap: { gap: 7 },
  trendRow: { flexDirection: 'row', gap: 6 },
  trendCard: { flex: 1, minWidth: 0, height: 124, padding: 9, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#292731', backgroundColor: '#090A0F' },
  trendLabel: { color: '#8F8A97', fontSize: 7, fontWeight: '700' },
  trendValue: { color: '#F2F0F4', fontSize: 16, lineHeight: 21, fontWeight: '700', marginTop: 4 },
  trendDetail: { color: '#77737D', fontSize: 8, marginTop: 1 },
  sparkEmpty: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 7 },
  sparkDot: { width: 5, height: 5, borderRadius: 3 },
  strengthCard: { minHeight: 144, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#49311E', backgroundColor: '#0B0907', overflow: 'hidden' },
  strengthMedallion: { width: 68, height: 90 },
  strengthImage: { width: '100%', height: '100%' },
  strengthLabel: { color: '#9C8AAE', fontSize: 8, marginTop: 5 },
  strengthFamily: { color: '#DAD5DF', fontSize: 13, marginTop: 1 },
  strengthValue: { color: '#F4F1F6', fontSize: 21, fontWeight: '700', marginTop: 2 },
  strengthUnit: { color: '#8B8791', fontSize: 10, fontWeight: '500' },
  strengthDelta: { color: '#43D38A', fontSize: 9, marginTop: 2 },
  strengthSpark: { width: 78 },
  achievementCard: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#5D4317', backgroundColor: '#130E05' },
  achievementCardImage: { width: 70, height: 88 },
  achievementLabel: { color: '#D4A33E', fontSize: 9, marginTop: 3 },
  achievementCardValue: { color: '#F4E0A7', fontSize: 14, fontWeight: '700', marginTop: 2 },
  selfActions: { flexDirection: 'row', gap: 8 },
  selfAction: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: '#3D2652', backgroundColor: '#100A17' },
  selfActionText: { color: '#D9D4DF', fontSize: 11, fontWeight: '600' },
});
