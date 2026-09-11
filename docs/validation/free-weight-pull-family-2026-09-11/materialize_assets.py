#!/usr/bin/env python3
"""Copy individually accepted masters; derive PNGs and review sheets only.

Run from mobile root using ../venv/bin/python. No AI creation/editing occurs here:
only native-master copying, Lanczos downsampling and unaltered proof arrangement.
"""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path.cwd()
DOC = ROOT / 'docs/validation/free-weight-pull-family-2026-09-11'
ART = ROOT / 'assets/images/movement-artwork/free-weight-v1'
BASELINE = ART / 'masters/dumbbell-incline-bench-press-v1.png'
BASELINE_HASH = 'e05a3bf38fa70279a8f369df65498bb952231b3aff1575b41edc15a3da80a9fe'
assert hashlib.sha256(BASELINE.read_bytes()).hexdigest() == BASELINE_HASH
audit = json.loads((DOC / 'taxonomy-audit.json').read_text())
reviews = json.loads((DOC / 'reviews.json').read_text())
accepted = {r['id']: r for r in reviews if r['status'] == 'ACCEPT'}
manifest = []
for row in audit['qualifying']:
 item = {k: row[k] for k in ('id','key','display_name','primary_muscle_group','equipment_type','existing_art_status','sidedness')}
 if row['id'] == 33:
  slug = 'dumbbell-incline-bench-press-v1'
  item.update(final_status='KEEP',attempt=0,review='Approved original immutable control specimen')
 elif row['id'] in accepted:
  review = accepted[row['id']]
  attempt = json.loads((DOC / f"attempts/{row['id']}-{review['attempt']}.json").read_text())
  slug = row['key'].removeprefix('accessory_').replace('_','-') + '-v1'
  target = ART / 'masters' / f'{slug}.png'
  changed = not target.exists() or target.read_bytes() != Path(attempt['path']).read_bytes()
  if changed:
   shutil.copyfile(attempt['path'], target)
  if changed or not all((ART/f'{slug}{suffix}.png').exists() for suffix in ('','-thumb')):
   source = Image.open(target).convert('RGB')
   assert source.width == source.height
   for size, suffix in ((512,''),(192,'-thumb')):
    source.resize((size,size),Image.Resampling.LANCZOS).save(ART/f'{slug}{suffix}.png', optimize=True)
  item.update(final_status='NEW',attempt=review['attempt'],review=review['reason'])
 else:
  item.update(final_status='PENDING',attempt=None,review='Not yet accepted')
  manifest.append(item)
  continue
 files = {}
 for role, path in [('master',ART/'masters'/f'{slug}.png'),('app',ART/f'{slug}.png'),('thumbnail',ART/f'{slug}-thumb.png')]:
  files[role] = {'path':str(path.relative_to(ROOT)),'dimensions':list(Image.open(path).size),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 item['files'] = files
 manifest.append(item)
(DOC/'asset-manifest.json').write_text(json.dumps({'baseline_sha256':BASELINE_HASH,'movements':manifest},indent=2)+'\n')
print(json.dumps({'accepted_new':len(accepted),'pending':len(audit['qualifying'])-len(accepted)}))

# Review sheets always begin with the ORIGINAL, never a descendant anchor.
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',14)
small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',11)
push = json.loads((ROOT/'docs/validation/free-weight-push-family-2026-09-11/asset-manifest.json').read_text())['movements']
controls = [next(r for r in push if r['id']==identifier) for identifier in (33,80,292)]
by_id = {r['id']: r for r in manifest}
ordered = [by_id[identifier] for identifier in accepted]
for group_index in range(0,len(ordered),6):
 group = controls+ordered[group_index:group_index+6]
 sheet = Image.new('RGB',(864,1008),'#09080d'); draw=ImageDraw.Draw(sheet)
 for index, row in enumerate(group):
  x,y=(index%3)*288,(index//3)*336
  source=Image.open(ROOT/row['files']['app']['path']).convert('RGB')
  sheet.paste(source.resize((256,256),Image.Resampling.LANCZOS),(x+16,y+8))
  label='ORIGINAL CONTROL' if row['id']==33 else f"{row['id']} · {row['display_name']}"
  # Keep the full movement label readable without altering the source image.
  words=label.split(); lines=['']
  for word in words:
   trial=(lines[-1]+' '+word).strip()
   if draw.textlength(trial,font=font)>260: lines.append(word)
   else: lines[-1]=trial
  for n,line in enumerate(lines): draw.text((x+16,y+270+n*16),line,font=font,fill='white')
  sheet.paste(source.resize((42,42),Image.Resampling.LANCZOS),(x+220,y+287))
  draw.text((x+16,y+313),'42 px thumbnail →',font=small,fill='#aaa1b4')
 (DOC/'family-checkpoints').mkdir(exist_ok=True)
 sheet.save(DOC/'family-checkpoints'/f'group-{group_index//6+1:02}.png',optimize=True)
