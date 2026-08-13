import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { accessoryMuscleRegion, type AccessoryMuscleRegionKey } from '@/lib/accessory-muscle-group';
import { accessoryMuscleRegionAsset } from '@/lib/accessory-muscle-region-assets';
import { displayWeight } from '@/lib/ledger-data';
import { movementEvidence, recordNumber, type LedgerMovementEvidence, type LedgerV2Scope, unitFor } from './types';
import { useLedgerV2Snapshot } from './data';
import { useLedgerV2Navigation } from './navigation';
import { LEDGER_V2_COLORS, LedgerBadge, LedgerContextBar, LedgerSection, LedgerV2Header, LedgerV2PageState, performanceLabel } from './ui';

type MuscleRecord = { key: AccessoryMuscleRegionKey; label: string; movements: LedgerMovementEvidence[]; sets: number; volumeKg: number };

function muscleRecords(snapshot: NonNullable<ReturnType<typeof useLedgerV2Snapshot>['snapshot']>): MuscleRecord[] {
  const grouped = new Map<AccessoryMuscleRegionKey, MuscleRecord>();
  movementEvidence(snapshot).filter((item) => item.classification === 'accessory').forEach((movement) => {
    const region = accessoryMuscleRegion({ movement: movement.name, movement_identity: { family: movement.family } });
    const existing = grouped.get(region.key) || { key: region.key, label: region.label, movements: [], sets: 0, volumeKg: 0 };
    existing.movements.push(movement);
    existing.sets += movement.performedSets;
    existing.volumeKg += movement.totalVolumeKg;
    grouped.set(region.key, existing);
  });
  return [...grouped.values()].sort((left, right) => right.volumeKg - left.volumeKg);
}

export function LedgerMusclesV2Screen() {
  const [scope, setScope] = useState<LedgerV2Scope>('all');
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot(scope);
  const { back, push } = useLedgerV2Navigation();
  const records = useMemo(() => snapshot ? muscleRecords(snapshot) : [], [snapshot]);
  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening Muscle Groups" body="Classifying accessory evidence through governed movement identity." />;
  if (!snapshot) return <LedgerV2PageState title="Muscle groups are unavailable" body={error || 'No canonical accessory evidence was returned.'} onRetry={() => void reload()} />;
  const unit = unitFor(snapshot);
  const maxVolume = Math.max(1, ...records.map((item) => item.volumeKg));
  return <View testID="ledger-v2-muscles" style={styles.page}>
    <LedgerV2Header back onBack={back} title="Muscle Groups" subtitle="Observed accessory volume grouped by governed taxonomy." />
    <LedgerContextBar value={scope} onChange={setScope} />
    <LedgerSection eyebrow="Performed accessory evidence" title="Volume balance" />
    <View style={styles.grid}>{records.map((record) => <Pressable key={record.key} onPress={() => push(`/(tabs)/ledger/muscles/${record.key}`)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.artWrap}><Image source={accessoryMuscleRegionAsset(record.key).source} resizeMode="contain" style={styles.art} /></View><View style={styles.cardCopy}><View style={styles.cardTitleRow}><Text style={styles.cardTitle}>{record.label}</Text><Ionicons name="chevron-forward" size={15} color={LEDGER_V2_COLORS.subtle} /></View><Text style={styles.cardMetric}>{displayWeight(record.volumeKg, unit)} {unit.toUpperCase()}</Text><Text style={styles.cardMeta}>{record.sets} {record.sets === 1 ? 'set' : 'sets'} · {record.movements.length} {record.movements.length === 1 ? 'movement' : 'movements'}</Text><View style={styles.track}><View style={[styles.fill, { width: `${Math.max(5, (record.volumeKg / maxVolume) * 100)}%` }]} /></View></View></Pressable>)}</View>
    {!records.length ? <LedgerV2PageState title="No muscle-group record yet" body="Performed accessory sets will appear here after canonical movement identity is recorded." /> : null}
    <View style={styles.taxonomyNote}><Ionicons name="shield-checkmark-outline" size={18} color={LEDGER_V2_COLORS.cyan} /><Text style={styles.taxonomyText}>Movement family is authoritative. Legacy name matching is used only where an older SetLog has no governed family.</Text></View>
  </View>;
}

export function LedgerMuscleDetailV2Screen({ muscleKey }: { muscleKey: string }) {
  const [scope, setScope] = useState<LedgerV2Scope>('all');
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot(scope);
  const { back, push } = useLedgerV2Navigation();
  const records = useMemo(() => snapshot ? muscleRecords(snapshot) : [], [snapshot]);
  const record = records.find((item) => item.key === muscleKey);
  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening muscle record" body="Gathering performed accessory evidence." />;
  if (!snapshot) return <LedgerV2PageState title="Muscle evidence is unavailable" body={error || 'No accessory evidence was returned.'} onRetry={() => void reload()} />;
  if (!record) return <LedgerV2PageState title="Muscle record not found" body="This region has no qualifying evidence in the selected period." />;
  const unit = unitFor(snapshot);
  const sets = record.movements.flatMap((movement) => movement.sets).sort((left, right) => String(right.occurred_at || right.occurred_on).localeCompare(String(left.occurred_at || left.occurred_on)));
  return <View testID="ledger-v2-muscle-detail" style={styles.page}>
    <LedgerV2Header back onBack={back} title={record.label} subtitle="Observed volume, movements, and source sets." />
    <LedgerContextBar value={scope} onChange={setScope} />
    <View style={styles.hero}><Image source={accessoryMuscleRegionAsset(record.key).source} resizeMode="contain" style={styles.heroArt} /><View style={styles.heroCopy}><LedgerBadge label="Observed evidence" tone={LEDGER_V2_COLORS.cyan} /><Text style={styles.heroValue}>{displayWeight(record.volumeKg, unit)} {unit.toUpperCase()}</Text><Text style={styles.heroLabel}>performed volume in the loaded window</Text><View style={styles.heroStats}><Text style={styles.heroStat}>{record.sets} sets</Text><Text style={styles.heroStat}>{record.movements.length} movements</Text></View></View></View>
    <LedgerSection eyebrow="Movement contribution" title="Top exercises" />
    <View style={styles.movements}>{record.movements.map((movement) => <Pressable key={movement.id} onPress={() => push(`/(tabs)/ledger/accessories/${movement.id}`)} style={({ pressed }) => [styles.movementRow, pressed && styles.pressed]}><View style={styles.movementCopy}><Text style={styles.movementTitle}>{movement.name}</Text><Text style={styles.movementMeta}>{movement.performedSets} sets · {displayWeight(movement.totalVolumeKg, unit)} {unit.toUpperCase()}</Text></View><Ionicons name="chevron-forward" size={16} color={LEDGER_V2_COLORS.subtle} /></Pressable>)}</View>
    <LedgerSection eyebrow="Bounded source evidence" title="Recent performed sets" />
    <View style={styles.movements}>{sets.slice(0, 12).map((item) => <Pressable key={item.source_id} onPress={() => push(`/(tabs)/ledger/archive/set/${item.source_id}`)} style={({ pressed }) => [styles.movementRow, pressed && styles.pressed]}><View style={styles.movementCopy}><Text style={styles.movementTitle}>{item.title}</Text><Text style={styles.movementMeta}>{performanceLabel(item, unit)} · {recordNumber(item.performance, 'set_index') ? `Set ${recordNumber(item.performance, 'set_index')}` : 'performed set'}</Text></View><Ionicons name="document-text-outline" size={16} color={LEDGER_V2_COLORS.cyan} /></Pressable>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 0, paddingBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12 },
  card: { width: '48.8%', minHeight: 202, overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object },
  artWrap: { height: 112, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, backgroundColor: '#080A10' },
  art: { width: 104, height: 104 },
  cardCopy: { flex: 1, padding: 11 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: LEDGER_V2_COLORS.text, fontSize: 13, fontWeight: '700' },
  cardMetric: { marginTop: 6, color: LEDGER_V2_COLORS.cyan, fontSize: 14, fontWeight: '700' },
  cardMeta: { marginTop: 2, color: LEDGER_V2_COLORS.muted, fontSize: 8.5 },
  track: { height: 4, overflow: 'hidden', marginTop: 8, borderRadius: 2, backgroundColor: '#1A2228' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: LEDGER_V2_COLORS.cyan },
  taxonomyNote: { flexDirection: 'row', gap: 9, margin: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#24343A', backgroundColor: '#061015' },
  taxonomyText: { flex: 1, color: LEDGER_V2_COLORS.muted, fontSize: 9.5, lineHeight: 14 },
  hero: { minHeight: 230, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#26343A', backgroundColor: '#060A0D', paddingHorizontal: 14 },
  heroArt: { width: '44%', height: 200 },
  heroCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  heroValue: { marginTop: 12, color: LEDGER_V2_COLORS.text, fontSize: 25, fontWeight: '700' },
  heroLabel: { marginTop: 3, color: LEDGER_V2_COLORS.muted, fontSize: 9.5, lineHeight: 13 },
  heroStats: { flexDirection: 'row', gap: 12, marginTop: 15 },
  heroStat: { color: LEDGER_V2_COLORS.cyan, fontSize: 10, fontWeight: '700' },
  movements: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  movementRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object },
  movementCopy: { flex: 1, minWidth: 0, gap: 3 },
  movementTitle: { color: LEDGER_V2_COLORS.text, fontSize: 13, fontWeight: '700' },
  movementMeta: { color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.987 }] },
});
