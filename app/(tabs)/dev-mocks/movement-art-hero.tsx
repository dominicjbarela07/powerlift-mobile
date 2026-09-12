import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/sl-text';
import { MovementArtworkHero } from '@/components/movement/MovementArtworkHero';
import { SessionV3Movement } from '@/components/workout-logger/session-v3-movement';
import { CANONICAL_ACCESSORY_ARTWORK_IDENTITIES, type CanonicalMovementArtworkInput } from '@/lib/canonical-movement-artwork';
import { CANONICAL_ACCESSORY_MOVEMENT_ARTWORK } from '@/lib/canonical-movement-artwork-assets';
import { movementHeroFocal, resolveApprovedExactMovementArtwork, type MovementHeroFocal } from '@/lib/movement-artwork-hero';

const SUBJECTS = [
  { id: 33, title: 'Incline Dumbbell Bench Press' }, { id: 253, title: 'Dumbbell Curl' },
  { id: 154, title: 'One-Arm Dumbbell Row' }, { id: 256, title: 'Standing Dumbbell Curl' },
  { id: 354, title: 'Bulgarian Split Squat' },
  { id: 121, title: 'Machine Lateral Raise', key: 'accessory_machine_lateral_raise', primary: 'side_delts' },
  { id: 113, title: 'Cable Lateral Raise', key: 'accessory_cable_lateral_raise', primary: 'side_delts' },
];

/** Crop inspection is visibly separated from product eligibility. This route
 * cannot approve, promote, save a Set or override the Logger's approval gate. */
export default function MovementArtHeroLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ movement?: string; mode?: string }>();
  const [selected, setSelected] = useState(Number(params.movement) || 33);
  const [mode, setMode] = useState<'logger' | 'crop' | 'source'>(params.mode === 'crop' ? 'crop' : 'logger');
  const entry = SUBJECTS.find(row => row.id === selected) || SUBJECTS[0];
  const registered = CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[entry.id as keyof typeof CANONICAL_ACCESSORY_ARTWORK_IDENTITIES];
  const movement: CanonicalMovementArtworkInput = { identity_type: 'accessory', id: entry.id,
    key: registered?.key || entry.key, primary_muscle_group: registered?.primary || entry.primary };
  const approved = resolveApprovedExactMovementArtwork(movement);
  const [focal, setFocal] = useState<MovementHeroFocal>(registered ? movementHeroFocal(registered.key) : { focalX: 0.5, focalY: 0.45, scale: 1, biasX: 0, biasY: 0 });
  useEffect(() => { if (params.movement) setSelected(Number(params.movement)); if (params.mode === 'crop') setMode('crop'); }, [params.movement, params.mode]);
  useEffect(() => { if (registered) setFocal(movementHeroFocal(registered.key)); }, [registered]);
  if (!__DEV__) return null;
  const asset = registered ? CANONICAL_ACCESSORY_MOVEMENT_ARTWORK[registered.key] : null;
  return <ScrollView style={s.page} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100, paddingHorizontal: 16 }}>
    <Pressable accessibilityLabel="Close focal lab" onPress={() => router.back()} style={s.button}><Text style={s.link}>‹ Close focal lab</Text></Pressable>
    <Text style={s.kicker}>DEV · MOVEMENT ART FOCAL REVIEW</Text>
    <Text style={s.title}>{entry.title}</Text>
    <Text style={s.status}>{approved ? 'Human-approved exact art' : asset ? 'PENDING HUMAN REVIEW · not hero eligible' : 'No exact movement art · compact fallback'}</Text>
    <View style={s.row}>{(['logger', 'crop', 'source'] as const).map(value => <Pressable key={value} onPress={() => setMode(value)} style={[s.button, mode === value && s.selected]}><Text style={s.link}>{value === 'logger' ? 'Actual Logger' : value === 'crop' ? 'Crop study' : 'Source'}</Text></Pressable>)}</View>
    {mode === 'logger' ? <SessionV3Movement title={entry.title} index={1} expanded complete={false} active reduceMotion onOpen={() => undefined}
      visual={{ liftLabel: entry.title, liftAccentColor: '#ab83e3', movementArtworkInput: movement }}
      focus={{ movementName: entry.title, currentSetLabel: 'Set 1', currentSetPositionLabel: 'SET 1 OF 3', currentSetRepsLabel: '12–15 reps', currentSetEffortLabel: '1 RIR', progressionLabel: '0 / 3', rail: [], canLog: false, canRepeat: false }} />
      : mode === 'source' ? asset ? <Image source={asset.source} contentFit="contain" style={s.study} cachePolicy="memory-disk" /> : <Text style={s.note}>No source image exists for this identity.</Text>
      : asset && registered ? <>
        <Text style={s.warning}>{approved ? 'APPROVED SOURCE · presentation study' : 'CANDIDATE CROP STUDY · NOT APPROVED'}</Text>
        <View style={s.study}>
          <MovementArtworkHero artworkKey={registered.key} receiptId={`dev-crop:${registered.key}`} focal={focal} reduceMotion />
          <Text style={s.studyTitle}>{entry.title}</Text>
          <View style={s.prescription}><Text style={s.kicker}>PRESCRIBED</Text><Text style={s.reps}>12–15</Text><Text style={s.effort}>reps · 1 RIR</Text></View>
        </View>
        {(Object.keys(focal) as (keyof MovementHeroFocal)[]).map(key => <View key={key} style={s.control}>
          <Text style={s.note}>{key}: {focal[key].toFixed(2)}</Text>
          <Pressable accessibilityLabel={`Decrease ${key}`} style={s.button} onPress={() => setFocal(value => ({ ...value, [key]: value[key] - 0.02 }))}><Text style={s.link}>−</Text></Pressable>
          <Pressable accessibilityLabel={`Increase ${key}`} style={s.button} onPress={() => setFocal(value => ({ ...value, [key]: value[key] + 0.02 }))}><Text style={s.link}>+</Text></Pressable>
        </View>)}
        <Text selectable style={s.note}>{JSON.stringify({ artworkKey: registered.key, ...focal })}</Text>
        <Text style={s.note}>Local study only. Approval stays in the web review queue; focal presets are owned by movement-artwork-hero.ts.</Text>
      </> : <Text style={s.note}>No hero to crop. The normal Logger keeps its compact identity.</Text>}
    <View style={s.subjects}>{SUBJECTS.map(row => <Pressable key={row.id} accessibilityLabel={`Inspect ${row.title}`} onPress={() => setSelected(row.id)} style={s.subject}><Text style={s.link}>{row.id} · {row.title}</Text></Pressable>)}</View>
  </ScrollView>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  title: { color: '#fff', fontSize: 23, lineHeight: 29, marginVertical: 6 }, kicker: { color: '#b89be8', fontSize: 11, letterSpacing: 1 },
  status: { color: '#d8c5a5', fontSize: 12, lineHeight: 18 }, button: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  selected: { backgroundColor: '#231530', borderRadius: 8 }, link: { color: '#d4b9f3', fontSize: 13 },
  study: { height: 236, backgroundColor: '#000', position: 'relative' }, studyTitle: { color: '#fff', fontSize: 26, lineHeight: 31, fontWeight: '700', paddingVertical: 8 },
  prescription: { width: '53%', marginTop: 20 }, reps: { color: '#fff', fontSize: 50, fontWeight: '700' }, effort: { color: '#e6deee', fontSize: 17 },
  warning: { color: '#f1c58b', fontSize: 11, lineHeight: 18, marginTop: 8 },
  control: { flexDirection: 'row', alignItems: 'center', gap: 8 }, note: { color: '#b6abbe', fontSize: 12, lineHeight: 18, flex: 1, marginVertical: 5 },
  subjects: { marginTop: 10 }, subject: { minHeight: 44, justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2e2537' },
});
