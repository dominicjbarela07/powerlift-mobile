export type LatestRequestResult<T> =
  | { kind: 'success'; value: T }
  | { kind: 'cancelled' }
  | { kind: 'obsolete' }
  | { kind: 'error'; error: unknown };

export function isAbortError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (error as { name?: string }).name === 'AbortError',
  );
}

/**
 * Owns one route-level request generation. A superseded or navigation-cancelled
 * request can never publish data or an error into the current screen.
 */
export function createLatestRequestManager<T>() {
  let generation = 0;
  let active: { generation: number; controller: AbortController } | null = null;

  return {
    async run(task: (signal: AbortSignal) => Promise<T>): Promise<LatestRequestResult<T>> {
      const requestGeneration = ++generation;
      active?.controller.abort();
      const controller = new AbortController();
      active = { generation: requestGeneration, controller };

      try {
        const value = await task(controller.signal);
        if (requestGeneration !== generation) return { kind: 'obsolete' };
        return { kind: 'success', value };
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return { kind: 'cancelled' };
        if (requestGeneration !== generation) return { kind: 'obsolete' };
        return { kind: 'error', error };
      } finally {
        if (active?.generation === requestGeneration) active = null;
      }
    },

    cancel() {
      generation += 1;
      active?.controller.abort();
      active = null;
    },

    hasActiveRequest() {
      return active !== null;
    },
  };
}
