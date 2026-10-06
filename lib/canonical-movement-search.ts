export const CANONICAL_MOVEMENT_SEARCH_DEBOUNCE_MS = 140;

const TOKEN_EXPANSIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "1arm": ["single", "arm"],
  "bb": ["barbell"],
  "shoulders": ["shoulder"],
  "legs": ["leg"],
  "arms": ["arm"],
  "hips": ["hip"],
  "weights": ["weight"],
  "bicep": ["biceps"],
  "forearm": ["forearms"],
  "calves": ["calf"],
  "barbells": ["barbell"],
  "dumbbells": ["dumbbell"],
  "kb": ["kettlebell"],
  "kettlebells": ["kettlebell"],
  "cables": ["cable"],
  "machines": ["machine"],
  "bands": ["band"],
  "pullovers": ["pullover"],
  "pulldowns": ["pulldown"],
  "rows": ["row"],
  "curls": ["curl"],
  "raises": ["raise"],
  "presses": ["press"],
  "extensions": ["extension"],
  "cbl": ["cable"],
  "db": ["dumbbell"],
  "dbs": ["dumbbell"],
  "deltoid": ["delt"],
  "deltoids": ["delt"],
  "delts": ["delt"],
  "flye": ["fly"],
  "flyes": ["fly"],
  "glutes": ["glute"],
  "ham": ["hamstring"],
  "hams": ["hamstring"],
  "hamstrings": ["hamstring"],
  "lats": ["lat"],
  "mach": ["machine"],
  "onearm": ["single", "arm"],
  "pec": ["chest"],
  "pecs": ["chest"],
  "push": ["press"],
  "pushdown": ["pressdown"],
  "quads": ["quad"],
  "quadricep": ["quad"],
  "quadriceps": ["quad"],
  "rearward": ["rear"],
  "sa": ["single", "arm"],
  "singlearm": ["single", "arm"],
  "tricep": ["triceps"],
  "uni": ["unilateral"],
});

const PHRASE_EXPANSIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "one arm": ["single", "arm"],
  "body weight": ["bodyweight"],
  "1 arm": ["single", "arm"],
  "pull down": ["pulldown"],
  "pull over": ["pullover"],
  "push down": ["pressdown"],
  "press down": ["pressdown"],
});

export function normalizeCanonicalMovementSearchTokens(value: unknown): string[] {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
  const filler = new Set(['a', 'an', 'the', 'with', 'for', 'using', 'exercise', 'exercises', 'show', 'me', 'something', 'to', 'train', 'training', 'my', 'i', 'can', 'do', 'what', 'movement', 'movements']);
  const raw = (normalized.slice(0, 160).match(/[a-z0-9]+/g) || []).filter(token => !filler.has(token)).slice(0, 16);
  const result: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const phrase = raw.slice(index, index + 2).join(' ');
    if (PHRASE_EXPANSIONS[phrase]) {
      result.push(...PHRASE_EXPANSIONS[phrase]);
      index += 1;
      continue;
    }
    result.push(...(TOKEN_EXPANSIONS[raw[index]] || [raw[index]]));
  }
  return [...new Set(result.filter(Boolean))];
}

function boundedDamerauLevenshtein(left: string, right: string, maximum: number) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1;
  let previousPrevious: number[] | null = null;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      let value = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      );
      if (
        previousPrevious
        && leftIndex > 1
        && rightIndex > 1
        && left[leftIndex - 1] === right[rightIndex - 2]
        && left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        value = Math.min(value, previousPrevious[rightIndex - 2] + 1);
      }
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previousPrevious = previous;
    previous = current;
  }
  return previous[right.length];
}

function tokenScore(queryToken: string, candidateToken: string) {
  if (queryToken === candidateToken) return 1;
  if (queryToken.length >= 2 && candidateToken.startsWith(queryToken)) return 0.92;
  if (queryToken.length < 4 || candidateToken.length < 4) return 0;
  const maximum = Math.max(queryToken.length, candidateToken.length) <= 8 ? 1 : 2;
  const distance = boundedDamerauLevenshtein(queryToken, candidateToken, maximum);
  if (distance > maximum) return 0;
  const score = 1 - distance / Math.max(queryToken.length, candidateToken.length);
  return score >= 0.72 ? score : 0;
}

function choiceScore(queryTokens: readonly string[], candidateTokens: readonly string[]) {
  if (!queryTokens.length) return 0;
  const scores = queryTokens.map((queryToken) => Math.max(
    0,
    ...candidateTokens.map((candidateToken) => tokenScore(queryToken, candidateToken)),
  ));
  if (Math.min(...scores) < 0.72) return null;
  return scores.reduce((total, score) => total + score, 0) / scores.length
    - Math.max(0, candidateTokens.length - queryTokens.length) * 0.004;
}

export function rankCanonicalMovementChoices<T>(
  choices: readonly T[],
  query: unknown,
  searchableText: (choice: T) => unknown,
): T[] {
  const queryTokens = normalizeCanonicalMovementSearchTokens(query);
  if (!queryTokens.length) return [...choices];
  return choices
    .map((choice, originalIndex) => ({
      choice,
      originalIndex,
      score: choiceScore(
        queryTokens,
        normalizeCanonicalMovementSearchTokens(searchableText(choice)),
      ),
    }))
    .filter((row): row is typeof row & { score: number } => row.score !== null)
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
    .map((row) => row.choice);
}

export function canonicalMovementSearchEmptyCopy(
  query: unknown,
  scopedFallback = 'No matching movements in this scope.',
) {
  return String(query || '').trim()
    ? 'No close matches. Try fewer words, an equipment name, or a muscle.'
    : scopedFallback;
}


export type MovementSearchMatch = { kind: string; matched_term: string; label: string };
export type MovementSearchSuggestion = { query: string; label: string; movement_definition_id: number; kind: string };

/** Completion refines a query only; selection always uses the canonical result. */
export function movementSearchSuggestions(value: unknown, items: readonly { id?: number | null }[]): MovementSearchSuggestion[] {
  const allowedIds = new Set(items.map(row => Number(row.id)).filter(id => id > 0));
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : []).filter(row => {
    if (!row || !allowedIds.has(Number(row.movement_definition_id)) || typeof row.query !== 'string'
      || !row.query.trim() || row.query.length > 160 || seen.has(row.query.toLowerCase())) return false;
    seen.add(row.query.toLowerCase());
    return true;
  }).slice(0, 3).map(row => ({ ...row, label: row.query, movement_definition_id: Number(row.movement_definition_id) }));
}
