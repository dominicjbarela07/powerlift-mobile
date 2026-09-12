#!/usr/bin/env python3
"""Append explicit human-reviewed generation plans/findings; never approve implicitly."""
import json, sys
from pathlib import Path
doc=Path(__file__).resolve().parent
mode=sys.argv[1]
addition=json.load(sys.stdin)
assert isinstance(addition,list)
name={'plan':'generation-plan.json','reviews':'reviews.json','checkpoints':'checkpoint-findings.json'}[mode]
path=doc/name
data=json.loads(path.read_text())
if mode=='plan':
 audit=json.loads((doc/'taxonomy-audit.json').read_text())
 allowed={r['id'] for r in audit['records'] if r['decision']=='NEEDS NEW ART'}
 assert all(r['id'] in allowed and r.get('cue') and r.get('implement') for r in addition)
 by_id={r['id']:r for r in data['movements']}
 by_id.update({r['id']:r for r in addition})
 data['movements']=list(by_id.values())
else:
 if mode=='reviews':
  assert all(r['status'] in ('ACCEPT','REJECT') and r.get('reason') for r in addition)
  seen={(r['id'],r['attempt']) for r in data}
  assert not any((r['id'],r['attempt']) in seen for r in addition)
 data.extend(addition)
path.write_text(json.dumps(data,indent=2)+'\n')
print(json.dumps({'updated':name,'total':len(data['movements']) if mode=='plan' else len(data)}))
