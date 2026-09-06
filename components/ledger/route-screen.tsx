import { useRouter } from 'expo-router';
import React from 'react';

import AchievementsExperience from './AchievementsExperience';
import { LedgerFiltersExperience, MovementCollectionExperience, MuscleGroupsExperience } from './exploration-experiences';

import { ExperienceForScreen } from './experiences';
import { LedgerFrame } from './primitives';
import { ledgerHrefFor, LEDGER_DESTINATION_BY_KEY, type LedgerRoom, type LedgerScreen } from './routing';
import type { LedgerLiveDataFixture } from './use-ledger-live-data';

export function LedgerRouteScreen({ screen, achievementsDevFixture }: { screen: LedgerScreen; achievementsDevFixture?: LedgerLiveDataFixture }) {
  if (screen === 'achievements') return <LedgerAchievementsRoom devFixture={achievementsDevFixture} />;
  if (screen === 'accessories') return <LedgerSpecializedRoom active="accessories"><MovementCollectionExperience kind="accessories" /></LedgerSpecializedRoom>;
  if (screen === 'variants') return <LedgerSpecializedRoom active="variants"><MovementCollectionExperience kind="variants" /></LedgerSpecializedRoom>;
  if (screen === 'muscle-groups') return <LedgerSpecializedRoom active="muscle-groups"><MuscleGroupsExperience /></LedgerSpecializedRoom>;
  if (screen === 'filters') return <LedgerSpecializedRoom active="filters"><LedgerFiltersExperience /></LedgerSpecializedRoom>;

  const destination = LEDGER_DESTINATION_BY_KEY[screen as LedgerRoom];
  if (!destination) return null;
  return (
    <LedgerFrame active={destination.key}>
      <ExperienceForScreen screen={destination.key} />
    </LedgerFrame>
  );
}

function LedgerSpecializedRoom({ active, children }: React.PropsWithChildren<{ active: LedgerRoom }>) {
  return <LedgerFrame active={active}>{children}</LedgerFrame>;
}

function LedgerAchievementsRoom({ devFixture }: { devFixture?: LedgerLiveDataFixture }) {
  const router = useRouter();
  return <AchievementsExperience devFixture={__DEV__ ? devFixture : undefined} onBack={() => router.replace(ledgerHrefFor('home') as any)} backAccessibilityLabel="Back to The Ledger" />;
}
