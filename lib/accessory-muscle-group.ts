export const ACCESSORY_MUSCLE_REGION_KEYS = [
  'chest',
  'shoulders',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'arms',
  'lats',
  'upper_back',
  'traps',
  'rotator_cuff',
  'lower_back',
  'core',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'hip_flexors',
  'calves',
  'serratus',
  'neck',
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
  primary_muscle_group?: string | null;
}>;

type AccessoryMovement = Readonly<{
  movement?: string | null;
  movement_identity?: AccessoryIdentity | null;
}>;

const REGION_LABELS: Record<AccessoryMuscleRegionKey, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  arms: 'Arms',
  lats: 'Lats',
  upper_back: 'Upper back',
  traps: 'Traps',
  rotator_cuff: 'Rotator cuff',
  lower_back: 'Lower back',
  core: 'Core',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  adductors: 'Adductors',
  abductors: 'Abductors',
  hip_flexors: 'Hip flexors',
  calves: 'Calves',
  serratus: 'Serratus',
  neck: 'Neck',
  full_body: 'Full body',
};

const GOVERNED_FAMILY_REGIONS: Readonly<Record<string, AccessoryMuscleRegionKey>> = {
  squat: 'quads',
  quads: 'quads',
  bench: 'chest',
  chest: 'chest',
  chest_press: 'chest',
  incline_press: 'chest',
  front_delts_pressing: 'front_delts',
  side_delts: 'side_delts',
  rear_delts_upper_back: 'rear_delts',
  deadlift: 'hamstrings',
  hamstrings: 'hamstrings',
  row: 'upper_back',
  upper_back: 'upper_back',
  traps: 'traps',
  rotator_cuff_rehab: 'rotator_cuff',
  vertical_pull: 'lats',
  lats_upper_back: 'lats',
  lat: 'lats',
  lats: 'lats',
  lower_back: 'lower_back',
  plank: 'core',
  core: 'core',
  core_abs: 'core',
  abs: 'abs',
  obliques: 'obliques',
  shoulder: 'shoulders',
  shoulders: 'shoulders',
  overhead_press: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  glutes: 'glutes',
  adductors: 'adductors',
  abductors: 'abductors',
  hip_flexors: 'hip_flexors',
  calves: 'calves',
  serratus: 'serratus',
  neck: 'neck',
  arms: 'arms',
  full_body: 'full_body',
};

const LEGACY_NAME_RULES: readonly [RegExp, AccessoryMuscleRegionKey][] = [
  [/\b(calf|calves|gastrocnemius|soleus)\b/i, 'calves'],
  [/\b(rotator\s*cuff|external\s+rotation|internal\s+rotation|scaption)\b/i, 'rotator_cuff'],
  [/\b(rear\s+delts?|reverse\s+(?:flye?|pec\s*deck))\b/i, 'rear_delts'],
  [/\b(side\s+delts?|lateral\s*raise|upright\s*row)\b/i, 'side_delts'],
  [/\b(front\s+delts?|front\s*raise)\b/i, 'front_delts'],
  [/\b(traps?|shrugs?)\b/i, 'traps'],
  [/\b(triceps?|pressdown|pushdown|skull\s*crusher|overhead\s+extension)\b/i, 'triceps'],
  [/\b(biceps?|curl)\b/i, 'biceps'],
  [/\b(forearms?|wrist|grip|farmer(?:'s)?\s+(?:carry|walk))\b/i, 'forearms'],
  [/\b(shoulders?|delts?|overhead\s*press|military\s*press)\b/i, 'shoulders'],
  [/\b(chest|bench\s*press|pec|flye?|incline\s*press|push[- ]?up)\b/i, 'chest'],
  [/\b(lats?|pulldown|pull[- ]?up|chin[- ]?up)\b/i, 'lats'],
  [/\b(lower\s*back|back\s*extension|hyperextension|reverse\s*hyper)\b/i, 'lower_back'],
  [/\b(upper\s*back|rows?|face\s*pull)\b/i, 'upper_back'],
  [/\b(hamstrings?|leg\s*curl|rdl|romanian\s*deadlift|nordic|good\s*morning)\b/i, 'hamstrings'],
  [/\b(hip\s*flexors?|iliopsoas|psoas|iliacus)\b/i, 'hip_flexors'],
  [/\b(abductors?|hip\s*abduction|outer\s*thigh)\b/i, 'abductors'],
  [/\b(adductors?|inner\s*thigh|groin)\b/i, 'adductors'],
  [/\b(glutes?|hip\s*thrust|glute\s*bridge|kickback)\b/i, 'glutes'],
  [/\b(quads?|leg\s*press|leg\s*extension|split\s*squat|lunges?|step[- ]?ups?|hack\s*squat)\b/i, 'quads'],
  [/\b(obliques?|side\s*bend|pallof|russian\s*twist|wood\s*chop)\b/i, 'obliques'],
  [/\b(abdominals?|abs|crunch|sit[- ]?up|leg\s*raise)\b/i, 'abs'],
  [/\b(core|plank|dead\s*bug|hollow\s*hold)\b/i, 'core'],
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

function regionFromGovernedKey(value?: string | null): AccessoryMuscleRegionKey | null {
  const normalized = normalizeFamily(value).replace(/^accessory_/, '');
  if ((ACCESSORY_MUSCLE_REGION_KEYS as readonly string[]).includes(normalized)) {
    return normalized as AccessoryMuscleRegionKey;
  }
  return GOVERNED_FAMILY_REGIONS[normalized] || null;
}

export function canonicalAccessoryMuscleRegionKey(
  value?: string | null,
): AccessoryMuscleRegionKey {
  return regionFromGovernedKey(value) || 'full_body';
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
  const governedFamily = regionFromGovernedKey(identity?.primary_muscle_group)
    || regionFromGovernedKey(identity?.family);
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
  if ([...unique].every((region) => ['front_delts', 'side_delts', 'rear_delts', 'shoulders', 'rotator_cuff'].includes(region))) {
    return presentation('shoulders');
  }
  if ([...unique].every((region) => ['abs', 'obliques', 'core'].includes(region))) {
    return presentation('core');
  }

  const counts = new Map<AccessoryMuscleRegionKey, number>();
  for (const region of resolved) counts.set(region, (counts.get(region) || 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] > ranked[1][1]) return presentation(ranked[0][0]);
  return presentation('full_body');
}
