import {
  exactAccessoryLastExposure,
  isExactComparableAccessoryHistory,
  type ExactAccessoryHistoryPayload,
  type ExactAccessoryHistorySet,
} from '@/lib/exact-accessory-history';
import {
  formatPerformedLoad,
  type PerformedLoadSemantics,
} from '@/lib/performed-load-semantics';

export type AccessoryLastBestCue = Readonly<{
  kind: 'last_best' | 'first_exact_exposure' | 'unavailable';
  eyebrow: 'LAST BEST' | 'HISTORY';
  primary: string;
  supporting: string | null;
  accessibilityLabel: string;
  comparisonIdentityKey: string | null;
  sourceSetId: number | null;
}>;

type AccessoryLastBestHistory = ExactAccessoryHistoryPayload<ExactAccessoryHistorySet>;

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compactNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function shortHistoryDate(value?: string | null): string | null {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (!Number.isFinite(date.valueOf())) return null;
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function unavailableCue(history: AccessoryLastBestHistory): AccessoryLastBestCue {
  const needsEquipmentContext = history?.comparison_scope === 'exact_implementation'
    && !history?.comparison_allowed;
  const primary = needsEquipmentContext
    ? 'Equipment-specific history unavailable'
    : 'Exact history unavailable';
  const supporting = needsEquipmentContext
    ? 'Equipment context is not selected yet.'
    : 'No reliable exact comparison is available yet.';
  return {
    kind: 'unavailable',
    eyebrow: 'HISTORY',
    primary,
    supporting,
    accessibilityLabel: `${primary}. ${supporting}`,
    comparisonIdentityKey: null,
    sourceSetId: null,
  };
}

export function buildAccessoryLastBestCue({
  history,
  semantics,
  unit,
}: {
  history: AccessoryLastBestHistory;
  semantics?: PerformedLoadSemantics | null;
  unit: 'kg' | 'lb';
}): AccessoryLastBestCue {
  if (!isExactComparableAccessoryHistory(history)) return unavailableCue(history);

  const comparisonIdentityKey = history?.comparison_identity_key || null;
  const prior = exactAccessoryLastExposure(history);
  if (!prior) {
    const primary = 'First exact exposure';
    const supporting = 'No prior exact performance yet.';
    return {
      kind: 'first_exact_exposure',
      eyebrow: 'HISTORY',
      primary,
      supporting,
      accessibilityLabel: `${primary}. ${supporting}`,
      comparisonIdentityKey,
      sourceSetId: null,
    };
  }

  const weightKg = finiteNumber(prior.weight_kg);
  const reps = finiteNumber(prior.reps);
  if (weightKg == null || reps == null || reps <= 0) return unavailableCue(history);
  const load = formatPerformedLoad(weightKg, unit, semantics);
  if (!load) return unavailableCue(history);

  const rir = finiteNumber(prior.rir);
  const rpe = finiteNumber(prior.rpe);
  const effort = rir != null
    ? ` @${compactNumber(rir)} RIR`
    : rpe != null
      ? ` @${compactNumber(rpe)} RPE`
      : '';
  const primary = `${load} × ${compactNumber(reps)}${effort}`;
  const supporting = shortHistoryDate(prior.date);
  return {
    kind: 'last_best',
    eyebrow: 'LAST BEST',
    primary,
    supporting,
    accessibilityLabel: ['Last best', primary, supporting].filter(Boolean).join('. '),
    comparisonIdentityKey,
    sourceSetId: finiteNumber(prior.id),
  };
}

export function accessoryLastBestInlineText(cue: AccessoryLastBestCue): string {
  if (cue.kind !== 'last_best') return cue.primary;
  return [`Last best: ${cue.primary}`, cue.supporting].filter(Boolean).join(' · ');
}
