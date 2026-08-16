import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Redirect } from 'expo-router';

import { SLMotionEntrance, SLMotionPressable } from '@/components/ui';
import { SLColors, SLFontFamilies, SLRadius, SLTypography } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import { kilogramsToDisplayValue } from '@/lib/display-units';

type ProgressionRange = '30d' | '90d' | '180d' | '1y' | 'all';
type DisplayUnit = 'kg' | 'lb';
type MetricKey = 'e1rm' | 'top_weight' | 'avg_rpe' | 'volume' | 'readiness';
type Trend = 'up' | 'steady' | 'down' | 'insufficient_data' | string;

type ArcPoint = {
  date?: string | null;
  value_kg?: number | null;
};

type ChartPoint = {
  date?: string | null;
  value: number;
};

type BigThreeLift = {
  key?: string | null;
  label?: string | null;
  current_e1rm_kg?: number | null;
  best_e1rm_kg?: number | null;
  change_kg?: number | null;
  change_pct?: number | null;
  trend?: Trend | null;
  points?: ArcPoint[];
};

type MetricTrend = {
  points?: Array<{ date?: string | null; value?: number | null; value_kg?: number | null }>;
  summary?: {
    current?: number | null;
    best?: number | null;
    change?: number | null;
  } | null;
  source?: string | null;
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
    completion_rate_pct?: number | null;
    current_streak?: number | null;
  } | null;
  milestones?: StoryItem[];
  readiness?: {
    average?: number | null;
    trend?: Trend | null;
    trend_label?: string | null;
    trend_delta?: string | null;
    points?: Array<{ date?: string | null; score?: number | null }>;
    context_line?: string | null;
  } | null;
  bodyweight?: {
    current_kg?: number | null;
    recent_points?: Array<{ date?: string | null; bodyweight_kg?: number | null }>;
    context_line?: string | null;
  } | null;
  metric_trends?: {
    top_weight?: MetricTrend;
    avg_rpe?: MetricTrend;
    volume?: MetricTrend;
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

type ChartSeries = {
  key: string;
  label: string;
  color: string;
  points: ChartPoint[];
};

const RANGE_OPTIONS: Array<{ key: ProgressionRange; label: string }> = [
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: '180d', label: '180d' },
  { key: '1y', label: '1y' },
  { key: 'all', label: 'All' },
];

const METRICS: Array<{ key: MetricKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'e1rm', label: 'e1RM', icon: 'trending-up-outline' },
  { key: 'top_weight', label: 'Top Weight', icon: 'barbell-outline' },
  { key: 'avg_rpe', label: 'Avg RPE', icon: 'pulse-outline' },
  { key: 'volume', label: 'Volume', icon: 'albums-outline' },
  { key: 'readiness', label: 'Readiness', icon: 'heart-outline' },
];

const PROGRESSION_UNIT_KEY = 'strength-ledger.progression.unit';

const colors = {
  text: SLColors.text,
  textStrong: SLColors.textStrong,
  muted: SLColors.textMuted,
  subtle: SLColors.textSubtle,
  line: SLColors.borderSubtle,
  lineSoft: SLColors.borderHairline,
  surface: SLColors.surfaceEmbedded,
  surfaceStrong: SLColors.focus,
  surfaceLift: SLColors.surfaceRaised,
  violet: SLColors.accentViolet,
  violetStrong: SLColors.accent,
  violetSoft: SLColors.accentVioletSoft,
  cyan: SLColors.info,
  pink: SLColors.danger,
  amber: SLColors.warning,
  green: SLColors.success,
  red: SLColors.danger,
};

export default function LegacyProgressionRoute() {
  return <Redirect href="/(tabs)/ledger/strength" />;
}

function AthleteProgressionScreen() {
  const [range, setRange] = useState<ProgressionRange>('90d');
  const [unit, setUnit] = useState<DisplayUnit>('kg');
  const [metric, setMetric] = useState<MetricKey>('e1rm');
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
      .catch(() => {})
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
    AsyncStorage.setItem(PROGRESSION_UNIT_KEY, next).catch(() => {});
  }, []);

  const chart = useMemo(() => buildChart(payload, metric, unit), [metric, payload, unit]);
  const insight = useMemo(() => buildInsight(payload, metric, unit, range), [metric, payload, range, unit]);

  if (loading && !refreshing && !payload) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={colors.violet} />
        <Text style={styles.stateTitle}>Loading Progress</Text>
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
        <Text typographyRole="pageTitle" style={styles.title}>Progress</Text>
        <Text typographyRole="supportingBody" style={styles.subtitle}>Your training story</Text>
      </View>

      <View style={styles.controlRow}>
        <View style={styles.rangeRail}>
          {RANGE_OPTIONS.map((option) => {
            const active = option.key === range;
            return (
              <SLMotionPressable
                key={option.key}
                onPress={() => setRange(option.key)}
                style={[
                  styles.rangeOption,
                  active && styles.rangeOptionActive,
                ]}
              >
                <Text style={[styles.rangeOptionText, active && styles.rangeOptionTextActive]}>{option.label}</Text>
              </SLMotionPressable>
            );
          })}
        </View>
        <View style={styles.unitRail}>
          {(['kg', 'lb'] as const).map((option) => {
            const active = unit === option;
            return (
              <SLMotionPressable
                key={option}
                onPress={() => changeUnit(option)}
                style={[
                  styles.unitOption,
                  active && styles.unitOptionActive,
                ]}
              >
                <Text style={[styles.unitOptionText, active && styles.unitOptionTextActive]}>{option}</Text>
              </SLMotionPressable>
            );
          })}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricRail}>
        {METRICS.map((option) => {
          const active = option.key === metric;
          return (
            <SLMotionPressable
              key={option.key}
              onPress={() => setMetric(option.key)}
              style={[
                styles.metricCard,
                active && styles.metricCardActive,
              ]}
            >
              <Ionicons name={option.icon} size={22} color={metricColor(option.key)} />
              <Text style={[styles.metricCardLabel, active && styles.metricCardLabelActive]}>{option.label}</Text>
            </SLMotionPressable>
          );
        })}
      </ScrollView>

      {error ? (
        <View style={styles.stateLine}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
          <Text style={styles.stateBody}>{error}</Text>
        </View>
      ) : null}

      <SLMotionEntrance motionKey={`${metric}-${range}-${unit}`} distance={6}>
        <View style={styles.heroCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>{metricTitle(metric)} Trend</Text>
              <Text style={styles.chartSubtitle}>{metricSubtitle(metric, unit)}</Text>
            </View>
            <View style={styles.adjustPill}>
              <Ionicons name="options-outline" size={15} color={colors.text} />
              <Text style={styles.adjustText}>Adjust View</Text>
            </View>
          </View>
          <Legend series={chart.series} />
          <HeroChart series={chart.series} formatValue={chart.formatValue} emptyTitle={chart.emptyTitle} />
        </View>
        <InsightCard insight={insight} />
        <SupportingMetrics payload={payload} selected={metric} unit={unit} />
      </SLMotionEntrance>
      <SLMotionEntrance motionKey={`story-${range}-${unit}`} delay={42} distance={6}>
        <StrengthStory payload={payload} unit={unit} />
        <RecentMilestones milestones={payload?.milestones || []} unit={unit} />
      </SLMotionEntrance>
    </ScrollView>
  );
}

function HeroChart({
  series,
  formatValue,
  emptyTitle,
}: {
  series: ChartSeries[];
  formatValue: (value: number) => string;
  emptyTitle: string;
}) {
  const populated = series.filter((item) => item.points.length >= 2);
  const allValues = populated.flatMap((item) => item.points.map((point) => point.value));
  const allDates = populated.flatMap((item) => item.points.map((point) => point.date || ''));

  if (allValues.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Ionicons name="analytics-outline" size={30} color={colors.violet} />
        <Text style={styles.chartEmptyTitle}>{emptyTitle}</Text>
        <Text style={styles.chartEmptyBody}>Log a few sessions to start building your progress story.</Text>
      </View>
    );
  }

  const width = 330;
  const height = 250;
  const left = 38;
  const right = 12;
  const top = 16;
  const bottom = 34;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const spread = Math.max(1, max - min);
  const yMin = Math.max(0, min - spread * 0.12);
  const yMax = max + spread * 0.12;
  const ySpread = Math.max(1, yMax - yMin);
  const gridValues = [0, 0.5, 1].map((ratio) => yMin + (1 - ratio) * ySpread);

  const pointToCoord = (point: ChartPoint, index: number, count: number) => {
    const x = left + (count <= 1 ? innerWidth / 2 : (index / (count - 1)) * innerWidth);
    const y = top + innerHeight - ((point.value - yMin) / ySpread) * innerHeight;
    return { x, y };
  };

  const firstDate = allDates.filter(Boolean)[0];
  const lastDate = allDates.filter(Boolean).slice(-1)[0];

  return (
    <View style={styles.chartWrap}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {gridValues.map((value, index) => {
          const y = top + (index / 2) * innerHeight;
          return (
            <React.Fragment key={`${value}-${index}`}>
              <Line x1={left} x2={width - right} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="4 4" />
              <Line x1={left} x2={left} y1={top} y2={top + innerHeight} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            </React.Fragment>
          );
        })}
        {populated.map((item) => {
          const path = item.points.map((point, index) => {
            const coord = pointToCoord(point, index, item.points.length);
            return `${coord.x},${coord.y}`;
          }).join(' ');
          return (
            <React.Fragment key={item.key}>
              <Polyline points={path} fill="none" stroke={item.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              {item.points.map((point, index) => {
                const coord = pointToCoord(point, index, item.points.length);
                return <Circle key={`${item.key}-${index}`} cx={coord.x} cy={coord.y} r={4} fill={item.color} />;
              })}
            </React.Fragment>
          );
        })}
      </Svg>
      <View style={styles.yLabels}>
        <Text style={styles.axisLabel}>{formatValue(yMax)}</Text>
        <Text style={styles.axisLabel}>{formatValue((yMin + yMax) / 2)}</Text>
        <Text style={styles.axisLabel}>{formatValue(yMin)}</Text>
      </View>
      <View style={styles.xLabels}>
        <Text style={styles.axisLabel}>{formatChartDate(firstDate)}</Text>
        <Text style={styles.axisLabel}>{formatChartDate(lastDate)}</Text>
      </View>
    </View>
  );
}

function Legend({ series }: { series: ChartSeries[] }) {
  const visible = series.filter((item) => item.points.length);
  if (!visible.length) return null;
  return (
    <View style={styles.legend}>
      {visible.map((item) => (
        <View key={item.key} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={styles.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function InsightCard({ insight }: { insight: string }) {
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightIcon}>
        <Ionicons name="sparkles-outline" size={18} color={colors.amber} />
      </View>
      <View style={styles.insightCopy}>
        <Text style={styles.insightTitle}>Insight</Text>
        <Text style={styles.insightBody}>{insight}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.amber} />
    </View>
  );
}

function SupportingMetrics({ payload, selected, unit }: { payload: ProgressionPayload | null; selected: MetricKey; unit: DisplayUnit }) {
  const cards = buildSupportingMetricCards(payload, selected, unit);
  if (!cards.length) return null;
  return (
    <View style={styles.supportingStack}>
      {cards.map((card) => (
        <View key={card.key} style={styles.supportCard}>
          <View style={[styles.supportIcon, { backgroundColor: card.iconBg }]}>
            <Ionicons name={card.icon} size={18} color={card.color} />
          </View>
          <View style={styles.supportCopy}>
            <Text style={styles.supportLabel}>{card.label}</Text>
            <Text style={styles.supportValue}>{card.value}</Text>
            {card.meta ? <Text style={styles.supportMeta}>{card.meta}</Text> : null}
          </View>
          {card.change ? <Text style={[styles.supportChange, { color: card.changeColor }]}>{card.change}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function StrengthStory({ payload, unit }: { payload: ProgressionPayload | null; unit: DisplayUnit }) {
  const lifts = (payload?.big_three_arc?.lifts || []).filter((lift) => (lift.points || []).length > 0);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Strength Story</Text>
        <Text style={styles.sectionMeta}>{metricRangeLabel(payload?.range?.label)}</Text>
      </View>
      <View style={styles.storyStack}>
        {lifts.length ? lifts.map((lift) => (
          <View key={String(lift.key || lift.label)} style={styles.liftCard}>
            <View style={[styles.liftIcon, { backgroundColor: liftTone(String(lift.key)).bg }]}>
              <Ionicons name={liftIcon(String(lift.key))} size={21} color={liftTone(String(lift.key)).color} />
            </View>
            <View style={styles.liftCardCopy}>
              <Text style={styles.liftName}>{friendlyLiftLabel(lift.label || lift.key || 'Lift')}</Text>
              <View style={styles.liftStatsRow}>
                <MetricColumn label="Current" value={formatWeight(lift.current_e1rm_kg, unit)} tone={liftTone(String(lift.key)).color} />
                <MetricColumn label="Best" value={formatWeight(lift.best_e1rm_kg, unit)} />
                <MetricColumn label="Change" value={formatDelta(lift.change_kg, unit)} tone={deltaTone(lift.change_kg)} />
              </View>
            </View>
            <Sparkline points={(lift.points || []).map((point) => ({ date: point.date, value: unitValue(point.value_kg, unit) })).filter((point) => Number.isFinite(point.value))} color={liftTone(String(lift.key)).color} />
          </View>
        )) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Strength story is building.</Text>
            <Text style={styles.emptyBody}>Logged top sets will appear here as your training history grows.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function RecentMilestones({ milestones, unit }: { milestones: StoryItem[]; unit: DisplayUnit }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Milestones</Text>
        {milestones.length ? <Text style={styles.sectionAction}>View All</Text> : null}
      </View>
      <View style={styles.milestoneCard}>
        {milestones.length ? milestones.slice(0, 4).map((item, index) => (
          <View key={`${item.id || item.date || 'milestone'}-${index}`} style={[styles.milestoneRow, index > 0 && styles.milestoneRowBorder]}>
            <View style={styles.milestoneIcon}>
              <Ionicons name="star-outline" size={19} color={colors.amber} />
            </View>
            <View style={styles.milestoneCopy}>
              <Text style={styles.milestoneTitle}>{item.title || 'Training milestone'}</Text>
              {item.body ? <Text style={styles.milestoneBody}>{convertKgText(item.body, unit)}</Text> : null}
            </View>
            <Text style={styles.milestoneDate}>{formatMilestoneDate(item.date)}</Text>
          </View>
        )) : (
          <View style={styles.emptyMilestone}>
            <Text style={styles.emptyTitle}>Milestones will appear as you log training.</Text>
            <Text style={styles.emptyBody}>New markers, streaks, and completed chapters will live here.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function MetricColumn({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.metricColumn}>
      <Text style={styles.metricColumnLabel}>{label}</Text>
      <Text style={[styles.metricColumnValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function Sparkline({ points, color }: { points: ChartPoint[]; color: string }) {
  if (points.length < 2) {
    return <View style={styles.sparklineEmpty} />;
  }
  const width = 76;
  const height = 34;
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const spread = Math.max(1, max - min);
  const path = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / spread) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  const last = path.split(' ').pop()?.split(',').map(Number) || [width, height / 2];
  return (
    <Svg width={width} height={height}>
      <Polyline points={path} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </Svg>
  );
}

function buildChart(payload: ProgressionPayload | null, metric: MetricKey, unit: DisplayUnit) {
  if (metric === 'e1rm') {
    const lifts = payload?.big_three_arc?.lifts || [];
    const series = lifts.map((lift) => ({
      key: String(lift.key || lift.label || 'lift'),
      label: friendlyLiftLabel(lift.label || lift.key || 'Lift'),
      color: liftTone(String(lift.key)).color,
      points: (lift.points || [])
        .map((point) => ({ date: point.date, value: unitValue(point.value_kg, unit) }))
        .filter((point) => Number.isFinite(point.value)),
    }));
    return {
      series,
      formatValue: (value: number) => `${roundWeight(value)}`,
      emptyTitle: 'No e1RM trend yet.',
    };
  }
  if (metric === 'readiness') {
    return {
      series: [{
        key: 'readiness',
        label: 'Readiness',
        color: colors.amber,
        points: (payload?.readiness?.points || [])
          .map((point) => ({ date: point.date, value: Number(point.score) }))
          .filter((point) => Number.isFinite(point.value)),
      }],
      formatValue: (value: number) => `${Math.round(value * 10) / 10}`,
      emptyTitle: 'No readiness trend yet.',
    };
  }
  const trend = payload?.metric_trends?.[metric];
  const isWeightMetric = metric === 'top_weight' || metric === 'volume';
  return {
    series: [{
      key: metric,
      label: metricTitle(metric),
      color: metricColor(metric),
      points: (trend?.points || [])
        .map((point) => ({
          date: point.date,
          value: isWeightMetric ? unitValue(point.value_kg, unit) : Number(point.value),
        }))
        .filter((point) => Number.isFinite(point.value)),
    }],
    formatValue: (value: number) => isWeightMetric ? `${compactNumber(value)}` : `${Math.round(value * 10) / 10}`,
    emptyTitle: `No ${metricTitle(metric).toLowerCase()} trend yet.`,
  };
}

function buildInsight(payload: ProgressionPayload | null, metric: MetricKey, unit: DisplayUnit, range: ProgressionRange) {
  const rangeLabel = RANGE_OPTIONS.find((item) => item.key === range)?.label || 'this range';
  if (!payload) return 'Log a few sessions and your first trend will appear here.';
  if (metric === 'e1rm') {
    const best = (payload.big_three_arc?.lifts || [])
      .filter((lift) => lift.change_kg != null)
      .sort((a, b) => Number(b.change_kg || 0) - Number(a.change_kg || 0))[0];
    if (best && Number(best.change_kg || 0) > 0) {
      return `Your ${friendlyLiftLabel(best.label || best.key || 'lift').toLowerCase()} e1RM is trending up ${formatWeight(Math.abs(Number(best.change_kg)), unit)} over ${rangeLabel}.`;
    }
    return convertKgText(payload.strength_story?.body || 'Keep logging sessions and your first trend will appear here.', unit);
  }
  if (metric === 'readiness') {
    return payload.readiness?.context_line || 'Log readiness after training and recovery trends will appear here.';
  }
  const trend = payload.metric_trends?.[metric];
  const change = trend?.summary?.change;
  if (change != null && Number.isFinite(Number(change))) {
    const direction = Number(change) >= 0 ? 'up' : 'down';
    const formatted = metric === 'avg_rpe'
      ? `${Math.abs(Number(change)).toFixed(1)}`
      : formatWeight(Math.abs(Number(change)), unit);
    return `${metricTitle(metric)} is ${direction} ${formatted} over ${rangeLabel}.`;
  }
  return `Keep logging sessions and your ${metricTitle(metric).toLowerCase()} trend will appear here.`;
}

function buildSupportingMetricCards(payload: ProgressionPayload | null, selected: MetricKey, unit: DisplayUnit) {
  const cards: Array<{
    key: string;
    label: string;
    value: string;
    meta?: string;
    change?: string;
    changeColor?: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    color: string;
  }> = [];
  const volume = payload?.metric_trends?.volume?.summary;
  if (selected !== 'volume' && volume?.current != null) {
    cards.push({
      key: 'volume',
      label: 'Training Load (Volume)',
      value: formatWeight(volume.current, unit),
      meta: 'Current range',
      change: volume.change != null ? formatDelta(volume.change, unit) : undefined,
      changeColor: deltaTone(volume.change),
      icon: 'albums-outline',
      iconBg: 'rgba(240,106,139,0.14)',
      color: colors.pink,
    });
  }
  if (selected !== 'readiness' && payload?.readiness?.average != null) {
    cards.push({
      key: 'readiness',
      label: 'Readiness Score',
      value: `${formatDecimal(payload.readiness.average)} / 5`,
      meta: 'Average',
      change: payload.readiness.trend_delta || undefined,
      changeColor: trendColor(payload.readiness.trend),
      icon: 'heart-outline',
      iconBg: 'rgba(243,190,85,0.14)',
      color: colors.amber,
    });
  }
  const avgRpe = payload?.metric_trends?.avg_rpe?.summary;
  if (selected !== 'avg_rpe' && avgRpe?.current != null) {
    cards.push({
      key: 'avg_rpe',
      label: 'Average RPE',
      value: formatDecimal(avgRpe.current),
      meta: 'Logged sets',
      change: avgRpe.change != null ? signedDecimal(avgRpe.change) : undefined,
      changeColor: deltaTone(avgRpe.change),
      icon: 'pulse-outline',
      iconBg: 'rgba(85,214,207,0.14)',
      color: colors.cyan,
    });
  }
  return cards.slice(0, 3);
}

function metricTitle(metric: MetricKey) {
  if (metric === 'e1rm') return 'e1RM';
  if (metric === 'top_weight') return 'Top Weight';
  if (metric === 'avg_rpe') return 'Avg RPE';
  if (metric === 'volume') return 'Volume';
  return 'Readiness';
}

function metricSubtitle(metric: MetricKey, unit: DisplayUnit) {
  if (metric === 'e1rm') return `Estimated 1 Rep Max (${unit})`;
  if (metric === 'top_weight') return `Heaviest logged set (${unit})`;
  if (metric === 'avg_rpe') return 'Average logged RPE';
  if (metric === 'volume') return `Logged set volume (${unit})`;
  return 'Readiness score';
}

function metricColor(metric: MetricKey) {
  if (metric === 'top_weight') return colors.text;
  if (metric === 'avg_rpe') return colors.cyan;
  if (metric === 'volume') return colors.pink;
  if (metric === 'readiness') return colors.amber;
  return colors.violetStrong;
}

function liftTone(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.includes('bench')) return { color: colors.cyan, bg: 'rgba(85,214,207,0.14)' };
  if (normalized.includes('dead')) return { color: colors.pink, bg: 'rgba(240,106,139,0.14)' };
  return { color: colors.violetStrong, bg: 'rgba(155,108,255,0.18)' };
}

function liftIcon(key: string): keyof typeof Ionicons.glyphMap {
  const normalized = key.toLowerCase();
  if (normalized.includes('bench')) return 'barbell-outline';
  if (normalized.includes('dead')) return 'body-outline';
  return 'walk-outline';
}

function friendlyLiftLabel(value: string) {
  return simplifyMobileMovementName(value).replace(/^Competition\s+/i, '');
}

function normalizeUnit(value?: string | null): DisplayUnit {
  const lower = String(value || '').toLowerCase();
  return lower.startsWith('kg') ? 'kg' : 'lb';
}

function unitValue(valueKg?: number | null, unit: DisplayUnit = 'lb') {
  if (valueKg == null || !Number.isFinite(Number(valueKg))) return Number.NaN;
  return kilogramsToDisplayValue(Number(valueKg), unit);
}

function formatWeight(valueKg?: number | null, unit: DisplayUnit = 'lb') {
  if (valueKg == null || !Number.isFinite(Number(valueKg))) return 'Building';
  return `${roundWeight(unitValue(valueKg, unit))} ${unit}`;
}

function formatDelta(valueKg?: number | null, unit: DisplayUnit = 'lb') {
  if (valueKg == null || !Number.isFinite(Number(valueKg))) return 'Building';
  const value = unitValue(valueKg, unit);
  const sign = value > 0 ? '+' : '';
  return `${sign}${roundWeight(value)} ${unit}`;
}

function roundWeight(value: number) {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function compactNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`;
  return roundWeight(value);
}

function formatDecimal(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return 'Building';
  return (Math.round(Number(value) * 10) / 10).toFixed(1);
}

function signedDecimal(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return undefined;
  const rounded = Math.round(Number(value) * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`;
}

function deltaTone(value?: number | null) {
  if (value == null || Math.abs(Number(value)) < 0.1) return colors.muted;
  return Number(value) > 0 ? colors.green : colors.red;
}

function trendColor(trend?: Trend | null) {
  if (trend === 'up' || trend === 'improving') return colors.green;
  if (trend === 'down' || trend === 'declining') return colors.red;
  if (trend === 'steady' || trend === 'stable') return colors.amber;
  return colors.muted;
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

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatChartDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMilestoneDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return '';
  const today = new Date();
  const sameDay = today.getFullYear() === date.getFullYear() && today.getMonth() === date.getMonth() && today.getDate() === date.getDate();
  if (sameDay) return 'Today';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function metricRangeLabel(value?: string | null) {
  if (!value) return 'e1RM';
  return value.replace(/^Last\s+/i, '');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
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
    fontSize: SLTypography.label.fontSize,
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
    fontSize: SLTypography.label.fontSize,
    color: colors.muted,
  },
  header: {
    gap: 4,
  },
  title: {
    color: colors.textStrong,
  },
  subtitle: {
    color: colors.muted,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  rangeRail: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.sm,
    overflow: 'hidden',
    backgroundColor: SLColors.surfaceFlat,
  },
  rangeOption: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeOptionActive: {
    backgroundColor: colors.violetStrong,
  },
  rangeOptionText: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.muted,
  },
  rangeOptionTextActive: {
    color: SLColors.textInverted,
  },
  unitRail: {
    flexDirection: 'row',
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.sm,
    overflow: 'hidden',
    backgroundColor: SLColors.surfaceFlat,
  },
  unitOption: {
    minWidth: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitOptionActive: {
    backgroundColor: colors.violetStrong,
  },
  unitOptionText: {
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  unitOptionTextActive: {
    color: SLColors.textInverted,
  },
  metricRail: {
    gap: 8,
    paddingVertical: 4,
  },
  metricCard: {
    width: 82,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.radiusRow,
    backgroundColor: colors.surface,
  },
  metricCardActive: {
    borderColor: SLColors.borderSelected,
    backgroundColor: SLColors.surfaceSelected,
  },
  metricCardLabel: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: SLTypography.caption.fontSize,
    color: colors.muted,
    textAlign: 'center',
  },
  metricCardLabelActive: {
    color: colors.textStrong,
  },
  heroCard: {
    gap: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.radiusCard,
    padding: 18,
    backgroundColor: SLColors.surfaceCommand,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    color: colors.textStrong,
  },
  chartSubtitle: {
    marginTop: 3,
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.label.fontSize,
    color: colors.muted,
  },
  adjustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 34,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: SLRadius.sm,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  adjustText: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.caption.fontSize,
    color: colors.text,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 13,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: SLRadius.pill,
  },
  legendText: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: SLTypography.caption.fontSize,
    color: colors.text,
  },
  chartWrap: {
    position: 'relative',
    minHeight: 276,
  },
  yLabels: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 42,
    justifyContent: 'space-between',
  },
  xLabels: {
    position: 'absolute',
    left: 38,
    right: 12,
    bottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.micro.fontSize,
    color: colors.muted,
  },
  chartEmpty: {
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.md,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  chartEmptyTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.sectionTitle.fontSize,
    color: colors.textStrong,
  },
  chartEmptyBody: {
    maxWidth: 250,
    textAlign: 'center',
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    color: colors.muted,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(243,190,85,0.26)',
    borderRadius: SLRadius.md,
    padding: 15,
    backgroundColor: 'rgba(51, 36, 12, 0.22)',
  },
  insightIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCopy: {
    flex: 1,
    gap: 4,
  },
  insightTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.body.fontSize,
    color: colors.amber,
  },
  insightBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    color: colors.text,
  },
  supportingStack: {
    gap: 8,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.radiusCard,
    padding: 13,
    backgroundColor: colors.surface,
  },
  supportIcon: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCopy: {
    flex: 1,
    gap: 2,
  },
  supportLabel: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.label.fontSize,
    color: colors.text,
  },
  supportValue: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: 20,
    color: colors.textStrong,
  },
  supportMeta: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.micro.fontSize,
    color: colors.muted,
  },
  supportChange: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.label.fontSize,
  },
  section: {
    gap: 10,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    color: colors.textStrong,
  },
  sectionMeta: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: SLTypography.caption.fontSize,
    color: colors.muted,
  },
  sectionAction: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.label.fontSize,
    color: colors.violetStrong,
  },
  storyStack: {
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.radiusCard,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  liftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  liftIcon: {
    width: 44,
    height: 44,
    borderRadius: SLRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liftCardCopy: {
    flex: 1,
    gap: 8,
  },
  liftName: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.cardTitle.fontSize,
    color: colors.textStrong,
  },
  liftStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricColumn: {
    gap: 2,
  },
  metricColumnLabel: {
    fontFamily: SLFontFamilies.sans,
    fontSize: 10,
    color: colors.muted,
  },
  metricColumnValue: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.label.fontSize,
    color: colors.textStrong,
  },
  sparklineEmpty: {
    width: 76,
    height: 34,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  milestoneCard: {
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: SLRadius.radiusCard,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  milestoneRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  milestoneIcon: {
    width: 42,
    height: 42,
    borderRadius: SLRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243,190,85,0.16)',
  },
  milestoneCopy: {
    flex: 1,
    gap: 3,
  },
  milestoneTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.rowTitle.fontSize,
    color: colors.textStrong,
  },
  milestoneBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    color: colors.muted,
  },
  milestoneDate: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.caption.fontSize,
    color: colors.muted,
  },
  emptyCard: {
    padding: 15,
    gap: 5,
  },
  emptyMilestone: {
    padding: 16,
    gap: 5,
  },
  emptyTitle: {
    fontFamily: SLFontFamilies.sansBold,
    fontSize: SLTypography.body.fontSize,
    color: colors.textStrong,
  },
  emptyBody: {
    fontFamily: SLFontFamilies.sans,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    color: colors.muted,
  },
  pressed: {
    opacity: 0.72,
  },
});
