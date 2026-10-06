import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as cache from '../lib/session-exposure-cache.ts';
import * as snapshots from '../lib/session-exposure-snapshot.ts';
// Run the production hook with React's state/effect lifecycle and controlled
// authorized History reads. Late responses and failed reads must not hide history.
const pending=[], reads=[], states=[], effects=[], cleanups=[];
let cursor=0, effectCursor=0, revision=0;
const react={
 useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],v=>states[i]=v];},
 useEffect(fn,deps){const i=effectCursor++,old=effects[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){cleanups[i]?.();effects[i]={deps,fn};pending.push(()=>{cleanups[i]=fn();});}},
 useSyncExternalStore:(_,snapshot)=>snapshot(),
 createElement:(type,props,...children)=>({type,props:props||{},children}),
};
function load(file,deps){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:key=>{assert.ok(key in deps,key);return deps[key];}});return module.exports;}
const identity=load('lib/use-session-exposure.ts',{react,'./canonical-movement-history':{},'./session-exposure-cache':cache,'./session-exposure-snapshot':snapshots});
const availability=load('lib/use-movement-history-availability.ts',{react,'./use-session-exposure':identity,
 './evidence-read-cache':{evidenceReadCache:{subscribe:()=>()=>{},snapshot:()=>revision}},
 './canonical-movement-history':{fetchCanonicalMovementHistory:options=>new Promise((resolve,reject)=>reads.push({options,resolve,reject}))}});
const context={ownerId:'owner-72',athleteId:65,workoutId:1840,sessionDate:'2026-10-09'};
let props={context,target:{athleteId:65,movementDefinitionId:121,equipmentContextDefinitionId:652},enabled:true};
const render=()=>{cursor=0;effectCursor=0;return availability.useMovementHistoryAvailability(props);};
const flush=()=>pending.splice(0).forEach(fn=>fn());
const settle=async()=>{for(let i=0;i<4;i++)await Promise.resolve();};
const history=(n,scope='exact_identity')=>({scope,filters:{date_range:'all',selected_scope:'all_history'},summary:{set_count:n}});
assert.equal(render().status,'loading');flush();assert.equal(reads.length,1);
assert.equal(reads[0].options.movementDefinitionId,121);assert.equal(reads[0].options.range,'all');assert.equal(reads[0].options.limit,1);
assert.equal(reads[0].options.equipmentContextDefinitionId,undefined,'other-equipment history must be discoverable without becoming a comparison');
reads[0].resolve(history(6));await settle();assert.equal(render().status,'found');flush();assert.equal(reads.length,1,'unrelated renders do not refetch');
props={...props,target:{...props.target,equipmentContextDefinitionId:27}};render();flush();assert.equal(reads.length,1,'history existence does not change with selected manufacturer');
props={...props,target:{...props.target,movementDefinitionId:219}};assert.equal(render().status,'loading','previous movement must not leak');flush();reads[1].resolve(history(0));await settle();assert.equal(render().status,'empty');
revision++;assert.equal(render().status,'loading');flush();reads[2].resolve(history(1));await settle();assert.equal(render().status,'found','new accepted evidence invalidates empty history');
props={...props,target:{...props.target,movementDefinitionId:252}};render();flush();const stale=reads.at(-1);
props={...props,context:{...context,ownerId:'different-owner'}};assert.equal(render().status,'loading');flush();stale.resolve(history(0));await settle();assert.equal(render().status,'loading','late previous-owner empty result must be ignored');
reads.at(-1).reject(Error('offline'));await settle();assert.equal(render().status,'error','network failure is never empty');
revision++;render();flush();reads.at(-1).resolve(history(0,'equipment_identity'));await settle();assert.equal(render().status,'error','restricted history cannot prove global emptiness');
revision++;render();flush();reads.at(-1).resolve(history(-1));await settle();assert.equal(render().status,'error','invalid summaries cannot prove emptiness');
props={...props,target:{athleteId:66,movementDefinitionId:252}};render();const count=reads.length;flush();assert.equal(render().status,'error');assert.equal(reads.length,count,'wrong authorized athlete does not dispatch');
props={context:{...context,sessionDate:'invalid'},target:{athleteId:65,movementDefinitionId:252},enabled:true};render();flush();assert.equal(render().status,'error');assert.equal(reads.length,count,'invalid Session identity does not dispatch');
props={context,target:{athleteId:65,coreMovementId:1},enabled:true};render();flush();reads.at(-1).resolve(history(2,'exact_core_identity'));await settle();assert.equal(render().status,'found');
props={...props,enabled:false};render();flush();revision++;render();flush();assert.equal(reads.length,count+1,'disabled comparable peeks do not dispatch extra reads');
// Run the actual component for its full, compact, absent, loading and failed states.
let read={status:'empty',exposure:null}, status='empty',opens=0;
const component=load('components/workout-logger/session-history-peek.tsx',{react,'react-native':{Pressable:'Pressable',View:'View',StyleSheet:{create:s=>s}},
 '@/components/ui/sl-text':{Text:'Text'},'@expo/vector-icons':{Ionicons:'Ionicons'},'@/constants/theme':{SLFontFamilies:{sansSemiBold:'test'}},
 '@/lib/use-session-exposure':{useSessionExposure:()=>read},'@/lib/use-movement-history-availability':{useMovementHistoryAvailability:()=>({status})},
 '@/lib/session-exposure-snapshot':{presentSessionExposure:e=>e}});
const p={target:{athleteId:65,movementDefinitionId:121,equipmentContextDefinitionId:652},ownerId:'72',workoutId:1840,sessionDate:'2026-10-09',unit:'lb',onOpen:()=>opens++};
const text=n=>n==null?'':typeof n==='object'?(n.children||[]).map(text).join(' '):String(n);
assert.equal(component.SessionHistoryPeek(p),null,'no exact history means no card or link');
status='found';let tree=component.SessionHistoryPeek(p);assert.match(text(tree),/Movement history/);assert.doesNotMatch(text(tree),/EXPOSURE|lb|No comparable/);assert.equal(tree.props.style.backgroundColor,undefined);tree.props.onPress();assert.equal(opens,1);
status='error';assert.match(text(component.SessionHistoryPeek(p)),/Movement history.*Unavailable/);
status='loading';assert.match(text(component.SessionHistoryPeek(p)),/Loading history/);
read={status:'found',exposure:{performance:'110 lb × 12',effort:'@1 RIR',date:'Oct 5',equipmentLabel:'Arsenal Strength'}};status='empty';tree=component.SessionHistoryPeek(p);assert.match(text(tree),/LAST COMPARABLE EXPOSURE.*Oct 5.*110 lb × 12.*Arsenal Strength/);assert.equal(tree.props.style.backgroundColor,'#080b0e');tree.props.onPress();assert.equal(opens,2);
console.log('PASS: exact all-equipment history existence; manufacturer-independent link only; owner/athlete/movement isolation; stale response rejection; evidence invalidation; no repeat render reads; empty/error distinction; actual full/compact/hidden rendering and History navigation');
