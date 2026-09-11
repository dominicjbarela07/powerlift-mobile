import { useSLReducedMotion } from '@/lib/motion';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/sl-text';
import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import type { GovernedAccessoryIdentity } from '@/components/movement/GovernedAccessoryPickerModal';
import { SLColors, SLFontFamilies } from '@/constants/theme';

/** This sheet receives only backend-issued stable identities for one item. */
export function ApprovedSubstitutionPicker({ visible, choices, currentName, prescription, onCancel, onSelect }: {
  visible: boolean;
  choices: GovernedAccessoryIdentity[];
  currentName: string;
  prescription: string;
  onCancel: () => void;
  onSelect: (identity: GovernedAccessoryIdentity) => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useSLReducedMotion();
  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onCancel}>
    <View style={styles.backdrop}>
      <Pressable accessibilityLabel="Close approved substitutions" onPress={onCancel} style={StyleSheet.absoluteFill} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.heading}>
          <View style={styles.copy}><Text style={styles.eyebrow}>COACH APPROVED</Text><Text style={styles.title}>Substitute movement</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onCancel} style={styles.close}><Ionicons name="close" size={23} color={SLColors.textStrong} /></Pressable>
        </View>
        <Text style={styles.context}>{currentName}</Text>
        <Text style={styles.prescription}>{prescription} · prescription retained</Text>
        <ScrollView>
          {choices.map((identity) => <Pressable key={identity.id} accessibilityRole="button" accessibilityLabel={`Substitute ${identity.display_name}`} onPress={() => onSelect(identity)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <CanonicalMovementArtwork movement={identity} size={52} style={styles.art} />
            <View style={styles.copy}><Text style={styles.name}>{identity.display_name}</Text><Text style={styles.context}>Approved for this Session</Text></View>
            <Ionicons name="chevron-forward" size={20} color={SLColors.accentViolet} />
          </Pressable>)}
          {!choices.length ? <Text style={styles.context}>No approved substitutions are available.</Text> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0009' },
  sheet: { maxHeight: '85%', backgroundColor: '#100e17', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#3a304d', padding: 20 },
  heading: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  copy: { flex: 1 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#b990f8', fontFamily: SLFontFamilies.sansBold, fontSize: 11, letterSpacing: 1.5, marginBottom: 8 },
  title: { color: SLColors.textStrong, fontFamily: SLFontFamilies.sansBold, fontSize: 25 },
  context: { color: SLColors.textMuted, fontSize: 13, marginTop: 4 },
  prescription: { color: '#a9dce3', fontSize: 14, paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17, borderTopWidth: 1, borderTopColor: '#302936', minHeight: 84 },
  name: { color: SLColors.textStrong, fontSize: 17, fontFamily: SLFontFamilies.sansSemiBold },
  art: { width: 52, height: 52 }, pressed: { backgroundColor: '#261b36' },
});
