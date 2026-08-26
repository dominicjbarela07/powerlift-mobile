export const PROGRAM_TIMELINE_PATHNAME = '/(tabs)/workout/program-timeline' as const;

export type ProgramTimelineLaunchContext = Readonly<{
  programId: number | string | null | undefined;
  athleteId?: number | string | null;
}>;

export type ProgramTimelineRoute = Readonly<{
  pathname: typeof PROGRAM_TIMELINE_PATHNAME;
  params: Readonly<{
    programId: string;
    athleteId?: string;
  }>;
}>;

/**
 * The single supported launch contract for the athlete Program Timeline.
 * A Timeline without a stable Program identity is not a valid destination.
 */
export function buildProgramTimelineRoute(
  context: ProgramTimelineLaunchContext,
): ProgramTimelineRoute | null {
  const programId = Number(context.programId);
  if (!Number.isInteger(programId) || programId <= 0) return null;

  const athleteId = context.athleteId == null ? null : Number(context.athleteId);
  return {
    pathname: PROGRAM_TIMELINE_PATHNAME,
    params: {
      programId: String(programId),
      ...(Number.isInteger(athleteId) && Number(athleteId) > 0
        ? { athleteId: String(athleteId) }
        : {}),
    },
  };
}
