#!/usr/bin/env python3
"""Create/read/clean only this run's isolated local DEV artwork QA draft."""
import json, sys
from pathlib import Path
from urllib.parse import urlparse
import requests
from app import create_app
from app.models import Workout, WorkoutItem, SetLog
from app.utils.tokens import make_token
root=Path.cwd()
proof=root/"powerlift_mobile/docs/validation/free-weight-completion-2026-09-11"
receipt=proof/"qa-session.json"
app=create_app()
assert urlparse(app.config["SQLALCHEMY_DATABASE_URI"]).hostname in ("localhost","127.0.0.1")
mode=sys.argv[1]
with app.app_context():
 token=make_token("mobile-auth",1)
 client=requests.Session()
 client.headers["Authorization"]="Bearer "+token
 base="http://127.0.0.1:5000"
 if mode=="create":
  assert not receipt.exists(), "Inspect existing fixture receipt; never duplicate"
  audit=json.loads((proof/"taxonomy-audit.json").read_text())
  by_id={r["id"]:r for r in audit["records"]}
  ids=[33,154,253,325,354,388,476,495,4,5,6,7]
  payload={"athlete_id":12,"date":"2026-09-11","label":"Whole Free-weight Family Art QA","status":"draft","core_items":[],"acc_items":[{"movement_definition_id":i,"movement":by_id[i]["display_name"],"sets":3,"reps_text":"10-12","rir_target":2} for i in ids]}
  response=client.post(base+"/workouts/mobile/new",json=payload,timeout=30)
  assert response.status_code==200, (response.status_code,response.text[:300])
  data=response.json()
  wid=data.get("workout_id") or data.get("id")
  assert wid, data
  receipt.write_text(json.dumps({"workout_id":wid,"athlete_id":12,"label":payload["label"],"requested_status":"draft","movement_definition_ids":ids,"created_http_status":response.status_code,"cleaned_up":False},indent=2)+"\n")
  print(json.dumps({"created_draft":wid,"athlete_id":12,"ids":ids}))
 elif mode=="search":
  audit=json.loads((proof/"taxonomy-audit.json").read_text())
  results=[]
  fields={"id","key","display_name","family","primary_muscle_group","execution_family","identity_status","ownership_scope"}
  primaries=sorted({r["primary_muscle_group"] for r in audit["records"] if r["decision"] in ("APPROVED","NEEDS NEW ART") and r["primary_muscle_group"]})
  for primary in primaries:
   params={"athlete_id":12,"primary_muscle_group":primary,"execution_family":"FREE_WEIGHT","limit":49}
   response=client.get(base+"/workouts/mobile/movement-definitions/search",params=params,timeout=30)
   assert response.status_code==200,response.status_code
   data=response.json();visible=data["items"]
   items=[r for r in visible if r.get("identity_status")=="canonical"]
   expected=sorted(r["id"] for r in audit["records"] if r["primary_muscle_group"]==primary and r["decision"] in ("APPROVED","NEEDS NEW ART") and r.get("execution_family")=="FREE_WEIGHT")
   assert sorted(r["id"] for r in items)==expected,(primary,[r["id"] for r in items])
   assert not data.get("next_cursor")
   results.append({"primary":primary,"http_status":response.status_code,"request":params,"private_custom_results_omitted":len(visible)-len(items),"items":[{k:v for k,v in row.items() if k in fields} for row in items]})
  (proof/"qa-search-serialized.json").write_text(json.dumps(results,indent=2)+"\n")
  print(json.dumps({"search_groups":len(results),"canonical_results":sum(len(r["items"]) for r in results),"all_match_audit":True}))
 elif mode in ("inspect","cleanup"):
  record=json.loads(receipt.read_text()); wid=record["workout_id"]
  w=Workout.query.get(wid)
  assert w and w.athlete_id==12 and w.label==record["label"] and w.status=="draft"
  count=SetLog.query.join(WorkoutItem,SetLog.item_id==WorkoutItem.id).filter(WorkoutItem.workout_id==wid).count()
  assert count==0, "Never clean a fixture containing performed evidence"
  response=client.get(base+f"/workouts/mobile/{wid}?history=summary&view=coach-preview",timeout=30)
  assert response.status_code==200, response.status_code
  data=response.json()
  if mode=="inspect":
   fields={"id","workout_id","athlete_id","status","label","items","core_items","acc_items","accessory_items","accessories","workout","session","movement_definition_id","effective_movement_definition_id","movement_identity","effective_movement_identity","performed_canonical_movement_identity","key","primary_muscle_group","family","is_substituted"}
   fields.add("accessory_groups")
   def safe(value):
    if isinstance(value,list): return [safe(x) for x in value]
    if isinstance(value,dict): return {k:safe(v) for k,v in value.items() if k in fields}
    return value
   (proof/"qa-session-serialized.json").write_text(json.dumps(safe(data),indent=2)+"\n")
   print(json.dumps({"workout_id":wid,"status":w.status,"setlogs":count,"top_keys":list(data)}))
  else:
   deleted=client.post(base+f"/workouts/mobile/{wid}/delete",json={},timeout=30)
   assert deleted.status_code==200, deleted.text[:300]
   record.update(cleaned_up=True,delete_http_status=200,performed_sets_before_cleanup=count)
   receipt.write_text(json.dumps(record,indent=2)+"\n")
   print(json.dumps({"deleted_own_draft":wid,"setlogs":count}))
 else: raise ValueError(mode)
