export type CompetitionStrengthMetric = 'squat' | 'bench' | 'deadlift';

/**
 * Strength-tier evidence is deliberately narrower than general Ledger search.
 * Display names, aliases, variants, and accessory families may not qualify.
 */
export function canonicalCompetitionLiftKey(value?: string | null): CompetitionStrengthMetric | null {
  const normalized = (value || '').trim();
  if (normalized === 'competition_squat') return 'squat';
  if (normalized === 'competition_bench') return 'bench';
  if (normalized === 'competition_deadlift') return 'deadlift';
  return null;
}
