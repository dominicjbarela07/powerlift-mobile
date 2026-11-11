import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { setResultLabel, type CompletedSessionRecapPayload } from '@/components/coach-mobile/CompletedSessionRecap';
import { KeyboardScrollView } from '@/components/keyboard/KeyboardSurface';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLFontFamilies, SLSelfCoach as C } from '@/constants/theme';
import { formatCompactVolumeValueFromKg } from '@/lib/display-units';
import { TRAINING_SESSION_TITLE, trainingSessionTitle } from '@/lib/training-session-title';
import { reuseSelfCoachWorkout } from '@/lib/self-coach-workouts';
import { SLFloatingNavigationDock } from '@/components/navigation/sl-tab-row-control';

export function SelfCoachWorkoutSaved({ owner, workoutId, recap, unit, top, bottom, unrecordedSets, onView, onDone, onTrain, onPlan, onProgress }: {
  owner: string; workoutId: number; recap: CompletedSessionRecapPayload; unit: 'lb' | 'kg'; top: number; bottom: number;
  unrecordedSets: boolean;
  onView: () => void; onDone: () => void; onTrain: () => void; onPlan: () => void; onProgress: () => void;
}) {
  const sessionTitle = trainingSessionTitle(recap.session.label);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(sessionTitle === TRAINING_SESSION_TITLE ? 'My routine' : sessionTitle);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const save = async () => {
    if (saving.current || !name.trim() || saved) return;
    saving.current = true; setBusy(true); setError('');
    try {
      await reuseSelfCoachWorkout({ owner, workoutId, action: 'save_routine', name: name.trim() });
      setSaved(true); setNaming(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save routine. Try again.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const session = recap.session;
  const volume = formatCompactVolumeValueFromKg(session.total_volume_kg, unit);
  const featuredMovement = recap.performed_movements.find(movement => movement.sets.length > 0);
  const featuredSet = featuredMovement?.sets.find(set => set.id === featuredMovement.best_set?.set_log_id) || featuredMovement?.sets[0];
  const canSaveRoutine = recap.plan.movements.length > 0 || recap.performed_movements.length > 0;
  return <View style={s.screen} testID="self-coach-workout-saved">
    <KeyboardScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingTop: top + 28, paddingBottom: bottom + 100 }]}>
      <Image accessibilityLabel="Strength Ledger" source={require('@/assets/images/16:9.png')} contentFit="contain" style={s.brandImage} />
      <View style={s.heading}><Ionicons name="checkmark-circle-outline" color={C.success} size={34} /><Text style={s.title}>Session saved</Text></View>
      <View style={s.rule} />
      {featuredMovement && featuredSet ? <>
        <Text style={s.secondary}>RECORDED</Text><Text style={s.workout}>{featuredMovement.label}</Text>
        <Text style={s.performance}>{setResultLabel(featuredSet, featuredMovement, unit)}</Text>
      </> : <Text style={s.workout}>{sessionTitle === TRAINING_SESSION_TITLE ? 'Your work, recorded.' : sessionTitle}</Text>}
      <View style={s.metrics}>
        <View><Text style={s.number}>{session.set_count}</Text><Text style={s.secondary}>{session.set_count === 1 ? 'set saved' : 'sets saved'}</Text></View>
        <View><Text style={s.number}>{session.movement_count}</Text><Text style={s.secondary}>{session.movement_count === 1 ? 'exercise' : 'exercises'}</Text></View>
        {session.duration_seconds != null && session.duration_seconds > 0 ? <View><Text style={s.number}>{Math.max(1, Math.round(session.duration_seconds / 60))}</Text><Text style={s.secondary}>minutes</Text></View> : null}
      </View>
      {volume ? <Text style={s.secondary}>{volume} recorded volume</Text> : null}
      {unrecordedSets ? <Text style={s.secondary}>Saved with some planned sets unrecorded.</Text> : null}
      <View style={s.art}>
        <Image source={require('@/assets/images/onboarding/loaded-iron-welcome-v1.png')} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]} contentFit="cover" contentPosition={{ top: '25%', left: '50%' }} />
        <LinearGradient colors={[C.canvas, 'rgba(16,14,22,0.1)', C.canvas]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFillObject} />
      </View>
      {naming ? <View style={s.nameSection}><Text style={s.secondary}>Routine name</Text><TextInput accessibilityLabel="Routine name" value={name} onChangeText={setName} maxLength={120} editable={!busy} style={s.input} />
        <Pressable onPress={() => setNaming(false)} disabled={busy} style={s.link}><Text style={s.secondary}>Cancel</Text></Pressable></View> : null}
      {canSaveRoutine ? <Pressable accessibilityRole="button" disabled={busy || (naming && !name.trim())} onPress={saved ? onPlan : naming ? save : () => setNaming(true)} style={({ pressed }) => [s.primary, (pressed || busy) && s.dim]}>
        {busy ? <ActivityIndicator color={C.accentInk} /> : <Text style={s.primaryText}>{saved ? 'Routine saved · Open Plan' : naming ? 'Save routine' : 'Save as routine'}</Text>}
      </Pressable> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {saved ? <Text style={s.confirmation}>Exercise structure saved. Your original session stays in your history.</Text> : null}
      <Pressable onPress={onView} accessibilityRole="button" style={s.link}><Text style={s.linkText}>View session</Text></Pressable>
      <Pressable onPress={onDone} accessibilityRole="button" style={s.link}><Text style={s.secondary}>Done</Text></Pressable>
    </KeyboardScrollView>
    <SLFloatingNavigationDock bottomInset={bottom} items={[
      { key: 'train', label: 'Train', accessibilityLabel: 'Train', icon: 'barbell-outline', selected: true, onPress: onTrain },
      { key: 'plan', label: 'Plan', accessibilityLabel: 'Plan', icon: 'calendar-outline', onPress: onPlan },
      { key: 'progress', label: 'Progress', accessibilityLabel: 'Progress', icon: 'book-outline', onPress: onProgress },
    ]} />
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas }, content: { paddingHorizontal: 24 }, brandImage: { width: 150, height: 34, alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 32 }, title: { color: C.text, fontSize: 28, fontFamily: SLFontFamilies.sansBold }, rule: { width: 40, height: 2, backgroundColor: C.accent, marginVertical: 22 }, workout: { color: C.text, fontSize: 25, lineHeight: 31, fontFamily: SLFontFamilies.sansSemiBold },
  performance: { color: C.text, fontSize: 36, lineHeight: 43, fontFamily: SLFontFamilies.sansBold, marginTop: 6 }, metrics: { flexDirection: 'row', gap: 32, marginVertical: 16 }, number: { color: C.text, fontSize: 25, lineHeight: 31, fontFamily: SLFontFamilies.sansBold }, secondary: { color: C.secondary, fontSize: 14, lineHeight: 21 }, art: { height: 180, marginHorizontal: -24, overflow: 'hidden' }, primary: { minHeight: 52, borderRadius: 15, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, primaryText: { color: C.accentInk, fontSize: 17, fontFamily: SLFontFamilies.sansSemiBold }, dim: { opacity: 0.5 },
  link: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, linkText: { color: C.text, fontSize: 16 }, nameSection: { gap: 8, marginBottom: 12 }, input: { minHeight: 48, backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, color: C.text, fontSize: 17 }, error: { color: C.danger, marginTop: 12, lineHeight: 21 }, confirmation: { color: C.success, fontSize: 13, lineHeight: 19, marginTop: 10 },
});
