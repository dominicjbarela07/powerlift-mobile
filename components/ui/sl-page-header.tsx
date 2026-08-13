import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLColors, SLIconSize, SLRadius, SLSpacing, SLTypography } from '@/constants/theme';
import { SLMotionPressable } from './sl-motion';
import { SLMaterialOverlay } from './sl-workspace';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backLabel?: string;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SLPageHeader({ title, subtitle, eyebrow, backLabel, onBack, actionLabel, onAction, compact, style }: Props) {
  const actionRole = actionLabel && (/\s/.test(actionLabel.trim()) || actionLabel.length > 10)
    ? 'longButtonLabel'
    : 'shortButtonLabel';
  return (
    <View style={[styles.wrap, style]}>
      {onBack ? (
        <SLMotionPressable accessibilityRole="button" onPress={onBack} style={styles.back}>
          <Ionicons color={SLColors.textMuted} name="arrow-back" size={SLIconSize.compact} />
          {backLabel ? <Text typographyRole="navigationLabel" style={styles.backLabel}>{backLabel}</Text> : null}
        </SLMotionPressable>
      ) : null}
      <View style={styles.titleRow}>
        <View style={styles.copy}>
          {eyebrow ? <Text typographyRole="shortTechnicalLabel" style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text typographyRole={compact ? 'cardTitle' : 'pageTitle'} style={compact ? styles.compactTitle : styles.title}>{title}</Text>
          {subtitle ? <Text typographyRole="supportingBody" style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actionLabel && onAction ? (
          <SLMotionPressable accessibilityRole="button" onPress={onAction} style={styles.action}>
            <SLMaterialOverlay compact level={2} />
            <Text typographyRole={actionRole} style={styles.actionLabel}>{actionLabel}</Text>
          </SLMotionPressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SLSpacing.xl, paddingTop: SLSpacing.sm },
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: SLSpacing.sm, minHeight: 28 },
  backLabel: { ...SLTypography.label, color: SLColors.textMuted },
  titleRow: { alignItems: 'flex-end', flexDirection: 'row', gap: SLSpacing.md, justifyContent: 'space-between' },
  copy: { flex: 1, gap: SLSpacing.xs },
  eyebrow: { ...SLTypography.utilityLabel, color: SLColors.textMuted, textTransform: 'uppercase', letterSpacing: 1.1 },
  title: { ...SLTypography.hero, color: SLColors.textStrong },
  compactTitle: { ...SLTypography.screenTitle, color: SLColors.textStrong },
  subtitle: { ...SLTypography.body, color: SLColors.textMuted, maxWidth: 560 },
  action: { justifyContent: 'center', minHeight: 36, paddingHorizontal: SLSpacing.md, borderRadius: SLRadius.radiusControl, backgroundColor: SLColors.surfaceFlat, borderColor: SLColors.borderSubtle, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', position: 'relative' },
  actionLabel: { ...SLTypography.label, color: SLColors.textStrong },
});
