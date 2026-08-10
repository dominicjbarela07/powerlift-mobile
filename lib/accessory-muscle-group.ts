export const ACCESSORY_MUSCLE_REGION_KEYS = [
  'chest',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'lats',
  'upper_back',
  'lower_back',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'arms',
  'full_body',
] as const;

export type AccessoryMuscleRegionKey = typeof ACCESSORY_MUSCLE_REGION_KEYS[number];

export type AccessoryMuscleRegionPresentation = Readonly<{
  key: AccessoryMuscleRegionKey;
  label: string;
}>;

type AccessoryIdentity = Readonly<{
  family?: string | null;
  family_display_name?: string | null;
}>;

type AccessoryMovement = Readonly<{
  movement?: string | null;
  movement_identity?: AccessoryIdentity | null;
}>;

const REGION_LABELS: Record<AccessoryMuscleRegionKey, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  lats: 'Lats',
  upper_back: 'Upper back',
  lower_back: 'Lower back',
  core: 'Core',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  calves: 'Calves',
  arms: 'Arms',
  full_body: 'Full body',
};

const GOVERNED_FAMILY_REGIONS: Readonly<Record<string, AccessoryMuscleRegionKey>> = {
  squat: 'quads',
  quads: 'quads',
  bench: 'chest',
  chest: 'chest',
  chest_press: 'chest',
  incline_press: 'chest',
  deadlift: 'hamstrings',
  hamstrings: 'hamstrings',
  row: 'upper_back',
  upper_back: 'upper_back',
  vertical_pull: 'lats',
  lat: 'lats',
  lats: 'lats',
  lower_back: 'lower_back',
  plank: 'core',
  core: 'core',
  shoulder: 'shoulders',
  shoulders: 'shoulders',
  overhead_press: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  glutes: 'glutes',
  adductors: 'adductors',
  calves: 'calves',
  arms: 'arms',
  full_body: 'full_body',
};

const LEGACY_NAME_RULES: readonly [RegExp, AccessoryMuscleRegionKey][] = [
  [/\b(calf|calves|gastrocnemius|soleus)\b/i, 'calves'],
  [/\b(triceps?|pressdown|pushdown|skull\s*crusher|overhead\s+extension)\b/i, 'triceps'],
  [/\b(biceps?|curl)\b/i, 'biceps'],
  [/\b(forearms?|wrist|grip|farmer(?:'s)?\s+(?:carry|walk))\b/i, 'forearms'],
  [/\b(shoulders?|delts?|lateral\s*raise|rear\s*delt|overhead\s*press|military\s*press|upright\s*row)\b/i, 'shoulders'],
  [/\b(chest|bench\s*press|pec|flye?|incline\s*press|push[- ]?up)\b/i, 'chest'],
  [/\b(lats?|pulldown|pull[- ]?up|chin[- ]?up)\b/i, 'lats'],
  [/\b(lower\s*back|back\s*extension|hyperextension|reverse\s*hyper)\b/i, 'lower_back'],
  [/\b(upper\s*back|rows?|face\s*pull)\b/i, 'upper_back'],
  [/\b(hamstrings?|leg\s*curl|rdl|romanian\s*deadlift|nordic|good\s*morning)\b/i, 'hamstrings'],
  [/\b(glutes?|hip\s*thrust|glute\s*bridge|hip\s*abduction|kickback)\b/i, 'glutes'],
  [/\b(adductors?|inner\s*thigh|groin)\b/i, 'adductors'],
  [/\b(quads?|leg\s*press|leg\s*extension|split\s*squat|lunges?|step[- ]?ups?|hack\s*squat)\b/i, 'quads'],
  [/\b(core|abdominals?|abs|plank|crunch|sit[- ]?up|dead\s*bug|pallof)\b/i, 'core'],
  [/\b(arms?)\b/i, 'arms'],
  [/\b(back)\b/i, 'upper_back'],
];

function normalizeFamily(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function presentation(key: AccessoryMuscleRegionKey): AccessoryMuscleRegionPresentation {
  return { key, label: REGION_LABELS[key] };
}

function regionFromLegacyText(value?: string | null): AccessoryMuscleRegionKey | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return LEGACY_NAME_RULES.find(([pattern]) => pattern.test(normalized))?.[1] || null;
}

/**
 * Resolves accessory artwork through governed movement identity first. Legacy
 * name matching is deliberately second so older prescriptions remain useful
 * without allowing display copy to override a governed family.
 */
export function accessoryMuscleRegion(item: AccessoryMovement): AccessoryMuscleRegionPresentation {
  const identity = item.movement_identity;
  const governedFamily = GOVERNED_FAMILY_REGIONS[normalizeFamily(identity?.family)];
  if (governedFamily) return presentation(governedFamily);

  const identityDisplayRegion = regionFromLegacyText(identity?.family_display_name);
  if (identityDisplayRegion) return presentation(identityDisplayRegion);

  const legacyRegion = regionFromLegacyText(item.movement);
  return presentation(legacyRegion || 'full_body');
}

/** Compatibility helper for non-visual consumers that still need readable copy. */
export function accessoryPrimaryMuscleGroup(item: AccessoryMovement): string {
  return accessoryMuscleRegion(item).label;
}

/**
 * Resolves one deterministic medallion for a superset. Related arm regions
 * become Arms, a repeated dominant region wins, and unrelated ties use the
 * safe full-body diagram.
 */
export function combineAccessoryMuscleRegions(
  regions: readonly (AccessoryMuscleRegionKey | null | undefined)[],
): AccessoryMuscleRegionPresentation {
  const resolved = regions.filter((region): region is AccessoryMuscleRegionKey => Boolean(region));
  if (resolved.length === 0) return presentation('full_body');
  if (resolved.every((region) => region === resolved[0])) return presentation(resolved[0]);

  const unique = new Set(resolved);
  if ([...unique].every((region) => ['biceps', 'triceps', 'forearms', 'arms'].includes(region))) {
    return presentation('arms');
  }

  const counts = new Map<AccessoryMuscleRegionKey, number>();
  for (const region of resolved) counts.set(region, (counts.get(region) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] > ranked[1][1]) return presentation(ranked[0][0]);
  return presentation('full_body');
}
