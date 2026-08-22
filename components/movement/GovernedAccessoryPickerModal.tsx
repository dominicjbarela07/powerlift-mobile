import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import { accessoryPickerArtwork } from '@/lib/accessory-picker-artwork';

export type GovernedAccessoryIdentity = {
  id: number;
  key?: string | null;
  display_name: string;
  family?: string | null;
  family_display_name?: string | null;
  ownership_scope?: string | null;
  library_scope?: string | null;
  primary_muscle_group?: string | null;
  secondary_muscle_groups?: string[] | null;
  execution_family?: string | null;
  requires_equipment_configuration?: boolean | null;
  is_favorite?: boolean | null;
  last_used_on?: string | null;
};

type AuthoringOptions = {
  muscle_groups?: { key: string; label: string }[];
  execution_families?: { key: string; label: string }[];
};

type PickerMode = 'all' | 'favorites' | 'recent' | 'custom';
type CustomStep = 'name' | 'primary' | 'secondary' | 'execution' | 'review';

type Props = {
  visible: boolean;
  athleteId: number | null;
  title?: string;
  currentIdentityId?: number | null;
  approvedIdentities?: GovernedAccessoryIdentity[];
  approvedOnly?: boolean;
  canCreateCustom?: boolean;
  onCancel: () => void;
  onSelect: (identity: GovernedAccessoryIdentity) => void | Promise<void>;
};

const MODES: { key: PickerMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'favorites', label: 'Favorites', icon: 'star-outline' },
  { key: 'recent', label: 'Recent', icon: 'time-outline' },
  { key: 'custom', label: 'My Movements', icon: 'person-outline' },
];

export function GovernedAccessoryPickerModal({
  visible,
  athleteId,
  title = 'Choose Accessory',
  currentIdentityId,
  approvedIdentities = [],
  approvedOnly = false,
  canCreateCustom = false,
  onCancel,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<PickerMode>('all');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<GovernedAccessoryIdentity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customStep, setCustomStep] = useState<CustomStep | null>(null);
  const [authoring, setAuthoring] = useState<AuthoringOptions>({});
  const [custom, setCustom] = useState({
    name: '', primary: '', secondary: [] as string[], execution: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [similarityMatches, setSimilarityMatches] = useState<{
    tier: string;
    movement_definition: GovernedAccessoryIdentity;
  }[]>([]);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setMode('all');
    setQuery('');
    setCustomStep(null);
    setSimilarityMatches([]);
    setError('');
  }, [visible]);

  useEffect(() => {
    if (!visible || approvedOnly || customStep || !athleteId) return;
    const requestId = ++requestRef.current;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        athlete_id: String(athleteId), q: query.trim(), limit: '40',
      });
      if (mode === 'favorites') params.set('favorites_only', '1');
      if (mode === 'recent') params.set('recent_only', '1');
      if (mode === 'custom') params.set('custom_only', '1');
      setLoading(true);
      setError('');
      void fetchJson<any>(`/workouts/mobile/movement-definitions/search?${params.toString()}`, { method: 'GET' })
        .then((response) => {
          if (requestId !== requestRef.current) return;
          const json = response.json || {};
          if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
          const grouped = json.result_groups;
          const items = grouped
            ? [...(grouped.primary?.items || []), ...(grouped.secondary?.items || [])]
            : (json.items || []);
          const unique = new Map<number, GovernedAccessoryIdentity>();
          items.forEach((item: GovernedAccessoryIdentity) => item?.id && unique.set(Number(item.id), item));
          setRows([...unique.values()]);
        })
        .catch((reason) => {
          if (requestId === requestRef.current) {
            setRows([]);
            setError(reason?.message || 'Movements could not load.');
          }
        })
        .finally(() => requestId === requestRef.current && setLoading(false));
    }, query.trim() ? 220 : 0);
    return () => clearTimeout(timer);
  }, [athleteId, approvedOnly, customStep, mode, query, visible]);

  const visibleRows = useMemo(() => {
    if (!approvedOnly) return rows;
    const needle = query.trim().toLocaleLowerCase();
    return approvedIdentities.filter((row) => !needle || row.display_name.toLocaleLowerCase().includes(needle));
  }, [approvedIdentities, approvedOnly, query, rows]);

  const beginCustom = async () => {
    if (!athleteId) return;
    setCustom({ name: query.trim(), primary: '', secondary: [], execution: '', notes: '' });
    setCustomStep('name');
    const response = await fetchJson<any>(`/workouts/mobile/movement-definitions/authoring-options?athlete_id=${athleteId}`, { method: 'GET' });
    if (response.ok && response.json?.ok) setAuthoring(response.json);
  };

  const createCustom = async () => {
    if (!athleteId) return;
    try {
      setSaving(true);
      const response = await fetchJson<any>('/workouts/mobile/movement-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_id: athleteId,
          display_name: custom.name.trim(),
          primary_muscle_group: custom.primary,
          secondary_muscle_groups: custom.secondary,
          execution_family: custom.execution,
          notes: custom.notes.trim(),
          confirm_similar: true,
        }),
      });
      const json = response.json || {};
      const identity = json.movement_definition || json.existing_custom_movement || json.existing_movement;
      if (!response.ok || !json.ok || !identity?.id) throw new Error(json.error || 'Movement could not be created.');
      await onSelect(identity);
    } catch (reason: any) {
      Alert.alert('Movement not created', reason?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderIdentity = (identity: GovernedAccessoryIdentity) => {
    const artwork = accessoryPickerArtwork(identity);
    const selected = Number(identity.id) === Number(currentIdentityId);
    return (
      <Pressable
        key={identity.id}
        accessibilityRole="button"
        accessibilityLabel={`Select ${identity.display_name}`}
        onPress={() => void onSelect(identity)}
        style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
      >
        <Image source={artwork.source} style={styles.artwork} resizeMode="contain" />
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{identity.display_name}</Text>
          <Text style={styles.rowMeta}>
            {[identity.primary_muscle_group, identity.family_display_name || identity.family]
              .filter(Boolean).join(' · ') || 'Governed accessory'}
          </Text>
        </View>
        {selected ? <Ionicons name="checkmark-circle" size={22} color={SLColors.success} /> : <Ionicons name="chevron-forward" size={20} color={SLColors.textMuted} />}
      </Pressable>
    );
  };

  const muscles = authoring.muscle_groups || [];
  const executions = authoring.execution_families || [];
  const nextCustomStep = () => {
    if (customStep === 'name' && custom.name.trim()) setCustomStep('primary');
    else if (customStep === 'primary' && custom.primary) setCustomStep('secondary');
    else if (customStep === 'secondary') setCustomStep('execution');
    else if (customStep === 'execution' && custom.execution && athleteId) {
      setSaving(true);
      void fetchJson<any>('/workouts/mobile/movement-definitions/similarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_id: athleteId,
          display_name: custom.name.trim(),
          primary_muscle_group: custom.primary,
          secondary_muscle_groups: custom.secondary,
          execution_family: custom.execution,
          notes: custom.notes.trim(),
        }),
      }).then((response) => {
        const json = response.json || {};
        if (!response.ok || !json.ok) throw new Error(json.error || 'Possible matches could not be reviewed.');
        setSimilarityMatches(Array.isArray(json.matches) ? json.matches : []);
        setCustomStep('review');
      }).catch((reason) => Alert.alert('Review unavailable', reason?.message || 'Try again.'))
        .finally(() => setSaving(false));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
      <View style={[styles.shell, { paddingTop: Math.max(insets.top, SLSpacing.md), paddingBottom: Math.max(insets.bottom, SLSpacing.md) }]}>
        <View style={styles.header}>
          <Pressable onPress={customStep ? () => setCustomStep(null) : onCancel} style={styles.headerButton}>
            <Ionicons name={customStep ? 'arrow-back' : 'close'} size={23} color={SLColors.textStrong} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{customStep ? 'Create Governed Movement' : title}</Text>
            <Text style={styles.subtitle}>{approvedOnly ? 'Coach-approved substitutions' : 'Canonical and owned movement library'}</Text>
          </View>
        </View>

        {!customStep ? (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={SLColors.textMuted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Search governed movements" placeholderTextColor={SLColors.textSubtle} style={styles.search} />
            </View>
            {!approvedOnly ? (
              <ScrollView
                horizontal
                style={styles.modeRail}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modes}
              >
                {MODES.map((entry) => (
                  <Pressable key={entry.key} onPress={() => setMode(entry.key)} style={[styles.mode, mode === entry.key && styles.modeActive]}>
                    <Ionicons name={entry.icon} size={16} color={mode === entry.key ? SLColors.accent : SLColors.textMuted} />
                    <Text style={[styles.modeText, mode === entry.key && styles.modeTextActive]}>{entry.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <ScrollView style={styles.scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              {approvedOnly && approvedIdentities.length ? <Text style={styles.sectionLabel}>APPROVED FOR THIS SESSION</Text> : null}
              {approvedIdentities.map(renderIdentity)}
              {!approvedOnly && approvedIdentities.length ? <Text style={styles.sectionLabel}>FULL LIBRARY</Text> : null}
              {loading ? <ActivityIndicator color={SLColors.accent} style={styles.loading} /> : null}
              {!loading ? visibleRows.map(renderIdentity) : null}
              {!loading && !visibleRows.length && !approvedIdentities.length ? <Text style={styles.empty}>{error || 'No governed movement found.'}</Text> : null}
            </ScrollView>
            {canCreateCustom && !approvedOnly ? (
              <Pressable onPress={() => void beginCustom()} style={styles.primaryAction}>
                <Ionicons name="add-circle-outline" size={20} color={SLColors.textStrong} />
                <Text style={styles.primaryActionText}>Create Governed Movement</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.customBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.step}>STEP {['name', 'primary', 'secondary', 'execution', 'review'].indexOf(customStep) + 1} OF 5</Text>
            {customStep === 'name' ? <TextInput autoFocus value={custom.name} onChangeText={(name) => setCustom((value) => ({ ...value, name }))} placeholder="Movement name" placeholderTextColor={SLColors.textSubtle} style={styles.customInput} /> : null}
            {customStep === 'primary' ? <ChoiceGrid rows={muscles} selected={[custom.primary]} onPress={(primary) => setCustom((value) => ({ ...value, primary }))} /> : null}
            {customStep === 'secondary' ? <ChoiceGrid rows={muscles.filter((row) => row.key !== custom.primary)} selected={custom.secondary} onPress={(key) => setCustom((value) => ({ ...value, secondary: value.secondary.includes(key) ? value.secondary.filter((item) => item !== key) : [...value.secondary, key] }))} /> : null}
            {customStep === 'execution' ? <ChoiceGrid rows={executions} selected={[custom.execution]} onPress={(execution) => setCustom((value) => ({ ...value, execution }))} /> : null}
            {customStep === 'review' ? (
              <View style={styles.review}>
                <Text style={styles.rowTitle}>{custom.name}</Text>
                <Text style={styles.rowMeta}>{[custom.primary, ...custom.secondary, custom.execution].filter(Boolean).join(' · ')}</Text>
                {similarityMatches.length ? (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.sectionLabel}>POSSIBLE MATCHES — REUSE WHEN EXACT</Text>
                    {similarityMatches.map((match) => (
                      <Pressable
                        key={`${match.tier}:${match.movement_definition.id}`}
                        onPress={() => void onSelect(match.movement_definition)}
                        style={styles.choice}
                      >
                        <Text style={styles.choiceText}>{match.movement_definition.display_name} · {match.tier.replaceAll('_', ' ')}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : <Text style={styles.rowMeta}>No governed duplicates found.</Text>}
                <TextInput multiline value={custom.notes} onChangeText={(notes) => setCustom((value) => ({ ...value, notes }))} placeholder="Optional notes" placeholderTextColor={SLColors.textSubtle} style={styles.customInput} />
              </View>
            ) : null}
            <Pressable disabled={saving} onPress={customStep === 'review' ? () => void createCustom() : nextCustomStep} style={styles.primaryAction}>
              {saving ? <ActivityIndicator color={SLColors.textStrong} /> : <Text style={styles.primaryActionText}>{customStep === 'review' ? 'Create & Select' : 'Continue'}</Text>}
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function ChoiceGrid({ rows, selected, onPress }: { rows: { key: string; label: string }[]; selected: string[]; onPress: (key: string) => void }) {
  return <View style={styles.choices}>{rows.map((row) => <Pressable key={row.key} onPress={() => onPress(row.key)} style={[styles.choice, selected.includes(row.key) && styles.choiceActive]}><Text style={styles.choiceText}>{row.label}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#050509', paddingHorizontal: SLSpacing.md },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292432' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#15111d' },
  headerCopy: { flex: 1, paddingHorizontal: 12 }, title: { color: SLColors.textStrong, fontSize: 19, fontWeight: '700' }, subtitle: { color: SLColors.textMuted, fontSize: 12, marginTop: 2 },
  searchWrap: { marginTop: 14, minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#30293d', borderRadius: SLRadius.md, backgroundColor: '#0e0c13' }, search: { flex: 1, color: SLColors.textStrong, paddingHorizontal: 10, fontSize: 16 },
  modeRail: { flexGrow: 0, flexShrink: 0, height: 62 },
  modes: { gap: 8, paddingVertical: 12, paddingRight: SLSpacing.md }, mode: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: '#292432', backgroundColor: '#0c0a10' }, modeActive: { borderColor: SLColors.accent, backgroundColor: '#211334' }, modeText: { color: SLColors.textMuted, fontSize: 13 }, modeTextActive: { color: SLColors.textStrong },
  scroll: { flex: 1, minHeight: 0 }, list: { paddingTop: 2, paddingBottom: 18, gap: 8 }, sectionLabel: { color: SLColors.textSubtle, fontSize: 11, letterSpacing: 1, marginTop: 8 }, row: { minHeight: 74, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#292432', backgroundColor: '#0c0b10' }, rowSelected: { borderColor: SLColors.success }, pressed: { opacity: .76, transform: [{ scale: .992 }] }, artwork: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#15111d' }, rowCopy: { flex: 1 }, rowTitle: { color: SLColors.textStrong, fontSize: 15, fontWeight: '600' }, rowMeta: { color: SLColors.textMuted, fontSize: 12, marginTop: 4, textTransform: 'capitalize' }, empty: { color: SLColors.textMuted, textAlign: 'center', paddingVertical: 32 }, loading: { marginVertical: 28 },
  primaryAction: { minHeight: 52, marginTop: 10, borderRadius: SLRadius.md, backgroundColor: '#5f26b8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryActionText: { color: SLColors.textStrong, fontWeight: '700', fontSize: 15 },
  customBody: { paddingVertical: 20, paddingBottom: 40 }, step: { color: SLColors.accent, letterSpacing: 1.2, fontSize: 12, marginBottom: 14 }, customInput: { minHeight: 52, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#382c4a', backgroundColor: '#0d0b12', color: SLColors.textStrong, padding: 14, fontSize: 16 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, choice: { paddingHorizontal: 13, minHeight: 42, justifyContent: 'center', borderRadius: 21, borderWidth: 1, borderColor: '#30293d', backgroundColor: '#0d0b12' }, choiceActive: { borderColor: SLColors.accent, backgroundColor: '#26153b' }, choiceText: { color: SLColors.textStrong, fontSize: 13 }, review: { padding: 16, gap: 12, borderWidth: 1, borderColor: '#382c4a', borderRadius: SLRadius.md, backgroundColor: '#0d0b12' },
});
