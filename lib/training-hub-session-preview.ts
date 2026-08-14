import {
  resolveCalendarSessionStatus,
  type CalendarSessionLifecycle,
} from './calendar-session-status';

export type TrainingHubSessionPreviewAction = {
  ctaLabel: 'Open Session' | 'Continue Session' | 'View Session Recap' | null;
  lifecycle: CalendarSessionLifecycle;
  openable: boolean;
  statusLabel: string;
};

type PreviewStatusInput = {
  fallbackStatus?: string | null;
  stateLabel?: string | null;
  status?: string | null;
};

const HUB_NOT_STARTED_ALIASES = new Set(['today', 'upcoming', 'moved']);
const NON_OPENABLE_STATUSES = new Set(['archived', 'cancelled', 'canceled', 'draft']);

function normalized(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export function resolveTrainingHubSessionPreviewAction({
  fallbackStatus,
  stateLabel,
  status,
}: PreviewStatusInput): TrainingHubSessionPreviewAction {
  const authoritativeStatus = normalized(status) || normalized(fallbackStatus);
  const fallback = normalized(fallbackStatus);
  const explicitlyUnavailable = NON_OPENABLE_STATUSES.has(authoritativeStatus);
  const resolved = resolveCalendarSessionStatus(authoritativeStatus || fallback);
  const lifecycle = resolved.lifecycle === 'other' && HUB_NOT_STARTED_ALIASES.has(fallback)
    ? 'not_started'
    : resolved.lifecycle;

  if (explicitlyUnavailable || lifecycle === 'canceled' || lifecycle === 'other') {
    return {
      ctaLabel: null,
      lifecycle,
      openable: false,
      statusLabel: explicitlyUnavailable
        ? resolveCalendarSessionStatus(authoritativeStatus).label
        : stateLabel || resolved.label,
    };
  }

  if (lifecycle === 'completed') {
    return {
      ctaLabel: 'View Session Recap',
      lifecycle,
      openable: true,
      statusLabel: stateLabel || resolved.label,
    };
  }

  if (lifecycle === 'in_progress') {
    return {
      ctaLabel: 'Continue Session',
      lifecycle,
      openable: true,
      statusLabel: stateLabel || resolved.label,
    };
  }

  return {
    ctaLabel: 'Open Session',
    lifecycle,
    openable: true,
    statusLabel: stateLabel || resolved.label,
  };
}

export function formatTrainingHubPreviewDate(value?: string | null) {
  if (!value) return 'DATE NOT SET';
  const parsed = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return String(value).toUpperCase();
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'long',
  }).toUpperCase();
}

export function trainingHubMovementPrescription(input: {
  prescription?: string | null;
  reps?: number | null;
  repsText?: string | null;
  sets?: number | null;
}) {
  const canonical = String(input.prescription || '').trim();
  if (canonical) return canonical;

  const sets = Number(input.sets);
  const reps = String(input.repsText || (input.reps != null ? input.reps : '')).trim();
  if (Number.isFinite(sets) && sets > 0 && reps) return `${sets} × ${reps}`;
  if (Number.isFinite(sets) && sets > 0) return `${sets} ${sets === 1 ? 'set' : 'sets'}`;
  return 'Prescription not available';
}
