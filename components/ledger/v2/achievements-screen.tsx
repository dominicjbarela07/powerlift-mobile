import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { displayWeight, type AccomplishmentEvent } from '@/lib/ledger-data';
import { recordNumber, recordString, type LedgerV2Scope, unitFor } from './types';
import { useLedgerV2Snapshot } from './data';
import { useLedgerV2Navigation } from './navigation';
import { LEDGER_V2_COLORS, LedgerBadge, LedgerContextBar, LedgerSection, LedgerV2Header, LedgerV2PageState, accomplishmentLabel, accomplishmentTone, dateLabel, number } from './ui';

type AchievementFilter = 'All' | 'Weight' | 'Rep' | 'e1RM' | 'Block Best';
const FILTERS: AchievementFilter[] = ['All', 'Weight', 'Rep', 'e1RM', 'Block Best'];

function matchesFilter(event: AccomplishmentEvent, filter: AchievementFilter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Block Best') return event.event_type.includes('BLOCK');
  if (filter === 'e1RM') return event.event_type.includes('E1RM');
  if (filter === 'Rep') return event.event_type.includes('REP');
  return event.event_type.includes('WEIGHT') && !event.event_type.includes('BLOCK');
}

function valueLabel(event: AccomplishmentEvent, unit: 'kg' | 'lb'): string {
  if (event.current_value == null) return 'Recorded';
  if (event.unit === 'reps') return `${number(event.current_value)} reps`;
  return `${displayWeight(event.current_value, unit)} ${unit.toUpperCase()}`;
}

export function LedgerAchievementsV2Screen() {
  const [scope, setScope] = useState<LedgerV2Scope>('all');
  const [filter, setFilter] = useState<AchievementFilter>('All');
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot(scope);
  const { back, push } = useLedgerV2Navigation();
  const events = useMemo(() => snapshot ? snapshot.accomplishments.filter((event) => matchesFilter(event, filter)) : [], [filter, snapshot]);
  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening Achievements" body="Gathering canonical accomplishment events." />;
  if (error || !snapshot) return <LedgerV2PageState title="Achievements are unavailable" body={error || 'No canonical accomplishments were returned.'} onRetry={() => void reload()} />;
  const unit = unitFor(snapshot);
  const milestoneCount = snapshot.accomplishments.filter((item) => item.event_type.includes('BLOCK')).length;

  return <View testID="ledger-v2-achievements" style={styles.page}>
    <LedgerV2Header back onBack={back} title="Achievements" subtitle="Every canonical PR, milestone, and earned record." />
    <LedgerContextBar value={scope} onChange={setScope} />
    <View style={styles.hero}><View style={styles.heroSeal}><Ionicons name="trophy-outline" size={32} color={LEDGER_V2_COLORS.gold} /></View><View style={styles.heroMetric}><Text style={styles.heroValue}>{snapshot.accomplishments.length}</Text><Text style={styles.heroLabel}>PR events loaded</Text></View><View style={styles.heroDivider} /><View style={styles.heroMetric}><Text style={[styles.heroValue, { color: LEDGER_V2_COLORS.gold }]}>{milestoneCount}</Text><Text style={styles.heroLabel}>block bests</Text></View></View>
    <View style={styles.filters}>{FILTERS.map((value) => <Pressable key={value} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{value}</Text></Pressable>)}</View>
    <LedgerSection eyebrow="Canonical accomplishment timeline" title={filter === 'All' ? 'All achievements' : filter} />
    <View style={styles.list}>{events.map((event) => <Pressable key={event.id} onPress={() => push(`/(tabs)/ledger/achievements/${event.id}`)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={[styles.seal, { borderColor: `${accomplishmentTone(event)}65`, backgroundColor: `${accomplishmentTone(event)}12` }]}><Ionicons name={event.event_type.includes('BLOCK') ? 'medal-outline' : 'star-outline'} size={20} color={accomplishmentTone(event)} /></View><View style={styles.rowCopy}><View style={styles.rowTitleLine}><Text style={styles.rowTitle}>{event.movement_label || 'Canonical accomplishment'}</Text><LedgerBadge label={accomplishmentLabel(event)} tone={accomplishmentTone(event)} /></View><Text style={styles.rowValue}>{valueLabel(event, unit)}</Text><Text style={styles.rowDate}>{dateLabel(event.occurred_at || event.workout_date)}</Text></View><Ionicons name="chevron-forward" size={17} color={LEDGER_V2_COLORS.subtle} /></Pressable>)}</View>
    {!events.length ? <LedgerV2PageState title="No achievements in this view" body="Only qualifying canonical accomplishments are shown. No proxy milestones are created." /> : null}
  </View>;
}

export function LedgerAchievementDetailV2Screen({ eventId }: { eventId: string }) {
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot('all');
  const { back, push } = useLedgerV2Navigation();
  const event = snapshot?.accomplishments.find((item) => item.id === Number(eventId));
  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening achievement" body="Gathering the canonical event and source SetLog." />;
  if (error || !snapshot) return <LedgerV2PageState title="Achievement is unavailable" body={error || 'No canonical accomplishment evidence was returned.'} onRetry={() => void reload()} />;
  if (!event) return <LedgerV2PageState title="Achievement not found" body="This event is outside the loaded canonical accomplishment window." />;
  const unit = unitFor(snapshot);
  const tone = accomplishmentTone(event);
  const source = snapshot.evidence.find((item) => item.archive_item_type === 'set' && item.source_id === event.source_set_log_id);
  const actualWeight = typeof event.evidence?.actual_weight_kg === 'number' ? event.evidence.actual_weight_kg : recordNumber(source?.performance, 'weight_kg');
  const actualReps = typeof event.evidence?.actual_reps === 'number' ? event.evidence.actual_reps : recordNumber(source?.performance, 'reps');

  return <View testID="ledger-v2-achievement-detail" style={styles.page}>
    <LedgerV2Header back onBack={back} title="Achievement" subtitle="Canonical event detail and source evidence." />
    <View style={[styles.detailHero, { borderColor: `${tone}65` }]}><View style={[styles.detailSeal, { borderColor: tone, shadowColor: tone }]}><Text style={[styles.detailSealText, { color: tone }]}>PR</Text></View><LedgerBadge label={accomplishmentLabel(event)} tone={tone} /><Text style={styles.detailMovement}>{event.movement_label || 'Canonical movement'}</Text><Text style={styles.detailValue}>{valueLabel(event, unit)}</Text><Text style={styles.detailDate}>{dateLabel(event.occurred_at || event.workout_date)}</Text></View>
    <LedgerSection eyebrow="Record comparison" title="What changed" />
    <View style={styles.comparison}><ComparisonCell label="Previous" value={event.prior_value == null ? 'No prior record' : event.unit === 'reps' ? `${number(event.prior_value)} reps` : `${displayWeight(event.prior_value, unit)} ${unit.toUpperCase()}`} /><Ionicons name="arrow-forward" size={20} color={tone} /><ComparisonCell label="Current" value={valueLabel(event, unit)} tone={tone} /></View>
    {event.delta != null ? <View style={styles.delta}><Text style={[styles.deltaValue, { color: tone }]}>+{event.unit === 'reps' ? number(Math.abs(event.delta)) : `${displayWeight(Math.abs(event.delta), unit)} ${unit.toUpperCase()}`}</Text><Text style={styles.deltaLabel}>canonical improvement</Text></View> : null}
    <LedgerSection eyebrow="Event context" title="Source record" />
    <View style={styles.context}><ContextRow label="Training Session" value={event.workout_title || 'Session title unavailable'} /><ContextRow label="Block" value={recordString(source?.program_context, 'block_name') || (event.training_block_id ? `Block ${event.training_block_id}` : 'No block context')} /><ContextRow label="Performed set" value={actualWeight != null ? `${displayWeight(actualWeight, unit)} ${unit.toUpperCase()}${actualReps != null ? ` × ${number(actualReps)}` : ''}` : 'Source values unavailable in this window'} /><ContextRow label="Scope" value={event.scope || 'canonical'} /></View>
    {event.source_set_log_id ? <Pressable onPress={() => push(`/(tabs)/ledger/archive/set/${event.source_set_log_id}`)} style={({ pressed }) => [styles.sourceAction, pressed && styles.pressed]}><Ionicons name="document-text-outline" size={21} color={tone} /><View style={styles.sourceCopy}><Text style={styles.sourceTitle}>Open source SetLog</Text><Text style={styles.sourceBody}>View the exact performed evidence behind this achievement.</Text></View><Ionicons name="arrow-forward" size={18} color={tone} /></Pressable> : null}
  </View>;
}

function ComparisonCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <View style={styles.comparisonCell}><Text style={styles.comparisonLabel}>{label}</Text><Text style={[styles.comparisonValue, tone ? { color: tone } : null]}>{value}</Text></View>;
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.contextRow}><Text style={styles.contextLabel}>{label}</Text><Text style={styles.contextValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  page: { gap: 0, paddingBottom: 24 },
  hero: { minHeight: 118, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#3C3324', backgroundColor: '#0D0A06', paddingHorizontal: 16 },
  heroSeal: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#5C4927', backgroundColor: '#181107' },
  heroMetric: { flex: 1, minWidth: 0 },
  heroValue: { color: LEDGER_V2_COLORS.text, fontSize: 27, fontWeight: '700' },
  heroLabel: { color: LEDGER_V2_COLORS.muted, fontSize: 9 },
  heroDivider: { width: 1, height: 46, backgroundColor: '#3C3324' },
  filters: { flexDirection: 'row', gap: 5, paddingHorizontal: 12, paddingTop: 12 },
  filter: { flex: 1, minHeight: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.inset },
  filterActive: { borderColor: '#70592E', backgroundColor: '#191207' },
  filterText: { color: LEDGER_V2_COLORS.muted, fontSize: 8, fontWeight: '700' },
  filterTextActive: { color: LEDGER_V2_COLORS.gold },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  row: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object },
  seal: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flex: 1, color: LEDGER_V2_COLORS.text, fontSize: 13.5, fontWeight: '700' },
  rowValue: { color: LEDGER_V2_COLORS.text, fontSize: 11, fontWeight: '700' },
  rowDate: { color: LEDGER_V2_COLORS.muted, fontSize: 8.5 },
  detailHero: { minHeight: 300, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderBottomWidth: 1, backgroundColor: '#09080D', padding: 18 },
  detailSeal: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center', marginBottom: 13, borderRadius: 46, borderWidth: 3, backgroundColor: '#100B16', shadowOpacity: 0.24, shadowRadius: 18 },
  detailSealText: { fontSize: 27, fontWeight: '800' },
  detailMovement: { marginTop: 13, color: LEDGER_V2_COLORS.text, fontSize: 17, fontWeight: '700' },
  detailValue: { marginTop: 4, color: LEDGER_V2_COLORS.text, fontSize: 35, lineHeight: 41, fontWeight: '700' },
  detailDate: { marginTop: 3, color: LEDGER_V2_COLORS.muted, fontSize: 10 },
  comparison: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object, padding: 13 },
  comparisonCell: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  comparisonLabel: { color: LEDGER_V2_COLORS.subtle, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  comparisonValue: { color: LEDGER_V2_COLORS.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  delta: { alignItems: 'center', paddingTop: 13 },
  deltaValue: { fontSize: 18, fontWeight: '800' },
  deltaLabel: { color: LEDGER_V2_COLORS.subtle, fontSize: 8.5 },
  context: { marginHorizontal: 12, overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: LEDGER_V2_COLORS.line },
  contextRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  contextLabel: { width: 105, color: LEDGER_V2_COLORS.subtle, fontSize: 9, fontWeight: '700' },
  contextValue: { flex: 1, color: LEDGER_V2_COLORS.text, fontSize: 10.5, textAlign: 'right' },
  sourceAction: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, margin: 12, borderRadius: 13, borderWidth: 1, borderColor: '#3B3150', backgroundColor: '#0D0912', padding: 13 },
  sourceCopy: { flex: 1, minWidth: 0 },
  sourceTitle: { color: LEDGER_V2_COLORS.text, fontSize: 13.5, fontWeight: '700' },
  sourceBody: { marginTop: 2, color: LEDGER_V2_COLORS.muted, fontSize: 9.5 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.987 }] },
});
