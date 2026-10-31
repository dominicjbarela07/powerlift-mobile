import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as navigation from '../lib/ledger-navigation.ts';
import * as dropdownLayout from '../lib/compact-dropdown.ts';
import * as records from '../lib/ledger-records.ts';
import * as rewards from '../lib/ledger-rewards.ts';
const {LEDGER_DESTINATIONS,LEDGER_CHAPTERS,ledgerContextOptions,ledgerContextDestination,ledgerNavigationLocation}=navigation;
const initial={section:'records',family:'core',history:'training'};
assert.equal(LEDGER_DESTINATIONS.length,9);assert.equal(new Set(LEDGER_DESTINATIONS.map(d=>d.key)).size,9);
assert.deepEqual(LEDGER_CHAPTERS.map(c=>c.key),['records','history','milestones']);
for(const section of ['records','history']){
 const choices=ledgerContextOptions(section);
 assert.equal(choices.length,section==='records'?3:5);
 for(const destination of LEDGER_DESTINATIONS)assert.equal(ledgerContextDestination(section,destination.key),destination.section===section?destination:null);
 assert.equal(ledgerContextDestination(section,'../../admin'),null);
}

let slots=[],index=0,keyboardDismissals=0,keyboardVisible=false,width=390,height=844,effects=[],frameCalls=0;
const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(value){const i=index++;return slots[i]??(slots[i]={current:value});},useMemo(fn,deps){const i=index++,previous=slots[i];if(!previous||deps.some((d,j)=>d!==previous.deps[j]))slots[i]={deps,value:fn()};return slots[i].value;},useCallback(fn,deps){return react.useMemo(()=>fn,deps);},useEffect:()=>{},useLayoutEffect:()=>{}};
const token=new Proxy({},{get:(_,key)=>String(key)}),theme={colors:token,material:token,fonts:token,type:token,radius:token};
const mocks={react,'react-native':{Keyboard:{dismiss:()=>keyboardDismissals++},View:'View',Pressable:'Pressable',StyleSheet:{create:x=>x,hairlineWidth:1,absoluteFill:{}},useWindowDimensions:()=>({width,height,fontScale:1})},'@expo/vector-icons':{Ionicons:'Icon'},'expo-haptics':{selectionAsync:async()=>{}},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:59,bottom:34,left:0,right:0})},'@/components/keyboard/keyboard-state':{useKeyboardState:()=>({visible:keyboardVisible})},'@/components/keyboard/KeyboardSurface':{KeyboardModal:'Modal',KeyboardScrollView:'Scroll'},'@/components/ui/sl-text':{Text:'Text',TextInput:'Input'},'./sl-text':{Text:'Text'},'./sl-motion':{SLMotionPressable:'MotionPressable'},'@/components/ui/sl-motion':{SLMotionPressable:'MotionPressable',SLMotionEntrance:'Entrance'},'@/constants/ledger':{LEDGER:theme},'@/constants/theme':{SLColors:token},'@/lib/ledger-navigation':navigation,'@/lib/compact-dropdown':dropdownLayout,'@/components/ui/sl-compact-dropdown':{SLCompactDropdown:'Dropdown'}};
function load(path){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>{assert.ok(key in mocks,key);return mocks[key];},requestAnimationFrame:fn=>{frameCalls++;fn();return frameCalls;},cancelAnimationFrame:()=>{}});return exports;}
const nodes=tree=>tree==null||tree===false?[]:Array.isArray(tree)?tree.flatMap(nodes):typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[tree];
const byID=(tree,id)=>nodes(tree).find(n=>n.props?.testID===id);
const component=load('components/ledger/LedgerViewNavigation.tsx').LedgerViewNavigation;
let chosen=[];
for(const chapter of LEDGER_CHAPTERS){
 const tree=component({section:chapter.key,onSectionChange:next=>chosen.push(next)}),tabs=nodes(tree).filter(n=>n.props?.accessibilityRole==='tab');
 assert.equal(tabs.length,3);assert.equal(nodes(tree).filter(n=>n.props?.accessibilityRole==='tablist').length,1);
 assert.equal(tabs.filter(n=>n.props.accessibilityState.selected).length,1);
 for(const tab of tabs){assert.ok(tab.props.style[0].minHeight>=44);tab.props.onPress();}
 assert.deepEqual(chosen.splice(0),['records','history','milestones'],'Primary taps switch directly with no modal/menu');
 assert.ok(!nodes(tree).some(n=>['Modal','Sheet','Dropdown'].includes(n.type)));
}
assert.equal(keyboardDismissals,9);
const filter=load('components/ledger/LedgerContextFilter.tsx').LedgerContextFilter;
let filterProps;
for(const destination of LEDGER_DESTINATIONS.filter(d=>d.section!=='milestones')){
 const changes=[],section=destination.section;
 const tree=filter({section,value:section==='records'?destination.family:destination.filter,onChange:v=>changes.push(v)});
 filterProps=tree.props;
 assert.equal(tree.type,'Dropdown');assert.equal(filterProps.appearance,'ledger');assert.equal(filterProps.value,destination.key);
 assert.equal(filterProps.options.length,section==='records'?3:5);
 for(const choice of filterProps.options){filterProps.onValueChange(choice.value);const expected=ledgerContextDestination(section,choice.value);assert.equal(changes.at(-1),section==='records'?expected.family:expected.filter);}
 const count=changes.length;for(const foreign of LEDGER_DESTINATIONS.filter(d=>d.section!==section))filterProps.onValueChange(foreign.key);
 filterProps.onValueChange('../../admin');assert.equal(changes.length,count,'A scoped filter cannot cross chapters or accept arbitrary routes');
}
console.log('PASS: actual visible three-chapter control, direct one-tap actions, selected/accessibility state, 44-point targets, scoped 3/5-option dropdowns and foreign-choice rejection.');

// Execute the shared measured dropdown, including keyboard, dismissal and rotation.
react.useEffect=(fn,deps)=>{const i=index++,previous=slots[i];if(!previous||deps.some((d,j)=>d!==previous.deps[j])){previous?.cleanup?.();effects.push(()=>{slots[i]={deps,cleanup:fn()};});}};
const dropdown=load('components/ui/sl-compact-dropdown.tsx').SLCompactDropdown;
const dp={...filterProps,onValueChange:value=>chosen.push(value)};
function renderDropdown(fresh=false){if(fresh){slots=[];effects=[];}index=0;const tree=dropdown(dp);while(effects.length)effects.shift()();return tree;}
let tree=renderDropdown(true),measured=0;
slots[0].current={measureInWindow:fn=>{measured++;fn(22,210,130,44);}};
byID(tree,dp.testID).props.onPress();tree=renderDropdown();let modal=nodes(tree).find(n=>n.type==='Modal');assert.equal(modal.props.visible,true);assert.equal(modal.props.transparent,true);
let menu=byID(tree,dp.menuTestID),position=menu.props.style.at(-1);assert.equal(position.left,22);assert.equal(position.top,261,'Menu opens seven points below the actual trigger, not at the bottom');
assert.equal(nodes(tree).filter(n=>n.props?.accessibilityState?.selected).length,1);
chosen=[];byID(tree,'ledger-history-media').props.onPress();tree=renderDropdown();assert.equal(nodes(tree).find(n=>n.type==='Modal').props.visible,false);assert.deepEqual(chosen,['history:media']);
byID(tree,dp.testID).props.onPress();tree=renderDropdown();byID(tree,`${dp.testID}-backdrop`).props.onPress();tree=renderDropdown();assert.equal(nodes(tree).find(n=>n.type==='Modal').props.visible,false);assert.equal(chosen.length,1,'Outside dismissal is neutral');
byID(tree,dp.testID).props.onPress();tree=renderDropdown();nodes(tree).find(n=>n.type==='Modal').props.onRequestClose();tree=renderDropdown();assert.equal(nodes(tree).find(n=>n.type==='Modal').props.visible,false);
keyboardVisible=true;tree=renderDropdown();const beforeMeasure=measured;byID(tree,dp.testID).props.onPress();tree=renderDropdown();assert.equal(measured,beforeMeasure,'Do not measure while keyboard avoidance owns the viewport');assert.equal(nodes(tree).find(n=>n.type==='Modal').props.visible,false);
height=600;renderDropdown();keyboardVisible=false;height=844;renderDropdown();tree=renderDropdown();assert.equal(measured,beforeMeasure+1);assert.equal(nodes(tree).find(n=>n.type==='Modal').props.visible,true);
width=844;height=390;renderDropdown();tree=renderDropdown();assert.equal(nodes(tree).find(n=>n.type==='Modal').props.visible,false,'Rotation closes an obsolete window-space anchor');
for(const [vw,vh,anchor] of [[320,568,{x:250,y:460,width:60,height:44}],[390,844,{x:22,y:210,width:130,height:44}],[844,390,{x:740,y:300,width:90,height:44}]]){
 const layout=dropdownLayout.resolveCompactDropdownLayout({anchor,estimatedHeight:256,insets:{top:44,bottom:34,left:0,right:0},minWidth:208,preferredMaxHeight:304,viewportWidth:vw,viewportHeight:vh});
 assert.ok(layout.left>=8);assert.ok(layout.left+layout.width<=vw-8);assert.ok(layout.top>=52);assert.ok(layout.top+layout.maxHeight<=vh-42);if(anchor.y>400)assert.equal(layout.placement,'above');
}
assert.throws(()=>assert.equal(position.top,844-256),'Deliberately replacing the anchored menu with bottom placement must fail');
dp.appearance=undefined;tree=renderDropdown(true);assert.equal(byID(tree,dp.testID).props.hitSlop,undefined);assert.ok(!byID(tree,dp.testID).props.style[2],'Calendar/default presentation stays unchanged');
console.log('PASS: actual shared dropdown trigger measurement, near-touch placement, selected rows, choice/outside/back close, keyboard wait, rotation invalidation and narrow-phone/landscape collisions.');

// Execute the normal authenticated Ledger controller; no alternate route/data provider.
react.useLayoutEffect=react.useEffect;
mocks['react-native'].BackHandler={addEventListener:()=>({remove:()=>{}})};
const liveData={currentBests:[],accomplishments:[],progression:{athlete:{id:68}},loading:false,error:null};
Object.assign(mocks,{
 'expo-router':{useLocalSearchParams:()=>({}),useRouter:()=>({push:()=>{},navigate:()=>{}})},
 '@/context/AuthContext':{useAuth:()=>({user:{id:78,athlete_id:68,role:'athlete'}})},'./athlete-ledger-subject':{useAthleteLedgerSubject:()=>({})},
 '@/components/ui/sl-screen':{SLScreen:'Screen'},'@/components/ui/floating-control-coordinator':{FloatingControlCoordinator:'Coordinator'},
 '@/lib/ledger-records':records,'@/lib/ledger-rewards':rewards,'@/lib/ledger-data':{},'@/lib/display-units':{},'@/components/charts/AnalyticalTimeSeriesChart':{},'@/lib/chart-fidelity':{},'@/lib/ledger-history-presentation':{},
 '@/lib/ledger-exploration':{},'@/lib/ledger-variants':{},'@/lib/movement-history-launch':{},'@/lib/surface-weight-unit':{useSurfaceWeightUnit:()=>({unit:'kg',toggleUnit:()=>{}})},
 './use-ledger-live-data':{useLedgerLiveData:()=>liveData},'./use-ledger-resource':{},'./archive-detail':{ArchiveDetailExperience:'Detail'},'./LedgerSourceContent':{},'./LedgerCollections':{},
 './LedgerHistoryPane':{LedgerHistoryPane:'HistoryPane'},'./LedgerContextFilter':{LedgerContextFilter:'ContextFilter'},'./LedgerVisuals':{LedgerRecordCard:'RecordCard',LedgerTrainingRhythm:'Rhythm'},'./LedgerMovementBackdrop':{},'./LedgerViewNavigation':{LedgerViewNavigation:'ViewNavigation'},'@/lib/ledger-movement-art':{},
});
slots=[];index=0;const root=load('components/ledger/LedgerExperience.tsx').default();const connected=root.type;
const scrollCalls=[];
function renderApp(){index=0;const tree=connected();const scroller=nodes(tree).find(n=>n.type==='Scroll');scroller.props.ref.current={scrollTo:args=>scrollCalls.push(args)};while(effects.length)effects.shift()();return tree;}
function scrolled(tree,y){nodes(tree).find(n=>n.type==='Scroll').props.onScroll({nativeEvent:{contentOffset:{y}}});}
function assertNavigation(tree){const all=nodes(tree);assert.equal(all.filter(n=>n.type==='ViewNavigation').length,1,'Exactly one visible primary navigation owner');assert.ok(!all.some(n=>n.props?.accessibilityRole==='tablist'),'Do not introduce a second stacked navigation rail');assert.ok(!all.some(n=>n.type==='Sheet'),'Local navigation cannot become a bottom sheet');assert.ok(all.findIndex(n=>n.type==='ViewNavigation')<all.findIndex(n=>n.type==='Scroll'),'Primary navigation remains visible while scrolling');}
const chapter=(tree,next)=>nodes(tree).find(n=>n.type==='ViewNavigation').props.onSectionChange(next);
effects=[];tree=renderApp();assertNavigation(tree);
scrolled(tree,420);chapter(tree,'history');tree=renderApp();assert.equal(scrollCalls.at(-1).y,0);scrolled(tree,80);chapter(tree,'records');tree=renderApp();assert.equal(scrollCalls.at(-1).y,420,'The actual controller restores each chapter position');
for(const family of ['core','variants','accessories']){
 nodes(tree).find(n=>n.type==='ContextFilter').props.onChange(family);tree=renderApp();assertNavigation(tree);
 assert.equal(nodes(tree).find(n=>n.type==='ContextFilter').props.value,family);
 chapter(tree,'history');tree=renderApp();let pane=nodes(tree).find(n=>n.type==='HistoryPane');assert.equal(pane.props.unit,'kg');assert.equal(pane.props.athleteId,undefined);assert.equal(pane.props.subject,'78:68');
 for(const choice of ledgerContextOptions('history')){pane.props.setFilter(choice.filter);tree=renderApp();pane=nodes(tree).find(n=>n.type==='HistoryPane');assert.equal(pane.props.filter,choice.filter);}
 chapter(tree,'milestones');tree=renderApp();assertNavigation(tree);
 chapter(tree,'records');tree=renderApp();assert.equal(nodes(tree).find(n=>n.type==='ContextFilter').props.value,family,'A chapter round trip retains the Records group');assert.equal(nodes(tree).find(n=>n.type==='HistoryPane').props.filter,'competition','Mounted archive state remains attached');
}
nodes(tree).find(n=>n.type==='ContextFilter').props.onChange('core');tree=renderApp();nodes(tree).find(n=>n.type==='RecordCard').props.onPress();tree=renderApp();
let detail=nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='CoreRecord');assert.ok(detail);const lift=detail.props.lift;scrolled(tree,140);
chapter(tree,'history');tree=renderApp();chapter(tree,'records');tree=renderApp();detail=nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='CoreRecord');assert.equal(detail.props.lift,lift,'Switching chapters cannot discard a connected drill-down');assert.equal(scrollCalls.at(-1).y,140,'Connected detail restores its own scroll position');
chapter(tree,'records');tree=renderApp();assert.ok(nodes(tree).some(n=>typeof n.type==='function'&&n.type.name==='CoreRecord'),'Reselecting a chapter does not silently reset its local selection');
detail.props.back();tree=renderApp();assert.ok(!nodes(tree).some(n=>typeof n.type==='function'&&n.type.name==='CoreRecord'));assert.equal(nodes(tree).find(n=>n.type==='ContextFilter').props.value,'core');assert.equal(scrollCalls.at(-1).y,420,'Detail Back restores the Core collection position');
const entrance=nodes(tree).find(n=>n.type==='Entrance');assert.equal(entrance.props.key,undefined,'Canonical motion must not remount cached views');assert.equal(typeof entrance.props.motionKey,'string');
assert.throws(()=>assertNavigation([tree,{type:'View',props:{accessibilityRole:'tablist'}}]),'Restoring the rejected stacked rail must fail');assert.throws(()=>assertNavigation({type:'View',props:{children:[]}}),'Removing the persistent navigation must fail');assert.throws(()=>assertNavigation([tree,{type:'Sheet',props:{}}]),'A navigation bottom sheet must fail');
const film={...initial,section:'history',history:'media'};
assert.equal(ledgerNavigationLocation(film),ledgerNavigationLocation({...film,family:'variants'},{lift:'squat',context:true}));
assert.notEqual(ledgerNavigationLocation(film),ledgerNavigationLocation({...film,history:'training'}));assert.notEqual(ledgerNavigationLocation(initial),ledgerNavigationLocation(initial,{lift:'squat'}));
const product=fs.readFileSync('components/ledger/LedgerExperience.tsx','utf8');assert.match(product,/offsets\.current\[location\]/);assert.match(product,/restoringScroll\.current/);assert.match(product,/<Back label="Core lifts"/);
console.log('PASS: actual normal Ledger controller; all nine destinations, retained detail/family/archive state, athlete/unit scope, Back to Core lifts, independent restoration keys, canonical motion without remount and deliberate bottom-sheet/stacked-rail/removal failures.');
