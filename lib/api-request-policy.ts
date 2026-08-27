export type ApiRequestImportance =
  | 'critical-mutation'
  | 'foreground-read'
  | 'background-refresh'
  | 'prefetch';

export type ApiRequestFailureKind =
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'http'
  | 'malformed-response';

export class ApiRequestError extends Error {
  readonly kind: ApiRequestFailureKind;
  readonly method: string;
  readonly path: string;
  readonly timeoutMs: number | null;
  readonly importance: ApiRequestImportance;
  readonly requestId: string;
  readonly elapsedMs: number;

  constructor(args: {
    kind: ApiRequestFailureKind;
    message: string;
    method: string;
    path: string;
    timeoutMs?: number | null;
    importance: ApiRequestImportance;
    requestId: string;
    elapsedMs: number;
  }) {
    super(args.message);
    // Preserve the platform AbortError contract for existing route-level
    // cancellation guards while retaining structured request metadata.
    this.name = args.kind === 'cancelled' ? 'AbortError' : 'ApiRequestError';
    this.kind = args.kind;
    this.method = args.method;
    this.path = args.path;
    this.timeoutMs = args.timeoutMs ?? null;
    this.importance = args.importance;
    this.requestId = args.requestId;
    this.elapsedMs = args.elapsedMs;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError || Boolean(
    error
    && typeof error === 'object'
    && ['ApiRequestError', 'AbortError'].includes((error as { name?: string }).name || '')
    && typeof (error as { kind?: string }).kind === 'string',
  );
}

export function shouldSurfaceRequestFailure(error: unknown): boolean {
  if (!isApiRequestError(error)) return true;
  if (error.kind === 'cancelled') return false;
  return error.importance === 'critical-mutation' || error.importance === 'foreground-read';
}

export function criticalMutationFailureMessage(error: unknown, fallback: string): string {
  if (isApiRequestError(error) && error.kind === 'timeout') {
    return `Couldn't save this set. Check your connection and tap Log Set to retry. (${error.requestId})`;
  }
  return String((error as { message?: string } | null)?.message || fallback);
}
