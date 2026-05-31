import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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

import { ThemedText } from '@/components/themed-text';
import { SLScreen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';
import { API_BASE, fetchJson, getDeviceTimezone, getResolvedTimezone, setManualTimezonePreference } from '@/lib/api';
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
  const [notifyVideoFeedback, setNotifyVideoFeedback] = useState(true);
  const [notifyVideoSubmissions, setNotifyVideoSubmissions] = useState(true);
  const [videoMlTrainingConsent, setVideoMlTrainingConsent] = useState<boolean | null>(null);
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

  useEffect(() => {
    let mounted = true;

    getMobileViewMode(isCoach).then((mode) => {
      if (mounted) setMobileViewMode(mode);
    });

    return () => {
      mounted = false;
    };
  }, [isCoach, auth?.user?.email]);

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
      if (role === 'athlete') {
        setTimezone(json.timezone || deviceTimezone || 'America/Los_Angeles');
        setTimezoneSource(json.timezone_source || 'device');
        await setManualTimezonePreference(json.timezone_source === 'manual' ? json.timezone : null);
      }
    } catch (err) {
      console.warn('Failed to load mobile settings', err);
      setTimezone(deviceTimezone || 'America/Los_Angeles');
      setTimezoneSource(deviceTimezone ? 'device' : 'fallback');
    } finally {
      setTimezoneLoading(false);
    }
  }, [deviceTimezone, role]);

  useEffect(() => {
    loadMobileSettings();
  }, [loadMobileSettings]);

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
      Alert.alert('Timezone not saved', err?.message || 'Please choose a valid timezone and try again.');
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
    if (role !== 'athlete') return;

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

  const handleSwitchMobileMode = async () => {
    if (!isCoach) return;

    const nextMode: MobileViewMode = mobileViewMode === 'coach' ? 'athlete' : 'coach';
    try {
      await saveMobileViewMode(nextMode);
      setMobileViewMode(nextMode);
      router.replace(nextMode === 'coach' ? '/coach-dashboard' : '/(tabs)/athlete-dashboard');
    } catch (err: any) {
      Alert.alert('Mode not changed', err?.message || 'Please try again.');
    }
  };

  return (
    <SLScreen edges="none" padded={false} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText variant="h1" style={styles.title}>
              Settings
            </ThemedText>
          </View>

          {isCoach && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionIconWrap}>
                    <Ionicons name="swap-horizontal-outline" size={22} color={SLColors.accentViolet} />
                  </View>
                  <ThemedText variant="h3" style={styles.sectionTitle}>
                    Mobile Mode
                  </ThemedText>
                </View>
                <ThemedText variant="bodyMuted" style={styles.timezoneDescription}>Coach or athlete view on this device.</ThemedText>
              </View>

              <View style={styles.modeStatus}>
                <ThemedText style={styles.timezoneLabel}>Current Mode</ThemedText>
                <ThemedText style={styles.modeValue}>
                  {mobileViewMode === 'coach' ? 'Coach Mode' : 'Athlete Mode'}
                </ThemedText>
              </View>

              <View style={styles.timezoneActions}>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                  onPress={handleSwitchMobileMode}
                >
                  <Ionicons
                    name={mobileViewMode === 'coach' ? 'fitness-outline' : 'people-outline'}
                    size={18}
                    color={SLColors.textStrong}
                  />
                  <ThemedText style={styles.primaryButtonText}>
                    {mobileViewMode === 'coach' ? 'Switch to Athlete Mode' : 'Switch to Coach Mode'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {role === 'athlete' && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionIconWrap}>
                    <Ionicons name="time-outline" size={22} color={SLColors.accentViolet} />
                  </View>
                  <ThemedText variant="h3" style={styles.sectionTitle}>
                    Training Timezone
                  </ThemedText>
                </View>
                <ThemedText variant="bodyMuted" style={styles.timezoneDescription}>
                  {"Used for today's training, missed sessions, and workout calendar dates."}
                </ThemedText>
              </View>

              <View style={styles.timezoneStatus}>
                <View style={styles.timezoneStatusRow}>
                  <ThemedText style={styles.timezoneLabel}>Current</ThemedText>
                  <ThemedText style={styles.timezoneValue}>{timezoneLoading ? 'Loading...' : timezone}</ThemedText>
                </View>
                <View style={styles.timezoneStatusRow}>
                  <ThemedText style={styles.timezoneLabel}>Source</ThemedText>
                  <ThemedText style={styles.timezoneValue}>{timezoneSourceLabel}</ThemedText>
                </View>
                {deviceTimezone ? (
                  <View style={styles.timezoneStatusRow}>
                    <ThemedText style={styles.timezoneLabel}>Device</ThemedText>
                    <ThemedText style={styles.timezoneValue}>{deviceTimezone}</ThemedText>
                  </View>
                ) : null}
              </View>

              <View style={styles.timezoneActions}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.rowButtonPressed]}
                  onPress={() => saveTimezone(null)}
                  disabled={timezoneSaving || timezoneLoading}
                >
                  {timezoneSaving ? <ActivityIndicator color={SLColors.accentViolet} /> : <Ionicons name="phone-portrait-outline" size={18} color={SLColors.accentViolet} />}
                  <ThemedText style={styles.secondaryButtonText}>Use device timezone</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                  onPress={() => setTimezoneModalOpen(true)}
                  disabled={timezoneSaving || timezoneLoading}
                >
                  <Ionicons name="search-outline" size={18} color={SLColors.textStrong} />
                  <ThemedText style={styles.primaryButtonText}>Choose manually</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="notifications-outline" size={22} color={SLColors.accentViolet} />
                </View>
                <ThemedText variant="h3" style={styles.sectionTitle}>
                  Notifications
                </ThemedText>
              </View>
              <ThemedText variant="bodyMuted" style={styles.timezoneDescription}>
                Choose which video review updates should reach this device.
              </ThemedText>
            </View>

            {role === 'athlete' ? (
              <Pressable
                style={({ pressed }) => [styles.rowButton, pressed && styles.rowButtonPressed]}
                onPress={() => saveNotificationPreference('notify_video_feedback', !notifyVideoFeedback)}
                disabled={notificationLoading}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.rowIconWrap, styles.linkCoachIconWrap]}>
                    <Ionicons name="chatbox-ellipses-outline" size={20} color={SLColors.accentViolet} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <ThemedText style={styles.rowTitle}>Video feedback notifications</ThemedText>
                    <ThemedText variant="bodyMuted" style={styles.rowSubtitle}>
                      When your coach reviews a set video
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.togglePill, notifyVideoFeedback && styles.togglePillOn]}>
                  <View style={[styles.toggleKnob, notifyVideoFeedback && styles.toggleKnobOn]} />
                </View>
              </Pressable>
            ) : null}

            {isCoach ? (
              <Pressable
                style={({ pressed }) => [styles.rowButton, pressed && styles.rowButtonPressed]}
                onPress={() => saveNotificationPreference('notify_video_submissions', !notifyVideoSubmissions)}
                disabled={notificationLoading}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.rowIconWrap, styles.linkCoachIconWrap]}>
                  <Ionicons name="videocam-outline" size={20} color={SLColors.accentViolet} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <ThemedText style={styles.rowTitle}>Video submission notifications</ThemedText>
                    <ThemedText variant="bodyMuted" style={styles.rowSubtitle}>
                      When an athlete submits a set video
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.togglePill, notifyVideoSubmissions && styles.togglePillOn]}>
                  <View style={[styles.toggleKnob, notifyVideoSubmissions && styles.toggleKnobOn]} />
                </View>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={SLColors.accentViolet} />
                </View>
                <ThemedText variant="h3" style={styles.sectionTitle}>
                  Video Privacy
                </ThemedText>
              </View>
              <ThemedText variant="bodyMuted" style={styles.timezoneDescription}>
                Your videos stay private to you and your coach.
              </ThemedText>
            </View>

            <Pressable
              style={({ pressed }) => [styles.rowButton, pressed && styles.rowButtonPressed]}
              onPress={() => saveVideoMlTrainingConsent(videoMlTrainingConsent !== true)}
              disabled={privacyLoading}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, styles.linkCoachIconWrap]}>
                  <Ionicons name="analytics-outline" size={20} color={SLColors.accentViolet} />
                </View>
                <View style={styles.rowTextWrap}>
                  <ThemedText style={styles.rowTitle}>Allow my videos to help train future ML analysis tools</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.rowSubtitle}>
                    Strength Ledger may use your uploaded training videos and labels internally to improve future ML features like automatic video tags, angle detection, and analysis tools. You can change this anytime.
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.togglePill, videoMlTrainingConsent === true && styles.togglePillOn]}>
                <View style={[styles.toggleKnob, videoMlTrainingConsent === true && styles.toggleKnobOn]} />
              </View>
            </Pressable>
          </View>

          <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="settings" size={22} color={SLColors.textMuted} />
              </View>
              <ThemedText variant="h3" style={styles.sectionTitle}>
                Account
              </ThemedText>
            </View>
          </View>

          {role === 'athlete' && (
            <Pressable style={({ pressed }) => [styles.rowButton, pressed && styles.rowButtonPressed]} onPress={handleLinkCoach}>
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, styles.linkCoachIconWrap]}>
                  <Ionicons name="link" size={20} color={SLColors.accentViolet} />
                </View>
                <View style={styles.rowTextWrap}>
                  <ThemedText style={styles.rowTitle}>Link coach</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.rowSubtitle}>
                    Connect your account to a coach
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={SLColors.textSubtle} />
            </Pressable>
          )}

          {role === 'athlete' && (
            <Pressable
              style={({ pressed }) => [styles.rowButton, pressed && styles.rowButtonPressed]}
              onPress={handleUpdateAvatar}
              disabled={uploadingAvatar}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIconWrap, styles.linkCoachIconWrap]}>
                  <Ionicons name="image" size={20} color={SLColors.accentViolet} />
                </View>
                <View style={styles.rowTextWrap}>
                  <ThemedText style={styles.rowTitle}>{uploadingAvatar ? 'Uploading photo…' : 'Update profile photo'}</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.rowSubtitle}>
                    Upload your athlete avatar
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={SLColors.textSubtle} />
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.rowButton, pressed && styles.rowButtonPressed]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.rowIconWrap, styles.logoutIconWrap]}>
                <Ionicons name="log-out-outline" size={20} color={SLColors.danger} />
              </View>
              <View style={styles.rowTextWrap}>
                <ThemedText style={styles.rowTitle}>{loggingOut ? 'Logging out…' : 'Log out'}</ThemedText>
                <ThemedText variant="bodyMuted" style={styles.rowSubtitle}>
                  End your current session
                </ThemedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={SLColors.textSubtle} />
          </Pressable>
          </View>
          <View style={styles.footer}>
            <ThemedText variant="bodyMuted" style={styles.footerText}>
              {updateLabel}
            </ThemedText>
          </View>
        </ScrollView>

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
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: SLTypography.title.fontFamily,
    fontSize: SLTypography.title.fontSize,
    lineHeight: SLTypography.title.lineHeight,
    fontWeight: '800',
    color: SLColors.textStrong,
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: SLColors.textMuted,
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
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
