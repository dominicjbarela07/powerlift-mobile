import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, TextInput, Modal, TouchableOpacity, ActivityIndicator, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { useLocalSearchParams } from 'expo-router';
import { fetchJson } from '@/lib/api';
import { simplifyMobileMovementName } from '@/lib/mobileMovementNames';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  AccessoryMovementCard,
  CoreMovementCard,
  CreatorAdvancedSection,
  CreatorChoiceChips,
  CreatorRpeSelector,
  CreatorSegmentedControl,
  CreatorStepper,
} from '@/components/creator';

type CoreDraft = {
  lift: 'SQ'|'BN'|'DL'|'OHP'|'VR';
  variant: 'STRAIGHT'|'TOP'|'BK'|'FULL_CUSTOM';
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
  planned_sets?: PlannedSetDraft[];
};

type PlannedSetDraft = {
  set_index: number;
  reps?: number | null;
  rpe_target?: number | null;
  pct?: number | null;
  manual_target_kg?: number | null;
  manual_pm_kg?: number | null;
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

type MovementPresetCategory = {
  key?: string;
  name: string;
  movements: string[];
};

type RecentSessionRow = {
  id: number;
  date?: string | null;
  label?: string | null;
  status?: string | null;
  planned_summary?: string | null;
};

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function isValidYMD(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return false;
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export default function CreateWorkoutScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isIndividual =
    user?.workspace_mode === 'individual' ||
      user?.is_individual_workspace === true ||
      user?.is_self_coached === true;
  const params = useLocalSearchParams<{
    editWorkoutId?: string | string[];
    athleteId?: string | string[];
    athleteName?: string | string[];
    date?: string | string[];
  }>();
  const editWorkoutId = firstParam(params?.editWorkoutId);
  const prefillAthleteIdParam = firstParam(params?.athleteId);
  const prefillAthleteNameParam = firstParam(params?.athleteName);
  const prefillDateParam = firstParam(params?.date);

  // Field programming guardrail:
  // This mobile creator owns one session at a time. Do not expand it into bulk
  // programming, template authoring, or block architecture; those stay web-first.

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

  const parseOptionalNumberInput = (s: string): number | null => {
    const t = normalizeDecimalInput(String(s ?? '')).trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

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
  const keyForPlannedManualTarget = (coreIdx: number, setIdx: number) => `core:${coreIdx}:planned:${setIdx}:manual_target`;
  const keyForPlannedManualPm = (coreIdx: number, setIdx: number) => `core:${coreIdx}:planned:${setIdx}:manual_pm`;
  const MAX_FULL_CUSTOM_SETS = 12;

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
      if (c?.variant === 'FULL_CUSTOM') {
        normalizePlannedSets(c.planned_sets, c).forEach((ps, psIdx) => {
          const target = ps.manual_target_kg;
          const pm = ps.manual_pm_kg;
          if (target != null && Number.isFinite(Number(target)) && Number(target) > 0 && !isMultipleOfStep(Number(target), KG_STEP)) {
            issues[keyForPlannedManualTarget(idx, psIdx)] = 'Must be in 2.5 kg increments';
          }
          if (pm != null && Number.isFinite(Number(pm)) && Number(pm) >= 0 && !isMultipleOfStep(Number(pm), KG_STEP)) {
            issues[keyForPlannedManualPm(idx, psIdx)] = 'Must be in 2.5 kg increments';
          }
        });
        return;
      }
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
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [athletePickerOpen, setAthletePickerOpen] = useState(false);
  const [addLiftOpen, setAddLiftOpen] = useState(false);
  const [coreEditorOpen, setCoreEditorOpen] = useState<null | { idx: number }>(null);
  const [accEditorOpen, setAccEditorOpen] = useState<null | { idx: number }>(null);
  const [movementPickerOpen, setMovementPickerOpen] = useState<null | { kind: 'accessory'|'variant'; idx: number }>(null);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementPresets, setMovementPresets] = useState<{
    accessories: MovementPresetCategory[];
    coreVariants: MovementPresetCategory[];
  }>({ accessories: [], coreVariants: [] });
  const [movementPresetsLoading, setMovementPresetsLoading] = useState(false);
  const [movementPresetsError, setMovementPresetsError] = useState<string | null>(null);
  const [coreSelectOpen, setCoreSelectOpen] = useState<null | { kind: 'lift'|'scheme'|'mode'; idx: number }>(null);

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateReplaceConfirmOpen, setTemplateReplaceConfirmOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [copyExistingOpen, setCopyExistingOpen] = useState(false);
  const [copyReplaceConfirmSource, setCopyReplaceConfirmSource] = useState<RecentSessionRow | null>(null);
  const [quickStartNotice, setQuickStartNotice] = useState<null | { title: string; body: string }>(null);
  const [copySessions, setCopySessions] = useState<RecentSessionRow[]>([]);
  const [copySessionsLoading, setCopySessionsLoading] = useState(false);
  const [copySessionsError, setCopySessionsError] = useState<string | null>(null);
  const [copySearch, setCopySearch] = useState('');
  const [copyApplying, setCopyApplying] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState<Record<string, boolean>>({});
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
    if (v === 'SQ') return simplifyMobileMovementName('Competition Squat');
    if (v === 'BN') return simplifyMobileMovementName('Competition Bench');
    if (v === 'DL') return simplifyMobileMovementName('Competition Deadlift');
    if (v === 'OHP') return 'OHP';
    return 'Variant';
  };

  const plannedSetSummary = (rows?: PlannedSetDraft[]) => {
    const count = Array.isArray(rows) ? rows.length : 0;
    if (!count) return 'No planned sets returned.';
    return `${count} planned set${count === 1 ? '' : 's'} preserved`;
  };

  const coreSchemeLabel = (arr: CoreDraft[], idx: number) => {
    const c = arr[idx];
    const n = arr[idx + 1];
    if (c?.variant === 'FULL_CUSTOM') return 'Full Custom';
    if (c?.variant === 'TOP' && n?.variant === 'BK') return 'Top + Backdown';
    return 'Straight';
  };

  const coreModeLabel = (v: CoreDraft['mode']) => (v === 'RPE' ? 'RPE' : '%');

  const coreMovementTitle = (c: CoreDraft) => {
    if (c.lift === 'VR') return c.movement?.trim() || 'Core Variant';
    return coreLiftLabel(c.lift);
  };

  const formatTarget = (mode: CoreDraft['mode'], rpe?: number | null, pct?: number | null) => {
    if (mode === 'PCT') {
      if (pct == null) return '%';
      return `@ ${Number(pct) > 1 ? pct : Math.round(Number(pct) * 100)}%`;
    }
    return rpe == null ? '@ RPE' : `@ RPE ${rpe}`;
  };

  const corePrescriptionSummary = (arr: CoreDraft[], idx: number) => {
    const c = arr[idx];
    const bk = c?.variant === 'TOP' && arr[idx + 1]?.variant === 'BK' ? arr[idx + 1] : null;
    if (!c) return 'No prescription';

    if (c.variant === 'FULL_CUSTOM') {
      const rows = normalizePlannedSets(c.planned_sets, c);
      return `Full Custom · ${rows.length} planned set${rows.length === 1 ? '' : 's'}`;
    }

    if (bk) {
      return `Top + Backdown · ${c.sets || 1}x${c.reps || '-'} ${formatTarget(c.mode, c.rpe_target, c.pct)} + ${bk.sets || '-'}x${bk.reps || '-'} ${formatTarget(bk.mode, bk.rpe_target, bk.pct)}`;
    }

    const scheme = c.lift === 'VR' ? 'Variant' : 'Straight Sets';
    return `${scheme} · ${c.sets || '-'}x${c.reps || '-'} ${formatTarget(c.mode, c.rpe_target, c.pct)}`;
  };

  const liftIconLabel = (lift: CoreDraft['lift']) => {
    if (lift === 'SQ') return 'SQ';
    if (lift === 'BN') return 'BN';
    if (lift === 'DL') return 'DL';
    if (lift === 'OHP') return 'OH';
    return 'VR';
  };

  const liftToneStyle = (lift: CoreDraft['lift']) => {
    if (lift === 'SQ') return styles.iconSquat;
    if (lift === 'BN') return styles.iconBench;
    if (lift === 'DL') return styles.iconDeadlift;
    if (lift === 'OHP') return styles.iconOhp;
    return styles.iconVariant;
  };

  const accessorySummary = (a: AccDraft) => {
    const parts = [`${a.sets || '-'}x${a.reps_text?.trim() || '-'}`];
    if (a.rir_target != null) parts.push(`RIR ${a.rir_target}`);
    const group = normalizeSSGroup(a.superset_group);
    if (group) parts.push(`Group ${group}`);
    return parts.join(' · ');
  };

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

  const canRequestSuggestedLoad = (c?: CoreDraft | null) => {
    if (!c) return false;
    if (c.variant === 'FULL_CUSTOM') return false;
    if (c.lift === 'VR') return false;
    if (c.manual_target_kg != null && Number(c.manual_target_kg) > 0) return false;

    const reps = Number(c.reps);
    if (!Number.isFinite(reps) || reps <= 0) return false;

    if (c.mode === 'PCT') {
      const pct = c.pct == null ? null : Number(c.pct);
      return pct != null && Number.isFinite(pct) && pct > 0;
    }

    const rpe = c.rpe_target == null ? null : Number(c.rpe_target);
    return rpe != null && Number.isFinite(rpe) && rpe > 0;
  };

  const devLogSuggest = (...args: unknown[]) => {
    if (__DEV__) console.log('[create-workout:suggest]', ...args);
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

    const hydratePlannedSets = (rows: any[]): PlannedSetDraft[] => {
      if (!Array.isArray(rows)) return [];
      return rows
        .map((r: any, idx: number): PlannedSetDraft | null => {
          if (!r || typeof r !== 'object') return null;
          const setIndex = Number(r.set_index ?? r.set ?? r.idx ?? idx + 1);
          if (!Number.isFinite(setIndex) || setIndex <= 0) return null;
          return {
            set_index: setIndex,
            reps: numOrNull(r.reps),
            rpe_target: numOrNull(r.rpe_target ?? r.rpe),
            pct: numOrNull(r.pct),
            manual_target_kg: numOrNull(r.manual_target_kg ?? r.target_kg ?? r.manual_kg),
            manual_pm_kg: numOrNull(r.manual_pm_kg ?? r.plus_kg ?? r.plus_minus_kg) ?? 0,
          };
        })
        .filter((row): row is PlannedSetDraft => !!row)
        .sort((a, b) => a.set_index - b.set_index);
    };

    return rows
      .map((r: any) => {
        const lift = (r?.lift || 'BN') as CoreDraft['lift'];
        const variant = (r?.variant || 'STRAIGHT') as CoreDraft['variant'];
        const mode = (r?.mode || 'RPE') as CoreDraft['mode'];
        const plannedSets = hydratePlannedSets(r?.planned_sets || []);
        const isFullCustom = variant === 'FULL_CUSTOM';

        const out: CoreDraft = {
          lift: lift === 'SQ' || lift === 'BN' || lift === 'DL' || lift === 'OHP' || lift === 'VR' ? lift : 'BN',
          variant: variant === 'TOP' || variant === 'BK' || variant === 'STRAIGHT' || variant === 'FULL_CUSTOM' ? variant : 'STRAIGHT',
          mode: mode === 'PCT' ? 'PCT' : 'RPE',
          movement: r?.movement ?? undefined,
          sets: isFullCustom ? plannedSets.length || Number(r?.sets ?? 0) : Number(r?.sets ?? 0),
          reps: isFullCustom ? 0 : Number(r?.reps ?? 0),
          rpe_target: isFullCustom ? null : (r?.rpe_target == null ? null : Number(r.rpe_target)),
          pct: isFullCustom ? null : (r?.pct == null ? null : Number(r.pct)),

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
          planned_sets: isFullCustom ? plannedSets : undefined,
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

  const loadCopyExistingSessions = async (query = '') => {
    if (!athleteId.trim()) {
      setQuickStartNotice({
        title: 'Select athlete',
        body: 'Choose an athlete before copying an existing session.',
      });
      return;
    }

    setCopySessionsLoading(true);
    setCopySessionsError(null);

    const searchPart = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : '';
    const resp = await fetchJson(
      `/coach/mobile/athletes/${encodeURIComponent(athleteId)}/sessions/recent?limit=30${searchPart}`,
      { method: 'GET' }
    );
    const res: any = resp.json;

    if (!resp.ok || !res?.ok) {
      const msg = res?.error || `HTTP ${resp.status}`;
      setCopySessions([]);
      setCopySessionsError(msg);
      setCopySessionsLoading(false);
      return;
    }

    setCopySessions(Array.isArray(res.sessions) ? res.sessions : []);
    setCopySessionsLoading(false);
  };

  const openCopyExisting = () => {
    if (editWorkoutId) return;
    if (!athleteId.trim()) {
      setQuickStartNotice({
        title: 'Select athlete',
        body: 'Choose an athlete before copying an existing session.',
      });
      return;
    }
    setCopySearch('');
    setCopyExistingOpen(true);
    void loadCopyExistingSessions('');
  };

  const loadMovementPresets = async () => {
    setMovementPresetsLoading(true);
    setMovementPresetsError(null);

    const resp = await fetchJson('/workouts/mobile/movement_presets', { method: 'GET' });
    const res: any = resp.json;

    if (!resp.ok || !res?.ok) {
      setMovementPresets({ accessories: [], coreVariants: [] });
      setMovementPresetsError(res?.error || `HTTP ${resp.status}`);
      setMovementPresetsLoading(false);
      return;
    }

    setMovementPresets({
      accessories: Array.isArray(res.accessories?.categories) ? res.accessories.categories : [],
      coreVariants: Array.isArray(res.core_variants?.categories) ? res.core_variants.categories : [],
    });
    setMovementPresetsLoading(false);
  };

  useEffect(() => {
    void loadMovementPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openMovementPicker = (kind: 'accessory'|'variant', idx: number) => {
    setMovementSearch('');
    setMovementPickerOpen({ kind, idx });
    if (!movementPresetsLoading && !movementPresets.accessories.length && !movementPresets.coreVariants.length) {
      void loadMovementPresets();
    }
  };

  const selectMovementPreset = (movement: string) => {
    const picker = movementPickerOpen;
    if (!picker) return;

    if (picker.kind === 'accessory') {
      setAcc((p) => p.map((x, i) => (i === picker.idx ? { ...x, movement } : x)));
    } else {
      updateCoreAt(picker.idx, { movement });
    }

    setMovementPickerOpen(null);
    setMovementSearch('');
  };

  const filteredMovementCategories = (kind: 'accessory'|'variant') => {
    const query = movementSearch.trim().toLowerCase();
    const categories = kind === 'accessory' ? movementPresets.accessories : movementPresets.coreVariants;
    return categories
      .map((category) => {
        const movements = Array.isArray(category.movements) ? category.movements : [];
        const filtered = query
          ? movements.filter((movement) => movement.toLowerCase().includes(query))
          : movements;
        return { ...category, movements: filtered };
      })
      .filter((category) => category.movements.length > 0);
  };

  const applyCopyExistingSession = async (source: RecentSessionRow, skipConfirm = false) => {
    if (!source?.id) return;

    const applySource = async () => {
      setCopyApplying(true);
      setCopySessionsError(null);

      const resp = await fetchJson(`/workouts/mobile/${source.id}/edit_preload`, { method: 'GET' });
      const res: any = resp.json;

      if (!resp.ok || !res?.ok) {
        const msg = res?.error || `HTTP ${resp.status}`;
        setCopySessionsError(msg);
        setCopyApplying(false);
        return;
      }

      const nextCore = hydrateCoreFromTemplate(Array.isArray(res.core_items) ? res.core_items : []);
      const nextAcc = hydrateAccFromTemplate(Array.isArray(res.acc_items) ? res.acc_items : []);
      const sourceLabel = String(source.label || res.workout?.label || 'Session').trim();

      setCore(nextCore);
      setAcc(nextAcc);
      setManualDraft({});
      setStepIssues({});
      if (!label.trim() && sourceLabel) {
        setLabel(`Copy of ${sourceLabel}`.slice(0, 80));
      }
      refreshSuggestionsForCore(nextCore);

      setCopyApplying(false);
      setCopyExistingOpen(false);
    };

    const hasDraft = core.length > 0 || acc.length > 0 || !!label.trim();
    if (hasDraft && !skipConfirm) {
      setCopyReplaceConfirmSource(source);
      return;
    }

    await applySource();
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
  // Editing sessions that already have logs/completion state is high risk because
  // the mobile edit endpoint rebuilds workout items; keep deeper edit safeguards deferred.
  const skipAthleteResetOnceRef = useRef(false);
  const prefillAppliedRef = useRef(false);
  const routeContextRef = useRef<string | null>(null);

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
  const suggestSignatureRef = useRef<Record<string, string>>({});

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
    if (!row) {
      devLogSuggest('schedule skipped: missing row', { idx });
      return;
    }

    const key = String(idx);
    clearSuggestTimer(key);
    devLogSuggest('schedule', {
      idx,
      delayMs,
      athleteId,
      lift: row.lift,
      mode: row.mode,
      reps: row.reps,
      rpe_target: row.rpe_target,
      pct: row.pct,
      manual_target_kg: row.manual_target_kg,
    });
    suggestTimersRef.current[key] = setTimeout(() => {
      void suggestNow(idx);
    }, delayMs);
  };

  const scheduleSuggestAfterState = (...indices: number[]) => {
    setTimeout(() => {
      indices.forEach((idx) => {
        if (Number.isFinite(idx) && idx >= 0) scheduleSuggest(idx);
      });
    }, 0);
  };

  const suggestNow = async (idx: number) => {
    const key = String(idx);
    // capture the sequence at invocation time
    const mySeq = (suggestSeqRef.current[key] || 0) + 1;
    suggestSeqRef.current[key] = mySeq;

    const athlete_id = Number(athleteIdRef.current);
    const c = coreRef.current[idx];
    if (!c) {
      devLogSuggest('skipped: missing row at request time', { idx });
      clearSuggestTimer(key);
      delete suggestSeqRef.current[key];
      return;
    }

    // If manual override is set, do not compute auto suggestions.
    if (c.manual_target_kg != null && Number(c.manual_target_kg) > 0) {
      devLogSuggest('skipped: manual target present', {
        idx,
        athlete_id,
        lift: c.lift,
        mode: c.mode,
        reps: c.reps,
        rpe_target: c.rpe_target,
        pct: c.pct,
        manual_target_kg: c.manual_target_kg,
      });
      return;
    }

    if (c.lift === 'VR') {
      devLogSuggest('skipped: variant lift has no standalone suggestion', { idx, athlete_id });
      clearSuggestTimer(key);
      delete suggestSeqRef.current[key];
      return;
    }

    // Require lift + reps + target
    const reps = Number(c.reps);
    if (!Number.isFinite(reps) || reps <= 0) {
      devLogSuggest('skipped: invalid reps', {
        idx,
        athlete_id,
        lift: c.lift,
        mode: c.mode,
        reps: c.reps,
        rpe_target: c.rpe_target,
        pct: c.pct,
        manual_target_kg: c.manual_target_kg,
      });
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
      devLogSuggest('skipped: invalid RPE target', {
        idx,
        athlete_id,
        lift: c.lift,
        mode,
        reps,
        rpe_target: c.rpe_target,
        pct: c.pct,
        manual_target_kg: c.manual_target_kg,
      });
      updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
      return;
    }
    if (mode === 'PCT' && (pct == null || pct <= 0)) {
      devLogSuggest('skipped: invalid pct', {
        idx,
        athlete_id,
        lift: c.lift,
        mode,
        reps,
        rpe_target: c.rpe_target,
        pct: c.pct,
        manual_target_kg: c.manual_target_kg,
      });
      updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
      return;
    }

    const payload: any = { athlete_id, lift: c.lift, mode, reps };
    if (mode === 'RPE') payload.rpe_target = rpe_target;
    if (mode === 'PCT') payload.pct = pct;

    devLogSuggest('request', {
      idx,
      athlete_id,
      lift: c.lift,
      mode,
      reps,
      rpe_target,
      pct,
      manual_target_kg: c.manual_target_kg,
      payload,
    });

    const resp = await fetchJson('/workouts/mobile/suggest_range', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });

    const res: any = resp.json;
    devLogSuggest('response', {
      idx,
      status: resp.status,
      ok: resp.ok,
      json: res,
    });

    // If a newer suggest request was scheduled/started, ignore this response.
    if ((suggestSeqRef.current[key] || 0) !== mySeq) {
      devLogSuggest('ignored stale response', { idx, mySeq, latestSeq: suggestSeqRef.current[key] });
      return;
    }

    if (!resp.ok || !res?.ok) {
      // Silent fail; just clear the label
      devLogSuggest('clearing range: response not ok', { idx, status: resp.status, json: res });
      updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
      return;
    }

    // Re-check current state before applying (user may have cleared reps/targets while request was in flight).
    const cur = coreRef.current[idx];
    const curReps = Number(cur?.reps);
    if (!cur || !Number.isFinite(curReps) || curReps <= 0) {
      devLogSuggest('clearing range: current row invalid after response', { idx, cur });
      updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
      return;
    }

    if (cur.mode === 'RPE') {
      const curRpe = cur.rpe_target == null ? null : Number(cur.rpe_target);
      if (curRpe == null || !Number.isFinite(curRpe) || curRpe <= 0) {
        devLogSuggest('clearing range: current RPE invalid after response', { idx, cur });
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
        devLogSuggest('clearing range: current pct invalid after response', { idx, cur });
        updateCoreAt(idx, { target_low_kg: null, target_high_kg: null });
        return;
      }
    }

    devLogSuggest('apply range', {
      idx,
      athlete_id,
      lift: c.lift,
      mode,
      reps,
      rpe_target,
      pct,
      target_low_kg: res.target_low_kg ?? null,
      target_high_kg: res.target_high_kg ?? null,
    });
    updateCoreAt(idx, {
      target_low_kg: res.target_low_kg ?? null,
      target_high_kg: res.target_high_kg ?? null,
    });
  };

  const suggestSignatureForRow = (row: CoreDraft | undefined, athleteIdValue: string) => {
    if (!row) return null;
    if (row.variant === 'FULL_CUSTOM') return null;
    if (row.lift === 'VR') return null;
    return [
      athleteIdValue,
      row.lift,
      row.mode,
      row.reps ?? '',
      row.rpe_target ?? '',
      row.pct ?? '',
      row.manual_target_kg ?? '',
    ].join('|');
  };

  useEffect(() => {
    const activeKeys = new Set<string>();

    core.forEach((row, idx) => {
      const key = String(idx);
      const signature = suggestSignatureForRow(row, athleteId);
      if (!signature) {
        delete suggestSignatureRef.current[key];
        return;
      }

      activeKeys.add(key);
      if (suggestSignatureRef.current[key] === signature) return;
      suggestSignatureRef.current[key] = signature;

      if (row.manual_target_kg != null && Number(row.manual_target_kg) > 0) return;
      scheduleSuggest(idx, 80);
    });

    Object.keys(suggestSignatureRef.current).forEach((key) => {
      if (!activeKeys.has(key)) delete suggestSignatureRef.current[key];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, athleteId]);

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
      // OHP is intentionally hidden from the modern mobile core-work flow;
      // historical OHP sessions still hydrate, render, and save safely.
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
            { value: 'FULL_CUSTOM' as const, label: 'Full Custom' },
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
      setRosterLoaded(false);
      setRosterError(null);

      const resp = await fetchJson('/coach/mobile/roster', { method: 'GET' });
      const res: any = resp.json;

      if (!resp.ok || !res?.ok) {
        const msg = res?.error || `HTTP ${resp.status}`;
        if (!cancelled) {
          setRoster([]);
          setRosterError(msg);
          setRosterLoading(false);
          setRosterLoaded(true);
        }
        return;
      }

      const rows: RosterRow[] = Array.isArray(res.athletes) ? res.athletes : [];
      if (!cancelled) {
        setRoster(rows);
        if (isIndividual && !editWorkoutId && !prefillAthleteIdParam.trim()) {
          const selfRow = rows.find((row) => row.is_self) || rows[0];
          if (selfRow?.id) setAthleteId(String(selfRow.id));
        }
        setRosterLoading(false);
        setRosterLoaded(true);
      }
    }

    loadRoster();

    return () => {
      cancelled = true;
    };
  }, [editWorkoutId, isIndividual, prefillAthleteIdParam]);

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

  useEffect(() => {
    if (editWorkoutId || prefillAppliedRef.current) return;

    const wantsAthletePrefill = prefillAthleteIdParam.trim().length > 0;
    if (wantsAthletePrefill && !rosterLoaded) return;

    if (prefillDateParam && isValidYMD(prefillDateParam)) {
      setDateStr(prefillDateParam);
    }

    const requestedAthleteId = Number(prefillAthleteIdParam);
    if (Number.isFinite(requestedAthleteId) && requestedAthleteId > 0) {
      const match = roster.find((row) => row.id === requestedAthleteId);
      if (match) {
        setAthleteId(String(match.id));
      }
    }

    prefillAppliedRef.current = true;
  }, [editWorkoutId, prefillAthleteIdParam, prefillDateParam, roster, rosterLoaded]);

  
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

    const normalizePlannedSets = (rows?: PlannedSetDraft[], fallback?: CoreDraft): PlannedSetDraft[] => {
    const source = Array.isArray(rows) ? rows : [];
    const normalized = source
        .slice(0, MAX_FULL_CUSTOM_SETS)
        .map((row, i) => ({
        set_index: i + 1,
        reps: row.reps ?? null,
        rpe_target: row.rpe_target ?? null,
        pct: row.pct ?? null,
        manual_target_kg: row.manual_target_kg ?? null,
        manual_pm_kg: row.manual_pm_kg ?? 0,
        }));

    if (normalized.length) return normalized;
    return [{
        set_index: 1,
        reps: fallback?.reps && fallback.reps > 0 ? fallback.reps : null,
        rpe_target: fallback?.mode === 'RPE' ? (fallback.rpe_target ?? null) : null,
        pct: fallback?.mode === 'PCT' ? (fallback.pct ?? null) : null,
        manual_target_kg: fallback?.manual_target_kg ?? null,
        manual_pm_kg: fallback?.manual_plusminus_kg ?? 0,
    }];
    };

    const updatePlannedSetAt = (coreIdx: number, plannedIdx: number, patch: Partial<PlannedSetDraft>) => {
    setCore((p) =>
        p.map((x, i) => {
        if (i !== coreIdx || x.variant !== 'FULL_CUSTOM') return x;
        const rows = normalizePlannedSets(x.planned_sets, x);
        const nextRows = rows.map((row, j) => (j === plannedIdx ? { ...row, ...patch } : row));
        return { ...x, sets: nextRows.length, planned_sets: nextRows };
        })
    );
    };

    const addPlannedSet = (coreIdx: number) => {
    setCore((p) =>
        p.map((x, i) => {
        if (i !== coreIdx || x.variant !== 'FULL_CUSTOM') return x;
        const rows = normalizePlannedSets(x.planned_sets, x);
        if (rows.length >= MAX_FULL_CUSTOM_SETS) return x;
        const last = rows[rows.length - 1];
        const nextRows = [
            ...rows,
            {
            set_index: rows.length + 1,
            reps: last?.reps ?? null,
            rpe_target: x.mode === 'RPE' ? (last?.rpe_target ?? null) : null,
            pct: x.mode === 'PCT' ? (last?.pct ?? null) : null,
            manual_target_kg: null,
            manual_pm_kg: 0,
            },
        ];
        return { ...x, sets: nextRows.length, planned_sets: nextRows };
        })
    );
    };

    const removePlannedSet = (coreIdx: number, plannedIdx: number) => {
    setCore((p) =>
        p.map((x, i) => {
        if (i !== coreIdx || x.variant !== 'FULL_CUSTOM') return x;
        const rows = normalizePlannedSets(x.planned_sets, x);
        if (rows.length <= 1) return x;
        const nextRows = rows
            .filter((_, j) => j !== plannedIdx)
            .map((row, j) => ({ ...row, set_index: j + 1 }));
        return { ...x, sets: nextRows.length, planned_sets: nextRows };
        })
    );
    };

    const setFullCustomModeAt = (idx: number, mode: CoreDraft['mode']) => {
    setCore((p) =>
        p.map((x, i) => {
        if (i !== idx) return x;
        const rows = x.variant === 'FULL_CUSTOM'
            ? normalizePlannedSets(x.planned_sets, x).map((row) => ({
                ...row,
                rpe_target: mode === 'RPE' ? row.rpe_target : null,
                pct: mode === 'PCT' ? row.pct : null,
            }))
            : x.planned_sets;
        return { ...x, mode, planned_sets: rows };
        })
    );
    };

    const setSchemeAt = (idx: number, scheme: 'STRAIGHT' | 'TOP_BK' | 'FULL_CUSTOM') => {
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

        if (scheme === 'FULL_CUSTOM') {
        const next = [...p];
        if (isTopBkStart(p, idx)) next.splice(idx + 1, 1);
        const current = next[idx];
        next[idx] = {
            ...current,
            variant: 'FULL_CUSTOM',
            sets: normalizePlannedSets(current.planned_sets, current).length,
            reps: 0,
            rpe_target: null,
            pct: null,
            target_low_kg: null,
            target_high_kg: null,
            planned_sets: normalizePlannedSets(current.planned_sets, current),
        };
        return next;
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
        planned_sets: undefined,
        };

        const bk: CoreDraft = {
        ...c,
        variant: 'BK',
        sets: 3,
        reps: baseReps,
        rpe_target: baseRpe == null ? null : baseRpe - 1,
        parent_item_id: null,
        planned_sets: undefined,
        };

        const next = [...p];
        next[idx] = top;
        next.splice(idx + 1, 0, bk);
        return next;
        }

        // Top+Backdown -> Straight (remove BK row)
        if (scheme === 'STRAIGHT') {
        if (!isTopBkStart(p, idx)) return p.map((x, i) => (
            i === idx
            ? {
                ...x,
                variant: 'STRAIGHT',
                sets: x.variant === 'FULL_CUSTOM' ? Math.max(1, x.planned_sets?.length || x.sets || 1) : x.sets,
                reps: x.variant === 'FULL_CUSTOM' ? (x.planned_sets?.[0]?.reps ?? 0) : x.reps,
                rpe_target: x.variant === 'FULL_CUSTOM' && x.mode === 'RPE' ? (x.planned_sets?.[0]?.rpe_target ?? null) : x.rpe_target,
                pct: x.variant === 'FULL_CUSTOM' && x.mode === 'PCT' ? (x.planned_sets?.[0]?.pct ?? null) : x.pct,
                planned_sets: undefined,
            }
            : x
        ));
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

  const resetBuilderStateForCreate = () => {
    Object.keys(suggestTimersRef.current).forEach(clearSuggestTimer);
    suggestSeqRef.current = {};
    skipAthleteResetOnceRef.current = false;
    prefillAppliedRef.current = false;

    setAthleteId('');
    setDateStr(new Date().toISOString().slice(0, 10));
    setLabel('');
    setCore([]);
    setAcc([]);
    setManualDraft({});
    setStepIssues({});
    setError(null);
    setSaving(false);
    setUnit('kg');
  };

  useEffect(() => {
    const previousContext = routeContextRef.current;

    if (editWorkoutId) {
      routeContextRef.current = `edit:${editWorkoutId}`;
      return;
    }

    if (previousContext?.startsWith('edit:')) {
      resetBuilderStateForCreate();

      if (prefillDateParam && isValidYMD(prefillDateParam)) {
        setDateStr(prefillDateParam);
      }

      const requestedAthleteId = Number(prefillAthleteIdParam);
      const wantsAthletePrefill = prefillAthleteIdParam.trim().length > 0;
      if (Number.isFinite(requestedAthleteId) && requestedAthleteId > 0 && rosterLoaded) {
        const match = roster.find((row) => row.id === requestedAthleteId);
        if (match) {
          setAthleteId(String(match.id));
        }
      }
      prefillAppliedRef.current = !wantsAthletePrefill || rosterLoaded;
    }

    routeContextRef.current = 'create';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editWorkoutId, prefillAthleteIdParam, prefillDateParam, roster, rosterLoaded]);

  const canSave = useMemo(() => {
    const noStepIssues = Object.keys(stepIssues).length === 0;
    return athleteId.trim().length > 0 && dateStr.trim().length === 10 && !saving && noStepIssues;
  }, [athleteId, dateStr, saving, stepIssues]);
  const hasSessionItems = core.length > 0 || acc.length > 0;
  const setupComplete = athleteId.trim().length > 0 && dateStr.trim().length === 10;
  const mainLiftCount = core.filter((item, index) => !(item.variant === 'BK' && core[index - 1]?.variant === 'TOP')).length;
  const accessoryCount = acc.length;

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

  const addCoreFromChooser = (
    lift: CoreDraft['lift'],
    scheme: 'STRAIGHT' | 'TOP_BK' | 'FULL_CUSTOM' = 'STRAIGHT'
  ) => {
    const idx = coreRef.current.length;
    const base: CoreDraft = {
      lift,
      variant: scheme === 'FULL_CUSTOM' ? 'FULL_CUSTOM' : scheme === 'TOP_BK' ? 'TOP' : 'STRAIGHT',
      mode: 'RPE',
      sets: scheme === 'FULL_CUSTOM' ? 1 : scheme === 'TOP_BK' ? 1 : 3,
      reps: scheme === 'FULL_CUSTOM' ? 0 : 5,
      rpe_target: scheme === 'FULL_CUSTOM' ? null : 7,
      pct: null,
      manual_target_kg: null,
      manual_plusminus_kg: 0,
      target_low_kg: null,
      target_high_kg: null,
      planned_sets: scheme === 'FULL_CUSTOM'
        ? [{ set_index: 1, reps: 5, rpe_target: 7, pct: null, manual_target_kg: null, manual_pm_kg: 0 }]
        : undefined,
    };

    setCore((p) => {
      if (scheme !== 'TOP_BK') return [...p, base];
      return [
        ...p,
        base,
        {
          ...base,
          variant: 'BK',
          sets: 3,
          rpe_target: 6,
          parent_item_id: null,
        },
      ];
    });
    setCoreEditorOpen({ idx });
    if (scheme !== 'FULL_CUSTOM') {
      scheduleSuggestAfterState(idx, scheme === 'TOP_BK' ? idx + 1 : -1);
    }
  };

  // Core Variant is preset-assisted on mobile while preserving custom text.
  // OHP intentionally stays hidden from modern mobile core-work selection.
  const addCoreVariant = () => {
    const idx = coreRef.current.length;
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
    setCoreEditorOpen({ idx });
    setTimeout(() => openMovementPicker('variant', idx), 0);
  };

  const addAcc = () => {
    const idx = acc.length;
    setAcc((p) => [
      ...p,
      { movement: '', sets: 3, reps_text: '10-12', rir_target: 2, superset_group: null, superset_pos: null },
    ]);
    setAccEditorOpen({ idx });
    setTimeout(() => openMovementPicker('accessory', idx), 0);
  };

  const updateAccAt = (idx: number, patch: Partial<AccDraft>) => {
    setAcc((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  const setAccSupersetGroup = (idx: number, group: SSGroup | null) => {
    setAcc((p) =>
      p.map((x, i) =>
        i === idx
          ? {
              ...x,
              superset_group: group,
              superset_pos: group ? nextSupersetPos(group, p) : null,
            }
          : x
      )
    );
  };

  const serializeCoreForSave = (c: CoreDraft) => {
    if (c.variant === 'FULL_CUSTOM') {
      const plannedSets = normalizePlannedSets(c.planned_sets, c);
      return {
        lift: c.lift,
        variant: 'FULL_CUSTOM' as const,
        mode: c.mode,
        movement: c.movement?.trim() || null,
        sets: plannedSets.length || c.sets || 0,
        reps: 0,
        rpe_target: null,
        pct: null,
        planned_sets: plannedSets.map((ps, idx) => ({
          set_index: ps.set_index || idx + 1,
          reps: ps.reps ?? null,
          rpe_target: c.mode === 'RPE' ? (ps.rpe_target ?? null) : null,
          pct: c.mode === 'PCT' ? (ps.pct ?? null) : null,
          manual_target_kg: ps.manual_target_kg ?? null,
          manual_pm_kg: ps.manual_pm_kg ?? 0,
        })),
      };
    }

    return {
      ...c,
      movement: c.movement?.trim() || null,
    };
  };

  const validateFullCustomCore = (c: CoreDraft, coreIdx: number) => {
    if (c.variant !== 'FULL_CUSTOM') return null;
    const rows = normalizePlannedSets(c.planned_sets, c);
    if (!rows.length) return `Core ${coreIdx + 1}: add at least one planned set.`;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const label = `Core ${coreIdx + 1}, Set ${i + 1}`;
      const reps = Number(row.reps);
      if (!Number.isFinite(reps) || reps <= 0) return `${label}: reps are required.`;

      if (c.mode === 'PCT') {
        const pct = Number(row.pct);
        if (!Number.isFinite(pct) || pct <= 0) return `${label}: percent is required.`;
      } else {
        const rpe = Number(row.rpe_target);
        if (!Number.isFinite(rpe) || rpe <= 0) return `${label}: RPE is required.`;
      }

      if (row.manual_target_kg != null) {
        const target = Number(row.manual_target_kg);
        if (!Number.isFinite(target) || target <= 0) return `${label}: manual target load is invalid.`;
      }
      if (row.manual_pm_kg != null) {
        const range = Number(row.manual_pm_kg);
        if (!Number.isFinite(range) || range < 0) return `${label}: manual range is invalid.`;
      }
    }

    return null;
  };

  const saveWithStatus = async (status: 'draft' | 'assigned') => {
    setError(null);
    const activeEditWorkoutId = editWorkoutId.trim();

    if (unit === 'kg') {
      const issues = computeKgStepIssues();
      setStepIssues(issues);
      if (Object.keys(issues).length > 0) {
        Alert.alert('Fix load entries', 'Manual load fields must be in 2.5 kg increments.');
        return;
      }
    }

    const fullCustomIssue = core.map(validateFullCustomCore).find(Boolean);
    if (fullCustomIssue) {
      setError(fullCustomIssue);
      Alert.alert('Fix Full Custom block', fullCustomIssue);
      return;
    }

    setSaving(true);

    const payload = {
      athlete_id: Number(athleteId),
      date: dateStr,
      label: label.trim() || null,
      status, // <-- IMPORTANT
      core_items: core.map(serializeCoreForSave),
      acc_items: acc
        .filter((a) => a.movement.trim().length > 0)
        .map((a) => ({
          ...a,
          movement: a.movement.trim(),
          reps_text: a.reps_text.trim(),
        })),
    };

    const endpoint = activeEditWorkoutId
      ? `/workouts/mobile/${activeEditWorkoutId}/edit`
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

    const workoutId = String(res.workout_id || activeEditWorkoutId);

    router.replace({
      pathname: '/workout/[workoutId]',
      params: { workoutId },
    });
  };

const saveDraft = async () => saveWithStatus('draft');
const assignSession = async () => saveWithStatus('assigned');
const ACCESSORY_REP_PRESETS = ['8-10', '10-12', '12-15', '15-20', 'AMRAP', '30 sec', '45 sec', '60 sec'];

  const toggleAdvanced = (key: string) => {
    setAdvancedOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderSegmented = <T extends string>(
    options: Array<{ value: T; label: string }>,
    active: T,
    onSelect: (value: T) => void,
  ) => (
    <CreatorSegmentedControl options={options} value={active} onChange={onSelect} />
  );

  const renderStepper = (
    label: string,
    value: number | null | undefined,
    onChange: (value: number) => void,
    options?: { min?: number; max?: number; step?: number },
  ) => {
    return (
      <CreatorStepper
        label={label}
        value={value}
        onChange={onChange}
        min={options?.min}
        max={options?.max}
        step={options?.step}
      />
    );
  };

  const renderRpeChips = (value: number | null | undefined, onSelect: (value: number) => void) => (
    <CreatorRpeSelector value={value} onChange={onSelect} />
  );

  const renderChoiceChips = <T extends string | number>(
    options: Array<{ value: T; label: string }>,
    value: T | null | undefined,
    onSelect: (value: T) => void,
  ) => (
    <CreatorChoiceChips options={options} value={value} onChange={onSelect} />
  );

  const renderPctInput = (value: number | null | undefined, onChange: (value: number | null) => void) => (
    <View style={styles.controlBlock}>
      <ThemedText variant="bodyMuted" style={styles.controlLabel}>%</ThemedText>
      <TextInput
        value={value == null ? '' : String(value)}
        onChangeText={(v) => onChange(v === '' ? null : Number(v))}
        keyboardType="decimal-pad"
        placeholder="80"
        placeholderTextColor="#64748b"
        style={[styles.input, styles.inputSm]}
      />
    </View>
  );

  const renderCoreAdvanced = (idx: number, c: CoreDraft) => {
    const advancedKey = `core:${idx}`;
    const open = !!advancedOpen[advancedKey];
    return (
      <CreatorAdvancedSection open={open} onToggle={() => toggleAdvanced(advancedKey)}>
            <View style={styles.row}>
              <View style={styles.fieldCol}>
                <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Load ({unit})</ThemedText>
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
              <View style={styles.fieldCol}>
                <ThemedText variant="bodyMuted" style={styles.fieldLabel}>± ({unit})</ThemedText>
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
                  placeholder="0"
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
      </CreatorAdvancedSection>
    );
  };

  const renderInlineLoadSummary = (c: CoreDraft) => {
    const sr = suggestedRangeLabel(c);
    if (!sr && !canRequestSuggestedLoad(c)) return null;
    return (
      <View style={styles.inlineLoadSummary}>
        <ThemedText variant="bodyMuted" style={styles.inlineLoadLabel}>
          {c.manual_target_kg != null && Number(c.manual_target_kg) > 0 ? 'Manual Load' : 'Suggested Load'}
        </ThemedText>
        <ThemedText variant="body" style={styles.inlineLoadValue}>
          {sr || 'No suggested load returned'}
        </ThemedText>
      </View>
    );
  };

  const renderMovementPickerBody = (kind: 'accessory'|'variant') => {
    const categories = filteredMovementCategories(kind);
    return (
      <>
        <TextInput
          value={movementSearch}
          onChangeText={setMovementSearch}
          placeholder="Search movements"
          placeholderTextColor="#64748b"
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="words"
        />

        {movementSearch.trim() ? (
          <Pressable
            style={styles.customMovementRow}
            onPress={() => selectMovementPreset(movementSearch.trim())}
          >
            <ThemedText variant="body" style={styles.customMovementTitle}>
              Use "{movementSearch.trim()}"
            </ThemedText>
          </Pressable>
        ) : null}

        <ScrollView
          style={styles.editorScroll}
          contentContainerStyle={styles.movementPickerContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {movementPresetsLoading ? (
            <View style={styles.rosterLoadingRow}>
              <ActivityIndicator color="#C4B5FD" />
              <ThemedText variant="bodyMuted" style={styles.rosterLoadingText}>Loading presets</ThemedText>
            </View>
          ) : movementPresetsError ? (
            <View style={styles.emptyOutlineCard}>
              <ThemedText variant="body" style={styles.emptyOutlineTitle}>Presets unavailable</ThemedText>
              <ThemedText variant="bodyMuted" style={styles.emptyOutlineText}>{movementPresetsError}</ThemedText>
            </View>
          ) : (
            categories.map((category) => (
              <View key={category.key || category.name} style={styles.presetCategoryBlock}>
                <ThemedText variant="badge" style={styles.presetCategoryTitle}>{category.name}</ThemedText>
                {category.movements.map((movement) => (
                  <TouchableOpacity
                    key={`${category.name}-${movement}`}
                    style={styles.presetMovementRow}
                    onPress={() => selectMovementPreset(movement)}
                  >
                    <ThemedText variant="body" style={styles.presetMovementText}>{movement}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}

          {!movementPresetsLoading && !categories.length ? (
            <View style={styles.emptyOutlineCard}>
              <ThemedText variant="body" style={styles.emptyOutlineTitle}>No presets found</ThemedText>
            </View>
          ) : null}
        </ScrollView>
      </>
    );
  };

  const renderCoreEditorContent = (idx: number) => {
    const c = core[idx];
    if (!c) return null;
    const hasTopBk = c.variant === 'TOP' && core[idx + 1]?.variant === 'BK';
    const bk = (hasTopBk ? core[idx + 1] : c) as CoreDraft;

    return (
      <View style={styles.editorBody}>
        {c.lift === 'VR' ? (
          <>
            <ThemedText variant="bodyMuted" style={styles.controlLabel}>Core Variant</ThemedText>
            <Pressable style={styles.selectInput} onPress={() => openMovementPicker('variant', idx)}>
              <ThemedText variant="body" style={styles.selectText}>
                {c.movement?.trim() || 'Choose variant'}
              </ThemedText>
              <ThemedText variant="bodyMuted" style={styles.selectChevron}>▾</ThemedText>
            </Pressable>
            <TextInput
              value={c.movement || ''}
              onChangeText={(v) => updateCoreAt(idx, { movement: v })}
              placeholder="Custom variant"
              placeholderTextColor="#64748b"
              style={styles.input}
            />
          </>
        ) : (
          <Pressable style={styles.liftButton} onPress={() => setCoreSelectOpen({ kind: 'lift', idx })}>
            <ThemedText variant="body" style={styles.liftButtonText}>{coreLiftLabel(c.lift)}</ThemedText>
            <ThemedText variant="bodyMuted" style={styles.selectChevron}>▾</ThemedText>
          </Pressable>
        )}

        {c.lift !== 'VR' ? (
          <>
            <ThemedText variant="bodyMuted" style={styles.controlLabel}>Scheme</ThemedText>
            {renderSegmented(
              [
                { value: 'STRAIGHT', label: 'Straight' },
                { value: 'TOP_BK', label: 'Top + Backdown' },
                { value: 'FULL_CUSTOM', label: 'Full Custom' },
              ],
              c.variant === 'FULL_CUSTOM' ? 'FULL_CUSTOM' : hasTopBk ? 'TOP_BK' : 'STRAIGHT',
              (scheme) => {
                setSchemeAt(idx, scheme);
                if (scheme !== 'FULL_CUSTOM') {
                  scheduleSuggestAfterState(idx, scheme === 'TOP_BK' ? idx + 1 : -1);
                }
              },
            )}
          </>
        ) : null}

        <ThemedText variant="bodyMuted" style={styles.controlLabel}>Mode</ThemedText>
        {c.lift === 'VR' ? (
          <View style={styles.segmentedRow}>
            <View style={[styles.segmentBtn, styles.segmentBtnActive]}>
              <ThemedText variant="badge" style={[styles.segmentText, styles.segmentTextActive]}>RPE</ThemedText>
            </View>
          </View>
        ) : renderSegmented(
          [
            { value: 'RPE', label: 'RPE' },
            { value: 'PCT', label: '%' },
          ],
          c.mode,
          (mode) => {
            if (c.variant === 'FULL_CUSTOM') setFullCustomModeAt(idx, mode);
            else if (isTopBkStart(core, idx)) {
              updateTopBkPair(idx, { mode, target_low_kg: null, target_high_kg: null });
              scheduleSuggestAfterState(idx, idx + 1);
            } else {
              updateCoreAt(idx, { mode, target_low_kg: null, target_high_kg: null });
              scheduleSuggestAfterState(idx);
            }
          },
        )}

        {c.variant === 'FULL_CUSTOM' ? (
          <View style={styles.fullCustomEditor}>
            <View style={styles.fullCustomHeaderRow}>
              <ThemedText variant="body" style={styles.subRowLabel}>Planned Sets</ThemedText>
              <Pressable
                onPress={() => addPlannedSet(idx)}
                disabled={normalizePlannedSets(c.planned_sets, c).length >= MAX_FULL_CUSTOM_SETS}
                style={[styles.smallBtn, normalizePlannedSets(c.planned_sets, c).length >= MAX_FULL_CUSTOM_SETS && styles.reorderBtnDisabled]}
              >
                <ThemedText variant="badge" style={styles.smallBtnText}>+ Add Set</ThemedText>
              </Pressable>
            </View>

            {normalizePlannedSets(c.planned_sets, c).map((ps, psIdx) => {
              const targetKey = keyForPlannedManualTarget(idx, psIdx);
              const pmKey = keyForPlannedManualPm(idx, psIdx);
              const stepIssue = stepIssues[targetKey] || stepIssues[pmKey];
              return (
                <View key={`${idx}-${psIdx}`} style={styles.plannedSetCardCompact}>
                  <View style={styles.plannedSetHeader}>
                    <ThemedText variant="body" style={styles.plannedSetTitle}>Set {psIdx + 1}</ThemedText>
                    <Pressable
                      onPress={() => removePlannedSet(idx, psIdx)}
                      disabled={normalizePlannedSets(c.planned_sets, c).length <= 1}
                      style={[styles.plannedSetRemove, normalizePlannedSets(c.planned_sets, c).length <= 1 && styles.reorderBtnDisabled]}
                    >
                      <ThemedText variant="badge" style={styles.removeBtnText}>Remove</ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.controlGrid}>
                    {renderStepper('Reps', ps.reps, (value) => updatePlannedSetAt(idx, psIdx, { reps: value }), { min: 1, max: 99 })}
                    {c.mode === 'PCT'
                      ? renderPctInput(ps.pct, (value) => updatePlannedSetAt(idx, psIdx, { pct: value, rpe_target: null }))
                      : (
                        <View style={styles.controlBlockWide}>
                          <ThemedText variant="bodyMuted" style={styles.controlLabel}>RPE</ThemedText>
                          {renderRpeChips(ps.rpe_target, (value) => updatePlannedSetAt(idx, psIdx, { rpe_target: value, pct: null }))}
                        </View>
                      )}
                  </View>
                  <CreatorAdvancedSection
                    open={!!advancedOpen[`planned:${idx}:${psIdx}`]}
                    onToggle={() => toggleAdvanced(`planned:${idx}:${psIdx}`)}
                  >
                        <View style={styles.row}>
                          <View style={styles.fieldCol}>
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Load ({unit})</ThemedText>
                            <TextInput
                              value={getDraft(targetKey, ps.manual_target_kg)}
                              onChangeText={(v) => setDraft(targetKey, v)}
                              onBlur={() => {
                                const nKg = parseDisplayWeightToKg(getDraft(targetKey, ps.manual_target_kg));
                                updatePlannedSetAt(idx, psIdx, { manual_target_kg: nKg });
                                validateKgStep(targetKey, nKg);
                                clearDraft(targetKey);
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
                            <ThemedText variant="bodyMuted" style={styles.fieldLabel}>± ({unit})</ThemedText>
                            <TextInput
                              value={getDraft(pmKey, ps.manual_pm_kg)}
                              onChangeText={(v) => setDraft(pmKey, v)}
                              onBlur={() => {
                                const pmKg = parseDisplayDeltaToKg(getDraft(pmKey, ps.manual_pm_kg));
                                updatePlannedSetAt(idx, psIdx, { manual_pm_kg: pmKg ?? 0 });
                                validateKgStep(pmKey, pmKg, true);
                                clearDraft(pmKey);
                              }}
                              keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                              autoCorrect={false}
                              autoCapitalize="none"
                              placeholder="0"
                              placeholderTextColor="#64748b"
                              style={[styles.input, styles.inputSm]}
                            />
                          </View>
                        </View>
                        {stepIssue ? <ThemedText variant="bodyMuted" style={styles.stepWarn}>{stepIssue}</ThemedText> : null}
                  </CreatorAdvancedSection>
                </View>
              );
            })}
          </View>
        ) : hasTopBk ? (
          <View style={styles.editorBody}>
            <ThemedText variant="body" style={styles.subRowLabel}>Top Set</ThemedText>
            <View style={styles.controlGrid}>
              {renderStepper('Sets', c.sets, (value) => updateTopBkPair(idx, { sets: value }), { min: 1, max: 12 })}
              {renderStepper('Reps', c.reps, (value) => {
                updateTopBkPair(idx, { reps: value });
                if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) scheduleSuggest(idx);
              }, { min: 1, max: 99 })}
            </View>
            {c.mode === 'PCT'
              ? renderPctInput(c.pct, (value) => {
                updateTopBkPair(idx, { pct: value });
                if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) scheduleSuggest(idx);
              })
              : (
                <>
                  <ThemedText variant="bodyMuted" style={styles.controlLabel}>RPE</ThemedText>
                  {renderRpeChips(c.rpe_target, (value) => {
                    updateTopBkPair(idx, { rpe_target: value });
                    if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) scheduleSuggest(idx);
                  })}
                </>
              )}
            {renderInlineLoadSummary(c)}

            <ThemedText variant="body" style={styles.subRowLabel}>Backdown Sets</ThemedText>
            <View style={styles.controlGrid}>
              {renderStepper('Sets', bk.sets, (value) => updateTopBkPair(idx, {}, { sets: value }), { min: 1, max: 12 })}
              {renderStepper('Reps', bk.reps, (value) => {
                updateTopBkPair(idx, {}, { reps: value });
                if (!(bk.manual_target_kg != null && Number(bk.manual_target_kg) > 0)) scheduleSuggest(idx + 1);
              }, { min: 1, max: 99 })}
            </View>
            {bk.mode === 'PCT'
              ? renderPctInput(bk.pct, (value) => {
                updateTopBkPair(idx, {}, { pct: value });
                if (!(bk.manual_target_kg != null && Number(bk.manual_target_kg) > 0)) scheduleSuggest(idx + 1);
              })
              : (
                <>
                  <ThemedText variant="bodyMuted" style={styles.controlLabel}>RPE</ThemedText>
                  {renderRpeChips(bk.rpe_target, (value) => {
                    updateTopBkPair(idx, {}, { rpe_target: value });
                    if (!(bk.manual_target_kg != null && Number(bk.manual_target_kg) > 0)) scheduleSuggest(idx + 1);
                  })}
                </>
              )}
            {renderInlineLoadSummary(bk)}
            {renderCoreAdvanced(idx, c)}
          </View>
        ) : (
          <View style={styles.editorBody}>
            <View style={styles.controlGrid}>
              {renderStepper('Sets', c.sets, (value) => updateCoreAt(idx, { sets: value }), { min: 1, max: 12 })}
              {renderStepper('Reps', c.reps, (value) => {
                updateCoreAt(idx, { reps: value });
                if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) scheduleSuggest(idx);
              }, { min: 1, max: 99 })}
            </View>
            {c.mode === 'PCT'
              ? renderPctInput(c.pct, (value) => {
                updateCoreAt(idx, { pct: value });
                if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) scheduleSuggest(idx);
              })
              : (
                <>
                  <ThemedText variant="bodyMuted" style={styles.controlLabel}>RPE</ThemedText>
                  {renderRpeChips(c.rpe_target, (value) => {
                    updateCoreAt(idx, { rpe_target: value });
                    if (!(c.manual_target_kg != null && Number(c.manual_target_kg) > 0)) scheduleSuggest(idx);
                  })}
                </>
              )}
            {renderInlineLoadSummary(c)}
            {renderCoreAdvanced(idx, c)}
          </View>
        )}
      </View>
    );
  };

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.topBar}>
          <View style={styles.titleBlock}>
            <ThemedText variant="h1" style={styles.title}>
              {editWorkoutId ? 'Edit Session' : 'Create Session'}
            </ThemedText>
            <ThemedText variant="bodyMuted" style={styles.titleSubtext}>
              Build your workout plan, then save it when it feels right.
            </ThemedText>
          </View>
          <View style={styles.topActions}>
            {editWorkoutId ? (
              <Pressable style={styles.topSecondaryBtn} onPress={() => router.back()}>
                <ThemedText variant="badge" style={styles.topSecondaryText}>Cancel</ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.topSecondaryBtn, !canSave && styles.btnDisabled]}
              disabled={!canSave}
              onPress={saveDraft}
            >
              <ThemedText variant="badge" style={styles.topSecondaryText}>Save Draft</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.progressStrip}>
          <ProgressStep label="Setup" value={setupComplete ? '✓' : '•'} active complete={setupComplete} />
          <ProgressStep label="Main Lifts" value={String(mainLiftCount)} active={mainLiftCount > 0} />
          <ProgressStep label="Accessories" value={String(accessoryCount)} active={accessoryCount > 0} accessory />
        </View>

        {error && <ThemedText variant="error" style={styles.error}>{error}</ThemedText>}

        <View style={[styles.card, styles.basicsCard]}>
          <View style={styles.setupHero}>
            <View style={styles.setupHeroIcon}>
              <ThemedText variant="h3" style={styles.setupHeroIconText}>⌁</ThemedText>
            </View>
            <View style={styles.setupHeroCopy}>
              <ThemedText variant="h3" style={styles.setupHeroTitle}>Session Setup</ThemedText>
              <ThemedText variant="bodyMuted" style={styles.setupHeroText}>
                Choose who this is for, when it happens, and how loads should read.
              </ThemedText>
            </View>
          </View>

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
                  : prefillAthleteNameParam
                    ? `Select athlete (${prefillAthleteNameParam})`
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
          <ThemedText variant="bodyMuted" style={styles.label}>
            Session Title (optional)
          </ThemedText>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Lower Body Strength"
            placeholderTextColor="#64748b"
            style={styles.input}
          />
        </View>

        <View style={styles.chapter}>
          <ThemedText variant="bodyMuted" style={styles.chapterKicker}>Quick Start (optional)</ThemedText>
          <View style={styles.quickStartGrid}>
            {!editWorkoutId ? (
              <Pressable
                style={({ pressed }) => [styles.quickStartCard, pressed && styles.pressed]}
                onPress={openCopyExisting}
              >
                <View style={styles.quickStartIcon}>
                  <ThemedText variant="h3" style={styles.quickStartIconText}>⧉</ThemedText>
                </View>
                <View style={styles.quickStartCopy}>
                  <ThemedText variant="body" style={styles.quickStartTitle}>Copy Existing Session</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.quickStartText}>Start from a previous workout you created.</ThemedText>
                </View>
                <ThemedText variant="h3" style={styles.quickStartArrow}>›</ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.quickStartCard, pressed && styles.pressed]}
              onPress={() => {
                const hasDraft = core.length > 0 || acc.length > 0 || !!label.trim();
                if (!hasDraft) {
                  setTemplatePickerOpen(true);
                  return;
                }
                setTemplateReplaceConfirmOpen(true);
              }}
            >
              <View style={[styles.quickStartIcon, styles.quickStartIconGreen]}>
                <ThemedText variant="h3" style={styles.quickStartIconText}>⌗</ThemedText>
              </View>
              <View style={styles.quickStartCopy}>
                <ThemedText variant="body" style={styles.quickStartTitle}>Load Template</ThemedText>
                <ThemedText variant="bodyMuted" style={styles.quickStartText}>Use a template to jump-start this session.</ThemedText>
              </View>
              <ThemedText variant="h3" style={styles.quickStartArrow}>›</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.chapter}>
          <ThemedText variant="bodyMuted" style={styles.chapterKicker}>What's Next?</ThemedText>
          <View style={styles.guidanceStack}>
            <GuidanceRow
              icon="⌘"
              title="Add your main lifts"
              body="Start with the key lifts for this workout. You can always adjust later."
            />
            <GuidanceRow
              icon="♡"
              title="Add supporting accessories"
              body="Accessories help round out your session and support your main lifts."
              accessory
            />
          </View>
        </View>

        <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <ThemedText variant="h3" style={styles.sectionKicker}>Main Lifts</ThemedText>
                    <ThemedText variant="bodyMuted" style={styles.sectionSubtext}>Add the key lifts for this workout.</ThemedText>
                  </View>
                  <Pressable style={styles.sectionAddBtn} onPress={() => setAddLiftOpen(true)}>
                    <ThemedText variant="badge" style={styles.sectionAddText}>+ Add Lift</ThemedText>
                  </Pressable>
                </View>
                {core.length === 0 ? (
                  <Pressable style={styles.emptyOutlineCard} onPress={() => setAddLiftOpen(true)}>
                    <ThemedText variant="body" style={styles.emptyOutlineTitle}>No main lifts yet.</ThemedText>
                    <ThemedText variant="bodyMuted" style={styles.emptyOutlineText}>Add your first lift to begin building your workout.</ThemedText>
                    <View style={styles.emptyCta}>
                      <ThemedText variant="badge" style={styles.emptyCtaText}>+ Add First Lift</ThemedText>
                    </View>
                  </Pressable>
                ) : null}
                {core.map((c, idx) => {
                    // hide the BK row if it belongs to a TOP+BK pair
                    if (c.variant === 'BK' && core[idx - 1]?.variant === 'TOP') return null;

                    const hasTopBk = c.variant === 'TOP' && core[idx + 1]?.variant === 'BK';
                    const bk = (hasTopBk ? core[idx + 1] : c) as CoreDraft;

                    return (
                      <CoreMovementCard
                        key={idx}
                        lift={c.lift}
                        title={coreMovementTitle(c)}
                        scheme={coreSchemeLabel(core, idx)}
                        summary={corePrescriptionSummary(core, idx).replace(`${coreSchemeLabel(core, idx)} · `, '')}
                        suggestedLoad={suggestedRangeLabel(c)}
                        manualLoad={c.manual_target_kg != null && Number(c.manual_target_kg) > 0}
                        canMoveUp={canMoveCoreUp(idx)}
                        canMoveDown={canMoveCoreDown(idx)}
                        onOpen={() => setCoreEditorOpen({ idx })}
                        onMoveUp={() => moveCore(idx, -1)}
                        onMoveDown={() => moveCore(idx, 1)}
                        onRemove={() => setCore((p) => {
                          if (isTopBkStart(p, idx)) return p.filter((_, i) => i !== idx && i !== idx + 1);
                          return p.filter((_, i) => i !== idx);
                        })}
                      />
                    );

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


                    {c.variant === 'FULL_CUSTOM' && (
                    <View style={styles.fullCustomEditor}>
                      <View style={styles.fullCustomHeaderRow}>
                        <View>
                          <ThemedText variant="body" style={styles.subRowLabel}>Planned Sets</ThemedText>
                          <ThemedText variant="bodyMuted" style={styles.fullCustomNoticeText}>
                            Set-by-set prescription · max {MAX_FULL_CUSTOM_SETS}
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => addPlannedSet(idx)}
                          disabled={normalizePlannedSets(c.planned_sets, c).length >= MAX_FULL_CUSTOM_SETS}
                          style={[
                            styles.smallBtn,
                            normalizePlannedSets(c.planned_sets, c).length >= MAX_FULL_CUSTOM_SETS && styles.reorderBtnDisabled,
                          ]}
                        >
                          <ThemedText variant="badge" style={styles.smallBtnText}>Add Set</ThemedText>
                        </Pressable>
                      </View>

                      {normalizePlannedSets(c.planned_sets, c).map((ps, psIdx) => {
                        const targetKey = keyForPlannedManualTarget(idx, psIdx);
                        const pmKey = keyForPlannedManualPm(idx, psIdx);
                        const stepIssue = stepIssues[targetKey] || stepIssues[pmKey];
                        return (
                          <View key={`${idx}-${psIdx}`} style={styles.plannedSetCard}>
                            <View style={styles.plannedSetHeader}>
                              <ThemedText variant="body" style={styles.plannedSetTitle}>Set {psIdx + 1}</ThemedText>
                              <Pressable
                                onPress={() => removePlannedSet(idx, psIdx)}
                                disabled={normalizePlannedSets(c.planned_sets, c).length <= 1}
                                style={[styles.plannedSetRemove, normalizePlannedSets(c.planned_sets, c).length <= 1 && styles.reorderBtnDisabled]}
                              >
                                <ThemedText variant="badge" style={styles.removeBtnText}>Remove</ThemedText>
                              </Pressable>
                            </View>

                            <View style={styles.row}>
                              <View style={styles.fieldCol}>
                                <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Reps</ThemedText>
                                <TextInput
                                  value={ps.reps == null ? '' : String(ps.reps)}
                                  onChangeText={(v) => updatePlannedSetAt(idx, psIdx, { reps: parseOptionalNumberInput(v) })}
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
                                    ? (ps.pct == null ? '' : String(ps.pct))
                                    : (ps.rpe_target == null ? '' : String(ps.rpe_target))}
                                  onChangeText={(v) => {
                                    const nextValue = parseOptionalNumberInput(v);
                                    if (c.mode === 'PCT') updatePlannedSetAt(idx, psIdx, { pct: nextValue, rpe_target: null });
                                    else updatePlannedSetAt(idx, psIdx, { rpe_target: nextValue, pct: null });
                                  }}
                                  keyboardType="decimal-pad"
                                  placeholder={c.mode === 'PCT' ? '80' : '7'}
                                  placeholderTextColor="#64748b"
                                  style={[styles.input, styles.inputSm]}
                                />
                              </View>
                            </View>

                            <View style={styles.row}>
                              <View style={styles.fieldCol}>
                                <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Manual Target ({unit})</ThemedText>
                                <TextInput
                                  value={getDraft(targetKey, ps.manual_target_kg)}
                                  onChangeText={(v) => setDraft(targetKey, v)}
                                  onBlur={() => {
                                    const nKg = parseDisplayWeightToKg(getDraft(targetKey, ps.manual_target_kg));
                                    updatePlannedSetAt(idx, psIdx, { manual_target_kg: nKg });
                                    validateKgStep(targetKey, nKg);
                                    clearDraft(targetKey);
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
                                  value={getDraft(pmKey, ps.manual_pm_kg)}
                                  onChangeText={(v) => setDraft(pmKey, v)}
                                  onBlur={() => {
                                    const pmKg = parseDisplayDeltaToKg(getDraft(pmKey, ps.manual_pm_kg));
                                    updatePlannedSetAt(idx, psIdx, { manual_pm_kg: pmKg ?? 0 });
                                    validateKgStep(pmKey, pmKg, true);
                                    clearDraft(pmKey);
                                  }}
                                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                                  autoCorrect={false}
                                  autoCapitalize="none"
                                  placeholder="0"
                                  placeholderTextColor="#64748b"
                                  style={[styles.input, styles.inputSm]}
                                />
                              </View>
                            </View>

                            {stepIssue ? (
                              <ThemedText variant="bodyMuted" style={styles.stepWarn}>{stepIssue}</ThemedText>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                    )}

                    {!hasTopBk && c.lift !== 'VR' && c.variant !== 'FULL_CUSTOM' && (
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
        

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <ThemedText variant="h3" style={styles.sectionKicker}>Accessories</ThemedText>
            </View>
            <Pressable style={styles.sectionAddBtn} onPress={addAcc}>
              <ThemedText variant="badge" style={styles.sectionAddText}>+ Add Accessory</ThemedText>
            </Pressable>
          </View>

          {acc.length === 0 ? (
            <Pressable style={styles.emptyOutlineCard} onPress={addAcc}>
              <ThemedText variant="body" style={styles.emptyOutlineTitle}>No accessories yet.</ThemedText>
              <ThemedText variant="bodyMuted" style={styles.emptyOutlineText}>Add accessories to support your main lifts.</ThemedText>
              <View style={[styles.emptyCta, styles.emptyCtaAccessory]}>
                <ThemedText variant="badge" style={styles.emptyCtaText}>+ Add Accessory</ThemedText>
              </View>
            </Pressable>
          ) : null}

          {acc.map((a, idx) => (
            <AccessoryMovementCard
              key={idx}
              title={a.movement.trim() || `Accessory ${idx + 1}`}
              summary={accessorySummary(a)}
              canMoveUp={canMoveAccUp(idx)}
              canMoveDown={canMoveAccDown(idx)}
              onOpen={() => setAccEditorOpen({ idx })}
              onMoveUp={() => moveAcc(idx, idx - 1)}
              onMoveDown={() => moveAcc(idx, idx + 1)}
              onRemove={() => setAcc((p) => p.filter((_, i) => i !== idx))}
            />
          ))}
        </View>

        <Modal
          visible={!!coreEditorOpen && !movementPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setCoreEditorOpen(null)}
        >
          <KeyboardAvoidingView
            style={styles.sheetOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.editorSheet}>
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText variant="h3" style={styles.modalTitle}>Edit movement</ThemedText>
                  {coreEditorOpen && core[coreEditorOpen.idx] ? (
                    <ThemedText variant="bodyMuted" style={styles.sectionSubtext}>
                      {coreMovementTitle(core[coreEditorOpen.idx])}
                    </ThemedText>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => setCoreEditorOpen(null)}
                  style={styles.modalClose}
                  accessibilityLabel="Close movement editor"
                >
                  <ThemedText variant="badge" style={styles.modalCloseText}>Done</ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={styles.editorScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                {coreEditorOpen && core[coreEditorOpen.idx] ? renderCoreEditorContent(coreEditorOpen.idx) : null}
                <Pressable style={styles.editorSaveBtn} onPress={() => setCoreEditorOpen(null)}>
                  <ThemedText variant="h3" style={styles.editorSaveText}>Save Changes</ThemedText>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={!!accEditorOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setAccEditorOpen(null)}
        >
          <KeyboardAvoidingView
            style={styles.sheetOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.editorSheet}>
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText variant="h3" style={styles.modalTitle}>
                    {movementPickerOpen?.kind === 'accessory' ? 'Choose movement' : 'Edit accessory'}
                  </ThemedText>
                  {movementPickerOpen?.kind !== 'accessory' && accEditorOpen && acc[accEditorOpen.idx] ? (
                    <ThemedText variant="bodyMuted" style={styles.sectionSubtext}>
                      {acc[accEditorOpen.idx].movement.trim() || `Accessory ${accEditorOpen.idx + 1}`}
                    </ThemedText>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (movementPickerOpen?.kind === 'accessory') {
                      setMovementPickerOpen(null);
                      setMovementSearch('');
                      return;
                    }
                    setAccEditorOpen(null);
                  }}
                  style={styles.modalClose}
                  accessibilityLabel="Close accessory editor"
                >
                  <ThemedText variant="badge" style={styles.modalCloseText}>
                    {movementPickerOpen?.kind === 'accessory' ? 'Back' : 'Done'}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {movementPickerOpen?.kind === 'accessory' ? (
                renderMovementPickerBody('accessory')
              ) : (
                <ScrollView
                  style={styles.editorScroll}
                  contentContainerStyle={styles.editorScrollContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                >
                  {accEditorOpen && acc[accEditorOpen.idx] ? (() => {
                  const idx = accEditorOpen.idx;
                  const a = acc[idx];
                  const group = normalizeSSGroup(a.superset_group);
                  return (
                    <View style={styles.editorBody}>
                      <Pressable style={styles.accessoryMovementHero} onPress={() => openMovementPicker('accessory', idx)}>
                        <View style={[styles.movementIconBlock, styles.iconAccessory]}>
                          <ThemedText variant="badge" style={styles.movementIconText}>AC</ThemedText>
                        </View>
                        <View style={styles.movementTitleWrap}>
                          <ThemedText variant="body" style={styles.accessoryMovementTitle}>
                            {a.movement.trim() || 'Choose movement'}
                          </ThemedText>
                        </View>
                        <ThemedText variant="bodyMuted" style={styles.selectChevron}>▾</ThemedText>
                      </Pressable>
                      <TextInput
                        value={a.movement}
                        onChangeText={(v) => updateAccAt(idx, { movement: v })}
                        placeholder="Custom movement"
                        placeholderTextColor="#64748b"
                        style={[styles.input, styles.customMovementInput]}
                      />

                      <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Superset</ThemedText>
                      {renderChoiceChips<string>(
                        [
                          { value: 'NONE', label: 'None' },
                          ...SS_GROUPS.map((g) => ({ value: g, label: `Group ${g}` })),
                        ],
                        group || 'NONE',
                        (value) => setAccSupersetGroup(idx, value === 'NONE' ? null : (value as SSGroup)),
                      )}

                      <ThemedText variant="bodyMuted" style={styles.fieldLabel}>Prescription</ThemedText>
                      <View style={styles.controlGrid}>
                        {renderStepper('Sets', a.sets, (value) => updateAccAt(idx, { sets: value }), { min: 1, max: 12 })}
                        <View style={styles.fieldCol}>
                          <ThemedText variant="bodyMuted" style={styles.controlLabel}>Reps</ThemedText>
                          <TextInput
                            value={a.reps_text}
                            onChangeText={(v) => updateAccAt(idx, { reps_text: v })}
                            placeholder="10-12"
                            placeholderTextColor="#64748b"
                            style={styles.input}
                          />
                        </View>
                      </View>
                      {renderChoiceChips<string>(
                        ACCESSORY_REP_PRESETS.map((preset) => ({ value: preset, label: preset })),
                        a.reps_text,
                        (value) => updateAccAt(idx, { reps_text: value }),
                      )}

                      <ThemedText variant="bodyMuted" style={styles.fieldLabel}>RIR</ThemedText>
                      {renderChoiceChips<number | 'NONE'>(
                        [
                          { value: 'NONE', label: '-' },
                          { value: 0, label: '0' },
                          { value: 1, label: '1' },
                          { value: 2, label: '2' },
                          { value: 3, label: '3' },
                          { value: 4, label: '4' },
                        ],
                        a.rir_target == null ? 'NONE' : Number(a.rir_target),
                        (value) => updateAccAt(idx, { rir_target: value === 'NONE' ? null : Number(value) }),
                      )}

                      <Pressable style={styles.editorSaveBtn} onPress={() => setAccEditorOpen(null)}>
                        <ThemedText variant="h3" style={styles.editorSaveText}>Save Changes</ThemedText>
                      </Pressable>
                    </View>
                  );
                  })() : null}
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Movement preset picker */}
        <Modal
          visible={movementPickerOpen?.kind === 'variant'}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setMovementPickerOpen(null);
            setMovementSearch('');
          }}
        >
          <KeyboardAvoidingView
            style={styles.sheetOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.editorSheet}>
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText variant="h3" style={styles.modalTitle}>
                    {movementPickerOpen?.kind === 'variant' ? 'Core Variant' : 'Accessory'}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setMovementPickerOpen(null);
                    setMovementSearch('');
                  }}
                  style={styles.modalClose}
                  accessibilityLabel="Close movement picker"
                >
                  <ThemedText variant="badge" style={styles.modalCloseText}>Done</ThemedText>
                </TouchableOpacity>
              </View>

              <TextInput
                value={movementSearch}
                onChangeText={setMovementSearch}
                placeholder="Search movements"
                placeholderTextColor="#64748b"
                style={styles.input}
                autoCorrect={false}
                autoCapitalize="words"
              />

              {movementSearch.trim() ? (
                <Pressable
                  style={styles.customMovementRow}
                  onPress={() => selectMovementPreset(movementSearch.trim())}
                >
                  <ThemedText variant="body" style={styles.customMovementTitle}>
                    Use "{movementSearch.trim()}"
                  </ThemedText>
                </Pressable>
              ) : null}

              <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={styles.movementPickerContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                {movementPresetsLoading ? (
                  <View style={styles.rosterLoadingRow}>
                    <ActivityIndicator color="#C4B5FD" />
                    <ThemedText variant="bodyMuted" style={styles.rosterLoadingText}>Loading presets</ThemedText>
                  </View>
                ) : movementPresetsError ? (
                  <View style={styles.emptyOutlineCard}>
                    <ThemedText variant="body" style={styles.emptyOutlineTitle}>Presets unavailable</ThemedText>
                    <ThemedText variant="bodyMuted" style={styles.emptyOutlineText}>{movementPresetsError}</ThemedText>
                  </View>
                ) : movementPickerOpen ? (
                  filteredMovementCategories(movementPickerOpen.kind).map((category) => (
                    <View key={category.key || category.name} style={styles.presetCategoryBlock}>
                      <ThemedText variant="badge" style={styles.presetCategoryTitle}>{category.name}</ThemedText>
                      {category.movements.map((movement) => (
                        <TouchableOpacity
                          key={`${category.name}-${movement}`}
                          style={styles.presetMovementRow}
                          onPress={() => selectMovementPreset(movement)}
                        >
                          <ThemedText variant="body" style={styles.presetMovementText}>{movement}</ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))
                ) : null}

                {movementPickerOpen && !movementPresetsLoading && !filteredMovementCategories(movementPickerOpen.kind).length ? (
                  <View style={styles.emptyOutlineCard}>
                    <ThemedText variant="body" style={styles.emptyOutlineTitle}>No presets found</ThemedText>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
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
          visible={copyExistingOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setCopyExistingOpen(false)}
        >
          <KeyboardAvoidingView
            style={styles.sheetOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.editorSheet}>
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText variant="h3" style={styles.modalTitle}>Copy Existing</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.sectionSubtext}>
                    {selectedAthlete?.name || 'Selected athlete'}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  onPress={() => setCopyExistingOpen(false)}
                  style={styles.modalClose}
                  accessibilityLabel="Close copy existing"
                >
                  <ThemedText variant="badge" style={styles.modalCloseText}>Close</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.copySearchRow}>
                <TextInput
                  value={copySearch}
                  onChangeText={setCopySearch}
                  placeholder="Search label, date, status"
                  placeholderTextColor="#64748b"
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={[styles.input, styles.copySearchInput]}
                  returnKeyType="search"
                  onSubmitEditing={() => loadCopyExistingSessions(copySearch)}
                />
                <Pressable
                  style={styles.sourceBtn}
                  onPress={() => loadCopyExistingSessions(copySearch)}
                >
                  <ThemedText variant="badge" style={styles.sourceBtnText}>Search</ThemedText>
                </Pressable>
              </View>

              {copySessionsLoading ? (
                <View style={styles.rosterLoadingRow}>
                  <ActivityIndicator />
                  <ThemedText variant="bodyMuted" style={styles.rosterLoadingText}>Loading sessions...</ThemedText>
                </View>
              ) : null}

              {copySessionsError ? (
                <ThemedText variant="error" style={styles.inlineError}>{copySessionsError}</ThemedText>
              ) : null}

              <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={styles.editorScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                {copySessions.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.copySessionRow}
                    disabled={copyApplying}
                    onPress={() => void applyCopyExistingSession(session)}
                  >
                    <View style={styles.copySessionMain}>
                      <ThemedText variant="body" style={styles.copySessionTitle}>
                        {session.label || 'Session'}
                      </ThemedText>
                      <ThemedText variant="bodyMuted" style={styles.copySessionMeta}>
                        {[session.date, session.status].filter(Boolean).join(' · ')}
                      </ThemedText>
                      {session.planned_summary ? (
                        <ThemedText variant="bodyMuted" style={styles.copySessionSummary}>
                          {session.planned_summary}
                        </ThemedText>
                      ) : null}
                    </View>
                    {copyApplying ? <ActivityIndicator /> : (
                      <ThemedText variant="bodyMuted" style={styles.selectChevron}>›</ThemedText>
                    )}
                  </TouchableOpacity>
                ))}

                {copySessions.length === 0 && !copySessionsLoading ? (
                  <ThemedText variant="bodyMuted" style={styles.muted}>
                    No recent sessions found.
                  </ThemedText>
                ) : null}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={!!copyReplaceConfirmSource}
          transparent
          animationType="fade"
          onRequestClose={() => setCopyReplaceConfirmSource(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText variant="h3" style={styles.modalTitle}>Replace current draft?</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.templateConfirmText}>
                    Copying an existing session will replace the current builder contents.
                  </ThemedText>
                </View>
                <TouchableOpacity
                  onPress={() => setCopyReplaceConfirmSource(null)}
                  style={styles.modalClose}
                  accessibilityLabel="Close copy confirmation"
                >
                  <ThemedText variant="badge" style={styles.modalCloseText}>✕</ThemedText>
                </TouchableOpacity>
              </View>
              <View style={styles.templateConfirmActions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setCopyReplaceConfirmSource(null)}
                >
                  <ThemedText variant="h3" style={styles.cancelText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={styles.saveBtn}
                  onPress={async () => {
                    const source = copyReplaceConfirmSource;
                    setCopyReplaceConfirmSource(null);
                    if (source) await applyCopyExistingSession(source, true);
                  }}
                >
                  <ThemedText variant="h3" style={styles.saveText}>Replace</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!quickStartNotice}
          transparent
          animationType="fade"
          onRequestClose={() => setQuickStartNotice(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText variant="h3" style={styles.modalTitle}>
                    {quickStartNotice?.title || ''}
                  </ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.templateConfirmText}>
                    {quickStartNotice?.body || ''}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  onPress={() => setQuickStartNotice(null)}
                  style={styles.modalClose}
                  accessibilityLabel="Close quick start notice"
                >
                  <ThemedText variant="badge" style={styles.modalCloseText}>✕</ThemedText>
                </TouchableOpacity>
              </View>
              <View style={styles.templateConfirmActions}>
                <Pressable
                  style={styles.saveBtn}
                  onPress={() => setQuickStartNotice(null)}
                >
                  <ThemedText variant="h3" style={styles.saveText}>Done</ThemedText>
                </Pressable>
              </View>
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

                <ThemedText variant="bodyMuted" style={styles.addLiftStepLabel}>Core lift</ThemedText>
                {(['SQ', 'BN', 'DL'] as CoreDraft['lift'][]).map((lift) => (
                  <View key={lift} style={styles.addLiftChoice}>
                    <ThemedText variant="body" style={styles.addLiftChoiceTitle}>{coreLiftLabel(lift)}</ThemedText>
                    <View style={styles.schemeChoiceRow}>
                      {[
                        { value: 'STRAIGHT' as const, label: 'Straight' },
                        { value: 'TOP_BK' as const, label: 'Top + Backdown' },
                        { value: 'FULL_CUSTOM' as const, label: 'Full Custom' },
                      ].map((scheme) => (
                        <Pressable
                          key={scheme.value}
                          style={styles.schemeChoiceBtn}
                          onPress={() => {
                            addCoreFromChooser(lift, scheme.value);
                            setAddLiftOpen(false);
                          }}
                        >
                          <ThemedText variant="badge" style={styles.schemeChoiceText}>{scheme.label}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addLiftChoice}
                  onPress={() => {
                    addCoreVariant();
                    setAddLiftOpen(false);
                  }}
                >
                  <ThemedText variant="body" style={styles.addLiftChoiceTitle}>Core Variant</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.addLiftChoiceSub}>Preset-assisted, custom allowed</ThemedText>
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
                            const nextMode = opt.value as CoreDraft['mode'];
                            if (core[idx]?.variant === 'FULL_CUSTOM') setFullCustomModeAt(idx, nextMode);
                            else if (isTopBkStart(core, idx)) updateTopBkPair(idx, { mode: nextMode });
                            else updateCoreAt(idx, { mode: nextMode });

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

      <Modal
        visible={templateReplaceConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTemplateReplaceConfirmOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText variant="h3" style={styles.modalTitle}>Load template?</ThemedText>
                <ThemedText variant="bodyMuted" style={styles.templateConfirmText}>
                  This will replace your current draft in the builder.
                </ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => setTemplateReplaceConfirmOpen(false)}
                style={styles.modalClose}
                accessibilityLabel="Close template confirmation"
              >
                <ThemedText variant="badge" style={styles.modalCloseText}>✕</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.templateConfirmActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setTemplateReplaceConfirmOpen(false)}
              >
                <ThemedText variant="h3" style={styles.cancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={styles.saveBtn}
                onPress={() => {
                  setTemplateReplaceConfirmOpen(false);
                  setTemplatePickerOpen(true);
                }}
              >
                <ThemedText variant="h3" style={styles.saveText}>Replace</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
      {hasSessionItems ? (
        <View style={styles.stickyFooter}>
          <Pressable
            style={[styles.stickyAssignBtn, !canSave && styles.btnDisabled]}
            disabled={!canSave}
            onPress={assignSession}
          >
            {saving ? (
              <ActivityIndicator />
            ) : (
              <ThemedText variant="h3" style={styles.stickyAssignText}>Assign Session</ThemedText>
            )}
          </Pressable>
        </View>
      ) : null}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function ProgressStep({
  label,
  value,
  active,
  complete,
  accessory,
}: {
  label: string;
  value: string;
  active?: boolean;
  complete?: boolean;
  accessory?: boolean;
}) {
  return (
    <View style={styles.progressStep}>
      <View style={[
        styles.progressBubble,
        active && styles.progressBubbleActive,
        complete && styles.progressBubbleComplete,
        accessory && active && styles.progressBubbleAccessory,
      ]}>
        <ThemedText variant="badge" style={styles.progressBubbleText}>{value}</ThemedText>
      </View>
      <ThemedText variant="bodyMuted" style={active ? styles.progressLabelActive : styles.progressLabel}>{label}</ThemedText>
    </View>
  );
}

function GuidanceRow({
  icon,
  title,
  body,
  accessory,
}: {
  icon: string;
  title: string;
  body: string;
  accessory?: boolean;
}) {
  return (
    <View style={styles.guidanceRow}>
      <View style={[styles.guidanceIcon, accessory && styles.guidanceIconAccessory]}>
        <ThemedText variant="h3" style={styles.guidanceIconText}>{icon}</ThemedText>
      </View>
      <View style={styles.guidanceCopy}>
        <ThemedText variant="body" style={styles.guidanceTitle}>{title}</ThemedText>
        <ThemedText variant="bodyMuted" style={styles.guidanceBody}>{body}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  keyboardRoot: { flex: 1 },
  scroll: { paddingBottom: 156, gap: 14 },
  topBar: {
    marginTop: 14,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  titleSubtext: {
    color: '#B8ACA1',
    fontSize: 13,
    lineHeight: 18,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topSecondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.42)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(28,19,42,0.46)',
  },
  topSecondaryText: {
    color: '#C4B5FD',
    fontWeight: '700',
  },
  title: { color: '#fff', fontSize: 26, lineHeight: 32, fontWeight: '800' },
  progressStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.16)',
    backgroundColor: 'rgba(18,15,25,0.42)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  progressBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  progressBubbleActive: {
    backgroundColor: 'rgba(139,92,246,0.44)',
    borderColor: 'rgba(196,181,253,0.42)',
  },
  progressBubbleComplete: {
    backgroundColor: 'rgba(74,222,128,0.16)',
    borderColor: 'rgba(167,203,181,0.38)',
  },
  progressBubbleAccessory: {
    backgroundColor: 'rgba(88,166,123,0.24)',
    borderColor: 'rgba(167,203,181,0.32)',
  },
  progressBubbleText: {
    color: '#F8FAFC',
    fontWeight: '900',
  },
  progressLabel: {
    color: '#82766D',
    fontSize: 11,
    fontWeight: '800',
  },
  progressLabelActive: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ECE5DA',
  },
  pressed: {
    opacity: 0.76,
  },
  error: { marginTop: 6, color: '#f97373' },
  sourceRow: {
    marginTop: 2,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sourceText: {
    flex: 1,
    color: '#A8A29E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sourceBtn: {
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.36)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(20,16,28,0.36)',
  },
  sourceBtnText: {
    color: '#C4B5FD',
    fontWeight: '700',
  },
  chapter: {
    gap: 10,
  },
  chapterKicker: {
    color: '#B8ACA1',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  quickStartGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickStartCard: {
    flex: 1,
    minHeight: 126,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(222,198,166,0.12)',
    backgroundColor: 'rgba(24,20,32,0.52)',
    padding: 14,
    gap: 10,
  },
  quickStartIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
  },
  quickStartIconGreen: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderColor: 'rgba(167,203,181,0.20)',
  },
  quickStartIconText: {
    color: '#A78BFA',
    fontWeight: '900',
  },
  quickStartCopy: {
    flex: 1,
    gap: 4,
  },
  quickStartTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 14,
  },
  quickStartText: {
    color: '#B8ACA1',
    fontSize: 12,
    lineHeight: 17,
  },
  quickStartArrow: {
    position: 'absolute',
    right: 12,
    top: 16,
    color: '#D8B4FE',
    fontSize: 20,
  },
  guidanceStack: {
    gap: 9,
  },
  guidanceRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(222,198,166,0.11)',
    backgroundColor: 'rgba(24,20,32,0.42)',
    padding: 14,
  },
  guidanceIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.22)',
  },
  guidanceIconAccessory: {
    backgroundColor: 'rgba(74,222,128,0.12)',
  },
  guidanceIconText: {
    color: '#A78BFA',
    fontWeight: '900',
  },
  guidanceCopy: {
    flex: 1,
    gap: 3,
  },
  guidanceTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
  },
  guidanceBody: {
    color: '#B8ACA1',
    fontSize: 12,
    lineHeight: 18,
  },
  copySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  copySearchInput: {
    flex: 1,
  },
  copySessionRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copySessionMain: {
    flex: 1,
    minWidth: 0,
  },
  copySessionTitle: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '800',
  },
  copySessionMeta: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: 12,
  },
  copySessionSummary: {
    marginTop: 4,
    color: '#CBD5E1',
    fontSize: 12,
  },
  templateConfirmText: {
    marginTop: 6,
    color: '#B8ACA1',
    fontSize: 13,
    lineHeight: 19,
  },
  templateConfirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(222,198,166,0.12)',
    backgroundColor: 'rgba(18,15,24,0.54)',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  basicsCard: {
    gap: 6,
    borderColor: 'rgba(167,139,250,0.18)',
    backgroundColor: 'rgba(25,20,34,0.62)',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  setupHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(222,198,166,0.10)',
    paddingBottom: 14,
    marginBottom: 4,
  },
  setupHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.20)',
  },
  setupHeroIconText: {
    color: '#A78BFA',
    fontWeight: '900',
  },
  setupHeroCopy: {
    flex: 1,
    gap: 4,
  },
  setupHeroTitle: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '900',
  },
  setupHeroText: {
    color: '#B8ACA1',
    fontSize: 13,
    lineHeight: 19,
  },
  h3: { color: '#E5E7EB', fontSize: 16, fontWeight: '600' },
  sectionKicker: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  sectionSubtext: {
    marginTop: 3,
    color: '#B8ACA1',
    fontSize: 12,
  },
  sectionAddBtn: {
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.42)',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(139,92,246,0.13)',
  },
  sectionAddText: {
    color: '#C4B5FD',
    fontWeight: '700',
  },
  label: { marginTop: 8, color: '#B8ACA1', fontSize: 12, fontWeight: '800' },
  input: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: 'rgba(222,198,166,0.14)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#E5E7EB',
    backgroundColor: 'rgba(6,6,10,0.48)',
  },
  rowBetween: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  smallBtn: {
    borderWidth: 1, borderColor: 'rgba(185,176,163,0.22)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(8,8,10,0.3)',
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
    borderColor: 'rgba(248,113,113,0.42)',
    backgroundColor: 'rgba(127,29,29,0.24)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
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
    borderColor: 'rgba(185,176,163,0.16)',
    borderRadius: 7,
    overflow: 'hidden',
  },
  unitBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,6,8,0.38)',
  },
  unitBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.26)',
  },
  unitBtnText: {
    color: '#E5E7EB',
    fontWeight: '800',
  },
  unitBtnTextActive: {
    color: '#DDD6FE',
  },
  inputSm: { flex: 1 },
  inputLg: { flex: 2 },

  muted: { marginTop: 8, color:'#9CA3AF' },
  emptyOutlineCard: {
    marginTop: 6,
    minHeight: 154,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.24)',
    borderRadius: 18,
    backgroundColor: 'rgba(22,18,30,0.46)',
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyOutlineTitle: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 17,
    textAlign: 'center',
  },
  emptyOutlineText: {
    color: '#B8ACA1',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 8,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(139,92,246,0.82)',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaAccessory: {
    backgroundColor: 'rgba(74,222,128,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(167,203,181,0.28)',
  },
  emptyCtaText: {
    color: '#F8FAFC',
    fontWeight: '900',
  },
  movementCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.12)',
    borderRadius: 0,
    backgroundColor: 'rgba(6,6,8,0.36)',
    padding: 10,
    gap: 8,
  },
  movementCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  movementIconBlock: {
    width: 34,
    height: 34,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  movementIconText: {
    color: '#F8FAFC',
    fontWeight: '900',
    fontSize: 11,
  },
  iconSquat: { backgroundColor: 'rgba(109,40,217,0.85)' },
  iconBench: { backgroundColor: 'rgba(37,99,235,0.85)' },
  iconDeadlift: { backgroundColor: 'rgba(22,163,74,0.82)' },
  iconOhp: { backgroundColor: 'rgba(217,119,6,0.85)' },
  iconVariant: { backgroundColor: 'rgba(100,116,139,0.82)' },
  iconAccessory: { backgroundColor: 'rgba(220,38,38,0.72)' },
  movementTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  movementTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  movementSubtitle: {
    marginTop: 3,
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  movementSummary: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: 12,
  },
  movementActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  overflowText: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 2,
  },
  movementMetaRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.14)',
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  accessoryMovementHero: {
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.16)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.42)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accessoryMovementTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
  },
  customMovementInput: {
    marginTop: 0,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,2,3,0.68)',
    justifyContent: 'flex-end',
  },
  editorSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.18)',
    backgroundColor: 'rgba(7,7,9,0.94)',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
  },
  editorScroll: {
    maxHeight: '100%',
  },
  editorScrollContent: {
    paddingBottom: 24,
  },
  movementPickerContent: {
    paddingTop: 12,
    paddingBottom: 28,
  },
  presetCategoryBlock: {
    marginBottom: 14,
  },
  presetCategoryTitle: {
    color: '#C4B5FD',
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  presetMovementRow: {
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.12)',
    borderRadius: 7,
    backgroundColor: 'rgba(6,6,8,0.38)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 7,
  },
  presetMovementText: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  customMovementRow: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.36)',
    borderRadius: 8,
    backgroundColor: 'rgba(20,16,28,0.38)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  customMovementTitle: {
    color: '#DDD6FE',
    fontWeight: '800',
  },
  editorBody: {
    gap: 8,
  },
  liftButton: {
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.16)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.42)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liftButtonText: {
    color: '#F8FAFC',
    fontWeight: '900',
  },
  segmentedRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.14)',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(6,6,8,0.42)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(148,163,184,0.12)',
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.34)',
  },
  segmentText: {
    color: '#CBD5E1',
    fontWeight: '800',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  controlLabel: {
    marginTop: 10,
    marginBottom: 6,
    color: '#A8A29E',
    fontSize: 12,
    fontWeight: '800',
  },
  controlGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  controlBlock: {
    flex: 1,
  },
  controlBlockWide: {
    flex: 1,
  },
  stepperRow: {
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.14)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.4)',
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,16,28,0.34)',
  },
  stepperText: {
    color: '#C4B5FD',
    fontWeight: '800',
  },
  stepperValue: {
    minWidth: 30,
    color: '#F8FAFC',
    textAlign: 'center',
    fontWeight: '900',
  },
  rpeSelectorScroll: {
    flexGrow: 0,
  },
  rpeSelectorContent: {
    gap: 8,
    paddingRight: 4,
  },
  rpeChip: {
    minWidth: 48,
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.16)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rpeChipActive: {
    borderColor: 'rgba(139,92,246,0.5)',
    backgroundColor: 'rgba(139,92,246,0.34)',
  },
  rpeChipText: {
    color: '#CBD5E1',
    fontWeight: '900',
  },
  rpeChipTextActive: {
    color: '#FFFFFF',
  },
  advancedWrap: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.14)',
    paddingTop: 8,
  },
  inlineLoadSummary: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.12)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.36)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inlineLoadLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  inlineLoadValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
  },
  advancedHeader: {
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advancedTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '800',
  },
  advancedChevron: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '900',
  },
  fullCustomNotice: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.24)',
    borderRadius: 8,
    backgroundColor: 'rgba(20,16,28,0.32)',
    padding: 12,
  },
  fullCustomNoticeTitle: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
  fullCustomNoticeText: {
    marginTop: 6,
    color: '#94A3B8',
  },
  fullCustomEditor: {
    marginTop: 12,
    gap: 10,
  },
  fullCustomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  plannedSetCard: {
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.14)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.34)',
    padding: 10,
    gap: 8,
  },
  plannedSetCardCompact: {
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.12)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.34)',
    padding: 10,
    gap: 8,
  },
  plannedSetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  plannedSetTitle: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
  plannedSetRemove: {
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.55)',
    backgroundColor: 'rgba(127,29,29,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  saveBtn: {
    flex: 1,
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.18)',
    backgroundColor: 'rgba(6,6,8,0.38)',
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  editorSaveBtn: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109,40,217,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.38)',
  },
  editorSaveText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: 'rgba(5,5,6,0.78)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
  },
  stickyAssignBtn: {
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109,40,217,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.38)',
  },
  stickyAssignText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  selectInput: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.16)',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(6,6,8,0.42)',
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
    backgroundColor: 'rgba(2,2,3,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '92%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.18)',
    backgroundColor: 'rgba(7,7,9,0.95)',
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
    borderColor: 'rgba(185,176,163,0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalCloseText: {
    color: '#E5E7EB',
  },
  modalRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
  },
  modalRowText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  addLiftBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: 'rgba(139,92,246,0.82)',
  },
  addLiftText: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(6,6,8,0.42)',
  },
  addTemplateText: {
    color: '#E5E7EB',
  },
  addLiftChoice: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
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
  addLiftStepLabel: {
    marginTop: 4,
    marginBottom: 2,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  schemeChoiceRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  schemeChoiceBtn: {
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.18)',
    borderRadius: 8,
    backgroundColor: 'rgba(6,6,8,0.38)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  schemeChoiceText: {
    color: '#E5E7EB',
    fontWeight: '800',
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
  borderColor: 'rgba(185,176,163,0.18)',
  backgroundColor: 'rgba(6,6,8,0.38)',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
},
pillActive: {
  borderColor: 'rgba(139,92,246,0.46)',
  backgroundColor: 'rgba(139,92,246,0.26)',
},
pillText: {
  color: '#E5E7EB',
  fontWeight: '700',
},
pillTextActive: {
  color: '#DDD6FE',
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
  borderColor: 'rgba(185,176,163,0.12)',
  borderRadius: 8,
  backgroundColor: 'rgba(6,6,8,0.34)',
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
  borderColor: 'rgba(185,176,163,0.18)',
  backgroundColor: 'rgba(6,6,8,0.38)',
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 8,
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
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.18)',
    backgroundColor: 'rgba(6,6,8,0.38)',
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
