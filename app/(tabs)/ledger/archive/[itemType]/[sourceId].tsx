import React from 'react';

import { ArchiveDetailExperience } from '@/components/ledger/archive-detail';
import { LedgerFrame } from '@/components/ledger/primitives';

export default function LedgerArchiveDetailRoute() {
  return (
    <LedgerFrame active="archive">
      <ArchiveDetailExperience />
    </LedgerFrame>
  );
}
