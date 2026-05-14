import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, Modal, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams } from 'expo-router';
import { fetchJson } from '@/lib/api';
import DateTimePicker from '@react-native-community/datetimepicker';

type CoreDraft = {
  lift: 'SQ'|'BN'|'DL'|'OHP'|'VR';
  variant: 'STRAIGHT'|'TOP'|'BK';
  mode: 'RPE'|'PCT';
  movement?: string;
  sets: number;
  reps: number;
  rpe_target?: number | null;
  pct?: number | null; // 0.8 style or 80 accepted by backend
  // Manual load entry (optional override for ANY core lift, including variants)
  manual_target_kg?: number | null;
  manual_plusminus_kg?: number | null;

  // Computed on backend (web builder). If present, show inline on mobile.
  target_low_kg?: number | null;
  target_high_kg?: number | null;

  parent_item_id?: number | null; // only needed if you ever create BK in same payload
};

type AccDraft = {
  movement: string;
  sets: number;
  reps_text: string;
  rir_target?: number | null;
  superset_group?: string | null;
  superset_pos?: number | null;
};

type RosterRow = {
  id: number;
  name: string;
  is_self?: boolean;
};

type TemplateRow = {
  id: number;
  name: string;
  updated_at?: string | null;
};

type TemplateDetail = {
  ok: boolean;
  template_id: number;
  name?: string | null;
  label?: string | null;
  core_items: any[];
  acc_items: any[];
};

export default function CreateWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editWorkoutId?: string }>();
  const editWorkoutId = params?.editWorkoutId ? String(params.editWorkoutId) : '';

  // ===== Units (mobile) =====
  // Backend stores kg. UI can display/input in kg or lb.
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const LB_PER_KG = 2.2046226218;
  const kgToLb = (kg: number) => kg * LB_PER_KG;
  const lbToKg = (lb: number) => lb / LB_PER_KG;

  const fmtWeight = (kg: number) => {
    const v = unit === 'lb' ? kgToLb(kg) : kg;
    const r = Math.round(v * 10) / 10;
    return Number.isInteger(r) ? String(Math.trunc(r)) : String(r);
  };

  const roundToStep = (v: number, step: number) => {
    if (!Number.isFinite(v)) return v;
    if (step <= 0) return v;
    return Math.round(v / step) * step;
  };

  const normalizeDecimalInput = (s: string) => (s ?? '').replace(/,/g, '.');

  const parseDisplayWeightToKg = (s: string): number | null => {
    if (s == null) return null;
    const t = normalizeDecimalInput(String(s)).trim();
    if (!t) return null;

    const n = Number(t); // allow decimals
    if (!Number.isFinite(n)) return null;
    if (n <= 0) return null;

    return unit === 'lb' ? lbToKg(n) : n;
  };

  const parseDisplayDeltaToKg = (s: string): number | null => {
    if (s == null) return null;
    const t = normalizeDecimalInput(String(s)).trim();
    if (!t) return null;

    const n = Number(t); // allow decimals
    if (!Number.isFinite(n)) return null;
    if (n < 0) return null;

    return unit === 'lb' ? lbToKg(n) : n;
  };

  const displayWeight = (kg: number | null | undefined) => {
    if (kg == null) return '';
    return fmtWeight(kg);
  };

  // ========== Manual load decimal helpers ==========
  const sanitizeDecimalDraft = (s: string) => {
    // allow digits + one decimal separator ('.' or ','); keep as the user types
    const t = String(s ?? '');
    // Remove spaces
    const noSpace = t.replace(/\s+/g, '');
    // Keep digits, '.' and ',' only
    const kept = noSpace.replace(/[^0-9\.,]/g, '');
    // If multiple separators, keep first and drop the rest
    const firstDot = kept.indexOf('.');
    const firstComma = kept.indexOf(',');
    const firstSepIdx = firstDot === -1 ? firstComma : (firstComma === -1 ? firstDot : Math.min(firstDot, firstComma));
    if (firstSepIdx === -1) return kept;
    const sep = kept[firstSepIdx];
    const before = kept.slice(0, firstSepIdx + 1);
    const after = kept.slice(firstSepIdx + 1).replace(/[\.,]/g, '');
    return before + after;
  };

  const keyForManualTarget = (idx: number) => `core:${idx}:manual_target`;
  const keyForManualPm = (idx: number) => `core:${idx}:manual_pm`;

  // ===== Step validation (kg only) =====
  const KG_STEP = 2.5;
  const [stepIssues, setStepIssues] = useState<Record<string, string>>({});

  const isMultipleOfStep = (v: number, step: number) => {
    const q = v / step;
    return Math.abs(q - Math.round(q)) < 1e-6;
  };

  const setIssue = (key: string, msg?: string | null) => {
    setStepIssues((prev) => {
      const next = { ...prev };
      if (!msg) delete next[key];
      else next[key] = msg;
      return next;
    });
  };

  const validateKgStep = (key: string, kgVal: number | null | undefined, allowZero = false) => {
    if (unit !== 'kg') return setIssue(key, null);
    if (kgVal == null) return setIssue(key, null);

    const n = Number(kgVal);
    if (!Number.isFinite(n)) return setIssue(key, 'Invalid number');
    if (!allowZero && n <= 0) return setIssue(key, null);
    if (allowZero && n < 0) return setIssue(key, 'Must be 0 or greater');

    if (!isMultipleOfStep(n, KG_STEP)) return setIssue(key, 'Must be in 2.5 kg increments');
    setIssue(key, null);
  };

  // Use a LOCAL compute for save/canSave (do not rely on async state updates)
  const computeKgStepIssues = () => {
    if (unit !== 'kg') return {};
    const issues: Record<string, string> = {};
    coreRef.current.forEach((c, idx) => {
      const t = c?.manual_target_kg;
      const pm = c?.manual_plusminus_kg;

      if (t != null && Number.isFinite(Number(t)) && Number(t) > 0 && !isMultipleOfStep(Number(t), KG_STEP)) {
        issues[`core:${idx}:manual_target`] = 'Must be in 2.5 kg increments';
      }
      if (pm != null && Number.isFinite(Number(pm)) && Number(pm) >= 0 && !isMultipleOfStep(Number(pm), KG_STEP)) {
        issues[`core:${idx}:manual_pm`] = 'Must be in 2.5 kg increments';
      }
    });
    return issues;
  };

  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [athletePickerOpen, setAthletePickerOpen] = useState(false);
  const [addLiftOpen, setAddLiftOpen] = useState(false);
  const [coreSelectOpen, setCoreSelectOpen] = useState<null | { kind: 'lift'|'scheme'|'mode'; idx: number }>(null);
  const [accSupersetSelectOpen, setAccSupersetSelectOpen] = useState<null | { idx: number }>(null);

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempPickedDate, setTempPickedDate] = useState<Date>(() => new Date());

  // Manual load text drafts (so decimals are typeable on iOS)
  const [manualDraft, setManualDraft] = useState<Record<string, string>>({});

  const getDraft = (key: string, fallbackKg: number | null | undefined) => {
    if (manualDraft[key] != null) return manualDraft[key];
    return displayWeight(fallbackKg);
  };

  const setDraft = (key: string, v: string) => {
    setManualDraft((prev) => ({ ...prev, [key]: sanitizeDecimalDraft(v) }));
  };

  const clearDraft = (key: string) => {
    setManualDraft((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const coreLiftLabel = (v: CoreDraft['lift']) => {
    if (v === 'SQ') return 'Comp Squat';
    if (v === 'BN') return 'Comp Bench';
    if (v === 'DL') return 'Comp Deadlift';
    return 'Variant';
  };

  const coreSchemeLabel = (arr: CoreDraft[], idx: number) => {
    const c = arr[idx];
    const n = arr[idx + 1];
    if (c?.variant === 'TOP' && n?.variant === 'BK') return 'Top + Backdown';
    return 'Straight';
  };

  const coreModeLabel = (v: CoreDraft['mode']) => (v === 'RPE' ? 'RPE' : '%');

  const formatDateYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // ===== Accessory supersets (mobile builder) =====
  // Web uses A–F groups; mobile should match.
  const SS_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
  type SSGroup = typeof SS_GROUPS[number];

  const normalizeSSGroup = (g: any): SSGroup | null => {
    const s = String(g || '').trim().toUpperCase();
    return (SS_GROUPS as readonly string[]).includes(s) ? (s as SSGroup) : null;
  };

  const getSupersetGroups = (rows: AccDraft[]) => {
    const used = new Set<string>();
    rows.forEach((a) => {
      const g = normalizeSSGroup(a.superset_group);
      if (g) used.add(g);
    });
    return SS_GROUPS.filter((g) => used.has(g));
  };

  const getNextAvailableSupersetGroup = (rows: AccDraft[]): SSGroup | null => {
    const used = new Set<string>();
    rows.forEach((a) => {
      const g = normalizeSSGroup(a.superset_group);
      if (g) used.add(g);
    });
    for (const g of SS_GROUPS) {
      if (!used.has(g)) return g;
    }
    return null;
  };

  const nextSupersetPos = (group: SSGroup, rows: AccDraft[]) => {
    let maxPos = 0;
    rows.forEach((a) => {
      if (normalizeSSGroup(a.superset_group) !== group) return;
      const p = a.superset_pos == null ? 0 : Number(a.superset_pos);
      if (Number.isFinite(p) && p > maxPos) maxPos = p;
    });
    return maxPos + 1;
  };

  const suggestedRangeLabel = (c: CoreDraft) => {
    const lo = c.target_low_kg;
    const hi = c.target_high_kg;
    if (lo == null || hi == null) return null;

    // Display-only rounding: when showing lb, round to nearest 5 lb.
    if (unit === 'lb') {
      const loLb = Math.round(kgToLb(lo) / 5) * 5;
      const hiLb = Math.round(kgToLb(hi) / 5) * 5;
      return `${loLb}–${hiLb} lb`;
    }

    return `${fmtWeight(lo)}–${fmtWeight(hi)} kg`;
  };

  // ===== Templates (mobile builder) =====
  // Endpoints expected:
  //   GET  /templates/mobile/list
  //   GET  /templates/mobile/<template_id>
  // These should be guarded server-side to only return coach-owned templates.

  const hydrateCoreFromTemplate = (rows: any[]): CoreDraft[] => {
    if (!Array.isArray(rows)) return [];
    // Helper functions for robust manual field hydration
    const numOrNull = (v: any): number | null => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const pickNum = (r: any, keys: string[]): number | null => {
      for (const k of keys) {
        const v = numOrNull(r?.[k]);
        if (v != null) return v;
      }
      return null;
    };

    return rows
      .map((r: any) => {
        const lift = (r?.lift || 'BN') as CoreDraft['lift'];
        const variant = (r?.variant || 'STRAIGHT') as CoreDraft['variant'];
        const mode = (r?.mode || 'RPE') as CoreDraft['mode'];

        const out: CoreDraft = {
          lift: lift === 'SQ' || lift === 'BN' || lift === 'DL' || lift === 'OHP' || lift === 'VR' ? lift : 'BN',
          variant: variant === 'TOP' || variant === 'BK' || variant === 'STRAIGHT' ? variant : 'STRAIGHT',
          mode: mode === 'PCT' ? 'PCT' : 'RPE',
          movement: r?.movement ?? undefined,
          sets: Number(r?.sets ?? 0),
          reps: Number(r?.reps ?? 0),
          rpe_target: r?.rpe_target == null ? null : Number(r.rpe_target),
          pct: r?.pct == null ? null : Number(r.pct),

          // Manual target fields: hydrate from multiple possible backend key names
          // (some endpoints historically used slightly different names)
          manual_target_kg: pickNum(r, [
            'manual_target_kg',
            'manual_target',
            'manual_target_weight_kg',
            'manual_load_target_kg',
          ]),
          manual_plusminus_kg: pickNum(r, [
            'manual_plusminus_kg',
            'manual_plusminus',
            'manual_plus_minus_kg',
            'manual_pm_kg',
            'manual_range_kg',
            'manual_delta_kg',
          ]),

          target_low_kg: r?.target_low_kg == null ? null : Number(r.target_low_kg),
          target_high_kg: r?.target_high_kg == null ? null : Number(r.target_high_kg),

          parent_item_id: r?.parent_item_id == null ? null : Number(r.parent_item_id),
        };

        // If manual_target exists but plusminus is missing, default plusminus to 0 so ± field doesn't render blank
        if (out.manual_target_kg != null && out.manual_plusminus_kg == null) {
          out.manual_plusminus_kg = 0;
        }

        return out;
      })
      // Filter totally empty rows
      .filter((c: CoreDraft) => !!c);
  };

  const hydrateAccFromTemplate = (rows: any[]): AccDraft[] => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r: any) => {
        const out: AccDraft = {
          movement: String(r?.movement ?? ''),
          sets: Number(r?.sets ?? 0),
          reps_text: String(r?.reps_text ?? ''),
          rir_target: r?.rir_target == null ? null : Number(r.rir_target),
          superset_group: r?.superset_group ?? null,
          superset_pos: r?.superset_pos == null ? null : Number(r.superset_pos),
        };
        return out;
      })
      // drop blank movements
      .filter((a: AccDraft) => a.movement.trim().length > 0);
  };

  const refreshSuggestionsForCore = (nextCore: CoreDraft[]) => {
    // Only compute suggestions if we have an athlete selected
    if (!athleteIdRef.current) return;

    // Clear any existing timers / sequences and keep template-provided ranges if present.
    Object.keys(suggestTimersRef.current).forEach(clearSuggestTimer);
    suggestSeqRef.current = {};

    // For rows that already have target_low/high, leave them.
    // For rows missing target range and eligible for auto-suggest, fire a suggest.
    setTimeout(() => {
      nextCore.forEach((row, i) => {
        if (!row) return;
        if (row.lift === 'VR') return;
        if (row.manual_target_kg != null && Number(row.manual_target_kg) > 0) return;
        const hasRange = row.target_low_kg != null && row.target_high_kg != null;
        if (!hasRange) {
          void suggestNow(i);
        }
      });
    }, 0);
  };

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);

    const resp = await fetchJson('/templates/mobile/list', { method: 'GET' });
    const res: any = resp.json;

    if (!resp.ok || !res?.ok) {
      const msg = res?.error || `HTTP ${resp.status}`;
      setTemplates([]);
      setTemplatesError(msg);
      setTemplatesLoading(false);
      return;
    }

    const rows: TemplateRow[] = Array.isArray(res.templates) ? res.templates : [];
    setTemplates(rows);
    setTemplatesLoading(false);
  };

  const applyTemplateById = async (templateId: number) => {
    const resp = await fetchJson(`/templates/mobile/${templateId}`, { method: 'GET' });
    const res: any = resp.json;

    if (!resp.ok || !res?.ok) {
      const msg = res?.error || `HTTP ${resp.status}`;
      setTemplatesError(msg);
      return;
    }

    const detail = res as TemplateDetail;

    const nextCore = hydrateCoreFromTemplate(detail.core_items || []);
    const nextAcc = hydrateAccFromTemplate(detail.acc_items || []);

    // Apply template label only if user hasn't typed one yet
    if (!label.trim() && detail.label) {
      setLabel(String(detail.label));
    }

    setCore(nextCore);
    setAcc(nextAcc);

    // If we want to compute missing suggested ranges, do it after state sets.
    refreshSuggestionsForCore(nextCore);
  };
  const applyManualRange = (idx: number, targetKg: number | null, plusMinusKg: number | null) => {
    const t = targetKg == null ? null : Number(targetKg);
    const pm = plusMinusKg == null ? null : Number(plusMinusKg);

    const okT = t != null && Number.isFinite(t) && t > 0;
    const okPm = pm != null && Number.isFinite(pm) && pm >= 0;

    if (!okT) {
        updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
        return;
    }

    const delta = okPm ? pm! : 0;
    updateCoreAt(idx, {
        target_low_kg: Math.max(0, t! - delta),
        target_high_kg: t! + delta,
    });
  };

  // When editing, we hydrate athleteId + items in quick succession.
  // The athleteId change effect below clears suggested ranges; skip that once during edit preload.
  const skipAthleteResetOnceRef = useRef(false);

  // ===== Edit hydration =====
  // If navigated here with ?editWorkoutId=<id>, preload the existing workout into the builder.
  useEffect(() => {
    let cancelled = false;

    async function loadForEdit(id: string) {
      if (!id) return;

      setError(null);
      setSaving(true);

      const resp = await fetchJson(`/workouts/mobile/${id}/edit_preload`, { method: 'GET' });
      const res: any = resp.json;

      if (cancelled) return;

      if (!resp.ok || !res?.ok) {
        const msg = res?.error || `HTTP ${resp.status}`;
        setError(msg || 'Failed to load workout for edit.');
        setSaving(false);
        return;
      }

      // Expected shape from mobile_edit_preload:
      // { ok, workout: { athlete_id, date, label }, core_items: [...], acc_items: [...] }
      const w = res.workout || {};

      // Hydrate basics
      const nextAthleteId = w.athlete_id != null ? String(w.athlete_id) : '';
      const nextDate = w.date ? String(w.date) : new Date().toISOString().slice(0, 10);
      const nextLabel = w.label == null ? '' : String(w.label);

      // Mark that the next athleteId change is coming from edit preload hydration.
      // This prevents the athleteId change effect from clearing preloaded ranges.
      skipAthleteResetOnceRef.current = true;

      setAthleteId(nextAthleteId);
      setDateStr(nextDate);
      setLabel(nextLabel);

      // Hydrate items (keep any template/manual fields if present)
      const nextCore = hydrateCoreFromTemplate(Array.isArray(res.core_items) ? res.core_items : []);
      const nextAcc = hydrateAccFromTemplate(Array.isArray(res.acc_items) ? res.acc_items : []);

      setCore(nextCore);
      setAcc(nextAcc);

      // Refresh any missing auto-suggestions (do not overwrite existing ranges coming from preload)
      refreshSuggestionsForCore(nextCore);

      setSaving(false);
    }

    if (editWorkoutId) {
      void loadForEdit(editWorkoutId);
    }

    return () => {
      cancelled = true;
    };
    // NOTE: hydrate helpers are stable in this file context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editWorkoutId]);

  // MVP: you can wire athlete picker from your roster payload later
  const [athleteId, setAthleteId] = useState<string>(''); // required
  const [dateStr, setDateStr] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [label, setLabel] = useState<string>('');

  const [core, setCore] = useState<CoreDraft[]>([]);
  function updateCoreAt(idx: number, patch: Partial<CoreDraft>) {
    setCore((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }
  const [acc, setAcc] = useState<AccDraft[]>([]);

    // ===== Suggested load range (live) =====
  // Calls backend to compute target_low_kg / target_high_kg from athlete TM + reps + target (RPE or %).
  // Keep latest state for async suggest calls (avoid stale closures)
    const coreRef = useRef<CoreDraft[]>([]);
    const athleteIdRef = useRef<string>('');
    const suggestTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const suggestSeqRef = useRef<Record<string, number>>({});

    useEffect(() => { coreRef.current = core; }, [core]);
    useEffect(() => { athleteIdRef.current = athleteId; }, [athleteId]);

  const clearSuggestTimer = (key: string) => {
    const t = suggestTimersRef.current[key];
    if (t) {
      clearTimeout(t);
      delete suggestTimersRef.current[key];
    }
  };

  const scheduleSuggest = (idx: number, delayMs = 250) => {
    const row = coreRef.current[idx];
    if (!row) return;

    // If manual override is set, we do NOT auto-suggest.
    if (row.manual_target_kg != null && Number(row.manual_target_kg) > 0) return;

    if (row.lift === 'VR') return;
    const key = String(idx);
    clearSuggestTimer(key);
    suggestTimersRef.current[key] = setTimeout(() => {
        void suggestNow(idx);
    }, delayMs);
  };

  const suggestNow = async (idx: number) => {
    const key = String(idx);
    // capture the sequence at invocation time
    const mySeq = (suggestSeqRef.current[key] || 0) + 1;
    suggestSeqRef.current[key] = mySeq;

    const athlete_id = Number(athleteIdRef.current);
    const c = coreRef.current[idx];
    if (!c) {
    clearSuggestTimer(key);
    delete suggestSeqRef.current[key];
    return;
    }

// If manual override is set, do not compute auto suggestions.
if (c.manual_target_kg != null && Number(c.manual_target_kg) > 0) {
  return;
}

if (c.lift === 'VR') {
  clearSuggestTimer(key);
  delete suggestSeqRef.current[key];
  return;
}

    // Require lift + reps + target
    const reps = Number(c.reps);
    if (!Number.isFinite(reps) || reps <= 0) {
      updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
      return;
    }

    const mode = c.mode;
    const rpe_target = mode === 'RPE' ? (c.rpe_target == null ? null : Number(c.rpe_target)) : null;

    let pct: number | null = null;
    if (mode === 'PCT') {
      if (c.pct == null || (c.pct as any) === '') pct = null;
      else {
        const raw = Number(c.pct);
        if (!raw || raw <= 0) pct = null;
        else pct = raw > 1 ? raw / 100 : raw; // allow 80 or 0.8
      }
    }

    if (mode === 'RPE' && (rpe_target == null || rpe_target <= 0)) {
      updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
      return;
    }
    if (mode === 'PCT' && (pct == null || pct <= 0)) {
      updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
      return;
    }

    const payload: any = { athlete_id, lift: c.lift, mode, reps };
    if (mode === 'RPE') payload.rpe_target = rpe_target;
    if (mode === 'PCT') payload.pct = pct;

    const resp = await fetchJson('/workouts/mobile/suggest_range', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    const res: any = resp.json;

    // If a newer suggest request was scheduled/started, ignore this response.
    if ((suggestSeqRef.current[key] || 0) !== mySeq) return;

    if (!resp.ok || !res?.ok) {
      // Silent fail; just clear the label
      updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
      return;
    }

    // Re-check current state before applying (user may have cleared reps/targets while request was in flight).
    const cur = coreRef.current[idx];
    const curReps = Number(cur?.reps);
    if (!cur || !Number.isFinite(curReps) || curReps <= 0) {
      updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
      return;
    }

    if (cur.mode === 'RPE') {
      const curRpe = cur.rpe_target == null ? null : Number(cur.rpe_target);
      if (curRpe == null || !Number.isFinite(curRpe) || curRpe <= 0) {
        updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
        return;
      }
    }

    if (cur.mode === 'PCT') {
      let curPct: number | null = null;
      if (cur.pct == null || (cur.pct as any) === '') curPct = null;
      else {
        const raw = Number(cur.pct);
        if (!raw || raw <= 0) curPct = null;
        else curPct = raw > 1 ? raw / 100 : raw;
      }
      if (curPct == null || !Number.isFinite(curPct) || curPct <= 0) {
        updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
        return;
      }
    }

    updateCoreAt(idx, {
      target_low_kg: res.target_low_kg ?? null,
      target_high_kg: res.target_high_kg ?? null,
    });
  };

  // When athlete changes, clear and refresh all suggestions
  useEffect(() => {
    // During edit preload hydration we set athleteId programmatically; do not wipe preloaded ranges.
    if (skipAthleteResetOnceRef.current) {
      skipAthleteResetOnceRef.current = false;
      return;
    }
    Object.keys(suggestTimersRef.current).forEach(clearSuggestTimer);
    // Core rows can be added/removed/reordered; ensure no stale indices remain.
    Object.keys(suggestSeqRef.current).forEach((k) => {
      const i = Number(k);
      if (!Number.isFinite(i) || i < 0 || i >= coreRef.current.length) {
        delete suggestSeqRef.current[k];
      }
    });
    suggestSeqRef.current = {};
    setCore((p) =>
      p.map((x) => {
        // If manual override exists, keep whatever range is present (manual ranges or template-provided).
        if (x?.manual_target_kg != null && Number(x.manual_target_kg) > 0) return x;
        // Otherwise clear range so it can be recomputed for the newly selected athlete.
        return { ...x, target_low_kg: null, target_high_kg: null };
      })
    );

    if (athleteId && core.length) {
      setTimeout(() => {
        core.forEach((_, i) => void suggestNow(i));
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  // If core items are removed/reordered, stale scheduled suggestions can reference missing indices.
  useEffect(() => {
    const len = core.length;
    Object.keys(suggestTimersRef.current).forEach((k) => {
      const i = Number(k);
      if (!Number.isFinite(i) || i < 0 || i >= len) {
        clearSuggestTimer(k);
      }
    });
    Object.keys(suggestSeqRef.current).forEach((k) => {
      const i = Number(k);
      if (!Number.isFinite(i) || i < 0 || i >= len) {
        delete suggestSeqRef.current[k];
      }
    });
  }, [core.length]);

  const coreSelectOptions = (kind: 'lift'|'scheme'|'mode') => {
    if (kind === 'lift') {
      return [
        { value: 'SQ' as const, label: 'Comp Squat' },
        { value: 'BN' as const, label: 'Comp Bench' },
        { value: 'DL' as const, label: 'Comp Deadlift' },
      ];
    }
    if (kind === 'scheme') {
        return [
            { value: 'STRAIGHT' as const, label: 'Straight' },
            { value: 'TOP_BK' as const, label: 'Top + Backdown' },
        ];
    }
    return [
      { value: 'RPE' as const, label: 'RPE' },
      { value: 'PCT' as const, label: '%' },
    ];
  };


  useEffect(() => {
    let cancelled = false;

    async function loadRoster() {
      setRosterLoading(true);
      setRosterError(null);

      const resp = await fetchJson('/coach/mobile/roster', { method: 'GET' });
      const res: any = resp.json;

      if (!resp.ok || !res?.ok) {
        const msg = res?.error || `HTTP ${resp.status}`;
        if (!cancelled) {
          setRoster([]);
          setRosterError(msg);
          setRosterLoading(false);
        }
        return;
      }

      const rows: RosterRow[] = Array.isArray(res.athletes) ? res.athletes : [];
      if (!cancelled) {
        setRoster(rows);
        setRosterLoading(false);
      }
    }

    loadRoster();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!templatePickerOpen) return;
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templatePickerOpen]);

  useEffect(() => {
    if (unit !== 'kg') setStepIssues({});
  }, [unit]);

  const selectedAthlete = useMemo(() => {
    const idNum = Number(athleteId);
    if (!idNum) return null;
    return roster.find((r) => r.id === idNum) || null;
  }, [athleteId, roster]);

  
  const isTopBkStart = (arr: CoreDraft[], idx: number) => {
    const c = arr[idx];
    const n = arr[idx + 1];
    return !!(c && n && c.variant === 'TOP' && n.variant === 'BK');
    };

    const updateTopBkPair = (idx: number, patchTop: Partial<CoreDraft>, patchBk?: Partial<CoreDraft>) => {
    setCore((p) => {
        if (!isTopBkStart(p, idx)) return p;
        return p.map((x, i) => {
        if (i === idx) return { ...x, ...patchTop };
        if (i === idx + 1) return { ...x, ...patchTop, ...(patchBk || {}) };
        return x;
        });
    });
    };

    const setSchemeAt = (idx: number, scheme: 'STRAIGHT' | 'TOP_BK') => {
    setCore((p) => {
        const c = p[idx];
        if (!c) return p;

        // Variants (VR) are always straight scheme
        if (c.lift === 'VR') {
        if (isTopBkStart(p, idx)) {
            const next = [...p];
            next[idx] = { ...next[idx], variant: 'STRAIGHT' };
            next.splice(idx + 1, 1);
            return next;
        }
        return p.map((x, i) => (i === idx ? { ...x, variant: 'STRAIGHT' } : x));
        }

        // Straight -> Top+Backdown (insert BK row)
        if (scheme === 'TOP_BK') {
        if (isTopBkStart(p, idx)) return p;

        const baseReps = Number.isFinite(Number(c.reps)) && Number(c.reps) > 0 ? Number(c.reps) : 0;
        const baseRpe = c.rpe_target == null ? null : Number(c.rpe_target);

        const top: CoreDraft = {
        ...c,
        variant: 'TOP',
        sets: 1,
        reps: baseReps,
        rpe_target: baseRpe,
        };

        const bk: CoreDraft = {
        ...c,
        variant: 'BK',
        sets: 3,
        reps: baseReps,
        rpe_target: baseRpe == null ? null : baseRpe - 1,
        parent_item_id: null,
        };

        const next = [...p];
        next[idx] = top;
        next.splice(idx + 1, 0, bk);
        return next;
        }

        // Top+Backdown -> Straight (remove BK row)
        if (scheme === 'STRAIGHT') {
        if (!isTopBkStart(p, idx)) return p.map((x, i) => (i === idx ? { ...x, variant: 'STRAIGHT' } : x));
        const next = [...p];
        next[idx] = { ...next[idx], variant: 'STRAIGHT' };
        next.splice(idx + 1, 1);
        return next;
        }

      return p;
    });
    };

    // ===== Reorder helpers (mobile builder) =====
    const moveAcc = (from: number, to: number) => {
    setAcc((p) => {
        if (from === to) return p;
        if (from < 0 || to < 0 || from >= p.length || to >= p.length) return p;
        const next = [...p];
        const [it] = next.splice(from, 1);
        next.splice(to, 0, it);
        return next;
    });
    };

    const moveCoreStraight = (from: number, to: number) => {
    setCore((p) => {
        if (from === to) return p;
        if (from < 0 || to < 0 || from >= p.length || to >= p.length) return p;
        const next = [...p];
        const [it] = next.splice(from, 1);
        next.splice(to, 0, it);
        return next;
    });
    };

    // Move a TOP+BK pair together as one unit.
    const moveCorePair = (startIdx: number, direction: -1 | 1) => {
    setCore((p) => {
        if (!isTopBkStart(p, startIdx)) return p;

        const from = startIdx;

        // down: swap pair with the element after BK
        if (direction === 1) {
        const afterIdx = from + 2;
        if (afterIdx >= p.length) return p;

        const next = [...p];
        const pair = next.splice(from, 2);      // remove TOP+BK
        const after = next.splice(from, 1)[0];  // element that was after BK is now at `from`
        next.splice(from, 0, after, ...pair);   // put after, then pair
        return next;
        }

        // up: swap pair with the element immediately before TOP
        if (direction === -1) {
        const beforeIdx = from - 1;
        if (beforeIdx < 0) return p;

        const next = [...p];
        const before = next.splice(beforeIdx, 1)[0]; // remove element before TOP
        const pair = next.splice(beforeIdx, 2);      // remove TOP+BK (now starts at beforeIdx)
        next.splice(beforeIdx, 0, ...pair, before);  // put pair, then before
        return next;
        }

        return p;
    });
    };

    const moveCore = (idx: number, direction: -1 | 1) => {
    const p = coreRef.current;

    // TOP+BK start moves as a unit
    if (isTopBkStart(p, idx)) return moveCorePair(idx, direction);

    // BK row is hidden in UI; ignore
    if (p[idx]?.variant === 'BK' && p[idx - 1]?.variant === 'TOP') return;

    // single row move
    moveCoreStraight(idx, idx + direction);
    };

    const canMoveCoreUp = (idx: number) => idx > 0;

    const canMoveCoreDown = (idx: number) => {
    const p = coreRef.current;
    if (!p.length) return false;
    if (isTopBkStart(p, idx)) return idx + 2 < p.length; // needs something after BK
    return idx + 1 < p.length;
    };

    const canMoveAccUp = (idx: number) => idx > 0;
    const canMoveAccDown = (idx: number) => idx + 1 < acc.length;
  

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const canSave = useMemo(() => {
    const noStepIssues = Object.keys(stepIssues).length === 0;
    return athleteId.trim().length > 0 && dateStr.trim().length === 10 && !saving && noStepIssues;
  }, [athleteId, dateStr, saving, stepIssues]);

  const addCore = () =>
    setCore((p) => [
        ...p,
        {
        lift: 'BN',
        variant: 'STRAIGHT',
        mode: 'RPE',
        sets: 0,
        reps: 0,
        rpe_target: null,
        pct: null,

        manual_target_kg: null,
        manual_plusminus_kg: 0,

        target_low_kg: null,
        target_high_kg: null,
        },
    ]);

  // MVP: “Core Variant” creates a TOP + BK pair in the draft.
  // Parent linking can be wired later if backend needs it.
  // Core Variant: e.g. Pause Squat, Close Grip Bench, Deficit DL, etc.
    // Always straight scheme, requires movement name, manual load range.
    const addCoreVariant = () =>
    setCore((p) => [
        ...p,
        {
        lift: 'VR',
        variant: 'STRAIGHT',
        mode: 'RPE', // irrelevant for VR but fine to keep
        movement: '',
        sets: 0,
        reps: 0,
        rpe_target: null,
        pct: null,

        manual_target_kg: null,
        manual_plusminus_kg: 0,

        target_low_kg: null,
        target_high_kg: null,
        },
    ]);

  const addAcc = () =>
    setAcc((p) => [
      ...p,
      { movement: '', sets: 3, reps_text: '10-12', rir_target: 2, superset_group: null, superset_pos: null },
    ]);

  const saveWithStatus = async (status: 'draft' | 'assigned') => {
    setError(null);

    if (unit === 'kg') {
      const issues = computeKgStepIssues();
      setStepIssues(issues);
      if (Object.keys(issues).length > 0) {
        Alert.alert('Fix load entries', 'Manual load fields must be in 2.5 kg increments.');
        return;
      }
    }

    setSaving(true);

    const payload = {
      athlete_id: Number(athleteId),
      date: dateStr,
      label: label.trim() || null,
      status, // <-- IMPORTANT
      core_items: core.map((c) => ({
        ...c,
        movement: c.movement?.trim() || null,
      })),
      acc_items: acc
        .filter((a) => a.movement.trim().length > 0)
        .map((a) => ({
          ...a,
          movement: a.movement.trim(),
          reps_text: a.reps_text.trim(),
        })),
    };

    const endpoint = editWorkoutId
      ? `/workouts/mobile/${editWorkoutId}/edit`
      : '/workouts/mobile/new';

    const resp = await fetchJson(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    const res: any = resp.json;

    if (!resp.ok || !res?.ok) {
      const msg = res?.error || `HTTP ${resp.status}`;
      setError(msg);
      setSaving(false);
      return;
    }

    setSaving(false);

    const workoutId = String(res.workout_id || editWorkoutId);

    router.replace({
      pathname: '/workout/[workoutId]',
      params: { workoutId },
    });
  };

const saveDraft = async () => saveWithStatus('draft');
const assignSession = async () => saveWithStatus('assigned');

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText variant="h1" style={styles.title}>
          {editWorkoutId ? 'Edit Session' : 'Create Session'}
        </ThemedText>

        {error && <ThemedText variant="error" style={styles.error}>{error}</ThemedText>}

        <View style={styles.card}>
          <ThemedText variant="h3" style={styles.h3}>Basics</ThemedText>

          <ThemedText variant="bodyMuted" style={styles.label}>Athlete</ThemedText>

          {rosterLoading ? (
            <View style={styles.rosterLoadingRow}>
              <ActivityIndicator />
              <ThemedText variant="bodyMuted" style={styles.rosterLoadingText}>Loading roster…</ThemedText>
            </View>
          ) : (
            <Pressable
              style={styles.selectInput}
              onPress={() => setAthletePickerOpen(true)}
            >
              <ThemedText variant="body" style={styles.selectText}>
                {selectedAthlete
                  ? `${selectedAthlete.name}${selectedAthlete.is_self ? ' (YOU)' : ''}`
                  : 'Select athlete'}
              </ThemedText>
              <ThemedText variant="bodyMuted" style={styles.selectChevron}>▾</ThemedText>
            </Pressable>
          )}

          {rosterError && (
            <ThemedText variant="error" style={styles.inlineError}>
              {rosterError}
            </ThemedText>
          )}


          <View style={styles.row}>
            <View style={styles.fieldCol}>
              <ThemedText variant="bodyMuted" style={styles.label}>
                Session Name
              </ThemedText>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="Optional"
                placeholderTextColor="#64748b"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldCol}>
              <ThemedText variant="bodyMuted" style={styles.label}>
                Date
              </ThemedText>
            <Pressable
                style={styles.selectInput}
                onPress={() => {
                  // Seed picker with current dateStr
                  const seeded = new Date(`${dateStr}T00:00:00`);
                  setTempPickedDate(isNaN(seeded.getTime()) ? new Date() : seeded);
                  setShowDatePicker(true);
                }}
                >
                <ThemedText variant="body" style={styles.selectText}>
                    {dateStr}
                </ThemedText>
              </Pressable>
            </View>



            <View style={styles.fieldCol}>
              <ThemedText variant="bodyMuted" style={styles.label}>
                Units
              </ThemedText>
              <View style={styles.unitToggleRow}>
                <Pressable
                  onPress={() => setUnit('kg')}
                  style={[styles.unitBtn, unit === 'kg' && styles.unitBtnActive]}
                >
                  <ThemedText
                    variant="badge"
                    style={[styles.unitBtnText, unit === 'kg' && styles.unitBtnTextActive]}
                  >
                    KG
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setUnit('lb')}
                  style={[styles.unitBtn, unit === 'lb' && styles.unitBtnActive]}
                >
                  <ThemedText
                    variant="badge"
                    style={[styles.unitBtnText, unit === 'lb' && styles.unitBtnTextActive]}
                  >
                    LB
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </View>


        {core.length > 0 && (
            <View style={styles.card}>
                {core.map((c, idx) => {
                    // hide the BK row if it belongs to a TOP+BK pair
                    if (c.variant === 'BK' && core[idx - 1]?.variant === 'TOP') return null;

                    const hasTopBk = c.variant === 'TOP' && core[idx + 1]?.variant === 'BK';
                    const bk = hasTopBk ? core[idx + 1] : null;

                    return (
                        <View key={idx} style={styles.block}>
                    <View style={styles.blockHeader}>
                        <ThemedText variant="body" style={styles.blockTitle}>Core {idx + 1}</ThemedText>

                        <View style={styles.blockHeaderRight}>
                            <Pressable
                            onPress={() => moveCore(idx, -1)}
                            disabled={!canMoveCoreUp(idx)}
                            style={[styles.reorderBtn, !canMoveCoreUp(idx) && styles.reorderBtnDisabled]}
                            >
                            <ThemedText variant="badge" style={styles.reorderBtnText}>↑</ThemedText>
                            </Pressable>

                            <Pressable
                            onPress={() => moveCore(idx, 1)}
                            disabled={!canMoveCoreDown(idx)}
                            style={[styles.reorderBtn, !canMoveCoreDown(idx) && styles.reorderBtnDisabled]}
                            >
                            <ThemedText variant="badge" style={styles.reorderBtnText}>↓</ThemedText>
                            </Pressable>

                            {/* keep your existing Remove button */}
                            <Pressable
                            onPress={() =>
                                setCore((p) => {
                                if (isTopBkStart(p, idx)) return p.filter((_, i) => i !== idx && i !== idx + 1);
                                return p.filter((_, i) => i !== idx);
                                })
                            }
                            style={styles.removeBtn}
                            >
                            <ThemedText variant="badge" style={styles.removeBtnText}>Remove</ThemedText>
                            </Pressable>
                        </View>
                    </View>

                    {/* Lift */}
                    <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Lift</ThemedText>

                    {c.lift === 'VR' ? (
                        <TextInput
                        value={c.movement || ''}
                        onChangeText={(v) => updateCoreAt(idx, { movement: v })}
                        placeholder="e.g. Pause Squat"
                        placeholderTextColor="#64748b"
                        style={styles.input}
                        />
                    ) : (
                    <Pressable
                        style={styles.selectInput}
                        onPress={() => setCoreSelectOpen({ kind: 'lift', idx })}
                    >
                        <ThemedText variant="body" style={styles.selectText}>
                        {coreLiftLabel(c.lift)}
                        </ThemedText>
                        <ThemedText variant="bodyMuted" style={styles.selectChevron}>▾</ThemedText>
                    </Pressable>
                    )}

                    {/* Scheme + Mode row */}
                    {c.lift === 'VR' ? (
                      // Variant: Scheme + Mode (locked, non-interactive, in a row)
                      <View style={styles.row}>
                        <View style={styles.fieldCol}>
                          <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Scheme</ThemedText>
                          <View style={styles.selectInput}>
                            <ThemedText variant="body" style={styles.selectText}>Straight</ThemedText>
                          </View>
                        </View>
                        <View style={styles.fieldCol}>
                          <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Mode</ThemedText>
                          <View style={styles.selectInput}>
                            <ThemedText variant="body" style={styles.selectText}>RPE</ThemedText>
                          </View>
                        </View>
                      </View>
                    ) : (
                      // Core: Scheme + Mode (interactive, in a row)
                      <View style={styles.row}>
                        <View style={styles.fieldCol}>
                          <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Scheme</ThemedText>
                          <Pressable
                            style={styles.selectInput}
                            onPress={() => setCoreSelectOpen({ kind: 'scheme', idx })}
                          >
                            <ThemedText variant="body" style={styles.selectText}>
                              {coreSchemeLabel(core, idx)}
                            </ThemedText>
                            <ThemedText variant="bodyMuted" style={styles.selectChevron}>▾</ThemedText>
                          </Pressable>
                        </View>
                        <View style={styles.fieldCol}>
                          <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Mode</ThemedText>
                          <Pressable
                            style={styles.selectInput}
                            onPress={() => setCoreSelectOpen({ kind: 'mode', idx })}
                          >
                            <ThemedText variant="body" style={styles.selectText}>
                              {coreModeLabel(c.mode)}
                            </ThemedText>
                            <ThemedText variant="bodyMuted" style={styles.selectChevron}>▾</ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {/* Variant details (lives under Scheme) OR Mode selector for standard core */}
                    {c.lift === 'VR' ? (
                    <>
                        {/* Variant scheme inputs (always Straight) */}
                        <View style={styles.row}>
                        <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Sets</ThemedText>
                            <TextInput
                            value={String(c.sets)}
                            onChangeText={(v) => updateCoreAt(idx, { sets: Number(v || 0) })}
                            keyboardType="number-pad"
                            placeholder="3"
                            placeholderTextColor="#64748b"
                            style={[styles.input, styles.inputSm]}
                            />
                        </View>

                        <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Reps</ThemedText>
                            <TextInput
                            value={String(c.reps)}
                            onChangeText={(v) => updateCoreAt(idx, { reps: Number(v || 0) })}
                            keyboardType="number-pad"
                            placeholder="5"
                            placeholderTextColor="#64748b"
                            style={[styles.input, styles.inputSm]}
                            />
                        </View>

                        <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>RPE</ThemedText>
                            <TextInput
                            value={c.rpe_target == null ? '' : String(c.rpe_target)}
                            onChangeText={(v) => updateCoreAt(idx, { rpe_target: v === '' ? null : Number(v) })}
                            keyboardType="decimal-pad"
                            placeholder="7"
                            placeholderTextColor="#64748b"
                            style={[styles.input, styles.inputSm]}
                            />
                        </View>
                        </View>

                        {/* Manual load entry: Target Load and ± Range on same row */}
                        <View style={styles.row}>
                          <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Target Load ({unit})</ThemedText>
                            <TextInput
                              value={getDraft(keyForManualTarget(idx), c.manual_target_kg)}
                              onChangeText={(v) => setDraft(keyForManualTarget(idx), v)}
                              onBlur={() => {
                                const key = keyForManualTarget(idx);
                                const nKg = parseDisplayWeightToKg(getDraft(key, c.manual_target_kg));
                                updateCoreAt(idx, { manual_target_kg: nKg });
                                applyManualRange(idx, nKg, c.manual_plusminus_kg ?? 0);
                                validateKgStep(key, nKg);
                                clearDraft(key);
                              }}
                              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                              autoCorrect={false}
                              autoCapitalize="none"
                              placeholder="Required"
                              placeholderTextColor="#64748b"
                              style={[styles.input, styles.inputSm]}
                            />
                          </View>

                          <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>± Range ({unit})</ThemedText>
                            <TextInput
                              value={getDraft(keyForManualPm(idx), c.manual_plusminus_kg)}
                              onChangeText={(v) => setDraft(keyForManualPm(idx), v)}
                              onBlur={() => {
                                const key = keyForManualPm(idx);
                                const pmKg = parseDisplayDeltaToKg(getDraft(key, c.manual_plusminus_kg));
                                updateCoreAt(idx, { manual_plusminus_kg: pmKg });
                                applyManualRange(idx, c.manual_target_kg ?? null, pmKg);
                                validateKgStep(key, pmKg, true);
                                clearDraft(key);
                              }}
                              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                              autoCorrect={false}
                              autoCapitalize="none"
                              placeholder="e.g. 5"
                              placeholderTextColor="#64748b"
                              style={[styles.input, styles.inputSm]}
                            />
                          </View>
                        </View>
                        {unit === 'kg' && (stepIssues[`core:${idx}:manual_target`] || stepIssues[`core:${idx}:manual_pm`]) ? (
                          <ThemedText variant="bodyMuted" style={styles.stepWarn}>
                            {stepIssues[`core:${idx}:manual_target`] || stepIssues[`core:${idx}:manual_pm`]}
                          </ThemedText>
                        ) : null}

                        {(() => {
                        const sr = suggestedRangeLabel(c);
                        if (!sr) return null;
                        return (
                            <View style={styles.suggestRow}>
                            <ThemedText variant="bodyMuted" style={styles.suggestLabel}>Suggested load</ThemedText>
                            <ThemedText variant="body" style={styles.suggestValue}>{sr}</ThemedText>
                            </View>
                        );
                        })()}
                    </>
                    ) : null}


                    {!hasTopBk && c.lift !== 'VR' && (
                    <>
                    <View style={styles.row}>
                        <View style={styles.fieldCol}>
                        <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Sets</ThemedText>
                        <TextInput
                            value={String(c.sets)}
                            onChangeText={(v) => updateCoreAt(idx, { sets: Number(v || 0) })}
                            keyboardType="number-pad"
                            placeholder="3"
                            placeholderTextColor="#64748b"
                            style={[styles.input, styles.inputSm]}
                        />
                        </View>

                        <View style={styles.fieldCol}>
                        <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Reps</ThemedText>
                        <TextInput
                            value={String(c.reps)}
                            onChangeText={(v) => {
                              const nextReps = Number(v || 0);
                              updateCoreAt(idx, { reps: nextReps });

                              // If reps cleared, nuke suggestion and invalidate any in-flight response
                              if (!Number.isFinite(nextReps) || nextReps <= 0) {
                                const key = String(idx);
                                suggestSeqRef.current[key] = (suggestSeqRef.current[key] || 0) + 1;
                                updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
                                return;
                              }

                              if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) {
                                scheduleSuggest(idx);
                                }
                            }}
                            keyboardType="number-pad"
                            placeholder="5"
                            placeholderTextColor="#64748b"
                            style={[styles.input, styles.inputSm]}
                        />
                        </View>

                        <View style={styles.fieldCol}>
                        <ThemedText variant="bodyMuted" style={styles.fieldLabel}>{c.mode === 'PCT' ? '%' : 'RPE'}</ThemedText>
                        <TextInput
                            value={c.mode === 'PCT'
                            ? (c.pct == null ? '' : String(c.pct))
                            : (c.rpe_target == null ? '' : String(c.rpe_target))}
                            onChangeText={(v) => {
                            if (c.mode === 'PCT') updateCoreAt(idx, { pct: v === '' ? null : Number(v) });
                            else updateCoreAt(idx, { rpe_target: v === '' ? null : Number(v) });
                            if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) {
                              scheduleSuggest(idx);
                            }
                            }}
                            keyboardType="decimal-pad"
                            placeholder={c.mode === 'PCT' ? '80' : '7'}
                            placeholderTextColor="#64748b"
                            style={[styles.input, styles.inputSm]}
                        />
                        </View>
                    </View>
                    {/* Manual load override (optional). If set, overrides auto suggested range. */}
                    <View style={styles.row}>
                      <View style={styles.fieldCol}>
                        <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Manual Target ({unit})</ThemedText>
                        <TextInput
                          value={getDraft(keyForManualTarget(idx), c.manual_target_kg)}
                          onChangeText={(v) => setDraft(keyForManualTarget(idx), v)}
                          onBlur={() => {
                            const key = keyForManualTarget(idx);
                            const nKg = parseDisplayWeightToKg(getDraft(key, c.manual_target_kg));

                            const seqKey = String(idx);
                            suggestSeqRef.current[seqKey] = (suggestSeqRef.current[seqKey] || 0) + 1;
                            clearSuggestTimer(seqKey);

                            updateCoreAt(idx, { manual_target_kg: nKg });
                            applyManualRange(idx, nKg, c.manual_plusminus_kg ?? 0);
                            validateKgStep(key, nKg);

                            if (nKg == null) scheduleSuggest(idx);

                            clearDraft(key);
                          }}
                          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                          autoCorrect={false}
                          autoCapitalize="none"
                          placeholder="Optional"
                          placeholderTextColor="#64748b"
                          style={[styles.input, styles.inputSm]}
                        />
                      </View>

                      <View style={styles.fieldCol}>
                        <ThemedText variant="bodyMuted" style={styles.fieldLabel}>± Range ({unit})</ThemedText>
                        <TextInput
                          value={getDraft(keyForManualPm(idx), c.manual_plusminus_kg)}
                          onChangeText={(v) => setDraft(keyForManualPm(idx), v)}
                          onBlur={() => {
                            const key = keyForManualPm(idx);
                            const pmKg = parseDisplayDeltaToKg(getDraft(key, c.manual_plusminus_kg));

                            const seqKey = String(idx);
                            suggestSeqRef.current[seqKey] = (suggestSeqRef.current[seqKey] || 0) + 1;
                            clearSuggestTimer(seqKey);

                            updateCoreAt(idx, { manual_plusminus_kg: pmKg });
                            applyManualRange(idx, c.manual_target_kg ?? null, pmKg);
                            validateKgStep(key, pmKg, true);

                            clearDraft(key);
                          }}
                          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                          autoCorrect={false}
                          autoCapitalize="none"
                          placeholder="e.g. 5"
                          placeholderTextColor="#64748b"
                          style={[styles.input, styles.inputSm]}
                        />
                      </View>
                    </View>
                    {unit === 'kg' && (stepIssues[`core:${idx}:manual_target`] || stepIssues[`core:${idx}:manual_pm`]) ? (
                      <ThemedText variant="bodyMuted" style={styles.stepWarn}>
                        {stepIssues[`core:${idx}:manual_target`] || stepIssues[`core:${idx}:manual_pm`]}
                      </ThemedText>
                    ) : null}
                    {(() => {
                      const sr = suggestedRangeLabel(c);
                      if (!sr) return null;
                      return (
                        <View style={styles.suggestRow}>
                          <ThemedText variant="bodyMuted" style={styles.suggestLabel}>
                            {c.manual_target_kg != null && Number(c.manual_target_kg) > 0 ? 'Manual load range' : 'Suggested load'}
                          </ThemedText>
                          <ThemedText variant="body" style={styles.suggestValue}>{sr}</ThemedText>
                        </View>
                      );
                    })()}
                    </>
                    )}

                    {hasTopBk && bk && (
                    <View style={{ gap: 10 }}>
                        <View>
                        <ThemedText variant="body" style={styles.subRowLabel}>Top</ThemedText>
                        <View style={styles.row}>
                            <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Sets</ThemedText>
                            <TextInput
                                value={String(c.sets)}
                                onChangeText={(v) => updateTopBkPair(idx, { sets: Number(v || 0) })}
                                keyboardType="number-pad"
                                placeholder="1"
                                placeholderTextColor="#64748b"
                                style={[styles.input, styles.inputSm]}
                            />
                            </View>

                            <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Reps</ThemedText>
                            <TextInput
                                value={String(c.reps)}
                                onChangeText={(v) => {
                                  const nextReps = Number(v || 0);
                                  updateTopBkPair(idx, { reps: nextReps });

                                  if (!Number.isFinite(nextReps) || nextReps <= 0) {
                                    const key = String(idx);
                                    suggestSeqRef.current[key] = (suggestSeqRef.current[key] || 0) + 1;
                                    updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
                                    return;
                                  }

                                  if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) {
                                    scheduleSuggest(idx);
                                  }
                                }}
                                keyboardType="number-pad"
                                placeholder="5"
                                placeholderTextColor="#64748b"
                                style={[styles.input, styles.inputSm]}
                            />
                            </View>

                            <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>{c.mode === 'PCT' ? '%' : 'RPE'}</ThemedText>
                            <TextInput
                                value={c.mode === 'PCT'
                                ? (c.pct == null ? '' : String(c.pct))
                                : (c.rpe_target == null ? '' : String(c.rpe_target))}
                                onChangeText={(v) => {
                                if (c.mode === 'PCT') updateTopBkPair(idx, { pct: v === '' ? null : Number(v) });
                                else updateTopBkPair(idx, { rpe_target: v === '' ? null : Number(v) });
                                if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) {
                                  scheduleSuggest(idx);
                                }
                                }}
                                keyboardType="decimal-pad"
                                placeholder={c.mode === 'PCT' ? '80' : '7'}
                                placeholderTextColor="#64748b"
                                style={[styles.input, styles.inputSm]}
                            />
                            </View>
                        </View>
                        {/* Manual load override (Top) */}
                        <View style={styles.row}>
                          <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Manual Target ({unit})</ThemedText>
                            <TextInput
                              value={getDraft(keyForManualTarget(idx), c.manual_target_kg)}
                              onChangeText={(v) => setDraft(keyForManualTarget(idx), v)}
                              onBlur={() => {
                                const key = keyForManualTarget(idx);
                                const nKg = parseDisplayWeightToKg(getDraft(key, c.manual_target_kg));
                                updateCoreAt(idx, { manual_target_kg: nKg });
                                applyManualRange(idx, nKg, c.manual_plusminus_kg ?? 0);
                                validateKgStep(key, nKg);
                                clearDraft(key);
                              }}
                              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                              autoCorrect={false}
                              autoCapitalize="none"
                              placeholder="Optional"
                              placeholderTextColor="#64748b"
                              style={[styles.input, styles.inputSm]}
                            />
                          </View>

                          {unit === 'kg' && (stepIssues[`core:${idx}:manual_target`] || stepIssues[`core:${idx}:manual_pm`]) ? (
                            <ThemedText variant="bodyMuted" style={styles.stepWarn}>
                              {stepIssues[`core:${idx}:manual_target`] || stepIssues[`core:${idx}:manual_pm`]}
                            </ThemedText>
                          ) : null}

                          <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>± Range ({unit})</ThemedText>
                            <TextInput
                              value={getDraft(keyForManualPm(idx), c.manual_plusminus_kg)}
                              onChangeText={(v) => setDraft(keyForManualPm(idx), v)}
                              onBlur={() => {
                                const key = keyForManualPm(idx);
                                const pmKg = parseDisplayDeltaToKg(getDraft(key, c.manual_plusminus_kg));
                                updateCoreAt(idx, { manual_plusminus_kg: pmKg });
                                applyManualRange(idx, c.manual_target_kg ?? null, pmKg);
                                validateKgStep(key, pmKg, true);
                                clearDraft(key);
                              }}
                              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                              autoCorrect={false}
                              autoCapitalize="none"
                              placeholder="e.g. 5"
                              placeholderTextColor="#64748b"
                              style={[styles.input, styles.inputSm]}
                            />
                          </View>
                        </View>
                        {(() => {
                          const sr = suggestedRangeLabel(c);
                          if (!sr) return null;
                          return (
                            <View style={styles.suggestRow}>
                              <ThemedText variant="bodyMuted" style={styles.suggestLabel}>
                                {c.manual_target_kg != null && Number(c.manual_target_kg) > 0 ? 'Manual load range' : 'Suggested load'}
                              </ThemedText>
                              <ThemedText variant="body" style={styles.suggestValue}>{sr}</ThemedText>
                            </View>
                          );
                        })()}
                        </View>

                        <View>
                        <ThemedText variant="body" style={styles.subRowLabel}>Backdown</ThemedText>
                        <View style={styles.row}>
                            <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Sets</ThemedText>
                            <TextInput
                                value={String(bk.sets)}
                                onChangeText={(v) => updateTopBkPair(idx, {}, { sets: Number(v || 0) })}
                                keyboardType="number-pad"
                                placeholder="3"
                                placeholderTextColor="#64748b"
                                style={[styles.input, styles.inputSm]}
                            />
                            </View>

                            <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Reps</ThemedText>
                            <TextInput
                                value={String(bk.reps)}
                                onChangeText={(v) => {
                                  const nextReps = Number(v || 0);
                                  updateTopBkPair(idx, {}, { reps: nextReps });

                                  if (!Number.isFinite(nextReps) || nextReps <= 0) {
                                    const key = String(idx + 1);
                                    suggestSeqRef.current[key] = (suggestSeqRef.current[key] || 0) + 1;
                                    updateCoreAt(idx + 1, { target_low_kg: null, target_high_kg: null });
                                    return;
                                  }

                                  if (!(bk.manual_target_kg != null && Number(bk.manual_target_kg) > 0)) {
                                    scheduleSuggest(idx + 1);
                                  }
                                }}
                                keyboardType="number-pad"
                                placeholder="5"
                                placeholderTextColor="#64748b"
                                style={[styles.input, styles.inputSm]}
                            />
                            </View>

                            <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>{bk.mode === 'PCT' ? '%' : 'RPE'}</ThemedText>
                            <TextInput
                                value={bk.mode === 'PCT'
                                ? (bk.pct == null ? '' : String(bk.pct))
                                : (bk.rpe_target == null ? '' : String(bk.rpe_target))}
                                onChangeText={(v) => {
                                if (bk.mode === 'PCT') updateTopBkPair(idx, {}, { pct: v === '' ? null : Number(v) });
                                else updateTopBkPair(idx, {}, { rpe_target: v === '' ? null : Number(v) });
                                if (!(bk.manual_target_kg != null && Number(bk.manual_target_kg) > 0)) {
                                  scheduleSuggest(idx + 1);
                                }
                                }}
                                keyboardType="decimal-pad"
                                placeholder={bk.mode === 'PCT' ? '75' : '6'}
                                placeholderTextColor="#64748b"
                                style={[styles.input, styles.inputSm]}
                            />
                            </View>
                        </View>
                        {/* Manual load override (Backdown) */}
                        <View style={styles.row}>
                          <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Manual Target ({unit})</ThemedText>
                            <TextInput
                              value={getDraft(keyForManualTarget(idx + 1), bk.manual_target_kg)}
                              onChangeText={(v) => setDraft(keyForManualTarget(idx + 1), v)}
                              onBlur={() => {
                                const key = keyForManualTarget(idx + 1);
                                const nKg = parseDisplayWeightToKg(getDraft(key, bk.manual_target_kg));
                                updateCoreAt(idx + 1, { manual_target_kg: nKg });
                                applyManualRange(idx + 1, nKg, bk.manual_plusminus_kg ?? 0);
                                validateKgStep(key, nKg);
                                clearDraft(key);
                              }}
                              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                              autoCorrect={false}
                              autoCapitalize="none"
                              placeholder="Optional"
                              placeholderTextColor="#64748b"
                              style={[styles.input, styles.inputSm]}
                            />
                          </View>

                          <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>± Range ({unit})</ThemedText>
                            <TextInput
                              value={getDraft(keyForManualPm(idx + 1), bk.manual_plusminus_kg)}
                              onChangeText={(v) => setDraft(keyForManualPm(idx + 1), v)}
                              onBlur={() => {
                                const key = keyForManualPm(idx + 1);
                                const pmKg = parseDisplayDeltaToKg(getDraft(key, bk.manual_plusminus_kg));
                                updateCoreAt(idx + 1, { manual_plusminus_kg: pmKg });
                                applyManualRange(idx + 1, bk.manual_target_kg ?? null, pmKg);
                                validateKgStep(key, pmKg, true);
                                clearDraft(key);
                              }}
                              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                              autoCorrect={false}
                              autoCapitalize="none"
                              placeholder="e.g. 5"
                              placeholderTextColor="#64748b"
                              style={[styles.input, styles.inputSm]}
                            />
                          </View>
                        </View>
                        {(() => {
                          const sr = suggestedRangeLabel(bk);
                          if (!sr) return null;
                          return (
                            <View style={styles.suggestRow}>
                              <ThemedText variant="bodyMuted" style={styles.suggestLabel}>
                                {bk.manual_target_kg != null && Number(bk.manual_target_kg) > 0 ? 'Manual load range' : 'Suggested load'}
                              </ThemedText>
                              <ThemedText variant="body" style={styles.suggestValue}>{sr}</ThemedText>
                            </View>
                          );
                        })()}
                        </View>
                    </View>
                    )}
                </View>
                );
              })}
            </View>
        )}

        {acc.length > 0 && (
            <View style={styles.card}>
                {acc.map((a, idx) => (
                <View key={idx} style={styles.block}>
                    <View style={styles.blockHeader}>
                        <ThemedText variant="body" style={styles.blockTitle}>Accessory {idx + 1}</ThemedText>

                        <View style={styles.blockHeaderRight}>
                            <Pressable
                            onPress={() => moveAcc(idx, idx - 1)}
                            disabled={!canMoveAccUp(idx)}
                            style={[styles.reorderBtn, !canMoveAccUp(idx) && styles.reorderBtnDisabled]}
                            >
                            <ThemedText variant="badge" style={styles.reorderBtnText}>↑</ThemedText>
                            </Pressable>

                            <Pressable
                            onPress={() => moveAcc(idx, idx + 1)}
                            disabled={!canMoveAccDown(idx)}
                            style={[styles.reorderBtn, !canMoveAccDown(idx) && styles.reorderBtnDisabled]}
                            >
                            <ThemedText variant="badge" style={styles.reorderBtnText}>↓</ThemedText>
                            </Pressable>

                            <Pressable
                            onPress={() => setAcc((p) => p.filter((_, i) => i !== idx))}
                            style={styles.removeBtn}
                            >
                            <ThemedText variant="badge" style={styles.removeBtnText}>Remove</ThemedText>
                            </Pressable>
                        </View>
                    </View>

                    <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Movement</ThemedText>
                    <TextInput
                      value={a.movement}
                      onChangeText={(v) =>
                        setAcc((p) => p.map((x, i) => (i === idx ? { ...x, movement: v } : x)))
                      }
                      placeholder="e.g. Lat Pulldown"
                      placeholderTextColor="#64748b"
                      style={styles.input}
                    />

                    {/* Superset grouping */}
                    <View style={styles.row}>
                      <View style={[styles.fieldCol, { flex: 1 }]}>
                        <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Superset</ThemedText>
                        <Pressable
                          style={styles.selectInput}
                          onPress={() => setAccSupersetSelectOpen({ idx })}
                        >
                          <ThemedText variant="body" style={styles.selectText}>
                            {normalizeSSGroup(a.superset_group) ? `Group ${normalizeSSGroup(a.superset_group)}` : 'None'}
                          </ThemedText>
                          <ThemedText variant="bodyMuted" style={styles.selectChevron}>▾</ThemedText>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.row}>
                      <View style={styles.fieldCol}>
                        <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Sets</ThemedText>
                        <TextInput
                          value={String(a.sets)}
                          onChangeText={(v) =>
                            setAcc((p) =>
                              p.map((x, i) => (i === idx ? { ...x, sets: Number(v || 0) } : x))
                            )
                          }
                          placeholder="3"
                          placeholderTextColor="#64748b"
                          keyboardType="number-pad"
                          style={[styles.input, styles.inputSm]}
                        />
                      </View>

                      <View style={styles.fieldCol}>
                        <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Reps</ThemedText>
                        <TextInput
                          value={a.reps_text}
                          onChangeText={(v) =>
                            setAcc((p) =>
                              p.map((x, i) => (i === idx ? { ...x, reps_text: v } : x))
                            )
                          }
                          placeholder="10-12"
                          placeholderTextColor="#64748b"
                          style={[styles.input, styles.inputLg]}
                        />
                      </View>

                      <View style={styles.fieldCol}>
                        <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Target RIR</ThemedText>
                        <TextInput
                          value={a.rir_target == null ? '' : String(a.rir_target)}
                          onChangeText={(v) =>
                            setAcc((p) =>
                              p.map((x, i) =>
                                i === idx
                                  ? { ...x, rir_target: v === '' ? null : Number(v) }
                                  : x
                              )
                            )
                          }
                          placeholder="2"
                          placeholderTextColor="#64748b"
                          keyboardType="decimal-pad"
                          style={[styles.input, styles.inputSm]}
                        />
                      </View>
                    </View>
                </View>
                ))}
            </View>
        )}

        <View style={styles.addRow}>
          <Pressable
            style={[styles.addLiftBtn, styles.addLeft]}
            onPress={() => setAddLiftOpen(true)}
          >
            <ThemedText variant="h3" style={styles.addLiftText}>+ Add Lift</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.addLiftBtn, styles.addRight]}
            onPress={() => {
              const hasDraft = core.length > 0 || acc.length > 0 || !!label.trim();
              if (!hasDraft) {
                setTemplatePickerOpen(true);
                return;
              }
              Alert.alert(
                'Load template?',
                'This will replace your current draft in the builder.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Replace',
                    style: 'destructive',
                    onPress: () => setTemplatePickerOpen(true),
                  },
                ]
              );
            }}
          >
            <ThemedText variant="h3" style={styles.addTemplateText}>Load Template</ThemedText>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          {editWorkoutId && (
            <Pressable style={[styles.cancelBtn]} onPress={() => router.back()}>
              <ThemedText variant="h3" style={styles.cancelText}>Cancel</ThemedText>
            </Pressable>
          )}

          <Pressable
            style={[styles.cancelBtn, !canSave && styles.btnDisabled]}
            disabled={!canSave}
            onPress={saveDraft}
          >
            <ThemedText variant="h3" style={styles.cancelText}>Save Draft</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.saveBtn, !canSave && styles.btnDisabled]}
            disabled={!canSave}
            onPress={assignSession}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <ThemedText variant="h3" style={styles.saveText}>Assign Session</ThemedText>
            )}
          </Pressable>
        </View>

        {/* Accessory superset picker */}
        <Modal
          visible={!!accSupersetSelectOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setAccSupersetSelectOpen(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <ThemedText variant="h3" style={styles.modalTitle}>Superset</ThemedText>

                <TouchableOpacity
                  onPress={() => setAccSupersetSelectOpen(null)}
                  style={styles.modalClose}
                  accessibilityLabel="Close superset selector"
                >
                  <ThemedText variant="badge" style={styles.modalCloseText}>✕</ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 420 }}>
                {/* None */}
                <TouchableOpacity
                  style={styles.modalRow}
                  onPress={() => {
                    const idx = accSupersetSelectOpen?.idx;
                    if (idx == null) return;
                    setAcc((p) =>
                      p.map((x, i) =>
                        i === idx ? { ...x, superset_group: null, superset_pos: null } : x
                      )
                    );
                    setAccSupersetSelectOpen(null);
                  }}
                >
                  <ThemedText variant="body" style={styles.modalRowText}>None</ThemedText>
                </TouchableOpacity>

                {SS_GROUPS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={styles.modalRow}
                    onPress={() => {
                      const idx = accSupersetSelectOpen?.idx;
                      if (idx == null) return;
                      setAcc((p) =>
                        p.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                superset_group: g,
                                superset_pos: nextSupersetPos(g, p),
                              }
                            : x
                        )
                      );
                      setAccSupersetSelectOpen(null);
                    }}
                  >
                    <ThemedText variant="body" style={styles.modalRowText}>Group {g}</ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={templatePickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setTemplatePickerOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <ThemedText variant="h3" style={styles.modalTitle}>Load template</ThemedText>
                <TouchableOpacity
                  onPress={() => setTemplatePickerOpen(false)}
                  style={styles.modalClose}
                  accessibilityLabel="Close template picker"
                >
                  <ThemedText variant="badge" style={styles.modalCloseText}>✕</ThemedText>
                </TouchableOpacity>
              </View>

              {templatesLoading ? (
                <View style={styles.rosterLoadingRow}>
                  <ActivityIndicator />
                  <ThemedText variant="bodyMuted" style={styles.rosterLoadingText}>Loading templates…</ThemedText>
                </View>
              ) : null}

              {templatesError ? (
                <ThemedText variant="error" style={styles.inlineError}>{templatesError}</ThemedText>
              ) : null}

              <ScrollView style={{ maxHeight: 420 }}>
                {templates.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.modalRow}
                    onPress={async () => {
                      // Replace current draft immediately (confirm handled before opening modal)
                      await applyTemplateById(t.id);
                      setTemplatePickerOpen(false);
                    }}
                  >
                    <ThemedText variant="body" style={styles.modalRowText}>
                      {t.name}
                    </ThemedText>
                    {t.updated_at ? (
                      <ThemedText variant="bodyMuted" style={{ color: '#9CA3AF', marginTop: 4, fontSize: 12 }}>
                        Updated {t.updated_at}
                      </ThemedText>
                    ) : null}
                  </TouchableOpacity>
                ))}

                {templates.length === 0 && !templatesLoading ? (
                  <ThemedText variant="bodyMuted" style={styles.muted}>
                    No templates yet.
                  </ThemedText>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
            visible={addLiftOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setAddLiftOpen(false)}
            >
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                    <ThemedText variant="h3" style={styles.modalTitle}>Add lift</ThemedText>
                    <TouchableOpacity
                    onPress={() => setAddLiftOpen(false)}
                    style={styles.modalClose}
                    accessibilityLabel="Close add lift"
                    >
                    <ThemedText variant="badge" style={styles.modalCloseText}>✕</ThemedText>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.addLiftChoice}
                    onPress={() => {
                    addCore();
                    setAddLiftOpen(false);
                    }}
                >
                    <ThemedText variant="body" style={styles.addLiftChoiceTitle}>Core</ThemedText>
                    <ThemedText variant="bodyMuted" style={styles.addLiftChoiceSub}>Straight sets core lift</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.addLiftChoice}
                    onPress={() => {
                    addCoreVariant();
                    setAddLiftOpen(false);
                    }}
                >
                    <ThemedText variant="body" style={styles.addLiftChoiceTitle}>Core Variant</ThemedText>
                    <ThemedText variant="bodyMuted" style={styles.addLiftChoiceSub}>Input SBD Variants</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.addLiftChoice}
                    onPress={() => {
                    addAcc();
                    setAddLiftOpen(false);
                    }}
                >
                    <ThemedText variant="body" style={styles.addLiftChoiceTitle}>Accessory</ThemedText>
                    <ThemedText variant="bodyMuted" style={styles.addLiftChoiceSub}>Accessory movement</ThemedText>
                </TouchableOpacity>
                </View>
            </View>
        </Modal>

        {/* Core dropdown picker (Lift / Scheme / Mode) */}
        <Modal
          visible={!!coreSelectOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setCoreSelectOpen(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <ThemedText variant="h3" style={styles.modalTitle}>
                  {coreSelectOpen?.kind === 'lift'
                    ? 'Select lift'
                    : coreSelectOpen?.kind === 'scheme'
                    ? 'Select scheme'
                    : 'Select mode'}
                </ThemedText>

                <TouchableOpacity
                  onPress={() => setCoreSelectOpen(null)}
                  style={styles.modalClose}
                  accessibilityLabel="Close selector"
                >
                  <ThemedText variant="badge" style={styles.modalCloseText}>✕</ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 420 }}>
                {coreSelectOpen &&
                  coreSelectOptions(coreSelectOpen.kind).map((opt) => (
                    <TouchableOpacity
                      key={String(opt.value)}
                      style={styles.modalRow}
                      onPress={() => {
                        const { idx, kind } = coreSelectOpen;

                        if (kind === 'lift') {
                            if (isTopBkStart(core, idx)) updateTopBkPair(idx, { lift: opt.value as CoreDraft['lift'] });
                            else updateCoreAt(idx, { lift: opt.value as CoreDraft['lift'] });

                            scheduleSuggest(idx);
                            if (isTopBkStart(core, idx)) scheduleSuggest(idx + 1);
                        }

                        if (kind === 'scheme') {
                            setSchemeAt(idx, opt.value as any);
                            scheduleSuggest(idx);

                            setTimeout(() => {
                            if (isTopBkStart(core, idx)) scheduleSuggest(idx + 1);
                            }, 0);
                        }

                        if (kind === 'mode') {
                            if (isTopBkStart(core, idx)) updateTopBkPair(idx, { mode: opt.value as CoreDraft['mode'] });
                            else updateCoreAt(idx, { mode: opt.value as CoreDraft['mode'] });

                            scheduleSuggest(idx);
                            if (isTopBkStart(core, idx)) scheduleSuggest(idx + 1);
                        }

                        setCoreSelectOpen(null);
                        }}
                    >
                      <ThemedText variant="body" style={styles.modalRowText}>
                        {opt.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

      <Modal
        visible={athletePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAthletePickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h3" style={styles.modalTitle}>Select athlete</ThemedText>
              <TouchableOpacity
                onPress={() => setAthletePickerOpen(false)}
                style={styles.modalClose}
                accessibilityLabel="Close athlete picker"
              >
                <ThemedText variant="badge" style={styles.modalCloseText}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {roster.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.modalRow}
                  onPress={() => {
                    setAthleteId(String(r.id));
                    setAthletePickerOpen(false);
                  }}
                >
                  <ThemedText variant="body" style={styles.modalRowText}>
                    {r.name}{r.is_self ? ' (YOU)' : ''}
                  </ThemedText>
                </TouchableOpacity>
              ))}

              {roster.length === 0 && !rosterLoading && (
                <ThemedText variant="bodyMuted" style={styles.muted}>
                  No athletes found.
                </ThemedText>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date picker modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.dateModalCard]}>
            <View style={styles.modalHeader}>
              <ThemedText variant="h3" style={styles.modalTitle}>Select date</ThemedText>
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={styles.modalClose}
                accessibilityLabel="Close date picker"
              >
                <ThemedText variant="badge" style={styles.modalCloseText}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.datePickerBody}>
              <DateTimePicker
                value={tempPickedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                themeVariant="dark"
                textColor={Platform.OS === 'ios' ? '#E5E7EB' : undefined}
                onChange={(event, selected) => {
                    // Android: picker closes; commit immediately on "set"
                    if (Platform.OS === 'android') {
                    setShowDatePicker(false);
                    if ((event as any)?.type === 'set' && selected) {
                        setTempPickedDate(selected);
                        setDateStr(formatDateYMD(selected)); // <-- THIS updates the field
                    }
                    return;
                    }

                    // iOS inline: update temp live; commit on Done
                    if (selected) setTempPickedDate(selected);
                }}
              />
            </View>

            <View style={styles.dateActionRow}>
              <Pressable
                style={[styles.cancelBtn, styles.dateActionBtn]}
                onPress={() => setShowDatePicker(false)}
              >
                <ThemedText variant="h3" style={styles.cancelText}>Cancel</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.saveBtn, styles.dateActionBtn]}
                onPress={() => {
                  setDateStr(formatDateYMD(tempPickedDate));
                  setShowDatePicker(false);
                }}
              >
                <ThemedText variant="h3" style={styles.saveText}>Done</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  scroll: { paddingBottom: 40 },
  title: { marginTop: 12, marginBottom: 8, color: '#fff', fontSize: 22, fontWeight: '700' },
  error: { marginTop: 6, color: '#f97373' },

  card: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  h3: { color: '#E5E7EB', fontSize: 16, fontWeight: '600' },
  label: { marginTop: 10, color: '#9CA3AF' },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E5E7EB',
  },
  rowBetween: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  smallBtn: {
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  smallBtnText: { color:'#E5E7EB' },

  block: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(31,41,55,0.8)' },
  blockTitle: { color:'#E5E7EB', marginBottom: 6 },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  removeBtn: {
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.7)',
    backgroundColor: 'rgba(127,29,29,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  removeBtnText: {
    color: '#fecaca',
    fontWeight: '700',
  },

  row: { flexDirection:'row', gap: 8 },
  unitToggleRow: {
    marginTop: 6,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
  },
  unitBtnActive: {
    backgroundColor: 'rgba(56,189,248,0.18)',
  },
  unitBtnText: {
    color: '#E5E7EB',
    fontWeight: '800',
  },
  unitBtnTextActive: {
    color: '#38bdf8',
  },
  inputSm: { flex: 1 },
  inputLg: { flex: 2 },

  muted: { marginTop: 8, color:'#9CA3AF' },

  saveBtn: {
    flex: 1,
    marginTop: 14,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#0b1220',
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },

  selectInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: '#E5E7EB',
    fontSize: 14,
    flexShrink: 1,
  },
  selectChevron: {
    marginLeft: 10,
    color: '#9CA3AF',
  },
  inlineError: {
    marginTop: 6,
    color: '#f97373',
  },
  rosterLoadingRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rosterLoadingText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '92%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#020617',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  modalClose: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalCloseText: {
    color: '#E5E7EB',
  },
  modalRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,41,55,0.8)',
  },
  modalRowText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  addLiftBtn: {
    marginTop: 10,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#38bdf8',
  },
  addLiftText: {
    color: '#020617',
  },
  addRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  addLeft: {
    flex: 1,
  },
  addRight: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  addTemplateText: {
    color: '#E5E7EB',
  },
  addLiftChoice: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(31,41,55,0.8)',
  },
  addLiftChoiceTitle: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
  },
  addLiftChoiceSub: {
    marginTop: 4,
    color: '#9CA3AF',
    fontSize: 12,
  },
  fieldCol: {
    flex: 1,
  },
  fieldLabel: {
    marginTop: 8,
    marginBottom: 4,
    color: '#9CA3AF',
    fontSize: 12,
  },
  pillsRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 6,
},
pill: {
  borderWidth: 1,
  borderColor: 'rgba(148,163,184,0.35)',
  backgroundColor: '#0b1220',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 999,
},
pillActive: {
  borderColor: '#38bdf8',
  backgroundColor: 'rgba(56,189,248,0.18)',
},
pillText: {
  color: '#E5E7EB',
  fontWeight: '700',
},
pillTextActive: {
  color: '#38bdf8',
},
subRowLabel: {
  marginTop: 10,
  color: '#E5E7EB',
  fontSize: 13,
  fontWeight: '700',
},
suggestRow: {
  marginTop: 8,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderWidth: 1,
  borderColor: 'rgba(148,163,184,0.22)',
  borderRadius: 12,
  backgroundColor: '#0b1220',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
suggestLabel: {
  color: '#9CA3AF',
  fontSize: 12,
},
suggestValue: {
  color: '#E5E7EB',
  fontSize: 13,
  fontWeight: '700',
},
blockHeaderRight: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
reorderBtn: {
  borderWidth: 1,
  borderColor: 'rgba(148,163,184,0.35)',
  backgroundColor: '#0b1220',
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
},
reorderBtnDisabled: {
  opacity: 0.35,
},
reorderBtnText: {
  color: '#E5E7EB',
  fontWeight: '900',
},

  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },

  cancelBtn: {
    flex: 1,
    marginTop: 14,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: '#0b1220',
  },

  cancelText: {
    color: '#E5E7EB',
  },
  dateModalCard: {
    width: '96%',
    maxWidth: 520,
  },
  datePickerBody: {
    paddingVertical: 6,
  },
  dateActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  dateActionBtn: {
    flex: 1,
  },
  stepWarn: {
    marginTop: 6,
    color: '#f97316',
    fontSize: 12,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});