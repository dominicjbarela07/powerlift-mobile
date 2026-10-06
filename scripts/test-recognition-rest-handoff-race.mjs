import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {initialLoggerFeedbackState,loggerFeedbackReducer,attachTransientRecognitionDelivery,selectCelebrationEvents,isNewCanonicalSessionFinalSet} from '../lib/logger-feedback.ts';
const source=fs.readFileSync('app/(tabs)/workout/[workoutId].tsx','utf8');
function acceptedCallback(text) {
 const tree=ts.createSourceFile('logger.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let result;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='handleCanonicalSetFeedback')result=node.initializer.arguments[0].getText(tree);ts.forEachChild(node,visit);}
 visit(tree);assert.ok(result,'actual canonical acceptance handler required');
 return ts.transpileModule(`globalThis.actualCallback=${result};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
}
const event={id:999,event_type:'ACCESSORY_REP_MAX_PR',priority:10,core_movement_key:'machine_lateral_raise',movement_label:'Machine Lateral Raise',current_value:22,prior_value:20,delta:2,unit:'kg',scope:'career',comparison_bucket:'reps:10',source_set_log_id:99,trigger_set_log_id:99,source_revision:1,calculation_version:'accessory-rep-max-v1',newly_generated:true,replayed:false,consumed:false,evidence:{rep_count:10,equipment_configuration_identity_id:653,comparison_scope:'canonical_movement_exact_equipment'}};
function check(text,{offer=true,final=false,replay=false}={}) {
 let state=loggerFeedbackReducer(initialLoggerFeedbackState,{type:'SUBMIT_STARTED',itemId:10});const timers=[];
 const context={attachTransientRecognitionDelivery,selectCelebrationEvents,isNewCanonicalSessionFinalSet,
 setAcceptedSetEvidenceItemIds:()=>{},acceptedRestOfferRef:{current:null},shouldOfferRestAfterAcceptedSet:()=>offer,
 dataRef:{current:{workout:{accessory_groups:[]}}},feedbackStateRef:{current:state},workoutId:1845,user:{preferred_units:'lb'},
 transientTraceContextRef:{current:{}},transientRecognitionTrace:()=>{},rewardLoopDemoV2Log:()=>{},
 feedbackDispatch:a=>{state=loggerFeedbackReducer(state,a);context.feedbackStateRef.current=state;},
 lastAcceptedAtRef:{current:null},submissionStartedAtRef:{current:null},rewardLoopDemoV2StorageScope:null,
 feedbackAnalytics:()=>{},triggerAcceptedSetHaptic:()=>Promise.resolve('career'),saveFeedbackTimerRef:{current:null},
 setTimeout:f=>{timers.push(f);return 1;},clearTimeout:()=>{},SLMotion:{saveConfirmationMs:800}};
 vm.createContext(context);vm.runInContext(acceptedCallback(text),context);
 context.actualCallback({set:{id:99,item_id:10},created:!replay,replayed:replay,client_submission_id:'race-save',recognition_events:[event],completion_boundary:{authority:'canonical',movement_final_set:true,session_final_set:final}},10);
 for(const timer of timers)timer();
 context.feedbackDispatch({type:'DISPLAY_NEXT_RECOGNITION'});
 if(offer&&!final&&!replay){
  assert.equal(state.recognition.currentEvent,null,'PR must not start before delayed rest picker mounts');
  assert.equal(state.timer.status,'picker_pending');assert.equal(state.recognition.queuedEvents.length,1);
  context.feedbackDispatch({type:'TIMER_ACTIVE'});context.feedbackDispatch({type:'DISPLAY_NEXT_RECOGNITION'});
  assert.equal(state.recognition.currentEvent?.id,999,'earned PR must play after rest selection');
 } else if(replay)assert.equal(state.recognition.currentEvent,null,'replayed saves do not reserve or play recognition');
 else assert.equal(state.recognition.currentEvent?.id,999,'no-rest and canonical final Sets remain deliverable');
}
check(source);check(source,{offer:false});check(source,{final:true});check(source,{replay:true});
assert.match(source,/logger_sheet: !!coreWheel \|\| !!accessoryWheel/,'open set sheets also block recognition release');
const original=source.replace(/    \/\/ Reserve the rest handoff[\s\S]*?    if \(events.length/,'    if (events.length');
assert.throws(()=>check(original),/PR must not start before delayed rest picker mounts/,'deliberately reintroducing late reservation must fail');
console.log('Actual canonical save handler reserves recognition through delayed rest mount, no-rest/final/replay paths retained; original race deliberately rejected.');
