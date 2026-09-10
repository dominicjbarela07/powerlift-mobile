import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson } from '@/lib/api';
import { acceptsCoachingPerformance, type CoachingPerformance, type CoachingPeriod } from '@/lib/coach-performance';

export function useCoachPerformance(subject: string | undefined, athleteId: number, onAccessLost: () => void) {
  const [period, setPeriod] = useState<CoachingPeriod>('90d');
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: CoachingPerformance; error?: string } | null>(null);
  const sequence = useRef(0);
  const key = `${subject || 'unverified'}:${athleteId}:${period}:${revision}`;
  const reloadPerformance = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    setPeriod('90d');
    setResult(null);
  }, [subject, athleteId]);
  useEffect(() => {
    if (!subject) return;
    const controller = new AbortController();
    const request = ++sequence.current;
    void (async () => {
      try {
        const response = await fetchJson<{ ok: boolean; progression?: CoachingPerformance }>(
          `/athletes/mobile/progression?athlete_id=${athleteId}&range=${period}&view=coach-workspace`,
          { auth: true, signal: controller.signal },
        );
        if (controller.signal.aborted || request !== sequence.current) return;
        if ([401, 403, 404].includes(response.status)) { onAccessLost(); return; }
        if (!response.ok || !response.json?.ok) throw new Error('Performance could not be loaded.');
        if (!acceptsCoachingPerformance(response.json.progression, subject, athleteId)) { onAccessLost(); return; }
        setResult({ key, data: response.json.progression });
      } catch {
        if (!controller.signal.aborted && request === sequence.current) {
          setResult({ key, error: 'Performance is temporarily unavailable. Pull to refresh or try again.' });
        }
      }
    })();
    return () => controller.abort();
  }, [athleteId, key, onAccessLost, period, subject]);
  const current = result?.key === key ? result : null;
  return { performance: current?.data || null, performanceLoading: Boolean(subject && !current),
    performanceError: current?.error || null, period, setPeriod, reloadPerformance };
}
