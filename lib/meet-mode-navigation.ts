export const DEFAULT_MEET_MODE_RETURN_PATH = '/(tabs)/athlete-dashboard' as const;

const ALLOWED_RETURN_PREFIXES = [
  '/athlete-dashboard',
  '/athlete-calendar',
  '/workout',
  '/ledger',
  '/reflection',
  '/training-focus',
  '/video-archive',
] as const;

function scalarParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Meet Mode may restore a protected in-app context, but it may never turn a
 * route parameter into an open redirect or bypass the account-state router.
 */
export function resolveMeetModeReturnPath(value: string | string[] | undefined) {
  const candidate = scalarParam(value)?.trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (candidate.includes('..') || candidate.includes('athlete-meet-plan')) return null;
  if (!/^\/[A-Za-z0-9_()\-./]+$/.test(candidate)) return null;
  return ALLOWED_RETURN_PREFIXES.some((prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`))
    ? candidate
    : null;
}

