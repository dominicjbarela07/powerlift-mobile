import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';

import AchievementsExperience from '@/components/ledger/AchievementsExperience';
import { strengthTierCertificationFixture } from '@/dev-mocks/fixtures/strength-tier';

export default function DevStrengthTierCertification() {
  const { sex } = useLocalSearchParams<{ sex?: string }>();
  const fixture = useMemo(() => strengthTierCertificationFixture(sex === 'F' ? 'F' : 'M'), [sex]);

  if (!__DEV__) return null;

  return (
    <>
      <Stack.Screen options={{ animation: 'none', headerShown: false }} />
      <AchievementsExperience devFixture={fixture} onBack={() => {}} backAccessibilityLabel="DEV strength-tier certification" />
    </>
  );
}
