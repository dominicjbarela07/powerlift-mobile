import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';
import { fetchJson } from '@/lib/api';

type ProgressionRange = '30d' | '90d' | '180d' | '1y' | 'all';
type Trend = 'up' | 'steady' | 'down' | 'insufficient_data' | string;

type ArcPoint = {
  date?: string | null;
  value_kg?: number | null;
};

type BigThreeLift = {
  key: 'squat' | 'bench' | 'deadlift';
  label?: string | null;
  current_e1rm_kg?: number | null;
  best_e1rm_kg?: number | null;
  change_kg?: number | null;
  change_pct?: number | null;
  trend?: Trend | null;
  points?: ArcPoint[];
};

type ProgressionPayload = {
  athlete?: {
    id?: number | null;
    name?: string | null;
    preferred_units?: string | null;
  } | null;
  range?: {
    start_date?: string | null;
    end_date?: string | null;
    label?: string | null;
  } | null;
  strength_story?: {
    title?: string | null;
    body?: string | null;
    confidence?: 'low' | 'medium' | 'high' | string | null;
    primary_lift?: string | null;
  } | null;
  big_three_arc?: {
    lifts?: BigThreeLift[];
    estimated_total_kg?: number | null;
    estimated_total_change_kg?: number | null;
  } | null;
  recent_wins?: StoryItem[];
  consistency?: {
    sessions_assigned?: number | null;
    sessions_completed?: number | null;
    missed_or_incomplete?: number | null;
    completion_rate_pct?: number | null;
    current_streak?: number | null;
    best_streak?: number | null;
    weeks?: Array<{
      week_start?: string | null;
      completed?: number | null;
      assigned?: number | null;
      missed?: number | null;
    }>;
  } | null;
  milestones?: StoryItem[];
  readiness?: {
    average?: number | null;
    trend?: Trend | null;
    points?: Array<{ date?: string | null; score?: number | null }>;
    context_line?: string | null;
  } | null;
  bodyweight?: {
    current_kg?: number | null;
    recent_points?: Array<{ date?: string | null; bodyweight_kg?: number | null }>;
    context_line?: string | null;
  } | null;
};

type StoryItem = {
  id?: string | number | null;
  kind?: string | null;
  title?: string | null;
  body?: string | null;
  date?: string | null;
  route?: string | null;
};

const RANGE_OPTIONS: Array<{ key: ProgressionRange; label: string }> = [
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '180d', label: '180d' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'All' },
];

const PROGRESSION_UNIT_KEY = 'strength-ledger.progression.unit';

const colors = {
  text: '#ECE5DA',
  textStrong: '#F9FAFB',
  muted: '#B8ACA1',
  subtle: '#82766D',
  line: 'rgba(222, 198, 166, 0.10)',
  lineSoft: 'rgba(222, 198, 166, 0.06)',
  surface: 'rgba(20, 14, 13, 0.28)',
  surfaceStrong: 'rgba(26, 17, 16, 0.48)',
  violet: SLColors.accentViolet,
  violetSoft: 'rgba(167, 139, 250, 0.18)',
  plum: 'rgba(77, 39, 63, 0.26)',
  amber: '#D6A75E',
  green: '#A7CBB5',
  red: '#E88989',
};

export default function AthleteProgressionScreen() {
  const [range, setRange] = useState<ProgressionRange>('90d');
  const [unit, setUnit] = useState<DisplayUnit>('kg');
  const [unitPreferenceLoaded, setUnitPreferenceLoaded] = useState(false);
  const [hasStoredUnitPreference, setHasStoredUnitPreference] = useState(false);
  const [payload, setPayload] = useState<ProgressionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProgression = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const resp = await fetchJson(`/athletes/mobile/progression?range=${encodeURIComponent(range)}`, { method: 'GET' });
      const json = resp.json as { ok?: boolean; progression?: ProgressionPayload; error?: string } | null;
      if (!resp.ok || !json?.ok) {
        setPayload(null);
        setError(json?.error || `Progression could not load. (${resp.status})`);
        return;
      }
      setPayload(json.progression || null);
    } catch (err: any) {
      setPayload(null);
      setError(err?.message || 'Progression could not load.');
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadProgression();
  }, [loadProgression]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PROGRESSION_UNIT_KEY)
      .then((stored) => {
        if (!alive) return;
        const normalized = normalizeUnit(stored);
        if (stored) {
          setUnit(normalized);
          setHasStoredUnitPreference(true);
        }
      })
      .catch(() => {
        // Best-effort preference load. The screen remains fully usable without it.
      })
      .finally(() => {
        if (alive) setUnitPreferenceLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!unitPreferenceLoaded || hasStoredUnitPreference) return;
    setUnit(normalizeUnit(payload?.athlete?.preferred_units));
  }, [hasStoredUnitPreference, payload?.athlete?.preferred_units, unitPreferenceLoaded]);

  const changeUnit = useCallback((next: DisplayUnit) => {
    setUnit(next);
    setHasStoredUnitPreference(true);
    AsyncStorage.setItem(PROGRESSION_UNIT_KEY, next).catch(() => {
      // Preference persistence is non-critical.
    });
  }, []);

  if (loading && !refreshing && !payload) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.violet} />
        <Text style={styles.stateTitle}>Loading Progression</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProgression({ silent: true })} tintColor={colors.violet} />}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Progression</Text>
          <Text style={styles.rangeCopy}>{payload?.range?.label || 'Training story'}</Text>
        </View>
        <ProgressionControls
          range={range}
          onRangeChange={setRange}
          unit={unit}
          onUnitChange={changeUnit}
        />
      </View>

      {error ? (
        <View style={styles.stateLine}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
          <Text style={styles.stateBody}>{error}</Text>
        </View>
      ) : null}

      <StrengthStory story={payload?.strength_story} unit={unit} />
      <BigThreeArc arc={payload?.big_three_arc} unit={unit} />
      <EstimatedTotal arc={payload?.big_three_arc} unit={unit} />
      <RecentWins wins={payload?.recent_wins || []} unit={unit} />
      <ConsistencyThread consistency={payload?.consistency} />
      <MilestoneTimeline milestones={payload?.milestones || []} unit={unit} />
      <ContextRows readiness={payload?.readiness || null} bodyweight={payload?.bodyweight || null} unit={unit} />
    </ScrollView>
  );
}

function ProgressionControls({
  range,
  onRangeChange,
  unit,
  onUnitChange,
}: {
  range: ProgressionRange;
  onRangeChange: (next: ProgressionRange) => void;
  unit: DisplayUnit;
  onUnitChange: (next: DisplayUnit) => void;
}) {
  return (
    <View style={styles.controlRail}>
      <View style={styles.rangeRail}>
        {RANGE_OPTIONS.map((option) => {
          const active = option.key === range;
          return (
            <Pressable
              key={option.key}
              onPress={() => onRangeChange(option.key)}
              style={({ pressed }) => [
                styles.rangeOption,
                active && styles.rangeOptionActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.rangeOptionText, active && styles.rangeOptionTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.unitRail}>
        {(['kg', 'lb'] as const).map((option) => {
          const active = unit === option;
          return (
            <Pressable
              key={option}
              onPress={() => onUnitChange(option)}
              style={({ pressed }) => [
                styles.unitOption,
                active && styles.unitOptionActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.unitOptionText, active && styles.unitOptionTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function StrengthStory({ story, unit }: { story?: ProgressionPayload['strength_story']; unit: DisplayUnit }) {
  const title = story?.title || 'Your story is just getting started.';
  const body = story?.body || 'Keep logging sessions and your progression story will build here.';
  return (
    <View style={styles.storyAnchor}>
      <View style={styles.storyRail} />
      <View style={styles.storyCopy}>
        <Text style={styles.zoneKicker}>Strength Story</Text>
        <Text style={styles.storyTitle}>{title}</Text>
        <Text style={styles.storyBody}>{convertKgText(body, unit)}</Text>
      </View>
    </View>
  );
}

function BigThreeArc({ arc, unit }: { arc?: ProgressionPayload['big_three_arc']; unit: DisplayUnit }) {
  const lifts = normalizeBigThreeLifts(arc?.lifts || []);
  return (
    <View style={styles.zone}>
      <View style={styles.zoneHeader}>
        <Text style={styles.zoneKicker}>Big Three Arc</Text>
        <Text style={styles.zoneHint}>e1RM markers</Text>
      </View>
      <View style={styles.liftLanes}>
        {lifts.map((lift) => (
          <View key={lift.key} style={styles.liftLane}>
            <View style={styles.liftLaneHeader}>
              <View>
                <Text style={styles.liftName}>{lift.label || liftLabel(lift.key)}</Text>
                <Text style={[styles.trendLabel, { color: trendColor(lift.trend) }]}>{trendLabel(lift.trend)}</Text>
              </View>
              <Sparkline points={lift.points || []} trend={lift.trend} />
            </View>
            <View style={styles.liftStats}>
              <MetricLine label="Current" value={formatWeight(lift.current_e1rm_kg, unit)} />
              <MetricLine label="Best" value={formatWeight(lift.best_e1rm_kg, unit)} />
              <MetricLine label="Change" value={formatDelta(lift.change_kg, unit)} tone={deltaTone(lift.change_kg)} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function EstimatedTotal({ arc, unit }: { arc?: ProgressionPayload['big_three_arc']; unit: DisplayUnit }) {
  if (arc?.estimated_total_kg == null) return null;
  const delta = arc.estimated_total_change_kg;
  return (
    <View style={styles.totalLine}>
      <View style={styles.totalRail} />
      <Text style={styles.totalText}>
        Estimated total: <Text style={styles.totalStrong}>{formatWeight(arc.estimated_total_kg, unit)}</Text>
        {delta != null ? <Text style={[styles.totalDelta, { color: deltaTone(delta) }]}> · {formatDelta(delta, unit)}</Text> : null}
      </Text>
    </View>
  );
}

function RecentWins({ wins, unit }: { wins: StoryItem[]; unit: DisplayUnit }) {
  return (
    <View style={styles.zone}>
      <Text style={styles.zoneKicker}>Recent Wins</Text>
      <View style={styles.storyRows}>
        {wins.length ? wins.slice(0, 6).map((win, index) => (
          <StoryRow key={`${win.id || win.date || 'win'}-${index}`} item={win} tone={colors.green} unit={unit} />
        )) : (
          <Text style={styles.emptyLine}>Wins appear as training history builds.</Text>
        )}
      </View>
    </View>
  );
}

function ConsistencyThread({ consistency }: { consistency?: ProgressionPayload['consistency'] }) {
  const assigned = Number(consistency?.sessions_assigned || 0);
  const completed = Number(consistency?.sessions_completed || 0);
  const completionRate = consistency?.completion_rate_pct;
  return (
    <View style={styles.zone}>
      <View style={styles.zoneHeader}>
        <Text style={styles.zoneKicker}>Consistency Thread</Text>
        <Text style={styles.zoneHint}>
          {assigned ? `${completed} of ${assigned} sessions` : 'Story building'}
        </Text>
      </View>
      <Text style={styles.contextBody}>
        {assigned
          ? `${formatPercent(completionRate)} complete · ${Number(consistency?.current_streak || 0)} session streak`
          : 'Complete sessions and your weekly rhythm will show here.'}
      </Text>
      <View style={styles.weekStrip}>
        {(consistency?.weeks || []).slice(-8).map((week, index) => {
          const weekAssigned = Number(week.assigned || 0);
          const weekCompleted = Number(week.completed || 0);
          const pct = weekAssigned > 0 ? Math.max(0.08, Math.min(1, weekCompleted / weekAssigned)) : 0.08;
          return (
            <View key={`${week.week_start || 'week'}-${index}`} style={styles.weekColumn}>
              <View style={styles.weekTrack}>
                <View style={[styles.weekFill, { height: `${pct * 100}%`, backgroundColor: weekCompleted >= weekAssigned && weekAssigned > 0 ? colors.green : colors.amber }]} />
              </View>
              <Text style={styles.weekLabel}>{formatShortWeek(week.week_start)}</Text>
            </View>
          );
        })}
        {!(consistency?.weeks || []).length ? <View style={styles.weekPlaceholder} /> : null}
      </View>
    </View>
  );
}

function MilestoneTimeline({ milestones, unit }: { milestones: StoryItem[]; unit: DisplayUnit }) {
  return (
    <View style={styles.zone}>
      <Text style={styles.zoneKicker}>Milestones</Text>
      <View style={styles.timeline}>
        {milestones.length ? milestones.slice(0, 12).map((milestone, index) => (
          <StoryRow key={`${milestone.id || milestone.date || 'milestone'}-${index}`} item={milestone} tone={colors.violet} timeline unit={unit} />
        )) : (
          <Text style={styles.emptyLine}>Milestones will appear as your training history grows.</Text>
        )}
      </View>
    </View>
  );
}

function ContextRows({
  readiness,
  bodyweight,
  unit,
}: {
  readiness: ProgressionPayload['readiness'];
  bodyweight: ProgressionPayload['bodyweight'];
  unit: DisplayUnit;
}) {
  if (!readiness && !bodyweight) return null;
  return (
    <View style={styles.zone}>
      <Text style={styles.zoneKicker}>Training Context</Text>
      {readiness ? (
        <View style={styles.contextRow}>
          <View style={[styles.rowRail, { backgroundColor: colors.violet }]} />
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Readiness</Text>
            <Text style={styles.rowMeta}>{readiness.context_line || `Average ${formatDecimal(readiness.average)}`}</Text>
          </View>
        </View>
      ) : null}
      {bodyweight ? (
        <View style={styles.contextRow}>
          <View style={[styles.rowRail, { backgroundColor: colors.amber }]} />
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Bodyweight</Text>
            <Text style={styles.rowMeta}>
              {bodyweight.current_kg != null
                ? `Current ${formatWeight(bodyweight.current_kg, unit)}`
                : convertKgText(bodyweight.context_line || 'Context building', unit)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MetricLine({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metricLine}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function StoryRow({ item, tone, timeline, unit }: { item: StoryItem; tone: string; timeline?: boolean; unit: DisplayUnit }) {
  return (
    <View style={styles.storyRow}>
      <View style={styles.timelineDate}>
        <Text style={styles.timelineMonth}>{formatMonth(item.date)}</Text>
        <Text style={styles.timelineDay}>{formatDayNumber(item.date)}</Text>
      </View>
      <View style={[timeline ? styles.timelineRail : styles.rowRail, { backgroundColor: tone }]} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{item.title || 'Training marker'}</Text>
        {item.body ? <Text style={styles.rowMeta}>{convertKgText(item.body, unit)}</Text> : null}
      </View>
    </View>
  );
}

function Sparkline({ points, trend }: { points: ArcPoint[]; trend?: Trend | null }) {
  const values = points.map((point) => Number(point.value_kg)).filter((value) => Number.isFinite(value));
  if (values.length < 2) {
    return (
      <View style={styles.sparklineEmpty}>
        <View style={styles.sparklineBaseline} />
      </View>
    );
  }

  const width = 86;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const path = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / spread) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(' ');
  const last = path.split(' ').pop()?.split(',').map(Number) || [width, height / 2];

  return (
    <Svg width={width} height={height}>
      <Polyline points={path} fill="none" stroke={trendColor(trend)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.82} />
      <Circle cx={last[0]} cy={last[1]} r={2.8} fill={trendColor(trend)} opacity={0.95} />
    </Svg>
  );
}

type DisplayUnit = 'kg' | 'lb';

function normalizeUnit(value?: string | null): DisplayUnit {
  const lower = String(value || '').toLowerCase();
  return lower.startsWith('lb') ? 'lb' : 'kg';
}

function formatWeight(valueKg?: number | null, unit: DisplayUnit = 'kg') {
  if (valueKg == null || !Number.isFinite(Number(valueKg))) return 'Building';
  const value = unit === 'lb' ? Number(valueKg) * 2.2046226218 : Number(valueKg);
  return `${roundWeight(value)} ${unit}`;
}

function formatDelta(valueKg?: number | null, unit: DisplayUnit = 'kg') {
  if (valueKg == null || !Number.isFinite(Number(valueKg))) return 'Building';
  const value = unit === 'lb' ? Number(valueKg) * 2.2046226218 : Number(valueKg);
  const sign = value > 0 ? '+' : '';
  return `${sign}${roundWeight(value)} ${unit}`;
}

function roundWeight(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function convertKgText(value: string | null | undefined, unit: DisplayUnit) {
  const text = String(value || '');
  if (!text || !/\bkg\b/i.test(text)) return text;
  return text.replace(/(-?\d+(?:\.\d+)?)\s*kg\b/gi, (_match, raw) => {
    const kg = Number(raw);
    if (!Number.isFinite(kg)) return _match;
    return formatWeight(kg, unit);
  });
}

function normalizeBigThreeLifts(lifts: BigThreeLift[]) {
  const map = new Map(lifts.map((lift) => [lift.key, lift]));
  return (['squat', 'bench', 'deadlift'] as const).map((key) => map.get(key) || { key, label: liftLabel(key), points: [], trend: 'insufficient_data' });
}

function liftLabel(key: string) {
  if (key === 'squat') return 'Squat';
  if (key === 'bench') return 'Bench';
  if (key === 'deadlift') return 'Deadlift';
  return key;
}

function trendLabel(trend?: Trend | null) {
  if (trend === 'up') return 'Trending up';
  if (trend === 'down') return 'Recent dip';
  if (trend === 'steady') return 'Holding steady';
  return 'Story building';
}

function trendColor(trend?: Trend | null) {
  if (trend === 'up') return colors.green;
  if (trend === 'down') return colors.red;
  if (trend === 'steady') return colors.amber;
  return colors.subtle;
}

function deltaTone(value?: number | null) {
  if (value == null || Math.abs(Number(value)) < 0.1) return colors.muted;
  return Number(value) > 0 ? colors.green : colors.red;
}

function formatPercent(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return '0%';
  return `${Math.round(Number(value))}%`;
}

function formatDecimal(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return 'building';
  return (Math.round(Number(value) * 10) / 10).toFixed(1);
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonth(value?: string | null) {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
}

function formatDayNumber(value?: string | null) {
  const date = parseDate(value);
  if (!date) return '';
  return String(date.getDate());
}

function formatShortWeek(value?: string | null) {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingTop: 12,
    paddingBottom: 28,
    gap: 18,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  stateTitle: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 13,
    color: colors.muted,
  },
  stateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  stateBody: {
    flex: 1,
    fontFamily: SLFontFamilies.sans,
    fontSize: 13,
    color: colors.muted,
  },
  header: {
    gap: 12,
  },
  headerCopy: {
    gap: 2,
  },
  title: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  rangeCopy: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 13,
    color: colors.muted,
  },
  controlRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingVertical: 2,
    paddingHorizontal: 2,
    backgroundColor: 'rgba(22, 14, 14, 0.22)',
  },
  rangeRail: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 4,
  },
  rangeOptionActive: {
    backgroundColor: colors.violetSoft,
  },
  rangeOptionText: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.muted,
    letterSpacing: 0.2,
  },
  rangeOptionTextActive: {
    color: colors.textStrong,
  },
  unitRail: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: colors.lineSoft,
  },
  unitOption: {
    minWidth: 34,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  unitOptionActive: {
    backgroundColor: colors.violetSoft,
  },
  unitOptionText: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.muted,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  unitOptionTextActive: {
    color: colors.textStrong,
  },
  storyAnchor: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 18,
    backgroundColor: colors.plum,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  storyRail: {
    width: 2,
    borderRadius: 999,
    backgroundColor: colors.violet,
    opacity: 0.72,
  },
  storyCopy: {
    flex: 1,
    gap: 7,
  },
  storyTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.textStrong,
    letterSpacing: 0,
  },
  storyBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  zone: {
    gap: 12,
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  zoneKicker: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 11,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.subtle,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  zoneHint: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 12,
    color: colors.subtle,
  },
  liftLanes: {
    gap: 10,
  },
  liftLane: {
    paddingVertical: 13,
    paddingLeft: 12,
    paddingRight: 2,
    backgroundColor: colors.surface,
    borderLeftWidth: 2,
    borderLeftColor: colors.violet,
  },
  liftLaneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  liftName: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 16,
    color: colors.textStrong,
  },
  trendLabel: {
    marginTop: 2,
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: 12,
  },
  liftStats: {
    marginTop: 10,
    gap: 7,
  },
  metricLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    paddingTop: 7,
  },
  metricLabel: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 12,
    color: colors.subtle,
  },
  metricValue: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 13,
    color: colors.text,
  },
  sparklineEmpty: {
    width: 86,
    height: 28,
    justifyContent: 'center',
  },
  sparklineBaseline: {
    height: 1,
    backgroundColor: colors.line,
  },
  totalLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  totalRail: {
    width: 2,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.amber,
    opacity: 0.8,
  },
  totalText: {
    flex: 1,
    fontFamily: SLFontFamilies.sans,
    fontSize: 14,
    color: colors.muted,
  },
  totalStrong: {
    fontFamily: SLFontFamilies.sansBold,
    color: colors.textStrong,
  },
  totalDelta: {
    fontFamily: SLFontFamilies.sansBold,
  },
  storyRows: {
    gap: 10,
  },
  storyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  timeline: {
    gap: 4,
  },
  timelineDate: {
    width: 42,
    alignItems: 'flex-start',
  },
  timelineMonth: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: 9,
    color: colors.subtle,
    letterSpacing: 0.4,
  },
  timelineDay: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 16,
    color: colors.text,
  },
  timelineRail: {
    width: 2,
    alignSelf: 'stretch',
    borderRadius: 999,
    opacity: 0.72,
  },
  rowRail: {
    width: 2,
    alignSelf: 'stretch',
    borderRadius: 999,
    opacity: 0.72,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 14,
    color: colors.textStrong,
  },
  rowMeta: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  emptyLine: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 13,
    color: colors.subtle,
    paddingVertical: 8,
  },
  contextBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  weekStrip: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingTop: 4,
  },
  weekColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  weekTrack: {
    width: '100%',
    maxWidth: 22,
    height: 42,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(236, 229, 218, 0.06)',
    overflow: 'hidden',
  },
  weekFill: {
    width: '100%',
    opacity: 0.72,
  },
  weekLabel: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 10,
    color: colors.subtle,
  },
  weekPlaceholder: {
    flex: 1,
    height: 34,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lineSoft,
  },
  contextRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  pressed: {
    opacity: 0.72,
  },
});
