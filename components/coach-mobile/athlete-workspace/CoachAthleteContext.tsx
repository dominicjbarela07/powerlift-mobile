import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { Text } from '@/components/ui/sl-text';
import { SLLayout, SLRadius, SLSpacing } from '@/constants/theme';

import { useCoachAthleteWorkspace } from './CoachAthleteWorkspaceContext';

const FIELDS = [
  ['federation', 'Federation', 'ribbon-outline'],
  ['weight_class', 'Weight class', 'scale-outline'],
  ['equipment_access', 'Equipment access', 'barbell-outline'],
  ['injury_notes', 'Injuries / limitations', 'medkit-outline'],
  ['mobility_limitations', 'Mobility restrictions', 'body-outline'],
  ['preferred_cues', 'Preferred cues', 'megaphone-outline'],
  ['timezone', 'Timezone', 'time-outline'],
] as const;

export function CoachAthleteContext() {
  const workspace = useCoachAthleteWorkspace();
  const bootstrap = workspace.bootstrap;
  if (!bootstrap) return null;
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View><Text style={styles.kicker}>ATHLETE CONTEXT</Text><Text style={styles.title}>{bootstrap.athlete.name}</Text><Text style={styles.subtitle}>Profile context recorded for this athlete. Missing values remain explicitly unrecorded.</Text></View>
      <View style={styles.card}>
        {FIELDS.map(([key, label, icon]) => {
          const value = bootstrap.athlete_context[key];
          return <View key={key} style={styles.row}><View style={styles.icon}><Ionicons color={value ? COACH_V2.violetBright : COACH_V2.subtle} name={icon} size={19} /></View><View style={styles.flex}><Text style={styles.label}>{label}</Text><Text style={[styles.value, !value && styles.empty] }>{value || 'Not recorded'}</Text></View></View>;
        })}
      </View>
      <View style={styles.relationship}>
        <Ionicons color={COACH_V2.green} name="link-outline" size={20} />
        <View style={styles.flex}><Text style={styles.relationshipTitle}>Active coaching relationship</Text><Text style={styles.relationshipMeta}>Relationship #{bootstrap.subject.relationship_id} · authorization verified by the server</Text></View>
      </View>
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: SLSpacing.lg, padding: SLLayout.screenGutter, paddingBottom: 96 },
  kicker: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: COACH_V2.text, fontSize: 28, fontWeight: '800', marginTop: 4 },
  subtitle: { color: COACH_V2.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  card: { backgroundColor: COACH_V2.surface, borderColor: COACH_V2.border, borderRadius: SLRadius.lg, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 14 },
  row: { alignItems: 'flex-start', borderBottomColor: COACH_V2.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 11, paddingVertical: 13 },
  icon: { alignItems: 'center', backgroundColor: COACH_V2.surfaceRaised, borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  flex: { flex: 1, minWidth: 0 },
  label: { color: COACH_V2.subtle, fontSize: 10, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
  value: { color: COACH_V2.text, fontSize: 14, lineHeight: 20, marginTop: 4 },
  empty: { color: COACH_V2.subtle, fontStyle: 'italic' },
  relationship: { alignItems: 'center', backgroundColor: 'rgba(85,214,138,0.08)', borderColor: 'rgba(85,214,138,0.28)', borderRadius: SLRadius.md, borderWidth: 1, flexDirection: 'row', gap: 11, padding: 14 },
  relationshipTitle: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  relationshipMeta: { color: COACH_V2.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  bottomSpace: { height: SLSpacing.xl },
});
