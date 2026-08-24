export type ProgrammingDeepOpenBlock = Readonly<{
  id: number;
  training_program_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
}>;

export type ProgrammingDeepOpenSession = Readonly<{
  id: number;
  date?: string | null;
  status?: string | null;
  kind?: string | null;
  training_block_id?: number | null;
}>;

export type ProgrammingDeepOpenSessionMap = Record<string, ProgrammingDeepOpenSession[]>;

export type ProgrammingDeepOpenResult =
  | Readonly<{ state: 'idle' }>
  | Readonly<{ state: 'pending' }>
  | Readonly<{ state: 'rejected'; reason: 'athlete' | 'program' | 'session' | 'lifecycle' }>
  | Readonly<{
      state: 'open';
      workoutId: number;
      context: Readonly<{ blockId: number; week: number; day: string }>;
    }>;

const TERMINAL_SESSION_STATES = new Set([
  'completed',
  'done',
  'logged',
  'missed',
  'incomplete',
  'cancelled',
  'canceled',
]);

function positiveInteger(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function dateOnly(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function utcDate(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sessionWeek(block: ProgrammingDeepOpenBlock, sessionDate: string): number {
  const startKey = dateOnly(block.start_date);
  const start = startKey ? utcDate(startKey) : null;
  const session = utcDate(sessionDate);
  if (!start || !session || session < start) return 1;
  return Math.floor((session.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/**
 * Resolves a route intent only against the fully hydrated athlete/program
 * projection. Missing or ambiguous identity fails closed; labels and dates are
 * never used to select a different Session.
 */
export function resolveProgrammingSessionDeepOpen({
  ready,
  requestedWorkoutId,
  requestedAthleteId,
  loadedAthleteId,
  requestedProgramId,
  activeProgramId,
  blocks,
  pendingMap,
  completedMap,
}: {
  ready: boolean;
  requestedWorkoutId?: unknown;
  requestedAthleteId?: unknown;
  loadedAthleteId?: unknown;
  requestedProgramId?: unknown;
  activeProgramId?: unknown;
  blocks: ProgrammingDeepOpenBlock[];
  pendingMap: ProgrammingDeepOpenSessionMap;
  completedMap: ProgrammingDeepOpenSessionMap;
}): ProgrammingDeepOpenResult {
  const workoutId = positiveInteger(requestedWorkoutId);
  if (!workoutId) return { state: 'idle' };
  if (!ready) return { state: 'pending' };

  const requestedAthlete = positiveInteger(requestedAthleteId);
  const loadedAthlete = positiveInteger(loadedAthleteId);
  if (!loadedAthlete || (requestedAthlete && requestedAthlete !== loadedAthlete)) {
    return { state: 'rejected', reason: 'athlete' };
  }

  const activeProgram = positiveInteger(activeProgramId);
  const requestedProgram = positiveInteger(requestedProgramId);
  if (!activeProgram || (requestedProgram && requestedProgram !== activeProgram)) {
    return { state: 'rejected', reason: 'program' };
  }

  const blockById = new Map(
    blocks
      .filter((block) => positiveInteger(block.training_program_id) === activeProgram)
      .map((block) => [Number(block.id), block]),
  );
  let found: ProgrammingDeepOpenSession | null = null;
  let block: ProgrammingDeepOpenBlock | null = null;

  const blockKeys = new Set([...Object.keys(pendingMap), ...Object.keys(completedMap)]);
  for (const blockKey of blockKeys) {
    const sessions = [
      ...(pendingMap[blockKey] || []),
      ...(completedMap[blockKey] || []),
    ];
    const candidate = sessions.find((session) => Number(session.id) === workoutId);
    if (!candidate) continue;
    const blockId = positiveInteger(candidate.training_block_id) || positiveInteger(blockKey);
    const candidateBlock = blockId ? blockById.get(blockId) || null : null;
    if (!candidateBlock) return { state: 'rejected', reason: 'program' };
    if (found) return { state: 'rejected', reason: 'session' };
    found = candidate;
    block = candidateBlock;
  }

  if (!found || !block) return { state: 'rejected', reason: 'session' };
  const lifecycle = String(found.status || found.kind || '').trim().toLowerCase();
  if (TERMINAL_SESSION_STATES.has(lifecycle)) {
    return { state: 'rejected', reason: 'lifecycle' };
  }
  const day = dateOnly(found.date);
  if (!day) return { state: 'rejected', reason: 'session' };

  return {
    state: 'open',
    workoutId,
    context: {
      blockId: Number(block.id),
      week: sessionWeek(block, day),
      day,
    },
  };
}
