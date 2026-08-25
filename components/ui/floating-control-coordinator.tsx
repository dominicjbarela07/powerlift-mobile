import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SLMotionPressable } from '@/components/ui/sl-motion';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLRadius, SLShadows, SLSpacing } from '@/constants/theme';
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
  const safeBottom = Math.max(0, safeAreaBottom);
  const base = context === 'tab-screen'
    ? safeBottom + 70
    : context === 'sheet'
      ? safeBottom + 18
      : safeBottom + 24;
  return base + bottomOffset + (slot * 60);
}

export function FloatingControlCoordinator({
  children,
  context = 'tab-screen',
  style,
}: React.PropsWithChildren<{
  context?: FloatingControlContext;
  style?: StyleProp<ViewStyle>;
}>) {
  const insets = useSafeAreaInsets();
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
            <FloatingDisplayUnitButton
              bottom={floatingControlBottom({
                context,
                safeAreaBottom: insets.bottom,
                slot: active.slot,
                bottomOffset: active.bottomOffset,
              })}
              disabled={active.disabled}
              onChange={active.onChange}
              testID={active.testID}
              unit={active.unit}
            />
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
  bottom,
  disabled,
  onChange,
  testID,
}: {
  unit: DisplayWeightUnit;
  bottom: number;
  disabled: boolean;
  onChange: (unit: DisplayWeightUnit) => void;
  testID: string;
}) {
  const nextUnit = unit === 'kg' ? 'lb' : 'kg';
  return (
    <SLMotionPressable
      accessibilityHint="Changes only the weights shown on this surface."
      accessibilityLabel={`Display unit ${unit}. Switch to ${nextUnit}`}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => onChange(nextUnit)}
      style={[styles.button, { bottom }, disabled && styles.disabled]}
      testID={testID}
    >
      <Text maxFontSizeMultiplier={1.25} style={styles.label}>{unit}</Text>
    </SLMotionPressable>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1, minHeight: 0, position: 'relative' },
  button: {
    alignItems: 'center',
    backgroundColor: 'rgba(28, 14, 37, 0.97)',
    borderColor: 'rgba(170, 105, 255, 0.48)',
    borderRadius: SLRadius.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: SLSpacing.md,
    position: 'absolute',
    right: SLSpacing.md,
    zIndex: 40,
    ...SLShadows.level2,
  },
  disabled: { opacity: 0.45 },
  label: {
    color: SLColors.textStrong,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    textTransform: 'lowercase',
  },
});
