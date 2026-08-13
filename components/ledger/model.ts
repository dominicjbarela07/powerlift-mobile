import type { ImageSourcePropType } from 'react-native';

import { SLMetricTones } from '@/constants/theme';

export type { LedgerDestination, LedgerScreen } from './routing';
export { LEDGER_DESTINATIONS } from './routing';

/** Decorative assets only. These must never be presented as athlete evidence. */
export const LEDGER_IMAGES = {
  squat: require('@/assets/images/squat-pr-icon-colored.png') as ImageSourcePropType,
  bench: require('@/assets/images/bench-pr-icon-colored.png') as ImageSourcePropType,
  deadlift: require('@/assets/images/deadlift-pr-icon-colored.png') as ImageSourcePropType,
} as const;

export const CORE_LIFT_PRESENTATION = [
  { key: 'Squat', color: SLMetricTones.squat.solid, image: LEDGER_IMAGES.squat },
  { key: 'Bench', color: SLMetricTones.bench.solid, image: LEDGER_IMAGES.bench },
  { key: 'Deadlift', color: SLMetricTones.deadlift.solid, image: LEDGER_IMAGES.deadlift },
] as const;

export type JourneyTag = Readonly<{ label: string; tone?: string }>;

export type JourneyMomentType =
  | 'first-workout'
  | 'session-completed'
  | 'training-anniversary'
  | 'major-pr'
  | 'biggest-pr-jump'
  | 'volume-milestone'
  | 'competition'
  | 'first-meet'
  | 'imported-history'
  | 'significant-video'
  | 'program-started'
  | 'program-completed'
  | 'block-started'
  | 'movement-added'
  | 'variant-introduced';

export type JourneyMomentImportance = 'landmark' | 'major' | 'supporting';

export type JourneyEvidenceReference = Readonly<{
  id: string;
  kind: 'workout' | 'set' | 'video' | 'coach-feedback' | 'meet' | 'historical-performance' | 'strength' | 'achievement';
  label: string;
  href: string;
}>;

export type JourneyMoment = Readonly<{
  id: string;
  type: JourneyMomentType;
  importance: JourneyMomentImportance;
  presentationPriority: number;
  year: string;
  date: string;
  occurredAt?: string;
  title: string;
  detail: string;
  icon: string;
  tone?: string;
  tags: readonly JourneyTag[];
  expandedDetail?: string;
  evidence: readonly JourneyEvidenceReference[];
  href?: string;
}>;

/** Compatibility alias for Index curation while Journey Moment naming lands. */
export type JourneyEvent = JourneyMoment;
