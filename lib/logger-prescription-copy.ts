export type LoggerRepMetricCopy = Readonly<{
  value: string;
  unitLabel: 'REP' | 'REPS';
}>;

export function loggerRepMetricCopy(value?: string | number | null): LoggerRepMetricCopy {
  const normalized = String(value ?? '').trim().replace(/\s*reps?$/i, '').trim();
  const numericValue = Number(normalized);
  return Object.freeze({
    value: normalized,
    unitLabel: Number.isFinite(numericValue) && numericValue === 1 ? 'REP' : 'REPS',
  });
}
