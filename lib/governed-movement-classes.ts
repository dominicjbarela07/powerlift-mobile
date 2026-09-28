export type MovementClass = 'core' | 'variant' | 'accessory';

export type GovernedCoreChoice = {
  id: number;
  display_name: string;
  lift: string;
  core_movement_kind: 'competition' | 'variant';
  core_movement_family: string;
  movement_definition_id?: number | null;
};

export const MOVEMENT_CLASS_OPTIONS: { key: MovementClass; label: string }[] = [
  { key: 'core', label: 'CORE' },
  { key: 'variant', label: 'VARIANTS' },
  { key: 'accessory', label: 'ACCESSORIES' },
];

export function governedCoreClass(row: Pick<GovernedCoreChoice, 'core_movement_kind'>): MovementClass | null {
  if (row.core_movement_kind === 'competition') return 'core';
  if (row.core_movement_kind === 'variant') return 'variant';
  return null;
}

export function governedCoreChoices(groups: { movements?: unknown[] }[]): GovernedCoreChoice[] {
  const choices = new Map<number, GovernedCoreChoice>();
  for (const group of groups) {
    for (const value of group.movements || []) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      const id = Number(row.core_movement_id || row.id);
      const kind = row.core_movement_kind;
      const family = String(row.core_movement_family || '');
      if (!Number.isInteger(id) || id <= 0 || (kind !== 'competition' && kind !== 'variant') || !family) continue;
      if (kind === 'variant' && !['squat', 'bench', 'deadlift'].includes(family)) continue;
      choices.set(id, {
        id,
        display_name: String(row.display_name || row.name || ''),
        lift: String(row.lift || ''),
        core_movement_kind: kind,
        core_movement_family: family,
        movement_definition_id: Number(row.movement_definition_id) || null,
      });
    }
  }
  return [...choices.values()];
}

export function coreFamilyLabel(family: string): string {
  return ({ squat: 'Competition Squat', bench: 'Competition Bench', deadlift: 'Competition Deadlift' } as Record<string, string>)[family] || family;
}
