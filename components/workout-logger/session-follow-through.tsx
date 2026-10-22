import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import SetVideoPlayerModal from '@/components/SetVideoPlayerModal';

type Cue = { id: number; cue: string; movement: string; workout_item_ids: number[];
  source_video_id: number; source_time_seconds: number | null; source_date: string | null };

/** Read-only coach-authored cue; logging, equipment selection and prescription stay canonical. */
export function SessionFollowThrough({ workoutId, focusedItemId }: { workoutId: number; focusedItemId?: number | null }) {
  const [cues, setCues] = useState<Cue[]>([]);
  const [error, setError] = useState(false);
  const [video, setVideo] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let current = true;
    setCues([]); setError(false);
    void fetchJson<{ok?: boolean; cues?: Cue[]}>(`/coaching/mobile/sessions/${workoutId}/cues`)
      .then(({ ok, json }) => { if (current) { if (!ok || !json?.ok) setError(true); else setCues(json.cues || []); } })
      .catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [workoutId, retry]));
  const visible = focusedItemId ? cues.filter(c => c.workout_item_ids.includes(focusedItemId)) : cues;
  if (error) return <Pressable accessibilityRole="button" accessibilityLabel="Retry loading coaching focus" onPress={() => setRetry(n => n + 1)} style={s.retry}><Text style={s.meta}>Coaching focus couldn’t load. Tap to retry.</Text></Pressable>;
  if (!visible.length) return null;
  return <View style={s.stack}>{visible.map(cue => <View key={cue.id} style={s.focus}>
    <View style={s.header}><Ionicons name="arrow-forward-circle-outline" size={18} color={SLColors.accent} /><Text style={s.eyebrow}>CARRY THIS FORWARD</Text></View>
    <Text style={s.movement}>{cue.movement}</Text><Text style={s.cue}>{cue.cue}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Watch the reference for ${cue.movement}`} onPress={() => setVideo(cue.source_video_id)} style={s.reference}>
      <Ionicons name="play-circle-outline" size={20} color={SLColors.accent} /><Text style={s.link}>Watch your reference{cue.source_time_seconds != null ? ` · cue at ${Math.floor(cue.source_time_seconds / 60)}:${String(Math.floor(cue.source_time_seconds % 60)).padStart(2, '0')}` : ''}</Text>
    </Pressable><Text style={s.meta}>Your current Session prescription stays below.</Text>
  </View>)}<SetVideoPlayerModal visible={video !== null} videoId={video} initialTimeSeconds={cues.find(c => c.source_video_id === video)?.source_time_seconds} allowExport={false} onClose={() => setVideo(null)} /></View>;
}
const s = StyleSheet.create({
  stack: { gap: 10, marginVertical: 12 },
  focus: { backgroundColor: SLColors.surface, borderRadius: 14, borderWidth: 1, borderColor: SLColors.border, padding: 18, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: { fontFamily: SLFontFamilies.bodySemiBold, fontSize: 10, letterSpacing: 1.5, color: SLColors.accent },
  movement: { fontSize: 12, color: SLColors.textMuted },
  cue: { fontSize: 17, lineHeight: 25, color: SLColors.text },
  reference: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  link: { color: SLColors.accent, fontSize: 13, flexShrink: 1 },
  meta: { fontSize: 11, lineHeight: 17, color: SLColors.textMuted },
  retry: { minHeight: 44, justifyContent: 'center', paddingVertical: 10 },
});
