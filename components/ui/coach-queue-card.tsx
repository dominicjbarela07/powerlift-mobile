import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLCard } from './sl-card';
import { SLStatusPill } from './sl-status-pill';
import { SLColors, SLSpacing, SLTypography, type SLStatusTone } from '@/constants/theme';

type CoachQueueCardProps = {
  title: string;
  count?: number;
  subtitle?: string;
  tone?: SLStatusTone;
  statusLabel?: string;
  children?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function CoachQueueCard({
  title,
  count,
  subtitle,
  tone = 'neutral',
  statusLabel,
  children,
  onPress,
  style,
}: CoachQueueCardProps) {
  return (
    <SLCard contentStyle={styles.cardContent} onPress={onPress} style={style}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {typeof count === 'number' ? <Text style={styles.count}>{count}</Text> : null}
      </View>
      {statusLabel ? <SLStatusPill label={statusLabel} tone={tone} /> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </SLCard>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SLSpacing.sm,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.rowTitle.fontFamily,
    fontSize: SLTypography.rowTitle.fontSize,
    fontWeight: SLTypography.rowTitle.fontWeight,
    letterSpacing: SLTypography.rowTitle.letterSpacing,
    lineHeight: SLTypography.rowTitle.lineHeight,
  },
  subtitle: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.rowMeta.fontFamily,
    fontSize: SLTypography.rowMeta.fontSize,
    fontWeight: SLTypography.rowMeta.fontWeight,
    lineHeight: SLTypography.rowMeta.lineHeight,
  },
  count: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.kpiNumber.fontFamily,
    fontSize: SLTypography.kpiNumber.fontSize,
    fontWeight: SLTypography.kpiNumber.fontWeight,
    letterSpacing: SLTypography.kpiNumber.letterSpacing,
    lineHeight: SLTypography.kpiNumber.lineHeight,
  },
  cardContent: {
    gap: SLSpacing.sm,
    padding: SLSpacing.md,
  },
  body: {
    marginTop: SLSpacing.md,
  },
});
