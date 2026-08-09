import { useRouter } from 'expo-router';
import React from 'react';

import AchievementsExperience from './AchievementsExperience';

import { ExperienceForScreen } from './experiences';
import { LedgerFrame } from './primitives';
import { ledgerHrefFor, LEDGER_DESTINATION_BY_KEY, type LedgerRoom, type LedgerScreen } from './routing';

export function LedgerRouteScreen({ screen }: { screen: LedgerScreen }) {
  if (screen === 'achievements') return <LedgerAchievementsRoom />;

  const destination = LEDGER_DESTINATION_BY_KEY[screen as LedgerRoom];
  if (!destination) return null;
  return (
    <LedgerFrame active={destination.key}>
      <ExperienceForScreen screen={destination.key} />
    </LedgerFrame>
  );
}

function LedgerAchievementsRoom() {
  const router = useRouter();
  return <AchievementsExperience onBack={() => router.replace(ledgerHrefFor('home') as any)} backAccessibilityLabel="Back to The Ledger" />;
}
