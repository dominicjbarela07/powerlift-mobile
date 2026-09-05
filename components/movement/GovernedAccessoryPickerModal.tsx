import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CanonicalMovementArtwork } from '@/components/movement/CanonicalMovementArtwork';
import { GovernedMuscleThumbnail } from '@/components/anatomy/GovernedMuscleThumbnail';
import { Text, TextInput } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing } from '@/constants/theme';
import { fetchJson } from '@/lib/api';
import {
  ACCESSORY_PICKER_REGIONS,
  accessoryTaxonomyLabel,
  availableSwapEquipmentTypeFilters,
  rankSimilarAccessoryMovements,
  type AccessoryExecutionFamilyFacet,
  type AccessoryExecutionFamilyKey,
  type AccessoryPickerRegion,
  type SimilarAccessoryCandidate,
} from '@/lib/canonical-accessory-discovery';
import { accessoryRegionalArtworkAsset } from '@/lib/accessory-muscle-region-assets';

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
type DiscoveryStep = 'home' | 'regions' | 'muscles' | 'results';
type PickerMode = 'search' | 'favorites' | 'recent' | 'custom' | 'muscle';
type CustomStep = 'name' | 'primary' | 'secondary' | 'execution' | 'review';
type Props = {
  context: 'in-session-substitution';
  visible: boolean;
  athleteId: number | null;
  athleteAnatomy?: { anatomy_display_preference?: string | null; sex?: string | null } | null;
  title?: string;
  currentIdentity?: GovernedAccessoryIdentity | null;
  currentPrescription?: string;
  canCreateCustom?: boolean;
  onCancel: () => void;
  onSelect: (identity: GovernedAccessoryIdentity) => void | Promise<void>;
};

const ACCELERATORS: { key: Exclude<PickerMode, 'search' | 'muscle'>; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'favorites', label: 'Favorites', icon: 'star-outline' },
  { key: 'recent', label: 'Recent', icon: 'time-outline' },
  { key: 'custom', label: 'My Movements', icon: 'person-outline' },
];

function uniqueIdentities(items: GovernedAccessoryIdentity[], excludedId?: number | null) {
  const unique = new Map<number, GovernedAccessoryIdentity>();
  items.forEach((item) => {
    const id = Number(item?.id || 0);
    if (id && id !== Number(excludedId || 0)) unique.set(id, item);
  });
  return [...unique.values()];
}

function MuscleArtwork({
  athlete,
  muscle,
}: {
  athlete?: Props['athleteAnatomy'];
  muscle: string;
}) {
  return (
    <GovernedMuscleThumbnail
      athlete={athlete}
      primary={muscle}
      style={styles.muscleArtwork}
      testID={`swap-muscle-thumbnail-${muscle}`}
    />
  );
}

export function GovernedAccessorySubstitutionPickerModal({
  context: _context,
  visible,
  athleteId,
  athleteAnatomy,
  title = 'Swap Accessory',
  currentIdentity,
  currentPrescription = '',
  canCreateCustom = false,
  onCancel,
  onSelect,
}: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<DiscoveryStep>('home');
  const [mode, setMode] = useState<PickerMode>('search');
  const [selectedRegion, setSelectedRegion] = useState<AccessoryPickerRegion | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [selectedExecutionFamily, setSelectedExecutionFamily] = useState<AccessoryExecutionFamilyKey | ''>('');
  const [executionFamilyFacets, setExecutionFamilyFacets] = useState<AccessoryExecutionFamilyFacet[]>([]);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<GovernedAccessoryIdentity[]>([]);
  const [similar, setSimilar] = useState<SimilarAccessoryCandidate<GovernedAccessoryIdentity>[]>([]);
  const [loading, setLoading] = useState(false);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [error, setError] = useState('');
  const [customStep, setCustomStep] = useState<CustomStep | null>(null);
  const [authoring, setAuthoring] = useState<AuthoringOptions>({});
  const [custom, setCustom] = useState({ name: '', primary: '', secondary: [] as string[], execution: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [similarityMatches, setSimilarityMatches] = useState<{ tier: string; movement_definition: GovernedAccessoryIdentity }[]>([]);
  const requestRef = useRef(0);
  const similarRequestRef = useRef(0);
  const currentSecondaryKey = (currentIdentity?.secondary_muscle_groups || []).join('|');
  const similaritySubject = useMemo(() => currentIdentity?.id ? {
    id: Number(currentIdentity.id),
    display_name: currentIdentity.display_name,
    primary_muscle_group: currentIdentity.primary_muscle_group,
    secondary_muscle_groups: currentSecondaryKey ? currentSecondaryKey.split('|') : [],
    execution_family: currentIdentity.execution_family,
    family: currentIdentity.family,
    requires_equipment_configuration: currentIdentity.requires_equipment_configuration,
  } : null, [
    currentIdentity?.display_name,
    currentIdentity?.execution_family,
    currentIdentity?.family,
    currentIdentity?.id,
    currentIdentity?.primary_muscle_group,
    currentIdentity?.requires_equipment_configuration,
    currentSecondaryKey,
  ]);

  useEffect(() => {
    if (!visible) return;
    setStep('home');
    setMode('search');
    setSelectedRegion(null);
    setSelectedMuscle('');
    setSelectedExecutionFamily('');
    setExecutionFamilyFacets([]);
    setQuery('');
    setRows([]);
    setCustomStep(null);
    setSimilarityMatches([]);
    setError('');
  }, [visible]);

  useEffect(() => {
    if (!visible || !athleteId || !similaritySubject?.id || !similaritySubject.primary_muscle_group) {
      setSimilar([]);
      return;
    }
    const requestId = ++similarRequestRef.current;
    const params = new URLSearchParams({
      athlete_id: String(athleteId),
      primary_muscle_group: similaritySubject.primary_muscle_group,
      include_secondary: '1',
      limit: '24',
    });
    setSimilarLoading(true);
    void fetchJson<any>(`/workouts/mobile/movement-definitions/search?${params.toString()}`, { method: 'GET' })
      .then((response) => {
        if (requestId !== similarRequestRef.current) return;
        const json = response.json || {};
        if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
        const grouped = json.result_groups;
        const items = grouped ? [...(grouped.primary?.items || []), ...(grouped.secondary?.items || [])] : (json.items || []);
        setSimilar(rankSimilarAccessoryMovements(similaritySubject, uniqueIdentities(items, similaritySubject.id)));
      })
      .catch(() => requestId === similarRequestRef.current && setSimilar([]))
      .finally(() => requestId === similarRequestRef.current && setSimilarLoading(false));
  }, [
    athleteId,
    similaritySubject,
    visible,
  ]);

  useEffect(() => {
    if (!visible || customStep || step !== 'results' || !athleteId) return;
    if (mode === 'search' && !query.trim()) {
      setRows([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestRef.current;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ athlete_id: String(athleteId), limit: '24' });
      if (query.trim()) params.set('q', query.trim());
      if (currentIdentity?.id) params.set('exclude_movement_definition_id', String(currentIdentity.id));
      if (mode === 'favorites') params.set('favorites_only', '1');
      if (mode === 'recent') params.set('recent_only', '1');
      if (mode === 'custom') params.set('custom_only', '1');
      if (mode === 'muscle' && selectedMuscle) {
        params.set('primary_muscle_group', selectedMuscle);
        params.set('include_secondary', '1');
        if (selectedExecutionFamily) params.set('execution_family', selectedExecutionFamily);
      }
      setLoading(true);
      setError('');
      void fetchJson<any>(`/workouts/mobile/movement-definitions/search?${params.toString()}`, { method: 'GET' })
        .then((response) => {
          if (requestId !== requestRef.current) return;
          const json = response.json || {};
          if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
          const grouped = json.result_groups;
          const items = grouped ? [...(grouped.primary?.items || []), ...(grouped.secondary?.items || [])] : (json.items || []);
          const nextRows = uniqueIdentities(items, currentIdentity?.id);
          const facets = Array.isArray(grouped?.execution_families)
            ? grouped.execution_families
            : [];
          if (mode === 'muscle' && facets.length) {
            setExecutionFamilyFacets(facets);
          } else if (mode === 'muscle' && !selectedExecutionFamily) {
            setExecutionFamilyFacets(
              availableSwapEquipmentTypeFilters(null, nextRows).map(({ key }) => ({ key, count: 1 })),
            );
          }
          setRows(nextRows);
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
  }, [athleteId, currentIdentity?.id, customStep, mode, query, selectedExecutionFamily, selectedMuscle, step, visible]);

  const equipmentTypeFilters = useMemo(
    () => availableSwapEquipmentTypeFilters(executionFamilyFacets, rows),
    [executionFamilyFacets, rows],
  );

  const resultTitle = useMemo(() => {
    if (mode === 'favorites') return 'Favorites';
    if (mode === 'recent') return 'Recent';
    if (mode === 'custom') return 'My Movements';
    if (mode === 'muscle') return accessoryTaxonomyLabel(selectedMuscle);
    return 'Search Results';
  }, [mode, selectedMuscle]);

  const openAccelerator = (nextMode: Exclude<PickerMode, 'search' | 'muscle'>) => {
    setMode(nextMode);
    setQuery('');
    setStep('results');
  };
  const openSearch = (nextQuery: string) => {
    setQuery(nextQuery);
    if (step === 'results' && mode === 'muscle') return;
    setMode('search');
    if (nextQuery.trim()) setStep('results');
  };

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
        body: JSON.stringify({ athlete_id: athleteId, display_name: custom.name.trim(), primary_muscle_group: custom.primary, secondary_muscle_groups: custom.secondary, execution_family: custom.execution, notes: custom.notes.trim(), confirm_similar: true }),
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

  const renderIdentity = (identity: GovernedAccessoryIdentity, reason?: string) => (
    <Pressable accessibilityLabel={`Select ${identity.display_name}`} accessibilityRole="button" key={identity.id} onPress={() => void onSelect(identity)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <CanonicalMovementArtwork movement={{ ...identity, kind: 'accessory' }} size={62} style={styles.artwork} testID="governed-picker-canonical-movement-artwork" />
      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={styles.rowTitle}>{identity.display_name}</Text>
        <Text numberOfLines={2} style={styles.rowMeta}>{reason || [accessoryTaxonomyLabel(identity.primary_muscle_group), accessoryTaxonomyLabel(identity.execution_family)].filter(Boolean).join(' · ') || 'Governed accessory'}</Text>
      </View>
      <Ionicons color={SLColors.textMuted} name="chevron-forward" size={20} />
    </Pressable>
  );

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
        body: JSON.stringify({ athlete_id: athleteId, display_name: custom.name.trim(), primary_muscle_group: custom.primary, secondary_muscle_groups: custom.secondary, execution_family: custom.execution, notes: custom.notes.trim() }),
      }).then((response) => {
        const json = response.json || {};
        if (!response.ok || !json.ok) throw new Error(json.error || 'Possible matches could not be reviewed.');
        setSimilarityMatches(Array.isArray(json.matches) ? json.matches : []);
        setCustomStep('review');
      }).catch((reason) => Alert.alert('Review unavailable', reason?.message || 'Try again.')).finally(() => setSaving(false));
    }
  };
  const navigateBack = () => {
    if (customStep) return setCustomStep(null);
    if (step === 'results' && mode === 'muscle') setStep('muscles');
    else if (step === 'muscles') setStep('regions');
    else setStep('home');
  };

  return (
    <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="fullScreen" statusBarTranslucent visible={visible}>
      <View style={[styles.shell, { paddingTop: Math.max(insets.top, SLSpacing.sm), paddingBottom: Math.max(insets.bottom, SLSpacing.sm) }]}>
        <View style={styles.header}>
          <Pressable accessibilityLabel={step === 'home' && !customStep ? 'Close Swap' : 'Back'} onPress={step === 'home' && !customStep ? onCancel : navigateBack} style={styles.headerButton}>
            <Ionicons color={SLColors.textStrong} name={step === 'home' && !customStep ? 'close' : 'arrow-back'} size={23} />
          </Pressable>
          <View style={styles.headerCopy}><Text numberOfLines={1} style={styles.title}>{customStep ? 'Create Governed Movement' : title}</Text><Text numberOfLines={1} style={styles.subtitle}>Self-coached Session programming</Text></View>
        </View>

        {!customStep ? <>
          <View style={styles.searchOuter}><View style={styles.searchWrap}><Ionicons color={SLColors.textMuted} name="search" size={18} /><TextInput onChangeText={openSearch} placeholder="Search names, aliases, or taxonomy" placeholderTextColor={SLColors.textSubtle} style={styles.search} value={query} /></View></View>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" style={styles.scroll}>
            {step === 'home' ? <>
              {currentIdentity ? <View style={styles.contextCard}>
                <CanonicalMovementArtwork movement={{ ...currentIdentity, kind: 'accessory' }} size={70} style={styles.contextArtwork} />
                <View style={styles.contextCopy}><Text style={styles.sectionLabel}>SWAPPING</Text><Text numberOfLines={2} style={styles.contextName}>{currentIdentity.display_name}</Text><Text numberOfLines={1} style={styles.contextMeta}>{[accessoryTaxonomyLabel(currentIdentity.primary_muscle_group), currentIdentity.family_display_name || accessoryTaxonomyLabel(currentIdentity.family)].filter(Boolean).join(' · ')}</Text><Text style={styles.prescriptionLabel}>Current prescription</Text><Text style={styles.prescription}>{currentPrescription || 'No prescription'}</Text></View>
              </View> : null}
              <Text style={styles.sectionLabel}>SIMILAR MOVEMENTS</Text>
              {similarLoading ? <ActivityIndicator color={SLColors.accent} style={styles.loadingCompact} /> : null}
              {!similarLoading && similar.length ? similar.map((candidate) => renderIdentity(candidate.identity, candidate.reason)) : null}
              {!similarLoading && !similar.length ? <Text style={styles.helper}>No authoritative taxonomy matches are available. Browse deliberately below.</Text> : null}
              <Pressable onPress={() => setStep('regions')} style={({ pressed }) => [styles.browseButton, pressed && styles.pressed]}><Ionicons color="#FFFFFF" name="body-outline" size={24} /><View style={styles.browseCopy}><Text style={styles.browseTitle}>Browse by Muscle Group</Text><Text style={styles.browseMeta}>Canonical Session Workspace drill-down</Text></View><Ionicons color="#FFFFFF" name="chevron-forward" size={20} /></Pressable>
              <Text style={styles.sectionLabel}>QUICK ACCESS</Text><View style={styles.accelerators}>{ACCELERATORS.map((entry) => <Pressable key={entry.key} onPress={() => openAccelerator(entry.key)} style={({ pressed }) => [styles.accelerator, pressed && styles.pressed]}><Ionicons color={SLColors.accentViolet} name={entry.icon} size={20} /><Text style={styles.acceleratorText}>{entry.label}</Text></Pressable>)}</View>
            </> : null}

            {step === 'regions' ? <><Text style={styles.pageTitle}>What are you trying to train?</Text><Text style={styles.pageMeta}>Choose a region, then an exact governed muscle target.</Text><View style={styles.regionGrid}>{ACCESSORY_PICKER_REGIONS.map((region) => <Pressable key={region.key} onPress={() => { setSelectedRegion(region); setStep('muscles'); }} style={({ pressed }) => [styles.regionCard, pressed && styles.pressed]}><Image accessibilityIgnoresInvertColors resizeMode="contain" source={accessoryRegionalArtworkAsset(region.artwork).source} style={styles.regionArtwork} /><Text style={styles.regionLabel}>{region.label}</Text></Pressable>)}</View></> : null}

            {step === 'muscles' && selectedRegion ? <><View style={styles.regionHero}><Image accessibilityIgnoresInvertColors resizeMode="contain" source={accessoryRegionalArtworkAsset(selectedRegion.artwork).source} style={styles.regionHeroArtwork} /><View style={styles.rowCopy}><Text style={styles.pageTitle}>{selectedRegion.label}</Text><Text style={styles.pageMeta}>Choose the primary muscle target.</Text></View></View>{selectedRegion.muscles.map((muscle) => <Pressable key={muscle} onPress={() => { setSelectedMuscle(muscle); setSelectedExecutionFamily(''); setExecutionFamilyFacets([]); setMode('muscle'); setQuery(''); setStep('results'); }} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><MuscleArtwork athlete={athleteAnatomy} muscle={muscle} /><Text style={[styles.rowTitle, styles.rowCopy]}>{accessoryTaxonomyLabel(muscle)}</Text><Ionicons color={SLColors.textMuted} name="chevron-forward" size={20} /></Pressable>)}</> : null}

            {step === 'results' ? <><Text style={styles.pageTitle}>{resultTitle}</Text>{mode === 'muscle' ? <><Text style={styles.pageMeta}>Primary matches first, followed by movements that also train this target.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.equipmentFilterRail} testID="swap-equipment-type-filters"><Pressable accessibilityRole="button" accessibilityState={{ selected: !selectedExecutionFamily }} onPress={() => setSelectedExecutionFamily('')} style={[styles.equipmentFilterChip, !selectedExecutionFamily && styles.equipmentFilterChipActive]}><Text style={[styles.equipmentFilterText, !selectedExecutionFamily && styles.equipmentFilterTextActive]}>All</Text></Pressable>{equipmentTypeFilters.map((filter) => <Pressable accessibilityLabel={`Filter by ${filter.label}`} accessibilityRole="button" accessibilityState={{ selected: selectedExecutionFamily === filter.key }} key={filter.key} onPress={() => setSelectedExecutionFamily(filter.key)} style={[styles.equipmentFilterChip, selectedExecutionFamily === filter.key && styles.equipmentFilterChipActive]}><Text style={[styles.equipmentFilterText, selectedExecutionFamily === filter.key && styles.equipmentFilterTextActive]}>{filter.label}</Text></Pressable>)}</ScrollView></> : null}{loading ? <ActivityIndicator color={SLColors.accent} style={styles.loading} /> : null}{!loading ? rows.map((identity) => renderIdentity(identity)) : null}{!loading && !rows.length ? <Text style={styles.empty}>{error || (mode === 'search' ? 'Type a movement name or governed taxonomy term.' : 'No matching accessory movements.')}</Text> : null}{canCreateCustom && mode === 'custom' ? <Pressable onPress={() => void beginCustom()} style={styles.primaryAction}><Ionicons color={SLColors.textStrong} name="add-circle-outline" size={20} /><Text style={styles.primaryActionText}>Create Governed Movement</Text></Pressable> : null}</> : null}
          </ScrollView>
        </> : <ScrollView contentContainerStyle={styles.customBody} keyboardShouldPersistTaps="handled" style={styles.scroll}>
          <Text style={styles.stepLabel}>STEP {['name', 'primary', 'secondary', 'execution', 'review'].indexOf(customStep) + 1} OF 5</Text>
          {customStep === 'name' ? <TextInput autoFocus onChangeText={(name) => setCustom((value) => ({ ...value, name }))} placeholder="Movement name" placeholderTextColor={SLColors.textSubtle} style={styles.customInput} value={custom.name} /> : null}
          {customStep === 'primary' ? <ChoiceGrid onPress={(primary) => setCustom((value) => ({ ...value, primary }))} rows={muscles} selected={[custom.primary]} /> : null}
          {customStep === 'secondary' ? <ChoiceGrid onPress={(key) => setCustom((value) => ({ ...value, secondary: value.secondary.includes(key) ? value.secondary.filter((item) => item !== key) : [...value.secondary, key] }))} rows={muscles.filter((row) => row.key !== custom.primary)} selected={custom.secondary} /> : null}
          {customStep === 'execution' ? <ChoiceGrid onPress={(execution) => setCustom((value) => ({ ...value, execution }))} rows={executions} selected={[custom.execution]} /> : null}
          {customStep === 'review' ? <View style={styles.review}><Text style={styles.rowTitle}>{custom.name}</Text><Text style={styles.rowMeta}>{[custom.primary, ...custom.secondary, custom.execution].filter(Boolean).map(accessoryTaxonomyLabel).join(' · ')}</Text>{similarityMatches.length ? <View style={styles.reviewMatches}><Text style={styles.sectionLabel}>POSSIBLE MATCHES — REUSE WHEN EXACT</Text>{similarityMatches.map((match) => <Pressable key={`${match.tier}:${match.movement_definition.id}`} onPress={() => void onSelect(match.movement_definition)} style={styles.choice}><Text style={styles.choiceText}>{match.movement_definition.display_name} · {match.tier.replaceAll('_', ' ')}</Text></Pressable>)}</View> : <Text style={styles.rowMeta}>No governed duplicates found.</Text>}<TextInput multiline onChangeText={(notes) => setCustom((value) => ({ ...value, notes }))} placeholder="Optional notes" placeholderTextColor={SLColors.textSubtle} style={styles.customInput} value={custom.notes} /></View> : null}
          <Pressable disabled={saving} onPress={customStep === 'review' ? () => void createCustom() : nextCustomStep} style={styles.primaryAction}>{saving ? <ActivityIndicator color={SLColors.textStrong} /> : <Text style={styles.primaryActionText}>{customStep === 'review' ? 'Create & Select' : 'Continue'}</Text>}</Pressable>
        </ScrollView>}
      </View>
    </Modal>
  );
}

function ChoiceGrid({ rows, selected, onPress }: { rows: { key: string; label: string }[]; selected: string[]; onPress: (key: string) => void }) {
  return <View style={styles.choices}>{rows.map((row) => <Pressable key={row.key} onPress={() => onPress(row.key)} style={[styles.choice, selected.includes(row.key) && styles.choiceActive]}><Text style={styles.choiceText}>{row.label}</Text></Pressable>)}</View>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: '#000000' },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SLSpacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#292432' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#15111d' },
  headerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 12 }, title: { color: SLColors.textStrong, fontSize: 19, fontWeight: '700' }, subtitle: { color: SLColors.textMuted, fontSize: 12, marginTop: 2 },
  searchOuter: { paddingHorizontal: SLSpacing.md, paddingTop: 12 }, searchWrap: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#30293d', borderRadius: SLRadius.md, backgroundColor: '#0e0c13' }, search: { flex: 1, color: SLColors.textStrong, paddingHorizontal: 10, fontSize: 16 },
  scroll: { flex: 1, minHeight: 0 }, scrollContent: { paddingHorizontal: SLSpacing.md, paddingTop: 14, paddingBottom: 40, gap: 9 },
  contextCard: { minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: '#332943', backgroundColor: '#09070d' }, contextArtwork: { flexShrink: 0, borderRadius: 12, backgroundColor: '#15111d' }, contextCopy: { flex: 1, minWidth: 0 }, contextName: { color: SLColors.textStrong, fontSize: 16, lineHeight: 21, fontWeight: '700', marginTop: 2 }, contextMeta: { color: SLColors.textMuted, fontSize: 12, marginTop: 3 }, prescriptionLabel: { color: SLColors.textSubtle, fontSize: 10, letterSpacing: .7, textTransform: 'uppercase', marginTop: 8 }, prescription: { color: SLColors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  sectionLabel: { color: SLColors.textSubtle, fontSize: 11, letterSpacing: 1, marginTop: 9 }, helper: { color: SLColors.textMuted, fontSize: 13, lineHeight: 19, paddingVertical: 10 },
  row: { minHeight: 76, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#292432', backgroundColor: '#0c0b10' }, pressed: { opacity: .76, transform: [{ scale: .992 }] }, artwork: { width: 58, height: 58, borderRadius: 10, backgroundColor: '#15111d' }, rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { color: SLColors.textStrong, fontSize: 15, lineHeight: 20, fontWeight: '600' }, rowMeta: { color: SLColors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  browseButton: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 7, paddingHorizontal: 16, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: '#9A5BE8', backgroundColor: '#4b1f78' }, browseCopy: { flex: 1, minWidth: 0 }, browseTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }, browseMeta: { color: '#D8C6ED', fontSize: 12, marginTop: 3 },
  accelerators: { flexDirection: 'row', gap: 8 }, accelerator: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 5, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#30293d', backgroundColor: '#0d0b12' }, acceleratorText: { color: SLColors.textStrong, fontSize: 12, textAlign: 'center', fontWeight: '600' },
  pageTitle: { color: SLColors.textStrong, fontSize: 22, lineHeight: 28, fontWeight: '700', marginTop: 4 }, pageMeta: { color: SLColors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 5 }, regionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, regionCard: { width: '48%', flexGrow: 1, minHeight: 138, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: SLRadius.lg, borderWidth: 1, borderColor: '#30293d', backgroundColor: '#0d0b12' }, regionArtwork: { width: 86, height: 86 }, regionLabel: { color: SLColors.textStrong, fontSize: 14, fontWeight: '700', marginTop: 4 }, regionHero: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: SLRadius.lg, backgroundColor: '#0d0b12' }, regionHeroArtwork: { width: 82, height: 82 }, muscleArtwork: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 10, overflow: 'hidden', backgroundColor: '#15111d' },
  equipmentFilterRail: { gap: 8, paddingBottom: 3 }, equipmentFilterChip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: '#30293d', backgroundColor: '#0d0b12' }, equipmentFilterChipActive: { borderColor: SLColors.accentViolet, backgroundColor: '#26153b' }, equipmentFilterText: { color: SLColors.textMuted, fontSize: 13, fontWeight: '600' }, equipmentFilterTextActive: { color: SLColors.textStrong },
  empty: { color: SLColors.textMuted, textAlign: 'center', paddingVertical: 32 }, loading: { marginVertical: 28 }, loadingCompact: { marginVertical: 12 }, primaryAction: { minHeight: 52, marginTop: 10, borderRadius: SLRadius.md, backgroundColor: '#5f26b8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryActionText: { color: SLColors.textStrong, fontWeight: '700', fontSize: 15 },
  customBody: { paddingHorizontal: SLSpacing.md, paddingVertical: 20, paddingBottom: 40 }, stepLabel: { color: SLColors.accent, letterSpacing: 1.2, fontSize: 12, marginBottom: 14 }, customInput: { minHeight: 52, borderRadius: SLRadius.md, borderWidth: 1, borderColor: '#382c4a', backgroundColor: '#0d0b12', color: SLColors.textStrong, padding: 14, fontSize: 16 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, choice: { paddingHorizontal: 13, minHeight: 42, justifyContent: 'center', borderRadius: 21, borderWidth: 1, borderColor: '#30293d', backgroundColor: '#0d0b12' }, choiceActive: { borderColor: SLColors.accent, backgroundColor: '#26153b' }, choiceText: { color: SLColors.textStrong, fontSize: 13 }, review: { padding: 16, gap: 12, borderWidth: 1, borderColor: '#382c4a', borderRadius: SLRadius.md, backgroundColor: '#0d0b12' }, reviewMatches: { gap: 8 },
});
