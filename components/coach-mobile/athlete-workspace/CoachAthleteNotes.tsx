import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AthleteCoachingScratchpadTrigger } from '@/components/coach-mobile/AthleteCoachingScratchpad';
import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { Text } from '@/components/ui/sl-text';
import { SLLayout, SLRadius, SLSpacing } from '@/constants/theme';

import { useCoachAthleteWorkspace } from './CoachAthleteWorkspaceContext';

export function CoachAthleteNotes() {
  const workspace = useCoachAthleteWorkspace();
  const athlete = workspace.bootstrap?.athlete;
  const coachContext = workspace.summary?.coach_context;
  if (!athlete) return null;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View><Text style={styles.kicker}>COACH MEMORY</Text><Text style={styles.title}>Notes for {athlete.name}</Text><Text style={styles.subtitle}>Private coach-owned context remains scoped to relationship #{workspace.bootstrap?.subject.relationship_id}.</Text></View>
      {coachContext?.pinned_note ? <View style={styles.pinned}><Text style={styles.pinnedLabel}>PINNED NOTE</Text><Text style={styles.pinnedTitle}>{coachContext.pinned_note.title || 'Pinned coach note'}</Text><Text style={styles.pinnedBody}>{coachContext.pinned_note.body_preview || 'No preview available.'}</Text></View> : <View style={styles.empty}><Text style={styles.emptyTitle}>No pinned note</Text><Text style={styles.emptyBody}>Pinned coach context has not been recorded for this athlete.</Text></View>}
      <AthleteCoachingScratchpadTrigger athleteId={athlete.id} athleteName={athlete.name} variant="card" />
      <Text style={styles.guard}>Coach notes and scratchpad content are coach-owned relationship data. They do not transfer to another coach relationship.</Text>
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: SLSpacing.lg, padding: SLLayout.screenGutter, paddingBottom: 96 },
  kicker: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: COACH_V2.text, fontSize: 28, fontWeight: '800', marginTop: 4 },
  subtitle: { color: COACH_V2.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  pinned: { backgroundColor: 'rgba(243,184,62,0.08)', borderColor: 'rgba(243,184,62,0.35)', borderRadius: SLRadius.lg, borderWidth: 1, padding: 15 },
  pinnedLabel: { color: COACH_V2.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  pinnedTitle: { color: COACH_V2.text, fontSize: 17, fontWeight: '800', marginTop: 7 },
  pinnedBody: { color: COACH_V2.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  empty: { backgroundColor: COACH_V2.surface, borderColor: COACH_V2.border, borderRadius: SLRadius.lg, borderWidth: 1, padding: 15 },
  emptyTitle: { color: COACH_V2.text, fontSize: 15, fontWeight: '800' },
  emptyBody: { color: COACH_V2.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  guard: { color: COACH_V2.subtle, fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
  bottomSpace: { height: SLSpacing.xl },
});
