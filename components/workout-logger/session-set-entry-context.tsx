import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { LoggerPlateStackVisual } from './logger-primitives';
import type { ActiveMovementVisualContext } from './core-loggers';

/** The prescribed instrument stays visible while the wheels edit actual performance. */
export function SessionSetEntryContext({ title, visual, target }: {
  title: string; visual: ActiveMovementVisualContext; target?: string | null;
}) {
  const endpoints = visual.plateStack?.endpoints || [];
  return <View style={s.context}>
    <View style={s.copy}><Text style={s.label}>PRESCRIBED · CONFIRM YOUR ACTUALS</Text><Text style={s.title}>{title}</Text><Text style={s.target}>{target}</Text></View>
    {endpoints.length ? <View style={s.stacks}>{endpoints.map((endpoint, index) => <View key={index} style={s.endpoint}>
      {endpoint.plateStack ? <LoggerPlateStackVisual plateStack={endpoint.plateStack} style={s.stack} /> : null}
      <Text style={s.load}>{endpoint.displayLabel}</Text>
    </View>)}</View> : <CanonicalMovementArtwork movement={visual.movementArtworkInput} size={60} />}
  </View>;
}
const s = StyleSheet.create({
  context: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#32263d', marginBottom: 10 },
  copy: { flex: 1 }, label: { color: '#ab93cd', fontSize: 9, letterSpacing: 0.6 }, title: { color: '#f1e9fb', fontSize: 15, marginTop: 4 }, target: { color: '#c6bcda', fontSize: 12, marginTop: 4 },
  stacks: { flexDirection: 'row', maxWidth: '48%' }, endpoint: { width: 76 }, stack: { width: 76, height: 72 }, load: { color: '#d8cae9', fontSize: 11, textAlign: 'center', marginBottom: 6 },
});
