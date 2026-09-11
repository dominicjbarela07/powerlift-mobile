#!/usr/bin/env python3
"""Extend explicit numeric-ID and static-require tables with reviewed assets only."""
import json
import re
from pathlib import Path

ROOT = Path.cwd()
DOC = ROOT / 'docs/validation/free-weight-pull-family-2026-09-11'
manifest = json.loads((DOC / 'asset-manifest.json').read_text())['movements']
accepted = [row for row in manifest if row['final_status'] == 'NEW']
path = ROOT / 'lib/canonical-movement-artwork.ts'
source = path.read_text()
start = source.index('export const CANONICAL_ACCESSORY_ARTWORK_IDENTITIES = {')
end = source.index('} as const;', start)
table = source[start:end]
for row in accepted:
    if not re.search(r'^  '+str(row['id'])+r':', table, re.M):
        table += f"  {row['id']}: {{ key: '{row['key']}', primary: '{row['primary_muscle_group']}' }},\n"
source = source[:start] + table + source[end:]
source = source.replace('// Canonical DEV database audit: docs/validation/free-weight-push-family-2026-09-11.', '// Canonical DEV database audits: docs/validation/free-weight-{push,pull}-family-2026-09-11.')
path.write_text(source)
path = ROOT / 'lib/canonical-movement-artwork-assets.ts'
source = path.read_text()
start = source.index('export const CANONICAL_ACCESSORY_MOVEMENT_ARTWORK:')
end = source.index('\n};', start)
table = source[start:end]
for row in accepted:
    if f"  {row['key']}: {{" not in table:
        files = row['files']
        label = ('Athlete performing ' + row['display_name'].lower()).replace("'", "\\'")
        table += f"\n  {row['key']}: {{\n    source: require('@/{files['app']['path']}'),\n    thumbnail: require('@/{files['thumbnail']['path']}'),\n    label: '{label}',\n  }},"
path.write_text(source[:start] + table + source[end:])
print(f'Registered {len(accepted)} reviewed pull identities; resolver precedence unchanged.')
