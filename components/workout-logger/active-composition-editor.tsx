import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLConfirmationModal } from '@/components/ui/sl-confirmation-modal';
import { StrengthLedgerBottomSheet } from '@/components/sheets/StrengthLedgerBottomSheet';
import { GovernedAccessorySubstitutionPickerModal } from '@/components/movement/GovernedAccessoryPickerModal';
import { MovementQuickPrescriptionEditor } from '@/components/coach-mobile/SessionEditingWorkspace';
import { type CoachMovementDraft } from '@/lib/coach-session-editor';
import { additionDraft, additionRequest, type AdditionSelection, type SessionComposition } from '@/lib/active-session-composition';
import { fetchJson } from '@/lib/api';
import { SLColors, SLFontFamilies } from '@/constants/theme';

export function ActiveCompositionEditor({ mode, workoutId, athlete, composition, unit, onClose, onSaved }: {
  mode: 'add' | 'remove'; workoutId: number; athlete: { id: number; sex?: string | null; anatomy_display_preference?: string | null };
  composition: SessionComposition; unit: 'kg' | 'lb'; onClose: () => void; onSaved: (payload: any) => void;
}) {
  const [selection, setSelection] = useState<AdditionSelection | null>(null);
  const [draft, setDraft] = useState<CoachMovementDraft | null>(null);
  const [beforeId, setBeforeId] = useState<number | null>(null);
  const [pendingRemovalId, setPendingRemovalId] = useState<number | null>(null);
  const pendingRemoval = composition.items.find(item => item.id === pendingRemovalId);
  const [coreChoices, setCoreChoices] = useState<{ id: number; display_name: string; lift: string }[]>([]);
  const [coreLoading, setCoreLoading] = useState(mode === 'add');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [backdownManual, setBackdownManual] = useState(false);
  const alive = useRef(true), saving = useRef(false);
  useEffect(() => {
    alive.current = true;
    if (mode === 'add') void fetchJson('/workouts/mobile/movement_presets?include_accessories=0', { method: 'GET', auth: true })
      .then(response => {
        if (!alive.current) return;
        if (!response.ok) throw new Error('Core lifts could not be loaded. Reopen Add Movement to try again.');
        setCoreChoices((response.json?.training_lifts?.categories || []).flatMap((group: any) =>
          (group.movements || []).filter((row: any) => Number.isInteger(row.movement_definition_id)).map((row: any) => ({
            id: row.movement_definition_id, display_name: row.display_name || row.name, lift: row.lift,
          }))));
      }).catch(reason => { if (alive.current) setError(reason.message); })
      .finally(() => { if (alive.current) setCoreLoading(false); });
    return () => { alive.current = false; };
  }, [mode]);
  const select = (value: AdditionSelection) => { setSelection(value); setDraft(additionDraft(value, unit)); };
  const save = async (removeId?: number) => {
    if (saving.current || (removeId == null && (!selection || !draft))) return;
    if (removeId != null && (removeId !== pendingRemoval?.id || !pendingRemoval.can_remove)) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const response = await fetchJson(`/workouts/mobile/${workoutId}/composition/items${removeId != null ? `/${removeId}` : ''}?history=summary`, {
        method: removeId != null ? 'DELETE' : 'POST', auth: true,
        body: JSON.stringify(removeId != null ? { expected_item_ids: composition.item_ids }
          : additionRequest(selection!, draft!, unit, composition, beforeId)),
      });
      if (!alive.current) return;
      if (!response.ok || !response.json?.ok) throw new Error(response.json?.error || 'Could not update Session movements.');
      onSaved(response.json); onClose();
    } catch (reason: any) { if (alive.current) setError(reason.message || 'Could not update Session movements.'); }
    finally {
      saving.current = false;
      if (alive.current) { setBusy(false); setPendingRemovalId(null); }
    }
  };
  if (mode === 'add' && !selection && !error) return <GovernedAccessorySubstitutionPickerModal
    context="in-session-addition" visible title="Add Movement" athleteId={athlete.id} athleteAnatomy={athlete}
    coreLoading={coreLoading} coreChoices={coreChoices} onSelectCore={value => select({ ...value, kind: 'core' })}
    canCreateCustom onCancel={onClose} onSelect={value => select({ id: value.id, display_name: value.display_name, kind: 'accessory' })} />;
  return <StrengthLedgerBottomSheet visible accessibilityLabel={mode === 'add' ? 'Add Movement' : 'Remove Movement'}
    heightFraction={0.88} dismissalBlocked={busy || pendingRemoval != null} onDismiss={onClose}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{mode === 'add' ? 'Add Movement' : 'Remove Movement'}</Text>
      {mode === 'remove' ? <>
        <Text style={s.hint}>Only movements with no logged Sets can be removed.</Text>
        {composition.items.map(item => <View key={item.id} style={s.row}>
          <View style={s.copy}><Text style={s.name}>{item.movement}{item.variant === 'BK' ? ' · Backdowns' : item.variant === 'TOP' ? ' · Top Sets' : ''}</Text>
            <Text style={s.hint}>{item.set_log_count ? 'Cannot remove: Sets have already been logged.' : item.variant === 'TOP' && composition.items.some(row => row.parent_item_id === item.id) ? 'Backdowns stay in this Session.' : 'No logged Sets'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.movement}${item.variant === 'BK' ? ' Backdowns' : item.variant === 'TOP' ? ' Top Sets' : ''}`}
            disabled={busy || !item.can_remove} onPress={() => setPendingRemovalId(item.id)} style={[s.remove, (!item.can_remove || busy) && s.disabled]}>
            <Text style={s.removeText}>Remove</Text></Pressable>
        </View>)}
        {!composition.items.length ? <Text style={s.hint}>No movements in this Session. Use Add Movement to continue.</Text> : null}
      </> : draft && selection ? <>
        <Text style={s.name}>{selection.display_name}</Text>
        <Text style={s.hint}>Prescription for this Session</Text>
        <MovementQuickPrescriptionEditor draft={draft} kind={selection.kind} editable={!busy} accessibilityReflow={false}
          onChange={patch => setDraft(current => current ? { ...current, ...patch } : current)} storageUnit={unit} displayUnit={unit}
          calculatedTarget={null} backdownCalculatedTarget={null} calculatingTarget={false}
          manualOverrideEnabled={manual} backdownManualOverrideEnabled={backdownManual}
          onManualOverrideEnabledChange={setManual} onBackdownManualOverrideEnabledChange={setBackdownManual} />
        <Text style={s.hint}>Prescription notes</Text>
        <TextInput accessibilityLabel="Prescription notes" value={draft.notes} editable={!busy} multiline maxLength={2000}
          onChangeText={notes => setDraft(current => current ? { ...current, notes } : current)} style={s.notes} />
        <Text style={s.name}>Position in Session</Text>
        {composition.items.filter((item, index, rows) => !item.parent_item_id
          && (!item.superset_group || rows.findIndex(row => row.superset_group === item.superset_group) === index)).map(item =>
          <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: beforeId === item.id }} disabled={busy}
            style={[s.position, beforeId === item.id && s.selected]} onPress={() => setBeforeId(item.id)}>
            <Text style={s.option}>Before {item.movement}</Text></Pressable>)}
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: beforeId === null }} disabled={busy}
          style={[s.position, beforeId === null && s.selected]} onPress={() => setBeforeId(null)}><Text style={s.option}>At the end</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} style={s.save} onPress={() => { void save(); }}>
          {busy ? <ActivityIndicator color={SLColors.textStrong} /> : <Text style={s.saveText}>Add to Session</Text>}
        </Pressable>
      </> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </ScrollView>
    <SLConfirmationModal visible={pendingRemoval != null} title="Remove movement?"
      body={pendingRemoval ? `Are you sure you want to remove ${pendingRemoval.movement}${pendingRemoval.variant === 'BK' ? ' · Backdowns' : pendingRemoval.variant === 'TOP' ? ' · Top Sets' : ''} from this Session?${pendingRemoval.variant === 'TOP' && composition.items.some(item => item.parent_item_id === pendingRemoval.id) ? '\n\nBackdowns will stay in this Session.' : ''}` : undefined}
      confirmLabel="Remove" cancelLabel="Cancel" confirmTone="danger" loading={busy}
      onCancel={() => { if (!saving.current) setPendingRemovalId(null); }}
      onConfirm={() => { if (pendingRemoval) void save(pendingRemoval.id); }} />
  </StrengthLedgerBottomSheet>;
}
const s = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { color: SLColors.textStrong, fontFamily: SLFontFamilies.sansBold, fontSize: 25 },
  name: { color: SLColors.textStrong, fontSize: 18 }, hint: { color: SLColors.textMuted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.textSubtle },
  copy: { flex: 1, gap: 6 }, remove: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  removeText: { color: '#ff9db0', fontSize: 15 }, disabled: { opacity: 0.35 },
  position: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: SLColors.textSubtle },
  notes: { color: SLColors.textStrong, minHeight: 60, padding: 12, borderWidth: 1, borderColor: SLColors.textSubtle, borderRadius: 12 },
  selected: { borderColor: SLColors.accentViolet, backgroundColor: '#30213f' }, option: { color: SLColors.textStrong, fontSize: 16 },
  save: { minHeight: 52, borderRadius: 14, backgroundColor: SLColors.accentViolet, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: SLColors.textStrong, fontFamily: SLFontFamilies.sansBold, fontSize: 17 }, error: { color: '#ff9db0', fontSize: 15 },
});
