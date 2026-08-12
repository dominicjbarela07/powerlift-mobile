import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';
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
        <Image source={{ uri: thumbnail }} style={[styles.thumbnail, compact && styles.thumbnailCompact]} />
      ) : (
        <View style={[styles.iconTile, compact && styles.thumbnailCompact]}>
          <Ionicons
            name={item.review_type === 'video' ? 'videocam-outline' : 'clipboard-outline'}
            size={compact ? 22 : 26}
            color={SLColors.accentViolet}
          />
        </View>
      )}
      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        <Text numberOfLines={2} style={styles.meta}>
          {item.athlete_name} · {formatDate(item.reviewed_at || item.submitted_at || item.date)}
        </Text>
        {item.summary ? <Text numberOfLines={2} style={styles.detail}>{item.summary}</Text> : null}
        {item.actual ? <Text numberOfLines={2} style={styles.actual}>{item.actual}</Text> : null}
        <View style={[styles.status, reviewed && styles.statusReviewed]}>
          <Text style={[styles.statusText, reviewed && styles.statusTextReviewed]}>{statusLabel(item)}</Text>
        </View>
        {reviewed && item.reviewer_name ? (
          <Text numberOfLines={1} style={styles.reviewer}>Reviewed by {item.reviewer_name}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={SLColors.accentViolet} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: SLColors.object,
    borderColor: SLColors.borderStandard,
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.md,
    minHeight: 112,
    padding: SLSpacing.md,
  },
  cardCompact: { minHeight: 98 },
  cardPressed: { backgroundColor: SLColors.surfacePressed },
  thumbnail: { borderRadius: SLRadius.md, height: 74, width: 94 },
  thumbnailCompact: { height: 62, width: 62 },
  iconTile: {
    alignItems: 'center',
    backgroundColor: SLColors.accentSoft,
    borderColor: SLColors.borderFocus,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    height: 74,
    justifyContent: 'center',
    width: 74,
  },
  content: { flex: 1, gap: 4, minWidth: 0 },
  title: { color: SLColors.textStrong, flex: 1, fontSize: 17, fontWeight: '700' },
  meta: { color: SLColors.textMuted, fontSize: 14 },
  detail: { color: SLColors.textSecondary, fontSize: 14 },
  actual: { color: SLColors.accentMuted, fontSize: 14, fontWeight: '600' },
  reviewer: { color: SLColors.success, fontSize: 12 },
  status: {
    backgroundColor: SLColors.accentSoft,
    borderColor: SLColors.borderFocus,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusReviewed: { backgroundColor: SLColors.successSoft, borderColor: SLColors.success },
  statusText: { color: SLColors.accentMuted, fontSize: 11, fontWeight: '700' },
  statusTextReviewed: { color: SLColors.success },
});
