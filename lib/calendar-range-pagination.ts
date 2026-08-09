export type CalendarRange = {
  start: string;
  end: string;
};

export const MAX_CALENDAR_API_RANGE_DAYS = 70;

type RangeRequestOptions = {
  cancelStale?: boolean;
  force?: boolean;
};

export type RangeRequestResult<T> = {
  key: string;
  source: 'cache' | 'network' | 'inflight';
  value: T;
};

type InflightRequest<T> = {
  controller: AbortController;
  promise: Promise<T>;
};

export function calendarRangeKey(range: CalendarRange, cacheScope = '') {
  const rangeKey = `${range.start}:${range.end}`;
  return cacheScope ? `${cacheScope}:${rangeKey}` : rangeKey;
}

export function nextCalendarRange(end: string, pageDays = 42): CalendarRange {
  return {
    // Calendar API ranges are half-open: [start, end). The next page begins
    // exactly at the prior exclusive end so there is neither a gap nor overlap.
    start: end,
    end: addDays(end, pageDays),
  };
}

export function previousCalendarRange(start: string, pageDays = 42): CalendarRange {
  return {
    start: addDays(start, -pageDays),
    end: start,
  };
}

export function canonicalCalendarRangeForMonth(month: Date): CalendarRange {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - 14);
  start.setDate(start.getDate() - start.getDay());

  const startYmd = formatLocalDate(start);
  return {
    start: startYmd,
    end: addDays(startYmd, MAX_CALENDAR_API_RANGE_DAYS),
  };
}

export function createCalendarRangeRequestManager<T>(
  fetchRange: (range: CalendarRange, signal: AbortSignal) => Promise<T>,
  { cacheScope = '' }: { cacheScope?: string } = {},
) {
  const cache = new Map<string, T>();
  const inflight = new Map<string, InflightRequest<T>>();

  const cancelExcept = (key: string) => {
    for (const [requestKey, request] of inflight) {
      if (requestKey !== key) {
        request.controller.abort();
        inflight.delete(requestKey);
      }
    }
  };

  return {
    async request(range: CalendarRange, options: RangeRequestOptions = {}): Promise<RangeRequestResult<T>> {
      const key = calendarRangeKey(range, cacheScope);
      if (options.cancelStale) cancelExcept(key);

      const active = inflight.get(key);
      if (active) {
        if (!options.force) {
          return { key, source: 'inflight', value: await active.promise };
        }
        active.controller.abort();
        inflight.delete(key);
      }

      if (!options.force && cache.has(key)) {
        return { key, source: 'cache', value: cache.get(key)! };
      }

      const controller = new AbortController();
      const promise = fetchRange(range, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) cache.set(key, value);
          return value;
        })
        .finally(() => {
          if (inflight.get(key)?.promise === promise) inflight.delete(key);
        });
      inflight.set(key, { controller, promise });
      return { key, source: 'network', value: await promise };
    },

    cancelAll() {
      for (const request of inflight.values()) request.controller.abort();
      inflight.clear();
    },

    clear(range?: CalendarRange) {
      if (range) cache.delete(calendarRangeKey(range, cacheScope));
      else cache.clear();
    },

    hasCached(range: CalendarRange) {
      return cache.has(calendarRangeKey(range, cacheScope));
    },

    inflightCount() {
      return inflight.size;
    },
  };
}

export function createCalendarBoundaryGuard({
  threshold = 240,
  hysteresis = 160,
  minimumMovement = 8,
}: {
  threshold?: number;
  hysteresis?: number;
  minimumMovement?: number;
} = {}) {
  let activeGesture = false;
  let armed = true;
  let moved = false;
  let lastOffset = 0;

  return {
    begin(offsetY: number) {
      activeGesture = true;
      moved = false;
      lastOffset = offsetY;
    },

    update({ offsetY, remaining }: { offsetY: number; remaining: number }) {
      const delta = offsetY - lastOffset;
      if (Math.abs(delta) >= minimumMovement) moved = true;
      if (remaining > threshold + hysteresis) armed = true;

      const crossedBoundary = activeGesture && moved && delta > 0 && remaining <= threshold && armed;
      if (crossedBoundary) armed = false;
      lastOffset = offsetY;
      return crossedBoundary;
    },

    end() {
      activeGesture = false;
      moved = false;
    },

    reset() {
      activeGesture = false;
      armed = true;
      moved = false;
      lastOffset = 0;
    },

    isArmed() {
      return armed;
    },
  };
}

function addDays(value: string, count: number) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + count));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
