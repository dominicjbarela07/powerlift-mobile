/** Nested workspace layouts may inherit empty parent params; the canonical path still owns the subject. */
export function resolveCoachWorkspaceAthleteId(local: string | string[] | undefined, pathname: string): number {
  const segment = pathname.match(/^\/(?:\(tabs\)\/)?coach-athlete\/([1-9]\d*)(?:\/|$)/)?.[1];
  if (!segment) return 0;
  const value = Array.isArray(local) ? local[0] : local;
  if (value != null && value !== '' && value !== segment) return 0;
  const id = Number(segment);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}
