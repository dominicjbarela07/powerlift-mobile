import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';

import { ThemedText } from '@/components/themed-text';
import { SLScreen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import { API_BASE, WEB_BASE, deleteAccountRequest, fetchJson, getDeviceTimezone, getResolvedTimezone, setManualTimezonePreference } from '@/lib/api';
import { getMobileViewMode, saveMobileViewMode, type MobileViewMode } from '@/lib/mobileViewMode';

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

type ProfileEditor = 'details' | 'maxes' | 'context' | null;

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

type SettingsAccent = 'purple' | 'amber' | 'teal' | 'neutral';

const settingsAccentColor: Record<SettingsAccent, string> = {
  purple: SLColors.accentViolet,
  amber: '#D6A75E',
  teal: '#4DD6C7',
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
  const auth = useAuth() as any;
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [timezone, setTimezone] = useState<string>(getDeviceTimezone() || 'America/Los_Angeles');
  const [timezoneSource, setTimezoneSource] = useState<'manual' | 'device' | 'fallback'>('device');
  const [timezoneLoading, setTimezoneLoading] = useState(false);
  const [timezoneSaving, setTimezoneSaving] = useState(false);
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
  const hasTrainingProfile = role === 'athlete' || isIndividual;
  const showVideoFeedbackNotifications = role === 'athlete' && !isIndividual;
  const showVideoSubmissionNotifications = isCoach && !isIndividual;
  const showNotificationsSection = showVideoFeedbackNotifications || showVideoSubmissionNotifications;

  const profileUnits = useMemo(() => normalizeUnits(trainingProfile?.preferred_units || trainingProfile?.context?.preferred_units), [trainingProfile]);

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
      setMobileViewMode('athlete');
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
      const resp = await fetchJson<any>('/mobile/settings', { method: 'GET' });
      const json = resp.json || {};
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      setNotifyVideoFeedback(json.notify_video_feedback !== false);
      setNotifyVideoSubmissions(json.notify_video_submissions !== false);
      setVideoMlTrainingConsent(
        typeof json.video_ml_training_consent === 'boolean'
          ? json.video_ml_training_consent
          : null
      );
      setTrainingProfile(json.training_profile || null);
      if (hasTrainingProfile) {
        setTimezone(json.timezone || deviceTimezone || 'America/Los_Angeles');
        setTimezoneSource(json.timezone_source || 'device');
        await setManualTimezonePreference(json.timezone_source === 'manual' ? json.timezone : null);
      }
    } catch (err) {
      console.warn('Failed to load mobile settings', err);
      setTrainingProfile(null);
      setTimezone(deviceTimezone || 'America/Los_Angeles');
      setTimezoneSource(deviceTimezone ? 'device' : 'fallback');
    } finally {
      setTimezoneLoading(false);
    }
  }, [deviceTimezone, hasTrainingProfile]);

  useEffect(() => {
    loadMobileSettings();
  }, [loadMobileSettings]);

  const openProfileEditor = (editor: Exclude<ProfileEditor, null>) => {
    if (!trainingProfile) return;
    const units = normalizeUnits(trainingProfile.preferred_units || trainingProfile.context?.preferred_units);
    setProfileError(null);
    setSettingsNotice(null);
    if (editor === 'details') {
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
    if (json?.training_profile) setTrainingProfile(json.training_profile);
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
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
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

  const handleUpdateAvatar = async () => {
    if (!hasTrainingProfile) return;

    const apiUrl = String(API_BASE || '').replace(/\/$/, '');
    const token = auth?.token;

    if (!apiUrl) {
      Alert.alert('Upload unavailable', 'Missing API connection. Please restart the app and try again.');
      return;
    }

    if (!token) {
      Alert.alert('Upload unavailable', 'Your session token was not available for upload. Please log out and back in.');
      return;
    }

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

      const resp = await fetch(`${apiUrl}/mobile/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Timezone': await getResolvedTimezone(),
        },
        body: formData,
      });

      const json = await resp.json();

      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || 'Upload failed');
      }

      Alert.alert('Success', 'Profile photo updated');
    } catch (err) {
      console.error('Avatar upload failed', err);
      Alert.alert('Upload failed', 'Please try again');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);

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

  const handleDeleteAccount = async () => {
    const deleteUrl = `${String(WEB_BASE || '').replace(/\/$/, '')}/auth/account/delete`;
    try {
      await WebBrowser.openBrowserAsync(deleteUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      });
      Alert.alert(
        'Delete Account',
        'If the delete page asked you to sign in or did not complete, use the in-app confirmation to permanently delete this account.',
        [
          { text: 'Done', style: 'cancel' },
          { text: 'Use in-app confirmation', style: 'destructive', onPress: () => setDeleteModalOpen(true) },
        ]
      );
    } catch {
      setDeleteModalOpen(true);
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

  const handleSwitchMobileMode = async () => {
    if (!isCoach || isIndividual) return;

    const nextMode: MobileViewMode = mobileViewMode === 'coach' ? 'athlete' : 'coach';
    try {
      await saveMobileViewMode(nextMode);
      setMobileViewMode(nextMode);
      router.replace(nextMode === 'coach' ? '/coach-dashboard' : '/(tabs)/athlete-dashboard');
    } catch (err: any) {
      Alert.alert('Mode not changed', err?.message || 'Please try again.');
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
      : profileEditor === 'maxes'
      ? 'Edit Training Maxes'
      : profileEditor === 'context'
      ? 'Edit Training Context'
      : 'Edit Training Profile';

  const saveCurrentProfileEditor = () => {
    if (profileEditor === 'details') return saveProfileDetails();
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
  const nameParts = String(profileName).trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.length >= 2
    ? `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase()
    : String(profileName).replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'SL';
  const accountModeLabel = isIndividual ? 'Self-Coached' : isCoach ? 'Coach' : 'Athlete';
  const profileDescriptor = isIndividual
    ? 'Self-coached training'
    : isCoach
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
  const videoPrivacyStatus =
    videoMlTrainingConsent === true ? 'Enabled' : videoMlTrainingConsent === false ? 'Disabled' : 'Private';

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
    description: string;
    summary?: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
    destructive?: boolean;
    warning?: boolean;
    accent?: SettingsAccent;
  }) => (
    <Pressable
      style={({ pressed }) => [
        styles.settingsRow,
        destructive && styles.settingsRowDestructive,
        pressed && styles.rowButtonPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
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
          <ThemedText style={[styles.settingsRowTitle, destructive ? styles.settingsRowTitleDestructive : {}]}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.settingsRowDescription, destructive ? styles.settingsRowDescriptionDestructive : {}]}>
            {description}
          </ThemedText>
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
        <Ionicons name="chevron-forward" size={19} color={destructive ? SLColors.danger : SLColors.textSubtle} />
      </View>
    </Pressable>
  );

  const settingsGroup = (
    title: string,
    icon: keyof typeof Ionicons.glyphMap,
    children: React.ReactNode,
    accent: SettingsAccent = 'purple'
  ) => (
    <View style={styles.settingsGroup}>
      <View style={styles.settingsGroupHeader}>
        <View
          style={[
            styles.settingsGroupIcon,
            accent === 'amber' && styles.settingsGroupIconAmber,
            accent === 'teal' && styles.settingsGroupIconTeal,
            accent === 'neutral' && styles.settingsGroupIconNeutral,
          ]}
        >
          <Ionicons name={icon} size={19} color={settingsAccentColor[accent]} />
        </View>
        <ThemedText style={styles.settingsGroupTitle}>{title}</ThemedText>
      </View>
      <View style={styles.settingsGroupRows}>{children}</View>
    </View>
  );

  return (
    <SLScreen edges="none" padded={false} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText variant="h1" style={styles.title}>
              Settings
            </ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              Manage your profile, training setup, and preferences.
            </ThemedText>
          </View>

          {settingsNotice ? (
            <View style={styles.noticeBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={SLColors.warning} />
              <ThemedText style={styles.noticeText}>{settingsNotice}</ThemedText>
              <Pressable onPress={() => setSettingsNotice(null)} style={styles.noticeClose}>
                <Ionicons name="close" size={16} color={SLColors.textMuted} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.profileHeroCard}>
            <View style={styles.profileHeroTop}>
              <View style={styles.avatarCircle}>
                <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
                {hasTrainingProfile ? (
                  <Pressable
                    style={styles.avatarPhotoButton}
                    onPress={handleUpdateAvatar}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? (
                      <ActivityIndicator size="small" color={SLColors.textStrong} />
                    ) : (
                      <Ionicons name="camera-outline" size={15} color={SLColors.textStrong} />
                    )}
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.profileHeroCopy}>
                <ThemedText style={styles.profileHeroName}>
                  {profileName}
                </ThemedText>
                <ThemedText style={styles.profileHeroMode}>{profileDescriptor}</ThemedText>
              </View>
              {hasTrainingProfile && trainingProfile ? (
                <Pressable
                  style={({ pressed }) => [styles.profileEditHeroButton, pressed && styles.rowButtonPressed]}
                  onPress={() => openProfileEditor('details')}
                >
                  <ThemedText style={styles.profileEditHeroText}>Edit</ThemedText>
                  <Ionicons name="arrow-forward" size={15} color={SLColors.accentViolet} />
                </Pressable>
              ) : null}
            </View>
            {trainingProfile ? (
              <View style={styles.profileHeroStats}>
                <View style={styles.profileHeroStat}>
                  <ThemedText style={styles.profileHeroStatLabel}>Bodyweight</ThemedText>
                  <ThemedText style={styles.profileHeroStatValue}>{bodyweightSummary}</ThemedText>
                </View>
                <View style={styles.profileHeroStatDivider} />
                <View style={styles.profileHeroStat}>
                  <ThemedText style={styles.profileHeroStatLabel}>Units</ThemedText>
                  <ThemedText style={styles.profileHeroStatValue}>{unitsSummary}</ThemedText>
                </View>
                <View style={styles.profileHeroStatDivider} />
                <View style={styles.profileHeroStat}>
                  <ThemedText style={styles.profileHeroStatLabel}>Experience</ThemedText>
                  <ThemedText style={styles.profileHeroStatValue}>{trainingStartSummary}</ThemedText>
                </View>
              </View>
            ) : (
              <View style={styles.profileHeroStats}>
                <View style={styles.profileHeroStat}>
                  <ThemedText style={styles.profileHeroStatLabel}>Account</ThemedText>
                  <ThemedText style={styles.profileHeroStatValue}>{accountModeLabel}</ThemedText>
                </View>
                <View style={styles.profileHeroStatDivider} />
                <View style={styles.profileHeroStat}>
                  <ThemedText style={styles.profileHeroStatLabel}>Email</ThemedText>
                  <ThemedText style={styles.profileHeroStatValue} numberOfLines={1}>
                    {auth?.user?.email || 'Not set'}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>

          {settingsGroup(
            'Feedback',
            'chatbubble-ellipses-outline',
            <>
              {settingsRow({
                icon: 'chatbubble-ellipses-outline',
                title: 'Send Feedback',
                description: 'Report a bug, request a feature, or share feedback',
                onPress: () => setFeedbackModalOpen(true),
                accent: 'purple',
              })}
            </>,
            'purple'
          )}

          {settingsGroup(
            'Account & Profile',
            'person-circle-outline',
            <>
              {hasTrainingProfile && trainingProfile
                ? settingsRow({
                    icon: 'person-outline',
                    title: 'My Training Profile',
                    description: 'Profile details and personal information',
                    onPress: () => openProfileEditor('details'),
                  })
                : null}
              {hasTrainingProfile
                ? settingsRow({
                    icon: 'image-outline',
                    title: uploadingAvatar ? 'Uploading photo...' : 'Profile Photo',
                    description: 'Update your training profile photo',
                    onPress: handleUpdateAvatar,
                    disabled: uploadingAvatar,
                  })
                : null}
              {isCoach && !isIndividual
                ? settingsRow({
                    icon: 'swap-horizontal-outline',
                    title: 'Mobile Mode',
                    description: 'Switch between coach and athlete mobile views',
                    summary: mobileViewMode === 'coach' ? 'Coach' : 'Athlete',
                    onPress: handleSwitchMobileMode,
                  })
                : null}
              {role === 'athlete' && !isIndividual
                ? settingsRow({
                    icon: 'link-outline',
                    title: 'Link coach',
                    description: 'Connect your account to a coach',
                    onPress: handleLinkCoach,
                  })
                : null}
            </>
          )}

          {hasTrainingProfile
            ? settingsGroup(
                'Training Setup',
                'barbell-outline',
                <>
                  {trainingProfile
                    ? settingsRow({
                        icon: 'barbell-outline',
                        title: 'Training Maxes',
                        description: 'Squat, bench, deadlift, and total',
                        summary: (
                          <View style={styles.trainingMaxSummary}>
                            <View style={styles.trainingMaxLine}>
                              <ThemedText style={[styles.trainingMaxPart, styles.trainingMaxSquat]}>S {squatMaxSummary}</ThemedText>
                              <ThemedText style={styles.trainingMaxDot}>·</ThemedText>
                              <ThemedText style={[styles.trainingMaxPart, styles.trainingMaxBench]}>B {benchMaxSummary}</ThemedText>
                              <ThemedText style={styles.trainingMaxDot}>·</ThemedText>
                              <ThemedText style={[styles.trainingMaxPart, styles.trainingMaxDeadlift]}>D {deadliftMaxSummary}</ThemedText>
                            </View>
                            {trainingMaxTotalSummary ? (
                              <ThemedText style={styles.trainingMaxTotal}>{trainingMaxTotalSummary}</ThemedText>
                            ) : null}
                          </View>
                        ),
                        onPress: () => openProfileEditor('maxes'),
                        accent: 'amber',
                      })
                    : null}
                  {trainingProfile
                    ? settingsRow({
                        icon: 'clipboard-outline',
                        title: 'Training Context',
                        description: 'Equipment, limitations, cues, and notes',
                        summary: profileContextRows.length ? `${profileContextRows.length} items` : 'Not set',
                        onPress: () => openProfileEditor('context'),
                        accent: 'amber',
                      })
                    : null}
                  {settingsRow({
                    icon: 'time-outline',
                    title: 'Training Timezone',
                    description: 'Used for workouts and calendar dates',
                    summary: timezoneLoading ? 'Loading...' : `${timezone}\n${timezoneSourceLabel}`,
                    onPress: () => setTimezoneModalOpen(true),
                    disabled: timezoneSaving || timezoneLoading,
                    accent: 'amber',
                  })}
                </>,
                'amber'
              )
            : null}

          {settingsGroup(
            'Privacy',
            'shield-checkmark-outline',
            <>
              {settingsRow({
                icon: 'shield-checkmark-outline',
                title: 'Video Privacy',
                description: isIndividual ? 'Your videos stay private to you' : 'Manage how your videos are used',
                summary: videoPrivacyStatus,
                onPress: () => saveVideoMlTrainingConsent(videoMlTrainingConsent !== true),
                disabled: privacyLoading,
                accent: 'teal',
              })}
              {showVideoFeedbackNotifications
                ? settingsRow({
                    icon: 'chatbox-ellipses-outline',
                    title: 'Video feedback notifications',
                    description: 'When your coach reviews a set video',
                    summary: notifyVideoFeedback ? 'On' : 'Off',
                    onPress: () => saveNotificationPreference('notify_video_feedback', !notifyVideoFeedback),
                    disabled: notificationLoading,
                    accent: 'teal',
                  })
                : null}
              {showVideoSubmissionNotifications
                ? settingsRow({
                    icon: 'videocam-outline',
                    title: 'Video submission notifications',
                    description: 'When an athlete submits a set video',
                    summary: notifyVideoSubmissions ? 'On' : 'Off',
                    onPress: () => saveNotificationPreference('notify_video_submissions', !notifyVideoSubmissions),
                    disabled: notificationLoading,
                    accent: 'teal',
                  })
                : null}
            </>,
            'teal'
          )}

          {settingsGroup(
            'Account',
            'settings-outline',
            <>
              {settingsRow({
                icon: 'log-out-outline',
                title: loggingOut ? 'Logging out...' : 'Log out',
                description: 'End your current session',
                onPress: handleLogout,
                disabled: loggingOut,
                warning: true,
                accent: 'neutral',
              })}
              {settingsRow({
                icon: 'trash-outline',
                title: 'Delete Account',
                description: 'Permanently delete your account and data',
                onPress: handleDeleteAccount,
                destructive: true,
                accent: 'neutral',
              })}
            </>,
            'neutral'
          )}
          <View style={styles.footer}>
            <ThemedText variant="bodyMuted" style={styles.footerText}>
              {updateLabel}
            </ThemedText>
          </View>
        </ScrollView>

        <Modal visible={profileEditor !== null} animationType="slide" transparent onRequestClose={() => setProfileEditor(null)}>
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
                    {editorField('Name', detailsDraft.name, (value) => setDetailsDraft((draft) => ({ ...draft, name: value })))}
                    {editorField('Email', detailsDraft.email, () => {}, { readOnly: true, keyboardType: 'email-address' })}
                    {editorChoice('Sex', detailsDraft.sex, [{ label: 'M', value: 'M' }, { label: 'F', value: 'F' }], (value) => setDetailsDraft((draft) => ({ ...draft, sex: value })))}
                    {editorChoice('Preferred Units', detailsDraft.preferredUnits, [{ label: 'kg', value: 'kg' }, { label: 'lbs', value: 'lbs' }], (value) => {
                      const oldUnits = normalizeUnits(detailsDraft.preferredUnits);
                      const rawKg = displayValueToKg(detailsDraft.bodyweight, oldUnits);
                      setDetailsDraft((draft) => ({
                        ...draft,
                        preferredUnits: value,
                        bodyweight: kgToDisplayValue(rawKg, normalizeUnits(value)),
                      }));
                    })}
                    {editorField(`Bodyweight (${normalizeUnits(detailsDraft.preferredUnits)})`, detailsDraft.bodyweight, (value) => setDetailsDraft((draft) => ({ ...draft, bodyweight: value })), { keyboardType: 'numeric' })}
                    {editorField('Federation', detailsDraft.federation, (value) => setDetailsDraft((draft) => ({ ...draft, federation: value })))}
                    {editorField('Weight Class', detailsDraft.weightClass, (value) => setDetailsDraft((draft) => ({ ...draft, weightClass: value })))}
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

        <Modal visible={feedbackModalOpen} animationType="slide" transparent onRequestClose={() => setFeedbackModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
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

              <ScrollView style={styles.editorScroll} contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
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
            </View>
          </View>
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
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 24,
  },
  scrollContent: {
    paddingBottom: 28,
    gap: 14,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontFamily: SLTypography.title.fontFamily,
    fontSize: SLTypography.title.fontSize,
    lineHeight: SLTypography.title.lineHeight,
    fontWeight: '800',
    color: SLColors.textStrong,
    letterSpacing: 0,
  },
  headerSubtitle: {
    marginTop: 6,
    color: SLColors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: SLColors.textMuted,
  },
  profileHeroCard: {
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
    backgroundColor: 'rgba(20,17,31,0.72)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  profileHeroTop: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.38)',
    backgroundColor: 'rgba(126,101,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: SLColors.accentViolet,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  avatarPhotoButton: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 25,
    height: 25,
    borderRadius: 13,
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
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
  },
  profileHeroMode: {
    marginTop: 3,
    color: SLColors.accentViolet,
    fontSize: 15,
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
    fontSize: 13,
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
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  profileHeroStatValue: {
    color: SLColors.textStrong,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  settingsGroup: {
    gap: 9,
    marginTop: 12,
  },
  settingsGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  settingsGroupIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    color: SLColors.textStrong,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  settingsGroupRows: {
    borderRadius: SLRadius.radiusCard,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.20)',
    backgroundColor: 'rgba(18,16,27,0.62)',
    overflow: 'hidden',
  },
  settingsRow: {
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SLColors.shellHairline,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
    backgroundColor: 'rgba(126,101,255,0.11)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowIconAmber: {
    borderColor: 'rgba(214,167,94,0.22)',
    backgroundColor: 'rgba(214,167,94,0.085)',
  },
  settingsRowIconTeal: {
    borderColor: 'rgba(77,214,199,0.20)',
    backgroundColor: 'rgba(77,214,199,0.075)',
  },
  settingsRowIconNeutral: {
    borderColor: 'rgba(205,194,176,0.14)',
    backgroundColor: 'rgba(205,194,176,0.045)',
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
    fontSize: 16,
    fontWeight: '800',
  },
  settingsRowTitleDestructive: {
    color: SLColors.textStrong,
  },
  settingsRowDescription: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: 12,
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
    color: SLColors.accentViolet,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  settingsRowCustomSummary: {
    alignItems: 'flex-end',
    maxWidth: 142,
  },
  settingsRowSummaryAmber: {
    color: '#D6A75E',
  },
  settingsRowSummaryTeal: {
    color: '#4DD6C7',
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  trainingMaxSquat: {
    color: SLColors.accentViolet,
  },
  trainingMaxBench: {
    color: '#4DD6C7',
  },
  trainingMaxDeadlift: {
    color: '#D6A75E',
  },
  trainingMaxDot: {
    color: SLColors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
  },
  trainingMaxTotal: {
    color: '#D6A75E',
    fontSize: 12,
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
    fontSize: 12,
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
    borderLeftWidth: 3,
    borderLeftColor: SLColors.railViolet,
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
    fontSize: 16,
    fontWeight: '900',
  },
  profileCardSubtitle: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  profileSummaryValue: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  profileEmptyState: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  profileEmptyTitle: {
    color: SLColors.textStrong,
    fontSize: 14,
    fontWeight: '900',
  },
  profileEmptyCopy: {
    marginTop: 4,
    color: SLColors.textMuted,
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  timezoneValue: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  modeValue: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: 15,
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
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '700',
  },
  rowSubtitle: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: 12,
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
    fontSize: 12,
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,2,3,0.58)',
    justifyContent: 'flex-end',
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
    fontSize: 12,
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: SLRadius.radiusControl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(205,194,176,0.07)',
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
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '900',
  },
  timezoneDeviceSubtitle: {
    marginTop: 2,
    color: SLColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  editorScroll: {
    flex: 1,
  },
  editorContent: {
    paddingBottom: 16,
    gap: 12,
  },
  editorField: {
    gap: 7,
  },
  editorLabel: {
    color: SLColors.textMuted,
    fontSize: 12,
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
    fontSize: 15,
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
    fontSize: 13,
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
    fontSize: 12,
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
    fontSize: 13,
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
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '800',
  },
  timezoneOptionSub: {
    marginTop: 3,
    color: SLColors.textMuted,
    fontSize: 11,
  },
});
