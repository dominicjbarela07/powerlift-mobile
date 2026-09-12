#!/usr/bin/env python3
"""Read-only canonical DEV catalog/coverage reconciliation; no primary filter."""
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import psycopg2
from dotenv import dotenv_values

ROOT = Path.cwd()
MOBILE = ROOT / 'powerlift_mobile'
DOC = MOBILE / 'docs/validation/free-weight-completion-2026-09-11'
DOC.mkdir(parents=True, exist_ok=True)
uri = dotenv_values(ROOT / '.env.dev')['DATABASE_URL']
assert urlparse(uri).hostname in ('localhost', '127.0.0.1'), 'Canonical local DEV only'
with psycopg2.connect(uri) as connection:
    connection.set_session(readonly=True)
    with connection.cursor() as cursor:
        cursor.execute('SELECT row_to_json(m) FROM movement_definition m ORDER BY id')
        definitions = [row[0] for row in cursor.fetchall()]
        cursor.execute('SELECT row_to_json(a) FROM movement_alias a ORDER BY movement_definition_id,id')
        aliases = [row[0] for row in cursor.fetchall()]

registered = {int(i): key for i, key in re.findall(r"^  (\d+): \{ key: '([^']+)'", (MOBILE / 'lib/canonical-movement-artwork.ts').read_text(), re.M)}
family_source = (MOBILE / 'lib/accessory-muscle-group.ts').read_text()
family_table = family_source.split('const GOVERNED_FAMILY_REGIONS:')[1].split('\n};')[0]
governed_family_regions = dict(re.findall(r"^  ([a-z_]+): '([a-z_]+)'", family_table, re.M))
prior = {}
for batch in ('push', 'pull'):
    manifest = json.loads((MOBILE / f'docs/validation/free-weight-{batch}-family-2026-09-11/asset-manifest.json').read_text())
    for item in manifest['movements']:
        assert item['final_status'] in ('KEEP', 'NEW')
        assert registered[item['id']] == item['key']
        for file in item['files'].values():
            assert hashlib.sha256((MOBILE / file['path']).read_bytes()).hexdigest() == file['sha256']
        prior[item['id']] = {'generation_batch': batch.title(), 'files': item['files'], 'review': item['review']}

records = []
for definition in definitions:
    material = json.loads(definition['material_parameters_json'] or '{}')
    taxonomy = material.get('accessory_taxonomy') or {}
    public = definition['ownership_scope'] == 'global'
    row = {key: definition[key] for key in ('id', 'key', 'display_name', 'family', 'kind', 'equipment_type', 'loading_implementation', 'load_convention', 'measurement_type', 'sidedness', 'ownership_scope', 'identity_status', 'identity_specificity', 'provenance', 'retired_at', 'replacement_id')}
    if not public:
        row.update(key='[private]', display_name='[private]')
    row.update(taxonomy)
    row['primary_muscle_group'] = taxonomy.get('primary_muscle_group')
    row['secondary_muscle_groups'] = taxonomy.get('secondary_muscle_groups')
    row['artwork_primary_muscle_group'] = taxonomy.get('primary_muscle_group') or governed_family_regions.get(row['family'])
    row['artwork_primary_source'] = 'stored_accessory_taxonomy' if taxonomy.get('primary_muscle_group') else 'existing_GOVERNED_FAMILY_REGIONS_adapter'
    row['visibility'] = 'public' if public else 'private'
    row['movement_pattern'] = material.get('movement_pattern') or taxonomy.get('movement_pattern')
    row['aliases'] = [{'name': a['display_alias'] if public else '[private]', 'type': a['alias_type'], 'retired_at': a['retired_at']} for a in aliases if a['movement_definition_id'] == row['id']]
    row['prior_artwork'] = prior.get(row['id'])
    eligible = row['kind'] == 'accessory' and row['identity_status'] == 'canonical' and not row['retired_at']
    if not eligible:
        row.update(decision='EXCLUDED', reason='Not an active canonical accessory definition.')
    elif row.get('execution_family') == 'FREE_WEIGHT':
        row.update(decision='APPROVED' if row['prior_artwork'] else 'NEEDS NEW ART', reason='Governed FREE_WEIGHT execution; no primary-muscle restriction.')
    elif row['id'] in (4, 5, 6, 7):
        assert row['loading_implementation'] == 'free_weight' and row['equipment_type'] in ('barbell', 'dumbbell')
        assert row['artwork_primary_muscle_group'] in ('chest', 'upper_back')
        row.update(decision='NEEDS NEW ART', reason='Legacy active canonical accessory has governed free_weight loading and barbell/dumbbell equipment. The existing typed GOVERNED_FAMILY_REGIONS adapter already supplies chest/upper_back from horizontal_push/pull. Retain raw absent taxonomy, independent ID/key and history; register its own exact art without a taxonomy or identity migration.')
    elif row['id'] == 343:
        row.update(decision='REVIEW', blocked=True, reason='OTHER_PORTABLE Towel Grip Hold stores unknown loading/implement. It could mean a bodyweight towel hang or an externally loaded towel hold. Canonical definition does not establish which; needs governed implement/product clarification before depiction.')
    elif row['id'] == 342:
        row.update(decision='EXCLUDED', reason='OTHER_PORTABLE hand gripper applies spring resistance, not a free-moving external weight.')
    elif row['id'] == 344:
        row.update(decision='EXCLUDED', reason='OTHER_PORTABLE rice-bucket hand drill uses granular drag, not a lifted free-weight implement.')
    elif not row.get('execution_family'):
        row.update(decision='EXCLUDED', reason='Legacy equipment/bodyweight definition lacks accessory taxonomy and its stored loading is cable, machine or bodyweight; not a free-weight accessory.')
    else:
        row.update(decision='EXCLUDED', reason=f"Governed {row.get('execution_family')} execution is outside free-weight artwork coverage.")
    records.append(row)

active = [r for r in records if r['kind'] == 'accessory' and r['identity_status'] == 'canonical' and not r['retired_at']]
result = {'queried_at_utc': datetime.now(timezone.utc).isoformat(), 'environment': 'canonical local DEV', 'transaction': 'read_only', 'selection': 'All MovementDefinitions; active canonical accessory kind intersect governed execution/equipment, then explicit ambiguous-equipment review. No name or primary-muscle filtering.', 'definitions_audited': len(records), 'accessory_rows_all_statuses': sum(r['kind'] == 'accessory' for r in records), 'active_canonical_accessory_count': len(active), 'counts_by_execution': dict(Counter(r.get('execution_family') or 'MISSING' for r in active)), 'taxonomized_free_weight_count': sum(r.get('execution_family') == 'FREE_WEIGHT' for r in active), 'confirmed_free_weight_including_legacy_count': sum(r.get('execution_family') == 'FREE_WEIGHT' or r['id'] in (4, 5, 6, 7) for r in active), 'prior_coverage': dict(Counter(r['generation_batch'] for r in prior.values())), 'initial_decisions': dict(Counter(r['decision'] for r in records)), 'remaining_by_primary': dict(Counter(r['artwork_primary_muscle_group'] for r in records if r['decision'] == 'NEEDS NEW ART')), 'blocked_ids': [r['id'] for r in records if r.get('blocked')], 'records': records}
(DOC / 'taxonomy-audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'records'}, indent=2))
print('REMAINING FREE_WEIGHT')
for r in records:
    if r['decision'] == 'NEEDS NEW ART':
        print(r['id'], r['display_name'], '|', r.get('primary_muscle_group'), '|', r['equipment_type'], '|', r['sidedness'])
print('AMBIGUOUS REVIEW')
for r in records:
    if r['decision'] == 'REVIEW':
        print(r['id'], r['display_name'], '|', r.get('execution_family'), '|', r['equipment_type'], '|', r['loading_implementation'])
