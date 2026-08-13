import { useRouter } from 'expo-router';
import React from 'react';

import AchievementsExperience from './AchievementsExperience';
import { LedgerFrame } from './primitives';
import { ledgerHrefFor, LEDGER_DESTINATION_BY_KEY, type LedgerScreen } from './routing';
import { LedgerArchiveV2Screen } from './v2/archive-screen';
import { LedgerCatalogV2Screen } from './v2/catalog-screen';
import { LedgerV2IndexScreen } from './v2/index-screen';
import { LedgerJourneyV2Screen } from './v2/journey-screen';
import { LedgerMusclesV2Screen } from './v2/muscle-screen';
import { LedgerStrengthV2Screen } from './v2/strength-screen';

export function LedgerRouteScreen({ screen }: { screen: LedgerScreen }) {
  if (screen === 'achievements') return <LedgerAchievementsRoom />;

  const destination = LEDGER_DESTINATION_BY_KEY[screen];
  if (!destination) return null;
  return (
    <LedgerFrame active={destination.key}>
      {screen === 'home' ? <LedgerV2IndexScreen /> : null}
      {screen === 'journey' ? <LedgerJourneyV2Screen /> : null}
      {screen === 'strength' ? <LedgerStrengthV2Screen /> : null}
      {screen === 'accessories' ? <LedgerCatalogV2Screen kind="accessory" /> : null}
      {screen === 'variants' ? <LedgerCatalogV2Screen kind="variant" /> : null}
      {screen === 'muscles' ? <LedgerMusclesV2Screen /> : null}
      {screen === 'archive' ? <LedgerArchiveV2Screen /> : null}
    </LedgerFrame>
  );
}

function LedgerAchievementsRoom() {
  const router = useRouter();
  return <AchievementsExperience onBack={() => router.replace(ledgerHrefFor('home') as any)} backAccessibilityLabel="Back to The Ledger" />;
}
