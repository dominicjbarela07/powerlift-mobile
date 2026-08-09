import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { SLColors, SLRadius, SLStatusTones, SLTypography, type SLStatusTone } from '@/constants/theme';
import { SLMaterialOverlay } from './sl-workspace';

type CoachMetric = {
  label: string;
  value: string | number;
  tone?: SLStatusTone;
};

type CoachMetricStripProps = {
  metrics: CoachMetric[];
  style?: StyleProp<ViewStyle>;
};

export function CoachMetricStrip({ metrics, style }: CoachMetricStripProps) {
  return (
    <View style={[styles.strip, style]}>
      <SLMaterialOverlay compact level={2} />
      {metrics.map((metric) => {
        const tone = metric.tone ? SLStatusTones[metric.tone] : null;
        return (
          <View key={metric.label} style={styles.metric}>
            <Text style={[styles.value, tone ? { color: tone.icon } : null]}>{metric.value}</Text>
            <Text numberOfLines={2} style={styles.label}>
              {metric.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: SLColors.surface,
    borderColor: SLColors.border,
    borderRadius: SLRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    overflow: 'hidden',
    padding: 6,
    position: 'relative',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
    minWidth: 0,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  value: {
    color: SLColors.textStrong,
    fontFamily: SLTypography.kpiNumber.fontFamily,
    fontSize: SLTypography.sectionTitle.fontSize,
    fontWeight: SLTypography.kpiNumber.fontWeight,
    letterSpacing: SLTypography.kpiNumber.letterSpacing,
    lineHeight: 22,
  },
  label: {
    color: SLColors.textMuted,
    fontFamily: SLTypography.utilityLabel.fontFamily,
    fontSize: SLTypography.utilityLabel.fontSize,
    fontWeight: SLTypography.utilityLabel.fontWeight,
    letterSpacing: SLTypography.utilityLabel.letterSpacing,
    lineHeight: 13,
    textAlign: 'center',
  },
});
