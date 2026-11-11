import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { KeyboardScrollView } from '@/components/keyboard/KeyboardSurface';
import { SelfCoachExercisePicker } from '@/components/movement/SelfCoachExercisePicker';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLFontFamilies, SLSelfCoach as C } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import type { AdditionSelection } from '@/lib/active-session-composition';
import { governedCoreChoices, type GovernedCoreChoice } from '@/lib/governed-movement-classes';
import { savePlanChange } from '@/lib/self-coach-plan';

const KG_PER_LB = 0.45359237;

type RoutineItem = { id: number | null; name: string; kind: 'core' | 'accessory'; lift?: string; sets: number | null; reps: number | null; reps_text?: string | null; load_kg?: number | null };
export type RoutineDetail = { id: string; name: string; editable: boolean; can_rename: boolean; version: string | null; items: RoutineItem[] };
type ExerciseDraft = { key: number; id: number | null; name: string; kind: 'core' | 'accessory'; lift?: string; sets: string; reps: string; load: string };

export function SelfCoachRoutineEditor({ routine, owner, athleteId, unit, onClose, onSaved }: {
  routine?: RoutineDetail;
  owner: string;
  athleteId: number;
  unit: 'kg' | 'lb';
  onClose: () => void;
  onSaved: () => void;
}) {
  const editable = !routine || routine.editable;
  const [name, setName] = useState(routine?.name || '');
  const [rows, setRows] = useState<ExerciseDraft[]>(() => (routine?.items || []).map((item, index) => ({
    ...item,
    key: index + 1,
    sets: item.sets == null ? '' : String(item.sets),
    reps: item.reps == null ? '' : String(item.reps),
    load: item.load_kg == null ? '' : String(Number((unit === 'lb' ? item.load_kg / KG_PER_LB : item.load_kg).toFixed(3))),
  })));
  const nextKey = useRef(rows.length + 1);
  const [picker, setPicker] = useState(false);
  const [coreChoices, setCoreChoices] = useState<GovernedCoreChoice[]>([]);
  const [coreLoading, setCoreLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [rowMenu, setRowMenu] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!picker) return;
    let current = true;
    setCoreLoading(true);
    setPickerError('');
    void fetchJson('/workouts/mobile/movement_presets?include_accessories=0').then(response => {
      if (!response.ok) throw new Error('Core lifts could not load. Reopen exercise search to retry.');
      if (current) setCoreChoices(governedCoreChoices(response.json?.training_lifts?.categories || []));
    }).catch(reason => { if (current) setPickerError(reason.message); })
      .finally(() => { if (current) setCoreLoading(false); });
    return () => { current = false; };
  }, [picker]);

  const add = (movement: AdditionSelection) => {
    setRows(current => [...current, { ...movement, key: nextKey.current++, name: movement.display_name, sets: '3', reps: '8', load: '' }]);
    setDirty(true);
    setPicker(false);
  };
  const edit = (key: number, field: 'sets' | 'reps' | 'load', value: string) => {
    setRows(current => current.map(row => row.key === key ? { ...row, [field]: value } : row));
    setDirty(true);
  };
  const reorder = (index: number, direction: -1 | 1) => {
    setRows(current => {
      const next = [...current];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });
    setDirty(true);
    setRowMenu(null);
  };
  const close = () => {
    if (saving.current) return;
    if (!dirty) { onClose(); return; }
    Alert.alert('Discard routine changes?', 'Your saved routines will stay in Plan.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard changes', style: 'destructive', onPress: onClose },
    ]);
  };

  const save = async () => {
    if (saving.current || !name.trim()) return;
    if (editable) {
      const invalid = rows.find(row => !/^[1-9]\d*$/.test(row.sets) || Number(row.sets) > 30 || !/^[1-9]\d*$/.test(row.reps) || Number(row.reps) > 999
        || (row.lift === 'VR' && (!row.load.trim() || !Number.isFinite(Number(row.load)) || Number(row.load) < 0)));
      if (invalid) {
        setError(`Check the sets, reps and planned load for ${invalid.name}.`);
        return;
      }
      if (!rows.length) { setError('Add at least one exercise.'); return; }
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      await savePlanChange(owner, athleteId, 'routines', {
        name: name.trim(),
        ...(routine ? { routine_id: Number(routine.id), base_version: routine.version } : {}),
        ...(editable ? { items: rows.map(row => ({
          id: row.id, kind: row.kind, sets: Number(row.sets), reps: Number(row.reps),
          ...(row.lift === 'VR' ? { load_kg: Number(row.load) * (unit === 'lb' ? KG_PER_LB : 1) } : {}),
        })) } : {}),
      });
      if (mounted.current) onSaved();
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : 'Routine could not save. Try again.');
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return <View style={s.screen}>
    {picker ? <SelfCoachExercisePicker athleteId={athleteId} coreChoices={coreChoices} coreLoading={coreLoading}
      error={pickerError} busy={busy} onSelect={add} onClose={() => setPicker(false)} backLabel="Routine" /> : null}
    <KeyboardScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Plan" onPress={close} disabled={busy} style={s.back}>
        <Ionicons name="chevron-back" size={19} color={C.accent} /><Text style={s.link}>Plan</Text>
      </Pressable>
      <Text style={s.title}>{routine ? editable ? 'Edit routine' : 'Rename routine' : 'Build a routine'}</Text>
      <Text style={s.fieldLabel}>Routine name</Text>
      <TextInput typographyRole="screenTitle" accessibilityLabel="Routine name" value={name} onChangeText={value => { setName(value); setDirty(true); }}
        placeholder="e.g. Upper A" placeholderTextColor={C.muted} maxLength={120} editable={!busy} style={s.nameInput} />
      {routine ? <Text style={s.detail}>Changes apply to future Sessions created from this routine.</Text> : null}
      {editable ? <>
        <Text style={s.detail}>{rows.length} {rows.length === 1 ? 'exercise' : 'exercises'} · {rows.reduce((total, row) => total + (Number(row.sets) || 0), 0)} planned sets</Text>
        {rows.length ? <View style={s.columnHeader}><Text style={[s.fieldLabel, s.flex]}>Exercise</Text><Text style={s.numericLabel}>Sets</Text><Text style={s.numericLabel}>Reps</Text><View style={{ width: 38 }} /></View> : null}
        {rows.map((row, index) => <View key={row.key} style={s.exercise}>
          <View style={s.exerciseRow}>
            <Text style={s.rowIndex}>{index + 1}</Text>
            <Text style={[s.exerciseName, s.flex]}>{row.name}</Text>
            <TextInput accessibilityLabel={`Sets for ${row.name}`} value={row.sets} onChangeText={value => edit(row.key, 'sets', value)} editable={!busy} keyboardType="number-pad" maxLength={2} style={s.number} />
            <TextInput accessibilityLabel={`Reps for ${row.name}`} value={row.reps} onChangeText={value => edit(row.key, 'reps', value)} editable={!busy} keyboardType="number-pad" maxLength={4} style={s.number} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${row.name}`} disabled={busy} onPress={() => setRowMenu(rowMenu === row.key ? null : row.key)} style={s.icon}><Ionicons name="ellipsis-horizontal" size={20} color={C.muted} /></Pressable>
          </View>
          {row.lift === 'VR' ? <View style={s.loadRow}><Text style={[s.detail, s.flex]}>Planned load ({unit})</Text><TextInput accessibilityLabel={`Planned load for ${row.name} in ${unit}`} value={row.load} onChangeText={value => edit(row.key, 'load', value)} editable={!busy} keyboardType="decimal-pad" style={s.load} /></View> : null}
          {rowMenu === row.key ? <View style={s.options}>
            {index > 0 ? <Pressable style={s.textAction} onPress={() => reorder(index, -1)}><Text style={s.link}>Move up</Text></Pressable> : null}
            {index < rows.length - 1 ? <Pressable style={s.textAction} onPress={() => reorder(index, 1)}><Text style={s.link}>Move down</Text></Pressable> : null}
            <Pressable style={s.textAction} onPress={() => { setRows(current => current.filter(item => item.key !== row.key)); setDirty(true); setRowMenu(null); }}><Text style={s.danger}>Remove</Text></Pressable>
          </View> : null}
        </View>)}
        <Pressable accessibilityRole="button" disabled={busy || rows.length >= 30} onPress={() => setPicker(true)} style={s.add}>
          <Ionicons name="add" size={22} color={C.accent} /><Text style={s.link}>Add exercise</Text>
        </Pressable>
      </> : null}
      {error ? <Text accessibilityRole="alert" style={s.danger}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy || !name.trim()} onPress={() => void save()} style={[s.primary, (!name.trim() || busy) && s.dim]}>
        {busy ? <ActivityIndicator color={C.accentInk} /> : <Text style={s.primaryText}>Save routine</Text>}
      </Pressable>
    </KeyboardScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas },
  content: { paddingHorizontal: 20, paddingBottom: 110 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  title: { color: C.text, fontFamily: SLFontFamilies.sansBold, fontSize: 29, marginBottom: 18 },
  fieldLabel: { color: C.secondary, fontSize: 13, lineHeight: 20 },
  nameInput: { color: C.text, minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.line, marginBottom: 12 },
  detail: { color: C.secondary, fontSize: 14, lineHeight: 21, marginBottom: 5 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 17, gap: 7, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 6 },
  numericLabel: { width: 48, textAlign: 'center', color: C.muted, fontSize: 13 },
  flex: { flex: 1 },
  exercise: { borderBottomWidth: 1, borderBottomColor: C.line },
  exerciseRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 7 },
  exerciseName: { color: C.text, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 15, lineHeight: 21 },
  rowIndex: { width: 18, color: C.muted, fontSize: 13 },
  number: { width: 48, height: 44, textAlign: 'center', color: C.text, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, fontSize: 17 },
  icon: { width: 38, height: 44, justifyContent: 'center', alignItems: 'center' },
  loadRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 25, marginBottom: 8 },
  load: { width: 96, minHeight: 44, paddingHorizontal: 10, color: C.text, borderWidth: 1, borderColor: C.line, borderRadius: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginLeft: 25 },
  textAction: { minHeight: 44, justifyContent: 'center' },
  add: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  link: { color: C.accent, fontSize: 15 },
  danger: { color: C.danger, fontSize: 14, lineHeight: 21 },
  primary: { minHeight: 52, marginTop: 12, borderRadius: 13, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaryText: { color: C.accentInk, fontSize: 17, fontFamily: SLFontFamilies.sansSemiBold },
  dim: { opacity: 0.55 },
});
