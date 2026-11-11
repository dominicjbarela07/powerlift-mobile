import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=fs.readFileSync('app/(tabs)/workout/[workoutId].tsx','utf8');
function load(file,imports={},extra={}) {
 const exports={};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 vm.runInNewContext(js,{exports,require:n=>{assert.ok(n in imports,`Missing stub ${n}`);return imports[n]},console,Date,Math,Map,Set,Uint8Array,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},...extra},{filename:file});return exports;
}
const status=load('lib/set-video-upload-status.ts');
assert.equal(status.requireUploadedSetVideo({id:8,set_log_id:77,upload_status:'uploaded'},77),8);
for(const video of [null,{}, {id:8,set_log_id:77,upload_status:'processing'}, {id:8,set_log_id:78,upload_status:'uploaded'}])assert.throws(()=>status.requireUploadedSetVideo(video,77),/not confirmed/);
assert.equal(status.videoUploadPresentation({status:'pending'}).label,'Video queued · Set saved');
assert.match(status.videoUploadPresentation({status:'uploading',uploadedBytes:4,totalBytes:4}).label,/99%/,'chunk completion is not server acceptance');
assert.equal(status.videoUploadPresentation({status:'uploaded'}).tone,'error');
assert.equal(status.videoUploadPresentation({status:'uploaded',serverAttachmentId:8}).action,'View');
assert.equal(status.videoUploadPresentation({status:'failed_retryable'}).action,'Retry');

async function exerciseQueue(responseVideo,actorSwitch=false) {
 const actor=load('lib/execution-actor.ts');actor.setExecutionActor(1);
 let jobs=[{id:'job-1',ownerUserId:'1',status:'pending',setLogId:77,workoutId:42,localFileUri:'file:/video-upload-queue/clip',filename:'clip.mp4',mimeType:'video/mp4',retryCount:0,createdAt:'2026-10-14',updatedAt:'2026-10-14'}];
 const deleted=[],states=[],calls=[];
 const storage={getItem:async()=>JSON.stringify(jobs),setItem:async(_k,v)=>{jobs=JSON.parse(v);states.push(structuredClone(jobs[0]));}};
 const api={API_BASE:'/api',fetchJson:async(path,options)=>{
  calls.push({path,options});
  if(path.endsWith('/init'))return {ok:true,json:{ok:true,upload_id:'u1',chunk_size:2,total_chunks:2}};
  if(path.endsWith('/complete')){if(actorSwitch)actor.setExecutionActor(2);return {ok:true,json:{ok:true,video:responseVideo}};}
  return {ok:true,json:{ok:true}};
 }};
 const queue=load('lib/videoUploadQueue.ts',{'@/lib/execution-actor':actor,'@react-native-async-storage/async-storage':{default:storage},'expo-file-system/legacy':{documentDirectory:'file:/',getInfoAsync:async()=>({exists:true,size:4}),readAsStringAsync:async()=> 'AAAA',deleteAsync:async uri=>deleted.push(uri),EncodingType:{Base64:'base64'}},'react-native':{Platform:{OS:'ios'},AppState:{addEventListener:()=>({remove(){}})}},'@/lib/api':api,'@/lib/updateSafety':{setUpdateBlocker(){}},'@/lib/set-video-upload-status':status});
 await queue.processVideoUploadQueue();return {jobs,deleted,states,calls,queue};
}
let q=await exerciseQueue({id:8,set_log_id:77,upload_status:'uploaded'});
assert.equal(q.jobs[0].status,'uploaded');assert.equal(q.jobs[0].serverAttachmentId,8);assert.equal(q.deleted.length,1);
assert.ok(q.states.some(j=>j.uploadedBytes===2&&j.totalBytes===4));
assert.ok(q.states.filter(j=>j.status==='uploaded').every(j=>j.serverAttachmentId===8));
await q.queue.processVideoUploadQueue();assert.equal(q.calls.filter(c=>c.path.endsWith('/complete')).length,1,'completed upload cannot replay');
for(const response of [null,{id:8,set_log_id:77,upload_status:'processing'},{id:8,set_log_id:99,upload_status:'uploaded'}]){
 q=await exerciseQueue(response);assert.equal(q.jobs[0].status,'failed_retryable');assert.equal(q.deleted.length,0,'failed confirmation preserves retry file');assert.match(q.jobs[0].lastError,/not confirmed/);
}
q=await exerciseQueue({id:8,set_log_id:77,upload_status:'uploaded'},true);assert.notEqual(q.jobs[0].status,'uploaded');assert.equal(q.deleted.length,0,'account switch cannot accept or remove old owner file');

function functionFrom(start,end,context={}) {
 const text=source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
 return vm.runInNewContext(ts.transpileModule(text+'\nqueueCoreWheelLog;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
}
const video={uri:'file:selected',name:'selected.mp4',mimeType:'video/mp4'};
let pending;
const queueCore=functionFrom('  const queueCoreWheelLog =','  const commitCoreWheel', {feedbackAnalytics(){},prefillCoreInput(){},prefillFcInput(){},setPendingCoreWheelLog:v=>pending=v});
for(const kind of ['straight','top','bk','fc']){
 queueCore({kind,itemId:9,setIndex:2,weight:'10',reps:'5',rpe:'7',selectedVideo:video});assert.equal(pending.selectedVideo,video);
 const start=source.indexOf('    if (!pendingCoreWheelLog) return;');const end=source.indexOf('\n  }, [pendingCoreWheelLog',start);const dispatched=[];
 vm.runInNewContext(ts.transpileModule('(function(){'+source.slice(start,end)+'})()',{}).outputText,{pendingCoreWheelLog:pending,setPendingCoreWheelLog(){},requestAnimationFrame:fn=>fn(),...Object.fromEntries(['logStraightSet','logTopSet','logBackdownSet','logFullCustomSet'].map(name=>[name,(...args)=>dispatched.push(args)]))});
 assert.equal(dispatched.length,1);assert.equal(dispatched[0].at(-1),video,kind+' preserves selected video through actual dispatch');
}
const accStart=source.indexOf('  const queueAccessoryWheelLog =');const accEnd=source.indexOf('  const commitAccessoryWheel',accStart);
const queueAcc=vm.runInNewContext(ts.transpileModule(source.slice(accStart,accEnd)+'\nqueueAccessoryWheelLog;',{}).outputText,{feedbackAnalytics(){},setAccInputs(){},setPendingAccessoryLogItemId:v=>pending=v});queueAcc({itemId:10,selectedVideo:video});assert.equal(pending.selectedVideo,video);
const loopStart=source.indexOf('        for (const entry of parsedEntries) {\n          if (!entry.selectedVideo)');const loopEnd=source.indexOf('        parsedEntries.forEach',loopStart);assert.ok(loopStart>0);
const attached=[];await vm.runInNewContext(ts.transpileModule('(async()=>{'+source.slice(loopStart,loopEnd)+'})()',{}).outputText,{parsedEntries:[{itemId:1,selectedVideo:video},{itemId:2,selectedVideo:{...video,uri:'file:second'}}],json:{entries:[{item_id:2,set:{id:102}},{item_id:1,set:{id:101}}]},attachSelectedVideoToLoggedSet:async(id,v)=>{attached.push([id,v.uri]);return null},setError:()=>assert.fail()});assert.deepEqual(attached,[[101,'file:selected'],[102,'file:second']]);

const react={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'Fragment',useState:v=>[v,()=>{}]};
const ui=load('components/workout-logger/set-entry-video.tsx',{'react':{...react,default:react},'react-native':{ActivityIndicator:'Spinner',Alert:{alert(){}},Image:'Image',Pressable:'Button',View:'View',StyleSheet:{create:s=>s,hairlineWidth:1}},'@expo/vector-icons':{Ionicons:'Icon'},'@/components/ui/sl-text':{Text:'Text'},'@/constants/theme':{SLColors:new Proxy({},{get:()=> 'color'}),SLFontFamilies:{},SLRadius:{}},'@/lib/set-video-upload-status':status,'./selected-set-video-preview':{SelectedSetVideoPreview:'Preview'}});
const nodes=t=>!t||typeof t!=='object'?[]:[t,...(t.children||[]).flat(Infinity).flatMap(nodes)];
let picked=0,removed=0,changed;
let tree=ui.SetEntryVideo({onPick:async()=>picked++,onChange:v=>changed=v,onRemove:()=>removed++,allowCoachReview:true});await nodes(tree).find(n=>n.props.accessibilityLabel==='Add video to this set').props.onPress();assert.equal(picked,1);
tree=ui.SetEntryVideo({video,onPick:async()=>{},onChange:v=>changed=v,onRemove:()=>removed++,allowCoachReview:true});nodes(tree).find(n=>n.props.accessibilityLabel==='Remove selected video').props.onPress();assert.equal(removed,1);const intents=nodes(tree).filter(n=>n.props.accessibilityState?.selected!=null);assert.equal(intents.length,2);intents[0].props.onPress();assert.equal(changed.submitForReview,false);
tree=ui.SetEntryVideo({video,onPick:async()=>{},onChange(){},onRemove(){},allowCoachReview:false});assert.equal(nodes(tree).filter(n=>n.props.accessibilityState?.selected!=null).length,0,'self-coach does not inherit coach review');
let viewed,retried;tree=ui.SessionVideoUploadStatus({job:{id:'a',status:'uploaded',serverAttachmentId:8},onView:id=>viewed=id,onRetry:id=>retried=id});nodes(tree).find(n=>n.props.accessibilityLabel==='View uploaded set video').props.onPress();assert.equal(viewed,8);
tree=ui.SessionVideoUploadStatus({job:{id:'a',status:'failed_retryable'},onView(){},onRetry:id=>retried=id});nodes(tree).find(n=>n.props.accessibilityLabel==='Retry set video upload').props.onPress();assert.equal(retried,'a');
assert.equal((source.match(/<SetEntryVideo video=/g)||[]).length,3,'all three canonical entry surfaces mount the real attachment component');
console.log('PASS: real queue confirmation/progress/retry preservation/ownership, four Core handlers, accessory and exact grouped Set association, actual picker/status controls and archive/review intent.');
