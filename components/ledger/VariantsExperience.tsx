import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AnalyticalTimeSeriesChart } from '@/components/charts/AnalyticalTimeSeriesChart';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { SLAtmosphericContextHeader } from '@/components/ui/sl-contextual-header';
import { Text } from '@/components/ui/sl-text';
import { analyticalMetricDefinition } from '@/lib/chart-fidelity';
import { kilogramsToDisplayValue } from '@/lib/display-units';
import {
  fetchLedgerCoreVariants,
  type CoreVariantBlockUsage,
  type CoreVariantFamily,
  type CoreVariantMovement,
  type CoreVariantProgression,
  type CoreVariantSetEvidence,
  type LedgerCoreVariantsStory,
} from '@/lib/ledger-variants';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';
import { movementHistorySheetRouteForCanonicalIdentity } from '@/lib/movement-history-launch';

import { useAthleteLedgerSubject } from './athlete-ledger-subject';
import { ledgerHrefFor } from './routing';

const VARIANTS_ATMOSPHERE = require('@/assets/images/ledger-index-v2/ledger-chapter-variants-v1.png');
const VIOLET = '#A35BFF';
const VIOLET_SOFT = '#D2A7FF';
const GREEN = '#55E795';
const FAMILY_TONES: Record<CoreVariantFamily, string> = {
  squat: '#A769FF',
  bench: '#EF5AA1',
  deadlift: '#FF6575',
};
const FAMILY_ICONS: Record<CoreVariantFamily, keyof typeof Ionicons.glyphMap> = {
  squat: 'fitness-outline',
  bench: 'barbell-outline',
  deadlift: 'layers-outline',
};

function readableDate(value?: string | null, year = true) {
  if (!value) return 'No exposure';
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', year
    ? { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function displayNumber(valueKg: number | null | undefined, unit: 'lb' | 'kg') {
  if (valueKg == null || !Number.isFinite(Number(valueKg))) return '—';
  const value = kilogramsToDisplayValue(Number(valueKg), unit);
  return value.toLocaleString('en-US', { maximumFractionDigits: unit === 'kg' ? 1 : 0 });
}

function volumeLabel(valueKg: number, unit: 'lb' | 'kg') {
  const value = kilogramsToDisplayValue(valueKg, unit);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString('en-US');
}

function performanceLabel(set: CoreVariantSetEvidence | null | undefined, unit: 'lb' | 'kg') {
  if (!set) return 'No recorded set';
  return `${displayNumber(set.weight_kg, unit)} ${unit.toUpperCase()} × ${set.reps ?? '—'}`;
}

function comparisonLabel(event: CoreVariantProgression | null | undefined, unit: 'lb' | 'kg') {
  if (!event) return 'No qualified change yet';
  if (event.kind === 'more_weight_same_reps') {
    return `+${displayNumber(event.load_delta_kg, unit)} ${unit.toUpperCase()} at ${event.current.reps} reps`;
  }
  if (event.kind === 'more_reps_same_weight') {
    return `+${event.reps_delta} rep${event.reps_delta === 1 ? '' : 's'} at the same weight`;
  }
  if (event.effort_kind === 'rpe') return `${event.effort_delta?.toFixed(1)} lower RPE at the same task`;
  return `${event.effort_delta?.toFixed(1)} more RIR at the same task`;
}

function SectionHeading({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionHeading}><View style={styles.sectionHeadingCopy}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>{action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => pressed && styles.pressed}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

function State({ title, retry }: { title: string; retry?: () => void }) {
  return <View style={styles.state}><Ionicons color={VIOLET_SOFT} name={retry ? 'alert-circle-outline' : 'hourglass-outline'} size={30} /><Text style={styles.stateText}>{title}</Text>{retry ? <Pressable onPress={retry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable> : null}</View>;
}

function useVariantStory(athleteId?: number) {
  const [story, setStory] = useState<LedgerCoreVariantsStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setLoading(true);
    setError(null);
    fetchLedgerCoreVariants(athleteId)
      .then(setStory)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Core Variant evidence could not be loaded.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [athleteId]);
  return { story, loading, error, load };
}

function variantArtwork(movement: Pick<CoreVariantMovement, 'core_movement_id' | 'family'>) {
  return {
    id: movement.core_movement_id,
    core_movement_id: movement.core_movement_id,
    identity_type: 'core',
    kind: 'variant',
    core_kind: 'variant',
    family: movement.family,
    core_family: movement.family,
  } as const;
}

export default function VariantsExperience() {
  const router = useRouter();
  const ledgerSubject = useAthleteLedgerSubject();
  const { story, loading, error, load } = useVariantStory(ledgerSubject.athleteId);
  const { unit, setUnit } = useSurfaceWeightUnit(story?.athlete.preferred_units);
  const [timelineMovementId, setTimelineMovementId] = useState<number | null>(null);
  const movementById = useMemo(() => new Map((story?.movements || []).map((movement) => [movement.core_movement_id, movement])), [story?.movements]);
  const progress = useMemo(() => (story?.making_progress_ids || []).flatMap((id) => {
    const movement = movementById.get(id);
    return movement ? [movement] : [];
  }), [movementById, story?.making_progress_ids]);
  const timelineMovement = movementById.get(timelineMovementId || 0)
    || story?.movements.find((movement) => movement.currently_programmed)
    || story?.movements[0];

  if (loading) return <State title="Loading your Core Variant record." />;
  if (error || !story) return <State title={error || 'Core Variant evidence is unavailable.'} retry={load} />;
  const openVariant = (coreMovementId: number) => router.push({ pathname: `/(tabs)/ledger/variant/${coreMovementId}` as any, params: ledgerSubject.routeParams } as never);
  const openFamily = (family: CoreVariantFamily) => router.push({ pathname: `/(tabs)/ledger/variant-family/${family}` as any, params: ledgerSubject.routeParams } as never);

  return <View style={styles.page} testID="ledger-core-variants-continuous-experience">
    <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} testID="variants-unit-toggle" />
    <SLAtmosphericContextHeader
      accent={VIOLET}
      atmosphereSource={VARIANTS_ATMOSPHERE}
      backAccessibilityLabel="Back to The Ledger"
      contextLabel="The Ledger · Supplemental Core Work"
      onBack={() => ledgerSubject.returnPath ? router.replace(ledgerSubject.returnPath as never) : router.replace(ledgerHrefFor('home') as never)}
      subtitle="Exact variant progress, exposure, and training context."
      testID="variants-atmospheric-header"
      title="Variants"
    >
      <View style={styles.headerFooter}><View style={styles.headerPill}><Ionicons color={VIOLET_SOFT} name="git-branch-outline" size={15} /><Text style={styles.headerPillText}>{story.current_block?.name || 'Current training'} · {story.current_rotation.count} active</Text></View></View>
    </SLAtmosphericContextHeader>

    <View style={styles.content}>
      <View style={styles.independenceNotice} testID="variant-independence-policy"><Ionicons color={VIOLET_SOFT} name="unlink-outline" size={19} /><View style={styles.independenceCopy}><Text style={styles.independenceTitle}>Supplemental evidence stands on its own.</Text><Text style={styles.independenceBody}>Variant bests never claim that your Competition lift improved.</Text></View></View>

      <View testID="variants-current-rotation">
        <SectionHeading title="CURRENT ROTATION" subtitle={`${story.current_rotation.count} variants programmed in ${story.current_block?.name || 'the current block'}.`} />
        <View style={styles.rotationCard}>{story.current_rotation.families.map((group, index) => <View key={group.family} style={[styles.rotationFamily, index > 0 && styles.rotationFamilyDivider]}><View style={styles.rotationLabel}><View style={[styles.familyDot, { backgroundColor: FAMILY_TONES[group.family] }]} /><Text style={[styles.rotationFamilyName, { color: FAMILY_TONES[group.family] }]}>{group.label.toUpperCase()}</Text></View><View style={styles.rotationVariants}>{group.variants.length ? group.variants.map((variant) => <Pressable key={variant.core_movement_id} accessibilityRole="button" onPress={() => openVariant(variant.core_movement_id)} style={({ pressed }) => [styles.rotationVariant, pressed && styles.pressed]}><Text numberOfLines={1} style={styles.rotationVariantName}>{variant.name}</Text><Ionicons color="#858D9A" name="chevron-forward" size={15} /></Pressable>) : <Text style={styles.rotationEmpty}>No active variant</Text>}</View></View>)}</View>
      </View>

      <View testID="variant-family-summary">
        <SectionHeading title="CORE LIFT VARIANT FAMILIES" subtitle="Organized by the Competition lift each movement supports." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.familyRail}>{story.families.map((family) => {
          const first = story.movements.find((movement) => movement.family === family.family);
          return <Pressable key={family.family} accessibilityRole="button" accessibilityLabel={`Open ${family.label} Variants`} onPress={() => openFamily(family.family)} style={({ pressed }) => [styles.familyCard, { borderColor: `${FAMILY_TONES[family.family]}70` }, pressed && styles.pressed]}><View style={styles.familyCardTop}><View style={[styles.familyIcon, { backgroundColor: `${FAMILY_TONES[family.family]}1E` }]}>{first ? <CanonicalMovementArtwork movement={variantArtwork(first)} size={66} testID={`variants-family-${family.family}-artwork`} /> : <Ionicons color={FAMILY_TONES[family.family]} name={FAMILY_ICONS[family.family]} size={25} />}</View><View style={styles.familyCounts}><Text style={styles.familyCount}>{family.recorded_count}</Text><Text style={styles.familyCountLabel}>RECORDED</Text><Text style={[styles.familyActive, { color: FAMILY_TONES[family.family] }]}>{family.active_count} active</Text></View></View><Text style={styles.familyName}>{family.label} Variants</Text><Text style={styles.familyMeta}>{family.session_count} sessions · {family.set_count} working sets</Text><View style={styles.familyRule} /><Text numberOfLines={2} style={styles.familyProgress}>{family.strongest_progression ? comparisonLabel(family.strongest_progression, unit) : 'No qualified progression yet'}</Text><View style={styles.familyDateRow}><Text style={styles.familyDate}>Latest · {readableDate(family.last_performed_on, false)}</Text><Ionicons color="#8B8094" name="arrow-forward" size={14} /></View></Pressable>;
        })}</ScrollView>
      </View>

      <View testID="variants-making-progress">
        <SectionHeading title="VARIANTS MAKING PROGRESS" subtitle="Literal load, rep, or effort improvements at an exact comparable task." />
        {progress.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressRail}>{progress.map((movement) => <ProgressCard key={movement.core_movement_id} movement={movement} unit={unit} onPress={() => openVariant(movement.core_movement_id)} />)}</ScrollView> : <CompactEmpty title="No comparable progress yet" body="Variant history is preserved, but no exact task has improved in this range." />}
      </View>

      <View testID="variant-block-exposure">
        <SectionHeading title="EXPOSURE ACROSS BLOCKS" subtitle="When an exact variant entered, continued, or left the program." />
        {story.movements.length ? <><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variantSelector}>{story.movements.map((movement) => {
          const selected = movement.core_movement_id === timelineMovement?.core_movement_id;
          return <Pressable key={movement.core_movement_id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setTimelineMovementId(movement.core_movement_id)} style={[styles.variantSelectorPill, selected && styles.variantSelectorPillSelected]}><Text style={[styles.variantSelectorText, selected && styles.variantSelectorTextSelected]}>{movement.name}</Text></Pressable>;
        })}</ScrollView>{timelineMovement ? <BlockTimeline movement={timelineMovement} unit={unit} /> : null}</> : null}
      </View>

      <View testID="variant-historical-record">
        <SectionHeading title="YOUR VARIANT RECORD" subtitle="Current and historical variants remain grouped by their parent Core lift." />
        <View style={styles.recordStack}>{story.current_rotation.families.map((family) => {
          const movements = story.movements.filter((movement) => movement.family === family.family);
          return <View key={family.family} style={styles.recordFamily}><View style={styles.recordFamilyHeader}><View><Text style={[styles.recordFamilyName, { color: FAMILY_TONES[family.family] }]}>{family.label.toUpperCase()}</Text><Text style={styles.recordFamilyCount}>{movements.length} variant{movements.length === 1 ? '' : 's'} recorded</Text></View><Ionicons color={FAMILY_TONES[family.family]} name={FAMILY_ICONS[family.family]} size={21} /></View>{movements.map((movement) => <VariantRecordRow key={movement.core_movement_id} movement={movement} unit={unit} onPress={() => openVariant(movement.core_movement_id)} />)}</View>;
        })}</View>
      </View>

      <View style={styles.sourcePolicy}><Ionicons color="#8B77A4" name="shield-checkmark-outline" size={19} /><Text style={styles.sourcePolicyText}>Exact governed Core Variant identity only · Competition evidence remains separate · no inferred carryover</Text></View>
    </View>
  </View>;
}

export function VariantFamilyExperience({ family }: { family: CoreVariantFamily }) {
  const router = useRouter();
  const ledgerSubject = useAthleteLedgerSubject();
  const { story, loading, error, load } = useVariantStory(ledgerSubject.athleteId);
  const { unit, setUnit } = useSurfaceWeightUnit(story?.athlete.preferred_units);
  if (loading) return <State title="Loading Core lift variant family." />;
  if (error || !story) return <State title={error || 'Core Variant family is unavailable.'} retry={load} />;
  const summary = story.families.find((row) => row.family === family);
  const movements = story.movements.filter((row) => row.family === family);
  if (!summary) return <State title="This governed Core lift family is unavailable." />;
  const tone = FAMILY_TONES[family];
  const active = movements.filter((row) => row.currently_programmed);
  const progressing = movements.filter((row) => row.latest_progression);
  const openVariant = (coreMovementId: number) => router.push({ pathname: `/(tabs)/ledger/variant/${coreMovementId}` as any, params: ledgerSubject.routeParams } as never);

  return <View style={styles.page} testID="ledger-core-variant-family">
    <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} testID="variant-family-unit-toggle" />
    <SLAtmosphericContextHeader
      accent={tone}
      atmosphereSource={VARIANTS_ATMOSPHERE}
      backAccessibilityLabel="Back to Variants"
      contextLabel="Core Variant Family"
      onBack={() => router.replace({ pathname: '/(tabs)/ledger/variants', params: ledgerSubject.routeParams } as never)}
      subtitle={`Every governed supplemental movement supporting ${summary.label}.`}
      title={`${summary.label} Variants`}
    />
    <View style={styles.detailContent}>
      <View style={[styles.familyEvidenceBand, { borderColor: `${tone}70` }]}><DetailFact value={summary.recorded_count.toString()} label="Recorded variants" /><DetailDivider /><DetailFact value={summary.active_count.toString()} label="Active now" /><DetailDivider /><DetailFact value={summary.session_count.toString()} label="Sessions" /><DetailDivider /><DetailFact value={`${volumeLabel(summary.volume_kg, unit)} ${unit.toUpperCase()}`} label="Performed volume" wide /></View>
      <View style={styles.independenceNotice}><Ionicons color={tone} name="unlink-outline" size={19} /><View style={styles.independenceCopy}><Text style={styles.independenceTitle}>Supports {summary.label}. Stays independent.</Text><Text style={styles.independenceBody}>This family never inherits or modifies Competition {summary.label} evidence.</Text></View></View>
      <View><SectionHeading title="ACTIVE ROTATION" subtitle={`${active.length} ${summary.label} variant${active.length === 1 ? '' : 's'} programmed in ${story.current_block?.name || 'the current block'}.`} /><View style={styles.recordFamily}>{active.length ? active.map((movement) => <VariantRecordRow key={movement.core_movement_id} movement={movement} unit={unit} onPress={() => openVariant(movement.core_movement_id)} />) : <CompactEmpty title="No active variant" body="Historical exact evidence remains available below." />}</View></View>
      <View><SectionHeading title="MAKING PROGRESS" subtitle="Qualified changes within this exact Core lift family." />{progressing.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressRail}>{progressing.map((movement) => <ProgressCard key={movement.core_movement_id} movement={movement} unit={unit} onPress={() => openVariant(movement.core_movement_id)} />)}</ScrollView> : <CompactEmpty title="No qualified progress yet" body="No positive result is inferred from unrelated or Competition-lift evidence." />}</View>
      <View><SectionHeading title="COMPLETE FAMILY RECORD" subtitle="Active and historical variants, preserved by exact governed identity." /><View style={styles.recordFamily}>{movements.map((movement) => <VariantRecordRow key={movement.core_movement_id} movement={movement} unit={unit} onPress={() => openVariant(movement.core_movement_id)} />)}</View></View>
    </View>
  </View>;
}

export function VariantDetailExperience({ coreMovementId }: { coreMovementId: number }) {
  const router = useRouter();
  const ledgerSubject = useAthleteLedgerSubject();
  const { story, loading, error, load } = useVariantStory(ledgerSubject.athleteId);
  const { unit, setUnit } = useSurfaceWeightUnit(story?.athlete.preferred_units);
  const movement = story?.movements.find((row) => row.core_movement_id === coreMovementId);
  if (loading) return <State title="Loading exact variant evidence." />;
  if (error || !story) return <State title={error || 'Variant evidence is unavailable.'} retry={load} />;
  if (!movement) return <State title="This governed variant has no visible evidence." />;
  const tone = FAMILY_TONES[movement.family];
  const latestChange = movement.latest_progression;

  return <View style={styles.page} testID="ledger-core-variant-detail">
    <FloatingDisplayUnitRegistration unit={unit} onChange={setUnit} testID="variant-detail-unit-toggle" />
    <SLAtmosphericContextHeader
      accent={tone}
      atmosphereSource={VARIANTS_ATMOSPHERE}
      backAccessibilityLabel="Back to Variants"
      contextLabel={`${movement.parent_lift_label} Variant · Exact Record`}
      onBack={() => router.replace({ pathname: '/(tabs)/ledger/variants', params: ledgerSubject.routeParams } as never)}
      subtitle="Supplemental performance and exposure, independent from the Competition lift."
      testID="variant-detail-atmospheric-header"
      title={movement.name}
    />
    <View style={styles.detailContent}>
      <View style={[styles.detailHero, { borderColor: `${tone}7A` }]}><View style={[styles.detailArt, { backgroundColor: `${tone}12` }]}><CanonicalMovementArtwork movement={variantArtwork(movement)} size={132} testID="variant-detail-canonical-artwork" /></View><View style={styles.detailHeroCopy}><Text style={[styles.detailKicker, { color: tone }]}>LATEST BEST</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.detailPerformance}>{performanceLabel(movement.latest_best, unit)}</Text><Text style={styles.detailDate}>{readableDate(movement.latest_best?.date)}</Text><View style={[styles.detailSupportPill, { borderColor: `${tone}70` }]}><Text style={[styles.detailSupportText, { color: tone }]}>SUPPORTS {movement.parent_lift_label.toUpperCase()}</Text></View></View></View>

      <View style={styles.detailEvidenceBand}><DetailFact value={movement.session_count.toString()} label="Sessions" /><DetailDivider /><DetailFact value={movement.set_count.toString()} label="Working sets" /><DetailDivider /><DetailFact value={`${volumeLabel(movement.volume_kg, unit)} ${unit.toUpperCase()}`} label="Performed volume" wide /></View>

      <View style={styles.detailChange}><View style={[styles.detailChangeIcon, { backgroundColor: `${tone}1F` }]}><Ionicons color={tone} name={latestChange ? 'trending-up-outline' : 'remove-outline'} size={23} /></View><View style={styles.detailChangeCopy}><Text style={styles.detailChangeKicker}>{story.current_block?.name?.toUpperCase() || 'CURRENT RANGE'}</Text><Text style={styles.detailChangeTitle}>{latestChange ? comparisonLabel(latestChange, unit) : 'No qualified improvement yet'}</Text><Text style={styles.detailChangeBody}>{latestChange ? `${performanceLabel(latestChange.current, unit)} vs ${performanceLabel(latestChange.prior, unit)}` : 'Recorded evidence remains visible without manufacturing a positive result.'}</Text></View></View>

      <View style={styles.detailSection} testID="variant-weight-on-bar"><SectionHeading title="WEIGHT ON THE BAR" subtitle="Literal heaviest recorded load in each Session. No formula." /><View style={styles.chartCard}><AnalyticalTimeSeriesChart emptyBody="Two exact variant Sessions are required." emptyTitle="Weight progression needs more history" height={205} metric={analyticalMetricDefinition('variant_weight_on_bar', { label: 'Heaviest performed load', kind: 'weight', unit: unit.toUpperCase(), axisUnit: unit.toUpperCase(), maximumFractionDigits: unit === 'kg' ? 1 : 0 })} series={[{ key: 'weight', label: 'Weight on the bar', color: tone, points: movement.weight_progression.map((point) => ({ date: point.date, value: kilogramsToDisplayValue(point.weight_kg, unit), meta: { reps: point.reps, rpe: point.rpe } })) }]} showLegend={false} testID="variant-weight-progression-chart" /></View></View>

      <View style={styles.detailSection} testID="variant-performed-volume"><SectionHeading title="PERFORMED VOLUME" subtitle="Exact recorded load × reps for this variant in each Session." /><View style={styles.chartCard}><AnalyticalTimeSeriesChart emptyBody="Two exact variant Sessions are required." emptyTitle="Volume progression needs more history" height={190} metric={analyticalMetricDefinition('variant_performed_volume', { label: 'Performed volume', kind: 'weight', unit: unit.toUpperCase(), axisUnit: unit.toUpperCase(), maximumFractionDigits: 0 })} series={[{ key: 'volume', label: 'Performed volume', color: VIOLET, points: movement.volume_progression.map((point) => ({ date: point.date, value: kilogramsToDisplayValue(point.volume_kg, unit), meta: { set_count: point.set_count, training_block_name: point.training_block_name } })) }]} showLegend={false} testID="variant-volume-progression-chart" /></View></View>

      <View style={styles.detailSection} testID="variant-rep-strength"><SectionHeading title="REP STRENGTH" subtitle="Best literal recorded load at each available rep count." /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.repRail}>{movement.rep_strength.map((row) => <View key={`${row.reps}-${row.set_log_id}`} style={styles.repCard}><Text style={[styles.repCount, { color: tone }]}>{row.reps}RM</Text><Text style={styles.repWeight}>{displayNumber(row.weight_kg, unit)} <Text style={styles.repUnit}>{unit.toUpperCase()}</Text></Text><Text style={styles.repDate}>{readableDate(row.date, false)}</Text></View>)}</ScrollView></View>

      <View style={styles.detailSection} testID="variant-comparable-performance"><SectionHeading title="COMPARABLE PERFORMANCE" subtitle="Same reps, same weight, or the same task at lower effort." />{movement.progressions.length ? <View style={styles.comparisonList}>{movement.progressions.slice(0, 5).map((event) => <View key={`${event.workout_id}-${event.kind}`} style={styles.comparisonRow}><View style={[styles.comparisonMark, { backgroundColor: `${tone}20` }]}><Ionicons color={tone} name="arrow-up-outline" size={17} /></View><View style={styles.comparisonCopy}><Text style={styles.comparisonTitle}>{comparisonLabel(event, unit)}</Text><Text style={styles.comparisonMeta}>{performanceLabel(event.current, unit)} · {readableDate(event.occurred_on, false)}</Text><Text style={styles.comparisonPrior}>Previous {performanceLabel(event.prior, unit)}</Text></View></View>)}</View> : <CompactEmpty title="No qualified comparison" body="The historical record remains available without a fabricated progression claim." />}</View>

      <View style={styles.detailSection} testID="variant-block-history"><SectionHeading title="BLOCK HISTORY" subtitle="Exact variant exposure and programming status across blocks." /><BlockTimeline movement={movement} unit={unit} /></View>

      <View style={styles.detailSection} testID="variant-session-history"><SectionHeading title="SESSION HISTORY" subtitle={`${movement.source_set_log_ids.length} exact source sets preserved.`} /><View style={styles.sessionList}>{movement.recent_exposures.map((exposure) => <Pressable key={exposure.workout_id} accessibilityRole="button" onPress={() => router.push({ pathname: `/(tabs)/ledger/archive/session/${exposure.workout_id}` as any, params: ledgerSubject.routeParams } as never)} style={({ pressed }) => [styles.detailSessionRow, pressed && styles.pressed]}><View style={styles.detailSessionCopy}><Text style={[styles.detailSessionDate, { color: tone }]}>{readableDate(exposure.date)}</Text><Text numberOfLines={1} style={styles.detailSessionName}>{exposure.session_title}</Text><Text style={styles.detailSessionBlock}>{exposure.training_block_name || 'Unassigned block'}</Text></View><View style={styles.detailSessionValues}><Text style={styles.detailSessionBest}>{performanceLabel(exposure.best_set, unit)}</Text><Text style={styles.detailSessionMeta}>{exposure.set_count} sets · {volumeLabel(exposure.volume_kg, unit)} {unit.toUpperCase()}</Text></View><Ionicons color="#858D9A" name="chevron-forward" size={17} /></Pressable>)}</View></View>

      <Pressable accessibilityRole="button" accessibilityLabel={`Open exact history for ${movement.name}`} onPress={() => router.push(movementHistorySheetRouteForCanonicalIdentity({ coreMovementId: movement.core_movement_id, athleteId: ledgerSubject.athleteId }) as never)} style={({ pressed }) => [styles.sourceDetail, pressed && styles.pressed]}><Ionicons color={tone} name="finger-print-outline" size={21} /><View style={styles.sourceDetailCopy}><Text style={styles.sourceDetailTitle}>SOURCE EVIDENCE</Text><Text style={styles.sourceDetailBody}>Exact governed ID {movement.core_movement_id} · {movement.source_set_log_ids.length} immutable performed sets · no Competition {movement.parent_lift_label} evidence merged.</Text></View><Ionicons color="#858D9A" name="chevron-forward" size={17} /></Pressable>
    </View>
  </View>;
}

function ProgressCard({ movement, unit, onPress }: { movement: CoreVariantMovement; unit: 'lb' | 'kg'; onPress: () => void }) {
  const event = movement.latest_progression!;
  const tone = FAMILY_TONES[movement.family];
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.progressCard, { borderColor: `${tone}73` }, pressed && styles.pressed]}><View style={styles.progressArt}><CanonicalMovementArtwork movement={variantArtwork(movement)} size={88} testID="variants-progress-canonical-artwork" /></View><Text style={[styles.progressSupport, { color: tone }]}>SUPPORTS {movement.parent_lift_label.toUpperCase()}</Text><Text numberOfLines={2} style={styles.progressName}>{movement.name}</Text><Text style={styles.progressCurrent}>{performanceLabel(event.current, unit)}</Text><Text style={styles.progressPrior}>Previous {performanceLabel(event.prior, unit)}</Text><View style={[styles.progressChange, { backgroundColor: `${tone}18` }]}><Ionicons color={GREEN} name="trending-up-outline" size={16} /><Text style={styles.progressChangeText}>{comparisonLabel(event, unit)}</Text></View></Pressable>;
}

function BlockTimeline({ movement, unit }: { movement: CoreVariantMovement; unit: 'lb' | 'kg' }) {
  const tone = FAMILY_TONES[movement.family];
  return <View style={styles.blockTimeline}><View style={styles.timelineIdentity}><CanonicalMovementArtwork movement={variantArtwork(movement)} size={54} /><View style={styles.timelineCopy}><Text style={styles.timelineName}>{movement.name}</Text><Text style={styles.timelineMeta}>{movement.session_count} Sessions · {movement.set_count} working sets</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.blockRail}>{movement.block_usage.map((block, index) => <React.Fragment key={block.block_id}>{index ? <View style={[styles.blockConnector, block.programmed && { backgroundColor: `${tone}80` }]} /> : null}<BlockUsageCard block={block} tone={tone} unit={unit} /></React.Fragment>)}</ScrollView></View>;
}

function BlockUsageCard({ block, tone, unit }: { block: CoreVariantBlockUsage; tone: string; unit: 'lb' | 'kg' }) {
  const used = block.session_count > 0;
  return <View style={[styles.blockCard, block.programmed && { borderColor: `${tone}8C`, backgroundColor: `${tone}0E` }]}><View style={styles.blockCardTop}><View style={[styles.blockNode, used && { borderColor: tone, backgroundColor: tone }]} />{block.programmed ? <Text style={[styles.blockActive, { color: tone }]}>PROGRAMMED</Text> : null}</View><Text numberOfLines={1} style={styles.blockName}>{block.block_name}</Text>{used ? <><Text style={styles.blockSessions}>{block.session_count} Session{block.session_count === 1 ? '' : 's'} · {block.set_count} sets</Text><Text style={styles.blockVolume}>{volumeLabel(block.volume_kg, unit)} {unit.toUpperCase()} volume</Text></> : <Text style={styles.blockNotProgrammed}>{block.programmed ? 'Awaiting exposure' : 'Not programmed'}</Text>}</View>;
}

function VariantRecordRow({ movement, unit, onPress }: { movement: CoreVariantMovement; unit: 'lb' | 'kg'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.recordRow, pressed && styles.pressed]}><CanonicalMovementArtwork movement={variantArtwork(movement)} size={49} testID="variant-record-canonical-artwork" /><View style={styles.recordCopy}><View style={styles.recordNameRow}><Text numberOfLines={1} style={styles.recordName}>{movement.name}</Text>{movement.currently_programmed ? <View style={styles.activePill}><Text style={styles.activePillText}>ACTIVE</Text></View> : null}</View><Text style={styles.recordMeta}>{movement.session_count} Sessions · {movement.set_count} sets · last {readableDate(movement.last_performed_on, false)}</Text></View><View style={styles.recordBest}><Text style={styles.recordBestValue}>{performanceLabel(movement.historical_load_best, unit)}</Text><Text numberOfLines={1} style={movement.latest_progression ? styles.recordProgress : styles.recordStable}>{movement.latest_progression ? comparisonLabel(movement.latest_progression, unit) : 'No change claimed'}</Text></View><Ionicons color="#858D9A" name="chevron-forward" size={16} /></Pressable>;
}

function DetailFact({ value, label, wide = false }: { value: string; label: string; wide?: boolean }) {
  return <View style={[styles.detailFact, wide && styles.detailFactWide]}><Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.detailFactValue}>{value}</Text><Text style={styles.detailFactLabel}>{label}</Text></View>;
}

function DetailDivider() {
  return <View style={styles.detailDivider} />;
}

function CompactEmpty({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><Ionicons color="#8567A7" name="analytics-outline" size={23} /><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { paddingBottom: 26 },
  content: { gap: 17, paddingHorizontal: 14, paddingTop: 14 },
  detailContent: { gap: 15, paddingHorizontal: 14, paddingTop: 14 },
  headerFooter: { paddingLeft: 62, paddingBottom: 8 },
  headerPill: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 11, borderRadius: 18, borderWidth: 1, borderColor: '#7049A0', backgroundColor: 'rgba(7,4,11,0.9)' },
  headerPillText: { color: '#ECE5F3', fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  sectionHeading: { minHeight: 50, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, paddingHorizontal: 2, paddingVertical: 7 },
  sectionHeadingCopy: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: { color: '#D2A8FF', fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 0.7 },
  sectionSubtitle: { color: '#9297A4', fontSize: 11.5, lineHeight: 16 },
  sectionAction: { color: VIOLET_SOFT, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  independenceNotice: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: '#443052', backgroundColor: '#0B0810' },
  independenceCopy: { flex: 1, minWidth: 0, gap: 3 },
  independenceTitle: { color: '#E8E2EC', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  independenceBody: { color: '#8E8A96', fontSize: 11, lineHeight: 15 },
  rotationCard: { overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#4E3561', backgroundColor: '#09070D' },
  rotationFamily: { minHeight: 64, flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 12, paddingVertical: 7 },
  rotationFamilyDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#302538' },
  rotationLabel: { width: 96, flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingTop: 5 },
  familyDot: { width: 7, height: 7, marginTop: 3, borderRadius: 4 },
  rotationFamilyName: { flex: 1, fontSize: 10.5, lineHeight: 14, fontWeight: '800', letterSpacing: 0.55 },
  rotationVariants: { flex: 1, minWidth: 0 },
  rotationVariant: { minHeight: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, paddingLeft: 8, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: '#352A3D' },
  rotationVariantName: { flex: 1, color: '#E9E4EC', fontSize: 11.5, lineHeight: 15, fontWeight: '600' },
  rotationEmpty: { color: '#777580', fontSize: 11, lineHeight: 25, fontStyle: 'italic' },
  familyRail: { gap: 10, paddingRight: 14 },
  familyCard: { width: 220, minHeight: 206, padding: 11, borderRadius: 15, borderWidth: 1, backgroundColor: '#09080D' },
  familyCardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  familyIcon: { width: 68, height: 62, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12 },
  familyCounts: { alignItems: 'flex-end' },
  familyCount: { color: '#F2EDF5', fontSize: 28, lineHeight: 31, fontWeight: '800' },
  familyCountLabel: { color: '#747985', fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5 },
  familyActive: { marginTop: 5, fontSize: 11, lineHeight: 14, fontWeight: '800' },
  familyName: { marginTop: 10, color: '#F0EBF3', fontSize: 16, lineHeight: 21, fontWeight: '700' },
  familyMeta: { marginTop: 2, color: '#898D97', fontSize: 10.5, lineHeight: 14 },
  familyRule: { height: StyleSheet.hairlineWidth, marginVertical: 7, backgroundColor: '#302D36' },
  familyProgress: { minHeight: 27, color: '#D0C8D5', fontSize: 11.5, lineHeight: 15, fontWeight: '600' },
  familyDateRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  familyDate: { color: '#737986', fontSize: 10, lineHeight: 13 },
  familyEvidenceBand: { minHeight: 94, flexDirection: 'row', alignItems: 'stretch', paddingVertical: 10, paddingHorizontal: 7, borderRadius: 14, borderWidth: 1, backgroundColor: '#080A0E' },
  progressRail: { gap: 10, paddingRight: 14 },
  progressCard: { width: 236, minHeight: 284, padding: 11, borderRadius: 15, borderWidth: 1, backgroundColor: '#0A080E' },
  progressArt: { height: 82, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 11, backgroundColor: '#100C17' },
  progressSupport: { marginTop: 9, fontSize: 9.5, lineHeight: 13, fontWeight: '800', letterSpacing: 0.65 },
  progressName: { minHeight: 39, marginTop: 2, color: '#F0ECF3', fontSize: 15, lineHeight: 19, fontWeight: '700' },
  progressCurrent: { color: '#FFFFFF', fontSize: 18, lineHeight: 23, fontWeight: '800' },
  progressPrior: { marginTop: 2, color: '#828793', fontSize: 10.5, lineHeight: 14 },
  progressChange: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 8, borderRadius: 9 },
  progressChangeText: { flex: 1, color: GREEN, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  variantSelector: { gap: 7, paddingBottom: 9, paddingRight: 14 },
  variantSelectorPill: { minHeight: 35, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 18, borderWidth: 1, borderColor: '#343743', backgroundColor: '#090B10' },
  variantSelectorPillSelected: { borderColor: VIOLET, backgroundColor: '#32154D' },
  variantSelectorText: { color: '#9296A0', fontSize: 11, lineHeight: 14, fontWeight: '600' },
  variantSelectorTextSelected: { color: '#F0E6FB' },
  blockTimeline: { overflow: 'hidden', padding: 11, borderRadius: 14, borderWidth: 1, borderColor: '#34313C', backgroundColor: '#080A0E' },
  timelineIdentity: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2D2B33' },
  timelineCopy: { flex: 1, minWidth: 0, gap: 2 },
  timelineName: { color: '#EEE9F1', fontSize: 14, lineHeight: 18, fontWeight: '700' },
  timelineMeta: { color: '#858A95', fontSize: 10.5, lineHeight: 14 },
  blockRail: { alignItems: 'center', paddingTop: 12, paddingRight: 8 },
  blockConnector: { width: 14, height: 1, backgroundColor: '#363741' },
  blockCard: { width: 132, minHeight: 86, padding: 9, borderRadius: 11, borderWidth: 1, borderColor: '#30333C', backgroundColor: '#0C0E13' },
  blockCardTop: { minHeight: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockNode: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#545965', backgroundColor: '#13161C' },
  blockActive: { fontSize: 8, lineHeight: 11, fontWeight: '800', letterSpacing: 0.5 },
  blockName: { marginTop: 4, color: '#E1DDE4', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  blockSessions: { marginTop: 5, color: '#A8A5AD', fontSize: 10, lineHeight: 13 },
  blockVolume: { color: '#747A86', fontSize: 9.5, lineHeight: 12 },
  blockNotProgrammed: { marginTop: 5, color: '#6F737D', fontSize: 10, lineHeight: 13, fontStyle: 'italic' },
  recordStack: { gap: 11 },
  recordFamily: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#343843', backgroundColor: '#080A0E' },
  recordFamilyHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2D313A', backgroundColor: '#0D0F14' },
  recordFamilyName: { fontSize: 11.5, lineHeight: 15, fontWeight: '800', letterSpacing: 0.65 },
  recordFamilyCount: { color: '#7F8490', fontSize: 10, lineHeight: 13 },
  recordRow: { minHeight: 77, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292D35' },
  recordCopy: { flex: 1, minWidth: 0, gap: 3 },
  recordNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recordName: { flexShrink: 1, color: '#E8E4EB', fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
  activePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, backgroundColor: '#3A1757' },
  activePillText: { color: '#D8B5FF', fontSize: 7.5, lineHeight: 10, fontWeight: '800', letterSpacing: 0.45 },
  recordMeta: { color: '#7D838E', fontSize: 9.5, lineHeight: 13 },
  recordBest: { width: 121, alignItems: 'flex-end', gap: 3 },
  recordBestValue: { color: '#ECE8EF', fontSize: 10.5, lineHeight: 14, fontWeight: '700', textAlign: 'right' },
  recordProgress: { maxWidth: 121, color: GREEN, fontSize: 9, lineHeight: 12, textAlign: 'right' },
  recordStable: { color: '#6F7580', fontSize: 9, lineHeight: 12 },
  sourcePolicy: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#302B38', backgroundColor: '#08090D' },
  sourcePolicyText: { flex: 1, color: '#817989', fontSize: 10.5, lineHeight: 15 },
  detailHero: { minHeight: 196, flexDirection: 'row', alignItems: 'center', gap: 13, overflow: 'hidden', padding: 12, borderRadius: 16, borderWidth: 1, backgroundColor: '#09070D' },
  detailArt: { width: 142, height: 168, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 13 },
  detailHeroCopy: { flex: 1, minWidth: 0, gap: 4 },
  detailKicker: { fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 0.7 },
  detailPerformance: { color: '#F5F0F7', fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.7 },
  detailDate: { color: '#8C919B', fontSize: 10.5, lineHeight: 14 },
  detailSupportPill: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, borderWidth: 1 },
  detailSupportText: { fontSize: 8.5, lineHeight: 11, fontWeight: '800', letterSpacing: 0.5 },
  detailEvidenceBand: { minHeight: 88, flexDirection: 'row', alignItems: 'stretch', paddingVertical: 10, paddingHorizontal: 9, borderRadius: 14, borderWidth: 1, borderColor: '#343843', backgroundColor: '#080A0E' },
  detailFact: { flex: 0.8, minWidth: 0, justifyContent: 'center', paddingHorizontal: 7 },
  detailFactWide: { flex: 1.25 },
  detailFactValue: { color: '#F1EDF4', fontSize: 20, lineHeight: 25, fontWeight: '800' },
  detailFactLabel: { color: '#858B96', fontSize: 10, lineHeight: 13 },
  detailDivider: { width: StyleSheet.hairlineWidth, marginVertical: 3, backgroundColor: '#2C3139' },
  detailChange: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#3E3348', backgroundColor: '#0B0910' },
  detailChangeIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  detailChangeCopy: { flex: 1, minWidth: 0, gap: 2 },
  detailChangeKicker: { color: '#9C7CB5', fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.6 },
  detailChangeTitle: { color: GREEN, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  detailChangeBody: { color: '#898D97', fontSize: 10.5, lineHeight: 14 },
  detailSection: { gap: 1 },
  chartCard: { overflow: 'hidden', paddingHorizontal: 8, paddingTop: 5, paddingBottom: 6, borderRadius: 14, borderWidth: 1, borderColor: '#343843', backgroundColor: '#07090D' },
  repRail: { gap: 9, paddingRight: 14 },
  repCard: { width: 132, minHeight: 100, justifyContent: 'center', gap: 2, padding: 11, borderRadius: 13, borderWidth: 1, borderColor: '#3C3546', backgroundColor: '#0A0B10' },
  repCount: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.55 },
  repWeight: { color: '#F1EDF3', fontSize: 20, lineHeight: 25, fontWeight: '800' },
  repUnit: { color: '#8C929D', fontSize: 9.5, fontWeight: '800' },
  repDate: { color: '#777D88', fontSize: 9.5, lineHeight: 13 },
  comparisonList: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#343843', backgroundColor: '#080A0E' },
  comparisonRow: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292E36' },
  comparisonMark: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  comparisonCopy: { flex: 1, minWidth: 0, gap: 2 },
  comparisonTitle: { color: GREEN, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  comparisonMeta: { color: '#E3DFE6', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  comparisonPrior: { color: '#777D88', fontSize: 9.5, lineHeight: 13 },
  sessionList: { overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: '#343843', backgroundColor: '#080A0E' },
  detailSessionRow: { minHeight: 79, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#292E36' },
  detailSessionCopy: { flex: 1, minWidth: 0, gap: 1 },
  detailSessionDate: { fontSize: 9.5, lineHeight: 13, fontWeight: '800' },
  detailSessionName: { color: '#E6E2E9', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  detailSessionBlock: { color: '#757B86', fontSize: 9.5, lineHeight: 13 },
  detailSessionValues: { width: 126, alignItems: 'flex-end', gap: 2 },
  detailSessionBest: { color: '#E9E5EC', fontSize: 10.5, lineHeight: 14, fontWeight: '700', textAlign: 'right' },
  detailSessionMeta: { color: '#777D88', fontSize: 9.5, lineHeight: 13, textAlign: 'right' },
  sourceDetail: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#3B3344', backgroundColor: '#09080D' },
  sourceDetailCopy: { flex: 1, minWidth: 0, gap: 3 },
  sourceDetailTitle: { color: '#B692D2', fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 0.6 },
  sourceDetailBody: { color: '#85808B', fontSize: 10.5, lineHeight: 15 },
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
