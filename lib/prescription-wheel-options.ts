export type PrescriptionWheelUnit = 'kg' | 'lb';
export type AccessoryRepTargetMode = 'FIXED' | 'RANGE' | 'AMRAP';

export type AccessoryRepTarget =
  | { mode: 'FIXED'; fixed: string }
  | { mode: 'RANGE'; low: string; high: string }
  | { mode: 'AMRAP' };

export type AccessoryRepTargetMemory = {
  fixed: string | null;
  range: { low: string; high: string } | null;
};

function formatWheelNumber(value: number) {
  return Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function withCurrentWheelOption(options: string[], current: string, numeric = true) {
  const normalized = String(current || '').trim();
  const values = options.includes(normalized) || !normalized ? [...options] : [...options, normalized];
  return Array.from(new Set(values)).sort((left, right) => {
    if (!left) return -1;
    if (!right) return 1;
    if (!numeric) {
      const leftBase = Number(left.split('-')[0]);
      const rightBase = Number(right.split('-')[0]);
      return leftBase - rightBase || left.localeCompare(right);
    }
    return Number(left) - Number(right);
  });
}

export function integerWheelOptions(min: number, max: number, current = '') {
  return withCurrentWheelOption(
    Array.from({ length: max - min + 1 }, (_, index) => String(min + index)),
    current,
  );
}

export function decimalWheelOptions(min: number, max: number, step: number, current = '') {
  const count = Math.round((max - min) / step);
  return withCurrentWheelOption(
    Array.from({ length: count + 1 }, (_, index) => formatWheelNumber(min + index * step)),
    current,
  );
}

export function accessoryRepWheelOptions(current = '') {
  return withCurrentWheelOption([
    ...Array.from({ length: 30 }, (_, index) => String(index + 1)),
    '3-5', '5-8', '6-8', '8-10', '10-12', '10-15', '12-15', '15-20', '20-25', '20-30',
  ], current, false);
}

function validRepValue(value: unknown, fallback = '10') {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return formatWheelNumber(numeric);
  const fallbackNumeric = Number(fallback);
  return Number.isFinite(fallbackNumeric) && fallbackNumeric > 0 ? formatWheelNumber(fallbackNumeric) : '10';
}

export function accessoryRepTargetFromText(value: string, fallback = '10'): AccessoryRepTarget {
  const normalized = String(value || '').trim();
  if (/^AMRAP$/i.test(normalized)) return { mode: 'AMRAP' };

  const range = normalized.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/);
  if (range) {
    const first = validRepValue(range[1], fallback);
    const second = validRepValue(range[2], fallback);
    const low = Number(first) <= Number(second) ? first : second;
    const high = Number(first) <= Number(second) ? second : first;
    return { mode: 'RANGE', low, high };
  }

  const numeric = normalized.match(/\d+(?:\.\d+)?/)?.[0];
  return { mode: 'FIXED', fixed: validRepValue(numeric, fallback) };
}

export function accessoryRepTargetText(target: AccessoryRepTarget) {
  if (target.mode === 'AMRAP') return 'AMRAP';
  if (target.mode === 'FIXED') return validRepValue(target.fixed);
  const low = validRepValue(target.low);
  const high = validRepValue(target.high, low);
  return `${low}-${high}`;
}

export function accessoryRepDisplayText(value: string, fallback = '10') {
  const target = accessoryRepTargetFromText(value, fallback);
  if (target.mode === 'AMRAP') return 'AMRAP';
  if (target.mode === 'FIXED') return target.fixed;
  return target.low === target.high ? target.low : `${target.low}–${target.high}`;
}

export function accessoryRepTargetMemoryFromTarget(target: AccessoryRepTarget): AccessoryRepTargetMemory {
  return {
    fixed: target.mode === 'FIXED' ? target.fixed : null,
    range: target.mode === 'RANGE' ? { low: target.low, high: target.high } : null,
  };
}

export function transitionAccessoryRepTarget(
  current: AccessoryRepTarget,
  nextMode: AccessoryRepTargetMode,
  memory: AccessoryRepTargetMemory,
  fallback = '10',
): { target: AccessoryRepTarget; memory: AccessoryRepTargetMemory } {
  const nextMemory: AccessoryRepTargetMemory = {
    fixed: current.mode === 'FIXED' ? current.fixed : memory.fixed,
    range: current.mode === 'RANGE' ? { low: current.low, high: current.high } : memory.range,
  };
  if (current.mode === nextMode) return { target: current, memory: nextMemory };

  if (nextMode === 'AMRAP') return { target: { mode: 'AMRAP' }, memory: nextMemory };
  if (nextMode === 'FIXED') {
    const fixed = current.mode === 'RANGE'
      ? current.low
      : validRepValue(nextMemory.fixed, fallback);
    nextMemory.fixed = fixed;
    return { target: { mode: 'FIXED', fixed }, memory: nextMemory };
  }

  const restored = current.mode === 'FIXED'
    ? { low: current.fixed, high: current.fixed }
    : nextMemory.range || {
      low: validRepValue(nextMemory.fixed, fallback),
      high: validRepValue(nextMemory.fixed, fallback),
    };
  nextMemory.range = restored;
  return { target: { mode: 'RANGE', ...restored }, memory: nextMemory };
}

export function accessoryRepRangeAfterLowerChange(lowValue: string, currentHigh: string): AccessoryRepTarget {
  const low = validRepValue(lowValue);
  const high = validRepValue(currentHigh, low);
  return { mode: 'RANGE', low, high: Number(low) > Number(high) ? low : high };
}

export function accessoryRepRangeAfterUpperChange(currentLow: string, highValue: string): AccessoryRepTarget {
  const low = validRepValue(currentLow);
  const high = validRepValue(highValue, low);
  return { mode: 'RANGE', low: Number(high) < Number(low) ? high : low, high };
}

export function accessoryRepBounds(value: string, fallback = '10') {
  const matches = String(value || '').match(/\d+(?:\.\d+)?/g) || [];
  const low = matches[0] || fallback;
  const high = matches[matches.length - 1] || low;
  return Number(low) <= Number(high) ? { low, high } : { low: high, high: low };
}

export function accessoryRepTextFromBounds(lowValue: string, highValue: string) {
  const low = Math.min(Number(lowValue), Number(highValue));
  const high = Math.max(Number(lowValue), Number(highValue));
  if (!Number.isFinite(low) || !Number.isFinite(high)) return '';
  return low === high ? formatWheelNumber(low) : `${formatWheelNumber(low)}-${formatWheelNumber(high)}`;
}

export function loadWheelOptions(unit: PrescriptionWheelUnit, current = '', allowUnset = false) {
  const options: string[] = [];
  const pushRange = (start: number, end: number, step: number) => {
    for (let value = start; value <= end + 0.0001; value += step) options.push(formatWheelNumber(value));
  };
  if (unit === 'kg') {
    pushRange(20, 68.75, 1.25);
    pushRange(70, 350, 2.5);
  } else {
    pushRange(45, 147.5, 2.5);
    pushRange(150, 800, 5);
  }
  return withCurrentWheelOption(allowUnset ? ['', ...options] : options, current);
}

export function marginWheelOptions(unit: PrescriptionWheelUnit, current = '', allowUnset = false) {
  const step = unit === 'kg' ? 1.25 : 2.5;
  const max = unit === 'kg' ? 25 : 50;
  const options = Array.from({ length: Math.round(max / step) + 1 }, (_, index) => formatWheelNumber(index * step));
  return withCurrentWheelOption(allowUnset ? ['', ...options] : options, current);
}
