import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { SLColors } from '@/constants/theme';
import { CABLE_EQUIPMENT_TYPE_ARTWORK, EQUIPMENT_TYPE_ARTWORK } from '@/lib/equipment-type-artwork';
import type { MachineEquipmentType } from '@/lib/machine-equipment';
import type { EquipmentHistoryPresentation } from '@/lib/equipment-selection';
import { EquipmentHistoryEvidence } from './equipment-history-evidence';

type Props = Readonly<{
  equipmentType: MachineEquipmentType;
  domain?: 'machine' | 'cable';
  label: string;
  status: string;
  evidence?: EquipmentHistoryPresentation;
  current: boolean;
  disabled: boolean;
  singleOption?: boolean;
  onPress: () => void;
}>;

/** Presents the existing governed choice; never creates or rewrites its subject. */
export function EquipmentTypeChoice({ equipmentType, domain = 'machine', label, status, evidence, current, disabled, singleOption, onPress }: Props) {
  const artwork = (domain === 'cable' ? CABLE_EQUIPMENT_TYPE_ARTWORK : EQUIPMENT_TYPE_ARTWORK)?.[equipmentType];
  if (!artwork) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${artwork.description}. ${evidence ? [evidence.performance, evidence.detail, evidence.status].filter(Boolean).join('. ') : status}`}
      accessibilityState={{ selected: current, disabled }}
      testID={`equipment-type-${equipmentType}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.card, singleOption && styles.singleCard, current && styles.current, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Image source={artwork.source} accessibilityLabel={artwork.accessibilityLabel} accessible={false}
        contentFit="contain" cachePolicy="memory-disk" transition={0} style={[styles.art, singleOption && styles.singleArt]} />
      <View style={[styles.copy, singleOption && styles.singleCopy]}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.description}>{artwork.description}</Text>
        <View style={styles.footer}>
          {evidence ? <EquipmentHistoryEvidence evidence={evidence} /> : <Text style={[styles.status, current && styles.currentStatus]}>{status}</Text>}
          <Ionicons name="chevron-forward" size={16} color={current ? '#D1B0FF' : SLColors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0, overflow: 'hidden', borderRadius: 15, borderWidth: 1, borderColor: '#302A39', backgroundColor: '#08090D' },
  current: { borderColor: '#9664D0', backgroundColor: '#100B18' },
  pressed: { opacity: 0.76 }, disabled: { opacity: 0.5 },
  art: { width: '100%', aspectRatio: 1, backgroundColor: '#030304' },
  copy: { padding: 12, gap: 6 },
  title: { color: SLColors.textStrong, fontSize: 16, lineHeight: 20, fontWeight: '800' },
  description: { color: '#A8A0B2', fontSize: 12, lineHeight: 17, minHeight: 34 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 'auto', paddingTop: 7 },
  status: { flex: 1, color: '#A9A1B2', fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.3 },
  currentStatus: { color: '#D1B0FF' },
  singleCard: { flexDirection: 'row', alignItems: 'center' },
  singleArt: { width: 112, height: 112, aspectRatio: 1 },
  singleCopy: { flex: 1 },
});
