import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as navigation from '../lib/ledger-navigation.ts';
import * as records from '../lib/ledger-records.ts';
import * as rewards from '../lib/ledger-rewards.ts';
const {LEDGER_DESTINATIONS,currentLedgerDestination,selectLedgerDestination,ledgerNavigationLocation}=navigation;
const initial={section:'records',family:'core',history:'training'};
assert.equal(LEDGER_DESTINATIONS.length,9);assert.equal(new Set(LEDGER_DESTINATIONS.map(d=>d.key)).size,9);
for(const destination of LEDGER_DESTINATIONS){
 const next=selectLedgerDestination(initial,destination.key);
 assert.equal(currentLedgerDestination(next).key,destination.key,'Every leaf must open directly');
 assert.equal(next.section,destination.section);
 if(destination.section==='records')assert.equal(next.history,'training');
 if(destination.section==='history')assert.equal(next.family,'core');
}
const film=selectLedgerDestination(initial,'history:media');
assert.equal(selectLedgerDestination(film,'records:variants').history,'media','Another chapter retains the last archive collection');
assert.equal(selectLedgerDestination(initial,'../../admin'),initial,'Unknown choices cannot become arbitrary routes');

let slots=[],index=0,keyboardDismissals=0,height=912,fontScale=1;
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(value){const i=index++;return slots[i]??(slots[i]={current:value});},useEffect:()=>{},useLayoutEffect:()=>{}};
const token=new Proxy({},{get:(_,key)=>String(key)}),theme={colors:token,material:token,fonts:token,type:token,radius:token};
const mocks={react,'react-native':{Keyboard:{dismiss:()=>keyboardDismissals++},View:'View',Pressable:'Pressable',StyleSheet:{create:x=>x},useWindowDimensions:()=>({height,fontScale})},'@expo/vector-icons':{Ionicons:'Icon'},'@/components/ui/sl-text':{Text:'Text',TextInput:'Input'},'@/constants/ledger':{LEDGER:theme},'@/components/sheets/StrengthLedgerBottomSheet':{StrengthLedgerBottomSheet:'Sheet',StrengthLedgerBottomSheetScrollView:'SheetScroll'},'@/lib/ledger-navigation':navigation};
function load(path){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>{assert.ok(key in mocks,key);return mocks[key];}});return exports;}
const nodes=tree=>tree==null||tree===false?[]:Array.isArray(tree)?tree.flatMap(nodes):typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[tree];
const component=load('components/ledger/LedgerViewNavigation.tsx').LedgerViewNavigation;
let chosen=[];
function renderNav(state=initial,fresh=false){if(fresh)slots=[];index=0;return component({state,onSelect:destination=>chosen.push(destination)});}
let tree=renderNav(initial,true),trigger=nodes(tree).find(n=>n.props?.testID==='ledger-view-trigger');
assert.equal(trigger.props.accessibilityState.expanded,false);assert.ok(trigger.props.style.minHeight>=44);assert.equal(trigger.props.style.borderWidth,undefined);
trigger.props.onPress();tree=renderNav();assert.ok(keyboardDismissals);assert.equal(nodes(tree).find(n=>n.type==='Sheet').props.visible,true);
nodes(tree).find(n=>n.type==='Sheet').props.onDismiss();tree=renderNav();assert.equal(chosen.length,0,'Dismissing a chooser cannot switch the current view');
for(const destination of LEDGER_DESTINATIONS){
 chosen=[];tree=renderNav(initial,true);nodes(tree).find(n=>n.props?.testID==='ledger-view-trigger').props.onPress();tree=renderNav();
 let dismissals=0;slots[1].current={dismiss:()=>dismissals++};
 const choices=nodes(tree).filter(n=>n.props?.testID&&LEDGER_DESTINATIONS.some(d=>d.testID===n.props.testID));assert.equal(choices.length,9);
 const target=choices.find(n=>n.props.testID===destination.testID);assert.equal(target.props.style({pressed:false})[0].minHeight,48);
 target.props.onPress();choices.find(n=>n.props.testID!==destination.testID).props.onPress();assert.equal(dismissals,1,'A double tap cannot replace an in-flight selection');assert.equal(chosen.length,0,'Navigate after the governed sheet finishes closing');
 const sheet=nodes(tree).find(n=>n.type==='Sheet');sheet.props.onDismiss();sheet.props.onDismiss();assert.equal(chosen.length,1);assert.equal(chosen[0].key,destination.key);
 tree=renderNav(selectLedgerDestination(initial,destination.key));trigger=nodes(tree).find(n=>n.props?.testID==='ledger-view-trigger');assert.ok(trigger.props.accessibilityLabel.includes(destination.label));assert.equal(trigger.props.accessibilityState.expanded,false);
 const selected=nodes(tree).filter(n=>n.props?.accessibilityState?.selected);assert.equal(selected.length,1);assert.equal(selected[0].props.testID,destination.testID);
}
for([height,fontScale] of [[568,1],[844,1],[912,1],[912,1.8]]){tree=renderNav(initial,true);const sheet=nodes(tree).find(n=>n.type==='Sheet');assert.ok(sheet.props.heightFraction<=.93);assert.ok(sheet.props.heightFraction>0);}
console.log('PASS: actual current-view control and chooser; all nine direct destinations, truthful chapter/selection, 48-point rows, keyboard dismissal, cancel neutrality, close-before-navigate, rapid-tap isolation and bounded sheet sizing.');

// Execute the real app controller through its normal authenticated component.
const liveData={currentBests:[],accomplishments:[],progression:{athlete:{id:68}},loading:false,error:null};
Object.assign(mocks,{
 '@expo/vector-icons':{Ionicons:'Icon'},'expo-router':{useLocalSearchParams:()=>({}),useRouter:()=>({push:()=>{},navigate:()=>{}})},
 '@/context/AuthContext':{useAuth:()=>({user:{id:78,athlete_id:68,role:'athlete'}})},'./athlete-ledger-subject':{useAthleteLedgerSubject:()=>({})},
 '@/components/ui/sl-screen':{SLScreen:'Screen'},'@/components/keyboard/KeyboardSurface':{KeyboardModal:'Modal',KeyboardScrollView:'Scroll'},'@/components/ui/floating-control-coordinator':{FloatingControlCoordinator:'Coordinator'},
 '@/lib/ledger-records':records,'@/lib/ledger-rewards':rewards,'@/lib/ledger-data':{},'@/lib/display-units':{},'@/components/charts/AnalyticalTimeSeriesChart':{},'@/lib/chart-fidelity':{},'@/lib/ledger-history-presentation':{},
 '@/lib/ledger-exploration':{},'@/lib/ledger-variants':{},'@/lib/movement-history-launch':{},'@/lib/surface-weight-unit':{useSurfaceWeightUnit:()=>({unit:'kg',toggleUnit:()=>{}})},
 './use-ledger-live-data':{useLedgerLiveData:()=>liveData},'./use-ledger-resource':{},'./archive-detail':{ArchiveDetailExperience:'Detail'},'./LedgerSourceContent':{},'./LedgerCollections':{},
 './LedgerHistoryPane':{LedgerHistoryPane:'HistoryPane'},'./LedgerVisuals':{LedgerRecordCard:'RecordCard',LedgerTrainingRhythm:'Rhythm'},'./LedgerMovementBackdrop':{},'./LedgerViewNavigation':{LedgerViewNavigation:'ViewNavigation'},'@/lib/ledger-movement-art':{},
});
slots=[];index=0;const root=load('components/ledger/LedgerExperience.tsx').default();const connected=root.type;
function renderApp(){index=0;return connected();}
function assertNavigation(tree){const all=nodes(tree);assert.equal(all.filter(n=>n.type==='ViewNavigation').length,1,'Exactly one current-view navigation owner');assert.ok(!all.some(n=>n.props?.accessibilityRole==='tablist'),'The rejected stacked tab bars cannot return');assert.ok(all.findIndex(n=>n.type==='ViewNavigation')<all.findIndex(n=>n.type==='Scroll'),'Navigation must remain visible when content scrolls');}
tree=renderApp();assertNavigation(tree);
for(const destination of LEDGER_DESTINATIONS){
 nodes(tree).find(n=>n.type==='ViewNavigation').props.onSelect(destination);tree=renderApp();assertNavigation(tree);
 const current=nodes(tree).find(n=>n.type==='ViewNavigation').props.state;assert.equal(currentLedgerDestination(current).key,destination.key);
 if(destination.section==='history'){
  const pane=nodes(tree).find(n=>n.type==='HistoryPane');assert.equal(pane.props.filter,destination.filter);assert.equal(pane.props.unit,'kg');assert.equal(pane.props.athleteId,undefined,'Own athlete navigation cannot add a coach override');assert.equal(pane.props.subject,'78:68');
 }
}
// A direct chapter selection exits an existing deep Records drill-down.
nodes(tree).find(n=>n.type==='ViewNavigation').props.onSelect(LEDGER_DESTINATIONS[0]);tree=renderApp();nodes(tree).find(n=>n.type==='RecordCard').props.onPress();tree=renderApp();assert.ok(nodes(tree).some(n=>typeof n.type==='function'&&n.type.name==='CoreRecord'));
nodes(tree).find(n=>n.type==='ViewNavigation').props.onSelect(LEDGER_DESTINATIONS[1]);tree=renderApp();assert.ok(!nodes(tree).some(n=>typeof n.type==='function'&&n.type.name==='CoreRecord'));assert.ok(nodes(tree).some(n=>typeof n.type==='function'&&n.type.name==='VariantList'));
assert.throws(()=>assertNavigation([tree,{type:'View',props:{accessibilityRole:'tablist'}}]),'Deliberately restoring the rejected tab rail must fail');assert.throws(()=>assertNavigation({type:'View',props:{children:[]}}),'Removing the persistent navigation must fail');
console.log('PASS: actual normal Ledger controller; all nine destination transitions, retained athlete/unit scope, direct exit from Core detail to Variants, persistent navigation and deliberate stacked-rail/navigation-removal failures.');

assert.equal(ledgerNavigationLocation(film),ledgerNavigationLocation({...film,family:'variants'},{lift:'squat',context:true}),'Inactive Records detail cannot erase the Film position');
assert.notEqual(ledgerNavigationLocation(film),ledgerNavigationLocation({...film,history:'training'}));
assert.notEqual(ledgerNavigationLocation(initial),ledgerNavigationLocation(initial,{lift:'squat'}));
assert.equal(ledgerNavigationLocation({...initial,section:'milestones'}),'milestones');
