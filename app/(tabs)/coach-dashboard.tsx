// app/coach-dashboard.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import RefreshScreen from '@/components/refresh-screen';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';

type CoachDashboardAthleteRef = {
  id: number;
  name: string;
};

type CoachDashboardReviewAthleteRef = {
  id: number;
  name: string;
  count?: number;
};

type CoachDashboardRecentActivityItem = {
  kind: 'logged' | 'missed' | 'assigned';
  athlete_name: string;
  session_name: string;
  when: string;
  workout_id: number;
  athlete_id: number;
  status: string;
};

type CoachDashboardUpcomingItem = {
  athlete_name: string;
  session_name: string;
  workout_id: number;
  athlete_id: number;
  status: string;
};

type CoachDashboardUpcomingDay = {
  date_iso: string;
  dow: string;
  md: string;
  date_label: string;
  items: CoachDashboardUpcomingItem[];
};

type CoachDashboardResponse = {
  ok: boolean;
  coach_name?: string;
  coach_logo_url?: string | null;
  total: number;
  athlete_count?: number;
  drafts: number;
  today_assigned: number;
  today_logged: number;
  missed_yesterday: number;
  pending_approvals: number;
  pending_reviews: number;
  no_log_3plus: CoachDashboardAthleteRef[];
  missed_yesterday_athletes?: CoachDashboardAthleteRef[];
  pending_reviews_athletes?: CoachDashboardReviewAthleteRef[];
  recent_activity?: CoachDashboardRecentActivityItem[];
  upcoming_days?: CoachDashboardUpcomingDay[];
};

export default function CoachDashboardScreen() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [data, setData] = useState<CoachDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const payloadName = (data?.coach_name || '').trim();
    if (payloadName) return payloadName;

    if (!user || typeof user !== 'object') return 'Coach';

    const getString = (obj: Record<string, unknown>, key: string) => {
      if (!(key in obj)) return '';
      const value = obj[key];
      return typeof value === 'string' ? value.trim() : '';
    };

    const userObj = user as Record<string, unknown>;

    const direct =
      getString(userObj, 'name') ||
      getString(userObj, 'full_name') ||
      getString(userObj, 'display_name') ||
      getString(userObj, 'coach_name');

    if (direct) return direct;

    const first = getString(userObj, 'first_name') || getString(userObj, 'firstName');
    const last = getString(userObj, 'last_name') || getString(userObj, 'lastName');
    const combined = [first, last].filter(Boolean).join(' ').trim();

    return combined || 'Coach';
  }, [data?.coach_name, user]);

    const displayInitials = useMemo(() => {
    return (displayName || 'Coach')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'C';
  }, [displayName]);

  const loadDashboard = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;

      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        if (!token) {
          setError('Not authenticated. Please log in again.');
          setData(null);
          return;
        }

        const res: any = await fetchJson('/coach/mobile/dashboard', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const status = Number(res?.status ?? 0);
        const payload = res?.json ?? res;

        if (res?.ok !== true) {
          const msg = payload?.error || payload?.message || `Request failed (${status || 'unknown'})`;
          setError(String(msg));
          setData(null);

          if (status === 401) {
            router.replace('/login');
          }
          return;
        }

        if (!payload || typeof payload !== 'object') {
          setError('Bad response (non-object).');
          setData(null);
          return;
        }

        if (payload.ok !== true) {
          const msg = payload?.error || payload?.message || 'Failed to load coach dashboard.';
          setError(String(msg));
          setData(null);
          return;
        }

        setData(payload as CoachDashboardResponse);
      } catch (e) {
        console.log('Coach dashboard load error', e);
        const msg = (e as any)?.message || String(e);
        setError(`Network/parse error: ${msg}`);
        setData(null);
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [token, router]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboard({ silent: true });
    }, [loadDashboard])
  );

  const onRefresh = useCallback(async () => {
    await loadDashboard({ silent: true });
  }, [loadDashboard]);

  const attentionItems = useMemo(() => {
    if (!data) return [] as Array<{
      key: string;
      athleteId?: number;
      name: string;
      reason: string;
      tone: 'danger' | 'warn' | 'accent';
      target?: string;
      count?: number;
    }>;

    const items: Array<{
      key: string;
      athleteId?: number;
      name: string;
      reason: string;
      tone: 'danger' | 'warn' | 'accent';
      target?: string;
      count?: number;
    }> = [];

    (data.no_log_3plus || []).forEach((a) => {
      items.push({
        key: `nolog-${a.id}`,
        athleteId: a.id,
        name: a.name,
        reason: 'No log in 3+ days',
        tone: 'danger',
      });
    });

    (data.missed_yesterday_athletes || []).forEach((a) => {
      items.push({
        key: `missed-${a.id}`,
        athleteId: a.id,
        name: a.name,
        reason: "Missed yesterday's session",
        tone: 'warn',
        target: '/coach-kpi/missed_yesterday',
      });
    });

    (data.pending_reviews_athletes || []).forEach((a) => {
      items.push({
        key: `review-${a.id}`,
        athleteId: a.id,
        name: a.name,
        reason: 'Session feedback to review',
        tone: 'accent',
        target: '/(tabs)/session-surveys',
        count: a.count ?? 1,
      });
    });

    if (!items.length) {
      if ((data.pending_reviews ?? 0) > 0) {
        items.push({
          key: 'review-summary',
          name: 'Session Feedback',
          reason: `${data.pending_reviews} item${data.pending_reviews === 1 ? '' : 's'} ready to review`,
          tone: 'accent',
          target: '/(tabs)/session-surveys',
          count: data.pending_reviews,
        });
      }

      if ((data.drafts ?? 0) > 0) {
        items.push({
          key: 'draft-summary',
          name: 'Draft Sessions',
          reason: `${data.drafts} draft${data.drafts === 1 ? '' : 's'} not assigned`,
          tone: 'accent',
          target: '/coach-kpi/drafts',
          count: data.drafts,
        });
      }
    }

    return items.slice(0, 6);
  }, [data]);

  const recentActivity = useMemo(() => {
    if (!data) return [] as Array<{
      key: string;
      title: string;
      meta: string;
      target: string;
      tone: 'accent' | 'warn' | 'success';
    }>;

    if (data.recent_activity && data.recent_activity.length > 0) {
      return data.recent_activity.slice(0, 4).map((item, idx) => {
        const actionLabel =
          item.kind === 'logged'
            ? 'completed'
            : item.kind === 'missed'
            ? 'missed'
            : 'was assigned';

        const whenLabel = (() => {
          const raw = String(item.when || '').trim();
          if (!raw) return 'Recently updated';
          if (raw.toLowerCase() === 'now') return 'Just now';
          return raw;
        })();

        return {
          key: `recent-${item.workout_id}-${idx}`,
          title: `${item.athlete_name} ${actionLabel} ${item.session_name}`,
          meta: whenLabel,
          target: item.workout_id ? `/workout/${item.workout_id}` : '/coach-kpi/today_logged',
          tone:
            item.kind === 'logged'
              ? 'success'
              : item.kind === 'missed'
              ? 'warn'
              : 'accent',
        };
      });
    }

    return [];
  }, [data]);

  const upcomingDays = useMemo(() => {
    return data?.upcoming_days ?? [];
  }, [data?.upcoming_days]);

  return (
    <ThemedView style={styles.screen}>
      {loading && !data ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
        </View>
      ) : (
        <RefreshScreen
          style={styles.scroll}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.avatarBubble}>
              {data?.coach_logo_url ? (
                <Image
                  source={{ uri: data.coach_logo_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <ThemedText style={styles.avatarText}>
                  {displayInitials}
                </ThemedText>
              )}
            </View>
            <View style={styles.heroCopy}>
              <ThemedText style={styles.heroEyebrow}>Coach</ThemedText>
              <ThemedText style={styles.heroName}>{displayName}</ThemedText>
              <ThemedText style={styles.heroMeta}>
                {data?.athlete_count ?? data?.total ?? 0} Athlete{((data?.athlete_count ?? data?.total ?? 0) === 1) ? '' : 's'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <TouchableOpacity
              style={[styles.kpiCard, styles.kpiThird]}
              onPress={() => router.push('/coach-kpi/today_assigned')}
            >
              <View style={styles.kpiIconRow}>
                <Ionicons name="calendar-outline" size={22} color="#A78BFA" />
              </View>
              <ThemedText style={styles.kpiMiniLabel}>Assigned Today</ThemedText>
              <ThemedText style={styles.kpiMiniValue}>{data?.today_assigned ?? 0}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.kpiCard, styles.kpiThird]}
              onPress={() => router.push('/coach-kpi/today_logged')}
            >
              <View style={styles.kpiIconRow}>
                <Ionicons name="checkbox-outline" size={22} color="#34D399" />
              </View>
              <ThemedText style={styles.kpiMiniLabel}>Logged Today</ThemedText>
              <ThemedText style={styles.kpiMiniValue}>{data?.today_logged ?? 0}</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.kpiCard, styles.kpiThird, styles.kpiWarnCard]}
              onPress={() => router.push('/coach-kpi/missed_yesterday')}
            >
              <View style={styles.kpiIconRow}>
                <Ionicons name="time-outline" size={22} color="#FBBF24" />
              </View>
              <ThemedText style={styles.kpiMiniLabel}>Missed Yesterday</ThemedText>
              <ThemedText style={[styles.kpiMiniValue, styles.warnValue]}>
                {data?.missed_yesterday ?? 0}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {error && (
            <ThemedText variant="error" style={styles.errorText}>{error}</ThemedText>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="warning-outline" size={18} color="#FF5C72" style={styles.sectionHeaderIcon} />
                <ThemedText variant="h2" style={styles.sectionTitle}>Needs Attention</ThemedText>
              </View>
              {(data?.pending_reviews ?? 0) > 0 && (
                <TouchableOpacity onPress={() => router.push('/(tabs)/session-surveys' as any)}>
                  <ThemedText style={styles.sectionLink}>View All</ThemedText>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.panelCard}>
              {attentionItems.length > 0 ? (
                attentionItems.map((item, idx) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.attentionRow,
                      idx !== attentionItems.length - 1 && styles.attentionRowBorder,
                    ]}
                    activeOpacity={item.target ? 0.85 : 1}
                    disabled={!item.target}
                    onPress={item.target ? () => router.push(item.target as any) : undefined}
                  >
                    <View
                      style={[
                        styles.attentionAvatar,
                        item.tone === 'danger'
                          ? styles.attentionAvatarDanger
                          : item.tone === 'warn'
                          ? styles.attentionAvatarWarn
                          : styles.attentionAvatarAccent,
                      ]}
                    >
                      <ThemedText style={styles.attentionAvatarText}>
                        {item.name
                          .split(' ')
                          .slice(0, 2)
                          .map((part) => part.charAt(0).toUpperCase())
                          .join('')
                          .slice(0, 2)}
                      </ThemedText>
                    </View>

                    <View style={styles.attentionContent}>
                      <ThemedText style={styles.attentionName}>{item.name}</ThemedText>
                      <ThemedText
                        style={[
                          styles.attentionReason,
                          item.tone === 'danger'
                            ? styles.attentionReasonDanger
                            : item.tone === 'warn'
                            ? styles.attentionReasonWarn
                            : styles.attentionReasonAccent,
                        ]}
                      >
                        {item.reason}
                      </ThemedText>
                    </View>

                    <View style={styles.attentionRight}>
                      {item.count ? (
                        <View style={styles.countBadge}>
                          <ThemedText style={styles.countBadgeText}>{item.count}</ThemedText>
                        </View>
                      ) : null}
                      {item.target ? <ThemedText style={styles.chevron}>›</ThemedText> : null}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyTitle}>Nothing urgent right now</ThemedText>
                  <ThemedText style={styles.emptyBody}>Your queue is clear for the moment.</ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="time-outline" size={18} color="#8B5CF6" style={styles.sectionHeaderIcon} />
                <ThemedText variant="h2" style={styles.sectionTitle}>Recent Activity</ThemedText>
              </View>
            </View>

            <View style={styles.panelCard}>
              {recentActivity.length > 0 ? (
                recentActivity.map((item, idx) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.activityRow,
                      idx !== recentActivity.length - 1 && styles.activityRowBorder,
                    ]}
                    onPress={() => router.push(item.target as any)}
                  >
                    <View
                      style={[
                        styles.activityIcon,
                        item.tone === 'success'
                          ? styles.activityIconSuccess
                          : item.tone === 'warn'
                          ? styles.activityIconWarn
                          : styles.activityIconAccent,
                      ]}
                    />
                    <View style={styles.activityContent}>
                      <ThemedText style={styles.activityTitle}>{item.title}</ThemedText>
                      <ThemedText style={styles.activityMeta}>{item.meta}</ThemedText>
                    </View>
                    <ThemedText style={styles.activityChevron}>›</ThemedText>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyTitle}>No recent activity yet</ThemedText>
                  <ThemedText style={styles.emptyBody}>Completed sessions and feedback will surface here.</ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="calendar-outline" size={18} color="#A78BFA" style={styles.sectionHeaderIcon} />
                <ThemedText variant="h2" style={styles.sectionTitle}>Upcoming</ThemedText>
              </View>
            </View>

            <View style={styles.panelCard}>
              {upcomingDays.length > 0 ? (
                upcomingDays.map((day, idx) => (
                  <View
                    key={day.date_iso}
                    style={[
                      styles.upcomingDayBlock,
                      idx !== upcomingDays.length - 1 && styles.upcomingDayBorder,
                    ]}
                  >
                    <View style={styles.upcomingDayHeader}>
                      <ThemedText style={styles.upcomingDayDow}>{day.dow}</ThemedText>
                      <ThemedText style={styles.upcomingDayDate}>{day.date_label}</ThemedText>
                    </View>

                    {day.items && day.items.length > 0 ? (
                      day.items.slice(0, 4).map((item, itemIdx) => (
                        <TouchableOpacity
                          key={`${day.date_iso}-${item.workout_id}-${itemIdx}`}
                          style={[
                            styles.upcomingItemRow,
                            itemIdx !== day.items.slice(0, 4).length - 1 && styles.upcomingItemBorder,
                          ]}
                          onPress={() => router.push(`/workout/${item.workout_id}` as any)}
                        >
                          <View style={styles.upcomingItemDot} />
                          <View style={styles.upcomingItemContent}>
                            <ThemedText style={styles.upcomingAthlete}>{item.athlete_name}</ThemedText>
                            <ThemedText style={styles.upcomingSession}>{item.session_name}</ThemedText>
                          </View>
                          <ThemedText style={styles.activityChevron}>›</ThemedText>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={styles.upcomingEmptyRow}>
                        <ThemedText style={styles.upcomingEmptyText}>No sessions scheduled</ThemedText>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <ThemedText style={styles.emptyTitle}>Nothing scheduled yet</ThemedText>
                  <ThemedText style={styles.emptyBody}>The next 3 days will show here.</ThemedText>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.9}
            onPress={() => router.push('/create-workout')}
          >
            <ThemedText style={styles.fabPlus}>＋</ThemedText>
            <ThemedText style={styles.fabLabel}>Create{`\n`}Session</ThemedText>
          </TouchableOpacity>
        </RefreshScreen>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 24,
    backgroundColor: '#020617',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 108, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124, 108, 255, 0.32)',
    marginRight: 12,
  },
  avatarText: {
    color: '#C4B5FD',
    fontSize: 20,
    fontWeight: '700',
  },
  heroCopy: {
    flex: 1,
  },
  heroEyebrow: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 2,
  },
  heroName: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  heroMeta: {
    fontSize: 15,
    color: '#94A3B8',
  },
  errorText: {
    color: '#f97373',
    fontSize: 13,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(10, 18, 38, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(109, 132, 176, 0.16)',
  },
  kpiThird: {
    minHeight: 104,
    justifyContent: 'space-between',
  },
  kpiWarnCard: {
    borderColor: 'rgba(245, 158, 11, 0.24)',
  },
  kpiIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  kpiMiniLabel: {
    fontSize: 12,
    lineHeight: 15,
    color: '#94A3B8',
  },
  kpiMiniValue: {
    fontSize: 24,
    lineHeight: 36,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  warnValue: {
    color: '#FBBF24',
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderIcon: {
    marginRight: 10,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  sectionDotDanger: {
    backgroundColor: '#FF5C72',
  },
  sectionDotAccent: {
    backgroundColor: '#8B5CF6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  sectionLink: {
    color: '#A78BFA',
    fontSize: 15,
    fontWeight: '600',
  },
  panelCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#071128',
    borderWidth: 1,
    borderColor: 'rgba(109, 132, 176, 0.14)',
  },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  attentionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  attentionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attentionAvatarDanger: {
    backgroundColor: 'rgba(255, 92, 114, 0.18)',
  },
  attentionAvatarWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  attentionAvatarAccent: {
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
  },
  attentionAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  attentionContent: {
    flex: 1,
  },
  attentionName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  attentionReason: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  attentionReasonDanger: {
    color: '#FF6B7D',
  },
  attentionReasonWarn: {
    color: '#FBBF24',
  },
  attentionReasonAccent: {
    color: '#A78BFA',
  },
  attentionRight: {
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 24,
    color: '#94A3B8',
    lineHeight: 24,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  activityIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  activityIconSuccess: {
    backgroundColor: '#34D399',
  },
  activityIconWarn: {
    backgroundColor: '#F59E0B',
  },
  activityIconAccent: {
    backgroundColor: '#8B5CF6',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: '#E5E7EB',
    fontWeight: '600',
    marginBottom: 3,
  },
  activityMeta: {
    fontSize: 13,
    color: '#8EA0BE',
  },
  activityChevron: {
    marginLeft: 10,
    fontSize: 22,
    color: '#64748B',
    lineHeight: 22,
  },
  upcomingDayBlock: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  upcomingDayBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  upcomingDayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  upcomingDayDow: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  upcomingDayDate: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  upcomingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  upcomingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  upcomingItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A78BFA',
    marginRight: 12,
  },
  upcomingItemContent: {
    flex: 1,
  },
  upcomingAthlete: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: 2,
  },
  upcomingSession: {
    fontSize: 13,
    color: '#94A3B8',
  },
  upcomingEmptyRow: {
    paddingVertical: 8,
  },
  upcomingEmptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptyState: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: 4,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 18,
    color: '#94A3B8',
  },
  fab: {
    position: 'absolute',
    right: 8,
    bottom: 18,
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabPlus: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '400',
    marginBottom: 2,
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
});