import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardModal as Modal, KeyboardScrollView as ScrollView } from '@/components/keyboard/KeyboardSurface';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLFontFamilies, SLSelfCoach as C } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import { useSLReducedMotion } from '@/lib/motion';
import { CANONICAL_MOVEMENT_SEARCH_DEBOUNCE_MS, rankCanonicalMovementChoices } from '@/lib/canonical-movement-search';
import type { AdditionSelection } from '@/lib/active-session-composition';
import type { GovernedCoreChoice } from '@/lib/governed-movement-classes';
import type { GovernedAccessoryIdentity } from './GovernedAccessoryPickerModal';

export function SelfCoachExercisePicker({ athleteId, coreChoices, coreLoading, busy, error, onSelect, onClose, onAdvanced, backLabel = 'Session' }: {
  athleteId: number; coreChoices: GovernedCoreChoice[]; coreLoading: boolean; busy: boolean; error?: string;
  onSelect: (selection: AdditionSelection) => void; onClose: () => void; onAdvanced?: () => void; backLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useSLReducedMotion();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<GovernedAccessoryIdentity[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestId = useRef(0);
  useEffect(() => {
    const generation = ++requestId.current;
    const controller = new AbortController();
    setLoading(true); setSearchError('');
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ athlete_id: String(athleteId), limit: '49', search_assist: '1' });
      if (query.trim()) params.set('q', query.trim());
      else params.set('recent_only', '1');
      void fetchJson<any>(`/workouts/mobile/movement-definitions/search?${params}`, { signal: controller.signal })
        .then(response => {
          if (requestId.current !== generation) return;
          if (!response.ok || !response.json?.ok) throw new Error('Search could not load. Try again.');
          setRows(response.json.items || []);
        }).catch(reason => {
          if (!controller.signal.aborted && requestId.current === generation) setSearchError(reason.message || 'Search could not load.');
        }).finally(() => { if (requestId.current === generation) setLoading(false); });
    }, query ? CANONICAL_MOVEMENT_SEARCH_DEBOUNCE_MS : 0);
    return () => { controller.abort(); clearTimeout(timer); requestId.current += 1; };
  }, [athleteId, query, retry]);
  const choices = useMemo(() => {
    const matches = rankCanonicalMovementChoices(coreChoices, query, row => row.display_name)
      .filter(row => query.trim() || row.core_movement_kind === 'competition');
    const result: (AdditionSelection & { detail: string })[] = matches.filter(row => row.movement_definition_id)
      .map(row => ({ id: row.movement_definition_id!, display_name: row.display_name, kind: 'core', lift: row.lift,
        detail: row.core_movement_kind === 'variant' ? 'Core variant' : 'Barbell' }));
    const ids = new Set(result.map(row => row.id));
    for (const row of rows) {
      if (ids.has(row.id)) continue;
      ids.add(row.id);
      result.push({ id: row.id, display_name: row.display_name, kind: row.kind === 'core' ? 'core' : 'accessory',
        lift: row.kind === 'core' ? coreChoices.find(choice => choice.movement_definition_id === row.id)?.lift || 'VR' : undefined,
        detail: [row.execution_family, row.primary_muscle_group].filter(Boolean).join(' · ').replaceAll('_', ' ') });
    }
    return result;
  }, [coreChoices, query, rows]);
  return <Modal visible animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${backLabel.toLowerCase()}`} disabled={busy} onPress={onClose} style={s.back}>
          <Ionicons name="chevron-back" size={22} color={C.secondary} /><Text style={s.backText}>{backLabel}</Text>
        </Pressable>
        {onAdvanced ? <Pressable accessibilityRole="button" disabled={busy} onPress={onAdvanced} style={s.more}>
          <Text style={s.link}>More options</Text>
        </Pressable> : null}
      </View>
      <Text style={s.title}>Add exercise</Text>
      <View style={s.search}>
        <Ionicons name="search" size={21} color={C.muted} />
        <TextInput accessibilityLabel="Search all exercises" autoCorrect={false} value={query} onChangeText={setQuery}
          placeholder="Find an exercise" placeholderTextColor={C.muted} style={s.input} editable={!busy} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear exercise search" onPress={() => setQuery('')} style={s.clear}>
          <Ionicons name="close-circle" size={19} color={C.muted} />
        </Pressable> : null}
      </View>
      <Text style={s.hint}>{query ? 'Matching exercises' : 'Core lifts and recently used exercises'}</Text>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {choices.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`Add ${row.display_name}`}
          disabled={busy} onPress={() => onSelect(row)} style={s.row}>
          <View style={s.copy}><Text style={s.name}>{row.display_name}</Text><Text style={s.detail}>{row.detail}</Text></View>
          <View style={s.add}><Ionicons name="add" color={C.accentInk} size={19} /><Text style={s.addText}>Add</Text></View>
        </Pressable>)}
        {loading || coreLoading || busy ? <ActivityIndicator color={C.accent} style={{ marginVertical: 20 }} /> : null}
        {!loading && !coreLoading && !choices.length && !searchError ? <Text style={s.empty}>No exercises match “{query}”. Try another name.</Text> : null}
        {error || searchError ? <View accessibilityRole="alert" style={s.error}>
          <Text style={s.errorText}>{error || searchError}</Text>
          {searchError ? <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={s.more}><Text style={s.link}>Try again</Text></Pressable> : null}
        </View> : null}
      </ScrollView>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.canvas, paddingHorizontal: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3 }, backText: { color: C.secondary, fontSize: 15 },
  more: { minHeight: 44, justifyContent: 'center' }, link: { color: C.accent, fontSize: 13 },
  title: { color: C.text, fontSize: 29, lineHeight: 37, fontFamily: SLFontFamilies.sansBold, marginVertical: 14 },
  search: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, borderRadius: 13, paddingHorizontal: 12 },
  input: { flex: 1, minHeight: 48, color: C.text, fontSize: 17 }, clear: { padding: 6 },
  hint: { color: C.muted, fontSize: 12, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 79, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  copy: { flex: 1, gap: 5 }, name: { color: C.text, fontFamily: SLFontFamilies.sansSemiBold, fontSize: 17, lineHeight: 23 },
  detail: { color: C.secondary, fontSize: 12, lineHeight: 17 },
  add: { minHeight: 40, paddingHorizontal: 12, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.accent },
  addText: { color: C.accentInk, fontSize: 13, fontFamily: SLFontFamilies.sansSemiBold },
  empty: { color: C.secondary, fontSize: 15, lineHeight: 23, paddingVertical: 30 },
  error: { paddingVertical: 16 }, errorText: { color: C.danger, fontSize: 14, lineHeight: 21 },
});
