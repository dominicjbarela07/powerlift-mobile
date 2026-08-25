import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { fetchJson } from '@/lib/api';
import { simplifyMobileMovementList, simplifyMobileMovementText } from '@/lib/mobileMovementNames';
import { SLColors, SLFontFamilies, SLTypography } from '@/constants/theme';
import { SLPageHeader } from '@/components/ui';
import { FloatingControlCoordinator, FloatingDisplayUnitRegistration } from '@/components/ui/floating-control-coordinator';
import { CompactAccomplishmentSignal, type AccomplishmentSignal } from '@/components/core-accomplishments';
import { feedbackAnalytics } from '@/lib/logger-feedback';
import { useSurfaceWeightUnit } from '@/lib/surface-weight-unit';

type HistorySession = {
  id: number;
  title?: string | null;
  label?: string | null;
  date?: string | null;
  kind?: string | null;
  status?: string | null;
  block_name?: string | null;
  recap?: { top_work?: string | null; execution_summary?: string | null } | null;
  focus?: { primary?: string[] } | null;
  accomplishment_signal?: AccomplishmentSignal | null;
};

type FilterOption = {
  key?: string;
  id?: number | string;
  label?: string;
  name?: string;
};

type FilterOptions = {
  blocks?: FilterOption[];
  core_lifts?: FilterOption[];
  accessories?: FilterOption[];
  designations?: FilterOption[];
};

const colors = {
  textStrong: SLColors.textStrong,
  muted: SLColors.textMuted,
  subtle: SLColors.textSubtle,
  line: 'rgba(205, 194, 176, 0.095)',
  lineSoft: 'rgba(205, 194, 176, 0.055)',
  surface: 'rgba(10, 11, 11, 0.24)',
  surfaceStrong: 'rgba(10, 11, 11, 0.92)',
  violet: SLColors.accentViolet,
  green: SLColors.railSuccess,
  amber: SLColors.railWarning,
  red: SLColors.railDanger,
};

export default function SessionHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteId?: string }>();
  const athleteId = params.athleteId ? String(params.athleteId) : null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [options, setOptions] = useState<FilterOptions>({});
  const [q, setQ] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [blockIds, setBlockIds] = useState<string[]>([]);
  const [coreLifts, setCoreLifts] = useState<string[]>([]);
  const [accessories, setAccessories] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [accessorySearch, setAccessorySearch] = useState('');
  const [athletePreferredUnit, setAthletePreferredUnit] = useState<string | null>(null);
  const { unit: displayUnit, setUnit: setDisplayUnit } = useSurfaceWeightUnit(athletePreferredUnit);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (athleteId) params.set('athlete_id', athleteId);
    if (q.trim()) params.set('q', q.trim());
    if (startDate.trim()) params.set('start_date', startDate.trim());
    if (endDate.trim()) params.set('end_date', endDate.trim());
    if (blockIds.length) params.set('block_ids', blockIds.join(','));
    if (coreLifts.length) params.set('core_lifts', coreLifts.join(','));
    if (accessories.length) params.set('accessories', accessories.join(','));
    if (designations.length) params.set('designations', designations.join(','));
    const raw = params.toString();
    return raw ? `?${raw}` : '';
  }, [accessories, athleteId, blockIds, coreLifts, designations, endDate, q, startDate]);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const resp = await fetchJson(`/workouts/mobile/training-hub/session-history${queryString}`, { method: 'GET' });
      const json: any = resp.json || {};
      if (resp.status === 401 || resp.status === 403) feedbackAnalytics('historical_accomplishment_authorization_denied', { surface: 'session_history', status: resp.status });
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      const nextSessions = Array.isArray(json.session_history?.sessions) ? json.session_history.sessions : [];
      setSessions(nextSessions);
      setOptions(json.session_history?.options || {});
      setAthletePreferredUnit(json.session_history?.athlete?.preferred_units || null);
      feedbackAnalytics('historical_accomplishment_timeline_loaded', {
        surface: 'session_history',
        session_count: nextSessions.length,
        accomplishment_session_count: nextSessions.filter((row: HistorySession) => Number(row.accomplishment_signal?.count || 0) > 0).length,
      });
      if (silent) feedbackAnalytics('historical_accomplishment_refresh', { surface: 'session_history' });
    } catch (err: any) {
      setError(err?.message || 'Session history could not load.');
      setSessions([]);
      feedbackAnalytics('historical_accomplishment_timeline_failed', { surface: 'session_history' });
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  const filterCount = filterValueCount({ startDate, endDate, blockIds, coreLifts, accessories, designations });
  const activeSummary = [
    startDate.trim() || endDate.trim() ? [startDate.trim() || 'Start', endDate.trim() || 'End'].join(' to ') : null,
    blockIds.length ? `${blockIds.length} block${blockIds.length === 1 ? '' : 's'}` : null,
    coreLifts.length ? `${coreLifts.length} core lift${coreLifts.length === 1 ? '' : 's'}` : null,
    accessories.length ? `${accessories.length} accessor${accessories.length === 1 ? 'y' : 'ies'}` : null,
    designations.length ? `${designations.length} role${designations.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' / ');

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setBlockIds([]);
    setCoreLifts([]);
    setAccessories([]);
    setDesignations([]);
    setAccessorySearch('');
  };

  return (
    <View style={styles.screen}>
      <FloatingControlCoordinator context="tab-screen">
      <FloatingDisplayUnitRegistration unit={displayUnit} onChange={setDisplayUnit} testID="session-history-unit-toggle" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.muted} />}
      >
        <SLPageHeader
          title="Session History"
          backLabel="Return to Training Hub"
          onBack={() => router.push('/(tabs)/workout' as any)}
        />
        <View style={styles.searchControlRow}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search title, movement, block"
              placeholderTextColor={colors.subtle}
              style={styles.searchInput}
              returnKeyType="search"
            />
          </View>
          <Pressable style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]} onPress={() => setFilterOpen(true)}>
            <Ionicons name="options-outline" size={16} color={colors.textStrong} />
            <Text style={styles.filterButtonText}>Filters{filterCount ? ` ${filterCount}` : ''}</Text>
          </Pressable>
        </View>

        {filterCount ? (
          <View style={styles.activeSummary}>
            <Text style={styles.summaryText} numberOfLines={2}>{activeSummary}</Text>
            <Pressable style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearText}>Clear filters</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? <StateLine title="Loading sessions" /> : error ? <StateLine title={error} tone="danger" /> : sessions.length ? (
          <View style={styles.list}>
            {sessions.map((session) => (
              <Pressable
                key={session.id}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: '/workout/[workoutId]', params: { workoutId: String(session.id) } })}
              >
                <View style={styles.copy}>
                  <Text typographyRole="workoutName" style={styles.rowTitle} numberOfLines={1}>{session.title || session.label || 'Training Session'}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{[formatShortDate(session.date), session.block_name, focusLine(session)].filter(Boolean).join(' / ')}</Text>
                  {session.recap?.top_work ? (
                    <Text style={styles.recap} numberOfLines={1}>{simplifyMobileMovementText(session.recap.top_work)}</Text>
                  ) : null}
                  <CompactAccomplishmentSignal signal={session.accomplishment_signal} displayUnit={displayUnit} />
                </View>
                <Text style={[styles.status, { color: toneForKind(session.kind || session.status) }]}>{labelForKind(session.kind || session.status)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.quietLine}>No past sessions yet.</Text>
        )}
      </ScrollView>

      <FilterSheet
        visible={filterOpen}
        options={options}
        startDate={startDate}
        endDate={endDate}
        blockIds={blockIds}
        coreLifts={coreLifts}
        accessories={accessories}
        designations={designations}
        accessorySearch={accessorySearch}
        onStartDate={setStartDate}
        onEndDate={setEndDate}
        onBlockIds={setBlockIds}
        onCoreLifts={setCoreLifts}
        onAccessories={setAccessories}
        onDesignations={setDesignations}
        onAccessorySearch={setAccessorySearch}
        onClear={clearFilters}
        onClose={() => setFilterOpen(false)}
      />
      </FloatingControlCoordinator>
    </View>
  );
}

function FilterSheet({
  visible,
  options,
  startDate,
  endDate,
  blockIds,
  coreLifts,
  accessories,
  designations,
  accessorySearch,
  onStartDate,
  onEndDate,
  onBlockIds,
  onCoreLifts,
  onAccessories,
  onDesignations,
  onAccessorySearch,
  onClear,
  onClose,
}: {
  visible: boolean;
  options: FilterOptions;
  startDate: string;
  endDate: string;
  blockIds: string[];
  coreLifts: string[];
  accessories: string[];
  designations: string[];
  accessorySearch: string;
  onStartDate: (value: string) => void;
  onEndDate: (value: string) => void;
  onBlockIds: (value: string[]) => void;
  onCoreLifts: (value: string[]) => void;
  onAccessories: (value: string[]) => void;
  onDesignations: (value: string[]) => void;
  onAccessorySearch: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const accessoryOptions = (options.accessories || [])
    .map((row) => ({ key: String(row.key), label: row.label || String(row.key) }))
    .filter((row) => row.label.toLowerCase().includes(accessorySearch.trim().toLowerCase()));
  const pickerValue = pickerTarget === 'end' ? endDate : startDate;
  const setPickerValue = pickerTarget === 'end' ? onEndDate : onStartDate;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Pressable style={styles.sheetClose} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.textStrong} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
            <View style={styles.dateRow}>
              <DatePickerControl
                label="Start Date"
                value={startDate}
                onOpen={() => setPickerTarget('start')}
                onClear={() => onStartDate('')}
              />
              <DatePickerControl
                label="End Date"
                value={endDate}
                onOpen={() => setPickerTarget('end')}
                onClear={() => onEndDate('')}
              />
            </View>
            {pickerTarget ? (
              <View style={styles.datePickerPanel}>
                <Text style={styles.datePickerTitle}>{pickerTarget === 'start' ? 'Start Date' : 'End Date'}</Text>
                <DateTimePicker
                  value={dateFromYMD(pickerValue || toYMD(new Date()))}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  themeVariant="dark"
                  textColor={Platform.OS === 'ios' ? colors.textStrong : undefined}
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android') {
                      setPickerTarget(null);
                      if ((event as any)?.type === 'set' && selected) {
                        setPickerValue(toYMD(selected));
                      }
                      return;
                    }
                    if (selected) setPickerValue(toYMD(selected));
                  }}
                />
                {Platform.OS === 'ios' ? (
                  <View style={styles.datePickerActions}>
                    <Pressable style={styles.sheetSecondary} onPress={() => setPickerTarget(null)}>
                      <Text style={styles.sheetSecondaryText}>Done</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
            <MultiSelectGroup
              label="Block"
              options={(options.blocks || []).map((block) => ({ key: String(block.id), label: block.label || block.name || 'Block' }))}
              values={blockIds}
              onChange={onBlockIds}
            />
            <MultiSelectGroup
              label="Core lifts"
              options={(options.core_lifts || []).map((lift) => ({ key: String(lift.key), label: lift.label || String(lift.key) }))}
              values={coreLifts}
              onChange={onCoreLifts}
            />
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionLabel}>Accessories</Text>
              <View style={styles.accessorySearch}>
                <Ionicons name="search-outline" size={15} color={colors.muted} />
                <TextInput
                  value={accessorySearch}
                  onChangeText={onAccessorySearch}
                  placeholder="Search accessories"
                  placeholderTextColor={colors.subtle}
                  style={styles.accessorySearchInput}
                />
              </View>
              {accessories.length ? (
                <View style={styles.selectedWrap}>
                  {accessories.map((key) => (
                    <FilterChip key={key} label={optionLabel(options.accessories, key)} selected onPress={() => toggleValue(accessories, key, onAccessories)} />
                  ))}
                </View>
              ) : null}
              <View style={styles.optionWrap}>
                {accessoryOptions.map((option) => (
                  <FilterChip
                    key={option.key}
                    label={option.label}
                    selected={accessories.includes(option.key)}
                    onPress={() => toggleValue(accessories, option.key, onAccessories)}
                  />
                ))}
              </View>
            </View>
            <MultiSelectGroup
              label="Role"
              options={(options.designations || []).map((row) => ({ key: String(row.key), label: row.label || String(row.key) }))}
              values={designations}
              onChange={onDesignations}
            />
          </ScrollView>
          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetSecondary} onPress={onClear}>
              <Text style={styles.sheetSecondaryText}>Clear filters</Text>
            </Pressable>
            <Pressable style={styles.sheetPrimary} onPress={onClose}>
              <Text style={styles.sheetPrimaryText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DatePickerControl({
  label,
  value,
  onOpen,
  onClear,
}: {
  label: string;
  value: string;
  onOpen: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.dateInputWrap}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Pressable style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]} onPress={onOpen}>
        <Ionicons name="calendar-outline" size={15} color={colors.muted} />
        <Text style={[styles.dateButtonText, !value && styles.dateButtonTextEmpty]}>{value ? formatReadableDate(value) : 'Any date'}</Text>
      </Pressable>
      {value ? (
        <Pressable style={styles.dateClear} onPress={onClear}>
          <Text style={styles.dateClearText}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MultiSelectGroup({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  values: string[];
  onChange: (value: string[]) => void;
}) {
  if (!options.length) return null;
  return (
    <View style={styles.sheetSection}>
      <Text style={styles.sheetSectionLabel}>{label}</Text>
      <View style={styles.optionWrap}>
        {options.map((option) => (
          <FilterChip
            key={option.key}
            label={option.label}
            selected={values.includes(option.key)}
            onPress={() => toggleValue(values, option.key, onChange)}
          />
        ))}
      </View>
    </View>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function StateLine({ title, tone }: { title: string; tone?: 'danger' }) {
  return (
    <View style={styles.stateLine}>
      {tone ? <Ionicons name="alert-circle-outline" size={18} color={colors.red} /> : <ActivityIndicator color={colors.violet} />}
      <Text style={styles.stateText}>{title}</Text>
    </View>
  );
}

function toggleValue(values: string[], key: string, onChange: (value: string[]) => void) {
  onChange(values.includes(key) ? values.filter((value) => value !== key) : [...values, key]);
}

function filterValueCount(input: {
  startDate: string;
  endDate: string;
  blockIds: string[];
  coreLifts: string[];
  accessories: string[];
  designations: string[];
}) {
  return [
    input.startDate.trim() || input.endDate.trim() ? 1 : 0,
    input.blockIds.length,
    input.coreLifts.length,
    input.accessories.length,
    input.designations.length,
  ].reduce((sum, value) => sum + value, 0);
}

function focusLine(session: HistorySession) {
  return simplifyMobileMovementList(session.focus?.primary).join(' / ');
}

function optionLabel(options: FilterOption[] | undefined, key: string) {
  const found = (options || []).find((option) => String(option.key) === key);
  return found?.label || key;
}

function toneForKind(value?: string | null) {
  const kind = (value || '').toLowerCase();
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return colors.green;
  if (kind === 'missed' || kind === 'past_due' || kind === 'incomplete') return colors.red;
  return colors.amber;
}

function labelForKind(value?: string | null) {
  const kind = (value || '').toLowerCase();
  if (kind === 'completed' || kind === 'logged' || kind === 'done') return 'Complete';
  if (kind === 'missed') return 'Missed';
  if (kind === 'incomplete') return 'Incomplete';
  if (kind === 'past_due') return 'Past due';
  return 'Session';
}

function formatShortDate(value?: string | null) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toYMD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromYMD(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function formatReadableDate(value: string) {
  const date = dateFromYMD(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  scrollView: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingTop: 16, paddingBottom: 36, gap: 24 },
  title: { fontFamily: SLFontFamilies.sansBold, fontSize: SLTypography.hero.fontSize, lineHeight: 34, color: colors.textStrong, letterSpacing: 0 },
  returnControl: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(10, 11, 11, 0.22)', paddingVertical: 8, paddingHorizontal: 10 },
  returnText: { ...SLTypography.label, color: colors.muted },
  searchControlRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  searchRow: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft, backgroundColor: 'rgba(10, 11, 11, 0.18)', paddingHorizontal: 10 },
  searchInput: { flex: 1, color: colors.textStrong, fontFamily: SLFontFamilies.sans, fontSize: SLTypography.rowTitle.fontSize, paddingVertical: 10 },
  filterButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(10, 11, 11, 0.28)', paddingHorizontal: 11 },
  filterButtonText: { ...SLTypography.label, color: colors.textStrong },
  activeSummary: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft, paddingVertical: 9 },
  summaryText: { ...SLTypography.caption, color: colors.subtle, flex: 1 },
  clearButton: { paddingVertical: 6, paddingHorizontal: 8 },
  clearText: { ...SLTypography.label, color: colors.textStrong },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: colors.lineSoft, backgroundColor: 'rgba(10, 11, 11, 0.16)', paddingVertical: 11 },
  rail: { width: 2, alignSelf: 'stretch' },
  copy: { flex: 1, gap: 3 },
  rowTitle: { ...SLTypography.body, color: colors.textStrong },
  meta: { ...SLTypography.caption, color: colors.muted },
  recap: { ...SLTypography.caption, color: colors.subtle },
  status: { ...SLTypography.label },
  quietLine: { ...SLTypography.body, color: colors.subtle, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft, paddingVertical: 14 },
  stateLine: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 16 },
  stateText: { ...SLTypography.body, color: colors.muted },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.54)' },
  sheet: { maxHeight: '84%', backgroundColor: colors.surfaceStrong, borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, paddingBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 18, paddingRight: 14, paddingBottom: 10 },
  sheetTitle: { ...SLTypography.sectionTitle, color: colors.textStrong },
  sheetClose: { padding: 8 },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { gap: 18, paddingLeft: 18, paddingRight: 18, paddingBottom: 12 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateInputWrap: { flex: 1, gap: 5 },
  dateLabel: { ...SLTypography.caption, color: colors.subtle },
  dateButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft, paddingVertical: 8, paddingHorizontal: 9 },
  dateButtonText: { ...SLTypography.caption, color: colors.textStrong },
  dateButtonTextEmpty: { color: colors.subtle },
  dateClear: { alignSelf: 'flex-start', paddingVertical: 3 },
  dateClearText: { ...SLTypography.caption, color: colors.muted },
  datePickerPanel: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft, backgroundColor: 'rgba(10, 11, 11, 0.18)', paddingVertical: 8 },
  datePickerTitle: { ...SLTypography.label, color: colors.subtle, paddingHorizontal: 10, textTransform: 'uppercase' },
  datePickerActions: { alignItems: 'flex-end', paddingHorizontal: 10 },
  sheetSection: { gap: 9 },
  sheetSectionLabel: { ...SLTypography.caption, color: colors.subtle, textTransform: 'uppercase' },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 2 },
  chip: { borderWidth: 1, borderColor: colors.lineSoft, backgroundColor: 'rgba(10, 11, 11, 0.18)', paddingVertical: 7, paddingHorizontal: 10 },
  chipSelected: { borderColor: 'rgba(167, 139, 250, 0.42)', backgroundColor: 'rgba(167, 139, 250, 0.12)' },
  chipText: { ...SLTypography.label, color: colors.muted },
  chipTextSelected: { color: colors.textStrong },
  accessorySearch: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft, paddingHorizontal: 9 },
  accessorySearchInput: { flex: 1, color: colors.textStrong, fontFamily: SLFontFamilies.sans, fontSize: SLTypography.rowTitle.fontSize, paddingVertical: 8 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: colors.lineSoft, paddingTop: 12, paddingHorizontal: 18 },
  sheetSecondary: { paddingVertical: 10, paddingHorizontal: 10 },
  sheetSecondaryText: { ...SLTypography.label, color: colors.muted },
  sheetPrimary: { backgroundColor: 'rgba(10, 11, 11, 0.36)', paddingVertical: 10, paddingHorizontal: 14 },
  sheetPrimaryText: { ...SLTypography.label, color: colors.textStrong },
  pressed: { opacity: 0.72 },
});
