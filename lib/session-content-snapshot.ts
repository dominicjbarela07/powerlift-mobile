export type SessionContentSnapshotInput = {
  movements?: (string | null | undefined)[] | null;
  accessoryCount?: number | null;
};

type CoreLiftFamily = 'squat' | 'bench' | 'deadlift';

function coreLiftFamily(value: string): CoreLiftFamily | null {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('squat')) return 'squat';
  if (normalized.includes('bench')) return 'bench';
  if (normalized.includes('deadlift') || normalized.includes('dead lift')) return 'deadlift';
  return null;
}

export function formatSessionContentSnapshot({
  movements,
  accessoryCount,
}: SessionContentSnapshotInput) {
  const seen = new Set<string>();
  const uniqueMovements = (movements || [])
    .map((movement) => String(movement || '').trim())
    .filter((movement) => {
      if (!movement) return false;
      const key = movement.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const families = new Set(
    uniqueMovements
      .map(coreLiftFamily)
      .filter((family): family is CoreLiftFamily => family != null),
  );
  const hasSbd =
    families.has('squat')
    && families.has('bench')
    && families.has('deadlift');

  const movementLabels = hasSbd
    ? [
        'SBD',
        ...uniqueMovements.filter((movement) => coreLiftFamily(movement) == null),
      ]
    : uniqueMovements;

  const normalizedAccessoryCount = Math.max(0, Math.trunc(Number(accessoryCount) || 0));
  if (normalizedAccessoryCount > 0) {
    movementLabels.push(
      `${normalizedAccessoryCount} ${normalizedAccessoryCount === 1 ? 'Accessory' : 'Accessories'}`,
    );
  }

  return movementLabels.join(' · ');
}
