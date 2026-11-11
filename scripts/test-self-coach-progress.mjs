import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as records from '../lib/ledger-records.ts';
import * as archive from '../lib/ledger-archive-visuals.ts';
import * as presentation from '../lib/ledger-history-presentation.ts';
import * as fidelity from '../lib/chart-fidelity.ts';
let slots=[], index=0, effects=[];
const react={
  createElement:(type,props,...children)=>({type,props:{...props,children}}),
  useState(initial){const key=index++;if(!(key in slots))slots[key]=typeof initial==='function'?initial():initial;return [slots[key],value=>slots[key]=typeof value==='function'?value(slots[key]):value];},
  useRef(initial){const key=index++;return slots[key]??(slots[key]={current:initial});},
  useMemo(fn,deps){const key=index++;if(!slots[key]||deps.some((dep,i)=>dep!==slots[key].deps[i]))slots[key]={value:fn(),deps};return slots[key].value;},
  useEffect(fn,deps){const key=index++;if(!slots[key]||deps.some((dep,i)=>dep!==slots[key][i])){slots[key]=deps;effects.push(fn);}},
};
react.useLayoutEffect=react.useEffect;
const colors=new Proxy({accent:'#BE99F4'},{get:(target,key)=>target[key]??'#DDDDDD'});
const theme={colors,fonts:{body:'Body',bodyMedium:'Medium',bodySemiBold:'Semibold'},material:{canvas:'#100E16'}};
const paths=[];
const data={loading:false,error:null,progression:{athlete:{id:106},big_three_arc:{lifts:[{key:'squat',strength_lenses:{weight_on_bar:{aggregation:'week',points:[{date:'2026-10-19',value_kg:90,source_set_log_id:101},{date:'2026-10-26',value_kg:100,source_set_log_id:102}]},source_evidence:{recent_sources:[{date:'2026-10-29',weight_kg:100,reps:5,source_set_log_id:102}]}}}]}},currentBests:[{core_movement_key:'competition_squat',metric:'weight',best_value:100,event:{id:1,source_set_log_id:102,event_type:'CORE_WEIGHT_PR',unit:'kg',current_value:100,workout_date:'2026-10-29',evidence:{actual_reps:5}}}],accomplishments:[],reload:()=>{}};
const mocks={
 react,'react-native':{View:'View',Pressable:'Pressable',ActivityIndicator:'Spinner',StyleSheet:{create:value=>value,hairlineWidth:0.5},BackHandler:{addEventListener:()=>({remove(){}})}},
 '@expo/vector-icons':{Ionicons:'Icon'},'expo-router':{useLocalSearchParams:()=>({}),useRouter:()=>({push:value=>paths.push(value)})},
 '@/components/ui/sl-text':{Text:'Text'},'@/components/ui/sl-screen':{SLScreen:'Screen'},'@/components/ui/sl-compact-dropdown':{SLCompactDropdown:'Dropdown'},
 '@/components/keyboard/KeyboardSurface':{KeyboardModal:'Modal',KeyboardScrollView:'Scroll'},'@/components/ui/floating-control-coordinator':{FloatingControlCoordinator:'Coordinator'},
 '@/components/charts/AnalyticalTimeSeriesChart':{AnalyticalTimeSeriesChart:'Chart'},'@/lib/chart-fidelity':fidelity,
 '@/context/AuthContext':{useAuth:()=>({user:{id:111,self_athlete_id:106,preferred_units:'lb'}})},'@/constants/ledger':{LEDGER:theme},
 '@/lib/display-units':{kilogramsToDisplayValue:(kg,unit)=>unit==='lb'?kg*2.20462262185:kg},'@/lib/ledger-records':records,
 '@/lib/ledger-rewards':{canonicalPrHistory:events=>events,resolveLedgerClubsRuntimeState:()=>({lifts:[]})},'@/lib/ledger-movement-art':{ledgerCompetitionArtwork:key=>({canonical:key})},
 '@/lib/movement-history-launch':{movementHistorySheetRouteForCanonicalIdentity:args=>({pathname:'/movement-history-sheet',params:args})},
 '@/lib/surface-weight-unit':{useSurfaceWeightUnit:()=>({unit:'lb',toggleUnit(){}})},'./use-ledger-live-data':{useLedgerLiveData:()=>data},
 './LedgerMovementBackdrop':{LedgerMovementBackdrop:'Backdrop'},'./LedgerHistoryPane':{LedgerHistoryPane:'Archive'},'./archive-detail':{ArchiveDetailExperience:'Detail'},
 './LedgerSourceContent':{LedgerSourceContent:'Source'},'./LedgerExperience':Object.fromEntries(['AccessoryList','CoreRecord','Milestones','TrainingContext','VariantList','VariantRecord'].map(name=>[name,name])),
 '@/lib/ledger-history-presentation':presentation,'@/lib/ledger-archive-visuals':archive,
};
const nodes=tree=>tree==null?[]:Array.isArray(tree)?tree.flatMap(nodes):typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[tree];
const text=tree=>nodes(tree).filter(value=>typeof value==='string'||typeof value==='number').join(' ').replace(/\s+/g,' ').trim();
function load(path){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];},requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){}});return exports;}
const product=load('components/ledger/SelfCoachLedgerExperience.tsx');
const root=product.default();assert.equal(root.props.key,'111:::','Identity changes reset every detail and source sheet');
function render(fn,props){index=0;const tree=fn(props);while(effects.length)effects.shift()();return tree;}
let tree=render(root.type),all=nodes(tree);
const overview=all.find(node=>node.type?.name==='StrengthRecord');assert.ok(overview);
const archiveOwner=all.find(node=>node.type==='Archive');assert.equal(archiveOwner.props.athleteId,undefined,'Self reads omit the coach override');
archiveOwner.props.setFilter('media');tree=render(root.type);assert.equal(nodes(tree).find(node=>node.type==='Archive').props.filter,'media');
overview.props.onDetail('squat');tree=render(root.type);assert.ok(nodes(tree).includes('Competition '));
assert.equal(nodes(tree).filter(node=>node.type==='Archive').length,1,'Evidence navigation retains the mounted archive owner');
const detailView=nodes(tree).find(node=>node.type?.name==='StrengthRecord'&&node.props.fixedLift);assert.equal(detailView.props.fixedLift,'squat');
let opened=[];
slots=[];tree=render(overview.type,{...overview.props,open:source=>opened.push(source)});
let chart=nodes(tree).find(node=>node.type==='Chart');assert.equal(chart.props.metric.unit,'lb');assert.equal(chart.props.showTooltip,false);assert.equal(chart.props.series[0].points[0].value,90*2.20462262185);
chart.props.onPointPress({index:8,values:[{meta:{sourceIndex:0}}]});tree=render(overview.type,{...overview.props,open:source=>opened.push(source)});
assert.ok(text(tree).includes('SELECTED WEEKLY TOP LOAD'));assert.ok(text(tree).includes('Week of Oct 19, 2026'));
assert.ok(!text(tree).includes('× 5 reps'),'An older load without linked rep evidence cannot borrow the all-time best repetitions');
nodes(tree).find(node=>node.props?.accessibilityLabel==='Open original set').props.onPress();assert.deepEqual(opened.at(-1),{type:'set',id:101});
nodes(tree).find(node=>node.type==='Pressable'&&text(node)==='Show all-time best').props.onPress();tree=render(overview.type,{...overview.props,open:source=>opened.push(source)});assert.ok(text(tree).includes('BEST RECORDED LOAD'));
slots=[];tree=render(overview.type,{...overview.props,data:{...data,currentBests:[],progression:null}});assert.ok(!nodes(tree).some(node=>node.type==='Chart'));assert.ok(text(tree).includes('Your strength story starts with a set.'));
const calendar=load('components/ledger/SelfCoachTrainingArchive.tsx').SelfCoachTrainingArchive;
const session={archive_item_type:'session',source_id:7,title:'Lower A',occurred_on:'2026-10-29',performance:{set_count:2,movement_count:1},media:{video_count:1}};
slots=[];let selectedMonth;const cp={items:[session],month:'2026-10',hasMore:true,unit:'kg',onMonth:value=>selectedMonth=value,open:source=>opened.push(source)};
tree=render(calendar,cp);assert.ok(text(tree).includes('Session shown'));assert.ok(text(tree).includes('More evidence is available'));
nodes(tree).find(node=>node.props?.accessibilityLabel==='Oct 29, 2026. 1 loaded Session').props.onPress();tree=render(calendar,cp);assert.ok(text(tree).includes('Show month'));
nodes(tree).find(node=>node.props?.accessibilityLabel==='Open Lower A, Oct 29, 2026').props.onPress();assert.deepEqual(JSON.parse(JSON.stringify(opened.at(-1))),{type:'session',id:7});
tree=render(calendar,cp);assert.ok(text(tree).includes('Show month'),'Evidence return keeps the selected date');
nodes(tree).find(node=>node.props?.accessibilityLabel==='Previous archive month').props.onPress();assert.equal(selectedMonth,'2026-09');
const route=fs.readFileSync('components/ledger/route-screen.tsx','utf8');assert.match(route,/activeMobileMode === 'individual' && !subject\.isWorkspaceScoped/);
assert.throws(()=>assert.match(route.replace("activeMobileMode === 'individual' && !subject.isWorkspaceScoped",'true'),/activeMobileMode === 'individual' && !subject\.isWorkspaceScoped/),'Deliberately leaking Self-Coach composition into another workspace must fail');
assert.throws(()=>assert.ok(text(tree).includes('999 Sessions')),'Invented archive counts must fail');
console.log('PASS Phase 3 actual controllers and renderers. Role/identity boundaries, mounted archive, original source IDs, literal units, weekly labels, missing-rep honesty, sparse history, calendar selection and bounded-page counts. Deliberate scope/count failures rejected.');
const weightPage={items:Array.from({length:24},(_,i)=>({id:i+1,reported_bodyweight_kg:82-i*.1,training_date:'2026-10-29',workout_id:800+i,session:{label:'Lower A'}})),next_cursor:'2026-10-01:24',has_more:true};
let settle,weightCalls=0,failWeights=false;
mocks['./use-ledger-resource']={useLedgerResource:()=>({data:weightPage,loading:false,error:null,load(){}})};
mocks['@/lib/ledger-journey']={fetchReportedBodyweightHistory:args=>{weightCalls++;assert.equal(args.cursor,weightPage.next_cursor);if(failWeights)return Promise.reject(new Error('offline'));return new Promise(resolve=>settle=resolve);}};
const weights=load('components/ledger/LedgerBodyweightHistory.tsx').LedgerBodyweightHistory;
slots=[];let weightTree=render(weights,{unit:'kg',open:source=>opened.push(source)});
const loadEarlier=()=>nodes(weightTree).find(node=>node.type==='Pressable'&&text(node)==='Load earlier reports').props.onPress();
loadEarlier();loadEarlier();assert.equal(weightCalls,1,'Concurrent taps share one bodyweight page request');
settle({items:[weightPage.items[23],{id:25,reported_bodyweight_kg:80,training_date:'2026-09-29',workout_id:825}],next_cursor:null,has_more:false});
await new Promise(resolve=>setImmediate(resolve));
weightTree=render(weights,{unit:'kg',open:source=>opened.push(source)});
assert.ok(text(weightTree).includes('25 reports loaded · complete submitted record'),'Overlapping cursor pages deduplicate immutable report IDs');
nodes(weightTree).find(node=>node.props?.accessibilityLabel==='Bodyweight 80 kg, Sep 29, 2026').props.onPress();assert.equal(opened.at(-1).id,825);
slots=[];failWeights=true;weightTree=render(weights,{unit:'kg',open(){}});loadEarlier();await new Promise(resolve=>setImmediate(resolve));weightTree=render(weights,{unit:'kg',open(){}});assert.ok(text(weightTree).includes('Retry earlier reports'));assert.ok(text(weightTree).includes('24 reports loaded'),'A failed page retains loaded evidence');
console.log('PASS full bodyweight archive, duplicate-tap exclusion, cursor identity, overlap deduplication, original Session links and recoverable page failure.');
