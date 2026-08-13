import { Ionicons } from '@expo/vector-icons';
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLAthleteAvatar } from './sl-athlete-avatar';
import { SLPriorityBadge } from './sl-priority-badge';
import { SLStatusPill } from './sl-status-pill';
import { SLMaterialOverlay } from './sl-workspace';
import { SLColors, SLControlSize, SLOpacity, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type Priority = 'high' | 'medium' | 'low' | 'neutral';

type SLQueueRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  athleteName?: string | null;
  athleteImageUrl?: string | null;
  athleteImageVersion?: string | null;
  leading?: ReactNode;
  icon?: IconName;
  statusLabel?: string;
  statusTone?: SLStatusTone;
  priority?: Priority;
  priorityLabel?: string;
  rightLabel?: string;
  variant?: 'flat' | 'card' | 'priority';
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

export function SLQueueRow({
  title,
  subtitle,
  meta,
  athleteName,
  athleteImageUrl,
  athleteImageVersion,
  leading,
  icon,
  statusLabel,
  statusTone = 'neutral',
  priority,
  priorityLabel,
  rightLabel,
  variant = 'card',
  onPress,
  style,
}: SLQueueRowProps) {
  const iconTone = statusTone !== 'neutral' ? SLStatusTones[statusTone].icon : SLColors.accentSteel;
  const leadingNode =
    leading ??
    (athleteName || athleteImageUrl ? (
      <SLAthleteAvatar
        imageUrl={athleteImageUrl}
        imageVersion={athleteImageVersion}
        name={athleteName}
        size={38}
      />
    ) : icon ? (
      <View style={styles.iconWrap}>
        <Ionicons color={iconTone} name={icon} size={19} />
      </View>
    ) : null);
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
          opacity: pressed ? SLOpacity.pressed : 1,
        },
        style,
      ]}
    >
      <SLMaterialOverlay compact level={variant === 'priority' ? 3 : variant === 'flat' ? 1 : 2} />
      {leadingNode}
      <View style={styles.main}>
        <View style={styles.titleLine}>
          <Text numberOfLines={1} typographyRole="bodyStrong" style={styles.title}>
            {title}
          </Text>
          {rightLabel ? <Text typographyRole="label" style={styles.rightLabel}>{rightLabel}</Text> : null}
        </View>
        {subtitle ? (
          <Text numberOfLines={2} typographyRole="supportingBody" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.metaLine}>
          {priority ? <SLPriorityBadge label={priorityLabel} priority={priority} /> : null}
          {statusLabel ? <SLStatusPill label={statusLabel} tone={statusTone} /> : null}
          {meta ? <Text numberOfLines={1} typographyRole="caption" style={styles.meta}>{meta}</Text> : null}
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
    minHeight: SLControlSize.queueRow,
    paddingHorizontal: SLSpacing.md,
    paddingVertical: SLSpacing.sm,
    overflow: 'hidden',
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
