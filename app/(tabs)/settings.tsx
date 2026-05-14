import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { API_BASE } from '@/lib/api';

export default function SettingsScreen() {
  const router = useRouter();
  const auth = useAuth() as any;
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['left','right','bottom']}>
      <ThemedView style={styles.screen}>
        <View style={styles.header}>
          <ThemedText variant="h1" style={styles.title}>
            Settings
          </ThemedText>
          <ThemedText variant="bodyMuted" style={styles.subtitle}>
            Manage your account
          </ThemedText>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name="settings" size={22} color="#94A3B8" />
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
                  <Ionicons name="link" size={20} color="#C4B5FD" />
                </View>
                <View style={styles.rowTextWrap}>
                  <ThemedText style={styles.rowTitle}>Link coach</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.rowSubtitle}>
                    Connect your account to a coach
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#64748B" />
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
                  <Ionicons name="image" size={20} color="#C4B5FD" />
                </View>
                <View style={styles.rowTextWrap}>
                  <ThemedText style={styles.rowTitle}>{uploadingAvatar ? 'Uploading photo…' : 'Update profile photo'}</ThemedText>
                  <ThemedText variant="bodyMuted" style={styles.rowSubtitle}>
                    Upload your athlete avatar
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#64748B" />
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.rowButton, pressed && styles.rowButtonPressed]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.rowIconWrap, styles.logoutIconWrap]}>
                <Ionicons name="log-out-outline" size={20} color="#FCA5A5" />
              </View>
              <View style={styles.rowTextWrap}>
                <ThemedText style={styles.rowTitle}>{loggingOut ? 'Logging out…' : 'Log out'}</ThemedText>
                <ThemedText variant="bodyMuted" style={styles.rowSubtitle}>
                  End your current session
                </ThemedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </Pressable>
        </View>
        <View style={styles.footer}>
          <ThemedText variant="bodyMuted" style={styles.footerText}>
            {updateLabel}
          </ThemedText>
        </View>
      </ThemedView>
    </SafeAreaView>
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
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#94A3B8',
  },
  section: {
    backgroundColor: 'rgba(8,16,38,0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  rowButton: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.08)',
    backgroundColor: 'transparent',
  },
  rowButtonPressed: {
    backgroundColor: 'rgba(148,163,184,0.05)',
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
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  linkCoachIconWrap: {
    backgroundColor: 'rgba(109,91,208,0.12)',
    borderColor: 'rgba(109,91,208,0.24)',
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
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  rowSubtitle: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: 12,
  },
  footer: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    color: '#64748B',
    fontSize: 12,
    letterSpacing: 0.3,
  },
});