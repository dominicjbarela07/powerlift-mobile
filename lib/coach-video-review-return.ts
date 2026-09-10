export type CoachReviewTypeFilter = 'all' | 'session' | 'video';
export type CoachWorkspaceReviewSegment = 'queue' | 'followup' | 'history';

export type CoachVideoReviewReturnContext =
  | { kind: 'inbox' }
  | {
      kind: 'workspace';
      athleteId: number;
      destination: 'reviews' | 'messages';
      subjectKey?: string;
      segment?: CoachWorkspaceReviewSegment;
      queuePosition?: number;
    }
  | {
      kind: 'hub';
      athleteId?: number;
      section?: 'queue' | 'history';
      scrollY?: number;
      queuePosition?: number;
    }
  | {
      kind: 'queue' | 'history';
      athleteId?: number;
      reviewType?: CoachReviewTypeFilter;
      scrollY?: number;
      queuePosition?: number;
    };

export type CoachVideoReviewRouteParams = Record<string, string | string[] | undefined>;

export type CoachVideoReviewReturnTarget = {
  pathname: string;
  params?: Record<string, string>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function nonNegativeNumber(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function addOptionalNumber(params: Record<string, string>, key: string, value?: number) {
  if (Number.isFinite(value) && Number(value) >= 0) params[key] = String(value);
}

export function buildCoachVideoReviewReturnParams(
  context: CoachVideoReviewReturnContext,
): Record<string, string> {
  if (context.kind === 'inbox') return { reviewReturnTo: 'inbox' };

  const params: Record<string, string> = { reviewReturnTo: context.kind };
  if (context.athleteId && context.athleteId > 0) params.athleteId = String(context.athleteId);

  if (context.kind === 'workspace') {
    params.returnToWorkspace = '1';
    params.workspaceReturn = context.destination;
    if (context.subjectKey) params.workspaceSubjectKey = context.subjectKey;
    if (context.segment) params.reviewSegment = context.segment;
    addOptionalNumber(params, 'queuePosition', context.queuePosition);
    return params;
  }

  if (context.kind === 'hub') {
    if (context.section) params.reviewSection = context.section;
  } else if (context.reviewType) {
    params.reviewType = context.reviewType;
  }
  addOptionalNumber(params, 'reviewScrollY', context.scrollY);
  addOptionalNumber(params, 'queuePosition', context.queuePosition);
  return params;
}

export function resolveCoachVideoReviewReturnContext(
  params: CoachVideoReviewRouteParams,
): CoachVideoReviewReturnContext {
  const returnTo = firstParam(params.reviewReturnTo);
  const athleteId = positiveInteger(params.athleteId);
  const scrollY = nonNegativeNumber(params.reviewScrollY);
  const queuePosition = nonNegativeNumber(params.queuePosition);

  if (returnTo === 'workspace' || firstParam(params.returnToWorkspace) === '1') {
    if (!athleteId) return { kind: 'inbox' };
    const workspaceReturn = firstParam(params.workspaceReturn);
    const segment = firstParam(params.reviewSegment);
    return {
      kind: 'workspace',
      athleteId,
      destination: workspaceReturn === 'messages' ? 'messages' : 'reviews',
      subjectKey: firstParam(params.workspaceSubjectKey),
      segment: segment === 'followup' || segment === 'history' ? segment : 'queue',
      queuePosition,
    };
  }

  if (returnTo === 'hub') {
    const section = firstParam(params.reviewSection);
    return {
      kind: 'hub',
      athleteId,
      section: section === 'history' ? 'history' : 'queue',
      scrollY,
      queuePosition,
    };
  }

  if (returnTo === 'queue' || returnTo === 'history') {
    const reviewType = firstParam(params.reviewType);
    return {
      kind: returnTo,
      athleteId,
      reviewType: reviewType === 'session' || reviewType === 'video' ? reviewType : 'all',
      scrollY,
      queuePosition,
    };
  }

  return { kind: 'inbox' };
}

export function coachVideoReviewReturnTarget(
  context: CoachVideoReviewReturnContext,
): CoachVideoReviewReturnTarget | null {
  if (context.kind === 'inbox') return null;
  if (context.kind === 'workspace') {
    return { pathname: `/(tabs)/coach-athlete/${context.athleteId}/${context.destination}` };
  }

  const params: Record<string, string> = {};
  if (context.athleteId) params.athleteId = String(context.athleteId);
  addOptionalNumber(params, 'reviewScrollY', context.scrollY);
  addOptionalNumber(params, 'queuePosition', context.queuePosition);

  if (context.kind === 'hub') {
    if (context.section) params.reviewSection = context.section;
    return { pathname: '/(tabs)/coach-videos', params: Object.keys(params).length ? params : undefined };
  }

  if (context.reviewType) params.reviewType = context.reviewType;
  return {
    pathname: context.kind === 'queue' ? '/(tabs)/coach-review-queue' : '/(tabs)/coach-review-history',
    params: Object.keys(params).length ? params : undefined,
  };
}
