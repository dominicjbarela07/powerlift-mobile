type AccessoryIdentity = Readonly<{
  family?: string | null;
  family_display_name?: string | null;
}>;

type AccessoryMovement = Readonly<{
  movement?: string | null;
  movement_identity?: AccessoryIdentity | null;
}>;

const RULES: readonly [RegExp, string][] = [
  [/calf|gastrocnemius|soleus/i, 'Calves'],
  [/triceps|pressdown|skull\s*crusher|triceps?\s*extension|overhead\s+extension/i, 'Triceps'],
  [/biceps|curl/i, 'Biceps'],
  [/lateral\s*raise|rear\s*delt|shoulder|overhead\s*press/i, 'Shoulders'],
  [/chest|bench|pec|fly|press/i, 'Chest'],
  [/lat|pulldown|pull[- ]?up|row|back/i, 'Back'],
  [/hamstring|leg\s*curl|rdl|romanian|good\s*morning/i, 'Hamstrings'],
  [/glute|hip\s*thrust|kickback|abduct/i, 'Glutes'],
  [/quad|leg\s*press|leg\s*extension|squat|lunge|split\s*squat/i, 'Quads'],
  [/adduct|groin/i, 'Adductors'],
  [/core|abdom|plank|crunch|rotation/i, 'Core'],
  [/forearm|wrist|grip/i, 'Forearms'],
];

/**
 * Produces the compact primary-muscle label used in accessory logger cards.
 * The governed movement family is preferred; movement text is retained as a
 * compatibility fallback for legacy/unresolved accessory prescriptions.
 */
export function accessoryPrimaryMuscleGroup(item: AccessoryMovement): string {
  const identity = item.movement_identity;
  const source = [
    identity?.family_display_name,
    identity?.family,
    item.movement,
  ].filter(Boolean).join(' ');
  const match = RULES.find(([pattern]) => pattern.test(source));
  return match?.[1] || 'Accessory';
}
