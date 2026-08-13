import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';

import { ThemedText } from '@/components/themed-text';
import { SLScreen } from '@/components/ui';
import { SLColors, SLRadius } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  ACCESSORY_CATALOG_REVIEW_USER_ID,
  ACCESSORY_REVIEW_CATALOG,
  type AccessoryMovement,
  type AccessoryReviewStore,
  type ProposedCorrection,
  type ReviewFilters,
  buildAccessoryReviewJson,
  buildAccessoryReviewMarkdown,
  canAccessAccessoryCatalogReview,
  deriveReviewCounts,
  equipmentConfigurationLabel,
  executionLabel,
  filterAccessoryMovements,
  firstUnreviewedMovement,
  movementSnapshot,
  muscleLabel,
  reviewStateFor,
  setMovementCorrect,
  setMovementCorrected,
} from '@/lib/accessory-catalog-review';
import {
  loadAccessoryReviewStore,
  resetAccessoryReviewStore,
  saveAccessoryReviewStore,
} from '@/lib/accessory-catalog-review-storage';

const DEFAULT_FILTERS: ReviewFilters = {
  state: 'ALL',
  primaryMuscle: null,
  executionFamily: null,
  search: '',
};

function nextUnreviewed(store: AccessoryReviewStore, movementId: string) {
  const movements = ACCESSORY_REVIEW_CATALOG.movements;
  const start = Math.max(0, movements.findIndex((movement) => movement.id === movementId));
  for (let offset = 1; offset <= movements.length; offset += 1) {
    const movement = movements[(start + offset) % movements.length];
    if (reviewStateFor(store, movement.id) === 'UNREVIEWED') return movement;
  }
  return movements[start] ?? null;
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</ThemedText>
    </Pressable>
  );
}

export default function AccessoryCatalogReviewScreen() {
  const { authReady, user } = useAuth();
  const router = useRouter();
  const authorized = canAccessAccessoryCatalogReview(user);
  const [store, setStore] = useState<AccessoryReviewStore | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReviewFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [proposed, setProposed] = useState<ProposedCorrection | null>(null);
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!authorized) {
      router.replace('/(tabs)/settings');
      return;
    }
    let active = true;
    loadAccessoryReviewStore(ACCESSORY_CATALOG_REVIEW_USER_ID).then((loaded) => {
      if (!active) return;
      const resumable = loaded.last_movement_id &&
        reviewStateFor(loaded, loaded.last_movement_id) === 'UNREVIEWED'
        ? ACCESSORY_REVIEW_CATALOG.movements.find((movement) => movement.id === loaded.last_movement_id)
        : null;
      setStore(loaded);
      setCurrentId((resumable ?? firstUnreviewedMovement(loaded) ?? ACCESSORY_REVIEW_CATALOG.movements[0])?.id ?? null);
    });
    return () => { active = false; };
  }, [authReady, authorized, router]);

  const filtered = useMemo(
    () => store ? filterAccessoryMovements(store, filters) : [],
    [filters, store],
  );
  const current = useMemo(
    () => ACCESSORY_REVIEW_CATALOG.movements.find((movement) => movement.id === currentId) ?? filtered[0] ?? null,
    [currentId, filtered],
  );
  const catalogIndex = current
    ? ACCESSORY_REVIEW_CATALOG.movements.findIndex((movement) => movement.id === current.id)
    : -1;
  const filteredIndex = current ? filtered.findIndex((movement) => movement.id === current.id) : -1;
  const counts = useMemo(() => store ? deriveReviewCounts(store) : null, [store]);

  const persist = useCallback(async (next: AccessoryReviewStore) => {
    setStore(next);
    await saveAccessoryReviewStore(next);
  }, []);

  const goTo = useCallback((movement: AccessoryMovement | null) => {
    if (!movement || !store) return;
    setCurrentId(movement.id);
    const next = { ...store, last_movement_id: movement.id };
    void persist(next);
  }, [persist, store]);

  const advanceWithinFilter = useCallback((delta: number) => {
    if (!filtered.length) return;
    const base = filteredIndex >= 0 ? filteredIndex : 0;
    goTo(filtered[(base + delta + filtered.length) % filtered.length]);
  }, [filtered, filteredIndex, goTo]);

  const markCorrect = useCallback(async () => {
    if (!store || !current) return;
    const next = setMovementCorrect(store, current);
    await persist(next);
    setCurrentId(nextUnreviewed(next, current.id)?.id ?? current.id);
  }, [current, persist, store]);

  const openCorrection = useCallback(() => {
    if (!store || !current) return;
    const record = store.reviews[current.id];
    setProposed(record?.proposed ?? movementSnapshot(current));
    setNote(record?.note ?? '');
    setCorrectionOpen(true);
  }, [current, store]);

  const saveCorrection = useCallback(async () => {
    if (!store || !current || !proposed || !proposed.canonical_name.trim()) return;
    const next = setMovementCorrected(store, current, proposed, note);
    await persist(next);
    setCorrectionOpen(false);
    setCurrentId(nextUnreviewed(next, current.id)?.id ?? current.id);
  }, [current, note, persist, proposed, store]);

  const shareExport = useCallback(async (format: 'json' | 'md') => {
    if (!store) return;
    try {
      setSharing(true);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device cannot open the share sheet.');
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      const filename = `strength-ledger-accessory-review-${date}.${format}`;
      const file = new File(Paths.cache, filename);
      file.write(format === 'json' ? buildAccessoryReviewJson(store) : buildAccessoryReviewMarkdown(store));
      await Sharing.shareAsync(file.uri, {
        mimeType: format === 'json' ? 'application/json' : 'text/markdown',
        UTI: format === 'json' ? 'public.json' : 'net.daringfireball.markdown',
        dialogTitle: 'Export Accessory Catalog Review',
      });
    } catch (error: any) {
      Alert.alert('Export failed', error?.message || 'The review export could not be shared.');
    } finally {
      setSharing(false);
    }
  }, [store]);

  const confirmReset = useCallback(() => {
    if (!counts) return;
    Alert.alert(
      'Reset all accessory catalog review progress?',
      `This will clear ${counts.reviewed} reviewed movements and ${counts.corrected} proposed corrections.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Review',
          style: 'destructive',
          onPress: () => {
            void resetAccessoryReviewStore().then((next) => {
              setStore(next);
              setCurrentId(ACCESSORY_REVIEW_CATALOG.movements[0]?.id ?? null);
            });
          },
        },
      ],
    );
  }, [counts]);

  if (!authReady || (authorized && !store)) {
    return <SLScreen style={styles.screen}><ActivityIndicator color={SLColors.accent} /></SLScreen>;
  }
  if (!authorized || !store || !counts) return null;

  const currentState = current ? reviewStateFor(store, current.id) : 'UNREVIEWED';
  const secondary = current?.secondary_muscle_groups.map(muscleLabel).join(' · ') || 'None';
  const percent = counts.total ? (counts.reviewed / counts.total) * 100 : 0;

  return (
    <SLScreen edges="none" padded={false} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderCopy}>
            <ThemedText style={styles.eyebrow}>CATALOG REVIEW</ThemedText>
            <ThemedText style={styles.pageTitle}>Accessory Movement Audit</ThemedText>
          </View>
          <Pressable accessibilityLabel="Return to Settings" onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="close" color={SLColors.text} size={24} />
          </Pressable>
        </View>

        <View style={styles.dashboard}>
          <View style={styles.metricRow}>
            {[
              ['TOTAL', counts.total], ['REVIEWED', counts.reviewed], ['CORRECT', counts.correct],
              ['CORRECTED', counts.corrected], ['REMAINING', counts.remaining],
            ].map(([label, value]) => (
              <View key={String(label)} style={styles.metric}>
                <ThemedText style={styles.metricValue}>{value}</ThemedText>
                <ThemedText style={styles.metricLabel}>{label}</ThemedText>
              </View>
            ))}
          </View>
          <View style={styles.progressCopy}>
            <ThemedText style={styles.progressText}>{counts.reviewed} / {counts.total} reviewed</ThemedText>
            <ThemedText style={styles.progressText}>{percent.toFixed(1)}%</ThemedText>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
        </View>

        <View style={styles.controlRow}>
          <Pressable onPress={() => setQueueOpen(true)} style={styles.controlButton}>
            <Ionicons name="list-outline" color={SLColors.accentMuted} size={19} />
            <ThemedText style={styles.controlText}>Review Queue</ThemedText>
          </Pressable>
          <Pressable onPress={() => setFilterOpen(true)} style={styles.controlButton}>
            <Ionicons name="options-outline" color={SLColors.accentMuted} size={19} />
            <ThemedText style={styles.controlText}>Filters</ThemedText>
          </Pressable>
        </View>

        {current ? (
          <View style={styles.reviewCard}>
            <View style={styles.cardTopRow}>
              <ThemedText style={styles.cardPosition}>{catalogIndex + 1} / {counts.total}</ThemedText>
              <View style={[styles.stateBadge, currentState === 'CORRECTED' && styles.stateCorrected]}>
                <ThemedText style={styles.stateText}>{currentState}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.movementName}>{current.canonical_name}</ThemedText>
            <View style={styles.taxonomyGrid}>
              <View style={styles.taxonomyBlock}>
                <ThemedText style={styles.taxonomyLabel}>PRIMARY</ThemedText>
                <ThemedText style={styles.taxonomyValue}>{muscleLabel(current.primary_muscle_group)}</ThemedText>
              </View>
              <View style={styles.taxonomyBlock}>
                <ThemedText style={styles.taxonomyLabel}>SECONDARY</ThemedText>
                <ThemedText style={styles.taxonomyValue}>{secondary}</ThemedText>
              </View>
              <View style={styles.taxonomyBlock}>
                <ThemedText style={styles.taxonomyLabel}>EXECUTION</ThemedText>
                <ThemedText style={styles.taxonomyValue}>{executionLabel(current.execution_family)}</ThemedText>
              </View>
              <View style={styles.taxonomyBlock}>
                <ThemedText style={styles.taxonomyLabel}>EQUIPMENT CONFIG</ThemedText>
                <ThemedText style={styles.taxonomyValue}>{equipmentConfigurationLabel(current)}</ThemedText>
              </View>
            </View>
            <ThemedText selectable style={styles.stableId}>{current.id}</ThemedText>
          </View>
        ) : (
          <View style={styles.emptyCard}><ThemedText style={styles.emptyText}>No movements match these filters.</ThemedText></View>
        )}

        <View style={styles.decisionRow}>
          <Pressable disabled={!current} onPress={markCorrect} style={[styles.decisionButton, styles.correctButton]}>
            <Ionicons name="checkmark-circle-outline" color={SLColors.success} size={23} />
            <ThemedText style={styles.decisionText}>Looks Correct</ThemedText>
          </Pressable>
          <Pressable disabled={!current} onPress={openCorrection} style={[styles.decisionButton, styles.correctionButton]}>
            <Ionicons name="create-outline" color={SLColors.warning} size={23} />
            <ThemedText style={styles.decisionText}>Needs Correction</ThemedText>
          </Pressable>
        </View>

        <View style={styles.navigationRow}>
          <Pressable onPress={() => advanceWithinFilter(-1)} style={styles.navigationButton}>
            <Ionicons name="chevron-back" size={18} color={SLColors.textSecondary} />
            <ThemedText style={styles.navigationText}>Previous</ThemedText>
          </Pressable>
          <Pressable onPress={() => advanceWithinFilter(1)} style={styles.navigationButton}>
            <ThemedText style={styles.navigationText}>Skip for Now</ThemedText>
            <Ionicons name="chevron-forward" size={18} color={SLColors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.exportRow}>
          <Pressable disabled={sharing} onPress={() => shareExport('json')} style={styles.secondaryAction}>
            <ThemedText style={styles.secondaryActionText}>{sharing ? 'Preparing…' : 'Export JSON'}</ThemedText>
          </Pressable>
          <Pressable disabled={sharing} onPress={() => shareExport('md')} style={styles.secondaryAction}>
            <ThemedText style={styles.secondaryActionText}>Export Markdown</ThemedText>
          </Pressable>
        </View>
        <Pressable onPress={confirmReset} style={styles.resetButton}>
          <ThemedText style={styles.resetText}>Reset Review</ThemedText>
        </Pressable>
      </ScrollView>

      <Modal visible={correctionOpen} animationType="slide" transparent onRequestClose={() => setCorrectionOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Proposed Correction</ThemedText>
              <Pressable onPress={() => setCorrectionOpen(false)}><Ionicons name="close" size={25} color={SLColors.text} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {current && proposed ? (
                <>
                  <ThemedText style={styles.editorLabel}>CANONICAL DISPLAY NAME</ThemedText>
                  <TextInput value={proposed.canonical_name} onChangeText={(value) => setProposed({ ...proposed, canonical_name: value })} style={styles.textInput} />
                  <ThemedText style={styles.editorLabel}>PRIMARY MUSCLE GROUP</ThemedText>
                  <View style={styles.chipWrap}>{ACCESSORY_REVIEW_CATALOG.muscle_groups.map((group) => (
                    <ChoiceChip key={group.key} label={group.label} selected={proposed.primary_muscle_group === group.key} onPress={() => setProposed({ ...proposed, primary_muscle_group: group.key, secondary_muscle_groups: proposed.secondary_muscle_groups.filter((key) => key !== group.key) })} />
                  ))}</View>
                  <ThemedText style={styles.editorLabel}>SECONDARY MUSCLE GROUPS</ThemedText>
                  <View style={styles.chipWrap}>{ACCESSORY_REVIEW_CATALOG.muscle_groups.map((group) => {
                    const selected = proposed.secondary_muscle_groups.includes(group.key);
                    const disabled = group.key === proposed.primary_muscle_group || (!selected && proposed.secondary_muscle_groups.length >= 3);
                    return <Pressable key={group.key} disabled={disabled} onPress={() => setProposed({ ...proposed, secondary_muscle_groups: selected ? proposed.secondary_muscle_groups.filter((key) => key !== group.key) : [...proposed.secondary_muscle_groups, group.key] })} style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}><ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>{group.label}</ThemedText></Pressable>;
                  })}</View>
                  <ThemedText style={styles.editorLabel}>EXECUTION FAMILY</ThemedText>
                  <View style={styles.chipWrap}>{ACCESSORY_REVIEW_CATALOG.execution_families.map((family) => (
                    <ChoiceChip key={family.key} label={family.label} selected={proposed.execution_family === family.key} onPress={() => setProposed({ ...proposed, execution_family: family.key })} />
                  ))}</View>
                  <ThemedText style={styles.editorLabel}>OPTIONAL REVIEW NOTE</ThemedText>
                  <TextInput multiline value={note} onChangeText={setNote} placeholder="Why should this change?" placeholderTextColor={SLColors.textMuted} style={[styles.textInput, styles.noteInput]} />
                  <Pressable onPress={saveCorrection} style={styles.saveButton}><ThemedText style={styles.saveButtonText}>Save Correction</ThemedText></Pressable>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={filterOpen} animationType="slide" transparent onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.filterSheet}>
          <View style={styles.modalHeader}><ThemedText style={styles.modalTitle}>Review Filters</ThemedText><Pressable onPress={() => setFilterOpen(false)}><Ionicons name="close" size={25} color={SLColors.text} /></Pressable></View>
          <ScrollView>
            <ThemedText style={styles.editorLabel}>REVIEW STATE</ThemedText>
            <View style={styles.chipWrap}>{(['ALL', 'UNREVIEWED', 'CORRECT', 'CORRECTED'] as const).map((state) => <ChoiceChip key={state} label={state} selected={filters.state === state} onPress={() => setFilters({ ...filters, state })} />)}</View>
            <ThemedText style={styles.editorLabel}>PRIMARY MUSCLE</ThemedText>
            <View style={styles.chipWrap}><ChoiceChip label="All" selected={!filters.primaryMuscle} onPress={() => setFilters({ ...filters, primaryMuscle: null })} />{ACCESSORY_REVIEW_CATALOG.muscle_groups.map((group) => <ChoiceChip key={group.key} label={group.label} selected={filters.primaryMuscle === group.key} onPress={() => setFilters({ ...filters, primaryMuscle: group.key })} />)}</View>
            <ThemedText style={styles.editorLabel}>EXECUTION</ThemedText>
            <View style={styles.chipWrap}><ChoiceChip label="All" selected={!filters.executionFamily} onPress={() => setFilters({ ...filters, executionFamily: null })} />{ACCESSORY_REVIEW_CATALOG.execution_families.map((family) => <ChoiceChip key={family.key} label={family.label} selected={filters.executionFamily === family.key} onPress={() => setFilters({ ...filters, executionFamily: family.key })} />)}</View>
            <Pressable onPress={() => { setFilters(DEFAULT_FILTERS); setFilterOpen(false); }} style={styles.clearButton}><ThemedText style={styles.secondaryActionText}>Clear Filters</ThemedText></Pressable>
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={queueOpen} animationType="slide" transparent onRequestClose={() => setQueueOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.queueSheet}>
          <View style={styles.modalHeader}><ThemedText style={styles.modalTitle}>Review Queue</ThemedText><Pressable onPress={() => setQueueOpen(false)}><Ionicons name="close" size={25} color={SLColors.text} /></Pressable></View>
          <TextInput value={filters.search} onChangeText={(search) => setFilters({ ...filters, search })} placeholder="Search movement name" placeholderTextColor={SLColors.textMuted} style={styles.searchInput} />
          <ThemedText style={styles.queueCount}>{filtered.length} movements</ThemedText>
          <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={({ item }) => (
            <Pressable onPress={() => { goTo(item); setQueueOpen(false); }} style={styles.queueRow}>
              <View style={styles.queueCopy}><ThemedText style={styles.queueName}>{item.canonical_name}</ThemedText><ThemedText style={styles.queueMeta}>{muscleLabel(item.primary_muscle_group)} · {executionLabel(item.execution_family)}</ThemedText></View>
              <ThemedText style={styles.queueState}>{reviewStateFor(store, item.id)}</ThemedText>
            </Pressable>
          )} />
        </View></View>
      </Modal>
    </SLScreen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: SLColors.canvas, flex: 1 },
  content: { paddingTop: 20, paddingBottom: 64, gap: 16 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageHeaderCopy: { flex: 1 },
  eyebrow: { color: SLColors.accentMuted, fontSize: 13, letterSpacing: 1.5 },
  pageTitle: { color: SLColors.textStrong, fontSize: 28, fontWeight: '700', marginTop: 3 },
  iconButton: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: SLColors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: SLColors.surface },
  dashboard: { backgroundColor: SLColors.surface, borderWidth: 1, borderColor: SLColors.border, borderRadius: SLRadius.lg, padding: 14, gap: 10 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'center', flex: 1 },
  metricValue: { color: SLColors.textStrong, fontSize: 20, fontWeight: '700' },
  metricLabel: { color: SLColors.textMuted, fontSize: 9, letterSpacing: 0.7, marginTop: 3 },
  progressCopy: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { color: SLColors.textSecondary, fontSize: 14 },
  progressTrack: { height: 7, backgroundColor: SLColors.surfaceInset, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: SLColors.accent, borderRadius: 99 },
  controlRow: { flexDirection: 'row', gap: 10 },
  controlButton: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: SLColors.border, borderRadius: SLRadius.md, backgroundColor: SLColors.surface },
  controlText: { color: SLColors.textSecondary, fontSize: 15 },
  reviewCard: { aspectRatio: 1, minHeight: 370, padding: 22, justifyContent: 'space-between', backgroundColor: SLColors.object, borderWidth: 1, borderColor: SLColors.borderFocus, borderRadius: 28 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardPosition: { color: SLColors.textSecondary, fontSize: 16 },
  stateBadge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99, backgroundColor: SLColors.surfaceInset, borderWidth: 1, borderColor: SLColors.border },
  stateCorrected: { borderColor: SLColors.warning },
  stateText: { color: SLColors.accentMuted, fontSize: 11, letterSpacing: 1 },
  movementName: { color: SLColors.textStrong, fontSize: 30, lineHeight: 36, fontWeight: '700' },
  taxonomyGrid: { gap: 11 },
  taxonomyBlock: { gap: 2 },
  taxonomyLabel: { color: SLColors.accentMuted, fontSize: 11, letterSpacing: 1.25 },
  taxonomyValue: { color: SLColors.textStrong, fontSize: 18, lineHeight: 23 },
  stableId: { color: SLColors.textMuted, fontSize: 10 },
  emptyCard: { minHeight: 260, borderWidth: 1, borderColor: SLColors.border, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: SLColors.textMuted, fontSize: 17 },
  decisionRow: { gap: 10 },
  decisionButton: { minHeight: 60, borderRadius: SLRadius.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  correctButton: { borderColor: SLColors.success, backgroundColor: SLColors.successSoft },
  correctionButton: { borderColor: SLColors.warning, backgroundColor: SLColors.warningSoft },
  decisionText: { color: SLColors.textStrong, fontSize: 18, fontWeight: '700' },
  navigationRow: { flexDirection: 'row', justifyContent: 'space-between' },
  navigationButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 },
  navigationText: { color: SLColors.textSecondary, fontSize: 15 },
  exportRow: { flexDirection: 'row', gap: 10 },
  secondaryAction: { flex: 1, minHeight: 50, borderWidth: 1, borderColor: SLColors.borderFocus, borderRadius: SLRadius.md, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: SLColors.accentMuted, fontSize: 15, fontWeight: '600' },
  resetButton: { alignItems: 'center', padding: 14 },
  resetText: { color: SLColors.danger, fontSize: 15 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: SLColors.scrim },
  modalSheet: { maxHeight: '92%', backgroundColor: SLColors.plane, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: SLColors.border, padding: 20 },
  filterSheet: { maxHeight: '86%', backgroundColor: SLColors.plane, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: SLColors.border, padding: 20 },
  queueSheet: { height: '82%', backgroundColor: SLColors.plane, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: SLColors.border, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle: { color: SLColors.textStrong, fontSize: 24, fontWeight: '700' },
  editorLabel: { color: SLColors.accentMuted, fontSize: 12, letterSpacing: 1.2, marginBottom: 8, marginTop: 17 },
  textInput: { minHeight: 52, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.border, backgroundColor: SLColors.surfaceInset, color: SLColors.textStrong, fontSize: 17, paddingHorizontal: 14 },
  noteInput: { minHeight: 92, paddingTop: 13, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 39, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: SLColors.border, backgroundColor: SLColors.surfaceInset },
  chipSelected: { borderColor: SLColors.borderFocus, backgroundColor: SLColors.focus },
  chipDisabled: { opacity: 0.35 },
  chipText: { color: SLColors.textSecondary, fontSize: 14 },
  chipTextSelected: { color: SLColors.accentMuted },
  saveButton: { minHeight: 58, marginTop: 22, marginBottom: 30, borderRadius: SLRadius.lg, backgroundColor: SLColors.accent, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: SLColors.textInverted, fontSize: 18, fontWeight: '700' },
  clearButton: { minHeight: 50, marginTop: 24, marginBottom: 30, borderWidth: 1, borderColor: SLColors.borderFocus, borderRadius: SLRadius.md, alignItems: 'center', justifyContent: 'center' },
  searchInput: { minHeight: 50, borderRadius: SLRadius.md, borderWidth: 1, borderColor: SLColors.border, backgroundColor: SLColors.surfaceInset, color: SLColors.textStrong, fontSize: 17, paddingHorizontal: 14 },
  queueCount: { color: SLColors.textMuted, fontSize: 13, marginVertical: 10 },
  queueRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SLColors.divider, gap: 10 },
  queueCopy: { flex: 1 },
  queueName: { color: SLColors.textStrong, fontSize: 16 },
  queueMeta: { color: SLColors.textMuted, fontSize: 12, marginTop: 3 },
  queueState: { color: SLColors.accentMuted, fontSize: 10 },
});
