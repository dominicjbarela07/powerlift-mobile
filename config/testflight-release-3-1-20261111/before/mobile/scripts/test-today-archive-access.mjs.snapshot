import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import path from 'node:path';
const rootFlag = process.argv.indexOf('--candidate-root');
const sourceRoot = rootFlag >= 0 ? path.resolve(process.argv[rootFlag + 1]) : process.cwd();

function harness() {
  const slots=[], effects=[]; let index=0, dirty=false, tree, component;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const react={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'Fragment',
    createContext:value=>({Provider:'Provider',value}),useContext:c=>c.value,
    useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{const next=typeof v==='function'?v(slots[i]):v;if(!Object.is(next,slots[i])){slots[i]=next;dirty=true;}}];},
    useRef(initial){const i=index++;return slots[i]??(slots[i]={current:initial});},
    useMemo(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
    useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
    useEffect(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
  };
  const state={params:{collection:'media',returnTo:'today'},user:{id:82,role:'coach',self_athlete_id:72},subject:{routeParams:{}},routes:[],calls:[],fail:false,
    page:{ok:true,items:[{archive_item_type:'video',source_id:501,title:'Competition Squat',athlete_id:72}],next_cursor:null,total_count:1,movement_facets:[{key:'movement:1',name:'Competition Squat',video_count:30},{key:'movement:2',name:'Competition Bench',video_count:1}]}};
  const theme={SLColors:new Proxy({},{get:()=> '#999'}),SLFontFamilies:{sansSemiBold:'Sans'},SLRadius:{md:12,pill:999},SLSpacing:{lg:20}};
  const api={getAthleteVideoArchive:async()=>({ok:true,json:{ok:true,videos:[]}}),getCoachVideoArchive:async p=>{state.calls.push(['thumbs',p]);return {ok:true,json:{ok:true,videos:[]}};}};
  const archive={ArchiveRequestError:class extends Error{},archiveDetailHref:(type,id,p)=>({type,id,p}),
    fetchArchiveLanding:async()=>({ok:true,recent:[],rediscovery:[],collection_summaries:{training:0,media:1,competition:0},supported_filters:{}}),
    fetchArchiveCollection:async(c,p)=>{state.calls.push([c,p]);if(state.pending)return state.pending;return state.page;},searchArchive:async()=>state.page,
    fetchArchiveDetail:async()=>{if(state.fail)throw Object.assign(new Error('denied'),{status:403});return {item:state.page.items[0]};}};
  const deps={react,'react-native':{View:'View',Pressable:'Pressable',ActivityIndicator:'ActivityIndicator',Image:'Image',StyleSheet:{create:s=>s,hairlineWidth:0.5}},
    '@expo/vector-icons':{Ionicons:'Ionicons'},'expo-router':{useLocalSearchParams:()=>state.params,useRouter:()=>({push:v=>state.routes.push(v),navigate:v=>state.routes.push(v),replace:v=>state.routes.push(v)})},
    '@react-navigation/native':{useFocusEffect:fn=>react.useEffect(fn,[fn])},'@react-native-async-storage/async-storage':{getItem:async()=>null,setItem:async()=>{}},
    '@/components/keyboard/KeyboardSurface':{KeyboardScrollView:'ScrollView'},'@/components/ui/sl-text':{Text:'Text',TextInput:'TextInput'},
    '@/components/ui':{FloatingDisplayUnitRegistration:'Unit',SLCanonicalIcon:'Icon',SLContextualHeader:'Header',SLTrophy:'Trophy',SLProfileAvatar:'Avatar'},
    '@/components/ui/floating-control-coordinator':{FloatingDisplayUnitRegistration:'Unit'},'@/constants/theme':theme,
    '@/lib/api':api,'@/lib/ledger-archive':archive,'./primitives':{SectionLabel:'Label'},'./routing':{ledgerHrefFor:()=> '/(tabs)/ledger/archive'},
    '@/context/AuthContext':{useAuth:()=>({user:state.user})},'./athlete-ledger-subject':{useAthleteLedgerSubject:()=>state.subject},
    '@/lib/surface-weight-unit':{useSurfaceWeightUnit:()=>({unit:'lb',setUnit:()=>{}})},
    '@/lib/display-units':{normalizeDisplayWeightUnit:()=> 'lb',formatWeightFromKg:v=>String(v)},
    '@/components/SetVideoPlayerModal':'VideoPlayer','@/components/home/TodayQuickAccess':{TodayQuickAccess:'QuickAccess'},
    './VideoMovementPicker':{VideoMovementPicker:'MovementPicker'},
    '@/components/sheets/StrengthLedgerBottomSheet':{StrengthLedgerBottomSheet:'Sheet',StrengthLedgerBottomSheetScrollView:'SheetScroll'},
    '@/components/home/HomeTrendPlot':{HomeTrendPlot:'Plot'},'@/components/anatomy/ProgrammingMuscleRegionArt':{ProgrammingMuscleRegionArt:'Anatomy'},'expo-linear-gradient':{LinearGradient:'Gradient'},
    '@/lib/athlete-home-v3':{resolveHomeState:()=> 'rest',distinctNextUpSession:()=>null}};
  function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(sourceRoot,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{module:m,exports:m.exports,require:k=>{if(k.startsWith('@/assets/'))return k;assert.ok(k in deps,k);return deps[k];},__DEV__:false,console,Map,URLSearchParams});return m.exports;}
  async function render(fn=component){component=fn;for(let i=0;i<12;i++){dirty=false;index=0;tree=component();while(effects.length)effects.shift()();await new Promise(r=>setImmediate(r));if(!dirty)break;}return tree;}
  const nodes=n=>n&&typeof n==='object'?[n,...(n.children||[]).flat(Infinity).flatMap(nodes)]:[];
  return {load,render,state,archive,nodes,find:(type)=>nodes(tree).find(n=>n.type===type||n.type?.name===type)};
}

let h=harness();const widget=h.load('components/home/TodayQuickAccess.tsx').TodayQuickAccess;
const actions=[];await h.render(()=>widget({onAction:a=>actions.push(a)}));
const buttons=h.nodes(h.find('View')).filter(n=>n.type==='Pressable');assert.equal(buttons.length,3);
for(const b of buttons)b.props.onPress();assert.deepEqual(actions.map(a=>a.route),['my_videos','training_history','movement_history']);
const routes=h.load('lib/today-history-routes.ts').todayHistoryHref;
assert.deepEqual(JSON.parse(JSON.stringify(routes('my_videos'))),{pathname:'/(tabs)/ledger/archive',params:{collection:'media',returnTo:'today'}});
assert.equal(routes('training_history'),'/(tabs)/workout/session-history');assert.equal(routes('movement_history'),'/(tabs)/workout/movement-history');assert.equal(routes('other'),null);
const home=h.load('components/home/AthleteHomeV3.tsx').AthleteHomeV3;
for(const isIndividual of [false,true]){await h.render(()=>home({today:{date:'2026-10-14'},isIndividual,onAction:()=>{}}));assert.ok(h.find('QuickAccess'),'both roles receive actual shared widgets');}

h=harness();const foundation=h.load('components/ledger/archive-foundation.tsx').ArchiveFoundationExperience;
await h.render(foundation);assert.equal(h.find('ArchiveResults').props.collection,'media');
assert.ok(h.state.calls.some(([name,p])=>name==='thumbs'&&p.athlete_id===72),'self coach thumbnail query uses personal athlete scope');
const video=h.state.page.items[0];h.find('ArchiveResults').props.onItem(video);await h.render();
assert.equal(h.find('VideoPlayer').props.videoId,501);assert.equal(h.find('VideoPlayer').props.visible,true);
assert.equal(h.find('VideoPlayer').props.allowExport,undefined,'server export policy is not overridden');assert.equal(h.state.routes.length,0,'playback stays within collection');
h.find('VideoPlayer').props.onClose();await h.render();assert.equal(h.find('VideoPlayer').props.visible,false);assert.equal(h.find('ArchiveResults').props.collection,'media');
assert.equal(h.find('MovementPicker').props.movements.length,2,'movement choices include evidence beyond the visible video page');
h.find('MovementPicker').props.onSelect(h.state.page.movement_facets[1]);await h.render();
assert.equal(h.state.calls.at(-1)[1].video_movement,'movement:2');assert.equal(h.find('ArchiveResults').props.collection,'media','movement drill-down stays in videos');
h.find('ArchiveResults').props.onItem(video);await h.render();h.find('VideoPlayer').props.onClose();await h.render();assert.equal(h.find('MovementPicker').props.selected.key,'movement:2','closing playback retains movement selection');
h.find('MovementPicker').props.onSelect(null);await h.render();assert.equal(h.state.calls.at(-1)[1].video_movement,undefined,'All movements clears the exact filter');
h.find('Header').props.onBack();assert.equal(h.state.routes.at(-1),'/(tabs)/athlete-dashboard');
let resolve;h.state.pending=new Promise(r=>resolve=r);h.state.params={collection:'training'};await h.render();
h.state.pending=null;h.state.params={collection:'media'};await h.render();resolve({ok:true,items:[{source_id:999}],next_cursor:null});await h.render();
assert.equal(h.find('ArchiveResults').props.items[0].source_id,501,'superseded request cannot replace the selected collection');
h.state.user={id:83,role:'athlete',athlete_id:73};h.state.subject={athleteId:72,routeParams:{},returnPath:'/(tabs)/coach-athlete/72/evidence'};await h.render();
h.find('ArchiveResults').props.onItem(video);await h.render();assert.equal(h.find('VideoPlayer').props.allowExport,false,'scoped roster playback cannot expose own export controls');
h.find('Header').props.onBack();assert.equal(h.state.routes.at(-1),'/(tabs)/coach-athlete/72/evidence');

h=harness();h.state.params={itemType:'video',sourceId:'501',collection:'media',returnTo:'today'};
const detail=h.load('components/ledger/archive-detail.tsx').ArchiveDetailExperience;await h.render(detail);
const play=h.nodes(h.find('Provider')).find(n=>n.props.accessibilityLabel==='Play video');assert.ok(play);play.props.onPress();await h.render();assert.equal(h.find('VideoPlayer').props.videoId,501);assert.equal(h.find('VideoPlayer').props.visible,true);
h.find('VideoPlayer').props.onClose();await h.render();assert.equal(h.find('VideoPlayer').props.visible,false);
h.state.fail=true;h.state.params={...h.state.params,sourceId:'502'};await h.render();assert.equal(h.find('VideoPlayer').props.visible,false);assert.ok(!h.nodes(h.find('Provider')).some(n=>n.props.accessibilityLabel==='Play video'),'403 details offer no playback');
h=harness();const picker=h.load('components/ledger/VideoMovementPicker.tsx').VideoMovementPicker;
let picked;await h.render(()=>picker({movements:h.state.page.movement_facets,selected:null,onSelect:m=>picked=m}));
h.find('Pressable').props.onPress();await h.render();assert.equal(h.find('Sheet').props.visible,true);
const benchRow=h.nodes(h.find('Fragment')).find(n=>n.props.accessibilityLabel?.startsWith('Competition Bench,'));assert.ok(benchRow);benchRow.props.onPress();await h.render();assert.equal(picked.key,'movement:2');assert.equal(h.find('Sheet').props.visible,false);
for(const n of h.nodes(h.find('Fragment')).filter(n=>n.type==='Text'&&['By movement','Competition Bench','Competition Squat'].includes(n.children[0])))assert.ok(n.props.style?.color,'sheet titles and movement labels remain legible on the dark surface');
console.log('PASS: actual Today widgets for athlete/self-coach; all three routes; direct media entry; authorized video IDs; close retains collection; Today/workspace returns; scoped export policy; stale request rejection; direct detail playback; denied detail remains unplayable.');
