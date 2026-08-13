import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { displayWeight } from '@/lib/ledger-data';
import {
  movementEvidence,
  recordNumber,
  recordString,
  type LedgerMovementEvidence,
  type LedgerV2Scope,
  unitFor,
} from './types';
import { useLedgerV2Snapshot } from './data';
import { useLedgerV2Navigation } from './navigation';
import {
  LEDGER_V2_COLORS,
  LedgerBadge,
  LedgerContextBar,
  LedgerSection,
  LedgerSparkline,
  LedgerV2Header,
  LedgerV2PageState,
  dateLabel,
  performanceLabel,
} from './ui';

type CatalogKind = 'accessory' | 'variant';

const CATALOG = {
  accessory: {
    title: 'Accessories',
    subtitle: 'Independent exercise records, volume, and source evidence.',
    eyebrow: 'Performed accessory evidence',
    empty: 'No accessory evidence exists in this period.',
    tone: LEDGER_V2_COLORS.green,
    icon: 'layers-outline' as const,
  },
  variant: {
    title: 'Variants',
    subtitle: 'Alternate core-lift identities with independent histories.',
    eyebrow: 'Governed movement identities',
    empty: 'No core-lift variant evidence exists in this period.',
    tone: LEDGER_V2_COLORS.magenta,
    icon: 'git-branch-outline' as const,
  },
} as const;

export function LedgerCatalogV2Screen({ kind }: { kind: CatalogKind }) {
  const [scope, setScope] = useState<LedgerV2Scope>('all');
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot(scope);
  const { back, push } = useLedgerV2Navigation();
  const presentation = CATALOG[kind];
  const records = useMemo(
    () => snapshot ? movementEvidence(snapshot).filter((item) => item.classification === kind) : [],
    [kind, snapshot],
  );

  if (loading && !snapshot) return <LedgerV2PageState loading title={`Opening ${presentation.title}`} body="Gathering performed movement evidence." />;
  if (!snapshot) return <LedgerV2PageState title={`${presentation.title} are unavailable`} body={error || 'No canonical movement evidence was returned.'} onRetry={() => void reload()} />;
  const unit = unitFor(snapshot);
  const route = kind === 'accessory' ? 'accessories' : 'variants';

  return <View testID={`ledger-v2-${route}`} style={styles.page}>
    <LedgerV2Header back onBack={back} title={presentation.title} subtitle={presentation.subtitle} />
    <LedgerContextBar value={scope} onChange={setScope} />
    <View style={[styles.summary, { borderColor: `${presentation.tone}45` }]}>
      <View style={[styles.summaryIcon, { backgroundColor: `${presentation.tone}14` }]}><Ionicons name={presentation.icon} size={26} color={presentation.tone} /></View>
      <View style={styles.summaryCopy}><Text style={styles.summaryValue}>{records.length}</Text><Text style={styles.summaryLabel}>movement histories represented in the bounded evidence window</Text></View>
      <View style={styles.summaryRule} />
      <View style={styles.summaryMetric}><Text style={[styles.summaryMetricValue, { color: presentation.tone }]}>{records.reduce((sum, item) => sum + item.performedSets, 0)}</Text><Text style={styles.summaryMetricLabel}>SETS</Text></View>
    </View>
    <LedgerSection eyebrow={presentation.eyebrow} title={kind === 'accessory' ? 'Exercise record' : 'Variant record'} />
    <View style={styles.list}>{records.map((record) => <MovementRow key={record.id} record={record} unit={unit} tone={presentation.tone} onPress={() => push(`/(tabs)/ledger/${route}/${record.id}`)} />)}</View>
    {!records.length ? <LedgerV2PageState title={`No ${presentation.title.toLowerCase()} yet`} body={presentation.empty} /> : null}
    <View style={styles.scopeNote}><Ionicons name="information-circle-outline" size={18} color={LEDGER_V2_COLORS.cyan} /><Text style={styles.scopeNoteText}>Counts and volume describe the evidence loaded for the selected period. Open Archive for complete, paginated source history.</Text></View>
  </View>;
}

export function LedgerCatalogDetailV2Screen({ kind, movementId }: { kind: CatalogKind; movementId: string }) {
  const [scope, setScope] = useState<LedgerV2Scope>('all');
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot(scope);
  const { back, push } = useLedgerV2Navigation();
  const presentation = CATALOG[kind];
  const record = useMemo(() => snapshot
    ? movementEvidence(snapshot).find((item) => item.id === Number(movementId) && item.classification === kind) || null
    : null, [kind, movementId, snapshot]);

  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening movement record" body="Gathering exact performed sets." />;
  if (!snapshot) return <LedgerV2PageState title="Movement evidence is unavailable" body={error || 'No canonical movement evidence was returned.'} onRetry={() => void reload()} />;
  if (!record) return <LedgerV2PageState title="Movement record not found" body="This identity has no qualifying evidence in the selected period." />;
  const unit = unitFor(snapshot);
  const weights = [...record.sets]
    .sort((left, right) => String(left.occurred_at || left.occurred_on || '').localeCompare(String(right.occurred_at || right.occurred_on || '')))
    .map((item) => recordNumber(item.performance, 'weight_kg'))
    .filter((value): value is number => value !== null);
  const manufacturer = recordString(record.latest.equipment, 'manufacturer');
  const implementation = recordString(record.latest.equipment, 'implementation');

  return <View testID="ledger-v2-catalog-detail" style={styles.page}>
    <LedgerV2Header back onBack={back} title={record.name} subtitle={`${kind === 'accessory' ? 'Accessory' : 'Variant'} record · ${record.family.replaceAll('_', ' ')}`} />
    <LedgerContextBar value={scope} onChange={setScope} />
    <View style={[styles.detailHero, { borderColor: `${presentation.tone}55` }]}>
      <LedgerBadge label={kind === 'variant' ? 'Independent variant history' : 'Accessory evidence'} tone={presentation.tone} />
      <Text style={styles.detailLabel}>BEST PERFORMED SET</Text>
      <Text style={styles.detailValue}>{performanceLabel(record.best, unit)}</Text>
      <Text style={styles.detailDate}>{dateLabel(record.best.occurred_at || record.best.occurred_on)}</Text>
      <View style={styles.detailMetrics}><DetailMetric value={String(record.performedSets)} label="sets loaded" /><DetailMetric value={`${displayWeight(record.totalVolumeKg, unit)} ${unit.toUpperCase()}`} label="loaded volume" tone={presentation.tone} /></View>
    </View>
    <LedgerSection eyebrow="Performed weight by date" title="Progression" />
    <View style={styles.chart}><LedgerSparkline values={weights} tone={presentation.tone} height={106} /></View>
    {manufacturer || implementation ? <><LedgerSection eyebrow="Recorded source context" title="Equipment" /><View style={styles.equipment}><Ionicons name="hardware-chip-outline" size={22} color={LEDGER_V2_COLORS.cyan} /><View style={styles.equipmentCopy}><Text style={styles.equipmentTitle}>{manufacturer || 'Equipment snapshot'}</Text><Text style={styles.equipmentBody}>{implementation || 'Configuration recorded with the source SetLog.'}</Text></View><LedgerBadge label="Snapshot" tone={LEDGER_V2_COLORS.cyan} /></View></> : null}
    <LedgerSection eyebrow="Bounded source history" title="Performed sets" />
    <View style={styles.sets}>{record.sets.map((item) => <Pressable key={item.source_id} onPress={() => push(`/(tabs)/ledger/archive/set/${item.source_id}`)} style={({ pressed }) => [styles.setRow, pressed && styles.pressed]}><View style={styles.setCopy}><Text style={styles.setTitle}>{performanceLabel(item, unit)}</Text><Text style={styles.setMeta}>{dateLabel(item.occurred_at || item.occurred_on)} · {recordString(item.program_context, 'block_name') || 'No block context'}</Text></View><Ionicons name="chevron-forward" size={16} color={LEDGER_V2_COLORS.subtle} /></Pressable>)}</View>
  </View>;
}

function MovementRow({ record, unit, tone, onPress }: { record: LedgerMovementEvidence; unit: 'kg' | 'lb'; tone: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={[styles.rowIcon, { borderColor: `${tone}55`, backgroundColor: `${tone}12` }]}><Text style={[styles.rowIconText, { color: tone }]}>{record.name.slice(0, 2).toUpperCase()}</Text></View>
    <View style={styles.rowCopy}><Text style={styles.rowTitle}>{record.name}</Text><Text style={styles.rowMeta}>{performanceLabel(record.best, unit)} · {record.performedSets} sets</Text><Text style={styles.rowDate}>Latest {dateLabel(record.latest.occurred_at || record.latest.occurred_on)}</Text></View>
    <Ionicons name="chevron-forward" size={17} color={LEDGER_V2_COLORS.subtle} />
  </Pressable>;
}

function DetailMetric({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return <View style={styles.detailMetric}><Text style={[styles.detailMetricValue, tone ? { color: tone } : null]}>{value}</Text><Text style={styles.detailMetricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  page: { gap: 0, paddingBottom: 24 },
  summary: { minHeight: 110, flexDirection: 'row', alignItems: 'center', gap: 13, borderTopWidth: 1, borderBottomWidth: 1, backgroundColor: '#07090C', paddingHorizontal: 16 },
  summaryIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryValue: { color: LEDGER_V2_COLORS.text, fontSize: 27, fontWeight: '700' },
  summaryLabel: { color: LEDGER_V2_COLORS.muted, fontSize: 9.5, lineHeight: 13 },
  summaryRule: { width: 1, height: 46, backgroundColor: LEDGER_V2_COLORS.line },
  summaryMetric: { alignItems: 'center' },
  summaryMetricValue: { fontSize: 20, fontWeight: '800' },
  summaryMetricLabel: { marginTop: 2, color: LEDGER_V2_COLORS.subtle, fontSize: 7.5, fontWeight: '800' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object },
  rowIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1 },
  rowIconText: { fontSize: 10, fontWeight: '800' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: LEDGER_V2_COLORS.text, fontSize: 14, fontWeight: '700' },
  rowMeta: { color: LEDGER_V2_COLORS.muted, fontSize: 10 },
  rowDate: { color: LEDGER_V2_COLORS.subtle, fontSize: 8.5 },
  scopeNote: { flexDirection: 'row', gap: 9, margin: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#24333A', backgroundColor: '#061015' },
  scopeNoteText: { flex: 1, color: LEDGER_V2_COLORS.muted, fontSize: 9.5, lineHeight: 14 },
  detailHero: { minHeight: 238, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, backgroundColor: '#09080D', padding: 18 },
  detailLabel: { marginTop: 14, color: LEDGER_V2_COLORS.subtle, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
  detailValue: { marginTop: 4, color: LEDGER_V2_COLORS.text, fontSize: 29, lineHeight: 35, fontWeight: '700', textAlign: 'center' },
  detailDate: { marginTop: 3, color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
  detailMetrics: { width: '100%', flexDirection: 'row', marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  detailMetric: { flex: 1, alignItems: 'center', gap: 2 },
  detailMetricValue: { color: LEDGER_V2_COLORS.text, fontSize: 17, fontWeight: '700' },
  detailMetricLabel: { color: LEDGER_V2_COLORS.subtle, fontSize: 8.5 },
  chart: { marginHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object, padding: 14 },
  equipment: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#26343D', backgroundColor: '#071014', padding: 13 },
  equipmentCopy: { flex: 1, minWidth: 0 },
  equipmentTitle: { color: LEDGER_V2_COLORS.text, fontSize: 13, fontWeight: '700' },
  equipmentBody: { marginTop: 2, color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
  sets: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  setRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  setCopy: { flex: 1, minWidth: 0, gap: 3 },
  setTitle: { color: LEDGER_V2_COLORS.text, fontSize: 12.5, fontWeight: '700' },
  setMeta: { color: LEDGER_V2_COLORS.muted, fontSize: 9 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.987 }] },
});
