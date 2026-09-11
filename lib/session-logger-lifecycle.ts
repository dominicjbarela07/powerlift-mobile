export function sessionExecutionCapabilities({ status, canLog, previewRequested, viewOnly }: {
  status?: string | null; canLog?: boolean | null; previewRequested: boolean; viewOnly?: boolean | null;
}) {
  const canExecute = Boolean(canLog) && !previewRequested && !viewOnly;
  return {
    canExecute,
    canBegin: canExecute && (status === 'assigned' || status === 'tardy'),
    canLogSet: canExecute && status === 'in_progress',
    canComplete: canExecute && status === 'in_progress',
    canCorrect: canExecute && status === 'completed',
  };
}
