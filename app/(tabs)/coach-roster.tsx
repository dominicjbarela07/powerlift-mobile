// app/coach-roster.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { fetchJson } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

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
  days_until_meet?: number | null;
};

type CoachRosterSummary = {
  need_programming: number;
  programming_soon: number;
  up_to_date: number;
  total_athletes: number;
};

type CoachRosterResponse = {
  ok: boolean;
  summary: CoachRosterSummary;
  athletes: CoachRosterAthlete[];
  error?: string;
};

export default function CoachRosterScreen() {
  const [data, setData] = useState<CoachRosterAthlete[]>([]);
  const [summary, setSummary] = useState<CoachRosterSummary>({
    need_programming: 0,
    programming_soon: 0,
    up_to_date: 0,
    total_athletes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const loadRoster = React.useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      setError(null);
      const resp = await fetchJson('/coach/mobile/roster', { method: 'GET' });
      const json = resp.json as CoachRosterResponse | null;

      if (!resp.ok || !json?.ok) {
        setError(json?.error || `Failed to load roster. (${resp.status})`);
        return;
      }

      setData(json.athletes || []);
      setSummary(
        json.summary || {
          need_programming: 0,
          programming_soon: 0,
          up_to_date: 0,
          total_athletes: json.athletes?.length || 0,
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

  const onRefresh = () => {
    setRefreshing(true);
    loadRoster();
  };

  const sortedAthletes = useMemo(() => {
    const rank: Record<string, number> = {
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

  const formatBodyweight = (v: number | null) => {
    if (v == null) return 'BW —';
    return `BW ${v.toFixed(1)} kg`;
  };

  const getStatusPillStyle = (tone: CoachRosterAthlete['status_tone']) => {
    if (tone === 'danger') return [styles.statusPill, styles.statusPillDanger];
    if (tone === 'warn') return [styles.statusPill, styles.statusPillWarn];
    return [styles.statusPill, styles.statusPillSuccess];
  };

  const getStatusTextStyle = (tone: CoachRosterAthlete['status_tone']) => {
    if (tone === 'danger') return [styles.statusPillText, styles.statusPillTextDanger];
    if (tone === 'warn') return [styles.statusPillText, styles.statusPillTextWarn];
    return [styles.statusPillText, styles.statusPillTextSuccess];
  };

  const getCardToneStyle = (tone: CoachRosterAthlete['status_tone']) => {
    if (tone === 'danger') return styles.athleteCardDanger;
    if (tone === 'warn') return styles.athleteCardWarn;
    return styles.athleteCardSuccess;
  };

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText variant="h1" style={styles.title}>Coach Roster</ThemedText>
        <ThemedText variant="bodyMuted" style={styles.subtitle}>
          {summary.total_athletes} {summary.total_athletes === 1 ? 'athlete' : 'athletes'} • Sorted by priority
        </ThemedText>
      </View>

      {loading && !refreshing && (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
        </View>
      )}

      {!loading && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#9CA3AF"
            />
          }
        >
          {error && (
            <ThemedText variant="error" style={styles.errorText}>{error}</ThemedText>
          )}

          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, styles.kpiDanger]}>
              <Ionicons name="calendar-outline" size={20} color="#FF8A8A" style={styles.kpiIcon} />
              <ThemedText style={styles.kpiLabel}>Need Programming</ThemedText>
              <ThemedText style={[styles.kpiValue, styles.kpiValueDanger]}>{summary.need_programming}</ThemedText>
            </View>
            <View style={[styles.kpiCard, styles.kpiWarn]}>
              <Ionicons name="time-outline" size={20} color="#FBBF24" style={styles.kpiIcon} />
              <ThemedText style={styles.kpiLabel}>Programming Soon</ThemedText>
              <ThemedText style={[styles.kpiValue, styles.kpiValueWarn]}>{summary.programming_soon}</ThemedText>
            </View>
            <View style={[styles.kpiCard, styles.kpiSuccess]}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#4ADE80" style={styles.kpiIcon} />
              <ThemedText style={styles.kpiLabel}>Up To Date</ThemedText>
              <ThemedText style={[styles.kpiValue, styles.kpiValueSuccess]}>{summary.up_to_date}</ThemedText>
            </View>
          </View>

          {sortedAthletes.length === 0 && !error && (
            <ThemedText variant="bodyMuted" style={styles.emptyText}>
              No athletes yet. Add athletes from the web coach dashboard.
            </ThemedText>
          )}

          {sortedAthletes.map((a) => (
            <Pressable
              key={a.id}
              style={({ pressed }) => [
                styles.athleteCard,
                getCardToneStyle(a.status_tone),
                pressed && styles.cardPressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/workouts',
                  params: { athleteId: String(a.id), athleteName: a.name },
                })
              }
            >
              <View style={styles.cardTopRow}>
                <View style={styles.avatarBubble}>
                  {a.avatar_url ? (
                    <Image source={{ uri: a.avatar_url }} style={styles.avatarImage} resizeMode="cover" />
                  ) : (
                    <ThemedText style={styles.avatarText}>
                      {(a.name || '')
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part.charAt(0).toUpperCase())
                        .join('') || 'A'}
                    </ThemedText>
                  )}
                </View>

                <View style={styles.cardTopContent}>
                  <View style={styles.nameRow}>
                    <ThemedText variant="h3" style={styles.nameText}>{a.name}</ThemedText>
                    {a.is_self && (
                      <View style={styles.badge}>
                        <ThemedText variant="badge" style={styles.badgeText}>You</ThemedText>
                      </View>
                    )}
                  </View>

                  <ThemedText variant="bodyMuted" style={styles.metaText}>
                    {(a.sex || '—').toUpperCase()} • {formatBodyweight(a.bodyweight)}
                  </ThemedText>
                </View>

                <ThemedText style={styles.chevron}>›</ThemedText>
              </View>

              <View style={getStatusPillStyle(a.status_tone)}>
                <ThemedText style={getStatusTextStyle(a.status_tone)}>{a.status_label}</ThemedText>
              </View>

              {a.meet_date && (
                <View style={styles.meetRow}>
                  <View style={styles.meetBadge}>
                    <Ionicons name="trophy-outline" size={15} color="#DDD6FE" style={styles.meetIcon} />
                    <ThemedText style={styles.meetText}>
                      {(() => {
                        try {
                          const d = new Date(a.meet_date);
                          const formatted = d.toLocaleDateString(undefined, {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          });

                          if (typeof a.days_until_meet === 'number') {
                            if (a.days_until_meet > 0) {
                              const w = Math.floor(a.days_until_meet / 7);
                              const dRem = a.days_until_meet % 7;
                              return `${formatted} • ${w}w ${dRem}d out`;
                            }
                            return `${formatted} • PASSED`;
                          }

                          return formatted;
                        } catch {
                          return a.meet_date;
                        }
                      })()}
                    </ThemedText>
                  </View>
                </View>
              )}

              <View style={styles.cardDivider} />

              <View style={styles.infoRow}>
                <View style={[styles.infoBlock, styles.infoBlockNarrow]}>
                  <View style={styles.infoHeaderRow}>
                    <Ionicons name="barbell-outline" size={16} color="#A78BFA" style={styles.infoIcon} />
                    <ThemedText style={styles.infoLabel}>Last Session</ThemedText>
                  </View>
                  <ThemedText style={styles.infoPrimary}>{a.last_session_primary}</ThemedText>
                  {!!a.last_session_secondary && (
                    <ThemedText style={styles.infoSecondary}>{a.last_session_secondary}</ThemedText>
                  )}
                </View>

                <View style={styles.infoDivider} />

                <View style={[styles.infoBlock, styles.infoBlockWide]}>
                  <View style={styles.infoHeaderRow}>
                    <Ionicons name="calendar-outline" size={16} color="#A78BFA" style={styles.infoIcon} />
                    <ThemedText style={styles.infoLabel}>Programmed Through</ThemedText>
                  </View>
                  <ThemedText style={styles.infoPrimary}>{a.programmed_primary}</ThemedText>
                  {!!a.programmed_secondary && (
                    <ThemedText
                      style={[
                        styles.infoSecondary,
                        a.status_tone === 'danger'
                          ? styles.infoSecondaryDanger
                          : a.status_tone === 'warn'
                          ? styles.infoSecondaryWarn
                          : styles.infoSecondarySuccess,
                      ]}
                    >
                      {a.programmed_secondary}
                    </ThemedText>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#020617',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#9CA3AF',
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
    paddingBottom: 32,
  },
  errorText: {
    color: '#f97373',
    fontSize: 14,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minHeight: 96,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(10, 18, 38, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(109, 132, 176, 0.16)',
    justifyContent: 'space-between',
  },
  kpiDanger: {
    borderColor: 'rgba(255, 92, 114, 0.24)',
  },
  kpiWarn: {
    borderColor: 'rgba(245, 158, 11, 0.24)',
  },
  kpiSuccess: {
    borderColor: 'rgba(74, 222, 128, 0.24)',
  },
  kpiIcon: {
    marginBottom: 10,
  },
  kpiLabel: {
    fontSize: 10,
    lineHeight: 14,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  kpiValue: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  kpiValueDanger: {
    color: '#FF8A8A',
  },
  kpiValueWarn: {
    color: '#FBBF24',
  },
  kpiValueSuccess: {
    color: '#4ADE80',
  },
  athleteCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(7, 17, 40, 1)',
    borderWidth: 1,
    borderColor: 'rgba(109, 132, 176, 0.14)',
    marginBottom: 12,
  },
  athleteCardDanger: {
    borderColor: 'rgba(255, 92, 114, 0.34)',
  },
  athleteCardWarn: {
    borderColor: 'rgba(245, 158, 11, 0.34)',
  },
  athleteCardSuccess: {
    borderColor: 'rgba(74, 222, 128, 0.26)',
  },
  cardPressed: {
    opacity: 0.88,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124, 108, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124, 108, 255, 0.28)',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  avatarText: {
    color: '#C4B5FD',
    fontSize: 20,
    fontWeight: '700',
  },
  cardTopContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(124, 108, 255, 0.26)',
    backgroundColor: 'rgba(124, 108, 255, 0.10)',
  },
  badgeText: {
    fontSize: 12,
    color: '#C4B5FD',
  },
  chevron: {
    fontSize: 26,
    color: '#64748B',
    lineHeight: 26,
    marginLeft: 10,
  },
  metaText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillDanger: {
    backgroundColor: 'rgba(255, 92, 114, 0.14)',
    borderColor: 'rgba(255, 92, 114, 0.24)',
  },
  statusPillWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.24)',
  },
  statusPillSuccess: {
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
    borderColor: 'rgba(74, 222, 128, 0.24)',
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusPillTextDanger: {
    color: '#FF8A8A',
  },
  statusPillTextWarn: {
    color: '#FBBF24',
  },
  statusPillTextSuccess: {
    color: '#4ADE80',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    marginTop: 14,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  infoBlock: {
    flex: 1,
  },
  infoBlockNarrow: {
    flex: 0.85,
  },
  infoBlockWide: {
    flex: 1.15,
  },
  infoDivider: {
    width: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    marginHorizontal: 14,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '700',
  },
  infoPrimary: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  infoSecondary: {
    fontSize: 14,
    color: '#94A3B8',
  },
  infoSecondaryDanger: {
    color: '#FF8A8A',
  },
  infoSecondaryWarn: {
    color: '#FBBF24',
  },
  infoSecondarySuccess: {
    color: '#4ADE80',
  },
  meetRow: {
    marginTop: 10,
  },
  meetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.34)',
    backgroundColor: 'rgba(124, 108, 255, 0.16)',
    shadowColor: '#7C6CFF',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 3,
  },
  meetIcon: {
    marginRight: 7,
  },
  meetText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#E9E3FF',
    letterSpacing: 0.2,
  },
});