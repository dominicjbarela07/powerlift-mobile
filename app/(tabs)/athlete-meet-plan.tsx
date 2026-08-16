// app/(tabs)/athlete-meet-plan.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { SLTrophy } from '@/components/ui';
import { fetchJson } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLRadius, SLShadows, SLTypography } from '@/constants/theme';
import {
  convertDisplayWeightValue,
  formatWeightFromKg,
  normalizeDisplayWeightUnit,
  type DisplayWeightUnit,
} from '@/lib/display-units';

type LiftKey = 'SQ' | 'BN' | 'DL';
type MainTab = 'overview' | 'attempts' | 'warmups' | 'notes' | 'summary';

type MeetAttemptResult = {
  id: number;
  attempt_id: number | null;
  lift: string | null;
  attempt_number: number;
  planned_weight_kg: number | null;
  actual_weight_kg: number | null;
  result: 'good' | 'miss' | 'skipped' | string;
  miss_reason: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MeetAttempt = {
  id: number;
  lift?: LiftKey | string | null;
  attempt_number: number;
  weight_kg: number | null;
  min_weight_kg?: number | null;
  target_weight_kg?: number | null;
  max_weight_kg?: number | null;
  decision_rule?: string | null;
  pct_tm: number | null;
  strategy_tag: string | null;
  strategy_note?: string | null;
  notes: string | null;
  result?: MeetAttemptResult | null;
  result_status?: 'pending' | 'good' | 'miss' | 'skipped' | string;
};

type MeetWarmup = {
  id: number;
  order_idx: number;
  weight_kg: number | null;
  reps: number | null;
  minutes_until_opener?: number | null;
  label: string | null;
};

type MeetNote = {
  id: number;
  category: string | null;
  body: string | null;
  created_at: string | null;
};

type AthleteRecapLiftSummary = {
  lift: LiftKey | string;
  label: string;
  best_kg: number | null;
  made: number;
  total_attempts: number;
};

type AthleteRecapMiss = {
  lift: LiftKey | string;
  label: string;
  attempt_number: number;
  attempt_label: string;
  actual_weight_kg: number | null;
  miss_reason: string | null;
  notes: string | null;
};

type AthleteRecap = {
  is_available: boolean;
  reason?: string | null;
  headline?: string | null;
  story?: string | null;
  story_paragraphs?: string[];
  highlights?: string[];
  soft_lowlights?: string[];
  lift_summaries?: AthleteRecapLiftSummary[];
  misses?: AthleteRecapMiss[];
  next_steps?: string | null;
};

type MeetResultSummary = {
  id: number;
  bodyweight_kg: number | null;
  weight_class: string | null;
  best_squat_kg: number | null;
  best_bench_kg: number | null;
  best_deadlift_kg: number | null;
  total_kg: number | null;
  attempts_made: number;
  attempts_taken: number;
  dots_score: number | null;
  gl_points: number | null;
};

type AttemptResultDraft = {
  attempt: MeetAttempt;
  result: 'good' | 'miss' | 'skipped' | '';
  actualWeightKg: string;
  rpe: '7' | '7.5' | '8' | '8.5' | '9' | '9.5' | '10' | '';
  missReason: 'technical' | 'strength' | 'command' | 'depth' | 'grip' | 'other' | '';
  notes: string;
};

type MeetPayload = {
  has_meet_plan: boolean;
  athlete?: {
    id: number;
    name: string;
    sex?: string | null;
  } | null;
  meet: {
    id: number;
    name: string | null;
    date: string | null;
    date_display: string | null;
    date_parts?: {
      year: number;
      month: number;
      day: number;
    } | null;
    days_until: number | null;
    weeks_until: number | null;
    days_remainder: number | null;
    federation: string | null;
    meet_category?: string | null;
    meet_category_label?: string | null;
    division?: string | null;
    division_label?: string | null;
    division_age?: number | null;
    division_detail?: string | null;
    weight_class: string | null;
    location: string | null;
    flight_platform: string | null;
    weigh_in_day: string | null;
    weigh_in_day_label: string | null;
    weigh_in_time: string | null;
    weigh_in_time_display: string | null;
    weigh_in_bodyweight_kg?: number | null;
    start_time: string | null;
    start_time_display: string | null;
    status: string | null;
    coach_notes?: string | null;
    status_label?: string | null;
    can_start_meet?: boolean;
    can_start_meet_blockers?: string[];
    can_finish_meet?: boolean;
    rack_heights: {
      squat: string | null;
      bench: string | null;
      bench_safety: string | null;
    };
  } | null;
  training_maxes?: Partial<Record<LiftKey, number | null>>;
  lift_order?: LiftKey[];
  lift_labels?: Partial<Record<LiftKey, string>>;
  attempts?: Partial<Record<LiftKey, MeetAttempt[]>>;
  meet_state?: {
    key: 'pre_meet' | 'in_progress' | 'completed' | 'archived' | string;
    label: string;
    primary_action: string | null;
  } | null;
  attempt_progress?: {
    attempts_total: number;
    attempts_logged: number;
    attempts_remaining: number;
    current_lift: LiftKey | string | null;
    next_unlogged_attempt_id: number | null;
  } | null;
  warmups?: Partial<Record<LiftKey, MeetWarmup[]>>;
  notes?: MeetNote[];
  result_summary?: MeetResultSummary | null;
  athlete_recap?: AthleteRecap | null;
};

const LIFT_ORDER: LiftKey[] = ['SQ', 'BN', 'DL'];

const LIFT_LABELS: Record<LiftKey, string> = {
  SQ: 'Squat',
  BN: 'Bench',
  DL: 'Deadlift',
};

const DEFAULT_GEAR_ITEMS = [
  'Singlet',
  'Belt',
  'Squat shoes',
  'Bench shoes',
  'Deadlift shoes',
  'Knee sleeves / wraps',
  'Wrist wraps',
  'Deadlift socks',
  'ID / membership card',
  'Food + electrolytes',
];

const USAPL_FEDERATIONS = new Set(['USAPL', 'USA POWERLIFTING']);
const IPF_FEDERATIONS = new Set(['IPF', 'POWERLIFTING AMERICA', 'CPU']);
const USPA_STYLE_FEDERATIONS = new Set(['USPA', 'WRPF', 'PLU', 'USPC', 'IPL', 'NPL', 'RPS', 'SPF', 'APF', 'WPC']);
const USAPL_WEIGHT_CLASSES_BY_SEX = {
  M: ['52', '56', '60', '67.5', '75', '82.5', '90', '100', '110', '125', '140', '140+'],
  F: ['44', '48', '52', '56', '60', '65', '70', '75', '82.5', '90', '100', '100+'],
};
const IPF_WEIGHT_CLASSES_BY_SEX = {
  M: ['53', '59', '66', '74', '83', '93', '105', '120', '120+'],
  F: ['43', '47', '52', '57', '63', '69', '76', '84', '84+'],
};
const USPA_STYLE_WEIGHT_CLASSES_BY_SEX = {
  M: ['60', '67.5', '75', '82.5', '90', '100', '110', '125', '140', '140+'],
  F: ['44', '48', '52', '56', '60', '67.5', '75', '82.5', '90', '90+'],
};
const FALLBACK_WEIGHT_CLASSES = Array.from(new Set([
  ...USAPL_WEIGHT_CLASSES_BY_SEX.F,
  ...USAPL_WEIGHT_CLASSES_BY_SEX.M,
  ...IPF_WEIGHT_CLASSES_BY_SEX.F,
  ...IPF_WEIGHT_CLASSES_BY_SEX.M,
  ...USPA_STYLE_WEIGHT_CLASSES_BY_SEX.F,
  ...USPA_STYLE_WEIGHT_CLASSES_BY_SEX.M,
]));
const RACK_HEIGHT_OPTIONS = Array.from({ length: 31 }, (_, index) => String(index + 1));
const RACK_POSITION_OPTIONS = ['In', 'Out'];
const HORIZONTAL_WHEEL_ITEM_WIDTH = 72;
const VERTICAL_WHEEL_ROW_HEIGHT = 38;
const VERTICAL_WHEEL_VISIBLE_ROWS = 5;


function formatMeetWeight(value?: number | null, unit: DisplayWeightUnit = 'lb') {
  return formatWeightFromKg(value, unit) || '—';
}

function formatMeetWeightNumber(value?: number | null, unit: DisplayWeightUnit = 'lb') {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const converted = convertDisplayWeightValue(Number(value), 'kg', unit);
  return converted.toFixed(1).replace(/\.0$/, '');
}

function displayMeetWeightToKg(value: number, unit: DisplayWeightUnit) {
  return convertDisplayWeightValue(value, unit, 'kg');
}

function isFluidAttempt(attempt: MeetAttempt) {
  return attempt.attempt_number !== 1 && (!!attempt.min_weight_kg || !!attempt.max_weight_kg);
}

function attemptDisplayWeight(attempt: MeetAttempt, unit: DisplayWeightUnit = 'lb') {
  if (attempt.result?.actual_weight_kg != null) return formatMeetWeight(attempt.result.actual_weight_kg, unit);
  if (!isFluidAttempt(attempt)) return formatMeetWeight(attempt.weight_kg, unit);

  const low = formatMeetWeightNumber(attempt.min_weight_kg, unit);
  const high = formatMeetWeightNumber(attempt.max_weight_kg, unit);
  if (low && high) return `${low}–${high} ${unit}`;
  if (low) return `${low}+ ${unit}`;
  if (high) return `≤${high} ${unit}`;
  return formatMeetWeight(attempt.weight_kg, unit);
}

function attemptPlanLabel(attempt: MeetAttempt, unit: DisplayWeightUnit = 'lb') {
  if (isFluidAttempt(attempt)) {
    const low = formatMeetWeightNumber(attempt.min_weight_kg, unit);
    const target = formatMeetWeightNumber(attempt.target_weight_kg, unit);
    const high = formatMeetWeightNumber(attempt.max_weight_kg, unit);
    if (low && target && high) return `${low}–${high} ${unit} · target ${target}`;
    if (low && high) return `${low}–${high} ${unit}`;
    if (target) return `Target ${target} ${unit}`;
  }

  return attempt.weight_kg != null ? formatMeetWeight(attempt.weight_kg, unit) : attemptDisplayWeight(attempt, unit);
}

function attemptStrategyNote(attempt: MeetAttempt) {
  return attempt.strategy_note?.trim() || attempt.notes?.trim() || attempt.decision_rule?.trim() || null;
}

function defaultAttemptWeightForLog(attempt: MeetAttempt) {
  return attempt.result?.actual_weight_kg ?? attempt.target_weight_kg ?? attempt.weight_kg ?? attempt.min_weight_kg ?? '';
}

function meetWeightOption(value: number) {
  return Number(value).toFixed(1);
}

function meetWeightOptionsForAttempt(attempt: MeetAttempt, unit: DisplayWeightUnit = 'lb') {
  const rawBase = defaultAttemptWeightForLog(attempt);
  const base = typeof rawBase === 'number' && Number.isFinite(rawBase)
    ? rawBase
    : attempt.weight_kg ?? attempt.target_weight_kg ?? attempt.min_weight_kg ?? 0;
  const roundedBase = Math.round(Number(base) / 2.5) * 2.5;
  const options = new Set<string>();

  for (let offset = -25; offset <= 25; offset += 2.5) {
    const value = roundedBase + offset;
    if (value > 0) options.add(meetWeightOption(convertDisplayWeightValue(value, 'kg', unit)));
  }

  if (typeof rawBase === 'number' && Number.isFinite(rawBase)) {
    options.add(meetWeightOption(convertDisplayWeightValue(rawBase, 'kg', unit)));
  }

  return Array.from(options).sort((a, b) => Number(a) - Number(b));
}

function parseRpeNote(notes?: string | null) {
  const raw = String(notes || '').trim();
  const match = raw.match(/^RPE\s*(7(?:\.5)?|8(?:\.5)?|9(?:\.5)?|10)(?:\s*[—-]\s*)?/i);
  if (!match) return { rpe: '' as AttemptResultDraft['rpe'], notes: raw };
  return {
    rpe: match[1] as AttemptResultDraft['rpe'],
    notes: raw.slice(match[0].length).trim(),
  };
}

function resultLabel(result: AttemptResultDraft['result']) {
  if (result === 'good') return 'Good Lift';
  if (result === 'miss') return 'No Lift';
  if (result === 'skipped') return 'Skipped';
  return 'Choose Result';
}

function attemptLabel(attemptNumber: number) {
  if (attemptNumber === 1) return 'Opener';
  if (attemptNumber === 2) return 'Second';
  if (attemptNumber === 3) return 'Third';
  return `Attempt ${attemptNumber}`;
}

function prettyTag(value?: string | null) {
  if (!value) return null;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysOutLabel(meet?: MeetPayload['meet']) {
  if (!meet || typeof meet.days_until !== 'number') return 'Date TBD';
  if (meet.days_until < 0) return 'Meet passed';
  if (meet.days_until === 0) return 'Today';
  const weeks = meet.weeks_until ?? Math.floor(meet.days_until / 7);
  const days = meet.days_remainder ?? meet.days_until % 7;
  return `${weeks}w ${days}d out`;
}

function divisionDisplay(meet?: MeetPayload['meet']) {
  if (!meet) return 'TBD';

  const parts = [
    meet.division_label || null,
    meet.division_age != null ? `Age ${meet.division_age}` : null,
    meet.division_detail || null,
  ].filter(Boolean);

  return parts.length ? parts.join(' · ') : 'TBD';
}

function liftOrderHas(liftOrder: LiftKey[], lift: LiftKey) {
  return liftOrder.includes(lift);
}

function requiredLiftsForMeetCategory(meet?: MeetPayload['meet']): LiftKey[] {
  switch (meet?.meet_category) {
    case 'push_pull':
      return ['BN', 'DL'];
    case 'bench_only':
      return ['BN'];
    case 'deadlift_only':
      return ['DL'];
    case 'full_power':
      return ['SQ', 'BN', 'DL'];
    default:
      return [];
  }
}

function normalizeAthleteSex(sex?: string | null) {
  const normalized = String(sex || '').trim().toUpperCase();
  if (normalized === 'M' || normalized === 'MALE') return 'M';
  if (normalized === 'F' || normalized === 'FEMALE') return 'F';
  return null;
}

function athleteSexLabel(sex?: string | null) {
  const normalized = normalizeAthleteSex(sex);
  if (normalized === 'M') return 'Male';
  if (normalized === 'F') return 'Female';
  return 'Sex unavailable';
}

function weightClassOptionsForFederation(federation?: string | null, sex?: string | null) {
  const normalized = String(federation || '').trim().toUpperCase();
  const normalizedSex = normalizeAthleteSex(sex);
  if (!normalizedSex) return FALLBACK_WEIGHT_CLASSES;
  if (USAPL_FEDERATIONS.has(normalized)) return USAPL_WEIGHT_CLASSES_BY_SEX[normalizedSex];
  if (IPF_FEDERATIONS.has(normalized)) return IPF_WEIGHT_CLASSES_BY_SEX[normalizedSex];
  if (USPA_STYLE_FEDERATIONS.has(normalized)) return USPA_STYLE_WEIGHT_CLASSES_BY_SEX[normalizedSex];
  return USPA_STYLE_WEIGHT_CLASSES_BY_SEX[normalizedSex];
}

export default function AthleteMeetPlanScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const displayUnit = normalizeDisplayWeightUnit(user?.preferred_units);

  const [payload, setPayload] = useState<MeetPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('overview');
  const [activeLift, setActiveLift] = useState<LiftKey>('SQ');
  const [checkedWarmups, setCheckedWarmups] = useState<Record<number, boolean>>({});
  const [collapsedWarmups, setCollapsedWarmups] = useState<Partial<Record<LiftKey, boolean>>>({});
  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});
  const [gearItems, setGearItems] = useState<string[]>(DEFAULT_GEAR_ITEMS);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [savingMeetDetails, setSavingMeetDetails] = useState(false);
  const [meetForm, setMeetForm] = useState({
    location: '',
    flight_platform: '',
    weight_class: '',
    weigh_in_bodyweight_kg: '',
    squat_rack_height: '',
    squat_rack_orientation: '',
    bench_rack_height: '',
    bench_safety_height: '',
    gear_text: DEFAULT_GEAR_ITEMS.join('\n'),
  });
  const [newMeetBagItem, setNewMeetBagItem] = useState('');
  const [savingAttemptId, setSavingAttemptId] = useState<number | null>(null);
  const [attemptDraft, setAttemptDraft] = useState<AttemptResultDraft | null>(null);
  const openAttemptDraft = useCallback((attempt: MeetAttempt) => {
    const existing = attempt.result;
    const existingNotes = existing?.notes || '';
    const parsedNotes = parseRpeNote(existingNotes);
    const defaultWeight = defaultAttemptWeightForLog(attempt);

    setAttemptDraft({
      attempt,
      result: (existing?.result as AttemptResultDraft['result']) || '',
      actualWeightKg: typeof defaultWeight === 'number' ? meetWeightOption(convertDisplayWeightValue(defaultWeight, 'kg', displayUnit)) : '',
      rpe: parsedNotes.rpe,
      missReason: existing?.result === 'miss' ? ((existing?.miss_reason as AttemptResultDraft['missReason']) || '') : '',
      notes: parsedNotes.notes,
    });
  }, [displayUnit]);

  const loadMeetPlan = useCallback(
    async (opts?: { silent?: boolean; showRefreshIndicator?: boolean }) => {
      const silent = !!opts?.silent;

      try {
        if (silent) {
          if (opts?.showRefreshIndicator !== false) setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        if (!token) {
          setError('Not authenticated. Please log in again.');
          setPayload(null);
          return;
        }

        const res: any = await fetchJson('/meet-planner/mobile/athlete/current', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const status = Number(res?.status ?? 0);
        const json = res?.json ?? res;

        if (res?.ok !== true) {
          const msg = json?.error || json?.message || `Request failed (${status || 'unknown'})`;
          setError(String(msg));
          setPayload(null);
          if (status === 401) {
            router.replace('/login');
          }
          return;
        }

        if (!json || typeof json !== 'object') {
          setError('Bad response while loading meet plan.');
          setPayload(null);
          return;
        }

        const data = json as MeetPayload;
        setPayload(data);
        setCheckedWarmups({});

        const nextLiftOrder = data.lift_order?.length ? data.lift_order : LIFT_ORDER;
        setActiveLift((currentLift) => {
          return nextLiftOrder.includes(currentLift) ? currentLift : nextLiftOrder[0] || 'SQ';
        });
      } catch (err) {
        console.log('Athlete meet plan API error', err);
        setError('Network error while loading meet plan.');
        setPayload(null);
      } finally {
        if (silent) {
          if (opts?.showRefreshIndicator !== false) setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [token, router]
  );

  useEffect(() => {
    loadMeetPlan();
  }, [loadMeetPlan]);



  useFocusEffect(
    useCallback(() => {
      loadMeetPlan({ silent: true, showRefreshIndicator: false });
    }, [loadMeetPlan])
  );

  const liftOrder = useMemo(() => {
    return payload?.lift_order?.length ? payload.lift_order : LIFT_ORDER;
  }, [payload?.lift_order]);

  const liftLabels = useMemo(() => {
    return {
      ...LIFT_LABELS,
      ...(payload?.lift_labels || {}),
    } as Record<LiftKey, string>;
  }, [payload?.lift_labels]);

  const meet = payload?.meet || null;
  const hasMeetPlan = !!payload?.has_meet_plan && !!meet;
  const athleteSex = payload?.athlete?.sex ?? null;
  const weightClassOptions = useMemo(() => weightClassOptionsForFederation(meet?.federation, athleteSex), [athleteSex, meet?.federation]);
  const weightClassContext = [meet?.federation || 'Federation TBD', athleteSexLabel(athleteSex)].join(' • ');

  const athleteRecap = payload?.athlete_recap || null;
  const resultSummary = payload?.result_summary || null;
  const canShowSummaryTab = !!athleteRecap?.is_available && (meet?.status === 'completed' || meet?.status === 'archived');
  const canLogMeetResults = meet?.status === 'active';

  useEffect(() => {
    if (activeTab === 'summary' && !canShowSummaryTab) {
      setActiveTab('overview');
    }
  }, [activeTab, canShowSummaryTab]);

  const handleRefresh = useCallback(async () => {
    await loadMeetPlan({ silent: true });
  }, [loadMeetPlan]);

  const parseSquatRack = useCallback((value?: string | null) => {
    const raw = String(value || '').trim();
    if (!raw) return { height: '', orientation: '' };

    const parts = raw.split(/\s+/);
    const maybeOrientation = parts[parts.length - 1]?.toLowerCase();
    if (maybeOrientation === 'in' || maybeOrientation === 'out') {
      return {
        height: parts.slice(0, -1).join(' '),
        orientation: maybeOrientation === 'in' ? 'In' : 'Out',
      };
    }

    return { height: raw, orientation: '' };
  }, []);

  const formatSquatRack = useCallback((height: string, orientation: string) => {
    const cleanHeight = height.trim();
    const cleanOrientation = orientation.trim();
    return [cleanHeight, cleanOrientation].filter(Boolean).join(' ').trim();
  }, []);

  const displaySquatRackParts = useCallback((value?: string | null) => {
    const parsed = parseSquatRack(value);
    return {
      height: parsed.height || 'TBD',
      position: parsed.orientation || 'TBD',
    };
  }, [parseSquatRack]);

  useEffect(() => {
    if (!meet) return;

    const parsedSquatRack = parseSquatRack(meet.rack_heights?.squat);

    setMeetForm((prev) => ({
      ...prev,
      location: meet.location || '',
      flight_platform: meet.flight_platform || '',
      weight_class: meet.weight_class || '',
      weigh_in_bodyweight_kg: meet.weigh_in_bodyweight_kg != null ? (formatMeetWeightNumber(meet.weigh_in_bodyweight_kg, displayUnit) || '') : '',
      squat_rack_height: parsedSquatRack.height,
      squat_rack_orientation: parsedSquatRack.orientation,
      bench_rack_height: meet.rack_heights?.bench || '',
      bench_safety_height: meet.rack_heights?.bench_safety || '',
      gear_text: gearItems.join('\n'),
    }));
  }, [displayUnit, meet, gearItems, parseSquatRack]);

  useEffect(() => {
    if (!detailsModalOpen || weightClassOptions.length === 0) return;
    setMeetForm((prev) => {
      const current = prev.weight_class.trim();
      if (current && weightClassOptions.includes(current)) return prev;
      return { ...prev, weight_class: weightClassOptions[0] || current };
    });
  }, [detailsModalOpen, weightClassOptions]);

  const updateMeetFormField = useCallback((key: keyof typeof meetForm, value: string) => {
    setMeetForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const meetBagDraftItems = useMemo(
    () => meetForm.gear_text.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
    [meetForm.gear_text]
  );

  const updateMeetBagDraftItems = useCallback((items: string[]) => {
    const cleaned = items.map((item) => item.trim()).filter(Boolean);
    updateMeetFormField('gear_text', cleaned.join('\n'));
  }, [updateMeetFormField]);

  const addMeetBagDraftItem = useCallback(() => {
    const item = newMeetBagItem.trim();
    if (!item) return;
    updateMeetBagDraftItems([...meetBagDraftItems, item]);
    setNewMeetBagItem('');
  }, [meetBagDraftItems, newMeetBagItem, updateMeetBagDraftItems]);

  const removeMeetBagDraftItem = useCallback((index: number) => {
    updateMeetBagDraftItems(meetBagDraftItems.filter((_, itemIndex) => itemIndex !== index));
  }, [meetBagDraftItems, updateMeetBagDraftItems]);

  const updateMeetStatusConfirmed = useCallback(async (action: 'start' | 'finish') => {
    if (!token) {
      setError('Not authenticated. Please log in again.');
      return;
    }

    try {
      const endpoint =
        action === 'start'
          ? '/meet-planner/mobile/athlete/current/start'
          : '/meet-planner/mobile/athlete/current/finish';

      const res: any = await fetchJson(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const status = Number(res?.status ?? 0);
      const json = res?.json ?? res;

      if (res?.ok !== true) {
        const msg =
          json?.error ||
          json?.message ||
          `Could not update meet status (${status || 'unknown'})`;

        setError(String(msg));

        if (status === 401) {
          router.replace('/login');
        }

        return;
      }

      await loadMeetPlan({ silent: true });

      if (action === 'finish') {
        setActiveTab('summary');
      }
    } catch (err) {
      console.log('Meet status update error', err);
      setError('Network error while updating meet status.');
    }
  }, [loadMeetPlan, router, token]);

  const updateMeetStatus = useCallback(async (action: 'start' | 'finish') => {
    if (action === 'finish') {
      Alert.alert(
        'Finish Meet?',
        'Log meet as complete? A full recap will be generated for you and your coach.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Finish Meet',
            style: 'default',
            onPress: () => {
              updateMeetStatusConfirmed('finish');
            },
          },
        ]
      );

      return;
    }

    updateMeetStatusConfirmed(action);
  }, [updateMeetStatusConfirmed]);

  const saveMeetDetails = useCallback(async () => {
    if (!token) {
      setError('Not authenticated. Please log in again.');
      return;
    }

    try {
      setSavingMeetDetails(true);

      const parsedGearItems = meetForm.gear_text
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);

      const nextGearItems = parsedGearItems.length ? parsedGearItems : DEFAULT_GEAR_ITEMS;

      const bodyweightText = meetForm.weigh_in_bodyweight_kg.trim();
      const squatRackValue = formatSquatRack(meetForm.squat_rack_height, meetForm.squat_rack_orientation);
      const res: any = await fetchJson('/meet-planner/mobile/athlete/current/details', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: meetForm.location,
          flight_platform: meetForm.flight_platform,
          weight_class: meetForm.weight_class,
          weigh_in_bodyweight_kg: bodyweightText ? displayMeetWeightToKg(Number(bodyweightText), displayUnit) : null,
          squat_rack_height: squatRackValue,
          bench_rack_height: meetForm.bench_rack_height,
          bench_safety_height: meetForm.bench_safety_height,
        }),
      });

      const status = Number(res?.status ?? 0);
      const json = res?.json ?? res;

      if (res?.ok !== true) {
        const msg = json?.error || json?.message || `Could not save meet details (${status || 'unknown'})`;
        setError(String(msg));
        if (status === 401) router.replace('/login');
        return;
      }

      setGearItems(nextGearItems);
      setCheckedGear((prev) => {
        const next: Record<string, boolean> = {};
        nextGearItems.forEach((item) => {
          next[item] = !!prev[item];
        });
        return next;
      });

      setDetailsModalOpen(false);
      setActiveTab('overview');
      await loadMeetPlan({ silent: true });
    } catch (err) {
      console.log('Meet details save error', err);
      setError('Network error while saving meet details.');
    } finally {
      setSavingMeetDetails(false);
    }
  }, [displayUnit, formatSquatRack, gearItems, loadMeetPlan, meetForm, router, token]);

  const submitAttemptResult = useCallback(
    async () => {
      if (!attemptDraft) return;

      if (!token) {
        setError('Not authenticated. Please log in again.');
        return;
      }

      const attempt = attemptDraft.attempt;
      const actualWeightDisplay = Number.parseFloat(attemptDraft.actualWeightKg || '');
      const actualWeight = Number.isFinite(actualWeightDisplay)
        ? displayMeetWeightToKg(actualWeightDisplay, displayUnit)
        : Number.NaN;
      const typedNote = attemptDraft.notes.trim();
      const notes = attemptDraft.rpe
        ? [`RPE ${attemptDraft.rpe}`, typedNote].filter(Boolean).join(' — ')
        : typedNote || null;

      if (!attemptDraft.result) {
        setError('Choose a result before saving.');
        return;
      }

      try {
        setSavingAttemptId(attempt.id);
        const res: any = await fetchJson(`/meet-planner/mobile/athlete/attempts/${attempt.id}/result`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            result: attemptDraft.result,
            actual_weight_kg: Number.isFinite(actualWeight) ? actualWeight : attempt.weight_kg,
            miss_reason: attemptDraft.result === 'miss' ? attemptDraft.missReason : null,
            notes,
          }),
        });

        const status = Number(res?.status ?? 0);
        const json = res?.json ?? res;

        if (res?.ok !== true) {
          const msg = json?.error || json?.message || `Could not save result (${status || 'unknown'})`;
          setError(String(msg));
          if (status === 401) router.replace('/login');
          return;
        }

        const updatedResult = json?.result as MeetAttemptResult | undefined;
        if (!updatedResult) return;

        setAttemptDraft(null);
        await loadMeetPlan({ silent: true });
      } catch (err) {
        console.log('Meet attempt result save error', err);
        setError('Network error while saving attempt result.');
      } finally {
        setSavingAttemptId(null);
      }
    },
    [attemptDraft, displayUnit, loadMeetPlan, token, router]
  );

  const clearAttemptResult = useCallback(
    async (attempt: MeetAttempt) => {
      if (!token) {
        setError('Not authenticated. Please log in again.');
        return;
      }

      try {
        setSavingAttemptId(attempt.id);
        const res: any = await fetchJson(`/meet-planner/mobile/athlete/attempts/${attempt.id}/result`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const status = Number(res?.status ?? 0);
        const json = res?.json ?? res;

        if (res?.ok !== true) {
          const msg = json?.error || json?.message || `Could not clear result (${status || 'unknown'})`;
          setError(String(msg));
          if (status === 401) router.replace('/login');
          return;
        }

        await loadMeetPlan({ silent: true });
      } catch (err) {
        console.log('Meet attempt result clear error', err);
        setError('Network error while clearing attempt result.');
      } finally {
        setSavingAttemptId(null);
      }
    },
    [loadMeetPlan, token, router]
  );

  const attemptsForLift = payload?.attempts?.[activeLift] || [];
  const warmupsForLift = payload?.warmups?.[activeLift] || [];
  const tmForLift = payload?.training_maxes?.[activeLift] ?? null;
  const notes = payload?.notes || [];
  const activeWarmupsCollapsed = !!collapsedWarmups[activeLift];
  const toggleActiveWarmups = useCallback(() => {
    setCollapsedWarmups((prev) => ({ ...prev, [activeLift]: !prev[activeLift] }));
  }, [activeLift]);

  const renderMainTabs = () => {
    const tabs: Array<{ key: MainTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
      { key: 'overview', label: 'Overview', icon: 'information-circle-outline' },
      { key: 'attempts', label: 'Attempts', icon: 'podium-outline' },
      { key: 'warmups', label: 'Warmups', icon: 'barbell-outline' },
      { key: 'notes', label: 'Notes', icon: 'reader-outline' },
      ...(canShowSummaryTab ? [{ key: 'summary' as MainTab, label: 'Recap', icon: 'sparkles-outline' as React.ComponentProps<typeof Ionicons>['name'] }] : []),
    ];

    return (
      <View style={styles.mainTabs}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => [
                styles.mainTab,
                active ? styles.mainTabActive : null,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name={tab.icon} size={15} color={active ? SLColors.accentViolet : SLColors.textMuted} />
              <Text style={[styles.mainTabText, active ? styles.mainTabTextActive : null]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderLiftTabs = () => (
    <View style={styles.liftTabs}>
      {liftOrder.map((lift) => {
        const active = activeLift === lift;
        const attempts = payload?.attempts?.[lift] || [];
        const logged = attempts.filter((attempt) => attempt.result).length;
        const total = attempts.length || 3;
        const complete = total > 0 && logged >= total;
        return (
          <Pressable
            key={lift}
            onPress={() => setActiveLift(lift)}
            style={({ pressed }) => [
              styles.liftTab,
              active ? styles.liftTabActive : null,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.liftTabText, active ? styles.liftTabTextActive : null]}>{liftLabels[lift]}</Text>
            <View style={styles.liftTabMetaRow}>
              <Text style={[styles.liftTabMeta, active ? styles.liftTabMetaActive : null]}>{logged}/{total}</Text>
              {complete ? <Ionicons name="checkmark" size={12} color={active ? SLColors.warning : SLColors.success} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  const renderMeetPacket = () => {
    if (!meet) return null;

    const gearCheckedCount = gearItems.filter((item) => checkedGear[item]).length;
    const requiredLifts = requiredLiftsForMeetCategory(meet);
    const showSquatRack = requiredLifts.includes('SQ');
    const showBenchRack = requiredLifts.includes('BN');
    const showPlatformSetup = showSquatRack || showBenchRack;
    const squatRackParts = displaySquatRackParts(meet.rack_heights?.squat);
    const hasMeaningfulValue = (value?: string | null) => {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return false;
      return !['tbd', 'none', 'null', 'n/a', 'na', '-', '—'].includes(raw);
    };
    const hasValidSquatRack = (value?: string | null) => {
      const raw = String(value || '').trim();
      if (!hasMeaningfulValue(raw)) return false;
      const parts = raw.split(/\s+/);
      const orientation = parts[parts.length - 1]?.toLowerCase();
      return orientation === 'in' || orientation === 'out';
    };
    const attemptsReady = liftOrder.every((lift) => (payload?.attempts?.[lift] || []).filter((attempt) => attempt.weight_kg != null || attempt.target_weight_kg != null || attempt.min_weight_kg != null || attempt.max_weight_kg != null).length >= 3);
    const readinessRows = [
      { label: 'Weigh-in', ready: meet.weigh_in_bodyweight_kg != null || hasMeaningfulValue(meet.weigh_in_time_display), detail: meet.weigh_in_time_display || meet.weigh_in_day_label || 'Needs info' },
      { label: 'Flight / platform', ready: hasMeaningfulValue(meet.flight_platform), detail: meet.flight_platform || 'Needs info' },
      { label: 'Rack heights', ready: (!showSquatRack || hasValidSquatRack(meet.rack_heights?.squat)) && (!showBenchRack || (hasMeaningfulValue(meet.rack_heights?.bench) && hasMeaningfulValue(meet.rack_heights?.bench_safety))), detail: showPlatformSetup ? 'Platform setup' : 'Not required' },
      { label: 'Attempts', ready: attemptsReady, detail: attemptsReady ? 'Attempts loaded' : 'Needs attempts' },
      { label: 'Meet bag', ready: gearCheckedCount === gearItems.length && gearItems.length > 0, detail: `${gearCheckedCount}/${gearItems.length}` },
    ];
    const canBeginMeet = meet.status === 'prep_visible' && !!meet.can_start_meet && readinessRows.every((row) => row.ready);
    const stateLabel = payload?.meet_state?.label || (meet.status === 'completed' ? 'Meet Recap' : 'Meet Packet');
    const statusLabel = meet.status === 'completed' ? 'Completed' : meet.status === 'active' ? 'In Progress' : 'Pre-meet';

    return (
      <View style={styles.packetStack}>
        <View style={styles.packetHero}>
          <View style={styles.packetHeroBody}>
            <View style={styles.packetHeroTop}>
              <View>
                <Text style={styles.packetKicker}>{stateLabel}</Text>
                <Text style={styles.packetStatusText}>{statusLabel}</Text>
              </View>
              <Pressable
                onPress={() => setDetailsModalOpen(true)}
                style={({ pressed }) => [styles.packetUtilityButton, pressed && styles.pressed]}
              >
                <Ionicons name="create-outline" size={14} color={SLColors.accentViolet} />
                <Text style={styles.packetUtilityText}>Edit</Text>
              </Pressable>
            </View>
            <Text style={styles.packetMeetName}>{meet.name || 'Meet'}</Text>
            <Text style={styles.packetMeetMeta} numberOfLines={2}>
              {[meet.federation, meet.date_display || 'Date TBD', daysOutLabel(meet)].filter(Boolean).join(' / ')}
            </Text>
            <Text style={styles.packetMeetSub} numberOfLines={1}>
              {[meet.weight_class, divisionDisplay(meet)].filter((value) => value && value !== 'TBD').join(' / ') || 'Weight class and division TBD'}
            </Text>
            {canBeginMeet ? (
              <Pressable
                onPress={() => updateMeetStatus('start')}
                style={({ pressed }) => [styles.packetPrimaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.packetPrimaryText}>Begin Meet</Text>
                <Ionicons name="arrow-forward" size={16} color={SLColors.success} />
              </Pressable>
            ) : null}
            {meet.status === 'active' ? (
              <View style={styles.packetPrimaryButton}>
                <Text style={styles.packetPrimaryText}>Log Attempts</Text>
                <Ionicons name="radio-button-on-outline" size={16} color={SLColors.success} />
              </View>
            ) : null}
            {meet?.can_finish_meet ? (
              <Pressable
                onPress={() => updateMeetStatus('finish')}
                style={({ pressed }) => [styles.packetPrimaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.packetPrimaryText}>Finish Meet</Text>
                <Ionicons name="checkmark-done-outline" size={16} color={SLColors.success} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.packetSection}>
          <View style={styles.packetSectionHeader}>
            <Text style={styles.packetSectionLabel}>Meet Readiness</Text>
            <Text style={styles.packetSectionMeta}>{readinessRows.filter((row) => row.ready).length}/{readinessRows.length}</Text>
          </View>
          <View style={styles.readinessList}>
            {readinessRows.map((row) => (
              <View key={row.label} style={styles.readinessPacketRow}>
                <View style={[styles.readinessMark, row.ready ? styles.readinessMarkReady : null]}>
                  <Ionicons name={row.ready ? 'checkmark' : 'ellipse-outline'} size={13} color={row.ready ? SLColors.success : SLColors.textMuted} />
                </View>
                <View style={styles.readinessPacketCopy}>
                  <Text style={styles.readinessPacketLabel}>{row.label}</Text>
                  <Text style={styles.readinessPacketDetail}>{row.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.packetSection}>
          <View style={styles.packetSectionHeader}>
            <Text style={styles.packetSectionLabel}>Attempts</Text>
            <Text style={styles.packetSectionMeta}>Opener / second / third</Text>
          </View>
          {liftOrder.map((lift) => {
            const rows = (payload?.attempts?.[lift] || []).slice(0, 3);
            return (
              <View key={lift} style={styles.attemptPreviewLift}>
                <Text style={styles.attemptPreviewLiftLabel}>{liftLabels[lift]}</Text>
                <View style={styles.attemptPreviewGrid}>
                  {[0, 1, 2].map((index) => {
                    const attempt = rows[index];
                    return (
                      <View key={`${lift}-${index}`} style={styles.attemptPreviewCell}>
                        <Text style={styles.attemptPreviewLabel}>{attemptLabel(index + 1)}</Text>
                        <Text style={styles.attemptPreviewValue}>{attempt ? attemptDisplayWeight(attempt, displayUnit) : '—'}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.packetSection}>
          <Pressable onPress={toggleActiveWarmups} style={({ pressed }) => [styles.packetSectionHeader, pressed && styles.pressed]}>
            <View>
              <Text style={styles.packetSectionLabel}>Warmups</Text>
              <Text style={styles.packetSectionMeta}>{liftLabels[activeLift]} · {warmupsForLift.length} sets</Text>
            </View>
            <Ionicons name={activeWarmupsCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={SLColors.textMuted} />
          </Pressable>
          {renderLiftTabs()}
          {!activeWarmupsCollapsed ? (
            <View style={styles.warmupPacketList}>
              {warmupsForLift.length > 0 ? (
                warmupsForLift.map((warmup, index) => (
                  <Pressable
                    key={warmup.id}
                    disabled={!canLogMeetResults}
                    onPress={() => setCheckedWarmups((prev) => ({ ...prev, [warmup.id]: !prev[warmup.id] }))}
                    style={({ pressed }) => [
                      styles.warmupPacketRow,
                      checkedWarmups[warmup.id] ? styles.warmupPacketRowChecked : null,
                      pressed && canLogMeetResults && styles.pressed,
                    ]}
                  >
                    <Text style={styles.warmupPacketIndex}>{index + 1}</Text>
                    <View style={styles.warmupPacketCopy}>
                      <Text style={styles.warmupPacketValue}>{formatMeetWeight(warmup.weight_kg, displayUnit)} x {warmup.reps ?? '—'}</Text>
                      <Text style={styles.warmupPacketMeta}>{[warmup.minutes_until_opener != null ? `-${warmup.minutes_until_opener} min` : null, warmup.label].filter(Boolean).join(' / ') || 'Warmup set'}</Text>
                    </View>
                    {canLogMeetResults ? (
                      <Ionicons name={checkedWarmups[warmup.id] ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={checkedWarmups[warmup.id] ? SLColors.success : SLColors.textMuted} />
                    ) : null}
                  </Pressable>
                ))
              ) : (
                <EmptyBlock text="No warmups set yet." />
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.packetSection}>
          <View style={styles.packetSectionHeader}>
            <Text style={styles.packetSectionLabel}>Meet Bag</Text>
            <Text style={styles.packetSectionMeta}>{gearCheckedCount}/{gearItems.length}</Text>
          </View>
          <View style={styles.gearList}>
            {gearItems.map((item) => {
              const checked = !!checkedGear[item];
              return (
                <Pressable
                  key={item}
                  onPress={() => setCheckedGear((prev) => ({ ...prev, [item]: !prev[item] }))}
                  style={({ pressed }) => [styles.gearPacketRow, pressed && styles.pressed]}
                >
                  <Ionicons name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={checked ? SLColors.success : SLColors.textMuted} />
                  <Text style={[styles.gearText, checked ? styles.gearTextChecked : null]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.packetSection}>
          <View style={styles.packetSectionHeader}>
            <Text style={styles.packetSectionLabel}>Meet Logistics</Text>
            <Text style={styles.packetSectionMeta}>Secondary</Text>
          </View>
          <View style={styles.meetDetailRows}>
            <DetailRow label="Location" value={meet.location || 'TBD'} />
            <DetailRow label="Flight / Platform" value={meet.flight_platform || 'TBD'} />
            <DetailRow label="Start time" value={meet.start_time_display || 'TBD'} />
            <DetailRow label="Weigh-in" value={[meet.weigh_in_day_label, meet.weigh_in_time_display].filter(Boolean).join(' / ') || 'TBD'} />
            {showSquatRack ? <DetailRow label="Squat rack" value={`${squatRackParts.height} / ${squatRackParts.position}`} /> : null}
            {showBenchRack ? <DetailRow label="Bench rack" value={`${meet.rack_heights?.bench || 'TBD'} / ${meet.rack_heights?.bench_safety || 'TBD'}`} /> : null}
          </View>
        </View>

        <View style={styles.packetSection}>
          <View style={styles.packetSectionHeader}>
            <Text style={styles.packetSectionLabel}>Meet Day Focus</Text>
            <Text style={styles.packetSectionMeta}>Coach</Text>
          </View>
          {meet.coach_notes?.trim() ? (
            <Text style={styles.packetFocusText}>{meet.coach_notes}</Text>
          ) : notes.length ? (
            notes.slice(0, 2).map((note) => (
              <View key={note.id} style={styles.focusNoteRow}>
                <Text style={styles.noteCategory}>{note.category ? note.category.replace(/_/g, ' ') : 'General'}</Text>
                <Text style={styles.noteBody}>{note.body || ''}</Text>
              </View>
            ))
          ) : (
            <EmptyBlock text="No meet-day focus yet." />
          )}
        </View>

        {canShowSummaryTab ? renderSummary() : null}

        <Modal
          visible={detailsModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setDetailsModalOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
            style={styles.detailsModalKeyboardWrap}
          >
            <View style={styles.detailsModalBackdrop}>
              <Pressable style={styles.modalBackdropPressable} onPress={() => setDetailsModalOpen(false)} />
              <View style={styles.meetDetailsModalCard}>
                <View style={styles.meetDetailsModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.meetDetailsModalTitle}>Update Meet Packet</Text>
                    <Text style={styles.meetDetailsModalSubtitle}>Update logistics, check-in, platform setup, and meet bag.</Text>
                  </View>
                  <Pressable
                    onPress={() => setDetailsModalOpen(false)}
                    style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={18} color={SLColors.text} />
                  </Pressable>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  contentContainerStyle={styles.meetDetailsModalContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.meetDetailsSection}>
                    <Text style={styles.meetDetailsSectionTitle}>Logistics</Text>
                    <View style={styles.meetControlStack}>
                      <View>
                        <Text style={styles.meetFieldLabel}>Location</Text>
                        <TextInput value={meetForm.location} onChangeText={(value) => updateMeetFormField('location', value)} placeholder="Venue / city" placeholderTextColor={SLColors.textSubtle} style={styles.meetFieldInput} />
                      </View>
                      <View>
                        <Text style={styles.meetFieldLabel}>Flight / Platform</Text>
                        <TextInput value={meetForm.flight_platform} onChangeText={(value) => updateMeetFormField('flight_platform', value)} placeholder="A / Platform 1" placeholderTextColor={SLColors.textSubtle} style={styles.meetFieldInput} />
                      </View>
                      <View>
                        <View style={styles.selectorLabelRow}>
                          <Text style={styles.meetFieldLabel}>Weight Class</Text>
                          <Text style={styles.selectorContextText}>({weightClassContext})</Text>
                        </View>
                        <HorizontalWheelSelector
                          options={weightClassOptions}
                          value={meetForm.weight_class || weightClassOptions[0]}
                          onChange={(value) => updateMeetFormField('weight_class', value)}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.meetDetailsSection}>
                    <Text style={styles.meetDetailsSectionTitle}>Check-in</Text>
                    <View style={styles.compactInputRow}>
                      <Text style={styles.compactInputLabel}>Actual BW</Text>
                      <TextInput value={meetForm.weigh_in_bodyweight_kg} onChangeText={(value) => updateMeetFormField('weigh_in_bodyweight_kg', value)} placeholder={displayUnit === 'lb' ? '198' : '89.7'} placeholderTextColor={SLColors.textSubtle} keyboardType="decimal-pad" style={styles.compactNumberInput} />
                      <Text style={styles.compactInputUnit}>{displayUnit}</Text>
                    </View>
                  </View>

                  {showPlatformSetup ? (
                    <View style={styles.meetDetailsSection}>
                      <Text style={styles.meetDetailsSectionTitle}>Platform Setup</Text>
                      <View style={styles.platformWheelGrid}>
                        {showSquatRack ? (
                          <>
                            <VerticalWheelSelector label="Squat Rack" options={RACK_HEIGHT_OPTIONS} value={meetForm.squat_rack_height || RACK_HEIGHT_OPTIONS[0]} onChange={(value) => updateMeetFormField('squat_rack_height', value)} />
                            <VerticalWheelSelector label="Position" options={RACK_POSITION_OPTIONS} value={meetForm.squat_rack_orientation || RACK_POSITION_OPTIONS[0]} onChange={(value) => updateMeetFormField('squat_rack_orientation', value)} />
                          </>
                        ) : null}
                        {showBenchRack ? (
                          <>
                            <VerticalWheelSelector label="Bench Rack" options={RACK_HEIGHT_OPTIONS} value={meetForm.bench_rack_height || RACK_HEIGHT_OPTIONS[0]} onChange={(value) => updateMeetFormField('bench_rack_height', value)} />
                            <VerticalWheelSelector label="Bench Safety" options={RACK_HEIGHT_OPTIONS} value={meetForm.bench_safety_height || RACK_HEIGHT_OPTIONS[0]} onChange={(value) => updateMeetFormField('bench_safety_height', value)} />
                          </>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.meetDetailsSection}>
                    <Text style={styles.meetDetailsSectionTitle}>Meet Bag</Text>
                    <Text style={styles.meetFieldHint}>Build the list you want in your bag on meet day.</Text>
                    <View style={styles.meetBagEditorList}>
                      {meetBagDraftItems.map((item, index) => (
                        <View key={`${item}-${index}`} style={styles.meetBagEditorRow}>
                          <Ionicons name="bag-check-outline" size={17} color={SLColors.warning} />
                          <Text style={styles.meetBagEditorText}>{item}</Text>
                          <Pressable onPress={() => removeMeetBagDraftItem(index)} hitSlop={8} style={({ pressed }) => [styles.meetBagDeleteButton, pressed && styles.pressed]}>
                            <Ionicons name="close" size={16} color={SLColors.textMuted} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                    <View style={styles.meetBagAddRow}>
                      <TextInput value={newMeetBagItem} onChangeText={setNewMeetBagItem} placeholder="Add item" placeholderTextColor={SLColors.textSubtle} style={styles.meetBagAddInput} returnKeyType="done" onSubmitEditing={addMeetBagDraftItem} />
                      <Pressable onPress={addMeetBagDraftItem} style={({ pressed }) => [styles.meetBagAddButton, pressed && styles.pressed]}>
                        <Ionicons name="add" size={17} color={SLColors.accentViolet} />
                        <Text style={styles.meetBagAddText}>Add</Text>
                      </Pressable>
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.meetDetailsFooter}>
                  <Pressable onPress={() => setDetailsModalOpen(false)} style={({ pressed }) => [styles.meetDetailsSecondaryButton, pressed && styles.pressed]}>
                    <Text style={styles.meetDetailsSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable disabled={savingMeetDetails} onPress={saveMeetDetails} style={({ pressed }) => [styles.meetDetailsPrimaryButton, pressed && styles.pressed, savingMeetDetails ? styles.disabledButton : null]}>
                    <Text style={styles.meetDetailsPrimaryText}>{savingMeetDetails ? 'Saving…' : 'Save Packet'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  };

  const renderMeetActive = () => {
    if (!meet) return null;
    const progress = payload?.attempt_progress;
    const logged = progress?.attempts_logged ?? 0;
    const total = progress?.attempts_total ?? liftOrder.reduce((sum, lift) => sum + (payload?.attempts?.[lift] || []).length, 0);
    const remaining = progress?.attempts_remaining ?? Math.max(0, total - logged);
    const allAttempts = liftOrder.flatMap((lift) =>
      (payload?.attempts?.[lift] || []).map((attempt) => ({ lift, attempt }))
    );
    const nextAttempt =
      allAttempts.find((entry) => entry.attempt.id === progress?.next_unlogged_attempt_id) ||
      allAttempts.find((entry) => !entry.attempt.result);
    const selectedAttempts = (payload?.attempts?.[activeLift] || []).slice(0, 3);
    const selectedWarmups = payload?.warmups?.[activeLift] || [];
    const selectedLiftLabel = liftLabels[activeLift];
    const eventLogged = selectedAttempts.filter((attempt) => attempt.result).length;
    const eventStatus = eventLogged === 0 ? 'Not started' : eventLogged >= selectedAttempts.length && selectedAttempts.length > 0 ? 'Complete' : 'In progress';
    const openerWeight = selectedAttempts[0]?.target_weight_kg ?? selectedAttempts[0]?.weight_kg ?? null;
    const meetInstructions = [
      meet.coach_notes?.trim()
        ? {
            key: 'coach-notes',
            label: 'Meet Day Instructions',
            body: meet.coach_notes.trim(),
          }
        : null,
      ...notes
        .filter((note) => !!note.body?.trim())
        .slice(0, 2)
        .map((note) => ({
          key: `note-${note.id}`,
          label: note.category ? prettyTag(note.category) || 'Coach Note' : 'Coach Note',
          body: note.body?.trim() || '',
        })),
    ].filter(Boolean) as Array<{ key: string; label: string; body: string }>;

    return (
      <View style={styles.packetStack}>
        <View style={[styles.packetHero, styles.activeHero]}>
          <View style={styles.packetHeroBody}>
            <View style={styles.packetHeroTop}>
              <View>
                <Text style={styles.packetKicker}>Meet Active</Text>
                <Text style={styles.packetStatusText}>In Progress</Text>
              </View>
              <View style={styles.activeStatusPill}>
                <Text style={styles.activeStatusText}>{logged}/{total}</Text>
              </View>
            </View>
            <Text style={styles.packetMeetName}>{meet.name || 'Meet'}</Text>
            <Text style={styles.packetMeetMeta} numberOfLines={2}>
              {[meet.federation, meet.date_display || 'Date TBD', 'Attempt board'].filter(Boolean).join(' / ')}
            </Text>
            <View style={styles.activeProgressTrack}>
              <View style={[styles.activeProgressFill, { width: total > 0 ? `${Math.min(100, (logged / total) * 100)}%` : '0%' }]} />
            </View>
            <Text style={styles.activeProgressText}>
              {remaining === 0 ? 'All attempts logged. Ready to finish.' : `${remaining} attempt${remaining === 1 ? '' : 's'} remaining`}
            </Text>
            {nextAttempt ? (
              <Text style={styles.activeNextText}>
                Next: {liftLabels[nextAttempt.lift]} {attemptLabel(nextAttempt.attempt.attempt_number).toLowerCase()} · {attemptPlanLabel(nextAttempt.attempt, displayUnit)}
              </Text>
            ) : null}
            {remaining === 0 ? (
              <Pressable onPress={() => updateMeetStatus('finish')} style={({ pressed }) => [styles.packetPrimaryButton, pressed && styles.pressed]}>
                <Text style={styles.packetPrimaryText}>Finish Meet</Text>
                <Ionicons name="checkmark-done-outline" size={16} color={SLColors.success} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.activeFocusSection}>
          <View style={styles.packetSectionHeader}>
            <Text style={styles.packetSectionLabel}>Meet Day Focus</Text>
            <Text style={styles.packetSectionMeta}>Coach</Text>
          </View>
          {meetInstructions.length ? (
            <View style={styles.activeInstructionList}>
              {meetInstructions.map((instruction) => (
                <View key={instruction.key} style={styles.activeInstructionRow}>
                  <View style={styles.activeInstructionCopy}>
                    <Text style={styles.activeInstructionLabel}>{instruction.label}</Text>
                    <Text style={styles.activeInstructionBody}>{instruction.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <EmptyBlock text="No meet-day instructions yet." />
          )}
        </View>

        <View style={styles.activeEventTabs}>
          {renderLiftTabs()}
        </View>

        <View style={styles.activeEventSection}>
          <Pressable onPress={toggleActiveWarmups} style={({ pressed }) => [styles.packetSectionHeader, pressed && styles.pressed]}>
            <View>
              <Text style={styles.packetSectionLabel}>Warmups</Text>
              <Text style={styles.packetSectionMeta}>{selectedWarmups.length} sets</Text>
            </View>
            <Ionicons name={activeWarmupsCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={SLColors.textMuted} />
          </Pressable>
          {!activeWarmupsCollapsed && selectedWarmups.length ? (
            <View style={styles.activeWarmupList}>
              {selectedWarmups.map((warmup, index) => {
                const pctOpener = openerWeight && warmup.weight_kg != null ? Math.round((warmup.weight_kg / openerWeight) * 100) : null;
                return (
                  <Pressable
                    key={warmup.id}
                    onPress={() => setCheckedWarmups((prev) => ({ ...prev, [warmup.id]: !prev[warmup.id] }))}
                    style={({ pressed }) => [
                      styles.activeWarmupRow,
                      checkedWarmups[warmup.id] ? styles.activeWarmupRowChecked : null,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.activeWarmupCheck, checkedWarmups[warmup.id] ? styles.activeWarmupCheckDone : null]}>
                      {checkedWarmups[warmup.id] ? <Ionicons name="checkmark" size={14} color={SLColors.success} /> : <Text style={styles.activeWarmupIndex}>{index + 1}</Text>}
                    </View>
                    <View style={styles.activeWarmupCopy}>
                      <Text style={[styles.activeWarmupValue, checkedWarmups[warmup.id] ? styles.activeWarmupValueDone : null]}>
                        {formatMeetWeight(warmup.weight_kg, displayUnit)} × {warmup.reps || '—'}
                      </Text>
                      <Text style={styles.activeWarmupMeta}>
                        {[warmup.minutes_until_opener != null ? `-${warmup.minutes_until_opener} min` : null, pctOpener != null ? `${pctOpener}% opener` : null, warmup.label].filter(Boolean).join(' · ') || 'Warmup'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : !activeWarmupsCollapsed ? (
            <EmptyBlock text={`No ${selectedLiftLabel.toLowerCase()} warmups set yet.`} />
          ) : null}
        </View>

        <View style={styles.activeEventSection}>
          <View style={styles.packetSectionHeader}>
            <Text style={styles.packetSectionLabel}>Attempts</Text>
            <Text style={styles.packetSectionMeta}>{eventLogged}/{selectedAttempts.length || 3}</Text>
          </View>
          {selectedAttempts.length ? (
            selectedAttempts.map((attempt, index) => {
              const previousAttempt = index > 0 ? selectedAttempts[index - 1] : null;
              const lockedReason = !attempt.result && previousAttempt && !previousAttempt.result
                ? `Log ${attemptLabel(previousAttempt.attempt_number).toLowerCase()} first`
                : null;
              return (
                <MeetAttemptLogRow
                  key={attempt.id}
                  attempt={attempt}
                  displayUnit={displayUnit}
                  disabled={savingAttemptId === attempt.id}
                  lockedReason={lockedReason}
                  onClear={() => clearAttemptResult(attempt)}
                  onOpenLog={() => openAttemptDraft(attempt)}
                />
              );
            })
          ) : (
            <EmptyBlock text={`No ${selectedLiftLabel.toLowerCase()} attempts set yet.`} />
          )}
        </View>
      </View>
    );
  };

  const renderOverview = () => {
    if (!meet) return null;

    const gearCheckedCount = gearItems.filter((item) => checkedGear[item]).length;
    const squatRackParts = displaySquatRackParts(meet.rack_heights?.squat);
    const requiredLifts = requiredLiftsForMeetCategory(meet);
    const showSquatRack = requiredLifts.includes('SQ');
    const showBenchRack = requiredLifts.includes('BN');
    const showPlatformSetup = showSquatRack || showBenchRack;

    const startMeetBlockers = [...(meet.can_start_meet_blockers || [])];
    const addStartMeetBlocker = (message: string) => {
      if (!startMeetBlockers.includes(message)) {
        startMeetBlockers.push(message);
      }
    };

    const hasMeaningfulValue = (value?: string | null) => {
      const raw = String(value || '').trim().toLowerCase();
      if (!raw) return false;
      return !['tbd', 'none', 'null', 'n/a', 'na', '-', '—'].includes(raw);
    };

    const hasValidSquatRack = (value?: string | null) => {
      const raw = String(value || '').trim();
      if (!hasMeaningfulValue(raw)) return false;

      const parts = raw.split(/\s+/);
      if (parts.length < 2) return false;

      const orientation = parts[parts.length - 1]?.toLowerCase();
      return orientation === 'in' || orientation === 'out';
    };

    if (!hasMeaningfulValue(meet.flight_platform)) {
      addStartMeetBlocker('Flight / platform needs to be recorded.');
    }

    if (meet.weigh_in_bodyweight_kg == null) {
      addStartMeetBlocker('Actual weigh-in bodyweight needs to be recorded.');
    }

    if (showSquatRack && !hasValidSquatRack(meet.rack_heights?.squat)) {
      addStartMeetBlocker('Squat rack height and position need to be recorded.');
    }

    if (showBenchRack && !hasMeaningfulValue(meet.rack_heights?.bench)) {
      addStartMeetBlocker('Bench rack height needs to be recorded.');
    }

    if (showBenchRack && !hasMeaningfulValue(meet.rack_heights?.bench_safety)) {
      addStartMeetBlocker('Bench safety height needs to be recorded.');
    }

    const canBeginMeet = meet.status === 'prep_visible' && !!meet.can_start_meet && startMeetBlockers.length === 0;
    const shouldShowStartRequirements =
      meet.status === 'prep_visible' &&
      !canBeginMeet &&
      startMeetBlockers.length > 0;

    return (
      <View style={styles.stack}>
        <View style={styles.meetSummaryCard}>
        <View style={styles.meetSummaryTopRow}>
            <View style={styles.meetSummaryTopLeft}>
            <View style={styles.heroIconWrap}>
                <SLTrophy size={22} tier="bronze" />
            </View>

            <View style={styles.heroTextCol}>
                <ThemedText variant="h2" style={styles.heroTitle}>
                {meet.date_display || 'Date TBD'}
                </ThemedText>

                <ThemedText variant="bodyMuted" style={styles.heroSubtitle}>
                {daysOutLabel(meet)}
                </ThemedText>
            </View>
            </View>

            <Pressable
            onPress={() => setDetailsModalOpen(true)}
            style={({ pressed }) => [
                styles.meetEditButtonCompact,
                pressed && styles.pressed,
            ]}
            >
            <Ionicons name="create-outline" size={14} color={SLColors.review} />
            <Text style={styles.meetEditButtonCompactText}>
                Edit Details
            </Text>
            </Pressable>
        </View>

        <View style={styles.meetActionStack}>

            {shouldShowStartRequirements ? (
            <View style={styles.startMeetRequirementsBox}>
                <View style={styles.startMeetRequirementsHeader}>
                <Ionicons name="alert-circle-outline" size={16} color={SLColors.warning} />
                <Text style={styles.startMeetRequirementsTitle}>
                    Before you can begin the meet
                </Text>
                </View>

                <View style={styles.startMeetRequirementsList}>
                {startMeetBlockers.map((item) => (
                    <View key={item} style={styles.startMeetRequirementRow}>
                    <View style={styles.startMeetRequirementDot} />
                    <Text style={styles.startMeetRequirementText}>{item}</Text>
                    </View>
                ))}
                </View>

                <Text style={styles.startMeetRequirementsHint}>
                Tap Edit Details to update check-in and platform setup.
                </Text>
            </View>
            ) : null}

            {canBeginMeet ? (
                <Pressable
                onPress={() => updateMeetStatus('start')}
                style={({ pressed }) => [
                    styles.meetStatusButtonStart,
                    pressed && styles.pressed,
                ]}
                >
                <Ionicons name="play-outline" size={15} color={SLColors.success} />
                <Text style={styles.meetStatusButtonStartText}>Begin Meet</Text>
                </Pressable>
            ) : null}

            {meet?.can_finish_meet ? (
                <Pressable
                onPress={() => updateMeetStatus('finish')}
                style={({ pressed }) => [
                    styles.meetStatusButtonFinish,
                    pressed && styles.pressed,
                ]}
                >
                <Ionicons
                    name="checkmark-done-outline"
                    size={15}
                    color={SLColors.textStrong}
                />
                <Text style={styles.meetStatusButtonFinishText}>Finish Meet</Text>
                </Pressable>
            ) : null}
          </View>

          <View style={styles.meetDetailRows}>
            <View style={styles.meetDetailRow}>
              <View style={styles.meetDetailIconWrap}>
                <Ionicons name="location-outline" size={15} color={SLColors.accentViolet} />
              </View>
              <Text style={styles.meetDetailLabel}>Location</Text>
              <Text style={styles.meetDetailValue}>{meet.location || 'TBD'}</Text>
            </View>
            <View style={styles.meetDetailRow}>
              <View style={styles.meetDetailIconWrap}>
                <Ionicons name="podium-outline" size={15} color={SLColors.accentViolet} />
              </View>
              <Text style={styles.meetDetailLabel}>Category</Text>
              <Text style={styles.meetDetailValue}>{meet.meet_category_label || 'TBD'}</Text>
            </View>
            <View style={styles.meetDetailRow}>
              <View style={styles.meetDetailIconWrap}>
                <SLTrophy size={15} tier="bronze" />
              </View>
              <Text style={styles.meetDetailLabel}>Division</Text>
              <Text style={styles.meetDetailValue}>{divisionDisplay(meet)}</Text>
            </View>
            <View style={styles.meetDetailRow}>
              <View style={styles.meetDetailIconWrap}>
                <Ionicons name="time-outline" size={15} color={SLColors.accentViolet} />
              </View>
              <Text style={styles.meetDetailLabel}>Start time</Text>
              <Text style={styles.meetDetailValue}>{meet.start_time_display || 'TBD'}</Text>
            </View>
            <View style={styles.meetDetailRow}>
              <View style={styles.meetDetailIconWrap}>
                <Ionicons name="flag-outline" size={15} color={SLColors.accentViolet} />
              </View>
              <Text style={styles.meetDetailLabel}>Flight / Platform</Text>
              <Text style={styles.meetDetailValue}>{meet.flight_platform || 'TBD'}</Text>
            </View>
            <View style={styles.meetDetailRow}>
              <View style={styles.meetDetailIconWrap}>
                <Ionicons name="barbell-outline" size={15} color={SLColors.accentViolet} />
              </View>
              <Text style={styles.meetDetailLabel}>Weight class</Text>
              <Text style={styles.meetDetailValue}>{meet.weight_class || 'TBD'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.checkInCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="clipboard-outline" size={20} color={SLColors.accentViolet} />
              <ThemedText variant="h3" style={styles.cardTitle}>Check-in</ThemedText>
            </View>
          </View>

          <View style={styles.checkInGrid}>
            <View style={styles.checkInTile}>
              <Text style={styles.checkInLabel}>Weigh-in</Text>
              <Text style={styles.checkInValue}>{meet.weigh_in_day_label || 'Unknown'}</Text>
              <Text style={styles.checkInSubValue}>{meet.weigh_in_time_display || 'Time TBD'}</Text>
            </View>
            <View style={styles.checkInTileAccent}>
              <Text style={styles.checkInLabel}>Actual BW</Text>
              <Text style={styles.checkInValue}>{formatMeetWeight(meet.weigh_in_bodyweight_kg, displayUnit)}</Text>
              <Text style={styles.checkInSubValue}>Recorded weigh-in</Text>
            </View>
          </View>
        </View>

        {showPlatformSetup ? (
          <View style={styles.rackCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="options-outline" size={20} color={SLColors.accentViolet} />
                <ThemedText variant="h3" style={styles.cardTitle}>Platform Setup</ThemedText>
              </View>
            </View>

            <View style={styles.rackGrid}>
              {showSquatRack ? (
                <View style={styles.rackLineCard}>
                  <Text style={styles.rackLineText}>
                    <Text style={styles.rackLineLabel}>Squat Rack: </Text>
                    {squatRackParts.height} / {squatRackParts.position}
                  </Text>
                </View>
              ) : null}

              {showBenchRack ? (
                <View style={styles.rackLineCard}>
                  <Text style={styles.rackLineText}>
                    <Text style={styles.rackLineLabel}>Bench Rack: </Text>
                    {meet.rack_heights?.bench || 'TBD'} / {meet.rack_heights?.bench_safety || 'TBD'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.gearCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="bag-check-outline" size={20} color={SLColors.accentViolet} />
              <ThemedText variant="h3" style={styles.cardTitle}>Gear Checklist</ThemedText>
            </View>
            <Text style={styles.metaText}>{gearCheckedCount}/{gearItems.length}</Text>
          </View>

          <View style={styles.gearList}>
            {gearItems.map((item) => {
              const checked = !!checkedGear[item];
              return (
                <Pressable
                  key={item}
                  onPress={() => setCheckedGear((prev) => ({ ...prev, [item]: !prev[item] }))}
                  style={({ pressed }) => [
                    styles.gearRow,
                    checked ? styles.gearRowChecked : null,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.gearCheckCircle, checked ? styles.gearCheckCircleChecked : null]}>
                    {checked ? <Ionicons name="checkmark" size={14} color={SLColors.success} /> : null}
                  </View>
                  <Text style={[styles.gearText, checked ? styles.gearTextChecked : null]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        <Modal
          visible={detailsModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setDetailsModalOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
            style={styles.detailsModalKeyboardWrap}
          >
            <View style={styles.detailsModalBackdrop}>
              <Pressable style={styles.modalBackdropPressable} onPress={() => setDetailsModalOpen(false)} />
              <View style={styles.meetDetailsModalCard}>
                <View style={styles.meetDetailsModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.meetDetailsModalTitle}>Update Meet Details</Text>
                    <Text style={styles.meetDetailsModalSubtitle}>Update logistics, check-in info, platform setup, and your meet bag.</Text>
                  </View>
                  <Pressable
                    onPress={() => setDetailsModalOpen(false)}
                    style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={18} color={SLColors.text} />
                  </Pressable>
                </View>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.meetDetailsModalContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.meetDetailsSection}>
                    <Text style={styles.meetDetailsSectionTitle}>Meet Logistics</Text>
                    <View style={styles.meetFieldStack}>
                      <View>
                        <Text style={styles.meetFieldLabel}>Location</Text>
                        <TextInput
                          value={meetForm.location}
                          onChangeText={(value) => updateMeetFormField('location', value)}
                          placeholder="Venue / city"
                          placeholderTextColor={SLColors.textSubtle}
                          style={styles.meetFieldInput}
                        />
                      </View>
                      <View>
                        <Text style={styles.meetFieldLabel}>Flight / Platform</Text>
                        <TextInput
                          value={meetForm.flight_platform}
                          onChangeText={(value) => updateMeetFormField('flight_platform', value)}
                          placeholder="A / Platform 1"
                          placeholderTextColor={SLColors.textSubtle}
                          style={styles.meetFieldInput}
                        />
                      </View>
                      <View>
                        <Text style={styles.meetFieldLabel}>Weight Class</Text>
                        <TextInput
                          value={meetForm.weight_class}
                          onChangeText={(value) => updateMeetFormField('weight_class', value)}
                          placeholder="90kg"
                          placeholderTextColor={SLColors.textSubtle}
                          style={styles.meetFieldInput}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.meetDetailsSection}>
                    <Text style={styles.meetDetailsSectionTitle}>Check-in</Text>
                    <View style={styles.meetFieldStack}>
                      <View>
                        <Text style={styles.meetFieldLabel}>Actual Weigh-in BW ({displayUnit})</Text>
                        <TextInput
                          value={meetForm.weigh_in_bodyweight_kg}
                          onChangeText={(value) => updateMeetFormField('weigh_in_bodyweight_kg', value)}
                          placeholder={displayUnit === 'lb' ? '198' : '89.7'}
                          placeholderTextColor={SLColors.textSubtle}
                          keyboardType="decimal-pad"
                          style={styles.meetFieldInput}
                        />
                      </View>
                    </View>
                  </View>

                  {showPlatformSetup ? (
                    <View style={styles.meetDetailsSection}>
                      <Text style={styles.meetDetailsSectionTitle}>Platform Setup</Text>
                      <View style={styles.meetFieldStack}>
                        {showSquatRack ? (
                          <View>
                            <Text style={styles.meetFieldLabel}>Squat Rack</Text>
                            <View style={styles.squatRackInputRow}>
                              <TextInput
                                value={meetForm.squat_rack_height}
                                onChangeText={(value) => updateMeetFormField('squat_rack_height', value)}
                                placeholder="11"
                                placeholderTextColor={SLColors.textSubtle}
                                keyboardType="number-pad"
                                style={[styles.meetFieldInput, styles.squatRackHeightInput]}
                              />
                              <View style={styles.squatRackOrientationGroup}>
                                {(['In', 'Out'] as const).map((option) => {
                                  const active = meetForm.squat_rack_orientation === option;
                                  return (
                                    <Pressable
                                      key={option}
                                      onPress={() => updateMeetFormField('squat_rack_orientation', active ? '' : option)}
                                      style={({ pressed }) => [
                                        styles.squatRackOrientationButton,
                                        active ? styles.squatRackOrientationButtonActive : null,
                                        pressed && styles.pressed,
                                      ]}
                                    >
                                      <Text style={[styles.squatRackOrientationText, active ? styles.squatRackOrientationTextActive : null]}>{option}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>
                          </View>
                        ) : null}

                        {showBenchRack ? (
                          <>
                            <View>
                              <Text style={styles.meetFieldLabel}>Bench Rack Height</Text>
                              <TextInput
                                value={meetForm.bench_rack_height}
                                onChangeText={(value) => updateMeetFormField('bench_rack_height', value)}
                                placeholder="14"
                                placeholderTextColor={SLColors.textSubtle}
                                style={styles.meetFieldInput}
                              />
                            </View>
                            <View>
                              <Text style={styles.meetFieldLabel}>Bench Safety Height</Text>
                              <TextInput
                                value={meetForm.bench_safety_height}
                                onChangeText={(value) => updateMeetFormField('bench_safety_height', value)}
                                placeholder="8"
                                placeholderTextColor={SLColors.textSubtle}
                                style={styles.meetFieldInput}
                              />
                            </View>
                          </>
                        ) : null}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.meetDetailsSection}>
                    <Text style={styles.meetDetailsSectionTitle}>Gear Checklist</Text>
                    <Text style={styles.meetFieldHint}>One item per line. This updates your local checklist for meet day.</Text>
                    <TextInput
                      value={meetForm.gear_text}
                      onChangeText={(value) => updateMeetFormField('gear_text', value)}
                      placeholder="Singlet\nBelt\nDeadlift socks"
                      placeholderTextColor={SLColors.textSubtle}
                      style={[styles.meetFieldInput, styles.meetFieldTextArea]}
                      multiline
                    />
                  </View>
                </ScrollView>

                <View style={styles.meetDetailsFooter}>
                  <Pressable
                    onPress={() => setDetailsModalOpen(false)}
                    style={({ pressed }) => [styles.meetDetailsSecondaryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.meetDetailsSecondaryText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={savingMeetDetails}
                    onPress={saveMeetDetails}
                    style={({ pressed }) => [
                      styles.meetDetailsPrimaryButton,
                      pressed && styles.pressed,
                      savingMeetDetails ? styles.disabledButton : null,
                    ]}
                  >
                    <Text style={styles.meetDetailsPrimaryText}>{savingMeetDetails ? 'Saving…' : 'Save Changes'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        </View>
      </View>
    );
  };

  const renderAttempts = () => (
    <View style={styles.stack}>
        {meet?.can_finish_meet ? (
        <Pressable
            onPress={() => updateMeetStatus('finish')}
            style={({ pressed }) => [
            styles.finishMeetBannerButton,
            pressed && styles.pressed,
            ]}
        >
            <View style={styles.finishMeetBannerContent}>
            <View style={styles.finishMeetBannerIconWrap}>
                <Ionicons
                name="checkmark-done-outline"
                size={20}
                color={SLColors.textStrong}
                />
            </View>

            <View style={styles.finishMeetBannerTextCol}>
                <Text style={styles.finishMeetBannerTitle}>
                Finish Meet
                </Text>

                <Text style={styles.finishMeetBannerSubtitle}>
                All attempts are logged. Generate your meet recap.
                </Text>
            </View>
            </View>
        </Pressable>
        ) : null}

        {renderLiftTabs()}

        <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="podium-outline" size={20} color={SLColors.accentViolet} />
            <ThemedText variant="h3" style={styles.cardTitle}>{liftLabels[activeLift]} Attempts</ThemedText>
          </View>
        </View>

        {attemptsForLift.length > 0 ? (
          attemptsForLift.map((attempt) => {
            const tag = prettyTag(attempt.strategy_tag);
            return (
              <View
                key={attempt.id}
                style={[
                  styles.attemptCard,
                  attempt.result?.result === 'good' ? styles.attemptCardGood : null,
                  attempt.result?.result === 'miss' ? styles.attemptCardMiss : null,
                ]}
              >
                <View style={styles.attemptTopRow}>
                  <View>
                    <Text style={styles.attemptLabel}>{attemptLabel(attempt.attempt_number)}</Text>
                    <Text style={[styles.attemptWeight, isFluidAttempt(attempt) && !attempt.result ? styles.attemptWeightRange : null]}>
                      {attemptDisplayWeight(attempt, displayUnit)}
                    </Text>
                    {attempt.result?.actual_weight_kg != null && attempt.weight_kg != null && attempt.result.actual_weight_kg !== attempt.weight_kg ? (
                      <Text style={styles.plannedWeightText}>Planned {formatMeetWeight(attempt.weight_kg, displayUnit)}</Text>
                    ) : null}
                    {!attempt.result && isFluidAttempt(attempt) ? (
                      <Text style={styles.plannedWeightText}>Meet-day range</Text>
                    ) : null}
                  </View>
                  {attempt.result?.result ? (
                    <Text style={attempt.result.result === 'good' ? styles.resultPillGood : styles.resultPillMiss}>
                      {attempt.result.result === 'good' ? 'Good Lift' : 'Miss'}
                    </Text>
                  ) : tag ? (
                    <Text style={styles.tagPill}>{tag}</Text>
                  ) : null}
                </View>

                {attempt.notes ? <Text style={styles.noteBody}>{attempt.notes}</Text> : null}


                {attempt.result ? (
                  <View style={styles.resultContextBox}>
                    {isFluidAttempt(attempt) ? (
                      <View style={styles.resultContextRow}>
                        <Text style={styles.resultContextLabel}>Range</Text>
                        <Text style={styles.resultContextValue}>{attemptDisplayWeight({ ...attempt, result: null }, displayUnit)}</Text>
                      </View>
                    ) : attempt.weight_kg != null ? (
                      <View style={styles.resultContextRow}>
                        <Text style={styles.resultContextLabel}>Planned</Text>
                        <Text style={styles.resultContextValue}>{formatMeetWeight(attempt.weight_kg, displayUnit)}</Text>
                      </View>
                    ) : null}
                    {attempt.result.result === 'miss' && attempt.result.miss_reason ? (
                      <View style={styles.resultContextRow}>
                        <Text style={styles.resultContextLabel}>Miss reason</Text>
                        <Text style={styles.resultContextValue}>{prettyTag(attempt.result.miss_reason)}</Text>
                      </View>
                    ) : null}
                    {attempt.result.notes ? (
                      <View style={styles.resultContextNotes}>
                        <Text style={styles.resultContextLabel}>Context</Text>
                        <Text style={styles.resultContextNoteText}>{attempt.result.notes}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {canLogMeetResults && attempt.result ? (
                  <Pressable
                    disabled={savingAttemptId === attempt.id}
                    onPress={() => clearAttemptResult(attempt)}
                    style={({ pressed }) => [
                      styles.clearResultButton,
                      pressed && styles.pressed,
                      savingAttemptId === attempt.id ? styles.disabledButton : null,
                    ]}
                  >
                    <Ionicons name="refresh-outline" size={15} color={SLColors.text} />
                    <Text style={styles.clearResultText}>Undo result</Text>
                  </Pressable>
                ) : canLogMeetResults ? (
                  <View style={styles.resultActionsRow}>
                    <Pressable
                      disabled={savingAttemptId === attempt.id}
                      onPress={() => openAttemptDraft(attempt)}
                      style={({ pressed }) => [
                        styles.resultButton,
                        styles.resultButtonGood,
                        pressed && styles.pressed,
                        savingAttemptId === attempt.id ? styles.disabledButton : null,
                      ]}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={SLColors.success} />
                      <Text style={styles.resultButtonGoodText}>Good</Text>
                    </Pressable>

                    <Pressable
                      disabled={savingAttemptId === attempt.id}
                      onPress={() => openAttemptDraft(attempt)}
                      style={({ pressed }) => [
                        styles.resultButton,
                        styles.resultButtonMiss,
                        pressed && styles.pressed,
                        savingAttemptId === attempt.id ? styles.disabledButton : null,
                      ]}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={SLColors.danger} />
                      <Text style={styles.resultButtonMissText}>Miss</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <EmptyBlock text="No attempts set yet." />
        )}
      </View>
    </View>
  );

  const renderWarmups = () => (
    <View style={styles.stack}>
      {renderLiftTabs()}
      <View style={styles.card}>
        <Pressable onPress={toggleActiveWarmups} style={({ pressed }) => [styles.cardHeaderRow, pressed && styles.pressed]}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="barbell-outline" size={20} color={SLColors.accentViolet} />
            <ThemedText variant="h3" style={styles.cardTitle}>{liftLabels[activeLift]} Warmups</ThemedText>
          </View>
          <View style={styles.warmupCollapseMeta}>
            <Text style={styles.metaText}>{warmupsForLift.length} sets</Text>
            <Ionicons name={activeWarmupsCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={SLColors.textMuted} />
          </View>
        </Pressable>

        {!activeWarmupsCollapsed && warmupsForLift.length > 0 ? (
          warmupsForLift.map((warmup, index) => (
            <Pressable
              key={warmup.id}
              disabled={!canLogMeetResults}
              onPress={() => {
                setCheckedWarmups((prev) => ({
                  ...prev,
                  [warmup.id]: !prev[warmup.id],
                }));
              }}
              style={({ pressed }) => [
                styles.warmupRow,
                checkedWarmups[warmup.id] ? styles.warmupRowChecked : null,
                pressed && canLogMeetResults && styles.pressed,
              ]}
            >
              <View style={[styles.warmupIndexBadge, checkedWarmups[warmup.id] ? styles.warmupIndexBadgeChecked : null]}>
                {checkedWarmups[warmup.id] ? (
                  <Ionicons name="checkmark" size={16} color={SLColors.success} />
                ) : (
                  <Text style={styles.warmupIndexText}>{index + 1}</Text>
                )}
              </View>
              <View style={styles.warmupTextCol}>
                <View style={styles.warmupPrescriptionRow}>
                  <Text style={[styles.warmupWeight, checkedWarmups[warmup.id] ? styles.warmupWeightChecked : null]}>
                    {formatMeetWeight(warmup.weight_kg, displayUnit)} × {warmup.reps ?? '—'}
                  </Text>
                  {warmup.minutes_until_opener != null ? (
                    <View style={styles.warmupTimingPill}>
                      <Ionicons name="time-outline" size={12} color={SLColors.review} />
                      <Text style={styles.warmupTimingText}>-{warmup.minutes_until_opener} min</Text>
                    </View>
                  ) : null}
                </View>
                {warmup.label ? (
                  <View style={styles.warmupMetaRow}>
                    <Text style={styles.metaText}>{warmup.label}</Text>
                  </View>
                ) : null}
              </View>
              {canLogMeetResults ? (
                <View style={[styles.warmupCheckCircle, checkedWarmups[warmup.id] ? styles.warmupCheckCircleChecked : null]}>
                  {checkedWarmups[warmup.id] ? <Ionicons name="checkmark" size={14} color={SLColors.success} /> : null}
                </View>
              ) : null}
            </Pressable>
          ))
        ) : !activeWarmupsCollapsed ? (
          <EmptyBlock text="No warmups set yet." />
        ) : null}
      </View>
    </View>
  );

  const renderNotes = () => {
    const hasMeetNotes = !!meet?.coach_notes?.trim();
    const hasStructuredNotes = notes.length > 0;

    return (
      <View style={styles.stack}>
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="reader-outline" size={20} color={SLColors.accentViolet} />
              <ThemedText variant="h3" style={styles.cardTitle}>Coach Notes</ThemedText>
            </View>
          </View>

          {hasMeetNotes ? (
            <View style={styles.noteCardFeatured}>
              <View style={styles.noteFeaturedHeader}>
                <Ionicons name="megaphone-outline" size={16} color={SLColors.review} />
                <Text style={styles.noteFeaturedTitle}>Meet-day notes</Text>
              </View>
              <Text style={styles.noteBody}>{meet?.coach_notes}</Text>
            </View>
          ) : null}

          {hasStructuredNotes ? (
            notes.map((note) => (
              <View key={note.id} style={styles.noteCard}>
                <Text style={styles.noteCategory}>{note.category ? note.category.replace(/_/g, ' ') : 'General'}</Text>
                <Text style={styles.noteBody}>{note.body || ''}</Text>
              </View>
            ))
          ) : null}

          {!hasMeetNotes && !hasStructuredNotes ? (
            <EmptyBlock text="No coach notes yet." />
          ) : null}
        </View>
      </View>
    );
  };

  const renderSummary = () => {
    if (!athleteRecap?.is_available) {
      return (
        <View style={styles.stack}>
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="sparkles-outline" size={20} color={SLColors.accentViolet} />
                <ThemedText variant="h3" style={styles.cardTitle}>Meet Recap</ThemedText>
              </View>
            </View>
            <EmptyBlock text={athleteRecap?.reason || 'Meet recap is not available yet.'} />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stack}>
        <View style={styles.recapHeroCard}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="sparkles-outline" size={22} color={SLColors.review} />
            <ThemedText variant="h3" style={styles.cardTitle}>Meet Recap</ThemedText>
          </View>
          {athleteRecap.headline ? <Text style={styles.recapHeadline}>{athleteRecap.headline}</Text> : null}

          {resultSummary ? (
            <View style={styles.recapMetricGrid}>
              <View style={styles.recapMetricTile}>
                <Text style={styles.recapMetricLabel}>Total</Text>
                <Text style={styles.recapMetricValue}>{formatMeetWeight(resultSummary.total_kg, displayUnit)}</Text>
              </View>
              <View style={styles.recapMetricTile}>
                <Text style={styles.recapMetricLabel}>Attempts</Text>
                <Text style={styles.recapMetricValue}>{resultSummary.attempts_made}/{resultSummary.attempts_taken}</Text>
              </View>
              <View style={styles.recapMetricTile}>
                <Text style={styles.recapMetricLabel}>DOTS</Text>
                <Text style={styles.recapMetricValue}>{resultSummary.dots_score != null ? resultSummary.dots_score.toFixed(2) : '—'}</Text>
              </View>
              <View style={styles.recapMetricTile}>
                <Text style={styles.recapMetricLabel}>GL</Text>
                <Text style={styles.recapMetricValue}>{resultSummary.gl_points != null ? resultSummary.gl_points.toFixed(2) : '—'}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {athleteRecap.story_paragraphs?.length ? (
          <View style={styles.recapStoryCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="journal-outline" size={20} color={SLColors.review} />
                <ThemedText variant="h3" style={styles.cardTitle}>
                  Meet Story
                </ThemedText>
              </View>
            </View>

            <View style={styles.recapStoryStack}>
              {athleteRecap.story_paragraphs.map((paragraph, index) => (
                <Text
                  key={`story-${index}`}
                  style={styles.recapStoryParagraph}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {athleteRecap.lift_summaries?.length ? (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="barbell-outline" size={20} color={SLColors.accentViolet} />
                <ThemedText variant="h3" style={styles.cardTitle}>Best Lifts</ThemedText>
              </View>
            </View>
            <View style={styles.recapLiftStack}>
              {athleteRecap.lift_summaries.map((lift) => (
                <View key={String(lift.lift)} style={styles.recapLiftRow}>
                  <View>
                    <Text style={styles.recapLiftLabel}>{lift.label}</Text>
                    <Text style={styles.recapLiftSubText}>{lift.made}/{lift.total_attempts} made</Text>
                  </View>
                  <Text style={styles.recapLiftValue}>{formatMeetWeight(lift.best_kg, displayUnit)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.recapNextStepsCard}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="chatbubbles-outline" size={20} color={SLColors.success} />
            <ThemedText variant="h3" style={styles.cardTitle}>Next Steps</ThemedText>
          </View>
          <Text style={styles.recapNextStepsText}>{athleteRecap.next_steps || 'Your coach is reviewing the full meet recap. Align with them for next steps in your training.'}</Text>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (hasMeetPlan && meet?.status === 'active') return renderMeetActive();
    if (hasMeetPlan) return renderMeetPacket();
    if (activeTab === 'overview') return renderOverview();
    if (activeTab === 'attempts') return renderAttempts();
    if (activeTab === 'warmups') return renderWarmups();
    if (activeTab === 'notes') return renderNotes();
    if (activeTab === 'summary') return renderSummary();
    return renderOverview();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.screenCentered}>
          <ActivityIndicator size="small" color={SLColors.accentViolet} />
          <ThemedText variant="bodyMuted" style={styles.loadingText}>Loading meet plan…</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ThemedView style={styles.screenCentered}>
          <ThemedText variant="error" style={styles.errorText}>{error}</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <ThemedView style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={SLColors.textMuted} />}
        >
          {!hasMeetPlan ? (
            <View style={styles.emptyCardLarge}>
              <SLTrophy size={32} tier="bronze" muted />
              <Text style={styles.emptyTitle}>No meet plan yet</Text>
              <Text style={styles.emptyBody}>When your coach creates a meet plan, it will show here.</Text>
            </View>
          ) : (
            <>
              {renderContent()}
            </>
          )}
        </ScrollView>
        {attemptDraft ? (
          <Modal transparent animationType="fade" visible={!!attemptDraft} onRequestClose={() => setAttemptDraft(null)}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
              style={styles.modalKeyboardWrap}
            >
              <View style={styles.modalBackdrop}>
                <Pressable style={styles.modalBackdropPressable} onPress={() => setAttemptDraft(null)} />
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.attemptModalCard}>
                <View style={styles.attemptModalHeader}>
                  <View>
                    <Text style={styles.attemptModalEyebrow}>{resultLabel(attemptDraft.result)}</Text>
                    <Text style={styles.attemptModalTitle}>
                      Log {liftLabels[(attemptDraft.attempt.lift as LiftKey) || activeLift] || liftLabels[activeLift]} {attemptLabel(attemptDraft.attempt.attempt_number)}
                    </Text>
                  </View>
                  <Pressable onPress={() => setAttemptDraft(null)} style={styles.modalCloseButton}>
                    <Ionicons name="close" size={18} color={SLColors.text} />
                  </Pressable>
                </View>

                <View style={styles.attemptModalStrategy}>
                  <Text style={styles.attemptModalStrategyLabel}>Plan</Text>
                  <Text style={styles.attemptModalStrategyText}>{attemptPlanLabel(attemptDraft.attempt, displayUnit)}</Text>
                  {attemptStrategyNote(attemptDraft.attempt) ? (
                    <Text style={styles.attemptModalStrategyNote}>{attemptStrategyNote(attemptDraft.attempt)}</Text>
                  ) : null}
                </View>

                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalLabel}>Result</Text>
                  <View style={styles.resultChoiceRow}>
                    {([
                      { value: 'good', label: 'Good Lift', style: styles.resultChoiceGood, activeStyle: styles.resultChoiceGoodActive, textStyle: styles.resultChoiceGoodText },
                      { value: 'miss', label: 'No Lift', style: styles.resultChoiceMiss, activeStyle: styles.resultChoiceMissActive, textStyle: styles.resultChoiceMissText },
                      { value: 'skipped', label: 'Skipped', style: styles.resultChoiceSkipped, activeStyle: styles.resultChoiceSkippedActive, textStyle: styles.resultChoiceSkippedText },
                    ] as const).map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          setAttemptDraft((prev) =>
                            prev ? { ...prev, result: option.value, missReason: option.value === 'miss' ? prev.missReason : '' } : prev
                          )
                        }
                        style={[
                          styles.resultChoice,
                          option.style,
                          attemptDraft.result === option.value ? option.activeStyle : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.resultChoiceText,
                            option.textStyle,
                            attemptDraft.result === option.value ? styles.resultChoiceTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalLabel}>Actual weight</Text>
                  <HorizontalWheelSelector
                    options={meetWeightOptionsForAttempt(attemptDraft.attempt, displayUnit)}
                    value={attemptDraft.actualWeightKg || meetWeightOptionsForAttempt(attemptDraft.attempt, displayUnit)[0]}
                    onChange={(value) => setAttemptDraft((prev) => prev ? { ...prev, actualWeightKg: value } : prev)}
                  />
                  <Text style={styles.modalWeightHint}>{displayUnit} · official meet increments</Text>
                </View>

                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalLabel}>RPE</Text>
                  <View style={styles.rpeChoiceRow}>
                    {(['7', '7.5', '8', '8.5', '9', '9.5', '10'] as const).map((rpe) => (
                      <Pressable
                        key={rpe}
                        onPress={() => setAttemptDraft((prev) => prev ? { ...prev, rpe: prev.rpe === rpe ? '' : rpe } : prev)}
                        style={[styles.rpeChoice, attemptDraft.rpe === rpe ? styles.rpeChoiceActive : null]}
                      >
                        <Text style={[styles.rpeChoiceText, attemptDraft.rpe === rpe ? styles.rpeChoiceTextActive : null]}>{rpe}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {attemptDraft.result === 'miss' ? (
                  <View style={styles.modalFieldGroup}>
                    <Text style={styles.modalLabel}>Why did it miss?</Text>
                    <View style={styles.optionWrap}>
                      {(['technical', 'strength', 'command', 'depth', 'grip', 'other'] as const).map((reason) => (
                    <Pressable
                          key={reason}
                          onPress={() => setAttemptDraft((prev) => prev ? { ...prev, missReason: reason } : prev)}
                          style={[styles.reasonPill, attemptDraft.missReason === reason ? styles.reasonPillActive : null]}
                    >
                          <Text style={[styles.reasonPillText, attemptDraft.missReason === reason ? styles.reasonPillTextActive : null]}>
                            {reason.charAt(0).toUpperCase() + reason.slice(1)}
                          </Text>
                    </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalLabel}>Notes</Text>
                  <TextInput
                    value={attemptDraft.notes}
                    onChangeText={(value) => setAttemptDraft((prev) => prev ? { ...prev, notes: value } : prev)}
                    placeholder="Optional note for coach"
                    placeholderTextColor={SLColors.textSubtle}
                    style={[styles.modalInput, styles.modalTextArea]}
                    multiline
                  />
                </View>

                <View style={styles.modalActionsRow}>
                  <Pressable onPress={() => setAttemptDraft(null)} style={styles.modalCancelButton}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={savingAttemptId === attemptDraft.attempt.id || !attemptDraft.result}
                    onPress={submitAttemptResult}
                    style={[
                      styles.modalSaveButton,
                      attemptDraft.result === 'miss' ? styles.modalSaveButtonMiss : attemptDraft.result === 'skipped' ? styles.modalSaveButtonNeutral : styles.modalSaveButtonGood,
                      (savingAttemptId === attemptDraft.attempt.id || !attemptDraft.result) ? styles.disabledButton : null,
                    ]}
                  >
                    <Text style={styles.modalSaveText}>Save Result</Text>
                  </Pressable>
                </View>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        ) : null}
      </ThemedView>
    </SafeAreaView>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function HorizontalWheelSelector({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const selectedIndex = Math.max(0, options.indexOf(value));

  useEffect(() => {
    const target = selectedIndex * HORIZONTAL_WHEEL_ITEM_WIDTH;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: target, animated: true });
    });
  }, [selectedIndex]);

  return (
    <View style={styles.horizontalWheelFrame}>
      <View pointerEvents="none" style={styles.horizontalWheelCenterBand} />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={HORIZONTAL_WHEEL_ITEM_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={styles.horizontalWheelContent}
        onMomentumScrollEnd={(event) => {
          const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.x / HORIZONTAL_WHEEL_ITEM_WIDTH)));
          onChange(options[index]);
        }}
        onScrollEndDrag={(event) => {
          const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.x / HORIZONTAL_WHEEL_ITEM_WIDTH)));
          onChange(options[index]);
        }}
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable key={option} onPress={() => onChange(option)} style={styles.horizontalWheelItem}>
              <Text style={[styles.horizontalWheelText, selected && styles.horizontalWheelTextActive]}>{option}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function VerticalWheelSelector({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const selectedIndex = Math.max(0, options.indexOf(value));

  useEffect(() => {
    const target = selectedIndex * VERTICAL_WHEEL_ROW_HEIGHT;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: target, animated: true });
    });
  }, [selectedIndex]);

  return (
    <View style={styles.platformWheelColumn}>
      <Text style={styles.platformWheelLabel}>{label}</Text>
      <View style={styles.platformWheelFrame}>
        <View pointerEvents="none" style={styles.platformWheelCenterBand} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={VERTICAL_WHEEL_ROW_HEIGHT}
          decelerationRate="fast"
          nestedScrollEnabled
          contentContainerStyle={styles.platformWheelContent}
          onMomentumScrollEnd={(event) => {
            const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / VERTICAL_WHEEL_ROW_HEIGHT)));
            onChange(options[index]);
          }}
          onScrollEndDrag={(event) => {
            const index = Math.max(0, Math.min(options.length - 1, Math.round(event.nativeEvent.contentOffset.y / VERTICAL_WHEEL_ROW_HEIGHT)));
            onChange(options[index]);
          }}
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <Pressable key={option} onPress={() => onChange(option)} style={styles.platformWheelOption}>
                <Text style={[styles.platformWheelText, selected && styles.platformWheelTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

function MeetAttemptLogRow({
  attempt,
  displayUnit,
  disabled,
  lockedReason,
  onClear,
  onOpenLog,
}: {
  attempt: MeetAttempt;
  displayUnit: DisplayWeightUnit;
  disabled: boolean;
  lockedReason?: string | null;
  onClear: () => void;
  onOpenLog: () => void;
}) {
  const result = attempt.result;
  const status = result?.result || 'pending';
  const planned = attemptDisplayWeight(attempt, displayUnit);
  const actual = result?.actual_weight_kg != null ? formatMeetWeight(result.actual_weight_kg, displayUnit) : planned;
  const statusLabel = status === 'good' ? 'Good Lift' : status === 'miss' ? 'No Lift' : status === 'skipped' ? 'Skipped' : 'Pending';
  const tag = prettyTag(attempt.strategy_tag);
  const strategyNote = attemptStrategyNote(attempt);

  return (
    <View style={styles.meetLogRow}>
      <View style={styles.meetLogTopRow}>
        <View style={styles.meetLogAttemptBadge}>
          <Text style={styles.meetLogAttemptBadgeText}>{attempt.attempt_number}</Text>
        </View>
        <View style={styles.meetLogCopy}>
          <Text style={styles.meetLogTitle}>{attemptLabel(attempt.attempt_number)}</Text>
          <Text style={styles.meetLogMeta}>{tag ? `${tag} · ` : ''}Plan {planned} / Actual {actual}</Text>
        </View>
        <Text
          style={[
            styles.meetLogStatus,
            status === 'good' ? styles.meetLogStatusGood : null,
            status === 'miss' ? styles.meetLogStatusMiss : null,
            status === 'skipped' ? styles.meetLogStatusSkipped : null,
          ]}
        >
          {statusLabel}
        </Text>
      </View>

      {strategyNote ? (
        <View style={styles.meetLogStrategyBlock}>
          <Text style={styles.meetLogStrategyLabel}>Strategy</Text>
          <Text style={styles.meetLogStrategyText}>{strategyNote}</Text>
        </View>
      ) : null}

      <View style={styles.meetLogResultActions}>
        {result ? (
          <>
            <Pressable disabled={disabled} onPress={onOpenLog} style={({ pressed }) => [styles.meetLogPrimaryButton, pressed && styles.pressed, disabled && styles.disabledButton]}>
              <Text style={styles.meetLogPrimaryText}>Edit Result</Text>
            </Pressable>
            <Pressable disabled={disabled} onPress={onClear} style={({ pressed }) => [styles.meetLogUtilityButton, pressed && styles.pressed, disabled && styles.disabledButton]}>
              <Ionicons name="refresh-outline" size={15} color={SLColors.textMuted} />
              <Text style={styles.meetLogUtilityText}>Clear</Text>
            </Pressable>
          </>
        ) : lockedReason ? (
          <View style={styles.meetLogLocked}>
            <Ionicons name="lock-closed-outline" size={14} color={SLColors.textMuted} />
            <Text style={styles.meetLogLockedText}>{lockedReason}</Text>
          </View>
        ) : (
          <Pressable disabled={disabled} onPress={onOpenLog} style={({ pressed }) => [styles.meetLogPrimaryButton, pressed && styles.pressed, disabled && styles.disabledButton]}>
            <Text style={styles.meetLogPrimaryText}>Log Result</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <View style={styles.emptyBlock}>
      <Text style={styles.emptyBody}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screenCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    gap: 10,
  },
  scroll: {
    paddingTop: 10,
    paddingBottom: 104,
  },
  loadingText: {
    color: SLColors.textMuted,
  },
  header: {
    width: '100%',
    marginBottom: 12,
    paddingVertical: 8,
  },
  headerEyebrow: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  title: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    color: SLColors.textStrong,
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 5,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    color: SLColors.textMuted,
    fontWeight: '700',
  },
  stack: {
    gap: 10,
  },
  packetStack: {
    gap: 10,
  },
  packetHero: {
    minHeight: 220,
    flexDirection: 'row',
    backgroundColor: 'rgba(28,18,20,0.30)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(214,167,94,0.11)',
  },
  packetHeroRail: {
    width: 4,
    backgroundColor: 'rgba(214,167,94,0.54)',
  },
  packetHeroBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  packetHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  packetKicker: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  packetStatusText: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  packetUtilityButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: SLRadius.xs,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.16)',
  },
  packetUtilityText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  packetMeetName: {
    color: SLColors.textStrong,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: 0,
  },
  packetMeetMeta: {
    marginTop: 10,
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontWeight: '800',
  },
  packetMeetSub: {
    marginTop: 5,
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontWeight: '700',
  },
  packetPrimaryButton: {
    minHeight: 44,
    marginTop: 18,
    borderRadius: SLRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(45,64,49,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(167,203,181,0.20)',
  },
  packetPrimaryText: {
    color: SLColors.success,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  activeHero: {
    backgroundColor: 'rgba(21,22,18,0.32)',
    borderColor: 'rgba(167,203,181,0.12)',
  },
  activeHeroRail: {
    width: 4,
    backgroundColor: 'rgba(167,203,181,0.56)',
  },
  activeStatusPill: {
    minHeight: 34,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.sm,
    backgroundColor: 'rgba(45,64,49,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(167,203,181,0.20)',
  },
  activeStatusText: {
    color: SLColors.success,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  activeProgressTrack: {
    height: 6,
    marginTop: 18,
    overflow: 'hidden',
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.surfaceInset,
  },
  activeProgressFill: {
    height: '100%',
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(167,203,181,0.70)',
  },
  activeProgressText: {
    marginTop: 8,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  activeNextText: {
    marginTop: 8,
    color: SLColors.warning,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '800',
  },
  activeFocusSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: SLColors.surfaceEmbedded,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  activeInstructionList: {
    gap: 10,
  },
  activeInstructionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 3,
  },
  activeInstructionRail: {
    width: 3,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(214,167,94,0.62)',
  },
  activeInstructionCopy: {
    flex: 1,
    minWidth: 0,
  },
  activeInstructionLabel: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  activeInstructionBody: {
    marginTop: 5,
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontWeight: '700',
  },
  activeEventTabs: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  activeEventSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: SLColors.surfaceEmbedded,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  activeEventStatus: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  activeWarmupList: {
    gap: 0,
  },
  activeWarmupRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  activeWarmupRowChecked: {
    backgroundColor: 'rgba(45,64,49,0.18)',
  },
  activeWarmupCheck: {
    width: 28,
    height: 28,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  activeWarmupCheckDone: {
    backgroundColor: 'rgba(45,64,49,0.44)',
    borderColor: 'rgba(167,203,181,0.30)',
  },
  activeWarmupIndex: {
    color: SLColors.warning,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textAlign: 'center',
  },
  activeWarmupCopy: {
    flex: 1,
    minWidth: 0,
  },
  activeWarmupValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
  },
  activeWarmupValueDone: {
    color: SLColors.success,
  },
  activeWarmupMeta: {
    marginTop: 2,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  warmupCollapseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meetLogRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  meetLogTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  meetLogAttemptBadge: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceInset,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  meetLogAttemptBadgeText: {
    color: SLColors.warning,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  meetLogCopy: {
    flex: 1,
    minWidth: 0,
  },
  meetLogTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
  },
  meetLogMeta: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  meetLogStatus: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  meetLogStatusGood: {
    color: SLColors.success,
  },
  meetLogStatusMiss: {
    color: SLColors.danger,
  },
  meetLogStatusSkipped: {
    color: SLColors.warning,
  },
  meetLogStrategyBlock: {
    marginTop: 12,
    marginLeft: 44,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(214,167,94,0.10)',
    borderRadius: SLRadius.xs,
  },
  meetLogStrategyLabel: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  meetLogStrategyText: {
    marginTop: 6,
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    fontWeight: '800',
  },
  meetLogActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  meetLogActionGood: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.sm,
    backgroundColor: 'rgba(45,64,49,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(167,203,181,0.20)',
  },
  meetLogActionGoodText: {
    color: SLColors.success,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  meetLogActionMiss: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.sm,
    backgroundColor: 'rgba(91,35,35,0.30)',
    borderWidth: 1,
    borderColor: SLColors.danger,
  },
  meetLogActionMissText: {
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  meetLogActionSkip: {
    minWidth: 64,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.sm,
    backgroundColor: SLColors.surfaceEmbedded,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  meetLogActionSkipText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  meetLogChangeWeight: {
    minHeight: 32,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetLogChangeWeightText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  meetLogResultActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  meetLogPrimaryButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: SLRadius.xs,
    backgroundColor: 'rgba(214,167,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(214,167,94,0.24)',
  },
  meetLogPrimaryText: {
    color: SLColors.warning,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  meetLogLocked: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: SLRadius.xs,
    backgroundColor: SLColors.surfaceEmbedded,
  },
  meetLogLockedText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  meetLogUtilityButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: SLRadius.sm,
    backgroundColor: SLColors.surfaceEmbedded,
  },
  meetLogUtilityText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  packetSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: SLColors.surfaceEmbedded,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  packetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  packetSectionLabel: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
  },
  packetSectionMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  readinessList: {
    gap: 0,
  },
  readinessPacketRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  readinessMark: {
    width: 24,
    height: 24,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  readinessMarkReady: {
    backgroundColor: 'rgba(45,64,49,0.30)',
    borderColor: 'rgba(167,203,181,0.18)',
  },
  readinessPacketCopy: {
    flex: 1,
    minWidth: 0,
  },
  readinessPacketLabel: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
  },
  readinessPacketDetail: {
    marginTop: 2,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  attemptPreviewLift: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  attemptPreviewLiftLabel: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  attemptPreviewGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  attemptPreviewCell: {
    flex: 1,
    minHeight: 68,
    paddingHorizontal: 9,
    paddingVertical: 10,
    backgroundColor: SLColors.surfaceEmbedded,
    borderRadius: SLRadius.xs,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  attemptPreviewLabel: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  attemptPreviewValue: {
    marginTop: 7,
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 20,
    fontWeight: '900',
  },
  warmupPacketList: {
    marginTop: 10,
  },
  warmupPacketRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  warmupPacketRowChecked: {
    backgroundColor: 'rgba(45,64,49,0.16)',
  },
  warmupPacketIndex: {
    width: 24,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textAlign: 'center',
  },
  warmupPacketCopy: {
    flex: 1,
    minWidth: 0,
  },
  warmupPacketValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
  },
  warmupPacketMeta: {
    marginTop: 2,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  gearPacketRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  packetFocusText: {
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 21,
    fontWeight: '700',
  },
  focusNoteRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  mainTabs: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surfaceEmbedded,
    marginBottom: 10,
  },
  mainTab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.xs,
    gap: 3,
  },
  mainTabActive: {
    backgroundColor: SLColors.accentVioletSoft,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
  },
  mainTabText: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  mainTabTextActive: {
    color: SLColors.textStrong,
  },
  liftTabs: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: SLColors.surfaceEmbedded,
  },
  liftTab: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  liftTabActive: {
    backgroundColor: 'rgba(214,167,94,0.06)',
  },
  liftTabText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  liftTabTextActive: {
    color: SLColors.textStrong,
  },
  liftTabMetaRow: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  liftTabMeta: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  liftTabMetaActive: {
    color: SLColors.warning,
  },
  liftTabRail: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    height: 2,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.borderHairline,
  },
  liftTabRailActive: {
    height: 3,
    backgroundColor: 'rgba(214,167,94,0.86)',
  },
  liftTabRailComplete: {
    backgroundColor: 'rgba(167,203,181,0.55)',
  },
  // --- Inserted status strip styles ---
  statusStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPillPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: SLRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(109,91,208,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(199,190,232,0.30)',
  },
  statusPillPrimaryText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  statusPillSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: SLRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  statusPillSecondaryText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  meetSummaryCard: {
    gap: 12,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: 'rgba(28,18,20,0.34)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(214,167,94,0.12)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
meetSummaryTopRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
},

meetSummaryTopLeft: {
  flex: 1,
  minWidth: 0,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
  meetDetailRows: {
    gap: 8,
    marginTop: 2,
  },
  meetDetailRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  meetDetailIconWrap: {
    width: 26,
    height: 26,
    borderRadius: SLRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.accentVioletSoft,
  },
  meetDetailLabel: {
    flex: 1,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meetDetailValue: {
    maxWidth: '46%',
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
    textAlign: 'right',
  },
  checkInCard: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderRadius: 0,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  checkInGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  checkInTile: {
    flex: 1,
    borderRadius: SLRadius.xs,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: SLColors.surfaceEmbedded,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  checkInTileAccent: {
    flex: 1,
    borderRadius: SLRadius.xs,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(32,40,31,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(167,203,181,0.12)',
  },
  checkInLabel: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  checkInValue: {
    marginTop: 7,
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
  },
  checkInSubValue: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
  },
  heroLocationBadge: {
    maxWidth: 118,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: SLRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(199,190,232,0.18)',
  },
  heroLocationText: {
    flexShrink: 1,
    color: SLColors.accentViolet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.24)',
  },
  heroTextCol: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    fontSize: SLTypography.title.fontSize,
    fontWeight: '800',
    color: SLColors.textStrong,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: SLTypography.label.fontSize,
    color: SLColors.textMuted,
  },
  heroMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  heroMetaText: {
    flex: 1,
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
  },
  heroQuickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroQuickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroQuickPill: {
    flex: 1,
    borderRadius: SLRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(199,190,232,0.14)',
  },
  heroQuickPillLarge: {
    width: '48.5%',
    minHeight: 58,
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(199,190,232,0.16)',
  },
  heroQuickPillWide: {
    flex: 1.55,
  },
  heroQuickLabel: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroQuickValue: {
    marginTop: 3,
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoTile: {
    width: '48%',
    minHeight: 74,
    borderRadius: SLRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(8,16,38,0.92)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  infoLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: {
    marginTop: 7,
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '800',
  },
  card: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderRadius: 0,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '700',
    color: SLColors.textStrong,
    letterSpacing: -0.2,
  },
  bodyText: {
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: SLColors.borderHairline,
  },
  detailLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
  },
  detailValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    textAlign: 'right',
  },
  metaText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  // --- Inserted attempt sublabel style ---
  attemptSubLabel: {
    marginTop: 4,
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  plannedWeightText: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  attemptCard: {
    borderRadius: SLRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(30,41,59,0.72)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    marginTop: 10,
    gap: 10,
  },
  attemptCardGood: {
    borderColor: SLColors.success,
    backgroundColor: SLColors.successSoft,
  },
  attemptCardMiss: {
    borderColor: SLColors.danger,
    backgroundColor: SLColors.dangerSoft,
  },
  attemptTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  attemptLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  attemptWeight: {
    marginTop: 4,
    color: SLColors.textStrong,
    fontSize: SLTypography.hero.fontSize,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  attemptWeightRange: {
    fontSize: SLTypography.screenTitle.fontSize,
  },
  tagPill: {
    overflow: 'hidden',
    borderRadius: SLRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: SLColors.accentViolet,
    backgroundColor: 'rgba(109,91,208,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(199,190,232,0.24)',
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  resultPillGood: {
    overflow: 'hidden',
    borderRadius: SLRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: SLColors.success,
    backgroundColor: SLColors.successSoft,
    borderWidth: 1,
    borderColor: SLColors.success,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  resultPillMiss: {
    overflow: 'hidden',
    borderRadius: SLRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: SLColors.danger,
    backgroundColor: SLColors.dangerSoft,
    borderWidth: 1,
    borderColor: SLColors.danger,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  resultActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  resultButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: SLRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
  resultButtonGood: {
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
  },
  resultButtonMiss: {
    backgroundColor: SLColors.dangerSoft,
    borderColor: SLColors.danger,
  },
  resultButtonGoodText: {
    color: SLColors.success,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  resultButtonMissText: {
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  resultContextBox: {
    gap: 7,
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.58)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  resultContextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  resultContextLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultContextValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    textAlign: 'right',
  },
  resultContextNotes: {
    gap: 4,
    paddingTop: 2,
  },
  resultContextNoteText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontWeight: '600',
  },
  clearResultButton: {
    minHeight: 34,
    borderRadius: SLRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.62)',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  clearResultText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.55,
  },
  noteBody: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
  },
  // --- Inserted warmup hero styles ---
  warmupHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: SLRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: SLColors.warningSoft,
    borderWidth: 1,
    borderColor: SLColors.warning,
  },
  warmupHeroText: {
    flex: 1,
    color: SLColors.warning,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
    lineHeight: 18,
  },
  warmupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: SLRadius.lg,
    backgroundColor: 'rgba(17,24,39,0.84)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 9,
  },
  warmupRowChecked: {
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
  },
  warmupIndexBadge: {
    width: 30,
    height: 30,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109,91,208,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(199,190,232,0.20)',
  },
  warmupIndexBadgeChecked: {
    backgroundColor: 'rgba(34,197,94,0.22)',
    borderColor: SLColors.success,
  },
  warmupIndexText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  warmupTextCol: {
    flex: 1,
    minWidth: 0,
  },
  warmupPrescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  warmupMetaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  warmupTimingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: SLRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(109,91,208,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(199,190,232,0.22)',
  },
  warmupTimingText: {
    color: SLColors.review,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  warmupWeight: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '800',
  },
  warmupWeightChecked: {
    color: SLColors.success,
  },
  warmupCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  warmupCheckCircleChecked: {
    borderColor: 'rgba(74,222,128,0.50)',
    backgroundColor: 'rgba(34,197,94,0.22)',
  },
  noteCardFeatured: {
    borderRadius: SLRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(109,91,208,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(199,190,232,0.20)',
    marginTop: 4,
    gap: 8,
  },
  noteFeaturedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteFeaturedTitle: {
    color: SLColors.review,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  noteCard: {
    borderRadius: SLRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(15,23,42,0.60)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    marginTop: 10,
    gap: 6,
  },
  noteCategory: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emptyBlock: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyCardLarge: {
    borderRadius: SLRadius.xl,
    paddingHorizontal: 22,
    paddingVertical: 26,
    backgroundColor: 'rgba(8,16,38,0.92)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '800',
  },
  emptyBody: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  modalKeyboardWrap: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,6,23,0.76)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  attemptModalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 42,
    backgroundColor: 'rgba(18,13,12,0.96)',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    gap: 14,
  },
  attemptModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  attemptModalEyebrow: {
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  attemptModalTitle: {
    marginTop: 3,
    color: SLColors.textStrong,
    fontSize: SLTypography.title.fontSize,
    fontWeight: '900',
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceInset,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  attemptModalStrategy: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: SLRadius.xs,
    backgroundColor: 'rgba(214,167,94,0.08)',
  },
  attemptModalStrategyLabel: {
    color: SLColors.warning,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  attemptModalStrategyText: {
    marginTop: 5,
    color: SLColors.white,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '900',
  },
  attemptModalStrategyNote: {
    marginTop: 7,
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    fontWeight: '700',
  },
  modalFieldGroup: {
    gap: 8,
  },
  modalLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalInput: {
    minHeight: 44,
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: SLColors.textStrong,
    backgroundColor: SLColors.surfaceInset,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '800',
  },
  modalTextArea: {
    minHeight: 86,
    textAlignVertical: 'top',
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resultChoiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resultChoice: {
    flex: 1,
    minHeight: 50,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  resultChoiceGood: {
    backgroundColor: 'rgba(45,64,49,0.18)',
    borderColor: 'rgba(167,203,181,0.15)',
  },
  resultChoiceGoodActive: {
    backgroundColor: 'rgba(34,197,94,0.24)',
    borderColor: 'rgba(134,239,172,0.52)',
  },
  resultChoiceMiss: {
    backgroundColor: 'rgba(91,35,35,0.18)',
    borderColor: SLColors.danger,
  },
  resultChoiceMissActive: {
    backgroundColor: 'rgba(185,28,28,0.30)',
    borderColor: 'rgba(252,165,165,0.56)',
  },
  resultChoiceSkipped: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderColor: SLColors.borderSubtle,
  },
  resultChoiceSkippedActive: {
    backgroundColor: 'rgba(120,113,108,0.24)',
    borderColor: 'rgba(214,211,209,0.28)',
  },
  resultChoiceText: {
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  resultChoiceTextActive: {
    color: SLColors.white,
  },
  resultChoiceGoodText: {
    color: SLColors.success,
  },
  resultChoiceMissText: {
    color: SLColors.danger,
  },
  resultChoiceSkippedText: {
    color: SLColors.text,
  },
  modalWeightHint: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    textAlign: 'center',
  },
  rpeChoiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  rpeChoice: {
    minWidth: 45,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.xs,
    backgroundColor: SLColors.surfaceEmbedded,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  rpeChoiceActive: {
    backgroundColor: 'rgba(124,58,237,0.24)',
    borderColor: 'rgba(196,181,253,0.38)',
  },
  rpeChoiceText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  rpeChoiceTextActive: {
    color: SLColors.review,
  },
  optionPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  optionPillActive: {
    backgroundColor: 'rgba(109,91,208,0.24)',
    borderColor: 'rgba(199,190,232,0.34)',
  },
  optionPillText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  optionPillTextActive: {
    color: SLColors.textStrong,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonPill: {
    borderRadius: SLRadius.xs,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: SLColors.surfaceEmbedded,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  reasonPillActive: {
    backgroundColor: SLColors.dangerSoft,
    borderColor: 'rgba(248,113,113,0.44)',
  },
  reasonPillText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  reasonPillTextActive: {
    color: SLColors.danger,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  modalCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceInset,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  modalCancelText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  modalSaveButton: {
    flex: 1.35,
    minHeight: 44,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalSaveButtonGood: {
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
  },
  modalSaveButtonMiss: {
    backgroundColor: SLColors.dangerSoft,
    borderColor: 'rgba(248,113,113,0.34)',
  },
  modalSaveButtonNeutral: {
    backgroundColor: 'rgba(87,83,78,0.34)',
    borderColor: 'rgba(214,211,209,0.22)',
  },
  modalSaveText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  errorText: {
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    textAlign: 'center',
  },
    rackCard: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderRadius: 0,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  rackGrid: {
    gap: 10,
  },
  rackTile: {
    width: '100%',
    borderRadius: SLRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  rackTileFull: {
    width: '100%',
    borderRadius: SLRadius.lg,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(24,38,28,0.62)',
    borderWidth: 1,
    borderColor: SLColors.success,
  },
  rackTileLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rackTileValue: {
    marginTop: 7,
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  rackLineCard: {
    width: '100%',
    borderRadius: SLRadius.xs,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: SLColors.surfaceEmbedded,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  rackLineText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
    lineHeight: 22,
  },
  rackLineLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rackSplitRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  rackSplitItem: {
    flex: 1,
    minWidth: 0,
  },
  rackSplitDivider: {
    width: 1,
    backgroundColor: SLColors.borderSubtle,
  },
  rackSplitLabel: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  meetEditButton: {
    marginTop: 12,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: 'rgba(91,33,182,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  meetEditButtonText: {
    color: SLColors.review,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  detailsModalKeyboardWrap: {
    flex: 1,
  },
  detailsModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(3,3,4,0.68)',
  },
  meetDetailsModalCard: {
    maxHeight: '90%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: 'rgba(13,10,10,0.96)',
  },
  meetDetailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.borderHairline,
  },
  meetDetailsModalTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '900',
  },
  meetDetailsModalSubtitle: {
    marginTop: 4,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    lineHeight: 18,
  },
  meetDetailsModalContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 0,
    paddingBottom: 110,
  },
  meetDetailsSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.borderHairline,
  },
  meetDetailsSectionTitle: {
    marginBottom: 12,
    color: SLColors.warning,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meetFieldStack: {
    gap: 13,
  },
  meetControlStack: {
    gap: 14,
  },
  meetFieldLabel: {
    marginBottom: 5,
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectorLabelRow: {
    marginBottom: 5,
  },
  selectorContextText: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    lineHeight: 15,
  },
  meetFieldHint: {
    marginTop: -4,
    marginBottom: 10,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '600',
    lineHeight: 17,
  },
  meetFieldInput: {
    minHeight: 44,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceInset,
    color: SLColors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
  },
  meetFieldTextArea: {
    minHeight: 126,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  horizontalWheelFrame: {
    height: 56,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceEmbedded,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  horizontalWheelCenterBand: {
    position: 'absolute',
    left: '50%',
    width: HORIZONTAL_WHEEL_ITEM_WIDTH,
    marginLeft: -HORIZONTAL_WHEEL_ITEM_WIDTH / 2,
    top: 6,
    bottom: 6,
    borderRadius: SLRadius.sm,
    backgroundColor: SLColors.accentVioletSoft,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.22)',
  },
  horizontalWheelContent: {
    paddingHorizontal: HORIZONTAL_WHEEL_ITEM_WIDTH * 2,
  },
  horizontalWheelItem: {
    width: HORIZONTAL_WHEEL_ITEM_WIDTH,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalWheelText: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
  },
  horizontalWheelTextActive: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '900',
  },
  compactInputRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  compactInputLabel: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
  },
  compactNumberInput: {
    width: 92,
    minHeight: 40,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceInset,
    color: SLColors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
  },
  compactInputUnit: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  platformWheelGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  platformWheelColumn: {
    flex: 1,
    minWidth: 0,
  },
  platformWheelLabel: {
    minHeight: 30,
    color: SLColors.textMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  platformWheelFrame: {
    height: VERTICAL_WHEEL_ROW_HEIGHT * VERTICAL_WHEEL_VISIBLE_ROWS,
    overflow: 'hidden',
    backgroundColor: SLColors.surfaceEmbedded,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  platformWheelCenterBand: {
    position: 'absolute',
    left: 3,
    right: 3,
    top: VERTICAL_WHEEL_ROW_HEIGHT * 2,
    height: VERTICAL_WHEEL_ROW_HEIGHT,
    borderRadius: SLRadius.xs,
    backgroundColor: SLColors.accentVioletSoft,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.20)',
  },
  platformWheelContent: {
    paddingVertical: VERTICAL_WHEEL_ROW_HEIGHT * 2,
  },
  platformWheelOption: {
    height: VERTICAL_WHEEL_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformWheelText: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  platformWheelTextActive: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
  },
  squatRackInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  squatRackHeightInput: {
    flex: 1,
  },
  squatRackOrientationGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  squatRackOrientationButton: {
    minHeight: 44,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceInset,
  },
  squatRackOrientationButtonActive: {
    borderColor: 'rgba(196,181,253,0.28)',
    backgroundColor: SLColors.accentVioletSoft,
  },
  squatRackOrientationText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  squatRackOrientationTextActive: {
    color: SLColors.textStrong,
  },
  meetDetailsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: SLColors.borderHairline,
    backgroundColor: 'rgba(13,10,10,0.98)',
  },
  meetDetailsSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceInset,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
  },
  meetDetailsSecondaryText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  meetDetailsPrimaryButton: {
    flex: 1.25,
    minHeight: 44,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.28)',
  },
  meetDetailsPrimaryText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  meetBagEditorList: {
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  meetBagEditorRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.borderHairline,
  },
  meetBagEditorText: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
  },
  meetBagDeleteButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetBagAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  meetBagAddInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    borderColor: SLColors.borderSubtle,
    backgroundColor: SLColors.surfaceInset,
    color: SLColors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
  },
  meetBagAddButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: SLRadius.sm,
    paddingHorizontal: 12,
    backgroundColor: SLColors.accentVioletSoft,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
  },
  meetBagAddText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  gearCard: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderRadius: 0,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  gearList: {
    gap: 8,
  },
  gearRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderColor: SLColors.borderHairline,
  },
  gearRowChecked: {
    backgroundColor: SLColors.successSoft,
    borderColor: SLColors.success,
  },
  gearCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  gearCheckCircleChecked: {
    borderColor: 'rgba(74,222,128,0.50)',
    backgroundColor: 'rgba(34,197,94,0.22)',
  },
  gearText: {
    flex: 1,
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  gearTextChecked: {
    color: SLColors.success,
  },
  focusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: SLRadius.xl,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: SLColors.warningSoft,
    borderWidth: 1,
    borderColor: SLColors.warning,
  },
  focusIconWrap: {
    width: 42,
    height: 42,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,146,60,0.14)',
    borderWidth: 1,
    borderColor: SLColors.warning,
  },
  focusTitle: {
    color: SLColors.warning,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  focusBody: {
    marginTop: 4,
    color: SLColors.warning,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '600',
  },
  recapHeroCard: {
    gap: 14,
    borderRadius: SLRadius.xl,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(20,18,52,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.42)',
    ...SLShadows.raised,
  },
  recapStoryCard: {
    backgroundColor: 'rgba(12,18,38,0.96)',
    borderRadius: SLRadius.xl,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
  },

  recapStoryStack: {
    gap: 18,
    marginTop: 14,
  },

  recapStoryParagraph: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 25,
    fontWeight: '500',
  },
  recapHeadline: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 22,
    fontWeight: '700',
  },
  recapMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recapMetricTile: {
    width: '48.5%',
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(199,190,232,0.14)',
  },
  recapMetricLabel: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  recapMetricValue: {
    marginTop: 5,
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
  },
  recapListStack: {
    gap: 10,
  },
  recapBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  recapBulletDot: {
    width: 7,
    height: 7,
    borderRadius: SLRadius.pill,
    marginTop: 7,
    backgroundColor: SLColors.success,
  },
  recapSoftDot: {
    width: 7,
    height: 7,
    borderRadius: SLRadius.pill,
    marginTop: 7,
    backgroundColor: SLColors.warning,
  },
  recapBulletText: {
    flex: 1,
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    fontWeight: '600',
  },
  recapLiftStack: {
    gap: 8,
  },
  recapLiftRow: {
    minHeight: 54,
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  recapLiftLabel: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  recapLiftSubText: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
  },
  recapLiftValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
    textAlign: 'right',
  },
  recapSoftCard: {
    gap: 12,
    backgroundColor: SLColors.warningSoft,
    borderRadius: SLRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: SLColors.warning,
  },
  recapNextStepsCard: {
    gap: 10,
    backgroundColor: SLColors.successSoft,
    borderRadius: SLRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: SLColors.success,
  },
  recapNextStepsText: {
    color: SLColors.success,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    fontWeight: '700',
  },
  meetActionStack: {
  gap: 10,
},

meetStatusButtonStart: {
  minHeight: 42,
  borderRadius: SLRadius.md,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  backgroundColor: SLColors.successSoft,
  borderWidth: 1,
  borderColor: SLColors.success,
},

meetStatusButtonStartText: {
  color: SLColors.success,
  fontSize: SLTypography.label.fontSize,
  fontWeight: '800',
},

meetStatusButtonFinish: {
  minHeight: 42,
  borderRadius: SLRadius.md,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  backgroundColor: 'rgba(109,91,208,0.24)',
  borderWidth: 1,
  borderColor: 'rgba(199,190,232,0.24)',
},

meetStatusButtonFinishText: {
  color: SLColors.textStrong,
  fontSize: SLTypography.label.fontSize,
  fontWeight: '800',
},
meetEditButtonCompact: {
  minHeight: 34,
  borderRadius: SLRadius.pill,
  paddingHorizontal: 12,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  backgroundColor: 'rgba(109,91,208,0.18)',
  borderWidth: 1,
  borderColor: 'rgba(199,190,232,0.22)',
},

meetEditButtonCompactText: {
  color: SLColors.review,
  fontSize: SLTypography.caption.fontSize,
  fontWeight: '800',
},
finishMeetBannerButton: {
  borderRadius: SLRadius.lg,
  paddingHorizontal: 16,
  paddingVertical: 14,
  backgroundColor: 'rgba(109,91,208,0.22)',
  borderWidth: 1,
  borderColor: 'rgba(199,190,232,0.24)',
},

finishMeetBannerContent: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},

finishMeetBannerIconWrap: {
  width: 42,
  height: 42,
  borderRadius: SLRadius.md,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(109,91,208,0.30)',
  borderWidth: 1,
  borderColor: 'rgba(199,190,232,0.24)',
},

finishMeetBannerTextCol: {
  flex: 1,
  minWidth: 0,
},

finishMeetBannerTitle: {
  color: SLColors.textStrong,
  fontSize: SLTypography.body.fontSize,
  fontWeight: '800',
},

finishMeetBannerSubtitle: {
  marginTop: 2,
  color: SLColors.text,
  fontSize: SLTypography.caption.fontSize,
  lineHeight: 17,
  fontWeight: '600',
},
startMeetRequirementsBox: {
  gap: 10,
  borderRadius: SLRadius.lg,
  paddingHorizontal: 12,
  paddingVertical: 12,
  backgroundColor: SLColors.warningSoft,
  borderWidth: 1,
  borderColor: SLColors.warning,
},
startMeetRequirementsHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
startMeetRequirementsTitle: {
  color: SLColors.warning,
  fontSize: SLTypography.label.fontSize,
  fontWeight: '900',
},
startMeetRequirementsList: {
  gap: 7,
},
startMeetRequirementRow: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 8,
},
startMeetRequirementDot: {
  width: 6,
  height: 6,
  borderRadius: SLRadius.pill,
  marginTop: 6,
  backgroundColor: SLColors.warning,
},
startMeetRequirementText: {
  flex: 1,
  color: SLColors.text,
  fontSize: SLTypography.caption.fontSize,
  lineHeight: 17,
  fontWeight: '700',
},
startMeetRequirementsHint: {
  color: SLColors.warning,
  fontSize: SLTypography.caption.fontSize,
  lineHeight: 17,
  fontWeight: '800',
},
});
