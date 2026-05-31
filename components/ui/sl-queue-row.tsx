import { Ionicons } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLAthleteAvatar } from './sl-athlete-avatar';
import { SLPriorityBadge } from './sl-priority-badge';
import { SLStatusPill } from './sl-status-pill';
import { SLColors, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type Priority = 'high' | 'medium' | 'low' | 'neutral';

type SLQueueRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  athleteName?: string | null;
  athleteImageUrl?: string | null;
  leading?: ReactNode;
  icon?: IconName;
  statusLabel?: string;
  statusTone?: SLStatusTone;
  priority?: Priority;
  priorityLabel?: string;
  rightLabel?: string;
  variant?: 'flat' | 'card' | 'priority';
  railTone?: SLStatusTone;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

export function SLQueueRow({
  title,
  subtitle,
  meta,
  athleteName,
  athleteImageUrl,
  leading,
  icon,
  statusLabel,
  statusTone = 'neutral',
  priority,
  priorityLabel,
  rightLabel,
  variant = 'card',
  railTone,
  onPress,
  style,
}: SLQueueRowProps) {
  const iconTone = statusTone !== 'neutral' ? SLStatusTones[statusTone].icon : SLColors.accentSteel;
  const leadingNode =
    leading ??
    (athleteName || athleteImageUrl ? (
      <SLAthleteAvatar imageUrl={athleteImageUrl} name={athleteName} size={38} />
    ) : icon ? (
      <View style={styles.iconWrap}>
        <Ionicons color={iconTone} name={icon} size={19} />
      </View>
    ) : null);
  const effectiveRailTone = railTone ?? (variant === 'priority' ? statusTone : undefined);
  const railColor = effectiveRailTone ? SLStatusTones[effectiveRailTone].icon : undefined;
  const variantStyle = variant === 'flat' ? styles.flatRow : variant === 'priority' ? styles.priorityRow : styles.cardRow;

  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        variantStyle,
        {
          opacity: pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      {railColor ? <View style={[styles.rail, { backgroundColor: railColor }]} /> : null}
      {leadingNode}
      <View style={styles.main}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {rightLabel ? <Text style={styles.rightLabel}>{rightLabel}</Text> : null}
        </View>
        {subtitle ? (
          <Text numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.metaLine}>
          {priority ? <SLPriorityBadge label={priorityLabel} priority={priority} /> : null}
          {statusLabel ? <SLStatusPill label={statusLabel} tone={statusTone} /> : null}
          {meta ? <Text numberOfLines={1} style={styles.meta}>{meta}</Text> : null}
        </View>
      </View>
      {onPress ? <Ionicons color={SLColors.textSubtle} name="chevron-forward" size={18} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: SLSpacing.sm,
    minHeight: 64,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
    position: 'relative',
  },
  flatRow: {
    backgroundColor: SLColors.surfaceFlat,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.radiusRow,
  },
  cardRow: {
    backgroundColor: SLColors.surface,
    borderColor: SLColors.border,
    borderRadius: SLRadius.radiusCard,
  },
  priorityRow: {
    backgroundColor: SLColors.surfaceCommand,
    borderColor: SLColors.borderSelected,
    borderRadius: SLRadius.radiusCard,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderSubtle,
    borderRadius: SLRadius.radiusRow,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  rail: {
    bottom: 8,
    left: 0,
    position: 'absolute',
    top: 8,
    width: 3,
  },
  main: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  titleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.sm,
  },
  title: {
    color: SLColors.textStrong,
    flex: 1,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    letterSpacing: SLTypography.rowTitle.letterSpacing,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  rightLabel: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  subtitle: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  metaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  meta: {
    color: SLColors.textSubtle,
    flexShrink: 1,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
});
