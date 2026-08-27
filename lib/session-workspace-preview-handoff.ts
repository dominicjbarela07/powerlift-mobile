export type SessionWorkspacePreviewSection = 'core' | 'accessories';

export type SessionWorkspacePreviewReturnContext = Readonly<{
  workoutId: number;
  athleteId: number | null;
  programId: number | null;
  blockId: number | null;
  week: number | null;
  day: string | null;
  section: SessionWorkspacePreviewSection;
  workspaceMode: 'self' | 'team';
}>;

export type SessionWorkspacePreviewHandoff =
  | Readonly<{ phase: 'idle'; context: null }>
  | Readonly<{
      phase: 'dismissing' | 'previewing' | 'restoring';
      context: SessionWorkspacePreviewReturnContext;
    }>;

export const IDLE_SESSION_WORKSPACE_PREVIEW_HANDOFF: SessionWorkspacePreviewHandoff = {
  phase: 'idle',
  context: null,
};

export function beginSessionWorkspacePreview(
  context: SessionWorkspacePreviewReturnContext,
): SessionWorkspacePreviewHandoff {
  return { phase: 'dismissing', context };
}

export function completeSessionWorkspaceDismissal(
  handoff: SessionWorkspacePreviewHandoff,
): SessionWorkspacePreviewHandoff {
  return handoff.phase === 'dismissing'
    ? { phase: 'previewing', context: handoff.context }
    : handoff;
}

export function beginSessionWorkspaceRestoration(
  handoff: SessionWorkspacePreviewHandoff,
): SessionWorkspacePreviewHandoff {
  return handoff.phase === 'previewing'
    ? { phase: 'restoring', context: handoff.context }
    : handoff;
}

export function completeSessionWorkspaceRestoration(
  handoff: SessionWorkspacePreviewHandoff,
): SessionWorkspacePreviewHandoff {
  return handoff.phase === 'restoring'
    ? IDLE_SESSION_WORKSPACE_PREVIEW_HANDOFF
    : handoff;
}

export function sessionWorkspacePreviewRouteParams(
  context: SessionWorkspacePreviewReturnContext,
) {
  return {
    workoutId: String(context.workoutId),
    athleteView: 'coach-preview',
    returnTo: 'programming-workspace-preview',
    returnSection: context.section,
    coachWorkspaceMode: context.workspaceMode,
    ...(context.athleteId != null ? { coachAthleteId: String(context.athleteId) } : {}),
    ...(context.programId != null ? { coachProgramId: String(context.programId) } : {}),
    ...(context.blockId != null ? { coachProgrammingBlockId: String(context.blockId) } : {}),
    ...(context.week != null ? { coachProgrammingWeek: String(context.week) } : {}),
    ...(context.day ? { coachProgrammingDay: context.day } : {}),
  };
}

export function sessionWorkspacePreviewFallbackParams(
  context: SessionWorkspacePreviewReturnContext,
) {
  return {
    workoutId: String(context.workoutId),
    ...(context.workspaceMode === 'team' && context.athleteId != null
      ? { athleteId: String(context.athleteId) }
      : {}),
    ...(context.programId != null ? { programId: String(context.programId) } : {}),
    ...(context.blockId != null ? { programmingBlockId: String(context.blockId) } : {}),
    ...(context.week != null ? { programmingWeek: String(context.week) } : {}),
    ...(context.day ? { programmingDay: context.day } : {}),
  };
}
