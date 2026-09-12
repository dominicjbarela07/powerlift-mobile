import React, { useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies } from '@/constants/theme';
import { fetchCanonicalMovementHistory } from '@/lib/canonical-movement-history';
import type { MovementHistoryLaunchTarget } from '@/lib/movement-history-launch';
import type { PerformedLoadSemantics } from '@/lib/performed-load-semantics';
import { exposureSnapshotKey, sessionExposureCache } from '@/lib/session-exposure-cache';
import { exposureFromCoreHistory, exposureFromHydration, presentSessionExposure, type HydratedExposureHistory } from '@/lib/session-exposure-snapshot';

/** Accessory evidence comes from authorized Session hydration. Core fallback is
 * optional and shared across remounts; neither history nor clocks own execution. */
export function SessionHistoryPeek({ target, workoutId, sessionDate, ownerId, history, semantics, unit, onOpen }: {
  target: MovementHistoryLaunchTarget; workoutId: number; sessionDate: string; ownerId: string;
  history?: HydratedExposureHistory | null; semantics?: PerformedLoadSemantics;
  unit: 'kg' | 'lb'; onOpen: () => void;
}) {
  const identity = { ownerId, athleteId: target.athleteId, workoutId, sessionDate,
    coreMovementId: target.coreMovementId, movementDefinitionId: target.movementDefinitionId,
    equipmentId: target.equipmentContextDefinitionId, comparisonKey: history?.comparison_identity_key };
  const key = exposureSnapshotKey(identity);
  const revision = useSyncExternalStore(sessionExposureCache.subscribe, sessionExposureCache.snapshot);
  useEffect(() => {
    if (!identity.coreMovementId || !ownerId || !sessionDate) return;
    void sessionExposureCache.ensure(identity, async () => exposureFromCoreHistory(
      await fetchCanonicalMovementHistory({ athleteId: identity.athleteId, coreMovementId: identity.coreMovementId, range: '3m', limit: 6 }), identity));
    // Identity primitives and evidence revisions own fetching; display units,
    // navigation, expansion and display clock ticks are intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision]);
  const snapshot = target.coreMovementId ? sessionExposureCache.get(identity) : exposureFromHydration(history, identity);
  const content = presentSessionExposure(snapshot ?? null, unit, target.coreMovementId ? 'core' : 'accessory', semantics);
  return <Pressable accessibilityRole="button" accessibilityLabel="Open full movement history" onPress={onOpen} style={s.panel}>
    <View style={s.heading}><Text style={s.label}>LAST COMPARABLE EXPOSURE</Text><Text style={s.date}>{content?.date || ''}</Text></View>
    <View style={s.performanceRow}>
      <Text style={s.value}>{content?.performance || (snapshot === undefined && target.coreMovementId ? 'Explore your prior work' : 'No comparable exposure')}</Text>
      {content?.effort ? <Text style={s.effort}>{content.effort}</Text> : null}
    </View>
    <Text style={s.context}>{content?.context || (target.coreMovementId ? 'Recent exact task · view full record below' : 'Exact movement · equipment-aware record')}</Text>
    <Text style={s.link}>Movement history · all sets & progression ↗︎</Text>
  </Pressable>;
}
const s = StyleSheet.create({
  panel: { marginTop: 9, borderRadius: 14, padding: 12, backgroundColor: '#0b141a', borderWidth: 1, borderColor: '#293d46' },
  heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', columnGap: 8, rowGap: 3 },
  label: { color: '#b6dfe6', fontSize: 10, lineHeight: 15, flexShrink: 1 },
  date: { color: '#b6bdca', fontSize: 11, lineHeight: 16 },
  performanceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 7, rowGap: 2, marginTop: 8, marginBottom: 4 },
  value: { color: '#f0edf7', fontSize: 21, lineHeight: 27, fontFamily: SLFontFamilies.sansSemiBold, flexShrink: 1 },
  effort: { color: '#d0d8e0', fontSize: 14, lineHeight: 21 },
  context: { color: '#b6bdca', fontSize: 11, lineHeight: 17 },
  link: { color: '#a8dfe9', fontSize: 12, lineHeight: 18, marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#29313b' },
});
