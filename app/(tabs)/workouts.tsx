// app/(tabs)/workouts.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Modal, TextInput } from 'react-native';
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const endpoint = rosterAthleteId
        ? `/workouts/my_list/mobile/${rosterAthleteId}`
        : `/workouts/my_list/mobile`;

      const resp = await fetchJson(endpoint, { method: 'GET' });
      const res: any = resp.json;

      // Normalize errors
      if (!resp.ok) {
        const msg = res?.error || res?.message || `HTTP ${resp.status}`;
        if (cancelled) return;
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
        setLoading(false);
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
      } else {
        // Expecting my-list style payload from /workouts/my_list/mobile
        const athleteObj = res.athlete || null;

        // Determine self-coached from payload (same logic used elsewhere)
        const selfCoached = !!(
          athleteObj &&
          (athleteObj.is_self_coached ??
            (athleteObj.user_id != null &&
              athleteObj.coach_id != null &&
              athleteObj.user_id === athleteObj.coach_id))
        );

        // If this is a true athlete view (not coach roster view, and not self-coached), hide drafts.
        const hideDraftsForAthlete = !rosterAthleteId && !selfCoached;

        const isDraft = (w: any) => String(w?.status || '').toLowerCase() === 'draft';

        const blocksRaw = res.blocks || [];
        const pendingRaw = res.pending_map || {};
        const completedRaw = res.completed_map || {};
        const unassignedPendingRaw = res.unassigned_pending || [];
        const unassignedCompletedRaw = res.unassigned_completed || [];

        // Filter drafts out of maps/lists ONLY for athletes
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

        // Optional: hide empty blocks if they only contained drafts
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
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [rosterAthleteId, refreshNonce]);

  const firstName =
    athlete?.name?.split(' ')[0] || 'Athlete';

  const statusLabel = (s?: string | null) => {
    const v = (s || 'assigned').toLowerCase();
    if (v === 'assigned') return 'Assigned';
    if (v === 'in_progress') return 'In progress';
    if (['logged', 'completed', 'done'].includes(v)) return 'Completed';
    return v.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const statusTone = (s?: string | null) => {
    const v = (s || 'assigned').toLowerCase();
    if (v === 'assigned') return '#f97316'; // warn
    if (v === 'in_progress') return '#22c55e'; // ok
    if (['logged', 'completed', 'done'].includes(v)) return '#38bdf8'; // accent
    return '#e5e7eb';
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
          style={styles.row}
          onPress={() =>
            router.push({
              pathname: '/workout/[workoutId]',
              params: { workoutId: String(w.id) },
            })
          }
        >
          <View>
            <ThemedText variant="body" style={styles.rowTitle}>
              {w.label || 'Workout'}
            </ThemedText>
            <ThemedText variant="small" style={styles.rowMeta}>
              {w.date || 'Unknown date'}
            </ThemedText>
          </View>
          <View style={[styles.statusPill, { borderColor: statusTone(w.status) }]}>
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
          style={styles.row}
          onPress={() =>
            router.push({
              pathname: '/workout/[workoutId]',
              params: { workoutId: String(w.id) },
            })
          }
        >
          <View>
            <ThemedText variant="body" style={styles.rowTitle}>
              {w.label || 'Workout'}
            </ThemedText>
            <ThemedText variant="small" style={styles.rowMeta}>
              {w.date || 'Unknown date'}
            </ThemedText>
          </View>
          <View style={[styles.statusPill, { borderColor: statusTone(w.status) }]}>
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

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ThemedText variant="h1" style={styles.pageTitle}>
            {rosterAthleteName ? `Workouts · ${rosterAthleteName}` : 'My Workouts'}
          </ThemedText>
          {canCreateBlock && (
            <View style={styles.topActionsRow}>
              <Pressable style={styles.primaryBtn} onPress={openCreateBlock}>
                <ThemedText variant="body" style={styles.primaryBtnText}>Create Block</ThemedText>
              </Pressable>
            </View>
          )}

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
            <View style={{ gap: 12 }}>
              {blocks.map((b) => {
                const collapseId = `completed-block-${b.id}`;
                const collapsed = collapseState[collapseId] ?? true;
                const pending = (pendingMap as any)[b.id] || [];
                const completed = (completedMap as any)[b.id] || [];

                return (
                  <View key={b.name} style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <ThemedText variant="h3" style={styles.cardTitle}>
                        {b.name}
                      </ThemedText>
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
                          <ThemedText variant="h3" style={styles.sectionHeader}>
                            Completed{' '}
                            <ThemedText variant="bodyMuted" style={styles.metaText}>
                              ({completed.length})
                            </ThemedText>
                          </ThemedText>
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
              <View style={[styles.card, { marginTop: 12 }]}>
                <View style={styles.cardHeaderRow}>
                  <ThemedText variant="h3" style={styles.cardTitle}>
                    No Assigned Block
                  </ThemedText>
                  {unassignedPending.length === 0 &&
                    unassignedCompleted.length === 0 && (
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
                            <ThemedText variant="h3" style={styles.sectionHeader}>
                              Completed{' '}
                              <ThemedText variant="bodyMuted" style={styles.metaText}>
                                ({unassignedCompleted.length})
                              </ThemedText>
                            </ThemedText>
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
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    color: '#FFFFFF',
  },
  topActionsRow: {
    marginBottom: 8,
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.55)',
    backgroundColor: '#38bdf8',
  },
  primaryBtnText: {
    color: '#0b1220',
    fontWeight: '800',
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
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,41,55,0.8)',
  },
  rowTitle: {
    fontSize: 14,
    color: '#E5E7EB',
  },
  rowMeta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metaText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
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
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#E5E7EB',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  collapsibleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapseBtn: {
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseBtnText: {
    fontSize: 16,
    color: '#E5E7EB',
  },
  swipeDeleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 92,
    backgroundColor: '#ef4444',
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    marginTop: 8,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalTitle: {
    color: '#E5E7EB',
    marginBottom: 6,
  },
  modalBody: {
    color: '#9CA3AF',
    marginBottom: 14,
    lineHeight: 18,
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
    backgroundColor: 'transparent',
    borderColor: 'rgba(148,163,184,0.35)',
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
    backgroundColor: '#38bdf8',
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    marginTop: 8,
    marginBottom: 0,
  },
  swipeMoveText: {
    color: '#0b1220',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  moveList: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  moveRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,41,55,0.8)',
    backgroundColor: '#0b1220',
  },
  moveRowFirst: {
    borderTopWidth: 0,
  },
  moveRowText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
});