import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Text } from '@/components/ui/sl-text';
import { SLFontFamilies } from '@/constants/theme';
import { fetchCanonicalMovementHistory, type CanonicalMovementHistory } from '@/lib/canonical-movement-history';
import type { MovementHistoryLaunchTarget } from '@/lib/movement-history-launch';
import { formatPerformedLoad } from '@/lib/performed-load-semantics';

/** Optional bounded evidence. Loading this never owns or blocks set execution. */
export function SessionHistoryPeek({ target, workoutId, unit, onOpen }: {
  target: MovementHistoryLaunchTarget; workoutId: number; unit: 'kg' | 'lb'; onOpen: () => void;
}) {
  const [result, setResult] = useState<{ key: string; value: CanonicalMovementHistory } | null>(null);
  const key = [target.athleteId, target.coreMovementId, target.movementDefinitionId, target.equipmentContextDefinitionId, workoutId].join(':');
  useEffect(() => {
    let current = true;
    void fetchCanonicalMovementHistory({ athleteId: target.athleteId, coreMovementId: target.coreMovementId, movementDefinitionId: target.movementDefinitionId, equipmentContextDefinitionId: target.equipmentContextDefinitionId, equipmentDefinitionId: target.equipmentContextDefinitionId, range: '3m', limit: 6 })
      .then(value => { if (current && value.athlete.id === target.athleteId) setResult({ key, value }); })
      .catch(() => { if (current) setResult(null); });
    return () => { current = false; };
  }, [key, target.athleteId, target.coreMovementId, target.movementDefinitionId, target.equipmentContextDefinitionId]);
  const history = result?.key === key ? result.value : null;
  const prior = history?.comparison_allowed ? history.exposures.find(row => row.workout_id !== workoutId) : null;
  const set = prior?.best_set;
  const stringValue = (value: unknown) => typeof value === 'string' ? value : null;
  const points = history?.comparison_allowed ? history.performance_trend.filter(row => row.workout_id !== workoutId).slice(-6) : [];
  const values = points.map(row => row.strength_metric_kg ?? row.weight_kg).filter((value): value is number => value != null && Number.isFinite(value));
  const low = Math.min(...values), high = Math.max(...values);
  const coordinates = values.map((value, i) => ({ x: 5 + i * (100 / Math.max(1, values.length - 1)), y: 39 - (value - low) / Math.max(1, high - low) * 30 }));
  return <Pressable accessibilityRole="button" accessibilityLabel="Open full movement history" onPress={onOpen} style={s.panel}>
    <View style={s.row}><Text style={s.label}>{set ? 'LAST COMPARABLE EXPOSURE' : 'MOVEMENT HISTORY'}</Text><Text style={s.date}>{prior?.date ? new Date(`${prior.date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''}</Text></View>
    <View style={s.row}>
      <View style={s.copy}><Text style={s.value}>{set ? `${formatPerformedLoad(set.weight_kg, unit, { loadConvention: stringValue(set.load_convention) || stringValue(history?.movement.load_convention), measurementType: stringValue(set.measurement_type) || stringValue(history?.movement.measurement_type) }) || 'Load unavailable'} × ${set.reps ?? '—'}` : history ? 'No comparable exposure' : 'Explore your prior work'}</Text>
        <Text style={s.date}>{set ? [set.rpe != null ? `${set.rpe} RPE` : set.rir != null ? `${set.rir} RIR` : '', `${prior?.set_count} sets`, history?.strength_metric?.short_label].filter(Boolean).join(' · ') : 'Exact movement · equipment-aware record'}</Text></View>
      {coordinates.length > 1 ? <Svg width={110} height={46} accessibilityLabel={`${history?.strength_metric?.label || 'Performance'} across ${coordinates.length} recent exposures`}>
        <Polyline points={coordinates.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#9edee8" strokeWidth={2} />
        {coordinates.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={2.3} fill="#b6e8ee" />)}
      </Svg> : null}
    </View>
    <Text style={s.link}>Movement history · {prior ? 'all sets & progression' : 'view full record'} ↗︎</Text>
  </Pressable>;
}
const s = StyleSheet.create({
  panel: { marginTop: 9, borderRadius: 14, padding: 10, backgroundColor: '#0b141a', borderWidth: 1, borderColor: '#293d46' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, copy: { flex: 1 },
  label: { color: '#b6dfe6', fontSize: 10 }, date: { color: '#b6bdca', fontSize: 11, lineHeight: 16 },
  value: { color: '#f0edf7', fontSize: 19, fontFamily: SLFontFamilies.sansSemiBold, marginTop: 8, marginBottom: 3 },
  link: { color: '#a8dfe9', fontSize: 12, marginTop: 7, paddingTop: 7, borderTopWidth: 1, borderTopColor: '#29313b' },
});
