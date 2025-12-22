// components/AppHeader.tsx

import React from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';

type AppHeaderProps = {
  firstName: string;
  onPressMenu?: () => void;
  onPressLogo?: () => void;
};

export function AppHeader({ firstName, onPressMenu, onPressLogo }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Menu (absolute left) */}
      <View style={styles.leftSlot}>
        <Pressable style={styles.menuBtn} onPress={onPressMenu}>
          <Text style={styles.menuText}>☰ Menu</Text>
        </Pressable>
      </View>

      {/* Center Logo (absolute center) */}
      <View style={styles.centerSlot}>
        <Pressable onPress={onPressLogo} hitSlop={8}>
          <Image
            source={require('../assets/images/app_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Pressable>
      </View>

      {/* Welcome (absolute right) */}
      <View style={styles.rightSlot}>
        <View style={styles.welcomeBlock}>
          <Text style={styles.welcomeLabel}>Welcome</Text>
          <Text style={styles.welcomeName}>{firstName}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    paddingBottom: 10,
    backgroundColor: '#020617',
    justifyContent: 'center',
    position: 'relative',
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
    fontSize: 16,
  },
  leftSlot: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  centerSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightSlot: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  titleLine: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F9FAFB',
    lineHeight: 20,
  },
  welcomeBlock: {
    alignItems: 'flex-end',
  },
  welcomeLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  welcomeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  logo: {
    height: 60,
    width:60,
  },
});