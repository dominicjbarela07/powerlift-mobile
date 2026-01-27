// app/(tabs)/workout/[workoutId].tsx
// @ts-nocheck

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  findNodeHandle,
  UIManager,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { API_BASE, fetchJson } from '@/lib/api';
import { ThemedText } from '@/components/themed-text';

type SetLog = {
  id: number;
  set_index: number;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  actual_rir: number | null;
};

type WorkoutItem = {
  id: number;
  lift: string;
  variant: string; // "TOP" | "BK" | "STRAIGHT" | "ACC"
  movement: string | null;
  sets: number | null;
  reps: number | null;
  reps_text: string | null;
  mode: string | null;
  rpe_target: number | null;
  pct: number | null;
  rir_target: number | null;
  target_low_kg: number | null;
  target_high_kg: number | null;
  baseline_low_kg: number | null;
  baseline_high_kg: number | null;
  actual_weight_kg: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  notes: string | null;
  superset_group: string | null;
  superset_pos: number | null;
  set_logs: SetLog[];
  // Optional lookback / history (provided by backend when available)
  lookback_best?: {
    workout_id?: number | null;
    date?: string | null;
    label?: string | null;
    actual_weight_kg?: number | null;
    actual_reps?: number | null;
    actual_rpe?: number | null;
    actual_rir?: number | null;
  } | null;
  // Backwards-compat aliases some endpoints may use
  last_best?: WorkoutItem['lookback_best'];
  prev_best?: WorkoutItem['lookback_best'];
  parent_item_id?: number | null;
};

type AccessoryGroup = {
  group: string | null;
  items: WorkoutItem[];
};

type WorkoutPayload = {
  ok: boolean;
  permissions?: {
    can_log: boolean;
    can_coach: boolean;
    is_self_coached: boolean;
    can_hot_swap: boolean;
  };
  workout: {
    id: number;
    athlete_id: number;
    date: string | null;
    label: string | null;
    status: string | null;
    training_block_id: number | null;
    core_items: WorkoutItem[];
    accessory_groups: AccessoryGroup[];
  };
  athlete: {
    id: number;
    name: string;
  };
};


// Local notification handling for rest timer
let __notifHandlerSet = false;
if (!__notifHandlerSet) {
  __notifHandlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const KG_PER_LB = 0.45359237; // 1 lb = 0.45359 kg

function formatWeight(
  kg: number | null | undefined,
  unit: 'kg' | 'lb'
): string {
  if (kg == null) return '?';

  if (unit === 'kg') return kg.toFixed(1);

  // Convert kg → lb
  const lbs = kg / KG_PER_LB;
  return roundToNearest5(lbs).toFixed(0); // display whole pounds
}

function formatTargetRange(
  lowKg: number | null | undefined,
  highKg: number | null | undefined,
  unit: 'kg' | 'lb'
): string | null {
  if (lowKg == null || highKg == null) return null;
  if (lowKg === 0 && highKg === 0) return null;

  // Collapse single-point ranges (manual pm = 0)
  if (lowKg === highKg) {
    return `${formatWeight(lowKg, unit)} ${unit}`;
  }

  return `${formatWeight(lowKg, unit)}–${formatWeight(highKg, unit)} ${unit}`;
}

function roundToNearest5(x: number): number {
  return Math.round(x / 5) * 5;
}

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  assigned: {
    bg: 'rgba(234,179,8,0.12)', // warn
    text: '#facc15',
    border: 'rgba(234,179,8,0.4)',
  },
  in_progress: {
    bg: 'rgba(34,197,94,0.12)', // ok
    text: '#4ade80',
    border: 'rgba(34,197,94,0.5)',
  },
  completed: {
    bg: 'rgba(129,140,248,0.14)', // accent
    text: '#a5b4fc',
    border: 'rgba(129,140,248,0.5)',
  },
};

function prettyStatus(status?: string | null) {
  if (!status) return '';
  return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}


function liftDisplayName(core: WorkoutItem): string {
  // Mirror the Jinja logic for core lift names
  if ((core.variant === 'VR' || core.lift === 'VR') && core.movement) {
    return core.movement;
  }

  if (core.lift === 'SQ') return 'Comp Squat';
  if (core.lift === 'BN') return 'Comp Bench';
  if (core.lift === 'DL') return 'Comp Deadlift';

  return core.movement || core.lift;
}

function getLookbackBest(it: any) {
  return it?.lookback_best || it?.last_best || it?.prev_best || null;
}

function formatLookbackLine(best: any, unit: 'kg' | 'lb') {
  if (!best) return null;

  // Support both shapes:
  // 1) { actual_weight_kg, actual_reps, actual_rpe, actual_rir, date }
  // 2) { weight_kg, reps, rpe, rir, date }
  const w = best.actual_weight_kg ?? best.weight_kg ?? null;
  const reps = best.actual_reps ?? best.reps ?? null;
  const rpe = best.actual_rpe ?? best.rpe ?? null;
  const rir = best.actual_rir ?? best.rir ?? null;
  const dateStr = best.date ? String(best.date).slice(0, 10) : null;

  if (w == null || reps == null) return null;

  let line = `Last best: ${formatWeight(w, unit)} ${unit} × ${reps}`;
  if (rpe != null) line += ` @ RPE ${Number(rpe).toFixed(1)}`;
  if (rir != null) line += ` (RIR ${rir})`;
  if (dateStr) line += ` · ${dateStr}`;

  return line;
}

export default function WorkoutViewerScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const router = useRouter();
  const { user } = useAuth(); // we only need session + role to decide logging availability

  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [data, setData] = useState<WorkoutPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
    const [straightInputs, setStraightInputs] = useState<
    Record<number, { weight: string; reps: string; rpe: string }>
  >({});
  const [topInputs, setTopInputs] = useState<
    Record<number, { weight: string; reps: string; rpe: string }>
  >({});
  const [bkInputs, setBkInputs] = useState<
    Record<number, { weight: string; reps: string; rpe: string }>
  >({});
  const [accInputs, setAccInputs] = useState<
    Record<number, { weight: string; reps: string; rir: string }>
  >({});
  const updateAccInput = (
    itemId: number,
    field: 'weight' | 'reps' | 'rir',
    value: string,
  ) => {
    // iOS/Expo numeric keyboards can emit spaces/newlines or locale characters.
    // Sanitize at the point of entry so state is always clean.
    let v = value ?? '';

    if (field === 'reps') {
      // reps must be an integer; keep digits only
      v = v.replace(/[^0-9]/g, '');
    } else if (field === 'weight') {
      // allow digits + one decimal point
      v = v.replace(/[^0-9.]/g, '');
      const firstDot = v.indexOf('.');
      if (firstDot !== -1) {
        // remove any additional dots
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
      }
    } else if (field === 'rir') {
      // allow digits + one decimal point + optional leading minus
      v = v.replace(/[^0-9.\-]/g, '');
      // only keep a single leading minus
      v = v.replace(/(?!^)-/g, '');
      const firstDot = v.indexOf('.');
      if (firstDot !== -1) {
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
      }
    }

    setAccInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: prev[itemId]?.weight || '',
        reps: prev[itemId]?.reps || '',
        rir: prev[itemId]?.rir || '',
        [field]: v,
      },
    }));
  };

  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const pendingRestoreScrollYRef = useRef<number | null>(null);

  // --- Keyboard + focus helpers so active log row stays visible ---
  const inputRefs = useRef<Record<string, any>>({});

  const scrollToNode = (node: any) => {
    if (!node || !scrollRef.current) return;

    try {
      // IMPORTANT: measureLayout must be called with native node handles.
      // TextInput refs can sometimes be non-native (composite) depending on platform/runtime.
      // Using UIManager.measureLayout avoids the warning and works reliably.
      const nodeHandle = findNodeHandle(node);
      const scrollNode = (scrollRef.current as any).getInnerViewNode?.() || scrollRef.current;
      const scrollHandle = findNodeHandle(scrollNode);

      if (!nodeHandle || !scrollHandle) return;

      UIManager.measureLayout(
        nodeHandle,
        scrollHandle,
        () => {},
        (_x: number, y: number) => {
          const targetY = Math.max(0, y - 120);
          scrollRef.current?.scrollTo({ y: targetY, animated: true });
        }
      );
    } catch {}
  };

  const focusField = (key: string) => {
    const ref = inputRefs.current[key];
    if (ref?.focus) {
      ref.focus();
      // Scroll after focus so we land on the correct position
      requestAnimationFrame(() => scrollToNode(ref));
    }
  };

  const registerRef = (key: string) => (ref: any) => {
    if (ref) inputRefs.current[key] = ref;
  };
  const [refreshing, setRefreshing] = useState(false);

  const rememberScroll = () => {
    pendingRestoreScrollYRef.current = scrollYRef.current;
  };

  const restoreScrollSoon = () => {
    const y = pendingRestoreScrollYRef.current;
    if (y == null) return;
    pendingRestoreScrollYRef.current = null;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  };

  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<
    null | 'begin' | 'complete' | 'cancel'
  >(null);

  const [restSeconds, setRestSeconds] = useState(0);
  const [restActive, setRestActive] = useState(false);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restEndAtMsRef = useRef<number | null>(null);
  const restNotifIdRef = useRef<string | null>(null);
  const notifPermCheckedRef = useRef(false);
  const ensureNotifPerms = async () => {
    // Only ask once per screen mount
    if (notifPermCheckedRef.current) {
      const existing = await Notifications.getPermissionsAsync();
      return existing.status === 'granted';
    }

    notifPermCheckedRef.current = true;

    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;

    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  };

  const cancelRestEndNotification = async () => {
    const id = restNotifIdRef.current;
    if (!id) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (e) {
      // best-effort
      console.log('cancelRestEndNotification error', e);
    } finally {
      restNotifIdRef.current = null;
    }
  };

  const scheduleRestEndNotification = async (seconds: number) => {
    // Replace any existing scheduled rest notification
    await cancelRestEndNotification();

    const granted = await ensureNotifPerms();
    if (!granted) return;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rest over',
          body: 'Time for the next set.',
          data: { kind: 'rest_end' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
      restNotifIdRef.current = id;
    } catch (e) {
      console.log('scheduleRestEndNotification error', e);
    }
  };

  // Shared timer picker state and helpers
  const [timerPickerVisible, setTimerPickerVisible] = useState(false);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);

  // --- Readiness survey (mobile only) ---
  const [readinessVisible, setReadinessVisible] = useState(false);
  const [pendingBeginWorkoutId, setPendingBeginWorkoutId] = useState<number | null>(null);
  const [readinessSubmitting, setReadinessSubmitting] = useState(false);

  const [readinessForm, setReadinessForm] = useState({
    sleep_quality: 3,
    fatigue: 3,
    soreness: 3,
    stress: 3,
    overall: 3,
  });

  // If backend provides readiness data, this prevents re-prompting.
  // If it doesn't yet, you'll still get prompted once per begin tap.
  const hasReadinessForWorkout = () => {
    const wk: any = data?.workout;
    return !!wk?.readiness_survey;
  };

  const openReadinessThenBegin = (wkId: number) => {
    setPendingBeginWorkoutId(wkId);
    setReadinessVisible(true);
  };

  // Submit readiness (best-effort) then begin workout either way.
  const submitReadinessAndBegin = async (opts?: { skipped?: boolean }) => {
    const wkId = pendingBeginWorkoutId;
    if (!wkId) {
      setReadinessVisible(false);
      return;
    }

    try {
      setReadinessSubmitting(true);
      setError(null);

      const skipped = !!opts?.skipped;
      const body = skipped
        ? { skipped: true }
        : {
            sleep_quality: readinessForm.sleep_quality,
            soreness: readinessForm.soreness,
            stress: readinessForm.stress,
            energy: readinessForm.fatigue, // mapping fatigue -> energy for now
          };

      // Create this backend route next:
      // POST /workouts/mobile/<wkId>/readiness
      await fetchJson(`${API_BASE}/workouts/mobile/${wkId}/readiness`, {
        method: 'POST',
        auth: true,
        body,
      });
    } catch (e) {
      // Don't block beginning the workout if readiness submit fails
      console.log('readiness submit error', e);
    } finally {
      setReadinessSubmitting(false);
      setReadinessVisible(false);
      setPendingBeginWorkoutId(null);

      // Now proceed with the existing begin flow
      requestAnimationFrame(() => beginWorkout());
    }
  };

  // --- Accessory hot-swap (self-coached only) ---
  const [swapAccVisible, setSwapAccVisible] = useState(false);
  const [swapAccItem, setSwapAccItem] = useState<WorkoutItem | null>(null);
  const [swapAccForm, setSwapAccForm] = useState({
    movement: '',
    sets: '',
    reps_text: '',
    rir: '',
  });

  const openSwapAcc = (it: WorkoutItem) => {
    setSwapAccItem(it);
    setSwapAccForm({
      movement: it.movement || '',
      sets: it.sets != null ? String(it.sets) : '',
      reps_text: it.reps_text || (it.reps != null ? String(it.reps) : ''),
      rir: it.rir_target != null ? String(it.rir_target) : '',
    });
    setSwapAccVisible(true);
  };

  const saveSwapAcc = async () => {
    if (!workoutId || !swapAccItem) return;

    const movement = String(swapAccForm.movement || '').trim();
    const setsStr = String(swapAccForm.sets || '').trim();
    const repsText = String(swapAccForm.reps_text || '').trim();
    const rirStr = String(swapAccForm.rir || '').trim();

    if (!movement) {
      setError('Movement required');
      return;
    }

    let sets: number | null = null;
    if (setsStr !== '') {
      const n = parseInt(setsStr.replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(n) || n < 0) {
        setError('Invalid sets');
        return;
      }
      sets = n;
    }

    let rir: number | null = null;
    if (rirStr !== '') {
      const cleaned = rirStr.replace(/[^0-9.\-]/g, '').replace(/(?!^)-/g, '');
      const n = parseFloat(cleaned);
      if (!Number.isFinite(n)) {
        setError('Invalid RIR');
        return;
      }
      rir = n;
    }

    try {
      setSavingItemId(swapAccItem.id);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${swapAccItem.id}/swap_acc`,
        {
          method: 'POST',
          body: {
            movement,
            sets: sets ?? undefined,
            reps_text: repsText,
            rir: rir ?? undefined,
          },
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to swap accessory (HTTP ${status})`);
      }

      setSwapAccVisible(false);
      setSwapAccItem(null);
      rememberScroll();
      await fetchWorkout();
    } catch (err: any) {
      console.log('saveSwapAcc error', err);
      setError(err?.message || 'Error swapping accessory');
    } finally {
      setSavingItemId(null);
    }
  };

  const TIMER_OPTIONS = [30, 60, 90, 120, 180, 240, 300];

  const openTimerPicker = () => {
    setTimerPickerVisible(true);
  };

  const handleTimerSelect = (seconds: number) => {
    startRestTimer(seconds);
    setTimerPickerVisible(false);
  };

  const startRestTimer = (seconds: number) => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    const endAt = Date.now() + seconds * 1000;
    restEndAtMsRef.current = endAt;

    setRestSeconds(seconds);
    setRestActive(true);

    // Schedule a local notification so the timer "works" while backgrounded
    scheduleRestEndNotification(seconds);
  };

  const stopRestTimer = () => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }
    restEndAtMsRef.current = null;
    setRestActive(false);
    setRestSeconds(0);

    // Cancel any pending rest-end notification
    cancelRestEndNotification();
  };

  const formatRestTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // If timer isn't active or has no end timestamp, ensure interval is cleared
    if (!restActive || !restEndAtMsRef.current) {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
      return;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((restEndAtMsRef.current! - Date.now()) / 1000)
      );

      setRestSeconds(remaining);

      if (remaining <= 0) {
        setRestActive(false);
        restEndAtMsRef.current = null;
        restNotifIdRef.current = null;

        if (restTimerRef.current) {
          clearInterval(restTimerRef.current);
          restTimerRef.current = null;
        }
      }
    };

    // Immediate sync so UI is correct right away
    tick();

    // Update frequently for smooth UI; uses end timestamp so background is fine
    const id = setInterval(tick, 250);
    restTimerRef.current = id as any;

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    };
  }, [restActive]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && restActive && restEndAtMsRef.current) {
        const remaining = Math.max(
          0,
          Math.ceil((restEndAtMsRef.current - Date.now()) / 1000)
        );
        setRestSeconds(remaining);

        if (remaining <= 0) {
          setRestActive(false);
          restEndAtMsRef.current = null;
        }
      }
    });

    return () => sub.remove();
  }, [restActive]);



  const updateStraightInput = (
    itemId: number,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => {
    setStraightInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: prev[itemId]?.weight || '',
        reps: prev[itemId]?.reps || '',
        rpe: prev[itemId]?.rpe || '',
        [field]: value,
      },
    }));
  };

  const updateTopInput = (
    itemId: number,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => {
    setTopInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: prev[itemId]?.weight || '',
        reps: prev[itemId]?.reps || '',
        rpe: prev[itemId]?.rpe || '',
        [field]: value,
      },
    }));
  };

  const updateBkInput = (
    itemId: number,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => {
    setBkInputs((prev) => ({
      ...prev,
      [itemId]: {
        weight: prev[itemId]?.weight || '',
        reps: prev[itemId]?.reps || '',
        rpe: prev[itemId]?.rpe || '',
        [field]: value,
      },
    }));
  };

  // Helper to ensure reps is initialized in state for controlled TextInput
  const ensureCoreRepsPrefill = (
    itemId: number,
    kind: 'straight' | 'top' | 'bk',
    fallbackReps: number | string | null | undefined,
  ) => {
    const repsStr = (fallbackReps != null && String(fallbackReps).trim() !== '')
      ? String(fallbackReps)
      : '';

    if (kind === 'straight') {
      setStraightInputs((prev) => {
        const cur = prev[itemId];
        if (cur && (cur.reps ?? '') !== '') return prev;
        return {
          ...prev,
          [itemId]: {
            weight: cur?.weight || '',
            reps: cur?.reps || repsStr,
            rpe: cur?.rpe || '',
          },
        };
      });
      return;
    }

    if (kind === 'top') {
      setTopInputs((prev) => {
        const cur = prev[itemId];
        if (cur && (cur.reps ?? '') !== '') return prev;
        return {
          ...prev,
          [itemId]: {
            weight: cur?.weight || '',
            reps: cur?.reps || repsStr,
            rpe: cur?.rpe || '',
          },
        };
      });
      return;
    }

    setBkInputs((prev) => {
      const cur = prev[itemId];
      if (cur && (cur.reps ?? '') !== '') return prev;
      return {
        ...prev,
        [itemId]: {
          weight: cur?.weight || '',
          reps: cur?.reps || repsStr,
          rpe: cur?.rpe || '',
        },
      };
    });
  };

  // Prefill prescribed reps into controlled state once the workout loads.
  useEffect(() => {
    const wk = data?.workout;
    if (!wk?.id) return;

    const coreItems: any[] = Array.isArray(wk.core_items) ? wk.core_items : [];

    // Straight-like items: STRAIGHT and VR
    const straightLike = coreItems.filter((it) => it && (it.variant === 'STRAIGHT' || it.variant === 'VR' || it.lift === 'VR'));
    if (straightLike.length) {
      setStraightInputs((prev) => {
        let next = prev;
        for (const it of straightLike) {
          const id = it.id;
          const reps = it.reps;
          if (id == null || reps == null) continue;
          const cur = prev[id];
          if (cur && String(cur.reps || '').trim() !== '') continue;
          if (next === prev) next = { ...prev };
          next[id] = {
            weight: cur?.weight || '',
            reps: String(reps),
            rpe: cur?.rpe || '',
          };
        }
        return next;
      });
    }

    // Top items
    const topItems = coreItems.filter((it) => it && it.variant === 'TOP');
    if (topItems.length) {
      setTopInputs((prev) => {
        let next = prev;
        for (const it of topItems) {
          const id = it.id;
          const reps = it.reps;
          if (id == null || reps == null) continue;
          const cur = prev[id];
          if (cur && String(cur.reps || '').trim() !== '') continue;
          if (next === prev) next = { ...prev };
          next[id] = {
            weight: cur?.weight || '',
            reps: String(reps),
            rpe: cur?.rpe || '',
          };
        }
        return next;
      });
    }

    // Backdowns: every BK item should get its own reps prefill
    const bkItems = coreItems.filter((it) => it && it.variant === 'BK');
    if (bkItems.length) {
      setBkInputs((prev) => {
        let next = prev;
        for (const it of bkItems) {
          const id = it.id;
          const reps = it.reps;
          if (id == null || reps == null) continue;
          const cur = prev[id];
          if (cur && String(cur.reps || '').trim() !== '') continue;
          if (next === prev) next = { ...prev };
          next[id] = {
            weight: cur?.weight || '',
            reps: String(reps),
            rpe: cur?.rpe || '',
          };
        }
        return next;
      });
    }
  }, [data?.workout?.id]);

  const logStraightSet = async (itemId: number) => {
    if (!workoutId || !data) return;

    const input = straightInputs[itemId] || { weight: '', reps: '', rpe: '' };
    let weightInUnit = input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;
    const rpe = input.rpe ? parseFloat(input.rpe) : null;

    if (Number.isNaN(weightInUnit)) {
      setError('Enter a valid weight');
      return;
    }
    if (weightInUnit <= 0) {
      setError('Weight required');
      return;
    }
    if (!Number.isFinite(reps) || reps <= 0) {
      setError('Reps required');
      return;
    }

    // ROUND lbs before converting
    if (unit === 'lb') {
      weightInUnit = roundToNearest5(weightInUnit);
    }

    const weightKg = unit === 'kg'
      ? weightInUnit
      : weightInUnit * KG_PER_LB;

    const prescribedReps = (() => {
      const it = data?.workout?.core_items?.find((x: any) => x?.id === itemId);
      return it?.reps != null ? String(it.reps) : '';
    })();

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_straight`,
        {
          method: 'POST',
          body: {
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe: rpe,
          },
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to log set (HTTP ${status})`);
      }

      setTimerPickerVisible(true);
      rememberScroll();
      await fetchWorkout();

      // Prefill next set weight with the weight just used (saves re-typing)
      const nextWeightStr = weightInUnit > 0
        ? (unit === 'lb'
            ? String(roundToNearest5(weightInUnit))
            : String(weightInUnit))
        : '';

      setStraightInputs((prev) => ({
        ...prev,
        [itemId]: { weight: nextWeightStr, reps: prescribedReps, rpe: '' },
      }));
    } catch (err: any) {
      console.log('logStraightSet error', err);
      setError(err?.message || 'Error logging set');
    } finally {
      setSavingItemId(null);
    }
  };

  const logTopSet = async (itemId: number) => {
    if (!workoutId || !data) return;

    const input = topInputs[itemId] || { weight: '', reps: '', rpe: '' };
    let weightInUnit = input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;
    const rpe = input.rpe ? parseFloat(input.rpe) : null;

    if (Number.isNaN(weightInUnit) || weightInUnit <= 0 || rpe == null) {
      setError(`Enter a valid top set: weight (${unit}) and RPE`);
      return;
    }
    if (!Number.isFinite(reps) || reps <= 0) {
      setError('Reps required');
      return;
    }

    // ROUND lbs before conversion
    if (unit === 'lb') {
      weightInUnit = roundToNearest5(weightInUnit);
    }

    const weightKg = unit === 'kg'
      ? weightInUnit
      : weightInUnit * KG_PER_LB;

    const prescribedReps = (() => {
      const it = data?.workout?.core_items?.find((x: any) => x?.id === itemId);
      return it?.reps != null ? String(it.reps) : '';
    })();

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_top`,
        {
          method: 'POST',
          body: {
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe: rpe,
          },
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to log top set (HTTP ${status})`);
      }

      setTimerPickerVisible(true);
      rememberScroll();
      await fetchWorkout();
      setTopInputs((prev) => ({
        ...prev,
        [itemId]: { weight: '', reps: prescribedReps, rpe: '' },
      }));
    } catch (err: any) {
      console.log('logTopSet error', err);
      setError(err?.message || 'Error logging top set');
    } finally {
      setSavingItemId(null);
    }
  };

  const logBackdownSet = async (itemId: number) => {
    if (!workoutId || !data) return;

    const input = bkInputs[itemId] || { weight: '', reps: '', rpe: '' };
    let weightInUnit = input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;
    const rpe = input.rpe ? parseFloat(input.rpe) : null;

    if (Number.isNaN(weightInUnit)) {
      setError(`Enter a valid backdown set weight (${unit})`);
      return;
    }
    if (weightInUnit <= 0) {
      setError(`Weight required`);
      return;
    }
    if (!Number.isFinite(reps) || reps <= 0) {
      setError('Reps required');
      return;
    }

    // ROUND lbs before conversion
    if (unit === 'lb') {
      weightInUnit = roundToNearest5(weightInUnit);
    }

    const weightKg = unit === 'kg'
      ? weightInUnit
      : weightInUnit * KG_PER_LB;

    const prescribedReps = (() => {
      const it = data?.workout?.core_items?.find((x: any) => x?.id === itemId);
      return it?.reps != null ? String(it.reps) : '';
    })();

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_bk`,
        {
          method: 'POST',
          body: {
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe: rpe,
          },
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to log backdown set (HTTP ${status})`);
      }

      setTimerPickerVisible(true);
      rememberScroll();
      await fetchWorkout();

      // Prefill next set weight with the weight just used (saves re-typing)
      const nextWeightStr = weightInUnit > 0
        ? (unit === 'lb'
            ? String(roundToNearest5(weightInUnit))
            : String(weightInUnit))
        : '';

      setBkInputs((prev) => ({
        ...prev,
        [itemId]: { weight: nextWeightStr, reps: prescribedReps, rpe: '' },
      }));
    } catch (err: any) {
      console.log('logBackdownSet error', err);
      setError(err?.message || 'Error logging backdown set');
    } finally {
      setSavingItemId(null);
    }
  };

  async function logAccessorySet(
    workoutId: number,
    itemId: number,
    payload: {
      actual_weight_kg: number;
      actual_reps: number;
      actual_rir?: number | null;
    }
  ) {
    console.log('logAccessorySet payload', { workoutId, itemId, payload });

    const { ok, status, json } = await fetchJson(
      `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_acc`,
      {
        method: 'POST',
        body: payload,
        auth: true,
      }
    );

    if (!ok || !json?.ok) {
      throw new Error(
        json?.error || `Failed to log accessory set (HTTP ${status})`
      );
    }

    return json as {
      ok: true;
      set: {
        id: number;
        set_index: number;
        actual_weight_kg: number;
        actual_reps: number;
        actual_rir: number | null;
      };
      next_index: number;
      total_sets: number;
    };
  }

  const handleAccessorySave = async (itemId: number) => {
    if (!workoutId || !data) return;

    const input = accInputs[itemId] || { weight: '', reps: '', rir: '' };
    console.log('handleAccessorySave input', { itemId, input });
    let weightInUnit =
      input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    // reps: digits only (defensive against invisible chars)
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;

    // rir: allow number/decimal/negative; strip other characters
    const rirStr = String(input.rir ?? '').trim().replace(/[^0-9.\-]/g, '');
    const rir = rirStr !== '' ? parseFloat(rirStr) : null;

    if (Number.isNaN(weightInUnit)) {
      setError(`Enter a valid accessory weight (${unit})`);
      return;
    }

    if (!Number.isFinite(reps) || reps <= 0) {
      setError('Reps required');
      return;
    }

    // ROUND lbs before conversion
    if (unit === 'lb') {
      weightInUnit = roundToNearest5(weightInUnit);
    }

    const weightKg = unit === 'kg'
      ? weightInUnit
      : weightInUnit * KG_PER_LB;

    try {
      setSavingItemId(itemId);
      setError(null);

      await logAccessorySet(
        Number(workoutId),
        itemId,
        {
          actual_weight_kg: weightKg,
          actual_reps: Number(reps),
          actual_rir: rir ?? undefined,
        }
      );

      setTimerPickerVisible(true);
      rememberScroll();
      await fetchWorkout();

      // Prefill next set weight with the weight just used (saves re-typing)
      const nextWeightStr = weightInUnit > 0
        ? (unit === 'lb'
            ? String(roundToNearest5(weightInUnit))
            : String(weightInUnit))
        : '';

      setAccInputs((prev) => ({
        ...prev,
        [itemId]: { weight: nextWeightStr, reps: '', rir: '' },
      }));
    } catch (err: any) {
      console.log('handleAccessorySave error', err);
      setError(err?.message || 'Error logging accessory set');
    } finally {
      setSavingItemId(null);
    }
  };

  const clearTopSet = async (itemId: number) => {
    if (!workoutId || !data) return;

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/clear_top`,
        {
          method: 'POST',
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to clear top set (HTTP ${status})`);
      }
      rememberScroll();
      await fetchWorkout();
    } catch (err: any) {
      console.log('clearTopSet error', err);
      setError(err?.message || 'Error clearing top set');
    } finally {
      setSavingItemId(null);
    }
  };

  const undoLastSet = async (itemId: number) => {
    if (!workoutId || !data) return;

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/delete_last_set`,
        {
          method: 'POST',
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to undo last set (HTTP ${status})`);
      }

      // Refresh workout so set_logs are in sync
      rememberScroll();
      await fetchWorkout();
    } catch (err: any) {
      console.log('undoLastSet error', err);
      setError(err?.message || 'Error undoing last set');
    } finally {
      setSavingItemId(null);
    }
  };

  const performStatusAction = async (kind: 'begin' | 'complete' | 'cancel') => {
    if (!workoutId) return;

    let path = '';
    if (kind === 'begin') path = 'begin';
    if (kind === 'complete') path = 'complete';
    if (kind === 'cancel') path = 'cancel';

    try {
      setActionLoading(kind);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/${path}`,
        {
          method: 'POST',
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to update workout status (HTTP ${status})`);
      }

      // pull fresh status + set_logs etc
      await fetchWorkout();
    } catch (err: any) {
      console.log('performStatusAction error', err);
      setError(err?.message || 'Error updating workout');
    } finally {
      setActionLoading(null);
    }
  };

  const beginWorkout = async () => {
    if (!data?.workout) return;
    const wkId = data.workout.id;

    if (!canLogFromServer) {
      Alert.alert('Read-only', 'You do not have permission to log this workout on mobile.');
      return;
    }

    try {
      setActionLoading('begin');
      setError(null);

      // Step 1: checkout the workout to this mobile client
      const checkout = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/checkout`,
        { method: 'POST', auth: true }
      );

      if (!checkout.ok || !checkout.json?.ok) {
        Alert.alert(
          'Unable to begin workout',
          checkout.json?.error ||
            `Workout is currently checked out by another user or device. (HTTP ${checkout.status})`
        );
        return;
      }

      // Step 2: mark status as in_progress
      const begun = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/begin`,
        { method: 'POST', auth: true }
      );

      if (!begun.ok || !begun.json?.ok) {
        Alert.alert('Error', begun.json?.error || `Failed to begin workout (HTTP ${begun.status})`);
        return;
      }

      // Pull fresh workout data (status, logs, etc.)
      await fetchWorkout();
    } catch (err) {
      console.error('beginWorkout error', err);
      Alert.alert('Error', 'Failed to begin workout');
    } finally {
      setActionLoading(null);
    }
  };

  const completeWorkout = async () => {
    if (!data?.workout) return;
    const wkId = data.workout.id;

    try {
      setActionLoading('complete');
      setError(null);

      const done = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/complete`,
        { method: 'POST', auth: true }
      );

      if (!done.ok || !done.json?.ok) {
        Alert.alert('Error', done.json?.error || `Failed to complete workout (HTTP ${done.status})`);
        return;
      }

      // Refresh local data
      await fetchWorkout();

      // Best-effort checkin: release the lock after completion
      try {
        await fetchJson(
          `${API_BASE}/workouts/mobile/${wkId}/checkin`,
          { method: 'POST', auth: true }
        );
      } catch (e) {
        console.warn('checkin after complete failed', e);
      }
    } catch (err) {
      console.error('completeWorkout error', err);
      Alert.alert('Error', 'Failed to complete workout');
    } finally {
      setActionLoading(null);
    }
  };

  const cancelWorkout = async () => {
    if (!data?.workout) return;
    const wkId = data.workout.id;

    try {
      setActionLoading('cancel');
      setError(null);

      const canceled = await fetchJson(
        `${API_BASE}/workouts/mobile/${wkId}/cancel`,
        { method: 'POST', auth: true }
      );

      if (!canceled.ok || !canceled.json?.ok) {
        Alert.alert('Error', canceled.json?.error || `Failed to cancel workout (HTTP ${canceled.status})`);
        return;
      }

      // Refresh local data
      await fetchWorkout();

      // Best-effort checkin: release the lock after cancel
      try {
        await fetchJson(
          `${API_BASE}/workouts/mobile/${wkId}/checkin`,
          { method: 'POST', auth: true }
        );
      } catch (e) {
        console.warn('checkin after cancel failed', e);
      }
    } catch (err) {
      console.error('cancelWorkout error', err);
      Alert.alert('Error', 'Failed to cancel workout');
    } finally {
      setActionLoading(null);
    }
  };

  const fetchWorkout = async () => {
    if (!workoutId) {
      setError('Missing workout id');
      setLoading(false);
      return;
    }

    try {
      // Only show the full-screen loader on first load.
      // Refreshes should keep ScrollView mounted to avoid snapping to top.
      if (!data) setLoading(true);
      else setRefreshing(true);

      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}`,
        { method: 'GET', auth: true }
      );

      const payload = json as WorkoutPayload;

      if (!ok || !payload?.ok) {
        throw new Error((payload as any)?.error || `Failed to load workout (HTTP ${status})`);
      }

      setData(payload);
      restoreScrollSoon();
    } catch (err: any) {
      console.log('Workout fetch error', err);
      setError(err?.message || 'Error loading workout');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkout();
  }, [workoutId]);

  useEffect(() => {
    return () => {
      // Best-effort cleanup so scheduled notifications don't linger
      cancelRestEndNotification();
    };
  }, []);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <ThemedText variant="bodyMuted" style={styles.muted}>
          Loading workout…
        </ThemedText>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <ThemedText variant="error" style={styles.errorText}>
          {error || 'Something went wrong'}
        </ThemedText>
      </View>
    );
  }

  const { workout, athlete } = data;
  const canLogFromServer = !!data.permissions?.can_log;
  const canHotSwap = !!data.permissions?.can_hot_swap;
  // Coach viewing an athlete workout in read-only mode
  const isCoachView = !!data.permissions?.can_coach && !canLogFromServer;
  const canEdit =
    (!!data.permissions?.can_coach || !!data.permissions?.is_self_coached) &&
    (workout.status === 'assigned' || workout.status === 'draft');
  const canLog = canLogFromServer && workout.status === 'in_progress';
  const canBegin = canLogFromServer && workout.status === 'assigned';
  const canCompleteOrCancel =
    canLogFromServer &&
    (workout.status === 'in_progress' || workout.status === 'completed');

  const statusStyle =
    (workout.status && STATUS_STYLES[workout.status]) || STATUS_STYLES.assigned;


  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
    >
      {/* Pinned top bar: unit toggle and rest timer (inline) */}
      <View style={styles.pinnedTopBar}>
        <View style={styles.topBarRow}>
          {/* Unit toggle */}
          <View style={styles.unitToggleRowInline}>
            <View style={styles.unitTogglePill}>
              <TouchableOpacity
                style={[
                  styles.unitToggleOption,
                  unit === 'kg' && styles.unitToggleOptionActive,
                ]}
                onPress={() => setUnit('kg')}
              >
                <Text
                  style={[
                    styles.unitToggleText,
                    unit === 'kg' && styles.unitToggleTextActive,
                  ]}
                >
                  kg
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitToggleOption,
                  unit === 'lb' && styles.unitToggleOptionActive,
                ]}
                onPress={() => setUnit('lb')}
              >
                <Text
                  style={[
                    styles.unitToggleText,
                    unit === 'lb' && styles.unitToggleTextActive,
                  ]}
                >
                  lb
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Rest timer */}
          {canLog && (
            <View style={styles.timerInline}>
              <Text style={styles.timerLabelInline}>
                {restActive && restSeconds > 0
                  ? formatRestTime(restSeconds)
                  : '—'}
              </Text>
              {!restActive ? (
                <TouchableOpacity
                  style={styles.timerButton}
                  onPress={openTimerPicker}
                >
                  <Text style={styles.timerButtonText}>Set Timer</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.timerButton, styles.timerStopButton]}
                  onPress={stopRestTimer}
                >
                  <Text style={styles.timerButtonText}>Stop</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Scrollable workout content */}
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top summary — mirrors the h2 row in workout_show.html */}
        <View style={styles.summaryRow}>
          <View style={{ flex: 1 }}>
            <ThemedText variant="h1" style={styles.pageTitle}>
              {workout.label || 'Training Session'}
            </ThemedText>
            <Text style={styles.summaryLine}>
              <Text style={styles.summaryStrong}>{athlete.name}</Text>
              <Text style={styles.summarySeparator}> · </Text>
              <Text style={styles.summaryText}>
                {workout.date || 'No date set'}
              </Text>
            </Text>
          </View>

          {workout.status && (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusStyle.bg,
                  borderColor: statusStyle.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: statusStyle.text },
                ]}
              >
                {prettyStatus(workout.status)}
              </Text>
            </View>
          )}
        </View>

        {/* Inline error banner (below header) */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity
              onPress={() => setError(null)}
              style={styles.errorBannerClose}
              accessibilityLabel="Dismiss error"
            >
              <Text style={styles.errorBannerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}


        {/* Actions row: Edit (coach/self) and Begin (athlete/self) */}
        {(canBegin || canEdit) && (
          <View style={styles.actionBar}>
              {canEdit && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionSecondary]}
                  onPress={() =>
                    router.push({
                      pathname: '/create-workout',
                      params: { editWorkoutId: String(workout.id) },
                    })
                  }
                >
                  <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>
                    Edit
                  </Text>
                </TouchableOpacity>
              )}

              {canBegin && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionPrimary,
                    actionLoading === 'begin' && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    if (hasReadinessForWorkout()) {
                      beginWorkout();
                    } else {
                      openReadinessThenBegin(workout.id);
                    }
                  }}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'begin' ? (
                    <ActivityIndicator size="small" color="#020617" />
                  ) : (
                    <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>
                      Begin Workout
                    </Text>
                  )}
                </TouchableOpacity>
              )}
          </View>
        )}

        {/* Core lifts as stacked cards */}
        <View style={styles.sectionBlock}>
          {workout.core_items.map((core) => {
            // ... keep the entire core_items.map block exactly as-is ...
            const isStraightLike =
              core.variant === 'STRAIGHT' ||
              core.variant === 'VR' ||
              core.lift === 'VR';

            const isTop = core.variant === 'TOP';
            const isBackdown = core.variant === 'BK';
            const hasParent = core.parent_item_id != null;

            // Skip BK rows that belong to a TOP – they’ll be rendered under the TOP card
            if (isBackdown && hasParent) {
              return null;
            }

            // BK children for this TOP item
            const backdownsForThisTop =
              isTop
                ? workout.core_items.filter(
                    (it) =>
                      it.variant === 'BK' &&
                      it.parent_item_id === core.id,
                  )
                : [];

            // Logging allowed only when server says this user can log AND workout is in progress
            const canLog = canLogFromServer && workout.status === 'in_progress';

            // straight-style logs (STRAIGHT/VR items only)
            const logs = core.set_logs || [];
            const totalSets = core.sets || 0;
            const latestLoggedIdx =
              logs.length > 0 ? Math.max(...logs.map((sl) => sl.set_index || 0)) : 0;
            const nextIdx = Math.min(latestLoggedIdx + 1, totalSets) || 1;

            // For TOP items, reps are stored on the TOP set_log (set_index=1).
            // Some payloads may still include core.actual_* aggregates, so support both.
            const topSetLog = isTop
              ? (logs.find((sl) => sl.set_index === 1) || logs[0] || null)
              : null;

            const hasTopActual = isTop
              ? (topSetLog?.actual_weight_kg != null && topSetLog?.actual_rpe != null)
              : (core.actual_weight_kg != null && core.actual_rpe != null);

            return (
              <View key={core.id} style={styles.coreCard}>
                {/* Title row */}
                <View style={styles.coreHeaderRow}>
                  <Text style={styles.coreTitle}>{liftDisplayName(core)}</Text>
                  <View style={styles.variantPill}>
                    <Text style={styles.variantText}>
                      {isTop
                        ? 'Top + Backdown'
                        : isBackdown
                        ? 'Backdown'
                        : 'Straight Sets'}
                    </Text>
                  </View>
                </View>

                {/* Scheme row (hide for TOP so the top/backdown rows each show their own scheme) */}
                {!isTop && (
                  <Text style={styles.coreScheme}>
                    {core.sets || 0} × {core.reps || core.reps_text || '—'}
                    {core.mode === 'RPE' && core.rpe_target != null && (
                      <Text style={styles.coreSchemeDetail}>
                        {' '}
                        @ RPE {core.rpe_target.toFixed(1)}
                      </Text>
                    )}
                    {core.mode === 'PCT' && core.pct != null && (
                      <Text style={styles.coreSchemeDetail}>
                        {' '}
                        @ {(core.pct * 100).toFixed(1)}% TM
                      </Text>
                    )}
                  </Text>
                )}

                {core.notes && core.notes.trim() !== '' && (
                  <Text style={styles.notesText}>{core.notes}</Text>
                )}

                {/* === Straight / VR logging === */}
                {isStraightLike && totalSets > 0 && (
                  <View style={styles.setLogsBlock}>
                    {Array.from({ length: totalSets }).map((_, idx) => {
                      const setIdx = idx + 1;
                      const existing = logs.find((sl) => sl.set_index === setIdx);

                      const isLatest = existing && setIdx === latestLoggedIdx;
                      const isNext = !existing && setIdx === nextIdx;

                      return (
                        <View key={setIdx} style={styles.setLogLine}>
                          <Text style={styles.setLabel}>Set {setIdx}</Text>

                          {/* Inline suggested range for the whole item */}
                          {(() => {
                            const t = formatTargetRange(core.target_low_kg, core.target_high_kg, unit);
                            if (!t) return null;
                            return <Text style={styles.setTargetInline}>{t}</Text>;
                          })()}

                          {existing ? (
                            <Text style={styles.actualText}>
                              {formatWeight(existing.actual_weight_kg, unit)} {unit}
                              {existing.actual_reps != null ? ` × ${existing.actual_reps}` : ''}
                              {existing.actual_rpe != null ? ` @ RPE ${existing.actual_rpe.toFixed(1)}` : ''}
                            </Text>
                          ) : isNext ? (
                            canLog ? (
                              <View style={styles.logRow}>
                                <TextInput
                                  style={styles.logInput}
                                  placeholder={unit}
                                  placeholderTextColor="#64748b"
                                  keyboardType="numeric"
                                  value={straightInputs[core.id]?.weight ?? ''}
                                  onChangeText={(txt) =>
                                    updateStraightInput(core.id, 'weight', txt)
                                  }
                                  ref={registerRef(`straight-${core.id}-weight`)}
                                  returnKeyType="next"
                                  blurOnSubmit={false}
                                  onSubmitEditing={() => focusField(`straight-${core.id}-reps`)}
                                  onFocus={() => {
                                    ensureCoreRepsPrefill(core.id, 'straight', core.reps);
                                    requestAnimationFrame(() => scrollToNode(inputRefs.current[`straight-${core.id}-weight`]));
                                  }}
                                />
                                <TextInput
                                  style={styles.logInput}
                                  placeholder="reps"
                                  placeholderTextColor="#64748b"
                                  keyboardType="number-pad"
                                  value={straightInputs[core.id]?.reps ?? ''}
                                  onChangeText={(txt) =>
                                    updateStraightInput(core.id, 'reps', txt)
                                  }
                                  ref={registerRef(`straight-${core.id}-reps`)}
                                  returnKeyType="next"
                                  blurOnSubmit={false}
                                  onSubmitEditing={() => focusField(`straight-${core.id}-rpe`)}
                                  onFocus={() => {
                                    ensureCoreRepsPrefill(core.id, 'straight', core.reps);
                                    requestAnimationFrame(() => scrollToNode(inputRefs.current[`straight-${core.id}-reps`]));
                                  }}
                                />
                                <TextInput
                                  style={styles.logInput}
                                  placeholder="RPE"
                                  placeholderTextColor="#64748b"
                                  keyboardType="numeric"
                                  value={straightInputs[core.id]?.rpe ?? ''}
                                  onChangeText={(txt) =>
                                    updateStraightInput(core.id, 'rpe', txt)
                                  }
                                  ref={registerRef(`straight-${core.id}-rpe`)}
                                  returnKeyType="done"
                                  onSubmitEditing={() => { Keyboard.dismiss(); logStraightSet(core.id); }}
                                  onFocus={() => requestAnimationFrame(() => scrollToNode(inputRefs.current[`straight-${core.id}-rpe`]))}
                                />
                                <TouchableOpacity
                                  style={styles.logButton}
                                  disabled={savingItemId === core.id}
                                  onPress={() => logStraightSet(core.id)}
                                >
                                  {savingItemId === core.id ? (
                                    <ActivityIndicator size="small" color="#020617" />
                                  ) : (
                                    <Text style={styles.logButtonText}>Save</Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                          ) : (
                            isCoachView ? null : (
                              <Text style={styles.logHint}>
                                Begin workout to log sets
                              </Text>
                            )
                          )
                        ) : (
                          isCoachView ? null : (
                            <Text style={styles.logHint}>
                              Locked until previous set is logged
                            </Text>
                          )
                        )}
                        </View>
                      );
                    })}

                    {canLog && logs.length > 0 && (
                      <TouchableOpacity
                        style={styles.undoButton}
                        disabled={savingItemId === core.id}
                        onPress={() => undoLastSet(core.id)}
                      >
                        {savingItemId === core.id ? (
                          <ActivityIndicator size="small" color="#fca5a5" />
                        ) : (
                          <Text style={styles.undoButtonText}>Undo last set</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* === Top set + its Backdowns in ONE card === */}
                {isTop && (
                  <View style={styles.setLogsBlock}>
                    {/* Top set row */}
                    <View style={styles.setLogLine}>
                      <Text style={styles.setLabel}>Top set</Text>
                      <Text style={styles.coreScheme}>
                        {core.sets || 0} × {core.reps || core.reps_text || '—'}
                        {core.mode === 'RPE' && core.rpe_target != null && (
                          <Text style={styles.coreSchemeDetail}>
                            {' '}@ RPE {core.rpe_target.toFixed(1)}
                          </Text>
                        )}
                        {core.mode === 'PCT' && core.pct != null && (
                          <Text style={styles.coreSchemeDetail}>
                            {' '}@ {(core.pct * 100).toFixed(1)}% TM
                          </Text>
                        )}
                      </Text>

                      {(() => {
                        const t = formatTargetRange(core.target_low_kg, core.target_high_kg, unit);
                        if (!t) return null;
                        return <Text style={styles.setTargetInline}>Target {t}</Text>;
                      })()}

                      {hasTopActual ? (
                        <Text style={styles.actualText}>
                          {formatWeight(topSetLog?.actual_weight_kg ?? core.actual_weight_kg, unit)} {unit}
                          {(topSetLog?.actual_reps ?? core.actual_reps) != null
                            ? ` × ${topSetLog?.actual_reps ?? core.actual_reps}`
                            : ''}
                          {(topSetLog?.actual_rpe ?? core.actual_rpe) != null
                            ? ` @ RPE ${(topSetLog?.actual_rpe ?? core.actual_rpe)!.toFixed(1)}`
                            : ''}
                        </Text>
                      ) : canLog ? (
                        <View style={styles.logRow}>
                          <TextInput
                            style={styles.logInput}
                            placeholder={unit}
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                            value={topInputs[core.id]?.weight ?? ''}
                            onChangeText={(txt) =>
                              updateTopInput(core.id, 'weight', txt)
                            }
                            ref={registerRef(`top-${core.id}-weight`)}
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={() => focusField(`top-${core.id}-reps`)}
                            onFocus={() => {
                              ensureCoreRepsPrefill(core.id, 'top', core.reps);
                              requestAnimationFrame(() => scrollToNode(inputRefs.current[`top-${core.id}-weight`]));
                            }}
                          />
                          <TextInput
                            style={styles.logInput}
                            placeholder="reps"
                            placeholderTextColor="#64748b"
                            keyboardType="number-pad"
                            value={topInputs[core.id]?.reps ?? ''}
                            onChangeText={(txt) =>
                              updateTopInput(core.id, 'reps', txt)
                            }
                            ref={registerRef(`top-${core.id}-reps`)}
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={() => focusField(`top-${core.id}-rpe`)}
                            onFocus={() => {
                              ensureCoreRepsPrefill(core.id, 'top', core.reps);
                              requestAnimationFrame(() => scrollToNode(inputRefs.current[`top-${core.id}-reps`]));
                            }}
                          />
                          <TextInput
                            style={styles.logInput}
                            placeholder="RPE"
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                            value={topInputs[core.id]?.rpe ?? ''}
                            onChangeText={(txt) =>
                              updateTopInput(core.id, 'rpe', txt)
                            }
                            ref={registerRef(`top-${core.id}-rpe`)}
                            returnKeyType="done"
                            onSubmitEditing={() => { Keyboard.dismiss(); logTopSet(core.id); }}
                            onFocus={() => requestAnimationFrame(() => scrollToNode(inputRefs.current[`top-${core.id}-rpe`]))}
                          />
                          <TouchableOpacity
                            style={styles.logButton}
                            disabled={savingItemId === core.id}
                            onPress={() => logTopSet(core.id)}
                          >
                            {savingItemId === core.id ? (
                              <ActivityIndicator size="small" color="#020617" />
                            ) : (
                              <Text style={styles.logButtonText}>Save</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        isCoachView ? null : (
                          <Text style={styles.logHint}>
                            Begin workout to log top set
                          </Text>
                        )
                      )}
                    </View>

                    {/* Undo top set button */}
                    {hasTopActual && canLog && (
                      <TouchableOpacity
                        style={styles.undoButton}
                        disabled={savingItemId === core.id}
                        onPress={() => clearTopSet(core.id)}
                      >
                        {savingItemId === core.id ? (
                          <ActivityIndicator size="small" color="#fca5a5" />
                        ) : (
                          <Text style={styles.undoButtonText}>Undo top set</Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Backdown(s) under the same card */}
                    {backdownsForThisTop.map((bd) => {
                      const bdLogs = bd.set_logs || [];
                      const bdTotal = bd.sets || 0;

                      return (
                        <View key={bd.id} style={styles.setLogLine}>
                          <Text style={styles.setLabel}>
                            Backdowns {bdLogs.length}/{bdTotal}
                          </Text>
                          <Text style={styles.coreScheme}>
                            {bd.sets || 0} × {bd.reps || bd.reps_text || '—'}
                            {bd.mode === 'RPE' && bd.rpe_target != null && (
                              <Text style={styles.coreSchemeDetail}>
                                {' '}@ RPE {bd.rpe_target.toFixed(1)}
                              </Text>
                            )}
                            {bd.mode === 'PCT' && bd.pct != null && (
                              <Text style={styles.coreSchemeDetail}>
                                {' '}@ {(bd.pct * 100).toFixed(1)}% TM
                              </Text>
                            )}
                          </Text>

                          {(() => {
                            const t = formatTargetRange(bd.target_low_kg, bd.target_high_kg, unit);
                            if (!t) return null;
                            return <Text style={styles.setTargetInline}>{t}</Text>;
                          })()}

                          {bdLogs.map((sl) => (
                            <Text key={sl.id} style={styles.actualText}>
                              Set {sl.set_index}:{' '}
                              {formatWeight(sl.actual_weight_kg, unit)} {unit}
                              {sl.actual_reps != null ? ` × ${sl.actual_reps}` : ''}
                              {sl.actual_rpe != null ? ` @ RPE ${sl.actual_rpe.toFixed(1)}` : ''}
                            </Text>
                          ))}

                          {canLog && hasTopActual && bdLogs.length < bdTotal ? (
                            <View style={styles.logRow}>
                              <TextInput
                                style={styles.logInput}
                                placeholder={unit}
                                placeholderTextColor="#64748b"
                                keyboardType="numeric"
                                value={bkInputs[bd.id]?.weight ?? ''}
                                onChangeText={(txt) =>
                                  updateBkInput(bd.id, 'weight', txt)
                                }
                                ref={registerRef(`bk-${bd.id}-weight`)}
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => focusField(`bk-${bd.id}-reps`)}
                                onFocus={() => {
                                  ensureCoreRepsPrefill(bd.id, 'bk', bd.reps);
                                  requestAnimationFrame(() => scrollToNode(inputRefs.current[`bk-${bd.id}-weight`]));
                                }}
                              />
                              <TextInput
                                style={styles.logInput}
                                placeholder="reps"
                                placeholderTextColor="#64748b"
                                keyboardType="number-pad"
                                value={bkInputs[bd.id]?.reps ?? ''}
                                onChangeText={(txt) =>
                                  updateBkInput(bd.id, 'reps', txt)
                                }
                                ref={registerRef(`bk-${bd.id}-reps`)}
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => focusField(`bk-${bd.id}-rpe`)}
                                onFocus={() => {
                                  ensureCoreRepsPrefill(bd.id, 'bk', bd.reps);
                                  requestAnimationFrame(() => scrollToNode(inputRefs.current[`bk-${bd.id}-reps`]));
                                }}
                              />
                              <TextInput
                                style={styles.logInput}
                                placeholder="RPE"
                                placeholderTextColor="#64748b"
                                keyboardType="numeric"
                                value={bkInputs[bd.id]?.rpe ?? ''}
                                onChangeText={(txt) =>
                                  updateBkInput(bd.id, 'rpe', txt)
                                }
                                ref={registerRef(`bk-${bd.id}-rpe`)}
                                returnKeyType="done"
                                onSubmitEditing={() => { Keyboard.dismiss(); logBackdownSet(bd.id); }}
                                onFocus={() => requestAnimationFrame(() => scrollToNode(inputRefs.current[`bk-${bd.id}-rpe`]))}
                              />
                              <TouchableOpacity
                                style={styles.logButton}
                                disabled={savingItemId === bd.id}
                                onPress={() => logBackdownSet(bd.id)}
                              >
                                {savingItemId === bd.id ? (
                                  <ActivityIndicator size="small" color="#020617" />
                                ) : (
                                  <Text style={styles.logButtonText}>Save</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          ) : !hasTopActual ? (
                            isCoachView ? null : (
                              <Text style={styles.logHint}>
                                Locked until top set is logged
                              </Text>
                            )
                          ) : (
                            bdLogs.length >= bdTotal && (
                              <Text style={styles.logHint}>
                                All backdown sets logged
                              </Text>
                            )
                          )}
                          {canLog && bdLogs.length > 0 && (
                            <TouchableOpacity
                              style={styles.undoButton}
                              disabled={savingItemId === bd.id}
                              onPress={() => undoLastSet(bd.id)}
                            >
                              {savingItemId === bd.id ? (
                                <ActivityIndicator size="small" color="#fca5a5" />
                              ) : (
                                <Text style={styles.undoButtonText}>Undo last set</Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* If you ever have orphan BK items w/ no parent, they’ll still render as their own card */}
                {isBackdown && !hasParent && (core.sets || 0) > 0 && (
                  <View style={styles.setLogsBlock}>
                    <View style={styles.setLogLine}>
                      <Text style={styles.setLabel}>
                        Backdown sets {logs.length}/{core.sets || 0}
                      </Text>

                      {(() => {
                        const t = formatTargetRange(core.target_low_kg, core.target_high_kg, unit);
                        if (!t) return null;
                        return <Text style={styles.setTargetInline}>{t}</Text>;
                      })()}

                      {logs.map((sl) => (
                        <Text key={sl.id} style={styles.actualText}>
                          Set {sl.set_index}:{' '}
                          {formatWeight(sl.actual_weight_kg, unit)} {unit}
                          {sl.actual_reps != null ? ` × ${sl.actual_reps}` : ''}
                          {sl.actual_rpe != null ? ` @ RPE ${sl.actual_rpe.toFixed(1)}` : ''}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Accessories, grouped like the Jinja acc_groups */}
        <View style={styles.sectionBlock}>
          {workout.accessory_groups.map((grp, idx) => {
            // ... keep the entire accessory rendering block exactly as-is ...
            const isSuperset = !!grp.group;

            if (isSuperset) {
              // Superset card with multiple rows inside
              return (
                <View key={grp.group || `ss-${idx}`} style={styles.supersetCard}>
                  <View style={styles.supersetHeader}>
                    <Text style={styles.supersetBadge}>
                      Superset {grp.group}
                    </Text>
                  </View>

                  {grp.items.map((it) => {
                    const logs = it.set_logs || [];
                    const totalSets = it.sets || 0;
                    const loggedCount = logs.length;
                    const nextIndex = loggedCount + 1;
                    const canLog = canLogFromServer && workout.status === 'in_progress';

                    return (
                      <View key={it.id} style={styles.supersetRow}>
                        <View style={styles.accHeadRow}>
                          <Text style={styles.accTitle}>
                            {it.movement || 'Accessory'}
                          </Text>

                          {canHotSwap && (
                            <TouchableOpacity
                              style={styles.swapPill}
                              onPress={() => openSwapAcc(it)}
                              disabled={savingItemId === it.id}
                            >
                              <Text style={styles.swapPillText}>Swap</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <Text style={styles.accMeta}>
                          {it.sets || 0} × {it.reps_text || it.reps || '—'}
                          {it.rir_target != null && (
                            <Text style={styles.accRir}>
                              {' '}
                              • RIR {it.rir_target.toFixed(1)}
                            </Text>
                          )}
                        </Text>
                        {(() => {
                          const best = getLookbackBest(it);
                          const line = formatLookbackLine(best, unit);
                          if (!line) return null;
                          return <Text style={styles.lookbackText}>{line}</Text>;
                        })()}

                        <View style={styles.setLogsBlock}>
                          {Array.from({ length: totalSets }).map((_, idx) => {
                            const setNumber = idx + 1;
                            const existing = logs.find(
                              (sl) => sl.set_index === setNumber,
                            );
                            const isNext = !existing && setNumber === nextIndex;

                            return (
                              <View key={setNumber} style={styles.setLogLine}>
                                {existing || (isNext && canLog && !isCoachView) ? (
                                  <Text style={styles.setLabel}>Set {setNumber}</Text>
                                ) : null}

                                {existing ? (
                                  <Text style={styles.actualText}>
                                    {formatWeight(existing.actual_weight_kg, unit)} {unit} ×{' '}
                                    {existing.actual_reps ?? '?'}
                                    {existing.actual_rir != null &&
                                      ` (RIR ${existing.actual_rir})`}
                                  </Text>
                                ) : isNext && canLog ? (
                                  <View style={styles.logRow}>
                                    <TextInput
                                      style={styles.logInput}
                                      placeholder={unit}
                                      placeholderTextColor="#64748b"
                                      keyboardType="numeric"
                                      value={accInputs[it.id]?.weight ?? ''}
                                      onChangeText={(txt) =>
                                        updateAccInput(it.id, 'weight', txt)
                                      }
                                      ref={registerRef(`acc-${it.id}-weight`)}
                                      returnKeyType="next"
                                      blurOnSubmit={false}
                                      onSubmitEditing={() => focusField(`acc-${it.id}-reps`)}
                                      onFocus={() =>
                                        requestAnimationFrame(() =>
                                          scrollToNode(inputRefs.current[`acc-${it.id}-weight`])
                                        )
                                      }
                                    />
                                    <TextInput
                                      style={styles.logInput}
                                      placeholder="reps"
                                      placeholderTextColor="#64748b"
                                      keyboardType="number-pad"
                                      value={accInputs[it.id]?.reps ?? ''}
                                      onChangeText={(txt) =>
                                        updateAccInput(it.id, 'reps', txt)
                                      }
                                      ref={registerRef(`acc-${it.id}-reps`)}
                                      returnKeyType="next"
                                      blurOnSubmit={false}
                                      onSubmitEditing={() => focusField(`acc-${it.id}-rir`)}
                                      onFocus={() =>
                                        requestAnimationFrame(() =>
                                          scrollToNode(inputRefs.current[`acc-${it.id}-reps`])
                                        )
                                      }
                                    />
                                    <TextInput
                                      style={styles.logInput}
                                      placeholder="RIR"
                                      placeholderTextColor="#64748b"
                                      keyboardType="numeric"
                                      value={accInputs[it.id]?.rir ?? ''}
                                      onChangeText={(txt) =>
                                        updateAccInput(it.id, 'rir', txt)
                                      }
                                      ref={registerRef(`acc-${it.id}-rir`)}
                                      returnKeyType="done"
                                      onSubmitEditing={() => {
                                        Keyboard.dismiss();
                                        handleAccessorySave(it.id);
                                      }}
                                      onFocus={() =>
                                        requestAnimationFrame(() =>
                                          scrollToNode(inputRefs.current[`acc-${it.id}-rir`])
                                        )
                                      }
                                    />
                                    <TouchableOpacity
                                      style={styles.logButton}
                                      disabled={savingItemId === it.id}
                                      onPress={() => handleAccessorySave(it.id)}
                                    >
                                      {savingItemId === it.id ? (
                                        <ActivityIndicator
                                          size="small"
                                          color="#020617"
                                        />
                                      ) : (
                                        <Text style={styles.logButtonText}>Save</Text>
                                      )}
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  isCoachView ? null : null
                                )}
                              </View>
                            );
                          })}

                          {canLog && logs.length > 0 && (
                            <TouchableOpacity
                              style={styles.undoButton}
                              disabled={savingItemId === it.id}
                              onPress={() => undoLastSet(it.id)}
                            >
                              {savingItemId === it.id ? (
                                <ActivityIndicator size="small" color="#fca5a5" />
                              ) : (
                                <Text style={styles.undoButtonText}>Undo last set</Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            }

            // Ungrouped accessories – individual cards
            return grp.items.map((it) => {
              const logs = it.set_logs || [];
              const totalSets = it.sets || 0;
              const loggedCount = logs.length;
              const nextIndex = loggedCount + 1;
              const canLog = canLogFromServer && workout.status === 'in_progress';

              return (
                <View key={it.id} style={styles.accCard}>
                  <View style={styles.accHeadRow}>
                    <Text style={styles.accTitle}>
                      {it.movement || 'Accessory'}
                    </Text>

                    {canHotSwap && (
                      <TouchableOpacity
                        style={styles.swapPill}
                        onPress={() => openSwapAcc(it)}
                        disabled={savingItemId === it.id}
                      >
                        <Text style={styles.swapPillText}>Swap</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.accMeta}>
                    {it.sets || 0} × {it.reps_text || it.reps || '—'}
                    {it.rir_target != null && (
                      <Text style={styles.accRir}>
                        {' '}
                        • RIR {it.rir_target.toFixed(1)}
                      </Text>
                    )}
                  </Text>
                  {(() => {
                    const best = getLookbackBest(it);
                    const line = formatLookbackLine(best, unit);
                    if (!line) return null;
                    return <Text style={styles.lookbackText}>{line}</Text>;
                  })()}

                  <View style={styles.setLogsBlock}>
                    {Array.from({ length: totalSets }).map((_, idx) => {
                      const setNumber = idx + 1;
                      const existing = logs.find(
                        (sl) => sl.set_index === setNumber,
                      );
                      const isNext = !existing && setNumber === nextIndex;

                      return (
                        <View key={setNumber} style={styles.setLogLine}>
                          {existing || (isNext && canLog && !isCoachView) ? (
                            <Text style={styles.setLabel}>Set {setNumber}</Text>
                          ) : null}

                          {existing ? (
                            <Text style={styles.actualText}>
                              {formatWeight(existing.actual_weight_kg, unit)} {unit} ×{' '}
                              {existing.actual_reps ?? '?'}
                              {existing.actual_rir != null &&
                                ` (RIR ${existing.actual_rir})`}
                            </Text>
                          ) : isNext && canLog ? (
                            <View style={styles.logRow}>
                              <TextInput
                                style={styles.logInput}
                                placeholder={unit}
                                placeholderTextColor="#64748b"
                                keyboardType="numeric"
                                value={accInputs[it.id]?.weight ?? ''}
                                onChangeText={(txt) =>
                                  updateAccInput(it.id, 'weight', txt)
                                }
                                ref={registerRef(`acc-${it.id}-weight`)}
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => focusField(`acc-${it.id}-reps`)}
                                onFocus={() =>
                                  requestAnimationFrame(() =>
                                    scrollToNode(inputRefs.current[`acc-${it.id}-weight`])
                                  )
                                }
                              />
                              <TextInput
                                style={styles.logInput}
                                placeholder="reps"
                                placeholderTextColor="#64748b"
                                keyboardType="number-pad"
                                value={accInputs[it.id]?.reps ?? ''}
                                onChangeText={(txt) =>
                                  updateAccInput(it.id, 'reps', txt)
                                }
                                ref={registerRef(`acc-${it.id}-reps`)}
                                returnKeyType="next"
                                blurOnSubmit={false}
                                onSubmitEditing={() => focusField(`acc-${it.id}-rir`)}
                                onFocus={() =>
                                  requestAnimationFrame(() =>
                                    scrollToNode(inputRefs.current[`acc-${it.id}-reps`])
                                  )
                                }
                              />
                              <TextInput
                                style={styles.logInput}
                                placeholder="RIR"
                                placeholderTextColor="#64748b"
                                keyboardType="numeric"
                                value={accInputs[it.id]?.rir ?? ''}
                                onChangeText={(txt) =>
                                  updateAccInput(it.id, 'rir', txt)
                                }
                                ref={registerRef(`acc-${it.id}-rir`)}
                                returnKeyType="done"
                                onSubmitEditing={() => {
                                  Keyboard.dismiss();
                                  handleAccessorySave(it.id);
                                }}
                                onFocus={() =>
                                  requestAnimationFrame(() =>
                                    scrollToNode(inputRefs.current[`acc-${it.id}-rir`])
                                  )
                                }
                              />
                              <TouchableOpacity
                                style={styles.logButton}
                                disabled={savingItemId === it.id}
                                onPress={() => handleAccessorySave(it.id)}
                              >
                                {savingItemId === it.id ? (
                                  <ActivityIndicator
                                    size="small"
                                    color="#020617"
                                  />
                                ) : (
                                  <Text style={styles.logButtonText}>Save</Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          ) : (
                            isCoachView ? null : null
                          )}
                        </View>
                      );
                    })}

                    {canLog && logs.length > 0 && (
                      <TouchableOpacity
                        style={styles.undoButton}
                        disabled={savingItemId === it.id}
                        onPress={() => undoLastSet(it.id)}
                      >
                        {savingItemId === it.id ? (
                          <ActivityIndicator size="small" color="#fca5a5" />
                        ) : (
                          <Text style={styles.undoButtonText}>Undo last set</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            });
          })}
        </View>
        {/* Bottom-of-page actions: Complete / Cancel */}
        {canCompleteOrCancel && (
            <View style={[styles.actionBar, { marginTop: 16, marginBottom: 24 }]}>
              {workout.status === 'in_progress' && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionPrimary,
                    actionLoading === 'complete' && { opacity: 0.7 },
                  ]}
                  onPress={completeWorkout}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'complete' ? (
                    <ActivityIndicator size="small" color="#020617" />
                  ) : (
                    <Text
                      style={[
                        styles.actionButtonText,
                        styles.actionPrimaryText,
                      ]}
                    >
                      Complete Workout
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  workout.status === 'completed'
                    ? styles.actionPrimary // identical to Begin Workout
                    : styles.actionDanger,
                  actionLoading === 'cancel' && { opacity: 0.7 },
                ]}
                onPress={() => setCancelConfirmVisible(true)}
                disabled={!!actionLoading}
              >
                {actionLoading === 'cancel' ? (
                  <ActivityIndicator size="small" color="#fca5a5" />
                ) : (
                  <Text
                    style={[
                      styles.actionButtonText,
                      workout.status === 'completed' && styles.actionPrimaryText,
                    ]}
                  >
                    {workout.status === 'completed' ? 'Resume Workout' : 'Cancel Workout'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
      </ScrollView>

      {/* Cancel / Resume confirmation modal */}
      <Modal
        visible={cancelConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelConfirmVisible(false)}
      >
        <View style={styles.timerOverlay}>
          <View style={styles.timerPicker}>
            <Text style={styles.timerPickerTitle}>
              {workout.status === 'completed'
                ? 'Resume this workout?'
                : 'Cancel this workout?'}
            </Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.timerButton, { borderColor: '#38bdf8' }]}
                onPress={async () => {
                  setCancelConfirmVisible(false);
                  if (workout.status === 'completed') {
                    beginWorkout();
                  } else {
                    cancelWorkout();
                  }
                }}
              >
                <Text style={styles.timerButtonText}>
                  {workout.status === 'completed' ? 'Resume' : 'Yes, Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timerButton, { borderColor: '#fca5a5' }]}
                onPress={() => setCancelConfirmVisible(false)}
              >
                <Text style={styles.timerButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Shared rest timer picker (popup modal) */}
      <Modal
        visible={timerPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimerPickerVisible(false)}
      >
        <View style={styles.timerOverlay}>
          <View style={styles.timerPicker}>
            <Text style={styles.timerPickerTitle}>Select rest duration</Text>
            <View style={styles.timerOptionsGrid}>
              {TIMER_OPTIONS.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={styles.timerOptionButton}
                  onPress={() => handleTimerSelect(sec)}
                >
                  <Text style={styles.timerOptionText}>
                    {sec >= 60 ? `${sec / 60} min` : `${sec}s`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.timerButton, styles.timerPickerCancel]}
              onPress={() => setTimerPickerVisible(false)}
            >
              <Text style={styles.timerButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Readiness survey modal (mobile only, shown on Begin Workout) */}
      <Modal
        visible={readinessVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!readinessSubmitting) setReadinessVisible(false);
        }}
      >
        <View style={styles.timerOverlay}>
          <View style={styles.readinessModal}>
            <Text style={styles.timerPickerTitle}>Quick readiness check</Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
              Tap values and hit Submit (or Skip).
            </Text>

            {/* Sleep */}
            <Text style={{ color: '#e5e7eb', fontWeight: '700', marginBottom: 6 }}>
              Sleep quality (1–5)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`sleep-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, sleep_quality: n }))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: n === readinessForm.sleep_quality ? '#38bdf8' : 'rgba(148,163,184,0.5)',
                    backgroundColor: n === readinessForm.sleep_quality ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.08)',
                  }}
                >
                  <Text style={{ color: '#e5e7eb', fontWeight: '800' }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Fatigue */}
            <Text style={{ color: '#e5e7eb', fontWeight: '700', marginTop: 12, marginBottom: 6 }}>
              Fatigue (1–5)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`fatigue-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, fatigue: n }))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: n === readinessForm.fatigue ? '#38bdf8' : 'rgba(148,163,184,0.5)',
                    backgroundColor: n === readinessForm.fatigue ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.08)',
                  }}
                >
                  <Text style={{ color: '#e5e7eb', fontWeight: '800' }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Soreness */}
            <Text style={{ color: '#e5e7eb', fontWeight: '700', marginTop: 12, marginBottom: 6 }}>
              Soreness (1–5)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`sore-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, soreness: n }))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: n === readinessForm.soreness ? '#38bdf8' : 'rgba(148,163,184,0.5)',
                    backgroundColor: n === readinessForm.soreness ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.08)',
                  }}
                >
                  <Text style={{ color: '#e5e7eb', fontWeight: '800' }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stress */}
            <Text style={{ color: '#e5e7eb', fontWeight: '700', marginTop: 12, marginBottom: 6 }}>
              Stress (1–5)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`stress-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, stress: n }))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: n === readinessForm.stress ? '#38bdf8' : 'rgba(148,163,184,0.5)',
                    backgroundColor: n === readinessForm.stress ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.08)',
                  }}
                >
                  <Text style={{ color: '#e5e7eb', fontWeight: '800' }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.timerButton, { borderColor: 'rgba(148,163,184,0.6)' }]}
                onPress={() => submitReadinessAndBegin({ skipped: true })}
                disabled={readinessSubmitting}
              >
                {readinessSubmitting ? (
                  <ActivityIndicator size="small" color="#e5e7eb" />
                ) : (
                  <Text style={styles.timerButtonText}>Skip</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timerButton, { borderColor: '#38bdf8', backgroundColor: '#38bdf8' }]}
                onPress={() => submitReadinessAndBegin({ skipped: false })}
                disabled={readinessSubmitting}
              >
                {readinessSubmitting ? (
                  <ActivityIndicator size="small" color="#020617" />
                ) : (
                  <Text style={[styles.timerButtonText, { color: '#020617' }]}>Submit</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timerButton, { borderColor: 'rgba(248,113,113,0.8)', backgroundColor: 'rgba(127,29,29,0.7)' }]}
                onPress={() => {
                  if (!readinessSubmitting) {
                    setReadinessVisible(false);
                    setPendingBeginWorkoutId(null);
                  }
                }}
                disabled={readinessSubmitting}
              >
                <Text style={styles.timerButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Accessory hot-swap modal (self-coached only) */}
      <Modal
        visible={swapAccVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwapAccVisible(false)}
      >
        <View style={styles.timerOverlay}>
          <View style={[styles.timerPicker, styles.swapModalWide]}>
            <Text style={styles.timerPickerTitle}>Swap accessory</Text>

            <TextInput
              style={styles.swapInput}
              placeholder="Movement (e.g., Lat Pulldown)"
              placeholderTextColor="#64748b"
              value={swapAccForm.movement}
              onChangeText={(t) => setSwapAccForm((p) => ({ ...p, movement: t }))}
            />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.swapInput, { flex: 1 }]}
                placeholder="Sets"
                placeholderTextColor="#64748b"
                keyboardType="number-pad"
                value={swapAccForm.sets}
                onChangeText={(t) =>
                  setSwapAccForm((p) => ({ ...p, sets: (t ?? '').replace(/[^0-9]/g, '') }))
                }
              />
              <TextInput
                style={[styles.swapInput, { flex: 1 }]}
                placeholder="Reps (text)"
                placeholderTextColor="#64748b"
                value={swapAccForm.reps_text}
                onChangeText={(t) => setSwapAccForm((p) => ({ ...p, reps_text: t }))}
              />
              <TextInput
                style={[styles.swapInput, { flex: 1 }]}
                placeholder="RIR"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={swapAccForm.rir}
                onChangeText={(t) => setSwapAccForm((p) => ({ ...p, rir: t }))}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.timerButton, { borderColor: '#38bdf8' }]}
                onPress={saveSwapAcc}
                disabled={savingItemId != null}
              >
                {savingItemId === swapAccItem?.id ? (
                  <ActivityIndicator size="small" color="#e5e7eb" />
                ) : (
                  <Text style={styles.timerButtonText}>Save</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.timerButton, { borderColor: 'rgba(148,163,184,0.6)' }]}
                onPress={() => setSwapAccVisible(false)}
              >
                <Text style={styles.timerButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  timerBarWrapper: {
    paddingHorizontal: 16,
    backgroundColor: '#020617',
  },
  container: {
    flex: 1,
    backgroundColor: '#020617', // near-black (matches app)
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
  },

  muted: {
    color: '#94a3b8',
    marginTop: 4,
    fontSize: 14,
  },

  errorText: {
    color: '#f87171',
    textAlign: 'center',
    paddingHorizontal: 24,
    fontSize: 15,
  },

  // --- header row (label · name · date + status badge) ---
  summaryRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
  },

  summaryLine: {
    marginTop: 4,
    fontSize: 14,
  },

  summaryStrong: {
    color: '#e5e7eb',
    fontWeight: '600',
  },

  summarySeparator: {
    color: '#64748b',
  },

  summaryText: {
    color: '#94a3b8',
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // --- section blocks ---
  sectionBlock: {
    marginTop: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 10,
  },

  // --- core cards ---
  coreCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: '#020617',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },

  coreHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  coreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f9fafb',
    flexShrink: 1,
  },

  variantPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#0f172a',
  },

  variantText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  coreScheme: {
    fontSize: 14,
    color: '#cbd5e1',
    marginTop: 2,
  },

  coreSchemeDetail: {
    color: '#a5b4fc',
  },

  coreTarget: {
    fontSize: 13,
    color: '#38bdf8',
    marginTop: 4,
  },

  actualText: {
    fontSize: 13,
    color: '#4ade80',
    marginTop: 4,
  },

  notesText: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // --- accessories ---
  supersetCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    backgroundColor: '#020617',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },

  supersetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  supersetBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#bfdbfe',
    backgroundColor: 'rgba(37,99,235,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },

  supersetRow: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.2)',
  },

  accCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: '#020617',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },

  accHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  swapPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.7)',
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  swapPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  swapInput: {
    borderWidth: 1,
    borderColor: '#1f2933',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f9fafb',
    fontSize: 14,
    backgroundColor: '#020617',
    marginBottom: 8,
  },

  accTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
  },

  accMeta: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },

  accRir: {
    color: '#facc15',
  },

  lookbackText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
  },

  setLogsBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.3)',
    paddingTop: 8,
  },
  setLogLine: {
    marginBottom: 8,
  },
  setLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 2,
  },
  setTargetInline: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  logInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1f2933',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#f9fafb',
    fontSize: 14,
    backgroundColor: '#020617',
  },
  logButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#020617',
  },
  logHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  undoButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.9)',
    backgroundColor: 'transparent',
  },
  undoButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fca5a5',
  },
    actionBar: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  actionDanger: {
    backgroundColor: 'rgba(127,29,29,0.85)',
    borderColor: 'rgba(248,113,113,0.9)',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  actionPrimaryText: {
    color: '#020617',
  },
    unitToggleRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  // --- new styles for inline top bar ---
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
  },
  unitToggleRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerLabelInline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
    minWidth: 44,
    textAlign: 'right',
  },
  unitTogglePill: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
    overflow: 'hidden',
  },
  unitToggleOption: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  unitToggleOptionActive: {
    backgroundColor: '#38bdf8',
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  unitToggleTextActive: {
    color: '#020617',
  },
  timerBar: {
    marginTop: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timerLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  timerButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  timerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
    backgroundColor: '#0f172a',
  },
  timerStopButton: {
    borderColor: 'rgba(248,113,113,0.9)',
    backgroundColor: 'rgba(127,29,29,0.9)',
  },
  timerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  timerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  timerPicker: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    backgroundColor: '#020617',
  },
  timerPickerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  timerOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timerOptionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
    backgroundColor: '#0f172a',
  },
  timerOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e5e7eb',
  },
  timerPickerCancel: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
    pinnedTopBar: {
    backgroundColor: '#020617',
    zIndex: 10,
  },
  errorBanner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.7)',
    backgroundColor: 'rgba(127,29,29,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  errorBannerText: {
    flex: 1,
    color: '#fecaca',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBannerClose: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.6)',
    backgroundColor: 'rgba(127,29,29,0.6)',
  },
  errorBannerCloseText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '800',
  },
  swapModalWide: {
    width: '92%',
    maxWidth: 520,
  },
  actionSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.55)',
    backgroundColor: 'rgba(148,163,184,0.10)',
  },
  actionSecondaryText: {
    color: '#e5e7eb',
  },
  readinessModal: {
    width: '80%',
    maxWidth: 420,
    backgroundColor: '#020617',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    alignItems: 'center',
  },
  readinessHelp: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 10,
  },
  readinessRow: {
    marginTop: 10,
  },
  readinessLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 6,
  },
  readinessPills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  readinessPill: {
    width: 36,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.10)',
  },
  readinessPillActive: {
    borderColor: '#38bdf8',
    backgroundColor: '#38bdf8',
  },
  readinessPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#e5e7eb',
  },
  readinessPillTextActive: {
    color: '#020617',
  },
});
