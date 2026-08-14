import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CoachCardChevron, CoachMobileHeader, CoachSectionHeading, COACH_V2 } from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLScreen } from '@/components/ui';
import { Text } from '@/components/ui/sl-text';

export default function CoachMoreRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const athleteId = Array.isArray(params.athleteId) ? params.athleteId[0] : params.athleteId;
  const athleteName = Array.isArray(params.athleteName) ? params.athleteName[0] : params.athleteName;
  const context = athleteId ? { athleteId: String(athleteId), athleteName: String(athleteName || '') } : undefined;
  const tools = [
    { label: 'Programming', detail: athleteId ? `Program ${athleteName || 'athlete'}` : 'Manage athlete programming', icon: 'calendar-outline' as const, route: '/(tabs)/workout' },
    { label: 'Review Hub', detail: 'Sessions and videos waiting for review', icon: 'clipboard-outline' as const, route: '/(tabs)/coach-videos' },
    { label: 'Coach Calendar', detail: 'Schedule and athlete context', icon: 'today-outline' as const, route: '/(tabs)/coach-calendar' },
    { label: 'Check-Ins', detail: 'Assigned and submitted check-ins', icon: 'checkbox-outline' as const, route: '/(tabs)/check-ins' },
  ];
  return (
    <SLScreen edges="top" padded={false} style={styles.screen}>
      <CoachMobileHeader onBack={() => router.back()} title="More" />
      <ScrollView contentContainerStyle={styles.content}>
        <CoachSectionHeading title={athleteId ? `Tools for ${athleteName || 'Athlete'}` : 'Coach Tools'} />
        <View style={styles.card}>
          {tools.map((tool) => (
            <Pressable
              accessibilityRole="button"
              key={tool.label}
              onPress={() => router.push({ pathname: tool.route, params: context } as any)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.icon}><Ionicons color={COACH_V2.violetBright} name={tool.icon} size={20} /></View>
              <View style={styles.copy}>
                <Text style={styles.label}>{tool.label}</Text>
                <Text style={styles.detail}>{tool.detail}</Text>
              </View>
              <CoachCardChevron />
            </Pressable>
          ))}
        </View>
        <CoachSectionHeading title="Account" />
        <View style={styles.card}>
          <Pressable onPress={() => router.push('/coach-team-brief' as any)} style={styles.row}>
            <View style={styles.icon}><Ionicons color={COACH_V2.cyan} name="reader-outline" size={20} /></View>
            <View style={styles.copy}><Text style={styles.label}>Team Brief</Text><Text style={styles.detail}>Evidence-backed team summary</Text></View>
            <CoachCardChevron />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/settings')} style={styles.row}>
            <View style={styles.icon}><Ionicons color={COACH_V2.muted} name="settings-outline" size={20} /></View>
            <View style={styles.copy}><Text style={styles.label}>Settings</Text><Text style={styles.detail}>Profile, workspace, and account</Text></View>
            <CoachCardChevron />
          </Pressable>
        </View>
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SLScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COACH_V2.black },
  content: { gap: 10, paddingTop: 12 },
  card: { overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COACH_V2.border },
  icon: { width: 42, height: 42, borderRadius: 9, backgroundColor: '#11131B', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  label: { color: COACH_V2.text, fontSize: 14, fontWeight: '800' },
  detail: { marginTop: 3, color: COACH_V2.muted, fontSize: 10 },
  pressed: { opacity: 0.7 },
  bottomSpace: { height: 84 },
});
