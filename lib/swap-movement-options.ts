export type SwapMovementOption = Readonly<{
  movement: string;
  kind: 'current' | 'prescribed' | 'approved';
}>;

export type SwapMovementGroup = Readonly<{
  title: string;
  options: readonly SwapMovementOption[];
}>;

function clean(value: unknown) {
  return String(value || '').trim();
}

export function buildSwapMovementGroups(input: Readonly<{
  current?: string | null;
  prescribed?: string | null;
  approved?: readonly string[] | null;
  query?: string | null;
}>): readonly SwapMovementGroup[] {
  const query = clean(input.query).toLowerCase();
  const seen = new Set<string>();
  const options: SwapMovementOption[] = [];
  const add = (movement: unknown, kind: SwapMovementOption['kind']) => {
    const value = clean(movement);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return;
    seen.add(key);
    options.push(Object.freeze({ movement: value, kind }));
  };

  add(input.current, 'current');
  add(input.prescribed, 'prescribed');
  (input.approved || []).forEach((movement) => add(movement, 'approved'));

  const matches = options.filter((option) => (
    !query || option.movement.toLowerCase().includes(query)
  ));
  const current = matches.filter((option) => option.kind === 'current');
  const prescribed = matches.filter((option) => option.kind === 'prescribed');
  const approved = matches.filter((option) => option.kind === 'approved');

  return Object.freeze([
    current.length ? Object.freeze({ title: 'Current movement', options: Object.freeze(current) }) : null,
    prescribed.length ? Object.freeze({ title: 'Prescribed movement', options: Object.freeze(prescribed) }) : null,
    approved.length ? Object.freeze({ title: 'Approved alternatives', options: Object.freeze(approved) }) : null,
  ].filter(Boolean) as SwapMovementGroup[]);
}
