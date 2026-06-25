import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState} from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MessageImageAttachment } from '@/components/MessageImageAttachment';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import {
  MessengerMessage,
  MessengerThread,
  completeAttachmentUpload,
  getThreadMessages,
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

function initialsForName(name?: string | null) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'A';
}

function avatarUrlForThread(
  thread?: MessengerThread | null,
  role?: 'coach' | 'athlete',
  fallback?: string | string[] | null
) {
  const fallbackUrl = Array.isArray(fallback) ? fallback[0] : fallback;

  if (!thread) return fallbackUrl || null;

  if (role === 'coach') {
    return thread.athlete_avatar_url || thread.other_user_avatar_url || thread.avatar_url || fallbackUrl || null;
  }

  return thread.coach_avatar_url || thread.other_user_avatar_url || thread.avatar_url || fallbackUrl || null;
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
    <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextTheirs]}>
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
  const iconName = attachmentIsImage(attachment) ? 'image-outline' : 'document-text-outline';
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
        name={iconName as any}
        size={16}
        color={mine ? '#EDE9FE' : '#C4B5FD'}
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
        color="#C4B5FD"
      />
      <View style={styles.attachmentPreviewTextWrap}>
        <Text style={styles.attachmentPreviewText} numberOfLines={1}>{attachment.name}</Text>
        <Text style={styles.attachmentPreviewSub}>{formatAttachmentSize(attachment.sizeBytes)}</Text>
      </View>
      <Pressable onPress={onRemove} style={styles.attachmentRemoveButton} hitSlop={8}>
        <Ionicons name="close" size={15} color="#FECACA" />
      </Pressable>
    </View>
  );
}

function mergeMessages(
  current: MessengerMessage[],
  incoming: MessengerMessage[]
): MessengerMessage[] {
  const merged = [...current];

  for (const msg of incoming || []) {
    const existingById = merged.findIndex((item) => String(item.id) === String(msg.id));
    if (existingById >= 0) {
      merged[existingById] = { ...merged[existingById], ...msg, pending: false, failed: false };
      continue;
    }

    const incomingTime = parseServerTimestamp(msg.created_at)?.getTime() || 0;
    const tempIdx = merged.findIndex((item) => {
      if (!item.temp_id || !item.is_mine || item.failed) return false;
      if (String(item.body || '') !== String(msg.body || '')) return false;
      const tempTime = parseServerTimestamp(item.created_at)?.getTime() || 0;
      return Math.abs(incomingTime - tempTime) < 30000;
    });

    if (tempIdx >= 0) {
      merged[tempIdx] = { ...msg, pending: false, failed: false };
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

function MessageAvatar({
  name,
  avatarUrl,
  size = 42,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
}) {
  return (
    <View style={[styles.avatarBubble, { width: size, height: size, borderRadius: size / 2 }]}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <Text style={[styles.avatarText, size <= 30 && styles.avatarTextTiny]}>
          {initialsForName(name)}
        </Text>
      )}
    </View>
  );
}

export default function MessageThreadScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ coachPlaceholder?: string }>();
  const isIndividual =
    user?.workspace_mode === 'individual' ||
      user?.is_individual_workspace === true ||
      user?.is_self_coached === true;

  React.useEffect(() => {
    if (isIndividual) {
      router.replace('/(tabs)/athlete-dashboard' as any);
    }
  }, [isIndividual, router]);

  if (isIndividual) {
    return null;
  }

  if (user?.is_coach && params.coachPlaceholder === '1') {
    return <CoachConversationPlaceholderScreen />;
  }

  return <ThreadScreen />;
}

function CoachConversationPlaceholderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ athleteName?: string; displayName?: string; avatarUrl?: string; threadId?: string }>();
  const athleteName = String(params.displayName || params.athleteName || 'Athlete');
  const avatarUrl = Array.isArray(params.avatarUrl) ? params.avatarUrl[0] : params.avatarUrl;

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.replace('/(tabs)/messages' as any)}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
        </Pressable>

          <MessageAvatar name={athleteName} avatarUrl={avatarUrl || null} size={42} />

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>{athleteName}</Text>
          <Text style={styles.headerSub}>Athlete conversation</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={32} color="#94A3B8" />
        </View>
        <Text style={styles.emptyTitle}>Conversation coming soon</Text>
        <Text style={styles.emptyBody}>Coach-to-athlete mobile messaging will open here.</Text>
      </View>
    </ThemedView>
  );
}

function ThreadScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{
    threadId?: string;
    athleteName?: string;
    displayName?: string;
    avatarUrl?: string;
    athleteEmbedded?: string;
    returnTo?: string;
  }>();
  const threadId = Number(params.threadId || 0);
  const listRef = useRef<FlatList<MessengerMessage>>(null);
  const pollingRef = useRef(false);
  const nearBottomRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState<MessengerThread | null>(null);
  const [messages, setMessages] = useState<MessengerMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<SelectedMessagingAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    const paramName = Array.isArray(params.displayName)
      ? params.displayName[0]
      : params.displayName || params.athleteName;

    if (user?.is_coach) {
      return thread?.athlete_name || thread?.other_user_name || paramName || 'Messages';
    }

    return thread?.coach_name || thread?.other_user_name || paramName || 'Messages';
  }, [params.athleteName, params.displayName, thread?.athlete_name, thread?.coach_name, thread?.other_user_name, user?.is_coach]);


  const scrollToEnd = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      try { listRef.current?.scrollToEnd({ animated }); } catch {}
    });
  }, []);

  const headerAvatarUrl = useMemo(() => {
    return avatarUrlForThread(
      thread,
      user?.is_coach ? 'coach' : 'athlete',
      params.avatarUrl
    );
  }, [params.avatarUrl, thread, user?.is_coach]);

  const handleBack = useCallback(() => {
    const athleteEmbedded = Array.isArray(params.athleteEmbedded)
      ? params.athleteEmbedded[0]
      : params.athleteEmbedded;
    const returnTo = Array.isArray(params.returnTo)
      ? params.returnTo[0]
      : params.returnTo;

    if (athleteEmbedded === '1' || returnTo === 'messages') {
      router.replace('/(tabs)/messages' as any);
      return;
    }

    router.replace('/(tabs)/messages' as any);
  }, [params.athleteEmbedded, params.returnTo, router]);


  const load = useCallback(async (opts?: {
    silent?: boolean;
    merge?: boolean;
    forceScroll?: boolean;
    skipMarkRead?: boolean;
  }) => {
    if (!threadId) {
      setError('Missing conversation.');
      setLoading(false);
      return;
    }

    try {
      if (!opts?.silent) setLoading(true);
      setError(null);

      const res = await getThreadMessages(threadId, { limit: 75 });
      if (!res.ok) {
        setError(res.error || 'Failed to load conversation.');
        return;
      }

      setThread(res.thread || null);
      setMessages((prev) => opts?.merge
        ? mergeMessages(prev, res.messages || [])
        : (res.messages || []));

      if (!opts?.skipMarkRead) {
        try { await markThreadRead(threadId); } catch {}
      }

      if (opts?.forceScroll || (!opts?.silent && nearBottomRef.current)) {
        scrollToEnd(false);
      }
    } catch (err) {
      console.error('Thread screen load error', err);
      setError('Failed to load conversation.');
    } finally {
      setLoading(false);
    }
  }, [scrollToEnd, threadId]);

  useFocusEffect(
    useCallback(() => {
      load({ forceScroll: true });
      const timer = setInterval(async () => {
        if (!threadId || pollingRef.current) return;
        pollingRef.current = true;
        try {
          await load({ silent: true, merge: true, skipMarkRead: true });
        } catch (err) {
          console.warn('Thread poll failed', err);
        } finally {
          pollingRef.current = false;
        }
      }, 5000);

      return () => clearInterval(timer);
    }, [load, threadId])
  );

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    const attachment = selectedAttachment;
    if ((!body && !attachment) || !threadId || sending) return;

    const tempId = `tmp-${Date.now()}`;

    setSending(true);

    try {
      const attachmentIds: number[] = [];
      if (attachment) {
        const upload = await uploadMessagingAttachment(threadId, attachment);
        attachmentIds.push(upload.attachment_id);
      }

      const tempMessage: MessengerMessage = {
        id: tempId,
        temp_id: tempId,
        thread_id: threadId,
        sender_name: 'You',
        body,
        message_type: body ? 'text' : 'attachment',
        attachments: attachment
          ? [{
              id: attachmentIds[0],
              filename: attachment.name,
              mime_type: attachment.mimeType,
              size_bytes: attachment.sizeBytes,
            }]
          : [],
        created_at: new Date().toISOString(),
        is_mine: true,
        pending: true,
      };

      setDraft('');
      setSelectedAttachment(null);
      setMessages((prev) => [...prev, tempMessage]);
      nearBottomRef.current = true;
      scrollToEnd(true);

      const res = await sendThreadMessage(threadId, body, { attachmentIds });
      if (!res.ok || !res.message) {
        setError(res.error || 'Failed to send message.');
        setMessages((prev) => prev.map((msg) =>
          msg.temp_id === tempId ? { ...msg, pending: false, failed: true } : msg
        ));
        return;
      }

      let sentMessage = res.message as MessengerMessage;
      if (attachmentIds.length && sentMessage.id) {
        const completeRes = await completeAttachmentUpload(attachmentIds[0], sentMessage.id);
        if (completeRes.ok && completeRes.message) {
          sentMessage = completeRes.message as MessengerMessage;
        }
      }

      setThread(res.thread || thread);
      setMessages((prev) => mergeMessages(
        prev.filter((msg) => msg.temp_id !== tempId),
        [sentMessage]
      ));

      scrollToEnd(true);
    } catch (err) {
      console.error('Send message failed', err);
      setError('Failed to send message.');
      setMessages((prev) => prev.map((msg) =>
        msg.temp_id === tempId ? { ...msg, pending: false, failed: true } : msg
      ));
    } finally {
      setSending(false);
    }
  }, [draft, scrollToEnd, selectedAttachment, sending, thread, threadId]);

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

  if (loading) {
    return (
      <ThemedView style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#8B7CFF" />
        <Text style={styles.loadingText}>Loading conversation…</Text>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 115 : 0}
      >
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Ionicons name="chevron-back" size={22} color="#F8FAFC" />
          </Pressable>

          <MessageAvatar name={title} avatarUrl={headerAvatarUrl} size={42} />

          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.headerSub}>Direct message</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {!!error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color="#FCA5A5" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FlatList
          ref={listRef}
          style={styles.messageListWrap}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            nearBottomRef.current =
              contentSize.height - contentOffset.y - layoutMeasurement.height < 120;
          }}
          scrollEventThrottle={120}
          onContentSizeChange={() => {
            if (nearBottomRef.current) scrollToEnd(false);
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyBody}>Start the conversation with your coach.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const mine = !!item.is_mine;
            const prev = messages[index - 1];
            const next = messages[index + 1];
            const showDate = !prev || formatMessageDate(prev.created_at) !== formatMessageDate(item.created_at);
            const nextIsSameIncomingSender =
              !!next &&
              !next.is_mine &&
              next.sender_id === item.sender_id &&
              formatMessageDate(next.created_at) === formatMessageDate(item.created_at);
            const showIncomingAvatar = !mine && !nextIsSameIncomingSender;
            const reviewVideoId = videoReviewIdForMessage(item);
            const showVideoReviewAction = !user?.is_coach && isVideoReviewFeedbackMessage(item) && !!reviewVideoId;
            const reviewWorkoutId = workoutIdForSessionReviewMessage(item);
            const showSessionReviewAction = !user?.is_coach && isSessionReviewFeedbackMessage(item) && !!reviewWorkoutId;

            return (
              <View>
                {showDate && (
                  <View style={styles.datePillWrap}>
                    <Text style={styles.datePillText}>{formatMessageDate(item.created_at)}</Text>
                  </View>
                )}

                <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowTheirs]}>
                  {!mine && (
                    <View style={styles.messageAvatarSlot}>
                      {showIncomingAvatar && (
                        <MessageAvatar
                          name={title}
                          avatarUrl={headerAvatarUrl}
                          size={30}
                        />
                      )}
                    </View>
                  )}

                  <View style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleTheirs,
                    item.pending && styles.bubblePending,
                    item.failed && styles.bubbleFailed,
                  ]}>
                    {!mine && (
                      <Text style={styles.senderName} numberOfLines={1}>
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
                        <Ionicons name="play-circle-outline" size={17} color={mine ? '#F8FAFC' : '#A7F3D0'} />
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
                        <Ionicons name="barbell-outline" size={17} color={mine ? '#F8FAFC' : '#A7F3D0'} />
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
                        {!!item.pending && (
                          <Text style={styles.messageStatus}>Sending...</Text>
                        )}
                        {!!item.failed && (
                          <Text style={[styles.messageStatus, styles.messageStatusFailed]}>
                            Failed to send
                          </Text>
                        )}
                      </View>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composerWrap}>
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
              <Ionicons name="attach-outline" size={20} color="#CBD5E1" />
            </Pressable>

            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={user?.is_coach ? 'Message athlete…' : 'Message your coach…'}
              placeholderTextColor="#64748B"
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
                <ActivityIndicator size="small" color="#F8FAFC" />
              ) : (
                <Ionicons name="send" size={18} color="#F8FAFC" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  keyboardWrap: {
    flex: 1,
  },
  messageListWrap: {
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
    color: '#CBD5E1',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185,176,163,0.08)',
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,6,8,0.38)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
  },
  backButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  headerTextWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  avatarBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,108,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(124,108,255,0.20)',
    overflow: 'hidden',
    marginLeft: 10,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#EDE9FE',
    fontSize: 13,
    fontWeight: '700',
  },
  avatarTextTiny: {
    fontSize: 10,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSub: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  headerSpacer: {
    width: 38,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(127,29,29,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
  },
  errorText: {
    flex: 1,
    color: '#FECACA',
    fontSize: 13,
    marginLeft: 10,
  },
  messageList: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 18,
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,6,8,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyBody: {
    color: '#64748B',
    fontSize: 13,
  },
  datePillWrap: {
    alignItems: 'center',
    marginVertical: 10,
  },
  datePillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(6,6,8,0.4)',
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
  messageAvatarSlot: {
    width: 34,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginRight: 7,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: 'rgba(109,40,217,0.84)',
    borderColor: 'rgba(255,255,255,0.10)',
    borderTopRightRadius: 6,
  },
  bubblePending: {
    opacity: 0.72,
  },
  bubbleFailed: {
    backgroundColor: 'rgba(127,29,29,0.72)',
    borderColor: 'rgba(248,113,113,0.28)',
  },
  bubbleTheirs: {
    backgroundColor: 'rgba(6,6,8,0.48)',
    borderColor: 'rgba(148,163,184,0.10)',
    borderTopLeftRadius: 6,
  },
  senderName: {
    color: '#C7BEE8',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMine: {
    color: '#F8FAFC',
  },
  messageTextTheirs: {
    color: '#E2E8F0',
  },
  messageLinkText: {
    color: '#C4B5FD',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  videoReviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginTop: 10,
    borderRadius: 12,
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
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '900',
  },
  videoReviewCtaTextMine: {
    color: '#F8FAFC',
  },
  messageAttachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 9,
    borderRadius: 12,
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
    backgroundColor: 'rgba(2,6,23,0.42)',
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
    color: '#F8FAFC',
    fontSize: 12,
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
    color: '#64748B',
  },
  messageStatus: {
    color: 'rgba(248,250,252,0.62)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageStatusFailed: {
    color: '#FCA5A5',
  },
  composerWrap: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    backgroundColor: 'rgba(5,5,6,0.76)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.08)',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachmentButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
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
    borderRadius: 14,
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
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
  },
  attachmentPreviewSub: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  attachmentRemoveButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,29,29,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.18)',
    marginLeft: 10,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#F8FAFC',
    backgroundColor: 'rgba(6,6,8,0.46)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    fontSize: 14,
    lineHeight: 20,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
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
});
