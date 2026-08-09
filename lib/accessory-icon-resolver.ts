export type SLAccessoryIconName =
  | 'dumbbell-press'
  | 'dumbbell-row'
  | 'barbell-row'
  | 'ez-curl'
  | 'machine-chest-press'
  | 'cable-row'
  | 'pulldown'
  | 'leg-extension'
  | 'leg-curl'
  | 'pec-deck'
  | 'lateral-raise';

export function resolveAccessoryIconName(movement?: string | null): SLAccessoryIconName {
  const name = String(movement || '').trim().toLowerCase();
  if (name.includes('pec deck') || name.includes('fly')) return 'pec-deck';
  if (name.includes('leg extension')) return 'leg-extension';
  if (name.includes('leg curl')) return 'leg-curl';
  if (name.includes('pulldown')) return 'pulldown';
  if (name.includes('lateral') || name.includes('side raise')) return 'lateral-raise';
  if (name.includes('ez') && name.includes('curl')) return 'ez-curl';
  if (name.includes('machine') || name.includes('chest press')) return 'machine-chest-press';
  if (name.includes('cable') && name.includes('row')) return 'cable-row';
  if (name.includes('dumbbell') && name.includes('row')) return 'dumbbell-row';
  if (name.includes('barbell') && name.includes('row')) return 'barbell-row';
  if (name.includes('row')) return 'cable-row';
  return 'dumbbell-press';
}
