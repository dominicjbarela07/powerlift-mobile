import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';

import AchievementsExperience from '@/components/ledger/AchievementsExperience';
import { strengthTierCertificationFixture, type StrengthTierCertificationScenario } from '@/dev-mocks/fixtures/strength-tier';

export default function DevStrengthTierCertification() {
  const { sex, scenario } = useLocalSearchParams<{ sex?: string; scenario?: string }>();
  const resolvedScenario: StrengthTierCertificationScenario = scenario === 'below' || scenario === 'tier7' ? scenario : 'mid';
  const fixture = useMemo(
    () => strengthTierCertificationFixture(sex === 'F' ? 'F' : 'M', resolvedScenario),
    [resolvedScenario, sex],
  );

  if (!__DEV__) return null;

  return (
    <>
      <Stack.Screen options={{ animation: 'none', headerShown: false }} />
      <AchievementsExperience devFixture={fixture} onBack={() => {}} backAccessibilityLabel="DEV strength-tier certification" />
    </>
  );
}
