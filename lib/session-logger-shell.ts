export type SessionLoggerShellMode =
  | 'loading'
  | 'error'
  | 'pre_session'
  | 'active_session'
  | 'finished_session';

export function sessionLoggerSharedHeaderShown({
  mode,
  hasCompletedRecap,
}: {
  mode: SessionLoggerShellMode;
  hasCompletedRecap: boolean;
}): boolean {
  // The Session owns its local header throughout its lifecycle.
  return mode === 'loading' || mode === 'error';
}
