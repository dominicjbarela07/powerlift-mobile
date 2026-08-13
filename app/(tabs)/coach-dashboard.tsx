import { Redirect } from 'expo-router';
import React from 'react';

/**
 * Compatibility alias for saved links and older clients.
 *
 * Coach mobile is roster-first. Keep the legacy route resolvable without
 * retaining a second dashboard implementation or adding another tab.
 */
export default function LegacyCoachTodayRedirect() {
  return <Redirect href="/(tabs)/coach-roster" />;
}
