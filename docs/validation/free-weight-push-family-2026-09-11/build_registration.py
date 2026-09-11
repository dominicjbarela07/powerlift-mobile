#!/usr/bin/env python3
"""Extend the EXISTING canonical registry after every audited asset is accepted.
Run from mobile root. Does not mutate taxonomy or generate images.
"""
import json
from pathlib import Path

root=Path.cwd()
doc=root/'docs/validation/free-weight-push-family-2026-09-11'
audit=json.loads((doc/'taxonomy-audit.json').read_text())
manifest=json.loads((doc/'asset-manifest.json').read_text())
assert len(manifest['movements'])==audit['count']==51
assert all(row['final_status'] in ('NEW','KEEP') for row in manifest['movements']), 'Do not register unreviewed artwork'
rows={r['id']:r for r in manifest['movements']}
resolver=root/'lib/canonical-movement-artwork.ts'
source=resolver.read_text()
old="export type CanonicalAccessoryArtworkKey = 'accessory_incline_dumbbell_bench_press';"
assert old in source, 'Inspect the existing registry before regenerating'
registration='''// Canonical DEV database audit: docs/validation/free-weight-push-family-2026-09-11.
// Numeric MovementDefinition IDs are the lookup boundary. Stable keys and primary
// taxonomy must agree, excluding row-ID collisions and contradictory subjects.
export const CANONICAL_ACCESSORY_ARTWORK_IDENTITIES = {
'''
for row in audit['qualifying']:
 registration+=f"  {row['id']}: {{ key: '{row['key']}', primary: '{row['primary_muscle_group']}' }},\n"
registration+='''} as const;
export type CanonicalAccessoryArtworkKey =
  typeof CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[keyof typeof CANONICAL_ACCESSORY_ARTWORK_IDENTITIES]['key'];
const REGISTERED_ACCESSORY_ARTWORK_KEYS = new Set<string>(
  Object.values(CANONICAL_ACCESSORY_ARTWORK_IDENTITIES).map((entry) => entry.key),
);'''
source=source.replace(old,registration)
old_resolve='''    // This is the catalog's stable governed key, never a title or alias.
    const artworkKey: CanonicalAccessoryArtworkKey | undefined =
      identity?.key === 'accessory_incline_dumbbell_bench_press'
        ? identity.key
        : undefined;'''
assert old_resolve in source
source=source.replace(old_resolve,'''    const registered = CANONICAL_ACCESSORY_ARTWORK_IDENTITIES[
      id as keyof typeof CANONICAL_ACCESSORY_ARTWORK_IDENTITIES
    ];
    if (registered && (
      identity?.key !== registered.key
      || taxonomy.primaryMuscleGroup !== registered.primary
    )) return null;
    if (!registered && REGISTERED_ACCESSORY_ARTWORK_KEYS.has(identity?.key || '')) return null;
    const artworkKey: CanonicalAccessoryArtworkKey | undefined = registered?.key;''')
resolver.write_text(source)
assets=root/'lib/canonical-movement-artwork-assets.ts'
source=assets.read_text()
start=source.index('  accessory_incline_dumbbell_bench_press: {')
end=source.index('\n};',start)
blocks=[]
for row in audit['qualifying']:
 asset=rows[row['id']]
 for role in ('app','thumbnail'): assert (root/asset['files'][role]['path']).is_file()
 label='Athlete performing '+row['display_name'].lower()
 blocks.append(f"  {row['key']}: {{\n    source: require('@/{asset['files']['app']['path']}'),\n    thumbnail: require('@/{asset['files']['thumbnail']['path']}'),\n    label: '{label}',\n  }},")
assets.write_text(source[:start]+'\n'.join(blocks)+source[end:])
print('Registered all 51 audited and reviewed MovementDefinition IDs in existing resolver and asset map')
