import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { bestForLift, displayWeight } from '@/lib/ledger-data';
import { blockChapters, movementEvidence, unitFor } from './types';
import { useLedgerV2Snapshot } from './data';
import { useLedgerV2Navigation } from './navigation';
import {
  LEDGER_V2_COLORS,
  LedgerBadge,
  LedgerChapterRow,
  LedgerMetric,
  LedgerSection,
  LedgerV2Header,
  LedgerV2PageState,
  accomplishmentLabel,
  accomplishmentTone,
  dateLabel,
} from './ui';

const CHAPTERS = [
  ['01', 'Journey', 'map-outline', LEDGER_V2_COLORS.violet, '/(tabs)/ledger/journey'],
  ['02', 'Strength', 'barbell-outline', LEDGER_V2_COLORS.cyan, '/(tabs)/ledger/strength'],
  ['03', 'Achievements', 'star-outline', LEDGER_V2_COLORS.gold, '/(tabs)/ledger/achievements'],
  ['04', 'Accessories', 'body-outline', LEDGER_V2_COLORS.green, '/(tabs)/ledger/accessories'],
  ['05', 'Variants', 'git-branch-outline', LEDGER_V2_COLORS.magenta, '/(tabs)/ledger/variants'],
  ['06', 'Archive', 'archive-outline', LEDGER_V2_COLORS.red, '/(tabs)/ledger/archive'],
] as const;

export function LedgerV2IndexScreen() {
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot('all');
  const { push } = useLedgerV2Navigation();
  const model = useMemo(() => {
    if (!snapshot) return null;
    const unit = unitFor(snapshot);
    const movements = movementEvidence(snapshot);
    const variants = movements.filter((item) => item.classification === 'variant');
    const accessories = movements.filter((item) => item.classification === 'accessory');
    const blocks = blockChapters(snapshot);
    const sessions = snapshot.progression.consistency?.sessions_completed ?? snapshot.landing.collection_summaries.training ?? 0;
    const trainingAge = snapshot.progression.consistency?.training_age_years ?? null;
    const liftValues = ['squat', 'bench', 'deadlift'].map((key) => {
      const weight = bestForLift(snapshot.currentBests, key, 'weight');
      const estimate = bestForLift(snapshot.currentBests, key, 'e1rm');
      return { key, best: weight || estimate, metric: weight ? 'Weight PR' : estimate ? 'e1RM' : 'No record' };
    });
    return { unit, movements, variants, accessories, blocks, sessions, trainingAge, liftValues, latest: snapshot.accomplishments[0] || null };
  }, [snapshot]);

  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening The Ledger" body="Gathering your canonical training record." />;
  if (error || !snapshot || !model) return <LedgerV2PageState title="The Ledger is unavailable" body={error || 'No canonical evidence was returned.'} onRetry={() => void reload()} />;

  const latest = model.latest;
  const latestTone = latest ? accomplishmentTone(latest) : LEDGER_V2_COLORS.violet;
  const latestPerformance = latest
    ? latest.unit === 'reps'
      ? `${latest.current_value ?? '—'} reps`
      : `${displayWeight(latest.current_value, model.unit)} ${model.unit.toUpperCase()}`
    : null;
  const currentBlock = model.blocks[0];
  const bodyweight = snapshot.progression.bodyweight?.current_kg;
  const chapterDetail = (title: string) => {
    if (title === 'Journey') return `${model.blocks.length} recent block chapter${model.blocks.length === 1 ? '' : 's'} · ${model.sessions} Sessions recorded`;
    if (title === 'Strength') return model.liftValues.map((lift) => `${lift.key[0].toUpperCase()} ${lift.best ? displayWeight(lift.best.best_value, model.unit) : '—'}`).join(' · ');
    if (title === 'Achievements') return `${snapshot.accomplishments.length} recent canonical accomplishment${snapshot.accomplishments.length === 1 ? '' : 's'}`;
    if (title === 'Accessories') return `${model.accessories.length} canonical movement${model.accessories.length === 1 ? '' : 's'} in the loaded evidence window`;
    if (title === 'Variants') return `${model.variants.length} independent core variant${model.variants.length === 1 ? '' : 's'} in the loaded evidence window`;
    return `${snapshot.landing.collection_summaries.training} training records · ${snapshot.landing.collection_summaries.media} media records`;
  };

  return <View testID="ledger-v2-index" style={styles.page}>
    <LedgerV2Header title="The Ledger" subtitle="Your training, written in results." />

    <View style={styles.careerSnapshot}>
      <Text style={styles.careerEyebrow}>CAREER SNAPSHOT</Text>
      <Text style={styles.careerNumber}>{model.sessions}</Text><Text style={styles.careerLabel}>SESSIONS RECORDED</Text>
      <View style={styles.careerMetrics}>
        <LedgerMetric value={String(snapshot.currentBests.length)} label="canonical current records" tone={LEDGER_V2_COLORS.cyan} />
        <View style={styles.metricDivider} />
        <LedgerMetric value={String(snapshot.accomplishments.length)} label="recent PR entries" tone={LEDGER_V2_COLORS.magenta} />
        <View style={styles.metricDivider} />
        <LedgerMetric value={model.trainingAge == null ? '—' : String(model.trainingAge)} label="years represented" tone={LEDGER_V2_COLORS.gold} />
      </View>
    </View>

    <LedgerSection eyebrow="Current canonical records" title="Core lifts" action="Open Strength" onAction={() => push('/(tabs)/ledger/strength')} />
    <View style={styles.liftRail}>{model.liftValues.map((lift) => {
      const tone = lift.key === 'squat' ? '#AA84F5' : lift.key === 'bench' ? '#CE6BE2' : '#D47A7E';
      return <Pressable key={lift.key} onPress={() => push(`/(tabs)/ledger/strength/${lift.key}`)} style={({ pressed }) => [styles.liftCard, pressed && styles.pressed]}>
        <Text style={styles.liftName}>{lift.key.toUpperCase()}</Text><Text numberOfLines={1} style={[styles.liftValue, { color: tone }]}>{lift.best ? displayWeight(lift.best.best_value, model.unit) : '—'}</Text><Text style={styles.liftUnit}>{lift.best ? model.unit.toUpperCase() : ''}</Text><Text style={styles.liftMetric}>{lift.metric}</Text>
      </Pressable>;
    })}</View>

    <LedgerSection eyebrow="Recently written" title="Latest entry" />
    <Pressable disabled={!latest?.source_set_log_id} onPress={() => latest?.source_set_log_id && push(`/(tabs)/ledger/archive/set/${latest.source_set_log_id}`)} style={({ pressed }) => [styles.latest, pressed && styles.pressed]}>
      <View style={[styles.latestSeal, { borderColor: `${latestTone}75`, backgroundColor: `${latestTone}16` }]}><Text style={[styles.latestSealText, { color: latestTone }]}>PR</Text></View>
      <View style={styles.latestCopy}>{latest ? <><LedgerBadge label={accomplishmentLabel(latest)} tone={latestTone} /><Text style={styles.latestTitle}>{latest.movement_label || 'Canonical accomplishment'}</Text><Text style={styles.latestMeta}>{latestPerformance} · {dateLabel(latest.occurred_at || latest.workout_date)}</Text></> : <><Text style={styles.latestTitle}>Your record starts here.</Text><Text style={styles.latestMeta}>Qualifying evidence will be written here after a completed Session.</Text></>}</View>
      <Ionicons name="chevron-forward" size={18} color={LEDGER_V2_COLORS.subtle} />
    </Pressable>

    <LedgerSection eyebrow="At a glance" title="Context matters" />
    <View style={styles.contextGrid}>
      <View style={styles.contextCard}><View style={styles.contextIcon}><Ionicons name="layers-outline" size={18} color={LEDGER_V2_COLORS.violet} /></View><Text style={styles.contextCardLabel}>CURRENT BLOCK</Text><Text style={styles.contextCardValue}>{currentBlock?.name || 'No active block evidence'}</Text><Text style={styles.contextCardMeta}>{currentBlock?.programName || 'Program context unavailable'}{currentBlock ? ` · ${currentBlock.sessions.length} recent Sessions` : ''}</Text></View>
      <View style={styles.contextCard}><View style={[styles.contextIcon, { backgroundColor: `${LEDGER_V2_COLORS.cyan}14` }]}><Ionicons name="scale-outline" size={18} color={LEDGER_V2_COLORS.cyan} /></View><Text style={styles.contextCardLabel}>BODYWEIGHT CONTEXT</Text><Text style={styles.contextCardValue}>{bodyweight == null ? 'Not recorded' : `${displayWeight(bodyweight, model.unit)} ${model.unit.toUpperCase()}`}</Text><Text style={styles.contextCardMeta}>Most recent authoritative value</Text></View>
    </View>

    <LedgerSection eyebrow="Your complete record" title="Ledger index" />
    <View style={styles.chapterIndex}>{CHAPTERS.map(([number, title, icon, tone, route]) => <LedgerChapterRow key={title} number={number} title={title} detail={chapterDetail(title)} icon={icon} tone={tone} onPress={() => push(route)} />)}</View>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 0, paddingBottom: 24 },
  careerSnapshot: { minHeight: 228, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#30273A', backgroundColor: '#08060B', paddingHorizontal: 18, paddingVertical: 18 },
  careerEyebrow: { color: LEDGER_V2_COLORS.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  careerNumber: { color: LEDGER_V2_COLORS.text, fontSize: 64, lineHeight: 69, fontWeight: '700', letterSpacing: -2.5, fontVariant: ['tabular-nums'] },
  careerLabel: { color: LEDGER_V2_COLORS.violet, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  careerMetrics: { width: '100%', flexDirection: 'row', alignItems: 'stretch', marginTop: 19, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#332A3B' },
  metricDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 10, backgroundColor: '#332D3A' },
  liftRail: { flexDirection: 'row', gap: 7, paddingHorizontal: 12 },
  liftCard: { flex: 1, minWidth: 0, minHeight: 126, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object, paddingHorizontal: 6 },
  liftName: { color: LEDGER_V2_COLORS.muted, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.8 },
  liftValue: { marginTop: 7, fontSize: 28, lineHeight: 31, fontWeight: '700', fontVariant: ['tabular-nums'] },
  liftUnit: { minHeight: 12, color: LEDGER_V2_COLORS.subtle, fontSize: 8, fontWeight: '700' },
  liftMetric: { marginTop: 6, color: LEDGER_V2_COLORS.muted, fontSize: 8.5 },
  latest: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#33283D', backgroundColor: LEDGER_V2_COLORS.object, padding: 13 },
  latestSeal: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, borderWidth: 1 },
  latestSealText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.8 },
  latestCopy: { flex: 1, minWidth: 0, gap: 4 },
  latestTitle: { color: LEDGER_V2_COLORS.text, fontSize: 15.5, lineHeight: 19, fontWeight: '700' },
  latestMeta: { color: LEDGER_V2_COLORS.muted, fontSize: 10, lineHeight: 14 },
  contextGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  contextCard: { flex: 1, minHeight: 132, borderRadius: 13, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object, padding: 12 },
  contextIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: `${LEDGER_V2_COLORS.violet}14` },
  contextCardLabel: { marginTop: 10, color: LEDGER_V2_COLORS.subtle, fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  contextCardValue: { marginTop: 4, color: LEDGER_V2_COLORS.text, fontSize: 13.5, lineHeight: 17, fontWeight: '700' },
  contextCardMeta: { marginTop: 3, color: LEDGER_V2_COLORS.muted, fontSize: 9, lineHeight: 13 },
  chapterIndex: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  pressed: { opacity: 0.72, transform: [{ scale: 0.986 }] },
});
