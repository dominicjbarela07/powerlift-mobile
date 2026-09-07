import { Redirect } from 'expo-router';
import React from 'react';

/** Generic legacy progression intent resolves to the canonical Strength Overview. */
export default function LegacyProgressionRoute() {
  return <Redirect href="/(tabs)/ledger/strength" />;
}
