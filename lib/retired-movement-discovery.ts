import retirements from '@/config/governed-movement-retirements.json';

const retiredKeys = new Set<string>(retirements.retired_keys);
type Definition = {
  key?: string; identity_status?: string; retired_at?: string | null;
  ownership_scope?: string; library_scope?: string;
};

/** Selection only. Never redirect IDs or remove evidence from an existing Session. */
export function isSelectableLibraryMovement(row: Definition): boolean {
  if (row.identity_status === 'retired' || row.retired_at) return false;
  const custom = (row.ownership_scope != null && row.ownership_scope !== 'global')
    || row.library_scope === 'my_movement';
  return custom || !retiredKeys.has(row.key ?? '');
}

/** Older shared backends can still return withdrawn global definitions. Apply
 * the same governed selection rule to Add, Swap, favorites and recent results.
 * Keep server cursors intact: they address the unfiltered server result set.
 * History, saved Sessions, mutation responses and custom restoration are not
 * selection catalogs and must retain their original payloads.
 */
export function filterRetiredMovementLibraryResponse<T>(path: string, payload: T): T {
  const route = path.split('?')[0];
  const search = route === '/workouts/mobile/movement-definitions/search';
  const presets = route === '/workouts/mobile/movement_presets';
  if ((!search && !presets) || !payload || typeof payload !== 'object') return payload;
  const data = payload as Record<string, any>;
  if (data.ok === false) return payload;
  const managesRetiredCustom = new URLSearchParams(path.split('?')[1] || '').get('include_retired');
  const keep = (row: Definition) => isSelectableLibraryMovement(row)
    || (search && ['1', 'true', 'yes'].includes(managesRetiredCustom || '')
      && (row.ownership_scope === 'coach' || row.ownership_scope === 'athlete'));
  const group = (value: any) => {
    if (!value || !Array.isArray(value.items)) return value;
    const items = value.items.filter(keep);
    return { ...value, items, ...(typeof value.total_count === 'number'
      ? { total_count: Math.max(items.length, value.total_count - (value.items.length - items.length)) } : {}) };
  };
  if (presets) {
    if (!Array.isArray(data.accessories?.definitions)) return payload;
    return { ...data, accessories: { ...data.accessories, definitions: data.accessories.definitions.filter(keep) } } as T;
  }
  return { ...data,
    ...(Array.isArray(data.items) ? { items: data.items.filter(keep) } : {}),
    ...(data.result_groups ? { result_groups: { ...data.result_groups,
      primary: group(data.result_groups.primary), secondary: group(data.result_groups.secondary),
    } } : {}),
  } as T;
}
