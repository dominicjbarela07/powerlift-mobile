import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { FloatingControlCoordinator, FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import {
  CoachTools,
  PlanCompareExperience,
  type CoachReviewContext,
  type CompletedRecapImpactSummary,
  type CompletedRecapMovement,
  type CompletedSessionRecapPayload,
} from '@/components/coach-mobile/CompletedSessionRecap';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import {
  formatCalculatedWeightFromKg,
  formatCompactVolumeValueFromKg,
  formatWeightFromKg,
  type DisplayWeightUnit,
} from '@/lib/display-units';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';

type ReviewerTab = 'overview' | 'performed' | 'plan' | 'coach';

type AnalyticsMovement = CompletedRecapMovement & {
  previous_best?: Record<string, any> | null;
  comparison?: {
    state?: 'improved' | 'stable' | 'declined' | 'not_comparable';
    literal?: string;
    metric_delta_percent?: number | null;
  };
  trajectory?: { state?: string; label?: string; sample_size?: number };
  confidence?: { state?: string; label?: string; sample_size?: number; scope?: string };
  volume?: {
    current_kg?: number | null;
    previous_kg?: number | null;
    delta_kg?: number | null;
    delta_percent?: number | null;
    current_per_set_kg?: number | null;
    previous_per_set_kg?: number | null;
    per_set_delta_percent?: number | null;
    scope?: string;
  };
  history?: Record<string, any>[];
  raw_sets?: Record<string, any>[];
};

type ReviewerAnalytics = {
  schema_version?: string;
  point_in_time_date?: string;
  comparator?: { workout_id?: number; label?: string; date?: string; matched_movement_count?: number } | null;
  session_read?: {
    performance?: { state?: string; label?: string; counts?: Record<string, number>; comparable_count?: number };
    execution?: { logged_sets?: number; planned_sets?: number | null; completion_percent?: number | null };
    recovery?: { state?: string; label?: string };
    reflection?: { state?: string; label?: string };
    synthesis?: string;
  };
  what_changed?: {
    movement_outcomes?: Record<string, number>;
    volume?: { current_kg?: number; previous_kg?: number | null; delta_percent?: number | null };
    logged_sets?: { current?: number; previous?: number | null; delta?: number | null };
    average_effort_rpe_equivalent?: { current?: number | null; previous?: number | null; delta?: number | null };
    pr_count?: number;
  };
  movements?: AnalyticsMovement[];
  recovery?: {
    state?: string;
    label?: string;
    summary?: string;
    sample_size?: number;
    metrics?: Record<string, { value?: number | null; baseline?: number | null; delta?: number | null; sample_size?: number }>;
    trend?: Record<string, any>[];
  };
  reflection?: {
    state?: string;
    label?: string;
    sample_size?: number;
    session_rpe?: { value?: number | null; baseline?: number | null; delta?: number | null };
    fatigue?: { value?: string | null; higher_than_prior_count?: number; prior_count?: number };
    strength?: string | null;
    note?: string;
  };
  coach_read?: { performance?: string; recovery?: string; reflection?: string; execution?: string; takeaways?: string[]; attention?: { kind?: string; label?: string; item_id?: number }[] };
};

type Props = {
  recap: CompletedSessionRecapPayload;
  impactSummary?: CompletedRecapImpactSummary | null;
  preferredUnits?: string | null;
  coachReview?: CoachReviewContext | null;
  coachReviewUnavailableReason?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onDone?: () => void;
  onOpenMovementHistory?: (movement: CompletedRecapMovement, unit: DisplayWeightUnit) => void;
};

const STATE = {
  improved: { color: '#38D381', icon: 'trending-up-outline' as const, label: 'Improved' },
  stable: { color: '#5AB8FF', icon: 'remove-outline' as const, label: 'Stable' },
  declined: { color: '#FF5F57', icon: 'trending-down-outline' as const, label: 'Declined' },
  not_comparable: { color: '#848895', icon: 'ban-outline' as const, label: 'N/C' },
};

function num(value: unknown, digits = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(digits).replace(/\.0$/, '');
}

function dateLabel(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

function deltaLabel(value: unknown, suffix = '') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'No baseline';
  if (Math.abs(parsed) < 0.05) return `No change${suffix}`;
  return `${parsed > 0 ? '↑ ' : '↓ '}${Math.abs(parsed).toFixed(1).replace(/\.0$/, '')}${suffix}`;
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}</View>{children}</View>;
}

function MetricTile({ icon, label, value, tone = '#B46CFF', detail }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; tone?: string; detail?: string }) {
  return <View style={styles.metricTile}><View style={[styles.metricIcon, { backgroundColor: `${tone}18` }]}><Ionicons name={icon} color={tone} size={17} /></View><View style={styles.metricCopy}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, { color: tone }]}>{value}</Text>{detail ? <Text numberOfLines={2} style={styles.metricDetail}>{detail}</Text> : null}</View></View>;
}

function formatBest(row: Record<string, any> | null | undefined, unit: DisplayWeightUnit) {
  if (!row) return 'No exact comparison';
  const load = formatWeightFromKg(row.weight_kg ?? row.actual_weight_kg, unit) || '—';
  const reps = Number(row.reps ?? row.actual_reps);
  const effort = row.rir != null ? ` @${num(row.rir)} RIR` : row.rpe != null ? ` @RPE ${num(row.rpe)}` : '';
  return `${load} × ${Number.isFinite(reps) ? reps : '—'}${effort}`;
}

function chartValue(valueKg: number, unit: DisplayWeightUnit) {
  return unit === 'kg' ? valueKg : valueKg * 2.2046226218;
}

type EvidencePlotPoint = Record<string, any> & {
  value: number;
  x: number;
  y: number;
};

type EvidencePlot = {
  rows: EvidencePlotPoint[];
  ticks: number[];
  path: string;
  height?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  low?: number;
  high?: number;
};

function EvidenceChart({ points, unit, label = 'Estimated strength' }: { points?: Record<string, any>[]; unit: DisplayWeightUnit; label?: string }) {
  const [width, setWidth] = useState(310);
  const [selected, setSelected] = useState<number | null>(null);
  const plot = useMemo<EvidencePlot>(() => {
    const rows = (points || []).map((row) => ({ ...row, value: chartValue(Number(row.metric_value ?? row.score), unit) })).filter((row) => Number.isFinite(row.value));
    if (!rows.length) return { rows: [], ticks: [], path: '' };
    const values = rows.map((row) => row.value);
    const actualMin = Math.min(...values);
    const actualMax = Math.max(...values);
    const reference = Math.max(Math.abs(actualMin), Math.abs(actualMax), 1);
    const honestPadding = Math.max((actualMax - actualMin) * 0.25, reference * 0.08);
    const low = Math.max(0, actualMin - honestPadding);
    const high = actualMax + honestPadding;
    const ticks = [low, low + (high - low) / 2, high];
    const left = 43, right = 12, top = 16, bottom = 28, height = 170;
    const x = (index: number) => left + (rows.length === 1 ? (width - left - right) / 2 : index * (width - left - right) / (rows.length - 1));
    const y = (value: number) => top + (high - value) * (height - top - bottom) / Math.max(high - low, 1);
    const path = rows.map((row, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(row.value)}`).join(' ');
    return { rows: rows.map((row, index) => ({ ...row, x: x(index), y: y(row.value) })) as EvidencePlotPoint[], ticks, path, height, left, right, top, bottom, low, high };
  }, [points, unit, width]);
  useEffect(() => setSelected(plot.rows.length ? plot.rows.length - 1 : null), [plot.rows.length]);
  if (!plot.rows.length) return <View style={styles.chartEmpty}><Text style={styles.chartEmptyTitle}>No exact comparable history</Text><Text style={styles.chartEmptyBody}>A real prior observation is required.</Text></View>;
  const selectedPoint = selected == null ? null : plot.rows[selected];
  return <View onLayout={(event) => setWidth(Math.max(280, Math.round(event.nativeEvent.layout.width)))} style={styles.chartWrap}>
    <Text style={styles.chartMetric}>{label} ({unit})</Text>
    <Svg accessibilityLabel={`${label} history with numerical axes`} width={width} height={170}>
      {plot.ticks.map((tick, index) => {
        const y = 16 + (plot.ticks[2] - tick) * (170 - 16 - 28) / Math.max(plot.ticks[2] - plot.ticks[0], 1);
        return <React.Fragment key={tick}><Line x1={43} x2={width - 12} y1={y} y2={y} stroke="#242833" strokeWidth="1" /><SvgText x="38" y={y + 4} textAnchor="end" fill="#8D91A0" fontSize="10">{num(tick, 0)}</SvgText></React.Fragment>;
      })}
      <Path d={plot.path} fill="none" stroke="#A35CFF" strokeWidth="3" />
      {plot.rows.map((point, index) => <Circle key={`${point.set_log_id || index}`} cx={point.x} cy={point.y} r={selected === index ? 6 : 4} fill={point.current ? '#D893FF' : '#7E54EF'} stroke={selected === index ? '#FFFFFF' : 'none'} strokeWidth="2" />)}
      {plot.rows.map((point, index) => <SvgText key={`${index}-date`} x={point.x} y="163" textAnchor="middle" fill="#858997" fontSize="9">{String(point.date || '').slice(5).replace('-', '/')}</SvgText>)}
    </Svg>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>{plot.rows.map((point, index) => <Pressable key={`${index}-hit`} accessibilityRole="button" accessibilityLabel={`Inspect ${point.date}`} onPress={() => setSelected(index)} style={[styles.pointHit, { left: point.x - 20, top: point.y + 18 }]} />)}</View>
    {selectedPoint ? <View style={[styles.tooltip, { left: Math.min(Math.max(8, selectedPoint.x - 72), Math.max(8, width - 154)) }]}><Text style={styles.tooltipDate}>{selectedPoint.current ? 'THIS SESSION' : dateLabel(selectedPoint.date).toUpperCase()}</Text><Text style={styles.tooltipValue}>{formatBest(selectedPoint, unit)}</Text><Text style={styles.tooltipMeta}>{formatCalculatedWeightFromKg(selectedPoint.metric_value, unit) || '—'} estimated strength</Text></View> : null}
  </View>;
}

function SessionRead({ analytics }: { analytics: ReviewerAnalytics }) {
  const read = analytics.session_read || {};
  const performanceTone = read.performance?.state === 'declining' ? '#FF5F57' : read.performance?.state === 'improving' ? '#38D381' : '#62B7FF';
  const recoveryTone = read.recovery?.state === 'below_baseline' ? '#FF8A3D' : '#38D381';
  return <Section title="SESSION READ" meta={analytics.comparator ? `vs ${analytics.comparator.label} · ${dateLabel(analytics.comparator.date)}` : 'Point-in-time evidence'}>
    <View style={styles.readCard}><LinearGradient colors={['rgba(119,62,177,0.18)', '#080A0F']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.metricGrid}>
        <MetricTile icon="trending-up-outline" label="Performance" value={read.performance?.label || 'Insufficient evidence'} tone={performanceTone} detail={`${read.performance?.counts?.improved || 0} improved · ${read.performance?.counts?.stable || 0} stable · ${read.performance?.counts?.declined || 0} declined`} />
        <MetricTile icon="clipboard-outline" label="Execution" value={`${read.execution?.logged_sets ?? '—'} / ${read.execution?.planned_sets ?? '—'}`} tone="#B46CFF" detail="Logged / planned sets" />
        <MetricTile icon="pulse-outline" label="Recovery Context" value={read.recovery?.label || 'Unavailable'} tone={recoveryTone} />
        <MetricTile icon="chatbubble-ellipses-outline" label="Athlete Reflection" value={read.reflection?.label || 'Unavailable'} tone="#E05BD8" />
      </View>
      <Text style={styles.synthesis}>{read.synthesis}</Text>
    </View>
  </Section>;
}

function WhatChanged({ analytics, unit }: { analytics: ReviewerAnalytics; unit: DisplayWeightUnit }) {
  const changed = analytics.what_changed || {};
  const volume = changed.volume || {};
  const sets = changed.logged_sets || {};
  const effort = changed.average_effort_rpe_equivalent || {};
  const rows = [
    ['Performance (movements)', `↑ ${changed.movement_outcomes?.improved || 0}  ↔ ${changed.movement_outcomes?.stable || 0}  ↓ ${changed.movement_outcomes?.declined || 0}`],
    ['Total volume', `${formatCompactVolumeValueFromKg(volume.current_kg, unit) || '—'}  ${deltaLabel(volume.delta_percent, '%')}`],
    ['Logged sets', `${sets.current ?? '—'}${sets.previous != null ? ` vs ${sets.previous}` : ''}${sets.delta ? ` · ${sets.delta > 0 ? '+' : ''}${sets.delta}` : ''}`],
    ['Avg effort (RPE-eq.)', `${num(effort.current)}  ${deltaLabel(effort.delta)}`],
    ['PR evidence', String(changed.pr_count || 0)],
  ];
  return <Section title="WHAT CHANGED SINCE LAST COMPARABLE SESSION"><View style={styles.tableCard}>{rows.map(([label, value]) => <View key={label} style={styles.changeRow}><Text style={styles.changeLabel}>{label}</Text><Text style={styles.changeValue}>{value}</Text></View>)}</View></Section>;
}

function MovementCard({ movement, unit, onHistory }: { movement: AnalyticsMovement; unit: DisplayWeightUnit; onHistory?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const state = STATE[movement.comparison?.state || 'not_comparable'];
  const previous = movement.previous_best;
  const current = movement.best_set;
  return <View style={[styles.movementCard, expanded && { borderColor: `${state.color}88` }]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={({ pressed }) => [styles.movementHeader, pressed && styles.pressed]}>
      <CanonicalMovementArtwork movement={movement} size={70} />
      <View style={styles.movementHeaderCopy}><Text numberOfLines={2} style={styles.movementTitle}>{movement.label}</Text><View style={styles.bestCompare}><Text style={styles.lastBest}>Last: {formatBest(previous, unit)}</Text><Text style={styles.todayBest}>Today: {formatBest(current, unit)}</Text></View><Text numberOfLines={2} style={[styles.literal, { color: state.color }]}>{movement.comparison?.literal || 'No reliable prior comparison'}</Text></View>
      <View style={styles.stateColumn}><View style={[styles.stateBadge, { borderColor: `${state.color}99`, backgroundColor: `${state.color}12` }]}><Ionicons name={state.icon} size={13} color={state.color} /><Text style={[styles.stateBadgeText, { color: state.color }]}>{state.label.toUpperCase()}</Text></View><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={SLColors.textSecondary} /></View>
    </Pressable>
    <View style={styles.trajectoryRow}><Text style={styles.trajectory}>{movement.trajectory?.label || 'Limited history'} · {movement.trajectory?.sample_size || 0} comparable Sessions</Text><Text style={styles.confidence}>{movement.confidence?.label || 'No reliable comparison'}</Text></View>
    {expanded ? <View style={styles.movementExpanded}>
      <View style={styles.derivedGrid}>
        <MetricTile icon="analytics-outline" label="Best-set performance" value={movement.comparison?.metric_delta_percent == null ? '—' : `${movement.comparison.metric_delta_percent > 0 ? '+' : ''}${num(movement.comparison.metric_delta_percent)}%`} tone={state.color} />
        <MetricTile icon="barbell-outline" label="Movement volume" value={movement.volume?.delta_percent == null ? '—' : `${movement.volume.delta_percent > 0 ? '+' : ''}${num(movement.volume.delta_percent)}%`} tone="#37C9E8" detail={`${formatCompactVolumeValueFromKg(movement.volume?.previous_kg, unit) || '—'} → ${formatCompactVolumeValueFromKg(movement.volume?.current_kg, unit) || '—'}`} />
        <MetricTile icon="layers-outline" label="Volume / set" value={movement.volume?.per_set_delta_percent == null ? '—' : `${movement.volume.per_set_delta_percent > 0 ? '+' : ''}${num(movement.volume.per_set_delta_percent)}%`} tone="#F3AC33" />
        <MetricTile icon="shield-checkmark-outline" label="Evidence" value={movement.confidence?.state === 'high' ? 'High' : movement.confidence?.state === 'limited' ? 'Limited' : 'Unavailable'} tone="#B46CFF" detail={String(movement.confidence?.scope || '').replaceAll('_', ' ')} />
      </View>
      <Text style={styles.subsectionTitle}>RAW SETLOG EVIDENCE</Text>
      <View style={styles.rawTable}><View style={styles.rawHeader}><Text style={styles.rawIndex}>SET</Text><Text style={styles.rawCell}>LOAD</Text><Text style={styles.rawCell}>REPS</Text><Text style={styles.rawCell}>EFFORT</Text><Text style={styles.rawCell}>VOLUME</Text></View>{(movement.raw_sets || movement.sets || []).map((row, index) => <View key={row.id || index} style={styles.rawRow}><Text style={styles.rawIndex}>{row.set_index || index + 1}</Text><Text style={styles.rawCell}>{formatWeightFromKg(row.actual_weight_kg, unit) || '—'}</Text><Text style={styles.rawCell}>{row.actual_reps ?? '—'}</Text><Text style={styles.rawCell}>{row.actual_rir != null ? `${num(row.actual_rir)} RIR` : row.actual_rpe != null ? `RPE ${num(row.actual_rpe)}` : '—'}</Text><Text style={styles.rawCell}>{formatCompactVolumeValueFromKg(Number(row.actual_weight_kg || 0) * Number(row.actual_reps || 0), unit) || '—'}</Text></View>)}</View>
      <Text style={styles.subsectionTitle}>ESTIMATED STRENGTH TREND</Text>
      <EvidenceChart points={movement.history} unit={unit} label={movement.trend?.metric_label || 'Estimated strength'} />
      {onHistory ? <Pressable accessibilityRole="button" onPress={onHistory} style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}><Ionicons name="time-outline" color={SLColors.accentMuted} size={19} /><Text style={styles.historyButtonText}>Open Full Movement History</Text><Ionicons name="chevron-forward" color={SLColors.textSecondary} size={18} /></Pressable> : null}
    </View> : null}
  </View>;
}

function Recovery({ analytics }: { analytics: ReviewerAnalytics }) {
  const recovery = analytics.recovery || {};
  const metrics = recovery.metrics || {};
  const entries = [
    ['Readiness', metrics.readiness, '/ 10', '#38D381'],
    ['Sleep', metrics.sleep, ' h', '#5AAEFF'],
    ['Stress', metrics.stress, ' / 10', '#FF8A3D'],
    ['Energy', metrics.energy, ' / 10', '#E05BD8'],
  ] as const;
  return <Section title="CONTEXT & RECOVERY" meta={`${recovery.sample_size || 0} prior observations`}><View style={styles.contextCard}><Text style={styles.contextSummary}>{recovery.summary}</Text><View style={styles.recoveryGrid}>{entries.map(([label, metric, suffix, color]) => <MetricTile key={label} icon={label === 'Sleep' ? 'moon-outline' : label === 'Stress' ? 'flame-outline' : label === 'Energy' ? 'flash-outline' : 'pulse-outline'} label={label} value={metric?.value == null ? '—' : `${num(metric.value)}${suffix}`} tone={color} detail={metric?.delta == null ? 'Baseline unavailable' : `${deltaLabel(metric.delta, suffix.trim())} vs recent average`} />)}</View><RecoveryChart points={recovery.trend || []} /></View></Section>;
}

function RecoveryChart({ points }: { points: Record<string, any>[] }) {
  const width = 330, height = 150, left = 34, right = 10, top = 12, bottom = 24;
  const rows = points.slice(-8);
  const axisMax = Math.max(
    10,
    ...rows.flatMap((row) => ['readiness', 'sleep', 'stress', 'energy']
      .map((key) => Number(row[key]))
      .filter((value) => Number.isFinite(value))),
  );
  const x = (index: number) => left + (rows.length <= 1 ? 0 : index * (width - left - right) / (rows.length - 1));
  const y = (value: number) => top + (axisMax - value) * (height - top - bottom) / axisMax;
  const series = [
    ['readiness', '#38D381'], ['sleep', '#5AAEFF'], ['stress', '#FF8A3D'], ['energy', '#E05BD8'],
  ] as const;
  const ticks = [0, axisMax / 2, axisMax];
  return <View style={styles.recoveryChart}><Svg accessibilityLabel={`Readiness context chart with 0 to ${num(axisMax)} numerical axis`} width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>{ticks.map((tick) => <React.Fragment key={tick}><Line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#252934" /><SvgText x={left - 6} y={y(tick) + 4} textAnchor="end" fill="#858997" fontSize="9">{num(tick)}</SvgText></React.Fragment>)}{series.map(([key, color]) => { const valid = rows.map((row, index) => ({ value: Number(row[key]), index })).filter((row) => Number.isFinite(row.value)); const path = valid.map((row, index) => `${index ? 'L' : 'M'} ${x(row.index)} ${y(row.value)}`).join(' '); return <React.Fragment key={key}><Path d={path} fill="none" stroke={color} strokeWidth="2" />{valid.map((row) => <Circle key={`${key}-${row.index}`} cx={x(row.index)} cy={y(row.value)} r="3" fill={color} />)}</React.Fragment>; })}{rows.map((row, index) => <SvgText key={`${index}-date`} x={x(index)} y={height - 5} textAnchor="middle" fill="#858997" fontSize="8">{String(row.date || '').slice(5).replace('-', '/')}</SvgText>)}</Svg><View style={styles.legend}>{series.map(([key, color]) => <View key={key} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{key[0].toUpperCase() + key.slice(1)}</Text></View>)}</View></View>;
}

function Reflection({ analytics }: { analytics: ReviewerAnalytics }) {
  const reflection = analytics.reflection || {};
  return <Section title="ATHLETE REFLECTION" meta={reflection.label}><View style={styles.contextCard}><View style={styles.reflectionGrid}><MetricTile icon="speedometer-outline" label="Session RPE" value={reflection.session_rpe?.value == null ? '—' : `${num(reflection.session_rpe.value)} / 10`} tone="#F3AC33" detail={reflection.session_rpe?.delta == null ? 'No prior baseline' : `${deltaLabel(reflection.session_rpe.delta)} vs recent average`} /><MetricTile icon="body-outline" label="Session Feel" value={String(reflection.strength || 'Not reported').replaceAll('_', ' ')} tone="#38D381" /><MetricTile icon="battery-half-outline" label="Fatigue" value={String(reflection.fatigue?.value || 'Not reported').replaceAll('_', ' ')} tone="#E05BD8" detail={reflection.fatigue?.prior_count ? `Higher than ${reflection.fatigue.higher_than_prior_count} of last ${reflection.fatigue.prior_count}` : undefined} /></View>{reflection.note ? <View style={styles.athleteNote}><Ionicons name="chatbox-ellipses-outline" color="#E05BD8" size={19} /><Text style={styles.athleteNoteText}>{reflection.note}</Text></View> : null}</View></Section>;
}

function CoachRead({ analytics }: { analytics: ReviewerAnalytics }) {
  const read = analytics.coach_read || {};
  return <><Section title="COACH READ"><View style={styles.coachReadCard}>{[
    ['Performance', read.performance, '#38D381', 'trending-up-outline'],
    ['Recovery', read.recovery, read.recovery === 'Below baseline' ? '#FF6A55' : '#38D381', 'bed-outline'],
    ['Reflection', read.reflection, '#E05BD8', 'chatbox-outline'],
    ['Execution', read.execution, '#B46CFF', 'clipboard-outline'],
  ].map(([label, value, color, icon]) => <View key={String(label)} style={styles.coachReadRow}><Ionicons name={icon as any} color={String(color)} size={18} /><Text style={styles.coachReadLabel}>{label}</Text><Text style={[styles.coachReadValue, { color: String(color) }]}>{value || 'Unavailable'}</Text></View>)}</View></Section><Section title="KEY TAKEAWAYS"><View style={styles.takeawayCard}>{(read.takeaways || []).map((row, index) => <View key={`${row}-${index}`} style={styles.takeawayRow}><View style={styles.takeawayIcon}><Ionicons name="sparkles-outline" size={16} color={SLColors.accentMuted} /></View><Text style={styles.takeawayText}>{row}</Text></View>)}</View></Section>{read.attention?.length ? <Section title="COACH ATTENTION"><View style={styles.takeawayCard}>{read.attention.map((row, index) => <View key={`${row.kind}-${index}`} style={styles.takeawayRow}><View style={[styles.takeawayIcon, { backgroundColor: 'rgba(255,92,83,0.12)' }]}><Ionicons name="alert-circle-outline" size={17} color="#FF6A55" /></View><Text style={styles.takeawayText}>{row.label}</Text></View>)}</View></Section> : null}</>;
}

export function CoachSessionReviewerV3({ recap, preferredUnits, coachReview, coachReviewUnavailableReason, refreshing, onRefresh, onClose, onDone, onOpenMovementHistory }: Props) {
  const insets = useSafeAreaInsets();
  const { unit, setUnit } = useSurfaceWeightUnit(preferredUnits);
  const [tab, setTab] = useState<ReviewerTab>('overview');
  const analytics = recap.reviewer_v3 as ReviewerAnalytics | null | undefined;
  const performed = recap.performed_movements || [];
  if (!analytics) return <SafeAreaView style={styles.loading}><ActivityIndicator color={SLColors.accentMuted} /><Text style={styles.loadingText}>Preparing canonical Session evidence…</Text></SafeAreaView>;
  return <SafeAreaView edges={['top']} style={styles.screen}><FloatingControlCoordinator context="screen"><FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} slot={1} testID="coach-reviewer-unit-toggle" />
    <View style={styles.topBar}><Pressable accessibilityRole="button" accessibilityLabel="Back from Session review" onPress={onClose} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}><Ionicons name="chevron-back" size={23} color={SLColors.textPrimary} /></Pressable><View style={styles.topCopy}><Text style={styles.topKicker}>SESSION REVIEW</Text><Text numberOfLines={1} style={styles.topTitle}>{recap.session.label}</Text><Text style={styles.topSubtitle}>{dateLabel(recap.session.date)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Done reviewing Session" onPress={onDone || onClose} style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}><Ionicons name="checkmark" size={23} color={SLColors.textPrimary} /></Pressable></View>
    <View style={styles.tabs}>{([{ key: 'overview', label: 'Overview' }, { key: 'performed', label: 'Performed' }, { key: 'plan', label: 'Plan / Compare' }, { key: 'coach', label: 'Coach' }] as { key: ReviewerTab; label: string }[]).map((row) => <Pressable key={row.key} accessibilityRole="tab" accessibilityState={{ selected: tab === row.key }} onPress={() => setTab(row.key)} style={({ pressed }) => [styles.tab, tab === row.key && styles.tabSelected, pressed && styles.pressed]}><Text style={[styles.tabText, tab === row.key && styles.tabTextSelected]}>{row.label}</Text></Pressable>)}</View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 18) + 86 }]} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={SLColors.accentMuted} /> : undefined} showsVerticalScrollIndicator={false}>
      {tab === 'overview' ? <><SessionRead analytics={analytics} /><WhatChanged analytics={analytics} unit={unit} /><Recovery analytics={analytics} /><Reflection analytics={analytics} /></> : null}
      {tab === 'performed' ? <Section title="MOVEMENT PROGRESSION" meta={`${analytics.movements?.length || 0} movements`}>{(analytics.movements || []).map((movement, index) => <MovementCard key={movement.item_id || `${movement.label}-${index}`} movement={movement} unit={unit} onHistory={onOpenMovementHistory ? () => { const canonical = performed.find((row) => Number(row.item_id) === Number(movement.item_id)); if (canonical) onOpenMovementHistory(canonical, unit); } : undefined} />)}</Section> : null}
      {tab === 'plan' ? <PlanCompareExperience recap={recap} performedMovements={performed} unit={unit} onOpenHistory={onOpenMovementHistory} /> : null}
      {tab === 'coach' ? <><CoachRead analytics={analytics} />{coachReview ? <CoachTools review={coachReview} /> : <Section title="COACH REVIEW TOOLS"><View style={styles.contextCard}><Text style={styles.contextSummary}>{coachReviewUnavailableReason || 'Review tools are unavailable.'}</Text></View></Section>}</> : null}
    </ScrollView>
  </FloatingControlCoordinator></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020307' }, loading: { flex: 1, gap: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020307' }, loadingText: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 13 },
  topBar: { minHeight: 78, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1B1E26' }, topButton: { width: 48, height: 48, borderRadius: 15, borderWidth: 1, borderColor: '#323642', backgroundColor: '#090B11', alignItems: 'center', justifyContent: 'center' }, topCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 10 }, topKicker: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, letterSpacing: 1.4 }, topTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 19 }, topSubtitle: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 },
  tabs: { margin: 12, height: 45, flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: '#303440', backgroundColor: '#07090E', padding: 3 }, tab: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, tabSelected: { backgroundColor: '#2A1439', borderWidth: 1, borderColor: '#924AC2' }, tabText: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, tabTextSelected: { color: '#E6CCFF' }, content: { paddingHorizontal: 10, gap: 12 },
  section: { gap: 8 }, sectionHeading: { paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: '#C378FF', fontFamily: SLFontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.8 }, sectionMeta: { flexShrink: 1, marginLeft: 10, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 9, textAlign: 'right' },
  readCard: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#343846', backgroundColor: '#07090E', padding: 10 }, metricGrid: { flexDirection: 'row', flexWrap: 'wrap' }, metricTile: { width: '50%', minHeight: 78, padding: 9, flexDirection: 'row', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#252936' }, metricIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, metricCopy: { flex: 1 }, metricLabel: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9, textTransform: 'uppercase' }, metricValue: { marginTop: 2, fontFamily: SLFontFamilies.display, fontSize: 14 }, metricDetail: { marginTop: 3, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 9, lineHeight: 12 }, synthesis: { marginTop: 10, padding: 11, borderRadius: 11, backgroundColor: 'rgba(119,62,177,0.12)', color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 17 },
  tableCard: { borderRadius: 14, borderWidth: 1, borderColor: '#2A2E38', backgroundColor: '#080A0F', overflow: 'hidden' }, changeRow: { minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#272B34' }, changeLabel: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 11 }, changeValue: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 },
  movementCard: { marginBottom: 9, borderRadius: 15, borderWidth: 1, borderColor: '#2A2E38', backgroundColor: '#080A0F', overflow: 'hidden' }, movementHeader: { minHeight: 98, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 }, movementHeaderCopy: { flex: 1 }, movementTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.display, fontSize: 16 }, bestCompare: { marginTop: 5, gap: 2 }, lastBest: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 }, todayBest: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, literal: { marginTop: 5, fontFamily: SLFontFamilies.bodyBold, fontSize: 10, textTransform: 'uppercase' }, stateColumn: { alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between' }, stateBadge: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }, stateBadgeText: { fontFamily: SLFontFamilies.bodyBold, fontSize: 8 }, trajectoryRow: { paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#242832' }, trajectory: { flex: 1, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 9 }, confidence: { color: '#A66CF1', fontFamily: SLFontFamilies.bodyBold, fontSize: 8 }, movementExpanded: { padding: 10, borderTopWidth: 1, borderTopColor: '#292D37' }, derivedGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 12, borderWidth: 1, borderColor: '#282C35', overflow: 'hidden' }, subsectionTitle: { marginTop: 14, marginBottom: 7, color: '#C378FF', fontFamily: SLFontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.7 },
  rawTable: { borderRadius: 11, borderWidth: 1, borderColor: '#282C35', overflow: 'hidden' }, rawHeader: { minHeight: 30, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', backgroundColor: '#10131A' }, rawRow: { minHeight: 37, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#292D36' }, rawIndex: { width: 32, color: SLColors.textSecondary, fontFamily: SLFontFamilies.bodyBold, fontSize: 9 }, rawCell: { flex: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 9 },
  chartWrap: { minHeight: 225, borderRadius: 12, borderWidth: 1, borderColor: '#282C35', backgroundColor: '#06080C', paddingTop: 10, overflow: 'hidden' }, chartMetric: { marginLeft: 12, color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 10 }, pointHit: { position: 'absolute', width: 40, height: 40 }, tooltip: { position: 'absolute', top: 34, width: 146, borderRadius: 9, borderWidth: 1, borderColor: '#7741A5', backgroundColor: '#11131B', padding: 8 }, tooltipDate: { color: '#C378FF', fontFamily: SLFontFamilies.bodyBold, fontSize: 8 }, tooltipValue: { marginTop: 2, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 10 }, tooltipMeta: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 8 }, chartEmpty: { height: 150, borderRadius: 12, borderWidth: 1, borderColor: '#282C35', alignItems: 'center', justifyContent: 'center' }, chartEmptyTitle: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 12 }, chartEmptyBody: { marginTop: 4, color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 10 }, historyButton: { marginTop: 11, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#6C3A92', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 8 }, historyButtonText: { flex: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.bodyBold, fontSize: 11 },
  contextCard: { borderRadius: 15, borderWidth: 1, borderColor: '#2A2E38', backgroundColor: '#080A0F', padding: 10 }, contextSummary: { color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 12, lineHeight: 18 }, recoveryGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' }, recoveryChart: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#282C35', paddingTop: 10 }, legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center' }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 8 }, reflectionGrid: { flexDirection: 'row', flexWrap: 'wrap' }, athleteNote: { marginTop: 8, padding: 10, borderRadius: 11, backgroundColor: 'rgba(224,91,216,0.1)', flexDirection: 'row', gap: 8 }, athleteNoteText: { flex: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 16 },
  coachReadCard: { borderRadius: 14, borderWidth: 1, borderColor: '#2A2E38', backgroundColor: '#080A0F', overflow: 'hidden' }, coachReadRow: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292D36' }, coachReadLabel: { flex: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 11 }, coachReadValue: { fontFamily: SLFontFamilies.bodyBold, fontSize: 11 }, takeawayCard: { borderRadius: 14, borderWidth: 1, borderColor: '#2A2E38', backgroundColor: '#080A0F', padding: 7 }, takeawayRow: { minHeight: 48, padding: 7, flexDirection: 'row', alignItems: 'center', gap: 9 }, takeawayIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: 'rgba(180,108,255,0.12)', alignItems: 'center', justifyContent: 'center' }, takeawayText: { flex: 1, color: SLColors.textPrimary, fontFamily: SLFontFamilies.body, fontSize: 11, lineHeight: 16 }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
