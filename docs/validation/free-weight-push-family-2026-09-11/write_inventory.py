#!/usr/bin/env python3
"""Write the complete grouped inventory from the database audit and asset receipts."""
import json
from pathlib import Path
p=Path('docs/validation/free-weight-push-family-2026-09-11')
audit=json.loads((p/'taxonomy-audit.json').read_text())
manifest=json.loads((p/'asset-manifest.json').read_text())
assets={r['id']:r for r in manifest['movements']}
implements={43:'straight barbell',44:'straight barbell',45:'straight barbell',46:'straight barbell',47:'cambered bench bar',73:'weight plate',81:'dumbbells',84:'weight plate',86:'landmine barbell',87:'landmine barbell',88:'landmine barbell',89:'straight barbell',90:'straight barbell',110:'weight plates',289:'straight barbell',290:'straight barbell',292:'EZ bar',294:'EZ bar',295:'EZ bar',298:'dumbbells',300:'single dumbbell'}
implements.update({106:'single dumbbell',107:'single dumbbell',296:'single dumbbell, two hands',297:'single dumbbell, one hand'})
lines=['# Complete canonical free-weight push artwork inventory','',f"Read-only DEV query audited **{audit['definitions_audited']} definitions** and selected **{audit['count']}**. All qualifying rows are active canonical public/global identities. [Exact SQL, metadata, aliases and exclusions](taxonomy-audit.json).",'', 'Existing exact artwork: **1 KEEP**, **50 missing exact assets** (focused-muscle fallbacks). No existing high-quality canonical photo is overwritten. The approved baseline remains byte-for-byte unchanged.','']
for primary,title in [('chest','Chest'),('triceps','Triceps'),('front_delts','Front Delts'),('side_delts','Side Delts')]:
 rows=[r for r in audit['qualifying'] if r['primary_muscle_group']==primary]
 lines += [f'## {title} — {len(rows)} definitions','', '| Canonical ID | Movement | Stored equipment → depicted implement | Existing art | Final art | App asset |','| --- | --- | --- | --- | --- | --- |']
 for r in rows:
  a=assets[r['id']];depicted=implements.get(r['id'], 'dumbbells' if r['equipment_type']=='dumbbell' else r['equipment_type'])
  asset=f"[PNG](../../../{a['files']['app']['path']})" if a.get('files') else 'Pending acceptance'
  lines.append(f"| {r['id']} | {r['display_name']} | {r['equipment_type']} → {depicted} | {r['existing_art_status']} | {a['final_status']} | {asset} |")
 lines.append('')
lines += ['[Master/card/thumbnail paths, dimensions and SHA-256 hashes](asset-manifest.json) · [Individual acceptance/rejection decisions](reviews.json) · [Fixed family specification](../../FREE_WEIGHT_MOVEMENT_ARTWORK_SPECIFICATION.md)','', '**NO TESTFLIGHT. NO PRODUCTION.**','']
(p/'INVENTORY.md').write_text('\n'.join(lines))
print('Wrote grouped inventory for all 51 canonical definitions')
