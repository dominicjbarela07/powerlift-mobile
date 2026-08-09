import type { ImageSourcePropType, ImageStyle } from 'react-native';

import { SLColors } from '@/constants/theme';
import { resolvePlateStackRender } from '@/lib/barbell/plate-stack-render-resolver';
import {
  KG_PER_LB,
  formatLoggerWeightKg,
} from '@/lib/logger-weight-format';
import {
  resolveLoggerPrescribedWeight,
  type ResolvedLoggerPrescribedWeight,
} from '@/lib/logger-prescribed-weight';
import {
  type PlateClubLiftKey,
} from '@/lib/barbell/milestone-render-assets';

export type LoggerLiftIdentity = {
  key: PlateClubLiftKey | 'accessory';
  label: string;
  accentColor: string;
  iconSource: ImageSourcePropType | null;
};

export type LoggerProgressEvidence =
  | {
      kind: 'weight_pr';
      qualification: 'qualified';
      targetWeightKg: number;
      previousWeightKg: number;
    }
  | {
      kind: 'rep_max';
      qualification: 'qualified';
      targetWeightKg: number;
      previousWeightKg: number;
      reps: number;
    }
  | {
      kind: 'plate_milestone';
      qualification: 'qualified';
      remainingWeightKg: number;
      milestoneLabel: string;
    }
  | {
      kind: 'matched_best';
      qualification: 'qualified';
      weightKg: number;
      reps: number;
    }
  | {
      kind: 'prior_session';
      qualification: 'qualified';
      weightKg: number;
      reps: number;
      rpe?: number | null;
      rir?: number | null;
      date?: string | null;
    };

export type LoggerProgressContext = {
  kind: LoggerProgressEvidence['kind'];
  eyebrow: string;
  primary: string;
  supporting: string | null;
  accessibilityLabel: string;
};

export type LoggerPlateStack = {
  imageSource: ImageSourcePropType;
  requestedWeight: number;
  requestedUnit: 'kg' | 'lb';
  catalogKeyLb: number;
  accessibilityLabel: string;
  presentationStyle?: ImageStyle;
};

type LoggerVisualItem = {
  lift?: string | null;
  movement?: string | null;
  target_low_kg?: number | null;
  target_high_kg?: number | null;
  lookback_best?: Record<string, unknown> | null;
  last_best?: Record<string, unknown> | null;
  prev_best?: Record<string, unknown> | null;
  progress_context?: LoggerProgressEvidence | null;
};

const LIFT_IDENTITIES: Record<PlateClubLiftKey, LoggerLiftIdentity> = {
  squat: {
    key: 'squat',
    label: 'Squat',
    accentColor: SLColors.accentViolet,
    iconSource: require('@/assets/images/lift-icons/achievement-material-v2/squat.png'),
  },
  bench: {
    key: 'bench',
    label: 'Bench',
    accentColor: SLColors.accentMagenta,
    iconSource: require('@/assets/images/lift-icons/achievement-material-v2/bench.png'),
  },
  deadlift: {
    key: 'deadlift',
    label: 'Deadlift',
    accentColor: SLColors.danger,
    iconSource: require('@/assets/images/lift-icons/achievement-material-v2/deadlift.png'),
  },
};

export function resolveLoggerLiftIdentity(item: LoggerVisualItem): LoggerLiftIdentity {
  const lift = String(item.lift || '').trim().toUpperCase();
  const movement = String(item.movement || '').trim().toLowerCase();
  if (lift === 'SQ' || movement.includes('squat')) return LIFT_IDENTITIES.squat;
  if (lift === 'BN' || movement.includes('bench')) return LIFT_IDENTITIES.bench;
  if (lift === 'DL' || movement.includes('deadlift')) return LIFT_IDENTITIES.deadlift;
  return {
    key: 'accessory',
    label: 'Accessory',
    accentColor: SLColors.textMuted,
    iconSource: null,
  };
}

function formattedWeight(weightKg: number, unit: 'kg' | 'lb') {
  return `${formatLoggerWeightKg(weightKg, unit)} ${unit}`;
}

function normalizedLookback(item: LoggerVisualItem): LoggerProgressEvidence | null {
  const best = item.lookback_best || item.last_best || item.prev_best;
  if (!best) return null;
  const weightKg = Number(best.actual_weight_kg ?? best.weight_kg);
  const reps = Number(best.actual_reps ?? best.reps);
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  const rpe = Number(best.actual_rpe ?? best.rpe);
  const rir = Number(best.actual_rir ?? best.rir);
  return {
    kind: 'prior_session',
    qualification: 'qualified',
    weightKg,
    reps,
    rpe: Number.isFinite(rpe) ? rpe : null,
    rir: Number.isFinite(rir) ? rir : null,
    date: best.date ? String(best.date).slice(0, 10) : null,
  };
}

export function resolveLoggerProgressContext(
  item: LoggerVisualItem,
  unit: 'kg' | 'lb',
): LoggerProgressContext | null {
  const evidence = item.progress_context?.qualification === 'qualified'
    ? item.progress_context
    : normalizedLookback(item);
  if (!evidence) return null;

  if (evidence.kind === 'weight_pr') {
    if (evidence.targetWeightKg <= evidence.previousWeightKg) return null;
    const primary = `${formattedWeight(evidence.targetWeightKg, unit)} is a PR today.`;
    const supporting = `Current best ${formattedWeight(evidence.previousWeightKg, unit)}`;
    return {
      kind: evidence.kind,
      eyebrow: 'You’re close',
      primary,
      supporting,
      accessibilityLabel: `${primary} ${supporting}`,
    };
  }

  if (evidence.kind === 'rep_max') {
    if (evidence.targetWeightKg <= evidence.previousWeightKg || evidence.reps <= 0) return null;
    const primary = `${formattedWeight(evidence.targetWeightKg, unit)} × ${evidence.reps} would improve your ${evidence.reps} Rep Max.`;
    const supporting = `Previous: ${formattedWeight(evidence.previousWeightKg, unit)} × ${evidence.reps}`;
    return {
      kind: evidence.kind,
      eyebrow: 'Rep-Max opportunity',
      primary,
      supporting,
      accessibilityLabel: `${primary} ${supporting}`,
    };
  }

  if (evidence.kind === 'plate_milestone') {
    if (evidence.remainingWeightKg <= 0 || !evidence.milestoneLabel.trim()) return null;
    const primary = `${formattedWeight(evidence.remainingWeightKg, unit)} from ${evidence.milestoneLabel}.`;
    return {
      kind: evidence.kind,
      eyebrow: 'Landmark nearby',
      primary,
      supporting: null,
      accessibilityLabel: primary,
    };
  }

  if (evidence.kind === 'matched_best') {
    const primary = `Matched your best at ${formattedWeight(evidence.weightKg, unit)} × ${evidence.reps}.`;
    return {
      kind: evidence.kind,
      eyebrow: 'Within reach',
      primary,
      supporting: null,
      accessibilityLabel: primary,
    };
  }

  let primary = `Last time: ${formattedWeight(evidence.weightKg, unit)} × ${evidence.reps}`;
  if (evidence.rpe != null) primary += ` @${evidence.rpe}`;
  if (evidence.rir != null) primary += ` · ${evidence.rir} RIR`;
  const supporting = evidence.date ? evidence.date : null;
  return {
    kind: evidence.kind,
    eyebrow: 'Previous exposure',
    primary,
    supporting,
    accessibilityLabel: supporting ? `${primary}. ${supporting}` : primary,
  };
}

export function resolveLoggerPlateStack(
  item: LoggerVisualItem,
  unit: 'kg' | 'lb',
  prescribedWeight: ResolvedLoggerPrescribedWeight | null =
    resolveLoggerPrescribedWeight({ item, unit }),
): LoggerPlateStack | null {
  const identity = resolveLoggerLiftIdentity(item);
  if (identity.key === 'accessory') return null;

  if (!prescribedWeight || prescribedWeight.requestedUnit !== unit) return null;
  const render = resolvePlateStackRender({
    weight: prescribedWeight.requestedWeight,
    unit: prescribedWeight.requestedUnit,
  });
  if (!render) return null;

  return {
    imageSource: render.imageSource,
    requestedWeight: prescribedWeight.requestedWeight,
    requestedUnit: prescribedWeight.requestedUnit,
    catalogKeyLb: render.catalogKeyLb,
    accessibilityLabel: `${prescribedWeight.requestedWeight} ${unit === 'kg' ? 'kilogram' : 'pound'} ${identity.label.toLowerCase()} plate stack`,
  };
}

export function resolveLoggerPlateStackForDisplayWeight(
  item: LoggerVisualItem,
  weight: number,
  unit: 'kg' | 'lb',
): LoggerPlateStack | null {
  if (!Number.isFinite(weight) || weight <= 0) return null;
  const canonicalWeightKg = unit === 'kg' ? weight : weight * KG_PER_LB;
  const prescribedWeight = resolveLoggerPrescribedWeight({
    item: {
      target_low_kg: canonicalWeightKg,
      target_high_kg: canonicalWeightKg,
    },
    unit,
  });
  return resolveLoggerPlateStack(item, unit, prescribedWeight);
}
