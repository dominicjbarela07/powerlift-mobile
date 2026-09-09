import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { type ReactNode, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SLCanonicalIcon } from '@/components/ui/sl-trophy';
import { Text } from '@/components/ui/sl-text';
import { SLMotionPressable } from '@/components/ui/sl-motion';
import { SLColors, SLLayout, SLMotion, SLRadius, SLShadows, SLSpacing } from '@/constants/theme';

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

/** Canonical geometry and material shared by the persistent global tab row. */
export const SL_TAB_ROW_CONTROL = {
  dockFrameHeight: 58,
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
  hitSlop: 4,
  expandedPaddingHorizontal: SLSpacing.sm,
  labelPaddingHorizontal: SLSpacing.sm,
  selectedColor: SLColors.review,
  inactiveColor: SLColors.textMuted,
} as const;

export type SLFloatingNavigationDockItem = {
  accessibilityLabel: string;
  badge?: number | 'dot';
  icon: keyof typeof Ionicons.glyphMap;
  key: string;
  onLongPress?: () => void;
  onPress: () => void;
  selected?: boolean;
};

function supportsNativeLiquidGlass() {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/**
 * The one canonical floating navigation object used by the global app shell
 * and any focused workspace that replaces it with context-local destinations.
 */
export function SLFloatingNavigationDock({
  bottomInset,
  flow = false,
  items,
}: {
  bottomInset: number;
  flow?: boolean;
  items: SLFloatingNavigationDockItem[];
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const usesNativeLiquidGlass = supportsNativeLiquidGlass() && !reduceTransparency;
  const expandedWidth = Math.max(
    SL_TAB_ROW_CONTROL.shellHeight,
    viewportWidth - (SLLayout.screenGutter * 2),
  );

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (mounted) setReduceTransparency(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.navigationDock,
        flow && styles.navigationDockFlow,
        {
          height: SL_TAB_ROW_CONTROL.dockFrameHeight + bottomInset,
          paddingBottom: bottomInset + SLSpacing.xs,
        },
      ]}
    >
      <View
        style={[
          styles.navigationShell,
          usesNativeLiquidGlass && styles.navigationShellNativeMaterial,
          { width: expandedWidth },
        ]}
      >
        <View pointerEvents="none" style={styles.navigationMaterialClip}>
          {usesNativeLiquidGlass ? (
            <GlassView
              colorScheme="dark"
              glassEffectStyle="regular"
              style={[StyleSheet.absoluteFillObject, styles.navigationNativeGlass]}
              tintColor="rgba(103, 82, 132, 0.045)"
            />
          ) : Platform.OS === 'ios' && !reduceTransparency ? (
            <BlurView
              intensity={72}
              style={StyleSheet.absoluteFillObject}
              tint="systemThinMaterialDark"
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                reduceTransparency
                  ? styles.navigationReducedTransparency
                  : styles.navigationTranslucentFallback,
              ]}
            />
          )}
          {!usesNativeLiquidGlass ? (
            <>
              <View style={styles.navigationFallbackTint} />
              <LinearGradient
                colors={SL_TAB_ROW_FALLBACK_SHEEN}
                end={{ x: 0.72, y: 1 }}
                locations={[0, 0.48, 1]}
                start={{ x: 0.12, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </>
          ) : null}
        </View>

        {items.map((item) => {
          const icon = item.selected && item.icon.endsWith('-outline')
            ? (item.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap)
            : item.icon;
          const color = item.selected
            ? SL_TAB_ROW_CONTROL.selectedColor
            : SL_TAB_ROW_CONTROL.inactiveColor;
          return (
            <View key={item.key} style={styles.navigationSlot}>
              {item.selected ? (
                <LinearGradient
                  colors={SL_TAB_ROW_SELECTED_LENS}
                  end={{ x: 1, y: 1 }}
                  pointerEvents="none"
                  start={{ x: 0, y: 0 }}
                  style={styles.navigationSelectedLens}
                />
              ) : null}
              <SLMotionPressable
                accessibilityLabel={item.accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={item.selected ? { selected: true } : {}}
                hitSlop={SL_TAB_ROW_CONTROL.hitSlop}
                onLongPress={item.onLongPress}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  item.onPress();
                }}
                pressScale={SLMotion.prominentPressScale}
                style={styles.navigationItem}
              >
                <View style={styles.navigationIconRow}>
                  <SLCanonicalIcon
                    color={color}
                    name={icon}
                    size={SL_TAB_ROW_CONTROL.iconSize}
                    trophyTier="bronze"
                  />
                </View>
              </SLMotionPressable>
              {item.badge === 'dot' ? <View pointerEvents="none" style={styles.notificationDot} /> : null}
              {typeof item.badge === 'number' && item.badge > 0 ? (
                <View pointerEvents="none" style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

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
  navigationDock: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    paddingHorizontal: SLLayout.screenGutter,
    position: 'absolute',
    right: 0,
    zIndex: 20,
  },
  navigationDockFlow: {
    flexShrink: 0,
    position: 'relative',
  },
  navigationShell: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: SL_TAB_ROW_CONTROL.shellBorderColor,
    borderRadius: SL_TAB_ROW_CONTROL.shellRadius,
    borderWidth: SL_TAB_ROW_CONTROL.shellBorderWidth,
    flexDirection: 'row',
    height: SL_TAB_ROW_CONTROL.shellHeight,
    justifyContent: 'space-between',
    padding: SL_TAB_ROW_CONTROL.shellPadding,
    paddingHorizontal: SL_TAB_ROW_CONTROL.expandedPaddingHorizontal,
    position: 'relative',
    ...SLShadows.level2,
  },
  navigationMaterialClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SL_TAB_ROW_CONTROL.shellRadius,
    overflow: 'hidden',
  },
  navigationShellNativeMaterial: { borderColor: 'transparent' },
  navigationNativeGlass: { borderRadius: SL_TAB_ROW_CONTROL.shellRadius },
  navigationFallbackTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SL_TAB_ROW_CONTROL.materialTint,
  },
  navigationTranslucentFallback: { backgroundColor: SL_TAB_ROW_CONTROL.translucentFallback },
  navigationReducedTransparency: { backgroundColor: SL_TAB_ROW_CONTROL.reducedTransparencyFallback },
  navigationSlot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    position: 'relative',
  },
  navigationItem: {
    alignItems: 'center',
    borderRadius: SL_TAB_ROW_CONTROL.itemRadius,
    height: SL_TAB_ROW_CONTROL.itemSize,
    justifyContent: 'center',
    overflow: 'hidden',
    width: SL_TAB_ROW_CONTROL.itemSize,
    zIndex: 1,
  },
  navigationSelectedLens: {
    borderColor: SL_TAB_ROW_CONTROL.indicatorBorderColor,
    borderRadius: SL_TAB_ROW_CONTROL.indicatorRadius,
    borderWidth: SL_TAB_ROW_CONTROL.indicatorBorderWidth,
    height: SL_TAB_ROW_CONTROL.indicatorSize,
    position: 'absolute',
    width: SL_TAB_ROW_CONTROL.indicatorSize,
    ...SLShadows.level1,
  },
  navigationIconRow: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  notificationDot: {
    backgroundColor: SLColors.danger,
    borderColor: SLColors.shellCanvas,
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    height: 8,
    left: '50%',
    marginLeft: 8,
    position: 'absolute',
    top: 0,
    width: 8,
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: SLColors.danger,
    borderColor: SLColors.shellCanvas,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    left: '50%',
    marginLeft: 7,
    minHeight: 15,
    minWidth: 15,
    paddingHorizontal: 3,
    position: 'absolute',
    top: -3,
  },
  countBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
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
