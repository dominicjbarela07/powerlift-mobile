import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';

import { LedgerRouteScreen } from '@/components/ledger/route-screen';
import {
  strengthTierCertificationFixture,
  type StrengthTierCertificationScenario,
} from '@/dev-mocks/fixtures/strength-tier';

export default function DevStrengthTierCertificationRoute() {
  const { sex, scenario } = useLocalSearchParams<{
    sex?: string;
    scenario?: string;
  }>();
  const devFixture = useMemo(() => {
    if (!__DEV__) return undefined;
    const resolvedScenario: StrengthTierCertificationScenario =
      scenario === 'below' || scenario === 'tier7' ? scenario : 'mid';
    return strengthTierCertificationFixture(sex === 'F' ? 'F' : 'M', resolvedScenario);
  }, [scenario, sex]);

  if (!__DEV__) return null;

  return <LedgerRouteScreen achievementsDevFixture={devFixture} screen="achievements" />;
}
