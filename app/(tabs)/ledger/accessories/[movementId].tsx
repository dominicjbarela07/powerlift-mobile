import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { LedgerFrame } from '@/components/ledger/primitives';
import { LedgerCatalogDetailV2Screen } from '@/components/ledger/v2/catalog-screen';
export default function LedgerAccessoryDetailRoute() {
  const { movementId } = useLocalSearchParams<{ movementId?: string | string[] }>();
  return <LedgerFrame active="accessories"><LedgerCatalogDetailV2Screen kind="accessory" movementId={Array.isArray(movementId) ? movementId[0] : movementId || ''} /></LedgerFrame>;
}
