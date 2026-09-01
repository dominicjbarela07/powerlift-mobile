import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SL_TAB_ROW_CONTROL,
  SL_TAB_ROW_SELECTED_LENS,
  SLTabRowControlShell,
} from '@/components/navigation/sl-tab-row-control';
import { SLMotionPressable } from '@/components/ui/sl-motion';
import { SLCanonicalIcon } from '@/components/ui/sl-trophy';
import { Text } from '@/components/ui/sl-text';
import { LinearGradient } from 'expo-linear-gradient';
import { SLColors, SLLayout, SLMotion, SLSpacing } from '@/constants/theme';
import type { DisplayWeightUnit } from '@/lib/display-units';

export type FloatingControlContext = 'tab-screen' | 'screen' | 'sheet';
export type FloatingTrailingSlot = 0 | 1 | 2;

type UnitRegistration = Readonly<{
  id: symbol;
  unit: DisplayWeightUnit;
  onChange: (unit: DisplayWeightUnit) => void;
  slot: FloatingTrailingSlot;
  bottomOffset: number;
  disabled: boolean;
  testID: string;
}>;

type CoordinatorValue = Readonly<{
  register: (registration: UnitRegistration) => () => void;
}>;

const CoordinatorContext = createContext<CoordinatorValue | null>(null);

/**
 * Canonical geometry for edge-anchored mobile utilities. The collapsed tab row
 * is the reference control, so utility controls share its outer diameter,
 * material, right-edge centerline, and interaction scale.
 */
export const SL_FLOATING_CONTROL = {
  size: SL_TAB_ROW_CONTROL.shellHeight,
  itemSize: SL_TAB_ROW_CONTROL.itemSize,
  rightInset: SLLayout.screenGutter,
  gap: SLSpacing.sm,
  tabBarBottomInset: SLSpacing.xs,
  screenBottomInset: SLSpacing.xxl,
  sheetBottomInset: SLSpacing.lg + SLSpacing.xxs,
} as const;

export function floatingControlStackBottom({
  context,
  safeAreaBottom,
  bottomOffset = 0,
}: {
  context: FloatingControlContext;
  safeAreaBottom: number;
  bottomOffset?: number;
}) {
  const safeBottom = Math.max(0, safeAreaBottom);
  const base = context === 'tab-screen'
    ? safeBottom
      + SL_FLOATING_CONTROL.tabBarBottomInset
      + SL_TAB_ROW_CONTROL.shellHeight
      + SL_FLOATING_CONTROL.gap
    : context === 'sheet'
      ? safeBottom + SL_FLOATING_CONTROL.sheetBottomInset
      : safeBottom + SL_FLOATING_CONTROL.screenBottomInset;
  return base + bottomOffset;
}

export function floatingControlBottom({
  context,
  safeAreaBottom,
  slot,
  bottomOffset = 0,
}: {
  context: FloatingControlContext;
  safeAreaBottom: number;
  slot: FloatingTrailingSlot;
  bottomOffset?: number;
}) {
  return floatingControlStackBottom({ context, safeAreaBottom, bottomOffset })
    + (slot * (SL_FLOATING_CONTROL.size + SL_FLOATING_CONTROL.gap));
}

export function FloatingControlStack({
  children,
  context = 'tab-screen',
  slot = 0,
  bottomOffset = 0,
  style,
}: {
  children: ReactNode;
  context?: FloatingControlContext;
  slot?: FloatingTrailingSlot;
  bottomOffset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.stack,
        {
          bottom: floatingControlBottom({
            context,
            safeAreaBottom: insets.bottom,
            slot,
            bottomOffset,
          }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function FloatingUtilityButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  icon,
  label,
  onPress,
  selected = false,
  testID,
  wide = false,
}: {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  onPress: () => unknown | Promise<unknown>;
  selected?: boolean;
  testID?: string;
  wide?: boolean;
}) {
  const foreground = selected ? SL_TAB_ROW_CONTROL.selectedColor : SLColors.textStrong;
  return (
    <SLTabRowControlShell style={[styles.utilityShell, wide && styles.utilityShellWide]}>
      <SLMotionPressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        hitSlop={SL_TAB_ROW_CONTROL.hitSlop}
        onPress={onPress}
        pressScale={SLMotion.prominentPressScale}
        style={[styles.utilityAction, wide && styles.utilityActionWide]}
        testID={testID}
      >
        {selected ? (
          <LinearGradient
            colors={SL_TAB_ROW_SELECTED_LENS}
            end={{ x: 1, y: 1 }}
            pointerEvents="none"
            start={{ x: 0, y: 0 }}
            style={styles.utilitySelectedLens}
          />
        ) : null}
        {icon ? (
          <SLCanonicalIcon
            color={foreground}
            name={icon}
            size={SL_TAB_ROW_CONTROL.iconSize}
            trophyTier="bronze"
          />
        ) : null}
        {label ? (
          <Text
            maxFontSizeMultiplier={1.25}
            numberOfLines={1}
            style={[styles.utilityLabel, wide && styles.utilityLabelWide, selected && styles.utilityLabelSelected]}
          >
            {label}
          </Text>
        ) : null}
      </SLMotionPressable>
    </SLTabRowControlShell>
  );
}

export function FloatingControlCoordinator({
  children,
  context = 'tab-screen',
  style,
}: React.PropsWithChildren<{
  context?: FloatingControlContext;
  style?: StyleProp<ViewStyle>;
}>) {
  const [registrations, setRegistrations] = useState<UnitRegistration[]>([]);
  const register = useCallback((registration: UnitRegistration) => {
    setRegistrations((current) => [...current.filter((item) => item.id !== registration.id), registration]);
    return () => setRegistrations((current) => current.filter((item) => item.id !== registration.id));
  }, []);
  const value = useMemo(() => ({ register }), [register]);
  const active = registrations.at(-1) || null;

  return (
    <CoordinatorContext.Provider value={value}>
      <View style={[styles.host, style]}>
        {children}
        {active ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
            <FloatingControlStack context={context} slot={active.slot} bottomOffset={active.bottomOffset}>
              <FloatingDisplayUnitButton
                disabled={active.disabled}
                onChange={active.onChange}
                testID={active.testID}
                unit={active.unit}
              />
            </FloatingControlStack>
          </View>
        ) : null}
      </View>
    </CoordinatorContext.Provider>
  );
}

export function FloatingDisplayUnitRegistration({
  unit,
  onChange,
  slot = 0,
  bottomOffset = 0,
  disabled = false,
  testID = 'floating-display-unit-control',
}: {
  unit: DisplayWeightUnit;
  onChange: (unit: DisplayWeightUnit) => void;
  slot?: FloatingTrailingSlot;
  bottomOffset?: number;
  disabled?: boolean;
  testID?: string;
}) {
  const coordinator = useContext(CoordinatorContext);
  const id = useRef(Symbol(testID)).current;

  useEffect(() => {
    if (!coordinator) return undefined;
    return coordinator.register({ id, unit, onChange, slot, bottomOffset, disabled, testID });
  }, [bottomOffset, coordinator, disabled, id, onChange, slot, testID, unit]);

  if (__DEV__ && !coordinator) {
    console.warn(`[floating-control] ${testID} has no FloatingControlCoordinator host`);
  }
  return null;
}

function FloatingDisplayUnitButton({
  unit,
  disabled,
  onChange,
  testID,
}: {
  unit: DisplayWeightUnit;
  disabled: boolean;
  onChange: (unit: DisplayWeightUnit) => void;
  testID: string;
}) {
  const nextUnit = unit === 'kg' ? 'lb' : 'kg';
  return (
    <FloatingUtilityButton
      accessibilityHint="Changes only the weights shown on this surface."
      accessibilityLabel={`Display unit ${unit}. Switch to ${nextUnit}`}
      disabled={disabled}
      label={unit}
      onPress={() => onChange(nextUnit)}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 0, position: 'relative' },
  stack: {
    alignItems: 'flex-end',
    gap: SL_FLOATING_CONTROL.gap,
    position: 'absolute',
    right: SL_FLOATING_CONTROL.rightInset,
    zIndex: 40,
  },
  utilityShell: {
    height: SL_FLOATING_CONTROL.size,
    width: SL_FLOATING_CONTROL.size,
  },
  utilityShellWide: {
    minWidth: SL_FLOATING_CONTROL.size,
    width: 'auto',
  },
  utilityAction: {
    alignItems: 'center',
    borderRadius: SL_TAB_ROW_CONTROL.itemRadius,
    height: SL_TAB_ROW_CONTROL.itemSize,
    justifyContent: 'center',
    overflow: 'hidden',
    width: SL_TAB_ROW_CONTROL.itemSize,
    zIndex: 1,
  },
  utilityActionWide: {
    minWidth: SL_TAB_ROW_CONTROL.itemSize,
    paddingHorizontal: SLSpacing.md,
    width: 'auto',
  },
  utilitySelectedLens: {
    borderColor: SL_TAB_ROW_CONTROL.indicatorBorderColor,
    borderRadius: SL_TAB_ROW_CONTROL.indicatorRadius,
    borderWidth: SL_TAB_ROW_CONTROL.indicatorBorderWidth,
    height: SL_TAB_ROW_CONTROL.indicatorSize,
    position: 'absolute',
    width: SL_TAB_ROW_CONTROL.indicatorSize,
  },
  utilityLabel: {
    color: SLColors.textStrong,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    textTransform: 'lowercase',
  },
  utilityLabelWide: {
    textTransform: 'none',
  },
  utilityLabelSelected: {
    color: SL_TAB_ROW_CONTROL.selectedColor,
  },
});
