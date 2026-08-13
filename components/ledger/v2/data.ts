import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import type { LedgerFixtureName, LedgerV2Scope, LedgerV2Snapshot } from './types';

const snapshotCache = new Map<LedgerV2Scope, LedgerV2Snapshot>();
const requestCache = new Map<LedgerV2Scope, Promise<LedgerV2Snapshot>>();

function scopeDateFrom(scope: LedgerV2Scope, today = new Date()): string {
  if (scope === 'all') return '1900-01-01';
  if (scope === 'year') return `${today.getFullYear()}-01-01`;
  const start = new Date(today);
  start.setDate(start.getDate() - 89);
  return start.toISOString().slice(0, 10);
}

function apiRange(scope: LedgerV2Scope): '90d' | '1y' | 'all' {
  if (scope === '3m') return '90d';
  if (scope === 'year') return '1y';
  return 'all';
}

export async function loadLedgerV2Snapshot(scope: LedgerV2Scope, force = false): Promise<LedgerV2Snapshot> {
  if (!force && snapshotCache.has(scope)) return snapshotCache.get(scope)!;
  if (!force && requestCache.has(scope)) return requestCache.get(scope)!;

  const dateFrom = scopeDateFrom(scope);
  const range = apiRange(scope);
  const request = Promise.all([
    fetchLedgerProgression(range),
    fetchLedgerCurrentBests(),
    fetchLedgerAccomplishmentPage(50),
    fetchArchiveLanding(),
    fetchArchiveCollection('training', { date_from: dateFrom, limit: 24 }),
    searchArchive({ date_from: dateFrom, limit: 50 }),
  ]).then(([progression, currentBests, accomplishmentPage, landing, training, evidence]) => {
    const snapshot: LedgerV2Snapshot = {
      scope,
      apiRange: range,
      dateFrom,
      progression,
      currentBests,
      accomplishments: accomplishmentPage.items,
      landing,
      sessions: training.items,
      evidence: evidence.items,
    };
    snapshotCache.set(scope, snapshot);
    return snapshot;
  }).finally(() => requestCache.delete(scope));
  requestCache.set(scope, request);
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
  const params = useLocalSearchParams<{ ledger_fixture?: string | string[] }>();
  const fixtureName = useMemo<LedgerFixtureName | null>(() => {
    if (!__DEV__) return null;
    const raw = Array.isArray(params.ledger_fixture) ? params.ledger_fixture[0] : params.ledger_fixture;
    return raw === 'mature' || raw === 'sparse' ? raw : null;
  }, [params.ledger_fixture]);
  const fixture = useMemo(() => fixtureName ? ledgerFixture(fixtureName, scope) : null, [fixtureName, scope]);
  const [snapshot, setSnapshot] = useState<LedgerV2Snapshot | null>(() => fixture || snapshotCache.get(scope) || null);
  const [loading, setLoading] = useState(!fixture && !snapshotCache.has(scope));
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
      setSnapshot(await loadLedgerV2Snapshot(scope, true));
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
  }, [fixture, scope]);

  useEffect(() => {
    let active = true;
    if (fixture) {
      setSnapshot(fixture);
      setLoading(false);
      setError(null);
      setErrorKind(null);
      return () => { active = false; };
    }
    setSnapshot(snapshotCache.get(scope) || null);
    setLoading(!snapshotCache.has(scope));
    loadLedgerV2Snapshot(scope)
      .then((next) => { if (active) setSnapshot(next); })
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
  }, [fixture, scope]);

  return { snapshot, loading, error, errorKind, reload, fixtureName };
}

export function clearLedgerV2Cache() {
  snapshotCache.clear();
  requestCache.clear();
}
