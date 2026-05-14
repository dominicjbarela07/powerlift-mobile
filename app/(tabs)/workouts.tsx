// app/(tabs)/workouts.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Modal, RefreshControl, TextInput, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { fetchJson } from '@/lib/api';

export default function WorkoutsScreen() {
  const router = useRouter(); 
  const params = useLocalSearchParams<{ athleteId?: string; athleteName?: string }>();
  const rosterAthleteId = params.athleteId ? String(params.athleteId) : null;
  const rosterAthleteName = params.athleteName ? String(params.athleteName) : null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<any | null>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [pendingMap, setPendingMap] = useState<Record<string, any[]>>({});
  const [completedMap, setCompletedMap] = useState<Record<string, any[]>>({});
  const [unassignedPending, setUnassignedPending] = useState<any[]>([]);
  const [unassignedCompleted, setUnassignedCompleted] = useState<any[]>([]);
  const [collapseState, setCollapseState] = useState<Record<string, boolean>>({});
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteLabel, setConfirmDeleteLabel] = useState<string>('');
  const [moveWorkoutId, setMoveWorkoutId] = useState<number | null>(null);
  const [moveWorkoutLabel, setMoveWorkoutLabel] = useState<string>('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveSaving, setMoveSaving] = useState(false);
  const [createBlockOpen, setCreateBlockOpen] = useState(false);
  const [blockName, setBlockName] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const swipeRefs = useRef<Record<string, SwipeableMethods | null>>({});

  const closeSwipe = (id: string | number | null | undefined) => {
    if (id == null) return;
    try { swipeRefs.current[String(id)]?.close(); } catch {}
  };

  const loadWorkouts = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;

    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const endpoint = rosterAthleteId
      ? `/workouts/my_list/mobile/${rosterAthleteId}`
      : `/workouts/my_list/mobile`;

    try {
      const resp = await fetchJson(endpoint, { method: 'GET' });
      const res: any = resp.json;

      if (!resp.ok) {
        const msg = res?.error || res?.message || `HTTP ${resp.status}`;
        if (resp.status === 401 || msg === 'auth required') {
          setError('Session expired. Please log in again.');
        } else {
          setError(msg || 'Failed to load workouts.');
        }
        setAthlete(null);
        setBlocks([]);
        setPendingMap({});
        setCompletedMap({});
        setUnassignedPending([]);
        setUnassignedCompleted([]);
        return;
      }

      if (!res?.ok) {
        const msg = res?.error || 'Failed to load workouts.';
        setError(msg);
        setAthlete(null);
        setBlocks([]);
        setPendingMap({});
        setCompletedMap({});
        setUnassignedPending([]);
        setUnassignedCompleted([]);
        return;
      }

      const athleteObj = res.athlete || null;

      const selfCoached = !!(
        athleteObj &&
        (athleteObj.is_self_coached ??
          (athleteObj.user_id != null &&
            athleteObj.coach_id != null &&
            athleteObj.user_id === athleteObj.coach_id))
      );

      const hideDraftsForAthlete = !rosterAthleteId && !selfCoached;

      const isDraft = (w: any) => String(w?.status || '').toLowerCase() === 'draft';

      const blocksRaw = res.blocks || [];
      const pendingRaw = res.pending_map || {};
      const completedRaw = res.completed_map || {};
      const unassignedPendingRaw = res.unassigned_pending || [];
      const unassignedCompletedRaw = res.unassigned_completed || [];

      const pendingFiltered = hideDraftsForAthlete
        ? Object.fromEntries(
            Object.entries(pendingRaw).map(([k, arr]: any) => [
              k,
              (arr || []).filter((w: any) => !isDraft(w)),
            ])
          )
        : pendingRaw;

      const completedFiltered = hideDraftsForAthlete
        ? Object.fromEntries(
            Object.entries(completedRaw).map(([k, arr]: any) => [
              k,
              (arr || []).filter((w: any) => !isDraft(w)),
            ])
          )
        : completedRaw;

      const unassignedPendingFiltered = hideDraftsForAthlete
        ? unassignedPendingRaw.filter((w: any) => !isDraft(w))
        : unassignedPendingRaw;

      const unassignedCompletedFiltered = hideDraftsForAthlete
        ? unassignedCompletedRaw.filter((w: any) => !isDraft(w))
        : unassignedCompletedRaw;

      const blocksFiltered = hideDraftsForAthlete
        ? blocksRaw.filter((b: any) => {
            const pid = String(b?.id);
            const p = (pendingFiltered as any)[pid] || [];
            const c = (completedFiltered as any)[pid] || [];
            return p.length + c.length > 0;
          })
        : blocksRaw;

      setAthlete(athleteObj);
      setBlocks(blocksFiltered);
      setPendingMap(pendingFiltered);
      setCompletedMap(completedFiltered);
      setUnassignedPending(unassignedPendingFiltered);
      setUnassignedCompleted(unassignedCompletedFiltered);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [rosterAthleteId]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts, refreshNonce]);

  const onRefresh = useCallback(async () => {
    await loadWorkouts({ silent: true });
  }, [loadWorkouts]);

  const firstName =
    athlete?.name?.split(' ')[0] || 'Athlete';

  const statusLabel = (s?: string | null) => {
    const v = (s || 'assigned').toLowerCase();
    if (v === 'assigned') return 'Assigned';
    if (v === 'missed') return 'Missed';
    if (v === 'in_progress') return 'In progress';
    if (['logged', 'completed', 'done'].includes(v)) return 'Completed';
    return v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const statusTone = (s?: string | null) => {
    const v = (s || 'assigned').toLowerCase();
    if (v === 'assigned') return '#f0b46a';
    if (v === 'missed') return '#ef6b73';
    if (v === 'in_progress') return '#4ade80';
    if (['logged', 'completed', 'done'].includes(v)) return '#8b5cf6';
    return '#c4cce0';
  };

  const statusFill = (s?: string | null) => {
    const v = (s || 'assigned').toLowerCase();
    if (v === 'assigned') return 'rgba(240,180,106,0.18)';
    if (v === 'missed') return 'rgba(239,107,115,0.18)';
    if (v === 'in_progress') return 'rgba(74,222,128,0.18)';
    if (['logged', 'completed', 'done'].includes(v)) return 'rgba(139,92,246,0.18)';
    return 'rgba(196,204,224,0.16)';
  };

  const toggleCollapse = useCallback((id: string) => {
    setCollapseState((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const isCoachView = !!rosterAthleteId;
  const isSelfCoached = !!(
    athlete &&
    (athlete.is_self_coached ?? (athlete.user_id != null && athlete.coach_id != null && athlete.user_id === athlete.coach_id))
  );
  const canCreateBlock = isCoachView || isSelfCoached;
  const canManageWorkouts = canCreateBlock;

  const openCreateBlock = () => {
    setBlockError(null);
    setBlockName('');
    setCreateBlockOpen(true);
  };

  const closeCreateBlock = () => {
    setCreateBlockOpen(false);
    setBlockError(null);
    setBlockName('');
  };

  const submitCreateBlock = async () => {
    const athleteId = rosterAthleteId ? String(rosterAthleteId) : String(athlete?.id ?? '');
    const name = blockName.trim();
    if (!athleteId) {
      setBlockError('Missing athlete id.');
      return;
    }
    if (!name) {
      setBlockError('Block name required.');
      return;
    }

    setBlockSaving(true);
    setBlockError(null);
    try {
      const resp = await fetchJson(`/athletes/mobile/${athleteId}/blocks`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      const res: any = resp.json;

      if (!resp.ok || !res?.ok) {
        const msg = res?.error || res?.message || `HTTP ${resp.status}`;
        setBlockError(msg || 'Failed to create block.');
        return;
      }

      setCreateBlockOpen(false);
      setBlockName('');
      setRefreshNonce((n) => n + 1);
    } finally {
      setBlockSaving(false);
    }
  };

  const hasAnyWorkouts =
    (blocks && blocks.length > 0) ||
    unassignedPending.length > 0 ||
    unassignedCompleted.length > 0;

  const requestDeleteWorkout = (w: any) => {
    // Close the swipe UI so it doesn't sit open behind the modal
    closeSwipe(w?.id);
    setConfirmDeleteId(Number(w.id));
    setConfirmDeleteLabel(String(w.label || 'Workout'));
  };

  const cancelDeleteWorkout = () => {
    closeSwipe(confirmDeleteId);
    setConfirmDeleteId(null);
    setConfirmDeleteLabel('');
  };

  const confirmDeleteWorkout = async () => {
    if (confirmDeleteId == null) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setConfirmDeleteLabel('');
    closeSwipe(id);

    const resp = await fetchJson(`/workouts/mobile/${id}/delete`, { method: 'POST' });
    const res: any = resp.json;

    if (!resp.ok || !res?.ok) {
      const msg = res?.error || res?.message || `HTTP ${resp.status}`;
      setError(msg || 'Failed to delete workout.');
      return;
    }

    // Re-fetch list so we don't have to surgically edit maps
    setRefreshNonce((n) => n + 1);
  };

  const requestMoveWorkout = (w: any) => {
    closeSwipe(w?.id);
    setMoveWorkoutId(Number(w.id));
    setMoveWorkoutLabel(String(w.label || 'Workout'));
    setMoveError(null);
    setMoveOpen(true);
  };

  const cancelMoveWorkout = () => {
    closeSwipe(moveWorkoutId);
    setMoveWorkoutId(null);
    setMoveWorkoutLabel('');
    setMoveError(null);
    setMoveOpen(false);
  };

  const submitMoveWorkout = async (destBlockId: number | null) => {
    if (moveWorkoutId == null) return;
    const id = moveWorkoutId;

    setMoveSaving(true);
    setMoveError(null);
    try {
      // If your backend route name differs, change it here.
      const resp = await fetchJson(`/athletes/mobile/workouts/${id}/move_to_block`, {
        method: 'POST',
        body: JSON.stringify({ block_id: destBlockId }),
      });
      const res: any = resp.json;

      if (!resp.ok || !res?.ok) {
        const msg = res?.error || res?.message || `HTTP ${resp.status}`;
        setMoveError(msg || 'Failed to move workout.');
        return;
      }

      setMoveOpen(false);
      setMoveWorkoutId(null);
      setMoveWorkoutLabel('');
      setRefreshNonce((n) => n + 1);
    } finally {
      setMoveSaving(false);
    }
  };

  const renderRightActions = (_progress?: any, _dragX?: any) => (
    <View style={styles.swipeDeleteAction}>
      <ThemedText variant="badge" style={styles.swipeDeleteText}>Delete</ThemedText>
    </View>
  );

  const renderLeftActions = (_progress?: any, _dragX?: any) => (
    <View style={styles.swipeMoveAction}>
      <ThemedText variant="badge" style={styles.swipeMoveText}>Move</ThemedText>
    </View>
  );

  const renderWorkoutRow = (w: any) => {
    // Athletes (non self-coached) can tap-to-open only.
    if (!canManageWorkouts) {
      return (
        <Pressable
          key={String(w.id)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() =>
            router.push({
              pathname: '/workout/[workoutId]',
              params: { workoutId: String(w.id) },
            })
          }
        >
          <View style={styles.rowMain}>
            <View style={styles.rowGlyphWrap}>
              <ThemedText variant="body" style={styles.rowGlyph}>
                {String((w.status || 'assigned')).toLowerCase() === 'draft' ? '⌁' : '⌄'}
              </ThemedText>
            </View>
            <View style={styles.rowTextWrap}>
              <ThemedText variant="body" style={styles.rowTitle}>
                {w.label || 'Workout'}
              </ThemedText>
              <ThemedText variant="small" style={styles.rowMeta}>
                {w.date || 'Unknown date'}
              </ThemedText>
            </View>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                borderColor: statusTone(w.status),
                backgroundColor: statusFill(w.status),
              },
            ]}
          >
            <ThemedText
              variant="badge"
              style={[styles.statusPillText, { color: statusTone(w.status) }]}
            >
              {statusLabel(w.status)}
            </ThemedText>
          </View>
        </Pressable>
      );
    }

    return (
      <Swipeable
        key={String(w.id)}
        ref={((r: SwipeableMethods | null) => {
          swipeRefs.current[String(w.id)] = r;
        }) as any}
        renderRightActions={renderRightActions}   // swipe left => delete
        renderLeftActions={renderLeftActions}     // swipe right => move
        leftThreshold={40}
        rightThreshold={40}
        onSwipeableOpen={(direction: any) => {
          // ReanimatedSwipeable reports the opened side as 'left' or 'right'.
          // We want: swipe LEFT (open right actions) => Delete
          //          swipe RIGHT (open left actions) => Manage/Move
          if (direction === 'right') {
            requestMoveWorkout(w);
          } else {
            requestDeleteWorkout(w);
          }
        }}
      >
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() =>
            router.push({
              pathname: '/workout/[workoutId]',
              params: { workoutId: String(w.id) },
            })
          }
        >
          <View style={styles.rowMain}>
            <View style={styles.rowGlyphWrap}>
              <ThemedText variant="body" style={styles.rowGlyph}>
                {String((w.status || 'assigned')).toLowerCase() === 'draft' ? '⌁' : '⌄'}
              </ThemedText>
            </View>
            <View style={styles.rowTextWrap}>
              <ThemedText variant="body" style={styles.rowTitle}>
                {w.label || 'Workout'}
              </ThemedText>
              <ThemedText variant="small" style={styles.rowMeta}>
                {w.date || 'Unknown date'}
              </ThemedText>
            </View>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                borderColor: statusTone(w.status),
                backgroundColor: statusFill(w.status),
              },
            ]}
          >
            <ThemedText
              variant="badge"
              style={[styles.statusPillText, { color: statusTone(w.status) }]}
            >
              {statusLabel(w.status)}
            </ThemedText>
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  return (

      <ThemedView style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9CA3AF" />
          }
        >
          <View style={styles.heroWrap}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroTitleCol}>
                <ThemedText variant="h1" style={styles.pageTitle}>
                  {rosterAthleteName ? `Workouts · ${rosterAthleteName}` : 'Workouts'}
                </ThemedText>
                <ThemedText variant="bodyMuted" style={styles.heroSubtext}>
                  {canManageWorkouts
                    ? 'Blocks, drafts, and assigned sessions'
                    : 'Assigned sessions and completed work'}
                </ThemedText>
              </View>

              {canCreateBlock && (
                <Pressable style={styles.heroCreateBtn} onPress={openCreateBlock}>
                  <View pointerEvents="none" style={styles.heroCreateBtnSheen} />
                  <View pointerEvents="none" style={styles.heroCreateBtnRim} />
                  <ThemedText variant="body" style={styles.heroCreateBtnText}>+ Add Block</ThemedText>
                </Pressable>
              )}
            </View>

            <View style={styles.heroStatsRow}>
              <View style={[styles.heroStatCard, styles.heroStatCardWarn]}>
                <View pointerEvents="none" style={[styles.heroStatGlow, styles.heroStatGlowWarn]} />
                <ThemedText variant="body" style={styles.heroStatLabel}>Pending</ThemedText>
                <ThemedText variant="body" style={[styles.heroStatValue, styles.heroStatValueWarn]}>
                  {[
                    ...blocks.flatMap((b) => ((pendingMap as any)[b.id] || [])),
                    ...unassignedPending,
                  ].filter((w: any) => String(w?.status || 'assigned').toLowerCase() !== 'missed').length}
                </ThemedText>
              </View>

              <View style={[styles.heroStatCard, styles.heroStatCardCool]}>
                <View pointerEvents="none" style={[styles.heroStatGlow, styles.heroStatGlowCool]} />
                <ThemedText variant="body" style={styles.heroStatLabel}>Completed</ThemedText>
                <ThemedText variant="body" style={[styles.heroStatValue, styles.heroStatValueCool]}>
                  {blocks.reduce((n, b) => n + (((completedMap as any)[b.id] || []).length), 0) + unassignedCompleted.length}
                </ThemedText>
              </View>

              <View style={[styles.heroStatCard, styles.heroStatCardMissed]}>
                <View pointerEvents="none" style={[styles.heroStatGlow, styles.heroStatGlowMissed]} />
                <ThemedText variant="body" style={styles.heroStatLabel}>Missed</ThemedText>
                <ThemedText variant="body" style={[styles.heroStatValue, styles.heroStatValueMissed]}>
                  {[
                    ...blocks.flatMap((b) => ((pendingMap as any)[b.id] || [])),
                    ...unassignedPending,
                  ].filter((w: any) => String(w?.status || 'assigned').toLowerCase() === 'missed').length}
                </ThemedText>
              </View>
            </View>
          </View>

          {loading && (
            <ThemedText variant="bodyMuted" style={styles.metaText}>Loading workouts…</ThemedText>
          )}

          {error && !loading && (
            <ThemedText variant="error" style={styles.errorText}>{error}</ThemedText>
          )}

          {!loading && !error && !hasAnyWorkouts && (
            <View style={styles.card}>
              <ThemedText variant="h3" style={styles.cardTitle}>No workouts yet</ThemedText>
              <ThemedText variant="bodyMuted" style={styles.metaText}>
                Your coach hasn’t assigned any workouts.
              </ThemedText>
            </View>
          )}

          {/* Training blocks */}
          {!loading && !error && blocks.length > 0 && (
            <View style={{ gap: 16 }}>
              {blocks.map((b) => {
                const collapseId = `completed-block-${b.id}`;
                const collapsed = collapseState[collapseId] ?? true;
                const pending = (pendingMap as any)[b.id] || [];
                const completed = (completedMap as any)[b.id] || [];

                return (
                  <View key={b.name} style={[styles.card, styles.sectionCard]}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.blockTitleRow}>
                        <View style={styles.blockIconBadge}>
                          <ThemedText variant="body" style={styles.blockIconText}>▣</ThemedText>
                        </View>
                        <ThemedText variant="h3" style={styles.cardTitle}>
                          {b.name}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Pending */}
                    <ThemedText variant="h3" style={styles.sectionHeader}>
                      Pending
                    </ThemedText>
                    {pending.length > 0 ? (
                      <View style={{ marginTop: 4 }}>
                        {pending.map(renderWorkoutRow)}
                      </View>
                    ) : (
                      <ThemedText variant="bodyMuted" style={styles.metaText}>
                        No pending workouts.
                      </ThemedText>
                    )}

                    {/* Completed (collapsible) */}
                    {completed.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <View style={styles.collapsibleHeaderRow}>
                          <View style={styles.completedHeaderGroup}>
                            <ThemedText variant="h3" style={styles.sectionHeader}>
                              Completed
                            </ThemedText>
                            <View style={styles.completedCountChip}>
                              <ThemedText variant="body" style={styles.completedCountText}>
                                {completed.length}
                              </ThemedText>
                            </View>
                          </View>
                          <Pressable
                            style={styles.collapseBtn}
                            onPress={() => toggleCollapse(collapseId)}
                          >
                            <ThemedText variant="h3" style={styles.collapseBtnText}>
                              {collapsed ? '+' : '–'}
                            </ThemedText>
                          </Pressable>
                        </View>
                        {!collapsed && (
                          <View style={{ marginTop: 6 }}>
                            {completed.map(renderWorkoutRow)}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Unassigned workouts card */}
          {!loading &&
            !error &&
            (unassignedPending.length > 0 || unassignedCompleted.length > 0) && (
              <View style={[styles.card, styles.sectionCard, { marginTop: 16 }]}>
                <View style={styles.unassignedHeaderWrap}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.blockTitleRow}>
                      <View style={[styles.blockIconBadge, styles.blockIconBadgeAlt]}>
                        <ThemedText variant="body" style={styles.blockIconText}>◔</ThemedText>
                      </View>
                      <ThemedText variant="h3" style={styles.cardTitle}>
                        Unassigned
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText variant="bodyMuted" style={styles.cardSubtext}>
                    Sessions without a block
                  </ThemedText>

                  {unassignedPending.length === 0 && unassignedCompleted.length === 0 && (
                    <ThemedText variant="bodyMuted" style={styles.metaText}>
                      No unassigned workouts
                    </ThemedText>
                  )}
                </View>

                <ThemedText variant="h3" style={styles.sectionHeader}>Pending</ThemedText>
                {unassignedPending.length > 0 ? (
                  <View style={{ marginTop: 4 }}>
                    {unassignedPending.map(renderWorkoutRow)}
                  </View>
                ) : (
                  <ThemedText variant="bodyMuted" style={styles.metaText}>
                    No pending unassigned workouts.
                  </ThemedText>
                )}

                {unassignedCompleted.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    {(() => {
                      const collapseId = 'completed-unassigned';
                      const collapsed = !!collapseState[collapseId];
                      return (
                        <View>
                          <View style={styles.collapsibleHeaderRow}>
                            <View style={styles.completedHeaderGroup}>
                              <ThemedText variant="h3" style={styles.sectionHeader}>
                                Completed
                              </ThemedText>
                              <View style={styles.completedCountChip}>
                                <ThemedText variant="body" style={styles.completedCountText}>
                                  {unassignedCompleted.length}
                                </ThemedText>
                              </View>
                            </View>
                            <Pressable
                              style={styles.collapseBtn}
                              onPress={() => toggleCollapse(collapseId)}
                            >
                              <ThemedText variant="h3" style={styles.collapseBtnText}>
                                {collapsed ? '+' : '–'}
                              </ThemedText>
                            </Pressable>
                          </View>
                          {!collapsed && (
                            <View style={{ marginTop: 6 }}>
                              {unassignedCompleted.map(renderWorkoutRow)}
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                )}
              </View>
            )}
        </ScrollView>

        <Modal
          visible={confirmDeleteId != null}
          transparent
          animationType="fade"
          onRequestClose={cancelDeleteWorkout}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <ThemedText variant="h3" style={styles.modalTitle}>Delete workout?</ThemedText>
                <ThemedText variant="bodyMuted" style={styles.modalBody}>
                  This will permanently delete “{confirmDeleteLabel}” and its logs.
                </ThemedText>

                <View style={styles.modalActionsRow}>
                  <Pressable style={[styles.modalBtn, styles.modalBtnGhost]} onPress={cancelDeleteWorkout}>
                    <ThemedText variant="body" style={styles.modalBtnText}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable style={[styles.modalBtn, styles.modalBtnDanger]} onPress={confirmDeleteWorkout}>
                    <ThemedText variant="body" style={styles.modalBtnText}>Delete</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          </GestureHandlerRootView>
        </Modal>

        <Modal
          visible={createBlockOpen}
          transparent
          animationType="fade"
          onRequestClose={closeCreateBlock}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <ThemedText variant="h3" style={styles.modalTitle}>Create training block</ThemedText>
                <ThemedText variant="bodyMuted" style={styles.modalBody}>
                  This will add a new block for organizing workouts.
                </ThemedText>

                <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Block name</ThemedText>
                <TextInput
                  value={blockName}
                  onChangeText={(v) => setBlockName(v)}
                  placeholder="e.g. Strength Block"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  style={styles.input}
                />

                {!!blockError && (
                  <ThemedText variant="error" style={styles.modalError}>{blockError}</ThemedText>
                )}

                <View style={styles.modalActionsRow}>
                  <Pressable
                    style={[styles.modalBtn, styles.modalBtnGhost]}
                    onPress={closeCreateBlock}
                    disabled={blockSaving}
                  >
                    <ThemedText variant="body" style={styles.modalBtnText}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.modalBtn, styles.modalBtnPrimary, blockSaving ? { opacity: 0.7 } : null]}
                    onPress={submitCreateBlock}
                    disabled={blockSaving}
                  >
                    <ThemedText variant="body" style={[styles.modalBtnText, { color: '#0b1220' }]}
                    >
                      {blockSaving ? 'Creating…' : 'Create'}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          </GestureHandlerRootView>
        </Modal>

        <Modal
          visible={moveOpen}
          transparent
          animationType="fade"
          onRequestClose={cancelMoveWorkout}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <ThemedText variant="h3" style={styles.modalTitle}>Move workout</ThemedText>
                <ThemedText variant="bodyMuted" style={styles.modalBody}>
                  Choose a block to move “{moveWorkoutLabel}” into.
                </ThemedText>

                <View style={styles.moveList}>
                  <Pressable
                    style={[styles.moveRow, styles.moveRowFirst]}
                    onPress={() => submitMoveWorkout(null)}
                    disabled={moveSaving}
                  >
                    <ThemedText variant="body" style={styles.moveRowText}>
                      No Assigned Block
                    </ThemedText>
                  </Pressable>

                  {blocks.map((b) => (
                    <Pressable
                      key={`move-${b.id}`}
                      style={styles.moveRow}
                      onPress={() => submitMoveWorkout(Number(b.id))}
                      disabled={moveSaving}
                    >
                      <ThemedText variant="body" style={styles.moveRowText}>{b.name}</ThemedText>
                    </Pressable>
                  ))}
                </View>

                {!!moveError && (
                  <ThemedText variant="error" style={styles.modalError}>{moveError}</ThemedText>
                )}

                <View style={styles.modalActionsRow}>
                  <Pressable
                    style={[styles.modalBtn, styles.modalBtnGhost]}
                    onPress={cancelMoveWorkout}
                    disabled={moveSaving}
                  >
                    <ThemedText variant="body" style={styles.modalBtnText}>Cancel</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          </GestureHandlerRootView>
        </Modal>
      </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scroll: {
    paddingHorizontal: 0,
    paddingTop: 18,
    paddingBottom: 44,
  },
  heroWrap: {
    marginBottom: 18,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  heroStatCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9,18,44,0.98)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  heroStatGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    opacity: 1,
  },
  heroStatGlowWarn: {
    backgroundColor: 'rgba(246,178,107,0.12)',
  },
  heroStatGlowCool: {
    backgroundColor: 'rgba(139,92,246,0.14)',
  },
  heroStatGlowMissed: {
    backgroundColor: 'rgba(239,107,115,0.14)',
  },
  heroStatCardWarn: {
    borderColor: 'rgba(249,115,22,0.28)',
  },
  heroStatCardCool: {
    borderColor: 'rgba(139,92,246,0.28)',
  },
  heroStatCardMissed: {
    borderColor: 'rgba(239,107,115,0.28)',
  },
  heroStatLabel: {
    color: '#AAB4D3',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.15,
    textTransform: 'uppercase',
    lineHeight: 15,
  },
  heroStatValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroStatValueWarn: {
    color: '#f6b26b',
  },
  heroStatValueCool: {
    color: '#a78bfa',
  },
  heroStatValueMissed: {
    color: '#f07c84',
  },
  heroCreateBtn: {
    minHeight: 58,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(162,145,255,0.62)',
    backgroundColor: '#4730cf',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#4a2be2',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroCreateBtnSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '56%',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroCreateBtnRim: {
    position: 'absolute',
    left: 1,
    right: 1,
    bottom: 0,
    height: 10,
    backgroundColor: 'rgba(35,22,112,0.32)',
  },
  heroCreateBtnText: {
    color: '#FBF9FF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  heroSubtext: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
    color: '#8B95B2',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 0,
    marginBottom: 0,
    color: '#F4F0FF',
    letterSpacing: -0.7,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E5E7EB',
    backgroundColor: '#0b1220',
    marginBottom: 10,
  },
  modalError: {
    marginTop: 2,
    marginBottom: 10,
    fontSize: 13,
    color: '#f97373',
  },
  modalBtnPrimary: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  card: {
    marginTop: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(102,116,164,0.26)',
    backgroundColor: 'rgba(7,16,40,0.98)',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionCard: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 0,
    color: '#F7F3FF',
    letterSpacing: -0.3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(94,106,147,0.13)',
  },
  rowPressed: {
    backgroundColor: 'rgba(125,93,255,0.055)',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  rowGlyphWrap: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rowGlyph: {
    color: '#EAC18A',
    fontSize: 12,
    fontWeight: '700',
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F4F0FF',
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontSize: 11,
    color: '#8A96B8',
    marginTop: 3,
  },
  metaText: {
    fontSize: 13,
    color: '#7E89A8',
    marginTop: 6,
    lineHeight: 18,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: '#f97373',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  blockIconBadge: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  blockIconBadgeAlt: {
    backgroundColor: 'transparent',
  },
  blockIconText: {
    color: '#c4b5fd',
    fontSize: 18,
    fontWeight: '700',
  },
  unassignedHeaderWrap: {
    marginBottom: 8,
  },
  cardSubtext: {
    color: '#7E89A8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 12,
  },
  sectionHeader: {
    marginTop: 0,
    marginBottom: 0,
    fontSize: 11,
    fontWeight: '800',
    color: '#9AA4C1',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  completedHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedCountChip: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,144,173,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(166,174,203,0.18)',
  },
  completedCountText: {
    color: '#D8DBEA',
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    minWidth: 98,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.05,
  },
  collapsibleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 0,
  },
  collapseBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseBtnText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#9AA4C1',
    lineHeight: Platform.OS === 'ios' ? 20 : 18,
  },
  swipeDeleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
    backgroundColor: 'rgba(239,68,68,0.92)',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    marginTop: 0,
    marginBottom: 0,
  },
  swipeDeleteText: {
    color: '#0b1220',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(92,104,150,0.26)',
    backgroundColor: 'rgba(6,14,36,0.98)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  modalTitle: {
    color: '#F4F0FF',
    marginBottom: 6,
    fontWeight: '700',
  },
  modalBody: {
    color: '#8b90ad',
    marginBottom: 14,
    lineHeight: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalBtnGhost: {
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderColor: 'rgba(148,163,184,0.22)',
  },
  modalBtnDanger: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  modalBtnText: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
  swipeMoveAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 92,
    backgroundColor: 'rgba(56,189,248,0.92)',
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    marginTop: 0,
    marginBottom: 0,
  },
  swipeMoveText: {
    color: '#0b1220',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  moveList: {
    borderWidth: 1,
    borderColor: 'rgba(92,104,150,0.22)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: 'rgba(8,16,40,0.96)',
  },
  moveRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(94,106,147,0.14)',
    backgroundColor: 'rgba(8,16,40,0.96)',
  },
  moveRowFirst: {
    borderTopWidth: 0,
  },
  moveRowText: {
    color: '#F4F0FF',
    fontSize: 14,
    fontWeight: '600',
  },
});