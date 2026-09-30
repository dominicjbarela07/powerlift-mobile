import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/sl-text';
import { SLColors } from '@/constants/theme';
import { API_BASE, type CoachReviewItem } from '@/lib/api';

function absoluteAssetUrl(value?: string | null) {
  if (!value) return null;
  return value.startsWith('http') ? value : `${API_BASE}${value}`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Date unavailable';
  const raw = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: raw.includes('T') ? 'numeric' : undefined,
    minute: raw.includes('T') ? '2-digit' : undefined,
  }).format(date);
}

function statusLabel(item: CoachReviewItem) {
  if (item.reviewed_at || item.status === 'reviewed') return 'Reviewed';
  if (item.status === 'needs_followup') return 'Follow-up';
  if (item.status === 'viewed') return 'Viewed';
  return 'Pending';
}

export function ReviewItemCard({
  item,
  onPress,
  compact = false,
}: {
  item: CoachReviewItem;
  onPress: () => void;
  compact?: boolean;
}) {
  const thumbnail = absoluteAssetUrl(item.thumbnail_url);
  const reviewed = Boolean(item.reviewed_at || item.status === 'reviewed');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title} ${item.review_type} review for ${item.athlete_name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.cardPressed]}
    >
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
      ) : (
        <View style={styles.iconTile}>
          <Ionicons
            name={item.review_type === 'video' ? 'videocam-outline' : 'clipboard-outline'}
            size={24}
            color={SLColors.accentMuted}
          />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.topLine}>
          <Text style={styles.kind}>{item.review_type === 'video' ? 'VIDEO REVIEW' : 'SESSION REVIEW'}</Text>
          <Text style={[styles.statusText, reviewed && styles.statusTextReviewed]}>{statusLabel(item).toUpperCase()}</Text>
        </View>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>{item.athlete_name} · {formatDate(item.reviewed_at || item.submitted_at || item.date)}</Text>
        {item.summary ? <Text numberOfLines={compact ? 1 : 2} style={styles.detail}>{item.summary}</Text> : null}
        {item.actual ? <Text numberOfLines={compact ? 1 : 2} style={styles.actual}>{item.actual}</Text> : null}
        {reviewed && item.reviewer_name ? (
          <Text numberOfLines={1} style={styles.reviewer}>Reviewed by {item.reviewer_name}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={SLColors.textMuted} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    backgroundColor: '#0D0C13',
    borderColor: SLColors.borderSubtle,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 106,
    padding: 13,
  },
  cardCompact: { minHeight: 102 },
  cardPressed: { backgroundColor: SLColors.surfacePressed },
  thumbnail: { backgroundColor: SLColors.surfaceMedia, borderRadius: 10, height: 72, width: 72 },
  iconTile: {
    alignItems: 'center',
    backgroundColor: '#181222',
    borderRadius: 10,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  content: { flex: 1, gap: 4, minWidth: 0 },
  topLine: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  kind: { color: SLColors.accentMuted, flexShrink: 1, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: SLColors.textStrong, fontSize: 16, fontWeight: '700' },
  meta: { color: SLColors.textMuted, fontSize: 12 },
  detail: { color: SLColors.textSecondary, fontSize: 12 },
  actual: { color: SLColors.accentMuted, fontSize: 12, fontWeight: '700' },
  reviewer: { color: SLColors.success, fontSize: 12 },
  statusText: { color: SLColors.accentMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.35 },
  statusTextReviewed: { color: SLColors.success },
  chevron: { alignSelf: 'center', marginLeft: -6 },
});
