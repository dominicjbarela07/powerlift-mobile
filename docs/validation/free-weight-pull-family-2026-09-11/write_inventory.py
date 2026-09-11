#!/usr/bin/env python3
"""Render the exact audited inventory and review decisions without name matching."""
import collections
import json
from pathlib import Path

DOC = Path('docs/validation/free-weight-pull-family-2026-09-11')
audit = json.loads((DOC/'taxonomy-audit.json').read_text())
manifest = json.loads((DOC/'asset-manifest.json').read_text())
assets = {row['id']: row for row in manifest['movements']}
plans = {row['id']: row for row in json.loads((DOC/'generation-plan.json').read_text())['movements']}
reviews = json.loads((DOC/'reviews.json').read_text())
labels = {'lats':'Lats','upper_back':'Upper Back','rear_delts':'Rear Delts','traps':'Traps','lower_back':'Lower Back'}
lines = ['# Canonical free-weight pull inventory', '',
 'Fresh canonical DEV read-only discovery: 633 definitions inspected; 49 candidates; 47 qualifying after semantic review. No distinct Mid Back primary exists.', '',
 'Every row is a public/global, non-retired canonical definition with FREE_WEIGHT execution. The full [audit](taxonomy-audit.json) retains exact keys, aliases, family, primary/secondary muscles, implement, sidedness, ownership and retirement state. No independent movement-pattern field is governed for these rows; inferred mechanics are recorded separately in the [generation plan](generation-plan.json).', '',
 'No qualifying ID had an existing exact photo. Each previously used the governed focused-muscle fallback, recorded as MISSING_EXACT_ART rather than incorrectly classifying it as a defective exact movement asset. The original incline and all 51 push assets remain unchanged. [Manifest](asset-manifest.json) includes native master, app and thumbnail paths, sizes and hashes.', '']
for primary,label in labels.items():
 rows=[row for row in audit['qualifying'] if row['primary_muscle_group']==primary]
 lines += [f'## {label} · {len(rows)}', '', '| ID | Canonical name | Primary | Equipment → depicted implement | Existing art | Decision | Final app asset |', '|---|---|---|---|---|---|---|']
 for row in rows:
  asset=assets[row['id']]
  path=asset.get('files',{}).get('app',{}).get('path')
  final=f'[{Path(path).name}](../../../{path})' if path else 'Pending'
  lines.append(f"| {row['id']} | {row['display_name']} | {primary} | {row['equipment_type']} → {plans.get(row['id'],{}).get('implement','Pending')} | Muscle fallback; no exact art | {asset['final_status']} | {final} |")
 lines.append('')
lines += ['## Boundary exclusions', '', 'Primary back involvement is insufficient when the exact task belongs to another family. These inspected definitions are deferred without taxonomy or evidence changes.', '', '| ID | Canonical name | Primary | Decision / reason |', '|---|---|---|---|']
for row in audit['boundary_exclusions']:
 lines.append(f"| {row['id']} | {row['display_name']} | {row['primary_muscle_group']} | {row['reason']} |")
lines += ['', 'Bodyweight/cable/machine entries and secondary-only back involvement are excluded by governed execution and primary identity. The full excluded set and reasons remain in taxonomy-audit.json.', '', '## Candidate decisions', '', '| ID | Attempt | Decision | Review |', '|---|---|---|---|']
for row in reviews:
 lines.append(f"| {row['id']} | {row['attempt']} | {row['status']} | {row['reason']} |")
(DOC/'INVENTORY.md').write_text('\n'.join(lines)+'\n')
# Persist the final individual decision on every attempt receipt.
by_attempt={(row['id'],row['attempt']):row for row in reviews}
for path in sorted((DOC/'attempts').glob('*.json')):
 attempt=json.loads(path.read_text());review=by_attempt.get((attempt['id'],attempt['attempt']))
 if review:
  attempt.update(review=review['status'],review_reason=review['reason'])
  path.write_text(json.dumps(attempt,indent=2)+'\n')
print(json.dumps({'inventory':audit['count'],'boundary_exclusions':len(audit['boundary_exclusions']),'reviews':dict(collections.Counter(row['status'] for row in reviews))}))
