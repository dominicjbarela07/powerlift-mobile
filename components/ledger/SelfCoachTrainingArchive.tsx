import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { LEDGER as T } from '@/constants/ledger';
import type { ArchiveItem } from '@/lib/ledger-archive';
import type { LedgerUnit } from '@/lib/ledger-data';
import type { LedgerSource } from '@/lib/ledger-records';
import { ledgerDate } from '@/lib/ledger-records';
import { ledgerArchiveFacts } from '@/lib/ledger-history-presentation';
import { archiveDay, archiveItemKey, archiveMonthCells, archiveMonthComplete, archiveMonthItems, archiveMonthLabel, archiveSetTotal, shiftArchiveMonth } from '@/lib/ledger-archive-visuals';

const C = T.colors;

/** Calendar and date-gutter evidence share one selection, with honest page coverage. */
export function SelfCoachTrainingArchive({ items, month, hasMore, unit, onMonth, open }: {
  items: ArchiveItem[]; month: string; hasMore: boolean; unit: LedgerUnit;
  onMonth: (month: string | null) => void; open: (source: LedgerSource) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const monthItems = archiveMonthItems(month, items);
  const day = selected?.startsWith(month) ? selected : null;
  const visible = day ? monthItems.filter(item => archiveDay(item) === day) : monthItems;
  const complete = archiveMonthComplete(month, items, hasMore);
  const sets = archiveSetTotal(monthItems);
  const changeMonth = (offset: number) => { setSelected(null); onMonth(shiftArchiveMonth(month, offset)); };

  return <View testID="self-coach-training-archive" style={s.archive}>
    <View style={s.monthRow}>
      <View style={s.flex}><Text style={s.heading}>{archiveMonthLabel(month)}</Text><Text style={s.caption}>{monthItems.length} {monthItems.length === 1 ? complete ? 'Session' : 'Session shown' : complete ? 'Sessions' : 'Sessions shown'}{sets != null ? ` · ${sets} recorded sets` : ''}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous archive month" onPress={() => changeMonth(-1)} style={s.icon}><Ionicons name="chevron-back" color={C.secondary} size={21} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Next archive month" onPress={() => changeMonth(1)} style={s.icon}><Ionicons name="chevron-forward" color={C.secondary} size={21} /></Pressable>
    </View>
    <View style={s.week}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => <Text key={index} style={s.weekLabel}>{label}</Text>)}</View>
    <View style={s.calendar}>
      {archiveMonthCells(month, items).map((cell, index) => <View key={cell.date ?? `blank-${index}`} style={s.cell}>
        {cell.date ? <Pressable accessibilityRole="button" accessibilityLabel={`${ledgerDate(cell.date)}. ${cell.items.length} ${complete ? 'recorded' : 'loaded'} ${cell.items.length === 1 ? 'Session' : 'Sessions'}`} accessibilityState={{ selected: day === cell.date }}
          onPress={() => setSelected(previous => previous === cell.date ? null : cell.date)} style={s.dayHit}>
          <View style={[s.day, cell.items.length > 0 && s.recordedDay, day === cell.date && s.selectedDay]}><Text style={[s.dayText, cell.items.length > 0 && s.recordedText, day === cell.date && s.selectedText]}>{cell.day}</Text></View>
        </Pressable> : null}
      </View>)}
    </View>
    {day ? <View style={s.monthRow}><Text style={[s.caption, s.flex]}>{ledgerDate(day)}</Text><Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={s.clear}><Text style={s.link}>Show month</Text></Pressable></View> : null}
    {!complete ? <Text style={s.caption}>More evidence is available. Load older records to complete this month.</Text> : null}
    <View style={s.entries}>
      {visible.map(item => <Pressable key={archiveItemKey(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}, ${ledgerDate(archiveDay(item))}`} onPress={() => open({ type: item.archive_item_type, id: item.source_id })} style={s.entry}>
        <View style={s.dateGutter}><Text style={s.dateNumber}>{archiveDay(item).slice(-2)}</Text><Text style={s.caption}>{new Date(`${archiveDay(item)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()}</Text></View>
        <View style={s.flex}><Text style={s.sessionTitle}>{item.title}</Text><Text numberOfLines={2} style={s.caption}>{ledgerArchiveFacts(item, unit).join(' · ')}</Text></View>
        {Number(item.media?.video_count) > 0 ? <Ionicons name="film-outline" size={20} color={C.teal} /> : null}
        <Ionicons name="chevron-forward" size={17} color={C.muted} />
      </Pressable>)}
      {!visible.length ? <View style={s.empty}><Text style={s.secondary}>{complete ? day ? 'No recorded Session on this date.' : 'No recorded Sessions this month.' : 'No Session loaded for this date yet.'}</Text><Text style={s.caption}>Choose another date{hasMore ? ' or load older records.' : ' to explore your training.'}</Text></View> : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  archive: { gap: 4 }, flex: { flex: 1, minWidth: 0, gap: 3 },
  heading: { color: C.text, fontFamily: T.fonts.bodyMedium, fontSize: 17, lineHeight: 24 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  caption: { color: C.muted, fontSize: 12, lineHeight: 18 }, secondary: { color: C.secondary, fontSize: 14, lineHeight: 21 },
  icon: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' }, weekLabel: { flex: 1, textAlign: 'center', color: C.muted, fontSize: 11, lineHeight: 20 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '14.285714%', height: 44 },
  dayHit: { flex: 1, alignItems: 'center', justifyContent: 'center' }, day: { minWidth: 34, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dayText: { color: C.muted, fontSize: 14, fontVariant: ['tabular-nums'] }, recordedDay: { backgroundColor: '#35233F' }, recordedText: { color: '#E2B9FF', fontFamily: T.fonts.bodySemiBold }, selectedDay: { backgroundColor: C.accent }, selectedText: { color: '#160D21' },
  entries: { marginTop: 8 }, entry: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingVertical: 10 },
  dateGutter: { width: 38, alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth, borderColor: C.line, paddingRight: 8 }, dateNumber: { color: C.text, fontSize: 21, fontFamily: T.fonts.bodyMedium, fontVariant: ['tabular-nums'] },
  sessionTitle: { color: C.text, fontFamily: T.fonts.bodyMedium, fontSize: 15, lineHeight: 21 },
  clear: { minHeight: 44, justifyContent: 'center' }, link: { color: C.accent, fontSize: 13 }, empty: { gap: 5, paddingVertical: 18 },
});
