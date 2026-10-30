import React from 'react';
import { StrengthExperience } from '@/components/ledger/StrengthExperience';
import { LedgerFrame } from '@/components/ledger/primitives';
/** Retained deeper analytical inventory, reached explicitly from a lift profile. */
export default function LedgerAnalysisRoute() {
  return <LedgerFrame active="strength"><StrengthExperience /></LedgerFrame>;
}
