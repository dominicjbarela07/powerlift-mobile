import { useCallback, useEffect, useRef, useState } from 'react';

import {
  normalizeDisplayWeightUnit,
  parseDisplayWeightUnit,
  type DisplayWeightUnit,
} from '@/lib/display-units';

export function resolveSurfaceWeightUnit(
  preferredUnit?: string | null,
  inheritedUnit?: string | null,
): DisplayWeightUnit {
  return parseDisplayWeightUnit(inheritedUnit)
    || normalizeDisplayWeightUnit(preferredUnit);
}

/**
 * A display-only unit owned by one mounted page or sheet.
 *
 * The first authoritative athlete preference (or explicit parent inheritance)
 * initializes the surface. A local change then remains stable across refetches
 * and rerenders, but disappears when the surface unmounts. This hook never
 * writes account settings, AsyncStorage, Session data, or historical evidence.
 */
export function useSurfaceWeightUnit(
  preferredUnit?: string | null,
  inheritedUnit?: string | null,
) {
  const initialAuthoritativeUnit = parseDisplayWeightUnit(inheritedUnit)
    || parseDisplayWeightUnit(preferredUnit);
  const [unit, setUnitState] = useState<DisplayWeightUnit>(() => (
    initialAuthoritativeUnit || normalizeDisplayWeightUnit(preferredUnit)
  ));
  const localOverrideRef = useRef(false);
  const authoritativeUnitSeenRef = useRef(Boolean(initialAuthoritativeUnit));

  useEffect(() => {
    if (localOverrideRef.current) return;
    const next = parseDisplayWeightUnit(inheritedUnit)
      || parseDisplayWeightUnit(preferredUnit);
    if (!next || authoritativeUnitSeenRef.current) return;
    authoritativeUnitSeenRef.current = true;
    setUnitState(next);
  }, [inheritedUnit, preferredUnit]);

  const setUnit = useCallback((next: DisplayWeightUnit) => {
    localOverrideRef.current = true;
    setUnitState(next);
  }, []);

  const toggleUnit = useCallback(() => {
    setUnit(unit === 'kg' ? 'lb' : 'kg');
  }, [setUnit, unit]);

  return { unit, setUnit, toggleUnit } as const;
}
