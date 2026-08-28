import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { StrengthLedgerBottomSheet, type StrengthLedgerBottomSheetHandle } from '@/components/sheets/StrengthLedgerBottomSheet';
import { SLButton } from '@/components/ui/sl-button';
import { SLMotionPressable as Pressable } from '@/components/ui/sl-motion';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies, SLRadius, SLSpacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  cacheAthleteScratchpad,
  cachedAthleteScratchpad,
  getAthleteScratchpad,
  saveAthleteScratchpad,
  type AthleteScratchpad,
} from '@/lib/athlete-coaching-scratchpad';

type Props = Readonly<{
  athleteId: number;
  athleteName: string;
  initialScratchpad?: Partial<AthleteScratchpad> | null;
  variant?: 'card' | 'compact';
  onSaved?: (scratchpad: AthleteScratchpad) => void;
}>;

function hydratedInitial(cacheKey: string, initial?: Partial<AthleteScratchpad> | null): AthleteScratchpad | null {
  const cached = cachedAthleteScratchpad(cacheKey);
  if (cached) return cached;
  if (!initial) return null;
  return {
    relationship_id: Number(initial.relationship_id || 0),
    note_id: initial.note_id ?? null,
    // Summary previews are not authoritative editable content.
    body: initial.body || '',
    body_preview: initial.body_preview || null,
    updated_at: initial.updated_at || null,
    updated_by: initial.updated_by || null,
    version: initial.version || null,
    is_empty: initial.is_empty ?? !initial.body_preview,
  };
}

export function AthleteCoachingScratchpadTrigger({ athleteId, athleteName, initialScratchpad, variant = 'compact', onSaved }: Props) {
  const { user } = useAuth();
  const cacheKey = `${user?.id || user?.email || 'anonymous'}:${athleteId}`;
  const sheetRef = useRef<StrengthLedgerBottomSheetHandle>(null);
  const draftRevisionRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const [scratchpad, setScratchpad] = useState<AthleteScratchpad | null>(() => hydratedInitial(cacheKey, initialScratchpad));
  const [draft, setDraft] = useState(scratchpad?.body || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState<AthleteScratchpad | null>(null);
  const savedBody = scratchpad?.body || '';
  const dirty = draft.trim() !== savedBody.trim();

  useEffect(() => {
    const next = hydratedInitial(cacheKey, initialScratchpad);
    setScratchpad(next);
    if (!visible) setDraft(next?.body || '');
  }, [cacheKey, initialScratchpad, visible]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const startingDraftRevision = draftRevisionRef.current;
    const result = await getAthleteScratchpad(athleteId);
    if (result.ok && result.json?.ok && result.json.scratchpad) {
      const next = result.json.scratchpad;
      cacheAthleteScratchpad(cacheKey, next);
      setScratchpad(next);
      if (draftRevisionRef.current === startingDraftRevision) setDraft(next.body || '');
    } else {
      setError(result.json?.error || 'Could not refresh the coaching scratchpad. Your last loaded note is still available.');
    }
    setLoading(false);
  }, [athleteId, cacheKey]);

  const open = useCallback(() => {
    const cached = cachedAthleteScratchpad(cacheKey) || scratchpad;
    if (cached) {
      setScratchpad(cached);
      setDraft(cached.body || '');
    }
    setSaved(false);
    setConflict(null);
    setError('');
    setVisible(true);
    void refresh();
  }, [cacheKey, refresh, scratchpad]);

  const dismiss = useCallback(() => sheetRef.current?.dismiss(), []);
  const requestClose = useCallback(() => {
    if (saving) return;
    if (!dirty) {
      dismiss();
      return;
    }
    Alert.alert('Discard coaching note changes?', 'Your unsaved scratchpad edits will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: dismiss },
    ]);
  }, [dirty, dismiss, saving]);

  const save = useCallback(async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setError('');
    setConflict(null);
    const result = await saveAthleteScratchpad(athleteId, draft, scratchpad?.version || null);
    if (result.ok && result.json?.ok && result.json.scratchpad) {
      const next = result.json.scratchpad;
      cacheAthleteScratchpad(cacheKey, next);
      setScratchpad(next);
      setDraft(next.body || '');
      setSaved(true);
      onSaved?.(next);
    } else if (result.status === 409 && result.json?.scratchpad) {
      setConflict(result.json.scratchpad);
      setError('This note changed elsewhere. Load the latest version before saving.');
    } else {
      setError(result.json?.error || 'The coaching scratchpad could not be saved. Your draft is still here.');
    }
    setSaving(false);
  }, [athleteId, cacheKey, dirty, draft, onSaved, saving, scratchpad?.version]);

  const preview = scratchpad?.body_preview || initialScratchpad?.body_preview || '';
  const updated = scratchpad?.updated_by?.name;
  const trigger = variant === 'card' ? styles.cardTrigger : styles.compactTrigger;
  const copy = useMemo(() => preview || 'No pinned coaching note. Add private coaching context or next steps.', [preview]);

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit Notes & Next Steps for ${athleteName}`} onPress={open} style={({ pressed }) => [trigger, pressed && styles.pressed]}>
        <View style={styles.triggerIcon}><Ionicons color={SLColors.accentViolet} name="document-text-outline" size={20} /></View>
        <View style={styles.triggerCopy}>
          <Text style={styles.triggerTitle}>Notes & Next Steps</Text>
          <Text numberOfLines={variant === 'card' ? 3 : 2} style={preview ? styles.triggerText : styles.triggerEmpty}>{copy}</Text>
          {updated ? <Text numberOfLines={1} style={styles.updatedText}>Updated by {updated}</Text> : null}
        </View>
        <Ionicons color={SLColors.textMuted} name="create-outline" size={19} />
      </Pressable>

      <StrengthLedgerBottomSheet
        ref={sheetRef}
        accessibilityLabel={`Notes & Next Steps for ${athleteName}`}
        heightFraction={0.82}
        onDismiss={() => { setVisible(false); setSaved(false); setConflict(null); setError(''); }}
        onRequestClose={requestClose}
        visible={visible}
      >
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHeading}>
            <Text style={styles.sheetEyebrow}>COACH PRIVATE</Text>
            <Text style={styles.sheetTitle}>Notes & Next Steps</Text>
            <Text style={styles.sheetSubtitle}>{athleteName} · shared coaching context</Text>
          </View>
          <View style={styles.editorSurface}>
            <TextInput
              accessibilityLabel="Coaching scratchpad"
              autoCapitalize="sentences"
              editable={!saving}
              maxLength={12000}
              multiline
              onChangeText={(value) => { draftRevisionRef.current += 1; setDraft(value); setSaved(false); }}
              placeholder="Capture priorities, follow-ups, programming context, and next steps…"
              placeholderTextColor={SLColors.textSubtle}
              style={styles.input}
              textAlignVertical="top"
              value={draft}
            />
            <Text style={styles.characterCount}>{draft.length.toLocaleString()} / 12,000</Text>
          </View>
          {loading ? <Text style={styles.statusText}>Refreshing latest note…</Text> : null}
          {saved ? <Text style={styles.successText}>Saved across coaching surfaces.</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          {conflict ? <SLButton fullWidth label="Load Latest Version" onPress={() => { setScratchpad(conflict); setDraft(conflict.body || ''); cacheAthleteScratchpad(cacheKey, conflict); setConflict(null); setError(''); }} size="sm" variant="secondary" /> : null}
          <View style={styles.actions}>
            <View style={styles.secondaryAction}><SLButton fullWidth disabled={saving} label="Cancel" onPress={requestClose} size="md" variant="secondary" /></View>
            <View style={styles.primaryAction}><SLButton fullWidth disabled={!dirty || loading} label={saving ? 'Saving…' : draft.trim() ? 'Save Note' : 'Clear Note'} loading={saving} onPress={save} size="md" variant="primary" /></View>
          </View>
        </ScrollView>
      </StrengthLedgerBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  cardTrigger: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.border, backgroundColor: SLColors.surfaceRaised, padding: SLSpacing.md },
  compactTrigger: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.borderSubtle, backgroundColor: SLColors.surface, paddingHorizontal: SLSpacing.md, paddingVertical: 12 },
  pressed: { opacity: 0.82 },
  triggerIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.accentSoft },
  triggerCopy: { flex: 1, minWidth: 0 },
  triggerTitle: { color: SLColors.text, fontFamily: SLFontFamilies.sansBold, fontSize: 16, lineHeight: 21 },
  triggerText: { color: SLColors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  triggerEmpty: { color: SLColors.textSubtle, fontSize: 14, lineHeight: 20, marginTop: 3 },
  updatedText: { color: SLColors.textSubtle, fontSize: 11, lineHeight: 15, marginTop: 5 },
  sheetContent: { paddingHorizontal: SLSpacing.lg, paddingTop: SLSpacing.md, paddingBottom: 40, gap: SLSpacing.md },
  sheetHeading: { gap: 4, paddingRight: 52 },
  sheetEyebrow: { color: SLColors.accentViolet, fontFamily: SLFontFamilies.sansBold, fontSize: 12, letterSpacing: 1.2 },
  sheetTitle: { color: SLColors.text, fontFamily: SLFontFamilies.sansBold, fontSize: 28, lineHeight: 34 },
  sheetSubtitle: { color: SLColors.textMuted, fontSize: 15, lineHeight: 21 },
  editorSurface: { minHeight: 280, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: SLColors.border, backgroundColor: SLColors.surfaceRaised, padding: SLSpacing.md },
  input: { flex: 1, minHeight: 230, color: SLColors.text, fontFamily: SLFontFamilies.body, fontSize: 17, lineHeight: 25, padding: 0 },
  characterCount: { color: SLColors.textSubtle, fontSize: 11, textAlign: 'right', marginTop: 8 },
  statusText: { color: SLColors.textMuted, fontSize: 13 },
  successText: { color: SLColors.success, fontFamily: SLFontFamilies.sansBold, fontSize: 13 },
  errorText: { color: SLColors.danger, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10 },
  secondaryAction: { flex: 0.8 },
  primaryAction: { flex: 1.2 },
});
