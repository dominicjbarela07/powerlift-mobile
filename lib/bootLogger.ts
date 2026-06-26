const bootStartedAt = Date.now();
let lastMarkAt = bootStartedAt;

function formatDetails(details?: Record<string, unknown>): string {
  if (!details) return '';
  const pairs = Object.entries(details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);
  return pairs.length ? ` ${pairs.join(' ')}` : '';
}

export function bootLog(stage: string, details?: Record<string, unknown>) {
  const now = Date.now();
  const deltaMs = now - lastMarkAt;
  const totalMs = now - bootStartedAt;
  lastMarkAt = now;
  console.log(`[BOOT] ${stage} delta_ms=${deltaMs} total_ms=${totalMs}${formatDetails(details)}`);
}

export function bootNow(): number {
  return Date.now();
}

export function bootDuration(stage: string, startedAt: number, details?: Record<string, unknown>) {
  bootLog(stage, {
    ...details,
    duration_ms: Date.now() - startedAt,
  });
}

