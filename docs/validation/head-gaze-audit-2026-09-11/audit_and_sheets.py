#!/usr/bin/env python3
"""Persist the visually reviewed inventory; compose evidence without image edits."""
import io
import json
import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
DOC = Path(__file__).resolve().parent
before = json.loads((DOC/'inventory-before.json').read_text())
current = json.loads((ROOT/'docs/validation/free-weight-completion-2026-09-11/asset-manifest.json').read_text())
after = {r['id']:r for r in current['movements']}
corrections = {r['id']:r for r in json.loads((DOC/'correction-manifest.json').read_text())['movements']}
rows = sorted(before['movements'], key=lambda r:r['id'])
# Explicit review groupings from the 17 inspected sheets; no product classifier.
lying = set([6,7,*range(32,48),105,155,156,257,*range(289,296),298,299,300,*range(418,425),430,495,496,497,498,500,528,560,561,569])
hinged = set([4,5,73,108,126,127,128,129,130,132,133,153,154,157,158,159,160,161,162,*range(191,205),206,242,258,262,*range(387,397),425,480,545,546,547,548,549])
notes = []
for index,row in enumerate(rows):
    identifier = row['id']
    if identifier in corrections:
        decision = 'CORRECT'
        reason = corrections[identifier]['review']['reason']
    else:
        decision = 'KEEP'
        if identifier in [580,581,582]:
            reason = 'Head position depicts the governed neck exercise itself; no unrelated sideways glance. Preserve deliberate flexion/extension/lateral flexion.'
        elif identifier in lying:
            reason = 'Face follows the supported torso/bench orientation; upward or three-quarter face is from the exercise and camera, with no independent shoulderward glance.'
        elif identifier in hinged:
            reason = 'Checked head against torso and equipment plane. Face points along the exercise plane; side appearance follows camera azimuth, without an independent over-shoulder look.'
        else:
            reason = 'Head and gaze follow the torso forward direction. The three-quarter or side camera view does not show an independent neck turn toward a shoulder.'
        assert after[identifier]['files'] == row['files'], identifier
    # The initial single-squat fix preceded the complete-family sheet capture.
    # Its comparison reconstructs the actual original from the source commit.
    evidence = 'comparisons/group-04.jpg' if identifier == 349 else f'audit-sheets/group-{index//12+1:02}.jpg'
    notes.append(dict(id=identifier,key=row['key'],name=row['display_name'],decision=decision,reason=reason,evidence=evidence))
payload = dict(scope='All 198 registered canonical free-weight movement images', source_commit=before['source_commit'],
               criteria='Independent head yaw/side glance relative to torso, not camera azimuth. Preserve exercise-defined neck motion.',
               reviewed_count=len(notes), corrected_count=len(corrections), kept_count=len(notes)-len(corrections),movements=notes)
(DOC/'audit-decisions.json').write_text(json.dumps(payload,indent=2)+'\n')
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
(DOC/'comparisons').mkdir(exist_ok=True)
targets = [r for r in rows if r['id'] in corrections]
for start in range(0,len(targets),6):
    group = targets[start:start+6]
    sheet = Image.new('RGB',(1536,math.ceil(len(group)/2)*426),'#09080d')
    draw = ImageDraw.Draw(sheet)
    for index,row in enumerate(group):
        for side in [0,1]:
            x,y = (index%2)*768+side*384,(index//2)*426
            path = row['files']['app']['path']
            image = Image.open(io.BytesIO(subprocess.check_output(['git','show',before['source_commit']+':'+path],cwd=ROOT))) if side==0 else Image.open(ROOT/path)
            sheet.paste(image.convert('RGB').resize((376,376),Image.Resampling.LANCZOS),(x+4,y+4))
            label = f"{row['id']} {'BEFORE' if side==0 else 'AFTER'} {row['display_name']}"
            lines=['']
            for word in label.split():
                if draw.textlength((lines[-1]+' '+word).strip(),font=font)>370: lines.append(word)
                else: lines[-1]=(lines[-1]+' '+word).strip()
            for n,line in enumerate(lines):draw.text((x+4,y+384+18*n),line,font=font,fill='white')
    sheet.save(DOC/'comparisons'/f'group-{start//6+1:02}.jpg',quality=94)
lines=['# Full head/gaze audit','','198 reviewed; 22 corrected; 176 retained with identical master/app/thumbnail hashes.','',
       '| ID | Movement | Decision | Review |','| --- | --- | --- | --- |']
for row in notes: lines.append(f"| {row['id']} | {row['name']} | {row['decision']} | {row['reason']} |")
(DOC/'FULL-AUDIT.md').write_text('\n'.join(lines)+'\n')
print('Recorded all 198 review decisions and four before/after sheets for all 22 corrections.')
