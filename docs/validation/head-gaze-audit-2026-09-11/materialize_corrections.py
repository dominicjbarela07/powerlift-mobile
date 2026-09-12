#!/usr/bin/env python3
"""Copy individually accepted built-in edits; resize only, preserve old hashes."""
# Historical automation acceptance is not human approval. This pipeline is frozen.
raise SystemExit("Human artwork approval required. Register candidates with ../scripts/movement_art_review.py; use its guarded promote command after human review. Historical materialization is disabled.")

import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
DOC = Path(__file__).resolve().parent
before = json.loads((DOC / 'inventory-before.json').read_text())
by_id = {row['id']: row for row in before['movements']}
reviews = json.loads((DOC / 'reviews.json').read_text())
final_reviews = {r['id']: r for r in reviews if r['status'] == 'ACCEPT'}
assert 33 not in final_reviews, 'original style master is immutable'
corrections = []
for identifier, review in sorted(final_reviews.items()):
    old = by_id[identifier]
    receipt = review.get('receipt', str((DOC / f'attempts/{identifier}-{review["attempt"]}.json').relative_to(ROOT)))
    attempt = json.loads((ROOT / receipt).read_text())
    assert attempt['id'] == identifier and attempt['attempt'] == review['attempt']
    assert attempt['reference_paths'][0].endswith('/masters/dumbbell-incline-bench-press-v1.png')
    source = Path(attempt['path'])
    master = ROOT / old['files']['master']['path']
    # Idempotent; don't touch accepted assets when running the materializer again.
    changed = master.read_bytes() != source.read_bytes()
    if changed:
        shutil.copyfile(source, master)
        original = Image.open(master).convert('RGB')
        assert original.width == original.height
        for role, size in [('app', 512), ('thumbnail', 192)]:
            original.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / old['files'][role]['path'], optimize=True)
    files = {}
    for role, previous in old['files'].items():
        path = ROOT / previous['path']
        files[role] = dict(path=previous['path'], dimensions=list(Image.open(path).size),
                           bytes=path.stat().st_size, sha256=hashlib.sha256(path.read_bytes()).hexdigest())
        assert files[role]['sha256'] != previous['sha256']
    corrections.append(dict(id=identifier, key=old['key'], display_name=old['display_name'],
                            generation_batch=old['generation_batch'], before_files=old['files'], files=files,
                            receipt=receipt, review=review))
payload = dict(source_commit=before['source_commit'], scope='Reviewed head/neck/gaze corrections only',
               audited_count=len(by_id), corrected_count=len(corrections),
               unchanged_count=len(by_id)-len(corrections), movements=corrections)
(DOC / 'correction-manifest.json').write_text(json.dumps(payload, indent=2)+'\n')
print(json.dumps({k: payload[k] for k in ['audited_count', 'corrected_count', 'unchanged_count']}))
