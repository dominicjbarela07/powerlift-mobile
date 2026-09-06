import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function DevStrengthTierCertification() {
  const { sex, scenario, unit, section, tab } = useLocalSearchParams<{
    sex?: string;
    scenario?: string;
    unit?: string;
    section?: string;
    tab?: string;
  }>();

  if (!__DEV__) return null;

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/ledger/dev-strength-tier-certification',
        params: {
          devStrengthTierCertification: '1',
          sex: sex === 'F' ? 'F' : 'M',
          scenario: scenario === 'below' || scenario === 'tier7' ? scenario : 'mid',
          ...(unit ? { unit } : {}),
          ...(section ? { section } : {}),
          ...(tab ? { tab } : {}),
        },
      } as any}
    />
  );
}
