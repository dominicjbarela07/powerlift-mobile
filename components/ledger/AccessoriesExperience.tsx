import { useLedgerResource } from './use-ledger-resource';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { MuscleMap } from '@/components/anatomy/MuscleMap';
import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { SLAtmosphericContextHeader } from '@/components/ui/sl-contextual-header';
import { Text } from '@/components/ui/sl-text';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import { kilogramsToDisplayValue, roundCalculatedWeightForDisplay } from '@/lib/display-units';
import {
  fetchLedgerExplorationIndex,
  type LedgerAccessoryBest,
  type LedgerAccessoryMovement,
  type LedgerAccessoryProgress,
  type LedgerAccessoriesStory,
  type LedgerMovementSet,
} from '@/lib/ledger-exploration';
import {
  anatomyExposureColor,
  isGovernedMuscleId,
  MUSCLE_META,
  normalizeAnatomyExposure,
  type GovernedMuscleId,
} from '@/lib/anatomy-system';
import { movementHistorySheetRouteForCanonicalIdentity } from '@/lib/movement-history-launch';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';

import { useAthleteLedgerSubject } from './athlete-ledger-subject';
import { ledgerHrefFor } from './routing';

const ACCESSORIES_ATMOSPHERE = require('@/assets/images/ledger-index-v2/ledger-chapter-accessories-v1.png');
const VIOLET = '#A35BFF';
const VIOLET_SOFT = '#C697FF';
const GREEN = '#55E795';

function titleCase(value?: string | null) {
  return String(value || '')
    .replace(/^accessory_/, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readableDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? 'Date unavailable'
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function compactNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString('en-US');
}

function displayWeight(valueKg: number | null | undefined, unit: 'lb' | 'kg') {
  if (valueKg == null || !Number.isFinite(valueKg)) return '—';
  const value = roundCalculatedWeightForDisplay(kilogramsToDisplayValue(valueKg, unit), unit);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function volumeLabel(valueKg: number, unit: 'lb' | 'kg') {
  return compactNumber(kilogramsToDisplayValue(valueKg, unit));
}

function equipmentLabel(source: {
  equipment_manufacturer?: string | null;
  equipment_model?: string | null;
  equipment_type?: string | null;
}) {
  return [source.equipment_manufacturer, source.equipment_model].filter(Boolean).join(' · ')
    || titleCase(source.equipment_type)
    || 'Equipment not recorded';
}

function performanceLabel(performance: LedgerMovementSet, unit: 'lb' | 'kg', assisted = false) {
  const load = `${displayWeight(performance.weight_kg, unit)} ${unit.toUpperCase()}`;
  const reps = performance.reps == null ? '' : ` × ${performance.reps}`;
  return assisted ? `${load} assistance${reps}` : `${load}${reps}`;
}

function percentageChange(current: number, previous: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function compactSignedPercent(value: number | null, matchedContext = false) {
  if (value == null) return 'No comparison';
  const change = `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(0)}%`;
  return matchedContext ? `${change} vs matched` : change;
}

function comparisonLabel(progress: LedgerAccessoryProgress, unit: 'lb' | 'kg') {
  const comparison = progress.comparison;
  const delta = Number(comparison.load_delta_kg || 0);
  const reps = Number(comparison.reps_delta || 0);
  const reserve = Number(comparison.effort_reserve_delta || 0);
  if (progress.assisted && delta < 0) return `${displayWeight(Math.abs(delta), unit)} ${unit.toUpperCase()} less assistance${reps > 0 ? ` · +${reps} reps` : ''}`;
  if (delta > 0 && reps > 0) return `+${displayWeight(delta, unit)} ${unit.toUpperCase()} · +${reps} reps`;
  if (delta > 0) return `+${displayWeight(delta, unit)} ${unit.toUpperCase()} at comparable work`;
  if (reps > 0) return `+${reps} rep${reps === 1 ? '' : 's'} at matched load`;
  if (reserve > 0) return `${reserve.toFixed(1)} more reps in reserve`;
  return 'Comparable performance improved';
}

function MovementSparkline({ points, assisted }: { points: readonly { weight_kg: number; reps?: number | null }[]; assisted?: boolean }) {
  const values = points.map((point) => kilogramsToDisplayValue(point.weight_kg, 'kg'));
  if (values.length < 2) return <View style={styles.sparklineEmpty} />;
  const width = 210;
  const height = 46;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const coordinates = values.map((value, index) => ({
    x: (index / Math.max(1, values.length - 1)) * width,
    y: 7 + ((assisted ? value - min : max - value) / span) * (height - 14),
  }));
  return <Svg accessibilityLabel="Exact comparable performance sparkline" height={height} width="100%" viewBox={`0 0 ${width} ${height}`}>
    <Polyline fill="none" points={coordinates.map((point) => `${point.x},${point.y}`).join(' ')} stroke={VIOLET} strokeWidth={2.2} />
    {coordinates.map((point, index) => <Circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} fill={index === coordinates.length - 1 ? GREEN : VIOLET_SOFT} r={index === coordinates.length - 1 ? 4 : 2.6} />)}
  </Svg>;
}

function EvidenceSparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return <View style={styles.outputSparklineEmpty} />;
  const width = 214;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const coordinates = values.map((value, index) => ({
    x: 4 + (index / Math.max(1, values.length - 1)) * (width - 8),
    y: 5 + ((max - value) / span) * (height - 10),
  }));
  return <Svg accessibilityLabel="Weekly working-set sparkline" height={height} testID="accessory-working-set-chart" width="100%" viewBox={`0 0 ${width} ${height}`}>
    <Polyline fill="none" points={coordinates.map((point) => `${point.x},${point.y}`).join(' ')} stroke="#C05CFF" strokeWidth={2.4} />
    {coordinates.map((point, index) => <Circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} fill={index === coordinates.length - 1 ? GREEN : VIOLET_SOFT} r={index === coordinates.length - 1 ? 4 : 2.7} />)}
  </Svg>;
}

function SectionHeading({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeading}><View style={styles.sectionHeadingCopy}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => pressed && styles.pressed}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

function State({ title, retry }: { title: string; retry?: () => void }) {
  return <View style={styles.state}><Ionicons color={VIOLET_SOFT} name={retry ? 'alert-circle-outline' : 'hourglass-outline'} size={30} /><Text style={styles.stateText}>{title}</Text>{retry ? <Pressable onPress={retry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}</View>;
}

export default function AccessoriesExperience() {
  const router = useRouter();
  const ledgerSubject = useAthleteLedgerSubject();
  const { data, loading, error, load } = useLedgerResource(`accessories:${ledgerSubject.athleteId ?? 'self'}`,
    () => fetchLedgerExplorationIndex(ledgerSubject.athleteId));
  const [anatomyView, setAnatomyView] = useState<'front' | 'rear' | null>(null);
  const { unit, setUnit } = useSurfaceWeightUnit(data?.athlete.preferred_units);


  const story = data?.accessories;
  const movementsById = useMemo(() => new Map((story?.movements || []).map((movement) => [movement.id, movement])), [story?.movements]);
  const primary = useMemo(() => (story?.trained_primary_muscles || []).filter(isGovernedMuscleId) as GovernedMuscleId[], [story?.trained_primary_muscles]);
  const muscleHighlights = useMemo(() => new Map((story?.muscle_groups || [])
    .map((muscle) => [muscle.key, [muscle.key]] as const)), [story?.muscle_groups]);
  const exposure = useMemo(() => normalizeAnatomyExposure(
    (story?.muscle_groups || []).map((muscle) => ({ muscle_id: muscle.key, score: muscle.set_count })),
  ), [story?.muscle_groups]);
  const resolvedAnatomyView = anatomyView
    || (primary[0] && MUSCLE_META[primary[0]].preferred === 'rear' ? 'rear' : 'front');

  if (loading) return <State title="Loading your accessory record." />;
  if (error || !data || !story) return <State title={error instanceof Error ? error.message : 'Accessory evidence is unavailable.'} retry={load} />;

  const openMovement = (movementId: number, equipmentContextDefinitionId?: number | null) => router.push(
    movementHistorySheetRouteForCanonicalIdentity({
      movementDefinitionId: movementId,
      athleteId: data.athlete.id,
      equipmentContextDefinitionId,
    }) as never,
  );
  const openMuscle = (key: string) => router.push({ pathname: `/(tabs)/ledger/muscle-groups/${key}` as any, params: ledgerSubject.routeParams } as never);
  const volumeChange = percentageChange(story.summary.volume_kg, story.comparison.volume_kg);
  const setChange = percentageChange(story.summary.set_count, story.comparison.set_count);

  return <View style={styles.page} testID="ledger-accessories-continuous-experience">
    <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} testID="accessories-unit-toggle" />
    <SLAtmosphericContextHeader
      accent={VIOLET}
      atmosphereSource={ACCESSORIES_ATMOSPHERE}
      backAccessibilityLabel="Back to The Ledger"
      contextLabel="The Ledger · Accessory Record"
      onBack={() => ledgerSubject.returnPath ? router.navigate(ledgerSubject.returnPath as never) : router.replace(ledgerHrefFor('home') as never)}
      subtitle="Where your work has gone, and what has changed."
      testID="accessories-atmospheric-header"
      title="Accessories"
    >
      <View style={styles.periodRail}><View style={styles.periodPill}><Ionicons color={VIOLET_SOFT} name="calendar-outline" size={15} /><Text style={styles.periodText}>{story.period.label}</Text><Text style={styles.periodDates}>{readableDate(story.period.start_date).replace(`, ${new Date(`${story.period.start_date}T12:00:00Z`).getUTCFullYear()}`, '')} – {readableDate(story.period.end_date)}</Text></View></View>
    </SLAtmosphericContextHeader>

    <View style={styles.content}>
      <View style={styles.developmentHero} testID="accessory-development-hero">
        <SectionHeading title="ACCESSORY DEVELOPMENT" subtitle="Relative exposure from performed accessory working sets." />
        <View style={styles.anatomyStage}>
          <MuscleMap athlete={data.athlete} exposure={exposure} framingPreset="hero" mode="exposure" region="full" semanticLevel="week" size="hero" style={styles.anatomy} view={resolvedAnatomyView} testID={`accessories-anatomy-${resolvedAnatomyView}`} />
          <View style={styles.anatomyControls}>
            {(['front', 'rear'] as const).map((view) => <Pressable key={view} accessibilityRole="tab" accessibilityState={{ selected: resolvedAnatomyView === view }} onPress={() => setAnatomyView(view)} style={[styles.anatomyControl, resolvedAnatomyView === view && styles.anatomyControlActive]} testID={`accessories-anatomy-view-${view}`}><Text style={[styles.anatomyControlText, resolvedAnatomyView === view && styles.anatomyControlTextActive]}>{titleCase(view)}</Text></Pressable>)}
          </View>
        </View>
        <View style={styles.muscleEvidence}>
          <View style={styles.evidenceHeader}><Text style={styles.evidenceKicker}>TOP MUSCLE GROUPS</Text><Text style={styles.evidenceScale}>relative to highest exposure</Text></View>
          {story.muscle_groups.slice(0, 5).map((muscle) => <MuscleEvidenceRow key={muscle.key} intensity={isGovernedMuscleId(muscle.key) ? Number(exposure[muscle.key] || 0) : 0} muscle={muscle} onPress={() => openMuscle(muscle.key)} />)}
        </View>
      </View>

      <WorkSnapshot story={story} unit={unit} volumeChange={volumeChange} setChange={setChange} />

      <View style={styles.outputCard}>
        <View testID="accessory-volume-trend">
          <SectionHeading title="ACCESSORY VOLUME" subtitle="Weekly performed external-load volume. Assistance and bodyweight-only sets are excluded." />
          <AnalyticalTimeSeriesChart
            emptyBody="Two weeks with governed external-load evidence are required."
            emptyTitle="Volume trend needs more history"
            height={190}
            metric={analyticalMetricDefinition('accessory_volume', { label: 'Accessory performed volume', kind: 'volume', unit: unit.toUpperCase(), axisUnit: unit.toUpperCase(), includeZero: true, maximumFractionDigits: 0 })}
            series={[{ key: 'volume', label: 'Accessory volume', color: VIOLET, points: story.weekly_trend.map((point) => ({ date: point.date, value: kilogramsToDisplayValue(point.volume_kg, unit) })) }]}
            showLegend={false}
            testID="accessory-volume-chart"
          />
        </View>
        <View style={styles.workingSetStrip} testID="accessory-working-set-trend">
          <View style={styles.workingSetCopy}>
            <View style={styles.workingSetTitleRow}><Ionicons color={VIOLET_SOFT} name="list-outline" size={15} /><Text style={styles.workingSetTitle}>WORKING SETS</Text></View>
            <View style={styles.workingSetValueRow}><Text style={styles.workingSetValue}>{story.summary.set_count}</Text><View style={styles.workingSetContext}><Text style={styles.workingSetLabel}>this block</Text><Text style={styles.workingSetDelta}>{compactSignedPercent(setChange)}</Text></View></View>
          </View>
          <View style={styles.workingSetSparkline}><EvidenceSparkline values={story.weekly_trend.map((point) => point.set_count)} /></View>
        </View>
      </View>

      <View testID="movements-making-progress">
        <SectionHeading title="MOVEMENTS MAKING PROGRESS" subtitle="Only exact, policy-compatible comparisons are shown." />
        {story.progress.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressRail}>{story.progress.slice(0, 5).map((item) => {
          const movement = movementsById.get(item.movement_id);
          if (!movement) return null;
          return <ProgressCard key={item.identity_key} item={item} movement={movement} unit={unit} onPress={() => openMovement(item.movement_id, item.current.equipment_identity_id)} />;
        })}</ScrollView> : <CompactEmpty title="No comparable change yet" body="Your exact accessory history is preserved, but this block does not contain a qualified improvement comparison." />}
      </View>

      <View testID="recent-accessory-bests">
        <SectionHeading title="RECENT ACCESSORY BESTS" subtitle="Meaningful bests from exact comparable evidence." />
        {story.recent_bests.length ? <View style={styles.listCard}>{story.recent_bests.slice(0, 5).map((best) => {
          const movement = movementsById.get(best.movement_id);
          if (!movement) return null;
          return <BestRow key={best.identity_key} best={best} movement={movement} unit={unit} onPress={() => openMovement(best.movement_id, best.performance.equipment_identity_id)} />;
        })}</View> : <CompactEmpty title="No new accessory bests in this block" body="A best appears only when exact comparable evidence exceeds the athlete's earlier record." />}
      </View>

      <View testID="accessories-your-movements">
        <SectionHeading title="YOUR MOVEMENTS" subtitle={`${story.summary.movement_count} performed movements · grouped by primary muscle`} />
        <View style={styles.listCard}>{story.muscle_groups.map((muscle) => <Pressable key={muscle.key} accessibilityRole="button" onPress={() => openMuscle(muscle.key)} style={({ pressed }) => [styles.libraryRow, pressed && styles.pressed]}><View style={styles.libraryIcon}>{isGovernedMuscleId(muscle.key) ? <MuscleMap athlete={data.athlete} framingPreset="thumbnail" primary={muscleHighlights.get(muscle.key)} semanticLevel="session" size="thumbnail" style={styles.libraryAnatomy} view="auto" /> : <Ionicons color={VIOLET_SOFT} name="body-outline" size={22} />}</View><View style={styles.libraryCopy}><Text style={styles.libraryName}>{titleCase(muscle.key)}</Text><Text style={styles.libraryMeta}>{muscle.movement_count} movement{muscle.movement_count === 1 ? '' : 's'} · {muscle.set_count} working sets</Text></View><Ionicons color="#89919E" name="chevron-forward" size={18} /></Pressable>)}</View>
      </View>

      <View testID="accessory-history-preview">
        <SectionHeading title="RECENT ACCESSORY SESSIONS" subtitle="Chronological evidence from this block." />
        <View style={styles.listCard}>{story.recent_sessions.slice(0, 5).map((session) => <Pressable key={session.id} accessibilityRole="button" onPress={() => router.push({ pathname: `/(tabs)/ledger/archive/session/${session.id}` as any, params: ledgerSubject.routeParams } as never)} style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}><View><Text style={styles.sessionDate}>{readableDate(session.date)}</Text><Text style={styles.sessionTitle}>{session.label}</Text></View><View style={styles.sessionMetrics}><Text style={styles.sessionValue}>{session.set_count} sets</Text><Text style={styles.sessionMeta}>{session.movement_count} movements · {volumeLabel(session.volume_kg, unit)} {unit.toUpperCase()}</Text></View><Ionicons color="#89919E" name="chevron-forward" size={18} /></Pressable>)}</View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: ledgerHrefFor('archive'), params: { collection: 'training', classification: 'accessory', ...ledgerSubject.routeParams } } as never)} style={({ pressed }) => [styles.fullHistory, pressed && styles.pressed]} testID="view-full-accessory-history"><View style={styles.fullHistoryIcon}><Ionicons color={VIOLET_SOFT} name="book" size={24} /></View><View style={styles.fullHistoryCopy}><Text style={styles.fullHistoryTitle}>View Full Accessory History</Text><Text style={styles.fullHistoryBody}>Every Session and performed set, preserved with exact identity.</Text></View><Ionicons color={VIOLET_SOFT} name="chevron-forward" size={20} /></Pressable>
    </View>
  </View>;
}

function MuscleEvidenceRow({ muscle, intensity, onPress }: { muscle: LedgerAccessoriesStory['muscle_groups'][number]; intensity: number; onPress: () => void }) {
  const percent = Math.round(Math.max(0, Math.min(1, intensity)) * 100);
  return <Pressable accessibilityLabel={`${titleCase(muscle.key)}, ${muscle.set_count} performed working sets, ${percent}% relative exposure`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.muscleRow, pressed && styles.pressed]}><Text style={styles.muscleName}>{titleCase(muscle.key)}</Text><View style={styles.muscleTrack}><View style={[styles.muscleFill, { width: `${Math.max(4, percent)}%`, backgroundColor: anatomyExposureColor(intensity) }]} /></View><View style={styles.muscleCount}><Text style={styles.muscleCountValue}>{muscle.set_count}</Text><Text style={styles.muscleCountLabel}>{percent}%</Text></View><Ionicons color="#89919E" name="chevron-forward" size={16} /></Pressable>;
}

function WorkSnapshot({ story, unit, volumeChange, setChange }: { story: LedgerAccessoriesStory; unit: 'lb' | 'kg'; volumeChange: number | null; setChange: number | null }) {
  const metrics = [
    { icon: 'barbell-outline' as const, value: volumeLabel(story.summary.volume_kg, unit), suffix: unit.toUpperCase(), label: 'Performed volume', detail: compactSignedPercent(volumeChange, true), emphasis: true },
    { icon: 'list-outline' as const, value: String(story.summary.set_count), suffix: '', label: 'Working sets', detail: compactSignedPercent(setChange), emphasis: true },
    { icon: 'walk-outline' as const, value: String(story.summary.movement_count), suffix: '', label: 'Exact movements', detail: '', emphasis: false },
    { icon: 'body-outline' as const, value: String(story.summary.muscle_group_count), suffix: '', label: 'Muscle groups', detail: '', emphasis: false },
  ];
  return <View style={styles.evidenceBand} testID="accessory-work-snapshot">{metrics.map((metric, index) => <React.Fragment key={metric.label}>{index ? <View style={styles.evidenceDivider} /> : null}<View style={[styles.evidenceMetric, metric.emphasis ? styles.evidenceMetricWide : styles.evidenceMetricCompact]}><View style={styles.evidenceIcon}><Ionicons color={VIOLET_SOFT} name={metric.icon} size={14} /></View><View style={styles.evidenceValueRow}><Text adjustsFontSizeToFit minimumFontScale={0.84} numberOfLines={1} style={styles.evidenceValue}>{metric.value}</Text>{metric.suffix ? <Text style={styles.evidenceUnit}>{metric.suffix}</Text> : null}</View><Text numberOfLines={2} style={styles.evidenceLabel}>{metric.label}</Text>{metric.detail ? <Text numberOfLines={1} style={styles.evidenceDetail}>{metric.detail}</Text> : <View style={styles.evidenceDetailSpacer} />}</View></React.Fragment>)}</View>;
}

function ProgressCard({ item, movement, unit, onPress }: { item: LedgerAccessoryProgress; movement: LedgerAccessoryMovement; unit: 'lb' | 'kg'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.progressCard, pressed && styles.pressed]}><CanonicalMovementArtwork movement={movement} size={92} style={styles.progressArt} testID="accessories-progress-canonical-artwork" /><Text numberOfLines={2} style={styles.progressName}>{movement.name}</Text><Text numberOfLines={1} style={styles.progressEquipment}>{equipmentLabel(item.current)}</Text><Text style={styles.progressCurrent}>{performanceLabel(item.current, unit, item.assisted)}</Text><Text numberOfLines={1} style={styles.progressPrior}>Previous: {performanceLabel(item.prior, unit, item.assisted)}</Text><Text numberOfLines={2} style={styles.progressChange}>{comparisonLabel(item, unit)}</Text><MovementSparkline assisted={item.assisted} points={item.trend} /></Pressable>;
}

function BestRow({ best, movement, unit, onPress }: { best: LedgerAccessoryBest; movement: LedgerAccessoryMovement; unit: 'lb' | 'kg'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.bestRow, pressed && styles.pressed]}><CanonicalMovementArtwork movement={movement} size={50} style={styles.bestArt} testID="accessories-best-canonical-artwork" /><View style={styles.bestCopy}><Text numberOfLines={1} style={styles.bestName}>{movement.name}</Text><Text numberOfLines={1} style={styles.bestEquipment}>{equipmentLabel(best.performance)}</Text><Text style={styles.bestDate}>{readableDate(best.occurred_on)}</Text></View><View style={styles.bestValueWrap}><Text style={styles.bestValue}>{performanceLabel(best.performance, unit, best.assisted)}</Text><View style={styles.bestPill}><Text style={styles.bestPillText}>{best.best_type}</Text></View></View><Ionicons color="#89919E" name="chevron-forward" size={17} /></Pressable>;
}

function CompactEmpty({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><Ionicons color="#8567A7" name="analytics-outline" size={23} /><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { paddingBottom: 24 },
  content: { gap: 16, paddingHorizontal: 14, paddingTop: 14 },
  periodRail: { paddingHorizontal: 62, paddingBottom: 7 },
  periodPill: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 11, borderRadius: 19, borderWidth: 1, borderColor: '#6F4896', backgroundColor: 'rgba(8,5,13,0.88)' },
  periodText: { color: '#EEE8F4', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  periodDates: { color: '#A49CAC', fontSize: 10.5, lineHeight: 14 },
  sectionHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, paddingHorizontal: 2, paddingVertical: 7 },
  sectionHeadingCopy: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { color: '#D2A8FF', fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 0.65 },
  sectionSubtitle: { color: '#9297A4', fontSize: 11.5, lineHeight: 16 },
  sectionAction: { color: VIOLET_SOFT, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  developmentHero: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#503365', backgroundColor: '#09070D', padding: 11 },
  anatomyStage: { minHeight: 348, alignItems: 'center', overflow: 'hidden', borderRadius: 13, backgroundColor: '#050609' },
  anatomy: { width: '100%', height: 318 },
  anatomyControls: { flexDirection: 'row', gap: 5, position: 'absolute', bottom: 8, padding: 3, borderRadius: 18, backgroundColor: 'rgba(7,8,12,0.92)' },
  anatomyControl: { minWidth: 70, minHeight: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#3C3546', backgroundColor: 'rgba(8,9,13,0.94)' },
  anatomyControlActive: { borderColor: VIOLET, backgroundColor: '#5D22A2' },
  anatomyControlText: { color: '#ABA5B2', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  anatomyControlTextActive: { color: '#FFFFFF' },
  muscleEvidence: { gap: 1, paddingTop: 11, paddingRight: 48 },
  evidenceHeader: { minHeight: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  evidenceKicker: { color: '#AF79E6', fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.6 },
  evidenceScale: { flex: 1, color: '#777F8C', fontSize: 10, lineHeight: 13, textAlign: 'right' },
  muscleRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#262330' },
  muscleName: { width: 86, color: '#D7D3DC', fontSize: 12.5, lineHeight: 17, fontWeight: '600' },
  muscleTrack: { flex: 1, height: 9, overflow: 'hidden', borderRadius: 5, backgroundColor: '#242733' },
  muscleFill: { height: '100%', borderRadius: 5, backgroundColor: VIOLET },
  muscleCount: { width: 36, alignItems: 'flex-end' },
  muscleCountValue: { color: '#F0ECF4', fontSize: 14, lineHeight: 17, fontWeight: '700' },
  muscleCountLabel: { color: '#777F8C', fontSize: 10, lineHeight: 12 },
  evidenceBand: { minHeight: 105, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: '#343B48', backgroundColor: '#090C12' },
  evidenceMetric: { minWidth: 0, justifyContent: 'flex-start', paddingHorizontal: 7 },
  evidenceMetricWide: { flex: 1.24 },
  evidenceMetricCompact: { flex: 0.86 },
  evidenceDivider: { width: StyleSheet.hairlineWidth, marginVertical: 3, backgroundColor: '#292F39' },
  evidenceIcon: { height: 19, justifyContent: 'center' },
  evidenceValueRow: { minHeight: 28, flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  evidenceValue: { color: '#F1EDF5', fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.4 },
  evidenceUnit: { color: '#B8AEC2', fontSize: 10, lineHeight: 14, fontWeight: '800' },
  evidenceLabel: { color: '#BEB5C8', fontSize: 10.5, lineHeight: 13, fontWeight: '700' },
  evidenceDetail: { marginTop: 2, color: '#A988C3', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  evidenceDetailSpacer: { height: 15 },
  outputCard: { overflow: 'hidden', paddingHorizontal: 10, paddingTop: 7, paddingBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: '#303743', backgroundColor: '#080B10' },
  workingSetStrip: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 7, paddingHorizontal: 4, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#343A45' },
  workingSetCopy: { width: 144, gap: 5 },
  workingSetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  workingSetTitle: { color: '#C7A0EA', fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.55 },
  workingSetValueRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  workingSetValue: { color: '#F1EDF5', fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6 },
  workingSetContext: { flex: 1, minWidth: 0, gap: 1 },
  workingSetLabel: { color: '#8D929D', fontSize: 10, lineHeight: 13 },
  workingSetDelta: { color: '#B394CB', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  workingSetSparkline: { flex: 1, minWidth: 0, justifyContent: 'center' },
  outputSparklineEmpty: { height: 48 },
  progressRail: { gap: 10, paddingRight: 14 },
  progressCard: { width: 232, minHeight: 286, overflow: 'hidden', gap: 4, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#5C3974', backgroundColor: '#0B0910' },
  progressArt: { width: '100%', height: 82, overflow: 'hidden', borderRadius: 10, backgroundColor: '#100C17' },
  progressName: { minHeight: 38, color: '#F0ECF3', fontSize: 15, lineHeight: 19, fontWeight: '700' },
  progressEquipment: { color: '#8E8795', fontSize: 11, lineHeight: 15 },
  progressCurrent: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '700' },
  progressPrior: { color: '#898E99', fontSize: 11, lineHeight: 15 },
  progressChange: { minHeight: 32, color: GREEN, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  sparklineEmpty: { height: 46 },
  listCard: { overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: '#303743', backgroundColor: '#080B10' },
  bestRow: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2A303A' },
  bestArt: { width: 52, height: 52, overflow: 'hidden', borderRadius: 9, backgroundColor: '#100C17' },
  bestCopy: { flex: 1, minWidth: 0, gap: 2 },
  bestName: { color: '#E7E3EA', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  bestEquipment: { color: '#89828F', fontSize: 10.5, lineHeight: 14 },
  bestDate: { color: '#727A86', fontSize: 10, lineHeight: 13 },
  bestValueWrap: { maxWidth: 132, alignItems: 'flex-end', gap: 5 },
  bestValue: { color: '#F0ECF3', fontSize: 12.5, lineHeight: 17, fontWeight: '700', textAlign: 'right' },
  bestPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: '#59258B' },
  bestPillText: { color: '#E4C3FF', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  libraryRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292F38' },
  libraryIcon: { width: 51, height: 51, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10, backgroundColor: '#130D1A' },
  libraryAnatomy: { width: 42, height: 45 },
  libraryCopy: { flex: 1, minWidth: 0, gap: 2 },
  libraryName: { color: '#E4E0E7', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  libraryMeta: { color: '#858C98', fontSize: 11, lineHeight: 15 },
  sessionRow: { minHeight: 73, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292F38' },
  sessionDate: { color: '#9E75CC', fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  sessionTitle: { color: '#E2DEE6', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  sessionMetrics: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 2 },
  sessionValue: { color: '#E6E2E9', fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  sessionMeta: { color: '#7D8490', fontSize: 10, lineHeight: 13, textAlign: 'right' },
  fullHistory: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#3B4553', backgroundColor: '#0A0D13' },
  fullHistoryIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#221330' },
  fullHistoryCopy: { flex: 1, minWidth: 0, gap: 3 },
  fullHistoryTitle: { color: '#F0ECF3', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  fullHistoryBody: { color: '#898F9B', fontSize: 11, lineHeight: 15 },
  empty: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: '#303743', backgroundColor: '#090B10' },
  emptyCopy: { flex: 1, minWidth: 0, gap: 3 },
  emptyTitle: { color: '#E1DDE5', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  emptyBody: { color: '#858C98', fontSize: 11, lineHeight: 16 },
  state: { minHeight: 520, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  stateText: { color: '#BDB8C4', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 11, borderWidth: 1, borderColor: '#76509B' },
  retryText: { color: '#D1B2F3', fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
});
