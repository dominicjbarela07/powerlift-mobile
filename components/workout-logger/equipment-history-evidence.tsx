import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import type { EquipmentHistoryPresentation } from '@/lib/equipment-selection';

/** Shared evidence copy inside the existing manufacturer and equipment choices. */
export function EquipmentHistoryEvidence({ evidence }: { evidence: EquipmentHistoryPresentation }) {
  return <View style={s.copy}>
    {evidence.performance ? <Text style={s.performance}>{evidence.performance}</Text> : null}
    <Text style={s.detail}>{evidence.detail}</Text>
    {evidence.status ? <Text style={s.current}>{evidence.status}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  copy: { flexShrink: 1, gap: 3 },
  performance: { color: '#E3DAEF', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  detail: { color: '#B9B1C2', fontSize: 13, lineHeight: 19 },
  current: { color: '#D1B0FF', fontSize: 10, lineHeight: 14, fontWeight: '700' },
});
