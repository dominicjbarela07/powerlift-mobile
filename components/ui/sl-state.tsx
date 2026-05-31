import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SLButton } from './sl-button';
import { SLColors, SLRadius, SLSpacing, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type BaseStateProps = {
  title: string;
  message?: string;
  icon?: IconName;
  tone?: SLStatusTone;
  style?: StyleProp<ViewStyle>;
};

type ActionStateProps = BaseStateProps & {
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SLEmptyState({
  title,
  message,
  icon = 'checkmark-circle-outline',
  tone = 'neutral',
  actionLabel,
  onActionPress,
  style,
}: ActionStateProps) {
  return (
    <StateFrame title={title} message={message} icon={icon} tone={tone} style={style}>
      {actionLabel && onActionPress ? (
        <SLButton label={actionLabel} onPress={onActionPress} size="sm" variant="secondary" />
      ) : null}
    </StateFrame>
  );
}

export function SLErrorState({
  title,
  message,
  icon = 'alert-circle-outline',
  tone = 'danger',
  actionLabel,
  onActionPress,
  style,
}: ActionStateProps) {
  return (
    <StateFrame title={title} message={message} icon={icon} tone={tone} style={style}>
      {actionLabel && onActionPress ? (
        <SLButton label={actionLabel} onPress={onActionPress} size="sm" variant="danger" />
      ) : null}
    </StateFrame>
  );
}

export function SLLoadingState({
  title = 'Loading',
  message,
  tone = 'accent',
  style,
}: Partial<BaseStateProps>) {
  const palette = SLStatusTones[tone];

  return (
    <View style={[styles.frame, style]}>
      <ActivityIndicator color={palette.icon} size="small" />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

function StateFrame({
  title,
  message,
  icon,
  tone = 'neutral',
  children,
  style,
}: BaseStateProps & { children?: React.ReactNode }) {
  const palette = SLStatusTones[tone];

  return (
    <View style={[styles.frame, style]}>
      {icon ? (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: palette.background,
              borderColor: palette.border,
            },
          ]}
        >
          <Ionicons color={palette.icon} name={icon} size={24} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children ? <View style={styles.action}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: SLColors.surface,
    borderColor: SLColors.border,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    gap: SLSpacing.sm,
    padding: SLSpacing.xl,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: SLRadius.lg,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  title: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.cardTitle.fontFamily,
    fontSize: SLTypography.cardTitle.fontSize,
    fontWeight: SLTypography.cardTitle.fontWeight,
    letterSpacing: 0,
    lineHeight: SLTypography.cardTitle.lineHeight,
    textAlign: 'center',
  },
  message: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.body.fontFamily,
    fontSize: SLTypography.body.fontSize,
    lineHeight: SLTypography.body.lineHeight,
    textAlign: 'center',
  },
  action: {
    marginTop: SLSpacing.xs,
  },
});
