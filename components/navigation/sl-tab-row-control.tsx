import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { SLCanonicalIcon } from '@/components/ui/sl-trophy';
import { Text } from '@/components/ui/sl-text';
import { SLMotionPressable } from '@/components/ui/sl-motion';
import { SLColors, SLMotion, SLRadius, SLShadows, SLSpacing } from '@/constants/theme';

export const SL_TAB_ROW_FALLBACK_SHEEN = [
  'rgba(255, 255, 255, 0.12)',
  'rgba(190, 176, 218, 0.025)',
  'rgba(0, 0, 0, 0.08)',
] as const;

export const SL_TAB_ROW_SELECTED_LENS = [
  'rgba(218, 207, 238, 0.20)',
  'rgba(127, 92, 176, 0.14)',
  'rgba(48, 40, 61, 0.10)',
] as const;

/** Canonical geometry and material shared with the floating collapsed tab row. */
export const SL_TAB_ROW_CONTROL = {
  shellHeight: 48,
  shellPadding: 4,
  shellRadius: SLRadius.pill,
  shellBorderWidth: 1,
  shellBorderColor: 'rgba(244, 240, 249, 0.20)',
  materialTint: 'rgba(72, 54, 88, 0.035)',
  translucentFallback: 'rgba(13, 9, 19, 0.82)',
  reducedTransparencyFallback: 'rgba(13, 10, 19, 0.96)',
  itemSize: 40,
  itemRadius: 20,
  indicatorSize: 38,
  indicatorRadius: 19,
  indicatorBorderWidth: 1,
  indicatorBorderColor: 'rgba(218, 204, 238, 0.28)',
  iconSize: 24,
  collapsedAnchorIconSize: 20,
  hitSlop: 4,
  expandedPaddingHorizontal: SLSpacing.sm,
  labelPaddingHorizontal: SLSpacing.sm,
  selectedColor: SLColors.review,
  inactiveColor: SLColors.textMuted,
} as const;

export function SLTabRowControlShell({
  children,
  density = 'navigation',
  style,
}: {
  children: ReactNode;
  density?: 'navigation' | 'utility';
  style?: StyleProp<ViewStyle>;
}) {
  const usesUtilityScale = density === 'utility';
  return (
    <View style={[styles.shell, usesUtilityScale && styles.utilityShell, style]}>
      <View
        pointerEvents="none"
        style={[styles.materialClip, usesUtilityScale && styles.utilityMaterialClip]}
      >
        <View style={styles.translucentFallback} />
        <View style={styles.materialTint} />
        <LinearGradient
          colors={SL_TAB_ROW_FALLBACK_SHEEN}
          end={{ x: 0.72, y: 1 }}
          locations={[0, 0.48, 1]}
          start={{ x: 0.12, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      {children}
    </View>
  );
}

export function SLTabRowControlItem({
  accessibilityLabel,
  icon,
  label,
  onPress,
  selected = false,
}: {
  accessibilityLabel: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  onPress: () => void;
  selected?: boolean;
}) {
  const color = selected ? SL_TAB_ROW_CONTROL.selectedColor : SL_TAB_ROW_CONTROL.inactiveColor;
  return (
    <SLMotionPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={selected ? { selected: true } : {}}
      hitSlop={SL_TAB_ROW_CONTROL.hitSlop}
      onPress={onPress}
      pressScale={SLMotion.prominentPressScale}
      style={[styles.item, label ? styles.labelItem : null]}
    >
      {selected ? (
        <LinearGradient
          colors={SL_TAB_ROW_SELECTED_LENS}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          start={{ x: 0, y: 0 }}
          style={styles.selectedLens}
        />
      ) : null}
      {icon ? (
        <SLCanonicalIcon
          color={color}
          name={icon}
          size={SL_TAB_ROW_CONTROL.iconSize}
          trophyTier="bronze"
        />
      ) : null}
      {label ? (
        <Text numberOfLines={1} typographyRole="navigationLabel" style={[styles.label, selected && styles.selectedLabel]}>
          {label}
        </Text>
      ) : null}
    </SLMotionPressable>
  );
}

export function SLTabRowControlLabel({ children }: { children: ReactNode }) {
  return (
    <View style={styles.staticLabel}>
      <Text numberOfLines={1} typographyRole="navigationLabel" style={styles.label}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: SL_TAB_ROW_CONTROL.shellHeight,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: SL_TAB_ROW_CONTROL.shellBorderWidth,
    borderColor: SL_TAB_ROW_CONTROL.shellBorderColor,
    borderRadius: SL_TAB_ROW_CONTROL.shellRadius,
    padding: SL_TAB_ROW_CONTROL.shellPadding,
    position: 'relative',
    ...SLShadows.level2,
  },
  materialClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SL_TAB_ROW_CONTROL.shellRadius,
    overflow: 'hidden',
  },
  translucentFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SL_TAB_ROW_CONTROL.translucentFallback,
  },
  materialTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SL_TAB_ROW_CONTROL.materialTint,
  },
  item: {
    width: SL_TAB_ROW_CONTROL.itemSize,
    height: SL_TAB_ROW_CONTROL.itemSize,
    borderRadius: SL_TAB_ROW_CONTROL.itemRadius,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  labelItem: {
    width: 'auto',
    minWidth: SL_TAB_ROW_CONTROL.itemSize,
    paddingHorizontal: SL_TAB_ROW_CONTROL.labelPaddingHorizontal,
  },
  selectedLens: {
    position: 'absolute',
    width: SL_TAB_ROW_CONTROL.indicatorSize,
    height: SL_TAB_ROW_CONTROL.indicatorSize,
    borderRadius: SL_TAB_ROW_CONTROL.indicatorRadius,
    borderColor: SL_TAB_ROW_CONTROL.indicatorBorderColor,
    borderWidth: SL_TAB_ROW_CONTROL.indicatorBorderWidth,
    ...SLShadows.level1,
  },
  staticLabel: {
    height: SL_TAB_ROW_CONTROL.itemSize,
    justifyContent: 'center',
    paddingHorizontal: SL_TAB_ROW_CONTROL.shellPadding,
    zIndex: 1,
  },
  utilityShell: {
    height: SL_TAB_ROW_CONTROL.itemSize,
    borderRadius: SL_TAB_ROW_CONTROL.itemRadius,
    padding: 0,
    ...SLShadows.level1,
  },
  utilityMaterialClip: {
    borderRadius: SL_TAB_ROW_CONTROL.itemRadius,
  },
  label: {
    color: SLColors.textStrong,
  },
  selectedLabel: {
    color: SL_TAB_ROW_CONTROL.selectedColor,
  },
});
