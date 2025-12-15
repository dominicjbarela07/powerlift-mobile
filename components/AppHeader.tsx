// components/AppHeader.tsx

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

type AppHeaderProps = {
  firstName: string;
  onPressMenu?: () => void;
};

export function AppHeader({ firstName, onPressMenu }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Menu */}
      <Pressable style={styles.menuBtn} onPress={onPressMenu}>
        <Text style={styles.menuText}>☰ Menu</Text>
      </Pressable>

      {/* Center Title */}
      <View style={styles.titleWrap}>
        <Text style={styles.titleLine}>Strength</Text>
        <Text style={styles.titleLine}>Coach UI</Text>
      </View>

      {/* Welcome */}
      <View style={styles.welcomeBlock}>
        <Text style={styles.welcomeLabel}>Welcome</Text>
        <Text style={styles.welcomeName}>{firstName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
  menuBtn: {
    padding: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 999,
  },
  menuText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  titleLine: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F9FAFB',
    lineHeight: 16,
  },
  welcomeBlock: {
    alignItems: 'flex-end',
  },
  welcomeLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  welcomeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
  },
});