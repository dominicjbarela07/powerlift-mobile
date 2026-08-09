import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SLWorkspaceBackground } from '@/components/ui/sl-workspace';

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  return (
    <View style={styles.shell}>
      <SLWorkspaceBackground />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
});
