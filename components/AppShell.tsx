import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { AppHeader } from './AppHeader';

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  return (
    <ThemedView style={styles.screen}>
      <View style={styles.body}>
        {children}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  body: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 24,
  },
});