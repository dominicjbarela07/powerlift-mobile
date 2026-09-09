import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AthleteLedgerSubjectProvider, useAthleteLedgerSubject } from '@/components/ledger/athlete-ledger-subject';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLLayout } from '@/constants/theme';

export default function LedgerLayout() {
  return <AthleteLedgerSubjectProvider><LedgerSubjectGate /></AthleteLedgerSubjectProvider>;
}

function LedgerSubjectGate() {
  const subject = useAthleteLedgerSubject();
  if (subject.isWorkspaceScoped && !subject.valid) {
    return <View style={styles.state}><Text style={styles.title}>Athlete evidence unavailable</Text><Text style={styles.body}>The athlete workspace subject could not be verified. Return to Coach Home and reopen the athlete.</Text></View>;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', backgroundColor: SLColors.canvas, flex: 1, justifyContent: 'center', padding: SLLayout.screenGutter },
  title: { color: SLColors.textStrong, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { color: SLColors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8, maxWidth: 340, textAlign: 'center' },
});
