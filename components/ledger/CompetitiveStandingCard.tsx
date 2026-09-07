import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { formatWeightFromKg } from '@/lib/display-units';
import type { LedgerUnit, StrengthMetric, StrengthStandardProjection } from '@/lib/ledger-data';
import {
  competitiveStanding,
  competitiveStandingSummary,
  strengthReferenceCohort,
  type StrengthTierState,
} from '@/lib/ledger-rewards';

type Props = Readonly<{
  state: StrengthTierState | null;
  standard: StrengthStandardProjection | null;
  metric: StrengthMetric;
  metricLabel: string;
  currentKg: number | null;
  unit: LedgerUnit;
  accent?: string;
  compact?: boolean;
  testID?: string;
}>;

export function CompetitiveStandingCard({
  state,
  standard,
  metric,
  metricLabel,
  currentKg,
  unit,
  accent = '#A85CFF',
  compact = false,
  testID = 'competitive-standing-card',
}: Props) {
  const [open, setOpen] = useState(false);
  const standing = competitiveStanding(state, standard?.sex);
  const cohort = strengthReferenceCohort(standard);
  const preciseTier = state && state.earnedTierIndex >= 0 ? state.tiers[state.earnedTierIndex] : null;
  const firstTier = state?.tiers[0] ?? null;
  const hasComparisonContext = !!cohort && currentKg != null && !!state;

  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="How this compares"
      disabled={!hasComparisonContext}
      onPress={() => setOpen(true)}
      style={({ pressed }) => [styles.card, compact && styles.cardCompact, { borderColor: `${accent}58` }, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={[styles.icon, { backgroundColor: `${accent}18` }]}><Ionicons name="people-outline" size={compact ? 17 : 20} color={accent} /></View>
      <View style={styles.copy}>
        <Text style={styles.label}>COMPETITIVE STANDING</Text>
        <Text style={[styles.summary, compact && styles.summaryCompact]}>{competitiveStandingSummary(state, standard?.sex)}</Text>
        {hasComparisonContext ? <Text style={[styles.action, { color: accent }]}>How this compares</Text> : null}
      </View>
      {hasComparisonContext ? <Ionicons name="chevron-forward" size={17} color={accent} /> : null}
    </Pressable>

    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()} testID={`${testID}-detail`}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <View style={styles.sheetHeader}><View style={[styles.detailIcon, { backgroundColor: `${accent}1F` }]}><Ionicons name="people-outline" size={22} color={accent} /></View><View style={styles.headerCopy}><Text style={styles.kicker}>YOUR COMPETITIVE STANDING</Text><Text style={styles.title}>{standing ? `Stronger than about ${standing.roundedPercentile}%` : hasComparisonContext ? 'Below the first reference point' : 'Standing unavailable'}</Text></View><Pressable accessibilityLabel="Close comparison detail" onPress={() => setOpen(false)} style={styles.close}><Ionicons name="close" size={20} color="#E7E2EC" /></Pressable></View>
            {cohort && currentKg != null && state ? <>
              <Text style={styles.explanation}>Your {formatWeightFromKg(currentKg, unit)} {metricLabel} is compared with recorded {metric === 'total' ? 'Full Power Total' : metricLabel} results from the governed OpenPowerlifting reference group used by Strength Ledger.</Text>
              <DetailRow label="Reference group" value={cohort.referenceGroupLabel} />
              <DetailRow label="Your result" value={`${formatWeightFromKg(currentKg, 'lb')} / ${formatWeightFromKg(currentKg, 'kg')}`} />
              <DetailRow label="Standing" value={standing ? `Approximately ${standing.roundedPercentile}th percentile` : firstTier ? `Below the first governed reference point (${firstTier.actual_percentile.toFixed(2)} percentile at ${formatWeightFromKg(firstTier.threshold_kg, unit)})` : 'Below the first governed reference point'} />
              <View style={[styles.plainEnglish, { borderColor: `${accent}58` }]}><Text style={styles.plainEnglishText}>{standing ? `About ${standing.roundedPercentile} out of every 100 competitors in this reference group recorded a lower ${metricLabel} result.` : `Strength Ledger does not invent a percentile below its first governed reference point. Your ${metricLabel} remains a valid recorded result.`}</Text></View>
              <Text style={styles.sectionLabel}>REFERENCE METHOD</Text>
              <DetailRow label="Source" value={`${cohort.sourceName} · dataset ${cohort.datasetDate} · revision ${cohort.datasetRevision}`} />
              <DetailRow label="Sample" value={cohort.sampleSize > 0 ? `${cohort.sampleSize.toLocaleString('en-US')} ${standard?.sex === 'F' ? 'female' : 'male'} lifters${cohort.eligibleMeetPerformances > 0 ? ` · ${cohort.eligibleMeetPerformances.toLocaleString('en-US')} eligible meet performances` : ''}` : `${standard?.sex === 'F' ? 'female' : 'male'} lifters`} />
              <DetailRow label="Selection" value={cohort.selectionRule} />
              <DetailRow label="Eligibility" value={cohort.eligibilityRule} />
              <DetailRow label="Eligible dates" value={cohort.dateRange} />
              <DetailRow label="Exact filters" value={cohort.exclusions} />
              <DetailRow label="Governed cohort rules" value={`equipment=${cohort.equipment}; event=${cohort.eventLabel}; age=${cohort.ageFilter}; tested=${cohort.testedFilter}; federation=${cohort.federationFilter}; country=${cohort.countryFilter}; sanctioned=${cohort.sanctionedRule}; validity=${cohort.validityRule}; identity=${cohort.identityRule}`} />
              <DetailRow label="Precise threshold standing" value={preciseTier ? `${preciseTier.actual_percentile.toFixed(2)} percentile at ${preciseTier.threshold_kg} KG · ${state?.standardVersion}` : 'Below the first governed threshold'} />
            </> : <Text style={styles.explanation}>A supported sex-specific standard and canonical competition-lift evidence are required. Strength Ledger will not infer either.</Text>}
            <Pressable onPress={() => setOpen(false)} style={[styles.done, { backgroundColor: accent }]}><Text style={styles.doneText}>Done</Text></Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  </>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 16, borderWidth: 1, backgroundColor: '#090D13' },
  cardCompact: { minHeight: 76, padding: 11 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { color: '#9DA6B1', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.65 },
  summary: { color: '#F0EDF4', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  summaryCompact: { fontSize: 12, lineHeight: 16 },
  action: { marginTop: 2, fontSize: 11, lineHeight: 15, fontWeight: '800' },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.78)' },
  sheet: { maxHeight: '88%', overflow: 'hidden', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderBottomWidth: 0, borderColor: '#343C49', backgroundColor: '#080A0F' },
  sheetContent: { gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  detailIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { color: '#AEB6C1', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.7 },
  title: { color: '#F5F1F7', fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.35 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#343B46', backgroundColor: '#11141A' },
  explanation: { color: '#C8C3CC', fontSize: 14, lineHeight: 21 },
  row: { gap: 4, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#303742' },
  rowLabel: { color: '#8E98A5', fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 0.55, textTransform: 'uppercase' },
  rowValue: { color: '#E7E3EA', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  plainEnglish: { padding: 14, borderRadius: 15, borderWidth: 1, backgroundColor: '#11101A' },
  plainEnglishText: { color: '#F2EDF5', fontSize: 16, lineHeight: 23, fontWeight: '800' },
  sectionLabel: { marginTop: 4, color: '#B985F5', fontSize: 11, lineHeight: 14, fontWeight: '900', letterSpacing: 0.7 },
  done: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 4, borderRadius: 14 },
  doneText: { color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '900' },
});
