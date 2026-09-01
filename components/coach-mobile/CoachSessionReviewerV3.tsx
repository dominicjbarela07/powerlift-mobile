import React from 'react';

import {
  CompletedSessionRecap,
  type CoachReviewContext,
  type CompletedRecapImpactSummary,
  type CompletedRecapMovement,
  type CompletedSessionRecapPayload,
} from '@/components/coach-mobile/CompletedSessionRecap';
import type { DisplayWeightUnit } from '@/lib/display-units';

type Props = {
  recap: CompletedSessionRecapPayload;
  impactSummary?: CompletedRecapImpactSummary | null;
  preferredUnits?: string | null;
  sessionTimeZone?: string | null;
  coachReview?: CoachReviewContext | null;
  coachReviewUnavailableReason?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onDone?: () => void;
  onOpenProgramming?: () => void;
  onOpenMovementHistory?: (movement: CompletedRecapMovement, unit: DisplayWeightUnit) => void;
};

/**
 * Compatibility boundary for existing coach-review routes.
 * Athlete and coach reviews intentionally render the same canonical runtime.
 */
export function CoachSessionReviewerV3({
  recap,
  impactSummary,
  preferredUnits,
  sessionTimeZone,
  coachReview,
  coachReviewUnavailableReason,
  refreshing,
  onRefresh,
  onClose,
  onDone,
  onOpenProgramming,
  onOpenMovementHistory,
}: Props) {
  const preferredUnit: DisplayWeightUnit = preferredUnits === 'kg' ? 'kg' : 'lb';
  return <CompletedSessionRecap
    recap={recap}
    impactSummary={impactSummary}
    preferredUnits={preferredUnits}
    sessionTimeZone={sessionTimeZone}
    viewerMode="coach"
    coachReview={coachReview}
    coachReviewUnavailableReason={coachReviewUnavailableReason}
    refreshing={refreshing}
    onRefresh={onRefresh}
    onClose={onClose}
    onDone={onDone}
    onOpenProgramming={onOpenProgramming}
    onOpenMovementHistory={onOpenMovementHistory ? (movement) => onOpenMovementHistory(movement, preferredUnit) : undefined}
  />;
}
