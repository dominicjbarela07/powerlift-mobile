import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies, SLRadius } from '@/constants/theme';
import type { HomeAction } from '@/lib/athlete-home-v3';

const destinations = [
  { label: 'My Videos', route: 'my_videos', icon: 'play-circle-outline', color: '#70D7D0' },
  { label: 'Session History', route: 'training_history', icon: 'time-outline', color: '#BB99F1' },
  { label: 'Movement History', route: 'movement_history', icon: 'barbell-outline', color: '#DCC18B' },
] as const;

/** Personal history belongs to both athlete and self-coach Today. */
export function TodayQuickAccess({ onAction }: { onAction: (action: HomeAction) => void }) {
  return <View style={styles.section} testID="today-quick-access">
    <Text style={styles.heading}>YOUR TRAINING</Text>
    <View style={styles.widgets}>
      {destinations.map(({ label, route, icon, color }) => <Pressable
        key={route}
        accessibilityRole="button"
        accessibilityLabel={`Open ${label}`}
        onPress={() => onAction({ route, label })}
        style={({ pressed }) => [styles.widget, pressed && styles.pressed]}
      >
        <View style={styles.iconRow}>
          <Ionicons name={icon} size={25} color={color} />
          <Ionicons name="chevron-forward" size={14} color={SLColors.iconMuted} />
        </View>
        <Text style={styles.title}>{label.replace(' ', '\n')}</Text>
      </Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10, marginTop: 3 },
  heading: { color: SLColors.textMuted, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 11, letterSpacing: 1.3 },
  widgets: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  widget: { flexGrow: 1, flexBasis: '30%', minWidth: 90, minHeight: 104, padding: 12, gap: 13, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#302738', backgroundColor: '#0D0B12' },
  iconRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  title: { color: SLColors.textStrong, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 14, lineHeight: 19 },
  pressed: { backgroundColor: '#20172C', borderColor: '#8460B0' },
});
