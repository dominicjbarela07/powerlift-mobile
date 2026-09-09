import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { Text } from '@/components/ui/sl-text';
import { SLLayout, SLRadius, SLSpacing } from '@/constants/theme';

import { useCoachAthleteWorkspace } from './CoachAthleteWorkspaceContext';

const ROOMS = [
  { key: 'journey', label: 'Journey', detail: 'Blocks, phases, Sessions, and history', icon: 'map-outline' },
  { key: 'strength', label: 'Strength', detail: 'Core lifts, standards, records, and analysis', icon: 'barbell-outline' },
  { key: 'achievements', label: 'Achievements', detail: 'PRs, tiers, milestones, and awards', icon: 'trophy-outline' },
  { key: 'accessories', label: 'Accessories', detail: 'Movement progress, volume, and muscle evidence', icon: 'fitness-outline' },
  { key: 'variants', label: 'Variants', detail: 'Core-variant history and progression', icon: 'git-branch-outline' },
  { key: 'archive', label: 'Archive', detail: 'Complete Session and evidence history', icon: 'archive-outline' },
] as const;

export function CoachAthleteEvidence() {
  const router = useRouter();
  const workspace = useCoachAthleteWorkspace();
  const athlete = workspace.bootstrap?.athlete;
  if (!athlete) return null;

  const openRoom = (key: typeof ROOMS[number]['key']) => {
    router.push({
      pathname: `/(tabs)/ledger/${key}` as any,
      params: {
        athleteId: String(athlete.id),
        athlete_id: String(athlete.id),
        returnToWorkspace: '1',
        workspaceAthleteId: String(athlete.id),
        workspaceReturn: 'evidence',
      },
    } as any);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <Text style={styles.kicker}>ATHLETE EVIDENCE</Text>
        <Text style={styles.title}>{athlete.name}’s Ledger</Text>
        <Text style={styles.subtitle}>Every room below inherits the verified athlete subject from this workspace.</Text>
      </View>
      <View style={styles.list}>
        {ROOMS.map((room, index) => (
          <Pressable accessibilityRole="button" key={room.key} onPress={() => openRoom(room.key)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={styles.index}>{`${index + 1}`.padStart(2, '0')}</Text>
            <View style={styles.icon}><Ionicons color={COACH_V2.violetBright} name={room.icon} size={22} /></View>
            <View style={styles.flex}><Text style={styles.rowTitle}>{room.label}</Text><Text style={styles.rowDetail}>{room.detail}</Text></View>
            <Ionicons color={COACH_V2.muted} name="chevron-forward" size={18} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.guard}>Athlete ID is addressing only. Each Ledger resource independently enforces the active coaching relationship.</Text>
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: SLSpacing.lg, padding: SLLayout.screenGutter, paddingBottom: 96 },
  intro: { paddingTop: 4 },
  kicker: { color: COACH_V2.violetBright, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: COACH_V2.text, fontSize: 28, fontWeight: '800', marginTop: 4 },
  subtitle: { color: COACH_V2.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  list: { backgroundColor: COACH_V2.surface, borderColor: COACH_V2.border, borderRadius: SLRadius.lg, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 13 },
  row: { alignItems: 'center', borderBottomColor: COACH_V2.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, minHeight: 76, paddingVertical: 10 },
  index: { color: COACH_V2.subtle, fontSize: 11, fontWeight: '800', width: 20 },
  icon: { alignItems: 'center', backgroundColor: 'rgba(157,92,255,0.12)', borderRadius: 13, height: 43, justifyContent: 'center', width: 43 },
  flex: { flex: 1, minWidth: 0 },
  rowTitle: { color: COACH_V2.text, fontSize: 16, fontWeight: '800' },
  rowDetail: { color: COACH_V2.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  pressed: { opacity: 0.7 },
  guard: { color: COACH_V2.subtle, fontSize: 11, lineHeight: 16, paddingHorizontal: 4 },
  bottomSpace: { height: SLSpacing.xl },
});
