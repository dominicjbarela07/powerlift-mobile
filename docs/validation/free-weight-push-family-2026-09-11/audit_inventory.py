#!/usr/bin/env python3
"""Read-only canonical DEV taxonomy audit. Run using backend venv from backend root.
No environment URLs, owner IDs or private display names are written to the receipt.
"""
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2

PRIMARY = ('chest', 'triceps', 'front_delts', 'side_delts')
SQL = '''SELECT row_to_json(m) FROM movement_definition m ORDER BY id'''
SELECTION_SQL = '''SELECT id, key, display_name FROM movement_definition
WHERE identity_status = 'canonical' AND retired_at IS NULL
  AND material_parameters_json::jsonb #>> '{accessory_taxonomy,execution_family}' = 'FREE_WEIGHT'
  AND material_parameters_json::jsonb #>> '{accessory_taxonomy,primary_muscle_group}'
      IN ('chest','triceps','front_delts','side_delts')
ORDER BY id'''
uri = dotenv_values('.env.dev')['DATABASE_URL']
assert urlparse(uri).hostname in ('localhost', '127.0.0.1'), 'Canonical local DEV only'
with psycopg2.connect(uri) as connection:
 connection.set_session(readonly=True)
 with connection.cursor() as cursor:
  cursor.execute(SQL)
  rows = [row[0] for row in cursor.fetchall()]
  cursor.execute('SELECT row_to_json(a) FROM movement_alias a ORDER BY movement_definition_id,id')
  aliases = [row[0] for row in cursor.fetchall()]
  cursor.execute(SELECTION_SQL)
  sql_ids = {row[0] for row in cursor.fetchall()}
qualified, excluded = [], []
for row in rows:
 material = json.loads(row['material_parameters_json'] or '{}')
 taxonomy = material.get('accessory_taxonomy') or {}
 reasons = []
 if row['identity_status'] != 'canonical': reasons.append('not_canonical')
 if row['retired_at']: reasons.append('retired')
 if taxonomy.get('primary_muscle_group') not in PRIMARY: reasons.append('primary_outside_scope_or_missing')
 if taxonomy.get('execution_family') != 'FREE_WEIGHT': reasons.append('not_governed_free_weight')
 if reasons:
  excluded.append({'id': row['id'], 'key': row['key'] if row['ownership_scope']=='global' else '[private]', 'kind': row['kind'], 'primary': taxonomy.get('primary_muscle_group'), 'execution_family': taxonomy.get('execution_family'), 'equipment_type': row['equipment_type'], 'reasons': reasons})
  continue
 record = {key: row[key] for key in ('id','key','display_name','family','kind','equipment_type','loading_implementation','load_convention','sidedness','ownership_scope','identity_status','identity_specificity','provenance','retired_at','replacement_id')}
 record.update(taxonomy)
 record['aliases'] = [{'name':a['display_alias'],'type':a['alias_type'],'retired_at':a['retired_at']} for a in aliases if a['movement_definition_id']==row['id']]
 record['visibility'] = 'public' if row['ownership_scope']=='global' else 'private'
 record['existing_art_status'] = 'KEEP' if row['id']==33 else 'MISSING_EXACT_ART'
 record['existing_art_note'] = 'Approved original control specimen' if row['id']==33 else 'Existing focused-muscle fallback; no exact canonical asset registered'
 qualified.append(record)
assert {row['id'] for row in qualified} == sql_ids
result = {'queried_at_utc':datetime.now(timezone.utc).isoformat(),'environment':'canonical local DEV','transaction':'read_only','definitions_audited':len(rows),'selection_sql':SELECTION_SQL,'primary_keys':PRIMARY,'count':len(qualified),'counts_by_primary':dict(Counter(r['primary_muscle_group'] for r in qualified)),'qualifying':qualified,'excluded':excluded}
output = Path('powerlift_mobile/docs/validation/free-weight-push-family-2026-09-11/taxonomy-audit.json')
output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ('definitions_audited','count','counts_by_primary')}))
