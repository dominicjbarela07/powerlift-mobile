import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { VariantFamilyExperience } from '@/components/ledger/VariantsExperience';
import { LedgerFrame } from '@/components/ledger/primitives';
import type { CoreVariantFamily } from '@/lib/ledger-variants';

const FAMILIES = new Set<CoreVariantFamily>(['squat', 'bench', 'deadlift']);

export default function LedgerCoreVariantFamilyRoute() {
  const params = useLocalSearchParams<{ family?: string }>();
  const rawFamily = Array.isArray(params.family) ? params.family[0] : params.family;
  const family: CoreVariantFamily = FAMILIES.has(rawFamily as CoreVariantFamily)
    ? rawFamily as CoreVariantFamily
    : 'squat';

  return (
    <LedgerFrame active="variants">
      <VariantFamilyExperience family={family} />
    </LedgerFrame>
  );
}
