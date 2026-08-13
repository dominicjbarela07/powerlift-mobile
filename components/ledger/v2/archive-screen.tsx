import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { ArchiveFoundationExperience } from '@/components/ledger/archive-foundation';
import { ArchiveDetailExperience } from '@/components/ledger/archive-detail';
import { recordNumber, recordString, type LedgerV2Scope, unitFor } from './types';
import { useLedgerV2Snapshot } from './data';
import { useLedgerV2Navigation } from './navigation';
import { LEDGER_V2_COLORS, LedgerBadge, LedgerContextBar, LedgerSection, LedgerV2Header, LedgerV2PageState, dateLabel, performanceLabel } from './ui';

type ArchiveTab = 'Sessions' | 'Sets' | 'Movements';

export function LedgerArchiveV2Screen() {
  const { fixtureName } = useLedgerV2Snapshot('all');
  if (!fixtureName) return <ArchiveFoundationExperience />;
  return <FixtureArchive />;
}

export function LedgerArchiveDetailV2Screen() {
  const params = useLocalSearchParams<{ ledger_fixture?: string | string[] }>();
  const raw = Array.isArray(params.ledger_fixture) ? params.ledger_fixture[0] : params.ledger_fixture;
  if (!__DEV__ || (raw !== 'mature' && raw !== 'sparse')) return <ArchiveDetailExperience />;
  return <FixtureArchiveDetail />;
}

function FixtureArchiveDetail() {
  const params = useLocalSearchParams<{ itemType?: string | string[]; sourceId?: string | string[] }>();
  const itemType = Array.isArray(params.itemType) ? params.itemType[0] : params.itemType;
  const sourceId = Number(Array.isArray(params.sourceId) ? params.sourceId[0] : params.sourceId);
  const { snapshot, loading } = useLedgerV2Snapshot('all');
  const { back } = useLedgerV2Navigation();
  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening source evidence" body="Retrieving the preserved record." />;
  const item = [...(snapshot?.evidence || []), ...(snapshot?.sessions || [])].find((candidate) => candidate.archive_item_type === itemType && candidate.source_id === sourceId);
  if (!snapshot || !item) return <LedgerV2PageState title="Evidence unavailable" body="This fixture source is outside the bounded record." />;
  const unit = unitFor(snapshot);
  const fields = [
    ['Movement identity', recordString(item.movement, 'name') || item.title],
    ['Performed evidence', item.archive_item_type === 'set' ? performanceLabel(item, unit) : `${recordNumber(item.performance, 'set_count') || 0} performed sets`],
    ['Block', recordString(item.program_context, 'block_name') || 'No block context'],
    ['Program', recordString(item.program_context, 'program_name') || 'No program context'],
    ['Provenance', item.provenance_label || 'Preserved source evidence'],
  ];
  const manufacturer = recordString(item.equipment, 'manufacturer');
  return <View testID="ledger-v2-archive-detail" style={styles.page}>
    <LedgerV2Header back onBack={back} title={item.archive_item_type === 'set' ? 'Set Detail' : 'Session Detail'} subtitle="Preserved source truth with provenance intact." />
    <View style={styles.detailMasthead}><LedgerBadge label={item.archive_item_type === 'set' ? 'Performed set' : 'Training Session'} tone={item.archive_item_type === 'set' ? LEDGER_V2_COLORS.violet : LEDGER_V2_COLORS.green} /><Text style={styles.detailTitle}>{item.title}</Text><Text style={styles.detailDate}>{dateLabel(item.occurred_at || item.occurred_on)}</Text></View>
    <LedgerSection eyebrow="Current authorized evidence" title="Source record" />
    <View style={styles.detailFields}>{fields.map(([label, value]) => <View key={label} style={styles.detailField}><Text style={styles.detailFieldLabel}>{label}</Text><Text style={styles.detailFieldValue}>{value}</Text></View>)}</View>
    {manufacturer ? <><LedgerSection eyebrow="Recorded context" title="Equipment" /><View style={styles.detailEquipment}><Ionicons name="hardware-chip-outline" size={21} color={LEDGER_V2_COLORS.cyan} /><View><Text style={styles.detailEquipmentTitle}>{manufacturer}</Text><Text style={styles.detailEquipmentBody}>{recordString(item.equipment, 'implementation') || 'Configuration snapshot'}</Text></View></View></> : null}
    <View style={styles.integrity}><Ionicons name="finger-print-outline" size={20} color={LEDGER_V2_COLORS.violet} /><View><Text style={styles.integrityTitle}>Preserved source truth</Text><Text style={styles.integrityBody}>Current athlete-visible evidence; no inferred values were added.</Text></View></View>
  </View>;
}

function FixtureArchive() {
  const params = useLocalSearchParams<{ ledger_view?: string | string[] }>();
  const requestedView = Array.isArray(params.ledger_view) ? params.ledger_view[0] : params.ledger_view;
  const [scope, setScope] = useState<LedgerV2Scope>('all');
  const [tab, setTab] = useState<ArchiveTab>(() => requestedView === 'sets' ? 'Sets' : requestedView === 'movements' ? 'Movements' : 'Sessions');
  useEffect(() => {
    if (requestedView === 'sets') setTab('Sets');
    else if (requestedView === 'movements') setTab('Movements');
  }, [requestedView]);
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot(scope);
  const { back, push } = useLedgerV2Navigation();
  const items = useMemo(() => {
    if (!snapshot) return [];
    if (tab === 'Sessions') return snapshot.sessions.filter((item) => item.archive_item_type === 'session');
    if (tab === 'Sets') return snapshot.evidence.filter((item) => item.archive_item_type === 'set');
    const seen = new Set<number>();
    return snapshot.evidence.filter((item) => {
      const id = recordNumber(item.movement, 'id');
      if (item.archive_item_type !== 'set' || id === null || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [snapshot, tab]);
  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening Archive" body="Gathering preserved source records." />;
  if (!snapshot) return <LedgerV2PageState title="Archive is unavailable" body={error || 'No preserved evidence was returned.'} onRetry={() => void reload()} />;
  return <View testID="ledger-v2-archive" style={styles.page}>
    <LedgerV2Header back onBack={back} title="Archive" subtitle="Every Session, set, movement, and preserved source record." />
    <View style={styles.search}><Ionicons name="search-outline" size={18} color={LEDGER_V2_COLORS.subtle} /><Text style={styles.searchText}>Search your complete record</Text><Ionicons name="options-outline" size={18} color={LEDGER_V2_COLORS.violet} /></View>
    <View style={styles.tabs}>{(['Sessions', 'Sets', 'Movements'] as ArchiveTab[]).map((value) => <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, value === tab && styles.tabActive]}><Text style={[styles.tabText, value === tab && styles.tabTextActive]}>{value}</Text></Pressable>)}</View>
    <LedgerContextBar value={scope} onChange={setScope} />
    <LedgerSection eyebrow="Preserved source material" title={`${items.length} ${tab.toLowerCase()} loaded`} />
    <View style={styles.list}>{items.map((item) => <Pressable key={`${item.archive_item_type}-${item.source_id}`} onPress={() => push(`/(tabs)/ledger/archive/${item.archive_item_type}/${item.source_id}`)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.dateBlock}><Text style={styles.dateDay}>{item.occurred_on?.slice(8, 10) || '—'}</Text><Text style={styles.dateMonth}>{item.occurred_on ? new Date(`${item.occurred_on}T12:00:00`).toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : ''}</Text></View><View style={styles.rowCopy}><View style={styles.titleLine}><Text style={styles.title}>{item.title}</Text><LedgerBadge label={item.archive_item_type} tone={item.archive_item_type === 'session' ? LEDGER_V2_COLORS.green : LEDGER_V2_COLORS.violet} /></View><Text style={styles.meta}>{item.archive_item_type === 'session' ? `${recordNumber(item.performance, 'set_count') || 0} performed sets` : item.subtitle || item.provenance_label || 'Preserved evidence'}</Text><Text style={styles.context}>{recordString(item.program_context, 'block_name') || dateLabel(item.occurred_on)}</Text></View><Ionicons name="chevron-forward" size={17} color={LEDGER_V2_COLORS.subtle} /></Pressable>)}</View>
    <View style={styles.filterCard}><View style={styles.filterTitle}><Ionicons name="funnel-outline" size={18} color={LEDGER_V2_COLORS.violet} /><Text style={styles.filterTitleText}>Filters & context</Text></View><Text style={styles.filterBody}>Production Archive supports bounded pagination, date, movement, block, classification, video, source, performance, review, and competition filters.</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  page: { gap: 0, paddingBottom: 24 },
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.inset, paddingHorizontal: 13 },
  searchText: { flex: 1, color: LEDGER_V2_COLORS.subtle, fontSize: 11 },
  tabs: { flexDirection: 'row', marginTop: 12, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  tab: { flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: LEDGER_V2_COLORS.violet },
  tabText: { color: LEDGER_V2_COLORS.muted, fontSize: 10, fontWeight: '700' },
  tabTextActive: { color: LEDGER_V2_COLORS.text },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  row: { minHeight: 87, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object },
  dateBlock: { width: 43, height: 51, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#423350', backgroundColor: '#140D1B' },
  dateDay: { color: LEDGER_V2_COLORS.text, fontSize: 16, fontWeight: '700' },
  dateMonth: { color: LEDGER_V2_COLORS.violet, fontSize: 7, fontWeight: '800' },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, color: LEDGER_V2_COLORS.text, fontSize: 13.5, fontWeight: '700' },
  meta: { color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
  context: { color: LEDGER_V2_COLORS.subtle, fontSize: 8.5 },
  filterCard: { margin: 12, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: '#3B3150', backgroundColor: '#0D0912' },
  filterTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterTitleText: { color: LEDGER_V2_COLORS.text, fontSize: 13, fontWeight: '700' },
  filterBody: { marginTop: 7, color: LEDGER_V2_COLORS.muted, fontSize: 9.5, lineHeight: 14 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.987 }] },
  detailMasthead: { minHeight: 210, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#332A3B', backgroundColor: '#09070D', padding: 18 },
  detailTitle: { marginTop: 12, color: LEDGER_V2_COLORS.text, fontSize: 26, lineHeight: 31, fontWeight: '700', textAlign: 'center' },
  detailDate: { marginTop: 4, color: LEDGER_V2_COLORS.muted, fontSize: 10 },
  detailFields: { marginHorizontal: 12, overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line },
  detailField: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  detailFieldLabel: { width: 112, color: LEDGER_V2_COLORS.subtle, fontSize: 9, fontWeight: '700' },
  detailFieldValue: { flex: 1, color: LEDGER_V2_COLORS.text, fontSize: 10.5, textAlign: 'right' },
  detailEquipment: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: '#26343A', backgroundColor: '#071014', padding: 13 },
  detailEquipmentTitle: { color: LEDGER_V2_COLORS.text, fontSize: 13, fontWeight: '700' },
  detailEquipmentBody: { marginTop: 2, color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
  integrity: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, margin: 12, borderRadius: 13, borderWidth: 1, borderColor: '#3B3150', backgroundColor: '#0D0912', padding: 13 },
  integrityTitle: { color: LEDGER_V2_COLORS.text, fontSize: 12.5, fontWeight: '700' },
  integrityBody: { marginTop: 2, color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
});
