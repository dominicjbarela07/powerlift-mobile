import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { Text } from '@/components/ui/sl-text';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { MuscleMap } from '@/components/anatomy/MuscleMap';
import { SLColors } from '@/constants/theme';
import { displayWeight, type LedgerUnit } from '@/lib/ledger-data';
import { kilogramsToDisplayValue } from '@/lib/display-units';
import {
  fetchLedgerExplorationIndex,
  fetchLedgerMovementHistory,
  type LedgerExplorationIndex,
  type LedgerMovementHistory,
  type LedgerMovementProgress,
  type LedgerMovementSet,
} from '@/lib/ledger-exploration';
import { canonicalAccessoryMuscleRegionKey, type AccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';
import { isGovernedMuscleId } from '@/lib/anatomy-system';
import { ledgerHrefFor } from './routing';
import { movementHistorySheetRouteForCanonicalIdentity } from '@/lib/movement-history-launch';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';

type ExplorationKind = 'accessories' | 'variants';

const FAMILY_TONES: Record<string, string> = {
  squat: '#A563E8',
  bench: '#D24F86',
  deadlift: '#E05C69',
  press: '#E7A34E',
};

function prettify(value?: string | null) {
  return String(value || '').replace(/^accessory_/, '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value?: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function loadLabel(weightKg?: number | null, reps?: number | null, unit: LedgerUnit = 'lb') {
  if (weightKg == null) return '—';
  return `${displayWeight(weightKg, unit)} ${unit.toUpperCase()}${reps ? ` × ${reps}` : ''}`;
}

function volumeNumber(valueKg: number, unit: LedgerUnit) {
  return Math.round(kilogramsToDisplayValue(valueKg, unit)).toLocaleString('en-US');
}

function MiniTrend({ values, tone, height = 54 }: { values: readonly number[]; tone: string; height?: number }) {
  if (values.length < 2) return <View style={[styles.emptyTrend, { height }]}><Text style={styles.emptyTrendText}>More exact evidence is needed for a trend.</Text></View>;
  const width = 310;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = Math.max(1, high - low);
  const points = values.map((value, index) => `${8 + index * ((width - 16) / (values.length - 1))},${height - 8 - ((value - low) / spread) * (height - 16)}`).join(' ');
  return <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}><Line x1="7" x2={width - 7} y1={height - 7} y2={height - 7} stroke="#29313B" /><Polyline points={points} fill="none" stroke={tone} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

function useExploration() {
  const [data, setData] = useState<LedgerExplorationIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = () => {
    setLoading(true);
    setError(null);
    fetchLedgerExplorationIndex().then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'Ledger movement evidence could not be loaded.')).finally(() => setLoading(false));
  };
  useEffect(reload, []);
  return { data, loading, error, reload };
}

function State({ title, error, onRetry }: { title: string; error?: boolean; onRetry?: () => void }) {
  return <View style={styles.state}><Ionicons name={error ? 'alert-circle-outline' : 'hourglass-outline'} size={28} color="#B68DEB" /><Text style={styles.stateTitle}>{title}</Text>{onRetry ? <Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}</View>;
}

function RoomHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={styles.roomHeader}><Text style={styles.roomKicker}>THE LEDGER</Text><Text style={styles.roomTitle}>{title}</Text><Text style={styles.roomSubtitle}>{subtitle}</Text></View>;
}

function ContextBar({ data, unit }: { data: LedgerExplorationIndex; unit: LedgerUnit }) {
  const context = data.context;
  const progress = context.block_progress == null ? null : Math.round(context.block_progress * 100);
  return <View testID="ledger-context-bar" style={styles.contextBar}><View style={styles.contextPrimary}><Text style={styles.contextKicker}>{context.block?.name || 'NO CURRENT BLOCK'}</Text><Text style={styles.contextDetail}>{context.week_number ? `Week ${context.week_number}${context.total_weeks ? ` of ${context.total_weeks}` : ''}` : 'No dated week'} · {context.block_completed_sessions}/{context.block_total_sessions || '—'} sessions</Text></View><View style={styles.contextFacts}><View><Text style={styles.contextFactValue}>{context.bodyweight_kg ? `${displayWeight(context.bodyweight_kg, unit)} ${unit}` : '—'}</Text><Text style={styles.contextFactLabel}>BODYWEIGHT</Text></View><View><Text style={styles.contextFactValue}>{context.training_frequency_per_week.toFixed(1)}</Text><Text style={styles.contextFactLabel}>SESSIONS/WK</Text></View><View style={styles.contextProgress}><Text style={styles.contextFactValue}>{progress == null ? '—' : `${progress}%`}</Text><Text style={styles.contextFactLabel}>BLOCK</Text></View></View></View>;
}

function ExplorationUnitToolbar({ unit, onChange }: { unit: LedgerUnit; onChange: (unit: LedgerUnit) => void }) {
  return <FloatingDisplayUnitRegistration unit={unit} onChange={onChange} testID="ledger-exploration-unit-toggle" />;
}

function Tabs<T extends string>({ values, value, onChange }: { values: readonly T[]; value: T; onChange: (value: T) => void }) {
  return <View accessibilityRole="tablist" style={styles.tabs}>{values.map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => onChange(tab)} style={[styles.tab, tab === value && styles.tabActive]}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{tab}</Text></Pressable>)}</View>;
}

function MovementArtwork({ movement, size = 58 }: { movement: LedgerMovementProgress; size?: number }) {
  return <CanonicalMovementArtwork movement={movement} size={size} style={styles.artworkFrame} testID="ledger-canonical-movement-artwork" />;
}

function MovementRow({ movement, unit, tone, onPress }: { movement: LedgerMovementProgress; unit: LedgerUnit; tone: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.movementRow, pressed && styles.pressed]}><MovementArtwork movement={movement} /><View style={styles.movementCopy}><Text style={styles.movementName}>{movement.name}</Text><Text style={styles.movementMeta}>{prettify(movement.primary_muscle_group || movement.core_family || movement.family)} · {prettify(movement.equipment_type)}</Text><Text style={styles.movementDate}>{dateLabel(movement.last_performed_on)}</Text></View><View style={styles.movementValueWrap}><Text style={[styles.movementValue, { color: tone }]}>{loadLabel(movement.best_weight_kg || movement.latest_weight_kg, movement.best_reps || movement.latest_reps, unit)}</Text><Text style={styles.movementVolume}>{volumeNumber(movement.volume_kg, unit)} {unit} volume</Text></View><Ionicons name="chevron-forward" size={15} color="#737C88" /></Pressable>;
}

export function MovementCollectionExperience({ kind }: { kind: ExplorationKind }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ muscle?: string; equipment?: string }>();
  const { data, loading, error, reload } = useExploration();
  const { unit, setUnit } = useSurfaceWeightUnit(data?.athlete.preferred_units);
  const [tab, setTab] = useState<'Overview' | 'By Muscle' | 'History'>('Overview');
  const movements = useMemo(() => {
    const source = data?.movements ?? [];
    return source.filter((movement) => {
      const typeMatch = kind === 'variants' ? movement.core_kind === 'variant' : movement.kind !== 'core';
      const muscleMatch = !params.muscle || canonicalAccessoryMuscleRegionKey(movement.primary_muscle_group || movement.body_region || movement.family) === params.muscle;
      const equipmentMatch = !params.equipment || movement.equipment_type === params.equipment;
      return typeMatch && muscleMatch && equipmentMatch;
    });
  }, [data?.movements, kind, params.equipment, params.muscle]);

  if (loading) return <State title={`Loading ${kind} evidence.`} />;
  if (error || !data) return <State title={error || 'Ledger movement evidence is unavailable.'} error onRetry={reload} />;
  const totalVolume = movements.reduce((sum, movement) => sum + movement.volume_kg, 0);
  const maxVolume = Math.max(1, ...movements.map((movement) => movement.volume_kg));
  const openMovement = (movement: LedgerMovementProgress) => router.push(
    movementHistorySheetRouteForCanonicalIdentity({ movementDefinitionId: movement.id, displayUnit: unit }) as any,
  );
  const sorted = [...movements].sort((left, right) => tab === 'History'
    ? String(right.last_performed_on || '').localeCompare(String(left.last_performed_on || ''))
    : right.volume_kg - left.volume_kg);

  return <View testID={`ledger-${kind}-experience`} style={styles.page}>
    <RoomHeader title={kind === 'variants' ? 'Variants' : 'Accessories'} subtitle={kind === 'variants' ? 'Independent progress for alternate core movements.' : 'Every accessory movement, tracked with exact identity.'} />
    <View style={styles.inset}><ExplorationUnitToolbar unit={unit} onChange={setUnit} /><Tabs values={['Overview', 'By Muscle', 'History'] as const} value={tab} onChange={setTab} /><ContextBar data={data} unit={unit} /></View>
    <View style={styles.inset}>
      <View style={styles.collectionHero}><View><Text style={styles.sectionKicker}>{kind === 'variants' ? 'CORE VARIANT RECORD' : 'ACCESSORY RECORD'}</Text><Text style={styles.collectionHeroValue}>{movements.length}</Text><Text style={styles.collectionHeroLabel}>MOVEMENTS WITH EXACT EVIDENCE</Text></View><View style={styles.collectionHeroSide}><Text style={styles.collectionHeroVolume}>{volumeNumber(totalVolume, unit)}</Text><Text style={styles.collectionHeroVolumeLabel}>{unit.toUpperCase()} PERFORMED VOLUME</Text></View></View>
      {params.muscle || params.equipment ? <View style={styles.activeFilter}><Text style={styles.activeFilterText}>FILTERED · {prettify(params.muscle || params.equipment)}</Text><Pressable onPress={() => router.setParams({ muscle: undefined, equipment: undefined })}><Ionicons name="close" size={17} color="#C8B1EC" /></Pressable></View> : null}
    </View>
    <View style={styles.inset}>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{tab === 'By Muscle' ? 'MUSCLE-LED MOVEMENTS' : tab === 'History' ? 'RECENTLY PERFORMED' : 'TOP MOVEMENTS'}</Text><Text style={styles.sectionMeta}>{movements.length} EXACT IDENTITIES</Text></View>
      {sorted.length ? <View style={styles.movementList}>{sorted.map((movement) => {
        const tone = kind === 'variants' ? FAMILY_TONES[movement.core_family || ''] || '#A873E8' : '#8C6ADB';
        return <View key={movement.id}><MovementRow movement={movement} unit={unit} tone={tone} onPress={() => openMovement(movement)} /><View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: `${Math.max(2, (movement.volume_kg / maxVolume) * 100)}%`, backgroundColor: tone }]} /></View></View>;
      })}</View> : <View style={styles.emptyCollection}><Text style={styles.emptyCollectionTitle}>No canonical {kind} evidence yet.</Text><Text style={styles.emptyCollectionBody}>This view only includes movements connected to immutable performed-set identity.</Text></View>}
    </View>
    <View style={styles.inset}><Pressable onPress={() => router.push(ledgerHrefFor('filters') as any)} style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}><Ionicons name="options-outline" size={18} color="#B793E8" /><Text style={styles.footerLinkText}>Filter this record</Text><Ionicons name="arrow-forward" size={16} color="#7E8793" /></Pressable></View>
  </View>;
}

export function MovementDetailExperience({ movementId, mode }: { movementId: number; mode?: 'accessory' | 'variant' }) {
  const router = useRouter();
  const { data, loading, error, reload } = useExploration();
  const { unit, setUnit } = useSurfaceWeightUnit(data?.athlete.preferred_units);
  const [history, setHistory] = useState<LedgerMovementHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tab, setTab] = useState<'Overview' | 'History' | 'PRs'>('Overview');
  const movement = data?.movements.find((item) => item.id === movementId);

  useEffect(() => {
    if (!data?.athlete.id || !movementId) return;
    let active = true;
    setHistoryLoading(true);
    fetchLedgerMovementHistory(data.athlete.id, movementId).then((value) => { if (active) setHistory(value); }).catch(() => { if (active) setHistory(null); }).finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [data?.athlete.id, movementId]);

  if (loading) return <State title="Loading movement evidence." />;
  if (error || !data) return <State title={error || 'Movement evidence is unavailable.'} error onRetry={reload} />;
  if (!movement) return <State title="This movement has no visible evidence in the Ledger." error />;
  const region = canonicalAccessoryMuscleRegionKey(movement.primary_muscle_group || movement.body_region || movement.family);
  const tone = mode === 'variant' ? FAMILY_TONES[movement.core_family || ''] || '#A66AE4' : '#9A66E7';
  const sets = history?.sets ?? [];
  const comparable = Boolean(history?.comparison_allowed);
  const trend = comparable ? [...sets].reverse().map((set) => set.weight_kg) : [];
  const bestSet = comparable ? [...sets].sort((left, right) => right.weight_kg - left.weight_kg || (right.reps || 0) - (left.reps || 0))[0] : sets[0];

  return <View testID="ledger-movement-detail-experience" style={styles.page}>
    <RoomHeader title={movement.name} subtitle={`${prettify(region)} · ${prettify(movement.equipment_type)}`} />
    <View style={styles.inset}><ExplorationUnitToolbar unit={unit} onChange={setUnit} /><Tabs values={['Overview', 'History', 'PRs'] as const} value={tab} onChange={setTab} /></View>
    <View style={styles.inset}>
      <View style={[styles.movementHero, { borderColor: `${tone}66` }]}><CanonicalMovementArtwork movement={movement} size={92} style={styles.movementHeroArt} testID="ledger-history-canonical-movement-artwork" /><View style={styles.movementHeroCopy}><Text style={[styles.sectionKicker, { color: tone }]}>{mode === 'variant' ? `${prettify(movement.core_family)} VARIANT` : `${prettify(region)} ACCESSORY`}</Text><Text style={styles.movementHeroValue}>{loadLabel(bestSet?.weight_kg || movement.latest_weight_kg, bestSet?.reps || movement.latest_reps, unit)}</Text><Text style={styles.movementHeroLabel}>{comparable ? 'BEST EXACT PERFORMANCE' : 'LATEST EXACT PERFORMANCE'}</Text><Text style={styles.movementHeroDate}>{dateLabel(bestSet?.date || movement.last_performed_on)}</Text></View></View>
    </View>
    {tab === 'PRs' ? <View style={styles.inset}><View style={styles.policyNotice}><Ionicons name="shield-checkmark-outline" size={20} color="#C5A4F1" /><View style={styles.policyCopy}><Text style={styles.policyTitle}>Recognition follows governed identity.</Text><Text style={styles.policyBody}>{mode === 'variant' ? 'Only canonical core accomplishment events appear as PRs. Exact set history remains available below.' : 'Accessory recognition is currently disabled by the movement identity platform, so no PR was invented for this movement.'}</Text></View></View></View> : null}
    {tab !== 'PRs' ? <>
      <View style={styles.inset}><View style={styles.detailMetrics}><View><Text style={styles.detailMetricValue}>{movement.set_count}</Text><Text style={styles.detailMetricLabel}>SETS</Text></View><View><Text style={styles.detailMetricValue}>{movement.session_count}</Text><Text style={styles.detailMetricLabel}>SESSIONS</Text></View><View><Text style={styles.detailMetricValue}>{volumeNumber(movement.volume_kg, unit)}</Text><Text style={styles.detailMetricLabel}>{unit.toUpperCase()} VOLUME</Text></View></View></View>
      <View style={styles.inset}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>PERFORMANCE OVER TIME</Text><Text style={styles.sectionMeta}>{comparable ? 'EXACT IDENTITY' : 'CONTEXT ONLY'}</Text></View><View style={styles.detailTrend}><MiniTrend values={trend} tone={tone} height={116} /></View></View>
      <View style={styles.inset}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{tab === 'History' ? 'COMPLETE RECENT HISTORY' : 'RECENT EVIDENCE'}</Text><Text style={styles.sectionMeta}>{historyLoading ? 'LOADING' : `${sets.length} SETS`}</Text></View><View style={styles.setList}>{sets.slice(0, tab === 'History' ? 49 : 6).map((set) => <SetEvidenceRow key={set.id} set={set} tone={tone} unit={unit} onPress={() => router.push(`/(tabs)/ledger/archive/set/${set.id}` as any)} />)}</View></View>
      <View style={styles.inset}><View style={styles.equipmentCard}><Text style={styles.sectionKicker}>EQUIPMENT CONTEXT</Text><Text style={styles.equipmentTitle}>{[movement.equipment_manufacturer, movement.equipment_model].filter(Boolean).join(' · ') || prettify(movement.equipment_type)}</Text><Text style={styles.equipmentBody}>{movement.comparison_scope ? `${prettify(movement.comparison_scope)} · ${prettify(movement.comparison_confidence)} confidence` : 'Comparison policy unavailable'}</Text></View></View>
    </> : null}
  </View>;
}

function SetEvidenceRow({ set, tone, unit, onPress }: { set: LedgerMovementSet; tone: string; unit: LedgerUnit; onPress: () => void }) {
  return <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.setRow, pressed && styles.pressed]}><View><Text style={styles.setDate}>{dateLabel(set.date)}</Text><Text style={styles.setMeta}>{set.rpe != null ? `RPE ${set.rpe}` : set.rir != null ? `${set.rir} RIR` : 'Effort not recorded'}</Text></View><Text style={[styles.setLoad, { color: tone }]}>{loadLabel(set.weight_kg, set.reps, unit)}</Text><Ionicons name="chevron-forward" size={15} color="#707986" /></Pressable>;
}

export function MuscleGroupsExperience() {
  const router = useRouter();
  const { data, loading, error, reload } = useExploration();
  const { unit, setUnit } = useSurfaceWeightUnit(data?.athlete.preferred_units);
  const [selected, setSelected] = useState<AccessoryMuscleRegionKey>('chest');
  if (loading) return <State title="Loading muscle-group evidence." />;
  if (error || !data) return <State title={error || 'Muscle-group evidence is unavailable.'} error onRetry={reload} />;
  const groups = data.muscle_groups.map((group) => ({ ...group, region: canonicalAccessoryMuscleRegionKey(group.key) }));
  const selectedGroup = groups.find((group) => group.region === selected) || groups[0];
  const activeRegion = selectedGroup?.region || selected;
  const maxVolume = Math.max(1, ...groups.map((group) => group.volume_kg));
  return <View testID="ledger-muscle-groups-experience" style={styles.page}>
    <RoomHeader title="Muscle Groups" subtitle="Performed training volume and movement balance." />
    <View style={styles.inset}><ExplorationUnitToolbar unit={unit} onChange={setUnit} /><ContextBar data={data} unit={unit} /></View>
    <View style={styles.inset}><View style={styles.muscleHero}><MuscleMap athlete={data.athlete} primary={isGovernedMuscleId(activeRegion) ? [activeRegion] : []} size="card" view="auto" /><View style={styles.muscleHeroCopy}><Text style={styles.sectionKicker}>MUSCLE BALANCE</Text><Text style={styles.muscleHeroTitle}>{prettify(activeRegion)}</Text><Text style={styles.muscleHeroValue}>{selectedGroup ? volumeNumber(selectedGroup.volume_kg, unit) : '—'} <Text style={styles.muscleHeroUnit}>{unit.toUpperCase()} VOLUME</Text></Text><Text style={styles.muscleHeroBody}>{selectedGroup ? `${selectedGroup.movement_count} movements · ${selectedGroup.set_count} sets` : 'No performed evidence'}</Text><Pressable disabled={!selectedGroup} onPress={() => selectedGroup && router.push(`/(tabs)/ledger/muscle-groups/${selectedGroup.region}` as any)} style={styles.detailButton}><Text style={styles.detailButtonText}>View detailed breakdown</Text><Ionicons name="arrow-forward" size={14} color="#CCB1F1" /></Pressable></View></View></View>
    <View style={styles.inset}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>VOLUME BY MUSCLE GROUP</Text><Text style={styles.sectionMeta}>PERFORMED SETS</Text></View><View style={styles.muscleList}>{groups.map((group) => <Pressable key={group.key} onPress={() => setSelected(group.region)} style={[styles.muscleRow, group.region === activeRegion && styles.muscleRowActive]}><View style={styles.muscleRowArt}>{isGovernedMuscleId(group.region) ? <MuscleMap athlete={data.athlete} primary={[group.region]} size="thumbnail" style={{ transform: [{ scale: 0.54 }] }} view="auto" /> : null}</View><View style={styles.muscleRowCopy}><View style={styles.muscleRowTop}><Text style={styles.muscleRowName}>{prettify(group.region)}</Text><Text style={styles.muscleRowValue}>{volumeNumber(group.volume_kg, unit)} {unit}</Text></View><View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: `${Math.max(2, group.volume_kg / maxVolume * 100)}%`, backgroundColor: group.region === activeRegion ? '#A46DE4' : '#60498A' }]} /></View></View></Pressable>)}</View></View>
  </View>;
}

export function MuscleDetailExperience({ region }: { region: AccessoryMuscleRegionKey }) {
  const router = useRouter();
  const { data, loading, error, reload } = useExploration();
  const { unit, setUnit } = useSurfaceWeightUnit(data?.athlete.preferred_units);
  if (loading) return <State title="Loading muscle-group detail." />;
  if (error || !data) return <State title={error || 'Muscle-group evidence is unavailable.'} error onRetry={reload} />;
  const group = data.muscle_groups.find((item) => canonicalAccessoryMuscleRegionKey(item.key) === region);
  const movements = data.movements.filter((movement) => canonicalAccessoryMuscleRegionKey(movement.primary_muscle_group || movement.body_region || movement.family) === region).sort((left, right) => right.volume_kg - left.volume_kg);
  const max = Math.max(1, ...movements.map((movement) => movement.volume_kg));
  return <View testID="ledger-muscle-detail-experience" style={styles.page}>
    <RoomHeader title={prettify(region)} subtitle="Exact movement contribution and performed volume." />
    <View style={styles.inset}><ExplorationUnitToolbar unit={unit} onChange={setUnit} /></View>
    <View style={styles.inset}><View style={styles.muscleDetailHero}>{isGovernedMuscleId(region) ? <MuscleMap athlete={data.athlete} primary={[region]} size="card" view="auto" /> : null}<View style={styles.muscleDetailMetrics}><Text style={styles.sectionKicker}>ALL-TIME PERFORMED EVIDENCE</Text><Text style={styles.muscleDetailVolume}>{group ? volumeNumber(group.volume_kg, unit) : '—'}</Text><Text style={styles.muscleDetailUnit}>{unit.toUpperCase()} VOLUME</Text><View style={styles.detailMetrics}><View><Text style={styles.detailMetricValue}>{group?.set_count ?? 0}</Text><Text style={styles.detailMetricLabel}>SETS</Text></View><View><Text style={styles.detailMetricValue}>{group?.movement_count ?? 0}</Text><Text style={styles.detailMetricLabel}>MOVEMENTS</Text></View></View></View></View></View>
    <View style={styles.inset}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>TOP MOVEMENTS</Text><Text style={styles.sectionMeta}>EXACT IDENTITIES</Text></View><View style={styles.movementList}>{movements.map((movement) => <View key={movement.id}><MovementRow movement={movement} unit={unit} tone="#A46DE4" onPress={() => router.push(movementHistorySheetRouteForCanonicalIdentity({ movementDefinitionId: movement.id, displayUnit: unit }) as any)} /><View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: `${Math.max(2, movement.volume_kg / max * 100)}%`, backgroundColor: '#7653A5' }]} /></View></View>)}</View></View>
    <View style={styles.inset}><View style={styles.policyNotice}><Ionicons name="ribbon-outline" size={20} color="#C5A4F1" /><View style={styles.policyCopy}><Text style={styles.policyTitle}>Reward evidence remains canonical.</Text><Text style={styles.policyBody}>Muscle-level medallions are not shown because the accomplishment platform does not currently issue them. Per-lift and total volume medallions remain in Achievements.</Text></View></View></View>
  </View>;
}

export function LedgerFiltersExperience() {
  const router = useRouter();
  const params = useLocalSearchParams<{ time?: string }>();
  const { data, loading, error, reload } = useExploration();
  const { unit, setUnit } = useSurfaceWeightUnit(data?.athlete.preferred_units);
  const [time, setTime] = useState(params.time || 'All Time');
  const [program, setProgram] = useState('All');
  const [muscle, setMuscle] = useState('All');
  const [exerciseType, setExerciseType] = useState('All');
  const [equipment, setEquipment] = useState('All');
  if (loading) return <State title="Loading Ledger filters." />;
  if (error || !data) return <State title={error || 'Ledger filters are unavailable.'} error onRetry={reload} />;
  const apply = () => {
    if (muscle !== 'All' || equipment !== 'All' || exerciseType === 'accessory' || exerciseType === 'variant') {
      router.replace({ pathname: exerciseType === 'variant' ? ledgerHrefFor('variants') : ledgerHrefFor('accessories'), params: { muscle: muscle === 'All' ? undefined : muscle, equipment: equipment === 'All' ? undefined : equipment } } as never);
      return;
    }
    const now = new Date();
    const dateFrom = time === 'Last 3 Months' ? new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10) : time === 'This Year' ? `${now.getFullYear()}-01-01` : undefined;
    router.replace({ pathname: ledgerHrefFor('archive'), params: { date_from: dateFrom, q: program === 'All' ? undefined : program } } as never);
  };
  return <View testID="ledger-filters-experience" style={styles.page}>
    <RoomHeader title="Filter the Ledger" subtitle="Every view is contextual. Focus on what matters." />
    <View style={styles.inset}><ExplorationUnitToolbar unit={unit} onChange={setUnit} /><ContextBar data={data} unit={unit} /></View>
    <View style={styles.inset}><FilterGroup label="TIME PERIOD" values={['This Block', 'Last 3 Months', 'This Year', 'All Time']} value={time} onChange={setTime} /><FilterGroup label="PROGRAM" values={['All', ...data.filters.programs.map((item) => item.name)]} value={program} onChange={setProgram} /><FilterGroup label="MUSCLE GROUP" values={['All', ...data.filters.muscle_groups]} value={muscle} onChange={setMuscle} format /><FilterGroup label="EXERCISE TYPE" values={['All', ...data.filters.exercise_types]} value={exerciseType} onChange={setExerciseType} format /><FilterGroup label="EQUIPMENT" values={['All', ...data.filters.equipment]} value={equipment} onChange={setEquipment} format /></View>
    <View style={styles.inset}><View style={styles.filterActions}><Pressable onPress={() => { setTime('All Time'); setProgram('All'); setMuscle('All'); setExerciseType('All'); setEquipment('All'); }} style={styles.clearButton}><Text style={styles.clearButtonText}>Clear Filters</Text></Pressable><Pressable onPress={apply} style={styles.applyButton}><Text style={styles.applyButtonText}>Apply Filters</Text></Pressable></View></View>
  </View>;
}

function FilterGroup({ label, values, value, onChange, format = false }: { label: string; values: string[]; value: string; onChange: (value: string) => void; format?: boolean }) {
  return <View style={styles.filterGroup}><Text style={styles.sectionKicker}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChoices}>{values.map((option) => <Pressable key={option} onPress={() => onChange(option)} style={[styles.filterChoice, value === option && styles.filterChoiceActive]}><Text style={[styles.filterChoiceText, value === option && styles.filterChoiceTextActive]}>{format ? prettify(option) : option}</Text></Pressable>)}</ScrollView></View>;
}

const styles = StyleSheet.create({
  page: { gap: 18, paddingBottom: 22 },
  inset: { gap: 10, marginHorizontal: 14 },
  roomHeader: { gap: 2, paddingHorizontal: 18, paddingTop: 2, paddingBottom: 2 },
  roomKicker: { color: '#A98ADF', fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 1 },
  roomTitle: { color: '#F3EFF6', fontSize: 28, lineHeight: 33, fontWeight: '700', letterSpacing: -0.45 },
  roomSubtitle: { maxWidth: 360, color: '#838B97', fontSize: 9, lineHeight: 13 },
  sectionKicker: { color: '#A98BDB', fontSize: 7.5, lineHeight: 10, fontWeight: '700', letterSpacing: 0.7 },
  sectionHeader: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#B895E7', fontSize: 9.5, lineHeight: 12, fontWeight: '700', letterSpacing: 0.7 },
  sectionMeta: { color: '#757E8A', fontSize: 7, lineHeight: 9, letterSpacing: 0.45 },
  state: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 12, marginHorizontal: 16 },
  stateTitle: { color: SLColors.textSecondary, textAlign: 'center' },
  retry: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#654D82' },
  retryText: { color: '#CDB6EC', fontSize: 11, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2D333C' },
  tab: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#A76DE6' },
  tabText: { color: '#777F8B', fontSize: 8, lineHeight: 11, fontWeight: '600' },
  tabTextActive: { color: '#C7A7ED' },
  contextBar: { overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: '#2E3540', backgroundColor: '#090C11' },
  contextPrimary: { gap: 2, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2B323C' },
  contextKicker: { color: '#B997E8', fontSize: 8.5, lineHeight: 11, fontWeight: '700' },
  contextDetail: { color: '#7F8894', fontSize: 7.5, lineHeight: 10 },
  contextFacts: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8 },
  contextFactValue: { color: '#E5E3E8', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  contextFactLabel: { color: '#68717D', fontSize: 5.5, lineHeight: 8, letterSpacing: 0.35 },
  contextProgress: { alignItems: 'flex-end' },
  collectionHero: { minHeight: 105, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: '#332B40', backgroundColor: '#0C0A10' },
  collectionHeroValue: { color: '#EEEAF2', fontSize: 37, lineHeight: 40, fontWeight: '500' },
  collectionHeroLabel: { color: '#777F8B', fontSize: 6.5, lineHeight: 9, letterSpacing: 0.45 },
  collectionHeroSide: { alignItems: 'flex-end' },
  collectionHeroVolume: { color: '#A97DE4', fontSize: 24, lineHeight: 28, fontWeight: '500' },
  collectionHeroVolumeLabel: { color: '#777F8B', fontSize: 6, lineHeight: 8, letterSpacing: 0.35 },
  activeFilter: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#181021' },
  activeFilterText: { color: '#BEA2E2', fontSize: 7.5, fontWeight: '700', letterSpacing: 0.5 },
  movementList: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#2A3039', backgroundColor: '#080B0F' },
  movementRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292F38' },
  artworkFrame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: '#342B40', backgroundColor: '#100C15' },
  artwork: { width: '100%', height: '100%' },
  movementCopy: { flex: 1, minWidth: 0, gap: 2 },
  movementName: { color: '#ECE9EF', fontSize: 10.5, lineHeight: 13, fontWeight: '600' },
  movementMeta: { color: '#8C8494', fontSize: 7, lineHeight: 9 },
  movementDate: { color: '#656E7A', fontSize: 6.5, lineHeight: 8 },
  movementValueWrap: { maxWidth: 115, alignItems: 'flex-end', gap: 2 },
  movementValue: { fontSize: 10, lineHeight: 13, fontWeight: '700', textAlign: 'right' },
  movementVolume: { color: '#69727E', fontSize: 6, lineHeight: 8, textAlign: 'right' },
  volumeTrack: { height: 3, overflow: 'hidden', backgroundColor: '#20262E' },
  volumeFill: { height: '100%' },
  footerLink: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#303640' },
  footerLinkText: { flex: 1, color: '#D5D1D9', fontSize: 10.5, fontWeight: '600' },
  emptyCollection: { gap: 6, padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#2B3139' },
  emptyCollectionTitle: { color: '#E4E1E6', fontSize: 12, fontWeight: '600' },
  emptyCollectionBody: { color: '#7D8590', fontSize: 9, lineHeight: 13 },
  movementHero: { minHeight: 185, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 15, borderWidth: 1, backgroundColor: '#090A0E' },
  movementHeroArt: { width: '48%', height: 176 },
  movementHeroCopy: { flex: 1, minWidth: 0, gap: 4, paddingRight: 12 },
  movementHeroValue: { color: '#F2EFF4', fontSize: 25, lineHeight: 29, fontWeight: '600' },
  movementHeroLabel: { color: '#777F8B', fontSize: 6.5, lineHeight: 9, letterSpacing: 0.45 },
  movementHeroDate: { color: '#8B939E', fontSize: 8, lineHeight: 10 },
  detailMetrics: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#303640' },
  detailMetricValue: { color: '#ECE9F0', fontSize: 18, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  detailMetricLabel: { color: '#737B87', fontSize: 6, lineHeight: 8, letterSpacing: 0.5, textAlign: 'center' },
  detailTrend: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2D343E', backgroundColor: '#090C11' },
  emptyTrend: { alignItems: 'center', justifyContent: 'center' },
  emptyTrendText: { color: '#717A86', fontSize: 8.5 },
  setList: { overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: '#2B313A', backgroundColor: '#090B0F' },
  setRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292F38' },
  setDate: { color: '#C6C2CA', fontSize: 8.5, lineHeight: 11, fontWeight: '600' },
  setMeta: { color: '#6D7682', fontSize: 6.5, lineHeight: 9 },
  setLoad: { flex: 1, fontSize: 11, lineHeight: 14, fontWeight: '700', textAlign: 'right' },
  equipmentCard: { gap: 4, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#36313C', backgroundColor: '#0B0A0D' },
  equipmentTitle: { color: '#E9E6EB', fontSize: 13, lineHeight: 16, fontWeight: '600' },
  equipmentBody: { color: '#7E8691', fontSize: 8, lineHeight: 11 },
  policyNotice: { flexDirection: 'row', gap: 11, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#3B304B', backgroundColor: '#0E0A14' },
  policyCopy: { flex: 1, gap: 4 },
  policyTitle: { color: '#E9E4EE', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  policyBody: { color: '#8D8594', fontSize: 8.5, lineHeight: 13 },
  muscleHero: { minHeight: 260, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#3B2E4A', backgroundColor: '#09080C' },
  muscleHeroArt: { width: '53%', height: 250 },
  muscleHeroCopy: { flex: 1, minWidth: 0, gap: 5, paddingRight: 12 },
  muscleHeroTitle: { color: '#D1B4F0', fontSize: 17, lineHeight: 21, fontWeight: '700' },
  muscleHeroValue: { color: '#F0EDF3', fontSize: 24, lineHeight: 28, fontWeight: '600' },
  muscleHeroUnit: { color: '#8C8493', fontSize: 7, lineHeight: 9 },
  muscleHeroBody: { color: '#858D98', fontSize: 8, lineHeight: 11 },
  detailButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: '#634581' },
  detailButtonText: { color: '#CCB1F1', fontSize: 7.5, lineHeight: 10, fontWeight: '600' },
  muscleList: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#2D333C', backgroundColor: '#090B0F' },
  muscleRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292F38' },
  muscleRowActive: { backgroundColor: '#171020' },
  muscleRowArt: { width: 48, height: 58 },
  muscleRowCopy: { flex: 1, gap: 6 },
  muscleRowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  muscleRowName: { color: '#DCD8E0', fontSize: 9.5, fontWeight: '600' },
  muscleRowValue: { color: '#A987D2', fontSize: 8.5, fontWeight: '600' },
  muscleDetailHero: { minHeight: 250, flexDirection: 'row', alignItems: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#3B2E4A', backgroundColor: '#09080C' },
  muscleDetailArt: { width: '52%', height: 240 },
  muscleDetailMetrics: { flex: 1, gap: 3, paddingRight: 12 },
  muscleDetailVolume: { color: '#F0ECF3', fontSize: 30, lineHeight: 34, fontWeight: '600' },
  muscleDetailUnit: { color: '#8B8392', fontSize: 7, lineHeight: 9, letterSpacing: 0.5 },
  filterGroup: { gap: 7, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2C323B' },
  filterChoices: { gap: 6, paddingRight: 10 },
  filterChoice: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: '#303640', backgroundColor: '#090C11' },
  filterChoiceActive: { borderColor: '#8E5EC5', backgroundColor: '#21122E' },
  filterChoiceText: { color: '#7F8792', fontSize: 8.5, fontWeight: '600' },
  filterChoiceTextActive: { color: '#D2B9EE' },
  filterActions: { flexDirection: 'row', gap: 8 },
  clearButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#3A4049' },
  clearButtonText: { color: '#A7ADB6', fontSize: 9, fontWeight: '600' },
  applyButton: { flex: 1.4, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#6F3AAE' },
  applyButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
