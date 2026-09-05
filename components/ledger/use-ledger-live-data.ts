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

type LedgerLiveDataOptions = Readonly<{
  allowPartial?: boolean;
  /** Deterministic development-only evidence for visual certification routes. */
  fixture?: LedgerLiveDataFixture;
}>;

export type LedgerLiveDataFixture = Readonly<{
  progression: LedgerProgression;
  currentBests: readonly CurrentBest[];
  accomplishments?: readonly AccomplishmentEvent[];
}>;

export function useLedgerLiveData(range: LedgerRange = '90d', options: LedgerLiveDataOptions = {}) {
  const allowPartial = Boolean(options.allowPartial);
  const fixture = __DEV__ ? options.fixture : undefined;
  const [progression, setProgression] = useState<LedgerProgression | null>(fixture?.progression ?? null);
  const [currentBests, setCurrentBests] = useState<CurrentBest[]>(fixture ? [...fixture.currentBests] : []);
  const [accomplishments, setAccomplishments] = useState<AccomplishmentEvent[]>(fixture ? [...(fixture.accomplishments ?? [])] : []);
  const [loading, setLoading] = useState(!fixture);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<LedgerRequestFailureKind | null>(null);

  const reload = useCallback(async () => {
    if (fixture) {
      setProgression(fixture.progression);
      setCurrentBests([...fixture.currentBests]);
      setAccomplishments([...(fixture.accomplishments ?? [])]);
      setError(null);
      setErrorKind(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setErrorKind(null);
    try {
      const requests = [
        fetchLedgerProgression(range),
        fetchLedgerCurrentBests(),
        fetchLedgerAccomplishments(32),
      ] as const;
      if (allowPartial) {
        const [progressionResult, currentBestsResult, accomplishmentsResult] = await Promise.allSettled(requests);
        const failures = [progressionResult, currentBestsResult, accomplishmentsResult]
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failures.length === requests.length) {
          const authorizationFailure = failures.find((result) => result.reason instanceof LedgerRequestError && result.reason.kind === 'unauthorized');
          throw authorizationFailure?.reason ?? failures[0]?.reason;
        }
        if (progressionResult.status === 'fulfilled') setProgression(progressionResult.value);
        if (currentBestsResult.status === 'fulfilled') setCurrentBests(currentBestsResult.value);
        if (accomplishmentsResult.status === 'fulfilled') setAccomplishments(accomplishmentsResult.value);
        if (failures.length) {
          console.warn('Ledger Index loaded with partial canonical data', failures.map((result) => result.reason instanceof LedgerRequestError ? { kind: result.reason.kind, status: result.reason.status } : { kind: 'error' }));
        }
      } else {
        const [nextProgression, nextCurrentBests, nextAccomplishments] = await Promise.all(requests);
        setProgression(nextProgression);
        setCurrentBests(nextCurrentBests);
        setAccomplishments(nextAccomplishments);
      }
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
  }, [allowPartial, fixture, range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { progression, currentBests, accomplishments, loading, error, errorKind, reload };
}
