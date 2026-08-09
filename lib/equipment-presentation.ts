const EQUIPMENT_PRESENTATION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  // Equipment classifications.
  plate_loaded: 'Plate Loaded',
  plate_loaded_machine: 'Plate Loaded',
  selectorized: 'Selectorized',
  selectorized_machine: 'Selectorized',
  smith_machine: 'Smith Machine',
  cable_machine: 'Cable Machine',
  lever_machine: 'Lever Machine',
  machine: 'Machine',
  cable: 'Cable',
  cable_stack: 'Cable Stack',
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  bodyweight: 'Bodyweight',
  weighted_bodyweight: 'Weighted Bodyweight',
  free_weight: 'Free Weight',
  other: 'Other',
  unknown: 'Unknown',

  // Load conventions.
  total_external_load: 'Total Load',
  per_hand: 'Per Hand',
  machine_stack_display: 'Machine Stack',
  bodyweight_only: 'Bodyweight',
  added_bodyweight: 'Added Weight',
  assistance_load: 'Assistance',
  no_external_load: 'No External Load',
  plate_total: 'Total Plate Load',
  barbell_total: 'Total Barbell Load',

  // Measurement and sidedness values used by equipment setup.
  load_reps: 'Weight + Reps',
  bodyweight_reps: 'Bodyweight + Reps',
  added_weight_reps: 'Added Weight + Reps',
  assisted_reps: 'Assistance + Reps',
  duration: 'Duration',
  bilateral: 'Bilateral',
  unilateral: 'Unilateral',
  alternating: 'Alternating',
});

const INTERNAL_IDENTIFIER = /^[a-z0-9]+(?:[_.:-][a-z0-9]+)*$/;

function normalizedKey(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/[\s-]+/g, '_');
}

/**
 * Converts governed equipment values into athlete-facing copy.
 *
 * Unknown identifier-shaped values deliberately fall back instead of being
 * mechanically title-cased. This keeps new backend enum values from leaking
 * into the UI before product copy has been defined for them.
 */
export function equipmentPresentationLabel(
  value: string | null | undefined,
  fallback = 'Equipment',
): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const canonical = EQUIPMENT_PRESENTATION_LABELS[normalizedKey(raw)];
  if (canonical) return canonical;
  if (INTERNAL_IDENTIFIER.test(raw)) return fallback;
  return raw;
}

export function equipmentPresentationParts(
  value: string | null | undefined,
  fallback = 'Equipment',
): string[] {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split('·')
    .map((part) => equipmentPresentationLabel(part, fallback))
    .filter((part, index, parts) => Boolean(part) && parts.indexOf(part) === index);
}

export function isKnownEquipmentPresentationValue(value: string): boolean {
  return Boolean(EQUIPMENT_PRESENTATION_LABELS[normalizedKey(value)]);
}
