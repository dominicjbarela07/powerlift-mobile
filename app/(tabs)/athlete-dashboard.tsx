// app/athlete-dashboard.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { fetchJson } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

type WorkoutPreviewLine = {
  lift?: string;
  scheme?: string;
};

type WorkoutPreview = {
  core_lines?: WorkoutPreviewLine[];
  core_count?: number;
  accessory_count?: number;
  primary_lifts?: string[];
  summary?: string | null;
};

type WorkoutCard = {
  id: number;
  label: string;
  date?: string | null;
  status?: string | null;
  is_today?: boolean;
  is_overdue?: boolean;
  preview?: WorkoutPreview;
};

type HeroPayload = {
  type: 'resume_workout' | 'start_workout' | 'completed_today' | 'missed_session' | 'rest_day';
  cta?: string | null;
  session?: WorkoutCard | null;
};

type ComplianceSummary = {
  last_30_days?: {
    pct?: number | null;
    logged?: number;
    missed?: number;
    total?: number;
    start_date?: string;
    end_date?: string;
  };
};

type ConsistencyPayload = {
  this_week?: {
    assigned?: number;
    logged?: number;
    missed?: number;
    pct?: number | null;
    start_date?: string;
    end_date?: string;
  };
  streak_sessions?: number;
};

type TrendPoint = {
  date: string;
  lift: string;
  e1rm_kg: number;
  weight_kg: number;
  reps: number;
};

type StrengthTrends = {
  squat?: TrendPoint[];
  bench?: TrendPoint[];
  deadlift?: TrendPoint[];
};

type StrengthSummaryBucket = {
  current_e1rm_kg?: number | null;
  delta_kg?: number | null;
  latest_set?: {
    weight_kg?: number | null;
    reps?: number | null;
    date?: string | null;
  } | null;
};


type StrengthSummary = {
  squat?: StrengthSummaryBucket;
  bench?: StrengthSummaryBucket;
  deadlift?: StrengthSummaryBucket;
};

type ReadinessPoint = {
  date?: string | null;
  readiness_score?: number | null;
  sleep_quality?: number | null;
  soreness?: number | null;
  stress?: number | null;
  energy?: number | null;
};

type ReadinessSummary = {
  id?: number;
  date?: string | null;
  sleep_quality?: number | null;
  soreness?: number | null;
  stress?: number | null;
  energy?: number | null;
  readiness_score?: number | null;
};

type WeekPreviewItem = {
  id: number;
  label: string;
  date?: string | null;
  status?: string | null;
};

type DashboardData = {
  athlete: any;
  coach: any;
  hero?: HeroPayload;
  next_workout: WorkoutCard | null;
  recent_workouts: WorkoutCard[];
  recent_sessions?: WorkoutCard[];
  week_preview?: WeekPreviewItem[];
  consistency?: ConsistencyPayload;
  compliance?: ComplianceSummary;
  strength_summary?: StrengthSummary;
  strength_trends?: StrengthTrends;
  today_readiness?: ReadinessSummary | null;
  latest_readiness?: ReadinessSummary | null;
  readiness_summary?: {
    window_days?: number;
    composite?: number | null;
    sleep?: number | null;
    energy?: number | null;
    soreness?: number | null;
    stress?: number | null;
    change?: number | null;
    change_direction?: 'up' | 'down' | 'flat' | string;
    latest_date?: string | null;
  };
  readiness_trend_7d?: ReadinessPoint[];
};


const KG_TO_LBS = 2.205;
const PATCH_NOTE_VERSION = 'athlete_dashboard_trends_fix_v1';

export default function AthleteDashboard() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const { token } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendChartWidth, setTrendChartWidth] = useState(0);
  const [trendUnit, setTrendUnit] = useState<'kg' | 'lbs'>('kg');
  const [trendUnitHydrated, setTrendUnitHydrated] = useState(false);
  const [activeTrendKey, setActiveTrendKey] = useState<'squat' | 'bench' | 'deadlift' | null>(null);
  const [showPatchNote, setShowPatchNote] = useState(false);
  useEffect(() => {
    let cancelled = false;

    const checkPatchNote = async () => {
      try {
        const seen = await AsyncStorage.getItem(PATCH_NOTE_VERSION);
        if (!cancelled && seen !== '1') {
          setShowPatchNote(true);
        }
      } catch {
        if (!cancelled) {
          setShowPatchNote(true);
        }
      }
    };

    checkPatchNote();

    return () => {
      cancelled = true;
    };
  }, []);
  const dismissPatchNote = async () => {
    setShowPatchNote(false);
    try {
      await AsyncStorage.setItem(PATCH_NOTE_VERSION, '1');
    } catch {
      // no-op
    }
  };

  const trendUnitStorageKey = useMemo(() => {
    const athleteId = data?.athlete?.id;
    return athleteId ? `athlete_dashboard_trend_unit:${athleteId}` : null;
  }, [data?.athlete?.id]);

  const loadDashboard = React.useCallback(
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

        const res: any = await fetchJson('/athletes/mobile/dashboard', {
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
          const msg = payload?.error || payload?.message || 'Failed to load dashboard.';
          setError(String(msg));
          setData(null);
          return;
        }

        setData({
          athlete: payload.athlete,
          coach: payload.coach,
          hero: payload.hero || undefined,
          next_workout: payload.next_workout || null,
          recent_workouts: payload.recent_workouts || [],
          recent_sessions: payload.recent_sessions || [],
          week_preview: payload.week_preview || [],
          consistency: payload.consistency || undefined,
          compliance: payload.compliance || undefined,
          strength_summary: payload.strength_summary || undefined,
          strength_trends: payload.strength_trends || undefined,
          today_readiness: payload.today_readiness || null,
          latest_readiness: payload.latest_readiness || null,
          readiness_summary: payload.readiness_summary || undefined,
          readiness_trend_7d: payload.readiness_trend_7d || [],
        });
      } catch (err) {
        console.log('Athlete dashboard API error', err);
        setError('Network error while loading dashboard.');
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

  useEffect(() => {
    let cancelled = false;

    const loadTrendUnit = async () => {
      if (!trendUnitStorageKey) {
        setTrendUnit('kg');
        setTrendUnitHydrated(true);
        return;
      }

      try {
        setTrendUnitHydrated(false);
        const saved = await AsyncStorage.getItem(trendUnitStorageKey);
        if (cancelled) return;
        if (saved === 'kg' || saved === 'lbs') {
          setTrendUnit(saved);
        } else {
          setTrendUnit('kg');
        }
      } catch {
        if (!cancelled) {
          setTrendUnit('kg');
        }
      } finally {
        if (!cancelled) {
          setTrendUnitHydrated(true);
        }
      }
    };

    loadTrendUnit();

    return () => {
      cancelled = true;
    };
  }, [trendUnitStorageKey]);

  useEffect(() => {
    if (!trendUnitHydrated || !trendUnitStorageKey) return;
    AsyncStorage.setItem(trendUnitStorageKey, trendUnit).catch(() => {
      // no-op
    });
  }, [trendUnit, trendUnitHydrated, trendUnitStorageKey]);

  const handleRefresh = React.useCallback(async () => {
    await loadDashboard({ silent: true });
  }, [loadDashboard]);

  const formatShortDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat([], {
      month: 'short',
      day: 'numeric',
    }).format(d);
  };

  const formatLongDate = (iso?: string | null) => {
    if (!iso) return 'Date TBD';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(d);
  };

  const parseLocalDate = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const convertWeight = (value?: number | null) => {
    if (value == null || !Number.isFinite(Number(value))) return null;
    const base = Number(value);
    return trendUnit === 'lbs' ? base * KG_TO_LBS : base;
  };

  const formatWeight = (value?: number | null) => {
    const converted = convertWeight(value);
    if (converted == null) return '—';
    const rounded = Math.round(converted * 4) / 4;
    return rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };

  const statusLabel = (s?: string | null) => {
    const v = String(s || 'assigned').trim().toLowerCase();
    if (v === 'assigned') return 'Assigned';
    if (v === 'in_progress') return 'In Progress';
    if (v === 'completed' || v === 'done' || v === 'logged') return 'Completed';
    if (v === 'missed') return 'Missed';
    return v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const statusTone = (s?: string | null) => {
    const v = String(s || 'assigned').trim().toLowerCase();
    if (v === 'assigned') {
      return {
        bg: 'rgba(245,158,11,0.10)',
        border: 'rgba(245,158,11,0.28)',
        text: '#F0B46A',
      };
    }
    if (v === 'in_progress') {
      return {
        bg: 'rgba(34,197,94,0.10)',
        border: 'rgba(34,197,94,0.26)',
        text: '#86EFAC',
      };
    }
    if (v === 'missed') {
      return {
        bg: 'rgba(239,68,68,0.10)',
        border: 'rgba(239,68,68,0.26)',
        text: '#FCA5A5',
      };
    }
    return {
      bg: 'rgba(109,91,208,0.10)',
      border: 'rgba(109,91,208,0.22)',
      text: '#C7BEE8',
    };
  };

  const heroAccent = (type?: HeroPayload['type']) => {
    if (type === 'resume_workout') return '#5B4FCF';
    if (type === 'completed_today') return '#22C55E';
    if (type === 'missed_session') return '#EF4444';
    if (type === 'rest_day') return '#94A3B8';
    return '#5B4FCF';
  };

  const heroCtaLabel = (type?: HeroPayload['type'], cta?: string | null) => {
    if (type === 'completed_today') return 'Review Session';
    return cta || 'Open Session';
  };

  const openWorkout = (workoutId?: number | null) => {
    if (!workoutId) return;
    router.push({
      pathname: '/workout/[workoutId]',
      params: { workoutId: String(workoutId) },
    });
  };

  const workoutPreview = (w?: WorkoutCard | null) => {
    if (!w?.preview) return null;
    const preview = w.preview;
    const primaryLifts = Array.isArray(preview.primary_lifts) ? preview.primary_lifts.filter(Boolean) : [];
    return {
      primaryLifts,
      coreCount: preview.core_count ?? 0,
      accessoryCount: preview.accessory_count ?? 0,
      summary: preview.summary || null,
    };
  };

  const formatReadinessValue = (value?: number | null, digits = 1) => {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return Number(value).toFixed(digits).replace(/\.0$/, '');
  };


  const athlete = data?.athlete;
  const coach = data?.coach;
  const hero = data?.hero || undefined;
  const fallbackWorkout = data?.next_workout;
  const activeHeroSession =
    hero?.session ||
    (hero?.type === 'completed_today' ? null : fallbackWorkout) ||
    null;

  const norm = (v: any) => String(v ?? '').trim().toLowerCase();
  const isSelfCoached = !!(
    athlete &&
    (
      athlete.is_self_coached === true ||
      (athlete.user_id != null && athlete.coach_id != null && String(athlete.user_id) === String(athlete.coach_id)) ||
      (coach?.id != null && athlete.user_id != null && String(coach.id) === String(athlete.user_id)) ||
      (coach?.id != null && athlete.coach_id != null && String(coach.id) === String(athlete.coach_id)) ||
      (!!coach?.email && !!athlete?.email && norm(coach.email) === norm(athlete.email)) ||
      (!!coach?.name && !!athlete?.name && norm(coach.name) === norm(athlete.name))
    )
  );

  const heroTone = statusTone(activeHeroSession?.status || (hero?.type === 'rest_day' ? 'rest' : undefined));
  const heroPreview = workoutPreview(activeHeroSession);
  const consistencyWeek = data?.consistency?.this_week;
  const weekAssigned = consistencyWeek?.assigned ?? 0;
  const weekLogged = consistencyWeek?.logged ?? 0;
  const weekMissed = consistencyWeek?.missed ?? 0;
  const weekPct = consistencyWeek?.pct;
  const streakSessions = data?.consistency?.streak_sessions ?? 0;
  const weekProgress = weekAssigned > 0 ? Math.min(1, weekLogged / weekAssigned) : 0;

  const weekStartDate = parseLocalDate(consistencyWeek?.start_date || null);
  const weekPreviewItems = data?.week_preview || [];
  const weekBlips = Array.from({ length: 7 }, (_, idx) => {
    const dateObj = weekStartDate ? new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate() + idx) : null;
    const iso = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}` : null;
    const itemsForDay = iso ? weekPreviewItems.filter((item) => item.date === iso) : [];

    const statusPriority = ['in_progress', 'assigned', 'completed', 'missed'];
    const chosenItem = itemsForDay.sort((a, b) => {
      const aIdx = statusPriority.indexOf(String(a.status || '').toLowerCase());
      const bIdx = statusPriority.indexOf(String(b.status || '').toLowerCase());
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    })[0] || null;

    return {
      key: iso || `day-${idx}`,
      label: dateObj ? dateObj.toLocaleDateString([], { weekday: 'short' }).slice(0, 1) : ['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx],
      hasSession: itemsForDay.length > 0,
      status: chosenItem?.status || null,
    };
  });

  const readinessSummary = data?.readiness_summary;
  const readinessLatest = data?.today_readiness || data?.latest_readiness || null;
  const readinessComposite7d = readinessSummary?.composite ?? null;
  const readinessSleep7d = readinessSummary?.sleep ?? null;
  const readinessEnergy7d = readinessSummary?.energy ?? null;
  const readinessSoreness7d = readinessSummary?.soreness ?? null;
  const readinessStress7d = readinessSummary?.stress ?? null;
  const readinessChange = readinessSummary?.change ?? null;
  const readinessDirection = readinessSummary?.change_direction || 'flat';

  const summaryBuckets = [
    { key: 'squat', label: 'Squat', color: '#FB7185', summary: data?.strength_summary?.squat, points: data?.strength_trends?.squat || [] },
    { key: 'bench', label: 'Bench', color: '#38BDF8', summary: data?.strength_summary?.bench, points: data?.strength_trends?.bench || [] },
    { key: 'deadlift', label: 'Deadlift', color: '#A78BFA', summary: data?.strength_summary?.deadlift, points: data?.strength_trends?.deadlift || [] },
  ].filter((bucket) => {
    const hasTrend = (bucket.points || []).length > 0;
    const hasSummary = bucket.summary?.current_e1rm_kg != null;
    return hasTrend || hasSummary;
  });

  const hasStrengthData = summaryBuckets.length > 0;

  const missedSessions = (data?.recent_sessions || [])
    .filter((session) => String(session.status || '').toLowerCase() === 'missed')
    .slice(0, 3);
  const hasMissedSessions = missedSessions.length > 0;

  const fallbackTrendBucket =
    summaryBuckets.find((bucket) => (bucket.points || []).length > 0) ||
    summaryBuckets.find((bucket) => bucket.summary?.current_e1rm_kg != null) ||
    null;

  const selectedTrendBucket = activeTrendKey
    ? summaryBuckets.find((bucket) => bucket.key === activeTrendKey)
    : null;

  const activeTrendBucket = selectedTrendBucket || fallbackTrendBucket;

  useEffect(() => {
    if (!activeTrendKey && fallbackTrendBucket?.key) {
      setActiveTrendKey(fallbackTrendBucket.key as 'squat' | 'bench' | 'deadlift');
      return;
    }

    if (activeTrendKey && !summaryBuckets.some((bucket) => bucket.key === activeTrendKey)) {
      setActiveTrendKey((fallbackTrendBucket?.key as 'squat' | 'bench' | 'deadlift') || null);
    }
  }, [activeTrendKey, fallbackTrendBucket?.key, summaryBuckets]);

  const trendPoints = useMemo(() => {
    const pts = activeTrendBucket?.points || [];
    return [...pts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-6);
  }, [activeTrendBucket]);

  const chartWidth = Math.max(220, trendChartWidth || windowWidth - 72);
  const chartHeight = 168;
  const chartPaddingLeft = 28;
  const chartPaddingRight = 10;
  const chartPaddingTop = 12;
  const chartPaddingBottom = 24;
  const trendDateKeys = trendPoints.map((p) => String(p.date).slice(0, 10));
  const trendValues = trendPoints.map((p) => convertWeight(p.e1rm_kg)).filter((v): v is number => v != null && Number.isFinite(v));
  const yMinRaw = trendValues.length ? Math.min(...trendValues) : 0;
  const yMaxRaw = trendValues.length ? Math.max(...trendValues) : 0;
  const yPadding = trendValues.length ? Math.max((yMaxRaw - yMinRaw) * 0.15, 5) : 5;
  const yMin = Math.max(0, Math.floor((yMinRaw - yPadding) / 10) * 10);
  const yMax = Math.ceil((yMaxRaw + yPadding) / 10) * 10;
  const ySpan = Math.max(yMax - yMin, 1);
  const innerChartWidth = Math.max(chartWidth - chartPaddingLeft - chartPaddingRight, 1);
  const innerChartHeight = Math.max(chartHeight - chartPaddingTop - chartPaddingBottom, 1);

  const xForDate = (date: string) => {
    const idx = trendDateKeys.indexOf(String(date).slice(0, 10));
    if (idx < 0) return chartPaddingLeft;
    if (trendDateKeys.length === 1) return chartPaddingLeft + innerChartWidth / 2;
    return chartPaddingLeft + (idx / Math.max(trendDateKeys.length - 1, 1)) * innerChartWidth;
  };

  const yForValue = (value: number) => {
    return chartPaddingTop + innerChartHeight - ((value - yMin) / ySpan) * innerChartHeight;
  };

  const rawStep = ySpan / 3;
  const tickStep = Math.max(10, Math.ceil(rawStep / 10) * 10);
  const yTickValues: number[] = [];
  for (let v = yMin; v <= yMax; v += tickStep) {
    yTickValues.push(v);
  }
  if (yTickValues[yTickValues.length - 1] !== yMax) {
    yTickValues.push(yMax);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.screenCentered}>
          <ActivityIndicator size="small" color="#B8B0DA" />
          <ThemedText variant="bodyMuted" style={styles.loadingText}>Loading dashboard…</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.screenCentered}>
          <ThemedText variant="error" style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.screenCentered}>
          <ThemedText>No data.</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ThemedView style={styles.screen}>
        <Modal
          visible={showPatchNote}
          transparent
          animationType="fade"
          onRequestClose={dismissPatchNote}
        >
          <View style={styles.patchModalBackdrop}>
            <View style={styles.patchModalCard}>
              <View style={styles.patchModalIconWrap}>
                <Ionicons name="analytics" size={22} color="#C7BEE8" />
              </View>

              <Text style={styles.patchModalTitle}>Analytics Update</Text>

              <Text style={styles.patchModalBody}>
                Fixed an issue where the e1RM chart only rendered one lift trend.
              </Text>

              <Text style={styles.patchModalSubtext}>
                Squat, Bench, and Deadlift trends can now be viewed individually by tapping on each one.
              </Text>

              <Pressable
                onPress={dismissPatchNote}
                style={({ pressed }) => [
                  styles.patchModalButton,
                  pressed && styles.patchModalButtonPressed,
                ]}
              >
                <Text style={styles.patchModalButtonText}>Got it</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#9CA3AF" />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerIdentityRow}>
              <View style={styles.headerAvatar}>
                {athlete?.avatar_url ? (
                  <Image source={{ uri: athlete.avatar_url }} style={styles.headerAvatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.headerAvatarText}>
                    {String(athlete?.name || 'Athlete')
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() || '')
                      .join('') || 'A'}
                  </Text>
                )}
              </View>
              <View style={styles.headerTextCol}>
                <ThemedText variant="h1" style={styles.title}>
                  {athlete?.name || 'Athlete'}
                </ThemedText>
                {isSelfCoached ? (
                  <ThemedText variant="bodyMuted" style={styles.subtitle}>Self-coached athlete</ThemedText>
                ) : coach ? (
                  <ThemedText variant="bodyMuted" style={styles.subtitle}>Coached by {coach.name || coach.email}</ThemedText>
                ) : (
                  <ThemedText variant="bodyMuted" style={styles.subtitle}>Athlete dashboard</ThemedText>
                )}
              </View>
            </View>
          </View>

          {athlete?.meet_date && typeof athlete?.days_until_meet === 'number' && athlete.days_until_meet >= 0 ? (
            <View style={styles.meetBanner}>
              <Ionicons name="trophy-outline" size={16} color="#DDD6FE" style={styles.meetBannerIcon} />
              <ThemedText style={styles.meetBannerText}>
                {`Meet Date: ${(() => {
                  try {
                    const d = new Date(`${athlete.meet_date}T00:00:00`);
                    const formatted = Number.isNaN(d.getTime())
                      ? athlete.meet_date
                      : d.toLocaleDateString(undefined, {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        });

                    const days = athlete.days_until_meet;
                    if (days > 0) {
                      const w = Math.floor(days / 7);
                      const dRem = days % 7;
                      return `${formatted} • ${w}w ${dRem}d out`;
                    }
                    return `${formatted} • TODAY`;
                  } catch {
                    return athlete.meet_date;
                  }
                })()}`}
              </ThemedText>
            </View>
          ) : null}

          <View style={[styles.heroCard, { borderColor: heroTone.border }]}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTitleCol}>
                <ThemedText variant="h3" style={styles.heroEyebrow}>Today</ThemedText>
                <ThemedText variant="h2" style={styles.heroWorkoutTitle}>
                  {activeHeroSession?.label || (hero?.type === 'completed_today' ? "Today's Session" : hero?.type === 'rest_day' ? 'Rest Day' : 'No Session Assigned')}
                </ThemedText>
                <ThemedText variant="bodyMuted" style={styles.heroDate}>
                  {activeHeroSession?.date ? formatLongDate(activeHeroSession.date) : 'No session scheduled'}
                </ThemedText>
              </View>
              {activeHeroSession?.status ? (
                <View style={[styles.statusPill, { backgroundColor: heroTone.bg, borderColor: heroTone.border }]}>
                  <Text style={[styles.statusPillText, { color: heroTone.text }]}>{statusLabel(activeHeroSession.status)}</Text>
                </View>
              ) : null}
            </View>

            {heroPreview ? (
              <View style={styles.heroMetaRow}>
                {heroPreview.primaryLifts.length > 0 && (
                  <View style={styles.heroMetaChip}>
                    <Text style={styles.heroMetaChipText}>{heroPreview.primaryLifts.join(' • ')}</Text>
                  </View>
                )}
                <View style={styles.heroMetaStatRow}>
                  <Text style={styles.heroMetaStat}>{heroPreview.coreCount} core</Text>
                  <Text style={styles.heroMetaDivider}>•</Text>
                  <Text style={styles.heroMetaStat}>{heroPreview.accessoryCount} accessories</Text>
                </View>
              </View>
            ) : null}

            {hero?.type !== 'rest_day' && activeHeroSession ? (
              <Pressable
                style={({ pressed }) => [
                  styles.heroCta,
                  { backgroundColor: heroAccent(hero?.type) },
                  pressed && styles.heroCtaPressed,
                ]}
                onPress={() => openWorkout(activeHeroSession.id)}
              >
                <Text style={styles.heroCtaText}>{heroCtaLabel(hero?.type, hero?.cta)}</Text>
              </Pressable>
            ) : (
              null
            )}
          </View>

          <View style={[styles.card, styles.readinessCard]}>
            <View style={styles.readinessHeaderRow}>
              <View style={styles.readinessTitleRow}>
                <View style={styles.readinessIconWrap}>
                  <Ionicons name="flash" size={22} color="#7DD3C7" />
                </View>
                <ThemedText variant="h3" style={styles.cardTitle}>Readiness</ThemedText>
              </View>
              <Text style={styles.readinessHeaderMeta}>7 day rolling</Text>
            </View>

            <View style={styles.readinessCompactRow}>
              <View style={styles.readinessScoreBlock}>
                <Text style={styles.readinessMainValue}>{formatReadinessValue(readinessComposite7d)}</Text>
                <Text
                  style={[
                    styles.readinessTrendGlyph,
                    readinessDirection === 'up' && styles.readinessTrendGlyphUp,
                    readinessDirection === 'down' && styles.readinessTrendGlyphDown,
                    readinessDirection === 'flat' && styles.readinessTrendGlyphFlat,
                  ]}
                >
                  {readinessDirection === 'up' ? '↑' : readinessDirection === 'down' ? '↓' : ''}
                </Text>
              </View>

              <View style={styles.readinessMetricInlineRow}>
                <Text style={styles.readinessInlineMetric}>Sleep {formatReadinessValue(readinessSleep7d, 1)}</Text>
                <Text style={styles.readinessInlineDivider}>|</Text>
                <Text style={styles.readinessInlineMetric}>Energy {formatReadinessValue(readinessEnergy7d, 1)}</Text>
                <Text style={styles.readinessInlineDivider}>|</Text>
                <Text style={styles.readinessInlineMetric}>Soreness {formatReadinessValue(readinessSoreness7d, 1)}</Text>
                <Text style={styles.readinessInlineDivider}>|</Text>
                <Text style={styles.readinessInlineMetric}>Stress {formatReadinessValue(readinessStress7d, 1)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.readinessTitleRow}>
                <View style={styles.consistencyIconWrap}>
                  <Ionicons name="flame" size={22} color="#F59E0B" />
                </View>
                <ThemedText variant="h3" style={styles.cardTitle}>Consistency</ThemedText>
              </View>
              <View style={styles.streakPill}>
                <Text style={styles.streakPillText}>{streakSessions} session streak</Text>
              </View>
            </View>
            <View style={styles.consistencySummaryRow}>
              <ThemedText variant="h2" style={styles.consistencyMain}>
                {weekAssigned > 0 ? `${weekLogged} of ${weekAssigned}` : '0 of 0'}
              </ThemedText>
              <ThemedText variant="bodyMuted" style={styles.consistencySummaryText}>
                sessions completed this week
              </ThemedText>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${weekProgress * 100}%` }]} />
            </View>
            <View style={styles.weekRow}>
              {weekBlips.map((day) => {
                const tone = day.hasSession ? statusTone(day.status) : null;
                return (
                  <View key={day.key} style={styles.weekDayCol}>
                    <View
                      style={[
                        styles.weekDot,
                        day.hasSession
                          ? { backgroundColor: tone?.text, opacity: 1 }
                          : styles.weekDotMuted,
                      ]}
                    />
                    <Text style={styles.weekDayLabel}>{day.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {hasStrengthData && (
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.readinessTitleRow}>
                <View style={styles.strengthIconWrap}>
                  <Ionicons name="barbell" size={22} color="#38BDF8" />
                </View>
                <ThemedText variant="h3" style={styles.cardTitle}>Strength Progress</ThemedText>
              </View>
              <Pressable
                onPress={() => setTrendUnit((prev) => (prev === 'kg' ? 'lbs' : 'kg'))}
                style={({ pressed }) => [styles.unitToggle, pressed && styles.unitTogglePressed]}
              >
                <Text style={styles.unitToggleText}>{trendUnit.toUpperCase()}</Text>
              </Pressable>
            </View>

            <View style={styles.metricGrid}>
              {summaryBuckets.map((bucket) => {
                const current = bucket.summary?.current_e1rm_kg;
                const delta = bucket.summary?.delta_kg;
                const isActive = activeTrendBucket?.key === bucket.key;
                return (
                  <Pressable
                    key={bucket.key}
                    onPress={() => setActiveTrendKey(bucket.key as 'squat' | 'bench' | 'deadlift')}
                    style={({ pressed }) => [
                      styles.metricMiniCard,
                      isActive && styles.metricMiniCardActive,
                      pressed && styles.metricMiniCardPressed,
                    ]}
                  >
                    <View style={[styles.metricMiniSwatch, { backgroundColor: bucket.color }]} />
                    <Text style={[styles.metricMiniTitle, isActive && styles.metricMiniTitleActive]}>{bucket.label}</Text>
                    <Text style={styles.metricMiniValue}>{formatWeight(current)}</Text>
                    <Text
                      style={[
                        styles.metricMiniDelta,
                        delta != null && delta > 0 && styles.metricMiniDeltaUp,
                        delta != null && delta < 0 && styles.metricMiniDeltaDown,
                      ]}
                    >
                      {delta == null ? '—' : `${delta > 0 ? '+' : ''}${formatWeight(delta)} ${trendUnit}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {activeTrendBucket && trendPoints.length > 0 && (
              <View
                style={styles.chartCard}
                onLayout={(e) => {
                  const nextWidth = Math.floor(e.nativeEvent.layout.width);
                  if (nextWidth > 0 && nextWidth !== trendChartWidth) {
                    setTrendChartWidth(nextWidth);
                  }
                }}
              >
                <View style={styles.chartHeaderInline}>
                  <Text style={styles.chartLiftTitle}>{activeTrendBucket.label}</Text>
                  <Text style={styles.chartLiftValue}>{formatWeight(activeTrendBucket.summary?.current_e1rm_kg)} {trendUnit}</Text>
                </View>
                <Svg width={chartWidth} height={chartHeight}>
                  {yTickValues.map((tick) => {
                    const y = yForValue(tick);
                    return (
                      <React.Fragment key={`tick-${tick}`}>
                        <Line
                          x1={chartPaddingLeft}
                          y1={y}
                          x2={chartWidth - chartPaddingRight}
                          y2={y}
                          stroke="rgba(148,163,184,0.12)"
                          strokeWidth="1"
                        />
                        <SvgText
                          x={chartPaddingLeft - 6}
                          y={y + 4}
                          fontSize="10"
                          fill="#94A3B8"
                          textAnchor="end"
                        >
                          {String(Math.round(tick))}
                        </SvgText>
                      </React.Fragment>
                    );
                  })}
                  <Line
                    x1={chartPaddingLeft}
                    y1={chartPaddingTop}
                    x2={chartPaddingLeft}
                    y2={chartHeight - chartPaddingBottom}
                    stroke="rgba(148,163,184,0.24)"
                    strokeWidth="1"
                  />
                  <Line
                    x1={chartPaddingLeft}
                    y1={chartHeight - chartPaddingBottom}
                    x2={chartWidth - chartPaddingRight}
                    y2={chartHeight - chartPaddingBottom}
                    stroke="rgba(148,163,184,0.24)"
                    strokeWidth="1"
                  />
                  <Polyline
                    points={trendPoints
                      .map((p) => `${xForDate(p.date)},${yForValue(convertWeight(p.e1rm_kg) ?? 0)}`)
                      .join(' ')}
                    fill="none"
                    stroke={activeTrendBucket.color}
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {trendPoints.map((p, idx) => {
                    const isLatest = idx === trendPoints.length - 1;
                    return (
                      <Circle
                        key={`${activeTrendBucket.key}-${p.date}`}
                        cx={xForDate(p.date)}
                        cy={yForValue(convertWeight(p.e1rm_kg) ?? 0)}
                        r={isLatest ? 4.5 : 3}
                        fill={isLatest ? '#F8FAFC' : activeTrendBucket.color}
                        stroke={activeTrendBucket.color}
                        strokeWidth="2"
                      />
                    );
                  })}
                </Svg>
                <View style={styles.chartFooterRow}>
                  {trendDateKeys.map((dateKey) => (
                    <Text
                      key={`label-${dateKey}`}
                      style={[
                        styles.chartFooterText,
                        { left: xForDate(dateKey) - 18 },
                      ]}
                    >
                      {formatShortDate(dateKey)}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
          )}

          {hasMissedSessions && (
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.readinessTitleRow}>
                  <View style={styles.missedSessionsIconWrap}>
                    <Ionicons name="warning" size={22} color="#F87171" />
                  </View>
                  <ThemedText variant="h3" style={styles.cardTitle}>Missed Sessions</ThemedText>
                </View>
              </View>
              {missedSessions.map((session, idx) => {
                const preview = workoutPreview(session);
                const tone = statusTone('missed');
                return (
                  <Pressable
                    key={`missed-${session.id}`}
                    style={({ pressed }) => [
                      styles.recentRow,
                      idx > 0 && styles.recentRowBorder,
                      pressed && styles.recentRowPressed,
                    ]}
                    onPress={() => openWorkout(session.id)}
                  >
                    <View style={styles.recentRowLeft}>
                      <View style={[styles.recentAvatar, { backgroundColor: tone.bg, borderColor: tone.border }]}> 
                        <Text style={[styles.recentAvatarText, { color: tone.text }]}>!
                        </Text>
                      </View>
                      <View style={styles.recentMetaCol}>
                        <Text style={styles.recentTitle}>{session.label}</Text>
                        <Text style={styles.recentSubtitle}>{formatLongDate(session.date)}</Text>
                        {preview?.summary ? <Text style={styles.recentSummary}>{preview.summary}</Text> : null}
                      </View>
                    </View>
                    <View style={styles.recentRowRight}>
                      <View style={[styles.statusPillSmall, { backgroundColor: tone.bg, borderColor: tone.border }]}> 
                        <Text style={[styles.statusPillSmallText, { color: tone.text }]}>Missed</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.readinessTitleRow}>
                <View style={styles.recentSessionsIconWrap}>
                  <Ionicons name="time" size={22} color="#94A3B8" />
                </View>
                <ThemedText variant="h3" style={styles.cardTitle}>Recent Sessions</ThemedText>
              </View>
            </View>
            {(data.recent_sessions || []).length > 0 ? (
              (data.recent_sessions || [])
                .filter((session) => {
                  const s = String(session.status || '').toLowerCase();
                  return s === 'completed' || s === 'done' || s === 'logged';
                })
                .slice(0, 3)
                .map((session, idx) => {
                const preview = workoutPreview(session);
                const tone = statusTone(session.status);
                return (
                  <Pressable
                    key={`recent-${session.id}`}
                    style={({ pressed }) => [
                      styles.recentRow,
                      idx > 0 && styles.recentRowBorder,
                      pressed && styles.recentRowPressed,
                    ]}
                    onPress={() => openWorkout(session.id)}
                  >
                    <View style={styles.recentRowLeft}>
                      <View style={[styles.recentAvatar, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <Text style={[styles.recentAvatarText, { color: tone.text }]}>
                          {(session.label || 'S').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.recentMetaCol}>
                        <Text style={styles.recentTitle}>{session.label}</Text>
                        <Text style={styles.recentSubtitle}>{formatLongDate(session.date)}</Text>
                        {preview?.summary ? <Text style={styles.recentSummary}>{preview.summary}</Text> : null}
                      </View>
                    </View>
                    <View style={styles.recentRowRight}>
                      <View style={[styles.statusPillSmall, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                        <Text style={[styles.statusPillSmallText, { color: tone.text }]}>{statusLabel(session.status)}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <ThemedText variant="bodyMuted" style={styles.emptyText}>No recent sessions yet.</ThemedText>
            )}
          </View>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  screen: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: 0,
  },
  screenCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
    gap: 10,
  },
  scroll: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 104,
  },
  loadingText: {
    color: '#94A3B8',
  },
  header: {
    width: '100%',
    marginBottom: 16,
    paddingTop: 4,
  },
  headerIdentityRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109,91,208,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(109,91,208,0.24)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  headerAvatarText: {
    color: '#E9E5FF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#94A3B8',
  },
  meetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(124,108,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.34)',
    marginBottom: 12,
    shadowColor: '#7C6CFF',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  meetBannerIcon: {
    marginRight: 8,
  },
  meetBannerText: {
    color: '#E9E3FF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  heroCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(10,18,40,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',

    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    color: '#94A3B8',
    marginBottom: 6,
  },
  heroWorkoutTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.6,
  },
  heroDate: {
    marginTop: 4,
    fontSize: 13,
    color: '#94A3B8',
  },
  heroMetaRow: {
    marginTop: 14,
    gap: 10,
  },
  heroMetaChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
  },
  heroMetaChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  heroMetaStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaStat: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
  },
  heroMetaDivider: {
    color: '#64748B',
    fontSize: 13,
  },
  heroCta: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    shadowColor: '#5B4FCF',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  heroCtaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  heroCtaText: {
    color: '#F5F3FF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  restDayCard: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  restDayText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: 'rgba(8,16,38,0.92)',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',

    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E5E7EB',
    letterSpacing: -0.2,
  },
  streakPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(109,91,208,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(109,91,208,0.22)',
  },
  streakPillText: {
    color: '#C7BEE8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  consistencyIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  strengthIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  recentSessionsIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#94A3B8',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  missedSessionsIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F87171',
    shadowOpacity: 0.14,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  readinessCard: {
    paddingTop: 14,
    paddingBottom: 14,
  },
  readinessHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  readinessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readinessIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7DD3C7',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  readinessHeaderMeta: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  readinessCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  readinessScoreBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 42,
    flexShrink: 0,
  },
  readinessMainValue: {
    color: '#F8FAFC',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  readinessTrendGlyph: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 1,
  },
  readinessTrendGlyphUp: {
    color: '#4ADE80',
  },
  readinessTrendGlyphDown: {
    color: '#F87171',
  },
  readinessTrendGlyphFlat: {
    color: 'transparent',
  },
  readinessMetricInlineRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 6,
    minWidth: 0,
  },
  readinessInlineMetric: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  readinessInlineDivider: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
  },
  consistencyMain: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.8,
  },
  consistencySummaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  consistencySummaryText: {
    color: '#94A3B8',
    fontSize: 15,
  },
  consistencySub: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.10)',
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#5B4FCF',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  weekDayCol: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  weekDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  weekDotMuted: {
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  weekDayLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricMiniCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  metricMiniCardActive: {
    borderColor: 'rgba(199,190,232,0.42)',
    backgroundColor: 'rgba(30,41,59,0.86)',
  },
  metricMiniCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  metricMiniSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  metricMiniTitle: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  metricMiniTitleActive: {
    color: '#F8FAFC',
  },
  metricMiniValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  metricMiniDelta: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  metricMiniDeltaUp: {
    color: '#4ADE80',
  },
  metricMiniDeltaDown: {
    color: '#F87171',
  },
  chartCard: {
    paddingTop: 4,
  },
  chartHeaderInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartLiftTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  chartLiftValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  chartFooterRow: {
    position: 'relative',
    height: 18,
    marginTop: 4,
  },
  chartFooterText: {
    position: 'absolute',
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8',
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  recentRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.08)',
  },
  recentRowPressed: {
    opacity: 0.9,
  },
  recentRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  recentAvatarText: {
    fontSize: 13,
    fontWeight: '800',
  },
  recentMetaCol: {
    flex: 1,
    minWidth: 0,
  },
  recentTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  recentSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  recentSummary: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  recentRowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statusPillSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillSmallText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.75,
  },
  unitToggle: {
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  unitTogglePressed: {
    opacity: 0.86,
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E5E7EB',
    letterSpacing: 0.4,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  patchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  patchModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 22,
    backgroundColor: 'rgba(10,18,40,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  patchModalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,108,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.24)',
    marginBottom: 14,
  },
  patchModalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  patchModalBody: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  patchModalSubtext: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  patchModalButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B4FCF',
  },
  patchModalButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  patchModalButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});