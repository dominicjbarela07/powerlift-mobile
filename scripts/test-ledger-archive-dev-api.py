import argparse,json,urllib.request,urllib.error,http.cookiejar
from pathlib import Path
parser=argparse.ArgumentParser(description='Read-only checks of the seeded local DEV athlete archive');parser.add_argument('--credentials',type=Path,required=True);args=parser.parse_args()
base='http://127.0.0.1:5017'
credentials=json.loads(args.credentials.read_text())
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
r=opener.open(urllib.request.Request(base+'/auth/login-mobile',data=json.dumps({'email':credentials['email'],'password':credentials['password']}).encode(),headers={'Content-Type':'application/json'}));auth=json.load(r)
assert auth['role']=='athlete' and auth['athlete_id']==68
headers={'Authorization':'Bearer '+auth['token']}
def get(path):
 with opener.open(urllib.request.Request(base+path,headers=headers)) as response:return json.load(response)
training=get('/mobile/ledger/archive/training?source_type=session&limit=24');past=get('/mobile/ledger/archive/training?source_type=historical');media=get('/mobile/ledger/archive/media');meets=get('/mobile/ledger/archive/competition');videos=get('/video-review/mobile/athlete/archive')
assert len(past['items'])==6 and len(media['items'])==3 and len(meets['items'])==2
assert all(i['archive_item_type']=='session' for i in training['items'])
assert 'DEV_PRIVATE_ARCHIVE_SENTINEL' not in json.dumps([training,past,media,meets,videos])
checked=[]
for video in videos['videos']:
 assert video['id'] in {item['source_id'] for item in media['items']}
 poster=video['thumbnail_url'];detail=get(f"/video-review/mobile/attachments/{video['id']}/url");url=detail['video'].get('url')
 assert 'DEV_PRIVATE_ARCHIVE_SENTINEL' not in json.dumps(detail)
 assert poster and url, list(video)
 with opener.open(poster) as response:assert response.status==200 and response.headers['Content-Type'].startswith('image/');assert len(response.read())>100
 with opener.open(urllib.request.Request(url,headers={'Range':'bytes=0-127'})) as response:assert response.status==206 and len(response.read())==128;assert response.headers.get('Content-Range','').startswith('bytes 0-127/')
 checked.append(video['id'])
for meet in meets['items']:
 s=meet['meet_context']['result_summary'];attempts=meet['meet_context']['attempts'];assert len(attempts)==9
 good=[a for a in attempts if a['result']=='made'];bests=[max(a['weight_kg'] for a in good if a['lift']==lift) for lift in ['SQ','BN','DL']]
 assert sum(bests)==s['total_kg'] and len(good)==s['attempts_made'];assert s['total_kg'] in [287.5,310]
 original=get(f"/mobile/ledger/archive/detail/meet/{meet['source_id']}");assert original['item']['source_id']==meet['source_id']
for item in past['items']:
 original=get(f"/mobile/ledger/archive/detail/historical_performance/{item['source_id']}");assert original['item']['performance']==item['performance']
for foreign in ['/mobile/ledger/archive/training?athlete_id=1','/mobile/ledger/archive/detail/video/1']:
 try:opener.open(urllib.request.Request(base+foreign,headers=headers));raise AssertionError('Foreign evidence accessible')
 except urllib.error.HTTPError as e:assert e.code in [403,404,410]
print(json.dumps({'authenticated_role':'athlete','athlete_id':68,'training_page':len(training['items']),'past_entries':6,'films_with_real_posters_and_206_range':checked,'completed_meets':2,'attempts':18,'final_totals_kg':[i['meet_context']['result_summary']['total_kg'] for i in meets['items']],'source_roundtrips':8,'private_note_leaks':0,'foreign_access_rejected':True}))
