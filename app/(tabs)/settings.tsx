import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { TextInput } from '@/components/ui/sl-text';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { SLProfileAvatar, SLScreen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLRadius, SLShadows, SLTypography } from '@/constants/theme';
import {
  API_BASE,
  PRODUCTION_API_BASE,
  deleteAccountRequest,
  fetchJson,
  getDeviceTimezone,
  setManualTimezonePreference,
} from '@/lib/api';
import { getMobileViewMode, saveMobileViewMode, type MobileViewMode } from '@/lib/mobileViewMode';
import { openRecoverableCheckoutBrowser } from '@/lib/checkoutBrowser';
import { ACCESSORY_REVIEW_CATALOG, canAccessAccessoryCatalogReview } from '@/lib/accessory-catalog-review';

const FALLBACK_TIMEZONES = [
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Kolkata',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Brisbane',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Rome',
  'Pacific/Auckland',
  'Pacific/Honolulu',
];

const TIMEZONE_ALIASES: Record<string, string> = {
  'Asia/Manila': 'Philippines Manila Filipino PH',
  'America/Los_Angeles': 'Pacific Los Angeles California US USA',
  'America/New_York': 'Eastern New York US USA',
  'America/Chicago': 'Central Chicago US USA',
  'America/Denver': 'Mountain Denver US USA',
  'Europe/London': 'United Kingdom UK London GMT',
  'Europe/Paris': 'France Paris Central Europe',
  'Australia/Sydney': 'Sydney NSW Australia',
  'Pacific/Auckland': 'New Zealand Auckland',
};

type TrainingProfileSummary = {
  id?: number | null;
  name?: string | null;
  email?: string | null;
  sex?: string | null;
  bodyweight?: number | null;
  preferred_units?: string | null;
  squat_tm?: number | null;
  bench_tm?: number | null;
  deadlift_tm?: number | null;
  total_tm?: number | null;
  dots?: number | null;
  meet_date?: string | null;
  federation?: string | null;
  weight_class?: string | null;
  context?: TrainingProfileContext | null;
  training_max_permissions?: {
    can_direct_edit?: boolean;
    managed_by_external_coach?: boolean;
    can_suggest?: boolean;
    authority_resolved?: boolean;
  } | null;
};

type TrainingProfileContext = {
  relationship_started_at?: string | null;
  relationship_started_date?: string | null;
  relationship_started_label?: string | null;
  relationship_age_label?: string | null;
  preferred_units?: string | null;
  federation?: string | null;
  weight_class?: string | null;
  equipment_access?: string | null;
  injury_notes?: string | null;
  mobility_limitations?: string | null;
  preferred_cues?: string | null;
};

type ProfileEditor = 'details' | 'units' | 'maxes' | 'context' | null;
type SettingsPanel = 'coach' | 'notifications' | 'privacy' | 'about' | 'logout' | null;

type AccountTransitionMode = {
  mode?: string | null;
  available?: boolean;
  reason?: string | null;
  next_action?: string | null;
};

type AccountTransitionOption = {
  transition?: string | null;
  available?: boolean;
  reason?: string | null;
  next_action?: string | null;
  requires_confirmation?: boolean;
  destructive?: boolean;
};

type AccountTransitionMetadata = {
  ok?: boolean;
  posture?: string | null;
  current_mode?: string | null;
  account_state?: string | null;
  is_owner_admin?: boolean;
  next_action?: string | null;
  available_modes?: AccountTransitionMode[];
  transitions?: AccountTransitionOption[];
  unavailable_transitions?: AccountTransitionOption[];
};

type LinkCoachStatus = {
  already_linked?: boolean;
  can_link_coach?: boolean;
  coach?: {
    id?: number | null;
    name?: string | null;
    email?: string | null;
  } | null;
  athlete?: {
    id?: number | null;
    name?: string | null;
    coach_id?: number | null;
  } | null;
  pending_invites?: Array<{
    id: number;
    coach_id?: number | null;
    coach_name?: string | null;
    coach_email?: string | null;
  }>;
};

const TRANSITION_ATHLETE_TO_TEAM_COACH = 'athlete_to_team_coach';
const TRANSITION_TEAM_COACH_TO_ATHLETE = 'team_coach_to_athlete';
const KG_TO_LB = 2.2046226218;

const normalizeUnits = (value?: string | null) => {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'lb' || raw === 'lbs' ? 'lbs' : 'kg';
};

const kgToDisplayValue = (value?: number | null, units: 'kg' | 'lbs' = 'kg') => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
  const converted = units === 'lbs' ? value * KG_TO_LB : value;
  return Number.isInteger(converted) ? converted.toFixed(0) : converted.toFixed(1);
};

const displayValueToKg = (value: string, units: 'kg' | 'lbs' = 'kg') => {
  const parsed = Number(String(value || '').trim());
  if (!Number.isFinite(parsed)) return 0;
  return units === 'lbs' ? parsed / KG_TO_LB : parsed;
};

const normalizeMobileMode = (value: unknown): MobileViewMode | null => {
  const mode = String(value || '').trim().toLowerCase();
  return ['athlete', 'coach', 'individual'].includes(mode) ? (mode as MobileViewMode) : null;
};

const humanizeToken = (value?: string | null) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const accountAccessLabel = (value?: string | null) => {
  switch (String(value || '').trim().toUpperCase()) {
    case 'READY_ATHLETE':
    case 'READY_INDIVIDUAL':
    case 'READY_TEAM_COACH':
    case 'READY_OWNER_ADMIN':
      return 'Ready';
    case 'EMAIL_VERIFICATION_REQUIRED':
      return 'Verify email';
    case 'LINK_COACH_REQUIRED':
      return 'Coach link needed';
    case 'ACTIVATION_REQUIRED':
      return 'Activation needed';
    default:
      return 'Status not loaded';
  }
};

const accountActionLabel = (value?: string | null) => {
  switch (String(value || '').trim().toLowerCase()) {
    case 'verify_email':
      return 'Verify your email to continue';
    case 'activate_billing':
      return 'Activate membership to continue';
    case 'link_coach':
    case 'accept_invite':
      return 'Connect a coach to continue';
    case 'confirm_offboarding':
      return 'Resolve roster and billing first';
    case 'choose_external_coach':
      return 'Choose a coach to continue';
    case 'end_external_relationship':
      return 'End the active coaching relationship first';
    case 'enter_beta_code':
      return 'Enter your Founder Beta code';
    default:
      return null;
  }
};

const accountRestrictionLabel = (value?: string | null) => {
  switch (String(value || '').trim().toLowerCase()) {
    case 'email_verification_required':
      return 'Verify your email first';
    case 'billing_required':
      return 'Membership activation is required';
    case 'cancelled_billing_requires_offboarding':
    case 'roster_offboarding_required':
      return 'Resolve roster athletes and billing first';
    case 'link_coach_required':
      return 'Connect a coach first';
    case 'external_coach_active':
      return 'End the active coaching relationship first';
    case 'self_relationship_active':
      return 'End self-coaching first';
    case 'owner_admin_explicit':
      return 'Owner/Admin access cannot be changed here';
    case 'already_in_target_mode':
      return 'Already using this mode';
    case 'mobile_switch_not_enabled':
      return 'Not enabled for this account';
    case 'not_current_posture':
    case 'unsupported_transition':
    case 'unknown_role':
      return 'Not available for this account';
    default:
      return null;
  }
};

type SettingsAccent = 'purple' | 'amber' | 'teal' | 'neutral';

const settingsAccentColor: Record<SettingsAccent, string> = {
  purple: SLColors.accentViolet,
  amber: SLColors.warning,
  teal: SLColors.accentCyanMuted,
  neutral: SLColors.textMuted,
};

function supportedTimezones(deviceTimezone: string | null) {
  let zones: string[] = [];
  try {
    const supported = (Intl as any).supportedValuesOf?.('timeZone');
    if (Array.isArray(supported)) zones = supported;
  } catch {
    zones = [];
  }
  if (!zones.length) zones = FALLBACK_TIMEZONES;
  if (deviceTimezone && !zones.includes(deviceTimezone)) zones = [deviceTimezone, ...zones];
  for (const required of ['Asia/Manila', 'America/Los_Angeles', 'America/New_York', 'Europe/London', 'Europe/Paris', 'Australia/Sydney', 'Pacific/Auckland']) {
    if (!zones.includes(required)) zones.push(required);
  }
  return Array.from(new Set(zones)).sort((a, b) => a.localeCompare(b));
}

export default function SettingsScreen() {
  const router = useRouter();
  const { height: viewportHeight } = useWindowDimensions();
  const auth = useAuth() as any;
  const refreshAccountState = auth?.refreshAccountState;
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [timezone, setTimezone] = useState<string>(getDeviceTimezone() || 'America/Los_Angeles');
  const [timezoneSource, setTimezoneSource] = useState<'manual' | 'device' | 'fallback'>('device');
  const [timezoneLoading, setTimezoneLoading] = useState(false);
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [mobileSettingsLoaded, setMobileSettingsLoaded] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [notifyVideoFeedback, setNotifyVideoFeedback] = useState(true);
  const [notifyVideoSubmissions, setNotifyVideoSubmissions] = useState(true);
  const [videoMlTrainingConsent, setVideoMlTrainingConsent] = useState<boolean | null>(null);
  const [trainingProfile, setTrainingProfile] = useState<TrainingProfileSummary | null>(null);
  const [profileEditor, setProfileEditor] = useState<ProfileEditor>(null);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [detailsDraft, setDetailsDraft] = useState({
    name: '',
    email: '',
    sex: 'M',
    bodyweight: '',
    preferredUnits: 'kg',
    federation: '',
    weightClass: '',
  });
  const [maxesDraft, setMaxesDraft] = useState({
    squat_tm: '',
    bench_tm: '',
    deadlift_tm: '',
  });
  const [contextDraft, setContextDraft] = useState({
    relationship_started_at: '',
    equipment_access: '',
    injury_notes: '',
    mobility_limitations: '',
    preferred_cues: '',
  });
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState({
    category: 'bug' as 'bug' | 'feature_request' | 'general_feedback',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    title: '',
    body: '',
  });
  const [timezoneModalOpen, setTimezoneModalOpen] = useState(false);
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [mobileViewMode, setMobileViewMode] = useState<MobileViewMode>('coach');
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [modeSwitching, setModeSwitching] = useState<MobileViewMode | null>(null);
  const [accountTransitions, setAccountTransitions] = useState<AccountTransitionMetadata | null>(null);
  const [accountTransitionsLoading, setAccountTransitionsLoading] = useState(false);
  const [accountTransitionsError, setAccountTransitionsError] = useState<string | null>(null);
  const [linkCoachStatus, setLinkCoachStatus] = useState<LinkCoachStatus | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeBetaCode, setUpgradeBetaCode] = useState('');
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [downgradeError, setDowngradeError] = useState<string | null>(null);
  const [downgradeSubmitting, setDowngradeSubmitting] = useState(false);

  const deviceTimezone = useMemo(() => getDeviceTimezone(), []);
  const timezoneOptions = useMemo(() => supportedTimezones(deviceTimezone), [deviceTimezone]);

  const formatLocalTime = (d?: Date | string | null) => {
    if (!d) return 'unknown time';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const updateLabel = Updates.isEmbeddedLaunch
    ? 'Embedded build'
    : Updates.updateId
    ? `Update ${Updates.updateId.slice(0, 8)} · ${formatLocalTime(Updates.createdAt)}`
    : 'Unknown update';
  const feedbackModalHeight = Math.min(620, Math.max(440, Math.round(viewportHeight * 0.78)));

  const role = useMemo(() => {
    const raw =
      auth?.user?.role ??
      auth?.profile?.role ??
      auth?.role ??
      auth?.accountType ??
      auth?.userType ??
      '';

    const normalized = String(raw || '').trim().toLowerCase();

    if (['coach', 'trainer'].includes(normalized)) return 'coach';
    if (['athlete', 'lifter', 'client'].includes(normalized)) return 'athlete';

    return 'athlete';
  }, [auth]);
  const isCoach = role === 'coach' || !!auth?.user?.is_coach;
  const isIndividual =
    auth?.user?.workspace_mode === 'individual' ||
      auth?.user?.is_individual_workspace === true ||
      auth?.user?.is_self_coached === true;
  const canUseInternalSelfCoachMode =
    auth?.user?.can_access_internal_self_coach_mobile_mode === true;
  const safeBackendMobileModes = useMemo(() => {
    if (isIndividual && !canUseInternalSelfCoachMode) return ['individual'] as MobileViewMode[];
    const raw = Array.isArray(auth?.user?.available_mobile_modes)
      ? auth.user.available_mobile_modes
      : isCoach
      ? ['athlete', 'coach']
      : ['athlete'];
    const normalized = raw
      .map((mode: unknown) => String(mode || '').trim().toLowerCase())
      .filter((mode: string): mode is MobileViewMode => ['athlete', 'coach', 'individual'].includes(mode));
    return Array.from(new Set(normalized.length ? normalized : isCoach ? ['athlete', 'coach'] : ['athlete'])) as MobileViewMode[];
  }, [auth?.user?.available_mobile_modes, canUseInternalSelfCoachMode, isCoach, isIndividual]);
  const activeMobileMode: MobileViewMode =
    isIndividual && !canUseInternalSelfCoachMode ? 'individual' : mobileViewMode;
  const transitionModeOptions = useMemo(() => {
    const transitionModes = Array.isArray(accountTransitions?.available_modes)
      ? accountTransitions.available_modes
          .map((mode) => {
            const normalized = normalizeMobileMode(mode.mode);
            if (!normalized) return null;
            const existingSwitchEnabled = safeBackendMobileModes.includes(normalized);
            const currentSelection = normalized === activeMobileMode;
            return {
              mode: normalized,
              backendAvailable: mode.available === true,
              switchable: currentSelection || (mode.available === true && existingSwitchEnabled && isCoach),
              reason: mode.available === true && !existingSwitchEnabled && !currentSelection
                ? 'mobile_switch_not_enabled'
                : mode.reason || null,
              nextAction: mode.next_action || null,
            };
          })
          .filter(Boolean)
      : [];

    if (transitionModes.length) {
      return transitionModes as Array<{
        mode: MobileViewMode;
        backendAvailable: boolean;
        switchable: boolean;
        reason: string | null;
        nextAction: string | null;
      }>;
    }

    return safeBackendMobileModes.map((mode) => ({
      mode,
      backendAvailable: true,
      switchable: isCoach,
      reason: null,
      nextAction: null,
    }));
  }, [accountTransitions?.available_modes, activeMobileMode, isCoach, safeBackendMobileModes]);
  const accountTransitionOptions = useMemo(
    () => [
      ...(Array.isArray(accountTransitions?.transitions) ? accountTransitions.transitions : []),
      ...(Array.isArray(accountTransitions?.unavailable_transitions) ? accountTransitions.unavailable_transitions : []),
    ],
    [accountTransitions?.transitions, accountTransitions?.unavailable_transitions]
  );
  const teamCoachUpgradeTransition = useMemo(
    () =>
      accountTransitionOptions.find(
        (transition) => String(transition.transition || '') === TRANSITION_ATHLETE_TO_TEAM_COACH
      ) || null,
    [accountTransitionOptions]
  );
  const teamCoachDowngradeTransition = useMemo(
    () =>
      accountTransitionOptions.find(
        (transition) => String(transition.transition || '') === TRANSITION_TEAM_COACH_TO_ATHLETE
      ) || null,
    [accountTransitionOptions]
  );
  const teamCoachUpgradeReason = String(teamCoachUpgradeTransition?.reason || '');
  const teamCoachUpgradeNextAction = String(teamCoachUpgradeTransition?.next_action || '');
  const showTeamCoachUpgradeEntry =
    !!teamCoachUpgradeTransition &&
    !['not_current_posture', 'unsupported_transition'].includes(teamCoachUpgradeReason);
  const canOpenTeamCoachUpgrade =
    showTeamCoachUpgradeEntry &&
    !upgradeSubmitting &&
    (
      teamCoachUpgradeTransition?.available === true ||
      teamCoachUpgradeReason === 'beta_code_required' ||
      teamCoachUpgradeNextAction === 'enter_beta_code'
    );
  const teamCoachUpgradeDescription = teamCoachUpgradeReason === 'email_verification_required'
    ? 'Verify your email before starting a Team Coach upgrade.'
    : teamCoachUpgradeReason === 'billing_required'
    ? 'Billing activation is required before Team Coach access opens.'
    : 'Founder Beta Team Coach is $10/month forever after the 14-day free trial.';
  const teamCoachDowngradeReason = String(teamCoachDowngradeTransition?.reason || '');
  const teamCoachDowngradeNextAction = String(teamCoachDowngradeTransition?.next_action || '');
  const pendingTeamCoachUpgrade =
    isCoach &&
    !isIndividual &&
    String(accountTransitions?.account_state || '').toUpperCase() === 'ACTIVATION_REQUIRED';
  const showTeamCoachDowngradeEntry =
    !!teamCoachDowngradeTransition &&
    !['not_current_posture', 'unsupported_transition'].includes(teamCoachDowngradeReason);
  const canStartTeamCoachDowngrade =
    (pendingTeamCoachUpgrade ||
      (showTeamCoachDowngradeEntry && teamCoachDowngradeTransition?.available === true)) &&
    !downgradeSubmitting;
  const teamCoachDowngradeDescription = pendingTeamCoachUpgrade
    ? 'Cancel this incomplete unpaid upgrade and return to Athlete without changing your identity or history.'
    : teamCoachDowngradeReason === 'roster_offboarding_required'
    ? 'Resolve roster athletes before returning to Athlete only.'
    : 'Cancel your coaching subscription and return to Athlete while preserving your identity and history.';
  const accountPosture = String(accountTransitions?.posture || '').trim().toLowerCase();
  const accountTypeTitle =
    accountTransitions?.is_owner_admin === true || accountPosture === 'owner_admin'
      ? 'Owner/Admin'
      : accountPosture === 'individual' || isIndividual
      ? 'Self-Coached'
      : accountPosture.startsWith('team_coach') || isCoach
      ? 'Team Coach'
      : 'Athlete';
  const modeOptions = useMemo(
    () =>
      transitionModeOptions.map((modeOption) => {
        const { mode } = modeOption;
        if (mode === 'individual') {
          return {
            ...modeOption,
            mode,
            icon: 'barbell-outline' as keyof typeof Ionicons.glyphMap,
            label: 'Self-Coach',
            description: 'Use your own athlete identity for individual programming and training.',
          };
        }
        if (mode === 'coach') {
          return {
            ...modeOption,
            mode,
            icon: 'people-outline' as keyof typeof Ionicons.glyphMap,
            label: 'Coach',
            description: 'Open roster, calendar, videos, messages, and team coach tools.',
          };
        }
        return {
          ...modeOption,
          mode,
          icon: 'person-outline' as keyof typeof Ionicons.glyphMap,
          label: 'Athlete',
          description: 'Open athlete training, calendar, The Ledger, and current training focus.',
        };
      }),
    [transitionModeOptions]
  );
  const mobileModeSummary =
    activeMobileMode === 'individual' ? 'Self-Coach' : activeMobileMode === 'coach' ? 'Coach' : 'Athlete';
  const hasTrainingProfile = isIndividual || activeMobileMode === 'athlete' || !!trainingProfile;
  const showVideoFeedbackNotifications = activeMobileMode === 'athlete' && !isIndividual;
  const showVideoSubmissionNotifications = isCoach && activeMobileMode === 'coach' && !isIndividual;
  const showNotificationsSection = showVideoFeedbackNotifications || showVideoSubmissionNotifications;
  const showLinkCoachEntry = !isIndividual && (role === 'athlete' || isCoach);
  const linkCoachAlreadyLinked = linkCoachStatus?.already_linked === true || !!linkCoachStatus?.athlete?.coach_id;
  const linkCoachPendingCount = Array.isArray(linkCoachStatus?.pending_invites)
    ? linkCoachStatus?.pending_invites?.length || 0
    : 0;
  const linkCoachSummary = linkCoachAlreadyLinked
    ? 'Linked'
    : linkCoachPendingCount > 0
    ? `${linkCoachPendingCount} pending`
    : 'Open';
  const linkCoachDescription = linkCoachAlreadyLinked
    ? `Linked to ${linkCoachStatus?.coach?.name || linkCoachStatus?.coach?.email || 'your coach'}`
    : isCoach
    ? 'Connect your own Athlete identity to a coach'
    : 'Connect your account to a coach';
  const profileUnits = useMemo(() => normalizeUnits(trainingProfile?.preferred_units || trainingProfile?.context?.preferred_units), [trainingProfile]);
  const trainingMaxPermissions = trainingProfile?.training_max_permissions;
  const canDirectEditTrainingMaxes =
    mobileSettingsLoaded &&
    trainingMaxPermissions?.authority_resolved === true &&
    trainingMaxPermissions?.can_direct_edit === true;
  const trainingMaxesManagedByCoach =
    mobileSettingsLoaded && trainingMaxPermissions?.managed_by_external_coach === true;

  const formatProfileWeight = useCallback(
    (value?: number | null) => {
      const formatted = kgToDisplayValue(value, profileUnits);
      return formatted ? `${formatted} ${profileUnits}` : null;
    },
    [profileUnits]
  );

  const profileDetailRows = useMemo(() => {
    if (!trainingProfile) return [];
    return [
      { label: 'Name', value: trainingProfile.name || null },
      { label: 'Email', value: trainingProfile.email || null },
      { label: 'Bodyweight', value: formatProfileWeight(trainingProfile.bodyweight) },
      { label: 'Sex', value: trainingProfile.sex || null },
      { label: 'Units', value: profileUnits.toUpperCase() },
      { label: 'Federation', value: trainingProfile.federation || null },
      { label: 'Weight Class', value: trainingProfile.weight_class || null },
    ].filter((row) => row.value);
  }, [formatProfileWeight, profileUnits, trainingProfile]);

  const profileContextRows = useMemo(() => {
    const context = trainingProfile?.context || {};
    return [
      { label: 'Profile Started', value: context.relationship_started_label || null },
      { label: 'Equipment', value: context.equipment_access || null },
      { label: 'Injury Notes', value: context.injury_notes || null },
      { label: 'Mobility', value: context.mobility_limitations || null },
      { label: 'Movement Cues', value: context.preferred_cues || null },
    ].filter((row) => row.value);
  }, [trainingProfile]);

  useEffect(() => {
    let mounted = true;

    if (isIndividual) {
      setMobileViewMode('individual');
      return () => {
        mounted = false;
      };
    }

    getMobileViewMode(isCoach).then((mode) => {
      if (mounted) setMobileViewMode(mode);
    });

    return () => {
      mounted = false;
    };
  }, [isCoach, isIndividual, auth?.user?.email]);

  const timezoneSourceLabel = useMemo(() => {
    if (timezoneSource === 'manual') return 'Manually set';
    if (timezoneSource === 'fallback') return 'Fallback';
    return 'Device detected';
  }, [timezoneSource]);

  const filteredTimezones = useMemo(() => {
    const q = timezoneSearch.trim().toLowerCase();
    if (!q) return timezoneOptions;
    return timezoneOptions.filter((tz) => {
      const haystack = `${tz} ${tz.replace(/[_/]/g, ' ')} ${TIMEZONE_ALIASES[tz] || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [timezoneOptions, timezoneSearch]);

  const loadMobileSettings = useCallback(async () => {
    try {
      setTimezoneLoading(true);
      setMobileSettingsLoaded(false);
      setProfileEditor(null);
      const resp = await fetchJson<any>('/mobile/settings', { method: 'GET' });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setNotifyVideoFeedback(json.notify_video_feedback !== false);
      setNotifyVideoSubmissions(json.notify_video_submissions !== false);
      if (Array.isArray(json.available_mobile_modes) || json.mobile_mode) {
        await auth?.applyAccountStatePayload?.({ user: json } as any);
      }
      if (json.mobile_mode && ['athlete', 'coach', 'individual'].includes(String(json.mobile_mode))) {
        setMobileViewMode(String(json.mobile_mode) as MobileViewMode);
      }
      setVideoMlTrainingConsent(
        typeof json.video_ml_training_consent === 'boolean'
          ? json.video_ml_training_consent
          : null
      );
      setTrainingProfile(json.training_profile || null);
      setLinkCoachStatus(json.link_coach || null);
      setMobileSettingsLoaded(true);
      if (hasTrainingProfile) {
        setTimezone(json.timezone || deviceTimezone || 'America/Los_Angeles');
        setTimezoneSource(json.timezone_source || 'device');
        await setManualTimezonePreference(json.timezone_source === 'manual' ? json.timezone : null);
      }
    } catch (err) {
      console.warn('Failed to load mobile settings', err);
      setMobileSettingsLoaded(false);
      setTrainingProfile(null);
      setLinkCoachStatus(null);
      setTimezone(deviceTimezone || 'America/Los_Angeles');
      setTimezoneSource(deviceTimezone ? 'device' : 'fallback');
    } finally {
      setTimezoneLoading(false);
    }
  }, [deviceTimezone, hasTrainingProfile]);

  useEffect(() => {
    loadMobileSettings();
  }, [loadMobileSettings]);

  useFocusEffect(
    useCallback(() => {
      void refreshAccountState?.();
    }, [refreshAccountState]),
  );

  const loadAccountTransitionMetadata = useCallback(async () => {
    try {
      setAccountTransitionsLoading(true);
      setAccountTransitionsError(null);
      const resp = await fetchJson<AccountTransitionMetadata>('/auth/account-transitions.json', { method: 'GET' });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error((json as any).error || `HTTP ${resp.status}`);
      setAccountTransitions(json);
    } catch (err: any) {
      setAccountTransitions(null);
      setAccountTransitionsError(err?.message || 'Account transition metadata could not be loaded.');
    } finally {
      setAccountTransitionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccountTransitionMetadata();
  }, [loadAccountTransitionMetadata]);

  const openProfileEditor = (editor: Exclude<ProfileEditor, null>) => {
    if (!trainingProfile) return;
    if (editor === 'maxes' && !canDirectEditTrainingMaxes) return;
    const units = normalizeUnits(trainingProfile.preferred_units || trainingProfile.context?.preferred_units);
    setProfileError(null);
    setSettingsNotice(null);
    if (editor === 'details' || editor === 'units') {
      setDetailsDraft({
        name: trainingProfile.name || '',
        email: trainingProfile.email || '',
        sex: (trainingProfile.sex || 'M').toUpperCase() === 'F' ? 'F' : 'M',
        bodyweight: kgToDisplayValue(trainingProfile.bodyweight, units),
        preferredUnits: units,
        federation: trainingProfile.federation || trainingProfile.context?.federation || '',
        weightClass: trainingProfile.weight_class || trainingProfile.context?.weight_class || '',
      });
    }
    if (editor === 'maxes') {
      setMaxesDraft({
        squat_tm: kgToDisplayValue(trainingProfile.squat_tm, units),
        bench_tm: kgToDisplayValue(trainingProfile.bench_tm, units),
        deadlift_tm: kgToDisplayValue(trainingProfile.deadlift_tm, units),
      });
    }
    if (editor === 'context') {
      const context = trainingProfile.context || {};
      setContextDraft({
        relationship_started_at: context.relationship_started_date || '',
        equipment_access: context.equipment_access || '',
        injury_notes: context.injury_notes || '',
        mobility_limitations: context.mobility_limitations || '',
        preferred_cues: context.preferred_cues || '',
      });
    }
    setProfileEditor(editor);
  };

  const applyProfilePayload = async (json: any) => {
    if (json?.training_profile) {
      setTrainingProfile(json.training_profile);
      if (json.training_profile?.training_max_permissions?.can_direct_edit !== true) {
        setProfileEditor((current) => (current === 'maxes' ? null : current));
      }
    }
    if (json?.timezone) setTimezone(json.timezone);
    if (json?.timezone_source) setTimezoneSource(json.timezone_source);
    if (json?.timezone_source) {
      await setManualTimezonePreference(json.timezone_source === 'manual' ? json.timezone : null);
    }
  };

  const saveProfileDetails = async () => {
    const units = normalizeUnits(detailsDraft.preferredUnits);
    try {
      setProfileSaving(true);
      setProfileError(null);
      const basicResp = await fetchJson<any>('/mobile/training-profile/basic', {
        method: 'PATCH',
        body: {
          name: detailsDraft.name,
          sex: detailsDraft.sex,
          bodyweight: displayValueToKg(detailsDraft.bodyweight, units),
        } as any,
      });
      const basicJson = basicResp.json || {};
      if (!basicResp.ok || !basicJson.ok) throw new Error(basicJson.error || `HTTP ${basicResp.status}`);

      const contextResp = await fetchJson<any>('/mobile/training-profile/context', {
        method: 'PATCH',
        body: {
          relationship_started_at: trainingProfile?.context?.relationship_started_date || '',
          preferred_units: units,
          federation: detailsDraft.federation,
          weight_class: detailsDraft.weightClass,
          equipment_access: trainingProfile?.context?.equipment_access || '',
          injury_notes: trainingProfile?.context?.injury_notes || '',
          mobility_limitations: trainingProfile?.context?.mobility_limitations || '',
          preferred_cues: trainingProfile?.context?.preferred_cues || '',
        } as any,
      });
      const contextJson = contextResp.json || {};
      if (!contextResp.ok || !contextJson.ok) throw new Error(contextJson.error || `HTTP ${contextResp.status}`);
      await applyProfilePayload(contextJson);
      setProfileEditor(null);
    } catch (err: any) {
      setProfileError(err?.message || 'Profile details could not be saved.');
    } finally {
      setProfileSaving(false);
    }
  };

  const savePreferredUnits = async () => {
    const units = normalizeUnits(detailsDraft.preferredUnits);
    try {
      setProfileSaving(true);
      setProfileError(null);
      const context = trainingProfile?.context || {};
      const resp = await fetchJson<any>('/mobile/training-profile/context', {
        method: 'PATCH',
        body: {
          relationship_started_at: context.relationship_started_date || '',
          preferred_units: units,
          federation: trainingProfile?.federation || context.federation || '',
          weight_class: trainingProfile?.weight_class || context.weight_class || '',
          equipment_access: context.equipment_access || '',
          injury_notes: context.injury_notes || '',
          mobility_limitations: context.mobility_limitations || '',
          preferred_cues: context.preferred_cues || '',
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      await applyProfilePayload(json);
      setProfileEditor(null);
    } catch (err: any) {
      setProfileError(err?.message || 'Preferred units could not be saved.');
    } finally {
      setProfileSaving(false);
    }
  };

  const saveTrainingMaxes = async () => {
    try {
      setProfileSaving(true);
      setProfileError(null);
      const resp = await fetchJson<any>('/mobile/training-profile/training-maxes', {
        method: 'PATCH',
        body: {
          squat_tm: displayValueToKg(maxesDraft.squat_tm, profileUnits),
          bench_tm: displayValueToKg(maxesDraft.bench_tm, profileUnits),
          deadlift_tm: displayValueToKg(maxesDraft.deadlift_tm, profileUnits),
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) {
        if (resp.status === 403 && json.error === 'coach_controlled_training_maxes') {
          setProfileEditor(null);
          setProfileError(null);
          await loadMobileSettings();
          setSettingsNotice('Your training maxes are now managed by your coach.');
          return;
        }
        throw new Error(json.message || json.error || `HTTP ${resp.status}`);
      }
      await applyProfilePayload(json);
      setProfileEditor(null);
    } catch (err: any) {
      setProfileError(err?.message || 'Training maxes could not be saved.');
    } finally {
      setProfileSaving(false);
    }
  };

  const saveTrainingContext = async () => {
    try {
      setProfileSaving(true);
      setProfileError(null);
      const resp = await fetchJson<any>('/mobile/training-profile/context', {
        method: 'PATCH',
        body: {
          relationship_started_at: contextDraft.relationship_started_at,
          preferred_units: profileUnits,
          federation: trainingProfile?.federation || trainingProfile?.context?.federation || '',
          weight_class: trainingProfile?.weight_class || trainingProfile?.context?.weight_class || '',
          equipment_access: contextDraft.equipment_access,
          injury_notes: contextDraft.injury_notes,
          mobility_limitations: contextDraft.mobility_limitations,
          preferred_cues: contextDraft.preferred_cues,
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      await applyProfilePayload(json);
      setProfileEditor(null);
    } catch (err: any) {
      setProfileError(err?.message || 'Training context could not be saved.');
    } finally {
      setProfileSaving(false);
    }
  };

  const saveNotificationPreference = async (
    key: 'notify_video_feedback' | 'notify_video_submissions',
    value: boolean,
  ) => {
    const previousFeedback = notifyVideoFeedback;
    const previousSubmissions = notifyVideoSubmissions;
    if (key === 'notify_video_feedback') setNotifyVideoFeedback(value);
    if (key === 'notify_video_submissions') setNotifyVideoSubmissions(value);
    try {
      setNotificationLoading(true);
      const resp = await fetchJson<any>('/mobile/settings', {
        method: 'PATCH',
        body: { [key]: value } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setNotifyVideoFeedback(json.notify_video_feedback !== false);
      setNotifyVideoSubmissions(json.notify_video_submissions !== false);
    } catch (err: any) {
      setNotifyVideoFeedback(previousFeedback);
      setNotifyVideoSubmissions(previousSubmissions);
      Alert.alert('Notification setting not saved', err?.message || 'Please try again.');
    } finally {
      setNotificationLoading(false);
    }
  };

  const saveVideoMlTrainingConsent = async (value: boolean) => {
    const previous = videoMlTrainingConsent;
    setVideoMlTrainingConsent(value);
    try {
      setPrivacyLoading(true);
      const resp = await fetchJson<any>('/settings/mobile/video-ml-consent', {
        method: 'POST',
        body: { video_ml_training_consent: value } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setVideoMlTrainingConsent(
        typeof json.video_ml_training_consent === 'boolean'
          ? json.video_ml_training_consent
          : value
      );
    } catch (err: any) {
      setVideoMlTrainingConsent(previous);
      Alert.alert('Privacy setting not saved', err?.message || 'Please try again.');
    } finally {
      setPrivacyLoading(false);
    }
  };

  const saveTimezone = async (nextTimezone: string | null) => {
    try {
      setTimezoneSaving(true);
      const resp = await fetchJson<any>('/mobile/settings', {
        method: 'PATCH',
        body: { timezone: nextTimezone } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setTimezone(json.timezone || nextTimezone || deviceTimezone || 'America/Los_Angeles');
      setTimezoneSource(json.timezone_source || (nextTimezone ? 'manual' : 'device'));
      await setManualTimezonePreference(json.timezone_source === 'manual' ? json.timezone : null);
      setTimezoneModalOpen(false);
    } catch (err: any) {
      setSettingsNotice(err?.message || 'Timezone not saved. Please choose a valid timezone and try again.');
    } finally {
      setTimezoneSaving(false);
    }
  };

  const handleLinkCoach = () => {
    try {
      router.push('/link-coach' as any);
    } catch {
      Alert.alert('Link coach', 'Link coach flow is not wired yet.');
    }
  };

  const chooseAndUploadAvatar = async () => {
    if (!hasTrainingProfile) return;

    try {
      setUploadingAvatar(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Allow photo access to upload an avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        Alert.alert('Upload failed', 'No image was selected.');
        return;
      }

      const filename = asset.fileName || 'avatar.jpg';
      const mimeType = asset.mimeType || 'image/jpeg';

      const formData = new FormData();
      formData.append('avatar', {
        uri: asset.uri,
        name: filename,
        type: mimeType,
      } as any);

      const response = await fetchJson<any>('/mobile/avatar', {
        method: 'POST',
        body: formData as any,
      });
      const payload = response.json;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Upload failed');
      }

      await auth.updateProfilePhoto(payload);
    } catch (err) {
      console.error('Avatar upload failed', err);
      Alert.alert('Upload failed', 'Please try again');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    try {
      setUploadingAvatar(true);
      const response = await fetchJson<any>('/mobile/avatar', { method: 'DELETE' });
      const payload = response.json;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Delete failed');
      await auth.updateProfilePhoto(payload);
    } catch (err) {
      console.error('Avatar removal failed', err);
      Alert.alert('Could not remove photo', 'Please try again');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateAvatar = () => {
    if (!hasTrainingProfile || uploadingAvatar) return;
    if (!auth.user?.profilePhotoUrl) {
      void chooseAndUploadAvatar();
      return;
    }

    Alert.alert('Profile photo', undefined, [
      { text: 'Choose new photo', onPress: () => void chooseAndUploadAvatar() },
      { text: 'Remove photo', style: 'destructive', onPress: () => void removeAvatar() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      setProfileEditor(null);
      setTrainingProfile(null);
      setMobileSettingsLoaded(false);

      if (typeof auth?.logout === 'function') {
        await auth.logout();
      } else if (typeof auth?.signOut === 'function') {
        await auth.signOut();
      } else {
        throw new Error('No logout handler found in auth context.');
      }

      router.replace('/login');
    } catch (err) {
      console.error('Settings logout failed', err);
      Alert.alert('Log out failed', 'Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    const email = String(auth?.user?.email || '').trim();
    if (!email) {
      Alert.alert('Delete Account', 'Your account email was not available. Please log out and sign back in.');
      return;
    }
    if (deleteConfirmEmail.trim().toLowerCase() !== email.toLowerCase()) {
      Alert.alert('Email does not match', 'Type your account email exactly to confirm deletion.');
      return;
    }

    try {
      setDeletingAccount(true);
      const result = await deleteAccountRequest(deleteConfirmEmail.trim());
      if (!result.ok) {
        throw new Error(result.error || 'Unable to delete account.');
      }
      setDeleteModalOpen(false);
      setDeleteConfirmEmail('');
      if (typeof auth?.logout === 'function') await auth.logout();
      Alert.alert('Account deleted', 'Your Strength Ledger account has been permanently deleted.', [
        { text: 'OK', onPress: () => router.replace('/login') },
      ]);
    } catch (err: any) {
      Alert.alert('Delete Account failed', err?.message || 'Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const openTeamCoachUpgrade = () => {
    if (!canOpenTeamCoachUpgrade) {
      const reason = teamCoachUpgradeReason ? humanizeToken(teamCoachUpgradeReason) : 'This transition is not available.';
      const nextAction = teamCoachUpgradeNextAction ? `\nNext action: ${humanizeToken(teamCoachUpgradeNextAction)}` : '';
      Alert.alert('Become a Team Coach', `${reason}${nextAction}`);
      return;
    }
    setUpgradeError(null);
    setUpgradeBetaCode('');
    setUpgradeModalOpen(true);
  };

  const submitTeamCoachUpgrade = async () => {
    const betaCode = upgradeBetaCode.trim();
    if (!betaCode) {
      setUpgradeError('Enter your founder beta access code.');
      return;
    }

    try {
      setUpgradeSubmitting(true);
      setUpgradeError(null);
      const devSimulationEnabled =
        typeof __DEV__ !== 'undefined' &&
        __DEV__ &&
        API_BASE !== PRODUCTION_API_BASE &&
        auth?.user?.dev_onboarding_simulation_enabled === true;
      const resp = await fetchJson<any>(`/auth/account-transitions/${TRANSITION_ATHLETE_TO_TEAM_COACH}/start`, {
        method: 'POST',
        body: {
          confirmed: true,
          beta_code: betaCode,
          dev_simulate_billing: devSimulationEnabled,
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) {
        const message =
          json.error ||
          json.reason ||
          json.next_action ||
          `HTTP ${resp.status}`;
        throw new Error(humanizeToken(message));
      }

      if (json.checkout_url) {
        if (json.account_state_payload) {
          await auth?.applyAccountStatePayload?.(json.account_state_payload);
        }
        await auth?.refreshAccountState?.();
        setUpgradeModalOpen(false);
        setUpgradeBetaCode('');
        setUpgradeSubmitting(false);
        try {
          await openRecoverableCheckoutBrowser(json.checkout_url);
        } catch {
          Alert.alert(
            'Stripe Checkout could not be opened',
            'Your Team Coach upgrade is waiting for billing activation. Reopen activation from Account Setup and try again.'
          );
        } finally {
          setUpgradeModalOpen(false);
          setUpgradeSubmitting(false);
        }
        void auth?.refreshAccountState?.();
        router.replace('/');
        return;
      }

      if (json.account_state_payload) {
        await auth?.applyAccountStatePayload?.(json.account_state_payload);
      }
      await auth?.refreshAccountState?.();
      await loadMobileSettings();
      await loadAccountTransitionMetadata();
      setUpgradeModalOpen(false);
      setUpgradeBetaCode('');
      Alert.alert('Team Coach mode ready', 'Your account is now ready for Team Coach surfaces. You can switch to Coach mode from Mobile Mode.');
    } catch (err: any) {
      setUpgradeError(err?.message || 'Team Coach upgrade failed.');
    } finally {
      setUpgradeSubmitting(false);
    }
  };

  const openTeamCoachDowngrade = () => {
    if (!canStartTeamCoachDowngrade) {
      const reason = teamCoachDowngradeReason ? humanizeToken(teamCoachDowngradeReason) : 'This transition is not available.';
      const nextAction = teamCoachDowngradeNextAction ? `\nNext action: ${humanizeToken(teamCoachDowngradeNextAction)}` : '';
      Alert.alert('Return to Athlete', `${reason}${nextAction}`);
      return;
    }
    setDowngradeError(null);
    setDowngradeModalOpen(true);
  };

  const submitTeamCoachDowngrade = async () => {
    try {
      setDowngradeSubmitting(true);
      setDowngradeError(null);
      const endpoint = pendingTeamCoachUpgrade
        ? '/auth/account-transitions/team-coach-upgrade/cancel'
        : `/auth/account-transitions/${TRANSITION_TEAM_COACH_TO_ATHLETE}/start`;
      const resp = await fetchJson<any>(endpoint, {
        method: 'POST',
        body: { confirmed: true } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) {
        if (json.retryable) {
          throw new Error('Cancellation could not be fully confirmed. Coach access was not removed. Please retry.');
        }
        const message =
          json.error ||
          json.reason ||
          json.next_action ||
          `HTTP ${resp.status}`;
        throw new Error(humanizeToken(message));
      }

      if (json.account_state_payload) {
        await auth?.applyAccountStatePayload?.(json.account_state_payload);
      }
      await auth?.refreshAccountState?.();
      await loadMobileSettings();
      await loadAccountTransitionMetadata();
      await saveMobileViewMode('athlete');
      setMobileViewMode('athlete');
      setDowngradeModalOpen(false);
      Alert.alert(
        'Athlete account ready',
        pendingTeamCoachUpgrade
          ? 'Your incomplete Team Coach upgrade was cancelled. Your Athlete identity, history, and linked coach relationship remain.'
          : 'Your coaching subscription was cancelled and Team Coach access removed. Your Athlete identity, history, and linked coach relationship remain.'
      );
      router.replace('/(tabs)/athlete-dashboard');
    } catch (err: any) {
      setDowngradeError(err?.message || 'Please try again.');
    } finally {
      setDowngradeSubmitting(false);
    }
  };

  const canChangeAccountType = canOpenTeamCoachUpgrade || canStartTeamCoachDowngrade;
  const openAccountTypeTransition = () => {
    if (canOpenTeamCoachUpgrade) {
      openTeamCoachUpgrade();
      return;
    }
    if (canStartTeamCoachDowngrade) {
      openTeamCoachDowngrade();
    }
  };

  const handleSelectMobileMode = async (nextMode: MobileViewMode) => {
    const selectedOption = transitionModeOptions.find((option) => option.mode === nextMode);
    if (!selectedOption?.switchable) return;
    if (nextMode === activeMobileMode) {
      setModeModalOpen(false);
      return;
    }

    try {
      setModeSwitching(nextMode);
      setProfileEditor(null);
      setTrainingProfile(null);
      setMobileSettingsLoaded(false);
      const resp = await fetchJson<any>('/mobile/settings/mode', {
        method: 'PATCH',
        body: { mode: nextMode } as any,
      });
      const json = resp.json || {};
      if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      await auth?.applyAccountStatePayload?.(json);
      const resolvedMode =
        ['athlete', 'coach', 'individual'].includes(String(json?.user?.mobile_mode))
          ? (String(json.user.mobile_mode) as MobileViewMode)
          : ['athlete', 'coach', 'individual'].includes(String(json?.mode))
          ? (String(json.mode) as MobileViewMode)
          : nextMode;
      await saveMobileViewMode(resolvedMode);
      setMobileViewMode(resolvedMode);
      setModeModalOpen(false);
      loadAccountTransitionMetadata();
      router.replace(resolvedMode === 'coach' ? '/(tabs)/coach-dashboard' : '/(tabs)/athlete-dashboard');
    } catch (err: any) {
      Alert.alert('Mode not changed', err?.message || 'Please try again.');
    } finally {
      setModeSwitching(null);
    }
  };

  const submitFeedback = async () => {
    const title = feedbackDraft.title.trim();
    const body = feedbackDraft.body.trim();
    if (title.length < 4 || body.length < 10) {
      Alert.alert('Add a little more detail', 'Include a short title and a few details so we can understand the feedback.');
      return;
    }
    try {
      setFeedbackSubmitting(true);
      const resp = await fetchJson<any>('/mobile/feedback', {
        method: 'POST',
        body: {
          category: feedbackDraft.category,
          severity: feedbackDraft.severity,
          title,
          body,
          app_context: updateLabel,
          app_version: Updates.updateId || (__DEV__ ? 'dev' : 'embedded'),
          platform: Platform.OS,
          device_context: `${Platform.OS} ${Platform.Version || ''}`.trim(),
          page_context: 'mobile settings',
          metadata: {
            role,
            is_individual: isIndividual,
          },
        } as any,
      });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setFeedbackModalOpen(false);
      setFeedbackDraft({ category: 'bug', severity: 'medium', title: '', body: '' });
      Alert.alert('Thanks — your feedback was sent.', 'We’ll use it to keep Strength Ledger tighter.');
    } catch (err: any) {
      Alert.alert('Feedback not sent', err?.message || 'Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const profileEditorTitle =
    profileEditor === 'details'
      ? 'Edit Profile Details'
      : profileEditor === 'units'
      ? 'Units'
      : profileEditor === 'maxes'
      ? 'Edit Training Maxes'
      : profileEditor === 'context'
      ? 'Edit Training Context'
      : 'Edit Training Profile';

  const saveCurrentProfileEditor = () => {
    if (profileEditor === 'details') return saveProfileDetails();
    if (profileEditor === 'units') return savePreferredUnits();
    if (profileEditor === 'maxes') return saveTrainingMaxes();
    if (profileEditor === 'context') return saveTrainingContext();
  };

  const editorField = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    options?: { multiline?: boolean; keyboardType?: 'default' | 'numeric' | 'email-address'; placeholder?: string; readOnly?: boolean }
  ) => (
    <View style={styles.editorField}>
      <ThemedText style={styles.editorLabel}>{label}</ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={options?.placeholder || ''}
        placeholderTextColor={SLColors.textSubtle}
        keyboardType={options?.keyboardType || 'default'}
        autoCapitalize={options?.keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={options?.keyboardType !== 'email-address'}
        editable={!options?.readOnly && !profileSaving}
        multiline={options?.multiline}
        style={[styles.editorInput, options?.multiline && styles.editorTextArea, options?.readOnly && styles.editorInputReadonly]}
      />
    </View>
  );

  const editorChoice = (
    label: string,
    value: string,
    options: Array<{ label: string; value: string }>,
    onSelect: (value: string) => void
  ) => (
    <View style={styles.editorField}>
      <ThemedText style={styles.editorLabel}>{label}</ThemedText>
      <View style={styles.editorChoiceRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={({ pressed }) => [styles.editorChoice, selected && styles.editorChoiceSelected, pressed && styles.rowButtonPressed]}
              onPress={() => onSelect(option.value)}
              disabled={profileSaving}
            >
              <ThemedText style={[styles.editorChoiceText, selected && styles.editorChoiceTextSelected]}>{option.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const profileName =
    trainingProfile?.name ||
    auth?.user?.name ||
    auth?.profile?.name ||
    auth?.user?.email ||
    'Strength Ledger';
  const backendCurrentMode = ['athlete', 'coach', 'individual'].includes(String(accountTransitions?.current_mode || ''))
    ? (String(accountTransitions?.current_mode) as MobileViewMode)
    : null;
  const displayMobileMode = backendCurrentMode || activeMobileMode;
  const profileDescriptor =
    displayMobileMode === 'individual'
      ? 'Self-coached training'
      : displayMobileMode === 'coach'
      ? 'Coach account'
      : 'Athlete profile';
  const bodyweightSummary = formatProfileWeight(trainingProfile?.bodyweight) || 'Not set';
  const unitsSummary = trainingProfile ? profileUnits.toUpperCase() : 'Not set';
  const trainingStartSummary =
    trainingProfile?.context?.relationship_age_label ||
    trainingProfile?.context?.relationship_started_label ||
    'Not set';
  const squatMaxSummary = kgToDisplayValue(trainingProfile?.squat_tm, profileUnits) || '-';
  const benchMaxSummary = kgToDisplayValue(trainingProfile?.bench_tm, profileUnits) || '-';
  const deadliftMaxSummary = kgToDisplayValue(trainingProfile?.deadlift_tm, profileUnits) || '-';
  const trainingMaxTotalSummary = trainingProfile?.total_tm
    ? `T ${kgToDisplayValue(trainingProfile.total_tm, profileUnits)} ${profileUnits}`
    : null;
  const videoDataUseStatus =
    !mobileSettingsLoaded ? 'Not loaded' : videoMlTrainingConsent === true ? 'Allowed' : 'Not allowed';
  const coachName = linkCoachStatus?.coach?.name || linkCoachStatus?.coach?.email || null;
  const identityDescriptor =
    displayMobileMode === 'coach'
      ? 'Coach'
      : displayMobileMode === 'individual'
      ? 'Self-coached athlete'
      : coachName
      ? `Athlete · Coached by ${coachName}`
      : 'Athlete';
  const timezoneSummary = timezoneLoading
    ? 'Loading…'
    : String(timezone || '')
        .split('/')
        .pop()
        ?.replace(/_/g, ' ') || 'Not set';
  const notificationStatus = !mobileSettingsLoaded
    ? 'Not loaded'
    : (showVideoFeedbackNotifications && notifyVideoFeedback) ||
      (showVideoSubmissionNotifications && notifyVideoSubmissions)
    ? 'On'
    : 'Off';
  const accountAccessSummary = accountTransitionsLoading
    ? 'Loading…'
    : accountTransitionsError
    ? 'Status not loaded'
    : accountTransitions?.account_state
    ? accountAccessLabel(accountTransitions.account_state)
    : linkCoachAlreadyLinked
    ? 'Ready'
    : 'Not linked';
  const trainingContextSummary = profileContextRows.length === 1 ? '1 item' : `${profileContextRows.length} items`;
  const compactTrainingMaxSummary = trainingProfile?.total_tm
    ? `${kgToDisplayValue(trainingProfile.total_tm, profileUnits)} ${profileUnits} total`
    : [squatMaxSummary, benchMaxSummary, deadliftMaxSummary].some((value) => value !== '-')
    ? 'Configured'
    : 'Not set';

  const settingsRow = ({
    icon,
    title,
    description,
    summary,
    onPress,
    disabled,
    destructive,
    warning,
    accent = 'purple',
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description?: string;
    summary?: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    destructive?: boolean;
    warning?: boolean;
    accent?: SettingsAccent;
  }) => (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={summary ? `${title}, ${typeof summary === 'string' ? summary : ''}` : title}
      accessibilityHint={!onPress ? 'This setting is read only in the mobile app.' : undefined}
      style={({ pressed }) => [
        styles.settingsRow,
        destructive && styles.settingsRowDestructive,
        pressed && onPress && styles.rowButtonPressed,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      <View style={styles.settingsRowLeft}>
        <View
          style={[
            styles.settingsRowIcon,
            accent === 'amber' && styles.settingsRowIconAmber,
            accent === 'teal' && styles.settingsRowIconTeal,
            accent === 'neutral' && styles.settingsRowIconNeutral,
            destructive && styles.settingsRowIconDestructive,
            warning && styles.settingsRowIconWarning,
          ]}
        >
          <Ionicons
            name={icon}
            size={21}
            color={destructive ? SLColors.danger : warning ? SLColors.warning : settingsAccentColor[accent]}
          />
        </View>
        <View style={styles.settingsRowText}>
          <ThemedText typographyRole="bodyStrong" style={[styles.settingsRowTitle, destructive ? styles.settingsRowTitleDestructive : {}]}>
            {title}
          </ThemedText>
          {description ? (
            <ThemedText typographyRole="supportingBody" style={[styles.settingsRowDescription, destructive ? styles.settingsRowDescriptionDestructive : {}]}>
              {description}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={styles.settingsRowRight}>
        {typeof summary === 'string' ? (
          <ThemedText
            style={[
              styles.settingsRowSummary,
              accent === 'amber' ? styles.settingsRowSummaryAmber : {},
              accent === 'teal' ? styles.settingsRowSummaryTeal : {},
              accent === 'neutral' ? styles.settingsRowSummaryNeutral : {},
              destructive ? styles.settingsRowSummaryDestructive : {},
            ]}
            numberOfLines={2}
          >
            {summary}
          </ThemedText>
        ) : summary ? (
          <View style={styles.settingsRowCustomSummary}>{summary}</View>
        ) : null}
        {onPress ? <Ionicons name="chevron-forward" size={19} color={destructive ? SLColors.danger : SLColors.textSubtle} /> : null}
      </View>
    </Pressable>
  );

  const settingsGroup = (
    children: React.ReactNode,
    label?: string
  ) => (
    <View style={styles.settingsGroup}>
      {label ? <ThemedText style={styles.settingsGroupLabel}>{label}</ThemedText> : null}
      <View style={styles.settingsGroupRows}>{children}</View>
    </View>
  );

  const settingsToggleRow = ({
    label,
    description,
    value,
    disabled = false,
    onChange,
  }: {
    label: string;
    description?: string;
    value: boolean;
    disabled?: boolean;
    onChange: (nextValue: boolean) => void;
  }) => (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.settingsPanelToggleRow,
        pressed && !disabled && styles.settingsRowPressed,
        disabled && styles.settingsRowDisabled,
      ]}
    >
      <View style={styles.settingsPanelToggleCopy}>
        <ThemedText style={styles.settingsPanelToggleLabel}>{label}</ThemedText>
        {description ? <ThemedText style={styles.settingsPanelToggleDescription}>{description}</ThemedText> : null}
      </View>
      <View style={[styles.togglePill, value && styles.togglePillOn]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  );

  const settingsPanelTitle =
    settingsPanel === 'coach'
      ? 'Connected Coach'
      : settingsPanel === 'notifications'
        ? 'Notifications'
        : settingsPanel === 'privacy'
          ? 'Video Data Use'
          : settingsPanel === 'about'
              ? 'About'
              : settingsPanel === 'logout'
                ? 'Log Out'
                : '';

  const closeSettingsPanelThen = (action: () => void) => {
    setSettingsPanel(null);
    setTimeout(action, 220);
  };

  return (
    <SLScreen edges="none" padded={false} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {settingsNotice ? (
          <View style={styles.noticeBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={SLColors.warning} />
            <ThemedText style={styles.noticeText}>{settingsNotice}</ThemedText>
            <Pressable onPress={() => setSettingsNotice(null)} style={styles.noticeClose}>
              <Ionicons name="close" size={16} color={SLColors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${profileName}, ${identityDescriptor}`}
          accessibilityHint={hasTrainingProfile ? 'Opens profile settings.' : 'Profile editing is unavailable for this account.'}
          style={({ pressed }) => [styles.identityCard, pressed && hasTrainingProfile && styles.rowButtonPressed]}
          onPress={hasTrainingProfile ? () => openProfileEditor('details') : undefined}
          disabled={!hasTrainingProfile}
        >
          <SLProfileAvatar
            accessibilityLabel={`${profileName} profile photo`}
            name={profileName}
            profilePhotoUrl={auth.user?.profilePhotoUrl}
            profilePhotoVersion={auth.user?.profilePhotoVersion}
            size={70}
            borderRadius={35}
            style={styles.identityAvatar}
          />
          <View style={styles.identityCopy}>
            <ThemedText numberOfLines={2} style={styles.identityName}>{profileName}</ThemedText>
            <ThemedText numberOfLines={2} style={styles.identityDescriptor}>{identityDescriptor}</ThemedText>
          </View>
          {hasTrainingProfile ? <Ionicons name="chevron-forward" size={23} color={SLColors.textSubtle} /> : null}
        </Pressable>

        {settingsGroup(
          <>
            {settingsRow({
              icon: 'person-outline',
              title: 'Account Type',
              description: canOpenTeamCoachUpgrade
                ? teamCoachUpgradeDescription
                : canStartTeamCoachDowngrade
                ? teamCoachDowngradeDescription
                : undefined,
              summary: accountTransitionsLoading ? 'Loading…' : accountTypeTitle,
              onPress: canChangeAccountType ? openAccountTypeTransition : undefined,
            })}
            {settingsRow({
              icon: 'person-add-outline',
              title: 'Connected Coach',
              summary: linkCoachAlreadyLinked ? 'Linked' : 'Not linked',
              onPress: () => setSettingsPanel('coach'),
              accent: 'amber',
            })}
            {settingsRow({
              icon: 'shield-checkmark-outline',
              title: 'Account Access',
              summary: accountAccessSummary,
              accent: 'amber',
            })}
            {modeOptions.length > 1
              ? settingsRow({
                  icon: 'swap-horizontal-outline',
                  title: 'Mobile Mode',
                  summary: accountTransitionsLoading ? 'Loading…' : mobileModeSummary,
                  onPress: () => setModeModalOpen(true),
                })
              : null}
          </>
        , 'Account')}

        {settingsGroup(
          <>
            {settingsRow({
              icon: 'scale-outline',
              title: 'Units',
              summary: unitsSummary.toLowerCase(),
              onPress: trainingProfile ? () => openProfileEditor('units') : undefined,
            })}
            {settingsRow({
              icon: 'barbell-outline',
              title: 'Training Maxes',
              description: trainingMaxesManagedByCoach
                ? 'Managed by your coach'
                : !mobileSettingsLoaded
                ? 'Checking edit access…'
                : undefined,
              summary: compactTrainingMaxSummary,
              onPress: trainingProfile && canDirectEditTrainingMaxes ? () => openProfileEditor('maxes') : undefined,
            })}
            {settingsRow({
              icon: 'locate-outline',
              title: 'Training Context',
              summary: trainingContextSummary,
              onPress: trainingProfile ? () => openProfileEditor('context') : undefined,
              accent: 'amber',
            })}
            {settingsRow({
              icon: 'globe-outline',
              title: 'Timezone',
              summary: timezoneSummary,
              onPress: timezoneSaving || timezoneLoading ? undefined : () => setTimezoneModalOpen(true),
            })}
          </>
        , 'Training')}

        {settingsGroup(
          <>
            {showNotificationsSection
              ? settingsRow({
                  icon: 'notifications-outline',
                  title: 'Notifications',
                  summary: notificationLoading || timezoneLoading ? 'Loading…' : notificationStatus,
                  onPress: mobileSettingsLoaded ? () => setSettingsPanel('notifications') : undefined,
                })
              : null}
            {settingsRow({
              icon: 'lock-closed-outline',
              title: 'Video Data Use',
              summary: privacyLoading || timezoneLoading ? 'Loading…' : videoDataUseStatus,
              onPress: mobileSettingsLoaded ? () => setSettingsPanel('privacy') : undefined,
              accent: 'teal',
            })}
          </>
        , 'Notifications & Privacy')}

        {settingsGroup(
          <>
            {settingsRow({
              icon: 'chatbubble-ellipses-outline',
              title: 'Send Feedback',
              onPress: () => setFeedbackModalOpen(true),
              accent: 'neutral',
            })}
            {settingsRow({
              icon: 'information-circle-outline',
              title: 'About',
              onPress: () => setSettingsPanel('about'),
              accent: 'neutral',
            })}
          </>
        , 'Support')}

        {canAccessAccessoryCatalogReview(auth.user)
          ? settingsGroup(
              settingsRow({
                icon: 'albums-outline',
                title: 'Accessory Catalog Review',
                description: 'Review canonical movement taxonomy',
                summary: `${ACCESSORY_REVIEW_CATALOG.total_movements} movements`,
                onPress: () => router.push('/(tabs)/accessory-catalog-review' as any),
              }),
              'Catalog Review'
            )
          : null}

        {settingsGroup(
          <>
            {settingsRow({
              icon: 'log-out-outline',
              title: loggingOut ? 'Logging Out…' : 'Log Out',
              onPress: loggingOut ? undefined : () => setSettingsPanel('logout'),
              warning: true,
              accent: 'neutral',
            })}
            {settingsRow({
              icon: 'trash-outline',
              title: 'Delete Account',
              onPress: () => {
                setDeleteConfirmEmail('');
                setDeleteModalOpen(true);
              },
              destructive: true,
              accent: 'neutral',
            })}
          </>
        , 'Account Actions')}
      </ScrollView>

      <Modal
        visible={settingsPanel !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSettingsPanel(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, styles.settingsPanelSheet]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <ThemedText style={styles.modalTitle}>{settingsPanelTitle}</ThemedText>
                <ThemedText style={styles.modalSubtitle}>Settings</ThemedText>
              </View>
              <Pressable
                accessibilityLabel="Close settings"
                accessibilityRole="button"
                disabled={notificationLoading || privacyLoading || loggingOut}
                hitSlop={12}
                onPress={() => setSettingsPanel(null)}
                style={({ pressed }) => [styles.modalClose, pressed && styles.settingsRowPressed]}
              >
                <Ionicons color={SLColors.textSecondary} name="close" size={22} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.settingsPanelContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {settingsPanel === 'coach' ? (
                <>
                  <View style={styles.settingsPanelIdentity}>
                    <View style={[styles.settingsRowIcon, styles.settingsRowIconAmber]}>
                      <Ionicons color={settingsAccentColor.amber} name="person-add-outline" size={23} />
                    </View>
                    <View style={styles.settingsPanelIdentityCopy}>
                      <ThemedText style={styles.settingsPanelIdentityTitle}>{coachName || 'No coach connected'}</ThemedText>
                      <ThemedText style={styles.settingsPanelIdentityCaption}>
                        {linkCoachAlreadyLinked
                          ? 'Your active coaching relationship controls shared training access.'
                          : 'Connect through the existing secure account-linking flow.'}
                      </ThemedText>
                    </View>
                  </View>
                  {linkCoachAlreadyLinked ? (
                    <View style={styles.editorInfoCard}>
                      <ThemedText style={styles.editorInfoText}>
                        This relationship is managed by the account and relationship system. It is read-only here.
                      </ThemedText>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => closeSettingsPanelThen(handleLinkCoach)}
                      style={({ pressed }) => [styles.primaryButton, pressed && styles.settingsRowPressed]}
                    >
                      <ThemedText style={styles.primaryButtonText}>Connect a coach</ThemedText>
                    </Pressable>
                  )}
                </>
              ) : null}

              {settingsPanel === 'notifications' ? (
                <>
                  {showVideoFeedbackNotifications
                    ? settingsToggleRow({
                        label: 'Video feedback',
                        description: 'Notify me when feedback is added to one of my videos.',
                        value: notifyVideoFeedback,
                        disabled: notificationLoading,
                        onChange: (nextValue) =>
                          void saveNotificationPreference('notify_video_feedback', nextValue),
                      })
                    : null}
                  {showVideoSubmissionNotifications
                    ? settingsToggleRow({
                        label: 'Video submissions',
                        description: 'Notify me when an athlete submits a video for review.',
                        value: notifyVideoSubmissions,
                        disabled: notificationLoading,
                        onChange: (nextValue) =>
                          void saveNotificationPreference('notify_video_submissions', nextValue),
                      })
                    : null}
                </>
              ) : null}

              {settingsPanel === 'privacy' ? (
                <>
                  {settingsToggleRow({
                    label: 'Video model training',
                    description: 'Allow eligible training videos to improve Strength Ledger video models.',
                    value: videoMlTrainingConsent === true,
                    disabled: privacyLoading,
                    onChange: (nextValue) => void saveVideoMlTrainingConsent(nextValue),
                  })}
                  <View style={styles.editorInfoCard}>
                    <ThemedText style={styles.editorInfoText}>
                      Video visibility still follows the account and relationship authorization rules. This setting
                      controls model-training consent only.
                    </ThemedText>
                  </View>
                </>
              ) : null}

              {settingsPanel === 'about' ? (
                <View style={styles.settingsPanelAbout}>
                  <View style={styles.settingsPanelAboutRow}>
                    <ThemedText style={styles.settingsPanelAboutLabel}>Environment</ThemedText>
                    <ThemedText style={styles.settingsPanelAboutValue}>Development</ThemedText>
                  </View>
                  <View style={styles.settingsPanelAboutRow}>
                    <ThemedText style={styles.settingsPanelAboutLabel}>Update</ThemedText>
                    <ThemedText style={styles.settingsPanelAboutValue}>{updateLabel}</ThemedText>
                  </View>
                  <View style={styles.settingsPanelAboutRow}>
                    <ThemedText style={styles.settingsPanelAboutLabel}>Platform</ThemedText>
                    <ThemedText style={styles.settingsPanelAboutValue}>
                      {Platform.OS} {String(Platform.Version)}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {settingsPanel === 'logout' ? (
                <>
                  <View style={styles.editorInfoCard}>
                    <ThemedText style={styles.editorInfoText}>
                      You will need to sign in again to access this account on this device.
                    </ThemedText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={loggingOut}
                    onPress={() => void handleLogout()}
                    style={({ pressed }) => [styles.dangerButton, pressed && styles.settingsRowPressed]}
                  >
                    <ThemedText style={styles.dangerButtonText}>{loggingOut ? 'Logging Out…' : 'Log Out'}</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={loggingOut}
                    onPress={() => setSettingsPanel(null)}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.settingsRowPressed]}
                  >
                    <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

        {profileEditor !== null && (profileEditor !== 'maxes' || canDirectEditTrainingMaxes) ? (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setProfileEditor(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.profileEditorSheet}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <ThemedText style={styles.modalTitle}>{profileEditorTitle}</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.modalSubtitle}>
                    Changes save to the same training profile used on web.
                  </ThemedText>
                </View>
                <Pressable style={styles.modalClose} onPress={() => setProfileEditor(null)} disabled={profileSaving}>
                  <Ionicons name="close" size={22} color={SLColors.text} />
                </Pressable>
              </View>

              {profileError ? (
                <View style={styles.editorError}>
                  <Ionicons name="alert-circle-outline" size={18} color={SLColors.danger} />
                  <ThemedText style={styles.editorErrorText}>{profileError}</ThemedText>
                </View>
              ) : null}

              <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
                {profileEditor === 'details' ? (
                  <>
                    <View style={styles.profileEditorIdentity}>
                      <SLProfileAvatar
                        accessibilityLabel={`${profileName} profile photo`}
                        name={profileName}
                        profilePhotoUrl={auth.user?.profilePhotoUrl}
                        profilePhotoVersion={auth.user?.profilePhotoVersion}
                        size={68}
                        borderRadius={34}
                      />
                      <View style={styles.profileEditorIdentityCopy}>
                        <ThemedText style={styles.profileEditorIdentityTitle}>Profile photo</ThemedText>
                        <ThemedText style={styles.profileEditorIdentityCaption}>
                          Used anywhere your identity appears.
                        </ThemedText>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.profilePhotoAction, pressed && styles.rowButtonPressed]}
                        onPress={handleUpdateAvatar}
                        disabled={uploadingAvatar}
                      >
                        {uploadingAvatar ? <ActivityIndicator size="small" color={SLColors.accentViolet} /> : null}
                        <ThemedText style={styles.profilePhotoActionText}>
                          {uploadingAvatar ? 'Updating…' : auth.user?.profilePhotoUrl ? 'Manage' : 'Add'}
                        </ThemedText>
                      </Pressable>
                    </View>
                    {editorField('Name', detailsDraft.name, (value) => setDetailsDraft((draft) => ({ ...draft, name: value })))}
                    {editorField('Email', detailsDraft.email, () => {}, { readOnly: true, keyboardType: 'email-address' })}
                    {editorChoice('Sex', detailsDraft.sex, [{ label: 'M', value: 'M' }, { label: 'F', value: 'F' }], (value) => setDetailsDraft((draft) => ({ ...draft, sex: value })))}
                    {editorField(`Bodyweight (${normalizeUnits(detailsDraft.preferredUnits)})`, detailsDraft.bodyweight, (value) => setDetailsDraft((draft) => ({ ...draft, bodyweight: value })), { keyboardType: 'numeric' })}
                    {editorField('Federation', detailsDraft.federation, (value) => setDetailsDraft((draft) => ({ ...draft, federation: value })))}
                    {editorField('Weight Class', detailsDraft.weightClass, (value) => setDetailsDraft((draft) => ({ ...draft, weightClass: value })))}
                  </>
                ) : null}

                {profileEditor === 'units' ? (
                  <>
                    {editorChoice(
                      'Preferred Units',
                      detailsDraft.preferredUnits,
                      [{ label: 'kg', value: 'kg' }, { label: 'lbs', value: 'lbs' }],
                      (value) => setDetailsDraft((draft) => ({ ...draft, preferredUnits: value })),
                    )}
                    <View style={styles.editorInfoCard}>
                      <Ionicons name="information-circle-outline" size={19} color={SLColors.textMuted} />
                      <ThemedText style={styles.editorInfoText}>
                        Units change how weights are displayed. Canonical training data remains stored in kilograms.
                      </ThemedText>
                    </View>
                  </>
                ) : null}

                {profileEditor === 'maxes' ? (
                  <>
                    {editorField(`Squat TM (${profileUnits})`, maxesDraft.squat_tm, (value) => setMaxesDraft((draft) => ({ ...draft, squat_tm: value })), { keyboardType: 'numeric' })}
                    {editorField(`Bench TM (${profileUnits})`, maxesDraft.bench_tm, (value) => setMaxesDraft((draft) => ({ ...draft, bench_tm: value })), { keyboardType: 'numeric' })}
                    {editorField(`Deadlift TM (${profileUnits})`, maxesDraft.deadlift_tm, (value) => setMaxesDraft((draft) => ({ ...draft, deadlift_tm: value })), { keyboardType: 'numeric' })}
                  </>
                ) : null}

                {profileEditor === 'context' ? (
                  <>
                    {editorField('Training Profile Started', contextDraft.relationship_started_at, (value) => setContextDraft((draft) => ({ ...draft, relationship_started_at: value })), { placeholder: 'YYYY-MM-DD' })}
                    {editorField('Equipment Access', contextDraft.equipment_access, (value) => setContextDraft((draft) => ({ ...draft, equipment_access: value })), { multiline: true })}
                    {editorField('Injury Notes', contextDraft.injury_notes, (value) => setContextDraft((draft) => ({ ...draft, injury_notes: value })), { multiline: true })}
                    {editorField('Mobility Limitations', contextDraft.mobility_limitations, (value) => setContextDraft((draft) => ({ ...draft, mobility_limitations: value })), { multiline: true })}
                    {editorField('Movement Cues', contextDraft.preferred_cues, (value) => setContextDraft((draft) => ({ ...draft, preferred_cues: value })), { multiline: true })}
                  </>
                ) : null}
              </ScrollView>

              <View style={styles.editorActions}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, styles.editorActionButton, pressed && styles.rowButtonPressed]}
                  onPress={() => setProfileEditor(null)}
                  disabled={profileSaving}
                >
                  <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, styles.editorActionButton, pressed && styles.primaryButtonPressed]}
                  onPress={saveCurrentProfileEditor}
                  disabled={profileSaving}
                >
                  {profileSaving ? <ActivityIndicator color={SLColors.textStrong} /> : <Ionicons name="checkmark" size={18} color={SLColors.textStrong} />}
                  <ThemedText style={styles.primaryButtonText}>{profileSaving ? 'Saving...' : 'Apply Changes'}</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        ) : null}

        <Modal visible={feedbackModalOpen} animationType="slide" transparent onRequestClose={() => setFeedbackModalOpen(false)}>
          <KeyboardAvoidingView
            style={styles.keyboardModalRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <Pressable style={[styles.modalBackdrop, styles.feedbackModalBackdrop]} onPress={Keyboard.dismiss}>
              <Pressable
                style={[styles.modalSheet, styles.feedbackModalSheet, { height: feedbackModalHeight }]}
                onPress={(event) => event.stopPropagation()}
              >
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <ThemedText style={styles.modalTitle}>Send Feedback</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.modalSubtitle}>
                    Report a bug, request a feature, or share what would make Strength Ledger better.
                  </ThemedText>
                </View>
                <Pressable style={styles.modalClose} onPress={() => setFeedbackModalOpen(false)} disabled={feedbackSubmitting}>
                  <Ionicons name="close" size={22} color={SLColors.text} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={[styles.editorContent, styles.feedbackEditorContent]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                <View style={styles.editorField}>
                  <ThemedText style={styles.editorLabel}>Category</ThemedText>
                  <View style={styles.editorChoiceRow}>
                    {[
                      { label: 'Bug', value: 'bug' },
                      { label: 'Feature', value: 'feature_request' },
                      { label: 'General', value: 'general_feedback' },
                    ].map((option) => {
                      const selected = feedbackDraft.category === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={({ pressed }) => [styles.editorChoice, selected && styles.editorChoiceSelected, pressed && styles.rowButtonPressed]}
                          onPress={() => setFeedbackDraft((draft) => ({ ...draft, category: option.value as any }))}
                          disabled={feedbackSubmitting}
                        >
                          <ThemedText style={[styles.editorChoiceText, selected && styles.editorChoiceTextSelected]}>{option.label}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.editorField}>
                  <ThemedText style={styles.editorLabel}>Severity</ThemedText>
                  <View style={styles.editorChoiceRow}>
                    {['low', 'medium', 'high', 'critical'].map((value) => {
                      const selected = feedbackDraft.severity === value;
                      return (
                        <Pressable
                          key={value}
                          style={({ pressed }) => [styles.editorChoice, selected && styles.editorChoiceSelected, pressed && styles.rowButtonPressed]}
                          onPress={() => setFeedbackDraft((draft) => ({ ...draft, severity: value as any }))}
                          disabled={feedbackSubmitting}
                        >
                          <ThemedText style={[styles.editorChoiceText, selected && styles.editorChoiceTextSelected]}>{value}</ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {editorField('Title', feedbackDraft.title, (value) => setFeedbackDraft((draft) => ({ ...draft, title: value })), {
                  placeholder: 'Short summary',
                })}
                {editorField('Details', feedbackDraft.body, (value) => setFeedbackDraft((draft) => ({ ...draft, body: value })), {
                  multiline: true,
                  placeholder: 'What happened? What would help?',
                })}
              </ScrollView>

              {/* P0 mobile invariant: keyboard must never cover composer/action rows. */}
              <View style={styles.editorActions}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, styles.editorActionButton, pressed && styles.rowButtonPressed]}
                  onPress={() => setFeedbackModalOpen(false)}
                  disabled={feedbackSubmitting}
                >
                  <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, styles.editorActionButton, pressed && styles.primaryButtonPressed]}
                  onPress={submitFeedback}
                  disabled={feedbackSubmitting}
                >
                  {feedbackSubmitting ? <ActivityIndicator color={SLColors.textStrong} /> : <Ionicons name="send-outline" size={18} color={SLColors.textStrong} />}
                  <ThemedText style={styles.primaryButtonText}>{feedbackSubmitting ? 'Sending...' : 'Send Feedback'}</ThemedText>
                </Pressable>
              </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={modeModalOpen} animationType="slide" transparent onRequestClose={() => setModeModalOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setModeModalOpen(false)}>
            <Pressable style={[styles.modalSheet, styles.modeModalSheet]} onPress={(event) => event.stopPropagation()}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <ThemedText style={styles.modalTitle}>Switch mobile mode</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.modalSubtitle}>
                    Choose which Strength Ledger workspace this device should open.
                  </ThemedText>
                </View>
                <Pressable style={styles.modalClose} onPress={() => setModeModalOpen(false)} disabled={modeSwitching !== null}>
                  <Ionicons name="close" size={22} color={SLColors.text} />
                </Pressable>
              </View>

              <View style={styles.modeOptionList}>
                {accountTransitions ? (
                  <View style={styles.modeMetadataCard}>
                    <ThemedText style={styles.modeMetadataTitle}>{accountTypeTitle}</ThemedText>
                    <ThemedText style={styles.modeMetadataDescription}>
                      {accountAccessLabel(accountTransitions.account_state)}
                      {accountActionLabel(accountTransitions.next_action)
                        ? ` · ${accountActionLabel(accountTransitions.next_action)}`
                        : ''}
                    </ThemedText>
                  </View>
                ) : accountTransitionsError ? (
                  <View style={[styles.modeMetadataCard, styles.modeMetadataCardWarning]}>
                    <ThemedText style={styles.modeMetadataTitle}>Account access could not be loaded</ThemedText>
                    <ThemedText style={styles.modeMetadataDescription}>{accountTransitionsError}</ThemedText>
                  </View>
                ) : null}
                {modeOptions.map((option) => {
                  const selected = option.mode === activeMobileMode;
                  const switching = modeSwitching === option.mode;
                  const blocked = !option.switchable;
                  const reason = accountRestrictionLabel(option.reason);
                  const nextAction = accountActionLabel(option.nextAction);
                  return (
                    <Pressable
                      key={option.mode}
                      style={({ pressed }) => [
                        styles.modeOption,
                        selected && styles.modeOptionSelected,
                        blocked && styles.modeOptionBlocked,
                        pressed && !switching && !blocked && styles.rowButtonPressed,
                      ]}
                      onPress={() => handleSelectMobileMode(option.mode)}
                      disabled={modeSwitching !== null || blocked}
                    >
                      <View style={[styles.modeOptionIcon, selected && styles.modeOptionIconSelected, blocked && styles.modeOptionIconBlocked]}>
                        {switching ? (
                          <ActivityIndicator color={SLColors.accentViolet} />
                        ) : (
                          <Ionicons
                            name={option.icon}
                            size={21}
                            color={blocked ? SLColors.textSubtle : selected ? SLColors.textStrong : SLColors.accentViolet}
                          />
                        )}
                      </View>
                      <View style={styles.rowTextWrap}>
                        <ThemedText style={[styles.modeOptionTitle, blocked && styles.modeOptionTitleBlocked]}>{option.label}</ThemedText>
                        <ThemedText style={styles.modeOptionDescription}>{option.description}</ThemedText>
                        {blocked ? (
                          <ThemedText style={styles.modeOptionReason}>
                            {reason || 'Not available for this account'}
                            {nextAction ? ` · ${nextAction}` : ''}
                          </ThemedText>
                        ) : null}
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={22} color={SLColors.success} />
                      ) : blocked ? (
                        <Ionicons name="lock-closed-outline" size={20} color={SLColors.textSubtle} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={upgradeModalOpen} animationType="slide" transparent onRequestClose={() => setUpgradeModalOpen(false)}>
          <KeyboardAvoidingView
            style={styles.keyboardModalRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <Pressable style={styles.modalBackdrop} onPress={Keyboard.dismiss}>
              <Pressable style={[styles.modalSheet, styles.upgradeModalSheet]} onPress={(event) => event.stopPropagation()}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleWrap}>
                    <ThemedText style={styles.modalTitle}>Become a Team Coach</ThemedText>
                    <ThemedText variant="bodyMuted" style={styles.modalSubtitle}>
                      Activate Founder Beta access with your code.
                    </ThemedText>
                  </View>
                  <Pressable style={styles.modalClose} onPress={() => setUpgradeModalOpen(false)} disabled={upgradeSubmitting}>
                    <Ionicons name="close" size={22} color={SLColors.text} />
                  </Pressable>
                </View>

                <ScrollView style={styles.upgradeModalScroll} contentContainerStyle={styles.upgradeModalContent} keyboardShouldPersistTaps="handled">
                  <View style={styles.upgradePlanHero}>
                    <View style={styles.upgradePlanEyebrowRow}>
                      <ThemedText style={styles.upgradePlanEyebrow}>Founder Beta Team Coach</ThemedText>
                      <View style={styles.upgradePlanBadge}>
                        <ThemedText style={styles.upgradePlanBadgeText}>Beta code</ThemedText>
                      </View>
                    </View>
                    <View style={styles.upgradePriceRow}>
                      <ThemedText style={styles.upgradePrice}>$10/mo</ThemedText>
                      <ThemedText style={styles.upgradePriceMeta}>after 14-day trial</ThemedText>
                    </View>
                    <ThemedText style={styles.upgradeHeroDescription}>
                      Unlimited athletes for approved founding beta coaches.
                    </ThemedText>
                  </View>

                  <View style={styles.upgradeBenefitList}>
                    {[
                      ['people-outline', 'Roster, programming, check-ins, and coach dashboard'],
                      ['videocam-outline', 'Video review, messages, and athlete feedback'],
                      ['shield-checkmark-outline', 'Same account and Athlete identity stay preserved'],
                    ].map(([icon, text]) => (
                      <View style={styles.upgradeBenefitRow} key={text}>
                        <View style={styles.upgradeBenefitIcon}>
                          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={17} color={SLColors.accent} />
                        </View>
                        <ThemedText style={styles.upgradeBenefitText}>{text}</ThemedText>
                      </View>
                    ))}
                  </View>

                  <ThemedText style={styles.upgradeBillingNote}>
                    Membership activates securely through Stripe. Your account, Athlete identity, history, and linked coach relationship stay intact.
                  </ThemedText>

                  {upgradeError ? (
                    <View style={styles.editorError}>
                      <Ionicons name="alert-circle-outline" size={18} color={SLColors.danger} />
                      <ThemedText style={styles.editorErrorText}>{upgradeError}</ThemedText>
                    </View>
                  ) : null}

                  <View style={styles.upgradeCodeField}>
                    <ThemedText style={styles.upgradeCodeLabel}>Founder beta access code</ThemedText>
                    <View style={styles.searchWrap}>
                      <Ionicons name="key-outline" size={18} color={SLColors.textMuted} />
                      <TextInput
                        value={upgradeBetaCode}
                        onChangeText={(value) => {
                          setUpgradeBetaCode(value);
                          if (upgradeError) setUpgradeError(null);
                        }}
                        placeholder="Enter beta code"
                        placeholderTextColor={SLColors.textSubtle}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        style={styles.searchInput}
                        editable={!upgradeSubmitting}
                      />
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.deleteActions}>
                  <Pressable
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.rowButtonPressed]}
                    onPress={() => setUpgradeModalOpen(false)}
                    disabled={upgradeSubmitting}
                  >
                    <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                    onPress={submitTeamCoachUpgrade}
                    disabled={upgradeSubmitting}
                  >
                    {upgradeSubmitting ? <ActivityIndicator color={SLColors.textStrong} /> : <Ionicons name="rocket-outline" size={18} color={SLColors.textStrong} />}
                    <ThemedText style={styles.primaryButtonText}>
                      {upgradeSubmitting ? 'Activating...' : 'Activate Team Coach Beta'}
                    </ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={downgradeModalOpen} animationType="slide" transparent onRequestClose={() => setDowngradeModalOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => (!downgradeSubmitting ? setDowngradeModalOpen(false) : null)}>
            <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <ThemedText style={styles.modalTitle}>
                    {pendingTeamCoachUpgrade ? 'Cancel Team Coach upgrade' : 'Return to Athlete'}
                  </ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.modalSubtitle}>
                    {pendingTeamCoachUpgrade
                      ? 'This cancels the incomplete unpaid upgrade and restores Athlete account access.'
                      : 'This cancels your coaching subscription and removes Team Coach access.'}
                  </ThemedText>
                </View>
                <Pressable style={styles.modalClose} onPress={() => setDowngradeModalOpen(false)} disabled={downgradeSubmitting}>
                  <Ionicons name="close" size={22} color={SLColors.text} />
                </Pressable>
              </View>

              <View style={[styles.modeMetadataCard, styles.modeMetadataCardWarning]}>
                <ThemedText style={styles.modeMetadataTitle}>Before you continue</ThemedText>
                <ThemedText style={styles.modeMetadataDescription}>
                  {pendingTeamCoachUpgrade
                    ? 'No active subscription will be cancelled. Your reserved founder code is released, while your same Athlete identity, history, and linked coach relationship remain.'
                    : 'This is available only after any athletes you coach are resolved from your roster. Your same account, Athlete identity, Training Sessions, history, videos, check-ins, and linked coach relationship remain. Stripe cancellation is confirmed before coach tools are removed.'}
                </ThemedText>
              </View>

              {downgradeError ? (
                <View style={styles.editorError}>
                  <Ionicons name="alert-circle-outline" size={18} color={SLColors.danger} />
                  <ThemedText style={styles.editorErrorText}>{downgradeError}</ThemedText>
                </View>
              ) : null}

              <View style={styles.deleteActions}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.rowButtonPressed]}
                  onPress={() => setDowngradeModalOpen(false)}
                  disabled={downgradeSubmitting}
                >
                  <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.rowButtonPressed]}
                  onPress={submitTeamCoachDowngrade}
                  disabled={downgradeSubmitting}
                >
                  {downgradeSubmitting ? <ActivityIndicator color={SLColors.textStrong} /> : <Ionicons name="person-outline" size={18} color={SLColors.textStrong} />}
                  <ThemedText style={styles.dangerButtonText}>
                    {downgradeSubmitting
                      ? pendingTeamCoachUpgrade
                        ? 'Cancelling upgrade...'
                        : 'Cancelling subscription...'
                      : pendingTeamCoachUpgrade
                      ? 'Cancel Upgrade & Return'
                      : 'Cancel Subscription & Return'}
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={timezoneModalOpen} animationType="slide" transparent onRequestClose={() => setTimezoneModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View>
                  <ThemedText style={styles.modalTitle}>Choose timezone</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.modalSubtitle}>Search any supported IANA timezone.</ThemedText>
                </View>
                <Pressable style={styles.modalClose} onPress={() => setTimezoneModalOpen(false)}>
                  <Ionicons name="close" size={22} color={SLColors.text} />
                </Pressable>
              </View>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={SLColors.textMuted} />
                <TextInput
                  value={timezoneSearch}
                  onChangeText={setTimezoneSearch}
                  placeholder="Search Manila, Philippines, Sydney..."
                  placeholderTextColor={SLColors.textSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.searchInput}
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.timezoneDeviceButton, pressed && styles.rowButtonPressed]}
                onPress={() => saveTimezone(null)}
                disabled={timezoneSaving}
              >
                {timezoneSaving ? (
                  <ActivityIndicator color={SLColors.accentViolet} />
                ) : (
                  <Ionicons name="phone-portrait-outline" size={18} color={SLColors.accentViolet} />
                )}
                <View style={styles.rowTextWrap}>
                  <ThemedText style={styles.timezoneDeviceTitle}>Use device timezone</ThemedText>
                  <ThemedText style={styles.timezoneDeviceSubtitle}>
                    {deviceTimezone || 'Use the timezone reported by this device'}
                  </ThemedText>
                </View>
                {timezoneSource === 'device' ? <Ionicons name="checkmark-circle" size={20} color={SLColors.success} /> : null}
              </Pressable>
              <FlatList
                data={filteredTimezones}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                style={styles.timezoneList}
                renderItem={({ item }) => {
                  const selected = item === timezone && timezoneSource === 'manual';
                  return (
                    <Pressable
                      style={({ pressed }) => [styles.timezoneOption, selected && styles.timezoneOptionSelected, pressed && styles.rowButtonPressed]}
                      onPress={() => saveTimezone(item)}
                      disabled={timezoneSaving}
                    >
                      <View style={styles.rowTextWrap}>
                        <ThemedText style={styles.timezoneOptionText}>{item}</ThemedText>
                        {TIMEZONE_ALIASES[item] ? (
                          <ThemedText variant="bodyMuted" style={styles.timezoneOptionSub}>{TIMEZONE_ALIASES[item]}</ThemedText>
                        ) : null}
                      </View>
                      {selected ? <Ionicons name="checkmark-circle" size={20} color={SLColors.success} /> : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        </Modal>
        <Modal visible={deleteModalOpen} animationType="slide" transparent onRequestClose={() => setDeleteModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <ThemedText style={styles.modalTitle}>Delete Account</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.modalSubtitle}>
                    This permanently deletes your account and related Strength Ledger data. This cannot be undone.
                  </ThemedText>
                </View>
                <Pressable style={styles.modalClose} onPress={() => setDeleteModalOpen(false)} disabled={deletingAccount}>
                  <Ionicons name="close" size={22} color={SLColors.text} />
                </Pressable>
              </View>
              <View style={styles.deleteWarning}>
                <Ionicons name="warning-outline" size={20} color={SLColors.danger} />
                <ThemedText style={styles.deleteWarningText}>
                  Type {auth?.user?.email || 'your email'} to confirm permanent deletion.
                </ThemedText>
              </View>
              <View style={styles.searchWrap}>
                <Ionicons name="mail-outline" size={18} color={SLColors.textMuted} />
                <TextInput
                  value={deleteConfirmEmail}
                  onChangeText={setDeleteConfirmEmail}
                  placeholder={auth?.user?.email || 'email@example.com'}
                  placeholderTextColor={SLColors.textSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={styles.searchInput}
                  editable={!deletingAccount}
                />
              </View>
              <View style={styles.deleteActions}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.rowButtonPressed]}
                  onPress={() => setDeleteModalOpen(false)}
                  disabled={deletingAccount}
                >
                  <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerButtonPressed]}
                  onPress={handleConfirmDeleteAccount}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? <ActivityIndicator color={SLColors.textStrong} /> : <Ionicons name="trash-outline" size={18} color={SLColors.textStrong} />}
                  <ThemedText style={styles.dangerButtonText}>
                    {deletingAccount ? 'Deleting...' : 'Delete Account'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
    </SLScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: 12,
    paddingBottom: 24,
  },
  scrollContent: {
    paddingBottom: 36,
    gap: 18,
  },
  headerSubtitle: {
    marginTop: 6,
    color: SLColors.textMuted,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 21,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
    fontSize: SLTypography.label.fontSize,
    color: SLColors.textMuted,
  },
  profileHeroCard: {
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    backgroundColor: 'rgba(20,17,31,0.72)',
    overflow: 'hidden',
    ...SLShadows.raised,
  },
  profileHeroTop: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrap: {
    width: 58,
    height: 58,
  },
  avatarCircle: {
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.38)',
    backgroundColor: 'rgba(126,101,255,0.22)',
  },
  avatarPhotoButton: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 25,
    height: 25,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(205,194,176,0.34)',
    backgroundColor: 'rgba(10,9,15,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileHeroName: {
    color: SLColors.textStrong,
    fontSize: SLTypography.screenTitle.fontSize,
    lineHeight: 29,
    fontWeight: '900',
  },
  profileHeroMode: {
    marginTop: 3,
    color: SLColors.accentViolet,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '800',
  },
  profileEditHeroButton: {
    minHeight: 34,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
  },
  profileEditHeroText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  profileHeroStats: {
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: SLColors.shellHairline,
    backgroundColor: 'rgba(7,8,13,0.24)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileHeroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  profileHeroStatDivider: {
    width: 1,
    height: 34,
    backgroundColor: SLColors.shellHairline,
  },
  profileHeroStatLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  profileHeroStatValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
    textAlign: 'center',
  },
  settingsGroup: {
    gap: 8,
  },
  settingsGroupLabel: {
    marginLeft: 16,
    color: SLColors.textMuted,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 21,
    fontWeight: '700',
  },
  identityCard: {
    minHeight: 112,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.065)',
    backgroundColor: 'rgba(28,28,30,0.92)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    overflow: 'hidden',
  },
  identityAvatar: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  identityName: {
    color: SLColors.textStrong,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
  identityDescriptor: {
    color: SLColors.textMuted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  settingsGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  settingsGroupIcon: {
    width: 30,
    height: 30,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
    backgroundColor: 'rgba(126,101,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsGroupIconAmber: {
    borderColor: 'rgba(214,167,94,0.24)',
    backgroundColor: 'rgba(214,167,94,0.10)',
  },
  settingsGroupIconTeal: {
    borderColor: 'rgba(77,214,199,0.22)',
    backgroundColor: 'rgba(77,214,199,0.09)',
  },
  settingsGroupIconNeutral: {
    borderColor: 'rgba(205,194,176,0.16)',
    backgroundColor: 'rgba(205,194,176,0.055)',
  },
  settingsGroupTitle: {
    flexShrink: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  settingsGroupRows: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(28,28,30,0.92)',
    overflow: 'hidden',
  },
  settingsRow: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.075)',
  },
  settingsRowPressed: {
    opacity: 0.82,
  },
  settingsRowDisabled: {
    opacity: 0.58,
  },
  settingsRowDestructive: {
    backgroundColor: 'rgba(239,68,68,0.035)',
  },
  settingsRowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsRowIcon: {
    width: 44,
    height: 44,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(194,146,255,0.42)',
    backgroundColor: 'rgba(126,58,220,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowIconAmber: {
    borderColor: 'rgba(255,204,74,0.44)',
    backgroundColor: 'rgba(215,150,20,0.78)',
  },
  settingsRowIconTeal: {
    borderColor: 'rgba(111,223,231,0.42)',
    backgroundColor: 'rgba(42,132,142,0.78)',
  },
  settingsRowIconNeutral: {
    borderColor: 'rgba(242,89,181,0.34)',
    backgroundColor: 'rgba(147,25,105,0.70)',
  },
  settingsRowIconWarning: {
    borderColor: 'rgba(245,158,11,0.24)',
    backgroundColor: 'rgba(245,158,11,0.10)',
  },
  settingsRowIconDestructive: {
    borderColor: 'rgba(239,68,68,0.26)',
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  settingsRowText: {
    flex: 1,
    minWidth: 0,
  },
  settingsRowTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '800',
  },
  settingsRowTitleDestructive: {
    color: SLColors.textStrong,
  },
  settingsRowDescription: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '600',
  },
  settingsRowDescriptionDestructive: {
    color: SLColors.danger,
  },
  settingsRowRight: {
    maxWidth: 142,
    minWidth: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  settingsRowSummary: {
    color: SLColors.textMuted,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'right',
  },
  settingsRowCustomSummary: {
    alignItems: 'flex-end',
    maxWidth: 142,
  },
  settingsRowSummaryAmber: {
    color: SLColors.textMuted,
  },
  settingsRowSummaryTeal: {
    color: SLColors.textMuted,
  },
  settingsRowSummaryNeutral: {
    color: SLColors.textMuted,
  },
  settingsRowSummaryDestructive: {
    color: SLColors.danger,
  },
  trainingMaxSummary: {
    alignItems: 'flex-end',
    gap: 3,
  },
  trainingMaxLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trainingMaxPart: {
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 16,
    fontWeight: '900',
  },
  trainingMaxSquat: {
    color: SLColors.textMuted,
  },
  trainingMaxBench: {
    color: SLColors.textMuted,
  },
  trainingMaxDeadlift: {
    color: SLColors.textMuted,
  },
  trainingMaxDot: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  trainingMaxTotal: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  section: {
    backgroundColor: SLColors.surfaceEmbedded,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.shellHairline,
    overflow: 'hidden',
  },
  sectionHeaderRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: SLTypography.sectionTitle.fontFamily,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '700',
    color: SLColors.textStrong,
  },
  rowButton: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: SLColors.shellHairline,
    backgroundColor: 'transparent',
  },
  rowButtonPressed: {
    backgroundColor: 'rgba(205,194,176,0.045)',
  },
  timezoneDescription: {
    marginTop: 8,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 18,
  },
  timezoneStatus: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: 'rgba(10,11,11,0.20)',
    overflow: 'hidden',
  },
  modeStatus: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: 'rgba(126,101,255,0.075)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileSummary: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderRadius: SLRadius.radiusCard,
    borderColor: SLColors.borderHairline,
    backgroundColor: 'rgba(16,14,23,0.58)',
    overflow: 'hidden',
  },
  profileCardHeader: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.shellHairline,
  },
  profileCardTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
  },
  profileCardSubtitle: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
  },
  profileEditButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: 'rgba(126,101,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileEditText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  profileSummaryRow: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLColors.shellHairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileSummaryLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  profileSummaryValue: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    textAlign: 'right',
  },
  profileEmptyState: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  profileEmptyTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  profileEmptyCopy: {
    marginTop: 4,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 18,
  },
  noticeBanner: {
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.28)',
    backgroundColor: 'rgba(245,158,11,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeText: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '700',
  },
  noticeClose: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timezoneStatusRow: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: SLColors.shellHairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  timezoneLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timezoneValue: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
    textAlign: 'right',
  },
  modeValue: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '900',
    textAlign: 'right',
  },
  timezoneActions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: 'rgba(126,101,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: SLRadius.radiusControl,
    backgroundColor: 'rgba(109,40,217,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: SLRadius.radiusRow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  linkCoachIconWrap: {
    backgroundColor: 'rgba(126,101,255,0.08)',
    borderColor: 'rgba(167,139,250,0.18)',
  },
  logoutIconWrap: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.24)',
  },
  deleteIconWrap: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderColor: 'rgba(239,68,68,0.24)',
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
  },
  rowSubtitle: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
  },
  togglePill: {
    width: 48,
    height: 28,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: 'rgba(10,11,11,0.35)',
    padding: 3,
    justifyContent: 'center',
  },
  togglePillOn: {
    borderColor: SLColors.borderSelected,
    backgroundColor: 'rgba(126,101,255,0.30)',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: SLRadius.radiusSharp,
    backgroundColor: SLColors.textMuted,
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
    backgroundColor: SLColors.textStrong,
  },
  footer: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.caption.fontSize,
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,2,3,0.58)',
    justifyContent: 'flex-end',
  },
  keyboardModalRoot: {
    flex: 1,
  },
  modalSheet: {
    maxHeight: '82%',
    minHeight: '62%',
    borderTopLeftRadius: SLRadius.radiusCard,
    borderTopRightRadius: SLRadius.radiusCard,
    backgroundColor: 'rgba(9,10,11,0.88)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 22,
  },
  settingsPanelSheet: {
    minHeight: 0,
    maxHeight: '72%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(28,28,30,0.98)',
  },
  settingsPanelContent: {
    paddingBottom: 8,
    gap: 12,
  },
  settingsPanelIdentity: {
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(12,12,14,0.52)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsPanelIdentityCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingsPanelIdentityTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 21,
    fontWeight: '800',
  },
  settingsPanelIdentityCaption: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 18,
    fontWeight: '600',
  },
  settingsPanelToggleRow: {
    minHeight: 72,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(12,12,14,0.52)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  settingsPanelToggleCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingsPanelToggleLabel: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 21,
    fontWeight: '800',
  },
  settingsPanelToggleDescription: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 18,
    fontWeight: '600',
  },
  settingsPanelAbout: {
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(12,12,14,0.52)',
    overflow: 'hidden',
  },
  settingsPanelAboutRow: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsPanelAboutLabel: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
  },
  settingsPanelAboutValue: {
    flex: 1,
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
    textAlign: 'right',
  },
  feedbackModalSheet: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    borderRadius: SLRadius.radiusCard,
    paddingBottom: 12,
  },
  feedbackModalBackdrop: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  modeModalSheet: {
    minHeight: 0,
    maxHeight: '58%',
    backgroundColor: 'rgba(9,10,13,0.96)',
  },
  upgradeModalSheet: {
    minHeight: 0,
    maxHeight: '86%',
    backgroundColor: 'rgba(8,9,12,0.97)',
  },
  profileEditorSheet: {
    maxHeight: '88%',
    minHeight: '70%',
    borderTopLeftRadius: SLRadius.radiusCard,
    borderTopRightRadius: SLRadius.radiusCard,
    backgroundColor: 'rgba(9,10,13,0.94)',
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 22,
  },
  profileEditorIdentity: {
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(28,28,30,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileEditorIdentityCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileEditorIdentityTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 21,
    fontWeight: '800',
  },
  profileEditorIdentityCaption: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '600',
  },
  profilePhotoAction: {
    minHeight: 36,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: 'rgba(126,101,255,0.12)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profilePhotoActionText: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  modalTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: SLColors.textStrong,
    fontSize: 21,
    fontWeight: '900',
  },
  modalSubtitle: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: SLRadius.radiusControl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(205,194,176,0.07)',
  },
  modeOptionList: {
    gap: 10,
    paddingBottom: 4,
  },
  modeOption: {
    minHeight: 78,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: 'rgba(4,6,9,0.42)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeOptionSelected: {
    borderColor: SLColors.borderSelected,
    backgroundColor: 'rgba(126,101,255,0.18)',
  },
  modeOptionBlocked: {
    opacity: 0.68,
    backgroundColor: 'rgba(4,6,9,0.26)',
  },
  modeOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.20)',
    backgroundColor: 'rgba(126,101,255,0.11)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOptionIconSelected: {
    borderColor: 'rgba(167,139,250,0.48)',
    backgroundColor: 'rgba(126,101,255,0.28)',
  },
  modeOptionIconBlocked: {
    borderColor: 'rgba(205,194,176,0.12)',
    backgroundColor: 'rgba(205,194,176,0.045)',
  },
  modeOptionTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    lineHeight: 20,
    fontWeight: '900',
  },
  modeOptionTitleBlocked: {
    color: SLColors.textMuted,
  },
  modeOptionDescription: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '600',
  },
  modeOptionReason: {
    marginTop: 5,
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    lineHeight: 15,
    fontWeight: '800',
  },
  modeMetadataCard: {
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.16)',
    backgroundColor: 'rgba(126,101,255,0.075)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 3,
  },
  modeMetadataCardWarning: {
    borderColor: 'rgba(245,158,11,0.20)',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  modeMetadataTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  modeMetadataDescription: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '600',
  },
  upgradeModalScroll: {
    flexGrow: 0,
  },
  upgradeModalContent: {
    gap: 12,
    paddingBottom: 4,
  },
  upgradePlanHero: {
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.30)',
    backgroundColor: 'rgba(126,101,255,0.13)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  upgradePlanEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  upgradePlanEyebrow: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  upgradePlanBadge: {
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(51,211,190,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(51,211,190,0.28)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  upgradePlanBadgeText: {
    color: SLColors.accent,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
  },
  upgradePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 10,
  },
  upgradePrice: {
    color: SLColors.textStrong,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
  },
  upgradePriceMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '800',
  },
  upgradeHeroDescription: {
    marginTop: 5,
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontWeight: '700',
  },
  upgradeBenefitList: {
    gap: 8,
  },
  upgradeBenefitRow: {
    minHeight: 48,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: 'rgba(4,6,9,0.38)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  upgradeBenefitIcon: {
    width: 32,
    height: 32,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(51,211,190,0.10)',
  },
  upgradeBenefitText: {
    flex: 1,
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    fontWeight: '800',
  },
  upgradeBillingNote: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '600',
  },
  upgradeCodeField: {
    gap: 7,
  },
  upgradeCodeLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  searchWrap: {
    minHeight: 46,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: 'rgba(10,11,11,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    minHeight: 42,
  },
  timezoneDeviceButton: {
    minHeight: 60,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderSelected,
    backgroundColor: 'rgba(126,101,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timezoneDeviceTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  timezoneDeviceSubtitle: {
    marginTop: 2,
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 16,
  },
  editorScroll: {
    flex: 1,
  },
  editorContent: {
    paddingBottom: 16,
    gap: 12,
  },
  feedbackEditorContent: {
    paddingBottom: 28,
    flexGrow: 1,
  },
  editorField: {
    gap: 7,
  },
  editorInfoCard: {
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(12,12,14,0.52)',
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  editorInfoText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 20,
    fontWeight: '600',
  },
  editorLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  editorInput: {
    minHeight: 48,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: 'rgba(4,6,9,0.58)',
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editorInputReadonly: {
    color: SLColors.textMuted,
    backgroundColor: 'rgba(205,194,176,0.045)',
  },
  editorTextArea: {
    minHeight: 104,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  editorChoiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editorChoice: {
    flex: 1,
    minHeight: 44,
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: SLColors.borderHairline,
    backgroundColor: 'rgba(4,6,9,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorChoiceSelected: {
    borderColor: SLColors.borderSelected,
    backgroundColor: 'rgba(126,101,255,0.22)',
  },
  editorChoiceText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  editorChoiceTextSelected: {
    color: SLColors.textStrong,
  },
  editorError: {
    borderRadius: SLRadius.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
    backgroundColor: 'rgba(239,68,68,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  editorErrorText: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    lineHeight: 17,
    fontWeight: '700',
  },
  editorActions: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SLColors.shellHairline,
    flexDirection: 'row',
    gap: 10,
  },
  editorActionButton: {
    flex: 1,
  },
  deleteWarning: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
    backgroundColor: 'rgba(239,68,68,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  deleteWarningText: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 19,
    fontWeight: '700',
  },
  deleteActions: {
    gap: 10,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: SLRadius.radiusControl,
    backgroundColor: SLColors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerButtonPressed: {
    opacity: 0.88,
  },
  dangerButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
  timezoneList: {
    flex: 1,
  },
  timezoneOption: {
    minHeight: 58,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: SLColors.shellHairline,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timezoneOptionSelected: {
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  timezoneOptionText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '800',
  },
  timezoneOptionSub: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
  },
});
