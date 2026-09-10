import { useEvidenceRevision } from './use-ledger-resource';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { invalidateEvidenceReads } from '@/lib/evidence-read-cache';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  type StrengthStandardProjection,
  type StrengthStandingProjection,
} from '@/lib/ledger-data';
import { useAthleteLedgerSubject } from './athlete-ledger-subject';

type LedgerLiveDataOptions = Readonly<{
  allowPartial?: boolean;
  projection?: 'ledger-index';
  /** Relationship-authorized athlete subject for coach-owned Ledger routes. */
  athleteId?: number;
  /** Deterministic development-only evidence for visual certification routes. */
  fixture?: LedgerLiveDataFixture;
}>;

export type LedgerLiveDataFixture = Readonly<{
  progression: LedgerProgression;
  currentBests: readonly CurrentBest[];
  accomplishments?: readonly AccomplishmentEvent[];
  strengthStandard?: StrengthStandardProjection | null;
  strengthStanding?: StrengthStandingProjection | null;
}>;

export function useLedgerLiveData(range: LedgerRange = '90d', options: LedgerLiveDataOptions = {}) {
  const ledgerSubject = useAthleteLedgerSubject();
  const focused = useIsFocused();
  const evidenceRevision = useEvidenceRevision();
  const { user } = useAuth();
  const sequence = useRef(0);
  const receivedAt = useRef(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const allowPartial = Boolean(options.allowPartial);
  const projection = options.projection;
  const athleteId = options.athleteId ?? ledgerSubject.athleteId;
  const fixture = __DEV__ ? options.fixture : undefined;
  const key = `${user?.id}:${athleteId ?? "self"}:${range}:${projection}:${ledgerSubject.valid}:${evidenceRevision}`;
  const currentKey = useRef(key); currentKey.current = key;
  const [progression, setProgression] = useState<LedgerProgression | null>(fixture?.progression ?? null);
  const [currentBests, setCurrentBests] = useState<CurrentBest[]>(fixture ? [...fixture.currentBests] : []);
  const [accomplishments, setAccomplishments] = useState<AccomplishmentEvent[]>(fixture ? [...(fixture.accomplishments ?? [])] : []);
  const [strengthStandard, setStrengthStandard] = useState<StrengthStandardProjection | null>(fixture?.strengthStandard ?? fixture?.progression.strength_standard ?? null);
  const [strengthStanding, setStrengthStanding] = useState<StrengthStandingProjection | null>(fixture?.strengthStanding ?? null);
  const [loading, setLoading] = useState(!fixture);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<LedgerRequestFailureKind | null>(null);

  const reload = useCallback(async (force = true) => {
    const request = ++sequence.current;
    const active = () => request === sequence.current && currentKey.current === key;
    if (force) invalidateEvidenceReads();
    if (!ledgerSubject.valid) return;
    if (fixture) {
      setProgression(fixture.progression);
      setCurrentBests([...fixture.currentBests]);
      setAccomplishments([...(fixture.accomplishments ?? [])]);
      setStrengthStandard(fixture.strengthStandard ?? fixture.progression.strength_standard ?? null);
      setStrengthStanding(fixture.strengthStanding ?? null);
      setError(null);
      setErrorKind(null);
      setLoading(false);
      setLoadedKey(key);
      return;
    }
    setLoading(true);
    setError(null);
    setErrorKind(null);
    try {
      const requests = [
        fetchLedgerProgression(range, athleteId, projection),
        fetchLedgerCurrentBests(athleteId),
        fetchLedgerAccomplishments(32, athleteId),
      ] as const;
      if (allowPartial) {
        const [progressionResult, currentBestsResult, accomplishmentsResult] = await Promise.allSettled(requests);
        if (!active()) return;
        const failures = [progressionResult, currentBestsResult, accomplishmentsResult]
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected');
        const authorizationFailure = failures.find((result) => result.reason instanceof LedgerRequestError && result.reason.kind === 'unauthorized');
        if (authorizationFailure || failures.length === requests.length) {
          throw authorizationFailure?.reason ?? failures[0]?.reason;
        }
        setProgression(progressionResult.status === 'fulfilled' ? progressionResult.value : null);
        if (currentBestsResult.status === 'fulfilled') {
          setCurrentBests(currentBestsResult.value.items);
          setStrengthStandard(currentBestsResult.value.strengthStandard ?? (progressionResult.status === 'fulfilled' ? progressionResult.value.strength_standard ?? null : null));
          setStrengthStanding(currentBestsResult.value.strengthStanding);
        } else {
          setCurrentBests([]);
          setStrengthStanding(null);
          setStrengthStandard(progressionResult.status === 'fulfilled' ? progressionResult.value.strength_standard ?? null : null);
        }
        setAccomplishments(accomplishmentsResult.status === 'fulfilled' ? accomplishmentsResult.value : []);
        if (failures.length) {
          console.warn('Ledger Index loaded with partial canonical data', failures.map((result) => result.reason instanceof LedgerRequestError ? { kind: result.reason.kind, status: result.reason.status } : { kind: 'error' }));
        }
      } else {
        const [nextProgression, nextCurrentBests, nextAccomplishments] = await Promise.all(requests);
        if (!active()) return;
        setProgression(nextProgression);
        setCurrentBests(nextCurrentBests.items);
        setStrengthStandard(nextCurrentBests.strengthStandard ?? nextProgression.strength_standard ?? null);
        setStrengthStanding(nextCurrentBests.strengthStanding);
        setAccomplishments(nextAccomplishments);
      }
      receivedAt.current = Date.now();
      setLoadedKey(key);
    } catch (caught) {
      if (!active()) return;
      setLoadedKey(key);
      setProgression(null); setCurrentBests([]); setAccomplishments([]);
      setStrengthStandard(null); setStrengthStanding(null);
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
      if (active()) { receivedAt.current = Date.now(); setLoading(false); }
    }
  }, [allowPartial, athleteId, fixture, key, ledgerSubject.valid, projection, range]);

  useEffect(() => {
    if (focused && (loadedKey !== key || Date.now() - receivedAt.current >= 10_000)) void reload(false);
  }, [focused, key, loadedKey, reload]);
  useEffect(() => () => { sequence.current += 1; }, []);

  const visible = Boolean(fixture || loadedKey === key);
  return { progression: visible ? progression : null, currentBests: visible ? currentBests : [],
    accomplishments: visible ? accomplishments : [], strengthStandard: visible ? strengthStandard : null,
    strengthStanding: visible ? strengthStanding : null, loading: !visible || loading,
    error: visible ? error : null, errorKind: visible ? errorKind : null, reload };
}
