import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLContextualHeader } from '@/components/ui/sl-contextual-header';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { MuscleMap } from '@/components/anatomy/MuscleMap';
import { SLColors } from '@/constants/theme';
import { displayWeight, type LedgerUnit } from '@/lib/ledger-data';
import { kilogramsToDisplayValue } from '@/lib/display-units';
import {
  fetchLedgerExplorationIndex,
  type LedgerExplorationIndex,
  type LedgerMovementProgress,
} from '@/lib/ledger-exploration';
import { canonicalAccessoryMuscleRegionKey, type AccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';
import { isGovernedMuscleId } from '@/lib/anatomy-system';
import { ledgerHrefFor } from './routing';
import { movementHistorySheetRouteForCanonicalIdentity } from '@/lib/movement-history-launch';

import { useAthleteLedgerSubject } from './athlete-ledger-subject';

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

function useExploration() {
  const ledgerSubject = useAthleteLedgerSubject();
  const [data, setData] = useState<LedgerExplorationIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = () => {
    setLoading(true);
    setError(null);
    fetchLedgerExplorationIndex(ledgerSubject.athleteId).then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'Ledger movement evidence could not be loaded.')).finally(() => setLoading(false));
  };
  useEffect(reload, [ledgerSubject.athleteId]);
  return { data, loading, error, reload };
}

function State({ title, error, onRetry }: { title: string; error?: boolean; onRetry?: () => void }) {
  return <View style={styles.state}><Ionicons name={error ? 'alert-circle-outline' : 'hourglass-outline'} size={28} color="#B68DEB" /><Text style={styles.stateTitle}>{title}</Text>{onRetry ? <Pressable onPress={onRetry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}</View>;
}

function RoomHeader({ title, subtitle, backHref = ledgerHrefFor('home') }: { title: string; subtitle: string; backHref?: string }) {
  const router = useRouter();
  const ledgerSubject = useAthleteLedgerSubject();
  const destination = backHref === ledgerHrefFor('home') && ledgerSubject.returnPath ? ledgerSubject.returnPath : backHref;
  return <SLContextualHeader backAccessibilityLabel={`Back from ${title}`} breadcrumb="The Ledger" onBack={() => router.replace({ pathname: destination as any, params: destination === ledgerSubject.returnPath ? {} : ledgerSubject.routeParams } as never)} subtitle={subtitle} title={title} />;
}

function ContextBar({ data }: { data: LedgerExplorationIndex }) {
  const context = data.context;
  const unit: LedgerUnit = data.athlete.preferred_units?.toLowerCase().startsWith('lb') ? 'lb' : 'kg';
  const progress = context.block_progress == null ? null : Math.round(context.block_progress * 100);
  return <View testID="ledger-context-bar" style={styles.contextBar}><View style={styles.contextPrimary}><Text style={styles.contextKicker}>{context.block?.name || 'NO CURRENT BLOCK'}</Text><Text style={styles.contextDetail}>{context.week_number ? `Week ${context.week_number}${context.total_weeks ? ` of ${context.total_weeks}` : ''}` : 'No dated week'} · {context.block_completed_sessions}/{context.block_total_sessions || '—'} sessions</Text></View><View style={styles.contextFacts}><View><Text style={styles.contextFactValue}>{context.bodyweight_kg ? `${displayWeight(context.bodyweight_kg, unit)} ${unit}` : '—'}</Text><Text style={styles.contextFactLabel}>BODYWEIGHT</Text></View><View><Text style={styles.contextFactValue}>{context.training_frequency_per_week.toFixed(1)}</Text><Text style={styles.contextFactLabel}>SESSIONS/WK</Text></View><View style={styles.contextProgress}><Text style={styles.contextFactValue}>{progress == null ? '—' : `${progress}%`}</Text><Text style={styles.contextFactLabel}>BLOCK</Text></View></View></View>;
}

function MovementArtwork({ movement, size = 58 }: { movement: LedgerMovementProgress; size?: number }) {
  return <CanonicalMovementArtwork movement={movement} size={size} style={styles.artworkFrame} testID="ledger-canonical-movement-artwork" />;
}

function MovementRow({ movement, unit, tone, onPress }: { movement: LedgerMovementProgress; unit: LedgerUnit; tone: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.movementRow, pressed && styles.pressed]}><MovementArtwork movement={movement} /><View style={styles.movementCopy}><Text style={styles.movementName}>{movement.name}</Text><Text style={styles.movementMeta}>{prettify(movement.primary_muscle_group || movement.core_family || movement.family)} · {prettify(movement.equipment_type)}</Text><Text style={styles.movementDate}>{dateLabel(movement.last_performed_on)}</Text></View><View style={styles.movementValueWrap}><Text style={[styles.movementValue, { color: tone }]}>{loadLabel(movement.best_weight_kg || movement.latest_weight_kg, movement.best_reps || movement.latest_reps, unit)}</Text><Text style={styles.movementVolume}>{volumeNumber(movement.volume_kg, unit)} {unit} volume</Text></View><Ionicons name="chevron-forward" size={15} color="#737C88" /></Pressable>;
}

export function MuscleGroupsExperience() {
  const router = useRouter();
  const ledgerSubject = useAthleteLedgerSubject();
  const { data, loading, error, reload } = useExploration();
  const [selected, setSelected] = useState<AccessoryMuscleRegionKey>('chest');
  if (loading) return <State title="Loading muscle-group evidence." />;
  if (error || !data) return <State title={error || 'Muscle-group evidence is unavailable.'} error onRetry={reload} />;
  const unit: LedgerUnit = data.athlete.preferred_units?.toLowerCase().startsWith('lb') ? 'lb' : 'kg';
  const groups = data.muscle_groups.map((group) => ({ ...group, region: canonicalAccessoryMuscleRegionKey(group.key) }));
  const selectedGroup = groups.find((group) => group.region === selected) || groups[0];
  const activeRegion = selectedGroup?.region || selected;
  const maxVolume = Math.max(1, ...groups.map((group) => group.volume_kg));
  return <View testID="ledger-muscle-groups-experience" style={styles.page}>
    <RoomHeader title="Muscle Groups" subtitle="Performed training volume and movement balance." />
    <View style={styles.inset}><ContextBar data={data} /></View>
    <View style={styles.inset}><View style={styles.muscleHero}><MuscleMap athlete={data.athlete} framingPreset="card" primary={isGovernedMuscleId(activeRegion) ? [activeRegion] : []} size="card" view="auto" /><View style={styles.muscleHeroCopy}><Text style={styles.sectionKicker}>MUSCLE BALANCE</Text><Text style={styles.muscleHeroTitle}>{prettify(activeRegion)}</Text><Text style={styles.muscleHeroValue}>{selectedGroup ? volumeNumber(selectedGroup.volume_kg, unit) : '—'} <Text style={styles.muscleHeroUnit}>{unit.toUpperCase()} VOLUME</Text></Text><Text style={styles.muscleHeroBody}>{selectedGroup ? `${selectedGroup.movement_count} movements · ${selectedGroup.set_count} sets` : 'No performed evidence'}</Text><Pressable disabled={!selectedGroup} onPress={() => selectedGroup && router.push({ pathname: `/(tabs)/ledger/muscle-groups/${selectedGroup.region}` as any, params: ledgerSubject.routeParams } as never)} style={styles.detailButton}><Text style={styles.detailButtonText}>View detailed breakdown</Text><Ionicons name="arrow-forward" size={14} color="#CCB1F1" /></Pressable></View></View></View>
    <View style={styles.inset}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>VOLUME BY MUSCLE GROUP</Text><Text style={styles.sectionMeta}>PERFORMED SETS</Text></View><View style={styles.muscleList}>{groups.map((group) => <Pressable key={group.key} onPress={() => setSelected(group.region)} style={[styles.muscleRow, group.region === activeRegion && styles.muscleRowActive]}><View style={styles.muscleRowArt}>{isGovernedMuscleId(group.region) ? <MuscleMap athlete={data.athlete} framingPreset="thumbnail" primary={[group.region]} size="thumbnail" style={styles.muscleRowAnatomy} view="auto" /> : null}</View><View style={styles.muscleRowCopy}><View style={styles.muscleRowTop}><Text style={styles.muscleRowName}>{prettify(group.region)}</Text><Text style={styles.muscleRowValue}>{volumeNumber(group.volume_kg, unit)} {unit}</Text></View><View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: `${Math.max(2, group.volume_kg / maxVolume * 100)}%`, backgroundColor: group.region === activeRegion ? '#A46DE4' : '#60498A' }]} /></View></View></Pressable>)}</View></View>
  </View>;
}

export function MuscleDetailExperience({ region }: { region: AccessoryMuscleRegionKey }) {
  const router = useRouter();
  const { data, loading, error, reload } = useExploration();
  if (loading) return <State title="Loading muscle-group detail." />;
  if (error || !data) return <State title={error || 'Muscle-group evidence is unavailable.'} error onRetry={reload} />;
  const unit: LedgerUnit = data.athlete.preferred_units?.toLowerCase().startsWith('lb') ? 'lb' : 'kg';
  const group = data.accessories.muscle_groups.find((item) => canonicalAccessoryMuscleRegionKey(item.key) === region);
  const movements = data.accessories.movements.filter((movement) => canonicalAccessoryMuscleRegionKey(movement.primary_muscle_group || movement.body_region || movement.family) === region).sort((left, right) => right.period_set_count - left.period_set_count || right.period_volume_kg - left.period_volume_kg);
  const max = Math.max(1, ...movements.map((movement) => movement.period_volume_kg));
  return <View testID="ledger-muscle-detail-experience" style={styles.page}>
    <RoomHeader backHref={ledgerHrefFor('accessories')} title={prettify(region)} subtitle="Your performed movements and exact accessory evidence." />
    <View style={styles.inset}><View style={styles.muscleDetailHero}>{isGovernedMuscleId(region) ? <MuscleMap athlete={data.athlete} framingPreset="card" primary={[region]} size="card" view="auto" /> : null}<View style={styles.muscleDetailMetrics}><Text style={styles.sectionKicker}>{data.accessories.period.label.toUpperCase()} PERFORMED EVIDENCE</Text><Text style={styles.muscleDetailVolume}>{group ? volumeNumber(group.volume_kg, unit) : '—'}</Text><Text style={styles.muscleDetailUnit}>{unit.toUpperCase()} VOLUME</Text><View style={styles.detailMetrics}><View><Text style={styles.detailMetricValue}>{group?.set_count ?? 0}</Text><Text style={styles.detailMetricLabel}>SETS</Text></View><View><Text style={styles.detailMetricValue}>{group?.movement_count ?? 0}</Text><Text style={styles.detailMetricLabel}>MOVEMENTS</Text></View></View></View></View></View>
    <View style={styles.inset}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>YOUR {prettify(region).toUpperCase()} MOVEMENTS</Text><Text style={styles.sectionMeta}>EXACT IDENTITIES</Text></View><View style={styles.movementList}>{movements.map((movement) => <View key={movement.id}><MovementRow movement={movement} unit={unit} tone="#A46DE4" onPress={() => router.push(movementHistorySheetRouteForCanonicalIdentity({ movementDefinitionId: movement.id, athleteId: data.athlete.id }) as any)} /><View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: `${Math.max(2, movement.period_volume_kg / max * 100)}%`, backgroundColor: '#7653A5' }]} /></View></View>)}</View></View>
    <View style={styles.inset}><View style={styles.policyNotice}><Ionicons name="ribbon-outline" size={20} color="#C5A4F1" /><View style={styles.policyCopy}><Text style={styles.policyTitle}>Reward evidence remains canonical.</Text><Text style={styles.policyBody}>Muscle-level medallions are not shown because the accomplishment platform does not currently issue them. Per-lift and total volume medallions remain in Achievements.</Text></View></View></View>
  </View>;
}

export function LedgerFiltersExperience() {
  const router = useRouter();
  const ledgerSubject = useAthleteLedgerSubject();
  const params = useLocalSearchParams<{ time?: string }>();
  const { data, loading, error, reload } = useExploration();
  const [time, setTime] = useState(params.time || 'All Time');
  const [program, setProgram] = useState('All');
  const [muscle, setMuscle] = useState('All');
  const [exerciseType, setExerciseType] = useState('All');
  const [equipment, setEquipment] = useState('All');
  if (loading) return <State title="Loading Ledger filters." />;
  if (error || !data) return <State title={error || 'Ledger filters are unavailable.'} error onRetry={reload} />;
  const apply = () => {
    if (muscle !== 'All' || equipment !== 'All' || exerciseType === 'accessory' || exerciseType === 'variant') {
      router.replace({ pathname: exerciseType === 'variant' ? ledgerHrefFor('variants') : ledgerHrefFor('accessories'), params: { ...ledgerSubject.routeParams, muscle: muscle === 'All' ? undefined : muscle, equipment: equipment === 'All' ? undefined : equipment } } as never);
      return;
    }
    const now = new Date();
    const dateFrom = time === 'Last 3 Months' ? new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10) : time === 'This Year' ? `${now.getFullYear()}-01-01` : undefined;
    router.replace({ pathname: ledgerHrefFor('archive'), params: { ...ledgerSubject.routeParams, date_from: dateFrom, q: program === 'All' ? undefined : program } } as never);
  };
  return <View testID="ledger-filters-experience" style={styles.page}>
    <RoomHeader title="Filter the Ledger" subtitle="Every view is contextual. Focus on what matters." />
    <View style={styles.inset}><ContextBar data={data} /></View>
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
  tabBleed: { marginHorizontal: -14 },
  sectionKicker: { color: '#A98BDB', fontSize: 7.5, lineHeight: 10, fontWeight: '700', letterSpacing: 0.7 },
  sectionHeader: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#B895E7', fontSize: 9.5, lineHeight: 12, fontWeight: '700', letterSpacing: 0.7 },
  sectionMeta: { color: '#757E8A', fontSize: 7, lineHeight: 9, letterSpacing: 0.45 },
  state: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 12, marginHorizontal: 16 },
  stateTitle: { color: SLColors.textSecondary, textAlign: 'center' },
  retry: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#654D82' },
  retryText: { color: '#CDB6EC', fontSize: 11, fontWeight: '600' },
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
  muscleRowAnatomy: { width: 42, height: 48 },
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
