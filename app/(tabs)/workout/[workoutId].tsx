// app/(tabs)/workout/[workoutId].tsx
// @ts-nocheck

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  findNodeHandle,
  UIManager,
} from 'react-native';
let Notifications: any = null;
if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
}
import { useLocalSearchParams, useRouter } from 'expo-router';
import RefreshScreen from '@/components/refresh-screen';
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

type PlannedSet = {
  set_index: number;
  reps: number | null;
  rpe_target: number | null;
  pct: number | null;
  manual_target_kg: number | null;
  manual_pm_kg: number | null;
  suggested_low_kg?: number | null;
  suggested_high_kg?: number | null;
};

type WorkoutItem = {
  id: number;
  lift: string;
  designation?: string | null;
  variant: string; // "TOP" | "BK" | "STRAIGHT" | "ACC"
  scheme?: string | null;
  planned_sets?: PlannedSet[];
  movement: string | null;
  original_movement?: string | null;
  is_substituted?: boolean;
  selected_sub_movement?: string | null;
  approved_subs?: string[];
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




const KG_PER_LB = 0.45359237; // 1 lb = 0.45359 kg

function formatWeight(
  kg: number | null | undefined,
  unit: 'kg' | 'lb'
): string {
  if (kg == null) return '?';

  if (unit === 'kg') {
    const snapped = Math.round(Number(kg) * 4) / 4;
    if (!Number.isFinite(snapped)) return '?';
    return snapped.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  // Convert kg → lb
  const lbs = kg / KG_PER_LB;
  const rounded = roundToNearestGymIncrementLb(lbs);
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

function formatTargetRange(
  lowKg: number | null | undefined,
  highKg: number | null | undefined,
  unit: 'kg' | 'lb'
): string | null {
  if (lowKg == null || highKg == null) return null;
  if (lowKg === 0 && highKg === 0) return null;

  const snapKg = (v: number | null | undefined) => {
    if (v == null) return null;
    const snapped = Math.round(Number(v) * 4) / 4;
    return Number.isFinite(snapped) ? snapped : null;
  };

  const formatTargetWeight = (kg: number | null | undefined) => {
    if (kg == null) return '?';

    if (unit === 'kg') {
      const snapped = snapKg(kg);
      if (snapped == null) return '?';
      return snapped.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    }

    const lbs = Number(kg) / KG_PER_LB;
    const rounded = Math.round(lbs / 2.5) * 2.5;
    return rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };

  const low = snapKg(lowKg);
  const high = snapKg(highKg);
  if (low == null || high == null) return null;

  if (low === high) {
    return `${formatTargetWeight(low)} ${unit}`;
  }

  return `${formatTargetWeight(low)}–${formatTargetWeight(high)} ${unit}`;
}

function computeManualRangeKg(ps: PlannedSet): { lowKg: number | null; highKg: number | null } {
  const mid = ps.manual_target_kg;
  const pm = ps.manual_pm_kg;

  if (mid == null) return { lowKg: null, highKg: null };

  const plusMinus = pm != null ? Number(pm) : 0;
  if (!Number.isFinite(plusMinus) || plusMinus <= 0) {
    return { lowKg: mid, highKg: mid };
  }
  return { lowKg: mid - plusMinus, highKg: mid + plusMinus };
}

function formatPlannedWeightLine(ps: PlannedSet, unit: 'kg' | 'lb') {
  const manual = computeManualRangeKg(ps);
  const primary =
    manual.lowKg != null && manual.highKg != null
      ? formatTargetRange(manual.lowKg, manual.highKg, unit)
      : null;

  const suggested = formatTargetRange(ps.suggested_low_kg ?? null, ps.suggested_high_kg ?? null, unit);
  return { primary, suggested };
}

function formatPlannedSchemeLine(ps: PlannedSet, mode: string | null): string {
  const m = (mode || 'RPE').toUpperCase();
  const reps = ps.reps != null ? String(ps.reps) : '—';

  if (m === 'PCT') {
    const pct = ps.pct;
    if (pct == null) return `${reps} Reps`;
    const p = pct > 1 ? pct : pct * 100;
    return `${reps} Reps @ ${p.toFixed(1)}%`;
  }

  if (ps.rpe_target == null) return `${reps} Reps`;

  return `${reps} Reps @ ${Number(ps.rpe_target).toFixed(1)}`;
}

function roundToNearest5(x: number): number {
  return Math.round(x / 5) * 5;
}

function roundToNearestGymIncrementLb(x: number): number {
  return Math.round(x / 2.5) * 2.5;
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


function titleCaseWord(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDesignation(des: any): string {
  const d = String(des || '').trim();
  if (!d) return '';
  return titleCaseWord(d);
}

function liftDisplayName(core: WorkoutItem): string {
  const v = String(core.variant || '').toUpperCase();

  // Core Variant / VR title
  if ((v === 'VR' || core.lift === 'VR') && core.movement) {
    const des = formatDesignation((core as any).designation);
    return des ? `${core.movement} (${des})` : core.movement;
  }

  let base = '';
  if (core.lift === 'SQ') base = 'Comp Squat';
  else if (core.lift === 'BN') base = 'Comp Bench';
  else if (core.lift === 'DL') base = 'Comp Deadlift';
  else base = core.movement || core.lift;

  const isNormalLift =
    core.lift === 'SQ' || core.lift === 'BN' || core.lift === 'DL' || core.lift === 'OHP';
  const isNormalVariant =
    v === 'TOP' || v === 'STRAIGHT' || v === 'FULL_CUSTOM';

  const des = formatDesignation((core as any).designation);
  if (des && isNormalLift && isNormalVariant) {
    return `${base} (${des})`;
  }

  return base;
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
  const [fcInputs, setFcInputs] = useState<
    Record<string, { weight: string; reps: string; rpe: string }>
  >({});

  const updateFcInput = (
    key: string,
    field: 'weight' | 'reps' | 'rpe',
    value: string,
  ) => {
    let v = value ?? '';

    if (field === 'reps') {
      v = v.replace(/[^0-9]/g, '');
    } else {
      v = v.replace(/[^0-9.]/g, '');
      const d = v.indexOf('.');
      if (d !== -1) v = v.slice(0, d + 1) + v.slice(d + 1).replace(/\./g, '');
    }

    setFcInputs((prev) => ({
      ...prev,
      [key]: {
        weight: prev[key]?.weight || '',
        reps: prev[key]?.reps || '',
        rpe: prev[key]?.rpe || '',
        [field]: v,
      },
    }));
  };

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

  const scrollRef = useRef<any>(null);
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
  const dataRef = useRef<WorkoutPayload | null>(null);

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
  const notifHandlerSetRef = useRef(false);
  const ensureNotifPerms = async () => {
    if (!Notifications) return false;
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
    if (!Notifications) return;
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
    if (!Notifications) return;
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
  const [timerPickerValue, setTimerPickerValue] = useState(120);
  const timerWheelRef = useRef<ScrollView | null>(null);
  const [cancelConfirmVisible, setCancelConfirmVisible] = useState(false);

  const [postSessionVisible, setPostSessionVisible] = useState(false);
  const [postSessionSubmitting, setPostSessionSubmitting] = useState(false);
  const [postSessionForm, setPostSessionForm] = useState({
    sessionRpe: null as number | null,
    strengthFeeling: '' as '' | 'much_weaker' | 'slightly_weaker' | 'normal' | 'slightly_stronger' | 'much_stronger',
    fatigueFeeling: '' as '' | 'very_fresh' | 'slightly_fatigued' | 'moderately_fatigued' | 'very_fatigued',
    note: '',
  });

  const [editSetVisible, setEditSetVisible] = useState(false);
  const [editSetSubmitting, setEditSetSubmitting] = useState(false);
  const [editSetCtx, setEditSetCtx] = useState<{
    itemId: number;
    setIndex: number;
    setLogId: number;
    canUndoDelete: boolean;
    mode: 'rpe' | 'rir';
    title: string;
  } | null>(null);

  const [editSetForm, setEditSetForm] = useState({
    weight: '',
    reps: '',
    rpe: '',
    rir: '',
  });

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
      movement: it.selected_sub_movement || it.movement || it.original_movement || '',
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

  const openEditSet = (
    itemId: number,
    setLog: SetLog,
    opts: { mode: 'rpe' | 'rir'; title: string; canUndoDelete?: boolean }
  ) => {
    const weightVal =
      setLog.actual_weight_kg != null
        ? unit === 'kg'
          ? formatWeight(setLog.actual_weight_kg, 'kg')
          : String(roundToNearestGymIncrementLb(setLog.actual_weight_kg / KG_PER_LB))
        : '';

    setEditSetCtx({
      itemId,
      setIndex: setLog.set_index,
      setLogId: setLog.id,
      canUndoDelete: !!opts.canUndoDelete,
      mode: opts.mode,
      title: opts.title,
    });

    setEditSetForm({
      weight: weightVal,
      reps: setLog.actual_reps != null ? String(setLog.actual_reps) : '',
      rpe: setLog.actual_rpe != null ? String(setLog.actual_rpe) : '',
      rir: setLog.actual_rir != null ? String(setLog.actual_rir) : '',
    });

    setEditSetVisible(true);
  };

  const saveEditedSet = async () => {
    if (!workoutId || !editSetCtx) return;

    let weightInUnit =
      editSetForm.weight.trim() === '' ? NaN : parseFloat(editSetForm.weight);

    const repsStr = String(editSetForm.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;

    if (Number.isNaN(weightInUnit) || weightInUnit <= 0) {
      setError('Weight required');
      return;
    }
    if (!Number.isFinite(reps) || reps <= 0) {
      setError('Reps required');
      return;
    }

    if (unit === 'lb') {
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
    }

    const weightKg = unit === 'kg' ? weightInUnit : weightInUnit * KG_PER_LB;

    let actual_rpe: number | null = null;
    let actual_rir: number | null = null;

    if (editSetCtx.mode === 'rpe') {
      actual_rpe =
        editSetForm.rpe.trim() === '' ? null : parseFloat(editSetForm.rpe);
      if (editSetForm.rpe.trim() !== '' && !Number.isFinite(actual_rpe as number)) {
        setError('Enter a valid RPE');
        return;
      }
    } else {
      actual_rir =
        editSetForm.rir.trim() === '' ? null : parseFloat(editSetForm.rir);
      if (editSetForm.rir.trim() !== '' && !Number.isFinite(actual_rir as number)) {
        setError('Enter a valid RIR');
        return;
      }
    }

    try {
      setEditSetSubmitting(true);
      setSavingItemId(editSetCtx.itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${editSetCtx.itemId}/edit_set`,
        {
          method: 'POST',
          auth: true,
          body: {
            set_index: editSetCtx.setIndex,
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe,
            actual_rir,
          },
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to update set (HTTP ${status})`);
      }

      setEditSetVisible(false);
      setEditSetCtx(null);
      rememberScroll();
      await fetchWorkout();
    } catch (err: any) {
      console.log('saveEditedSet error', err);
      setError(err?.message || 'Error updating set');
    } finally {
      setEditSetSubmitting(false);
      setSavingItemId(null);
    }
  };

  const deleteEditedSet = async () => {
    if (!workoutId || !editSetCtx?.setLogId) return;

    try {
      setEditSetSubmitting(true);
      setSavingItemId(editSetCtx.itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/${workoutId}/setlogs/${editSetCtx.setLogId}`,
        {
          method: 'DELETE',
          auth: true,
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to delete set (HTTP ${status})`);
      }

      setEditSetVisible(false);
      setEditSetCtx(null);

      rememberScroll();
      await fetchWorkout();
    } catch (err: any) {
      console.log('deleteEditedSet error', err);
      setError(err?.message || 'Error deleting set');
    } finally {
      setEditSetSubmitting(false);
      setSavingItemId(null);
    }
  };

  const TIMER_OPTIONS = [30, 60, 90, 120, 180, 240, 300];

  const openTimerPicker = () => {
    const clamped = Math.max(30, Math.min(300, Math.round((restSeconds || 120) / 30) * 30));
    setTimerPickerValue(clamped);
    setTimerPickerVisible(true);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const idx = Math.max(0, Math.min(9, Math.round(clamped / 30) - 1));
        timerWheelRef.current?.scrollTo({
          y: idx * 52,
          animated: false,
        });
      });
    });
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

    const fcItems = coreItems.filter(
      (it) => it && (it.variant === 'FULL_CUSTOM' || String(it.scheme || '').toUpperCase() === 'FULL_CUSTOM')
    );

    if (fcItems.length) {
      setFcInputs((prev) => {
        let next = prev;
        for (const it of fcItems) {
          const planned = Array.isArray(it.planned_sets) ? it.planned_sets : [];
          for (const ps of planned) {
            const k = `${it.id}:${ps?.set_index}`;
            if (!ps?.set_index) continue;
            const cur = prev[k];
            if (cur && String(cur.reps || '').trim() !== '') continue;
            if (next === prev) next = { ...prev };
            next[k] = {
              weight: cur?.weight || '',
              reps: ps?.reps != null ? String(ps.reps) : (cur?.reps || ''),
              rpe: cur?.rpe || '',
            };
          }
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
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
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
            ? String(roundToNearestGymIncrementLb(weightInUnit))
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
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
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
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
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
            ? String(roundToNearestGymIncrementLb(weightInUnit))
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

  const logFullCustomSet = async (itemId: number, setIndex: number) => {
    if (!workoutId || !data) return;

    const key = `${itemId}:${setIndex}`;
    const input = fcInputs[key] || { weight: '', reps: '', rpe: '' };

    let weightInUnit = input.weight.trim() === '' ? 0 : parseFloat(input.weight);
    const repsStr = String(input.reps ?? '').replace(/[^0-9]/g, '');
    const reps = repsStr ? Number(repsStr) : NaN;
    const rpe = input.rpe ? parseFloat(input.rpe) : null;

    if (Number.isNaN(weightInUnit)) return setError(`Enter a valid weight (${unit})`);
    if (weightInUnit <= 0) return setError('Weight required');
    if (!Number.isFinite(reps) || reps <= 0) return setError('Reps required');

    if (unit === 'lb') weightInUnit = roundToNearestGymIncrementLb(weightInUnit);

    const weightKg = unit === 'kg' ? weightInUnit : weightInUnit * KG_PER_LB;

    try {
      setSavingItemId(itemId);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/items/${itemId}/log_fc`,
        {
          method: 'POST',
          auth: true,
          body: {
            set_index: setIndex,
            actual_weight_kg: weightKg,
            actual_reps: reps,
            actual_rpe: rpe,
          },
        }
      );

      if (!ok || !json?.ok) throw new Error(json?.error || `Failed (HTTP ${status})`);

      setTimerPickerVisible(true);
      rememberScroll();
      await fetchWorkout();

      // optional convenience: carry weight forward
      const nextWeightStr =
        weightInUnit > 0
          ? unit === 'lb'
            ? String(roundToNearestGymIncrementLb(weightInUnit))
            : String(weightInUnit)
          : '';

      setFcInputs((prev) => ({
        ...prev,
        [`${itemId}:${setIndex}`]: {
          weight: nextWeightStr,
          reps: prev[`${itemId}:${setIndex}`]?.reps || '',
          rpe: '',
        },
      }));
    } catch (e: any) {
      console.log('logFullCustomSet error', e);
      setError(e?.message || 'Error logging set');
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
      weightInUnit = roundToNearestGymIncrementLb(weightInUnit);
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
            ? String(roundToNearestGymIncrementLb(weightInUnit))
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

  const beginWorkoutConfirmed = async () => {
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

  const beginWorkout = async () => {
    if (
      data?.workout?.status === 'completed' &&
      (data?.workout as any)?.post_session_submitted_at
    ) {
      Alert.alert(
        'Resume Session?',
        'Resuming this completed session will delete the post-session survey for this workout.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resume Session',
            style: 'destructive',
            onPress: () => {
              requestAnimationFrame(() => beginWorkoutConfirmed());
            },
          },
        ]
      );
      return;
    }

    await beginWorkoutConfirmed();
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

  const openPostSessionSurvey = () => {
    setPostSessionForm({
      sessionRpe: null,
      strengthFeeling: '',
      fatigueFeeling: '',
      note: '',
    });
    setPostSessionVisible(true);
  };

  const skipPostSessionAndComplete = async () => {
    setPostSessionVisible(false);
    await completeWorkout();
  };

  const submitPostSessionAndComplete = async () => {
    if (
      postSessionForm.sessionRpe == null ||
      !postSessionForm.strengthFeeling ||
      !postSessionForm.fatigueFeeling
    ) {
      setError('Complete the post-session check-in or choose Skip & Complete.');
      return;
    }

    if (!workoutId) {
      setError('Missing workout id');
      return;
    }

    try {
      setPostSessionSubmitting(true);
      setError(null);

      const { ok, status, json } = await fetchJson(
        `${API_BASE}/workouts/mobile/${workoutId}/post_session_survey`,
        {
          method: 'POST',
          auth: true,
          body: {
            session_rpe: postSessionForm.sessionRpe,
            strength_feeling: postSessionForm.strengthFeeling,
            fatigue_feeling: postSessionForm.fatigueFeeling,
            note: postSessionForm.note,
          },
        }
      );

      if (!ok || !json?.ok) {
        throw new Error(json?.error || `Failed to save post-session survey (HTTP ${status})`);
      }

      setPostSessionVisible(false);
      await completeWorkout();
    } catch (err: any) {
      console.log('submitPostSessionAndComplete error', err);
      setError(err?.message || 'Failed to submit post-session survey');
    } finally {
      setPostSessionSubmitting(false);
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

  const fetchWorkout = useCallback(async (opts?: { silent?: boolean }) => {
    if (!workoutId) {
      setError('Missing workout id');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const silent = !!opts?.silent;

    try {
      if (silent) setRefreshing(true);
      else if (!dataRef.current) setLoading(true);
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
      if (!silent && !dataRef.current) {
        setData(null);
      }
    } finally {
      if (silent) setRefreshing(false);
      else {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [workoutId]);

  useEffect(() => {
    if (Platform.OS === 'web' || !Notifications) return;
    if (notifHandlerSetRef.current) return;

    notifHandlerSetRef.current = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  const onRefresh = useCallback(async () => {
    await fetchWorkout({ silent: true });
  }, [fetchWorkout]);

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
      {/* Command strip */}
      <View style={styles.commandStripWrap}>
        <View style={[styles.commandStrip, restActive && styles.commandStripActive]}>
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

          <View style={styles.commandDivider} />

          <View style={[styles.commandTimerBlock, restActive && styles.commandTimerBlockActive]}>
            <Text style={[styles.commandTimerDot, !restActive && styles.commandTimerDotIdle]}>●</Text>
            <Text style={[styles.commandTimerValue, restActive && styles.commandTimerValueActive]}>
              {restActive && restSeconds > 0 ? formatRestTime(restSeconds) : '—'}
            </Text>
            <Text style={[styles.commandTimerMeta, restActive && styles.commandTimerMetaActive]}>
              Rest Timer
            </Text>
          </View>

          <View style={styles.commandDivider} />

          {canLog ? (
            !restActive ? (
              <TouchableOpacity style={styles.commandButton} onPress={openTimerPicker}>
                <Text style={styles.commandButtonText}>Set Timer</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.commandButton, styles.commandButtonDanger]}
                onPress={stopRestTimer}
              >
                <Text style={styles.commandButtonText}>Stop</Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={styles.commandButtonGhost}>
              <Text style={styles.commandButtonGhostText}>Ready</Text>
            </View>
          )}
        </View>
      </View>

      {/* Scrollable workout content */}
      <RefreshScreen
        ref={scrollRef}
        style={styles.scrollShell}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{
          paddingBottom: 32,
          flexGrow: 1,
        }}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {/* Session header */}
        <View style={styles.sessionHeroCard}>
          <View style={styles.sessionHeroTopRow}>
            <View style={styles.sessionHeroTitleCol}>
              <ThemedText variant="h1" style={styles.pageTitle}>
                {workout.label || 'Session'}
              </ThemedText>
              <Text style={styles.summaryLine}>
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


        {/* Action row */}
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

            const isFullCustom =
              core.variant === 'FULL_CUSTOM' ||
              ((core.scheme || '').toUpperCase() === 'FULL_CUSTOM');

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

            // TOP items can have multiple prescribed sets. Keep hasTopActual for existing
            // backdown unlock logic, but also track per-set progress for TOP logging UI.
            const topLogs = isTop ? (logs || []) : [];
            const topTotalSets = isTop ? (core.sets || 0) : 0;
            const topLatestLoggedIdx =
              isTop && topLogs.length > 0
                ? Math.max(...topLogs.map((sl) => sl.set_index || 0))
                : 0;
            const topNextIdx = isTop
              ? (Math.min(topLatestLoggedIdx + 1, topTotalSets) || 1)
              : 1;

            const topSetLog = isTop
              ? (topLogs.find((sl) => sl.set_index === 1) || topLogs[0] || null)
              : null;

            const hasAllTopActual = isTop
              ? topTotalSets > 0 && topLatestLoggedIdx >= topTotalSets
              : false;
            return (
              <View key={core.id} style={[styles.coreCard, styles.coreCardShell]}>
                {/* Title row */}
                <View style={styles.coreHeaderRow}>
                  <Text style={styles.coreTitle}>{liftDisplayName(core)}</Text>
                  <View style={styles.variantPill}>
                    <Text style={styles.variantText}>
                      {isTop
                        ? 'Top + Backdown'
                        : isBackdown
                        ? 'Backdown'
                        : isFullCustom
                        ? 'Full Custom'
                        : 'Straight Sets'}
                    </Text>
                  </View>
                </View>

                {/* Scheme row (hide for TOP so the top/backdown rows each show their own scheme) */}
                {!isTop && !isFullCustom && (
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

                {/* === FULL_CUSTOM prescription (per-set logging) === */}
                {isFullCustom && Array.isArray(core.planned_sets) && core.planned_sets.length > 0 && (
                  <View style={styles.setLogsBlock}>
                    {core.planned_sets
                      .slice()
                      .sort((a, b) => (a.set_index || 0) - (b.set_index || 0))
                      .map((ps) => {
                        const setIdx = ps.set_index || 0;
                        const wt = formatPlannedWeightLine(ps, unit);

                        // Existing logs for this item
                        const fcLogs = core.set_logs || [];
                        const fcTotal = Array.isArray(core.planned_sets) ? core.planned_sets.length : 0;

                        const fcLatestLoggedIdx =
                          fcLogs.length > 0 ? Math.max(...fcLogs.map((sl) => sl.set_index || 0)) : 0;

                        const fcNextIdx = Math.min(fcLatestLoggedIdx + 1, fcTotal) || 1;

                        const existing = fcLogs.find((sl) => (sl.set_index || 0) === setIdx);
                        const isNext = !existing && setIdx === fcNextIdx;
                        const key = `${core.id}:${setIdx}`;

                        return (
                          <View
                            key={`fc-${core.id}-${setIdx}`}
                            style={[
                              styles.setLogLine,
                              isNext && workout.status === 'in_progress' && styles.setLogLineActive,
                              existing && !isNext && setIdx === fcLatestLoggedIdx && styles.setLogLineLatest,
                            ]}
                          >
                            {isNext && workout.status === 'in_progress' && <View style={styles.setLogAccent} />}
                            {existing && !isNext && setIdx === fcLatestLoggedIdx && (
                              <View style={[styles.setLogAccent, styles.setLogAccentMuted]} />
                            )}
                            <Text style={styles.setLabel}>Set {setIdx}</Text>

                            {/* Line 2: prescription */}
                            <Text style={styles.coreScheme}>
                              {ps.reps != null ? ps.reps : '—'} Reps
                              {(() => {
                                const m = (core.mode || 'RPE').toUpperCase();
                                if (m === 'PCT') {
                                  if (ps.pct == null) return null;
                                  const p = ps.pct > 1 ? ps.pct : ps.pct * 100;
                                  return <Text style={styles.coreSchemeDetail}> @ {p.toFixed(1)}%</Text>;
                                }
                                if (ps.rpe_target == null) return null;
                                return (
                                  <Text style={styles.coreSchemeDetail}>
                                    {' '}@ RPE {Number(ps.rpe_target).toFixed(1)}
                                  </Text>
                                );
                              })()}
                            </Text>

                            {/* Line 3: weight range */}
                            {(wt.primary || wt.suggested) && (
                              <Text style={styles.setTargetInline}>
                                {wt.primary ? wt.primary : wt.suggested}
                              </Text>
                            )}

                            {/* Logged actual */}
                            {existing ? (
                              <View style={styles.loggedRowInline}>
                                <Text style={styles.actualTextInline}>
                                  {formatWeight(existing.actual_weight_kg, unit)} {unit}
                                  {existing.actual_reps != null ? ` × ${existing.actual_reps}` : ''}
                                  {existing.actual_rpe != null ? ` @ RPE ${existing.actual_rpe.toFixed(1)}` : ''}
                                </Text>

                                {canLog && (
                                  <TouchableOpacity
                                    style={styles.inlineEditButtonInline}
                                    onPress={() =>
                                      openEditSet(core.id, existing, {
                                        mode: 'rpe',
                                        title: `Edit Set ${setIdx}`,
                                        canUndoDelete: setIdx === fcLatestLoggedIdx,
                                      })
                                    }
                                  >
                                    <Text style={styles.inlineEditButtonText}>Edit</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            ) : isNext ? (
                              canLog ? (
                                <View style={styles.logRow}>
                                  <TextInput
                                    style={styles.logInput}
                                    placeholder={unit}
                                    placeholderTextColor="#64748b"
                                    keyboardType="numeric"
                                    value={fcInputs[key]?.weight ?? ''}
                                    onChangeText={(txt) => updateFcInput(key, 'weight', txt)}
                                    ref={registerRef(`fc-${core.id}-${setIdx}-weight`)}
                                    returnKeyType="next"
                                    blurOnSubmit={false}
                                    onSubmitEditing={() => focusField(`fc-${core.id}-${setIdx}-reps`)}
                                    onFocus={() =>
                                      requestAnimationFrame(() =>
                                        scrollToNode(inputRefs.current[`fc-${core.id}-${setIdx}-weight`])
                                      )
                                    }
                                  />
                                  <TextInput
                                    style={styles.logInput}
                                    placeholder="reps"
                                    placeholderTextColor="#64748b"
                                    keyboardType="number-pad"
                                    value={fcInputs[key]?.reps ?? ''}
                                    onChangeText={(txt) => updateFcInput(key, 'reps', txt)}
                                    ref={registerRef(`fc-${core.id}-${setIdx}-reps`)}
                                    returnKeyType="next"
                                    blurOnSubmit={false}
                                    onSubmitEditing={() => focusField(`fc-${core.id}-${setIdx}-rpe`)}
                                    onFocus={() =>
                                      requestAnimationFrame(() =>
                                        scrollToNode(inputRefs.current[`fc-${core.id}-${setIdx}-reps`])
                                      )
                                    }
                                  />
                                  <TextInput
                                    style={styles.logInput}
                                    placeholder="RPE"
                                    placeholderTextColor="#64748b"
                                    keyboardType="numeric"
                                    value={fcInputs[key]?.rpe ?? ''}
                                    onChangeText={(txt) => updateFcInput(key, 'rpe', txt)}
                                    ref={registerRef(`fc-${core.id}-${setIdx}-rpe`)}
                                    returnKeyType="done"
                                    onSubmitEditing={() => {
                                      Keyboard.dismiss();
                                      logFullCustomSet(core.id, setIdx);
                                    }}
                                    onFocus={() =>
                                      requestAnimationFrame(() =>
                                        scrollToNode(inputRefs.current[`fc-${core.id}-${setIdx}-rpe`])
                                      )
                                    }
                                  />
                                  <TouchableOpacity
                                    style={styles.logButton}
                                    disabled={savingItemId === core.id}
                                    onPress={() => logFullCustomSet(core.id, setIdx)}
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
                                  <Text style={styles.logHint}>Begin workout to log sets</Text>
                                )
                              )
                            ) : (
                              isCoachView ? null : (
                                <Text style={styles.logHint}>Locked until previous set is logged</Text>
                              )
                            )}
                          </View>
                        );
                      })}
                  </View>
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
                        <View
                          key={setIdx}
                          style={[
                            styles.setLogLine,
                            isNext && workout.status === 'in_progress' && styles.setLogLineActive,
                            isLatest && !isNext && styles.setLogLineLatest,
                          ]}
                        >
                          {isNext && workout.status === 'in_progress' && <View style={styles.setLogAccent} />}
                          {isLatest && !isNext && <View style={[styles.setLogAccent, styles.setLogAccentMuted]} />}
                          <Text style={styles.setLabel}>Set {setIdx}</Text>

                          {/* Inline suggested range for the whole item */}
                          {(() => {
                            const t = formatTargetRange(core.target_low_kg, core.target_high_kg, unit);
                            if (!t) return null;
                            return <Text style={styles.setTargetInline}>{t}</Text>;
                          })()}

                          {existing ? (
                            <View style={styles.loggedRowInline}>
                              <Text style={styles.actualTextInline}>
                                {formatWeight(existing.actual_weight_kg, unit)} {unit}
                                {existing.actual_reps != null ? ` × ${existing.actual_reps}` : ''}
                                {existing.actual_rpe != null ? ` @ RPE ${existing.actual_rpe.toFixed(1)}` : ''}
                              </Text>

                              {canLog && (
                                <TouchableOpacity
                                  style={styles.inlineEditButtonInline}
                                  onPress={() =>
                                    openEditSet(core.id, existing, {
                                      mode: 'rpe',
                                      title: `Edit Set ${setIdx}`,
                                      canUndoDelete: setIdx === latestLoggedIdx,
                                    })
                                  }
                                >
                                  <Text style={styles.inlineEditButtonText}>Edit</Text>
                                </TouchableOpacity>
                              )}
                            </View>
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
                  </View>
                )}

                {/* === Top set + its Backdowns in ONE card === */}
                {isTop && totalSets > 0 && (
                  <View style={styles.setLogsBlock}>
                    {/* Top set summary (once, matching backdown style) */}
                    <View style={{ marginBottom: 10 }}>
                      <Text style={styles.coreScheme}>
                        Top Sets {topLogs.length}/{core.sets || totalSets || 0}
                      </Text>
                      <Text style={styles.coreScheme}>
                        {`${core.sets || totalSets || 0} × ${core.reps || core.reps_text || '—'}`}
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
                        return <Text style={styles.setTargetInline}>{t}</Text>;
                      })()}
                    </View>
                    {Array.from({ length: totalSets }).map((_, idx) => {
                      const setIdx = idx + 1;
                      const existing = logs.find((sl) => sl.set_index === setIdx);
                      const isNext = !existing && setIdx === topNextIdx;

                      return (
                        <View
                          key={`top-${core.id}-${setIdx}`}
                          style={[
                            styles.setLogLine,
                            isNext && workout.status === 'in_progress' && styles.setLogLineActive,
                            existing && !isNext && setIdx === topLatestLoggedIdx && styles.setLogLineLatest,
                            { marginBottom: setIdx < totalSets ? 8 : 0 },
                          ]}
                        >
                          {isNext && workout.status === 'in_progress' && <View style={styles.setLogAccent} />}
                          {existing && !isNext && setIdx === topLatestLoggedIdx && (
                            <View style={[styles.setLogAccent, styles.setLogAccentMuted]} />
                          )}

                          {existing ? (
                            <View style={styles.loggedRowInline}>
                              <Text style={styles.actualTextInline}>
                                Set {setIdx}:{' '}
                                {formatWeight(existing.actual_weight_kg, unit)} {unit}
                                {existing.actual_reps != null ? ` × ${existing.actual_reps}` : ''}
                                {existing.actual_rpe != null ? ` @ RPE ${existing.actual_rpe.toFixed(1)}` : ''}
                              </Text>

                              {canLog && (
                                <TouchableOpacity
                                  style={styles.inlineEditButtonInline}
                                  onPress={() =>
                                    openEditSet(core.id, existing, {
                                      mode: 'rpe',
                                      title: `Edit Top Set ${setIdx}`,
                                      canUndoDelete:
                                        setIdx === topLatestLoggedIdx &&
                                        !backdownsForThisTop.some((bd) => (bd.set_logs || []).length > 0),
                                    })
                                  }
                                >
                                  <Text style={styles.inlineEditButtonText}>Edit</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ) : isNext ? (
                            canLog ? (
                              <View style={styles.logRow}>
                                <TextInput
                                  style={styles.logInput}
                                  placeholder={unit}
                                  placeholderTextColor="#64748b"
                                  keyboardType="numeric"
                                  value={topInputs[core.id]?.weight ?? ''}
                                  onChangeText={(txt) => updateTopInput(core.id, 'weight', txt)}
                                  ref={registerRef(`top-${core.id}-${setIdx}-weight`)}
                                  returnKeyType="next"
                                  blurOnSubmit={false}
                                  onSubmitEditing={() => focusField(`top-${core.id}-${setIdx}-reps`)}
                                  onFocus={() => {
                                    ensureCoreRepsPrefill(core.id, 'top', core.reps);
                                    requestAnimationFrame(() => scrollToNode(inputRefs.current[`top-${core.id}-${setIdx}-weight`]));
                                  }}
                                />
                                <TextInput
                                  style={styles.logInput}
                                  placeholder="reps"
                                  placeholderTextColor="#64748b"
                                  keyboardType="number-pad"
                                  value={topInputs[core.id]?.reps ?? ''}
                                  onChangeText={(txt) => updateTopInput(core.id, 'reps', txt)}
                                  ref={registerRef(`top-${core.id}-${setIdx}-reps`)}
                                  returnKeyType="next"
                                  blurOnSubmit={false}
                                  onSubmitEditing={() => focusField(`top-${core.id}-${setIdx}-rpe`)}
                                  onFocus={() => {
                                    ensureCoreRepsPrefill(core.id, 'top', core.reps);
                                    requestAnimationFrame(() => scrollToNode(inputRefs.current[`top-${core.id}-${setIdx}-reps`]));
                                  }}
                                />
                                <TextInput
                                  style={styles.logInput}
                                  placeholder="RPE"
                                  placeholderTextColor="#64748b"
                                  keyboardType="numeric"
                                  value={topInputs[core.id]?.rpe ?? ''}
                                  onChangeText={(txt) => updateTopInput(core.id, 'rpe', txt)}
                                  ref={registerRef(`top-${core.id}-${setIdx}-rpe`)}
                                  returnKeyType="done"
                                  onSubmitEditing={() => {
                                    Keyboard.dismiss();
                                    logTopSet(core.id);
                                  }}
                                  onFocus={() => requestAnimationFrame(() => scrollToNode(inputRefs.current[`top-${core.id}-${setIdx}-rpe`]))}
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
                                <Text style={styles.logHint}>Begin workout to log sets</Text>
                              )
                            )
                          ) : (
                            isCoachView ? null : (
                              <Text style={styles.logHint}>Locked until previous set is logged</Text>
                            )
                          )}
                        </View>
                      );
                    })}

                    {/* Backdown(s) under the same card */}
                    <View style={{ height: 10 }} />
                    {backdownsForThisTop.map((bd) => {
                      const bdLogs = bd.set_logs || [];
                      const bdLatestLoggedIdx =
                        bdLogs.length > 0
                          ? Math.max(...bdLogs.map((sl) => sl.set_index || 0))
                          : 0;
                      const bdTotal = bd.sets || 0;
                      return (
                        <View
                          key={bd.id}
                          style={[
                            styles.setLogLine,
                            bdLogs.length < bdTotal && hasAllTopActual && canLog && workout.status === 'in_progress' && styles.setLogLineActive,
                            bdLogs.length > 0 && bdLogs.length === bdTotal && styles.setLogLineLatest,
                            { marginBottom: bd === backdownsForThisTop[backdownsForThisTop.length - 1] ? 0 : 8 },
                          ]}
                        >
                          {bdLogs.length < bdTotal && hasAllTopActual && canLog && workout.status === 'in_progress' && <View style={styles.setLogAccent} />}
                          {bdLogs.length > 0 && bdLogs.length === bdTotal && (
                            <View style={[styles.setLogAccent, styles.setLogAccentMuted]} />
                          )}
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
                            <View key={sl.id} style={[styles.loggedRowInline, { marginTop: 8 }]}>
                              <Text style={styles.actualTextInline}>
                                Set {sl.set_index}:{' '}
                                {formatWeight(sl.actual_weight_kg, unit)} {unit}
                                {sl.actual_reps != null ? ` × ${sl.actual_reps}` : ''}
                                {sl.actual_rpe != null ? ` @ RPE ${sl.actual_rpe.toFixed(1)}` : ''}
                              </Text>

                              {canLog && (
                                <TouchableOpacity
                                  style={styles.inlineEditButtonInline}
                                  onPress={() =>
                                    openEditSet(bd.id, sl, {
                                      mode: 'rpe',
                                      title: `Edit Backdown Set ${sl.set_index}`,
                                      canUndoDelete: sl.set_index === bdLogs[bdLogs.length - 1]?.set_index,
                                    })
                                  }
                                >
                                  <Text style={styles.inlineEditButtonText}>Edit</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ))}

                          {canLog && hasAllTopActual && bdLogs.length < bdTotal ? (
                            <View style={[styles.logRow, { marginTop: 4 }]}>
                              <TextInput
                                style={styles.logInput}
                                placeholder={unit}
                                placeholderTextColor="#64748b"
                                keyboardType="numeric"
                                value={bkInputs[bd.id]?.weight ?? ''}
                                onChangeText={(txt) => updateBkInput(bd.id, 'weight', txt)}
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
                                onChangeText={(txt) => updateBkInput(bd.id, 'reps', txt)}
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
                                onChangeText={(txt) => updateBkInput(bd.id, 'rpe', txt)}
                                ref={registerRef(`bk-${bd.id}-rpe`)}
                                returnKeyType="done"
                                onSubmitEditing={() => {
                                  Keyboard.dismiss();
                                  logBackdownSet(bd.id);
                                }}
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
                          ) : !hasAllTopActual ? (
                            isCoachView ? null : (
                              <Text style={[styles.logHint, { marginTop: 4 }]}>Locked until all top sets are logged</Text>
                            )
                          ) : (
                            null
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* If you ever have orphan BK items w/ no parent, they’ll still render as their own card */}
                {isBackdown && !hasParent && (core.sets || 0) > 0 && (
                  <View style={styles.setLogsBlock}>
                    <View
                      style={[
                        styles.setLogLine,
                        logs.length > 0 && logs.length === (core.sets || 0) && styles.setLogLineLatest,
                      ]}
                    >
                      {logs.length > 0 && logs.length === (core.sets || 0) && (
                        <View style={[styles.setLogAccent, styles.setLogAccentMuted]} />
                      )}
                      <Text style={styles.setLabel}>
                        Backdown sets {logs.length}/{core.sets || 0}
                      </Text>

                      {(() => {
                        const t = formatTargetRange(core.target_low_kg, core.target_high_kg, unit);
                        if (!t) return null;
                        return <Text style={styles.setTargetInline}>{t}</Text>;
                      })()}

                      {logs.map((sl) => (
                        <View key={sl.id} style={styles.loggedRowInline}>
                          <Text style={styles.actualTextInline}>
                            Set {sl.set_index}:{' '}
                            {formatWeight(sl.actual_weight_kg, unit)} {unit}
                            {sl.actual_reps != null ? ` × ${sl.actual_reps}` : ''}
                            {sl.actual_rpe != null ? ` @ RPE ${sl.actual_rpe.toFixed(1)}` : ''}
                          </Text>

                          {canLog && (
                            <TouchableOpacity
                              style={styles.inlineEditButtonInline}
                              onPress={() =>
                                openEditSet(core.id, sl, {
                                  mode: 'rpe',
                                  title: `Edit Backdown Set ${sl.set_index}`,
                                  canUndoDelete: sl.set_index === bdLogs[bdLogs.length - 1]?.set_index,
                                })
                              }
                            >
                              <Text style={styles.inlineEditButtonText}>Edit</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Accessories, grouped like the Jinja acc_groups */}
        <View style={[styles.sectionBlock, styles.accessorySectionBlock]}>
          {workout.accessory_groups.map((grp, idx) => {
            // ... keep the entire accessory rendering block exactly as-is ...
            const isSuperset = !!grp.group;

            if (isSuperset) {
              // Superset card with multiple rows inside
              return (
                <View key={grp.group || `ss-${idx}`} style={[styles.supersetCard, styles.supersetCardSecondary]}>
                  <View style={styles.supersetHeader}>
                    <Text style={styles.supersetBadge}>
                      Superset {grp.group}
                    </Text>
                  </View>

                  {grp.items.map((it) => {
                    const logs = it.set_logs || [];
                    const latestLoggedIdx =
                      logs.length > 0
                        ? Math.max(...logs.map((l) => l.set_index || 0))
                        : 0;
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

                         {canHotSwap ? (
                          <TouchableOpacity
                            style={styles.swapPill}
                            onPress={() => openSwapAcc(it)}
                            disabled={savingItemId === it.id}
                          >
                            <Text style={styles.swapPillText}>Swap</Text>
                          </TouchableOpacity>
                        ) : (Array.isArray(it.approved_subs) && it.approved_subs.length > 0 ? (
                          <TouchableOpacity
                            style={styles.swapPill}
                            onPress={() => openSwapAcc(it)}
                            disabled={savingItemId === it.id}
                          >
                            <Text style={styles.swapPillText}>Sub</Text>
                          </TouchableOpacity>
                        ) : null)}
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
                        {!!it.notes && (
                          <Text style={styles.cardMeta}>{it.notes}</Text>
                        )}
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
                              <View
                                key={setNumber}
                                style={[
                                  styles.setLogLine,
                                  isNext && workout.status === 'in_progress' && styles.setLogLineActive,
                                  existing && !isNext && setNumber === latestLoggedIdx && styles.setLogLineLatest,
                                ]}
                              >
                                {isNext && workout.status === 'in_progress' && <View style={styles.setLogAccent} />}
                                {existing && !isNext && setNumber === latestLoggedIdx && (
                                  <View style={[styles.setLogAccent, styles.setLogAccentMuted]} />
                                )}
                                {existing || (isNext && canLog && !isCoachView) ? (
                                  <Text style={styles.setLabel}>Set {setNumber}</Text>
                                ) : null}

                                {existing ? (
                                  <View style={styles.loggedRowInline}>
                                    <Text style={styles.actualTextInline}>
                                      {formatWeight(existing.actual_weight_kg, unit)} {unit}
                                      {existing.actual_reps != null ? ` × ${existing.actual_reps}` : ''}
                                      {existing.actual_rir != null ? ` @ RIR ${existing.actual_rir.toFixed(1)}` : ''}
                                    </Text>

                                    {canLog && (
                                      <TouchableOpacity
                                        style={styles.inlineEditButtonInline}
                                        onPress={() =>
                                          openEditSet(it.id, existing, {
                                            mode: 'rir',
                                            title: `Edit Set ${setNumber}`,
                                            canUndoDelete: existing?.set_index === latestLoggedIdx,
                                          })
                                        }
                                      >
                                        <Text style={styles.inlineEditButtonText}>Edit</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
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
              const latestLoggedIdx =
                logs.length > 0
                  ? Math.max(...logs.map((l) => l.set_index || 0))
                  : 0;
              const totalSets = it.sets || 0;
              const loggedCount = logs.length;
              const nextIndex = loggedCount + 1;
              const canLog = canLogFromServer && workout.status === 'in_progress';

              return (
                <View key={it.id} style={[styles.accCard, styles.accCardSecondary]}>
                  <View style={styles.accHeadRow}>
                    <Text style={styles.accTitle}>
                      {it.movement || 'Accessory'}
                    </Text>

                    {canHotSwap ? (
                      <TouchableOpacity
                        style={styles.swapPill}
                        onPress={() => openSwapAcc(it)}
                        disabled={savingItemId === it.id}
                      >
                        <Text style={styles.swapPillText}>Swap</Text>
                      </TouchableOpacity>
                    ) : (Array.isArray(it.approved_subs) && it.approved_subs.length > 0 ? (
                      <TouchableOpacity
                        style={styles.swapPill}
                        onPress={() => openSwapAcc(it)}
                        disabled={savingItemId === it.id}
                      >
                        <Text style={styles.swapPillText}>Sub</Text>
                      </TouchableOpacity>
                    ) : null)}
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
                  {!!it.notes && (
                    <Text style={styles.cardMeta}>{it.notes}</Text>
                  )}
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
                        <View
                          key={setNumber}
                          style={[
                            styles.setLogLine,
                            isNext && workout.status === 'in_progress' && styles.setLogLineActive,
                            existing && !isNext && setNumber === latestLoggedIdx && styles.setLogLineLatest,
                          ]}
                        >
                          {isNext && workout.status === 'in_progress' && <View style={styles.setLogAccent} />}
                          {existing && !isNext && setNumber === latestLoggedIdx && (
                            <View style={[styles.setLogAccent, styles.setLogAccentMuted]} />
                          )}
                          {existing || (isNext && canLog && !isCoachView) ? (
                            <Text style={styles.setLabel}>Set {setNumber}</Text>
                          ) : null}

                          {existing ? (
                            <View style={styles.loggedRowInline}>
                              <Text style={styles.actualTextInline}>
                                {formatWeight(existing.actual_weight_kg, unit)} {unit}
                                {existing.actual_reps != null ? ` × ${existing.actual_reps}` : ''}
                                {existing.actual_rir != null ? ` @ RIR ${existing.actual_rir.toFixed(1)}` : ''}
                              </Text>

                              {canLog && (
                                <TouchableOpacity
                                  style={styles.inlineEditButtonInline}
                                  onPress={() =>
                                    openEditSet(it.id, existing, {
                                      mode: 'rir',
                                      title: `Edit Set ${setNumber}`,
                                      canUndoDelete: existing?.set_index === latestLoggedIdx,
                                    })
                                  }
                                >
                                  <Text style={styles.inlineEditButtonText}>Edit</Text>
                                </TouchableOpacity>
                              )}
                            </View>
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
                  onPress={openPostSessionSurvey}
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
                      workout.status === 'completed'
                        ? styles.actionPrimaryText
                        : styles.actionDangerText,
                    ]}
                  >
                    {workout.status === 'completed' ? 'Resume Workout' : 'Cancel Workout'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
      </RefreshScreen>

      <TouchableOpacity
        style={styles.floatingBackButton}
        onPress={() => router.back()}
      >
        <Text style={styles.floatingBackButtonText}>← Back</Text>
      </TouchableOpacity>

      {/* Cancel / Resume confirmation modal */}
      <Modal
        visible={cancelConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.postSessionTitle}>
              {workout.status === 'completed'
                ? 'Resume this workout?'
                : 'Cancel this workout?'}
            </Text>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  workout.status === 'completed' ? styles.actionPrimary : styles.actionDanger,
                  { flex: 1 },
                ]}
                onPress={async () => {
                  setCancelConfirmVisible(false);
                  if (workout.status === 'completed') {
                    beginWorkout();
                  } else {
                    cancelWorkout();
                  }
                }}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    workout.status === 'completed'
                      ? styles.actionPrimaryText
                      : styles.actionDangerText,
                  ]}
                >
                  {workout.status === 'completed' ? 'Resume' : 'Yes, Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
                onPress={() => setCancelConfirmVisible(false)}
              >
                <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editSetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!editSetSubmitting) {
            setEditSetVisible(false);
            setEditSetCtx(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.editSetModalWide]}>
            <Text style={styles.postSessionTitle}>{editSetCtx?.title || 'Edit Set'}</Text>
            <Text style={styles.modalSubtitle}>Update the logged values for this set.</Text>

            <View style={styles.modalRow}>
              <View style={[styles.modalFieldBlock, styles.modalFieldInline]}>
                <Text style={styles.modalLabel}>Weight ({unit})</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSetForm.weight}
                  onChangeText={(txt) =>
                    setEditSetForm((prev) => ({
                      ...prev,
                      weight: txt.replace(/[^0-9.]/g, ''),
                    }))
                  }
                  placeholder={`Enter ${unit}`}
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.modalFieldBlock, styles.modalFieldInline]}>
                <Text style={styles.modalLabel}>Reps</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSetForm.reps}
                  onChangeText={(txt) =>
                    setEditSetForm((prev) => ({
                      ...prev,
                      reps: txt.replace(/[^0-9]/g, ''),
                    }))
                  }
                  placeholder="Reps"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                />
              </View>

              {editSetCtx?.mode === 'rpe' ? (
                <View style={[styles.modalFieldBlock, styles.modalFieldInline]}>
                  <Text style={styles.modalLabel}>RPE</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editSetForm.rpe}
                    onChangeText={(txt) =>
                      setEditSetForm((prev) => ({
                        ...prev,
                        rpe: txt.replace(/[^0-9.]/g, ''),
                      }))
                    }
                    placeholder="RPE"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </View>
              ) : (
                <View style={[styles.modalFieldBlock, styles.modalFieldInline]}>
                  <Text style={styles.modalLabel}>RIR</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editSetForm.rir}
                    onChangeText={(txt) =>
                      setEditSetForm((prev) => ({
                        ...prev,
                        rir: txt.replace(/[^0-9.\\-]/g, '').replace(/(?!^)-/g, ''),
                      }))
                    }
                    placeholder="RIR"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </View>
              )}
            </View>

            <View style={styles.modalActionsRow}>
              {editSetCtx?.canUndoDelete && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionDanger, { flex: 1 }]}
                  onPress={deleteEditedSet}
                  disabled={editSetSubmitting}
                >
                  {editSetSubmitting ? (
                    <ActivityIndicator size="small" color="#fca5a5" />
                  ) : (
                    <Text style={[styles.actionButtonText, styles.actionDangerText]}>Undo Set Log</Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
                onPress={() => {
                  if (!editSetSubmitting) {
                    setEditSetVisible(false);
                    setEditSetCtx(null);
                  }
                }}
                disabled={editSetSubmitting}
              >
                <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]}
                onPress={saveEditedSet}
                disabled={editSetSubmitting}
              >
                {editSetSubmitting ? (
                  <ActivityIndicator size="small" color="#020617" />
                ) : (
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={postSessionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!postSessionSubmitting) setPostSessionVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.modalBackdrop}>
              <View style={[styles.modalCard, styles.postSessionModal]}>
                <Text style={styles.postSessionTitle}>Post-Session Survey</Text>
                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Session RPE</Text>
                  <View style={styles.surveyChipRow}>
                    {[6, 7, 8, 9, 10].map((value) => {
                      const selected = postSessionForm.sessionRpe === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.surveyChip, selected && styles.surveyChipActive]}
                          onPress={() =>
                            setPostSessionForm((prev) => ({
                              ...prev,
                              sessionRpe: value,
                            }))
                          }
                        >
                          <Text style={[styles.surveyChipText, selected && styles.surveyChipTextActive]}>
                            {value}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Perceived Strength</Text>
                  <View style={styles.surveyChoiceStack}>
                    {[
                      ['weaker', 'Weaker'],
                      ['normal', 'Normal'],
                      ['stronger', 'Stronger'],
                    ].map(([value, label]) => {
                      const selected = postSessionForm.strengthFeeling === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.surveyChoiceButton, selected && styles.surveyChoiceButtonActive]}
                          onPress={() =>
                            setPostSessionForm((prev) => ({
                              ...prev,
                              strengthFeeling: value as any,
                            }))
                          }
                        >
                          <Text style={[styles.surveyChoiceText, selected && styles.surveyChoiceTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Perceived Fatigue</Text>
                  <View style={styles.surveyChoiceStack}>
                    {[
                      ['low', 'Low'],
                      ['medium', 'Medium'],
                      ['high', 'High'],
                    ].map(([value, label]) => {
                      const selected = postSessionForm.fatigueFeeling === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.surveyChoiceButton, selected && styles.surveyChoiceButtonActive]}
                          onPress={() =>
                            setPostSessionForm((prev) => ({
                              ...prev,
                              fatigueFeeling: value as any,
                            }))
                          }
                        >
                          <Text style={[styles.surveyChoiceText, selected && styles.surveyChoiceTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.surveySection}>
                  <Text style={styles.surveyLabel}>Notes</Text>
                  <TextInput
                    style={[styles.modalInput, styles.surveyNoteInput]}
                    value={postSessionForm.note}
                    onChangeText={(txt) =>
                      setPostSessionForm((prev) => ({
                        ...prev,
                        note: txt,
                      }))
                    }
                    placeholder="Sleep was bad, low back felt tight, bench moved well, etc."
                    placeholderTextColor="#64748b"
                    multiline
                    textAlignVertical="top"
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>

                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
                    onPress={skipPostSessionAndComplete}
                    disabled={postSessionSubmitting}
                  >
                    <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>
                      Skip & Complete
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionPrimary, { flex: 1.2 }]}
                    onPress={submitPostSessionAndComplete}
                    disabled={postSessionSubmitting}
                  >
                    {postSessionSubmitting ? (
                      <ActivityIndicator size="small" color="#020617" />
                    ) : (
                      <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>
                        Submit & Complete
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Shared rest timer picker (popup modal) */}
      <Modal
        visible={timerPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTimerPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.postSessionTitle}>Set Rest Timer</Text>
            <View style={styles.timerWheelWrap}>
              <View pointerEvents="none" style={styles.timerWheelCenterIndicator} />
              <ScrollView
                ref={timerWheelRef}
                style={styles.timerWheel}
                contentContainerStyle={styles.timerWheelContent}
                showsVerticalScrollIndicator={false}
                snapToInterval={52}
                decelerationRate="fast"
                disableIntervalMomentum
                snapToAlignment="center"
                scrollEventThrottle={16}
                onScrollEndDrag={(e) => {
                  const y = e.nativeEvent.contentOffset.y;
                  const idx = Math.max(0, Math.min(9, Math.round(y / 52)));
                  const snappedY = idx * 52;
                  const value = (idx + 1) * 30;
                  setTimerPickerValue(value);
                  timerWheelRef.current?.scrollTo({ y: snappedY, animated: true });
                }}
                onMomentumScrollEnd={(e) => {
                  const y = e.nativeEvent.contentOffset.y;
                  const idx = Math.max(0, Math.min(9, Math.round(y / 52)));
                  const snappedY = idx * 52;
                  const value = (idx + 1) * 30;
                  setTimerPickerValue(value);
                  timerWheelRef.current?.scrollTo({ y: snappedY, animated: false });
                }}
              >
                {Array.from({ length: 10 }).map((_, idx) => {
                  const value = (idx + 1) * 30;
                  const mins = Math.floor(value / 60);
                  const secs = value % 60;
                  const label =
                    mins > 0
                      ? `${mins}:${String(secs).padStart(2, '0')}`
                      : `${secs}s`;
                  const selected = timerPickerValue === value;

                  return (
                    <View
                      key={value}
                      style={[styles.timerWheelOption, selected && styles.timerWheelOptionActive]}
                    >
                      <Text style={[styles.timerWheelText, selected && styles.timerWheelTextActive]}>
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
                onPress={() => setTimerPickerVisible(false)}
              >
                <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]}
                onPress={() => {
                  startRestTimer(timerPickerValue);
                  setTimerPickerVisible(false);
                }}
              >
                <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>
                  Start Timer
                </Text>
              </TouchableOpacity>
            </View>
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
        <View style={styles.modalBackdropCenter}>
          <View style={[styles.modalCard, styles.readinessModal]}>
            <Text style={styles.postSessionTitle}>Quick readiness check</Text>

            {/* Sleep */}
            <Text style={styles.readinessQuestionLabel}>
              Sleep quality (1 = poor, 5 = great)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`sleep-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, sleep_quality: n }))}
                  style={[
                    styles.readinessScalePill,
                    n === readinessForm.sleep_quality && styles.readinessScalePillActive,
                  ]}
                >
                  <Text style={styles.readinessScalePillText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Energy */}
            <Text style={[styles.readinessQuestionLabel, styles.readinessQuestionSpaced]}>
              Energy (1 = drained, 5 = energized)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`fatigue-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, fatigue: n }))}
                  style={[
                    styles.readinessScalePill,
                    n === readinessForm.fatigue && styles.readinessScalePillActive,
                  ]}
                >
                  <Text style={styles.readinessScalePillText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Soreness */}
            <Text style={[styles.readinessQuestionLabel, styles.readinessQuestionSpaced]}>
              Soreness (1 = fresh, 5 = very sore)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`sore-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, soreness: n }))}
                  style={[
                    styles.readinessScalePill,
                    n === readinessForm.soreness && styles.readinessScalePillActive,
                  ]}
                >
                  <Text style={styles.readinessScalePillText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Stress */}
            <Text style={[styles.readinessQuestionLabel, styles.readinessQuestionSpaced]}>
              Stress (1 = relaxed, 5 = high stress)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {[1,2,3,4,5].map((n) => (
                <TouchableOpacity
                  key={`stress-${n}`}
                  onPress={() => setReadinessForm((p) => ({ ...p, stress: n }))}
                  style={[
                    styles.readinessScalePill,
                    n === readinessForm.stress && styles.readinessScalePillActive,
                  ]}
                >
                  <Text style={styles.readinessScalePillText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActionsRow}>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]}
                onPress={() => submitReadinessAndBegin({ skipped: false })}
                disabled={readinessSubmitting}
              >
                {readinessSubmitting ? (
                  <ActivityIndicator size="small" color="#0B0F1A" />
                ) : (
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Submit</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionDanger, { flex: 1 }]}
                onPress={() => {
                  if (!readinessSubmitting) {
                    setReadinessVisible(false);
                    setPendingBeginWorkoutId(null);
                  }
                }}
                disabled={readinessSubmitting}
              >
                <Text style={styles.actionDangerText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Accessory substitution modal */}
      <Modal
        visible={swapAccVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwapAccVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.swapModalWide]}>
            <Text style={styles.postSessionTitle}>
              {canHotSwap ? 'Swap accessory' : 'Substitute accessory'}
            </Text>

            <Text style={styles.modalSubtitle}>
              {canHotSwap
                ? 'Update the accessory movement and prescription.'
                : 'Select one of the coach-approved substitutions below.'}
            </Text>

            {canHotSwap ? (
              <>
                <TextInput
                  style={styles.swapInput}
                  placeholder="Movement (e.g., Lat Pulldown)"
                  placeholderTextColor="#64748b"
                  value={swapAccForm.movement}
                  onChangeText={(t) => setSwapAccForm((p) => ({ ...p, movement: t }))}
                />

                <View style={styles.readinessScaleRow}>
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
              </>
            ) : (
              <>
                <View style={{ gap: 8, marginTop: 10 }}>
                  {(() => {
                    const prescribed = String(
                      swapAccItem?.original_movement || swapAccItem?.movement || ''
                    ).trim();

                    const approved = Array.isArray(swapAccItem?.approved_subs)
                      ? swapAccItem.approved_subs
                      : [];

                    const options: string[] = [];
                    const seen = new Set<string>();

                    [prescribed, ...approved].forEach((mv) => {
                      const clean = String(mv || '').trim();
                      if (!clean) return;
                      const key = clean.toLowerCase();
                      if (seen.has(key)) return;
                      seen.add(key);
                      options.push(clean);
                    });

                    const currentActive = String(
                      swapAccItem?.selected_sub_movement || swapAccItem?.movement || ''
                    ).trim();

                    return options.map((movement) => {
                      const selected = swapAccForm.movement === movement;
                      const isPrescribed = prescribed !== '' && movement === prescribed;
                      const isActive = currentActive !== '' && movement === currentActive;

                      return (
                        <TouchableOpacity
                          key={movement}
                          style={[
                            styles.swapOptionButton,
                            selected && styles.swapOptionButtonActive,
                          ]}
                          onPress={() => setSwapAccForm((p) => ({ ...p, movement }))}
                        >
                          <Text style={[styles.swapOptionText, selected && styles.swapOptionTextActive]}>
                            {movement}
                            {isPrescribed ? ' (Prescribed)' : ''}
                            {isActive ? ' (Active)' : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </View>

                <Text style={[styles.modalSubtitle, { marginTop: 10 }]}>
                  Keeps the same sets, reps, and RIR by default.
                </Text>
              </>
            )}
            
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionPrimary, { flex: 1 }]}
                onPress={saveSwapAcc}
                disabled={savingItemId != null}
              >
                {savingItemId === swapAccItem?.id ? (
                  <ActivityIndicator size="small" color="#0B0F1A" />
                ) : (
                  <Text style={[styles.actionButtonText, styles.actionPrimaryText]}>Save</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionSecondary, { flex: 1 }]}
                onPress={() => setSwapAccVisible(false)}
              >
                <Text style={[styles.actionButtonText, styles.actionSecondaryText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 20,
  },

  accessorySectionBlock: {
    marginTop: 6,
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 10,
  },

  // --- core cards ---
  coreCard: {
    marginBottom: 14,
  },
  coreHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  variantPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(18,22,40,0.68)',
  },

  variantText: {
    color: '#B8B0DA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  coreSchemeDetail: {
    color: '#A5B4FC',
    fontWeight: '600',
  },


  notesText: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // --- accessories ---
  supersetCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },


  supersetHeader: {
    marginBottom: 8,
  },

  supersetBadge: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },

  supersetRow: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(15,23,42,0.46)',
  },

  accCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },

  accCardSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(10,18,36,0.68)',
  },

  accHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
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


  accMeta: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  cardMeta: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },


  lookbackText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 8,
  },

  setLogsBlock: {
    marginTop: 4,
  },
  setLogLine: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(10,14,28,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.06)',
    overflow: 'hidden', // important for accent bar
  },

  setLogLineActive: {
    borderColor: 'rgba(109,91,208,0.18)',
    backgroundColor: 'rgba(109,91,208,0.06)',
  },

  setLogLineLatest: {
    borderColor: 'rgba(148,163,184,0.12)',
  },

  setLogAccent: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#5B4FCF',
    opacity: 0.65,
  },

  setLogAccentMuted: {
    backgroundColor: 'rgba(148,163,184,0.4)',
    opacity: 0.4,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  logHint: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  unitToggleRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  unitToggleRowInline: {
    justifyContent: 'center',
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
  unitToggleOption: {
    minWidth: 50,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
  timerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  timerPicker: {
    width: '92%',
    maxWidth: 420,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(10,14,28,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(109,91,208,0.10)',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
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
  timerWheelWrap: {
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    backgroundColor: '#020617',
    overflow: 'hidden',
    height: 220,
    position: 'relative',
  },
  timerWheel: {
    height: 220,
  },
  timerWheelContent: {
    paddingVertical: 84,
  },
  timerWheelOption: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
  },
  timerWheelOptionActive: {
    backgroundColor: 'transparent',
  },

  swapModalWide: {
    width: '92%',
    maxWidth: 520,
  },
  readinessModal: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  readinessQuestionLabel: {
    color: '#E2E8F0',
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 13,
    textAlign: 'center'
  },

  readinessQuestionSpaced: {
    marginTop: 14,
  },
  readinessScalePill: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(148,163,184,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  readinessScalePillActive: {
    borderColor: 'rgba(109,91,208,0.50)',
    backgroundColor: 'rgba(109,91,208,0.10)',
  },

  readinessScalePillText: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 13,
  },
  readinessScaleRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
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
  setTargetInline: {
    marginLeft: 10,
    color: '#94a3b8',
    fontSize: 13,
  },

  // Shared modal form helper styles (used in timer/readiness/edit-set modals)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.76)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 10,
  },
  modalBody: {
    color: '#94A3B8',
    marginBottom: 14,
    lineHeight: 20,
    fontSize: 14,
    textAlign: 'left',
  },
  modalBtnGhost: {
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderColor: 'rgba(148,163,184,0.18)',
  },
  modalFieldBlock: {
    marginBottom: 10,
  },
  editSetModalWide: {
    width: '95%',
    maxWidth: 600,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalFieldInline: {
    flex: 1,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 6,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  loggedRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingVertical: 4,
  },
  postSessionModal: {
    width: '95%',
    maxWidth: 520,
    paddingTop: 4,
  },
  surveySection: {
    marginTop: 14,
  },
  surveyChipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  surveyChoiceStack: {
    gap: 8,
  },
  surveyNoteInput: {
    minHeight: 96,
    paddingTop: 12,
  },
  commandStripWrap: {
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.10)',
  },
  commandDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(148,163,184,0.14)',
  },
  commandTimerBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  commandTimerBlockActive: {
    backgroundColor: 'transparent',
  },
  commandTimerDotIdle: {
    color: '#64748B',
    textShadowRadius: 0,
  },

  screen: {
    flex: 1,
    backgroundColor: '#0B0F1A',
  },
  timerBarWrapper: {
    paddingHorizontal: 16,
    backgroundColor: '#0B0F1A',
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 14,
  },

  scrollShell: {
    flex: 1,
    backgroundColor: '#020617',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0F1A',
  },
  coreCardShell: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(10,14,28,0.96)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  coreTitle: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  coreScheme: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    lineHeight: 19,
  },
  coreTarget: {
    fontSize: 13,
    color: '#8E84CC',
    marginTop: 4,
  },

  actualText: {
    fontSize: 13,
    color: '#22C55E',
    marginTop: 4,
  },
  supersetCardSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(12,16,32,0.92)',
  },
  swapPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(91,79,207,0.7)',
    backgroundColor: 'rgba(91,79,207,0.12)',
  },
  swapPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  swapOptionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(15,20,36,0.55)',
    justifyContent: 'flex-start',
  },

  swapOptionButtonActive: {
    borderColor: 'rgba(109,91,208,0.22)',
    backgroundColor: 'rgba(109,91,208,0.08)',
  },

  swapOptionText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },

  swapOptionTextActive: {
    color: '#E2E8F0',
  },
  accTitle: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    flex: 1,
  },
  accRir: {
    color: '#F59E0B',
  },
  setLabel: {
    color: '#A9A3CF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },

  setTargetInline: {
    color: '#8E84CC',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  logInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(15,20,36,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    paddingHorizontal: 12,
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
  },

  logInputActive: {
    borderColor: 'rgba(109,91,208,0.22)',
    backgroundColor: 'rgba(15,20,36,0.86)',
  },

  logButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#5B4FCF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5B4FCF',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  logButtonText: {
    color: '#F5F3FF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  undoButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.9)',
    backgroundColor: 'transparent',
  },
  undoButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  actionPrimary: {
    backgroundColor: '#5B4FCF',
    borderColor: 'rgba(109,91,208,0.22)',
    shadowColor: '#5B4FCF',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionSecondary: {
    backgroundColor: 'rgba(15,20,36,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  actionPrimaryText: {
    color: '#F5F3FF',
  },
  actionSecondaryText: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  actionDangerText: {
    color: '#FCA5A5',
    fontWeight: '700',
  },
  unitTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,20,36,0.82)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
  },

  unitToggleOptionActive: {
    backgroundColor: '#5B4FCF',
    shadowColor: '#5B4FCF',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  unitToggleText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'lowercase',
  },

  unitToggleTextActive: {
    color: '#E5E7EB',
  },
  timerButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
    backgroundColor: '#0B0F1A',
  },
  timerStopButton: {
    borderColor: 'rgba(239,68,68,0.9)',
    backgroundColor: 'rgba(127,29,29,0.9)',
  },
  timerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  timerWheelText: {
    color: '#CBD5E1',
    fontSize: 20,
    fontWeight: '600',
  },
  timerWheelTextActive: {
    color: '#7C3AED',
  },
  timerWheelCenterIndicator: {
    position: 'absolute',
    top: 84,
    left: 0,
    right: 0,
    height: 52,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(91,79,207,0.06)',
    zIndex: 5,
  },
  errorBanner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.7)',
    backgroundColor: 'rgba(127,29,29,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  errorBannerText: {
    flex: 1,
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBannerClose: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.6)',
    backgroundColor: 'rgba(127,29,29,0.6)',
  },
  errorBannerCloseText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  actionSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(148,163,184,0.08)',
  },
  actionSecondaryText: {
    color: '#E2E8F0',
  },
  inlineEditButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.35)',
    backgroundColor: 'rgba(129,140,248,0.10)',
  },
  inlineEditButtonText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(10,14,28,0.98)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  modalTitle: {
    color: '#E2E8F0',
    marginBottom: 6,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: -0.2,
    textAlign: 'left',
  },
  modalBtnDanger: {
    backgroundColor: 'rgba(127,29,29,0.92)',
    borderColor: 'rgba(239,68,68,0.32)',
  },
  modalBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#1f2933',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#CBD5E1',
    fontSize: 14,
    backgroundColor: '#0B0F1A',
  },
  actualTextInline: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  inlineEditButtonInline: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(15,20,36,0.80)',
  },
  floatingBackButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    backgroundColor: 'rgba(15,20,36,0.80)',
    zIndex: 40,
  },
  floatingBackButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  postSessionTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: 10,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  surveyLabel: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  surveyChip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B0F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  surveyChipActive: {
    backgroundColor: '#CBD5E1',
    borderColor: '#CBD5E1',
  },
  surveyChipText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
  surveyChipTextActive: {
    color: '#0B0F1A',
  },
  surveyChoiceButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B0F1A',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  surveyChoiceButtonActive: {
    borderColor: '#CBD5E1',
    backgroundColor: '#111c2f',
  },
  surveyChoiceText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
  },
  surveyChoiceTextActive: {
    color: '#E2E8F0',
  },
  commandStrip: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(10,14,28,0.94)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  commandStripActive: {
    borderColor: 'rgba(34,197,94,0.16)',
    backgroundColor: 'rgba(10,16,30,0.96)',
    shadowOpacity: 0.16,
  },
  commandTimerDot: {
    color: '#22C55E',
    fontSize: 10,
    marginTop: 1,
    textShadowColor: 'rgba(34,197,94,0.28)',
    textShadowRadius: 8,
  },
  commandTimerValue: {
    color: '#E2E8F0',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  commandTimerValueActive: {
    color: '#D1FAE5',
    textShadowColor: 'rgba(34,197,94,0.10)',
    textShadowRadius: 8,
  },
  commandTimerMeta: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  commandTimerMetaActive: {
    color: '#A7F3D0',
  },
  commandButton: {
    minWidth: 92,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,20,36,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
  },
  commandButtonDanger: {
    borderColor: 'rgba(239,68,68,0.22)',
    backgroundColor: 'rgba(40,12,18,0.92)',
  },
  commandButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  commandButtonGhost: {
    minWidth: 92,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,20,36,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.06)',
  },
  commandButtonGhostText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionHeroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'rgba(10,14,28,0.98)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 6,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  sessionHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  sessionHeroTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  summaryRow: {
    marginBottom: 0,
  },
  pageTitle: {
    color: '#F8FAFC',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 4,
  },
  summaryLine: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryStrong: {
    color: '#E5E7EB',
    fontWeight: '600',
  },
  summarySeparator: {
    color: '#64748B',
  },
  summaryText: {
    color: '#94A3B8',
  },
  statusBadge: {
    minHeight: 30,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionDanger: {
    backgroundColor: 'rgba(239,68,68,0.16)', // soft red fill
    borderColor: 'rgba(239,68,68,0.55)',     // visible red edge
    borderWidth: 1,
  },
  actionDangerText: {
    color: '#FCA5A5',
    fontWeight: '700',
  },
});
