export type LedgerIndexMaturityName = 'seedling' | 'building' | 'established' | 'veteran';

export type LedgerIndexDensity = 'open' | 'focused' | 'layered' | 'deep';

export type LedgerIndexModule =
  | 'first-action'
  | 'journey'
  | 'strength'
  | 'achievements'
  | 'archive'
  | 'career-snapshot'
  | 'historical-comparison'
  | 'media-evidence';

export type LedgerIndexHistorySummary = Readonly<{
  completedWorkouts: number;
  hasJourneyEvidence?: boolean;
  hasStrengthEvidence?: boolean;
  hasAchievements?: boolean;
  hasArchiveEvidence?: boolean;
  hasMediaEvidence?: boolean;
}>;

export type LedgerIndexMaturity = Readonly<{
  name: LedgerIndexMaturityName;
  reason: string;
  density: LedgerIndexDensity;
  eligibleModules: readonly LedgerIndexModule[];
  fallback: 'first-workout' | 'next-honest-step' | 'sparse-evidence' | 'career-summary';
  nextBoundary: number | null;
}>;

const STATE_DEFINITIONS: Readonly<Record<LedgerIndexMaturityName, Omit<LedgerIndexMaturity, 'reason'>>> = {
  seedling: {
    name: 'seedling',
    density: 'open',
    eligibleModules: ['first-action', 'journey', 'strength', 'achievements', 'archive'],
    fallback: 'first-workout',
    nextBoundary: 10,
  },
  building: {
    name: 'building',
    density: 'focused',
    eligibleModules: ['journey', 'strength', 'achievements', 'archive', 'historical-comparison'],
    fallback: 'next-honest-step',
    nextBoundary: 100,
  },
  established: {
    name: 'established',
    density: 'layered',
    eligibleModules: ['journey', 'strength', 'achievements', 'archive', 'historical-comparison', 'media-evidence'],
    fallback: 'sparse-evidence',
    nextBoundary: 500,
  },
  veteran: {
    name: 'veteran',
    density: 'deep',
    eligibleModules: ['career-snapshot', 'journey', 'strength', 'achievements', 'archive', 'historical-comparison', 'media-evidence'],
    fallback: 'career-summary',
    nextBoundary: null,
  },
};

export function resolveLedgerIndexMaturity(summary: LedgerIndexHistorySummary): LedgerIndexMaturity {
  const completedWorkouts = Number.isFinite(summary.completedWorkouts)
    ? Math.max(0, Math.floor(summary.completedWorkouts))
    : 0;
  const name: LedgerIndexMaturityName = completedWorkouts >= 500
    ? 'veteran'
    : completedWorkouts >= 100
      ? 'established'
      : completedWorkouts >= 10
        ? 'building'
        : 'seedling';
  const definition = STATE_DEFINITIONS[name];
  const evidenceCount = [
    summary.hasJourneyEvidence,
    summary.hasStrengthEvidence,
    summary.hasAchievements,
    summary.hasArchiveEvidence,
    summary.hasMediaEvidence,
  ].filter(Boolean).length;

  return {
    ...definition,
    reason: `${completedWorkouts} canonical completed Training Session${completedWorkouts === 1 ? '' : 's'}; ${evidenceCount} eligible evidence source${evidenceCount === 1 ? '' : 's'}.`,
  };
}

export type LedgerDailySignal =
  | 'anniversary'
  | 'major-pr'
  | 'achievement'
  | 'meet'
  | 'reviewed-video'
  | 'strength-change'
  | 'rediscovery'
  | 'next-milestone'
  | 'early-action';

export type LedgerDailySignalAvailability = Readonly<Partial<Record<LedgerDailySignal, boolean>>>;

export const LEDGER_DAILY_SIGNAL_PRIORITY: readonly LedgerDailySignal[] = [
  'anniversary',
  'major-pr',
  'achievement',
  'meet',
  'reviewed-video',
  'strength-change',
  'rediscovery',
  'next-milestone',
  'early-action',
];

export function selectLedgerDailySignal(availability: LedgerDailySignalAvailability): LedgerDailySignal {
  return LEDGER_DAILY_SIGNAL_PRIORITY.find((signal) => availability[signal]) ?? 'early-action';
}

export function progressToNextMaturity(completedWorkouts: number, maturity: LedgerIndexMaturity): number {
  if (maturity.nextBoundary === null) return 1;
  const previousBoundary = maturity.name === 'seedling' ? 0 : maturity.name === 'building' ? 10 : 100;
  const span = maturity.nextBoundary - previousBoundary;
  return Math.max(0, Math.min(1, (completedWorkouts - previousBoundary) / span));
}
