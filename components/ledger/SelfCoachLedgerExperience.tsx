import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View, type ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@/components/ui/sl-text';
import { SLScreen } from '@/components/ui/sl-screen';
import { SLCompactDropdown } from '@/components/ui/sl-compact-dropdown';
import { KeyboardModal as Modal, KeyboardScrollView } from '@/components/keyboard/KeyboardSurface';
import { FloatingControlCoordinator } from '@/components/ui/floating-control-coordinator';
import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import { useAuth } from '@/context/AuthContext';
import { LEDGER as T } from '@/constants/ledger';
import { kilogramsToDisplayValue } from '@/lib/display-units';
import type { LedgerRange, LedgerUnit } from '@/lib/ledger-data';
import { ledgerDate, performanceSource, performedWeightValue, recordProfile, RECORD_LIFTS, type LedgerSource, type RecordLift } from '@/lib/ledger-records';
import { canonicalPrHistory, resolveLedgerClubsRuntimeState } from '@/lib/ledger-rewards';
import { ledgerCompetitionArtwork } from '@/lib/ledger-movement-art';
import { movementHistorySheetRouteForCanonicalIdentity } from '@/lib/movement-history-launch';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';
import type { CoreVariantMovement } from '@/lib/ledger-variants';
import { useLedgerLiveData } from './use-ledger-live-data';
import { LedgerMovementBackdrop } from './LedgerMovementBackdrop';
import { LedgerHistoryPane, type LedgerHistoryFocus } from './LedgerHistoryPane';
import type { HistoryFilter } from './use-ledger-history';
import { ArchiveDetailExperience } from './archive-detail';
import { LedgerSourceContent } from './LedgerSourceContent';
import { AccessoryList, CoreRecord, Milestones, TrainingContext, VariantList, VariantRecord } from './LedgerExperience';

const C = T.colors;
type Page = 'home' | 'lift' | 'variants' | 'accessories' | 'context' | 'milestones';

/** Self-Coach's normal Progress entry. All evidence comes from authenticated APIs. */
export default function SelfCoachLedgerExperience() {
  const { user } = useAuth();
  const intent = useLocalSearchParams<{ lift?: string; family?: string; tab?: string }>();
  return <ConnectedProgress key={`${user?.id}:${intent.lift ?? ''}:${intent.family ?? ''}:${intent.tab ?? ''}`} />;
}

function ConnectedProgress() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ lift?: string; family?: string; tab?: string }>();
  const initialLift = RECORD_LIFTS.find(lift => lift.key === params.lift)?.key;
  const [page, setPage] = useState<Page>(initialLift ? 'lift' : params.family === 'variants' ? 'variants' : params.family === 'accessories' ? 'accessories' : params.tab === 'milestones' ? 'milestones' : 'home');
  const [lift, setLift] = useState<RecordLift>(initialLift ?? 'squat');
  const [variant, setVariant] = useState<CoreVariantMovement | null>(null);
  const [range, setRange] = useState<LedgerRange>('90d');
  const [advanced, setAdvanced] = useState(false);
  const [metric, setMetric] = useState('load');
  const [standards, setStandards] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>('training');
  const [focus, setFocus] = useState<LedgerHistoryFocus>();
  const [sources, setSources] = useState<LedgerSource[]>([]);
  const [sourceUnit, setSourceUnit] = useState<LedgerUnit>();
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const restoring = useRef(false);
  const data = useLedgerLiveData(range);
  const { unit, toggleUnit } = useSurfaceWeightUnit(data.progression?.athlete?.preferred_units ?? user?.preferred_units);
  const athleteId = data.progression?.athlete?.id ?? user?.self_athlete_id ?? user?.athlete_id;
  const location = `${page}:${page === 'lift' ? lift : page === 'variants' ? variant?.core_movement_id ?? '' : ''}`;
  const back = () => { setPage('home'); setVariant(null); setAdvanced(false); };
  const open = (source: LedgerSource) => { setSourceUnit(unit); setSources([source]); };
  useLayoutEffect(() => {
    restoring.current = true;
    const frame = requestAnimationFrame(() => {
      scroll.current?.scrollTo({ y: offsets.current[location] ?? 0, animated: false });
      restoring.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [location]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sources.length) { setSources(previous => previous.slice(0, -1)); return true; }
      if (page !== 'home') { back(); return true; }
      return false;
    });
    return () => listener.remove();
  }, [page, sources.length]);
  const events = canonicalPrHistory([...data.accomplishments, ...data.currentBests.flatMap(best => best.event ? [best.event] : [])]);
  const performedPr = events.find(event => event.event_type === 'CORE_WEIGHT_PR' && event.unit === 'kg' && typeof event.current_value === 'number' && Number.isFinite(event.current_value));
  const clubs = resolveLedgerClubsRuntimeState(data.currentBests, data.strengthStandard ?? data.progression?.strength_standard, data.strengthStanding, unit);
  const openLift = (next: RecordLift) => { setLift(next); setAdvanced(false); setPage('lift'); };

  return <SLScreen edges="none" padded={false} disableEntranceMotion style={s.screen}>
    <FloatingControlCoordinator context="tab-screen">
      <View style={[s.fill, s.canvas]} testID="self-coach-ledger">
        <View style={s.header}>
          <Text accessibilityRole="header" testID="ledger-page-title" style={s.title}>The Ledger</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Weight unit ${unit}. Switch units`} onPress={toggleUnit} style={s.unit}>
            <Text style={s.body}>{unit}</Text><Ionicons name="swap-horizontal" size={17} color={C.secondary} />
          </Pressable>
        </View>
        <KeyboardScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}
          onScroll={event => { if (!restoring.current) offsets.current[location] = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={100}>
          {/* Keep the archive mounted so its date, query and collection survive every evidence round trip. */}
          <View style={page !== 'home' && s.hidden} accessibilityElementsHidden={page !== 'home'} importantForAccessibility={page !== 'home' ? 'no-hide-descendants' : 'auto'}>
            <StrengthRecord data={data} unit={unit} range={range} onRange={setRange} open={open} onDetail={openLift} onBrowse={setPage} />
            <View style={s.archive}>
              <Text accessibilityRole="header" style={s.heading}>Training archive</Text>
              <LedgerHistoryPane presentation="self-coach" subject={`${user?.id}:${athleteId ?? 'self'}`} unit={unit} open={open} filter={filter} setFilter={setFilter} focus={focus} />
            </View>
            <View style={s.footerLinks}>
              <Destination title="Milestones" detail="Earned records & collections" icon="trophy-outline" onPress={() => setPage('milestones')} />
              <Destination title="Bodyweight & readiness" detail="Your check-ins and training context" icon="pulse-outline" onPress={() => setPage('context')} />
            </View>
          </View>
          {page !== 'home' ? <Pressable accessibilityRole="button" accessibilityLabel="Back to The Ledger" onPress={back} style={s.back}><Ionicons name="chevron-back" size={20} color={C.accent} /><Text style={s.link}>The Ledger</Text></Pressable> : null}
          {page === 'lift' ? <>
            <Text accessibilityRole="header" style={s.detailTitle}>Competition {RECORD_LIFTS.find(item => item.key === lift)?.label}</Text>
            <StrengthRecord data={data} unit={unit} range={range} onRange={setRange} open={open} fixedLift={lift} />
            <Destination title={advanced ? 'Hide detailed analysis' : 'Rep records & analysis'} detail="Rep-specific loads, volume and strength reference" icon="analytics-outline" onPress={() => setAdvanced(value => !value)} />
            {advanced ? <CoreRecord lift={lift} range={range} metric={metric} setRange={setRange} setMetric={setMetric} unit={unit} back={() => setAdvanced(false)} open={open} standards={standards} onStandards={() => setStandards(value => !value)} onAnalysis={() => router.push({ pathname: '/(tabs)/ledger/analysis', params: { lift, displayUnit: unit } } as never)} /> : null}
          </> : null}
          {page === 'variants' ? variant
            ? <VariantRecord movement={variant} unit={unit} back={() => setVariant(null)} open={open} />
            : <><Text style={s.detailTitle}>Core variants</Text><VariantList select={setVariant} /></> : null}
          {page === 'accessories' ? <><Text style={s.detailTitle}>Accessories</Text><AccessoryList onSelect={id => {
            if (!athleteId) return;
            const target = movementHistorySheetRouteForCanonicalIdentity({ athleteId, movementDefinitionId: id });
            router.push({ ...target, params: { ...target.params, displayUnit: unit, ledgerAtmosphere: '1' } } as never);
          }} /></> : null}
          {page === 'context' ? <TrainingContext embedded unit={unit} back={back} open={open} onMuscles={() => router.push('/(tabs)/ledger/muscle-groups' as never)} onHistory={back} /> : null}
          {page === 'milestones' ? <Milestones clubs={clubs} performedPr={performedPr} unit={unit} loading={data.loading} error={data.error} reload={() => void data.reload()} open={open} collection={() => router.push('/(tabs)/ledger/achievements' as never)} history={() => { setFilter('prs'); back(); }} /> : null}
        </KeyboardScrollView>
      </View>
      <Modal backdropColor="#100E16" visible={sources.length > 0} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSources(previous => previous.slice(0, -1))}>
        <SLScreen edges="both" padded={false} style={s.screen}>
          <FloatingControlCoordinator context="sheet">
            <View style={s.sourceHeader}>
              {sources.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Previous source record" onPress={() => setSources(previous => previous.slice(0, -1))} style={s.unit}><Ionicons name="chevron-back" size={23} color={C.text} /></Pressable> : null}
              <Text style={[s.heading, s.fill]}>Original evidence</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close record" onPress={() => setSources([])} style={s.unit}><Ionicons name="close" size={24} color={C.text} /></Pressable>
            </View>
            <KeyboardScrollView contentContainerStyle={s.sourceContent}>
              {sources.length ? <ArchiveDetailExperience key={`${sources.at(-1)?.type}:${sources.at(-1)?.id}`} target={sources.at(-1)} presentation="ledger" initialDisplayUnit={sourceUnit ?? unit} onDisplayUnitChange={setSourceUnit}
                onClose={() => setSources(previous => previous.slice(0, -1))} onOpenSource={source => setSources(previous => [...previous, source])}
                renderContent={(item, display, onPlay) => <LedgerSourceContent item={item} unit={display} onPlay={onPlay} onOpen={source => setSources(previous => [...previous, source])} onBrowseFilm={entry => {
                  setSources([]); setFilter('media'); setFocus({ nonce: Date.now(), query: entry.title, from: entry.occurred_on, to: entry.occurred_on }); back();
                }} />} /> : null}
            </KeyboardScrollView>
          </FloatingControlCoordinator>
        </SLScreen>
      </Modal>
    </FloatingControlCoordinator>
  </SLScreen>;
}

function StrengthRecord({ data, unit, range, onRange, open, onDetail, onBrowse, fixedLift }: {
  data: ReturnType<typeof useLedgerLiveData>; unit: LedgerUnit; range: LedgerRange; onRange: (range: LedgerRange) => void;
  open: (source: LedgerSource) => void; onDetail?: (lift: RecordLift) => void; onBrowse?: (page: 'variants' | 'accessories') => void; fixedLift?: RecordLift;
}) {
  const [selected, setSelected] = useState<RecordLift | null>(null);
  const [pointIndex, setPointIndex] = useState<number | null>(null);
  const profiles = RECORD_LIFTS.map(lift => recordProfile(lift.key, data.progression, data.currentBests));
  const firstRecorded = profiles.find(profile => profile.best || profile.lenses?.weight_on_bar.points.length)?.key;
  const lift = fixedLift ?? selected ?? firstRecorded ?? 'squat';
  const profile = profiles.find(item => item.key === lift)!;
  const raw = profile.lenses?.weight_on_bar.points ?? [];
  const series = useMemo(() => [{ key: lift, label: 'Recorded load', color: C.accent, points: raw.map((point, sourceIndex) => ({ id: `${point.source_type ?? 'set'}:${point.source_set_log_id ?? point.source_id ?? `${point.date}:${sourceIndex}`}`, date: point.date, value: kilogramsToDisplayValue(point.value_kg, unit), meta: { sourceIndex } })) }], [lift, raw, unit]);
  const chartMetric = useMemo(() => analyticalMetricDefinition('self-coach-performed-load', { label: 'Recorded load', kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 1 }), [unit]);
  const points = series[0].points;
  const point = pointIndex == null ? null : raw[pointIndex];
  const source = point ? performanceSource(point) : profile.source;
  const pointEvidence = point ? profile.lenses?.source_evidence.recent_sources.find(entry =>
    entry.source_set_log_id != null && entry.source_set_log_id === point.source_set_log_id
    || entry.source_type === point.source_type && entry.source_id != null && entry.source_id === point.source_id) : null;
  const displayedReps = point ? pointEvidence?.reps : profile.reps;
  const evidence = profile.lenses?.source_evidence.recent_sources ?? [];
  useEffect(() => setPointIndex(null), [lift, range]);
  if (data.loading) return <View style={s.state}><ActivityIndicator color={C.accent} /><Text style={s.secondary}>Opening your training record…</Text></View>;
  if (data.error) return <View style={s.state}><Text style={s.body}>{data.error}</Text><Pressable accessibilityRole="button" onPress={() => void data.reload()} style={s.back}><Text style={s.link}>Try again</Text></Pressable></View>;
  const label = RECORD_LIFTS.find(item => item.key === lift)!.label;
  return <View testID="self-coach-strength-record">
    <View style={s.hero}>
      <LedgerMovementBackdrop movement={ledgerCompetitionArtwork(lift)} width={235} testID="self-coach-record-atmosphere" />
      <View style={s.heroCopy}>
        {!fixedLift ? <SLCompactDropdown appearance="ledger" label={label} value={lift} accessibilityLabel="Featured lift" minMenuWidth={205}
          options={RECORD_LIFTS.map(item => ({ value: item.key, label: item.label }))} onValueChange={value => { setSelected(value as RecordLift); setPointIndex(null); }} /> : null}
        <Text style={s.caption}>{point ? profile.lenses?.weight_on_bar.aggregation === 'week' ? 'SELECTED WEEKLY TOP LOAD' : 'SELECTED SESSION TOP LOAD' : 'BEST RECORDED LOAD'}</Text>
        <View style={s.loadRow}><Text style={s.record}>{performedWeightValue(point?.value_kg ?? profile.best?.best_value, unit)}</Text><Text style={s.loadUnit}>{unit}</Text>{displayedReps != null ? <Text style={s.reps}>× {displayedReps}</Text> : null}</View>
        <Text style={s.caption}>{point ? `${profile.lenses?.weight_on_bar.aggregation === 'week' ? 'Week of ' : ''}${ledgerDate(point.date)}` : profile.best ? ledgerDate(profile.best.event?.workout_date || profile.best.event?.occurred_at) : 'Your first set starts this record'}</Text>
        {source ? <Pressable accessibilityRole="button" accessibilityLabel="Open original set" onPress={() => open(source)} style={s.sourceLink}><Text style={s.link}>Original set</Text><Ionicons name="arrow-forward" color={C.accent} size={17} /></Pressable> : null}
      </View>
    </View>
    <View style={s.chartHeader}>
      <View><Text style={s.heading}>Recorded load</Text><Text style={s.caption}>{profile.lenses?.weight_on_bar.aggregation === 'week' ? 'Weekly top load' : 'Session top load'} · {unit}</Text></View>
      <SLCompactDropdown appearance="ledger" label={range === '30d' ? '30 days' : range === '90d' ? '90 days' : range === '1y' ? '1 year' : 'All time'} value={range} accessibilityLabel="Record time range" minMenuWidth={160}
        options={[{ value: '30d', label: '30 days' }, { value: '90d', label: '90 days' }, { value: '1y', label: '1 year' }, { value: 'all', label: 'All time' }]} onValueChange={value => onRange(value as LedgerRange)} />
    </View>
    {points.length ? <AnalyticalTimeSeriesChart testID="self-coach-record-chart" series={series} metric={chartMetric} showTooltip={false}
      height={145} surfaceColor="#100E16" readableText showLegend={false} selectedInitially="none" onPointPress={selection => {
        const sourceIndex = selection.values[0]?.meta?.sourceIndex;
        if (typeof sourceIndex === 'number' && Number.isInteger(sourceIndex) && raw[sourceIndex]) setPointIndex(sourceIndex);
      }} />
      : <View style={s.sparse}><Text style={s.body}>Your strength story starts with a set.</Text><Text style={s.caption}>Recorded loads will appear here as you train.</Text></View>}
    {point ? <Pressable accessibilityRole="button" onPress={() => setPointIndex(null)} style={s.back}><Text style={s.link}>Show all-time best</Text></Pressable> : null}
    {points.length === 1 ? <Text style={s.caption}>First observation · a trend needs more training.</Text> : null}
    {onDetail ? <View style={s.historyActions}><Pressable accessibilityRole="button" accessibilityLabel={`Open ${label} history`} onPress={() => onDetail(lift)} style={s.historyLink}><Text style={s.link}>{label} history</Text><Ionicons name="arrow-forward" size={17} color={C.accent} /></Pressable>{onBrowse ? <SLCompactDropdown appearance="ledger" label="All movements" value="browse" accessibilityLabel="Browse movement records" minMenuWidth={220} options={[{value: 'variants', label: 'Core variants'}, {value: 'accessories', label: 'Accessories'}]} onValueChange={value => { if (value === 'variants' || value === 'accessories') onBrowse(value); }} /> : null}</View> : <View style={s.evidence}>
      <View style={s.chartHeader}><Text style={s.heading}>Evidence</Text><Text style={s.caption}>{evidence.length} recent sets</Text></View>
      {evidence.map((entry, index) => {
        const target = performanceSource(entry);
        return <Pressable key={`${entry.source_type}:${entry.source_set_log_id ?? entry.source_id}:${index}`} accessibilityRole={target ? 'button' : undefined} disabled={!target} onPress={() => target && open(target)} style={s.evidenceRow}>
          <Text style={s.secondary}>{ledgerDate(entry.date).replace(/, \d{4}$/, '')}</Text>
          <Text style={[s.body, s.fill]}>{performedWeightValue(entry.weight_kg, unit)} {unit}{entry.reps != null ? ` × ${entry.reps}` : ''}</Text>
          <Ionicons name="chevron-forward" size={18} color={C.accent} />
        </Pressable>;
      })}
    </View>}
  </View>;
}

function Destination({ title, detail, icon, onPress }: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail} onPress={onPress} style={s.destination}>
    <Ionicons name={icon} color={icon === 'trophy-outline' ? C.gold : C.teal} size={23} />
    <View style={s.fill}><Text style={s.body}>{title}</Text><Text style={s.caption}>{detail}</Text></View>
    <Ionicons name="chevron-forward" color={C.muted} size={18} />
  </Pressable>;
}

const s = StyleSheet.create({
  screen: { backgroundColor: '#100E16' }, canvas: { backgroundColor: '#100E16' }, fill: { flex: 1, minWidth: 0 }, hidden: { display: 'none' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, minHeight: 60 },
  title: { color: C.text, fontFamily: T.fonts.bodySemiBold, fontSize: 29, letterSpacing: -0.7 },
  unit: { minWidth: 48, minHeight: 48, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 18, paddingBottom: 130 },
  hero: { minHeight: 190, justifyContent: 'center', marginHorizontal: -8 },
  heroCopy: { width: '53%', gap: 4, paddingLeft: 8, paddingVertical: 8 },
  record: { color: C.text, fontFamily: T.fonts.bodySemiBold, fontSize: 37, lineHeight: 45, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  loadRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' },
  loadUnit: { color: C.secondary, fontSize: 17 }, reps: { color: C.text, fontFamily: T.fonts.bodyMedium, fontSize: 19 },
  heading: { color: C.text, fontFamily: T.fonts.bodySemiBold, fontSize: 19, lineHeight: 26, letterSpacing: -0.3 },
  body: { color: C.text, fontFamily: T.fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  secondary: { color: C.secondary, fontSize: 13, lineHeight: 20 },
  caption: { color: C.muted, fontSize: 12, lineHeight: 18 }, link: { color: C.accent, fontFamily: T.fonts.bodyMedium, fontSize: 14, lineHeight: 21 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sourceLink: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center' },
  historyLink: { minHeight: 48, flexDirection: 'row', gap: 7, alignItems: 'center', flexShrink: 1 },
  historyActions: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingBottom: 6 },
  archive: { marginTop: 18, gap: 8 }, footerLinks: { marginTop: 12 },
  destination: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailTitle: { color: C.text, fontFamily: T.fonts.bodySemiBold, fontSize: 25, lineHeight: 32, marginBottom: 6 },
  evidence: { marginVertical: 14 }, evidenceRow: { minHeight: 58, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  state: { paddingVertical: 35, gap: 12, alignItems: 'center' }, sparse: { paddingVertical: 20, gap: 6 },
  sourceHeader: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  sourceContent: { padding: 18, paddingBottom: 50 },
});
