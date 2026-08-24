export type ProgrammingProgramVisualKey = 'bodybuilding' | 'powerlifting' | 'meet' | 'general';
export type ProgrammingRegionArtworkKey =
  | 'back_region'
  | 'arms'
  | 'shoulders'
  | 'core'
  | 'full_body'
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'lats'
  | 'upper_back'
  | 'traps'
  | 'lower_back'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'abductors'
  | 'hip_flexors'
  | 'calves'
  | 'serratus'
  | 'neck';

export type ProgrammingProgramVisualInput = Readonly<{
  name?: string | null;
  programType?: string | null;
  description?: string | null;
  meetDate?: string | null;
}>;

/**
 * Program art establishes training-environment identity. It never infers
 * muscle focus and never uses athlete imagery.
 */
export function resolveProgrammingProgramVisual(input: ProgrammingProgramVisualInput): ProgrammingProgramVisualKey {
  const semanticText = [input.name, input.programType, input.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (input.meetDate || /\b(meet|competition|peak|peaking|taper)\b/.test(semanticText)) return 'meet';
  if (/\b(bodybuild|bodybuilding|hypertrophy|physique)\b/.test(semanticText)) return 'bodybuilding';
  if (/\b(powerlift|powerlifting|strength|sbd)\b/.test(semanticText)) return 'powerlifting';
  return 'general';
}

const BACK_REGIONS = new Set(['lats', 'upper_back', 'traps', 'lower_back', 'rear_delts']);
const ARM_REGIONS = new Set(['biceps', 'triceps', 'forearms']);
const SHOULDER_REGIONS = new Set(['front_delts', 'side_delts', 'rear_delts']);
const CORE_REGIONS = new Set(['abs', 'obliques']);
const SINGLE_REGION_ARTWORK = new Set<ProgrammingRegionArtworkKey>([
  'chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'forearms',
  'lats', 'upper_back', 'traps', 'lower_back', 'abs', 'obliques', 'quads', 'hamstrings',
  'glutes', 'adductors', 'abductors', 'hip_flexors', 'calves', 'serratus', 'neck',
]);

/** Resolves existing purpose-built region artwork from canonical muscle IDs. */
export function resolveProgrammingRegionArtwork(
  primary: readonly string[],
  level: 'week' | 'session',
): ProgrammingRegionArtworkKey[] {
  const governed = primary.filter((muscle): muscle is ProgrammingRegionArtworkKey =>
    SINGLE_REGION_ARTWORK.has(muscle as ProgrammingRegionArtworkKey),
  );
  // Missing governed evidence is not "full body". Consumers must render a
  // neutral Session placeholder rather than inventing anatomy.
  if (!governed.length) return [];
  const allIn = (members: ReadonlySet<string>) => governed.every((muscle) => members.has(muscle));
  if (governed.length > 1 && allIn(BACK_REGIONS)) return ['back_region'];
  if (governed.length > 1 && allIn(ARM_REGIONS)) return ['arms'];
  if (governed.length > 1 && allIn(SHOULDER_REGIONS)) return ['shoulders'];
  if (governed.length > 1 && allIn(CORE_REGIONS)) return ['core'];
  // A Session is an aggregate, not its first movement. Two regional assets
  // preserve the dominant whole-Session emphasis without becoming a collage.
  return governed.slice(0, 2);
}
