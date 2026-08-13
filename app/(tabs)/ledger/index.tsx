import { Redirect } from 'expo-router';
import React from 'react';

export default function LedgerIndexRoute() {
  return <Redirect href={'/(tabs)/ledger/home' as any} />;
}
