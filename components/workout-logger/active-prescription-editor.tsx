import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import { Text, TextInput } from '@/components/ui/sl-text';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { MovementQuickPrescriptionEditor } from '@/components/coach-mobile/SessionEditingWorkspace';
import { movementDraftFromItem, type CoachMovementDraft, type CoachEditorItem } from '@/lib/coach-session-editor';
import { activePrescriptionPatch } from '@/lib/active-session-prescription';
import { fetchJson } from '@/lib/api';
import { SLColors, SLFontFamilies } from '@/constants/theme';

export function ActivePrescriptionEditor({ workoutId, itemId, unit, onClose, onSaved }: {
  workoutId: number; itemId: number; unit: 'kg' | 'lb'; onClose: () => void;
  onSaved: (payload: any) => void;
}) {
  const [draft, setDraft] = useState<CoachMovementDraft | null>(null);
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const alive = useRef(true);
  const saving = useRef(false);
  const original = useRef<CoachMovementDraft | undefined>(undefined);
  const originalItem = useRef<CoachEditorItem | undefined>(undefined);
  const path = `/workouts/mobile/${workoutId}/items/${itemId}/prescription`;
  useEffect(() => {
    alive.current = true;
    void fetchJson(path, { method: 'GET', auth: true }).then(response => {
      if (!alive.current) return;
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Could not open the prescription.');
      const next = movementDraftFromItem(response.json.item, unit);
      original.current = next;
      originalItem.current = response.json.item;
      setDraft(next); setVersion(response.json.version);
      setManual(Boolean(next.targetLowLb || next.targetHighLb));
    }).catch(e => { if (alive.current) setError(e.message || 'Could not open the prescription.'); });
    return () => { alive.current = false; };
  }, [path, unit]);
  const kind = draft?.sourceVariant === 'ACC' || ['AX', 'ACC'].includes(draft?.sourceLift || '') ? 'accessory' : 'core';
  const save = async () => {
    if (!draft || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const prescription = activePrescriptionPatch(draft, kind, unit, original.current, originalItem.current);
      if (!Object.keys(prescription).length) { onClose(); return; }
      const response = await fetchJson(`${path}?history=summary`, { method: 'PATCH', auth: true,
        body: JSON.stringify({ version, prescription }) });
      if (!alive.current) return;
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Could not save the prescription.');
      onSaved(response.json);
      const notices = response.json.prescription_notices;
      if (notices?.length) Alert.alert('Prescription saved', notices.join('\n'));
      onClose();
    } catch (e: any) {
      if (alive.current) setError(e.message || 'Could not save the prescription.');
    } finally { saving.current = false; if (alive.current) setBusy(false); }
  };
  return <StrengthLedgerBottomSheet visible accessibilityLabel="Edit Prescription" heightFraction={0.86}
    dismissalBlocked={busy} onDismiss={onClose}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Edit Prescription</Text>
      {draft ? <>
        <Text style={s.name}>{draft.movement}{draft.sourceVariant === 'BK' ? ' · Backdowns' : draft.sourceVariant === 'TOP' ? ' · Top Sets' : ''}</Text>
        <Text style={s.hint}>For this Session. Completed Sets are kept.</Text>
        <MovementQuickPrescriptionEditor prescriptionOnly draft={draft} kind={kind} editable={!busy}
          accessibilityReflow={false} onChange={patch => setDraft(current => current ? { ...current, ...patch } : current)}
          storageUnit={unit} displayUnit={unit} calculatedTarget={null} backdownCalculatedTarget={null}
          calculatingTarget={false} manualOverrideEnabled={manual} backdownManualOverrideEnabled={false}
          onManualOverrideEnabledChange={setManual} onBackdownManualOverrideEnabledChange={() => {}} />
        <Text style={s.hint}>Prescription notes</Text>
        <TextInput accessibilityLabel="Prescription notes" value={draft.notes} editable={!busy} multiline maxLength={2000}
          onChangeText={notes => setDraft(current => current ? { ...current, notes } : current)} style={s.notes} />
      </> : !error ? <ActivityIndicator color={SLColors.accentViolet} /> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {draft ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void save(); }} style={s.save}>
        {busy ? <ActivityIndicator color={SLColors.textStrong} /> : <Text style={s.saveText}>Save Prescription</Text>}
      </Pressable> : null}
    </ScrollView>
  </StrengthLedgerBottomSheet>;
}
const s = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  title: { color: SLColors.textStrong, fontFamily: SLFontFamilies.sansBold, fontSize: 25 },
  name: { color: SLColors.textStrong, fontSize: 19 }, hint: { color: SLColors.textMuted, fontSize: 14 },
  notes: { color: SLColors.textStrong, minHeight: 70, padding: 12, borderWidth: 1, borderColor: SLColors.textMuted, borderRadius: 12 },
  error: { color: '#ff9db0', fontSize: 15 },
  save: { minHeight: 52, backgroundColor: SLColors.accentViolet, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  saveText: { color: SLColors.textStrong, fontFamily: SLFontFamilies.sansBold, fontSize: 17 },
});
