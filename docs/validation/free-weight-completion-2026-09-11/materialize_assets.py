#!/usr/bin/env python3
"""Preserve prior masters; copy accepted independent generations and resize only."""
# Historical automation acceptance is not human approval. This pipeline is frozen.
raise SystemExit("Human artwork approval required. Register candidates with ../scripts/movement_art_review.py; use its guarded promote command after human review. Historical materialization is disabled.")

import hashlib
import json
import math
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path.cwd()
DOC = ROOT / 'docs/validation/free-weight-completion-2026-09-11'
ART = ROOT / 'assets/images/movement-artwork/free-weight-v1'
BASELINE_HASH = 'e05a3bf38fa70279a8f369df65498bb952231b3aff1575b41edc15a3da80a9fe'
assert hashlib.sha256((ART/'masters/dumbbell-incline-bench-press-v1.png').read_bytes()).hexdigest() == BASELINE_HASH
audit = json.loads((DOC/'taxonomy-audit.json').read_text())
reviews = json.loads((DOC/'reviews.json').read_text())
accepted = {r['id']:r for r in reviews if r['status']=='ACCEPT'}
plan = {r['id']:r for r in json.loads((DOC/'generation-plan.json').read_text())['movements']}
correction_doc = ROOT / 'docs/validation/head-gaze-audit-2026-09-11'
corrections = {r['id']: r for r in json.loads((correction_doc/'correction-manifest.json').read_text())['movements']}
for correction in corrections.values():
 assert correction['review']['status'] == 'ACCEPT'
 for file in correction['files'].values():
  assert hashlib.sha256((ROOT/file['path']).read_bytes()).hexdigest() == file['sha256']

# Static, reviewed choices from the historical Push prompts, never runtime matching.
push_implements = {}
for identifiers, implement in [
 ([32,33,34,35,36,37,38,39,40,41,79,80,81,82,83,103,104,105,108,109,111,293,298,299], 'Two dumbbells'),
 ([106,107,297], 'Single dumbbell'),
 ([296,300], 'Single dumbbell held with both hands'),
 ([42,43,44,45,46,85,89,90,112,289,290,291], 'Straight barbell'),
 ([47], 'Cambered barbell'), ([73,84], 'Single plate'), ([110], 'Two plates'),
 ([86,87,88], 'Landmine barbell'), ([292,294,295], 'EZ bar'),
]:
 for identifier in identifiers: push_implements[identifier] = implement
prior = {}
for family in ('push','pull'):
 folder = ROOT/f'docs/validation/free-weight-{family}-family-2026-09-11'
 old_plan = {r['id']:r for r in json.loads((folder/'generation-plan.json').read_text())['movements']}
 for row in json.loads((folder/'asset-manifest.json').read_text())['movements']:
  if row['id'] in corrections:
   correction = corrections[row['id']]
   assert correction['key'] == row['key'] and correction['before_files'] == row['files']
   row = dict(row, files=correction['files'])
  for file in row['files'].values():
   assert hashlib.sha256((ROOT/file['path']).read_bytes()).hexdigest()==file['sha256'], (row['id'],file['path'])
  prior[row['id']] = dict(row, generation_batch=family.title(),
    implement=push_implements[row['id']] if family=='push' else old_plan[row['id']]['implement'])
assert len(prior)==98

manifest=[]
for row in audit['records']:
 if row['decision'] not in ('APPROVED','NEEDS NEW ART'): continue
 item={k:row[k] for k in ('id','key','display_name','family','equipment_type','loading_implementation','load_convention','sidedness','identity_status','ownership_scope','visibility','retired_at','secondary_muscle_groups')}
 item['primary_muscle_group']=row['artwork_primary_muscle_group']
 item['stored_primary_muscle_group']=row['primary_muscle_group']
 item['primary_taxonomy_source']=row['artwork_primary_source']
 if row['id'] in prior:
  old=prior[row['id']]
  item.update(asset_status='APPROVED',final_status='RETAINED',generation_batch=old['generation_batch'],
   implement=old['implement'],files=old['files'],validation_note='Prior approved art retained byte-for-byte. '+old.get('review',''))
 elif row['id'] in accepted:
  review=accepted[row['id']]
  attempt=json.loads((DOC/f"attempts/{row['id']}-{review['attempt']}.json").read_text())
  assert attempt['reference_paths'][0].endswith('masters/dumbbell-incline-bench-press-v1.png')
  slug=row['key'].removeprefix('accessory_').replace('_','-')+'-v1'
  target=ART/'masters'/f'{slug}.png'
  candidate=Path(attempt['path'])
  if row['id'] in corrections:
   candidate=Path(json.loads((ROOT/corrections[row['id']]['receipt']).read_text())['path'])
  changed=not target.exists() or target.read_bytes()!=candidate.read_bytes()
  if changed: shutil.copyfile(candidate,target)
  if changed or not all((ART/f'{slug}{suffix}.png').exists() for suffix in ('','-thumb')):
   source=Image.open(target).convert('RGB')
   assert source.width==source.height
   for size,suffix in ((512,''),(192,'-thumb')):
    source.resize((size,size),Image.Resampling.LANCZOS).save(ART/f'{slug}{suffix}.png',optimize=True)
  files={}
  for role,path in [('master',target),('app',ART/f'{slug}.png'),('thumbnail',ART/f'{slug}-thumb.png')]:
   files[role]={'path':str(path.relative_to(ROOT)),'dimensions':list(Image.open(path).size),
    'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
  item.update(asset_status='APPROVED',final_status='NEW',generation_batch='Completion',
   implement=plan[row['id']]['implement'],files=files,attempt=review['attempt'],validation_note=review['reason'])
 else:
  item.update(asset_status='NEEDS NEW ART',final_status='PENDING',generation_batch='Completion',
   implement=plan.get(row['id'],{}).get('implement'),validation_note='Pending independent generation and review.')
 if row['id'] in corrections:
  correction = corrections[row['id']]
  assert correction['key'] == row['key'] and item['files'] == correction['files']
  item['gaze_correction_receipt'] = correction['receipt']
  item['validation_note'] = 'Reviewed head/gaze correction: ' + correction['review']['reason']
 manifest.append(item)
manifest.sort(key=lambda r:(r['primary_muscle_group'],r['id']))
groups={}
for row in manifest: groups.setdefault(row['primary_muscle_group'],[]).append(row['id'])
payload={'baseline_sha256':BASELINE_HASH,'catalog_query_utc':audit['queried_at_utc'],
 'scope':'Entire confirmed governed free-weight accessory family; original taxonomy retained, four legacy primaries use existing typed family adapter.',
 'total':len(manifest),'approved':98+len(accepted),'retained':98,'new':len(accepted),
 'reviewed_head_gaze_corrections':len(corrections),
 'uncovered_confirmed_ids':[r['id'] for r in manifest if r['asset_status']!='APPROVED'],
 'taxonomy_product_blocked':[{'id':343,'name':'Towel Grip Hold','reason':'OTHER_PORTABLE, unknown loading: definition does not identify bodyweight versus external-weight resistance. Not counted in confirmed inventory.'}],
 'groups_by_governed_primary':groups,'movements':manifest}
(DOC/'asset-manifest.json').write_text(json.dumps(payload,indent=2)+'\n')
lines=['# Entire free-weight accessory artwork family','',f"Confirmed inventory: {len(manifest)}. Approved: {98+len(accepted)}. Prior identities retained: 98. Reviewed head/gaze corrections across batches: {len(corrections)}.",'',
 'Four legacy definitions retain their stored taxonomy; grouping uses the existing governed family-to-primary adapter. No display-name classification or identity merge.','']
for primary,identifiers in groups.items():
 lines.extend([f'## {primary} ({len(identifiers)})','',
  '| ID | Canonical movement | Secondary | Implement shown | Status | Batch | Canonical app asset | Validation note |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |'])
 for row in manifest:
  if row['id'] not in identifiers: continue
  values=[row['id'],row['display_name'],', '.join(row['secondary_muscle_groups'] or []) or 'Not stored' if row['secondary_muscle_groups'] is None else ', '.join(row['secondary_muscle_groups']) or 'None',
   row['implement'] or 'Pending',row['asset_status'],row['generation_batch'],row.get('files',{}).get('app',{}).get('path','Pending'),row['validation_note']]
  lines.append('| '+' | '.join(str(v).replace('|','/').replace('\n',' ') for v in values)+' |')
 lines.append('')
lines.extend(['## Explicit taxonomy/product block','',
 '343 — Towel Grip Hold: OTHER_PORTABLE with unknown loading. Resistance is unspecified; requires a governed definition decision before it can qualify as free weight. No invented movement or fallback art.',''])
(DOC/'ENTIRE-FAMILY-MANIFEST.md').write_text('\n'.join(lines))

# Original + unchanged Push/Pull + diverse accepted controls at every checkpoint.
by_id={r['id']:r for r in manifest}
ordered=[by_id[identifier] for identifier in accepted]
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',14)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',11)
controls=[by_id[i] for i in (33,80,191,253,354,325,495) if by_id[i]['asset_status']=='APPROVED']
for start in range(0,len(ordered),6):
 group=list({r['id']:r for r in controls+ordered[start:start+6]}.values())
 columns=3 if len(group)<=9 else 4
 sheet=Image.new('RGB',(columns*288,math.ceil(len(group)/columns)*336),'#09080d')
 draw=ImageDraw.Draw(sheet)
 for index,row in enumerate(group):
  x,y=(index%columns)*288,(index//columns)*336
  source=Image.open(ROOT/row['files']['app']['path']).convert('RGB')
  sheet.paste(source.resize((256,256),Image.Resampling.LANCZOS),(x+16,y+8))
  label='ORIGINAL CONTROL' if row['id']==33 else f"{row['id']} · {row['display_name']}"
  wrapped=['']
  for word in label.split():
   trial=(wrapped[-1]+' '+word).strip()
   if draw.textlength(trial,font=font)>260: wrapped.append(word)
   else: wrapped[-1]=trial
  for n,line in enumerate(wrapped): draw.text((x+16,y+270+n*16),line,font=font,fill='white')
  sheet.paste(source.resize((42,42),Image.Resampling.LANCZOS),(x+220,y+287))
  draw.text((x+16,y+313),'42 px thumbnail →',font=small,fill='#aaa1b4')
 (DOC/'family-checkpoints').mkdir(exist_ok=True)
 sheet.save(DOC/'family-checkpoints'/f'group-{start//6+1:02}.png',optimize=True)
print(json.dumps({k:payload[k] for k in ('total','approved','retained','new','uncovered_confirmed_ids')}))
