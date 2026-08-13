import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  ArchiveRequestError,
  fetchArchiveCollection,
  fetchArchiveLanding,
  searchArchive,
} from '@/lib/ledger-archive';
import {
  fetchLedgerAccomplishmentPage,
  fetchLedgerCurrentBests,
  fetchLedgerProgression,
  LedgerRequestError,
  type LedgerRequestFailureKind,
} from '@/lib/ledger-data';
import { ledgerFixture } from './fixtures';
import { assembleLedgerV2Snapshot, type LedgerV2Requests } from './assemble';
import type { LedgerFixtureName, LedgerV2Scope, LedgerV2Snapshot } from './types';

const snapshotCache = new Map<string, LedgerV2Snapshot>();
const requestCache = new Map<string, Promise<LedgerV2Snapshot>>();

const liveRequests: LedgerV2Requests = {
  progression: fetchLedgerProgression,
  currentBests: fetchLedgerCurrentBests,
  accomplishments: () => fetchLedgerAccomplishmentPage(50),
  landing: fetchArchiveLanding,
  training: (dateFrom) => fetchArchiveCollection('training', { date_from: dateFrom, limit: 24 }),
  search: (dateFrom) => searchArchive({ date_from: dateFrom, limit: 50 }),
};

export async function loadLedgerV2Snapshot(
  scope: LedgerV2Scope,
  force = false,
  identityKey = 'current',
): Promise<LedgerV2Snapshot> {
  const cacheKey = `${identityKey}:${scope}`;
  if (!force && snapshotCache.has(cacheKey)) return snapshotCache.get(cacheKey)!;
  if (!force && requestCache.has(cacheKey)) return requestCache.get(cacheKey)!;

  const request = assembleLedgerV2Snapshot(scope, liveRequests).then((snapshot) => {
    snapshotCache.set(cacheKey, snapshot);
    return snapshot;
  }).finally(() => requestCache.delete(cacheKey));
  requestCache.set(cacheKey, request);
  return request;
}

function failureKind(error: unknown): LedgerRequestFailureKind {
  if (error instanceof LedgerRequestError) return error.kind;
  if (error instanceof ArchiveRequestError) {
    if (error.status === 401 || error.status === 403) return 'unauthorized';
    if (error.status === 404 || error.status === 410) return 'unavailable';
  }
  return 'error';
}

export function useLedgerV2Snapshot(scope: LedgerV2Scope = 'all') {
  const { user } = useAuth();
  const identityKey = String(user?.id ?? user?.user_id ?? user?.athlete_id ?? 'anonymous');
  const cacheKey = `${identityKey}:${scope}`;
  const params = useLocalSearchParams<{ ledger_fixture?: string | string[] }>();
  const fixtureName = useMemo<LedgerFixtureName | null>(() => {
    if (!__DEV__) return null;
    const raw = Array.isArray(params.ledger_fixture) ? params.ledger_fixture[0] : params.ledger_fixture;
    return raw === 'mature' || raw === 'sparse' ? raw : null;
  }, [params.ledger_fixture]);
  const fixture = useMemo(() => fixtureName ? ledgerFixture(fixtureName, scope) : null, [fixtureName, scope]);
  const [snapshot, setSnapshot] = useState<LedgerV2Snapshot | null>(() => fixture || snapshotCache.get(cacheKey) || null);
  const [loading, setLoading] = useState(!fixture && !snapshotCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<LedgerRequestFailureKind | null>(null);

  const reload = useCallback(async () => {
    if (fixture) {
      setSnapshot(fixture);
      setLoading(false);
      setError(null);
      setErrorKind(null);
      return;
    }
    setLoading(true);
    setError(null);
    setErrorKind(null);
    try {
      setSnapshot(await loadLedgerV2Snapshot(scope, true, identityKey));
    } catch (caught) {
      const kind = failureKind(caught);
      setErrorKind(kind);
      setError(kind === 'unauthorized'
        ? 'This Ledger is not available to this account.'
        : kind === 'unavailable'
          ? 'The requested Ledger evidence is unavailable.'
          : 'Ledger evidence could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [fixture, identityKey, scope]);

  useEffect(() => {
    let active = true;
    if (fixture) {
      setSnapshot(fixture);
      setLoading(false);
      setError(null);
      setErrorKind(null);
      return () => { active = false; };
    }
    setSnapshot(snapshotCache.get(cacheKey) || null);
    setLoading(!snapshotCache.has(cacheKey));
    setError(null);
    setErrorKind(null);
    loadLedgerV2Snapshot(scope, false, identityKey)
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setError(null);
        setErrorKind(null);
      })
      .catch((caught) => {
        if (!active) return;
        const kind = failureKind(caught);
        setErrorKind(kind);
        setError(kind === 'unauthorized'
          ? 'This Ledger is not available to this account.'
          : kind === 'unavailable'
            ? 'The requested Ledger evidence is unavailable.'
            : 'Ledger evidence could not be loaded.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cacheKey, fixture, identityKey, scope]);

  return { snapshot, loading, error, errorKind, reload, fixtureName };
}

export function clearLedgerV2Cache() {
  snapshotCache.clear();
  requestCache.clear();
}
