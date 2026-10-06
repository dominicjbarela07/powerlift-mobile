import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { SLFontFamilies } from '@/constants/theme';
import type { MovementHistoryLaunchTarget } from '@/lib/movement-history-launch';
import type { PerformedLoadSemantics } from '@/lib/performed-load-semantics';
import { useMovementHistoryAvailability } from '@/lib/use-movement-history-availability';
import { useSessionExposure } from '@/lib/use-session-exposure';
import { presentSessionExposure, type HydratedExposureHistory } from '@/lib/session-exposure-snapshot';

/** Before equipment selection, exact History answers what was performed last.
 * Selected equipment retains the authorized hydration's comparison policy. */
export function SessionHistoryPeek({ target, workoutId, sessionDate, ownerId, history, semantics, unit, onOpen }: {
  target: MovementHistoryLaunchTarget; workoutId: number; sessionDate: string; ownerId: string;
  history?: HydratedExposureHistory | null; semantics?: PerformedLoadSemantics;
  unit: 'kg' | 'lb'; onOpen: () => void;
}) {
  const beforeEquipmentSelection = !target.equipmentContextDefinitionId;
  const context = { ownerId, athleteId: target.athleteId, workoutId, sessionDate };
  const read = useSessionExposure({ context, target, history,
    canonicalEditorHistory: beforeEquipmentSelection });
  const content = presentSessionExposure(read.exposure, unit, target.coreMovementId ? 'core' : 'accessory', semantics);
  const contextLine = content?.equipmentLabel;
  const availability = useMovementHistoryAvailability({ context, target,
    enabled: !content && read.status !== 'loading' });
  if (!content) {
    if (availability.status === 'empty') return null;
    const loading = read.status === 'loading' || availability.status === 'loading';
    return <Pressable accessibilityRole="button" accessibilityLabel="Open full movement history"
      onPress={onOpen} style={s.compact}>
      <Ionicons name="time-outline" size={16} color="#a8dfe9" />
      <Text style={s.compactLabel}>{loading ? 'Loading history…' : 'Movement history'}</Text>
      {availability.status === 'error' ? <Text style={s.unavailable}>Unavailable</Text> : null}
      <Ionicons name="chevron-forward" size={15} color="#b6cbd5" />
    </Pressable>;
  }
  return <Pressable accessibilityRole="button" accessibilityLabel="Open full movement history" onPress={onOpen} style={s.panel}>
    <View style={s.heading}><Text style={s.label}>{beforeEquipmentSelection ? 'LAST EXPOSURE' : 'LAST COMPARABLE EXPOSURE'}</Text><View style={s.affordance}><Text style={s.date}>{content?.date || ''}</Text><Ionicons name="chevron-forward" size={18} color="#b6cbd5" /></View></View>
    <View style={s.performanceRow}>
      <Text style={s.value}>{content.performance}</Text>
      {content?.effort ? <Text style={s.effort}>{content.effort}</Text> : null}
    </View>
    {contextLine ? <Text style={s.context}>{contextLine}</Text> : null}
    {read.status === 'error' && read.retry ? <Pressable accessibilityRole="button" accessibilityLabel="Retry previous exposure" onPress={event => { event.stopPropagation(); read.retry?.(); }}><Text style={s.link}>Retry history</Text></Pressable> : null}
  </Pressable>;
}
const s = StyleSheet.create({
  compact: { marginTop: 4, minHeight: 44, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  compactLabel: { color: '#a8dfe9', fontSize: 13, lineHeight: 18 },
  unavailable: { color: '#b6bdca', fontSize: 11, lineHeight: 16 },
  panel: { marginTop: 9, borderRadius: 14, padding: 13, backgroundColor: '#080b0e', borderWidth: 1, borderColor: '#2d3d45' },
  affordance: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 8, rowGap: 3 },
  label: { color: '#b6dfe6', fontSize: 10, lineHeight: 15, flexShrink: 1 },
  date: { color: '#b6bdca', fontSize: 11, lineHeight: 16 },
  performanceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 7, rowGap: 2, marginTop: 4, marginBottom: 0 },
  value: { color: '#f0edf7', fontSize: 21, lineHeight: 27, fontFamily: SLFontFamilies.sansSemiBold, flexShrink: 1 },
  effort: { color: '#f0edf7', fontSize: 18, lineHeight: 27, fontFamily: SLFontFamilies.sansSemiBold },
  context: { color: '#b6bdca', fontSize: 12, lineHeight: 18 },
  link: { color: '#a8dfe9', fontSize: 12, lineHeight: 18, marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#29313b' },
});
