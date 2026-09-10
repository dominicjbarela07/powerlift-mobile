import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import { evidenceReadCache, invalidateEvidenceReads } from '@/lib/evidence-read-cache';

/** A mounted, unfocused destination does not own a new evidence request. */
export function useEvidenceRevision() { return useSyncExternalStore(evidenceReadCache.subscribe, evidenceReadCache.snapshot); }

export function useLedgerResource<T>(subjectKey: string, loader: () => Promise<T>) {
  const { user } = useAuth();
  const focused = useIsFocused();
  const evidenceRevision = useEvidenceRevision();
  const loaderRef = useRef(loader); loaderRef.current = loader;
  const [revision, setRevision] = useState(0);
  const key = `${user?.id}:${subjectKey}:${revision}:${evidenceRevision}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: unknown; receivedAt: number } | null>(null);
  const load = useCallback(() => { invalidateEvidenceReads(); setRevision((value) => value + 1); }, []);
  useEffect(() => {
    if (!focused || (result?.key === key && Date.now() - result.receivedAt < 10_000)) return;
    let active = true;
    void loaderRef.current().then((data) => { if (active) setResult({ key, data, receivedAt: Date.now() }); },
      (error) => { if (active) setResult({ key, error, receivedAt: Date.now() }); });
    return () => { active = false; };
  }, [focused, key, result]);
  const current = result?.key === key ? result : null;
  return { data: current?.data ?? null, loading: !current, error: current?.error, load };
}
