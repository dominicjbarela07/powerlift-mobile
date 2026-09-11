import type { useOptionalCoachAthleteWorkspace } from '@/components/coach-mobile/athlete-workspace/CoachAthleteWorkspaceContext';

type Workspace = Pick<NonNullable<ReturnType<typeof useOptionalCoachAthleteWorkspace>>, 'athleteId' | 'bootstrap'>;

export type ProgrammingSubject = {
  athleteId: number | null;
  workspaceOwned: boolean;
  ready: boolean;
};

export function resolveProgrammingSubject(
  workspace: Workspace | null,
  routeAthleteId?: string | string[],
): ProgrammingSubject {
  if (workspace) {
    const id = Number(workspace.bootstrap?.subject.athlete_id);
    const ready = Number.isInteger(id) && id > 0 && id === workspace.athleteId;
    // An unresolved workspace must never fall back to route or self identity.
    return { athleteId: ready ? id : null, workspaceOwned: true, ready };
  }
  const raw = Array.isArray(routeAthleteId) ? routeAthleteId[0] : routeAthleteId;
  const id = raw ? Number(raw) : null;
  const ready = id === null || (Number.isInteger(id) && id > 0);
  return { athleteId: ready ? id : null, workspaceOwned: false, ready };
}

export function assertProgrammingResponseSubject(subject: Pick<ProgrammingSubject, 'athleteId' | 'ready'>, responseAthleteId?: number | null) {
  if (!subject.ready || (subject.athleteId !== null && responseAthleteId !== subject.athleteId)) {
    throw new Error('Programming could not be verified for this athlete. Please refresh.');
  }
}

export function assertProgrammingMutationSubject(subject: ProgrammingSubject, athleteId: number | null, nextAthleteId = athleteId) {
  if (!subject.workspaceOwned) return;
  assertProgrammingResponseSubject(subject, athleteId);
  assertProgrammingResponseSubject(subject, nextAthleteId);
}

export function programmingSubjectRoute(
  subject: ProgrammingSubject,
  screen: 'home' | 'create-program',
  params: Record<string, string> = {},
) {
  if (!subject.ready) throw new Error('Programming subject is unavailable.');
  const pathname = subject.workspaceOwned
    ? screen === 'home'
      ? '/(tabs)/coach-athlete/[athleteId]/training'
      : '/(tabs)/coach-athlete/[athleteId]/training/create-program'
    : screen === 'home' ? '/(tabs)/workout' : '/(tabs)/workout/create-program';
  return {
    pathname,
    params: { ...params, ...(subject.athleteId ? { athleteId: String(subject.athleteId) } : {}) },
  };
}
