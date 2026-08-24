import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/sl-text';

import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import {
  CoachAnnouncement,
  CoachRosterAthlete,
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getCoachRoster,
  markAnnouncementRead,
  setAnnouncementPinned,
  updateAnnouncement,
} from '@/lib/api';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';

type AnnouncementAudienceMode = 'all_roster' | 'selected_athletes';

type TargetedAnnouncement = CoachAnnouncement & {
  audience_mode?: AnnouncementAudienceMode | string | null;
  athlete_ids?: number[] | null;
  audience_summary?: string | null;
};

function parseServerTimestamp(value?: string | null) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDateTime(value?: string | null) {
  const date = parseServerTimestamp(value);
  if (!date) return '';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sortAnnouncements<T extends CoachAnnouncement>(items: T[]) {
  return [...items].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

function isOwnerBroadcast(item?: CoachAnnouncement | null) {
  return item?.source === 'owner_broadcast' || item?.message_type === 'owner_broadcast';
}

function titleCaseWords(value?: string | null) {
  return String(value || '')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\w\S*/g, (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
}

function platformBadgeLabel(item?: CoachAnnouncement | null) {
  if (!isOwnerBroadcast(item)) return '';
  return item?.source_badge || 'Developer Update';
}

function categoryLabel(item?: CoachAnnouncement | null) {
  return titleCaseWords(item?.category || '');
}

function sourceLabel(item?: CoachAnnouncement | null) {
  return isOwnerBroadcast(item) ? (item?.source_label || 'Strength Ledger') : 'Announcement';
}

export default function AnnouncementsScreen() {
  const { user, activeMobileMode } = useAuth();
  const router = useRouter();
  const isIndividual = activeMobileMode === 'individual';

  React.useEffect(() => {
    if (isIndividual) {
      router.replace('/(tabs)/athlete-dashboard' as any);
    }
  }, [isIndividual, router]);

  if (isIndividual) {
    return null;
  }

  if (user?.is_coach) {
    return <CoachAnnouncementHub />;
  }

  return <AthleteAnnouncementsScreen />;
}

function CoachAnnouncementHub() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<TargetedAnnouncement[]>([]);
  const [roster, setRoster] = useState<CoachRosterAthlete[]>([]);
  const [editingAnnouncement, setEditingAnnouncement] = useState<TargetedAnnouncement | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AnnouncementAudienceMode>('all_roster');
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<number[]>([]);
  const [athleteSearch, setAthleteSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedAnnouncements = useMemo(() => sortAnnouncements(announcements), [announcements]);
  const filteredRoster = useMemo(() => {
    const needle = athleteSearch.trim().toLowerCase();
    return needle
      ? roster.filter((athlete) => String(athlete.name || '').toLowerCase().includes(needle))
      : roster;
  }, [athleteSearch, roster]);

  const toggleSelectedAthlete = useCallback((athleteId: number) => {
    setSelectedAthleteIds((prev) => (
      prev.includes(athleteId)
        ? prev.filter((id) => id !== athleteId)
        : [...prev, athleteId]
    ));
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;

    try {
      if (!silent) setLoading(true);
      setError(null);

      const [announcementRes, rosterRes] = await Promise.all([
        getAnnouncements(),
        getCoachRoster(),
      ]);
      if (!announcementRes.ok) {
        setError(announcementRes.error || 'Failed to load announcements.');
        return;
      }

      setAnnouncements((announcementRes.announcements || []) as TargetedAnnouncement[]);
      if (rosterRes.ok) setRoster((rosterRes.athletes || []).filter((athlete) => !athlete.is_self));
    } catch (err) {
      console.error('Announcements load error', err);
      setError('Failed to load announcements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ silent: true });
  }, [load]);

  const openCreate = useCallback(() => {
    setEditingAnnouncement(null);
    setTitle('');
    setBody('');
    setPinned(false);
    setAudienceMode('all_roster');
    setSelectedAthleteIds([]);
    setAthleteSearch('');
    setComposerOpen(true);
  }, []);

  const openEdit = useCallback((announcement: TargetedAnnouncement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title || '');
    setBody(announcement.body || '');
    setPinned(!!announcement.pinned);
    setAudienceMode(announcement.audience_mode === 'selected_athletes' ? 'selected_athletes' : 'all_roster');
    setSelectedAthleteIds(Array.isArray(announcement.athlete_ids) ? announcement.athlete_ids.map(Number).filter(Boolean) : []);
    setAthleteSearch('');
    setComposerOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    if (saving) return;
    setComposerOpen(false);
    setEditingAnnouncement(null);
    setAthleteSearch('');
  }, [saving]);

  const replaceAnnouncement = useCallback((announcement: TargetedAnnouncement) => {
    setAnnouncements((prev) => {
      const idx = prev.findIndex((item) => item.id === announcement.id);
      if (idx < 0) return [announcement, ...prev];
      return prev.map((item) => item.id === announcement.id ? announcement : item);
    });
  }, []);

  const saveAnnouncement = useCallback(async () => {
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (!nextTitle || !nextBody || saving) return;
    if (audienceMode === 'selected_athletes' && !selectedAthleteIds.length) {
      setError('Select at least one athlete.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        title: nextTitle,
        body: nextBody,
        pinned,
        audience_mode: audienceMode,
        athlete_ids: audienceMode === 'selected_athletes' ? selectedAthleteIds : [],
      };
      const res = editingAnnouncement
        ? await updateAnnouncement(editingAnnouncement.id, payload)
        : await createAnnouncement(payload);

      if (!res.ok || !res.announcement) {
        setError(res.error || 'Failed to save announcement.');
        return;
      }

      replaceAnnouncement(res.announcement as TargetedAnnouncement);
      setComposerOpen(false);
      setEditingAnnouncement(null);
    } catch (err) {
      console.error('Save announcement failed', err);
      setError('Failed to save announcement.');
    } finally {
      setSaving(false);
    }
  }, [audienceMode, body, editingAnnouncement, pinned, replaceAnnouncement, saving, selectedAthleteIds, title]);

  const togglePinned = useCallback(async (announcement: CoachAnnouncement) => {
    const res = await setAnnouncementPinned(announcement.id, !announcement.pinned);
    if (res.ok && res.announcement) {
      replaceAnnouncement(res.announcement);
    } else {
      setError(res.error || 'Failed to update pin.');
    }
  }, [replaceAnnouncement]);

  const confirmDelete = useCallback((announcement: CoachAnnouncement) => {
    Alert.alert(
      'Delete announcement?',
      'This removes it for athletes too.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteAnnouncement(announcement.id);
            if (res.ok) {
              setAnnouncements((prev) => prev.filter((item) => item.id !== announcement.id));
            } else {
              setError(res.error || 'Failed to delete announcement.');
            }
          },
        },
      ]
    );
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={SLColors.accentViolet} />
        <Text style={styles.loadingText}>Loading announcements...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(tabs)/messages' as any)}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={SLColors.textStrong} />
        </Pressable>

        <View style={styles.headerTextWrap}>
          <Text typographyRole="pageTitle" style={styles.headerTitle}>Announcements</Text>
        </View>

        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [styles.headerIconButton, pressed && styles.backButtonPressed]}
        >
          <Ionicons name="add" size={22} color={SLColors.textStrong} />
        </Pressable>
      </View>

      {!!error && (
        <View style={styles.errorCard}>
          <Ionicons name="warning-outline" size={16} color={SLColors.danger} />
          <Text typographyRole="errorText" style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={sortedAnnouncements}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={SLColors.accentViolet}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="megaphone-outline" size={30} color={SLColors.textSubtle} />
            <Text typographyRole="emptyStateTitle" style={styles.emptyTitle}>No announcements</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.announcementCard, item.pinned && styles.announcementCardPinned]}>
            <View style={styles.cardMainRow}>
              <View style={styles.titleRow}>
                <Text typographyRole="bodyStrong" style={styles.announcementTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </View>

              {!!item.pinned && (
                <View style={styles.pinnedBadge}>
                  <Ionicons name="pin" size={11} color={SLColors.review} />
                </View>
              )}
            </View>

            <Text style={styles.announcementDate}>
              {formatLocalDateTime(item.created_at)}
            </Text>
            <Text style={styles.announcementAudience} numberOfLines={1}>
              {item.audience_summary || (item.audience_mode === 'selected_athletes' ? 'Selected athletes' : 'All athletes')}
            </Text>

            <Text typographyRole="messageText" style={styles.coachAnnouncementBody} numberOfLines={3}>
              {item.body}
            </Text>

            <View style={styles.coachActions}>
              <Pressable
                onPress={() => togglePinned(item)}
                style={({ pressed }) => [
                  styles.compactActionButton,
                  item.pinned && styles.iconActionPinned,
                  pressed && styles.iconActionPressed,
                ]}
              >
                <Ionicons name={item.pinned ? 'pin' : 'pin-outline'} size={16} color={item.pinned ? SLColors.review : SLColors.text} />
                <Text style={[styles.compactActionText, item.pinned && styles.compactActionTextPinned]}>
                  {item.pinned ? 'Pinned' : 'Pin'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => openEdit(item)}
                style={({ pressed }) => [styles.compactActionButton, pressed && styles.iconActionPressed]}
              >
                <Ionicons name="create-outline" size={16} color={SLColors.text} />
                <Text style={styles.compactActionText}>Edit</Text>
              </Pressable>

              <Pressable
                onPress={() => confirmDelete(item)}
                style={({ pressed }) => [styles.compactActionButton, styles.iconActionDanger, pressed && styles.iconActionPressed]}
              >
                <Ionicons name="trash-outline" size={16} color={SLColors.danger} />
                <Text style={[styles.compactActionText, styles.compactActionTextDanger]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      {composerOpen && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeComposer} />
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoider}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={styles.editorCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <Text typographyRole="modalTitle" style={styles.modalTitle}>{editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}</Text>
                </View>
                <Pressable onPress={closeComposer} style={styles.modalClose}>
                  <Ionicons name="close" size={18} color={SLColors.text} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={styles.editorScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Title"
                  placeholderTextColor={SLColors.textSubtle}
                  style={styles.editorInput}
                  maxLength={160}
                  returnKeyType="next"
                />

                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Body"
                  placeholderTextColor={SLColors.textSubtle}
                  style={[styles.editorInput, styles.editorBody]}
                  multiline
                  textAlignVertical="top"
                />

                <Pressable
                  onPress={() => setPinned((value) => !value)}
                  style={styles.pinToggleRow}
                >
                  <View style={[styles.pinToggleIcon, pinned && styles.pinToggleIconActive]}>
                    <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={14} color={pinned ? SLColors.review : SLColors.textMuted} />
                  </View>
                  <Text style={styles.pinToggleText}>{pinned ? 'Pinned' : 'Pin announcement'}</Text>
                </Pressable>

                <View style={styles.audienceBlock}>
                  <Text style={styles.audienceLabel}>Audience</Text>
                  <View style={styles.audienceModeRow}>
                    {[
                      { value: 'all_roster' as const, label: 'All athletes' },
                      { value: 'selected_athletes' as const, label: 'Selected' },
                    ].map((option) => {
                      const active = audienceMode === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => setAudienceMode(option.value)}
                          style={[styles.audienceModeChip, active && styles.audienceModeChipActive]}
                        >
                          <Text style={[styles.audienceModeText, active && styles.audienceModeTextActive]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {audienceMode === 'selected_athletes' ? (
                    <View style={styles.athletePicker}>
                      <TextInput
                        value={athleteSearch}
                        onChangeText={setAthleteSearch}
                        placeholder="Search athletes"
                        placeholderTextColor={SLColors.textSubtle}
                        style={styles.athleteSearchInput}
                      />
                      <ScrollView style={styles.athletePickerList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                        {filteredRoster.map((athlete) => {
                          const active = selectedAthleteIds.includes(athlete.id);
                          return (
                            <Pressable
                              key={athlete.id}
                              style={[styles.athleteOptionRow, active && styles.athleteOptionRowActive]}
                              onPress={() => toggleSelectedAthlete(athlete.id)}
                            >
                              <Text typographyRole="dynamicName" style={[styles.athleteOptionText, active && styles.athleteOptionTextActive]} numberOfLines={1}>
                                {athlete.name}
                              </Text>
                              {active ? <Ionicons name="checkmark" size={16} color={SLColors.success} /> : null}
                            </Pressable>
                          );
                        })}
                        {!filteredRoster.length ? (
                          <View style={styles.athleteOptionEmpty}>
                            <Text style={styles.athleteOptionEmptyText}>No athletes found</Text>
                          </View>
                        ) : null}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  onPress={saveAnnouncement}
                  disabled={!title.trim() || !body.trim() || saving || (audienceMode === 'selected_athletes' && !selectedAthleteIds.length)}
                  style={({ pressed }) => [
                    styles.saveButton,
                    (!title.trim() || !body.trim() || saving || (audienceMode === 'selected_athletes' && !selectedAthleteIds.length)) && styles.saveButtonDisabled,
                    pressed && !!title.trim() && !!body.trim() && !saving && styles.iconActionPressed,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={SLColors.textStrong} />
                  ) : (
                    <Text style={styles.saveButtonText}>{editingAnnouncement ? 'Save' : 'Post'}</Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </ThemedView>
  );
}

function AthleteAnnouncementsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<CoachAnnouncement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<CoachAnnouncement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedAnnouncements = useMemo(() => sortAnnouncements(announcements), [announcements]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;

    try {
      if (!silent) setLoading(true);
      setError(null);

      const res = await getAnnouncements();
      if (!res.ok) {
        setError(res.error || 'Failed to load announcements.');
        return;
      }

      setAnnouncements(res.announcements || []);
    } catch (err) {
      console.error('Announcements load error', err);
      setError('Failed to load announcements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ silent: true });
  }, [load]);

  const openAnnouncement = useCallback(async (announcement: CoachAnnouncement) => {
    setSelectedAnnouncement(announcement);

    if (announcement.read_at) return;

    try {
      const res = await markAnnouncementRead(announcement.id);
      if (res.ok && res.announcement) {
        const updated = { ...announcement, ...res.announcement };
        setAnnouncements((prev) => prev.map((item) =>
          item.id === announcement.id ? { ...item, ...res.announcement } : item
        ));
        setSelectedAnnouncement(updated);
      }
    } catch (err) {
      console.warn('Mark announcement read failed', err);
    }
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={SLColors.accentViolet} />
        <Text style={styles.loadingText}>Loading announcements...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(tabs)/messages' as any)}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={SLColors.textStrong} />
        </Pressable>

        <View style={styles.headerTextWrap}>
          <Text typographyRole="pageTitle" style={styles.headerTitle}>Announcements</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {!!error && (
        <View style={styles.errorCard}>
          <Ionicons name="warning-outline" size={16} color={SLColors.danger} />
          <Text typographyRole="errorText" style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={sortedAnnouncements}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={SLColors.accentViolet}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="megaphone-outline" size={30} color={SLColors.textSubtle} />
            <Text typographyRole="emptyStateTitle" style={styles.emptyTitle}>No announcements</Text>
          </View>
        }
        renderItem={({ item }) => {
          const unread = !item.read_at;
          const platformUpdate = isOwnerBroadcast(item);
          const platformCategory = categoryLabel(item);

          return (
            <Pressable
              onPress={() => openAnnouncement(item)}
              style={({ pressed }) => [
                styles.announcementCard,
                platformUpdate && styles.platformAnnouncementCard,
                platformUpdate && item.priority === 'important' && styles.platformAnnouncementCardImportant,
                pressed && styles.announcementCardPressed,
              ]}
            >
              {platformUpdate && (
                <View style={styles.platformSourceRow}>
                  <View style={styles.platformMark}>
                    <Text style={styles.platformMarkText}>SL</Text>
                  </View>
                  <Text style={styles.platformSourceText} numberOfLines={1}>
                    {sourceLabel(item)} · {platformBadgeLabel(item)}
                  </Text>
                  {!!platformCategory && (
                    <View style={styles.platformCategoryBadge}>
                      <Text style={styles.platformCategoryText}>{platformCategory}</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={styles.cardMainRow}>
                <View style={styles.titleRow}>
                  {unread && <View style={styles.unreadDot} />}
                  <Text typographyRole="bodyStrong" style={styles.announcementTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>

                {!!item.pinned && (
                  <View style={styles.pinnedBadge}>
                    <Ionicons name="pin" size={11} color={SLColors.review} />
                  </View>
                )}
              </View>

              <Text style={styles.announcementDate}>
                {formatLocalDateTime(item.created_at)}
              </Text>
            </Pressable>
          );
        }}
      />

      {selectedAnnouncement && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedAnnouncement(null)}
          />

          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                {isOwnerBroadcast(selectedAnnouncement) ? (
                  <View style={styles.platformModalSource}>
                    <View style={styles.platformModalMark}>
                      <Text style={styles.platformMarkText}>SL</Text>
                    </View>
                    <View style={styles.platformModalSourceCopy}>
                      <Text style={styles.platformModalSourceLabel}>
                        {sourceLabel(selectedAnnouncement)}
                      </Text>
                      <View style={styles.platformModalBadgeRow}>
                        <Text style={styles.platformModalBadge}>
                          {platformBadgeLabel(selectedAnnouncement)}
                        </Text>
                        {!!categoryLabel(selectedAnnouncement) && (
                          <Text style={styles.platformModalCategory}>
                            {categoryLabel(selectedAnnouncement)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.modalEyebrow}>Announcement</Text>
                )}
                <Text typographyRole="modalTitle" style={styles.modalTitle}>{selectedAnnouncement.title}</Text>
              </View>

              <Pressable
                onPress={() => setSelectedAnnouncement(null)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={18} color={SLColors.text} />
              </Pressable>
            </View>

            <Text style={styles.modalDate}>
              {formatLocalDateTime(selectedAnnouncement.created_at)}
            </Text>

            <ScrollView style={styles.modalBodyScroll}>
              <Text typographyRole="modalBody" style={styles.modalBody}>{selectedAnnouncement.body}</Text>
              {!!selectedAnnouncement.link_url && !!selectedAnnouncement.link_label && (
                <Pressable
                  onPress={() => {
                    const url = String(selectedAnnouncement.link_url || '');
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                      Linking.openURL(url).catch(() => {});
                    } else {
                      Alert.alert('Open in Strength Ledger', url);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.modalLinkButton,
                    isOwnerBroadcast(selectedAnnouncement) && styles.platformModalLinkButton,
                    pressed && styles.modalLinkButtonPressed,
                  ]}
                >
                  <Text style={styles.modalLinkButtonText}>{selectedAnnouncement.link_label}</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    marginTop: 14,
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.08)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
  },
  backButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.railViolet,
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
  },
  headerSub: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '600',
    marginTop: 2,
  },
  headerSpacer: {
    width: 38,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 24,
    gap: 9,
  },
  announcementCard: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(6,6,8,0.3)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185,176,163,0.1)',
  },
  announcementCardPinned: {
    borderLeftColor: 'rgba(196,181,253,0.44)',
    backgroundColor: 'rgba(76,29,149,0.14)',
  },
  platformAnnouncementCard: {
    borderLeftColor: 'rgba(214,182,109,0.76)',
    backgroundColor: 'rgba(18,18,22,0.74)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(214,182,109,0.14)',
  },
  platformAnnouncementCardImportant: {
    backgroundColor: 'rgba(42,31,14,0.38)',
    borderLeftColor: 'rgba(245,158,11,0.95)',
  },
  announcementCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  platformSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  platformMark: {
    width: 24,
    height: 24,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,182,109,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(214,182,109,0.32)',
  },
  platformMarkText: {
    color: SLColors.warning,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  platformSourceText: {
    flex: 1,
    minWidth: 0,
    color: SLColors.warning,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  platformCategoryBadge: {
    flexShrink: 0,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(15,23,42,0.56)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  platformCategoryText: {
    color: SLColors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.review,
    marginRight: 8,
    flexShrink: 0,
  },
  announcementTitle: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
    lineHeight: 19,
    marginRight: 10,
  },
  pinnedBadge: {
    width: 22,
    height: 22,
    borderRadius: SLRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,108,255,0.16)',
  },
  announcementDate: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  announcementAudience: {
    color: SLColors.accentViolet,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    marginTop: 4,
  },
  coachAnnouncementBody: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
    marginTop: 8,
  },
  coachActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 10,
  },
  compactActionButton: {
    minHeight: 30,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    backgroundColor: 'rgba(6,6,8,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  compactActionText: {
    color: SLColors.text,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  compactActionTextPinned: {
    color: SLColors.review,
  },
  compactActionTextDanger: {
    color: SLColors.danger,
  },
  iconActionButton: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,6,8,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  iconActionPinned: {
    backgroundColor: 'rgba(124,108,255,0.16)',
    borderColor: 'rgba(124,108,255,0.24)',
  },
  iconActionDanger: {
    backgroundColor: 'rgba(127,29,29,0.18)',
    borderColor: 'rgba(248,113,113,0.18)',
  },
  iconActionPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.97 }],
  },
  emptyCard: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185,176,163,0.1)',
    backgroundColor: 'transparent',
    paddingVertical: 11,
    gap: 9,
  },
  emptyTitle: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '600',
    marginTop: 0,
  },
  emptyBody: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    display: 'none',
    textAlign: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SLRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: 'rgba(127,29,29,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
  },
  errorText: {
    flex: 1,
    color: SLColors.danger,
    fontSize: SLTypography.label.fontSize,
    marginLeft: 10,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,2,3,0.7)',
  },
  modalKeyboardAvoider: {
    width: '100%',
    maxHeight: '90%',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    maxHeight: '72%',
    borderRadius: SLRadius.xl,
    padding: 18,
    backgroundColor: 'rgba(7,7,9,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.18)',
  },
  editorCard: {
    width: '100%',
    maxHeight: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    backgroundColor: 'rgba(7,7,9,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.18)',
  },
  editorScroll: {
    maxHeight: 520,
  },
  editorScrollContent: {
    paddingBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  platformModalSource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  platformModalMark: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,182,109,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(214,182,109,0.38)',
  },
  platformModalSourceCopy: {
    flex: 1,
    minWidth: 0,
  },
  platformModalSourceLabel: {
    color: SLColors.textStrong,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '900',
  },
  platformModalBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  platformModalBadge: {
    overflow: 'hidden',
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(214,182,109,0.17)',
    color: SLColors.warning,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
    textTransform: 'uppercase',
  },
  platformModalCategory: {
    overflow: 'hidden',
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(148,163,184,0.12)',
    color: SLColors.text,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modalEyebrow: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  modalTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: '800',
    lineHeight: 23,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,6,8,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  modalDate: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalBodyScroll: {
    maxHeight: 360,
  },
  modalBody: {
    color: SLColors.text,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 22,
  },
  modalLinkButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(214, 204, 255, 0.36)',
    backgroundColor: 'rgba(139, 124, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  platformModalLinkButton: {
    borderColor: 'rgba(214,182,109,0.42)',
    backgroundColor: 'rgba(214,182,109,0.14)',
  },
  modalLinkButtonPressed: {
    opacity: 0.78,
  },
  modalLinkButtonText: {
    color: SLColors.review,
    fontWeight: '800',
  },
  editorInput: {
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(6,6,8,0.38)',
    color: SLColors.textStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: SLTypography.rowTitle.fontSize,
    marginTop: 10,
  },
  editorBody: {
    minHeight: 124,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  pinToggleIcon: {
    width: 30,
    height: 30,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.36)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    marginRight: 10,
  },
  pinToggleIconActive: {
    backgroundColor: 'rgba(124,108,255,0.16)',
    borderColor: 'rgba(124,108,255,0.24)',
  },
  pinToggleText: {
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
  },
  audienceBlock: {
    marginTop: 14,
    gap: 9,
  },
  audienceLabel: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  audienceModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  audienceModeChip: {
    minHeight: 34,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(2,6,23,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  audienceModeChipActive: {
    borderColor: 'rgba(124,108,255,0.38)',
    backgroundColor: 'rgba(124,108,255,0.18)',
  },
  audienceModeText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  audienceModeTextActive: {
    color: SLColors.textStrong,
  },
  athletePicker: {
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(2,6,23,0.24)',
    padding: 9,
  },
  athleteSearchInput: {
    minHeight: 38,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    backgroundColor: 'rgba(6,6,8,0.42)',
    color: SLColors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: SLTypography.label.fontSize,
  },
  athletePickerList: {
    maxHeight: 168,
    marginTop: 8,
  },
  athleteOptionRow: {
    minHeight: 38,
    borderRadius: SLRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 6,
    backgroundColor: 'rgba(15,23,42,0.54)',
  },
  athleteOptionRowActive: {
    backgroundColor: 'rgba(5,150,105,0.18)',
  },
  athleteOptionText: {
    flex: 1,
    color: SLColors.text,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '700',
  },
  athleteOptionTextActive: {
    color: SLColors.success,
    fontWeight: '900',
  },
  athleteOptionEmpty: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  athleteOptionEmptyText: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
  },
  saveButton: {
    height: 44,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109,40,217,0.82)',
    marginTop: 14,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '900',
  },
});
