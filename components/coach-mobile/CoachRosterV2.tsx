import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import {
  CoachCardChevron,
  CoachMobileHeader,
  CoachStatusBadge,
  COACH_V2,
} from '@/components/coach-mobile/coach-mobile-v2-ui';
import { SLAthleteAvatar, SLEmptyState, SLErrorState, SLLoadingState, SLScreen } from '@/components/ui';
import { Text, TextInput } from '@/components/ui/sl-text';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/api';
import { athleteTrainingLabel, filterCoachRosterV2, type CoachRosterV2Filter } from '@/lib/coach-mobile-v2';
import type { CoachRosterAthlete, CoachRosterResponse } from '@/lib/coach-mobile';
import { normalizeProfilePhotoPayload } from '@/lib/profile-photo';

const FILTERS: { id: CoachRosterV2Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs_attention', label: 'Needs You' },
  { id: 'programming', label: 'Programming' },
  { id: 'active', label: 'Active' },
];

function validFilter(value?: string): value is CoachRosterV2Filter {
  return FILTERS.some((item) => item.id === value);
}

export function CoachRosterV2({ previewAthletes }: { previewAthletes?: CoachRosterAthlete[] }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { user } = useAuth();
  const listRef = useRef<FlatList<CoachRosterAthlete>>(null);
  const accountKey = user?.email || String(user?.athlete_id || '');
  const accountRef = useRef(accountKey);
  const requestRef = useRef(0);
  const requested = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const previewMode = Boolean(previewAthletes);
  const [athletes, setAthletes] = useState<CoachRosterAthlete[]>(previewAthletes || []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CoachRosterV2Filter>(validFilter(requested) ? requested : 'all');
  const [loading, setLoading] = useState(!previewAthletes);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountRef.current = accountKey;
    requestRef.current += 1;
    if (!previewMode) setAthletes([]);
  }, [accountKey, previewMode]);

  useEffect(() => {
    if (previewAthletes) {
      setAthletes(previewAthletes);
      setLoading(false);
    }
  }, [previewAthletes]);

  useEffect(() => {
    if (validFilter(requested)) setFilter(requested);
  }, [requested]);

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (previewMode) return;
    const requestAccount = accountKey;
    const sequence = ++requestRef.current;
    const current = () => accountRef.current === requestAccount && requestRef.current === sequence;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetchJson('/coach/mobile/roster', { method: 'GET' });
      const payload = response.json as CoachRosterResponse | null;
      if (!current()) return;
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (!response.ok || !payload?.ok) {
        setError(payload?.error || `Could not load athletes. (${response.status})`);
        return;
      }
      setAthletes((payload.athletes || []).map((athlete) => ({ ...athlete, ...normalizeProfilePhotoPayload(athlete) })));
    } catch (loadError) {
      if (!current()) return;
      console.warn('All Athletes V2 load failed', loadError);
      setError('Network error. Pull to refresh or try again.');
    } finally {
      if (current()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [accountKey, previewMode, router]);

  useFocusEffect(useCallback(() => {
    void load({ silent: athletes.length > 0 });
  // The focus event, not roster reconciliation, owns refresh cadence.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load({ silent: true });
    });
    return () => subscription.remove();
  }, [load]);

  const visible = useMemo(() => filterCoachRosterV2(athletes, filter, query), [athletes, filter, query]);
  const letterIndexes = useMemo(() => {
    const index = new Map<string, number>();
    visible.forEach((athlete, athleteIndex) => {
      const letter = athlete.name.trim()[0]?.toUpperCase();
      if (letter && !index.has(letter)) index.set(letter, athleteIndex);
    });
    return index;
  }, [visible]);
  const showsAlphabetRail = visible.length >= 12;

  const openAthlete = useCallback((athlete: CoachRosterAthlete) => {
    router.push({
      pathname: '/(tabs)/coach-athlete/[athleteId]',
      params: { athleteId: String(athlete.id), athleteName: athlete.name },
    } as any);
  }, [router]);

  if (loading && athletes.length === 0) {
    return <SLScreen edges="top" padded={false}><SLLoadingState message="Loading your authorized athlete relationships." title="Loading Athletes" /></SLScreen>;
  }

  return (
    <SLScreen edges="top" padded={false} style={styles.screen}>
      <CoachMobileHeader
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/coach-dashboard');
        }}
        onPrimary={() => router.push('/(tabs)/coach-invite-athlete' as any)}
        primaryIcon="add"
        primaryLabel="Add athlete"
        title="All Athletes"
      />
      <View style={styles.searchShell}>
        <Ionicons color={COACH_V2.subtle} name="search" size={18} />
        <TextInput
          accessibilityLabel="Search athletes"
          onChangeText={setQuery}
          placeholder="Search athletes"
          placeholderTextColor={COACH_V2.subtle}
          style={styles.searchInput}
          value={query}
        />
        {query ? <Pressable accessibilityLabel="Clear athlete search" hitSlop={8} onPress={() => setQuery('')}><Ionicons color={COACH_V2.muted} name="close-circle" size={18} /></Pressable> : null}
      </View>
      <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
        {FILTERS.map((item) => {
          const selected = filter === item.id;
          return (
            <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={item.id} onPress={() => setFilter(item.id)} style={[styles.filter, selected && styles.filterSelected]}>
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {error ? <SLErrorState actionLabel="Try Again" message={error} onActionPress={() => load()} title="Athletes unavailable" /> : null}
      <FlatList
        contentContainerStyle={[styles.list, showsAlphabetRail && styles.listWithRail]}
        data={visible}
        initialNumToRender={12}
        keyExtractor={(athlete) => String(athlete.id)}
        maxToRenderPerBatch={12}
        ref={listRef}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={COACH_V2.violet} onRefresh={() => load({ silent: true })} />}
        renderItem={({ item }) => <RosterAthleteCard athlete={item} onPress={() => openAthlete(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={!error ? <SLEmptyState message={athletes.length ? 'Try another filter or search.' : 'Invite an athlete to begin coaching.'} title={athletes.length ? 'No matching athletes' : 'No athletes yet'} /> : null}
        ListFooterComponent={<View style={styles.bottomSpace} />}
        windowSize={9}
      />
      {showsAlphabetRail ? (
        <View accessibilityLabel="Alphabetical athlete navigation" style={styles.alphaRail}>
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
            <Pressable
              disabled={!letterIndexes.has(letter)}
              hitSlop={{ left: 6, right: 6 }}
              key={letter}
              onPress={() => {
                const index = letterIndexes.get(letter);
                if (index != null) listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0 });
              }}
            >
              <Text style={[styles.alphaLetter, !letterIndexes.has(letter) && styles.alphaDisabled]}>{letter}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </SLScreen>
  );
}

function RosterAthleteCard({ athlete, onPress }: { athlete: CoachRosterAthlete; onPress: () => void }) {
  const needsAttention = athlete.status.classification === 'needs_attention';
  const readiness = athlete.readiness.score;
  const delta = athlete.readiness.delta;
  return (
    <Pressable accessibilityLabel={`Open ${athlete.name} Athlete Hub`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.athleteCard, pressed && styles.pressed]}>
      <SLAthleteAvatar imageUrl={athlete.profilePhotoUrl} imageVersion={athlete.profilePhotoVersion} name={athlete.name} size={48} statusColor={needsAttention ? COACH_V2.magenta : COACH_V2.green} />
      <View style={styles.athleteCopy}>
        <Text numberOfLines={1} style={styles.athleteName}>{athlete.name}</Text>
        <CoachStatusBadge label={athlete.status.label} tone={needsAttention ? 'danger' : athlete.status.classification === 'monitor' ? 'warning' : 'success'} />
        <Text numberOfLines={1} style={styles.training}>{athleteTrainingLabel(athlete)}</Text>
        <Text numberOfLines={1} style={styles.supporting}>{athlete.primary_attention_reason?.supporting_text || athlete.primary_attention_reason?.title || (athlete.last_completed_session ? `Last Session ${athlete.last_completed_session.label}` : 'No recent Session evidence')}</Text>
      </View>
      <View style={styles.readiness}>
        <Text style={styles.readinessLabel}>Readiness</Text>
        <Text style={styles.readinessValue}>{readiness == null ? '—' : readiness.toFixed(1)}</Text>
        {delta != null ? (
          <View style={styles.deltaRow}>
            <Ionicons color={delta < 0 ? COACH_V2.magenta : delta > 0 ? COACH_V2.green : COACH_V2.muted} name={delta < 0 ? 'arrow-down' : delta > 0 ? 'arrow-up' : 'remove'} size={12} />
            <Text style={[styles.delta, { color: delta < 0 ? COACH_V2.magenta : delta > 0 ? COACH_V2.green : COACH_V2.muted }]}>{Math.abs(delta).toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
      <CoachCardChevron />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: COACH_V2.black },
  searchShell: { height: 44, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, paddingHorizontal: 12 },
  searchInput: { flex: 1, height: 42, color: COACH_V2.text, fontSize: 14 },
  filters: { gap: 7, paddingVertical: 10 },
  filter: { height: 34, minWidth: 58, borderRadius: 18, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  filterSelected: { borderColor: COACH_V2.violet, backgroundColor: '#271143' },
  filterText: { color: COACH_V2.muted, fontSize: 11, fontWeight: '700' },
  filterTextSelected: { color: COACH_V2.text },
  list: { paddingTop: 2 },
  listWithRail: { paddingRight: 18 },
  separator: { height: 7 },
  athleteCard: { minHeight: 86, borderRadius: 11, borderWidth: 1, borderColor: COACH_V2.border, backgroundColor: COACH_V2.surface, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  athleteCopy: { flex: 1, minWidth: 0, gap: 3 },
  athleteName: { color: COACH_V2.text, fontSize: 15, fontWeight: '800' },
  training: { color: COACH_V2.muted, fontSize: 11 },
  supporting: { color: COACH_V2.subtle, fontSize: 10 },
  readiness: { width: 56, alignItems: 'flex-end' },
  readinessLabel: { color: COACH_V2.subtle, fontSize: 8, fontWeight: '700' },
  readinessValue: { marginTop: 3, color: COACH_V2.text, fontSize: 20, fontWeight: '700' },
  deltaRow: { flexDirection: 'row', alignItems: 'center' },
  delta: { fontSize: 10, fontWeight: '800' },
  alphaRail: { position: 'absolute', right: 1, top: 172, bottom: 82, justifyContent: 'center', gap: 1 },
  alphaLetter: { color: COACH_V2.violetBright, fontSize: 8, lineHeight: 10, fontWeight: '800' },
  alphaDisabled: { color: '#343743' },
  pressed: { opacity: 0.72 },
  bottomSpace: { height: 84 },
});
