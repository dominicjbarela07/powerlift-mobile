export type CoreLoggerMovementState = 'complete' | 'logged' | 'not_started';

export function coreLoggerMovementStateLabel(state: CoreLoggerMovementState) {
  if (state === 'complete') return 'Completed';
  if (state === 'logged') return 'In progress';
  return 'Not started';
}

export function coreLoggerVisibleMovementNote(
  expanded: boolean | undefined,
  movementNote: string | null | undefined,
) {
  return expanded ? String(movementNote || '').trim() : '';
}

export function coreLoggerVisibleExpandedContent<T>(
  expanded: boolean | undefined,
  content: T | null | undefined,
) {
  return expanded ? content ?? null : null;
}

type CoreLoggerHeaderMetadataInput = {
  title: string;
  designation?: string | null;
  schemeLabel?: string | null;
  prescription?: string | null;
};

export function coreLoggerHeaderMetadataLines({
  title,
  designation,
  schemeLabel,
  prescription,
}: CoreLoggerHeaderMetadataInput) {
  const normalizedTitle = String(title || '').trim();
  const normalizedDesignation = String(designation || '').trim();
  const normalizedScheme = String(schemeLabel || '').trim();
  const normalizedPrescription = String(prescription || '').trim();
  const titleIncludesDesignation = normalizedDesignation
    ? normalizedTitle.toLowerCase().includes(`(${normalizedDesignation.toLowerCase()})`)
    : false;

  const schemeLine = [
    !titleIncludesDesignation ? normalizedDesignation : '',
    normalizedScheme.toLowerCase() !== normalizedDesignation.toLowerCase() ? normalizedScheme : '',
  ].filter(Boolean).join(' · ');

  return {
    schemeLine,
    prescriptionLine: normalizedPrescription,
  };
}

export function coreLoggerHeaderMetadata(input: CoreLoggerHeaderMetadataInput) {
  const { schemeLine, prescriptionLine } = coreLoggerHeaderMetadataLines(input);
  return [schemeLine, prescriptionLine].filter(Boolean).join(' · ');
}
