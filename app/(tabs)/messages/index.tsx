import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
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

import { MessageImageAttachment } from '@/components/MessageImageAttachment';
import { NewCoachExperience, type NewCoachExperiencePayload } from '@/components/NewCoachExperience';
import { ThemedView } from '@/components/themed-view';
import { SLErrorState, SLProfileAvatar } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import {
  CoachAnnouncement,
  MessengerMessage,
  MessengerUnreadSummary,
  MessengerThread,
  completeAttachmentUpload,
  getAnnouncements,
  getMessengerThreads,
  getThreadMessages,
  getUnreadSummary,
  markThreadRead,
  sendThreadMessage,
} from '@/lib/api';
import {
  SelectedMessagingAttachment,
  attachmentIsImage,
  formatAttachmentSize,
  messageAttachments,
  openMessageAttachment,
  pickMessagingAttachment,
  pickPhotoMessagingAttachment,
  uploadMessagingAttachment,
} from '@/lib/messagingAttachments';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';

function parseServerTimestamp(value?: string | null) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMessageTime(value?: string | null) {
  const date = parseServerTimestamp(value);
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatMessageDate(value?: string | null) {
  const date = parseServerTimestamp(value);
  if (!date) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatInboxTimestamp(value?: string | null) {
  const date = parseServerTimestamp(value);
  if (!date) return '';

  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function mergeMessagesById(current: MessengerMessage[], incoming: MessengerMessage[]) {
  const merged = [...current];

  for (const msg of incoming || []) {
    const existingIdx = merged.findIndex((item) => String(item.id) === String(msg.id));
    if (existingIdx >= 0) {
      merged[existingIdx] = { ...merged[existingIdx], ...msg };
    } else {
      merged.push(msg);
    }
  }

  return merged.sort((a, b) => {
    const aTime = parseServerTimestamp(a.created_at)?.getTime() || 0;
    const bTime = parseServerTimestamp(b.created_at)?.getTime() || 0;
    if (aTime !== bTime) return aTime - bTime;
    const aId = Number(a.id || 0);
    const bId = Number(b.id || 0);
    return (Number.isFinite(aId) ? aId : 0) - (Number.isFinite(bId) ? bId : 0);
  });
}

function firstParam(value?: string | string[] | null) {
  if (Array.isArray(value)) return value[0] || '';
  return value ? String(value) : '';
}

function MessageAvatar({
  name,
  avatarUrl,
  avatarVersion,
  size = 46,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  avatarVersion?: string | null;
  size?: number;
}) {
  return (
    <SLProfileAvatar
      name={name}
      profilePhotoUrl={avatarUrl}
      profilePhotoVersion={avatarVersion}
      size={size}
      style={styles.avatarBubble}
    />
  );
}

function LinkifiedMessageText({
  body,
  mine,
}: {
  body?: string | null;
  mine: boolean;
}) {
  const text = String(body || '');
  if (!text) return null;

  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <Text typographyRole="messageText" style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextTheirs]}>
      {parts.map((part, index) => {
        const isUrl = /^https?:\/\/[^\s]+$/.test(part);
        if (!isUrl) return <Text key={`${index}-text`}>{part}</Text>;

        return (
          <Text
            key={`${index}-link`}
            style={styles.messageLinkText}
            onPress={() => {
              Linking.openURL(part).catch(() => {});
            }}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

function MessageAttachmentChip({
  attachment,
  mine,
  onError,
}: {
  attachment: any;
  mine: boolean;
  onError: (message: string) => void;
}) {
  return (
    <Pressable
      disabled={!attachment.id}
      onPress={() => {
        openMessageAttachment(attachment).catch((err) => {
          onError(err?.message || 'Attachment could not be opened.');
        });
      }}
      style={({ pressed }) => [
        styles.messageAttachmentChip,
        mine ? styles.messageAttachmentChipMine : styles.messageAttachmentChipTheirs,
        pressed && !!attachment.id && styles.messageAttachmentChipPressed,
      ]}
    >
      <Ionicons
        name={attachmentIsImage(attachment) ? 'image-outline' : 'document-text-outline'}
        size={16}
        color={mine ? SLColors.textStrong : SLColors.accentViolet}
        style={styles.messageAttachmentIcon}
      />
      <View style={styles.messageAttachmentTextWrap}>
        <Text style={styles.messageAttachmentName} numberOfLines={1}>
          {attachment.filename || 'Attachment'}
        </Text>
        <Text style={styles.messageAttachmentSize}>
          {formatAttachmentSize(attachment.size_bytes)}
        </Text>
      </View>
    </Pressable>
  );
}

function videoReviewIdForMessage(message: MessengerMessage): number | null {
  const raw =
    message.video_id ??
    message.video_review_id ??
    message.metadata?.video_id ??
    message.metadata?.video_review_id ??
    null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function isVideoReviewFeedbackMessage(message: MessengerMessage) {
  return (
    message.message_type === 'video_review_feedback' ||
    !!message.video_review_id ||
    !!message.video_id ||
    !!message.metadata?.video_review_id ||
    !!message.metadata?.video_id
  );
}

function workoutIdForSessionReviewMessage(message: MessengerMessage): number | null {
  const raw = message.workout_id ?? message.metadata?.workout_id ?? message.session_review_id ?? message.metadata?.session_review_id ?? null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function isSessionReviewFeedbackMessage(message: MessengerMessage) {
  return (
    message.message_type === 'session_review_feedback' ||
    !!message.session_review_id ||
    (message.message_type === 'session_feedback' && !!message.workout_id)
  );
}

function AttachmentPreviewChip({
  attachment,
  onRemove,
}: {
  attachment: SelectedMessagingAttachment;
  onRemove: () => void;
}) {
  return (
    <View style={styles.attachmentPreviewChip}>
      <Ionicons
        name={attachmentIsImage(attachment) ? 'image-outline' : 'document-text-outline'}
        size={17}
        color={SLColors.accentViolet}
      />
      <View style={styles.attachmentPreviewTextWrap}>
        <Text style={styles.attachmentPreviewText} numberOfLines={1}>{attachment.name}</Text>
        <Text style={styles.attachmentPreviewSub}>{formatAttachmentSize(attachment.sizeBytes)}</Text>
      </View>
      <Pressable onPress={onRemove} style={styles.attachmentRemoveButton} hitSlop={8}>
        <Ionicons name="close" size={15} color={SLColors.danger} />
      </Pressable>
    </View>
  );
}

export default function MessagesScreen() {
  const { user, activeMobileMode } = useAuth();
  const router = useRouter();
  const isIndividual = activeMobileMode === 'individual';

  useEffect(() => {
    if (isIndividual) {
      router.replace('/(tabs)/athlete-dashboard' as any);
    }
  }, [isIndividual, router]);

  if (isIndividual) {
    return null;
  }

  if (activeMobileMode === 'coach' && user?.is_coach) {
    return <CoachMessagesScreen />;
  }

  return <AthleteMessagesScreen />;
}

function CoachMessagesScreen() {
  const router = useRouter();
  const pollingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [threads, setThreads] = useState<MessengerThread[]>([]);
  const [unreadSummary, setUnreadSummary] = useState<MessengerUnreadSummary | null>(null);
  const [announcementCount, setAnnouncementCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [newCoachExperience, setNewCoachExperience] = useState<NewCoachExperiencePayload | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;

    try {
      if (!silent) setLoading(true);
      setError(null);

      const [threadsRes, unreadRes, announcementsRes] = await Promise.all([
        getMessengerThreads(),
        getUnreadSummary(),
        getAnnouncements(),
      ]);

      if (!threadsRes.ok) {
        setError(threadsRes.error || 'Failed to load message threads.');
      }

      setThreads(threadsRes.threads || []);
      setNewCoachExperience(threadsRes.new_coach_experience || null);
      if (unreadRes.ok) setUnreadSummary(unreadRes.summary || null);
      if (announcementsRes.ok) setAnnouncementCount((announcementsRes.announcements || []).length);
    } catch (err) {
      console.error('Coach messages load error', err);
      setError('Failed to load conversations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(async () => {
        if (pollingRef.current) return;
        pollingRef.current = true;
        try {
          await load({ silent: true });
        } catch (err) {
          console.warn('Coach messages poll failed', err);
        } finally {
          pollingRef.current = false;
        }
      }, 12000);

      return () => clearInterval(timer);
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ silent: true });
  }, [load]);

  const previewForThread = useCallback((thread: MessengerThread | null) => {
    if (!thread) return 'No messages yet';

    const rawPreview =
      (thread as any).last_message_body ||
      (typeof (thread as any).last_message === 'string' ? (thread as any).last_message : null) ||
      (thread as any).preview ||
      thread.last_message?.body ||
      '';

    return String(rawPreview || '').trim() || (messageAttachments(thread.last_message).length ? 'Sent an attachment' : 'No messages yet');
  }, []);

  const orderedThreads = useMemo(() => {
    return [...threads].sort((a, b) => {
      const unreadDelta = Number(b.unread_count || 0) - Number(a.unread_count || 0);
      if (unreadDelta) return unreadDelta;
      const aTime = parseServerTimestamp(a.last_message_at || a.last_message?.created_at)?.getTime() || 0;
      const bTime = parseServerTimestamp(b.last_message_at || b.last_message?.created_at)?.getTime() || 0;
      if (aTime !== bTime) return bTime - aTime;
      return String(a.athlete_name || a.other_user_name || '').localeCompare(String(b.athlete_name || b.other_user_name || ''));
    });
  }, [threads]);

  const unreadMessages = unreadSummary?.unread_messages ?? orderedThreads.reduce((sum, thread) => sum + Number(thread.unread_count || 0), 0);
  const unreadAnnouncements = unreadSummary?.unread_announcements ?? 0;

  if (loading) {
    return (
      <ThemedView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={SLColors.accentViolet} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.coachContentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={SLColors.accentViolet}
          />
        }
      >
        <View style={styles.inboxHeader}>
          <Text typographyRole="pageTitle" style={styles.coachTitle}>Messages</Text>
        </View>

        {!!error ? (
          <SLErrorState
            title="Could not load inbox"
            message={error}
            actionLabel="Retry"
            onActionPress={() => load()}
            style={styles.coachStateCard}
          />
        ) : null}

        <View style={styles.inboxTopRow}>
          <View style={styles.inboxMetricCard}>
            <Text style={styles.inboxMetricValue}>{unreadMessages}</Text>
            <Text style={styles.inboxMetricLabel}>Unread</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/messages/announcements' as any)}
            style={({ pressed }) => [
              styles.inboxAnnouncementAction,
              pressed && styles.announcementCardPressed,
            ]}
          >
            <View style={styles.inboxAnnouncementIcon}>
              <Ionicons name="megaphone-outline" size={18} color={SLColors.accentViolet} />
              {unreadAnnouncements > 0 ? <View style={styles.inboxAnnouncementDot} /> : null}
            </View>
            <View style={styles.inboxAnnouncementCopy}>
              <Text style={styles.inboxAnnouncementTitle}>Announcements</Text>
              <Text style={styles.inboxAnnouncementMeta}>
                {unreadAnnouncements > 0 ? `${unreadAnnouncements} unread` : `${announcementCount} total`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={SLColors.textSubtle} />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inbox</Text>
        </View>

        {orderedThreads.length ? (
          <View style={styles.coachConversationList}>
            {orderedThreads.map((thread) => {
              const unreadCount = Number(thread.unread_count || 0);
              const athleteName = thread.athlete_name || thread.other_user_name || 'Athlete';
              const avatarUrl = thread.profilePhotoUrl;
              const avatarVersion = thread.profilePhotoVersion;
              const timestamp = formatInboxTimestamp(thread.last_message_at || thread.last_message?.created_at);

              return (
                <Pressable
                  key={thread.id}
                  onPress={() => {
                    router.push({
                      pathname: '/(tabs)/messages/[threadId]',
                      params: {
                        threadId: String(thread.id),
                        athleteName,
                        displayName: athleteName,
                        avatarUrl: avatarUrl || '',
                        avatarVersion: avatarVersion || '',
                      },
                    } as any);
                  }}
                  style={({ pressed }) => [
                    styles.coachConversationCard,
                    unreadCount > 0 && styles.coachConversationUnread,
                    pressed && styles.announcementCardPressed,
                  ]}
                >
                  <MessageAvatar name={athleteName} avatarUrl={avatarUrl} avatarVersion={avatarVersion} size={42} />
                  <View style={styles.coachConversationText}>
                    <View style={styles.coachConversationTopLine}>
                      <Text typographyRole="bodyStrong" style={styles.coachConversationName} numberOfLines={1}>
                        {athleteName}
                      </Text>
                      {timestamp ? <Text style={styles.coachConversationTime}>{timestamp}</Text> : null}
                    </View>
                    <Text
                      style={[styles.coachConversationSub, unreadCount > 0 && styles.coachConversationSubUnread]}
                      numberOfLines={1}
                    >
                      {previewForThread(thread)}
                    </Text>
                  </View>
                  {unreadCount > 0 && (
                    <View style={[styles.unreadBadge, styles.coachUnreadBadge]}>
                      <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color={SLColors.textSubtle} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          newCoachExperience ? (
            <NewCoachExperience experience={newCoachExperience} />
          ) : (
            <View style={styles.inlineEmptyRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={SLColors.textMuted} />
              <Text typographyRole="emptyStateBody" style={styles.inlineEmptyText}>No conversations</Text>
            </View>
          )
        )}
      </ScrollView>
    </ThemedView>
  );
}

function AthleteMessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    draft?: string | string[];
    contextType?: string | string[];
    workoutId?: string | string[];
    draftNonce?: string | string[];
  }>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [threads, setThreads] = useState<MessengerThread[]>([]);
  const [announcements, setAnnouncements] = useState<CoachAnnouncement[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<MessengerMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<SelectedMessagingAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const messageScrollRef = useRef<ScrollView>(null);
  const pollingRef = useRef(false);
  const messagePollingRef = useRef(false);
  const activeThreadIdRef = useRef<number | null>(null);
  const shouldScrollEmbeddedMessagesRef = useRef(false);
  const appliedDraftKeyRef = useRef<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;

    try {
      if (!silent) setLoading(true);
      setError(null);

      const [threadsRes, announcementsRes] = await Promise.all([
        getMessengerThreads(),
        getAnnouncements(),
      ]);

      if (!threadsRes.ok) {
        setError(threadsRes.error || 'Failed to load messages');
      }

      if (!announcementsRes.ok && !threadsRes.ok) {
        setError(announcementsRes.error || 'Failed to load announcements');
      }

      setThreads(threadsRes.threads || []);
      setAnnouncements(announcementsRes.announcements || []);

      const firstThread = (threadsRes.threads || [])[0];
      if (firstThread?.id) {
        const messageRes = await getThreadMessages(firstThread.id, { limit: 75 });
        if (messageRes.ok) {
          if (!silent) shouldScrollEmbeddedMessagesRef.current = true;
          setMessages((prev) => silent
            ? mergeMessagesById(prev, messageRes.messages || [])
            : (messageRes.messages || []));
          try { await markThreadRead(firstThread.id); } catch {}
        }
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Messages screen load error', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshIndexSummary = useCallback(async () => {
    const [threadsRes, announcementsRes] = await Promise.all([
      getMessengerThreads(),
      getAnnouncements(),
    ]);

    if (threadsRes.ok) {
      setThreads(threadsRes.threads || []);
    }

    if (announcementsRes.ok) {
      setAnnouncements(announcementsRes.announcements || []);
    }
  }, []);

  const refreshActiveThreadMessages = useCallback(async () => {
    const threadId = activeThreadIdRef.current;
    if (!threadId || messagePollingRef.current) return;

    messagePollingRef.current = true;
    try {
      const messageRes = await getThreadMessages(threadId, { limit: 75 });
      if (messageRes.ok) {
        setMessages((prev) => mergeMessagesById(prev, messageRes.messages || []));
        try { await markThreadRead(threadId); } catch {}
      }
    } catch (err) {
      console.warn('Athlete embedded thread poll failed', err);
    } finally {
      messagePollingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const messageTimer = setInterval(() => {
        refreshActiveThreadMessages();
      }, 5000);

      const broadTimer = setInterval(async () => {
        if (pollingRef.current) return;
        pollingRef.current = true;
        try {
          await refreshIndexSummary();
        } catch (err) {
          console.warn('Messages index poll failed', err);
        } finally {
          pollingRef.current = false;
        }
      }, 12000);

      return () => {
        clearInterval(messageTimer);
        clearInterval(broadTimer);
      };
    }, [load, refreshActiveThreadMessages, refreshIndexSummary])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ silent: true });
  }, [load]);

  const unreadAnnouncementCount = useMemo(() => {
    return announcements.filter((announcement) => !announcement.read_at).length;
  }, [announcements]);

  const announcementSummaryTitle = unreadAnnouncementCount
    ? `You have ${unreadAnnouncementCount} unread announcement${unreadAnnouncementCount === 1 ? '' : 's'}`
    : announcements.length
    ? 'View coach announcements'
    : 'No announcements yet';

  const activeThread = threads[0] || null;
  const routeDraft = firstParam(params.draft);
  const routeContextType = firstParam(params.contextType);
  const routeWorkoutId = firstParam(params.workoutId);
  const routeDraftNonce = firstParam(params.draftNonce);
  const draftContextKey = [routeContextType, routeWorkoutId, routeDraftNonce, routeDraft].filter(Boolean).join(':');
  const hasMissedSessionDraft = routeContextType === 'missed_session' && !!routeDraft && draft === routeDraft;

  useEffect(() => {
    if (!routeDraft || !draftContextKey || appliedDraftKeyRef.current === draftContextKey) return;
    setDraft((current) => {
      if (current.trim()) return current;
      appliedDraftKeyRef.current = draftContextKey;
      return routeDraft;
    });
  }, [draftContextKey, routeDraft]);

  useEffect(() => {
    activeThreadIdRef.current = activeThread?.id || null;
  }, [activeThread?.id]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    const attachment = selectedAttachment;
    if ((!body && !attachment) || !activeThread?.id || sending) return;

    setSending(true);

    try {
      const attachmentIds: number[] = [];
      if (attachment) {
        const upload = await uploadMessagingAttachment(activeThread.id, attachment);
        attachmentIds.push(upload.attachment_id);
      }

      const res = await sendThreadMessage(activeThread.id, body, { attachmentIds });
      if (!res.ok || !res.message) {
        setError(res.error || 'Failed to send message.');
        setDraft(body);
        return;
      }

      let sentMessage = res.message as MessengerMessage;
      if (attachmentIds.length && sentMessage.id) {
        const completeRes = await completeAttachmentUpload(attachmentIds[0], sentMessage.id);
        if (completeRes.ok && completeRes.message) {
          sentMessage = completeRes.message as MessengerMessage;
        }
      }

      setDraft('');
      setSelectedAttachment(null);
      shouldScrollEmbeddedMessagesRef.current = true;
      setMessages((prev) => mergeMessagesById(prev, [sentMessage]));
      setTimeout(() => {
        try { messageScrollRef.current?.scrollToEnd({ animated: true }); } catch {}
      }, 50);
    } catch (err) {
      console.error('Send message failed', err);
      setError('Failed to send message.');
      setDraft(body);
    } finally {
      setSending(false);
    }
  }, [activeThread?.id, draft, selectedAttachment, sending]);

  const handleChoosePhoto = useCallback(async () => {
    if (sending) return;
    try {
      const result = await pickPhotoMessagingAttachment();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.attachment) {
        setError(null);
        setSelectedAttachment(result.attachment);
      }
    } catch (err) {
      console.error('Pick photo failed', err);
      setError('Photo could not be selected.');
    }
  }, [sending]);

  const handleChooseFile = useCallback(async () => {
    if (sending) return;
    try {
      const result = await pickMessagingAttachment();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.attachment) {
        setError(null);
        setSelectedAttachment(result.attachment);
      }
    } catch (err) {
      console.error('Pick file failed', err);
      setError('Attachment could not be selected.');
    }
  }, [sending]);

  const handlePickAttachment = useCallback(() => {
    if (sending) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Choose Photo', 'Choose File', 'Cancel'],
          cancelButtonIndex: 2,
          userInterfaceStyle: 'dark',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) handleChoosePhoto();
          if (buttonIndex === 1) handleChooseFile();
        }
      );
      return;
    }

    Alert.alert('Add attachment', undefined, [
      { text: 'Choose Photo', onPress: handleChoosePhoto },
      { text: 'Choose File', onPress: handleChooseFile },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [handleChooseFile, handleChoosePhoto, sending]);

  const openReviewedVideo = useCallback((message: MessengerMessage) => {
    const videoId = videoReviewIdForMessage(message);
    if (!videoId) {
      setError('This reviewed video could not be opened from Messages.');
      return;
    }
    router.push({
      pathname: '/(tabs)/coach-reviews',
      params: { videoId: String(videoId), from: 'messages' },
    } as any);
  }, [router]);

  const openReviewedSession = useCallback((message: MessengerMessage) => {
    const workoutId = workoutIdForSessionReviewMessage(message);
    if (!workoutId) {
      setError('This reviewed session could not be opened from Messages.');
      return;
    }
    router.push({
      pathname: '/workout/[workoutId]',
      params: { workoutId: String(workoutId), from: 'messages' },
    } as any);
  }, [router]);

  useEffect(() => {
    if (!activeThread?.id) return;
    try { markThreadRead(activeThread.id); } catch {}
  }, [activeThread?.id, messages.length]);

  if (loading) {
    return (
      <ThemedView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={SLColors.accentViolet} />
        <Text style={styles.loadingText}>Loading messages…</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screenKeyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 115 : 0}
      >
        <View style={styles.athletePinnedHeader}>
          {!!error && (
            <View style={styles.errorCard}>
              <Ionicons name="warning-outline" size={16} color={SLColors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={() => router.push('/(tabs)/messages/announcements' as any)}
            style={({ pressed }) => [
              styles.announcementSummaryCard,
              pressed && styles.announcementCardPressed,
            ]}
          >
            <View style={styles.announcementSummaryIcon}>
              <Ionicons name="megaphone-outline" size={19} color={SLColors.review} />
              {!!unreadAnnouncementCount && <View style={styles.announcementSummaryDot} />}
            </View>

            <View style={styles.announcementSummaryContent}>
              <View style={styles.announcementSummaryTopRow}>
                <Text style={styles.announcementSummaryTitle} numberOfLines={2}>
                  {announcementSummaryTitle}
                </Text>
                {!!unreadAnnouncementCount && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadAnnouncementCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.announcementSummarySubline}>Tap to view coach updates</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={SLColors.textSubtle} />
          </Pressable>

          <View style={[styles.sectionHeader, styles.athleteConversationTitle]}>
            <Text style={styles.sectionTitle}>Coach Conversation</Text>
          </View>
        </View>

        <View style={styles.athleteThreadArea}>
          {activeThread ? (
            <View style={styles.embeddedThreadCard}>
              <View style={styles.embeddedThreadHeader}>
                <MessageAvatar
                  name={activeThread.coach_name || activeThread.other_user_name || 'Coach'}
                  avatarUrl={activeThread.profilePhotoUrl}
                  avatarVersion={activeThread.profilePhotoVersion}
                />

                <View style={styles.threadContent}>
                  <Text typographyRole="dynamicName" style={styles.threadName} numberOfLines={1}>
                    {activeThread.coach_name || activeThread.athlete_name || 'Conversation'}
                  </Text>
                  <Text style={styles.threadPreview}>Direct coach conversation</Text>
                </View>

                <Pressable
                  onPress={() => {
                    router.push({
                      pathname: '/(tabs)/messages/[threadId]',
                      params: {
                        threadId: String(activeThread.id),
                        athleteEmbedded: '1',
                        returnTo: 'messages',
                      },
                    } as any);
                  }}
                  style={({ pressed }) => [
                    styles.threadExpandButton,
                    pressed && styles.threadExpandButtonPressed,
                  ]}
                  accessibilityLabel="Open conversation full screen"
                >
                  <Ionicons name="expand-outline" size={18} color={SLColors.text} />
                </Pressable>
              </View>

              <ScrollView
                ref={messageScrollRef}
                style={styles.embeddedMessagesScroll}
                contentContainerStyle={styles.embeddedMessagesContent}
                nestedScrollEnabled
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={SLColors.accentViolet}
                  />
                }
                onContentSizeChange={() => {
                  if (!shouldScrollEmbeddedMessagesRef.current) return;
                  shouldScrollEmbeddedMessagesRef.current = false;
                  try { messageScrollRef.current?.scrollToEnd({ animated: false }); } catch {}
                }}
              >
                {messages.length ? (
                  messages.map((item, index) => {
                    const mine = !!item.is_mine;
                    const prev = messages[index - 1];
                    const next = messages[index + 1];
                    const showDate = !prev || formatMessageDate(prev.created_at) !== formatMessageDate(item.created_at);
                    const nextMine = !!next?.is_mine;
                    const showIncomingAvatar = !mine && (!next || nextMine);
                    const coachName = activeThread.coach_name || activeThread.other_user_name || 'Coach';
                    const coachAvatarUrl = activeThread.profilePhotoUrl;
                    const coachAvatarVersion = activeThread.profilePhotoVersion;
                    const reviewVideoId = videoReviewIdForMessage(item);
                    const showVideoReviewAction = isVideoReviewFeedbackMessage(item) && !!reviewVideoId;
                    const reviewWorkoutId = workoutIdForSessionReviewMessage(item);
                    const showSessionReviewAction = isSessionReviewFeedbackMessage(item) && !!reviewWorkoutId;

                    return (
                      <View key={String(item.id)}>
                        {showDate && (
                          <View style={styles.datePillWrap}>
                            <Text style={styles.datePillText}>{formatMessageDate(item.created_at)}</Text>
                          </View>
                        )}

                        <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
                          {!mine && (
                            <View style={styles.smallBubbleAvatarSlot}>
                              {showIncomingAvatar && (
                                <MessageAvatar
                                  name={coachName}
                                  avatarUrl={coachAvatarUrl}
                                  avatarVersion={coachAvatarVersion}
                                  size={28}
                                />
                              )}
                            </View>
                          )}
                          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                            {!mine && (
                              <Text typographyRole="bodyStrong" style={styles.senderName} numberOfLines={1}>
                                {item.sender_name || 'Coach'}
                              </Text>
                            )}

                            <LinkifiedMessageText body={item.body} mine={mine} />

                            {showVideoReviewAction ? (
                              <Pressable
                                onPress={() => openReviewedVideo(item)}
                                style={({ pressed }) => [
                                  styles.videoReviewCta,
                                  mine ? styles.videoReviewCtaMine : styles.videoReviewCtaTheirs,
                                  pressed && styles.videoReviewCtaPressed,
                                ]}
                              >
                                <Ionicons name="play-circle-outline" size={17} color={mine ? SLColors.textStrong : SLColors.success} />
                                <Text style={[styles.videoReviewCtaText, mine && styles.videoReviewCtaTextMine]}>
                                  Watch reviewed video
                                </Text>
                              </Pressable>
                            ) : null}

                            {showSessionReviewAction ? (
                              <Pressable
                                onPress={() => openReviewedSession(item)}
                                style={({ pressed }) => [
                                  styles.videoReviewCta,
                                  mine ? styles.videoReviewCtaMine : styles.videoReviewCtaTheirs,
                                  pressed && styles.videoReviewCtaPressed,
                                ]}
                              >
                                <Ionicons name="barbell-outline" size={17} color={mine ? SLColors.textStrong : SLColors.success} />
                                <Text style={[styles.videoReviewCtaText, mine && styles.videoReviewCtaTextMine]}>
                                  View session
                                </Text>
                              </Pressable>
                            ) : null}

                            {messageAttachments(item).map((attachment, attachmentIndex) => (
                              attachmentIsImage(attachment) ? (
                                <MessageImageAttachment
                                  key={`${attachment.id || attachment.filename || attachmentIndex}`}
                                  attachment={attachment}
                                  mine={mine}
                                  onError={setError}
                                />
                              ) : (
                                <MessageAttachmentChip
                                  key={`${attachment.id || attachment.filename || attachmentIndex}`}
                                  attachment={attachment}
                                  mine={mine}
                                  onError={setError}
                                />
                              )
                            ))}

                            <Text style={[styles.messageTime, mine ? styles.messageTimeMine : styles.messageTimeTheirs]}>
                              {formatMessageTime(item.created_at)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.emptyInlineThreadWrap}>
                    <Ionicons name="chatbubble-ellipses-outline" size={30} color={SLColors.textSubtle} />
                    <Text typographyRole="emptyStateTitle" style={styles.emptyThreadTitle}>No messages yet</Text>
                    <Text typographyRole="emptyStateBody" style={styles.emptyThreadBody}>Start the conversation with your coach.</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyThreadWrap}>
              <Ionicons name="chatbox-ellipses-outline" size={34} color={SLColors.textSubtle} />
              <Text typographyRole="emptyStateTitle" style={styles.emptyThreadTitle}>Conversation unavailable</Text>
              <Text typographyRole="emptyStateBody" style={styles.emptyThreadBody}>
                Your coach conversation has not been initialized yet.
              </Text>
            </View>
          )}
        </View>

        {activeThread && (
          <View style={styles.composerWrap}>
            {hasMissedSessionDraft && (
              <View style={styles.contextDraftChip}>
                <Ionicons name="alert-circle-outline" size={15} color={SLColors.danger} />
                <Text style={styles.contextDraftText}>Missed session context</Text>
              </View>
            )}
            {!!selectedAttachment && (
              <AttachmentPreviewChip
                attachment={selectedAttachment}
                onRemove={() => setSelectedAttachment(null)}
              />
            )}

            <View style={styles.composerRow}>
              <Pressable
                onPress={handlePickAttachment}
                disabled={sending}
                style={({ pressed }) => [
                  styles.attachmentButton,
                  sending && styles.attachmentButtonDisabled,
                  pressed && !sending && styles.attachmentButtonPressed,
                ]}
              >
                <Ionicons name="attach-outline" size={20} color={SLColors.text} />
              </Pressable>

              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message your coach…"
                placeholderTextColor={SLColors.textSubtle}
                style={styles.composerInput}
                multiline
                maxLength={2000}
                editable={!sending}
              />

              <Pressable
                onPress={handleSend}
                disabled={(!draft.trim() && !selectedAttachment) || sending}
                style={({ pressed }) => [
                  styles.sendButton,
                  ((!draft.trim() && !selectedAttachment) || sending) && styles.sendButtonDisabled,
                  pressed && (!!draft.trim() || !!selectedAttachment) && !sending && styles.sendButtonPressed,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={SLColors.textStrong} />
                ) : (
                  <Ionicons name="send" size={18} color={SLColors.textStrong} />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screenKeyboardWrap: {
    flex: 1,
  },
  mainScroll: {
    flex: 1,
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
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingTop: 18,
    paddingBottom: 18,
  },
  athletePinnedHeader: {
    paddingTop: 18,
    paddingBottom: 12,
  },
  athleteConversationTitle: {
    marginTop: 22,
    marginBottom: 0,
  },
  athleteThreadArea: {
    flex: 1,
    minHeight: 0,
  },
  coachContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 24,
  },
  inboxHeader: {
    paddingBottom: 10,
  },
  coachHero: {
    marginBottom: 18,
  },
  coachTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.hero.fontSize,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  coachSubtitle: {
    color: SLColors.textMuted,
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
    marginTop: 5,
  },
  inboxTopRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 18,
  },
  inboxMetricCard: {
    width: 92,
    minHeight: 64,
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(185,176,163,0.1)',
    backgroundColor: 'rgba(6,6,8,0.3)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  inboxMetricValue: {
    color: SLColors.textStrong,
    fontSize: SLTypography.title.fontSize,
    lineHeight: 26,
    fontWeight: '700',
  },
  inboxMetricLabel: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  inboxAnnouncementAction: {
    flex: 1,
    minHeight: 64,
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(185,176,163,0.1)',
    backgroundColor: 'rgba(6,6,8,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 11,
  },
  inboxAnnouncementIcon: {
    width: 36,
    height: 36,
    borderRadius: SLRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.18)',
    backgroundColor: 'rgba(20,16,28,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxAnnouncementDot: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 8,
    height: 8,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.success,
    borderWidth: 1,
    borderColor: SLColors.surfaceRaised,
  },
  inboxAnnouncementCopy: {
    flex: 1,
    minWidth: 0,
  },
  inboxAnnouncementTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: '700',
  },
  inboxAnnouncementMeta: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 9,
  },
  sectionTitle: {
    color: SLColors.text,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  announcementSummaryCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SLRadius.lg,
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  announcementSummaryIcon: {
    width: 44,
    height: 44,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,108,255,0.14)',
    marginRight: 13,
  },
  announcementSummaryDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: SLRadius.pill,
    backgroundColor: SLColors.review,
    borderWidth: 1,
    borderColor: SLColors.surfaceRaised,
  },
  announcementSummaryContent: {
    flex: 1,
    minWidth: 0,
  },
  announcementSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  announcementSummaryTitle: {
    flex: 1,
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
    lineHeight: 20,
    marginRight: 10,
  },
  announcementSummarySubline: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
  },
  announcementHubCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SLRadius.lg,
    padding: 16,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.14)',
  },
  announcementHubIcon: {
    width: 48,
    height: 48,
    borderRadius: SLRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,108,255,0.14)',
    marginRight: 14,
  },
  announcementHubText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  announcementHubTitle: {
    color: SLColors.textStrong,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: '900',
    marginBottom: 5,
  },
  announcementHubSubtitle: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
  },
  coachConversationList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(185,176,163,0.1)',
  },
  coachConversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(6,6,8,0.3)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185,176,163,0.1)',
  },
  coachConversationUnread: {
    borderLeftColor: 'rgba(167,139,250,0.44)',
    backgroundColor: 'rgba(76,29,149,0.16)',
  },
  avatarBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,108,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.20)',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
  },
  avatarTextSmall: {
    fontSize: SLTypography.label.fontSize,
  },
  coachConversationText: {
    flex: 1,
    minWidth: 0,
  },
  coachConversationTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  coachConversationName: {
    flex: 1,
    minWidth: 0,
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
  },
  coachConversationTime: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
  },
  coachConversationSub: {
    color: SLColors.textMuted,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '600',
  },
  coachConversationSubUnread: {
    color: SLColors.text,
    fontWeight: '800',
  },
  coachUnreadBadge: {
    marginHorizontal: 10,
  },
  coachStateCard: {
    marginBottom: 14,
  },
  inlineEmptyRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(185,176,163,0.1)',
    paddingVertical: 11,
  },
  inlineEmptyText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    fontWeight: '600',
  },
  emptyCoachCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SLRadius.lg,
    paddingVertical: 46,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(15,23,42,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  embeddedThreadCard: {
    flex: 1,
    minHeight: 0,
    borderRadius: SLRadius.xl,
    backgroundColor: 'rgba(6,6,8,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(185,176,163,0.1)',
    overflow: 'hidden',
  },
  embeddedThreadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.08)',
  },
  threadContent: {
    flex: 1,
    minWidth: 0,
  },
  threadName: {
    color: SLColors.textStrong,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
    marginBottom: 4,
  },
  threadPreview: {
    color: SLColors.textMuted,
    fontSize: SLTypography.label.fontSize,
    lineHeight: 18,
  },
  threadExpandButton: {
    width: 36,
    height: 36,
    borderRadius: SLRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    marginLeft: 10,
  },
  threadExpandButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  embeddedMessagesScroll: {
    flex: 1,
  },
  embeddedMessagesContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 240,
  },
  emptyInlineThreadWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 54,
  },
  datePillWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  datePillText: {
    color: SLColors.textMuted,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(2,6,23,0.55)',
    overflow: 'hidden',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  smallBubbleAvatarSlot: {
    width: 32,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginRight: 7,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: SLRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: SLColors.railViolet,
    borderColor: 'rgba(255,255,255,0.10)',
    borderTopRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: 'rgba(2,6,23,0.54)',
    borderColor: 'rgba(148,163,184,0.10)',
    borderTopLeftRadius: 6,
  },
  senderName: {
    color: SLColors.review,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    marginBottom: 4,
  },
  messageText: {
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
  },
  messageTextMine: {
    color: SLColors.textStrong,
  },
  messageTextTheirs: {
    color: SLColors.text,
  },
  messageLinkText: {
    color: SLColors.accentViolet,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  videoReviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginTop: 10,
    borderRadius: SLRadius.md,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
  },
  videoReviewCtaMine: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  videoReviewCtaTheirs: {
    backgroundColor: 'rgba(167,243,208,0.10)',
    borderColor: 'rgba(167,243,208,0.26)',
  },
  videoReviewCtaPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  videoReviewCtaText: {
    color: SLColors.success,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '900',
  },
  videoReviewCtaTextMine: {
    color: SLColors.textStrong,
  },
  messageAttachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 9,
    borderRadius: SLRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    maxWidth: '100%',
  },
  messageAttachmentChipMine: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  messageAttachmentChipTheirs: {
    backgroundColor: 'rgba(15,23,42,0.62)',
    borderColor: 'rgba(148,163,184,0.12)',
  },
  messageAttachmentChipPressed: {
    opacity: 0.82,
  },
  messageAttachmentTextWrap: {
    flexShrink: 1,
    minWidth: 0,
    marginLeft: 8,
  },
  messageAttachmentIcon: {
    flexShrink: 0,
  },
  messageAttachmentName: {
    color: SLColors.textStrong,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
    flexShrink: 1,
    minWidth: 0,
  },
  messageAttachmentSize: {
    color: 'rgba(226,232,240,0.64)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  messageTime: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  messageTimeMine: {
    color: 'rgba(248,250,252,0.68)',
  },
  messageTimeTheirs: {
    color: SLColors.textSubtle,
  },
  composerWrap: {
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: 'rgba(5,5,6,0.76)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.08)',
  },
  contextDraftChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: SLRadius.pill,
    backgroundColor: 'rgba(127,29,29,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.22)',
  },
  contextDraftText: {
    color: SLColors.danger,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachmentButton: {
    width: 42,
    height: 42,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,6,8,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    marginRight: 10,
  },
  attachmentButtonDisabled: {
    opacity: 0.45,
  },
  attachmentButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  attachmentPreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SLRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(6,6,8,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.20)',
  },
  attachmentPreviewTextWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
  },
  attachmentPreviewText: {
    color: SLColors.text,
    fontSize: SLTypography.caption.fontSize,
    fontWeight: '800',
  },
  attachmentPreviewSub: {
    color: SLColors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  attachmentRemoveButton: {
    width: 28,
    height: 28,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
    marginLeft: 10,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    borderRadius: SLRadius.lg,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: SLColors.textStrong,
    backgroundColor: 'rgba(6,6,8,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    fontSize: SLTypography.rowTitle.fontSize,
    lineHeight: 20,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(109,40,217,0.82)',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: SLRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.review,
    paddingHorizontal: 7,
  },
  unreadBadgeText: {
    color: SLColors.textStrong,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '800',
  },
  emptyThreadWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  emptyThreadTitle: {
    color: SLColors.text,
    fontSize: SLTypography.body.fontSize,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  emptyThreadBody: {
    color: SLColors.textSubtle,
    fontSize: SLTypography.label.fontSize,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: SLRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
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
  announcementCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
