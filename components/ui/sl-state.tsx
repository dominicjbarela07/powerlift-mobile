import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLButton } from './sl-button';
import { SLMotionEntrance } from './sl-motion';
import { SLMaterialOverlay } from './sl-workspace';
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
    <SLMotionEntrance motionKey={`loading-${title}`} distance={SLSpacing.xs} style={[styles.frame, style]}>
      <ActivityIndicator color={palette.icon} size="small" />
      <Text typographyRole="emptyStateTitle" style={styles.title}>{title}</Text>
      {message ? <Text typographyRole="emptyStateBody" style={styles.message}>{message}</Text> : null}
    </SLMotionEntrance>
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
    <SLMotionEntrance motionKey={`${tone}-${title}`} distance={SLSpacing.xs} style={[styles.frame, style]}>
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
          <SLMaterialOverlay compact level={2} />
          <Ionicons color={palette.icon} name={icon} size={24} />
        </View>
      ) : null}
      <Text typographyRole="emptyStateTitle" style={styles.title}>{title}</Text>
      {message ? <Text typographyRole="emptyStateBody" style={styles.message}>{message}</Text> : null}
      {children ? <View style={styles.action}>{children}</View> : null}
    </SLMotionEntrance>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: SLSpacing.md,
    paddingHorizontal: SLSpacing.xl,
    paddingVertical: SLSpacing.xxxl,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: SLRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 52,
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
