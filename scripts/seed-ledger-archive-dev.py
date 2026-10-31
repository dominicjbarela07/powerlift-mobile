"""Append-only fictional archive material for the existing local DEV athlete.

No credentials/relationships/original evidence are changed. Default is rollback;
--apply commits after original-row fingerprint verification. Footage is licensed
Your Move demo material, not footage of the QA athlete or another user's video.
"""
from pathlib import Path
from datetime import date,datetime,time
import argparse,json,logging,sys,hashlib
BACKEND=Path(__file__).resolve().parents[2];sys.path.insert(0,str(BACKEND))
from app import create_app
from app.extensions import db
from app.models import User,Athlete,Workout,WorkoutItem,SetLog,SetVideoAttachment,HistoricalPerformanceEntry,MeetPlan,MeetAttempt,MeetAttemptResult,MeetResultSummary,CoreMovementDefinition
from app.services.relationships import active_coach_id_for_athlete
from app.services.video_storage.local_storage import LocalVideoStorage
from app.services.video_media import inspect_video,make_thumbnail
from app.utils.account_state import canonical_account_state_payload
from scripts.extend_dev_training_history import assert_dev_source,fingerprints,assert_preserved
from werkzeug.datastructures import FileStorage
MARKER='DEV_LEDGER_ARCHIVE_20261030'
MEDIA={
 'competition_squat':('squat','squat.mp4','https://ymove.app/mkt/tim-barbell-back-squat.mp4'),
 'competition_bench':('bench','bench.mp4','https://ymove.app/mkt/tim-barbell-bench-press.mp4'),
 'competition_deadlift':('deadlift','deadlift.mp4','https://ymove.app/mkt/tim-barbell-deadlift.mp4'),
}
SOURCE_SHA256={'squat':'b5b1be16a8b723cb9704bda8ff41a7fbee086cb336f31fb350d6907e49bdc19b','bench':'d65fd86051ac8ac099527acca39b1f7caf22f5cc27011789f3ce56291e5e75ac','deadlift':'150b01c720bafe5519976260bbd5ccce44fcf590e35e2637149cdfd46339a301'}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--media-dir',type=Path,help='Directory containing the licensed squat.mp4, bench.mp4 and deadlift.mp4 originals');args=parser.parse_args()
 app=create_app();app.logger.setLevel(logging.ERROR)
 with app.app_context():
  assert_dev_source(app.config['SQLALCHEMY_DATABASE_URI'])
  user=db.session.get(User,78);athlete=Athlete.query.filter_by(user_id=78).one()
  if user.role!='athlete' or user.email!='release-integrity-20261003-athlete@example.test' or athlete.id!=68 or not canonical_account_state_payload(user)['can_access_product'] or active_coach_id_for_athlete(athlete)!=77:raise RuntimeError('Unexpected existing QA identity or readiness')
  existing=SetVideoAttachment.query.filter(SetVideoAttachment.upload_client_key.like(MARKER+':%')).all()
  if existing:
   if len(existing)!=3 or HistoricalPerformanceEntry.query.filter(HistoricalPerformanceEntry.external_ref.like(MARKER+':%')).count()!=6 or MeetPlan.query.filter_by(athlete_id=athlete.id,notes=MARKER).count()!=2:raise RuntimeError('Partial archive fixture; refusing overwrite')
   print(json.dumps({'existing':True,'athlete_id':68,'film':len(existing),'past_entries':6,'meets':2}));return
  if not args.media_dir or not all((args.media_dir / (name+'.mp4')).is_file() for name in ['squat','bench','deadlift']):raise RuntimeError('Pass --media-dir with the three licensed demo originals')
  before=fingerprints();storage=LocalVideoStorage();films=[];created_keys=[]
  try:
   for key,(name,path,url) in MEDIA.items():
    core=CoreMovementDefinition.query.filter_by(key=key).one()
    log=SetLog.query.join(WorkoutItem,SetLog.item_id==WorkoutItem.id).join(Workout,WorkoutItem.workout_id==Workout.id).filter(Workout.athlete_id==68,Workout.programming_notes=='DEV_LEDGER_ATHLETE_REVIEW_20261030',WorkoutItem.core_movement_id==core.id,SetLog.set_index==1).order_by(Workout.date.desc()).first()
    if not log:raise RuntimeError('Missing original QA set for '+key)
    source=args.media_dir/path
    if hashlib.sha256(source.read_bytes()).hexdigest()!=SOURCE_SHA256[name]:raise RuntimeError('Demo footage does not match the reviewed licensed original: '+name)
    metadata=inspect_video(str(source));metadata.update({'fixture':MARKER,'demo_footage':True,'source_url':url,'license':'https://ymove.app/free-exercise-videos#licence'})
    with source.open('rb') as handle:stored=storage.save_video(FileStorage(stream=handle,filename=f'DEV-DEMO-{name}.mp4'),athlete_id=68,set_log_id=log.id)
    created_keys.append(stored['storage_key']);poster_key=stored['storage_key']+'.jpg';created_keys.append(poster_key);poster=storage.path_for(poster_key);make_thumbnail(storage.path_for(stored['storage_key']),poster,metadata)
    reviewed=name!='bench';w=log.item.workout
    v=SetVideoAttachment(athlete_id=68,coach_id=77,workout_id=w.id,workout_item_id=log.item_id,set_log_id=log.id,storage_backend='local',storage_key=stored['storage_key'],original_filename=f'DEV-DEMO-{name}.mp4',content_type='video/mp4',file_size_bytes=stored['file_size_bytes'],thumbnail_storage_key=poster_key,thumbnail_content_type='image/jpeg',thumbnail_file_size_bytes=Path(poster).stat().st_size,thumbnail_created_at=datetime.now(),upload_owner_user_id=78,upload_client_key=f'{MARKER}:{name}',source_sha256=metadata['sha256'],media_metadata_json=metadata,playback_status='ready',playback_storage_key=stored['storage_key'],playback_content_type='video/mp4',session_date=w.date,workout_label='Demo film · '+w.label,movement_name=log.item.movement,set_index=1,actual_weight_kg=log.actual_weight_kg,actual_reps=log.actual_reps,actual_rpe=log.actual_rpe,lift=log.item.lift,upload_status='uploaded',review_status='reviewed' if reviewed else 'pending',submitted_for_review=False,is_active=True,coach_feedback='Demo feedback: controlled setup and a consistent bar path.' if reviewed else None,coach_private_notes='DEV_PRIVATE_ARCHIVE_SENTINEL',video_angle='side',reviewed_by=77 if reviewed else None,reviewed_at=datetime.combine(w.date,time(19)) if reviewed else None)
    db.session.add(v);db.session.flush();films.append({'id':v.id,'movement':key,'width':metadata['width'],'height':metadata['height'],'duration':metadata['duration'],'sha256':metadata['sha256']})
   past=[('2025-11-08','Competition Squat',80,5,'manual_history'),('2025-11-15','Competition Bench',50,5,'manual_history'),('2025-11-22','Competition Deadlift',100,3,'manual_history'),('2026-03-07','Competition Squat',90,3,'import'),('2026-03-14','Competition Bench',65,3,'import'),('2026-06-06','Competition Deadlift',115,2,'import')]
   for index,(day,name,kg,reps,source) in enumerate(past):db.session.add(HistoricalPerformanceEntry(athlete_id=68,coach_id=77,source=source,performed_on=date.fromisoformat(day),movement_name=name,raw_movement_name=name,normalized_movement_name=name.lower(),weight_kg=kg,raw_weight=kg,raw_unit='kg',reps=reps,sets=1,rpe=8,notes='Fictional DEV archive example; preserved pre-app training record.',raw_row_json={'fixture':MARKER},external_ref=f'{MARKER}:{index}',row_hash=hashlib.sha256(f'{MARKER}:{index}'.encode()).hexdigest()))
   for title,day,lifts in [('Spring Open · DEV demo','2026-03-21',[(90,95,100),(60,62.5,65),(115,120,125)]),('Summer Open · DEV demo','2026-06-20',[(100,105,110),(65,70,72.5),(125,130,135)])]:
    d=date.fromisoformat(day);summer='Summer' in title;misses={('BN',3)}|({('DL',3)} if summer else set());meet=MeetPlan(coach_id=77,athlete_id=68,meet_name=title,meet_date=d,federation='Demo federation',meet_category='full_power',division='open',weight_class='74 kg',location='Fictional DEV venue',weigh_in_bodyweight_kg=72,status='completed',completed_at=datetime.combine(d,time(17)),notes=MARKER);db.session.add(meet);db.session.flush();bests=[];made=0
    for lift,weights in zip(['SQ','BN','DL'],lifts):
     good=[]
     for n,kg in enumerate(weights,1):
      success=(lift,n) not in misses;made+=int(success)
      if success:good.append(kg)
      a=MeetAttempt(meet_plan_id=meet.id,lift=lift,attempt_number=n,weight_kg=kg,result='made' if success else 'missed',completed_at=datetime.combine(d,time(12+n)))
      db.session.add(a);db.session.flush();db.session.add(MeetAttemptResult(meet_plan_id=meet.id,attempt_id=a.id,athlete_id=68,lift=lift,attempt_number=n,planned_weight_kg=kg,actual_weight_kg=kg,result='good' if success else 'miss'))
     bests.append(max(good))
    db.session.add(MeetResultSummary(meet_plan_id=meet.id,athlete_id=68,coach_id=77,bodyweight_kg=72,weight_class='74 kg',best_squat_kg=bests[0],best_bench_kg=bests[1],best_deadlift_kg=bests[2],total_kg=sum(bests),squat_made=3,bench_made=2,deadlift_made=2 if summer else 3,attempts_made=made,attempts_taken=9))
   db.session.flush();preserved=assert_preserved(before)
   result={'applied':args.apply,'database':'strength_ledger_dev','athlete_id':68,'role':'athlete','films_added':films,'past_entries_added':6,'meets_added':2,'attempts_added':18,'original_rows_preserved':preserved,'credential_relationship_changes':False,'marker':MARKER}
   if args.apply:db.session.commit()
   else:
    db.session.rollback()
    for key in created_keys:storage.delete_video(key)
   print(json.dumps(result))
  except BaseException:
   db.session.rollback()
   for key in created_keys:storage.delete_video(key)
   raise

if __name__=='__main__':main()
