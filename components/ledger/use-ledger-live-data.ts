import { useCallback, useEffect, useState } from 'react';

import {
  fetchLedgerAccomplishments,
  fetchLedgerCurrentBests,
  fetchLedgerProgression,
  type AccomplishmentEvent,
  type CurrentBest,
  type LedgerProgression,
  type LedgerRange,
  LedgerRequestError,
  type LedgerRequestFailureKind,
} from '@/lib/ledger-data';

export function useLedgerLiveData(range: LedgerRange = '90d') {
  const [progression, setProgression] = useState<LedgerProgression | null>(null);
  const [currentBests, setCurrentBests] = useState<CurrentBest[]>([]);
  const [accomplishments, setAccomplishments] = useState<AccomplishmentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<LedgerRequestFailureKind | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorKind(null);
    try {
      const [nextProgression, nextCurrentBests, nextAccomplishments] = await Promise.all([
        fetchLedgerProgression(range),
        fetchLedgerCurrentBests(),
        fetchLedgerAccomplishments(32),
      ]);
      setProgression(nextProgression);
      setCurrentBests(nextCurrentBests);
      setAccomplishments(nextAccomplishments);
    } catch (caught) {
      console.warn('Ledger canonical data request failed', caught);
      if (caught instanceof LedgerRequestError) {
        setErrorKind(caught.kind);
        setError(caught.kind === 'unauthorized'
          ? 'This Ledger is not available to this account.'
          : caught.kind === 'unavailable'
            ? 'The requested Ledger evidence is unavailable.'
            : 'Ledger data could not be loaded.');
      } else {
        setErrorKind('error');
        setError('Ledger data could not be loaded.');
      }
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { progression, currentBests, accomplishments, loading, error, errorKind, reload };
}
