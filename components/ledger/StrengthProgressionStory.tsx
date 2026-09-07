import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { Text } from '@/components/ui/sl-text';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import { kilogramsToDisplayValue, roundCalculatedWeightForDisplay } from '@/lib/display-units';
import type { LedgerUnit, StrengthProgressionLenses, StrengthSourcePerformance } from '@/lib/ledger-data';

type EstimatedPoint = Readonly<{ date: string; valueKg: number }>;

type StrengthProgressionStoryProps = Readonly<{
  liftKey: 'squat' | 'bench' | 'deadlift';
  liftLabel: string;
  tone: string;
  unit: LedgerUnit;
  currentEstimateKg: number | null;
  estimatedChangeKg: number | null;
  estimatedPoints: readonly EstimatedPoint[];
  lenses: StrengthProgressionLenses | null;
  onOpenEvidence: () => void;
}>;

const REP_COLORS = ['#F4C75B', '#56D3FF', '#B46BFF', '#FF7CA8', '#67E6A2'];

function displayWeight(valueKg: number | null | undefined, unit: LedgerUnit) {
  if (valueKg == null || !Number.isFinite(valueKg)) return '—';
  const projected = roundCalculatedWeightForDisplay(kilogramsToDisplayValue(valueKg, unit), unit);
  return Number.isInteger(projected) ? projected.toLocaleString('en-US') : projected.toFixed(1);
}

function signedWeight(valueKg: number | null | undefined, unit: LedgerUnit) {
  if (valueKg == null || !Number.isFinite(valueKg)) return '—';
  return `${valueKg > 0 ? '+' : valueKg < 0 ? '−' : '±'}${displayWeight(Math.abs(valueKg), unit)} ${unit.toUpperCase()}`;
}

function compactVolume(valueKg: number | null | undefined, unit: LedgerUnit) {
  if (valueKg == null || !Number.isFinite(valueKg)) return '—';
  const projected = kilogramsToDisplayValue(valueKg, unit);
  const compact = Math.abs(projected) >= 1000 ? `${(projected / 1000).toFixed(projected >= 10_000 ? 1 : 2)}K` : Math.round(projected).toLocaleString('en-US');
  return `${compact} ${unit.toUpperCase()}`;
}

function signedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)}%`;
}

function readableDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function LensHeading({ evidence, title, body, tone }: { evidence: 'ESTIMATED' | 'PERFORMED'; title: string; body: string; tone: string }) {
  return <View style={styles.heading}>
    <View style={[styles.evidenceBadge, evidence === 'PERFORMED' ? { borderColor: `${tone}75`, backgroundColor: `${tone}18` } : null]}>
      <View style={[styles.evidenceDot, { backgroundColor: evidence === 'PERFORMED' ? tone : '#7B8491' }]} />
      <Text style={[styles.evidenceBadgeText, evidence === 'PERFORMED' ? { color: tone } : null]}>{evidence}</Text>
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.body}>{body}</Text>
  </View>;
}

function CompactEmpty({ children, testID }: { children: string; testID: string }) {
  return <View testID={testID} style={styles.compactEmpty}><Ionicons name="remove-circle-outline" size={18} color="#707B89" /><Text style={styles.compactEmptyText}>{children}</Text></View>;
}

function EvidenceBars<T extends Readonly<{ date: string }>>({ points, tone, value }: { points: readonly T[]; tone: string; value: (point: T) => number }) {
  const visible = points.slice(-10);
  const maximum = Math.max(1, ...visible.map(value));
  if (!visible.length) return null;
  return <View style={styles.barsWrap}>
    <View style={styles.bars}>{visible.map((point, index) => {
      const amount = value(point);
      const height = Math.max(amount > 0 ? 8 : 2, (amount / maximum) * 108);
      return <View key={`${point.date}-${index}`} style={styles.barTrack}><View style={[styles.bar, { height, backgroundColor: tone, opacity: 0.5 + (index / Math.max(1, visible.length - 1)) * 0.5 }]} /></View>;
    })}</View>
    <View style={styles.axisLabels}><Text style={styles.axisLabel}>{readableDate(visible[0].date).replace(/, \d{4}/, '')}</Text><Text style={styles.axisLabel}>{readableDate(visible.at(-1)?.date).replace(/, \d{4}/, '')}</Text></View>
  </View>;
}

function performanceLabel(performance: StrengthSourcePerformance | null | undefined, unit: LedgerUnit) {
  if (!performance || performance.weight_kg == null || performance.reps == null) return 'Recorded performance unavailable';
  return `${displayWeight(performance.weight_kg, unit)} ${unit.toUpperCase()} × ${performance.reps}`;
}

function comparisonLabel(kind: StrengthProgressionLenses['comparable_performance']['kind']) {
  if (kind === 'more_reps_same_weight') return 'Same weight · more reps';
  if (kind === 'more_weight_same_reps') return 'Same reps · more weight';
  if (kind === 'lower_effort_same_task') return 'Same load and reps · lower effort';
  return 'Matched performance';
}

function HistoricalRow({ label, rangeValue, careerValue, rangeDate, careerDate, unit, tone }: {
  label: string;
  rangeValue: number | null | undefined;
  careerValue: number | null | undefined;
  rangeDate?: string | null;
  careerDate?: string | null;
  unit: LedgerUnit;
  tone: string;
}) {
  return <View style={styles.historicalRow}>
    <View style={styles.historicalLabelWrap}><View style={[styles.historicalMarker, { backgroundColor: tone }]} /><Text style={styles.historicalLabel}>{label}</Text></View>
    <View style={styles.historicalColumns}>
      <View style={styles.historicalColumn}><Text style={styles.historicalColumnLabel}>THIS RANGE</Text><Text style={styles.historicalValue}>{displayWeight(rangeValue, unit)} {rangeValue != null ? unit.toUpperCase() : ''}</Text><Text style={styles.historicalDate}>{rangeDate ? readableDate(rangeDate) : 'No evidence'}</Text></View>
      <View style={styles.historicalColumn}><Text style={styles.historicalColumnLabel}>CAREER BEST</Text><Text style={styles.historicalValue}>{displayWeight(careerValue, unit)} {careerValue != null ? unit.toUpperCase() : ''}</Text><Text style={styles.historicalDate}>{careerDate ? readableDate(careerDate) : 'No evidence'}</Text></View>
    </View>
  </View>;
}

export function StrengthProgressionStory({
  liftKey,
  liftLabel,
  tone,
  unit,
  currentEstimateKg,
  estimatedChangeKg,
  estimatedPoints,
  lenses,
  onOpenEvidence,
}: StrengthProgressionStoryProps) {
  const weight = lenses?.weight_on_bar;
  const reps = lenses?.rep_strength.series ?? [];
  const volume = lenses?.training_volume;
  const comparison = lenses?.comparable_performance;
  const heavy = lenses?.heavy_exposure;
  const history = lenses?.historical_context;
  const sources = lenses?.source_evidence;
  const repHistory = history?.rep_maxes.filter((row) => row.range_best_kg != null || row.career_best_kg != null) ?? [];

  return <View testID={`strength-progression-story-${liftKey}`} style={styles.story}>
    <View testID="strength-lens-estimated" style={styles.lensCard}>
      <LensHeading evidence="ESTIMATED" title="Estimated Strength" body="Calculated e1RM progression from exact-lift load, reps, and recorded effort." tone={tone} />
      <View style={styles.metricRow}><View><Text style={styles.metricValue}>{displayWeight(currentEstimateKg, unit)} {currentEstimateKg != null ? unit.toUpperCase() : ''}</Text><Text style={styles.metricCaption}>Current estimated 1RM</Text></View><View style={[styles.deltaPill, { borderColor: `${tone}70` }]}><Text style={[styles.deltaValue, { color: tone }]}>{signedWeight(estimatedChangeKg, unit)}</Text><Text style={styles.deltaCaption}>change in range</Text></View></View>
      <View style={styles.chartStage}><AnalyticalTimeSeriesChart series={[{ key: liftKey, label: `${liftLabel} estimated strength`, color: tone, points: estimatedPoints.map((point) => ({ date: point.date, value: kilogramsToDisplayValue(point.valueKg, unit) })) }]} metric={analyticalMetricDefinition('estimated_1rm', { label: `${liftLabel} estimated strength`, kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 0 })} height={230} showLegend={false} readableText emptyTitle="Estimated strength needs more history" emptyBody="Two qualifying estimated-strength observations are required." testID="strength-profile-trend-chart" /></View>
    </View>

    <View testID="strength-lens-weight-on-bar" style={[styles.lensCard, { borderColor: `${tone}55` }]}>
      <LensHeading evidence="PERFORMED" title="Weight on the Bar" body={`Literal ${weight?.aggregation === 'session' ? 'session' : 'weekly'} heaviest load. No formula.`} tone={tone} />
      {weight?.points.length ? <><View style={styles.metricRow}><View><Text style={styles.metricValue}>{displayWeight(weight.heaviest_kg, unit)} {unit.toUpperCase()}</Text><Text style={styles.metricCaption}>Heaviest recorded in this range · {weight.heaviest_date ? readableDate(weight.heaviest_date) : 'date unavailable'}</Text></View><View style={[styles.deltaPill, { borderColor: `${tone}70` }]}><Text style={[styles.deltaValue, { color: tone }]}>{signedWeight(weight.change_kg, unit)}</Text><Text style={styles.deltaCaption}>{weight.aggregation} top-load change</Text></View></View><View style={styles.chartStage}><AnalyticalTimeSeriesChart series={[{ key: 'top-weight', label: `${liftLabel} performed top weight`, color: tone, points: weight.points.map((point) => ({ date: point.date, value: kilogramsToDisplayValue(point.value_kg, unit) })) }]} metric={analyticalMetricDefinition('top_weight', { label: `${liftLabel} performed top weight`, kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 0 })} height={220} showLegend={false} readableText emptyTitle="No performed top-weight history" emptyBody="A recorded exact-lift load is required." testID="strength-top-weight-chart" /></View></> : <CompactEmpty testID="strength-top-weight-empty">No recorded exact-lift weight is available in this range.</CompactEmpty>}
    </View>

    <View testID="strength-lens-rep-strength" style={styles.lensCard}>
      <LensHeading evidence="PERFORMED" title="Rep Strength" body="Best literal load at each exact rep count. Estimated rep maxes are excluded." tone={tone} />
      {reps.length ? <><View style={styles.repSummaryRail}>{reps.map((series, index) => <View key={series.reps} style={[styles.repSummary, { borderColor: `${REP_COLORS[index % REP_COLORS.length]}60` }]}><Text style={[styles.repName, { color: REP_COLORS[index % REP_COLORS.length] }]}>{series.label}</Text><Text style={styles.repValue}>{displayWeight(series.best_in_range_kg, unit)} {unit.toUpperCase()}</Text><Text style={styles.repDelta}>{series.change_kg == null ? 'One observation' : `${signedWeight(series.change_kg, unit)} in range`}</Text></View>)}</View><View style={styles.chartStage}><AnalyticalTimeSeriesChart series={reps.map((series, index) => ({ key: `rep-${series.reps}`, label: series.label, color: REP_COLORS[index % REP_COLORS.length], points: series.points.map((point) => ({ date: point.date, value: kilogramsToDisplayValue(point.value_kg, unit) })) }))} metric={analyticalMetricDefinition('rep_strength', { label: `${liftLabel} performed rep strength`, kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 0 })} height={235} showLegend readableText emptyTitle="Rep strength needs more history" emptyBody="Recorded exact-rep performances are required." testID="strength-rep-max-chart" /></View></> : <CompactEmpty testID="strength-rep-max-empty">Not enough comparable rep-max evidence yet.</CompactEmpty>}
    </View>

    <View testID="strength-lens-training-volume" style={[styles.lensCard, styles.volumeCard]}>
      <LensHeading evidence="PERFORMED" title="Training Volume" body={`Exact ${liftLabel} load × reps, grouped by ${volume?.aggregation ?? 'the selected range'}. Volume is context, not a strength estimate.`} tone={tone} />
      {volume?.points.length ? <><View style={styles.metricRow}><View><Text style={styles.metricValue}>{compactVolume(volume.recent_average_kg, unit)}</Text><Text style={styles.metricCaption}>Recent {volume.aggregation} average</Text></View><View style={[styles.deltaPill, { borderColor: '#4EC4E870' }]}><Text style={[styles.deltaValue, { color: '#62D9F8' }]}>{signedPercent(volume.change_pct)}</Text><Text style={styles.deltaCaption}>vs earlier in range</Text></View></View><EvidenceBars points={volume.points} tone="#58D6F4" value={(point) => point.value_kg} /></> : <CompactEmpty testID="strength-volume-empty">No complete performed volume is available for this exact lift and range.</CompactEmpty>}
    </View>

    <View testID="strength-lens-comparable-performance" style={[styles.lensCard, styles.comparisonCard]}>
      <LensHeading evidence="PERFORMED" title="Comparable Performance" body="A literal matched-task comparison. e1RM is not used." tone={tone} />
      {comparison?.status === 'supported' && comparison.from && comparison.to ? <><Text style={[styles.comparisonKind, { color: tone }]}>{comparisonLabel(comparison.kind)}</Text><View style={styles.comparisonFlow}><View style={styles.performanceBox}><Text style={styles.performanceDate}>{readableDate(comparison.from.date)}</Text><Text style={styles.performanceValue}>{performanceLabel(comparison.from, unit)}</Text><Text style={styles.performanceEffort}>{comparison.from.effort_label ?? 'Effort not recorded'}</Text></View><View style={[styles.comparisonArrow, { borderColor: `${tone}65` }]}><Ionicons name="arrow-forward" size={22} color={tone} /></View><View style={[styles.performanceBox, { borderColor: `${tone}65`, backgroundColor: `${tone}12` }]}><Text style={styles.performanceDate}>{readableDate(comparison.to.date)}</Text><Text style={styles.performanceValue}>{performanceLabel(comparison.to, unit)}</Text><Text style={styles.performanceEffort}>{comparison.to.effort_label ?? 'Effort not recorded'}</Text></View></View></> : <CompactEmpty testID="strength-comparison-empty">No trustworthy same-task comparison exists in this range yet.</CompactEmpty>}
    </View>

    <View testID="strength-lens-heavy-exposure" style={styles.lensCard}>
      <LensHeading evidence="PERFORMED" title="Heavy Exposure" body="Meaningful heavy work relative to strength known at the time—not a fixed load." tone={tone} />
      {heavy?.points.length ? <><View style={styles.heavyMetrics}><View style={styles.heavyMetric}><Text style={[styles.heavyValue, { color: tone }]}>{heavy.qualifying_sets}</Text><Text style={styles.heavyLabel}>qualifying sets</Text></View><View style={styles.heavyDivider} /><View style={styles.heavyMetric}><Text style={styles.heavyValue}>{heavy.qualifying_sessions}</Text><Text style={styles.heavyLabel}>sessions</Text></View><View style={styles.heavyDivider} /><View style={styles.heavyMetric}><Text style={styles.heavyValue}>{heavy.average_sets_per_bucket ?? '—'}</Text><Text style={styles.heavyLabel}>per {heavy.aggregation}</Text></View></View><EvidenceBars points={heavy.points} tone={tone} value={(point) => point.qualifying_sets} /><View style={styles.definition}><Ionicons name="shield-checkmark-outline" size={18} color={tone} /><Text style={styles.definitionText}>{heavy.definition}</Text></View></> : <CompactEmpty testID="strength-heavy-empty">No exact-lift performances can be evaluated for heavy exposure in this range.</CompactEmpty>}
    </View>

    <View testID="strength-lens-historical-context" style={styles.lensCard}>
      <LensHeading evidence="PERFORMED" title="Historical Context" body="Each current lens is compared with its own career evidence. Different measures stay separate." tone={tone} />
      <HistoricalRow label="Estimated 1RM" rangeValue={history?.current_e1rm_kg} careerValue={history?.career_e1rm_peak_kg} rangeDate={history?.current_e1rm_date} careerDate={history?.career_e1rm_peak_date} unit={unit} tone="#8C7BFF" />
      <HistoricalRow label="Weight on the bar" rangeValue={history?.range_top_weight_kg} careerValue={history?.career_top_weight_kg} rangeDate={history?.range_top_weight_date} careerDate={history?.career_top_weight_date} unit={unit} tone={tone} />
      {repHistory.map((row, index) => <HistoricalRow key={row.reps} label={row.label} rangeValue={row.range_best_kg} careerValue={row.career_best_kg} rangeDate={row.range_best_date} careerDate={row.career_best_date} unit={unit} tone={REP_COLORS[index % REP_COLORS.length]} />)}
      {!history || (history.current_e1rm_kg == null && history.range_top_weight_kg == null && !repHistory.length) ? <CompactEmpty testID="strength-history-empty">No dated history is available for this lift yet.</CompactEmpty> : null}
    </View>

    <View testID="strength-lens-source-evidence" style={[styles.lensCard, styles.sourceCard]}>
      <LensHeading evidence="PERFORMED" title="Source Evidence" body="The recorded work behind every performed lens on this page." tone={tone} />
      <View style={styles.sourceCounts}><View><Text style={styles.sourceCount}>{sources?.performance_count ?? 0}</Text><Text style={styles.sourceCountLabel}>performances in range</Text></View><View><Text style={styles.sourceCount}>{sources?.native_set_log_count ?? 0}</Text><Text style={styles.sourceCountLabel}>Strength Ledger sets</Text></View><View><Text style={styles.sourceCount}>{sources?.historical_import_count ?? 0}</Text><Text style={styles.sourceCountLabel}>historical entries</Text></View></View>
      <Text style={styles.sourcePolicy}>{sources?.identity_policy ?? 'Exact governed competition-lift identity is required.'}</Text>
      <Pressable testID="strength-open-source-evidence" onPress={onOpenEvidence} style={({ pressed }) => [styles.sourceButton, { borderColor: `${tone}70` }, pressed && styles.pressed]}><Ionicons name="document-text-outline" size={20} color={tone} /><Text style={styles.sourceButtonText}>Open source sets</Text><Ionicons name="arrow-forward" size={18} color={tone} /></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  story: { gap: 16 },
  lensCard: { gap: 14, overflow: 'hidden', padding: 15, borderRadius: 19, borderWidth: 1, borderColor: '#303A47', backgroundColor: '#080B10' },
  volumeCard: { borderColor: '#27444D', backgroundColor: '#071014' },
  comparisonCard: { backgroundColor: '#0B0910' },
  sourceCard: { borderColor: '#394151', backgroundColor: '#0A0D13' },
  heading: { gap: 5 },
  evidenceBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#444B56', backgroundColor: '#15191F' },
  evidenceDot: { width: 6, height: 6, borderRadius: 3 },
  evidenceBadgeText: { color: '#A4ADB8', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.7 },
  title: { color: '#F4F1F6', fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.45 },
  body: { color: '#A1AAB6', fontSize: 12, lineHeight: 18 },
  metricRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  metricValue: { color: '#F6F3F8', fontSize: 32, lineHeight: 37, fontWeight: '500', letterSpacing: -0.7 },
  metricCaption: { maxWidth: 235, marginTop: 2, color: '#949EAA', fontSize: 10.5, lineHeight: 15 },
  deltaPill: { minWidth: 104, alignItems: 'center', gap: 2, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: '#0A0E14' },
  deltaValue: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  deltaCaption: { color: '#838E9B', fontSize: 10, lineHeight: 13, textAlign: 'center' },
  chartStage: { marginHorizontal: -7, overflow: 'hidden', borderRadius: 14, backgroundColor: '#05070B' },
  compactEmpty: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#292F38', backgroundColor: '#0B0E13' },
  compactEmptyText: { flex: 1, color: '#909AA7', fontSize: 11, lineHeight: 16 },
  repSummaryRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  repSummary: { minWidth: 102, flexGrow: 1, gap: 1, padding: 10, borderRadius: 12, borderWidth: 1, backgroundColor: '#0B0E14' },
  repName: { fontSize: 11, lineHeight: 14, fontWeight: '900' },
  repValue: { color: '#F0EDF4', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  repDelta: { color: '#87919E', fontSize: 10, lineHeight: 13 },
  barsWrap: { gap: 5, paddingTop: 4 },
  bars: { height: 114, flexDirection: 'row', alignItems: 'flex-end', gap: 5, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#303845' },
  barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', minWidth: 5, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  axisLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { color: '#77818E', fontSize: 10, lineHeight: 13 },
  comparisonKind: { fontSize: 13, lineHeight: 17, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  comparisonFlow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  performanceBox: { flex: 1, minWidth: 0, gap: 4, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: '#303845', backgroundColor: '#0B0E14' },
  performanceDate: { color: '#8B95A2', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  performanceValue: { color: '#F3F0F5', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  performanceEffort: { color: '#A3ACB7', fontSize: 10, lineHeight: 13 },
  comparisonArrow: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, backgroundColor: '#0B0E14' },
  heavyMetrics: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 14, borderWidth: 1, borderColor: '#303845', backgroundColor: '#0A0E14' },
  heavyMetric: { flex: 1, alignItems: 'center', gap: 2 },
  heavyValue: { color: '#F1EEF4', fontSize: 23, lineHeight: 27, fontWeight: '800' },
  heavyLabel: { color: '#8D97A4', fontSize: 10, lineHeight: 13, textAlign: 'center' },
  heavyDivider: { width: StyleSheet.hairlineWidth, height: 42, backgroundColor: '#303845' },
  definition: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 11, borderRadius: 12, backgroundColor: '#0B0F15' },
  definitionText: { flex: 1, color: '#909AA7', fontSize: 10, lineHeight: 15 },
  historicalRow: { gap: 9, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#303845' },
  historicalLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  historicalMarker: { width: 7, height: 7, borderRadius: 4 },
  historicalLabel: { color: '#D8D4DC', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  historicalColumns: { flexDirection: 'row', gap: 9 },
  historicalColumn: { flex: 1, gap: 2, padding: 10, borderRadius: 12, backgroundColor: '#0B0F15' },
  historicalColumnLabel: { color: '#7F8996', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.4 },
  historicalValue: { color: '#F0EDF4', fontSize: 15, lineHeight: 19, fontWeight: '800' },
  historicalDate: { color: '#858F9C', fontSize: 10, lineHeight: 13 },
  sourceCounts: { flexDirection: 'row', gap: 8 },
  sourceCount: { color: '#F2EFF5', fontSize: 22, lineHeight: 26, fontWeight: '800' },
  sourceCountLabel: { maxWidth: 110, color: '#87919E', fontSize: 10, lineHeight: 13 },
  sourcePolicy: { color: '#9BA5B1', fontSize: 10.5, lineHeight: 16 },
  sourceButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, backgroundColor: '#0B0F15' },
  sourceButtonText: { flex: 1, color: '#EAE7EE', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
});
