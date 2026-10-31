import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as archive from '../lib/ledger-archive-visuals.ts';
import * as presentation from '../lib/ledger-history-presentation.ts';
import * as records from '../lib/ledger-records.ts';
import * as art from '../lib/ledger-movement-art.ts';
const session=(id,date,sets=3)=>({archive_item_type:'session',source_id:id,athlete_id:68,title:`Session ${id}`,occurred_on:date,performance:{set_count:sets,movement_count:1}});
const oct=[session(1,'2026-10-02'),session(2,'2026-10-02'),session(3,'2026-10-16')];
const cells=archive.archiveMonthCells('2026-10',oct);
assert.equal(cells.length,35);assert.equal(cells[3].date,'2026-10-01');assert.equal(cells[4].items.length,2);
assert.equal(cells.filter(c=>c.date).length,31);assert.equal(cells.at(-1).date,null);
assert.equal(archive.archiveMonthCells('2024-02',[]).filter(c=>c.date).length,29);
assert.equal(archive.archiveMonthCells('2025-02',[]).filter(c=>c.date).length,28);
assert.equal(archive.shiftArchiveMonth('2026-01',-1),'2025-12');assert.equal(archive.shiftArchiveMonth('2026-12',1),'2027-01');
assert.throws(()=>archive.archiveMonthBounds('2026-13'));
assert.equal(archive.archiveMonthComplete('2026-10',oct,true),false,'A bounded page must not make missing days rest days');
assert.equal(archive.archiveMonthComplete('2026-10',[...oct,session(4,'2026-09-30')],true),true);
assert.equal(archive.archiveSetTotal(oct),9);assert.equal(archive.archiveSetTotal([session(1,'2026-10-01',0)]),0);
assert.equal(archive.archiveSetTotal([{performance:{}},...oct]),null,'Unknown set counts are not zero');
assert.deepEqual(archive.archiveYearGroups([session(1,'2025-11-01'),session(2,'2026-03-01')]).map(g=>g.year),['2026','2025']);
const pr=(id,key,type,value,date)=>({id,core_movement_key:key,movement_label:key,event_type:type,unit:'kg',current_value:value,workout_date:date,evidence:{actual_reps:5},source_set_log_id:100+id,source_workout_id:50+id});
const events=[pr(4,'competition_squat','CORE_E1RM_PR',200,'2026-10-16'),pr(3,'competition_squat','CORE_WEIGHT_PR',100,'2026-10-16'),pr(2,'pause_squat','CORE_WEIGHT_PR',70,'2026-10-12'),pr(1,'competition_squat','CORE_WEIGHT_PR',95,'2026-10-16'),pr(5,'competition_squat','CORE_WEIGHT_PR',0,'2026-08-01'),pr(6,'competition_squat','CORE_REP_MAX_PR',120,'2026-10-17')];
let points=archive.archiveLoadRecordPoints(events,'competition_squat','kg');
assert.deepEqual(points.map(p=>p.value),[0,95,100]);assert.equal(new Set(points.map(p=>p.id)).size,3);
assert.ok(Math.abs(archive.archiveLoadRecordPoints(events,'pause_squat','lb')[0].value-154.32358)<.001);
assert.equal(archive.archiveBestGroups(events).length,2);
assert.equal(archive.archiveBestGroups([{id:1,movement_label:'Same'},{id:2,movement_label:'Same'}]).length,2,'Unresolved identity must not merge by title');
assert.throws(()=>assert.deepEqual([200,...points.map(p=>p.value)],[0,95,100]),'Deliberately mixing estimates into performed load must fail');
assert.throws(()=>assert.equal(archive.archiveMonthComplete('2026-10',oct,true),true),'Deliberately claiming partial coverage complete must fail');
const meet={archive_item_type:'meet',source_id:20,title:'Summer Open',occurred_on:'2026-06-20',status:'completed',meet_context:{result_summary:{total_kg:310,best_squat_kg:110,best_bench_kg:70,best_deadlift_kg:130,attempts_made:7,attempts_taken:9},attempts:[{lift:'SQ',attempt_number:1,weight_kg:100,result:'made'},{lift:'BN',attempt_number:3,weight_kg:72.5,result:'missed'},{lift:'DL',attempt_number:1,weight_kg:0,result:'pending'}]}};
const attempts=archive.archiveMeetAttempts(meet);
assert.equal(attempts.length,3);assert.ok(attempts.every(l=>l.attempts.length===3));
assert.equal(attempts[1].attempts[2].state,'missed');assert.equal(attempts[2].attempts[0].state,'unrecorded');assert.equal(attempts[2].attempts[0].kg,0);
assert.equal(attempts[0].attempts[1].kg,null,'Missing attempt is not a zero-weight success');

const token=new Proxy({},{get:(_,key)=>String(key)}),theme={colors:token,material:token,fonts:token,type:token,radius:token};
let state=[],index=0,opened,month,played;
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useEffect:()=>{},useState(initial){const i=index++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}];}};
const mocks={react,'react-native':{ActivityIndicator:'Loading',View:'View',Pressable:'Pressable',StyleSheet:{create:x=>x,absoluteFillObject:{}}},'expo-image':{Image:'Image'},'@expo/vector-icons':{Ionicons:'Icon'},'@/components/keyboard/KeyboardSurface':{KeyboardScrollView:'Scroll'},'@/components/ui/sl-text':{Text:'Text'},'@/constants/ledger':{LEDGER:theme},'@/components/charts/AnalyticalTimeSeriesChart':{AnalyticalTimeSeriesChart:'Chart'},'@/lib/chart-fidelity':{analyticalMetricDefinition:(_,x)=>x},'@/lib/ledger-archive':{fetchArchiveDetail:()=>{}},'@/lib/ledger-records':records,'@/lib/ledger-history-presentation':presentation,'@/lib/ledger-archive-visuals':archive,'@/lib/ledger-movement-art':art,'./LedgerMovementBackdrop':{LedgerMovementBackdrop:'Backdrop'},'./LedgerVisuals':{LedgerSurface:'Surface'},'./use-ledger-resource':{useLedgerResource:()=>({data:null})}};
function load(path){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>{assert.ok(key in mocks,key);return mocks[key];}});return exports;}
const views=load('components/ledger/LedgerArchiveViews.tsx');
const nodes=tree=>tree==null||tree===false?[]:Array.isArray(tree)?tree.flatMap(nodes):typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[tree];
const texts=tree=>nodes(tree).filter(n=>typeof n==='string'||typeof n==='number').join(' ');
function render(name,props,fresh=true){if(fresh)state=[];index=0;return views[name](props);}
const open=s=>opened=s;
let props={items:oct,month:'2026-10',hasMore:true,subject:'athlete:68',unit:'kg',onMonth:v=>month=v,open};
let tree=render('LedgerTrainingArchive',props);
let all=nodes(tree);all.find(n=>n.props?.accessibilityLabel==='Previous archive month').props.onPress();assert.equal(month,'2026-09');
assert.ok(texts(tree).includes('Sessions shown'));assert.ok(!texts(tree).includes('rest day'));
all.find(n=>n.props?.accessibilityLabel?.startsWith('Oct 2, 2026:')).props.onPress();
tree=render('LedgerTrainingArchive',props,false);assert.equal(nodes(tree).filter(n=>typeof n.type==='function'&&n.type.name==='ArchiveSessionHero').length,2,'Selecting a day retains both original Sessions');
const tiles=nodes(tree).filter(n=>n.props?.accessibilityLabel?.startsWith('Open Session'));
tiles[0].props.onPress();assert.equal(opened.id,1);assert.equal(opened.type,'session');
tree=render('LedgerTrainingSearch',{items:[...oct,session(4,'2025-10-01')],unit:'kg',open});assert.equal(nodes(tree).filter(n=>n.props?.accessibilityLabel?.startsWith('Open Session')).length,4,'Search cannot hide matches in another month');
tree=render('LedgerBestArchive',{events,unit:'kg',open});all=nodes(tree);const chart=all.find(n=>n.type==='Chart');assert.ok(chart);assert.deepEqual(chart.props.series[0].points.map(p=>p.value),[0,95,100]);chart.props.onPointPress({index:2});assert.equal(opened.id,103);assert.equal(opened.type,'set');
assert.ok(texts(tree).includes('calculated'));assert.ok(all.some(n=>n.type==='Backdrop'));
const past=[{...session(1,'2025-11-01'),archive_item_type:'historical_performance',source_type:'manual_history',performance:{weight_kg:0,reps:8,sets:1}}];
tree=render('LedgerPastArchive',{items:past,unit:'kg',open});assert.ok(texts(tree).includes('MANUAL'));assert.ok(texts(tree).includes('0 kg × 8'));nodes(tree).find(n=>n.props?.accessibilityLabel?.startsWith('Open past entry')).props.onPress();assert.equal(opened.type,'historical_performance');
tree=render('LedgerFilmArchive',{items:[{...session(5,'2026-10-12'),archive_item_type:'video',subtitle:'Demo film · Session',performance:{weight_kg:100,reps:3},status:'reviewed'}],posters:{5:'https://example.test/signed-poster'},unit:'kg',open,play:id=>played=id});
const tile=nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='FilmTile');index=0;state=[];let film=tile.type(tile.props),filmNodes=nodes(film);assert.equal(filmNodes.find(n=>n.type==='Image').props.contentFit,'contain');assert.ok(texts(film).includes('Demo film · Session'));filmNodes.find(n=>n.props?.accessibilityLabel?.startsWith('Play ')).props.onPress();assert.equal(played,5);const source=filmNodes.find(n=>typeof n.type==='function'&&n.type.name==='SourceLink');source.props.onPress();assert.equal(opened.id,5);assert.equal(opened.type,'video');
for(const unit of ['kg','lb']){tree=render('LedgerMeetArchive',{items:[meet],unit,open});assert.ok(texts(tree).includes(unit==='kg'?'310':'683.4'));assert.ok(texts(tree).includes('7/9 made'));const link=nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='SourceLink');link.props.onPress();assert.equal(opened.id,20);assert.equal(opened.type,'meet');}
tree=render('LedgerMeetArchive',{items:[{...meet,status:'draft'}],unit:'kg',open});assert.ok(texts(tree).includes('No final total recorded'));
console.log('PASS: real month/leap-day placement, partial-page honesty, multi-Session days, cross-month search, zero/missing counts, exact movement/load PR trails and sources, separate estimates, year collections, full-frame film/play/source actions, meet attempts/totals/units and original source actions.');
// Execute the real controller: selected calendar month reaches the server while
// sibling collections retain their own date scope and original source actions.
let requestArgs,user={id:78,role:'athlete',athlete_id:68},resourceLoader,apiCalls=[];
Object.assign(mocks,{'expo-router':{useRouter:()=>({push:()=>{}})},'./athlete-ledger-subject':{useAthleteLedgerSubject:()=>({routeParams:{}})},'@react-native-community/datetimepicker':{__esModule:true,default:'DatePicker'},'@/context/AuthContext':{useAuth:()=>({user})},'@/lib/api':{getAthleteVideoArchive:async()=>{apiCalls.push('own');return {ok:true,json:{ok:true,videos:[{id:5,thumbnail_url:'signed'}]}};},getCoachVideoArchive:async args=>{apiCalls.push(args);return {ok:true,json:{ok:true,videos:[]}};}},'@/components/SetVideoPlayerModal':{__esModule:true,default:'Player'},'@/lib/ledger-rewards':{canonicalPrHistory:x=>x},'@/lib/coach-calendar':{fromLocalYMD:s=>new Date(s+'T12:00:00'),toLocalYMD:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`},'./use-ledger-history':{useLedgerHistory:(...args)=>{requestArgs=args;return {items:oct,events:[],cursor:null,loading:false,error:null};}},'./use-ledger-resource':{useLedgerResource:(key,loader)=>{resourceLoader=loader;return {data:{5:'signed'},loading:false};}},'./LedgerArchiveViews':Object.fromEntries(Object.keys(views).map(k=>[k,k]))});
const pane=load('components/ledger/LedgerHistoryPane.tsx').LedgerHistoryPane;
let controllerProps={subject:'78:68',unit:'kg',open,filter:'training',setFilter:()=>{}};
state=[];index=0;tree=pane(controllerProps);assert.equal(requestArgs[1],undefined,'Personal scope must omit a coach override');
nodes(tree).find(n=>n.type==='LedgerTrainingArchive').props.onMonth('2026-09');index=0;tree=pane(controllerProps);assert.equal(requestArgs[4].from,'2026-09-01');assert.equal(requestArgs[4].to,'2026-09-30');
controllerProps.filter='media';index=0;tree=pane(controllerProps);assert.equal(requestArgs[4].from,undefined,'Training month cannot leak into Film/Meets/Past');
const collection=nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='FilmCollection');state=[];index=0;let filmCollection=collection.type(collection.props);let posters=await resourceLoader();assert.deepEqual(apiCalls,['own']);assert.equal(posters[5],'signed');
nodes(filmCollection).find(n=>n.type==='LedgerFilmArchive').props.play(5);index=0;filmCollection=collection.type(collection.props);let player=nodes(filmCollection).find(n=>n.type==='Player');assert.equal(player.props.visible,true);assert.equal(player.props.videoId,5);player.props.onClose();index=0;filmCollection=collection.type(collection.props);assert.equal(nodes(filmCollection).find(n=>n.type==='Player').props.visible,false);
user={id:77,role:'coach',self_athlete_id:90};state=[];index=0;filmCollection=collection.type({...collection.props,subject:'77:68',athleteId:68});await resourceLoader();assert.deepEqual({...apiCalls.at(-1)},{athlete_id:68,per_page:100});assert.equal(nodes(filmCollection).find(n=>n.type==='Player').props.allowExport,false);
user={id:78,role:'athlete',athlete_id:68};const before=apiCalls.length;state=[];index=0;collection.type({...collection.props,athleteId:999});await assert.rejects(()=>resourceLoader());assert.equal(apiCalls.length,before,'An athlete cannot request another athlete’s film archive');
const product=fs.readFileSync('components/ledger/LedgerExperience.tsx','utf8');assert.ok(product.indexOf('<LedgerViewNavigation ')<product.indexOf('<KeyboardScrollView ref={scroll}'),'The current-view chooser stays outside the scrolling archive');assert.match(product,/ledgerNavigationLocation\(\{section:tab,family,history:historyFilter\}/,'Collection changes must retain an active-view restoration key');
console.log('PASS: actual archive controller and film flow; month server bounds, collection scope, athlete self endpoint, coach target, denied foreign scope, native player open/close/export policy, pinned collection navigation and independent scroll positions.');

assert.equal(presentation.ledgerProvenanceLabel({archive_item_type:'historical_performance',source_type:'manual_history'}),'Manual training entry');
assert.equal(presentation.ledgerProvenanceLabel({archive_item_type:'historical_performance',source_type:'import'}),'Imported training entry');

// Exercise actual layout values, including a deliberate rejected narrow-phone gap.
const gridTree=render('LedgerTrainingSearch',{items:oct,unit:'kg',open});
const gridStyle=nodes(gridTree).find(n=>n.props?.style?.flexWrap==='wrap').props.style;
const tileStyle=nodes(gridTree).find(n=>n.props?.accessibilityLabel?.startsWith('Open Session')).props.style;
function assertGrid(style){for(const screen of [320,375,390,430,768]){const available=screen-36,tiles=2*parseFloat(tileStyle.width)/100*available,gap=style.columnGap??style.gap??0;assert.ok(tiles+gap<=available,'Two archive tiles overflow the phone width');}}
assertGrid(gridStyle);assert.throws(()=>assertGrid({...gridStyle,gap:12}),'The rejected fixed-gap/percentage overflow must fail');
