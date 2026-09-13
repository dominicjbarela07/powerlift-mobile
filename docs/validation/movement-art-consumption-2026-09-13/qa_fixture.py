import sys,json,hashlib
from pathlib import Path
R=Path('/Users/dominic/powerlifting_app_dev');sys.path.insert(0,str(R))
from dotenv import load_dotenv
load_dotenv(R/'.env.dev',override=True)
from app import create_app
from app.models import SetLog,Workout,MovementDefinition
from app.utils.tokens import make_token
from scripts.movement_art_review import assert_dev
import requests
O=R/'powerlift_mobile/artifacts/art-consumption-fixture';O.mkdir(exist_ok=True)
def hashes():
 return {str(x.id):hashlib.sha256(json.dumps({c.name:str(getattr(x,c.name)) for c in x.__table__.columns},sort_keys=True).encode()).hexdigest() for x in SetLog.query.all()}
with create_app().app_context() as ctx:
 assert_dev(ctx.app);db=ctx.app.extensions['sqlalchemy'].session
 c=requests.Session();c.headers['Authorization']='Bearer '+make_token('mobile-auth',1)
 def call(method,path,data=None):
  r=c.request(method,'http://127.0.0.1:5000/workouts/mobile'+path,json=data,timeout=60);assert r.status_code==200,(r.status_code,r.text[:300]);return r.json()
 mode=sys.argv[1]
 if mode=='create':
  assert not (O/'receipt.json').exists()
  (O/'evidence.json').write_text(json.dumps(hashes(),sort_keys=True))
  receipt=[]
  for label,ids,superset in [('Artwork Consumption QA',[253,33,154,354,91,120],False),('Artwork Superset QA',[253,91],True)]:
   items=[]
   for pos,id in enumerate(ids):
    m=db.get(MovementDefinition,id);items.append(dict(movement_definition_id=id,movement=m.display_name,sets=1,reps_text='6-8',rir_target=1,**(dict(superset_group='A',superset_pos=pos+1) if superset else {})))
   new=call('POST','/new',dict(athlete_id=4,date='2026-09-13',label=label,status='assigned',core_items=[],acc_items=items));wid=new.get('workout_id') or new.get('id');data=call('GET',f'/{wid}?history=summary')['workout'];(O/f'{wid}-pre.json').write_text(json.dumps(data,indent=2));receipt.append(dict(id=wid,label=label,ids=ids))
  (O/'receipt.json').write_text(json.dumps(receipt,indent=2));print(receipt)
 elif mode=='pre-copy':
  receipt=json.loads((O/'receipt.json').read_text());items=[]
  for id in [253,33,154,354,91,120]:
   m=db.get(MovementDefinition,id);items.append(dict(movement_definition_id=id,movement=m.display_name,sets=1,reps_text='6-8',rir_target=1))
  label='Artwork Pre-Session QA';new=call('POST','/new',dict(athlete_id=4,date='2026-09-13',label=label,status='assigned',core_items=[],acc_items=items));wid=new.get('workout_id') or new.get('id');receipt.append(dict(id=wid,label=label,ids=[253,33,154,354,91,120]));(O/'receipt.json').write_text(json.dumps(receipt,indent=2));data=call('GET',f'/{wid}?history=summary')['workout'];(O/f'{wid}-pre.json').write_text(json.dumps(data,indent=2));print('Pre-Session fixture',wid)
 elif mode=='begin':
  wid=int(sys.argv[2]);assert any(x['id']==wid for x in json.loads((O/'receipt.json').read_text()));call('POST',f'/{wid}/begin',{});data=call('GET',f'/{wid}?history=summary')['workout'];(O/f'{wid}-active.json').write_text(json.dumps(data,indent=2));print('began own fixture',wid)
 elif mode=='cleanup':
  receipt=json.loads((O/'receipt.json').read_text())
  for x in receipt:
   w=db.get(Workout,x['id']);assert w.label==x['label'] and w.athlete_id==4 and not any(i.set_logs for i in w.items);db.delete(w)
  db.commit();after=hashes();before=json.loads((O/'evidence.json').read_text());assert before==after
  (O/'cleanup.json').write_text(json.dumps(dict(removed=receipt,original_setlogs_unchanged=len(before))));print('Cleaned fixtures; original SetLogs unchanged',len(before))
