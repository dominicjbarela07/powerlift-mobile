export const completedSetSwipeTooltipEnabled = true;

export type CompletedSetSwipeTooltipStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export const completedSetSwipeTooltipStorageKey = (workoutId: string | number) =>
  `completed-set-swipe-tooltip:v1:${workoutId}`;

export function shouldShowCompletedSetSwipeTooltip({
  enabled = completedSetSwipeTooltipEnabled,
  hasBeenShown,
  isPersistedNewSet,
  setLogId,
}: {
  enabled?: boolean;
  hasBeenShown: boolean | null;
  isPersistedNewSet: boolean;
  setLogId: number | null;
}) {
  return enabled && hasBeenShown === false && isPersistedNewSet && Number.isInteger(setLogId) && Number(setLogId) > 0;
}

export function createCompletedSetSwipeTooltipStorage(adapter: CompletedSetSwipeTooltipStorageAdapter) {
  return {
    async hasBeenShown(workoutId: string | number) {
      return (await adapter.getItem(completedSetSwipeTooltipStorageKey(workoutId))) === 'shown';
    },
    markShown(workoutId: string | number) {
      return adapter.setItem(completedSetSwipeTooltipStorageKey(workoutId), 'shown');
    },
  };
}
