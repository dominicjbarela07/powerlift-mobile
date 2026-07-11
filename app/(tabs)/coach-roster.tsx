// app/coach-roster.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import RefreshScreen from '@/components/refresh-screen';
import { NewCoachExperience, type NewCoachExperiencePayload } from '@/components/NewCoachExperience';
import {
  SLAthleteAvatar,
  SLEmptyState,
  SLErrorState,
  SLLoadingState,
  SLScreen,
} from '@/components/ui';
import { fetchJson } from '@/lib/api';
import { SLColors, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';

type CoachRosterAthlete = {
  id: number;
  name: string;
  avatar_url?: string | null;
  sex: string | null;
  bodyweight: number | null;
  squat_tm: number | null;
  bench_tm: number | null;
  deadlift_tm: number | null;
  dots: number;
  is_self: boolean;
  status: 'needs_programming' | 'programming_soon' | 'up_to_date';
  status_label: string;
  status_tone: 'danger' | 'warn' | 'success';
  programmed_through_date: string | null;
  last_completed_date: string | null;
  days_remaining: number | null;
  days_since_last_completed: number | null;
  last_session_primary: string;
  last_session_secondary: string | null;
  programmed_primary: string;
  programmed_secondary: string | null;
  meet_date?: string | null;
  meet_date_display?: string | null;
  meet_name?: string | null;
  meet_date_parts?: { year: number; month: number; day: number } | null;
  days_until_meet?: number | null;
};

type CoachRosterSummary = {
  need_programming: number;
  programming_soon: number;
  up_to_date: number;
  total_athletes: number;
};

type CoachRosterInvite = {
  id: number;
  athlete_first?: string | null;
  athlete_last?: string | null;
  athlete_email: string;
  status: string;
  sent_at?: string | null;
  updated_at?: string | null;
};

type CoachRosterResponse = {
  ok: boolean;
  summary: CoachRosterSummary;
  athletes: CoachRosterAthlete[];
  pending_invites?: CoachRosterInvite[];
  error?: string;
  new_coach_experience?: NewCoachExperiencePayload | null;
};

type FilterKey = 'all' | 'needs' | 'soon' | 'meet' | 'up_to_date';

const ROSTER_MATERIAL = {
  surface: 'rgba(8, 8, 10, 0.44)',
  surfaceSubtle: 'rgba(6, 6, 7, 0.30)',
  surfaceSoft: 'rgba(12, 13, 15, 0.42)',
  hairline: 'rgba(255, 255, 255, 0.052)',
} as const;

const filters: Array<{
  key: FilterKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: SLStatusTone;
}> = [
  { key: 'all', label: 'All', icon: 'list-outline', tone: 'neutral' },
  { key: 'needs', label: 'Needs', icon: 'alert-circle-outline', tone: 'danger' },
  { key: 'soon', label: 'Soon', icon: 'time-outline', tone: 'warning' },
  { key: 'meet', label: 'Meet', icon: 'trophy-outline', tone: 'review' },
  { key: 'up_to_date', label: 'Current', icon: 'checkmark-circle-outline', tone: 'success' },
];

function statusTone(tone: CoachRosterAthlete['status_tone']): SLStatusTone {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warning';
  return 'success';
}

function toneColor(tone: SLStatusTone) {
  return SLStatusTones[tone]?.icon ?? SLColors.accentSteel;
}

function priorityFor(status: CoachRosterAthlete['status']) {
  if (status === 'needs_programming') return 'high' as const;
  if (status === 'programming_soon') return 'medium' as const;
  return undefined;
}

function formatBodyweight(v: number | null) {
  if (v == null) return null;
  return `BW ${v.toFixed(1)} kg`;
}

function meetLabel(athlete: CoachRosterAthlete) {
  if (!athlete.meet_date) return null;

  const dateLabel = athlete.meet_date_display || athlete.meet_date;
  if (typeof athlete.days_until_meet !== 'number') return athlete.meet_name ? `${athlete.meet_name} · ${dateLabel}` : dateLabel;
  if (athlete.days_until_meet < 0) return athlete.meet_name ? `${athlete.meet_name} · passed` : 'Meet passed';
  if (athlete.days_until_meet === 0) return athlete.meet_name ? `${athlete.meet_name} · today` : 'Meet today';

  const weeks = Math.floor(athlete.days_until_meet / 7);
  const days = athlete.days_until_meet % 7;
  const countdown = weeks > 0 ? `${weeks}w ${days}d out` : `${days}d out`;
  return athlete.meet_name ? `${athlete.meet_name} · ${countdown}` : `Meet · ${countdown}`;
}

function buildSubtitle(athlete: CoachRosterAthlete) {
  const programmed = `Programmed ${athlete.programmed_primary || 'unknown'}`;
  const last = `Last ${athlete.last_session_primary || 'unknown'}`;
  return `${programmed} · ${last}`;
}

function buildMeta(athlete: CoachRosterAthlete) {
  const meet = meetLabel(athlete);
  if (meet) return meet;

  const bits = [
    athlete.programmed_secondary,
    athlete.last_session_secondary ? `last ${athlete.last_session_secondary}` : null,
    formatBodyweight(athlete.bodyweight),
  ].filter(Boolean);

  return bits.join(' · ') || undefined;
}

function inviteName(invite: CoachRosterInvite) {
  return [invite.athlete_first, invite.athlete_last].filter(Boolean).join(' ').trim() || 'Invited athlete';
}

function inviteTimestamp(invite: CoachRosterInvite) {
  const raw = invite.updated_at || invite.sent_at;
  if (!raw) return 'Awaiting acceptance';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return 'Awaiting acceptance';
  return `Updated ${parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function CoachRosterScreen() {
  const [data, setData] = useState<CoachRosterAthlete[]>([]);
  const [pendingInvites, setPendingInvites] = useState<CoachRosterInvite[]>([]);
  const [summary, setSummary] = useState<CoachRosterSummary>({
    need_programming: 0,
    programming_soon: 0,
    up_to_date: 0,
    total_athletes: 0,
  });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCoachExperience, setNewCoachExperience] = useState<NewCoachExperiencePayload | null>(null);

  const router = useRouter();

  const loadRoster = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const resp = await fetchJson('/coach/mobile/roster', { method: 'GET' });
      const json = resp.json as CoachRosterResponse | null;

      if (!resp.ok || !json?.ok) {
        setError(json?.error || `Failed to load roster. (${resp.status})`);
        return;
      }

      const athletes = json.athletes || [];
      setData(athletes);
      setPendingInvites(json.pending_invites || []);
      setNewCoachExperience(json.new_coach_experience || null);
      setSummary(
        json.summary || {
          need_programming: 0,
          programming_soon: 0,
          up_to_date: 0,
          total_athletes: athletes.length,
        }
      );
    } catch (e) {
      console.log('Coach roster load error', e);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  useFocusEffect(
    React.useCallback(() => {
      loadRoster({ silent: true });
    }, [loadRoster])
  );

  const onRefresh = useCallback(() => {
    loadRoster({ silent: true });
  }, [loadRoster]);

  const sortedAthletes = useMemo(() => {
    const rank: Record<CoachRosterAthlete['status'], number> = {
      needs_programming: 0,
      programming_soon: 1,
      up_to_date: 2,
    };

    return [...data].sort((a, b) => {
      const byStatus = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (byStatus !== 0) return byStatus;
      const byDays = (a.days_remaining ?? 9999) - (b.days_remaining ?? 9999);
      if (byDays !== 0) return byDays;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  const visibleAthletes = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return sortedAthletes.filter((athlete) => {
      if (needle && !athlete.name.toLowerCase().includes(needle)) return false;
      if (filter === 'needs') return athlete.status === 'needs_programming';
      if (filter === 'soon') return athlete.status === 'programming_soon';
      if (filter === 'meet') return !!athlete.meet_date;
      if (filter === 'up_to_date') return athlete.status === 'up_to_date';
      return true;
    });
  }, [filter, query, sortedAthletes]);

  const metrics = useMemo(
    (): Array<{ label: string; value: number; tone: SLStatusTone }> => [
      { label: 'Needs Programming', value: summary.need_programming, tone: summary.need_programming > 0 ? 'danger' : 'neutral' },
      { label: 'Due Soon', value: summary.programming_soon, tone: summary.programming_soon > 0 ? 'warning' : 'neutral' },
      { label: 'Up To Date', value: summary.up_to_date, tone: 'success' },
      { label: 'Total', value: summary.total_athletes, tone: 'neutral' },
    ],
    [summary]
  );

  const openAthlete = useCallback(
    (athlete: CoachRosterAthlete) => {
      router.push({
        pathname: '/(tabs)/coach-athlete/[athleteId]',
        params: { athleteId: String(athlete.id), athleteName: athlete.name },
      } as any);
    },
    [router]
  );

  if (loading && !refreshing && data.length === 0) {
    return (
      <SLScreen edges="none">
        <View style={styles.centerState}>
          <SLLoadingState message="Loading athlete triage..." title="Loading Roster" />
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
        <View style={styles.header}>
          <View style={styles.headerRail} />
          <Text style={styles.eyebrow}>Athlete Triage</Text>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>Roster</Text>
              <Text style={styles.subtitle}>Athlete triage and programming horizon</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/coach-invite-athlete' as any)}
              style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}
            >
              <Ionicons color="#FFFFFF" name="person-add-outline" size={15} />
              <Text style={styles.inviteButtonText}>Invite Athlete</Text>
            </Pressable>
          </View>
        </View>

        <RosterMetricStrip metrics={metrics} />

        <View style={styles.controls}>
          <View style={styles.searchBox}>
            <Ionicons color={SLColors.textSubtle} name="search-outline" size={17} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              placeholder="Search athletes"
              placeholderTextColor={SLColors.textSubtle}
              style={styles.searchInput}
              value={query}
            />
          </View>

          <View style={styles.filterRow}>
            {filters.map((item) => (
              <RosterFilterChip
                icon={item.icon}
                key={item.key}
                label={item.label}
                onPress={() => setFilter(item.key)}
                selected={filter === item.key}
                tone={item.tone}
              />
            ))}
          </View>
        </View>

        {error ? (
          <SLErrorState
            actionLabel="Try Again"
            message={error}
            onActionPress={() => loadRoster()}
            title="Could not load roster"
          />
        ) : null}

        <View style={styles.section}>
          <View style={styles.ledgerHeader}>
            <View style={styles.sectionRail} />
            <Text style={styles.ledgerTitle}>Priority List</Text>
            <Text style={styles.ledgerMeta}>{visibleAthletes.length} / {summary.total_athletes}</Text>
          </View>

          {visibleAthletes.length === 0 && !error ? (
            newCoachExperience && !query && filter === 'all' ? (
              <NewCoachExperience experience={newCoachExperience} />
            ) : (
              <SLEmptyState
                message={query || filter !== 'all' ? 'Try a different search or filter.' : 'Add athletes from the web coach dashboard.'}
                title={query || filter !== 'all' ? 'No matching athletes' : 'No athletes yet'}
              />
            )
          ) : (
            <View style={styles.rowStack}>
              {visibleAthletes.map((athlete, index) => (
                <AthleteLedgerRow
                  athlete={athlete}
                  key={athlete.id}
                  meta={buildMeta(athlete)}
                  onPress={() => openAthlete(athlete)}
                  dominant={index === 0 && athlete.status !== 'up_to_date'}
                  subtitle={buildSubtitle(athlete)}
                  title={athlete.is_self ? `${athlete.name} (You)` : athlete.name}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.ledgerHeader}>
            <View style={styles.sectionRail} />
            <Text style={styles.ledgerTitle}>Pending Invites</Text>
            <Text style={styles.ledgerMeta}>{pendingInvites.length}</Text>
          </View>

          {pendingInvites.length > 0 ? (
            <View style={styles.pendingStack}>
              {pendingInvites.map((invite) => (
                <PendingInviteRow invite={invite} key={invite.id} />
              ))}
            </View>
          ) : (
            <View style={styles.pendingEmpty}>
              <Ionicons color={SLColors.textSubtle} name="mail-outline" size={18} />
              <Text style={styles.pendingEmptyText}>No pending roster invites.</Text>
            </View>
          )}
        </View>
      </RefreshScreen>
    </SLScreen>
  );
}

function RosterMetricStrip({
  metrics,
}: {
  metrics: Array<{ label: string; value: number; tone: SLStatusTone }>;
}) {
  return (
    <View style={styles.metricStrip}>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.metricCell}>
          <Text style={[styles.metricValue, { color: toneColor(metric.tone) }]}>{metric.value}</Text>
          <Text numberOfLines={1} style={styles.metricLabel}>{metric.label}</Text>
        </View>
      ))}
    </View>
  );
}

function RosterFilterChip({
  icon,
  label,
  selected,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  tone: SLStatusTone;
  onPress: () => void;
}) {
  const color = selected ? toneColor(tone) : SLColors.textSubtle;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}>
      <Ionicons color={color} name={icon} size={14} />
      <Text style={[styles.filterChipText, selected && { color }]}>{label}</Text>
    </Pressable>
  );
}

function AthleteLedgerRow({
  athlete,
  title,
  subtitle,
  meta,
  dominant,
  onPress,
}: {
  athlete: CoachRosterAthlete;
  title: string;
  subtitle: string;
  meta?: string;
  dominant?: boolean;
  onPress: () => void;
}) {
  const tone = statusTone(athlete.status_tone);
  const rail = toneColor(tone);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.athleteRow, dominant && styles.athleteRowDominant, pressed && styles.pressed]}>
      <View style={[styles.athleteRail, { backgroundColor: rail }]} />
      <SLAthleteAvatar imageUrl={athlete.avatar_url || undefined} name={athlete.name} size={dominant ? 36 : 32} />
      <View style={styles.athleteCopy}>
        <View style={styles.athleteTitleRow}>
          <Text numberOfLines={1} style={[styles.athleteName, dominant && styles.athleteNameDominant]}>{title}</Text>
          <Text style={[styles.statusText, { color: rail }]}>{athlete.status_label}</Text>
        </View>
        <Text numberOfLines={1} style={styles.athleteSubtitle}>{subtitle}</Text>
        {meta ? <Text numberOfLines={1} style={styles.athleteMeta}>{meta}</Text> : null}
      </View>
      <View style={styles.daysColumn}>
        {typeof athlete.days_remaining === 'number' ? (
          <>
            <Text style={[styles.daysValue, { color: rail }]}>{athlete.days_remaining}</Text>
            <Text style={styles.daysLabel}>days</Text>
          </>
        ) : (
          <Ionicons color={SLColors.textSubtle} name="chevron-forward" size={16} />
        )}
      </View>
    </Pressable>
  );
}

function PendingInviteRow({ invite }: { invite: CoachRosterInvite }) {
  return (
    <View style={styles.pendingInviteRow}>
      <View style={styles.pendingInviteIcon}>
        <Ionicons color={SLColors.accentViolet} name="mail-unread-outline" size={18} />
      </View>
      <View style={styles.pendingInviteCopy}>
        <View style={styles.pendingInviteTitleRow}>
          <Text numberOfLines={1} style={styles.pendingInviteName}>{inviteName(invite)}</Text>
          <Text style={styles.pendingBadge}>Pending</Text>
        </View>
        <Text numberOfLines={1} style={styles.pendingInviteEmail}>{invite.athlete_email}</Text>
        <Text numberOfLines={1} style={styles.pendingInviteMeta}>{inviteTimestamp(invite)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    gap: 18,
    paddingBottom: 40,
    paddingHorizontal: 0,
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
  headerRail: {
    backgroundColor: SLColors.railViolet,
    bottom: 8,
    left: 0,
    opacity: 0.72,
    position: 'absolute',
    top: 8,
    width: 3,
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
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.md,
    justifyContent: 'space-between',
    paddingRight: SLSpacing.md,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  inviteButton: {
    alignItems: 'center',
    backgroundColor: SLColors.accentViolet,
    borderRadius: SLRadius.radiusControl,
    flexDirection: 'row',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: SLSpacing.md,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 12,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    lineHeight: 15,
  },
  metricStrip: {
    flexDirection: 'row',
    gap: 0,
    paddingVertical: 8,
  },
  metricCell: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  metricValue: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.kpiNumber.fontFamily,
    fontSize: 21,
    fontWeight: SLTypography.kpiNumber.fontWeight,
    lineHeight: 24,
  },
  metricLabel: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 13,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  controls: {
    gap: 9,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: ROSTER_MATERIAL.surfaceSubtle,
    borderColor: ROSTER_MATERIAL.hairline,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 42,
    paddingHorizontal: SLSpacing.md,
  },
  searchInput: {
    color: SLColors.text,
    fontFamily: SLTypography.body.fontFamily,
    flex: 1,
    fontSize: 15,
    minWidth: 0,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    width: '100%',
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 6, 7, 0.18)',
    borderColor: ROSTER_MATERIAL.hairline,
    borderRadius: SLRadius.radiusSharp,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 26,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  filterChipSelected: {
    backgroundColor: 'rgba(8, 8, 10, 0.46)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  filterChipText: {
    color: SLColors.textSubtle,
    flexShrink: 1,
    fontFamily: SLTypography.chipLabel.fontFamily,
    fontSize: SLTypography.chipLabel.fontSize,
    fontWeight: SLTypography.chipLabel.fontWeight,
    lineHeight: 12,
    textAlign: 'center',
  },
  section: {
    gap: 9,
  },
  ledgerHeader: {
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
  ledgerTitle: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.sectionLabel.fontFamily,
    fontSize: SLTypography.sectionLabel.fontSize,
    fontWeight: SLTypography.sectionLabel.fontWeight,
    letterSpacing: SLTypography.sectionLabel.letterSpacing,
    lineHeight: SLTypography.sectionLabel.lineHeight,
    textTransform: 'uppercase',
  },
  ledgerMeta: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 13,
    marginLeft: 'auto',
    textTransform: 'uppercase',
  },
  rowStack: {
    backgroundColor: ROSTER_MATERIAL.surfaceSubtle,
    overflow: 'hidden',
  },
  pendingStack: {
    backgroundColor: ROSTER_MATERIAL.surfaceSubtle,
    borderColor: ROSTER_MATERIAL.hairline,
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pendingInviteRow: {
    alignItems: 'center',
    borderBottomColor: ROSTER_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.md,
    minHeight: 78,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
  },
  pendingInviteIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(108, 56, 255, 0.12)',
    borderColor: 'rgba(108, 56, 255, 0.28)',
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pendingInviteCopy: {
    flex: 1,
    minWidth: 0,
  },
  pendingInviteTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  pendingInviteName: {
    color: SLColors.textStrong,
    flex: 1,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  pendingBadge: {
    color: SLColors.accentViolet,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.2,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
  pendingInviteEmail: {
    color: SLColors.text,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
    marginTop: 2,
  },
  pendingInviteMeta: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.2,
    lineHeight: 13,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  pendingEmpty: {
    alignItems: 'center',
    backgroundColor: ROSTER_MATERIAL.surfaceSubtle,
    borderColor: ROSTER_MATERIAL.hairline,
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 48,
    paddingHorizontal: SLSpacing.md,
  },
  pendingEmptyText: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  pressed: {
    opacity: 0.78,
  },
  athleteRow: {
    alignItems: 'center',
    borderBottomColor: ROSTER_MATERIAL.hairline,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 74,
    overflow: 'hidden',
    paddingRight: SLSpacing.sm,
  },
  athleteRowDominant: {
    backgroundColor: ROSTER_MATERIAL.surfaceSoft,
    minHeight: 82,
  },
  athleteRail: {
    alignSelf: 'stretch',
    opacity: 0.78,
    width: 4,
  },
  athleteCopy: {
    flex: 1,
    minWidth: 0,
  },
  athleteTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  athleteName: {
    color: SLColors.textStrong,
    flex: 1,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    lineHeight: SLTypography.rowTitle.lineHeight,
    minWidth: 0,
  },
  athleteNameDominant: {
    fontSize: 15,
    lineHeight: 20,
  },
  statusText: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 10,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.22,
    lineHeight: 13,
    maxWidth: 98,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  athleteSubtitle: {
    color: '#9BA5B2',
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
    marginTop: 2,
  },
  athleteMeta: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: 14,
    marginTop: 1,
  },
  daysColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 36,
  },
  daysValue: {
    fontFamily: SLTypography.kpiNumber.fontFamily,
    fontSize: 17,
    fontWeight: SLTypography.kpiNumber.fontWeight,
    lineHeight: 20,
  },
  daysLabel: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 9,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: 0.25,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
});
