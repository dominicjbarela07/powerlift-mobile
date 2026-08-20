import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchJson } from '@/lib/api';

export type CanonicalAccessorySelection = {
  id: number;
  display_name: string;
  name?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: string[] | null;
  execution_family?: string | null;
  ownership_scope?: string | null;
  library_scope?: string | null;
  custom_notes?: string | null;
};

type ResultMode = 'all' | 'favorites' | 'recent' | 'custom';
type PickerStep =
  | 'search'
  | 'review'
  | 'custom-name'
  | 'custom-primary'
  | 'custom-secondary'
  | 'custom-execution'
  | 'custom-review'
  | 'custom-created';

type AuthoringOption = { key: string; label: string };
type SimilarityMatch = {
  tier?: string | null;
  score?: number | null;
  movement_definition?: CanonicalAccessorySelection | null;
};

const FALLBACK_MUSCLES: AuthoringOption[] = [
  ['chest', 'Chest'], ['front_delts', 'Front Delts'], ['side_delts', 'Side Delts'],
  ['rear_delts', 'Rear Delts'], ['lats', 'Lats'], ['upper_back', 'Upper Back'],
  ['traps', 'Traps'], ['biceps', 'Biceps'], ['triceps', 'Triceps'],
  ['forearms', 'Forearms'], ['quads', 'Quads'], ['hamstrings', 'Hamstrings'],
  ['glutes', 'Glutes'], ['adductors', 'Adductors'], ['abductors', 'Abductors'],
  ['calves', 'Calves'], ['abs', 'Abs'], ['obliques', 'Obliques'],
  ['lower_back', 'Lower Back'], ['serratus', 'Serratus'], ['hip_flexors', 'Hip Flexors'],
  ['neck', 'Neck'],
].map(([key, label]) => ({ key, label }));

const FALLBACK_EXECUTION: AuthoringOption[] = [
  ['FREE_WEIGHT', 'Free Weight'], ['MACHINE', 'Machine'], ['CABLE', 'Cable'],
  ['BODYWEIGHT', 'Bodyweight'], ['BAND', 'Band'], ['OTHER_PORTABLE', 'Other Portable'],
].map(([key, label]) => ({ key, label }));

function cleanMovement(value: any): CanonicalAccessorySelection | null {
  const id = Number(value?.id);
  const displayName = String(value?.display_name || value?.name || '').trim();
  if (!Number.isInteger(id) || id <= 0 || !displayName) return null;
  return {
    ...value,
    id,
    display_name: displayName,
    secondary_muscle_groups: Array.isArray(value?.secondary_muscle_groups)
      ? value.secondary_muscle_groups.map(String)
      : [],
  };
}

function labelFor(options: AuthoringOption[], key?: string | null) {
  return options.find((option) => option.key === key)?.label || String(key || '').replace(/_/g, ' ');
}

export function CanonicalAccessoryPicker({
  visible,
  athleteId,
  onCancel,
  onSelect,
}: {
  visible: boolean;
  athleteId: number | null;
  onCancel: () => void;
  onSelect: (movement: CanonicalAccessorySelection) => void;
}) {
  const [step, setStep] = useState<PickerStep>('search');
  const [query, setQuery] = useState('');
  const [resultMode, setResultMode] = useState<ResultMode>('all');
  const [results, setResults] = useState<CanonicalAccessorySelection[]>([]);
  const [selected, setSelected] = useState<CanonicalAccessorySelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchRevision, setSearchRevision] = useState(0);
  const [muscles, setMuscles] = useState<AuthoringOption[]>(FALLBACK_MUSCLES);
  const [executionFamilies, setExecutionFamilies] = useState<AuthoringOption[]>(FALLBACK_EXECUTION);
  const [customName, setCustomName] = useState('');
  const [customPrimary, setCustomPrimary] = useState('');
  const [customSecondary, setCustomSecondary] = useState<string[]>([]);
  const [customExecution, setCustomExecution] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [matches, setMatches] = useState<SimilarityMatch[]>([]);
  const [matchesReviewed, setMatchesReviewed] = useState(false);
  const [reviewingMatches, setReviewingMatches] = useState(false);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const searchGeneration = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setStep('search');
    setQuery('');
    setResultMode('all');
    setResults([]);
    setSelected(null);
    setError('');
    setCustomName('');
    setCustomPrimary('');
    setCustomSecondary([]);
    setCustomExecution('');
    setCustomNotes('');
    setMatches([]);
    setMatchesReviewed(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || !athleteId) return;
    void fetchJson<any>(`/workouts/mobile/movement-definitions/authoring-options?athlete_id=${athleteId}`, { method: 'GET' })
      .then((response) => {
        const json = response.json || {};
        if (!response.ok || !json.ok) return;
        if (Array.isArray(json.muscle_groups) && json.muscle_groups.length) {
          setMuscles(json.muscle_groups.map((row: any) => ({ key: String(row.key), label: String(row.label || row.key) })));
        }
        if (Array.isArray(json.execution_families) && json.execution_families.length) {
          setExecutionFamilies(json.execution_families.map((row: any) => ({ key: String(row.key), label: String(row.label || row.key) })));
        }
      })
      .catch(() => undefined);
  }, [athleteId, visible]);

  useEffect(() => {
    if (!visible || step !== 'search' || !athleteId) return;
    const generation = ++searchGeneration.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ athlete_id: String(athleteId), q: query.trim(), limit: '24' });
      if (resultMode === 'favorites') params.set('favorites_only', '1');
      if (resultMode === 'recent') params.set('recent_only', '1');
      if (resultMode === 'custom') params.set('custom_only', '1');
      void fetchJson<any>(`/workouts/mobile/movement-definitions/search?${params.toString()}`, { method: 'GET' })
        .then((response) => {
          if (generation !== searchGeneration.current) return;
          const json = response.json || {};
          if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
          const raw = Array.isArray(json.items)
            ? json.items
            : [
                ...(Array.isArray(json.result_groups?.primary?.items) ? json.result_groups.primary.items : []),
                ...(Array.isArray(json.result_groups?.secondary?.items) ? json.result_groups.secondary.items : []),
              ];
          const unique = new Map<number, CanonicalAccessorySelection>();
          raw.forEach((row: any) => {
            const movement = cleanMovement(row);
            if (movement) unique.set(movement.id, movement);
          });
          setResults([...unique.values()]);
        })
        .catch((reason: any) => {
          if (generation !== searchGeneration.current) return;
          setResults([]);
          setError(reason?.message || 'Accessory movements could not load.');
        })
        .finally(() => {
          if (generation === searchGeneration.current) setLoading(false);
        });
    }, query.trim() ? 220 : 0);
    return () => clearTimeout(timer);
  }, [athleteId, query, resultMode, searchRevision, step, visible]);

  const primaryLabel = useMemo(() => labelFor(muscles, selected?.primary_muscle_group), [muscles, selected]);

  const reviewPossibleMatches = async ({ nameOnly = true }: { nameOnly?: boolean } = {}) => {
    if (!athleteId || !customName.trim()) return;
    setReviewingMatches(true);
    setError('');
    try {
      const response = await fetchJson<any>('/workouts/mobile/movement-definitions/similarity', {
        method: 'POST',
        body: {
          athlete_id: athleteId,
          display_name: customName.trim(),
          ...(nameOnly ? {} : {
            primary_muscle_group: customPrimary,
            secondary_muscle_groups: customSecondary,
            execution_family: customExecution,
            notes: customNotes.trim(),
          }),
        } as any,
      });
      const json = response.json || {};
      if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
      setMatches(Array.isArray(json.matches) ? json.matches : []);
      setMatchesReviewed(true);
      if (!nameOnly) setStep('custom-review');
    } catch (reason: any) {
      setMatches([]);
      setMatchesReviewed(false);
      setError(reason?.message || 'Possible matches could not be reviewed.');
    } finally {
      setReviewingMatches(false);
    }
  };

  const createCustomMovement = async () => {
    if (!athleteId || !customName.trim() || !customPrimary || !customExecution) return;
    setCreatingCustom(true);
    setError('');
    try {
      const response = await fetchJson<any>('/workouts/mobile/movement-definitions', {
        method: 'POST',
        body: {
          athlete_id: athleteId,
          display_name: customName.trim(),
          primary_muscle_group: customPrimary,
          secondary_muscle_groups: customSecondary,
          execution_family: customExecution,
          notes: customNotes.trim(),
          confirm_similar: true,
        } as any,
      });
      const json = response.json || {};
      const movement = cleanMovement(
        response.ok && json.ok
          ? json.movement_definition
          : json.existing_custom_movement || json.existing_movement,
      );
      if (!movement) throw new Error(json.error || `HTTP ${response.status}`);
      setSelected(movement);
      setStep('custom-created');
    } catch (reason: any) {
      setError(reason?.message || 'Custom movement could not be created.');
    } finally {
      setCreatingCustom(false);
    }
  };

  const goBack = () => {
    setError('');
    if (step === 'review') setStep('search');
    else if (step === 'custom-name') setStep('search');
    else if (step === 'custom-primary') setStep('custom-name');
    else if (step === 'custom-secondary') setStep('custom-primary');
    else if (step === 'custom-execution') setStep('custom-secondary');
    else if (step === 'custom-review') setStep('custom-execution');
    else if (step === 'custom-created') setStep('custom-review');
  };

  const headerTitle = step === 'search' ? 'Choose Accessory' : step === 'review' ? 'Review Movement' : 'Create Custom Movement';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={step === 'search' ? 'Close accessory picker' : 'Go back'} onPress={step === 'search' ? onCancel : goBack} style={styles.iconButton}>
            <Ionicons name={step === 'search' ? 'close' : 'chevron-back'} size={22} color="#ECE5DA" />
          </Pressable>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'search' ? (
            <>
              <Text style={styles.eyebrow}>Governed movement identity</Text>
              <Text style={styles.title}>What are you adding?</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#A78BFA" />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search accessory movements" placeholderTextColor="#82766D" style={styles.searchInput} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {([['all', 'All'], ['favorites', 'Favorites'], ['recent', 'Recent'], ['custom', 'My Movements']] as const).map(([value, label]) => (
                  <Pressable key={value} onPress={() => setResultMode(value)} style={[styles.chip, resultMode === value && styles.chipActive]}>
                    <Text style={[styles.chipText, resultMode === value && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {loading ? <View style={styles.status}><ActivityIndicator color="#A78BFA" /><Text style={styles.muted}>Loading governed movements…</Text></View> : null}
              {!loading && !error && !results.length ? <Text style={styles.muted}>No matching accessory movements.</Text> : null}
              {results.map((movement) => (
                <Pressable key={movement.id} accessibilityRole="button" onPress={() => { setSelected(movement); setStep('review'); }} style={styles.resultCard}>
                  <View style={styles.resultCopy}>
                    <Text style={styles.resultName}>{movement.display_name}</Text>
                    <Text style={styles.resultMeta}>{[labelFor(muscles, movement.primary_muscle_group), labelFor(executionFamilies, movement.execution_family), movement.library_scope === 'my_movement' ? 'My Movement' : 'Catalog'].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#A78BFA" />
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={() => { setCustomName(query.trim()); setMatches([]); setMatchesReviewed(false); setStep('custom-name'); }} style={styles.secondaryButton}>
                <Ionicons name="add-circle-outline" size={18} color="#A78BFA" />
                <Text style={styles.secondaryButtonText}>Can&apos;t find it? Create custom movement</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'review' && selected ? (
            <View style={styles.reviewCard}>
              <Text style={styles.eyebrow}>Selected identity</Text>
              <Text style={styles.reviewName}>{selected.display_name}</Text>
              <Metadata label="Primary target" value={primaryLabel} />
              <Metadata label="Secondary targets" value={(selected.secondary_muscle_groups || []).map((key) => labelFor(muscles, key)).join(', ') || 'None'} />
              <Metadata label="Execution" value={labelFor(executionFamilies, selected.execution_family)} />
              <Metadata label="Library" value={selected.library_scope === 'my_movement' ? 'My Movement' : 'Canonical catalog'} />
              <Pressable accessibilityRole="button" onPress={() => onSelect(selected)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Confirm & Add to Session</Text></Pressable>
            </View>
          ) : null}

          {step === 'custom-name' ? (
            <>
              <StepTitle step="1 of 5" title="What are you creating?" body="Name the movement first so Strength Ledger can check the governed library." />
              <TextInput value={customName} onChangeText={(value) => { setCustomName(value); setMatches([]); setMatchesReviewed(false); }} placeholder="Movement name" placeholderTextColor="#82766D" style={styles.input} />
              <Pressable disabled={!customName.trim() || reviewingMatches} onPress={() => { void reviewPossibleMatches(); }} style={[styles.primaryButton, (!customName.trim() || reviewingMatches) && styles.disabled]}><Text style={styles.primaryButtonText}>{reviewingMatches ? 'Checking…' : 'Review Possible Matches'}</Text></Pressable>
              {matches.length ? <Text style={styles.sectionTitle}>Possible Matches</Text> : null}
              {matchesReviewed && !matches.length ? <Text style={styles.muted}>No possible matches found.</Text> : null}
              {matches.map((match, index) => {
                const movement = cleanMovement(match.movement_definition);
                if (!movement) return null;
                return <Pressable key={`${movement.id}-${index}`} onPress={() => { setSelected(movement); setStep('review'); }} style={styles.resultCard}><View style={styles.resultCopy}><Text style={styles.resultName}>{movement.display_name}</Text><Text style={styles.resultMeta}>{String(match.tier || 'Related').replace(/_/g, ' ')}</Text></View><Text style={styles.useText}>Use</Text></Pressable>;
              })}
              {matchesReviewed ? <Pressable onPress={() => setStep('custom-primary')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>No, mine is different.</Text></Pressable> : null}
            </>
          ) : null}

          {step === 'custom-primary' ? <ChoiceStep step="2 of 5" title="Primary muscle" body="Choose the main target." options={muscles} selected={[customPrimary]} onToggle={(key) => { setCustomPrimary(key); setCustomSecondary((current) => current.filter((value) => value !== key)); }} single onContinue={() => setStep('custom-secondary')} /> : null}
          {step === 'custom-secondary' ? <ChoiceStep step="3 of 5" title="Secondary muscles" body={`Choose up to three additional targets (${customSecondary.length}/3).`} options={muscles.filter((option) => option.key !== customPrimary)} selected={customSecondary} onToggle={(key) => setCustomSecondary((current) => current.includes(key) ? current.filter((value) => value !== key) : current.length < 3 ? [...current, key] : current)} onContinue={() => setStep('custom-execution')} /> : null}
          {step === 'custom-execution' ? <ChoiceStep step="4 of 5" title="Execution family" body="Choose how the movement is performed." options={executionFamilies} selected={[customExecution]} onToggle={setCustomExecution} single onContinue={() => { void reviewPossibleMatches({ nameOnly: false }); }} /> : null}

          {step === 'custom-review' ? (
            <View style={styles.reviewCard}>
              <StepTitle step="5 of 5" title="Review your movement" body="This creates a governed custom identity in your movement library." />
              <Text style={styles.reviewName}>{customName.trim()}</Text>
              <Metadata label="Primary target" value={labelFor(muscles, customPrimary)} />
              <Metadata label="Secondary targets" value={customSecondary.map((key) => labelFor(muscles, key)).join(', ') || 'None'} />
              <Metadata label="Execution" value={labelFor(executionFamilies, customExecution)} />
              <TextInput value={customNotes} onChangeText={setCustomNotes} multiline placeholder="Optional identity notes" placeholderTextColor="#82766D" style={[styles.input, styles.notes]} />
              <Pressable disabled={creatingCustom} onPress={() => { void createCustomMovement(); }} style={[styles.primaryButton, creatingCustom && styles.disabled]}><Text style={styles.primaryButtonText}>{creatingCustom ? 'Creating…' : 'Create Movement'}</Text></Pressable>
            </View>
          ) : null}

          {step === 'custom-created' && selected ? (
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={54} color="#A7CBB5" />
              <Text style={styles.reviewName}>{selected.display_name}</Text>
              <Text style={styles.muted}>The governed custom movement is ready for this Session.</Text>
              <Pressable onPress={() => onSelect(selected)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Use This Movement</Text></Pressable>
            </View>
          ) : null}

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => setSearchRevision((value) => value + 1)}><Text style={styles.retry}>Retry</Text></Pressable></View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StepTitle({ step, title, body }: { step: string; title: string; body: string }) {
  return <View style={styles.stepTitle}><Text style={styles.eyebrow}>{step}</Text><Text style={styles.title}>{title}</Text><Text style={styles.muted}>{body}</Text></View>;
}

function Metadata({ label, value }: { label: string; value?: string | null }) {
  return <View style={styles.metadata}><Text style={styles.metadataLabel}>{label}</Text><Text style={styles.metadataValue}>{value || 'Not specified'}</Text></View>;
}

function ChoiceStep({ step, title, body, options, selected, onToggle, onContinue, single }: { step: string; title: string; body: string; options: AuthoringOption[]; selected: string[]; onToggle: (key: string) => void; onContinue: () => void; single?: boolean }) {
  const canContinue = !single || selected.length > 0;
  return <><StepTitle step={step} title={title} body={body} /><View style={styles.choiceGrid}>{options.map((option) => { const active = selected.includes(option.key); return <Pressable key={option.key} accessibilityRole={single ? 'radio' : 'checkbox'} accessibilityState={single ? { checked: active } : { checked: active }} onPress={() => onToggle(option.key)} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.label}</Text></Pressable>; })}</View><Pressable disabled={!canContinue} onPress={onContinue} style={[styles.primaryButton, !canContinue && styles.disabled]}><Text style={styles.primaryButtonText}>Continue</Text></Pressable></>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  header: { minHeight: 64, paddingTop: Platform.OS === 'ios' ? 12 : 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(222,198,166,0.15)' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#ECE5DA', textAlign: 'center', fontSize: 18, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 80, gap: 14 },
  eyebrow: { color: '#A78BFA', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { color: '#F7F0E7', fontSize: 24, lineHeight: 30, fontWeight: '800' },
  muted: { color: '#B8ACA1', fontSize: 14, lineHeight: 20 },
  searchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(167,139,250,0.34)', borderRadius: 12, backgroundColor: '#08080B' },
  searchInput: { flex: 1, color: '#ECE5DA', fontSize: 16 },
  chipRow: { gap: 8, paddingRight: 16 },
  chip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(222,198,166,0.14)', borderRadius: 999, backgroundColor: '#070709' },
  chipActive: { borderColor: '#A78BFA', backgroundColor: 'rgba(124,58,237,0.20)' },
  chipText: { color: '#B8ACA1', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#ECE5DA' },
  status: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderWidth: 1, borderColor: 'rgba(222,198,166,0.13)', borderRadius: 13, backgroundColor: '#070709' },
  resultCopy: { flex: 1, minWidth: 0, gap: 4 },
  resultName: { color: '#F7F0E7', fontSize: 16, fontWeight: '800' },
  resultMeta: { color: '#9D9187', fontSize: 12, lineHeight: 17, textTransform: 'capitalize' },
  useText: { color: '#A78BFA', fontSize: 13, fontWeight: '800' },
  secondaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.34)', borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.10)' },
  secondaryButtonText: { color: '#C4B5FD', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  primaryButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(167,203,181,0.38)', borderRadius: 13, backgroundColor: 'rgba(85,132,105,0.28)' },
  primaryButtonText: { color: '#BFE3CD', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.42 },
  reviewCard: { gap: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(167,139,250,0.28)', borderRadius: 16, backgroundColor: '#070709' },
  reviewName: { color: '#F7F0E7', fontSize: 24, lineHeight: 30, fontWeight: '800' },
  metadata: { gap: 3, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(222,198,166,0.11)' },
  metadataLabel: { color: '#82766D', fontSize: 11, textTransform: 'uppercase', fontWeight: '800' },
  metadataValue: { color: '#ECE5DA', fontSize: 15, lineHeight: 20, textTransform: 'capitalize' },
  stepTitle: { gap: 6 },
  input: { minHeight: 50, paddingHorizontal: 13, paddingVertical: 10, color: '#ECE5DA', fontSize: 16, borderWidth: 1, borderColor: 'rgba(222,198,166,0.16)', borderRadius: 12, backgroundColor: '#08080B' },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  sectionTitle: { color: '#ECE5DA', fontSize: 17, fontWeight: '800' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  choice: { minHeight: 46, width: '48.5%', alignItems: 'center', justifyContent: 'center', padding: 9, borderWidth: 1, borderColor: 'rgba(222,198,166,0.14)', borderRadius: 11, backgroundColor: '#070709' },
  choiceActive: { borderColor: '#A78BFA', backgroundColor: 'rgba(124,58,237,0.20)' },
  choiceText: { color: '#B8ACA1', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  choiceTextActive: { color: '#ECE5DA' },
  successCard: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  errorBox: { gap: 8, padding: 13, borderWidth: 1, borderColor: 'rgba(248,113,113,0.42)', borderRadius: 12, backgroundColor: 'rgba(127,29,29,0.20)' },
  errorText: { color: '#FCA5A5', fontSize: 13, lineHeight: 18 },
  retry: { color: '#FECACA', fontSize: 13, fontWeight: '800' },
});
