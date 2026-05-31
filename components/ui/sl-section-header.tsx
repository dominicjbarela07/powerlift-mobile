import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SLColors, SLSpacing, SLTypography } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type SLSectionHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onActionPress?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SLSectionHeader({
  title,
  eyebrow,
  subtitle,
  actionLabel,
  actionIcon = 'chevron-forward',
  onActionPress,
  compact = false,
  style,
}: SLSectionHeaderProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onActionPress}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.72 : 1 }]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons color={SLColors.accent} name={actionIcon} size={15} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'space-between',
  },
  wrapCompact: {
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: SLColors.textSubtle,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.utilityLabel.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: SLTypography.utilityLabel.letterSpacing,
    lineHeight: SLTypography.utilityLabel.lineHeight,
    textTransform: 'uppercase',
  },
  title: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.sectionTitle.fontFamily,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: SLTypography.sectionTitle.fontWeight,
    letterSpacing: SLTypography.sectionTitle.letterSpacing,
    lineHeight: SLTypography.sectionTitle.lineHeight,
  },
  titleCompact: {
    fontFamily: SLTypography.sectionLabel.fontFamily,
    fontSize: SLTypography.sectionLabel.fontSize,
    fontWeight: SLTypography.sectionLabel.fontWeight,
    letterSpacing: SLTypography.sectionLabel.letterSpacing,
    lineHeight: SLTypography.sectionLabel.lineHeight,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  subtitleCompact: {
    fontSize: SLTypography.micro.fontSize,
    lineHeight: SLTypography.micro.lineHeight,
  },
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SLSpacing.xs,
    minHeight: 28,
  },
  actionText: {
    color: SLColors.accent,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.utilityLabel.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: SLTypography.utilityLabel.letterSpacing,
    lineHeight: SLTypography.utilityLabel.lineHeight,
  },
});
