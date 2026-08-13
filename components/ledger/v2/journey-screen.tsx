import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { blockChapters, recordNumber, recordString, type LedgerV2Scope } from './types';
import { useLedgerV2Snapshot } from './data';
import { useLedgerV2Navigation } from './navigation';
import {
  LEDGER_V2_COLORS,
  LedgerContextBar,
  LedgerMetric,
  LedgerSection,
  LedgerV2Header,
  LedgerV2PageState,
  accomplishmentLabel,
  accomplishmentTone,
  dateLabel,
} from './ui';

type JourneyTab = 'Overview' | 'Blocks' | 'Timeline';

export function LedgerJourneyV2Screen() {
  const params = useLocalSearchParams<{ ledger_view?: string | string[] }>();
  const requestedView = Array.isArray(params.ledger_view) ? params.ledger_view[0] : params.ledger_view;
  const [scope, setScope] = useState<LedgerV2Scope>('all');
  const [tab, setTab] = useState<JourneyTab>(() => requestedView === 'blocks' ? 'Blocks' : requestedView === 'timeline' ? 'Timeline' : 'Overview');
  useEffect(() => {
    if (requestedView === 'blocks') setTab('Blocks');
    else if (requestedView === 'timeline') setTab('Timeline');
  }, [requestedView]);
  const { snapshot, loading, error, reload } = useLedgerV2Snapshot(scope);
  const { back, push } = useLedgerV2Navigation();
  const blocks = useMemo(() => snapshot ? blockChapters(snapshot) : [], [snapshot]);
  const timeline = useMemo(() => {
    if (!snapshot) return [];
    const events = snapshot.accomplishments.map((event) => ({
      id: `event-${event.id}`, date: event.occurred_at || event.workout_date || '', title: event.movement_label || 'Canonical accomplishment',
      detail: accomplishmentLabel(event), tone: accomplishmentTone(event), icon: 'sparkles-outline' as const,
      href: event.source_set_log_id ? `/(tabs)/ledger/archive/set/${event.source_set_log_id}` : null,
    }));
    const sessions = snapshot.sessions.filter((item) => item.archive_item_type === 'session').map((item) => ({
      id: `session-${item.source_id}`, date: item.occurred_on || '', title: item.title,
      detail: `${recordNumber(item.performance, 'set_count') || 0} performed sets · ${recordString(item.program_context, 'block_name') || 'No block context'}`,
      tone: LEDGER_V2_COLORS.green, icon: 'checkmark-circle-outline' as const,
      href: `/(tabs)/ledger/archive/session/${item.source_id}`,
    }));
    return [...events, ...sessions].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 30);
  }, [snapshot]);

  if (loading && !snapshot) return <LedgerV2PageState loading title="Opening Journey" body="Ordering your training chapters." />;
  if (error || !snapshot) return <LedgerV2PageState title="Journey is unavailable" body={error || 'No chronological evidence was returned.'} onRetry={() => void reload()} />;
  const current = blocks[0];
  const completedSessions = snapshot.progression.consistency?.sessions_completed ?? snapshot.sessions.length;
  const totalSets = snapshot.sessions.reduce((sum, item) => sum + (recordNumber(item.performance, 'set_count') || 0), 0);

  return <View testID="ledger-v2-journey" style={styles.page}>
    <LedgerV2Header back onBack={back} title="Journey" subtitle="Blocks, phases, and Sessions in chronological order." />
    <View style={styles.tabs}>{(['Overview', 'Blocks', 'Timeline'] as JourneyTab[]).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}><Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value}</Text></Pressable>)}</View>
    <LedgerContextBar value={scope} onChange={setScope} />

    {tab === 'Overview' ? <>
      <View style={styles.overviewHero}>
        <View style={styles.overviewHeader}><View><Text style={styles.eyebrow}>CURRENT TRAINING CHAPTER</Text><Text style={styles.heroTitle}>{current?.name || 'No block evidence in this period'}</Text><Text style={styles.heroMeta}>{current?.programName || 'Program context unavailable'}</Text></View><View style={styles.chapterSeal}><Text style={styles.chapterSealValue}>{current?.sessions.length || 0}</Text><Text style={styles.chapterSealLabel}>SESSIONS</Text></View></View>
        <View style={styles.metricRow}><LedgerMetric value={String(completedSessions)} label="Sessions represented" /><LedgerMetric value={String(totalSets)} label="performed sets loaded" tone={LEDGER_V2_COLORS.cyan} /><LedgerMetric value={String(blocks.length)} label="block chapters loaded" tone={LEDGER_V2_COLORS.gold} /></View>
      </View>
      <LedgerSection eyebrow="Recent chronology" title="The story as it was written" action="Full timeline" onAction={() => setTab('Timeline')} />
      <View style={styles.timeline}>{timeline.slice(0, 6).map((item, index) => <TimelineRow key={item.id} item={item} last={index === Math.min(5, timeline.length - 1)} onPress={() => item.href && push(item.href)} />)}</View>
      <LedgerSection eyebrow="Block chapters" title="Training structure" action="All blocks" onAction={() => setTab('Blocks')} />
      <View style={styles.blocks}>{blocks.slice(0, 3).map((block, index) => <BlockRow key={block.id} index={index} block={block} onPress={() => push(`/(tabs)/ledger/archive?collection=training&block_id=${block.id}&block_name=${encodeURIComponent(block.name)}`)} />)}</View>
    </> : null}

    {tab === 'Blocks' ? <>
      <LedgerSection eyebrow="Chapters" title={`${blocks.length} blocks in the loaded period`} />
      <View style={styles.blocks}>{blocks.map((block, index) => <BlockRow key={block.id} index={index} block={block} onPress={() => push(`/(tabs)/ledger/archive?collection=training&block_id=${block.id}&block_name=${encodeURIComponent(block.name)}`)} />)}</View>
      {!blocks.length ? <LedgerV2PageState title="No block chapters yet" body="Completed Sessions will appear here when canonical block context is attached." /> : null}
    </> : null}

    {tab === 'Timeline' ? <>
      <LedgerSection eyebrow="Bounded chronological feed" title="Session and accomplishment evidence" />
      <View style={styles.timeline}>{timeline.map((item, index) => <TimelineRow key={item.id} item={item} last={index === timeline.length - 1} onPress={() => item.href && push(item.href)} />)}</View>
    </> : null}
  </View>;
}

function BlockRow({ block, index, onPress }: { block: ReturnType<typeof blockChapters>[number]; index: number; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.block, pressed && styles.pressed]}><View style={styles.blockNumber}><Text style={styles.blockNumberText}>{String(index + 1).padStart(2, '0')}</Text></View><View style={styles.blockCopy}><Text style={styles.blockTitle}>{block.name}</Text><Text style={styles.blockMeta}>{block.programName || 'Program unavailable'} · {block.sessions.length} Sessions</Text><Text style={styles.blockDates}>{dateLabel(block.firstDate)} — {dateLabel(block.lastDate)}</Text></View><Ionicons name="chevron-forward" size={17} color={LEDGER_V2_COLORS.subtle} /></Pressable>;
}

function TimelineRow({ item, last, onPress }: { item: { id: string; date: string; title: string; detail: string; tone: string; icon: keyof typeof Ionicons.glyphMap; href: string | null }; last: boolean; onPress: () => void }) {
  return <Pressable disabled={!item.href} onPress={onPress} style={({ pressed }) => [styles.timelineRow, pressed && styles.pressed]}><View style={styles.timelineAxis}><View style={[styles.timelineLine, last && { opacity: 0 }]} /><View style={[styles.timelineDot, { backgroundColor: item.tone }]} /></View><View style={[styles.timelineIcon, { borderColor: `${item.tone}55`, backgroundColor: `${item.tone}12` }]}><Ionicons name={item.icon} size={17} color={item.tone} /></View><View style={styles.timelineCopy}><Text style={styles.timelineDate}>{dateLabel(item.date)}</Text><Text style={styles.timelineTitle}>{item.title}</Text><Text style={styles.timelineDetail}>{item.detail}</Text></View>{item.href ? <Ionicons name="chevron-forward" size={15} color={LEDGER_V2_COLORS.subtle} /> : null}</Pressable>;
}

const styles = StyleSheet.create({
  page: { gap: 0, paddingBottom: 24 },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: LEDGER_V2_COLORS.violet },
  tabText: { color: LEDGER_V2_COLORS.muted, fontSize: 10.5, fontWeight: '700' },
  tabTextActive: { color: '#D8C3FA' },
  overviewHero: { minHeight: 210, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#332A3B', backgroundColor: '#09070D', padding: 16 },
  overviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: LEDGER_V2_COLORS.violet, fontSize: 8.5, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { maxWidth: 260, marginTop: 5, color: LEDGER_V2_COLORS.text, fontSize: 26, lineHeight: 31, fontWeight: '700' },
  heroMeta: { marginTop: 4, color: LEDGER_V2_COLORS.muted, fontSize: 11 },
  chapterSeal: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, borderWidth: 3, borderColor: LEDGER_V2_COLORS.violet, backgroundColor: '#130C1C' },
  chapterSealValue: { color: LEDGER_V2_COLORS.text, fontSize: 21, fontWeight: '800' },
  chapterSealLabel: { color: LEDGER_V2_COLORS.muted, fontSize: 6.5, fontWeight: '800', letterSpacing: 0.6 },
  metricRow: { flexDirection: 'row', gap: 12, marginTop: 24, paddingTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#332D3A' },
  timeline: { paddingHorizontal: 12 },
  timelineRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineAxis: { alignSelf: 'stretch', width: 12, alignItems: 'center' },
  timelineLine: { position: 'absolute', top: 43, bottom: -43, width: 1, backgroundColor: LEDGER_V2_COLORS.lineStrong },
  timelineDot: { position: 'absolute', top: 39, width: 8, height: 8, borderRadius: 4 },
  timelineIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1 },
  timelineCopy: { flex: 1, minWidth: 0, gap: 2 },
  timelineDate: { color: LEDGER_V2_COLORS.subtle, fontSize: 8.5, fontWeight: '700', letterSpacing: 0.5 },
  timelineTitle: { color: LEDGER_V2_COLORS.text, fontSize: 13.5, fontWeight: '700' },
  timelineDetail: { color: LEDGER_V2_COLORS.muted, fontSize: 10, lineHeight: 14 },
  blocks: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line },
  block: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: LEDGER_V2_COLORS.line, backgroundColor: LEDGER_V2_COLORS.object },
  blockNumber: { width: 38, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#4A3760', backgroundColor: '#160D20' },
  blockNumberText: { color: LEDGER_V2_COLORS.violet, fontSize: 13, fontWeight: '800' },
  blockCopy: { flex: 1, minWidth: 0, gap: 2 },
  blockTitle: { color: LEDGER_V2_COLORS.text, fontSize: 15, fontWeight: '700' },
  blockMeta: { color: LEDGER_V2_COLORS.muted, fontSize: 10 },
  blockDates: { color: LEDGER_V2_COLORS.subtle, fontSize: 9 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.987 }] },
});
