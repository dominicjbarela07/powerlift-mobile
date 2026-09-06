import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';

import { LedgerRouteScreen } from '@/components/ledger/route-screen';
import { strengthTierCertificationFixture, type StrengthTierCertificationScenario } from '@/dev-mocks/fixtures/strength-tier';

export default function LedgerAchievementsRoute() {
  const { devStrengthTierCertification, sex, scenario } = useLocalSearchParams<{
    devStrengthTierCertification?: string;
    sex?: string;
    scenario?: string;
  }>();
  const devFixture = useMemo(() => {
    if (!__DEV__ || devStrengthTierCertification !== '1') return undefined;
    const resolvedScenario: StrengthTierCertificationScenario = scenario === 'below' || scenario === 'tier7'
      ? scenario
      : 'mid';
    return strengthTierCertificationFixture(sex === 'F' ? 'F' : 'M', resolvedScenario);
  }, [devStrengthTierCertification, scenario, sex]);

  return <LedgerRouteScreen achievementsDevFixture={devFixture} screen="achievements" />;
}
