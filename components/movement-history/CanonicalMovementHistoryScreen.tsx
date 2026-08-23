import { Ionicons } from '@expo/vector-icons';
import { Canvas, Circle, Line, vec } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AnalyticalHistoryChart } from '@/components/movement-history/AnalyticalHistoryChart';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { Text } from '@/components/ui/sl-text';
import { SLScreen } from '@/components/ui/sl-screen';
import { AccessoryMuscleRegionMedallion } from '@/components/workout-logger/accessory-muscle-region-medallion';
import { ManufacturerBrandMark } from '@/components/workout-logger/manufacturer-brand-mark';
import { SLLayout } from '@/constants/theme';
import { API_BASE } from '@/lib/api';
import {
  fetchCanonicalMovementExposure,
  fetchCanonicalMovementHistory,
  setCanonicalMovementFavorite,
  type CanonicalHistoryExposure,
  type CanonicalHistoryExposureDetail,
  type CanonicalHistorySet,
  type CanonicalMovementHistory,
  type MovementHistoryDateRange,
  type MovementHistoryQuery,
  type MovementHistoryUnit,
} from '@/lib/canonical-movement-history';
import {
  formatCalculatedWeightDeltaFromKg,
  formatCalculatedWeightFromKg,
  kilogramsToDisplayValue,
} from '@/lib/display-units';
import { fetchLedgerExplorationIndex } from '@/lib/ledger-exploration';
import { canonicalAccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';
import {
  buildLoadRepProfileLayout,
  loadRepProfileAccessibilityLabel,
  type LoadRepProfileCoordinate,
} from '@/lib/load-rep-profile';

type FilterPreset = 'all' | 'rir1' | 'rir2' | 'reps6to10' | 'reps8to12' | 'reps12plus';

function titleCase(value?: string | null) {
  return String(value || '').replace(/^accessory_/, '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value?: string | null, year = true) {
  if (!value) return '—';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', year ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
}

function relativeDate(value?: string | null) {
  if (!value) return null;
  const today = new Date();
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);
  const delta = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - parsed.getTime()) / 86400000);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  return null;
}

function displayWeight(valueKg: number | null | undefined, unit: MovementHistoryUnit, digits = 1) {
  if (valueKg == null || !Number.isFinite(Number(valueKg))) return '—';
  return kilogramsToDisplayValue(Number(valueKg), unit).toLocaleString('en-US', { maximumFractionDigits: digits });
}

function setLabel(set: CanonicalHistorySet | null | undefined, unit: MovementHistoryUnit) {
  if (!set) return 'No comparable set';
  const effort = set.rir != null ? ` @ ${set.rir} RIR` : set.rpe != null ? ` @ RPE ${set.rpe}` : '';
  return `${displayWeight(set.weight_kg, unit)} ${unit} × ${set.reps ?? '—'}${effort}`;
}

function compactSetLoad(set: CanonicalHistorySet | null | undefined, unit: MovementHistoryUnit) {
  if (!set) return '—';
  return `${displayWeight(set.weight_kg, unit)} ${unit} × ${set.reps ?? '—'}`;
}

function compactSetEffort(set: CanonicalHistorySet | null | undefined) {
  if (!set) return null;
  if (set.rir != null) return `${set.rir} RIR`;
  if (set.rpe != null) return `RPE ${set.rpe}`;
  return 'Effort not recorded';
}

function compactEquipmentLabel(value?: string | null) {
  return String(value || 'Unknown').replace(/ Machine$/i, '');
}

function durationLabel(seconds?: number | null) {
  if (!seconds) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function absoluteAssetUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE}${value.startsWith('/') ? value : `/${value}`}`;
}

function filterQuery(preset: FilterPreset) {
  if (preset === 'rir1') return { rirMax: 1 };
  if (preset === 'rir2') return { rirMax: 2 };
  if (preset === 'reps6to10') return { repMin: 6, repMax: 10 };
  if (preset === 'reps8to12') return { repMin: 8, repMax: 12 };
  if (preset === 'reps12plus') return { repMin: 12 };
  return {};
}

export function CanonicalMovementHistoryScreen({
  movementDefinitionId,
  athleteId,
  initialEquipmentContextDefinitionId,
  presentation = 'screen',
  onRequestClose,
}: {
  movementDefinitionId: number;
  athleteId?: number | null;
  initialEquipmentContextDefinitionId?: number | null;
  presentation?: 'screen' | 'sheet';
  onRequestClose?: () => void;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  useLayoutEffect(() => {
    if (presentation === 'sheet') return undefined;
    navigation.setOptions({ headerShown: false });
    return () => navigation.setOptions({ headerShown: true });
  }, [navigation, presentation]);

  const [resolvedAthleteId, setResolvedAthleteId] = useState<number | null>(athleteId || null);
  const [history, setHistory] = useState<CanonicalMovementHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<MovementHistoryDateRange>('all');
  const [equipmentDefinitionId, setEquipmentDefinitionId] = useState<number | null>(null);
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [rangeSheetOpen, setRangeSheetOpen] = useState(false);
  const [scopeSheetOpen, setScopeSheetOpen] = useState(false);
  const [selectedExposureId, setSelectedExposureId] = useState<string | null>(null);
  const [exposureDetail, setExposureDetail] = useState<CanonicalHistoryExposureDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const requestGeneration = useRef(0);

  useEffect(() => {
    setResolvedAthleteId(athleteId || null);
    setEquipmentDefinitionId(null);
    setRange('all');
    setFilterPreset('all');
    setHistory(null);
  }, [athleteId, initialEquipmentContextDefinitionId, movementDefinitionId]);

  useEffect(() => {
    if (resolvedAthleteId || !movementDefinitionId) return;
    let active = true;
    fetchLedgerExplorationIndex()
      .then((payload) => { if (active) setResolvedAthleteId(payload.athlete.id); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Athlete context is unavailable.'); })
      .finally(() => { if (active && !resolvedAthleteId) setLoading(false); });
    return () => { active = false; };
  }, [movementDefinitionId, resolvedAthleteId]);

  const query = useMemo<MovementHistoryQuery | null>(() => {
    if (!resolvedAthleteId || !movementDefinitionId) return null;
    return {
      athleteId: resolvedAthleteId,
      movementDefinitionId,
      equipmentDefinitionId,
      equipmentContextDefinitionId: equipmentDefinitionId === null ? initialEquipmentContextDefinitionId : null,
      range,
      ...filterQuery(filterPreset),
      limit: 12,
    };
  }, [equipmentDefinitionId, filterPreset, initialEquipmentContextDefinitionId, movementDefinitionId, range, resolvedAthleteId]);

  const load = useCallback(async (refresh = false) => {
    if (!query) return;
    const generation = ++requestGeneration.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const payload = await fetchCanonicalMovementHistory(query);
      if (generation !== requestGeneration.current) return;
      setHistory(payload);
    } catch (caught) {
      if (generation !== requestGeneration.current) return;
      setError(caught instanceof Error ? caught.message : 'Movement History could not load.');
    } finally {
      if (generation === requestGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [query]);

  useEffect(() => { void load(false); }, [load]);

  const loadMore = useCallback(async () => {
    if (!query || !history?.has_more || !history.next_cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchCanonicalMovementHistory({ ...query, cursor: history.next_cursor });
      setHistory((current) => current ? {
        ...next,
        exposures: [...current.exposures, ...next.exposures.filter((row) => !current.exposures.some((existing) => existing.id === row.id))],
      } : next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Older exposures could not load.');
    } finally {
      setLoadingMore(false);
    }
  }, [history, loadingMore, query]);

  const openExposure = useCallback(async (exposureId: string) => {
    if (!query) return;
    setSelectedExposureId(exposureId);
    setExposureDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setExposureDetail(await fetchCanonicalMovementExposure(query, exposureId));
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : 'Exposure evidence could not load.');
    } finally {
      setDetailLoading(false);
    }
  }, [query]);

  const closeExposure = () => {
    setSelectedExposureId(null);
    setExposureDetail(null);
    setDetailError(null);
  };

  const toggleFavorite = async () => {
    if (!history || favoriteSaving) return;
    const next = !history.movement.is_favorite;
    setFavoriteSaving(true);
    setHistory({ ...history, movement: { ...history.movement, is_favorite: next } });
    try {
      const confirmed = await setCanonicalMovementFavorite(history.movement.id, history.athlete.id, next);
      setHistory((current) => current ? { ...current, movement: { ...current.movement, is_favorite: confirmed } } : current);
    } catch {
      setHistory((current) => current ? { ...current, movement: { ...current.movement, is_favorite: !next } } : current);
    } finally {
      setFavoriteSaving(false);
    }
  };

  const unit = history?.athlete.preferred_units || 'kg';
  const selectedEquipment = history?.equipment_breakdown.find((row) => row.selected) || null;
  const scopeLabel = history?.filters.selected_scope === 'all_history' ? 'All History' : selectedEquipment?.label || 'Equipment';
  const unknownEquipmentSeries = history?.filters.analytics_basis === 'recorded_unknown_equipment';
  const profileEquipmentId = Number(String(history?.filters.analytics_scope || '').replace(/^equipment:/, ''));
  const profileSeriesLabel = unknownEquipmentSeries
    ? 'Unknown equipment'
    : history?.equipment_breakdown.find((row) => row.id === profileEquipmentId)?.label || 'Exact comparable sets';
  const muscleLine = [titleCase(history?.movement.primary_muscle_group), ...(history?.movement.secondary_muscle_groups || []).slice(0, 1).map(titleCase)].filter(Boolean).join(' · ');
  const primaryMuscleRegion = canonicalAccessoryMuscleRegionKey(history?.movement.primary_muscle_group);

  const closeHistory = onRequestClose || (() => router.back());
  const screenContent = (
    <>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#A865FF" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.navbar}>
          {presentation === 'screen' ? <Pressable accessibilityLabel="Back from Movement History" accessibilityRole="button" hitSlop={10} onPress={closeHistory} style={styles.navButton}>
            <Ionicons name="chevron-back" size={22} color="#B971FF" />
          </Pressable> : <View style={styles.navButton} />}
          <View style={styles.navTitle}><Ionicons name="analytics-outline" size={15} color="#B971FF" /><Text style={styles.navTitleText}>Movement History</Text></View>
          <Pressable accessibilityLabel="Movement History options" accessibilityRole="button" style={styles.navButton} onPress={() => setFilterSheetOpen(true)}>
            <Ionicons name="ellipsis-horizontal" size={21} color="#D5D3DC" />
          </Pressable>
        </View>

        {loading && !history ? <State icon="hourglass-outline" title="Loading exact movement evidence" /> : error && !history ? <State icon="alert-circle-outline" title={error} action="Try again" onAction={() => void load(false)} /> : history ? (
          <>
            <View style={styles.movementHeader}>
              <View style={styles.muscleArtworkFrame}>
                <AccessoryMuscleRegionMedallion
                  accessibilityLabel={`${titleCase(history.movement.primary_muscle_group) || 'Movement'} muscle group`}
                  regionKey={primaryMuscleRegion}
                />
              </View>
              <View style={styles.movementIdentity}>
                <Text style={styles.movementName}>{history.movement.display_name}</Text>
                <Text style={styles.movementMuscles}>{muscleLine || 'Governed movement identity'}</Text>
              </View>
              <Pressable accessibilityLabel={history.movement.is_favorite ? 'Remove movement favorite' : 'Favorite movement'} accessibilityRole="button" accessibilityState={{ selected: Boolean(history.movement.is_favorite), busy: favoriteSaving }} onPress={() => void toggleFavorite()} style={styles.favoriteButton}>
                <Ionicons name={history.movement.is_favorite ? 'star' : 'star-outline'} size={23} color="#E9B83F" />
              </Pressable>
            </View>

            <View style={styles.summaryStrip}>
              <SummaryFact value={String(history.summary.exposure_count)} label="Exposures" />
              <SummaryFact value={String(history.summary.set_count)} label="Sets" />
              <SummaryFact value={history.summary.first_performed_on ? `${dateLabel(history.summary.first_performed_on, false)} – ${dateLabel(history.summary.last_performed_on, false)}` : '—'} label="Date Range" wide />
            </View>

            <View style={styles.controlRow}>
              <TopControl icon="options-outline" label="Filters" active={filterPreset !== 'all'} onPress={() => setFilterSheetOpen(true)} />
              <TopControl label={scopeLabel} active={equipmentDefinitionId !== null} onPress={() => setScopeSheetOpen(true)} chevron />
              <TopControl icon="calendar-outline" label={history.filters.date_range_label} active={range !== 'all'} onPress={() => setRangeSheetOpen(true)} chevron />
            </View>

            {history.equipment_breakdown.length ? (
              <Section title="EQUIPMENT BREAKDOWN" info>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.equipmentRail}>
                  <AllHistoryCard selected={history.filters.selected_scope === 'all_history'} count={history.summary.exposure_count} onPress={() => setEquipmentDefinitionId(null)} />
                  {history.equipment_breakdown.map((equipment) => (
                    <EquipmentCard
                      key={equipment.id}
                      equipment={equipment}
                      unit={unit}
                      onPress={() => setEquipmentDefinitionId(equipment.id)}
                    />
                  ))}
                </ScrollView>
                <Text style={styles.comparisonNote}>{unknownEquipmentSeries ? `${history.filters.analytics_exposure_count ?? history.performance_trend.length} Unknown exposure${(history.filters.analytics_exposure_count ?? history.performance_trend.length) === 1 ? '' : 's'} plotted as one recorded historical series. It is never mixed with named equipment.` : `${history.filters.comparable_exposure_count ?? history.performance_trend.length} comparable of ${history.filters.filtered_exposure_count ?? history.summary.exposure_count} scoped exposures inform the analytics. Every canonical exposure remains available under All History.`}</Text>
              </Section>
            ) : null}

            <NumberedSection number="1" title="PERFORMANCE TREND" subtitle={unknownEquipmentSeries ? 'e10RM from best recorded set' : 'e10RM from best comparable set'}>
              <View style={styles.chartUnitRow}><Text style={styles.chartUnit}>e10RM ({unit})</Text><RangePills selected={range} onSelect={setRange} /></View>
              <AnalyticalHistoryChart points={history.performance_trend} metric="e10rm" unit={unit} color="#A865FF" onOpenExposure={(id) => void openExposure(id)} />
              <Text style={styles.chartFootnote}>{unknownEquipmentSeries ? 'Unknown-equipment historical series · not compared with named implementations · ' : ''}Canonical Epley estimate · recorded RPE, or recorded RIR when RPE is absent</Text>
            </NumberedSection>

            <NumberedSection number="2" title="LOAD PROGRESSION" subtitle={unknownEquipmentSeries ? 'Best recorded set over time' : 'Best comparable set over time'} tone="#EF3C8C">
              <View style={styles.chartUnitRow}><Text style={styles.chartUnit}>Load ({unit})</Text><RangePills selected={range} onSelect={setRange} /></View>
              <AnalyticalHistoryChart points={history.load_progression} metric="load" unit={unit} color="#EF3C8C" onOpenExposure={(id) => void openExposure(id)} />
              <View style={styles.legendRow}><View style={styles.legendRing} /><Text style={styles.legendText}>Point label = reps on the exact set</Text></View>
            </NumberedSection>

            <NumberedSection number="3" title="LOAD × REP PROFILE" subtitle="Demonstrated performance envelope" tone="#9B6BDB">
              <LoadRepProfile points={history.load_rep_profile} unit={unit} seriesLabel={profileSeriesLabel} onOpenExposure={(id) => void openExposure(id)} />
            </NumberedSection>

            <Section title="KEY STATISTICS">
              <StatisticsGrid statistics={history.statistics} unit={unit} onOpenExposure={(id) => void openExposure(id)} />
            </Section>

            <Section title="EXPOSURE HISTORY" meta={`${history.filters.filtered_exposure_count ?? history.summary.exposure_count} exposure${(history.filters.filtered_exposure_count ?? history.summary.exposure_count) === 1 ? '' : 's'}`}>
              {history.exposures.length ? <View style={styles.exposureList}>{history.exposures.map((exposure) => <ExposureRow key={exposure.id} exposure={exposure} unit={unit} onPress={() => void openExposure(exposure.id)} />)}</View> : <View style={styles.truthfulEmpty}><Text style={styles.truthfulEmptyTitle}>No canonical exposures in this filter.</Text><Text style={styles.truthfulEmptyBody}>Try All History or a different date and performance filter.</Text></View>}
              {history.has_more ? <Pressable accessibilityRole="button" onPress={() => void loadMore()} style={styles.loadMore}><Text style={styles.loadMoreText}>{loadingMore ? 'Loading…' : 'View all exposures'}</Text><Ionicons name="chevron-down" size={16} color="#B778F2" /></Pressable> : null}
            </Section>
          </>
        ) : null}
      </ScrollView>

      <FilterSheet visible={filterSheetOpen} selected={filterPreset} onSelect={setFilterPreset} onClose={() => setFilterSheetOpen(false)} />
      <ChoiceSheet
        visible={rangeSheetOpen}
        title="Date Range"
        selected={range}
        choices={(history?.filters.date_range_options || []).map((row) => ({ key: row.key, label: row.label }))}
        onSelect={(value) => { setRange(value as MovementHistoryDateRange); setRangeSheetOpen(false); }}
        onClose={() => setRangeSheetOpen(false)}
      />
      <ChoiceSheet
        visible={scopeSheetOpen}
        title="Comparison Scope"
        selected={history?.filters.selected_scope || ''}
        choices={[
          { key: 'all_history', label: 'All History' },
          ...(history?.equipment_breakdown || []).map((row) => ({ key: `equipment:${row.id}`, label: row.label })),
        ]}
        onSelect={(value) => {
          setEquipmentDefinitionId(value === 'all_history' ? null : Number(value.split(':')[1]));
          setScopeSheetOpen(false);
        }}
        onClose={() => setScopeSheetOpen(false)}
      />
      <StrengthLedgerBottomSheet accessibilityLabel="Exposure Details" heightFraction={0.91} visible={Boolean(selectedExposureId)} onDismiss={closeExposure} onRequestClose={closeExposure}>
        <ExposureDetailContent
          detail={exposureDetail}
          loading={detailLoading}
          error={detailError}
          unit={unit}
          onViewSession={(workoutId) => {
            closeExposure();
            router.push({ pathname: '/workout/[workoutId]', params: { workoutId: String(workoutId) } });
          }}
        />
      </StrengthLedgerBottomSheet>
    </>
  );
  if (presentation === 'sheet') return <View style={styles.screen}>{screenContent}</View>;
  return <SLScreen edges="top" padded={false} style={styles.screen}>{screenContent}</SLScreen>;
}

function State({ icon, title, action, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.state}><Ionicons name={icon} size={28} color="#A865FF" /><Text style={styles.stateText}>{title}</Text>{action && onAction ? <Pressable onPress={onAction} style={styles.stateAction}><Text style={styles.stateActionText}>{action}</Text></Pressable> : null}</View>;
}

function SummaryFact({ value, label, wide = false }: { value: string; label: string; wide?: boolean }) {
  return <View style={[styles.summaryFact, wide && styles.summaryFactWide]}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function TopControl({ icon, label, active, chevron, onPress }: { icon?: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; chevron?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${label}${active ? ', selected' : ''}`} onPress={onPress} style={({ pressed }) => [styles.topControl, active && styles.topControlActive, pressed && styles.pressed]}>{icon ? <Ionicons name={icon} size={15} color={active ? '#C891FF' : '#DAD7DF'} /> : null}<Text numberOfLines={1} style={[styles.topControlText, active && styles.topControlTextActive]}>{label}</Text>{chevron ? <Ionicons name="chevron-down" size={13} color="#B8B5BF" /> : null}</Pressable>;
}

function Section({ title, meta, info, children }: React.PropsWithChildren<{ title: string; meta?: string; info?: boolean }>) {
  return <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{title}</Text>{info ? <Ionicons name="information-circle-outline" size={13} color="#94909C" /> : null}</View>{meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}</View>{children}</View>;
}

function NumberedSection({ number, title, subtitle, tone = '#A865FF', children }: React.PropsWithChildren<{ number: string; title: string; subtitle: string; tone?: string }>) {
  return <View style={styles.analyticsSection}><View style={styles.analyticsHeader}><View style={[styles.sectionNumber, { borderColor: tone, backgroundColor: `${tone}22` }]}><Text style={[styles.sectionNumberText, { color: tone }]}>{number}</Text></View><Text style={[styles.analyticsTitle, { color: tone }]}>{title}</Text><Text numberOfLines={1} style={styles.analyticsSubtitle}>{subtitle}</Text><Ionicons name="information-circle-outline" size={12} color="#7C7F89" /></View>{children}</View>;
}

function RangePills({ selected, onSelect }: { selected: MovementHistoryDateRange; onSelect: (value: MovementHistoryDateRange) => void }) {
  return <View style={styles.rangePills}>{(['1m', '3m', '6m', '1y', 'all'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: selected === value }} onPress={() => onSelect(value)} style={[styles.rangePill, selected === value && styles.rangePillActive]}><Text style={[styles.rangePillText, selected === value && styles.rangePillTextActive]}>{value.toUpperCase()}</Text></Pressable>)}</View>;
}

function AllHistoryCard({ selected, count, onPress }: { selected: boolean; count: number; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.equipmentCard, selected && styles.equipmentCardSelected]}><View style={styles.allComparableIcon}><Ionicons name="layers-outline" size={22} color="#B676F5" /></View><Text style={styles.equipmentName}>All History</Text><Text style={styles.equipmentCount}>{count} exposure{count === 1 ? '' : 's'}</Text><Text style={styles.equipmentMetricLabel}>CANONICAL SCOPE</Text><Text style={styles.equipmentMetricValue}>Every resolved exposure</Text></Pressable>;
}

function EquipmentCard({ equipment, unit, onPress }: { equipment: CanonicalMovementHistory['equipment_breakdown'][number]; unit: MovementHistoryUnit; onPress: () => void }) {
  const unknown = equipment.id === 0;
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: equipment.selected }} onPress={onPress} style={[styles.equipmentCard, equipment.selected && styles.equipmentCardSelected]}><View style={styles.equipmentBrandRow}>{unknown ? <View style={styles.standardEquipment}><Ionicons name="help-outline" size={19} color="#A66DE5" /></View> : <ManufacturerBrandMark compact manufacturerName={equipment.manufacturer?.display_name || equipment.label} />}{equipment.current_context ? <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>CURRENT</Text></View> : equipment.selected ? <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>FILTERED</Text></View> : null}</View><Text numberOfLines={2} style={styles.equipmentName}>{unknown ? 'Unknown' : equipment.label}</Text><Text style={styles.equipmentCount}>{equipment.exposure_count} exposure{equipment.exposure_count === 1 ? '' : 's'} · {equipment.set_count} sets</Text><Text style={styles.equipmentMetricLabel}>{unknown ? 'HISTORICAL FACT' : 'BEST PERFORMANCE'}</Text><Text numberOfLines={1} style={styles.equipmentMetricValue}>{unknown ? 'Equipment was not recorded' : setLabel(equipment.best_performance, unit)}</Text><Text style={styles.equipmentLast}>Last used {dateLabel(equipment.last_used)}</Text></Pressable>;
}

function LoadRepProfile({ points, unit, seriesLabel, onOpenExposure }: { points: CanonicalMovementHistory['load_rep_profile']; unit: MovementHistoryUnit; seriesLabel: string; onOpenExposure: (id: string) => void }) {
  const [width, setWidth] = useState(340);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const height = 246;
  const plotLeft = 48;
  const plotRight = width - 14;
  const plotTop = 32;
  const plotBottom = 190;
  const layout = useMemo(() => buildLoadRepProfileLayout({
    observations: points,
    unit,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
  }), [plotRight, points, unit]);
  const selected = layout.coordinates.find((point) => point.key === selectedKey) || null;

  useEffect(() => {
    setSelectedKey((current) => layout.coordinates.some((point) => point.key === current) ? current : null);
  }, [layout.coordinates]);

  const selectNearest = (x: number, y: number) => {
    const nearest = layout.coordinates.reduce<LoadRepProfileCoordinate | null>((best, point) => {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance > 30) return best;
      if (!best) return point;
      return distance < Math.hypot(best.x - x, best.y - y) ? point : best;
    }, null);
    if (nearest) setSelectedKey(nearest.key);
  };

  if (!layout.observationCount) {
    return <View style={styles.profileEmpty} accessibilityLabel="No performed sets in the current Load by Rep Profile filter"><Text style={styles.profileEmptyTitle}>No load × rep evidence in this filter.</Text><Text style={styles.profileEmptyBody}>A performed set with both load and reps is required.</Text></View>;
  }

  const selectedObservation = selected?.observations[0] || null;
  const selectedEffort = selectedObservation?.rir != null
    ? `${selectedObservation.rir} RIR`
    : selectedObservation?.rpe != null
      ? `RPE ${selectedObservation.rpe}`
      : 'Effort not recorded';
  const tooltipLeft = selected ? Math.min(Math.max(selected.x - 76, plotLeft), width - 166) : 0;
  const tooltipTop = selected ? (selected.y < 98 ? selected.y + 14 : selected.y - 76) : 0;

  return <View><View accessibilityLabel={`Load by rep profile with ${layout.observationCount} performed sets`} onLayout={(event) => setWidth(Math.max(280, Math.round(event.nativeEvent.layout.width)))} style={styles.profileChart}><Canvas style={{ width, height }}>{layout.yTicks.map((tick) => { const y = plotBottom - ((tick - layout.yDomain[0]) / Math.max(layout.yDomain[1] - layout.yDomain[0], 1)) * (plotBottom - plotTop); return <Line key={`y-${tick}`} p1={vec(plotLeft, y)} p2={vec(plotRight, y)} color="#242832" strokeWidth={tick === layout.yDomain[0] ? 1.1 : 0.7} />; })}{layout.xTicks.map((tick) => { const x = plotLeft + ((tick - layout.xDomain[0]) / Math.max(layout.xDomain[1] - layout.xDomain[0], 1)) * (plotRight - plotLeft); return <Line key={`x-${tick}`} p1={vec(x, plotTop)} p2={vec(x, plotBottom)} color="#1A1E27" strokeWidth={0.7} />; })}{selected ? <><Line p1={vec(selected.x, plotTop)} p2={vec(selected.x, plotBottom)} color="#A865FF88" strokeWidth={1} /><Line p1={vec(plotLeft, selected.y)} p2={vec(plotRight, selected.y)} color="#A865FF88" strokeWidth={1} /></> : null}{layout.coordinates.map((point) => <React.Fragment key={point.key}>{point.observations.length > 1 ? <Circle cx={point.x} cy={point.y} r={point.radius + 3} color="#A865FF33" /> : null}{selected?.key === point.key ? <Circle cx={point.x} cy={point.y} r={point.radius + 3} color="#F4E9FF" /> : null}<Circle cx={point.x} cy={point.y} r={point.radius} color="#A865FF" /></React.Fragment>)}</Canvas><View pointerEvents="none" style={StyleSheet.absoluteFillObject}>{layout.yTicks.map((tick) => { const y = plotBottom - ((tick - layout.yDomain[0]) / Math.max(layout.yDomain[1] - layout.yDomain[0], 1)) * (plotBottom - plotTop); return <Text key={`yl-${tick}`} style={[styles.profileYTick, { top: y - 8 }]}>{tick.toLocaleString('en-US', { maximumFractionDigits: 1 })}</Text>; })}{layout.xTicks.map((tick) => { const x = plotLeft + ((tick - layout.xDomain[0]) / Math.max(layout.xDomain[1] - layout.xDomain[0], 1)) * (plotRight - plotLeft); return <Text key={`xl-${tick}`} style={[styles.profileXTick, { left: x - 16 }]}>{tick}</Text>; })}<Text style={styles.profileYLabel}>Load ({unit})</Text><Text style={styles.profileXLabel}>Reps</Text></View><View style={StyleSheet.absoluteFillObject} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={(event) => selectNearest(event.nativeEvent.locationX, event.nativeEvent.locationY)} onResponderMove={(event) => selectNearest(event.nativeEvent.locationX, event.nativeEvent.locationY)}>{layout.coordinates.map((point) => <Pressable key={`tap-${point.key}`} accessibilityRole="button" accessibilityLabel={loadRepProfileAccessibilityLabel(point, unit, seriesLabel)} onPress={() => setSelectedKey(point.key)} style={[styles.profileTarget, { left: point.x - 22, top: point.y - 22 }]} />)}{selected && selectedObservation ? <Pressable accessibilityRole="button" accessibilityLabel={`Open exposure from ${dateLabel(selectedObservation.date)}`} onPress={() => onOpenExposure(selectedObservation.exposure_id)} style={[styles.profileTooltip, { left: tooltipLeft, top: tooltipTop }]}><Text style={styles.profileTooltipValue}>{displayWeight(selectedObservation.weight_kg, unit)} {unit} × {selected.reps}{selected.observations.length > 1 ? ` · ${selected.observations.length} sets` : ''}</Text><Text numberOfLines={1} style={styles.profileTooltipDetail}>{selectedEffort} · {dateLabel(selectedObservation.date)}</Text><Text numberOfLines={1} style={styles.profileTooltipSeries}>{seriesLabel} · View evidence</Text></Pressable> : null}</View></View><View style={styles.profileLegend}><View style={styles.profileLegendDot} /><Text numberOfLines={1} style={styles.profileLegendText}>{seriesLabel}</Text><Text style={styles.profileObservationCount}>{layout.observationCount} performed set{layout.observationCount === 1 ? '' : 's'}</Text></View></View>;
}

function StatisticsGrid({ statistics, unit, onOpenExposure }: { statistics: CanonicalMovementHistory['statistics']; unit: MovementHistoryUnit; onOpenExposure: (id: string) => void }) {
  const strength = statistics.estimated_strength_pr;
  const load = statistics.load_pr;
  const rep = statistics.rep_pr_at_load;
  const bestN = statistics.best_n_rep_load;
  return <View style={styles.statisticsGrid}><StatisticCard tone="#A865FF" icon="trending-up-outline" label="EST. STRENGTH" value={strength ? formatCalculatedWeightFromKg(strength.value_kg, unit) || '—' : '—'} detail={strength ? dateLabel(strength.date) : 'No exact estimate'} subdetail={strength?.delta_kg ? `${formatCalculatedWeightDeltaFromKg(strength.delta_kg, unit, 'signed')} vs first exposure` : null} onPress={strength ? () => onOpenExposure(strength.exposure_id) : undefined} /><StatisticCard tone="#ED3F8E" icon="ribbon-outline" label="LOAD PR" value={load ? setLabel(load, unit) : '—'} detail={load ? dateLabel(load.date) : 'No load evidence'} /><StatisticCard tone="#2CC8B7" icon="repeat-outline" label={`REP PR${rep ? ` @ ${displayWeight(rep.weight_kg, unit)} ${unit}` : ''}`} value={rep ? `${rep.reps} reps` : '—'} detail={rep?.previous_reps != null ? `Previous: ${rep.previous_reps} reps` : 'No prior rep match'} /><StatisticCard tone="#E4A92F" icon="barbell-outline" label={bestN ? `BEST ${bestN.target_reps}-REP LOAD` : 'REP-RANGE LOAD'} value={bestN ? `${displayWeight(bestN.weight_kg, unit)} ${unit} × ${bestN.reps}` : '—'} detail={bestN ? 'Exact performed evidence' : 'No matching exposure'} /></View>;
}

function StatisticCard({ tone, icon, label, value, detail, subdetail, onPress }: { tone: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string; detail: string; subdetail?: string | null; onPress?: () => void }) {
  const body = <><View style={styles.statHeader}><Text style={[styles.statLabel, { color: tone }]}>{label}</Text><Ionicons name={icon} size={17} color={tone} /></View><Text numberOfLines={2} style={styles.statValue}>{value}</Text><Text style={styles.statDetail}>{detail}</Text>{subdetail ? <Text style={[styles.statSubdetail, { color: tone }]}>{subdetail}</Text> : null}</>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [styles.statCard, pressed && styles.pressed]}>{body}</Pressable> : <View style={styles.statCard}>{body}</View>;
}

function ExposureRow({ exposure, unit, onPress }: { exposure: CanonicalHistoryExposure; unit: MovementHistoryUnit; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Exposure on ${dateLabel(exposure.date)}, ${setLabel(exposure.best_set, unit)}`} onPress={onPress} style={({ pressed }) => [styles.exposureRow, pressed && styles.pressed]}><View style={styles.exposureHeaderRow}><View style={styles.exposureDate}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86} style={styles.exposureDateText}>{dateLabel(exposure.date)}</Text>{relativeDate(exposure.date) ? <Text style={styles.exposureToday}>{relativeDate(exposure.date)}</Text> : null}</View><View style={styles.exposureEquipment}>{exposure.equipment?.manufacturer?.display_name ? <View style={styles.exposureBrandMark}><ManufacturerBrandMark compact manufacturerName={exposure.equipment.manufacturer.display_name} /></View> : <View style={styles.standardEquipment}><Ionicons name="help-outline" size={18} color="#A66DE5" /></View>}<View style={styles.exposureEquipmentCopy}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84} style={styles.exposureEquipmentName}>{compactEquipmentLabel(exposure.equipment?.label)}</Text><Text numberOfLines={1} style={styles.exposureSetCount}>{exposure.set_count} set{exposure.set_count === 1 ? '' : 's'}</Text></View></View><Ionicons name="chevron-forward" size={18} color="#8B718F" /></View><View style={styles.exposureMetrics}><ExposureMetric label="TOP SET" value={compactSetLoad(exposure.best_set, unit)} detail={compactSetEffort(exposure.best_set)} wide /><ExposureMetric label="VOLUME" value={`${displayWeight(exposure.total_volume_kg, unit, 0)} ${unit}`} /><ExposureMetric label="e10RM" value={formatCalculatedWeightFromKg(exposure.e10rm_kg, unit) || '—'} accent last /></View></Pressable>;
}

function ExposureMetric({ label, value, detail, wide = false, accent = false, last = false }: { label: string; value: string; detail?: string | null; wide?: boolean; accent?: boolean; last?: boolean }) {
  return <View style={[styles.exposureMetricCell, wide && styles.exposureMetricWide, last && styles.exposureMetricLast]}><Text numberOfLines={1} style={styles.exposureLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.exposureMetricValue, accent && styles.exposureE10]}>{value}</Text>{detail ? <Text numberOfLines={1} style={styles.exposureMetricDetail}>{detail}</Text> : null}</View>;
}

function ChoiceSheet({ visible, title, choices, selected, onSelect, onClose }: { visible: boolean; title: string; choices: { key: string; label: string }[]; selected: string; onSelect: (key: string) => void; onClose: () => void }) {
  return <StrengthLedgerBottomSheet accessibilityLabel={title} heightFraction={0.52} visible={visible} onDismiss={onClose} onRequestClose={onClose}><View style={styles.choiceSheet}><Text style={styles.sheetTitle}>{title}</Text><ScrollView contentContainerStyle={styles.choiceList}>{choices.map((choice) => <Pressable key={choice.key} accessibilityRole="button" accessibilityState={{ selected: selected === choice.key }} onPress={() => onSelect(choice.key)} style={[styles.choiceRow, selected === choice.key && styles.choiceRowSelected]}><Text style={[styles.choiceText, selected === choice.key && styles.choiceTextSelected]}>{choice.label}</Text>{selected === choice.key ? <Ionicons name="checkmark" size={18} color="#B975F4" /> : null}</Pressable>)}</ScrollView></View></StrengthLedgerBottomSheet>;
}

function FilterSheet({ visible, selected, onSelect, onClose }: { visible: boolean; selected: FilterPreset; onSelect: (value: FilterPreset) => void; onClose: () => void }) {
  const choices: { key: FilterPreset; label: string; detail: string }[] = [
    { key: 'all', label: 'All exact evidence', detail: 'No RIR or rep-range restriction' },
    { key: 'rir1', label: 'RIR 1 or less', detail: 'High-effort performed sets' },
    { key: 'rir2', label: 'RIR 2 or less', detail: 'Sets within two reps of failure' },
    { key: 'reps6to10', label: '6–10 reps', detail: 'Lower-rep performance scope' },
    { key: 'reps8to12', label: '8–12 reps', detail: 'Common hypertrophy range' },
    { key: 'reps12plus', label: '12+ reps', detail: 'Higher-rep performance scope' },
  ];
  return <StrengthLedgerBottomSheet accessibilityLabel="Movement History Filters" heightFraction={0.72} visible={visible} onDismiss={onClose} onRequestClose={onClose}><View style={styles.choiceSheet}><Text style={styles.sheetTitle}>Filters</Text><Text style={styles.sheetSubtitle}>Every option recalculates plots, statistics, equipment evidence, and exposure history.</Text><ScrollView contentContainerStyle={styles.choiceList}>{choices.map((choice) => <Pressable key={choice.key} accessibilityRole="button" accessibilityState={{ selected: selected === choice.key }} onPress={() => onSelect(choice.key)} style={[styles.filterChoice, selected === choice.key && styles.choiceRowSelected]}><View style={styles.filterChoiceCopy}><Text style={[styles.choiceText, selected === choice.key && styles.choiceTextSelected]}>{choice.label}</Text><Text style={styles.filterChoiceDetail}>{choice.detail}</Text></View>{selected === choice.key ? <Ionicons name="checkmark-circle" size={19} color="#B975F4" /> : <View style={styles.choiceCircle} />}</Pressable>)}</ScrollView><View style={styles.filterActions}><Pressable onPress={() => onSelect('all')} style={styles.resetButton}><Text style={styles.resetButtonText}>Reset Filters</Text></Pressable><Pressable onPress={onClose} style={styles.applyButton}><Text style={styles.applyButtonText}>Apply</Text></Pressable></View></View></StrengthLedgerBottomSheet>;
}

function ExposureDetailContent({ detail, loading, error, unit, onViewSession }: { detail: CanonicalHistoryExposureDetail | null; loading: boolean; error: string | null; unit: MovementHistoryUnit; onViewSession: (id: number) => void }) {
  if (loading) return <State icon="hourglass-outline" title="Loading immutable exposure evidence" />;
  if (error) return <State icon="alert-circle-outline" title={error} />;
  if (!detail) return null;
  const thumbnails = detail.sets.filter((row) => row.video?.thumbnail_url);
  return <View style={styles.detailSheet}><Text style={styles.detailKicker}>EXPOSURE DETAILS</Text><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}><View style={styles.detailDateRow}><View><Text style={styles.detailDate}>{dateLabel(detail.date)}</Text>{relativeDate(detail.date) ? <Text style={styles.exposureToday}>{relativeDate(detail.date)}</Text> : null}</View></View><View style={styles.detailEquipment}>{detail.equipment?.manufacturer?.display_name ? <ManufacturerBrandMark compact manufacturerName={detail.equipment.manufacturer.display_name} /> : <View style={styles.standardEquipment}><Ionicons name="help-outline" size={20} color="#A66DE5" /></View>}<Text style={styles.detailEquipmentLabel}>{detail.equipment?.label || 'Unknown'}</Text></View><View style={styles.detailSummary}><View style={styles.detailSummaryPrimary}><Text style={styles.detailSummaryValue}>{setLabel(detail.best_set, unit)}</Text><Text style={styles.detailSummaryLabel}>Top Set · Canonical Exposure</Text></View><View style={styles.detailSummaryMetric}><Text style={styles.detailSummaryAccent}>{formatCalculatedWeightFromKg(detail.e10rm_kg, unit) || '—'}</Text><Text style={styles.detailSummaryLabel}>e10RM</Text></View><View style={styles.detailSummaryMetric}><Text style={styles.detailSummaryValue}>{displayWeight(detail.total_volume_kg, unit, 0)} {unit}</Text><Text style={styles.detailSummaryLabel}>Total Volume</Text></View></View><Text style={styles.detailSectionTitle}>SETS PERFORMED</Text><View style={styles.detailSetList}>{detail.sets.map((set) => <View key={set.id} style={styles.detailSetRow}><View style={styles.setIndex}><Text style={styles.setIndexText}>{set.set_index}</Text></View><Text style={styles.detailSetValue}>{setLabel(set, unit)}</Text>{set.pr_indicators?.length ? <View style={styles.prBadge}><Text style={styles.prBadgeText}>PR</Text></View> : null}</View>)}</View>{detail.duration_seconds ? <View style={styles.detailFacts}><DetailFact label="Duration" value={durationLabel(detail.duration_seconds)} /></View> : null}{detail.movement_notes?.length || detail.session_notes ? <View style={styles.detailNotes}><Text style={styles.detailSectionTitle}>NOTES</Text>{detail.movement_notes?.map((note, index) => <Text key={index} style={styles.noteText}>{note}</Text>)}{detail.session_notes ? <Text style={styles.noteText}>{detail.session_notes}</Text> : null}</View> : null}{thumbnails.length ? <View><Text style={styles.detailSectionTitle}>VIDEOS</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videoRail}>{thumbnails.map((set) => <View key={set.id} style={styles.videoCard}>{set.video?.thumbnail_url ? <Image source={{ uri: absoluteAssetUrl(set.video.thumbnail_url)! }} resizeMode="cover" style={StyleSheet.absoluteFillObject} /> : null}<LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFillObject} /><View style={styles.videoPlay}><Ionicons name="play" size={16} color="#FFFFFF" /></View><Text style={styles.videoLabel}>SET {set.set_index}</Text></View>)}</ScrollView></View> : null}<Pressable accessibilityRole="button" onPress={() => onViewSession(detail.session.id)} style={styles.viewSession}><Text style={styles.viewSessionText}>View Full Session</Text></Pressable></ScrollView></View>;
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailFact}><Text style={styles.detailFactLabel}>{label}</Text><Text style={styles.detailFactValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020205' },
  content: { paddingHorizontal: 14, paddingBottom: SLLayout.tabBarClearance + 26 },
  navbar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navTitleText: { color: '#B971FF', fontSize: 17, lineHeight: 22, fontWeight: '600' },
  movementHeader: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  muscleArtworkFrame: { width: 96, height: 86, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  movementIdentity: { flex: 1, minWidth: 0, gap: 4 },
  movementName: { color: '#FAF8FC', fontSize: 25, lineHeight: 31, fontWeight: '600' },
  movementMuscles: { color: '#AAA5B1', fontSize: 15, lineHeight: 20 },
  favoriteButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  summaryStrip: { minHeight: 70, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#2A2D36', backgroundColor: '#080A0F' },
  summaryFact: { flex: 0.75, justifyContent: 'center', gap: 3, paddingHorizontal: 12, borderRightWidth: StyleSheet.hairlineWidth, borderColor: '#292C35' },
  summaryFactWide: { flex: 1.4, borderRightWidth: 0 },
  summaryValue: { color: '#F0EDF4', fontSize: 16, lineHeight: 20, fontWeight: '600' },
  summaryLabel: { color: '#85818D', fontSize: 12, lineHeight: 16 },
  controlRow: { flexDirection: 'row', gap: 7, marginTop: 12, marginBottom: 12 },
  topControl: { flex: 1, minWidth: 0, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: '#2B2E38', backgroundColor: '#080A0F' },
  topControlActive: { borderColor: '#694384', backgroundColor: '#110B17' },
  topControlText: { flexShrink: 1, color: '#D8D5DD', fontSize: 13, lineHeight: 17, fontWeight: '500' },
  topControlTextActive: { color: '#C995FF' },
  section: { marginTop: 10, overflow: 'hidden', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#20232B', backgroundColor: '#07090D' },
  sectionHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionTitle: { color: '#B773F0', fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.45 },
  sectionMeta: { color: '#818590', fontSize: 11, lineHeight: 15 },
  equipmentRail: { gap: 8, paddingHorizontal: 9, paddingBottom: 10 },
  equipmentCard: { width: 174, minHeight: 154, gap: 4, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2B2E37', backgroundColor: '#090B10' },
  equipmentCardSelected: { borderColor: '#904FC8', backgroundColor: '#100A17' },
  equipmentBrandRow: { minHeight: 40, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  allComparableIcon: { width: 46, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#171020' },
  primaryBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: '#4B2368' },
  primaryBadgeText: { color: '#D1A3F1', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  equipmentName: { color: '#ECE8F0', fontSize: 13, lineHeight: 17, fontWeight: '600' },
  equipmentCount: { color: '#80848F', fontSize: 11, lineHeight: 15 },
  equipmentMetricLabel: { marginTop: 5, color: '#6F737E', fontSize: 10, lineHeight: 13, letterSpacing: 0.35 },
  equipmentMetricValue: { color: '#D9D5DD', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  equipmentLast: { color: '#8B8791', fontSize: 11, lineHeight: 15 },
  comparisonNote: { paddingHorizontal: 10, paddingBottom: 10, color: '#737780', fontSize: 10.5, lineHeight: 14 },
  analyticsSection: { marginTop: 10, padding: 9, overflow: 'hidden', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#20232B', backgroundColor: '#07090D' },
  analyticsHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionNumber: { width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1 },
  sectionNumberText: { fontSize: 11, fontWeight: '800' },
  analyticsTitle: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.35 },
  analyticsSubtitle: { flex: 1, color: '#878A94', fontSize: 10.5, lineHeight: 14 },
  chartUnitRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartUnit: { color: '#A3A0AA', fontSize: 12, lineHeight: 16 },
  rangePills: { flexDirection: 'row', gap: 2 },
  rangePill: { minWidth: 31, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  rangePillActive: { backgroundColor: '#7A3CAC' },
  rangePillText: { color: '#777A84', fontSize: 10, fontWeight: '600' },
  rangePillTextActive: { color: '#FFFFFF' },
  chartFootnote: { marginTop: 6, color: '#6F737D', fontSize: 10, lineHeight: 14 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  legendRing: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#EF3C8C' },
  legendText: { color: '#797C86', fontSize: 10.5, lineHeight: 14 },
  profileChart: { height: 246, overflow: 'hidden', borderRadius: 9, backgroundColor: '#07090E' },
  profileTarget: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
  profileYLabel: { position: 'absolute', left: 5, top: 4, color: '#969AA5', fontSize: 10.5, fontWeight: '600' },
  profileXLabel: { position: 'absolute', right: 12, bottom: 4, color: '#969AA5', fontSize: 10.5, fontWeight: '600' },
  profileYTick: { position: 'absolute', left: 4, width: 39, color: '#A6A9B3', fontSize: 10.5, lineHeight: 16, textAlign: 'right' },
  profileXTick: { position: 'absolute', bottom: 25, width: 32, color: '#A6A9B3', fontSize: 10.5, lineHeight: 16, textAlign: 'center' },
  profileTooltip: { position: 'absolute', width: 160, minHeight: 62, justifyContent: 'center', gap: 2, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#A865FF', backgroundColor: '#171020' },
  profileTooltipValue: { color: '#F4EBFA', fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
  profileTooltipDetail: { color: '#C5BFCA', fontSize: 10.5, lineHeight: 14 },
  profileTooltipSeries: { color: '#B978EF', fontSize: 10, lineHeight: 13, fontWeight: '600' },
  profileLegend: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 5 },
  profileLegendDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#A865FF' },
  profileLegendText: { flex: 1, minWidth: 0, color: '#A9A5AF', fontSize: 11, lineHeight: 15 },
  profileObservationCount: { color: '#7E818B', fontSize: 10.5, lineHeight: 15 },
  profileEmpty: { minHeight: 176, alignItems: 'center', justifyContent: 'center', gap: 5, padding: 20, borderRadius: 9, backgroundColor: '#07090E' },
  profileEmptyTitle: { color: '#D9D5DD', fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  profileEmptyBody: { color: '#7D818C', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  statisticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 8 },
  statCard: { width: '49%', minHeight: 96, gap: 3, padding: 9, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#292C34', backgroundColor: '#090B10' },
  statHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statLabel: { flex: 1, fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.25 },
  statValue: { color: '#F0EDF3', fontSize: 16, lineHeight: 21, fontWeight: '600' },
  statDetail: { color: '#868A94', fontSize: 10.5, lineHeight: 14 },
  statSubdetail: { fontSize: 10, lineHeight: 13 },
  exposureList: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#20232B' },
  exposureRow: { minHeight: 132, paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#20232B' },
  exposureHeaderRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exposureDate: { width: 104, minWidth: 0 },
  exposureDateText: { color: '#E4E0E7', fontSize: 13, lineHeight: 17, fontWeight: '600' },
  exposureToday: { color: '#52D487', fontSize: 10, lineHeight: 13 },
  exposureEquipment: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  exposureBrandMark: { width: 68, height: 40, alignItems: 'center', justifyContent: 'center' },
  exposureEquipmentCopy: { flex: 1, minWidth: 0 },
  exposureEquipmentName: { color: '#D4D0D9', fontSize: 12.5, lineHeight: 16, fontWeight: '500' },
  exposureSetCount: { color: '#777B86', fontSize: 10.5, lineHeight: 14 },
  standardEquipment: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#14101A' },
  exposureMetrics: { minHeight: 55, flexDirection: 'row', marginTop: 9, overflow: 'hidden', borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#242730', backgroundColor: '#090B10' },
  exposureMetricCell: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 1, paddingHorizontal: 10, borderRightWidth: StyleSheet.hairlineWidth, borderColor: '#282B34' },
  exposureMetricWide: { flex: 1.35 },
  exposureMetricLast: { borderRightWidth: 0 },
  exposureLabel: { color: '#777B86', fontSize: 10, lineHeight: 13, fontWeight: '600', letterSpacing: 0.2 },
  exposureMetricValue: { color: '#DED9E2', fontSize: 12.5, lineHeight: 16, fontWeight: '600' },
  exposureMetricDetail: { color: '#87828E', fontSize: 10, lineHeight: 13 },
  exposureE10: { color: '#B979F1' },
  loadMore: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  loadMoreText: { color: '#B778F2', fontSize: 12, fontWeight: '600' },
  truthfulEmpty: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 18 },
  truthfulEmptyTitle: { color: '#D9D5DD', fontSize: 16, lineHeight: 21, fontWeight: '600' },
  truthfulEmptyBody: { color: '#747883', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  state: { flex: 1, minHeight: 360, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateText: { color: '#BEBAC5', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  stateAction: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 9, borderWidth: 1, borderColor: '#734A91' },
  stateActionText: { color: '#C893F3', fontSize: 13, fontWeight: '600' },
  choiceSheet: { flex: 1, minHeight: 0, paddingHorizontal: 14 },
  sheetTitle: { color: '#F2EEF4', fontSize: 18, lineHeight: 23, fontWeight: '600' },
  sheetSubtitle: { marginTop: 4, color: '#85808D', fontSize: 13, lineHeight: 18 },
  choiceList: { gap: 7, paddingTop: 13, paddingBottom: 20 },
  choiceRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#2D3039', backgroundColor: '#090B10' },
  choiceRowSelected: { borderColor: '#824CB0', backgroundColor: '#171020' },
  choiceText: { color: '#B9B5C0', fontSize: 14, lineHeight: 19 },
  choiceTextSelected: { color: '#E1C4F7', fontWeight: '600' },
  filterChoice: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#2D3039', backgroundColor: '#090B10' },
  filterChoiceCopy: { flex: 1, gap: 2 },
  filterChoiceDetail: { color: '#767A85', fontSize: 12, lineHeight: 16 },
  choiceCircle: { width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: '#545762' },
  filterActions: { flexDirection: 'row', gap: 8, paddingVertical: 10 },
  resetButton: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#343741' },
  resetButtonText: { color: '#AAA6B1', fontSize: 13, fontWeight: '600' },
  applyButton: { flex: 1.35, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#7938B5' },
  applyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  detailSheet: { flex: 1, minHeight: 0, paddingHorizontal: 14 },
  detailKicker: { color: '#B86DF6', fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.4 },
  detailContent: { gap: 13, paddingTop: 10, paddingBottom: 18 },
  detailDateRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  detailDate: { color: '#F0ECF3', fontSize: 15, lineHeight: 19, fontWeight: '600' },
  detailEquipment: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailEquipmentLabel: { flex: 1, color: '#DCD7E1', fontSize: 11, fontWeight: '500' },
  detailSummary: { minHeight: 76, flexDirection: 'row', alignItems: 'stretch', borderRadius: 9, borderWidth: 1, borderColor: '#70409A', backgroundColor: '#100B17' },
  detailSummaryPrimary: { flex: 1.3, justifyContent: 'center', gap: 3, paddingHorizontal: 10, borderRightWidth: StyleSheet.hairlineWidth, borderColor: '#36243F' },
  detailSummaryMetric: { flex: 0.8, alignItems: 'center', justifyContent: 'center', gap: 3, borderRightWidth: StyleSheet.hairlineWidth, borderColor: '#36243F' },
  detailSummaryValue: { color: '#F0EDF3', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  detailSummaryAccent: { color: '#B978F0', fontSize: 16, lineHeight: 19, fontWeight: '600' },
  detailSummaryLabel: { color: '#747783', fontSize: 10, lineHeight: 13, textAlign: 'center' },
  detailSectionTitle: { color: '#A9A5AF', fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 0.4 },
  detailSetList: { overflow: 'hidden', borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#292C34' },
  detailSetRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292C34', backgroundColor: '#090B10' },
  setIndex: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#171A21' },
  setIndexText: { color: '#A7A3AE', fontSize: 12 },
  detailSetValue: { flex: 1, color: '#E5E1E8', fontSize: 13 },
  prBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: '#A3781B' },
  prBadgeText: { color: '#E5B94C', fontSize: 10, fontWeight: '700' },
  detailFacts: { gap: 2 },
  detailFact: { minHeight: 31, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#242730' },
  detailFactLabel: { color: '#7B7F89', fontSize: 12 },
  detailFactValue: { color: '#D3CFD8', fontSize: 12 },
  detailNotes: { gap: 6 },
  noteText: { color: '#C9C4CE', fontSize: 13, lineHeight: 19 },
  videoRail: { gap: 8, paddingTop: 7 },
  videoCard: { width: 164, height: 105, overflow: 'hidden', borderRadius: 8, backgroundColor: '#0A0C11' },
  videoPlay: { position: 'absolute', left: '50%', top: '50%', width: 34, height: 34, marginLeft: -17, marginTop: -17, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.62)' },
  videoLabel: { position: 'absolute', left: 8, bottom: 6, color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  viewSession: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#7938B5' },
  viewSessionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.988 }] },
});
