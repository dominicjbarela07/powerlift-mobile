import React from 'react';

import { LedgerFrame } from '@/components/ledger/primitives';
import { LedgerArchiveDetailV2Screen } from '@/components/ledger/v2/archive-screen';

export default function LedgerArchiveDetailRoute() {
  return (
    <LedgerFrame active="archive">
      <LedgerArchiveDetailV2Screen />
    </LedgerFrame>
  );
}
