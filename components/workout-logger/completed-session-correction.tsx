import { useSLReducedMotion } from '@/lib/motion';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from '@/components/ui/sl-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchJson } from '@/lib/api';
import { formatLoggerWeightKg, KG_PER_LB } from '@/lib/logger-weight-format';
import { resolveLoggerMovementIdentity, type LoggerMovementIdentityItem } from '@/lib/logger-movement-identity';
import { SLFontFamilies } from '@/constants/theme';

type EvidenceSet = { performed_canonical_movement_identity?: { id: number; display_name?: string | null } | null; performed_label_snapshot?: string | null; id: number; set_index: number; actual_weight_kg: number; actual_reps: number; actual_rpe?: number | null; actual_rir?: number | null };
type EvidenceItem = LoggerMovementIdentityItem & { id: number; movement?: string; variant?: string; evidence_revision?: number; set_logs: EvidenceSet[] };
export function CompletedSessionCorrection({ mode, workoutId, items, note, unit, onClose, onSaved }: {
  mode: 'sets' | 'note' | null; workoutId: number; items: EvidenceItem[]; note: string; unit: 'kg' | 'lb'; onClose: () => void; onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useSLReducedMotion();
  const [selection, setSelection] = useState<{ item: EvidenceItem; set: EvidenceSet } | null>(null);
  const [form, setForm] = useState({ weight: '', reps: '', effort: '' });
  const [draftNote, setDraftNote] = useState(note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const subject = useRef({ workoutId, mode });
  subject.current = { workoutId, mode };
  useEffect(() => { setSelection(null); setDraftNote(note); setError(''); setBusy(false); }, [mode, workoutId, note]);
  const save = async () => {
    if (busy || !mode) return;
    const dispatched = { workoutId, mode };
    setBusy(true); setError('');
    try {
      let path = `/workouts/mobile/${workoutId}/post_session_note`;
      let payload: object = { note: draftNote, previous_note: note };
      if (mode === 'sets') {
        if (!selection) return;
        const weight = Number(form.weight), reps = Number(form.reps), effort = form.effort.trim() === '' ? null : Number(form.effort);
        if (!form.weight.trim() || !Number.isFinite(weight) || weight < 0 || !form.reps.trim() || !Number.isInteger(reps) || reps < 0 || (effort != null && (!Number.isFinite(effort) || effort < 0 || effort > 10))) throw new Error('Enter a valid load, whole reps and optional effort from 0–10.');
        path = `/workouts/mobile/${workoutId}/items/${selection.item.id}/edit_set`;
        payload = { set_log_id: selection.set.id, set_index: selection.set.set_index, expected_evidence_revision: selection.item.evidence_revision,
          actual_weight_kg: form.weight === formatLoggerWeightKg(selection.set.actual_weight_kg, unit) ? selection.set.actual_weight_kg : unit === 'kg' ? weight : weight * KG_PER_LB, actual_reps: reps,
          actual_rpe: selection.item.variant === 'ACC' || reps === 0 ? null : effort,
          actual_rir: selection.item.variant === 'ACC' && reps > 0 ? effort : null };
      }
      const response = await fetchJson<{ ok: boolean; error?: string }>(path, { method: mode === 'note' ? 'PATCH' : 'POST', auth: true, body: JSON.stringify(payload) });
      if (!mounted.current || subject.current.workoutId !== dispatched.workoutId || subject.current.mode !== dispatched.mode) return;
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Correction could not be saved.');
      onSaved(); onClose();
    } catch (failure) { if (mounted.current && subject.current.workoutId === dispatched.workoutId) setError(failure instanceof Error ? failure.message : 'Correction could not be saved.'); }
    finally { if (mounted.current && subject.current.workoutId === dispatched.workoutId) setBusy(false); }
  };
  return <Modal visible={mode != null} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close correction" /><View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
    <View style={s.heading}><Text style={s.title}>{mode === 'note' ? 'Session note' : selection ? 'Correct set' : 'Correct performed work'}</Text><Pressable onPress={onClose} accessibilityLabel="Close" style={s.close}><Ionicons name="close" color="#eee" size={24} /></Pressable></View>
    <Text style={s.subtitle}>Your Session stays completed. Saved reflection is preserved.</Text>
    <ScrollView keyboardShouldPersistTaps="handled">
      {mode === 'note' ? <TextInput accessibilityLabel="Session note" value={draftNote} onChangeText={setDraftNote} multiline maxLength={10000} style={[s.input, s.note]} /> : selection ? <>
        <Text style={s.name}>{selection.set.performed_canonical_movement_identity?.display_name || selection.set.performed_label_snapshot || resolveLoggerMovementIdentity(selection.item).displayName} · Set {selection.set.set_index}</Text>
        <View style={s.fields}>{(['weight', 'reps', 'effort'] as const).map(field => <View key={field} style={s.field}><Text style={s.subtitle}>{field === 'weight' ? `Load (${unit})` : field === 'reps' ? 'Reps' : selection.item.variant === 'ACC' ? 'RIR' : 'RPE'}</Text><TextInput accessibilityLabel={field} keyboardType="decimal-pad" value={form[field]} onChangeText={value => setForm(current => ({ ...current, [field]: value.replace(',', '.') }))} style={s.input} /></View>)}</View>
      </> : items.map(item => <View key={item.id}><Text style={s.name}>{resolveLoggerMovementIdentity(item).displayName}</Text>{item.set_logs.map(set => <Pressable key={set.id} onPress={() => { setSelection({ item, set }); setForm({ weight: formatLoggerWeightKg(set.actual_weight_kg, unit), reps: String(set.actual_reps), effort: String(set.actual_rpe ?? set.actual_rir ?? '') }); }} style={s.setRow} accessibilityRole="button"><Text style={s.subtitle}>{set.performed_canonical_movement_identity?.display_name || set.performed_label_snapshot || `Set ${set.set_index}`}</Text><Text style={s.result}>{formatLoggerWeightKg(set.actual_weight_kg, unit)} {unit} × {set.actual_reps}</Text><Ionicons name="create-outline" color="#b995ef" size={19} /></Pressable>)}</View>)}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {mode === 'note' || selection ? <Pressable disabled={busy} onPress={() => { void save(); }} style={s.save} accessibilityRole="button">{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save correction</Text>}</Pressable> : null}
    </ScrollView>
  </View></KeyboardAvoidingView></Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000a' }, sheet: { maxHeight: '85%', backgroundColor: '#120e1b', padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#42334e' }, heading: { flexDirection: 'row', alignItems: 'center' }, title: { flex: 1, color: '#f4effa', fontFamily: SLFontFamilies.sansBold, fontSize: 25 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, subtitle: { color: '#bcb2cb', fontSize: 12, lineHeight: 18 }, name: { color: '#eee5f8', fontFamily: SLFontFamilies.sansSemiBold, fontSize: 17, marginTop: 22, marginBottom: 10 }, fields: { flexDirection: 'row', gap: 12 }, field: { flex: 1 }, input: { color: '#fff', backgroundColor: '#09070f', borderWidth: 1, borderColor: '#4c3b5c', borderRadius: 12, padding: 12, minHeight: 52, fontSize: 22, marginTop: 8 }, note: { minHeight: 170, fontSize: 16, textAlignVertical: 'top' }, setRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#33293c' }, result: { color: '#eee8f6', flex: 1, fontSize: 15 }, error: { color: '#ff9db0', marginTop: 12 }, save: { backgroundColor: '#7941ce', minHeight: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 14, marginTop: 22 }, saveText: { color: '#fff', fontSize: 16, fontFamily: SLFontFamilies.sansBold },
});
