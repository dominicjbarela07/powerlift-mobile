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
  return !(mode === 'finished_session' && hasCompletedRecap);
}
