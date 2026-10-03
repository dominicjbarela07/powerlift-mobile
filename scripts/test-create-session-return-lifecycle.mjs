import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real screen and its event handlers while retaining its hook state
// across navigation, which is the user-visible failure observed in Device Hub.
const source = fs.readFileSync(process.env.STRENGTH_LEDGER_CREATE_SCREEN_UNDER_TEST || 'app/(tabs)/create-workout.tsx','utf8');
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
function screen({templateId,failTemplateOnce=false}={}) {
  const hooks=[],effects=[],requests=[],navigation=[];
  let index=0,focus=()=>{},nextId=100,templateAttempts=0;
  const element=(type,props,...children)=>({type,props:{...props,children}});
  const react={createElement:element,
    useState(initial){const i=index++;hooks[i]??={value:typeof initial==='function'?initial():initial};return [hooks[i].value,v=>{hooks[i].value=typeof v==='function'?v(hooks[i].value):v;}];},
    useRef(initial){const i=index++;hooks[i]??={value:{current:initial}};return hooks[i].value;},
    useMemo(factory){index++;return factory();},
    useCallback(callback){index++;return callback;},
    useEffect(callback,deps){const i=index++,old=hooks[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){hooks[i]={deps};effects.push(callback);}},
  };
  const fetchJson=async(path,options)=>{
    requests.push({path,options});
    if(path==='/coach/mobile/roster') return {ok:true,json:{ok:true,athletes:[{id:65,name:'Self Coach QA',is_self:true}]}};
    if(path==='/workouts/mobile/new') return {ok:true,json:{ok:true,workout_id:nextId++}};
    if(path.endsWith('/apply-template')) {templateAttempts++;return failTemplateOnce&&templateAttempts===1?{ok:false,status:500,json:{ok:false,error:'Template unavailable'}}:{ok:true,json:{ok:true}};}
    throw new Error(`Unexpected screen request: ${path}`);
  };
  const theme=new Proxy({},{get:(_t,k)=>k});
  const requireMock=name=>{
    if(name==='react')return {...react,default:react,__esModule:true};
    if(name==='expo-router')return {useRouter:()=>({replace:route=>navigation.push(route),back(){}}),useLocalSearchParams:()=>({athleteId:'65',templateId}),useFocusEffect:cb=>{focus=cb;}};
    if(name==='react-native')return {ActivityIndicator:'ActivityIndicator',Platform:{OS:'ios'},Pressable:'Pressable',StyleSheet:{create:x=>x,hairlineWidth:1},View:'View'};
    if(name==='@expo/vector-icons')return {Ionicons:'Ionicons'};
    if(name==='@react-native-community/datetimepicker')return {default:'DateTimePicker',__esModule:true};
    if(name==='@/lib/api')return {fetchJson};
    if(name==='@/lib/coach-roster-visibility')return {activeCoachingAthletes:rows=>rows};
    if(name==='@/components/keyboard/KeyboardSurface')return {KeyboardAvoidingView:'KeyboardAvoidingView',KeyboardScrollView:'ScrollView'};
    if(name==='@/constants/theme')return {SLColors:theme,SLFontFamilies:theme,SLRadius:theme,SLShadows:theme,SLSpacing:theme};
    if(name==='@/components/ui/sl-text')return {Text:'Text',TextInput:'TextInput'};
    if(name==='@/components/ui/sl-button')return {SLButton:'SLButton'};
    if(name==='@/components/ui/sl-profile-avatar')return {SLProfileAvatar:'SLProfileAvatar'};
    if(name==='@/components/ui/sl-workspace')return {SLMaterialOverlay:'SLMaterialOverlay'};
    throw new Error(`Unexpected screen import: ${name}`);
  };
  const module={exports:{}};
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,Date})(requireMock,module,module.exports);
  const render=()=>{index=0;const node=module.exports.default();while(effects.length)effects.shift()();return node;};
  function find(node,type){if(Array.isArray(node)){for(const child of node){const found=find(child,type);if(found)return found;}}else if(node&&typeof node==='object'){if(node.type===type)return node;return find(node.props?.children,type);}return null;}
  return {render,button:()=>find(render(),'SLButton'),title:()=>find(render(),'TextInput'),focus:()=>focus(),requests,navigation};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const creator=screen();creator.render();await settle();
assert.equal(creator.button().props.disabled,false);
const first=creator.button();first.props.onPress();first.props.onPress();await settle();
assert.equal(creator.requests.filter(r=>r.path==='/workouts/mobile/new').length,1,'double taps must create one draft');
assert.equal(creator.navigation.length,1);
creator.render();creator.focus();
assert.equal(creator.button().props.label,'Create Draft','returning after success must show a fresh enabled form');
assert.equal(creator.button().props.disabled,false);
assert.equal(creator.title().props.editable,true);
creator.button().props.onPress();await settle();
assert.equal(creator.requests.filter(r=>r.path==='/workouts/mobile/new').length,2,'a second explicit creation must create a different Session');
assert.notEqual(creator.navigation[0].params.workoutId,creator.navigation[1].params.workoutId);

const retry=screen({templateId:'template-4',failTemplateOnce:true});retry.render();await settle();
retry.button().props.onPress();await settle();retry.render();retry.focus();
assert.equal(retry.button().props.label,'Retry Template','failed template application must retain the server draft for retry');
assert.equal(retry.title().props.editable,false);
retry.button().props.onPress();await settle();
assert.equal(retry.requests.filter(r=>r.path==='/workouts/mobile/new').length,1,'a template retry must never create a duplicate Session');
assert.equal(retry.requests.filter(r=>r.path.endsWith('/apply-template')).length,2);
assert.equal(retry.navigation[0].params.workoutId,'100');
retry.render();retry.focus();assert.equal(retry.button().props.label,'Create Draft');
console.log('PASS actual Create Session screen: retained-screen return, distinct second creation, double-tap protection, and same-draft template retry');
