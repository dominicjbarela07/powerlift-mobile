#!/usr/bin/env python3
"""Read-only local DEV discovery followed by explicit semantic boundary review."""
import json,re
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2

PRIMARY=('lats','upper_back','rear_delts','traps','lower_back')
DEFER={546:'Hip-hinge Good Morning; defer with the lower-body hinge family despite stored lower_back primary.',548:'Zercher-loaded hip hinge; defer with Good Mornings/lower-body hinges.'}
SQL="""SELECT id,key,display_name FROM movement_definition
WHERE identity_status='canonical' AND retired_at IS NULL
AND material_parameters_json::jsonb #>> '{accessory_taxonomy,execution_family}'='FREE_WEIGHT'
AND material_parameters_json::jsonb #>> '{accessory_taxonomy,primary_muscle_group}'
IN ('lats','upper_back','rear_delts','traps','lower_back')
ORDER BY id"""
root=Path.cwd();mobile=root/'powerlift_mobile';proof=mobile/'docs/validation/free-weight-pull-family-2026-09-11'
proof.mkdir(parents=True,exist_ok=True)
uri=dotenv_values('.env.dev')['DATABASE_URL']
assert urlparse(uri).hostname in ('localhost','127.0.0.1'),'Local canonical DEV only'
with psycopg2.connect(uri) as conn:
 conn.set_session(readonly=True)
 with conn.cursor() as c:
  c.execute('SELECT row_to_json(m) FROM movement_definition m ORDER BY id');rows=[x[0] for x in c.fetchall()]
  c.execute('SELECT row_to_json(a) FROM movement_alias a ORDER BY movement_definition_id,id');aliases=[x[0] for x in c.fetchall()]
  c.execute(SQL);candidate_ids={x[0] for x in c.fetchall()}
registered={int(i):key for i,key in re.findall(r"^  (\d+): \{ key: '([^']+)'", (mobile/'lib/canonical-movement-artwork.ts').read_text(),re.M)}
qualifying=[];candidates=[];excluded=[];boundary=[]
counts=Counter();taxonomy_keys=set()
for row in rows:
 material=json.loads(row['material_parameters_json'] or '{}');tax=material.get('accessory_taxonomy') or {}
 primary=tax.get('primary_muscle_group');execution=tax.get('execution_family')
 if primary:taxonomy_keys.add(primary)
 canonical=row['identity_status']=='canonical' and not row['retired_at']
 if canonical and execution=='FREE_WEIGHT':counts[primary]+=1
 public=row['ownership_scope']=='global'
 record={k:row[k] for k in ('id','key','display_name','family','kind','equipment_type','loading_implementation','load_convention','sidedness','ownership_scope','identity_status','identity_specificity','provenance','retired_at','replacement_id')}
 if not public:record.update(key='[private]',display_name='[private]')
 record.update(tax)
 record['movement_pattern']=material.get('movement_pattern') or tax.get('movement_pattern')
 record['movement_pattern_note']='No independent governed pattern stored' if not record['movement_pattern'] else None
 record['visibility']='public' if public else 'private'
 record['aliases']=[{'name':a['display_alias'] if public else '[private]','type':a['alias_type'],'retired_at':a['retired_at']} for a in aliases if a['movement_definition_id']==row['id']]
 record['existing_art_status']='EXACT_REGISTERED_REVIEW' if row['id'] in registered else 'MISSING_EXACT_ART'
 record['existing_art_note']='Existing focused-muscle fallback, no exact registered movement photograph' if row['id'] not in registered else registered[row['id']]
 if row['id'] in candidate_ids:
  candidates.append(record)
  if row['id'] in DEFER:
   boundary.append({**record,'decision':'DEFER_LOWER_BODY_HINGE','reason':DEFER[row['id']]})
  else:
   note={240:'Governed traps-primary loaded carry: upper-back/trap loading warrants inclusion although it is not a literal row.',545:'Supported, externally loaded back extension directly develops the posterior trunk.',547:'Governed lower_back spinal-articulation exercise; distinct from the rigid-spine hip-hinge family.',549:'Externally loaded supported posterior-trunk isometric, not a lower-body hinge repetition.'}.get(row['id'],'Primary governed back/posterior upper-body free-weight identity.')
   record['semantic_decision']='INCLUDE';record['semantic_reason']=note;qualifying.append(record)
 else:
  reasons=[]
  if not canonical:reasons.append('noncanonical_or_retired')
  if execution!='FREE_WEIGHT':reasons.append('not_governed_free_weight')
  if primary not in PRIMARY:reasons.append('primary_outside_back_posterior_scope')
  excluded.append({'id':row['id'],'key':record['key'],'primary':primary,'execution_family':execution,'reasons':reasons})
  if canonical and execution=='FREE_WEIGHT' and primary in ('hamstrings','glutes','biceps','forearms','serratus','neck'):
   reason={'hamstrings':'Lower-body hamstring/hinge family; secondary back involvement does not qualify.', 'glutes':'Lower-body glute family; posterior-chain overlap is insufficient.', 'biceps':'Anterior-arm elbow-flexor isolation belongs to a future arms family.', 'forearms':'Grip/wrist/forearm identity belongs to a future arms/grip family.', 'serratus':'Scapular protraction/reach identity is not this back/posterior family, including pullover-named entries.', 'neck':'Cervical isolation is a separate neck family, not governed back/trap pulling.'}[primary]
   boundary.append({**record,'decision':'DEFER_OTHER_FAMILY','reason':reason})
assert len(candidates)==49 and len(qualifying)==47
assert not any(r['id'] in registered for r in qualifying)
result={'queried_at_utc':datetime.now(timezone.utc).isoformat(),'environment':'canonical local DEV','transaction':'read_only','definitions_audited':len(rows),'candidate_selection_sql':SQL,'semantic_review':'All candidates reviewed; canonical ID 546/548 explicitly deferred to lower-body hinges. See boundary decisions.','count':len(qualifying),'candidate_count':len(candidates),'counts_by_primary':dict(Counter(r['primary_muscle_group'] for r in qualifying)),'all_canonical_free_weight_counts_by_primary':dict(counts),'taxonomy_primary_keys':sorted(taxonomy_keys),'mid_back_taxonomy_present':'mid_back' in taxonomy_keys,'qualifying':qualifying,'candidates':candidates,'boundary_exclusions':boundary,'excluded':excluded}
(proof/'taxonomy-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ('definitions_audited','candidate_count','count','counts_by_primary','mid_back_taxonomy_present')},indent=2))
