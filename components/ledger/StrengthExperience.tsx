import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { StrengthSemanticArtwork } from '@/components/ledger/StrengthSemanticArtwork';
import { SLAtmosphericContextHeader, SLCompactTabRail } from '@/components/ui/sl-contextual-header';
import { Text } from '@/components/ui/sl-text';
import { FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { MILESTONE_RENDER_ORIENTATION_STYLE } from '@/lib/barbell/milestone-render-assets';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import { convertDisplayWeightValue, kilogramsToDisplayValue, parseDisplayWeightUnit, roundCalculatedWeightForDisplay } from '@/lib/display-units';
import { archiveDetailHref } from '@/lib/ledger-archive';
import {
  canonicalCompetitionLiftKey,
  canonicalLiftKey,
  type AccomplishmentEvent,
  type CurrentBest,
  type LedgerRange,
  type LedgerUnit,
} from '@/lib/ledger-data';
import {
  canonicalPrHistory,
  resolveLedgerClubsRuntimeState,
  type StrengthTierState,
} from '@/lib/ledger-rewards';
import { LEDGER_INDEX_ASSETS } from '@/lib/ledger-index-assets';
import { STRENGTH_LEDGER_ATMOSPHERE_ASSETS } from '@/lib/strength-ledger-visual-assets';

import { useLedgerScrollToTop } from './primitives';
import { useLedgerLiveData } from './use-ledger-live-data';

const STRENGTH_UNIT_KEY = 'strength-ledger.progression.unit';

type LiftKey = 'squat' | 'bench' | 'deadlift';
type StrengthSection = 'overview' | 'progression' | 'records' | 'analysis';
type LiftPanel = 'progression' | 'evidence' | 'standards';
type PrFilter = 'all' | LiftKey;

type LiftProfile = Readonly<{
  key: LiftKey;
  label: string;
  shortLabel: string;
  tone: string;
  softTone: string;
  currentEstimateKg: number | null;
  historicalPeakKg: number | null;
  historicalPeakDate: string | null;
  changeKg: number | null;
  points: readonly Readonly<{ date: string; valueKg: number }>[];
  estimateSourceSetLogId: number | null;
  tierState: StrengthTierState | null;
  events: readonly AccomplishmentEvent[];
}>;

const LIFTS: readonly Readonly<{
  key: LiftKey;
  label: string;
  shortLabel: string;
  tone: string;
  softTone: string;
}>[] = [
  { key: 'squat', label: 'Squat', shortLabel: 'SQUAT', tone: '#A65CFF', softTone: '#241139' },
  { key: 'bench', label: 'Bench Press', shortLabel: 'BENCH', tone: '#F2539A', softTone: '#351020' },
  { key: 'deadlift', label: 'Deadlift', shortLabel: 'DEADLIFT', tone: '#FF4D64', softTone: '#3B1018' },
];

const LIFT_TIER_ART: Record<LiftKey, readonly ImageSourcePropType[]> = {
  squat: [
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-135.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-225.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-315.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-405.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-495.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-585.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/squat-725.png'),
  ],
  bench: [
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-95.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-175.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-225.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-315.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-405.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-495.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/bench-585.png'),
  ],
  deadlift: [
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-185.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-275.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-365.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-455.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-545.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-675.png'),
    require('@/assets/images/milestone-renders/plate-club-material-v2/deadlift-895.png'),
  ],
};

function readableDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function displayKg(valueKg: number | null | undefined, unit: LedgerUnit) {
  if (valueKg == null || !Number.isFinite(valueKg)) return '—';
  const value = kilogramsToDisplayValue(valueKg, unit);
  const rounded = roundCalculatedWeightForDisplay(value, unit);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function signedDisplayKg(valueKg: number | null | undefined, unit: LedgerUnit) {
  if (valueKg == null || !Number.isFinite(valueKg)) return '—';
  const value = Number(displayKg(Math.abs(valueKg), unit));
  return `${valueKg > 0 ? '+' : valueKg < 0 ? '−' : '±'}${value}`;
}

function percentileLabel(state: StrengthTierState | null, expanded = false) {
  if (!state) return 'No verified standing';
  const tier = state.earnedTierIndex >= 0 ? state.tiers[state.earnedTierIndex] : state.nextTierIndex == null ? null : state.tiers[state.nextTierIndex];
  if (!tier) return 'Highest tier reached';
  return expanded ? `approximately the ${tier.actual_percentile.toFixed(1)}th percentile` : `~P${tier.actual_percentile.toFixed(1)}`;
}

function tierLabel(state: StrengthTierState | null) {
  if (!state) return 'Standard unavailable';
  return state.earnedTierIndex >= 0 ? state.tiers[state.earnedTierIndex].name : 'Below Tier I';
}

function eventLiftKey(event: AccomplishmentEvent): LiftKey | null {
  return canonicalCompetitionLiftKey(event.core_movement_key)
    ?? canonicalLiftKey(event.core_movement_key);
}

function eventTypeLabel(event: AccomplishmentEvent) {
  if (event.event_type.includes('REP_MAX')) return 'Rep max';
  if (event.event_type.includes('E1RM')) return 'Estimated 1RM';
  if (event.event_type.includes('WEIGHT')) return 'Weight PR';
  return 'Strength record';
}

function eventValue(event: AccomplishmentEvent, unit: LedgerUnit) {
  if (event.current_value == null) return 'Recorded';
  if (event.event_type.includes('REP_MAX') && event.unit !== 'kg' && event.unit !== 'lb') return `${event.current_value} reps`;
  const sourceUnit = parseDisplayWeightUnit(event.unit) ?? 'kg';
  const converted = convertDisplayWeightValue(event.current_value, sourceUnit, unit);
  const rounded = roundCalculatedWeightForDisplay(converted, unit);
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${unit.toUpperCase()}`;
}

function sourceSetSummary(event: AccomplishmentEvent, unit: LedgerUnit) {
  const evidence = event.evidence ?? {};
  const weightKg = typeof evidence.actual_weight_kg === 'number'
    ? evidence.actual_weight_kg
    : event.unit === 'kg' && typeof event.current_value === 'number'
      ? event.current_value
      : null;
  const reps = typeof evidence.actual_reps === 'number'
    ? evidence.actual_reps
    : typeof evidence.rep_count === 'number'
      ? evidence.rep_count
      : null;
  const rpe = typeof evidence.actual_rpe === 'number' ? `RPE ${evidence.actual_rpe}` : null;
  const rir = typeof evidence.actual_rir === 'number' ? `${evidence.actual_rir} RIR` : null;
  return {
    load: weightKg == null ? eventValue(event, unit) : `${displayKg(weightKg, unit)} ${unit.toUpperCase()}`,
    reps: reps == null ? null : `${reps} rep${reps === 1 ? '' : 's'}`,
    effort: rpe ?? rir,
  };
}

function PrimaryTabs({ value, onChange }: { value: StrengthSection; onChange: (value: StrengthSection) => void }) {
  const items: readonly StrengthSection[] = ['overview', 'progression', 'records', 'analysis'];
  return <SLCompactTabRail
    items={items.map((item) => ({ key: item, label: item[0].toUpperCase() + item.slice(1), testID: `strength-tab-${item}` }))}
    onSelect={(item) => onChange(item as StrengthSection)}
    selectedKey={value}
    accent="#A65CFF"
  />;
}

function RangeTabs({ value, onChange }: { value: LedgerRange; onChange: (value: LedgerRange) => void }) {
  const labels: readonly Readonly<[LedgerRange, string]>[] = [['30d', '30d'], ['90d', '90d'], ['180d', '180d'], ['1y', '1y'], ['all', 'All']];
  return <View accessibilityRole="tablist" style={styles.rangeTabs}>{labels.map(([item, label]) => <Pressable key={item} testID={`strength-range-${item}`} accessibilityRole="tab" accessibilityState={{ selected: value === item }} onPress={() => onChange(item)} style={[styles.rangeTab, value === item && styles.rangeTabActive]}><Text style={[styles.rangeTabText, value === item && styles.rangeTabTextActive]}>{label}</Text></Pressable>)}</View>;
}

function LiftTierMini({ profile }: { profile: LiftProfile }) {
  return <><Text style={[styles.liftTier, { color: profile.tone }]}>{tierLabel(profile.tierState)}</Text><Text style={styles.liftPercentile}>{percentileLabel(profile.tierState)}</Text></>;
}

function Overview({ profiles, totalKg, momentumKg, unit, onOpenLift, onOpenProgression, onOpenRecords }: {
  profiles: readonly LiftProfile[];
  totalKg: number | null;
  momentumKg: number | null;
  unit: LedgerUnit;
  onOpenLift: (key: LiftKey) => void;
  onOpenProgression: () => void;
  onOpenRecords: () => void;
}) {
  const closest = [...profiles].filter((profile) => profile.tierState?.remaining != null).sort((left, right) => (left.tierState?.remaining ?? Infinity) - (right.tierState?.remaining ?? Infinity))[0];
  return <View testID="strength-overview" style={styles.sectionStack}>
    <ImageBackground source={LEDGER_INDEX_ASSETS.hero} resizeMode="cover" style={styles.totalHero} imageStyle={styles.totalHeroImage}>
      <LinearGradient colors={['rgba(4,5,9,0.08)', 'rgba(4,5,9,0.42)', '#07070B']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.totalHeroCopy}><Text style={styles.eyebrow}>TOTAL ESTIMATED STRENGTH</Text><View style={styles.valueRow}><Text style={styles.totalValue}>{displayKg(totalKg, unit)}</Text>{totalKg != null ? <Text style={styles.totalUnit}>{unit.toUpperCase()}</Text> : null}</View><Text style={styles.totalStanding}>Current Squat + Bench + Deadlift estimates</Text>{momentumKg != null ? <View style={styles.momentumPill}><Ionicons name={momentumKg >= 0 ? 'trending-up' : 'trending-down'} size={15} color={momentumKg >= 0 ? '#53DE94' : '#FF697A'} /><Text style={[styles.momentumPillText, { color: momentumKg >= 0 ? '#53DE94' : '#FF697A' }]}>{signedDisplayKg(momentumKg, unit)} {unit.toUpperCase()} in 90 days</Text></View> : null}</View>
    </ImageBackground>

    <View style={styles.liftOverviewGrid}>{profiles.map((profile) => <Pressable key={profile.key} testID={`strength-overview-lift-${profile.key}`} onPress={() => onOpenLift(profile.key)} style={({ pressed }) => [styles.liftOverviewCard, { borderColor: `${profile.tone}72` }, pressed && styles.pressed]}><View style={[styles.liftOverviewArtStage, { backgroundColor: profile.softTone }]}><StrengthSemanticArtwork lift={profile.key} destination="overview-card" testID={`strength-overview-art-${profile.key}`} /></View><View style={styles.liftOverviewCopy}><Text style={[styles.liftOverviewName, { color: profile.tone }]}>{profile.shortLabel}</Text><Text style={styles.liftOverviewValue}>{displayKg(profile.currentEstimateKg, unit)}</Text><Text style={styles.liftOverviewUnit}>{unit.toUpperCase()} EST. 1RM</Text><LiftTierMini profile={profile} /></View></Pressable>)}</View>

    <View style={styles.identityCard}><View style={styles.identityHeader}><View><Text style={styles.eyebrow}>STRENGTH MOMENTUM</Text><Text style={styles.identityTitle}>{momentumKg == null ? 'Your trend needs more history.' : `${signedDisplayKg(momentumKg, unit)} ${unit.toUpperCase()} across your current estimates`}</Text></View><View style={styles.momentumBars}>{[0.3, 0.48, 0.62, 0.82, 1].map((height, index) => <View key={index} style={[styles.momentumBar, { height: 8 + height * 32, opacity: 0.4 + index * 0.14 }]} />)}</View></View></View>

    {closest?.tierState?.nextTierIndex != null ? <Pressable onPress={() => onOpenLift(closest.key)} style={({ pressed }) => [styles.closestCard, pressed && styles.pressed]}><View style={[styles.closestIcon, { borderColor: `${closest.tone}88`, backgroundColor: closest.softTone }]}><Ionicons name="trophy-outline" size={22} color={closest.tone} /></View><View style={styles.closestCopy}><Text style={styles.closestLabel}>CLOSEST TO NEXT TIER</Text><Text style={styles.closestTitle}>{closest.label}</Text><Text style={styles.closestMeta}>{closest.tierState.remaining} {unit.toUpperCase()} to {closest.tierState.tiers[closest.tierState.nextTierIndex].name}</Text></View><Ionicons name="chevron-forward" size={20} color={closest.tone} /></Pressable> : null}

    <View style={styles.overviewActions}><Pressable onPress={onOpenProgression} style={({ pressed }) => [styles.overviewAction, pressed && styles.pressed]}><Ionicons name="pulse-outline" size={20} color="#B677FF" /><Text style={styles.overviewActionText}>Open progression</Text><Ionicons name="arrow-forward" size={17} color="#7E8794" /></Pressable><Pressable onPress={onOpenRecords} style={({ pressed }) => [styles.overviewAction, pressed && styles.pressed]}><Ionicons name="ribbon-outline" size={20} color="#F2B44A" /><Text style={styles.overviewActionText}>Open record book</Text><Ionicons name="arrow-forward" size={17} color="#7E8794" /></Pressable></View>
  </View>;
}

function LiftSelector({ profiles, unit, onSelect, onOpenStandards }: { profiles: readonly LiftProfile[]; unit: LedgerUnit; onSelect: (key: LiftKey) => void; onOpenStandards: () => void }) {
  return <View testID="strength-lift-selector" style={styles.sectionStack}>
    <View style={styles.sectionLead}><Text style={styles.eyebrow}>CHOOSE A LIFT</Text><Text style={styles.sectionTitle}>Go deeper into your strength.</Text><Text style={styles.sectionBody}>Progress, evidence, and the exact governed standard for each competition lift.</Text></View>
    <View style={styles.selectorList}>{profiles.map((profile) => <Pressable key={profile.key} testID={`strength-select-${profile.key}`} onPress={() => onSelect(profile.key)} style={({ pressed }) => [styles.selectorCard, { borderColor: `${profile.tone}75` }, pressed && styles.pressed]}><View style={[styles.selectorArtStage, { backgroundColor: profile.softTone }]}><StrengthSemanticArtwork lift={profile.key} destination="selector-card" /></View><View style={styles.selectorCopy}><Text style={[styles.selectorName, { color: profile.tone }]}>{profile.label}</Text><View style={styles.selectorMetric}><Text style={styles.selectorValue}>{displayKg(profile.currentEstimateKg, unit)}</Text><Text style={styles.selectorUnit}>{unit.toUpperCase()}</Text></View><Text style={styles.selectorStanding}>{tierLabel(profile.tierState)} · {percentileLabel(profile.tierState)}</Text></View><Ionicons name="chevron-forward" size={22} color={profile.tone} style={styles.selectorChevron} /></Pressable>)}</View>
    <Pressable testID="strength-standards-entry" onPress={onOpenStandards} style={({ pressed }) => [styles.standardsEntry, pressed && styles.pressed]}><View style={styles.standardsEntryIcon}><Ionicons name="book-outline" size={22} color="#4AA4FF" /></View><View style={styles.standardsEntryCopy}><Text style={styles.standardsEntryTitle}>Strength Standards</Text><Text style={styles.standardsEntryBody}>View the governed OpenPowerlifting standards and tier thresholds.</Text></View><Ionicons name="chevron-forward" size={18} color="#778291" /></Pressable>
  </View>;
}

function LiftPicker({ profiles, selected, unit, open, onSelect }: { profiles: readonly LiftProfile[]; selected: LiftProfile; unit: LedgerUnit; open: boolean; onSelect: (key: LiftKey) => void }) {
  if (!open) return null;
  return <View style={styles.liftPickerMenu} testID="strength-lift-picker-menu">{profiles.map((profile) => <Pressable key={profile.key} onPress={() => onSelect(profile.key)} style={[styles.liftPickerOption, profile.key === selected.key && { backgroundColor: profile.softTone }]} testID={`strength-lift-picker-${profile.key}`}><StrengthSemanticArtwork lift={profile.key} destination="picker" /><View style={styles.liftPickerOptionCopy}><Text style={[styles.liftPickerOptionName, { color: profile.tone }]}>{profile.label}</Text><Text style={styles.liftPickerOptionMeta}>{displayKg(profile.currentEstimateKg, unit)} {unit.toUpperCase()} · {tierLabel(profile.tierState)}</Text></View></Pressable>)}</View>;
}

function LiftTabs({ value, onChange, accent }: { value: LiftPanel; onChange: (value: LiftPanel) => void; accent: string }) {
  const tabs: readonly LiftPanel[] = ['progression', 'evidence', 'standards'];
  return <SLCompactTabRail accent={accent} items={tabs.map((tab) => ({ key: tab, label: tab[0].toUpperCase() + tab.slice(1), testID: `strength-lift-tab-${tab}` }))} onSelect={(tab) => onChange(tab as LiftPanel)} selectedKey={value} />;
}

function CurrentLiftHero({ profile, unit }: { profile: LiftProfile; unit: LedgerUnit }) {
  const state = profile.tierState;
  return <View testID={`strength-lift-hero-${profile.key}`} style={[styles.currentHero, { borderColor: `${profile.tone}74` }]}><View style={[styles.currentHeroArtStage, { backgroundColor: profile.softTone }]}><StrengthSemanticArtwork lift={profile.key} destination="detail-hero" testID={`strength-detail-art-${profile.key}`} /></View><View style={styles.currentHeroEvidenceRow}><View style={styles.currentHeroCopy}><Text style={[styles.eyebrow, { color: profile.tone }]}>CURRENT STRENGTH</Text><View style={styles.valueRow}><Text style={styles.currentHeroValue}>{displayKg(profile.currentEstimateKg, unit)}</Text>{profile.currentEstimateKg != null ? <Text style={styles.currentHeroUnit}>{unit.toUpperCase()}</Text> : null}</View><Text style={styles.currentHeroMetric}>Estimated 1RM</Text><Text style={[styles.currentHeroTier, { color: profile.tone }]}>{tierLabel(state)} · {percentileLabel(state)}</Text></View>{profile.changeKg != null ? <View style={[styles.currentHeroDelta, { borderColor: `${profile.tone}70` }]}><Ionicons name={profile.changeKg >= 0 ? 'trending-up' : 'trending-down'} size={15} color={profile.tone} /><Text style={[styles.currentHeroDeltaValue, { color: profile.tone }]}>{signedDisplayKg(profile.changeKg, unit)} {unit.toUpperCase()}</Text><Text style={styles.currentHeroDeltaLabel}>in this range</Text></View> : null}</View></View>;
}

function ProgressionPanel({ profile, unit, range, onRangeChange, onOpenTiers }: { profile: LiftProfile; unit: LedgerUnit; range: LedgerRange; onRangeChange: (range: LedgerRange) => void; onOpenTiers: () => void }) {
  const state = profile.tierState;
  const latestEvent = profile.events.find((event) => event.event_type.includes('SAME_WEIGHT_REP'));
  const evidence = latestEvent?.evidence ?? {};
  const priorReps = typeof latestEvent?.prior_value === 'number' ? latestEvent.prior_value : null;
  const currentReps = typeof latestEvent?.current_value === 'number' ? latestEvent.current_value : null;
  const volume = profile.events.reduce((sum, event) => {
    const value = event.evidence?.volume_kg;
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
  const nextTier = state?.nextTierIndex == null ? null : state.tiers[state.nextTierIndex];
  return <View testID="strength-progression-panel" style={styles.sectionStack}>
    <CurrentLiftHero profile={profile} unit={unit} />
    <RangeTabs value={range} onChange={onRangeChange} />
    <View style={styles.chartCard}><AnalyticalTimeSeriesChart series={[{ key: profile.key, label: `${profile.label} estimated strength`, color: profile.tone, points: profile.points.map((point) => ({ date: point.date, value: kilogramsToDisplayValue(point.valueKg, unit) })) }]} metric={analyticalMetricDefinition('estimated_1rm', { label: `${profile.label} estimated strength`, kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 0 })} height={245} showLegend={false} readableText emptyTitle="No reliable trend yet" emptyBody="Two qualifying estimated-strength observations are required." testID="strength-profile-trend-chart" /></View>
    <View style={styles.summaryPair}><View style={styles.summaryCard}><Text style={styles.summaryLabel}>CURRENT</Text><Text style={styles.summaryValue}>{displayKg(profile.currentEstimateKg, unit)} {profile.currentEstimateKg != null ? unit.toUpperCase() : ''}</Text><Text style={styles.summaryMeta}>{tierLabel(state)}</Text></View><View style={styles.summaryCard}><Text style={styles.summaryLabel}>HISTORICAL PEAK</Text><Text style={styles.summaryValue}>{displayKg(profile.historicalPeakKg, unit)} {profile.historicalPeakKg != null ? unit.toUpperCase() : ''}</Text><Text style={styles.summaryMeta}>{profile.historicalPeakDate ? readableDate(profile.historicalPeakDate) : 'No dated peak yet'}</Text></View></View>
    <Pressable testID="strength-tier-entry" onPress={onOpenTiers} style={({ pressed }) => [styles.tierEntry, { borderColor: `${profile.tone}66` }, pressed && styles.pressed]}><View style={styles.tierEntryCopy}><Text style={[styles.eyebrow, { color: profile.tone }]}>CURRENT TIER</Text><Text style={styles.tierEntryTitle}>{tierLabel(state)}</Text><Text style={styles.tierEntryMeta}>{nextTier && state ? `${state.remaining} ${unit.toUpperCase()} to ${nextTier.name}` : state ? 'Highest governed tier reached' : 'Verified standard unavailable'}</Text></View><Image source={LIFT_TIER_ART[profile.key][Math.max(0, state?.earnedTierIndex ?? 0)]} resizeMode="contain" style={[styles.tierEntryArt, MILESTONE_RENDER_ORIENTATION_STYLE]} /><Ionicons name="chevron-forward" size={19} color={profile.tone} /></Pressable>
    <View style={styles.signalCard}><Text style={styles.cardHeading}>KEY SIGNALS</Text>{[
      ['trending-up', 'Weight trend', profile.changeKg == null ? '—' : `${signedDisplayKg(profile.changeKg, unit)} ${unit.toUpperCase()}`, profile.changeKg == null ? 'No reliable comparison yet.' : 'Estimated change in range'],
      ['repeat-outline', 'Rep strength', priorReps != null && currentReps != null ? `${priorReps} → ${currentReps} reps` : '—', priorReps != null ? 'Same-weight progress' : 'No reliable comparison yet.'],
      ['pulse-outline', 'Heavy exposure', `${profile.points.length} data point${profile.points.length === 1 ? '' : 's'}`, profile.points.length >= 2 ? 'In range' : 'More evidence needed'],
      ['bar-chart-outline', 'Volume trend', volume > 0 ? `${displayKg(volume, unit)} ${unit.toUpperCase()}` : '—', typeof evidence.actual_weight_kg === 'number' ? 'Qualified performed work' : 'No qualified volume signal'],
    ].map(([icon, label, value, detail]) => <View key={label} style={styles.signalRow}><View style={[styles.signalIcon, { borderColor: `${profile.tone}72` }]}><Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={19} color={profile.tone} /></View><View style={styles.signalCopy}><Text style={styles.signalLabel}>{label}</Text><Text style={styles.signalValue}>{value}</Text><Text style={styles.signalDetail}>{detail}</Text></View></View>)}</View>
  </View>;
}

function sourceEventKey(event: AccomplishmentEvent) {
  return event.source_set_log_id ? `set:${event.source_set_log_id}` : `event:${event.id}`;
}

function EvidencePanel({ profile, currentBests, unit, onOpen }: { profile: LiftProfile; currentBests: readonly CurrentBest[]; unit: LedgerUnit; onOpen: (sourceSetLogId: number) => void }) {
  const currentBestEvents = currentBests.filter((best) => (canonicalCompetitionLiftKey(best.core_movement_key) ?? canonicalLiftKey(best.core_movement_key)) === profile.key).map((best) => best.event);
  const events = [...new Map([...currentBestEvents, ...profile.events].filter((event) => event.source_set_log_id).map((event) => [sourceEventKey(event), event])).values()].slice(0, 8);
  return <View testID="strength-evidence-panel" style={styles.sectionStack}>
    <View style={styles.sectionLead}><Text style={[styles.eyebrow, { color: profile.tone }]}>SOURCE SETS</Text><Text style={styles.sectionTitle}>The work behind this estimate.</Text><Text style={styles.sectionBody}>Only movement-matched canonical evidence is shown.</Text></View>
    <View style={styles.sourceList}>{events.map((event) => { const summary = sourceSetSummary(event, unit); const used = event.source_set_log_id === profile.estimateSourceSetLogId; return <Pressable key={sourceEventKey(event)} onPress={() => event.source_set_log_id && onOpen(event.source_set_log_id)} style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}><View style={[styles.sourceIcon, { borderColor: `${profile.tone}72` }]}><Ionicons name="barbell-outline" size={19} color={profile.tone} /></View><View style={styles.sourceCopy}><Text style={styles.sourceLoad}>{summary.load}{summary.reps ? ` × ${summary.reps.replace(' reps', '').replace(' rep', '')}` : ''}</Text><Text style={styles.sourceMeta}>{[summary.effort, readableDate(event.occurred_at || event.workout_date)].filter(Boolean).join(' · ')}</Text></View><View style={[styles.usedBadge, used && { backgroundColor: `${profile.tone}25`, borderColor: `${profile.tone}7A` }]}><Text style={[styles.usedBadgeText, used && { color: profile.tone }]}>{used ? 'USED' : 'SOURCE'}</Text></View><Ionicons name="chevron-forward" size={16} color="#75808D" /></Pressable>; })}{!events.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No source sets are available yet.</Text><Text style={styles.emptyBody}>A qualifying movement-matched set will appear here when the canonical estimate can cite it.</Text></View> : null}</View>
    <View style={styles.estimateCard}><Text style={styles.cardHeading}>ESTIMATE DETAILS</Text>{[
      ['Method', profile.currentEstimateKg == null ? 'Unavailable' : 'RPE-adjusted estimated 1RM'],
      ['Estimated strength', `${displayKg(profile.currentEstimateKg, unit)} ${profile.currentEstimateKg == null ? '' : unit.toUpperCase()}`],
      ['Confidence', profile.points.length >= 3 ? 'High' : profile.points.length >= 1 ? 'Developing' : 'Unavailable'],
      ['Source sets', String(events.length)],
      ['Identity', `Competition ${profile.label}`],
    ].map(([label, value]) => <View key={label} style={styles.estimateRow}><Text style={styles.estimateLabel}>{label}</Text><Text style={styles.estimateValue}>{value}</Text></View>)}</View>
    <View style={styles.infoCard}><Ionicons name="information-circle-outline" size={22} color="#668FFF" /><View style={styles.infoCopy}><Text style={styles.infoTitle}>About this estimate</Text><Text style={styles.infoBody}>Recent movement-matched load, reps, and recorded effort shape the estimate. It is not presented as a tested maximum.</Text></View></View>
  </View>;
}

function StandardsPanel({ profile, unit, sex, version }: { profile: LiftProfile; unit: LedgerUnit; sex?: string | null; version?: string | null }) {
  const state = profile.tierState;
  return <View testID="strength-standards-panel" style={styles.sectionStack}>
    <View style={styles.sectionLead}><Text style={[styles.eyebrow, { color: profile.tone }]}>OPENPOWERLIFTING STANDARD</Text><Text style={styles.sectionTitle}>{profile.label}</Text><Text style={styles.sectionBody}>{sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : 'Verified sex required'} · Raw · canonical kilograms</Text></View>
    {state ? <View style={styles.standardTable}><View style={styles.standardHeader}><Text style={styles.standardHeaderText}>TIER</Text><Text style={styles.standardHeaderText}>STANDARD ({unit.toUpperCase()})</Text><Text style={styles.standardHeaderText}>PERCENTILE</Text></View>{[...state.tiers].reverse().map((tier) => { const index = tier.tier - 1; const threshold = state.thresholds[index]; const status = index <= state.earnedTierIndex ? 'EARNED' : index === state.nextTierIndex ? 'NEXT' : 'LOCKED'; return <View key={tier.tier} style={[styles.standardRow, status === 'NEXT' && { backgroundColor: profile.softTone }]}><Text style={[styles.standardTier, status === 'NEXT' && { color: profile.tone }]}>{tier.name}</Text><Text style={styles.standardValue}>{threshold}</Text><Text style={styles.standardPercentile}>~P{tier.actual_percentile.toFixed(1)}</Text></View>; })}</View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Verified standard unavailable.</Text><Text style={styles.emptyBody}>Strength Ledger will not guess a male or female reference standard.</Text></View>}
    <View style={styles.standardNote}><Ionicons name="shield-checkmark-outline" size={22} color="#668FFF" /><Text style={styles.standardNoteText}>Governed reference: {version ?? 'unavailable'}. Thresholds are stored in KG and projected to LB only at display time.</Text></View>
  </View>;
}

function TiersScreen({ profile, unit, sex, version, onBack }: { profile: LiftProfile; unit: LedgerUnit; sex?: string | null; version?: string | null; onBack: () => void }) {
  const state = profile.tierState;
  return <View testID={`strength-tiers-${profile.key}`} style={styles.page}>
    <SLAtmosphericContextHeader accent={profile.tone} atmosphereSource={STRENGTH_LEDGER_ATMOSPHERE_ASSETS.strength} backAccessibilityLabel="Back to lift progression" contextLabel="STRENGTH STANDARD" onBack={onBack} style={styles.headerBleed} testID="strength-tiers-header" title={`${profile.label} Tiers`} artwork={<StrengthSemanticArtwork lift={profile.key} destination="context-header" />} />
    <View style={styles.tiersIntro}><Text style={[styles.eyebrow, { color: profile.tone }]}>{profile.shortLabel} TIERS</Text><Text style={styles.tiersIntroMeta}>OpenPowerlifting · {sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : 'Verified sex required'} · Raw</Text></View>
    {state ? <View style={styles.tierRows}>{[...state.tiers].reverse().map((tier) => { const index = tier.tier - 1; const status = index <= state.earnedTierIndex ? 'Earned' : index === state.nextTierIndex ? 'Next' : 'Locked'; return <View key={tier.tier} style={[styles.tierRow, status === 'Next' && { borderColor: profile.tone, backgroundColor: profile.softTone }]}><Image source={LIFT_TIER_ART[profile.key][index]} resizeMode="contain" style={[styles.tierRowArt, MILESTONE_RENDER_ORIENTATION_STYLE, status === 'Locked' && styles.locked]} /><Text style={styles.tierRowName}>{tier.name}</Text><View style={styles.tierRowMetric}><Text style={styles.tierRowValue}>{state.thresholds[index]} {unit.toUpperCase()}</Text><Text style={styles.tierRowPercentile}>~P{tier.actual_percentile.toFixed(1)}</Text></View><Text style={[styles.tierRowStatus, status === 'Earned' && { color: profile.tone }, status === 'Next' && { color: '#F5F2F8' }]}>{status}</Text></View>; })}<View style={[styles.currentTierSummary, { borderColor: profile.tone }]}><Text style={[styles.eyebrow, { color: profile.tone }]}>CURRENT</Text><Text style={styles.currentTierSummaryTitle}>{tierLabel(state)}</Text><Text style={styles.currentTierSummaryValue}>{state.current} {unit.toUpperCase()}</Text><Text style={styles.currentTierSummaryMeta}>{state.nextTierIndex == null ? 'Tier VII reached' : `${state.remaining} ${unit.toUpperCase()} to ${state.tiers[state.nextTierIndex].name}`}</Text></View></View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Strength tiers unavailable.</Text><Text style={styles.emptyBody}>A supported sex-specific governed standard is required.</Text></View>}
    <Text style={styles.versionText}>{version ?? 'No governed standard version returned'}</Text>
  </View>;
}

function RecordBook({ events, unit, filter, onFilter, onOpen }: { events: readonly AccomplishmentEvent[]; unit: LedgerUnit; filter: PrFilter; onFilter: (filter: PrFilter) => void; onOpen: (sourceSetLogId: number) => void }) {
  const filtered = filter === 'all' ? events : events.filter((event) => eventLiftKey(event) === filter);
  return <View testID="strength-records" style={styles.sectionStack}>
    <View style={styles.sectionLead}><Text style={styles.eyebrow}>STRENGTH RECORD BOOK</Text><Text style={styles.sectionTitle}>Your biggest moments.</Text><Text style={styles.sectionBody}>Career PRs preserved with canonical movement and source evidence.</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recordFilters}>{(['all', 'squat', 'bench', 'deadlift'] as const).map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: filter === item }} onPress={() => onFilter(item)} style={[styles.recordFilter, filter === item && styles.recordFilterActive]}><Text style={[styles.recordFilterText, filter === item && styles.recordFilterTextActive]}>{item === 'all' ? 'All' : item === 'bench' ? 'Bench' : item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</ScrollView>
    <View style={styles.recordList}>{filtered.map((event) => { const key = eventLiftKey(event); const presentation = LIFTS.find((item) => item.key === key); return <Pressable key={event.id} disabled={!event.source_set_log_id} onPress={() => event.source_set_log_id && onOpen(event.source_set_log_id)} style={({ pressed }) => [styles.recordRow, pressed && styles.pressed]}><View style={[styles.recordIcon, { borderColor: `${presentation?.tone ?? '#A65CFF'}72` }]}><Ionicons name="barbell-outline" size={20} color={presentation?.tone ?? '#A65CFF'} /></View><View style={styles.recordCopy}><Text style={styles.recordTitle}>{event.movement_label || presentation?.label || 'Competition lift'}</Text><Text style={styles.recordMeta}>{eventTypeLabel(event)} · {readableDate(event.occurred_at || event.workout_date)}</Text></View><Text style={styles.recordValue}>{eventValue(event, unit)}</Text>{event.source_set_log_id ? <Ionicons name="chevron-forward" size={17} color="#77818E" /> : null}</Pressable>; })}{!filtered.length ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No matching strength records yet.</Text><Text style={styles.emptyBody}>A qualifying canonical PR will appear here with its source evidence.</Text></View> : null}</View>
  </View>;
}

function BalanceRadar({ profiles, unit }: { profiles: readonly LiftProfile[]; unit: LedgerUnit }) {
  const values = profiles.map((profile) => profile.currentEstimateKg ?? 0);
  const max = Math.max(1, ...values);
  const center = 120;
  const radius = 78;
  const axes = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  const outer = axes.map((angle) => `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`).join(' ');
  const middle = axes.map((angle) => `${center + Math.cos(angle) * radius * 0.58},${center + Math.sin(angle) * radius * 0.58}`).join(' ');
  const data = axes.map((angle, index) => `${center + Math.cos(angle) * radius * (values[index] / max)},${center + Math.sin(angle) * radius * (values[index] / max)}`).join(' ');
  return <View style={styles.radarWrap}><Svg width={240} height={240}><Polygon points={outer} fill="rgba(150,77,255,0.03)" stroke="#493069" strokeWidth={1} /><Polygon points={middle} fill="none" stroke="#2F2940" strokeWidth={1} />{axes.map((angle, index) => <Line key={index} x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="#30283E" strokeWidth={1} />)}<Polygon points={data} fill="rgba(159,69,255,0.48)" stroke="#B268FF" strokeWidth={2} />{axes.map((angle, index) => <Circle key={`point-${index}`} cx={center + Math.cos(angle) * radius * (values[index] / max)} cy={center + Math.sin(angle) * radius * (values[index] / max)} r={4} fill={profiles[index].tone} />)}</Svg><Text style={[styles.radarLabel, styles.radarSquat]}>SQUAT{`\n`}{displayKg(profiles[0].currentEstimateKg, unit)} {unit.toUpperCase()}</Text><Text style={[styles.radarLabel, styles.radarBench]}>BENCH{`\n`}{displayKg(profiles[1].currentEstimateKg, unit)} {unit.toUpperCase()}</Text><Text style={[styles.radarLabel, styles.radarDeadlift]}>DEADLIFT{`\n`}{displayKg(profiles[2].currentEstimateKg, unit)} {unit.toUpperCase()}</Text></View>;
}

function totalTrend(profiles: readonly LiftProfile[]) {
  const dates = [...new Set(profiles.flatMap((profile) => profile.points.map((point) => point.date)))].sort();
  const latest = new Map<LiftKey, number>();
  return dates.flatMap((date) => {
    profiles.forEach((profile) => {
      const point = profile.points.find((item) => item.date === date);
      if (point) latest.set(profile.key, point.valueKg);
    });
    if (latest.size !== 3) return [];
    return [{ date, valueKg: (latest.get('squat') ?? 0) + (latest.get('bench') ?? 0) + (latest.get('deadlift') ?? 0) }];
  });
}

function Analysis({ profiles, unit }: { profiles: readonly LiftProfile[]; unit: LedgerUnit }) {
  const trend = totalTrend(profiles);
  const total = profiles.reduce((sum, profile) => sum + (profile.currentEstimateKg ?? 0), 0);
  return <View testID="strength-analysis" style={styles.sectionStack}>
    <View style={styles.sectionLead}><Text style={styles.eyebrow}>STRENGTH ANALYSIS</Text><Text style={styles.sectionTitle}>Balance, momentum, and context.</Text><Text style={styles.sectionBody}>Your current estimates viewed as one strength profile.</Text></View>
    <View style={styles.analysisCard}><Text style={styles.cardHeading}>STRENGTH BALANCE</Text><BalanceRadar profiles={profiles} unit={unit} /><Text style={styles.analysisNote}>Each axis is scaled against your strongest current estimate. This shows relationship, not competition scoring.</Text></View>
    <View style={styles.analysisCard}><Text style={styles.cardHeading}>TOTAL PROGRESSION</Text><Text style={styles.analysisMetric}>Estimated S + B + D · {displayKg(total || null, unit)} {total ? unit.toUpperCase() : ''}</Text><AnalyticalTimeSeriesChart series={[{ key: 'total', label: 'Estimated Total', color: '#A65CFF', points: trend.map((point) => ({ date: point.date, value: kilogramsToDisplayValue(point.valueKg, unit) })) }]} metric={analyticalMetricDefinition('estimated_total', { label: 'Estimated Total', kind: 'weight', unit, axisUnit: unit, includeZero: false, maximumFractionDigits: 0 })} height={240} showLegend={false} readableText emptyTitle="Total progression needs more history" emptyBody="Aligned qualifying S/B/D estimates are required." testID="strength-total-progression-chart" /></View>
    <View style={styles.analysisCard}><Text style={styles.cardHeading}>CURRENT STRENGTH DISTRIBUTION</Text>{profiles.map((profile) => { const share = total > 0 ? (profile.currentEstimateKg ?? 0) / total : 0; return <View key={profile.key} style={styles.distributionRow}><View style={styles.distributionTop}><Text style={[styles.distributionName, { color: profile.tone }]}>{profile.shortLabel}</Text><Text style={styles.distributionValue}>{displayKg(profile.currentEstimateKg, unit)} {profile.currentEstimateKg != null ? unit.toUpperCase() : ''} · {Math.round(share * 100)}%</Text></View><View style={styles.distributionTrack}><View style={[styles.distributionFill, { width: `${share * 100}%`, backgroundColor: profile.tone }]} /></View></View>; })}</View>
  </View>;
}

export function StrengthExperience() {
  const router = useRouter();
  const scrollToTop = useLedgerScrollToTop();
  const [section, setSection] = useState<StrengthSection>('overview');
  const [selectedLift, setSelectedLift] = useState<LiftKey | null>(null);
  const [liftPanel, setLiftPanel] = useState<LiftPanel>('progression');
  const [showLiftPicker, setShowLiftPicker] = useState(false);
  const [showTiers, setShowTiers] = useState(false);
  const [range, setRange] = useState<LedgerRange>('90d');
  const [unit, setUnit] = useState<LedgerUnit>('lb');
  const [prFilter, setPrFilter] = useState<PrFilter>('all');
  const { progression, currentBests, accomplishments, strengthStandard: standardCandidate, strengthStanding, loading, error, errorKind, reload } = useLedgerLiveData(range);

  React.useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STRENGTH_UNIT_KEY).then((stored) => {
      if (active && (stored === 'lb' || stored === 'kg')) setUnit(stored);
      else if (active && progression?.athlete?.preferred_units?.toLowerCase().startsWith('kg')) setUnit('kg');
    }).catch(() => {}).finally(() => {});
    return () => { active = false; };
  }, [progression?.athlete?.preferred_units]);

  const changeUnit = useCallback((next: LedgerUnit) => {
    setUnit(next);
    void AsyncStorage.setItem(STRENGTH_UNIT_KEY, next);
  }, []);
  const scrollToTopAfterTransition = useCallback(() => {
    requestAnimationFrame(scrollToTop);
  }, [scrollToTop]);
  const clubs = useMemo(() => resolveLedgerClubsRuntimeState(currentBests, standardCandidate ?? progression?.strength_standard, strengthStanding, unit), [currentBests, progression?.strength_standard, standardCandidate, strengthStanding, unit]);
  const profiles = useMemo(() => LIFTS.map((presentation): LiftProfile => {
    const live = progression?.big_three_arc?.lifts?.find((lift) => canonicalLiftKey(lift.key) === presentation.key);
    const points = (live?.points ?? []).flatMap((point) => typeof point.value_kg === 'number' && point.date ? [{ date: point.date, valueKg: point.value_kg }] : []);
    const peakPoint = [...points].sort((left, right) => right.valueKg - left.valueKg)[0];
    const e1rmBest = currentBests.filter((best) => (canonicalCompetitionLiftKey(best.core_movement_key) ?? canonicalLiftKey(best.core_movement_key)) === presentation.key && best.metric === 'e1rm').sort((left, right) => right.best_value - left.best_value)[0];
    const exactBest = currentBests.filter((best) => canonicalCompetitionLiftKey(best.core_movement_key) === presentation.key && best.metric === 'weight').sort((left, right) => right.best_value - left.best_value)[0];
    const events = accomplishments.filter((event) => eventLiftKey(event) === presentation.key);
    return {
      ...presentation,
      currentEstimateKg: live?.current_e1rm_kg ?? e1rmBest?.best_value ?? null,
      historicalPeakKg: live?.best_e1rm_kg ?? e1rmBest?.best_value ?? null,
      historicalPeakDate: peakPoint?.date ?? e1rmBest?.event?.occurred_at ?? e1rmBest?.event?.workout_date ?? null,
      changeKg: live?.change_kg ?? null,
      points,
      estimateSourceSetLogId: e1rmBest?.event?.source_set_log_id ?? exactBest?.event?.source_set_log_id ?? null,
      tierState: clubs.lifts.find((lift) => lift.key === presentation.key)?.tierState ?? null,
      events,
    };
  }), [accomplishments, clubs.lifts, currentBests, progression?.big_three_arc?.lifts]);
  const records = useMemo(() => canonicalPrHistory(accomplishments), [accomplishments]);
  const profile = profiles.find((item) => item.key === selectedLift) ?? profiles[0];
  const totalKg = profiles.every((item) => item.currentEstimateKg != null) ? profiles.reduce((sum, item) => sum + (item.currentEstimateKg ?? 0), 0) : null;
  const momentumKg = profiles.every((item) => item.changeKg != null) ? profiles.reduce((sum, item) => sum + (item.changeKg ?? 0), 0) : null;

  const openLift = (key: LiftKey, panel: LiftPanel = 'progression') => {
    setSelectedLift(key);
    setLiftPanel(panel);
    setShowLiftPicker(false);
    setShowTiers(false);
    scrollToTopAfterTransition();
  };
  const openSourceSet = (sourceSetLogId: number) => router.push(archiveDetailHref('set', sourceSetLogId) as any);
  const changeSection = (next: StrengthSection) => {
    setSection(next);
    setSelectedLift(null);
    setShowTiers(false);
    setShowLiftPicker(false);
    scrollToTopAfterTransition();
  };

  const changeLiftPanel = (next: LiftPanel) => {
    setLiftPanel(next);
    scrollToTopAfterTransition();
  };
  const openTiers = () => {
    setShowTiers(true);
    scrollToTopAfterTransition();
  };
  const closeTiers = () => {
    setShowTiers(false);
    scrollToTopAfterTransition();
  };
  const closeLift = () => {
    setSelectedLift(null);
    setShowLiftPicker(false);
    scrollToTopAfterTransition();
  };

  if (showTiers && selectedLift) return <><FloatingDisplayUnitRegistration unit={unit} onChange={changeUnit} testID="ledger-strength-unit-toggle" /><TiersScreen profile={profile} unit={unit} sex={clubs.standard?.sex} version={clubs.standard?.version} onBack={closeTiers} /></>;

  if (selectedLift) return <View style={styles.page} testID="ledger-strength-lift-detail"><FloatingDisplayUnitRegistration unit={unit} onChange={changeUnit} testID="ledger-strength-unit-toggle" /><SLAtmosphericContextHeader accent={profile.tone} atmosphereSource={STRENGTH_LEDGER_ATMOSPHERE_ASSETS.strength} artwork={<StrengthSemanticArtwork lift={profile.key} destination="context-header" />} backAccessibilityLabel="Back to Strength" contextLabel="STRENGTH PROFILE" onBack={closeLift} onTitlePress={() => setShowLiftPicker((value) => !value)} style={styles.headerBleed} testID="strength-detail-header" title={profile.label} titleExpanded={showLiftPicker}><LiftTabs value={liftPanel} onChange={changeLiftPanel} accent={profile.tone} /></SLAtmosphericContextHeader><LiftPicker profiles={profiles} selected={profile} unit={unit} open={showLiftPicker} onSelect={(key) => openLift(key, liftPanel)} />{loading ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Loading strength evidence…</Text></View> : error ? <Pressable onPress={() => void reload()} style={styles.emptyCard}><Text style={styles.emptyTitle}>{error}</Text><Text style={styles.emptyBody}>Tap to try again.</Text></Pressable> : liftPanel === 'progression' ? <ProgressionPanel profile={profile} unit={unit} range={range} onRangeChange={setRange} onOpenTiers={openTiers} /> : liftPanel === 'evidence' ? <EvidencePanel profile={profile} currentBests={currentBests} unit={unit} onOpen={openSourceSet} /> : <StandardsPanel profile={profile} unit={unit} sex={clubs.standard?.sex} version={clubs.standard?.version} />}</View>;

  return <View style={styles.page} testID="ledger-strength-experience"><FloatingDisplayUnitRegistration unit={unit} onChange={changeUnit} testID="ledger-strength-unit-toggle" /><SLAtmosphericContextHeader accent="#A65CFF" atmosphereSource={STRENGTH_LEDGER_ATMOSPHERE_ASSETS.strength} backAccessibilityLabel="Back to The Ledger" contextLabel="YOUR STRENGTH PROFILE" onBack={() => router.replace('/(tabs)/ledger/home' as any)} style={styles.headerBleed} subtitle="Current strength, progression, and proof." testID="strength-contextual-header" title="Strength"><PrimaryTabs value={section} onChange={changeSection} /></SLAtmosphericContextHeader>{loading ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Loading your strength profile…</Text></View> : error ? <Pressable onPress={() => void reload()} style={styles.emptyCard}><Text style={styles.emptyTitle}>{errorKind === 'unauthorized' ? 'This strength profile is not available to this account.' : error}</Text><Text style={styles.emptyBody}>Tap to try again.</Text></Pressable> : section === 'overview' ? <Overview profiles={profiles} totalKg={totalKg} momentumKg={momentumKg} unit={unit} onOpenLift={openLift} onOpenProgression={() => changeSection('progression')} onOpenRecords={() => changeSection('records')} /> : section === 'progression' ? <LiftSelector profiles={profiles} unit={unit} onSelect={openLift} onOpenStandards={() => openLift('deadlift', 'standards')} /> : section === 'records' ? <RecordBook events={records} unit={unit} filter={prFilter} onFilter={setPrFilter} onOpen={openSourceSet} /> : <Analysis profiles={profiles} unit={unit} />}</View>;
}

const styles = StyleSheet.create({
  page: { gap: 10, paddingHorizontal: 14, paddingBottom: 28 },
  headerBleed: { marginHorizontal: -14 },
  sectionStack: { gap: 16 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  eyebrow: { color: '#C17AFF', fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8 },
  totalHero: { minHeight: 260, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 19, borderWidth: 1, borderColor: '#34404C', backgroundColor: '#080A0F' },
  totalHeroImage: { borderRadius: 19 },
  totalHeroCopy: { alignItems: 'flex-end', gap: 4, padding: 18 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  totalValue: { color: '#F7F4FA', fontSize: 56, lineHeight: 61, fontWeight: '400', letterSpacing: -2.3 },
  totalUnit: { color: '#D2CED8', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  totalStanding: { color: '#E6E2EA', fontSize: 18, lineHeight: 23, fontWeight: '700' },
  momentumPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(7,10,14,0.80)' },
  momentumPillText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  liftOverviewGrid: { flexDirection: 'row', gap: 8 },
  liftOverviewCard: { flex: 1, minWidth: 0, height: 226, overflow: 'hidden', borderRadius: 15, borderWidth: 1, backgroundColor: '#080A0E' },
  liftOverviewArtStage: { height: 108, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#252B35' },
  liftOverviewCopy: { flex: 1, gap: 1, padding: 10 },
  liftOverviewName: { fontSize: 11, lineHeight: 14, fontWeight: '900' },
  liftOverviewValue: { color: '#F5F2F7', fontSize: 30, lineHeight: 34, fontWeight: '500', letterSpacing: -1 },
  liftOverviewUnit: { color: '#929AA6', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  liftTier: { marginTop: 5, fontSize: 12, lineHeight: 15, fontWeight: '800' },
  liftPercentile: { color: '#C4C0C9', fontSize: 10, lineHeight: 13 },
  identityCard: { padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#303946', backgroundColor: '#090D13' },
  identityHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  identityTitle: { maxWidth: 250, marginTop: 5, color: '#F0EDF4', fontSize: 17, lineHeight: 22, fontWeight: '700' },
  momentumBars: { height: 45, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  momentumBar: { width: 6, borderRadius: 3, backgroundColor: '#A44BFF' },
  closestCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: '#343D48', backgroundColor: '#090D13' },
  closestIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, borderWidth: 1 },
  closestCopy: { flex: 1, minWidth: 0, gap: 2 },
  closestLabel: { color: '#8B94A0', fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 0.6 },
  closestTitle: { color: '#F0EDF4', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  closestMeta: { color: '#AAB1BB', fontSize: 11, lineHeight: 15 },
  overviewActions: { gap: 8 },
  overviewAction: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#303843', backgroundColor: '#090D13' },
  overviewActionText: { flex: 1, color: '#EAE7ED', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  sectionLead: { gap: 5, paddingHorizontal: 3 },
  sectionTitle: { color: '#F4F1F6', fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.5 },
  sectionBody: { color: '#A4ADB8', fontSize: 13, lineHeight: 19 },
  selectorList: { gap: 10 },
  selectorCard: { height: 146, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 17, borderWidth: 1, backgroundColor: '#080A0E' },
  selectorArtStage: { width: '46%', height: '100%', alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#292D36' },
  selectorCopy: { flex: 1, minWidth: 0, gap: 2, paddingLeft: 14, paddingRight: 36 },
  selectorName: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  selectorMetric: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  selectorValue: { color: '#F5F2F8', fontSize: 34, lineHeight: 38, fontWeight: '500' },
  selectorUnit: { color: '#D1CCD5', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  selectorStanding: { color: '#D0CBD4', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  selectorChevron: { position: 'absolute', right: 13, top: 62 },
  standardsEntry: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: '#31404E', backgroundColor: '#091019' },
  standardsEntryIcon: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#0D2138' },
  standardsEntryCopy: { flex: 1, minWidth: 0, gap: 3 },
  standardsEntryTitle: { color: '#F0EDF4', fontSize: 15, lineHeight: 19, fontWeight: '800' },
  standardsEntryBody: { color: '#9CA6B2', fontSize: 11, lineHeight: 16 },
  liftPickerMenu: { zIndex: 2, gap: 4, marginTop: -4, padding: 6, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, borderWidth: 1, borderTopWidth: 0, borderColor: '#333B47', backgroundColor: '#090D13' },
  liftPickerOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10 },
  liftPickerOptionCopy: { flex: 1, gap: 2 },
  liftPickerOptionName: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  liftPickerOptionMeta: { color: '#A4ADB8', fontSize: 10.5, lineHeight: 14 },
  currentHero: { minHeight: 326, overflow: 'hidden', borderRadius: 19, borderWidth: 1, backgroundColor: '#07080C' },
  currentHeroArtStage: { height: 174, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2B3039' },
  currentHeroEvidenceRow: { minHeight: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 18 },
  currentHeroCopy: { flex: 1, minWidth: 0, gap: 3 },
  currentHeroValue: { color: '#F7F4F9', fontSize: 58, lineHeight: 62, fontWeight: '400', letterSpacing: -2.2 },
  currentHeroUnit: { color: '#D9D4DD', fontSize: 17, lineHeight: 21, fontWeight: '700' },
  currentHeroMetric: { color: '#A6AFBA', fontSize: 12, lineHeight: 16 },
  currentHeroTier: { marginTop: 3, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  currentHeroDelta: { width: 112, alignItems: 'center', gap: 2, marginBottom: 3, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 12, borderWidth: 1, backgroundColor: '#090C12' },
  currentHeroDeltaValue: { fontSize: 15, lineHeight: 18, fontWeight: '900' },
  currentHeroDeltaLabel: { color: '#99A2AE', fontSize: 10, lineHeight: 13 },
  rangeTabs: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: 13, borderWidth: 1, borderColor: '#303844', backgroundColor: '#090D12' },
  rangeTab: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  rangeTabActive: { backgroundColor: '#4A1A70' },
  rangeTabText: { color: '#9BA5B0', fontSize: 10, lineHeight: 13, fontWeight: '700' },
  rangeTabTextActive: { color: '#F2E6FF' },
  chartCard: { padding: 8, borderRadius: 17, borderWidth: 1, borderColor: '#303945', backgroundColor: '#070A0F' },
  summaryPair: { flexDirection: 'row', gap: 9 },
  summaryCard: { flex: 1, minHeight: 94, gap: 4, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: '#303844', backgroundColor: '#090D13' },
  summaryLabel: { color: '#8B95A2', fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 0.55 },
  summaryValue: { color: '#F2EFF5', fontSize: 20, lineHeight: 24, fontWeight: '800' },
  summaryMeta: { color: '#A6AFBA', fontSize: 10.5, lineHeight: 14 },
  tierEntry: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 16, borderWidth: 1, backgroundColor: '#090C12' },
  tierEntryCopy: { flex: 1, minWidth: 0, gap: 3 },
  tierEntryTitle: { color: '#F3F0F6', fontSize: 23, lineHeight: 27, fontWeight: '800' },
  tierEntryMeta: { color: '#A2ABB6', fontSize: 11, lineHeight: 15 },
  tierEntryArt: { width: 100, height: 76 },
  signalCard: { overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#303945', backgroundColor: '#090D13' },
  cardHeading: { color: '#DBD6E0', fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 0.55, padding: 14 },
  signalRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#303844' },
  signalIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1 },
  signalCopy: { flex: 1, gap: 2 },
  signalLabel: { color: '#B5BDC7', fontSize: 11, lineHeight: 14 },
  signalValue: { color: '#F2EFF5', fontSize: 16, lineHeight: 20, fontWeight: '800' },
  signalDetail: { color: '#8C96A2', fontSize: 10.5, lineHeight: 14 },
  sourceList: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#303945', backgroundColor: '#090D13' },
  sourceRow: { minHeight: 75, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#303844' },
  sourceIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1 },
  sourceCopy: { flex: 1, minWidth: 0, gap: 3 },
  sourceLoad: { color: '#F0EDF4', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  sourceMeta: { color: '#939DA9', fontSize: 10, lineHeight: 14 },
  usedBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#3B434E' },
  usedBadgeText: { color: '#8D97A4', fontSize: 10, lineHeight: 12, fontWeight: '900' },
  estimateCard: { overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#303945', backgroundColor: '#090D13' },
  estimateRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#303844' },
  estimateLabel: { color: '#A5AEB9', fontSize: 11, lineHeight: 15 },
  estimateValue: { flex: 1, color: '#F0EDF4', fontSize: 11, lineHeight: 15, fontWeight: '700', textAlign: 'right' },
  infoCard: { minHeight: 88, flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#2E3E55', backgroundColor: '#0A111D' },
  infoCopy: { flex: 1, gap: 4 },
  infoTitle: { color: '#E7EBF2', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  infoBody: { color: '#A2ACBA', fontSize: 11, lineHeight: 16 },
  emptyCard: { gap: 6, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#303945', backgroundColor: '#090D13' },
  emptyTitle: { color: '#F0EDF4', fontSize: 16, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: '#9EA8B4', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  standardTable: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#303945', backgroundColor: '#090D13' },
  standardHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, backgroundColor: '#111721' },
  standardHeaderText: { flex: 1, color: '#8E98A5', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.4, textAlign: 'center' },
  standardRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#303844' },
  standardTier: { flex: 1, color: '#E7E3EA', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  standardValue: { flex: 1, color: '#F2EFF5', fontSize: 13, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  standardPercentile: { flex: 1, color: '#B1BAC5', fontSize: 12, lineHeight: 16, textAlign: 'center' },
  standardNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#2E3D52', backgroundColor: '#0A111C' },
  standardNoteText: { flex: 1, color: '#A5AFBC', fontSize: 11, lineHeight: 17 },
  tiersIntro: { gap: 3 },
  tiersIntroMeta: { color: '#A1AAB6', fontSize: 11, lineHeight: 15 },
  tierRows: { gap: 8 },
  tierRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9, borderRadius: 14, borderWidth: 1, borderColor: '#303945', backgroundColor: '#090D13' },
  tierRowArt: { width: 69, height: 51 },
  tierRowName: { width: 54, color: '#F0EDF4', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  tierRowMetric: { flex: 1, gap: 2 },
  tierRowValue: { color: '#F1EEF4', fontSize: 12, lineHeight: 16, fontWeight: '800', textAlign: 'right' },
  tierRowPercentile: { color: '#9EA7B3', fontSize: 10, lineHeight: 13, textAlign: 'right' },
  tierRowStatus: { width: 48, color: '#77818E', fontSize: 10, lineHeight: 13, fontWeight: '900', textAlign: 'right', textTransform: 'uppercase' },
  locked: { opacity: 0.34 },
  currentTierSummary: { gap: 3, marginTop: 4, padding: 16, borderRadius: 16, borderWidth: 1, backgroundColor: '#160D19' },
  currentTierSummaryTitle: { color: '#F5F2F7', fontSize: 19, lineHeight: 24, fontWeight: '800' },
  currentTierSummaryValue: { color: '#F5F2F7', fontSize: 28, lineHeight: 33, fontWeight: '500' },
  currentTierSummaryMeta: { color: '#A8B0BB', fontSize: 11, lineHeight: 15 },
  versionText: { color: '#717B88', fontSize: 10, lineHeight: 14, textAlign: 'center' },
  recordFilters: { gap: 7 },
  recordFilter: { minWidth: 78, minHeight: 39, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 19, borderWidth: 1, borderColor: '#303946', backgroundColor: '#090D13' },
  recordFilterActive: { borderColor: '#9A43EA', backgroundColor: '#32134B' },
  recordFilterText: { color: '#AAB3BE', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  recordFilterTextActive: { color: '#F3E9FF' },
  recordList: { overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#303945', backgroundColor: '#090D13' },
  recordRow: { minHeight: 83, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#303844' },
  recordIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1 },
  recordCopy: { flex: 1, minWidth: 0, gap: 3 },
  recordTitle: { color: '#F1EEF4', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  recordMeta: { color: '#949EAA', fontSize: 10, lineHeight: 14 },
  recordValue: { color: '#F0EDF4', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  analysisCard: { gap: 4, overflow: 'hidden', borderRadius: 17, borderWidth: 1, borderColor: '#303945', backgroundColor: '#090D13' },
  analysisMetric: { color: '#AEB7C2', fontSize: 11, lineHeight: 15, paddingHorizontal: 14, paddingBottom: 4 },
  analysisNote: { color: '#939DA9', fontSize: 10.5, lineHeight: 16, paddingHorizontal: 14, paddingBottom: 14 },
  radarWrap: { width: 300, height: 260, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  radarLabel: { position: 'absolute', color: '#CDD2DA', fontSize: 10, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  radarSquat: { top: 3, left: 115 },
  radarBench: { left: 5, bottom: 18 },
  radarDeadlift: { right: 0, bottom: 18 },
  distributionRow: { gap: 6, paddingHorizontal: 14, paddingBottom: 14 },
  distributionTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  distributionName: { fontSize: 10, lineHeight: 13, fontWeight: '900' },
  distributionValue: { color: '#DAD6DF', fontSize: 11, lineHeight: 14, fontWeight: '700' },
  distributionTrack: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: '#252C35' },
  distributionFill: { height: '100%', borderRadius: 4 },
});
