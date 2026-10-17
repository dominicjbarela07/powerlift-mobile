import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { reportWeekOf, reportWeekEnd, moveReportWeek, shareTrainingWeekPdf } from '../lib/training-week-report.ts';

assert.equal(reportWeekOf('2026-10-18'), '2026-10-12');
assert.equal(reportWeekOf('2027-01-01'), '2026-12-28');
assert.equal(reportWeekEnd('2026-12-28'), '2027-01-03');
assert.equal(reportWeekEnd('2026-08-31'), '2026-09-06');
assert.equal(moveReportWeek('2026-12-28', 1), '2027-01-04');
const payload = { ok: true, filename: 'Strength-Ledger-Training-Week-2026-10-12.pdf', pdf_base64: 'JVBERi0x', page_count: 1,
  report: { athlete_name: 'Avery', week_label: 'Oct 12 - Oct 18', week_start: '2026-10-12', week_end: '2026-10-18', summary: { session_count: 1, set_count: 3, recorded_duration_seconds: 3000, duration_session_count: 1 }, sessions: [] } };
const calls = [];
const io = { available: async () => true, write: async (base64, name) => { calls.push(['write', base64, name]); return 'file:///private/test.pdf'; },
  share: async uri => { calls.push(['share', uri]); }, remove: async uri => { calls.push(['remove', uri]); } };
await shareTrainingWeekPdf(payload, 7, io);
assert.equal(calls[0][1], payload.pdf_base64); assert.match(calls[0][2], /^7-\d+\/Strength-Ledger/);
assert.deepEqual(calls.map(c => c[0]), ['write', 'share', 'remove']);
calls.length = 0;
await assert.rejects(() => shareTrainingWeekPdf(payload, 7, { ...io, share: async () => { throw new Error('cancelled'); } }), /cancelled/);
assert.deepEqual(calls.map(c => c[0]), ['write', 'remove'], 'cancelled native shares still clean the private cache');
calls.length = 0;
await assert.rejects(() => shareTrainingWeekPdf(payload, 7, { ...io, available: async () => false }), /not available/);
assert.equal(calls.length, 0);
await assert.rejects(() => shareTrainingWeekPdf({ ...payload, pdf_base64: 'not-a-pdf' }, 7, io), /Prepare/);

// Execute the actual route and its real effects against controlled transport:
// stale account responses must never expose or share another athlete's PDF.
let cursor=0, dirty=false, tree; const slots=[], effects=[];
let user={ id: 7, preferred_units: 'lb' }; let pending=null; let denied=false; let requestCount=0;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
const react={ createElement:(type,props,...children)=>({type,props:props||{},children}),
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{const n=typeof v==='function'?v(slots[i]):v;if(n!==slots[i]){slots[i]=n;dirty=true;}}];},
 useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},
 useCallback(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,fn};return slots[i].fn;},
 useEffect(fn,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}
};
const deps={react,'react-native':{ View:'View', Pressable:'Pressable', Image:'Image', ActivityIndicator:'Spinner', StyleSheet:{create:s=>s}},
 'expo-router':{useLocalSearchParams:()=>({weekOf:'2026-10-12'}),useRouter:()=>({canGoBack:()=>false,replace(){}}),useFocusEffect:fn=>react.useEffect(fn,[fn])},
 '@expo/vector-icons':{Ionicons:'Icon'},'expo-linear-gradient':{LinearGradient:'Gradient'},'expo-sharing':{},'expo-file-system/legacy':{},'expo-haptics':{},
 'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:20})},'@/components/keyboard/KeyboardSurface':{KeyboardScrollView:'Scroll'},
 '@/components/ui/sl-text':{Text:'Text'},'@/context/AuthContext':{useAuth:()=>({user,token:'private-test-token'})},
 '@/constants/theme':{SLColors:new Proxy({},{get:()=> '#ffffff'})},'@/lib/training-week-report':{reportWeekOf,reportWeekEnd,moveReportWeek,shareTrainingWeekPdf,reportDuration:()=> '50 min'},
 '@/lib/api':{fetchJson:async url=>{requestCount++;assert.ok(url.startsWith('/athletes/mobile/training-week-report?'));if(pending)return pending;return denied?{ok:false,json:{ok:false,error:'Denied'}}:{ok:true,json:structuredClone(payload)};}}
};
const module={exports:{}};
const source=fs.readFileSync('app/(tabs)/training-week-report.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
vm.runInNewContext(code,{module,exports:module.exports,require:key=>{assert.ok(key in deps,key);return deps[key];},AbortController,URLSearchParams,Date,console});
async function render(){for(let n=0;n<15;n++){dirty=false;cursor=0;tree=module.exports.default();while(effects.length)effects.shift()();await new Promise(r=>setImmediate(r));if(!dirty)break;}}
const nodes=n=>n&&typeof n==='object'?[n,...(n.children||[]).flat(Infinity).flatMap(nodes)]:[];
const shareButton=()=>nodes(tree).find(n=>n.props?.accessibilityLabel==='Share training week PDF');
await render();assert.equal(shareButton().props.disabled,false);assert.equal(requestCount,1);
let resolve;pending=new Promise(r=>{resolve=r;});user={id:9,preferred_units:'lb'};
await render();assert.equal(shareButton().props.disabled,true,'old account PDF hidden immediately');
user={id:10,preferred_units:'lb'};denied=true;pending=null;await render();
resolve({ok:true,json:payload});await render();assert.equal(shareButton().props.disabled,true,'obsolete successful PDF cannot reopen sharing after denial/account change');
const calendar=fs.readFileSync('app/(tabs)/athlete-calendar.tsx','utf8');
assert.match(calendar,/onShareWeek=\{\(\) => router\.push\(/);assert.match(calendar,/weekOf: selectedDate/);
assert.match(fs.readFileSync('components/calendar/AthleteCalendarStoryboardV2.tsx','utf8'),/accessibilityLabel="Share training week"/);
console.log('PASS: calendar weeks/month-year boundaries; actual route cold/account/obsolete/denied handling; private PDF write/share/cancel cleanup; Calendar entrypoint.');
